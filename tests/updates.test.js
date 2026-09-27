import test from 'node:test';
import assert from 'node:assert/strict';
import {GameUpdates} from '../src/updates.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
class Events {constructor(){this.handlers={};}addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}emit(name){for(const fn of this.handlers[name]||[])fn();}}
function setup({saving=true,build=true}={}){
 const elements=Object.fromEntries(['#opt-update','#opt-refresh','#update-status','#update-notice'].map(id=>[id,{hidden:true,disabled:false,textContent:''}]));
 const doc=new Events();doc.hidden=false;doc.querySelector=s=>s.startsWith('meta')?(build?{content:'test-build'}:null):elements[s];
 const sw=new Events(),registration=new Events();sw.controller={};sw.register=async()=>registration;registration.update=async()=>{};
 let saved=0,reloads=0,messages=0,timeout;
 const worker=new Events();worker.state='installed';worker.postMessage=()=>messages++;
 const win={location:{reload:()=>reloads++},setInterval(){},setTimeout(fn){timeout=fn;return 1;},clearTimeout(){},addEventListener(){}};
 const game={paused:false,persist:()=>{saved++;return saving;}};
 const updates=new GameUpdates(game,{doc,nav:{serviceWorker:sw},win});
 return {updates,game,elements,registration,worker,sw,get saved(){return saved;},get reloads(){return reloads;},get messages(){return messages;},expire:()=>timeout()};
}
test('update detection offers a notice without activation or reload',async()=>{
 const t=setup();await t.updates.started;t.registration.waiting=t.worker;await t.updates.check(true);
 assert.equal(t.elements['#update-notice'].hidden,false);assert.equal(t.messages,0);assert.equal(t.saved,0);assert.equal(t.reloads,0);
});
test('applying a waiting update saves before activating and reloads exactly once',async()=>{
 const t=setup();await t.updates.started;t.registration.waiting=t.worker;t.updates.apply();t.updates.apply();
 assert.equal(t.saved,1);assert.equal(t.messages,1);assert.equal(t.reloads,0);assert.equal(t.game.paused,true);
 t.sw.emit('controllerchange');t.sw.emit('controllerchange');assert.equal(t.reloads,1);
});
test('failed save blocks activation and refresh and restores play',async()=>{
 const t=setup({saving:false});await t.updates.started;t.registration.waiting=t.worker;t.updates.apply();
 assert.equal(t.messages,0);assert.equal(t.reloads,0);assert.equal(t.game.paused,false);assert.match(t.elements['#update-status'].textContent,/Refresh cancelled/);
});
test('ordinary refresh works without a service-worker build and saves first',async()=>{
 const t=setup({build:false});await t.updates.started;t.updates.apply();assert.equal(t.saved,1);assert.equal(t.reloads,1);
});
test('offline checks leave game usable and a later retry succeeds',async()=>{
 const t=setup();await t.updates.started;t.registration.update=async()=>{throw Error('offline');};await t.updates.check(true);
 assert.match(t.elements['#update-status'].textContent,/internet/);assert.equal(t.elements['#opt-update'].disabled,false);assert.equal(t.reloads,0);
 t.registration.update=async()=>{};await t.updates.check(true);assert.match(t.elements['#update-status'].textContent,/up to date/);
});
test('activation timeout permits retry without discarding the saved village',async()=>{
 const t=setup();await t.updates.started;t.registration.waiting=t.worker;t.updates.apply();t.expire();assert.equal(t.updates.applying,false);assert.equal(t.game.paused,false);assert.equal(t.reloads,0);
 t.updates.apply();assert.equal(t.messages,2);
});
test('an update activated by another window offers refresh without forcing it',async()=>{
 const t=setup();await t.updates.started;t.sw.emit('controllerchange');assert.equal(t.updates.ready,true);assert.equal(t.reloads,0);
});
test('worker waits for approval, cleans only its own scope, and never returns HTML for assets',async()=>{
 const source=await readFile(new URL('../scripts/service-worker.js',import.meta.url),'utf8');
 const handlers={},deleted=[],network=[],cached=new Map(),prefix='game:/village:',cacheName=prefix+'new';let skipped=0,claimed=0;
 const cache={addAll:async()=>{},match:async request=>cached.get(String(request.url||request))};
 const context={URL,Request,Promise,CACHE:cacheName,PREFIX:prefix,CORE:['https://example.com/village/index.html'],
  caches:{open:async()=>cache,keys:async()=>[prefix+'old',cacheName,'other-game-cache'],delete:async key=>deleted.push(key)},
  fetch:async req=>{network.push(req.url);return 'network';},
  self:{registration:{scope:'https://example.com/village/'},location:{origin:'https://example.com'},clients:{claim:async()=>claimed++},skipWaiting:async()=>skipped++,addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.runInNewContext(source,context);
 let pending;const event={waitUntil:p=>pending=p};handlers.install(event);await pending;assert.equal(skipped,0);
 handlers.message({...event,data:{type:'SKIP_WAITING'}});await pending;assert.equal(skipped,1);
 handlers.activate(event);await pending;assert.deepEqual(deleted,[prefix+'old']);assert.equal(claimed,1);
 cached.set('https://example.com/village/index.html','cached page');
 const request={method:'GET',url:'https://example.com/village/missing.js',mode:'same-origin'};
 handlers.fetch({request,respondWith:p=>pending=p});assert.equal(await pending,'network');
 request.mode='navigate';request.url='https://example.com/village/?refresh=1';handlers.fetch({request,respondWith:p=>pending=p});assert.equal(await pending,'cached page');assert.equal(network.length,1);
});
