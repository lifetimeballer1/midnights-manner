import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {claimRegion,regionById} from '../src/systems/expansion.js';
import {
 frontierEventDelay,frontierEventEligible,eligibleFrontierEvents,
 ensureFrontierEventClock,tickFrontierEvents,resolveFrontierEvent
} from '../src/systems/frontier-events.js';

const data=Object.fromEntries(await Promise.all(
 ['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[
  n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))
 ])
));
const fresh=()=>({world:createWorld(structuredClone(data)),home:null,mission:null,completed:[],unlocks:[],xp:0,vlevel:8,questsCompleted:[]});

test('frontier events: data is region-bound with two readable choices each',()=>{
 const events=data.world.frontierEvents||[];
  assert.equal(events.length,9);
 assert.ok(events.every(e=>regionById(data.expansion,e.region)), 'every event region resolves');
 for(const e of events){
  assert.ok(e.title&&e.text.length>40,e.id);
  assert.equal(e.choices.length,2,`${e.id} has a real choice`);
  assert.equal(new Set(e.choices.map(c=>c.id)).size,2,`${e.id} choice ids unique`);
 }
});

test('frontier events: eligibility requires the named region to be claimed and level met',()=>{
 const state=fresh(),event=data.world.frontierEvents.find(e=>e.region==='southreach');
 assert.equal(frontierEventEligible(event,state,data),false);
 claimRegion(state.world,regionById(data.expansion,'southreach'));
 assert.equal(frontierEventEligible(event,state,data),true);
 state.vlevel=(event.minLevel||1)-1;
 assert.equal(frontierEventEligible(event,state,data),false);
});

test('frontier events: lazy clock is deterministic, sparse and safe for old saves',()=>{
 const a=fresh(),b=fresh();
 delete a.world.nextFrontierEventAt;delete b.world.nextFrontierEventAt;
 a.world.frontierEventCount=3;b.world.frontierEventCount=3;a.world.wave=2;b.world.wave=2;
 const delay=frontierEventDelay(a.world,data);
 assert.ok(delay>=300&&delay<480,`delay ${delay}s stays sparse`);
 const atA=ensureFrontierEventClock(a,data),atB=ensureFrontierEventClock(b,data);
 assert.equal(atA,atB);
 assert.equal(atA,a.world.elapsed+delay);
});

test('frontier events: due choices trigger only during calm home time',()=>{
 const state=fresh();claimRegion(state.world,regionById(data.expansion,'southreach'));
 state.world.elapsed=500;state.world.nextRaidAt=900;state.world.nextFrontierEventAt=499;
 const notes=[];
 const e=tickFrontierEvents(state,data,m=>notes.push(m));
 assert.ok(e&&e.region==='southreach');
 assert.equal(state.world.frontierEvent.id,e.id);
 assert.match(notes[0],/Open Adventure/i);
 // An active card never rerolls.
 assert.equal(tickFrontierEvents(state,data),null);
 const blocked=fresh();claimRegion(blocked.world,regionById(data.expansion,'southreach'));
 blocked.world.elapsed=500;blocked.world.nextFrontierEventAt=499;blocked.world.nextRaidAt=540;
 assert.equal(tickFrontierEvents(blocked,data),null,'horns within 60s suppress new choices');
 assert.equal(blocked.world.frontierEvent,undefined);
});

test('frontier events: resource choice spends atomically, rewards, clears and reschedules',()=>{
 const state=fresh();claimRegion(state.world,regionById(data.expansion,'southreach'));
 state.world.elapsed=500;state.world.nextRaidAt=1000;state.world.nextFrontierEventAt=499;
 tickFrontierEvents(state,data);
 const event=data.world.frontierEvents.find(e=>e.id===state.world.frontierEvent.id);
 const paid=event.choices.find(c=>Object.keys(c.cost||{}).length);
 for(const [k,v] of Object.entries(paid.cost))state.world.resources[k]=v+10;
 const before={...state.world.resources},result=resolveFrontierEvent(state,data,paid.id);
 assert.equal(result.ok,true);
 for(const [k,v] of Object.entries(paid.cost))assert.equal(state.world.resources[k],before[k]-v+(paid.reward?.[k]||0));
 for(const [k,v] of Object.entries(paid.reward||{}))if(!(k in paid.cost))assert.equal(state.world.resources[k],(before[k]||0)+v);
 assert.equal(state.world.frontierEvent,null);
 assert.equal(state.world.frontierEventCount,1);
 assert.ok(state.world.nextFrontierEventAt>state.world.elapsed+299);
});

test('frontier events: unaffordable choices spend nothing and a free decline remains available',()=>{
 const state=fresh();claimRegion(state.world,regionById(data.expansion,'southreach'));
 state.world.elapsed=500;state.world.nextRaidAt=1000;state.world.nextFrontierEventAt=499;
 tickFrontierEvents(state,data);
 const event=data.world.frontierEvents.find(e=>e.id===state.world.frontierEvent.id);
 const paid=event.choices.find(c=>Object.keys(c.cost||{}).length),free=event.choices.find(c=>!Object.keys(c.cost||{}).length);
 for(const k of Object.keys(paid.cost))state.world.resources[k]=0;
 const before=structuredClone(state.world.resources),fail=resolveFrontierEvent(state,data,paid.id);
 assert.equal(fail.ok,false);assert.deepEqual(state.world.resources,before);assert.ok(state.world.frontierEvent);
 const pass=resolveFrontierEvent(state,data,free.id);
 assert.equal(pass.ok,true);assert.equal(state.world.frontierEvent,null);
});
