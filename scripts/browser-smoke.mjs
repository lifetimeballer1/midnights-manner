// Dependency-free real-Chromium regression test. CI provides google-chrome.
// Local usage: CHROME_BIN=/path/to/chrome npm run test:browser
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve,relative,isAbsolute} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
// Windows browsers leave crashpad/utility children behind `kill()`; those
// children inherit our stdio handles and can hang a piping shell long after
// node exits. Kill the whole tree so the harness always returns promptly.
function killBrowser(proc){try{if(process.platform==='win32')spawnSync('taskkill',['/pid',String(proc.pid),'/T','/F'],{stdio:'ignore'});else proc.kill();}catch{}}
const root=resolve('dist'),profile=await mkdtemp(join(tmpdir(),'midnight-browser-'));
let updateFixture=false;
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/midnights-manner\//,'');if(!path||path==='/')path='index.html';const file=resolve(root,path);const rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');let contents=await readFile(file);if(updateFixture&&path==='sw.js')contents=Buffer.from(contents.toString().replace(/const CACHE=PREFIX\+"[^"]+";/,'const CACHE=PREFIX+"browser-update-fixture";'));if(updateFixture&&path==='index.html')contents=Buffer.from(contents.toString().replace(/name="game-build" content="[^"]+"/,'name="game-build" content="browser-update-fixture"'));res.end(contents);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try{
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);let log='';chrome.on('error',reject);chrome.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{const response=JSON.parse(event.data);if(response.id){const cb=pending.get(response.id);if(cb){pending.delete(response.id);response.error?cb.reject(Error(JSON.stringify(response.error))):cb.resolve(response.result);}}else if(response.method==='Runtime.exceptionThrown')errors.push(response.params.exceptionDetails.text);};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(method,params={})=>send(method,params,sessionId);
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__audioProbe={starts:0,stops:0,analyser:null};const AC=window.AudioContext;if(AC){const create=AC.prototype.createOscillator;AC.prototype.createOscillator=function(...args){const node=create.apply(this,args),start=node.start.bind(node),stop=node.stop.bind(node);node.start=(...values)=>{window.__audioProbe.starts++;return start(...values);};node.stop=(...values)=>{window.__audioProbe.stops++;return stop(...values);};return node;};const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){if(destination===this.context.destination&&!window.__audioProbe.analyser){const analyser=this.context.createAnalyser();analyser.fftSize=2048;window.__audioProbe.analyser=analyser;connect.call(this,analyser);connect.call(analyser,destination);return destination;}return connect.call(this,destination,...args);};}`});
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/midnights-manner/`});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Browser evaluation failed');return r.result.value;};
 for(let i=0;i<100;i++){if(await evaluate('Boolean(window.midnightsManner)'))break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(await evaluate('Boolean(window.midnightsManner)'),'game loaded');
 await mkdir('artifacts',{recursive:true});
 const screenshot=async name=>{const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`artifacts/${name}.png`,Buffer.from(data,'base64'));};
 const waitFor=async (expression,tries=100)=>{for(let i=0;i<tries;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,75));}throw Error('Timed out: '+expression);};
 const click=async selector=>{const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled||!e.getClientRects().length)throw Error('Unavailable '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});};
 const tap=async point=>{await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});};
 // fire() dispatches a real click on the live node instead of tapping coordinates.
 // Panel/tab buttons redraw every game tick, so CDP tap coords go stale; canvas
 // and map interactions keep using click()/tap() for true hit-testing.
  const fire=async selector=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unfireable '+${JSON.stringify(selector)});e.click();})()`);await new Promise(r=>setTimeout(r,150));};
  // U1 collapsible HUD: camera tools and the resource grid start collapsed.
  // Expand them before use; helpers are idempotent for the rest of the run.
  const ensureCamera=async ()=>{if(await evaluate('Boolean(document.querySelector("#camera-buttons")?.hidden)'))await fire('#camera-toggle');};
  const ensureResources=async ()=>{if(!await evaluate('Boolean(document.querySelector("[data-resource=\\"wood\\"]")?.getClientRects().length)'))await fire('#resource-summary');};
 assert.equal(await evaluate('window.midnightsManner.paused'),true,'welcome pauses simulation');
  await click('#begin');await waitFor('window.midnightsManner.ready');
  assert.equal(await evaluate('Boolean(document.querySelector("#camera-buttons")?.hidden)'),true,'camera tools collapse by default');
  assert.ok(await evaluate('Boolean(document.querySelector("#resource-summary"))'),'resource summary chip present');
 const musicStarts=await evaluate('window.__audioProbe.starts');assert.ok(musicStarts>=12,'Enter village starts the generated score');
 let musicLevel;
 for(let i=0;i<30;i++){
  musicLevel=await evaluate('(()=>{const a=window.__audioProbe.analyser;if(!a)return null;const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);let peak=0,power=0;for(const value of data){peak=Math.max(peak,Math.abs(value));power+=value*value;}return {peak,rms:Math.sqrt(power/data.length)};})()');
  if(musicLevel?.rms>0.0001)break;
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(musicLevel&&musicLevel.rms>0.0001,'score produces a non-silent browser audio signal');assert.ok(musicLevel.peak<.95,'score leaves headroom instead of clipping');console.log('Music output level',musicLevel);
 await click('#pause');const stopsBeforeMute=await evaluate('window.__audioProbe.stops');await click('#opt-sound');
 assert.ok(await evaluate(`window.__audioProbe.stops>${stopsBeforeMute}`),'Sound off stops scheduled score notes');
 const startsBeforeUnmute=await evaluate('window.__audioProbe.starts');await click('#opt-sound');
 assert.ok(await evaluate(`window.__audioProbe.starts>${startsBeforeUnmute}`),'Sound on resumes the score');await click('#resume');
 await screenshot('desktop');
 assert.equal(await evaluate('document.documentElement.scrollHeight > innerHeight'),false,'game has no document scrolling');
 const count=await evaluate('window.midnightsManner.snapshot().world.buildings.length');
 await click('[data-tab="build"]');
 for(let i=0;i<3;i++){await click('[data-build="farm"]');if(await evaluate('document.querySelector("#placement-hint").textContent.startsWith("Wheat")'))break;await new Promise(r=>setTimeout(r,250));await click('[data-tab="build"]');}
 await waitFor('document.querySelector("#placement-hint").textContent.startsWith("Wheat")');
 await tap(await evaluate('window.midnightsManner.project(2.5,2.5)'));
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.buildings.length'),count,'preview does not spend');
 console.log('Placement state',await evaluate(`({hint:document.querySelector('#placement-state').textContent,point:window.midnightsManner.project(2.5,2.5),target:(()=>{const p=window.midnightsManner.project(2.5,2.5);return document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,300)})()})`));await screenshot('placement-check');
 await click('#confirm-place');assert.equal(await evaluate('window.midnightsManner.snapshot().world.buildings.length'),count+1,'confirm builds once');
 // Phase 8 chains: the Sawmill card refines timber to lumber through posted crews.
 const millsBefore=await evaluate('window.midnightsManner.snapshot().world.buildings.length');
 for(let i=0;i<3;i++){await fire('[data-build="sawmill"]');if(await evaluate('document.querySelector("#placement-hint").textContent.startsWith("Sawmill")'))break;await new Promise(r=>setTimeout(r,250));await fire('[data-tab="build"]');}
 await waitFor('document.querySelector("#placement-hint").textContent.startsWith("Sawmill")');
 await tap(await evaluate('window.midnightsManner.project(2.5,5.5)'));
 await click('#confirm-place');assert.equal(await evaluate('window.midnightsManner.snapshot().world.buildings.length'),millsBefore+1,'sawmill confirms once');
 await waitFor('(()=>{const e=document.querySelector("#inspector");return e&&!e.hidden&&e.getClientRects().length>0&&e.textContent.includes("Refinery");})()');
 assert.ok(await evaluate('document.querySelector("#inspector").textContent.includes("Sawmill")'),'sawmill inspector names the shop');
 await fire('[data-action="close"]');
 // Touch wall rows on a phone: preview is free, confirm builds the line,
 // and the inspector upgrades the complete connected row with one action.
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await new Promise(r=>setTimeout(r,200));await ensureCamera();await click('#recenter');
 await click('[data-tab="build"]');
 for(let i=0;i<3;i++){await click('[data-build="wall"]');if(await evaluate('document.querySelector("#placement-hint").textContent.startsWith("Palisade")'))break;await new Promise(r=>setTimeout(r,250));await click('[data-tab="build"]');}
 await waitFor('document.querySelector("#placement-hint").textContent.startsWith("Palisade")');
 const wallStart=await evaluate('window.midnightsManner.project(7.5,3.5)'),wallEnd=await evaluate('window.midnightsManner.project(9.5,3.5)');
 const wallBefore=await evaluate('window.midnightsManner.snapshot().world.buildings.length');
 const wallCamera=await evaluate('window.midnightsManner.camera()');
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...wallStart,id:1}]});
 await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...wallEnd,id:1}]});
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.buildings.length'),wallBefore,'wall release only previews');
 assert.deepEqual(await evaluate('window.midnightsManner.camera()'),wallCamera,'wall drag does not pan');
 assert.match(await evaluate('document.querySelector("#placement-hint").textContent'),/3 segments/);
 await screenshot('mobile-wall-preview');await click('#confirm-place');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.buildings.length'),wallBefore+3,'three wall segments built');
 await click('#cancel');
 await waitFor('window.midnightsManner.snapshot().world.buildings.filter(b=>b.type==="wall"&&b.y===3&&b.x>=7&&b.x<=9).every(b=>b.remaining<=0)');
 const wallPoint=await evaluate('(()=>{const g=window.midnightsManner;const ids=new Set(g.snapshot().world.buildings.filter(b=>b.type==="wall"&&b.y===3&&b.x>=7&&b.x<=9).map(b=>b.id));for(let y=160;y<innerHeight-160;y+=4)for(let x=8;x<innerWidth-60;x+=4){const hit=g.pick(x,y);if(hit?.kind==="building"&&ids.has(hit.id)&&document.elementFromPoint(x,y)?.id==="world")return {x,y};}return null;})()');
 assert.ok(wallPoint,'a wall segment remains selectable beside collection labels');await tap(wallPoint);
 await screenshot('mobile-wall-upgrade');await click('[data-action="upgrade-row"][data-axis="x"]');
 assert.ok(await evaluate('window.midnightsManner.snapshot().world.buildings.filter(b=>b.type==="wall"&&b.y===3&&b.x>=7&&b.x<=9).every(b=>b.level===2)'),'row upgrade applies to all segments');
 await click('[data-action="close"]');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,200));await ensureCamera();await click('#recenter');
 await click('[data-tab="troops"]');await click('[data-gear="cart"]');await click('[data-level]');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[2].gear'),'cart','equipment applies');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[0].level'),2,'training applies');
 // Phase 7 villagers: every hire is named and tempered, and the idle bar posts them.
 await click('[data-tab="troops"]');
 await waitFor('Boolean(document.querySelector(".idle-bar"))');
 assert.ok(await evaluate('document.querySelectorAll(".trait").length > 0'),'villager trait chips render');
 assert.ok(await evaluate('window.midnightsManner.snapshot().world.troops.every(t=>typeof t.name==="string"&&t.name.length>0)'),'every villager is named');
 // Auto-assign's posting logic is unit-tested (phase7-villagers.test.js). Here
 // we only prove the UI offers it. Self-filling posts mean open work may
 // already be taken by the time we look — so either the button is enabled
 // (hands still idle) or no idle hands remain (they self-filled). Firing is
 // only legal while hands are still idle.
 assert.ok(await evaluate('Boolean(document.querySelector("[data-autoassign]"))'),'auto-assign control exists');
 const autoState=await evaluate('(()=>{const btn=document.querySelector("[data-autoassign]");const bar=document.querySelector(".idle-bar");const m=bar?bar.textContent.match(/\d+ idle/):null;return {enabled:!!(btn&&!btn.disabled),idle:m?parseInt(m[0]):0};})()');
 assert.ok(autoState.enabled||autoState.idle===0,'idle hands are offered posting or already self-filled');
 if(autoState.enabled){await fire('[data-autoassign]');await waitFor('Boolean(document.querySelector(".idle-bar"))||document.querySelector("#status").textContent.length>0');}
 if(await evaluate('(()=>{const e=document.querySelector("#close-panel");return !!(e&&!e.disabled&&e.getClientRects().length);})()'))await fire('#close-panel');
 // Manage a workplace from its map selection, then hire directly into it.
 // The starting warrior stands in front of the crop bed: tap its upper half.
 const farmFaces=await evaluate('(()=>{const g=window.midnightsManner,b=g.snapshot().world.buildings.find(b=>b.type==="farm"&&b.x===6);return g.modelPoints(b.id).filter(p=>document.elementFromPoint(p.x,p.y)?.id==="world");})()');
 assert.ok(farmFaces.length,'farm has an exposed model face');
 let farmOpen=false;
 for(const p of farmFaces.slice(0,12)){await tap(p);await new Promise(r=>setTimeout(r,250));if(await evaluate('Boolean(document.querySelector("[data-action=assign]"))')){farmOpen=true;break;}}
 assert.ok(farmOpen,'farm inspector opens despite crew on the tile');
 await screenshot('workplace-selection');
 console.log('Workplace selection:',await evaluate('document.querySelector("#inspector").textContent'));
 // Opening a menu is idempotent. Reacquire the live inspector after its harvest row changes layout.
 await click('[data-action="assign"]');
 await waitFor('Boolean(document.querySelector("[data-staff]"))||Boolean(document.querySelector("[data-release]"))');
 if(await evaluate('Boolean(document.querySelector("[data-release]"))')){await click('[data-release]');await waitFor('Boolean(document.querySelector("[data-staff]"))');}
 await click('[data-staff]');
 assert.ok(await evaluate('window.midnightsManner.snapshot().world.troops.find(t=>t.type==="farmer").workplace'),'worker assigned from workplace');
 await click('[data-release]');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops.find(t=>t.type==="farmer").workplace'),null,'release opens the job');
 await click('[data-recruit="farmer"][data-workplace]');
 assert.ok(await evaluate('window.midnightsManner.snapshot().world.troops.filter(t=>t.type==="farmer").at(-1).workplace'),'direct hire is assigned');
 await screenshot('workplace');
 await click('#close-panel');
 // Resource identities, collection, search and every main menu on a phone.
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await new Promise(r=>setTimeout(r,150));await ensureCamera();await click('#recenter');
 await waitFor('window.midnightsManner.collectionBubbles().length > 0',1600);
 const bubbles=await evaluate('window.midnightsManner.collectionBubbles()');
 assert.ok(bubbles.every(b=>/(Wood|Food|Gold|Frostwood|Plate)(?: \+\d+| storage full)/.test(b.label)),'collection markers name their resources');
 await screenshot('polished-village');
 const visiblePill=await evaluate('window.midnightsManner.collectionBubbles().find(b=>document.elementFromPoint(b.x+b.w/2,b.y+b.h/2)?.id==="world")');
 assert.ok(visiblePill,'collection touch target visible');
 const bonusBefore=await evaluate(`window.midnightsManner.snapshot().world.buildings.find(b=>b.id===${JSON.stringify(visiblePill.id)}).harvestBonus`);
 await tap({x:visiblePill.x+visiblePill.w/2,y:visiblePill.y+visiblePill.h/2});
 assert.ok((await evaluate(`window.midnightsManner.snapshot().world.buildings.find(b=>b.id===${JSON.stringify(visiblePill.id)}).harvestBonus`))<bonusBefore,'labeled bubble collects the right building');
 // Exercise orbit controls through actual phone touch and menu input.
 await ensureCamera();await click('#camera-menu');await click('#orbit-mode');await click('#camera-close');
 const orbitBefore=await evaluate('window.midnightsManner.camera()');
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:470,id:1}]});
 await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:290,y:510,id:1}]});
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const orbitAfter=await evaluate('window.midnightsManner.camera()');assert.notEqual(orbitAfter.yaw,orbitBefore.yaw,'phone orbit changes heading');assert.notEqual(orbitAfter.pitch,orbitBefore.pitch,'phone orbit changes elevation');assert.equal(orbitAfter.x,orbitBefore.x,'orbit keeps the focus point');
 await ensureCamera();await click('#camera-menu');await click('#orbit-mode');
 for(const view of ['low','top','classic']){await click(`[data-view="${view}"]`);await screenshot('orbit-phone-'+view);}
 for(let i=0;i<16;i++)await click('#turn-right');
 const turned=await evaluate('window.midnightsManner.camera().yaw');assert.ok(Math.abs(turned-orbitAfter.yaw)<1e-6,'full 360 degree turn returns to heading');
 await click('#camera-reset');await click('#camera-close');
 await ensureResources();await click('[data-resource="wood"]');assert.ok(await evaluate('document.querySelector("#panel").textContent.includes("Wood")'),'resource stores open');assert.ok(await evaluate('Boolean(document.querySelector("[data-collect-all]"))'),'collect-all offered in resource stores');await screenshot('polished-resources');await click('#close-panel');
 await click('[data-tab="build"]');await screenshot('polished-build');await click('#panel-search');await call('Input.insertText',{text:'Wheat'});
 assert.equal(await evaluate('document.querySelectorAll("[data-build]").length'),1,'building search narrows cards');await click('#close-panel');
 await click('[data-tab="troops"]');await screenshot('polished-people');await click('#close-panel');
 await click('[data-tab="story"]');await screenshot('polished-adventure');await click('[data-category="quests"]');await screenshot('polished-quests');
 await click('[data-category="home"]');
 await click('[data-goto="research"]');await waitFor('document.querySelectorAll(".tech-branch").length===6');
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'research fits portrait');
 await screenshot('mobile-research');await click('[data-goto="home"]');
 if(await evaluate('Boolean(document.querySelector(\'[data-goto="market"]\'))'))await click('[data-goto="market"]');
 await screenshot('polished-trading');await click('#close-panel');
 await click('#pause');await screenshot('polished-settings');await click('#resume');
 for(const width of [320,390,430]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:2,mobile:true});await new Promise(r=>setTimeout(r,80));
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'),false,`no overflow at ${width}`);
  assert.ok(await evaluate('[...document.querySelectorAll(".resource small")].every(e=>getComputedStyle(e).display!=="none")'),'resource names stay visible');
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,150));await ensureCamera();await click('#recenter');
 await click('[data-tab="story"]');await click('[data-category="chapters"]');await waitFor('Boolean(document.querySelector(\'[data-mission="first-harvest"]\'))');await click('[data-mission="first-harvest"]');
 assert.ok(await evaluate('window.midnightsManner.snapshot().mission'),'expedition starts');
 await click('[data-tab="story"]');await click('[data-category="expeditions"]');await waitFor('Boolean(document.querySelector(\'#panel [data-home="true"]\'))');await click('#panel [data-home="true"]');assert.equal(await evaluate('window.midnightsManner.snapshot().mission'),null,'return restores home');
 await click('#raid');await waitFor('window.midnightsManner.snapshot().world.enemies.length > 0');
 await waitFor('window.midnightsManner.snapshot().world.troops.some(t=>t.emergency)');
 assert.ok(await evaluate('window.midnightsManner.snapshot().world.enemies.every(e=>e.faction)'), 'home raiders have faction identity');
 await screenshot('survival-emergency');
 await click('#pause');assert.equal(await evaluate('window.midnightsManner.paused'),true);await click('#opt-save');await click('#resume');
 await click('#pause');await fire('#opt-news');await waitFor('!document.querySelector("#news-overlay").hidden');
 assert.ok(await evaluate('document.querySelectorAll(".news-entry").length>=3'),'notice board lists patch notes');
 await screenshot('whats-new');await fire('#news-close');await waitFor('document.querySelector("#news-overlay").hidden');
 assert.equal(await evaluate('window.midnightsManner.snapshot().seenUpdatesVersion'),'0.3.0','dismissing the board marks the version seen');
 await click('#resume');
 await call('Page.reload');await waitFor('Boolean(window.midnightsManner)');await click('#begin');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[0].level'),2,'level restored');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[2].gear'),'cart','gear restored');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await new Promise(r=>setTimeout(r,200));
 await ensureCamera();await click('#recenter');
 assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight'),false,'phone canvas fills viewport without scrolling');
 const before=await evaluate('window.midnightsManner.camera()');
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:350,id:1,radiusX:3,radiusY:3}]});
 await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:240,y:395,id:1,radiusX:3,radiusY:3}]});
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const after=await evaluate('window.midnightsManner.camera()');assert.ok(Math.abs(before.x-after.x)+Math.abs(before.y-after.y)>.1,'one finger pans');
 const zoomBefore=after.zoom;
 const pinchArea=await evaluate('(()=>{for(let y=300;y<innerHeight-180;y+=20)for(let x=120;x<innerWidth-120;x+=20){if(document.elementFromPoint(x-50,y)?.id==="world"&&document.elementFromPoint(x+50,y)?.id==="world")return {x,y};}return null;})()');
 assert.ok(pinchArea,'clear canvas area available for pinch');
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pinchArea.x-50,y:pinchArea.y,id:1},{x:pinchArea.x+50,y:pinchArea.y,id:2}]});
 await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pinchArea.x-90,y:pinchArea.y,id:1},{x:pinchArea.x+90,y:pinchArea.y,id:2}]});
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok((await evaluate('window.midnightsManner.camera().zoom'))>zoomBefore,'two fingers zoom');
 await ensureCamera();await click('#recenter');await screenshot('mobile');
 await click('[data-tab="build"]');await screenshot('mobile-build');
 await click('#close-panel');
 await call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});await new Promise(r=>setTimeout(r,100));await ensureCamera();await click('#recenter');await screenshot('landscape');
 assert.equal(await evaluate('document.documentElement.scrollHeight > innerHeight'),false,'landscape has no scrolling');
 const perf=await evaluate('window.midnightsManner.frameReport()');
 assert.ok(perf&&perf.n>=10&&Number.isFinite(perf.avg)&&Number.isFinite(perf.p95),'frame telemetry stays live');
 assert.ok(perf.faces<30000&&perf.staticFaces<30000,`visible mesh stays bounded (faces=${perf.faces}, static=${perf.staticFaces})`);
 console.log('Frame report',perf);
 // Living detail fixture: use a detached real browser canvas, keeping the
 // interactive village/save used by the remainder of this smoke untouched.
 const living=await evaluate(`(async()=>{
  const root='/midnights-manner/',names=['world','troops','items','buildings','abilities','quests','missions','biomes','expansion'];
  const data=Object.fromEntries(await Promise.all(names.map(async n=>[n,await(await fetch(root+'data/'+n+'.json')).json()])));
  const [{Renderer},{createWorld,makeBuilding,makeUnit},{recordTravel,trailMultiplier},{move},{exportSave,importSaveBlob}]=await Promise.all(['renderer.js','model.js','systems/trails.js','systems/pathfinding.js','storage.js'].map(n=>import(root+'src/'+n)));
  const world=createWorld(data);world.elapsed=400;world.buildings=[];world.troops=[];
  Object.keys(data.buildings).forEach((type,i)=>{const x=2+(i%10)*4,y=2+Math.floor(i/10)*4,b=makeBuilding(type,x,y,data,Math.min(6,data.buildings[type].tiers.length));b.id='living-'+i;b.remaining=0;world.buildings.push(b);const typeOf=data.buildings[type].workplace;if(typeOf&&data.troops[typeOf]){const u=makeUnit(typeOf,data,i);u.workplace=b.id;u.x=x+data.buildings[type].size/2;u.y=y+data.buildings[type].size;world.troops.push(u);}});
  for(let i=0;i<300;i++){recordTravel(world,data,4.25,4.25,28.25,4.25);recordTravel(world,data,10.25,4.25,10.25,24.25);}
  const state={...window.midnightsManner.snapshot(),world,home:null,mission:null},loaded=importSaveBlob(exportSave(state),data);
  if(!loaded.ok||JSON.stringify(loaded.state.world.trails)!==JSON.stringify(world.trails))throw Error('Living trail save roundtrip failed');
  const speed=trailMultiplier(world,4.25,4.25),actor={id:'path-walker',hp:100,x:4.25,y:4.25};
  const isolated={...world,buildings:[],troops:[actor],enemies:[]};move(isolated,data,actor,{x:7.25,y:4.25},1,.05,.1,false,true);
  if(Math.abs(Math.hypot(actor.x-4.25,actor.y-4.25)-.05*speed)>1e-8)throw Error('Living friendly path speed failed');
  const before=window.midnightsManner.snapshot().world.troops[0]?.id,frames=[];
  for(const [width,height,yaw,zoom,calm,raid,tag] of [[1280,900,Math.PI/4,1.65,false,false,'desktop'],[390,844,Math.PI/4,1.65,false,false,'phone'],[1280,900,Math.PI*1.25,2.4,false,false,'reverse'],[1280,900,Math.PI/2,.65,false,false,'far'],[390,844,Math.PI/4,1.65,true,false,'calm'],[1280,900,Math.PI/4,1.65,false,true,'raid']]){
   const canvas=document.createElement('canvas'),r=new Renderer(canvas,data,{});r.resize(width,height,1);r.cam={x:16,y:12,yaw,pitch:.8,zoom};r.calm=calm;
   world.enemies=raid?Array.from({length:16},(_,i)=>({id:'living-enemy-'+i,hp:100,maxHp:100,x:8+i*.3,y:8,role:i%2?'archer':'raider',type:'enemy',animation:.2})):[];
   const times=[];for(let i=0;i<8;i++){const start=performance.now();r.draw(world,2200+i*50);times.push(performance.now()-start);}
   if(r.sceneFaces.some(f=>!f.color||f.vertices.some(v=>v.some(n=>!Number.isFinite(n)))))throw Error('Invalid living mesh');
   frames.push({tag,faces:r.sceneFaces.length,staticFaces:r._meshStatic.faces.length,medianMs:times.sort((a,b)=>a-b)[4],image:canvas.toDataURL('image/png').split(',')[1]});
  }
  if(window.midnightsManner.snapshot().world.troops[0]?.id!==before)throw Error('Living fixture changed the interactive village');
  return {speed,cells:Object.keys(world.trails).length,frames};
 })()`);
 assert.equal(living.speed,1.11,'packed path bonus in real Chromium');
 for(const frame of living.frames){assert.ok(frame.faces<30000&&frame.staticFaces<30000,'crowded living village stays bounded');await writeFile('artifacts/living-browser-'+frame.tag+'.png',Buffer.from(frame.image,'base64'));delete frame.image;}
 console.log('Living detail browser review',living);

 await click('[data-tab="troops"]');await click('[data-category="recruit"]');
 assert.ok((await evaluate('document.querySelectorAll("[data-recruit]").length'))>=20,'all professions retained');
 // Serve a second build while the standalone-sized page stays open.
 await click('#close-panel');await click('#pause');
 await evaluate('navigator.serviceWorker.ready.then(()=>true)');
 await waitFor('!!navigator.serviceWorker.controller');
 const savedUnit=await evaluate('window.midnightsManner.snapshot().world.troops[0].id');
 await call('Network.enable');
 await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await click('#opt-update');await waitFor('document.querySelector("#update-status").textContent.includes("internet")');
 assert.ok(await evaluate('window.midnightsManner.ready'),'offline check does not reload the game');
 await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await waitFor('!document.querySelector("#opt-update").disabled');
 updateFixture=true;
 // A service-worker controller/update transition can briefly restore the game
 // surface and hide the pause sheet without reloading the app. Re-open Settings
 // before the second manual check, but fail loudly if a real early reload
 // brought the title screen back.
 assert.equal(await evaluate('document.querySelector("#title").hidden'),true,'update check does not reload before approval');
 if(await evaluate('document.querySelector("#pause-overlay").hidden')){await click('#pause');await waitFor('!document.querySelector("#pause-overlay").hidden');}
 await waitFor('document.querySelector("#opt-update")?.getClientRects().length>0 && !document.querySelector("#opt-update").disabled');
 await click('#opt-update');await waitFor('!document.querySelector("#update-notice").hidden');
 assert.notEqual(await evaluate('document.querySelector("meta[name=game-build]").content'),'browser-update-fixture','update waits for a click');
 await screenshot('update-ready');
 assert.equal(await evaluate('document.querySelector("#title").hidden'),true,'ready update still waits for player approval');
 if(await evaluate('document.querySelector("#pause-overlay").hidden')){await click('#pause');await waitFor('!document.querySelector("#pause-overlay").hidden');}
 await waitFor('document.querySelector("#opt-update")?.getClientRects().length>0 && !document.querySelector("#opt-update").disabled');
 await click('#opt-update');
 await waitFor('document.querySelector("meta[name=game-build]")?.content==="browser-update-fixture" && !!window.midnightsManner');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[0].id'),savedUnit,'update preserves village');
 await click('#begin');await click('#pause');await click('#opt-refresh');
 await waitFor('!!window.midnightsManner && !document.querySelector("#title").hidden');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[0].id'),savedUnit,'ordinary in-app refresh preserves village');
 assert.deepEqual(errors,[],'no browser runtime errors');
 console.log(JSON.stringify({resourceCollection:true,menuSearch:true,mobileMenuPolish:true,inAppUpdate:true,saveAndRefresh:true,noticeBoard:true,offlineUpdateCheck:true,placementConfirmation:true,touchWallRows:true,sawmillRefinery:true,wallRowUpgrade:true,equipment:true,training:true,mission:true,raid:true,saveReload:true,portrait:true,landscape:true,touchPan:true,pinchZoom:true,consoleErrors:errors}));
}finally{ws?.close();killBrowser(chrome);server.close();await new Promise(r=>setTimeout(r,300));await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
