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
 // Calm motion before load: the renderer reads prefers-reduced-motion at boot.
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/midnights-manner/`});
 await waitFor('Boolean(window.midnightsManner)');
 await evaluate('document.querySelector("#begin").click()');await waitFor('window.midnightsManner.ready');
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
 summary.frame=await evaluate('window.midnightsManner.frameReport()');
 summary.errors=errors;
 console.log(JSON.stringify(summary,null,1));
 if(errors.length)throw Error('Page errors during capture: '+errors.join(' | '));
}finally{
 try{ws?.close();}catch{}
 killBrowser(chrome);server.close();
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
