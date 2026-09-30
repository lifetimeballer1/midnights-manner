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
 const orbi…59883 tokens truncated…1,timber);
   if(l>=2){for(const a of [.28,1.24])s.box(x+a,y+1.25,.13,.07,.07,.76,timber);s.roof(x+.22,y+1.16,.89,1.16,.5,.16,'#60897b');s.box(x+1.4,y+1.2,.13,.08,.46,.35,timber);s.box(x+1.33,y+1.2,.46,.22,.46,.06,'#d4ae73');}
   lanternPost(s,x+n-.26,y+n-.26,.76,1.08,.42);return;
  }
  if(['grove','frostgrove'].includes(t)){for(const [a,c]of[[.5,.5],[1.35,.65],[.9,1.4]])pine(s,x+a,y+c,1.2+l*.15,t==='frostgrove');fence(s,x+.15,y+.15,n-.3,n-.3);lanternPost(s,x+n-.26,y+n-.26,.76,1.08,.42);
   if(l>=4)pine(s,x+.9,y+.5,.8+l*.1,t==='frostgrove');
   if(l>=5){s.box(x+.4,y+.4,.1,.5,.2,.3,timber);s.roof(x+.35,y+.35,.4,.6,.3,.12,'#60897b');}
   if(l>=6)s.box(x+.45,y+.45,.72,.4,.1,.06,gold);
   return;}
  if(['lumber','timber_yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.18,y+.2+i*.19,.13,.62,.14,.14,timber);s.box(x+.28,y+.29,.27,.43,.14,.14,'#d4ae73');s.box(x+.17,y+.16,.13,.08,.08,.73,timber);s.box(x+.74,y+.16,.13,.08,.08,.73,timber);s.roof(x+.1,y+.1,.83,.8,.6,.18,'#60897b');lanternPost(s,x+.79,y+.22,.78,1,.42);
   if(l>=4){s.box(x+.1,y+.62,.13,.5,.12,.12,'#c79861');s.box(x+.14,y+.66,.25,.42,.08,.06,timber);}
   if(l>=5){s.pyramid(x+.3,y+.7,.13,.16,.24,'#76593d',5);s.pyramid(x+.48,y+.7,.13,.13,.2,'#8a6a48',5);}
   if(l>=6){s.box(x+.62,y+.5,.13,.07,.07,.8,timber);s.box(x+.62,y+.5,.8,.4,.07,.07,timber);s.box(x+.95,y+.5,.3,.07,.07,.07,'#6a6f65');}
   return;}
  if(['mine','emberglass'].includes(t)){s.pyramid(x+.5,y+.5,.13,.55,.72,'#8b9690',6);s.box(x+.34,y+.76,.14,.32,.09,.4,'#2d3937');s.box(x+.27,y+.79,.14,.07,.12,.48,timber);s.box(x+.68,y+.79,.14,.07,.12,.48,timber);s.box(x+.27,y+.79,.62,.48,.12,.07,timber);s.pyramid(x+.26,y+.35,.62,.14,.26,t==='mine'?gold:'#9cd5d2');torch(s,x+.27,y+.84,.55,[0,1],.95,.47);torch(s,x+.73,y+.84,.55,[0,1],.95,.47);
   if(l>=4){for(const px of [.22,.73])s.box(x+px,y+.72,.14,.09,.09,.55,stone);}
   if(l>=5){s.box(x+.13,y+.3,.16,.3,.24,.2,'#6f6253');s.pyramid(x+.27,y+.41,.36,.09,.12,'#a29074',5);}
   if(l>=6){s.box(x+.44,y+.86,.14,.05,.05,.7,timber);s.box(x+.44,y+.86,.7,.34,.05,.05,timber);lanternPost(s,x+.5,y+.3,.6,.9,.4);}
   return;}
 if(['tower','bell-tower','bellcote','scout_post','archer_tower','ballista'].includes(t)){const width=t==='archer_tower'?n*.45:t==='ballista'?n*.62:n*.55,h=t==='archer_tower'?1+l*.3:t==='ballista'?.62+l*.18:.85+l*.24;tower(s,x+(n-width)/2,y+(n-width)/2,width,h,l===1?timber:stone);if(t.includes('bell')){s.box(x+n*.4,y+n*.4,h+.3,n*.2,n*.2,.28,gold);s.roof(x+.15,y+.15,h+.7,n-.3,n-.3,.45,'#648b90');}
  // Archer tower: slim shaft, hooded crown and a level-2 pennant — the
  // longest reach on the wall, paid for in fragility.
   if(t==='archer_tower'){s.box(x+(n-width)/2-.06,y+(n-width)/2-.06,h+.12,width+.12,width+.12,.1,l>=3?gold:stone);if(l>=2){s.box(x+n*.47,y+n*.47,h+.2,.06,.06,.5,timber);s.box(x+n*.53,y+n*.47,h+.55,.22,.02,.14,l>=3?'#b76053':'#73956a');}
    if(l>=5)s.box(x+(n-width)/2-.02,y+(n-width)/2-.02,.06,width+.04,width+.04,.2,stone);
    if(l>=6){s.box(x+n*.47,y+n*.47,h+.62,.06,.06,.4,timber);s.box(x+n*.31,y+n*.47,h+.9,.22,.02,.12,'#b76053');}}
   // Ballista: squat engine deck with a spanned crossbow on top — short
   // range, slow reload (data cooldown), the hardest single hit in town.
   if(t==='ballista'){s.box(x+.14,y+.14,h,width+.1,width+.1,.12,timber);s.box(x+n/2-.3,y+n/2-.03,h+.12,.6,.06,.06,stone);s.box(x+n/2-.03,y+n/2-.3,h+.12,.06,.6,.06,stone);s.box(x+n/2-.02,y+n/2-.02,h+.12,.04,.5,.05,gold);
    if(l>=4){s.box(x+.1,y+.4,h+.05,.06,.2,.3,timber);s.box(x+.84,y+.4,h+.05,.06,.2,.3,timber);}
    if(l>=6)s.box(x+n/2-.02,y+n/2-.02,h+.18,.04,.5,.05,gold);}
  torch(s,x+n/2,y+(n+width)/2+.035,h*.58,[0,1],1.02,.45);
  return;}
  if(['watchfire','oathstone','moon-dial','cairnfield'].includes(t)){const spots=t==='cairnfield'?[[.5,.5],[1.3,.6],[.6,1.4],[1.35,1.35]]:[[n/2,n/2]];s.emissive=t==='watchfire'?1:0;for(const [a,c]of spots){s.box(x+a-.18,y+c-.18,.13,.36,.36,.22,stone);if(t==='watchfire'){s.source([x+a,y+c,.55],null,2.1,1,'fire');s.pyramid(x+a,y+c,.36,.26,.55,'#f2b35c',5);if(l>=4)s.pyramid(x+a,y+c,.2,.15,.3,'#e8883f',5);if(l>=5)for(const [ox,oy]of[[-.3,0],[.3,0],[0,-.3],[0,.3]])s.box(x+a+ox-.06,y+c+oy-.06,.13,.12,.12,.16,stone);if(l>=6){s.box(x+a-.05,y+c-.05,.13,.1,.1,.5,timber);s.box(x+a-.09,y+c-.09,.55,.18,.18,.08,'#4d514b');}}else if(t==='moon-dial')s.pyramid(x+a,y+c,.35,.17,.55,gold);else s.box(x+a-.09,y+c-.06,.35,.18,.12,.6,t==='oathstone'?'#90b5b5':stone);}s.emissive=0;return;}
 if(t==='dawn-gate'){tower(s,x+.18,y+.35,.62,1.7,stone);tower(s,x+n-.8,y+.35,.62,1.7,stone);s.box(x+.8,y+.43,1.35,n-1.6,.46,.45,gold);s.roof(x+.05,y+.2,2,n-.1,.95,.32,'#638b92');torch(s,x+.68,y+.92,1.22,[0,1],1.25,.58);torch(s,x+n-.68,y+.92,1.22,[0,1],1.25,.58);return;}
 if(t==='market'){for(const [a,c,color]of[[.22,.24,'#b76053'],[1.7,.25,'#73956a'],[.6,1.75,'#ccac60']]){s.box(x+a,y+c,.14,1,.5,.35,timber);for(const dx of [0,.94])s.box(x+a+dx,y+c,.14,.06,.06,.95,timber);s.roof(x+a-.06,y+c-.12,1.02,1.12,.75,.12,color);}lanternPost(s,x+.32,y+n-.32,.9,1.12,.44);lanternPost(s,x+n-.32,y+n-.32,.9,1.12,.44);return;}
 // The new production chain buildings need to read differently at map scale.
 // Keep the machinery stationary so the meshes can share the camera cache.
 if(t==='sawmill'){
  const h=.85+l*.12;
  for(const a of [.25,n-.35])for(const c of [.25,n-.35])s.box(x+a,y+c,.12,.11,.11,h,timber);
  s.roof(x+.12,y+.12,h+.12,n-.24,.72,.26,'#5f8074'); // open work bay
  s.box(x+.38,y+.8,.14,n-.76,.48,.27,'#6b5945'); // sawing bench
  s.box(x+.44,y+.92,.42,n-.88,.1,.045,'#d3b27e');
  for(const dx of [.4,1.5])s.box(x+dx,y+1.08,.15,.07,.07,.45,timber); // attached saw guides
  for(let i=0;i<3;i++)s.box(x+.25,y+.3+i*.18,.13,.69,.13,.13,i===1?'#cba46d':timber);
   if(l>=2){s.box(x+n-.48,y+.42,.14,.18,.18,1.2,timber);s.box(x+n-.48,y+.42,1.2,.54,.12,.1,timber);s.box(x+n-.04,y+.42,.63,.04,.04,.58,'#6a6f65');}
   if(l>=4){for(let i=0;i<2;i++)s.box(x+.25,y+.3+i*.18,.26,.69,.13,.1,i%2?'#cba46d':'#8a6a48');}
   if(l>=5){s.box(x+.12,y+.62,.13,.5,.12,.12,'#c79861');s.box(x+.16,y+.66,.25,.42,.08,.06,timber);}
   if(l>=6){s.box(x+n-.5,y+.2,.13,.07,.07,.9,timber);s.box(x+n-.5,y+.2,.9,.42,.07,.07,timber);lanternPost(s,x+.5,y+.3,.7,1,.42);}
   lanternPost(s,x+.24,y+n-.26,.82,1.06,.43);
   return;
 }
 if(t==='mill'){
  hut(s,x+.3,y+.3,n-.6,n-.6,.7+l*.13,'#aa7959',l);
  // A raised wheel, grain hopper, and flour sacks identify the gristmill.
  const z=.5,cx=x+n-.21,cy=y+n*.5;
  s.box(cx-.08,cy-.045,z-.04,.3,.09,.09,timber);
  for(const dy of [-.24,.24])s.box(cx+.03,cy+dy,.12,.08,.08,.43,timber);
   s.pyramid(x+.58,y+.54,1.15,.27,.38,'#d5b477');
   for(let i=0;i<2;i++)s.box(x+.19+i*.36,y+n-.42,.14,.3,.27,.24,'#decaa0');
   if(l>=4){s.box(cx+.01,cy-.28,.12,.12,.56,.06,stone);}
   if(l>=5){for(let i=0;i<3;i++)s.box(x+.19+i*.24,y+n-.42,.14,.2,.2,.2,'#decaa0');}
   if(l>=6){lanternPost(s,x+.3,y+.4,.7,1,.42);s.box(x+n*.4,y+.2,.9,.2,.06,.3,l>=3?gold:stone);}
   return;
 }
 if(t==='longhouse'){
  longhouseShape(s,b,n);
  if(l>=2){
   for(const side of [x+.53,x+n-.63])s.box(side,y+.46,.13,.085,n-.92,.55,l>=3?stone:timber);
   s.box(x+n*.38,y+.42,.67,n*.24,.48,.55,stone);
   s.roof(x+n*.37,y+.4,1.22,n*.26,.53,.24,l>=3?'#5e8c9b':'#977851');
  }
   if(l>=3){
    for(const side of [x+.63,x+n-.72])s.box(side,y+n-.34,.13,.09,.09,1.23,stone);
    s.box(x+.53,y+n-.38,1.32,n-1.06,.09,.08,gold);
   }
   if(l>=4){
    // Prosperous: stone foundation skirt and shield row on the front gable.
    s.box(x+.5,y+.24,.08,n-1,.12,.2,stone);
    for(let i=0;i<3;i++)s.box(x+n*.32+i*.3,y+n-.2,.85,.16,.03,.24,i%2?'#ad6155':'#5e8c9b');
   }
   if(l>=5){
    // Advanced: side wings with low roofs broaden the meadhall footprint.
    for(const side of [x+.3,x+n-.85]){s.box(side,y+.7,.12,.55,n-1.4,.5,stone);s.roof(side-.05,y+.65,.62,.65,n-1.3,.18,'#977851');}
   }
   if(l>=6){
    // Masterwork: gold ridge caps and twin braziers flanking the door.
    const ridgeX=x+.58+(n-1.15)/2;
    s.box(ridgeX-.05,y+.34,1.2,.1,n-.68,.07,gold);
    for(const dx of [n*.32,n*.68]){s.box(x+dx-.09,y+n-.3,.12,.18,.18,.3,stone);s.emissive=1;s.pyramid(x+dx,y+n-.21,.42,.12,.24,'#f2b35c',5);s.emissive=0;s.source([x+dx,y+n-.21,.5],null,1.6,.8,'fire');}
   }
   torch(s,x+n*.3,y+n-.11,.73,[0,1],1.24,.56);
   torch(s,x+n*.7,y+n-.11,.73,[0,1],1.24,.56);
   return;
 }
 // Town projects (Phase 4): grand works read as themselves at map scale —
 // an open plaza of striped stalls, a grain hall with chute and sacks,
 // hedge-lined gardens with a fountain, and a plinth obelisk. Tier lifts
 // each silhouette (gold caps, arcades, taller stone).
 if(t==='market-square'){
  s.box(x+.1,y+.1,.05,n-.2,n-.2,.03,'#8a7354');
  for(const [a,c,color]of[[.18,.22,'#b76053'],[n-1.02,.25,'#73956a'],[.3,n-1.02,'#ccac60'],[n-1,.92,'#a26b7e']]){
   s.box(x+a,y+c,.1,.82,.44,.3,timber);
   for(const dx of [0,.76])s.box(x+a+dx,y+c,.1,.06,.06,.8,timber);
   s.roof(x+a-.05,y+c-.1,.86,1,.66,.12,color);
  }
   if(l>=2){s.box(x+n*.43,y+n*.43,.09,.14,.14,.52,stone);s.pyramid(x+n*.5,y+n*.5,.61,.26,.32,gold,4);}
   if(l>=3){s.box(x+.55,y+n-.26,.08,n-1.1,.13,.3,stone);s.box(x+n-1.45,y+.55,.08,.13,n-1.1,.3,stone);}
   if(l>=4){for(const [a,c]of[[.18,n-1.02],[n-1.02,n-1.02]])s.box(x+a,y+c,1.02,.12,.12,.14,gold);}
   if(l>=5){s.box(x+.2,y+.2,.06,.5,.5,.4,timber);s.roof(x+.15,y+.15,.46,.6,.6,.14,'#ccac60');}
   if(l>=6)lanternPost(s,x+n*.5,y+.2,.8,1.05,.44);
   return;
 }
 if(t==='grand-granary'){
  hut(s,x+.22,y+.22,n-.44,n-.44,.5+l*.16,l>=3?stone:timber,l);
  s.box(x+n-.6,y+.16,.32,.36,.32,.42,'#d8c98f');
  s.box(x+.24,y+n-.46,.14,.4,.3,.28,'#deca9f');
  s.box(x+.48,y+n-.46,.14,.4,.3,.32,'#deca9f');
   if(l>=3)for(const a of [.12,n-.34]){s.box(x+a,y+n*.42,.96,.18,.18,.8,'#e9dab2');s.pyramid(x+a+.09,y+n*.51,1.08,.15,.22,stone,4);}
   if(l>=4){s.box(x+.24,y+n-.5,.14,.5,.24,.2,'#8d6844');s.box(x+.28,y+n-.46,.34,.42,.16,.03,'#b88a55');}
   if(l>=5){s.box(x+n-.62,y+.14,1.5,.3,.3,.3,gold);}
   if(l>=6)lanternPost(s,x+.3,y+.3,.72,1,.42);
   return;
 }
 if(t==='manor-gardens'){
  s.box(x+.1,y+.1,.04,n-.2,n-.2,.05,'#547b60');
  for(const [a,c]of[[.42,.42],[n-.8,.5],[.5,n-.8]])pine(s,x+a,y+c,.6+l*.16,false);
   if(l>=2){s.box(x+n*.4,y+n*.4,.1,.34,.34,.12,stone);s.box(x+n*.43,y+n*.43,.14,.28,.28,.1,'#4e9aaa');}
   for(const [a,c]of[[.22,n*.5],[n-.36,n*.5],[n*.5,.22],[n*.5,n-.36]])s.pyramid(x+a,y+c,.08,.06,.15,l>=3?gold:'#a26b7e',4);
   if(l>=4){s.box(x+.2,y+.2,.06,n-.4,.08,.1,stone);s.box(x+.2,y+n-.28,.06,n-.4,.08,.1,stone);}
   if(l>=5)for(const [a,c]of[[.6,.6],[n-.7,.6],[.6,n-.7],[n-.7,n-.7]])s.pyramid(x+a,y+c,.3,.07,.14,'#90a369');
   if(l>=6){s.box(x+n*.4,y+n*.4,.5,.34,.34,.1,gold);lanternPost(s,x+.3,y+n-.3,.7,1,.42);}
   return;
 }
 if(t==='monument'){
  if(l>=2){s.box(x+n*.14,y+n*.14,.1,.72,.72,.1,stone);s.box(x+n*.2,y+n*.2,.16,.6,.6,.16,'#e9dab2');}
  s.box(x+n*.32,y+n*.32,.24,.36,.36,.5+l*.4,'#e9dab2');
  s.pyramid(x+n*.5,y+n*.5,.9+l*.4,.16,.22,l>=3?gold:stone,4);
   if(l>=3){s.box(x+n*.12,y+n*.12,.5,.16,.76,.09,stone);s.box(x+n*.12,y+n*.6,.5,.76,.16,.09,stone);}
   if(l>=4)for(const [a,c]of[[.3,.3],[n-.3,.3],[.3,n-.3],[n-.3,n-.3]])s.box(x+a-.06,y+c-.06,.12,.12,.12,.5,stone);
   if(l>=5)s.box(x+n*.32,y+n*.32,1.3,.36,.36,.12,gold);
   if(l>=6){for(const [a,c]of[[n*.2,n*.5],[n*.8,n*.5]])s.box(x+a-.08,y+c-.01,.9,.16,.03,.3,'#5e8c9b');lanternPost(s,x+.25,y+.25,.8,1,.42);}
   return;
 }
 const colors={hall:'#658d99',barracks:'#b96d5a',cottage:'#9ba061',longhouse:'#977851',chapel:'#8e8dae','sunken-chapel':'#679fa5',forge:'#976b54',smeltery:'#846f67',armory:'#667b91',workshop:'#789380',tannery:'#bd9a69',schoolroom:'#ba9369',scriptorium:'#798ca7',butchery:'#a75e54',fletcher:'#7c9868','shieldwall-yard':'#668a91',mason_yard:'#949b90'};
 hut(s,x+.22,y+.22,n-.44,n-.44,.42+l*.16,colors[t]||'#829a78',l);
 if(t==='hall'){
  torch(s,x+n*.3,y+n-.12,.66,[0,1],1.15,.53);
  torch(s,x+n*.7,y+n-.12,.66,[0,1],1.15,.53);
 }
 if(t==='storehouse'){
  // A raised loading canopy and reinforced door set stores apart from homes.
  s.box(x+n*.31,y+n-.15,.13,n*.38,.15,.1,timber);
  for(const dx of [x+n*.31,x+n*.68])s.box(dx,y+n-.13,.13,.055,.055,.62,l>=2?stone:timber);
  s.roof(x+n*.28,y+n-.24,.78,n*.44,.42,.19,l>=3?'#667d91':'#947052');
  if(l>=3){s.box(x+n*.43,y+.36,1.12,.28,.28,.54,stone);s.roof(x+n*.4,y+.32,1.68,.34,.36,.2,'#667d91');}
 }
 workplaceDetails(s,b,n);
 if(spec.housing)homeDetails(s,b,n,l);
 if(['forge','smeltery'].includes(t)){s.box(x+n-.55,y+.28,.1,.28,.28,1.5,stone);s.box(x+n-.57,y+.26,1.6,.32,.32,.12,'#4d514b');s.chimneys.push({owner:s.owner,position:[x+n-.41,y+.42,1.73]});s.source([x+.5,y+n-.15,.33],[0,1],1.65,1,'fire');s.emissive=1;s.box(x+.3,y+n-.2,.2,.4,.024,.26,'#eea55d');s.emissive=0;}
 if(t.includes('chapel')){tower(s,x+.25,y+.25,.4,1.35,stone);s.pyramid(x+.45,y+.45,1.65,.33,.6,colors[t]);}
  if(t==='hall'&&l>=2)tower(s,x+n-.7,y+.25,.48,1.35,stone);
  if(t==='hall'&&l>=4){tower(s,x+.22,y+.25,.48,1.35+l*.14,stone);for(const dx of [.32,.68])s.box(x+n*dx-.08,y+n-.2,.9,.16,.03,.26,dx<.5?'#ad6155':'#5e8c9b');}
  if(t==='hall'&&l>=6){for(const dx of [.3,.7]){s.box(x+n*dx-.09,y+n-.32,.12,.18,.18,.3,stone);s.emissive=1;s.pyramid(x+n*dx,y+n-.23,.42,.12,.24,'#f2b35c',5);s.emissive=0;s.source([x+n*dx,y+n-.23,.5],null,1.6,.8,'fire');}}
  if(t==='barracks'&&l>=4){for(let i=0;i<3;i++)s.box(x+.25+i*.42,y+.35,.12,.1,.1,.7,timber);s.box(x+.2,y+.3,.72,n-.4,.07,.07,timber);}
  if(t==='barracks'&&l>=6){s.box(x+n-.55,y+.3,.12,.3,.3,.9,stone);s.box(x+n-.62,y+.23,1.02,.44,.44,.1,stone);}
  if(t==='storehouse'&&l>=4){s.box(x+.2,y+.2,.12,.4,.3,.3,timber);s.roof(x+.15,y+.15,.54,.5,.4,.14,'#667d91');}
  if(t==='storehouse'&&l>=6){s.box(x+n*.43,y+.36,1.66,.28,.28,.2,gold);}
  if(['forge','smeltery'].includes(t)&&l>=4){s.box(x+.35,y+.28,.1,.24,.24,1.9,stone);s.box(x+.33,y+.26,2.0,.28,.28,.1,'#4d514b');}
  if(['forge','smeltery'].includes(t)&&l>=6){s.box(x+.33,y+.26,2.1,.28,.28,.07,gold);}
  if(['mason_yard','shieldwall-yard'].includes(t)){for(let i=0;i<3;i++)s.box(x+.25+i*.42,y+n-.15,.13,.28,.16,.3,stone);}
}
export function buildingModel(s,b,spec,world,time=0){
 buildingShape(s,b,spec,world,time);
 if(b.id==null)return; // placement previews already have a clear ghost treatment
 buildingDetailLayer(s,b,spec);
 addLivingProps(s,b,spec);
 const x=b.x,y=b.y,n=spec.size;
 if(b.hp<=0){
  s.alpha=.95;
  for(const [dx,dy,w] of [[.17,.2,.28],[n-.51,.23,.34],[.28,n-.49,.3],[n-.5,n-.53,.32]])
   s.box(x+dx,y+dy,.12,w,w,.12,'#56534a');
  s.box(x+n*.42,y+n*.43,.12,n*.18,n*.13,.08,'#3f4742');
 }else if(b.remaining>0){
  s.alpha=.9;
  const h=.8+n*.12;
  for(const dx of [.13,n-.21])for(const dy of [.13,n-.21])s.box(x+dx,y+dy,.12,.08,.08,h,timber);
  for(const dy of [.13,n-.21])s.box(x+.13,y+dy,h*.57,n-.26,.07,.07,'#d0af79');
  s.box(x+.18,y+.21,.13,Math.min(.54,n-.36),.24,.17,'#c5a16e');
 }
 productionPile(s,b,spec);
}

// Phase 6 — the on-site haul is visible on the building itself: a stockpile
// grows in four steps as the tap reserve fills (harvest.capacity), and a gold
// pennant flies once the haul is worth collecting. Pure geometry over b
// fields; the static mesh cache keys on productionStage()/reserveReady() so
// it only repaints when a step or the badge flips, never per reserve unit.
export function productionStage(b,spec){
 if(!spec?.production||b.hp<=0||b.remaining>0)return -1;
 const level=Math.max(1,Math.floor(+b.level||1));
 const cap=Math.max(1,reserveCapacity(spec,level));
 const held=Number.isFinite(+b.harvestBonus)?Math.max(0,+b.harvestBonus):0;
 return Math.min(3,Math.floor((held/cap)*4));
}
const PILES={
 wood:{kind:'timber',a:'#8a6a48',b:'#b38a59'},
 lumber:{kind:'timber',a:'#c8a06a',b:'#d9b57e'},
 frostwood:{kind:'timber',a:'#7e9aa3',b:'#b6d4da'},
 food:{kind:'sacks',a:'#c8a44e',b:'#e1c776'},
 gold:{kind:'ore',a:'#8b8378',b:'#e5bd66'},
 plate:{kind:'bars',a:'#8b96a0',b:'#b7c7dc'},
};
function productionPile(s,b,spec){
 const stage=productionStage(b,spec);
 if(stage<=0)return;
 const n=spec.size,px=b.x+n*.78,py=b.y+n*.82,pile=PILES[spec.production]||PILES.wood;
 if(pile){const {a,b:c}=pile;
  if(pile.kind==='timber'){
   for(let i=0;i<stage;i++)s.box(px-.26+i*.16,py-.2,.1,.13,.4,.12,i%2?c:a);
   if(stage>=3)s.box(px-.24,py-.08,.22,.42,.16,.1,c);
  }else if(pile.kind==='sacks'){
   for(let i=0;i<stage;i++)s.pyramid(px-.16+(i%2)*.3,py-.12+Math.floor(i/2)*.3,.02,.1,.17,i%2?c:a,5);
   if(stage>=3)s.box(px-.22,py-.1,.24,.36,.14,.12,c);
  }else if(pile.kind==='ore'){
   for(let i=0;i<stage;i++)s.pyramid(px-.14+(i%2)*.26,py-.1+Math.floor(i/2)*.26,.02,.09,.14,i%2?c:a,5);
   if(stage>=3)s.pyramid(px-.02,py+.02,.02,.3,.12,c,6);
  }else{
   for(let i=0;i<stage;i++)s.box(px-.3,py-.24+i*.16,.1,.12,.3,.07,i%2?c:a);
   if(stage>=3)s.box(px-.24,py-.2,.17,.42,.26,.06,a);
  }
 }
 if(reserveReady(b,spec)){s.box(b.x+.24,b.y+n-.14,.1,.05,.05,.52,timber);s.box(b.x+.29,b.y+n-.14,.58,.24,.03,.14,'#f2c96e');}
}
export function drawVillage3D(r,world,time,light){const s=new MeshScene(r),W=r.data.world.width,H=r.data.world.height;
 // Phase 2/3/4 — one resolved sky per frame: mesh shading follows the clock,
 // and the static geometry cache below stays light-agnostic (clock is not a key).
 s.light=light||skyLightAt(world.elapsed,r.data,{calm:r.calm});
 // Large settlements keep outfit/weapon silhouettes but omit tiny face/trim meshes.
 s.characterDetail=world.troops.length+world.enemies.length<=64;
 s.dynamicDoors=true;
  // Project static meshes only when the camera, footprint, building state or
  // visible defense/production stage changes; moving gates quantize to four
  // steps and traps key only their armed state, never every cooldown tick.
  const key=JSON.stringify([r.width,r.height,r.cx,r.cy,r.cam,W,H,r.claimedTileCount??-1,trailRevision(world),world.wave||0,world.buildings.map(b=>{const spec=r.data.buildings[b.type];return [b.id,b.type,b.x,b.y,b.level,b.hp<=0,b.remaining>0,productionStage(b,spec),spec?.production&&reserveReady(b,spec)?1:0,b.type==='gate'?gateLiftStage(r,b,world,time):0,b.type.includes('trap')?(trapArmed(b)?1:0):0];})]);
 if(r._meshStatic?.key===key){s.faces=r._meshStatic.faces.slice();s.sources=r._meshStatic.sources;s.chimneys=r._meshStatic.chimneys;s.doors=r._meshStatic.doors||[];}else{
 // Border trees share depth sorting with the village, including reverse views.
 for(let i=-1;i<W+2;i++){s.owner=null;if(i%2)pine(s,i,-1.5,1.4+(i%3)*.22);if(i%3===0)pine(s,-1.5,((i%H)+H)%H,1.5);if(i%3===1)pine(s,W+1,i%H,1.6);if(i%4===0)pine(s,i,H+3,1.5);}
  addTrailGeometry(s,world);
  addEnvironmentScenery(s,world,r.data);
  for(const b of world.buildings)buildingModel(s,b,r.data.buildings[b.type],world,time);
 prepareSourceLighting(s);
 prepareNearbyLight(s,world);
 r._meshStatic={key,faces:s.faces.slice(),sources:s.sources,chimneys:s.chimneys,doors:s.doors};
 }

  r._motionWorld=world;
  addLivingMechanisms(s,world,time);
  addWindLife(s,world,time);
  for(const u of world.troops)if(!insideWorkplace(world,r.data,u))characterModel(s,u,r.data,time);for(const e of world.enemies)characterModel(s,e,r.data,time,true);
  if(r.placing&&r.hover){const source=world.buildings.find(b=>b.id===r.moving),ghosts=placementCells(r).map(p=>({type:r.placing,...p,level:source?.level||1,hp:1,remaining:1,id:null})),preview={buildings:[...world.buildings.filter(b=>b.id!==r.moving),...ghosts]};for(const b of ghosts)buildingModel(s,b,r.data.buildings[b.type],preview,time);}
 drawCelestialShadows(s);
 drawGroundMist(s,time);
 drawSourceSpill(s,time);
 s.paint();
 drawPracticalBloom(s,time);
 drawChimneyWisps(s,time);
 drawCelestialAir(r,s.light);
 drawBuildingActivity(r,world,time);
}
