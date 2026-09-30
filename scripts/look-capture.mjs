// Deterministic look snapshots for presentation-phase reviews (Phase 1).
// Usage: npm run build && CHROME_BIN=<chrome|edge> node scripts/look-capture.mjs
// Pins camera, calm motion and a clear-sky clock per phase so runs compare
// frame-for-frame. Writes artifacts/look-*.png (gitignored) and prints a JSON
// summary. Read-only: the game loop and saves are never altered.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve,relative,isAbsolute} from 'node:path';
import {createServer} from 'node:http';
import {DAY_LENGTH,phaseAt,weatherAt} from '../src/systems/daynight.js';
import {DEFAULT_YAW,DEFAULT_PITCH} from '../src/camera.js';
import assert from 'node:assert/strict';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {VERSION} from '../src/storage.js';
// Windows browsers leave crashpad/utility children behind `kill()`; those
// children inherit our stdio handles and can hang a piping shell long after
// node exits. Kill the whole tree so the harness always returns promptly.
function killBrowser(proc){try{if(process.platform==='win32')spawnSync('taskkill',['/pid',String(proc.pid),'/T','/F'],{stdio:'ignore'});else proc.kill();}catch{}}
const root=resolve('dist'),world=JSON.parse(await readFile(new URL('../data/world.json',import.meta.url))),profile=await mkdtemp(join(tmpdir(),'midnight-look-'));
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/midnights-manner\//,'');if(!path||path==='/')path='index.html';const file=resolve(root,path),rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try{
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);let log='';chrome.on('error',reject);chrome.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{const response=JSON.parse(event.data);if(response.id){const cb=pending.get(response.id);if(cb){pending.delete(response.id);response.error?cb.reject(Error(JSON.stringify(response.error))):cb.resolve(response.result);}}else if(response.method==='Runtime.exceptionThrown')errors.push(response.params.exceptionDetails.exception?.description||response.params.exceptionDetails.text);};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Browser evaluation failed');return r.result.value;};
 const waitFor=async (expression,tries=100)=>{for(let i=0;i<tries;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
 await call('Runtime.enable');await call('Page.enable');
 if(process.env.FRONTIER_CAPTURE==='1'||process.env.POLISH_CAPTURE==='1'){
  const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','quests','expansion','biomes'].map(async name=>[name,JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url)))])));
  const village=createWorld(data);
  village.nextRaidAt=1e9;village.nextFrontierEventAt=1e9;
  for(const [type,profession,x,y,level]of [['whisper-grove','heartwarden',2,2,1],['whisper-grove','heartwarden',2,5,2],['blackwater-weir','mudlark',5,2,1],['blackwater-weir','mudlark',5,5,2]]){
   const b=makeBuilding(type,x,y,data,level),u=makeUnit(profession,data);
   b.remaining=0;b.harvestBonus=160;u.workplace=b.id;u.x=x+1;u.y=y+1;u.armor=profession==='heartwarden'?'whisper-coat':'mire-coat';u.armorOwned=[u.armor];
   village.buildings.push(b);village.troops.push(u);
  }
  if(process.env.POLISH_CAPTURE==='1'){
   village.buildings=[];
   const types=['hall','cottage','mine','farm','lumber','market','watchfire','storehouse'];
   for(let i=0;i<56;i++){
    const type=types[i%types.length],spec=data.buildings[type];if(!spec)continue;
    const b=makeBuilding(type,4+(i%8)*3,4+Math.floor(i/8)*3,data,Math.min(3,spec.tiers.length));
    b.remaining=0;b.harvestBonus=spec.production?430:0;village.buildings.push(b);
   }
   village.troops=Array.from({length:150},(_,i)=>{
    const u=makeUnit(i%2?'warrior':'archer',data);u.x=5+(i%15)*1.4;u.y=5+Math.floor(i/15)*1.4;u.order={kind:'hold'};return u;
   });
   for(const key of Object.keys(village.resources))village.resources[key]=0;
  }
  const state={version:VERSION,world:village,home:null,mission:null,completed:[],unlocks:data.world.locked,xp:2640,vlevel:11,questsCompleted:data.quests.map(q=>q.id)};
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('midnights-manner-v2',${JSON.stringify(JSON.stringify(state))});localStorage.setItem('midnights-manner-guide-v1','{"done":true}');`});
 }
 // Calm motion before load: the renderer reads prefers-reduced-motion at boot.
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/midnights-manner/`});
 await waitFor('Boolean(window.midnightsManner)');
 await evaluate('document.querySelector("#begin").click()');await waitFor('window.midnightsManner.ready');
 if(process.env.POLISH_CAPTURE==='1')assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops.length'),150,'mature settlement fixture loaded');
 if(process.env.FRONTIER_CAPTURE==='1')assert.ok(await evaluate(`['whisper-grove','blackwater-weir'].every(type=>window.midnightsManner.snapshot().world.buildings.filter(b=>b.type===type).length===2)`),'frontier save fixture loaded');
 // Dismiss the first-run notice board if this build shows one.
 await new Promise(r=>setTimeout(r,600));await evaluate('document.querySelector("#news-close")?.click()');
 const hall=await evaluate('(()=>{const b=window.midnightsManner.snapshot().world.buildings.find(b=>b.type==="hall");return {x:b.x+1,y:b.y+1};})()');
 const camera=zoom=>`window.midnightsManner.setCamera({yaw:${DEFAULT_YAW},pitch:${DEFAULT_PITCH},zoom:${zoom},x:${hall.x},y:${hall.y}})`;
 await evaluate(camera(1.8));
 const clearAt=fraction=>{for(let day=0;day<60;day++){const t=day*DAY_LENGTH+DAY_LENGTH*fraction;if(weatherAt(t,{world}).id==='clear')return t;}return DAY_LENGTH*fraction;};
 const setSky=async t=>{await evaluate(`window.midnightsManner.setElapsed(${t})`);await new Promise(r=>setTimeout(r,300));};
 await mkdir('artifacts',{recursive:true});
 const shot=async name=>{const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`artifacts/${name}.png`,Buffer.from(data,'base64'));};
 const summary={views:[],errors:[]};
 // GUI title proof (env-gated): the title screen shows before begin, so
 // capture it from a second load after the main pass leaves saves warm.
 if(process.env.GUI_CAPTURE==='1'){
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/midnights-manner/`});
  await waitFor('Boolean(window.midnightsManner)');
  await new Promise(r=>setTimeout(r,1200));
  await shot('look-gui-title');
  summary.views.push({file:'artifacts/look-gui-title.png'});
  await evaluate('document.querySelector("#begin").click()');await waitFor('window.midnightsManner.ready');
  await new Promise(r=>setTimeout(r,600));await evaluate('document.querySelector("#news-close")?.click()');
 }
 for(const [name,fraction] of [['dawn',0.01],['day',0.3],['dusk',0.54],['night',0.8]]){
  const t=clearAt(fraction);await setSky(t);await shot('look-desktop-'+name);
  summary.views.push({file:`artifacts/look-desktop-${name}.png`,phase:phaseAt(t,{world}).id,weather:weatherAt(t,{world}).id,elapsed:t});
 }
 // Weather proof shots: the first rain day and the first fog day that fit
 // the scan window, pinned at the same camera as the clear views.
 const findWeather=(id,fraction)=>{for(let day=0;day<60;day++){const t=day*DAY_LENGTH+DAY_LENGTH*fraction;if(weatherAt(t,{world}).id===id)return t;}return null;};
 for(const [id,fraction,name] of [['rain',0.3,'look-desktop-day-rain'],['fog',0.8,'look-desktop-night-fog']]){
  const t=findWeather(id,fraction);
  if(t==null){summary.views.push({file:null,weather:id,skipped:'no such day in scan window'});continue;}
  await setSky(t);await shot(name);
  summary.views.push({file:`artifacts/${name}.png`,phase:phaseAt(t,{world}).id,weather:weatherAt(t,{world}).id,elapsed:t});
 }
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await new Promise(r=>setTimeout(r,250));await evaluate(camera(1.65));
 const tNight=clearAt(0.8);await setSky(tNight);await shot('look-phone-night');
 summary.views.push({file:'artifacts/look-phone-night.png',phase:phaseAt(tNight,{world}).id,weather:weatherAt(tNight,{world}).id,elapsed:tNight});
 // GUI proof shots (env-gated, default runs untouched): open the build
 // drawer on desktop and on phone so reskin phases judge real panels.
 if(process.env.GUI_CAPTURE==='1'){
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await new Promise(r=>setTimeout(r,250));await evaluate(camera(1.8));
  await evaluate(`document.querySelector('[data-tab=build]').click()`);
  await new Promise(r=>setTimeout(r,600));await shot('look-gui-drawer');
  summary.views.push({file:'artifacts/look-gui-drawer.png'});
  await evaluate(`document.querySelector('#close-panel').click()`);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await new Promise(r=>setTimeout(r,250));
  await evaluate(`document.querySelector('[data-tab=build]').click()`);
  await new Promise(r=>setTimeout(r,600));await shot('look-gui-drawer-phone');
  summary.views.push({file:'artifacts/look-gui-drawer-phone.png'});
 }
 if(process.env.FRONTIER_CAPTURE==='1'){
  await evaluate(`window.midnightsManner.setCamera({yaw:${DEFAULT_YAW},pitch:${DEFAULT_PITCH},zoom:1.65,x:4,y:4})`);
  await new Promise(r=>setTimeout(r,300));await shot('look-frontier-phone');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate('window.midnightsManner.setCamera({zoom:2.5,x:4,y:4})');
  await new Promise(r=>setTimeout(r,300));await shot('look-frontier-desktop');
  assert.ok(await evaluate(`(()=>{const g=window.midnightsManner;return g.snapshot().world.buildings.filter(b=>['whisper-grove','blackwater-weir'].includes(b.type)).every(b=>g.modelPoints(b.id).length>0);})()`),'both frontier tiers have selectable visible geometry');
  summary.views.push({file:'artifacts/look-frontier-phone.png'},{file:'artifacts/look-frontier-desktop.png'});
  const seconds=Number(process.env.SOAK_SECONDS||60);
  assert.ok(Number.isFinite(seconds)&&seconds>=10&&seconds<=600,'soak duration must be 10-600 seconds');
  const samples=[],start=Date.now(),startElapsed=await evaluate('window.midnightsManner.snapshot().world.elapsed');
  while(Date.now()-start<seconds*1000){
   await new Promise(r=>setTimeout(r,1000));
   const sample=await evaluate('({frame:window.midnightsManner.frameReport(),effects:window.midnightsManner.snapshot().world.effects.length})');
   assert.ok(sample.frame?.n>=10&&Number.isFinite(sample.frame.p95),'live frame telemetry');
   assert.ok(sample.frame.faces<30000&&sample.frame.staticFaces<30000,'face budget');
   assert.ok(sample.effects<=60,'effect pool budget');samples.push(sample);
  }
  const elapsed=await evaluate('window.midnightsManner.snapshot().world.elapsed');
  assert.ok(elapsed>startElapsed+seconds*.5,'soak must run active simulation');
  summary.soak={seconds,samples:samples.length,activeSeconds:elapsed-startElapsed,maxFaces:Math.max(...samples.map(s=>s.frame.faces)),maxStaticFaces:Math.max(...samples.map(s=>s.frame.staticFaces)),maxEffects:Math.max(...samples.map(s=>s.effects))};
 }
 if(process.env.POLISH_CAPTURE==='1'){
  await new Promise(r=>setTimeout(r,200));
  const report=async()=>{await new Promise(r=>setTimeout(r,300));return evaluate('window.midnightsManner.frameReport().lighting');};
  await evaluate('document.querySelector("#close-panel").click()');
  await evaluate('window.midnightsManner.setCamera({x:14,y:13,zoom:.7})');
  let overview=await report();assert.equal(overview.unitShadows,0,'overview disables villager shadows');assert.ok(overview.shadows>0,'overview retains building shadows');assert.equal(overview.penumbraPasses,2);
  await shot('look-mature-overview');
  await evaluate('window.midnightsManner.setCamera({zoom:1.65})');
  const close=await report();assert.ok(close.unitShadows>0,'close units keep shadows');assert.equal(close.penumbraPasses,3);assert.ok(close.shadowCulled>0,'offscreen shadows culled');assert.ok(close.spillCulled>0,'offscreen lights culled');assert.ok(close.bloom<=72&&close.shadowCache<=512,'phone budgets');
  await shot('look-mature-close-night');
  for(const weather of ['rain','fog']){
   const t=findWeather(weather,.8);await setSky(t);const info=await report();assert.equal(info.rays,0,'wet weather suppresses god rays');assert.equal(info.fogBanks,4,'phone fog budget');await shot('look-mature-night-'+weather);
  }
  // Frozen sky motion and static lighting survive reduced-motion preferences.
  assert.ok(await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'));await setSky(clearAt(.8));
  const g='window.midnightsManner';
  assert.ok(await evaluate('document.querySelector("#collect-ready").closest(".bottom-hud")!==null'),'collect lives in bottom HUD');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#collect-ready")).position'),'static','no floating collect action');
  assert.equal(await evaluate('document.querySelectorAll(".dock .dock-button").length'),5,'five navigation actions');
  await evaluate(`(()=>{const e=document.querySelector('#collect-ready');window.__heldBefore=${g}.snapshot().world.buildings.reduce((n,b)=>n+(b.harvestBonus||0),0);if(e.hidden||e.disabled)throw Error('Collect unavailable');e.click();window.__collectDisabled=e.disabled;})()`);
  assert.ok(await evaluate(`${g}.snapshot().world.buildings.reduce((n,b)=>n+(b.harvestBonus||0),0)<window.__heldBefore`),'bottom collection banks reserves');
  assert.equal(await evaluate('window.__collectDisabled'),true,'zero ready is disabled');
  await call('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:2,mobile:true});await new Promise(r=>setTimeout(r,300));
  const bounds=await evaluate(`['#collect-ready','#army-summary','.bottom-hud',...Array.from(document.querySelectorAll('.dock .dock-button')).map(e=>'#'+e.id).filter(s=>s!=='#')].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,right:r.right,bottom:r.bottom};})`);
  assert.ok(bounds.every(r=>r.x>=0&&r.right<=320&&r.bottom<=740),'narrow phone HUD fits');await shot('look-narrow-hud');
  for(const [tab,category] of [['build','projects'],['story','lore']]){
   await evaluate(`document.querySelector('[data-tab="${tab}"]').click()`);
   assert.equal(await evaluate('document.querySelector("#collect-ready").hidden'),true,'menus hide collect');
   await evaluate(`document.querySelector('[data-category="${category}"]').click()`);
   await new Promise(r=>setTimeout(r,150));
   const tabBounds=await evaluate(`(()=>{const e=document.querySelector('[data-category="${category}"]'),p=e.parentElement,r=e.getBoundingClientRect(),b=p.getBoundingClientRect();return {left:r.left,right:r.right,railLeft:b.left,railRight:b.right};})()`);
   assert.ok(tabBounds.left>=tabBounds.railLeft-1&&tabBounds.right<=tabBounds.railRight+1,'active overflow tab fully visible: '+JSON.stringify(tabBounds));
   await shot('look-narrow-'+category);await evaluate('document.querySelector("#close-panel").click()');
  }
  summary.mature={troops:150,overview,close,narrowPhone:true,collection:true,tabOverflow:true,reducedMotion:true};
 }
 summary.frame=await evaluate('window.midnightsManner.frameReport()');
 summary.errors=errors;
 console.log(JSON.stringify(summary,null,1));
 assert.ok(summary.frame?.faces<30000&&summary.frame.staticFaces<30000,'capture face budget');
 if(errors.length)throw Error('Page errors during capture: '+errors.join(' | '));
}finally{
 try{ws?.close();}catch{}
 killBrowser(chrome);server.close();
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
