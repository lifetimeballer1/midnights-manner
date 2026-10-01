import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {recordTravel} from '../src/systems/trails.js';
import {movementMetrics} from '../src/systems/pathfinding.js';
import {tickSteward,stewardMetrics,stewardSnapshot} from '../src/systems/steward.js';
import {matureSettlement} from '../scripts/settlement-fixture.mjs';
const dir=new URL('../data/',import.meta.url),files=(await readdir(dir)).filter(n=>n.endsWith('.json'));
const data=Object.fromEntries(await Promise.all(files.map(async f=>[f.slice(0,-5),JSON.parse(await readFile(new URL(f,dir)))])));
function fixture(){
 const w=matureSettlement(data,{createWorld,makeBuilding,makeUnit,recordTravel});
 return {world:w,data,state:{mission:null,vlevel:12,completed:[]},locked:()=>false};
}
test('steward remains inactive for legacy villages, disabled villages and campaigns',()=>{
 const g=fixture();tickSteward(g,100);assert.equal(stewardMetrics(g.world).plans,0);assert.equal(g.world.steward,undefined);
 g.world.steward={enabled:false};tickSteward(g,100);assert.equal(stewardMetrics(g.world).plans,0);
 g.world.steward.enabled=true;g.state.mission={status:'active'};tickSteward(g,100);assert.equal(stewardMetrics(g.world).plans,0);
});
test('mature-settlement steward refresh is interval-limited and checks at most 24 buildings',()=>{
 const g=fixture();g.world.steward={enabled:true};
 for(let i=0;i<50;i++)tickSteward(g,.05);
 assert.equal(stewardMetrics(g.world).plans,1);assert.equal(stewardMetrics(g.world).lastInspected,24);
 tickSteward(g,1);tickSteward(g,3.1);
 assert.equal(stewardMetrics(g.world).plans,3);assert.equal(stewardMetrics(g.world).inspected,72);
 assert.ok(stewardSnapshot(g).issues.length<=12);
});
test('steward does not replay missed planner intervals on a large time step',()=>{
 const g=fixture();g.world.steward={enabled:true};tickSteward(g,1000);
 assert.equal(stewardMetrics(g.world).plans,1);assert.equal(stewardMetrics(g.world).inspected,24);
 tickSteward(g,1000);assert.equal(stewardMetrics(g.world).plans,2);
});
test('invalid steward time steps neither run nor poison the next refresh',()=>{
 const g=fixture();g.world.steward={enabled:true};
 for(const dt of [0,-1,NaN,Infinity])tickSteward(g,dt);
 assert.equal(stewardMetrics(g.world).plans,0);
 tickSteward(g,.05);assert.equal(stewardMetrics(g.world).plans,1);
});
test('steward refresh and repeated detached UI reads add no routes or save mutations',()=>{
 const g=fixture();g.world.steward={enabled:true};
 const saved=JSON.stringify(g.world),searches=movementMetrics(g.world).movementSearches;
 tickSteward(g,.05);const metrics=stewardMetrics(g.world);
 for(let i=0;i<100;i++){
  const snapshot=stewardSnapshot(g);
  if(snapshot.issues[0])snapshot.issues[0].label='Changed outside planner';
  snapshot.metrics.plans=-1;
 }
 assert.deepEqual(stewardMetrics(g.world),metrics);
 assert.equal(movementMetrics(g.world).movementSearches,searches);
 assert.equal(JSON.stringify(g.world),saved);
 assert.ok(stewardSnapshot(g).issues.every(issue=>issue.label!=='Changed outside planner'));
});
