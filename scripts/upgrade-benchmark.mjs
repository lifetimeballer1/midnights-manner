// 150-villager phone renderer baseline for max building upgrades.
// Runs against the built game in an isolated Chrome profile and never writes saves.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve,relative,isAbsolute} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';

function killBrowser(proc){try{if(process.platform==='win32')spawnSync('taskkill',['/pid',String(proc.pid),'/T','/F'],{stdio:'ignore'});else proc.kill();}catch{}}
const root=resolve('dist'),profile=await mkdtemp(join(tmpdir(),'midnight-upgrade-bench-'));
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/midnights-manner\//,'');if(!path||path==='/')path='index.html';const file=resolve(root,path),rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--enable-precise-memory-info','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
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
 const waitFor=async(expression,tries=160)=>{for(let i=0;i<tries;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+expression);};
 await call('Runtime.enable');await call('Page.enable');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/midnights-manner/?benchmark=1`});
 await waitFor('Boolean(window.midnightsManner)');
 await evaluate('document.querySelector("#begin").click()');await waitFor('window.midnightsManner.ready');
 const population=await evaluate('window.midnightsManner.stressUpgrades(150)');
 assert.equal(population.population,150,'benchmark population');
 const sample=async mode=>{
  const tiers=await evaluate(`window.midnightsManner.setUpgradeMode("${mode}")`);
  await new Promise(r=>setTimeout(r,300));
  await evaluate('window.midnightsManner.resetFrameReport()');
  await waitFor('window.midnightsManner.frameReport()?.n>=120',240);
  const report=await evaluate('window.midnightsManner.frameReport()');
  assert.ok(report&&report.n>=120,mode+' frame sample collected');
  for(const k of ['avg','p50','p95','faces','staticFaces','drawCalls','triangles'])assert.ok(Number.isFinite(report[k]),mode+' '+k+' is finite');
  assert.ok(report.faces<30000&&report.triangles<60000,`${mode} mesh runaway`);
  return {tiers,...report};
 };
 const baseline=await sample('baseline');
 const feature=await sample('feature');
 assert.deepEqual(errors,[],'no browser runtime errors');
 const pct=(a,b)=>+(((b-a)/a)*100).toFixed(1);
 const delta={avgPct:pct(baseline.avg,feature.avg),p50Pct:pct(baseline.p50,feature.p50),p95Pct:pct(baseline.p95,feature.p95),facesPct:pct(baseline.faces,feature.faces),trianglesPct:pct(baseline.triangles,feature.triangles)};
 console.log('UPGRADE_PAIRED_BENCHMARK '+JSON.stringify({viewport:'390x844@2x',villagers:population.population,baseline,feature,delta}));
}finally{
 try{ws?.close();}catch{}
 killBrowser(chrome);server.close();
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
