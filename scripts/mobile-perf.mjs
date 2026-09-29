// Reproducible Goal 1 stress benchmark: full 52x44 frontier, 150 visible villagers,
// portrait phone viewport. Canvas has no WebGL draw-call counter, so renderer
// telemetry reports mesh polygons/triangles and the two paint ops (fill+stroke)
// performed per mesh face. CDP supplies JS heap usage.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve,relative,isAbsolute} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createWorld,makeUnit,makeBuilding} from '../src/model.js';
import {nextStep} from '../src/systems/pathfinding.js';

function killBrowser(proc){try{if(process.platform==='win32')spawnSync('taskkill',['/pid',String(proc.pid),'/T','/F'],{stdio:'ignore'});else proc.kill();}catch{}}
const names=['world','troops','buildings','expansion','biomes'];
const data=Object.fromEntries(await Promise.all(names.map(async name=>[name,JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url)))])));
const world=createWorld(data);
world.tiles?.forEach(t=>{t.claimed=true;});
world.resources={...world.resources,wood:50000,food:50000,gold:50000,frostwood:5000,plate:5000,lumber:5000,flour:5000,bread:5000};
const extra=[['farm',4,4],['mine',8,4],['lumber',12,4],['forge',4,8],['workshop',8,8],['barracks',12,8],['tower',6,6],['tower',10,10],['cottage',2,10],['pasture',14,10],['pond',16,6],['sawmill',6,12],['smeltery',10,12],['chapel',14,12],['market',16,10],['wall',3,3],['wall',3,4],['wall',3,5],['gate',3,6],['archer_tower',12,12]];
for(const [type,x,y] of extra)if(data.buildings[type])world.buildings.push(makeBuilding(type,x,y,data));
const preferred=['farmer','miner','lumberjack','builder','scholar','fisherman','forager','mason','sawyer','miller','warrior','archer'].filter(t=>data.troops[t]);
const troopTypes=preferred.length?preferred:Object.keys(data.troops);
world.troops=[];
for(let i=0;i<150;i++){
 const type=troopTypes[i%troopTypes.length],u=makeUnit(type,data,i);
 u.x=5+(i%15)*.5;u.y=5+(Math.floor(i/15)%10)*.5;u.level=3+(i%5);u.name='Perf '+(i+1);u.traits=i%3===0?['hard_worker']:[];u.jobXp=0;u.jobLevel=1;u.manualPost=false;
 world.troops.push(u);
}
const hall=world.buildings.find(b=>b.type==='hall');
assert.ok(hall,'stress village has a Manor Hall');
const hallSize=data.buildings.hall.size||2,target={x:hall.x+hallSize/2,y:hall.y+hallSize/2};
const pathStart=performance.now();
for(let i=0;i<150;i++){
 const actor={x:.5+((i*7)%data.world.width),y:.5+((i*11)%data.world.height)};
 nextStep(world,data,actor,target,.9,false,true);
}
const pathfinding150Ms=performance.now()-pathStart;
assert.ok(pathfinding150Ms<5000,`150 full-grid paths took ${pathfinding150Ms.toFixed(1)}ms`);

const state={version:13,world,home:null,mission:null,completed:[],unlocks:['tower'],xp:2600,vlevel:11,questsCompleted:[],tradeDay:null,tradesUsed:{},calendarDay:null,gatheredAtBell:null};
const saveBlob=JSON.stringify(state);
const root=resolve('dist'),profile=await mkdtemp(join(tmpdir(),'midnight-perf-'));
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/midnights-manner\//,'');if(!path||path==='/')path='index.html';const file=resolve(root,path),rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
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
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(method,params={})=>send(method,params,sessionId);
 await call('Runtime.enable');await call('Page.enable');await call('Performance.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 // Seed before the app module runs. Seeding after first boot is racy because
 // pagehide persists the starter village during reload and overwrites the fixture.
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('midnights-manner-v2',${JSON.stringify(saveBlob)})}catch{}`});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Browser evaluation failed');return r.result.value;};
 const waitFor=async(expression,tries=120)=>{for(let i=0;i<tries;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/midnights-manner/`});await waitFor('Boolean(window.midnightsManner)');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops.length'),150,'heavy save loads 150 villagers');
 await evaluate('document.querySelector("#begin").click()');await waitFor('window.midnightsManner.ready');
 await evaluate('document.querySelector("#recenter").click();window.midnightsManner.resetFrameReport()');
 await new Promise(r=>setTimeout(r,4500));
 const frame=await evaluate('window.midnightsManner.frameReport()');
 const perf=await call('Performance.getMetrics');
 const metric=Object.fromEntries((perf.metrics||[]).map(m=>[m.name,m.value]));
 const jsHeapUsedMB=(metric.JSHeapUsedSize||0)/1024/1024;
 assert.ok(frame&&frame.n>=30&&Number.isFinite(frame.avg)&&Number.isFinite(frame.p95),'portrait frame telemetry captured');
 assert.ok(frame.faces<30000&&frame.meshTriangles<60000,'visible mesh work remains bounded');
 assert.ok(Number.isFinite(jsHeapUsedMB)&&jsHeapUsedMB>0,'CDP reports JS heap');
 assert.deepEqual(errors,[],'no browser runtime errors');
 await mkdir('artifacts',{recursive:true});
 const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
 await writeFile('artifacts/mobile-perf-150.png',Buffer.from(shot.data,'base64'));
 const report={viewport:'390x844@2',villagers:150,world:`${data.world.width}x${data.world.height}`,claimedTiles:world.tiles.filter(t=>t.claimed).length,pathfinding150Ms:Math.round(pathfinding150Ms*100)/100,frame,jsHeapUsedMB:Math.round(jsHeapUsedMB*100)/100};
 console.log('MOBILE_PERF_150 '+JSON.stringify(report));
}finally{ws?.close();killBrowser(chrome);server.close();await new Promise(r=>setTimeout(r,250));await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
