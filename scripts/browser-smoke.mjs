// Dependency-free real-Chromium regression test. CI provides google-chrome.
// Local usage: CHROME_BIN=/path/to/chrome npm run test:browser
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const root=resolve('dist'),profile=await mkdtemp(join(tmpdir(),'midnight-browser-'));
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/midnights-manner\//,'');if(!path||path==='/')path='index.html';const file=resolve(root,path);if(!file.startsWith(root+'/'))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
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
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/midnights-manner/`});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Browser evaluation failed');return r.result.value;};
 for(let i=0;i<100;i++){if(await evaluate('Boolean(window.midnightsManner)'))break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(await evaluate('Boolean(window.midnightsManner)'),'game loaded');
 await mkdir('artifacts',{recursive:true});
 const screenshot=async name=>{const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`artifacts/${name}.png`,Buffer.from(data,'base64'));};
 await screenshot('desktop');
 const result=await evaluate(`(()=>{
 const click=s=>{const el=document.querySelector(s);if(!el)throw Error('Missing '+s);el.click();};
 const snap=()=>window.midnightsManner.snapshot();const n=snap().world.buildings.length;
 click('[data-build="farm"]');const c=document.querySelector('#world'),r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+510/1100*r.width,clientY:r.top+174/740*r.height}));
 if(snap().world.buildings.length!==n+1)throw Error('placement failed');click('#cancel');
 click('[data-tab="troops"]');click('[data-gear="axe"]');if(snap().world.troops[0].gear!=='axe')throw Error('equip failed');click('[data-level]');if(snap().world.troops[0].level!==2)throw Error('training failed');click('#save');
 click('[data-tab="story"]');click('[data-mission="first-harvest"]');if(!snap().mission)throw Error('mission failed');click('[data-home]');if(snap().mission)throw Error('return failed');click('#raid');if(!snap().world.enemies.length)throw Error('raid failed');click('#pause');if(!window.midnightsManner.paused)throw Error('pause failed');click('#save');return {placement:true,equipment:true,training:true,campaign:true,raid:true,pause:true};})()`);
 await call('Page.reload');
 await new Promise(r=>setTimeout(r,800));
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[0].level'),2,'level restored');
 assert.equal(await evaluate('window.midnightsManner.snapshot().world.troops[0].gear'),'axe','gear restored');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('[data-tab=build]').click()");
 await screenshot('mobile');
 assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'),false,'no mobile horizontal overflow');
 const ratio=await evaluate('(()=>{const c=document.querySelector("canvas"),r=c.getBoundingClientRect();return (r.width/r.height)/(c.width/c.height)})()');assert.ok(Math.abs(ratio-1)<.01,'mobile canvas input coordinates match display');
 assert.deepEqual(errors,[],'no browser errors');
 console.log(JSON.stringify({...result,saveReload:true,mobileLayout:true,consoleErrors:errors}));
}finally{ws?.close();chrome.kill();server.close();await new Promise(r=>setTimeout(r,300));await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
