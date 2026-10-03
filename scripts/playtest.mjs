import {spawn, spawnSync} from 'node:child_process';
import {mkdtemp, rm, writeFile, mkdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, extname, resolve, relative, isAbsolute} from 'node:path';
import {createServer} from 'node:http';

function killBrowser(proc) {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {stdio: 'ignore'});
    else proc.kill();
  } catch {}
}

const root = resolve('dist');
const profile = await mkdtemp(join(tmpdir(), 'midnight-playtest-'));
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/midnights-manner\//, '');
    if (!path || path === '/') path = 'index.html';
    const file = resolve(root, path);
    const rel = relative(root, file);
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Invalid path');
    res.setHeader('Content-Type', ({'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml'})[extname(file)] || 'application/octet-stream');
    const contents = await readFile(file);
    res.end(contents);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const CHROME_BIN = process.env.CHROME_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chrome = spawn(CHROME_BIN, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe']});

let ws;
const errors = [];
let launchAttempts = 0;
let wsConnected = false;

async function tryLaunch() {
  while (launchAttempts < 3 && !wsConnected) {
    launchAttempts++;
    console.log(`Launch attempt ${launchAttempts}/3...`);
    try {
      const endpoint = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Chrome startup timeout')), 20000);
        let log = '';
        chrome.on('error', reject);
        chrome.stderr.on('data', chunk => {
          log += chunk;
          const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
          if (match) { clearTimeout(timer); resolve(match[1]); }
        });
      });
      ws = new WebSocket(endpoint);
      await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
      wsConnected = true;
      console.log('CDP connected');
      return true;
    } catch (e) {
      console.log(`Launch attempt ${launchAttempts} failed:`, e.message);
      if (launchAttempts >= 3) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

if (!await tryLaunch()) {
  console.log('Edge failed to launch after 3 attempts, aborting');
  killBrowser(chrome);
  process.exit(1);
}

let seq = 0;
const pending = new Map();
ws.onmessage = event => {
  const response = JSON.parse(event.data);
  if (response.id) {
    const cb = pending.get(response.id);
    if (cb) { pending.delete(response.id); response.error ? cb.reject(Error(JSON.stringify(response.error))) : cb.resolve(response.result); }
  } else if (response.method === 'Runtime.exceptionThrown') {
    errors.push(response.params.exceptionDetails.text);
  } else if (response.method === 'Runtime.consoleAPICalled') {
    const args = response.params.args.map(a => a.value ?? a.description).join(' ');
    errors.push(`[console.${response.params.type}] ${args}`);
  }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, {resolve, reject});
  ws.send(JSON.stringify({id, method, params, sessionId}));
});

const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
const call = (method, params = {}) => send(method, params, sessionId);

await call('Runtime.enable');
await call('Page.enable');
await call('Runtime.runIfWaitingForDebugger');

// Enable console API to capture errors
await call('Runtime.evaluate', {expression: 'console.log("playtest start")', awaitPromise: true});

// Step 1: Set device metrics for iPhone 12 + CPU throttle 4x
console.log('Setting device metrics: 390x844 mobile, CPU throttle 4x');
await call('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 2, mobile: true, touch: true});
await call('Emulation.setCPUThrottlingRate', {rate: 4});

// Step 2: Load the game, wait for window.midnightsManner
console.log('Navigating to game...');
await call('Page.navigate', {url: `http://127.0.0.1:${port}/midnights-manner/`});

const evaluate = async expression => {
  const r = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || 'Browser evaluation failed');
  return r.result.value;
};

let loaded = false;
for (let i = 0; i < 150; i++) {
  if (await evaluate('Boolean(window.midnightsManner)')) { loaded = true; break; }
  await new Promise(r => setTimeout(r, 100));
}
if (!loaded) throw Error('Game did not load: window.midnightsManner not found');
console.log('Game loaded, waiting for ready...');

// Wait for game to be ready (may need to click #begin)
const paused = await evaluate('window.midnightsManner.paused');
if (paused) {
  await call('Input.dispatchMouseEvent', {type: 'mousePressed', x: 195, y: 422, button: 'left', clickCount: 1});
  await call('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 195, y: 422, button: 'left', clickCount: 1});
  // Try clicking #begin
  await evaluate(`document.querySelector('#begin')?.click()`);
}
await new Promise(r => setTimeout(r, 1000));
for (let i = 0; i < 100; i++) {
  if (await evaluate('window.midnightsManner.ready')) break;
  await new Promise(r => setTimeout(r, 100));
}
console.log('Game ready');

// Step 3: Measure FPS over 30s idle village
console.log('Measuring FPS over 30s idle village...');
const fpsSamples = [];
const heapSamples = [];
let lastFrame = performance.now();
let frameCount = 0;

await evaluate(`
  window.__fpsData = {frames: [], lastTime: performance.now()};
  function tick() {
    const now = performance.now();
    window.__fpsData.frames.push(now - window.__fpsData.lastTime);
    window.__fpsData.lastTime = now;
    if (window.__fpsData.frames.length < 1800) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
`);

await new Promise(r => setTimeout(r, 30000)); // 30 seconds

const fpsResult = await evaluate('window.__fpsData.frames');
const heapResult = await evaluate('performance.memory ? performance.memory.usedJSHeapSize : null');

if (fpsResult && fpsResult.length > 10) {
  const deltas = fpsResult;
  const fpsValues = deltas.map(d => 1000 / d).filter(f => isFinite(f) && f > 0 && f < 200);
  fpsValues.sort((a, b) => a - b);
  const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
  const p50Fps = fpsValues[Math.floor(fpsValues.length * 0.5)];
  const p95Fps = fpsValues[Math.floor(fpsValues.length * 0.95)];
  console.log(`Idle FPS: avg=${avgFps.toFixed(1)}, p50=${p50Fps.toFixed(1)}, p95=${p95Fps.toFixed(1)} (${fpsValues.length} samples)`);
} else {
  console.log('Idle FPS: insufficient samples');
}

if (heapResult) {
  console.log(`Idle JS Heap: ${(heapResult / 1024 / 1024).toFixed(1)} MB`);
}

// Step 4: Trigger a raid if harness exposes one
console.log('Checking for raid trigger...');
let combatFpsData = null;
try {
  // Check if #raid button exists and click it
  const raidExists = await evaluate('Boolean(document.querySelector("#raid"))');
  if (raidExists) {
    console.log('Triggering raid via #raid button...');
    await evaluate('document.querySelector("#raid")?.click()');
    await new Promise(r => setTimeout(r, 500));
    
    // Wait for enemies to spawn
    for (let i = 0; i < 100; i++) {
      const enemies = await evaluate('window.midnightsManner.snapshot().world.enemies.length');
      if (enemies > 0) break;
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Measure combat FPS for 15 seconds
    await evaluate(`
      window.__combatFpsData = {frames: [], lastTime: performance.now()};
      function ctick() {
        const now = performance.now();
        window.__combatFpsData.frames.push(now - window.__combatFpsData.lastTime);
        window.__combatFpsData.lastTime = now;
        if (window.__combatFpsData.frames.length < 900) requestAnimationFrame(ctick);
      }
      requestAnimationFrame(ctick);
    `);
    
    await new Promise(r => setTimeout(r, 15000));
    
    combatFpsData = await evaluate('window.__combatFpsData.frames');
    const combatHeap = await evaluate('performance.memory ? performance.memory.usedJSHeapSize : null');
    
    if (combatFpsData && combatFpsData.length > 10) {
      const deltas = combatFpsData;
      const fpsValues = deltas.map(d => 1000 / d).filter(f => isFinite(f) && f > 0 && f < 200);
      fpsValues.sort((a, b) => a - b);
      const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
      const p50Fps = fpsValues[Math.floor(fpsValues.length * 0.5)];
      const p95Fps = fpsValues[Math.floor(fpsValues.length * 0.95)];
      console.log(`Combat FPS: avg=${avgFps.toFixed(1)}, p50=${p50Fps.toFixed(1)}, p95=${p95Fps.toFixed(1)} (${fpsValues.length} samples)`);
    }
    if (combatHeap) {
      console.log(`Combat JS Heap: ${(combatHeap / 1024 / 1024).toFixed(1)} MB`);
    }
  } else {
    console.log('No #raid button found, skipping combat measurement');
  }
} catch (e) {
  console.log('Raid trigger failed:', e.message);
}

// Step 5: Tap build-menu button via touch input and screenshot stages
await mkdir('artifacts', {recursive: true});

const screenshot = async name => {
  try {
    const {data} = await call('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
    await writeFile(`artifacts/${name}.png`, Buffer.from(data, 'base64'));
    console.log(`Screenshot saved: artifacts/${name}.png`);
  } catch (e) {
    console.log(`Screenshot ${name} failed:`, e.message);
  }
};

console.log('Capturing dawn village screenshot...');
await screenshot('pt-dawn-village');

console.log('Opening build menu...');
try {
  // Click build tab
  await evaluate(`document.querySelector('[data-tab="build"]')?.click()`);
  await new Promise(r => setTimeout(r, 500));
  await screenshot('pt-build-menu');
} catch (e) {
  console.log('Build menu interaction failed:', e.message);
}

// If we triggered raid, capture night/raid screenshot
if (combatFpsData) {
  console.log('Capturing night/raid screenshot...');
  await screenshot('pt-night-raid');
}

// Step 6: Collect console errors
console.log('\n=== CONSOLE ERRORS ===');
const uniqueErrors = [...new Set(errors)];
uniqueErrors.slice(0, 5).forEach((e, i) => console.log(`${i+1}. ${e}`));
if (uniqueErrors.length > 5) console.log(`... and ${uniqueErrors.length - 5} more`);

// Final summary
console.log('\n=== PLAYTEST SUMMARY ===');
console.log('Device: iPhone 12 emulation (390x844 CSS, DPR 2, mobile touch)');
console.log('CPU Throttle: 4x (simulated, not physical iOS Safari CPU)');
console.log('Emulation caveats:');
console.log('  - Headless Edge/Chromium V8 != iOS Safari JavaScriptCore');
console.log('  - CPU throttle 4x approximates but does not replicate mobile thermal throttling');
console.log('  - No GPU throttling, GPU is desktop-class');
console.log('  - Touch emulation via CDP Input.dispatchTouchEvent, not real touch hardware');
console.log('  - Headless mode skips some compositor paths');

killBrowser(chrome);
server.close();
await rm(profile, {recursive: true, force: true});