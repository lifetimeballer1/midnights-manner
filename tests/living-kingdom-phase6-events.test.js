import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding} from '../src/model.js';
import {eventConditionsMet} from '../src/systems/frontier-events.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('events: market-gated merchant waits for a finished market',()=>{
  const w=createWorld(data),state={world:w,mission:null,vlevel:9};
  const ev={id:'x',title:'T',text:'t',when:{building:'market'},choices:[]};
  assert.equal(eventConditionsMet(ev,state,data),false);
  w.buildings.push(makeBuilding('market',8,10,data));
  assert.equal(eventConditionsMet(ev,state,data),true);
});
import {housing} from '../src/model.js';
import {claimRegion,regionById} from '../src/systems/expansion.js';
import {frontierEventEligible,eventAnchor,resolveFrontierEvent} from '../src/systems/frontier-events.js';
const full=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','expansion','biomes'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const fresh=()=>({world:createWorld(structuredClone(full)),home:null,mission:null,completed:[],unlocks:[],xp:0,vlevel:9,questsCompleted:[]});
test('events: original nine carry no gates and read exactly as before',()=>{
  for(const id of ['southreach-broken-axle','starwatch-signal','whisperwood-wayfinders','blackwater-ferry','ashfall-hearth','dawnfields-camp','pale-coast-wagon','whisperwood-paired-cuts','blackwater-white-thread']){
    const e=full.world.frontierEvents.find(x=>x.id===id);
    assert.ok(e,id);
    assert.ok(!('when' in e)&&!('cooldown' in e)&&!('place' in e),`${id} untouched`);
  }
  assert.equal(full.world.frontierEvents.length,15);
});
test('events: per-id cooldown suppresses re-fire until the window passes',()=>{
  const state=fresh(),world=state.world;
  const ev={id:'cd-x',title:'T',text:'t',cooldown:600,choices:[]};
  world.elapsed=1000;
  assert.equal(frontierEventEligible(ev,state,full),true);
  world.frontierEventSeen={'cd-x':500};
  assert.equal(frontierEventEligible(ev,state,full),false);
  world.frontierEventSeen={'cd-x':100};
  assert.equal(frontierEventEligible(ev,state,full),true);
});
test('events: gated entry waits on region claim AND its when-clauses',()=>{
  const state=fresh(),world=state.world;
  const ev=full.world.frontierEvents.find(e=>e.id==='timberdeep-market-day');
  assert.equal(frontierEventEligible(ev,state,full),false);
  claimRegion(world,regionById(full.expansion,'timber-deep'));
  assert.equal(frontierEventEligible(ev,state,full),false);
  world.buildings.push(makeBuilding('market',8,10,full));
  assert.equal(frontierEventEligible(ev,state,full),true);
});
test('events: shortage gate fires only while stores run low',()=>{
  const state=fresh(),world=state.world;
  const ev={id:'s',title:'T',text:'t',when:{resourceBelow:{key:'food',amount:120}},choices:[]};
  world.resources.food=200;
  assert.equal(eventConditionsMet(ev,state,full),false);
  world.resources.food=50;
  assert.equal(eventConditionsMet(ev,state,full),true);
  const herb=full.world.frontierEvents.find(e=>e.id==='moonwell-herbwife');
  assert.equal(eventConditionsMet(herb,state,full),false,'storehouse still missing');
  world.buildings.push(makeBuilding('storehouse',8,10,full));
  assert.equal(eventConditionsMet(herb,state,full),true,'both clauses hold');
});
test('events: freeBeds gate counts real bunks against the muster',()=>{
  const w=createWorld(structuredClone(full)),state={world:w,mission:null,vlevel:9};
  const need=housing(w,full).beds-housing(w,full).used+1;
  const ev={id:'b',title:'T',text:'t',when:{freeBeds:need},choices:[]};
  assert.equal(eventConditionsMet(ev,state,full),false);
  w.buildings.push(makeBuilding('longhouse',8,10,full));
  assert.equal(eventConditionsMet(ev,state,full),true);
});
test('events: minWave gate waits on the wave counter',()=>{
  const w=createWorld(structuredClone(full)),state={world:w,mission:null,vlevel:9};
  const ev={id:'m',title:'T',text:'t',when:{minWave:3},choices:[]};
  assert.equal(eventConditionsMet(ev,state,full),false);
  w.wave=3;
  assert.equal(eventConditionsMet(ev,state,full),true);
});
test('events: anchor resolves the nearest place.near building to the village center',()=>{
  const state=fresh(),world=state.world;
  world.buildings.push(makeBuilding('market',1,1,full));
  const near=makeBuilding('market',6,5,full);
  world.buildings.push(near);
  assert.equal(eventAnchor(world,full,{id:'a',place:{near:'market'},choices:[]}),near);
  assert.equal(eventAnchor(world,full,{id:'b',place:{near:'bakery'},choices:[]}),null);
  const fallback=eventAnchor(world,full,{id:'d',choices:[]});
  assert.ok(fallback&&fallback.hp>0&&!(fallback.remaining>0));
  assert.equal(eventAnchor({buildings:[]},full,{id:'c',choices:[]}),null);
});
test('events: gated village entry resolves atomically and stamps its cooldown',()=>{
  const state=fresh(),world=state.world;
  claimRegion(world,regionById(full.expansion,'timber-deep'));
  world.buildings.push(makeBuilding('market',8,10,full));
  world.elapsed=500;world.nextRaidAt=1000;
  world.frontierEvent={id:'timberdeep-market-day',at:500};
  world.resources.food=50;world.resources.gold=0;
  const pass=resolveFrontierEvent(state,full,'pass');
  assert.equal(pass.ok,true);
  assert.equal(world.frontierEventSeen['timberdeep-market-day'],500);
  world.frontierEvent={id:'timberdeep-market-day',at:500};
  world.resources.food=50;world.resources.gold=0;
  const spend=resolveFrontierEvent(state,full,'stock');
  assert.equal(spend.ok,true);
  assert.equal(world.resources.food,0);
  assert.equal(world.resources.gold,95);
  assert.equal(world.frontierEvent,null);
  world.frontierEvent={id:'timberdeep-market-day',at:500};
  world.resources.food=0;world.resources.gold=7;
  const snapshot=structuredClone(world.resources);
  const broke=resolveFrontierEvent(state,full,'stock');
  assert.equal(broke.ok,false);
  assert.deepEqual(world.resources,snapshot);
  assert.ok(world.frontierEvent);
});
