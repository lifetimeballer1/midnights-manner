import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeUnit,makeBuilding} from '../src/model.js';
import {enqueueConstruction,constructionSnapshot,advanceConstruction,removeConstruction,moveConstruction} from '../src/systems/steward-construction.js';
import {captureBlueprint,blueprintQuote,applyBlueprint,blueprintSnapshot} from '../src/systems/steward-blueprints.js';
import {refreshStewardBudget} from '../src/systems/steward-budget.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest','expansion'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const fresh=()=>{const g=new Game(data);g.state={...g.state,world:createWorld(data),home:null,mission:null,vlevel:11,completed:[],unlocks:Object.keys(data.buildings)};g.paused=false;g.world.bounds={w:40,h:34};g.world.resources=Object.fromEntries(Object.keys(g.world.resources).map(k=>[k,1e6]));g.world.troops.push(makeUnit('builder',data));g.world.steward={enabled:true,queueEnabled:true,protectMeals:false,protectRepairs:false,main:null,secondary:[],queue:[]};return g;};
test('steward queue: enqueue spends nothing, obeys caps and rejects duplicate targets',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall'),before={...g.world.resources};
 assert.equal(enqueueConstruction(g,{kind:'upgrade',buildingId:hall.id,targetTier:3}).ok,true);assert.deepEqual(g.world.resources,before);
 assert.equal(enqueueConstruction(g,{kind:'upgrade',buildingId:hall.id,targetTier:2}).ok,false);
 for(let i=0;i<11;i++)assert.equal(enqueueConstruction(g,{kind:'build',type:'wall',x:25+i%6,y:18+Math.floor(i/6)}).ok,true);
 assert.equal(enqueueConstruction(g,{kind:'build',type:'wall',x:33,y:21}).ok,false);assert.equal(constructionSnapshot(g).length,12);
 const id=g.world.steward.queue[1].id;assert.equal(moveConstruction(g,id,-1).ok,true);assert.equal(g.world.steward.queue[0].id,id);assert.equal(removeConstruction(g,id).ok,true);
});
test('steward queue: one paid stage per advance, waits for completion and remains opted in',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall');enqueueConstruction(g,{kind:'upgrade',buildingId:hall.id,targetTier:3});
 g.world.steward.queueEnabled=false;assert.equal(advanceConstruction(g).ok,false);g.world.steward.queueEnabled=true;
 const gold=g.world.resources.gold;assert.equal(advanceConstruction(g).ok,true);assert.equal(hall.level,2);assert.equal(g.world.resources.gold,gold-150);
 assert.equal(advanceConstruction(g).ok,false);assert.equal(hall.level,2);hall.remaining=0;assert.equal(advanceConstruction(g).ok,true);assert.equal(hall.level,3);
 hall.remaining=0;assert.ok(advanceConstruction(g).completed);assert.equal(g.world.steward.queue.length,0);
});
test('steward queue: repairs, raids, unavailable builders and resource reserves block payment',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall');enqueueConstruction(g,{kind:'upgrade',buildingId:hall.id});const before={...g.world.resources};
 hall.hp--;assert.match(advanceConstruction(g).error,/Repairs/);hall.hp++;g.world.raidPending={};assert.equal(advanceConstruction(g).ok,false);g.world.raidPending=null;
 const builders=g.world.troops.filter(t=>data.troops[t.type].role==='builder');for(const b of builders)b.order={kind:'hold'};assert.match(advanceConstruction(g).error,/builder/);for(const b of builders)b.order=null;
 g.world.automation={reserves:{gold:g.world.resources.gold}};assert.match(advanceConstruction(g).error,/reserves/);assert.deepEqual(g.world.resources,before);
});
test('steward queue: build retains created id through construction and target upgrades',()=>{
 const g=fresh();const result=enqueueConstruction(g,{kind:'build',type:'wall',x:25,y:18,targetTier:2});assert.equal(result.ok,true);
 const step=advanceConstruction(g);assert.equal(step.ok,true);const row=g.world.steward.queue[0],b=g.world.buildings.find(b=>b.id===step.buildingId);assert.equal(row.buildingId,b.id);assert.equal(constructionSnapshot(g)[0].status,'Construction in progress');
 b.remaining=0;assert.equal(advanceConstruction(g).ok,true);assert.equal(b.level,2);b.remaining=0;assert.ok(advanceConstruction(g).completed);
});
test('steward queue: live gate changes and existing protected goal basket remain authoritative',()=>{
 const g=fresh(),b=makeBuilding('scriptorium',18,18,data);b.level=2;b.hp=data.buildings.scriptorium.tiers[1].hp;b.remaining=0;g.world.buildings.push(b);enqueueConstruction(g,{kind:'upgrade',buildingId:b.id,targetTier:3});g.state.vlevel=1;
 assert.match(advanceConstruction(g).error,/level/);g.state.vlevel=11;g.world.steward.main={id:'project',buildingId:b.id,targetTier:3};
 refreshStewardBudget(g,[{slot:'main',buildingId:b.id,label:'Scriptorium',status:'Ready',cost:constructionSnapshot(g)[0].cost}]);assert.equal(advanceConstruction(g).ok,true);
});
test('steward blueprints: quote uses collision contract and queues all without immediate purchases',()=>{
 const g=fresh(),a=makeBuilding('wall',18,18,data),b=makeBuilding('wall',19,18,data);a.remaining=0;b.remaining=0;g.world.buildings.push(a,b);
 const capture=captureBlueprint(g,'West gate',[a.id,b.id]);assert.equal(capture.ok,true);const before={...g.world.resources},count=g.world.buildings.length;
 assert.equal(blueprintQuote(g,capture.id,18,18).ok,false);const quote=blueprintQuote(g,capture.id,26,20);assert.equal(quote.ok,true);assert.equal(quote.entries.length,2);
 const apply=applyBlueprint(g,capture.id,26,20);assert.equal(apply.ok,true);assert.equal(g.world.steward.queue.length,2);assert.equal(g.world.buildings.length,count);assert.deepEqual(g.world.resources,before);
 assert.equal(blueprintQuote(g,capture.id,26,20).ok,false,'pending queue reserves footprint');const copy=blueprintSnapshot(g);copy[0].entries[0].dx=99;assert.equal(blueprintSnapshot(g)[0].entries[0].dx,0);
});
test('steward blueprints: limits and full queue refuse atomically; JSON preserves plans',()=>{
 const g=fresh(),a=makeBuilding('wall',18,18,data);a.remaining=0;g.world.buildings.push(a);const cap=captureBlueprint(g,'Plan',[a.id]);
 for(let i=0;i<12;i++)enqueueConstruction(g,{kind:'build',type:'wall',x:25+i%6,y:23+Math.floor(i/6)});
 const before=JSON.stringify(g.world.steward.queue);assert.equal(applyBlueprint(g,cap.id,25,20).ok,false);assert.equal(JSON.stringify(g.world.steward.queue),before);
 const h=fresh();h.state.world=JSON.parse(JSON.stringify(g.world));assert.deepEqual(constructionSnapshot(h),constructionSnapshot(g));assert.deepEqual(blueprintSnapshot(h),blueprintSnapshot(g));
});
test('steward queue: live unlock and reserved placement checks prevent invalid starts',()=>{
 const g=fresh();g.data={...data,world:{...data.world,locked:[...data.world.locked,'tower']}};assert.equal(enqueueConstruction(g,{kind:'build',type:'tower',x:28,y:20}).ok,true);
 assert.equal(enqueueConstruction(g,{kind:'build',type:'wall',x:28,y:20}).ok,false,'planned sites block overlapping plans');
 g.state.unlocks=[];assert.match(advanceConstruction(g).error,/unlock/);g.state.unlocks=['tower'];
 const obstruction=makeBuilding('wall',28,20,data);obstruction.remaining=0;g.world.buildings.push(obstruction);const before={...g.world.resources};assert.match(advanceConstruction(g).error,/blocked/);assert.deepEqual(g.world.resources,before);
});
