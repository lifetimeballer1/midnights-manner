import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit,buildingCost} from '../src/model.js';
import {setGoal,clearGoal,goalSnapshot,goalChoices} from '../src/systems/steward-goals.js';
import {recordPreliminary,ensureConquest} from '../src/systems/conquest.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest','expansion'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
const fresh=()=>{const g=new Game(data);g.state={...g.state,world:createWorld(data),home:null,mission:null,vlevel:1,completed:[],unlocks:['tower']};const cottage=makeBuilding('cottage',18,18,data);cottage.remaining=0;g.world.buildings.push(cottage);return g;};

test('steward goals: legacy reads and invalid selections create no save fields',()=>{
 const g=fresh(),before=JSON.stringify(g.world);assert.deepEqual(goalSnapshot(g),[]);assert.ok(goalChoices(g).length);
 assert.equal(setGoal(g,2,{id:'grow'}).ok,false);assert.equal(setGoal(g,'main',{id:'project',buildingId:'absent'}).ok,false);
 assert.equal(setGoal(g,'main',{id:'conquest'}).ok,false,'multiple tribes require a target');
 assert.equal(clearGoal(g,'main').ok,true);assert.equal(JSON.stringify(g.world),before);
});
test('steward goals: three bounded slots with duplicate target rejection survive JSON reload',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall'),farm=g.world.buildings.find(b=>b.type==='farm');
 assert.equal(setGoal(g,'main',{id:'project',buildingId:hall.id,targetTier:3}).ok,true);
 assert.equal(setGoal(g,0,{id:'grow'}).ok,true);assert.equal(setGoal(g,1,{id:'project',buildingId:farm.id}).ok,true);
 assert.equal(setGoal(g,0,{id:'project',buildingId:hall.id}).ok,false);
 assert.equal(goalSnapshot(g).length,3);const copy=fresh();copy.state.world=JSON.parse(JSON.stringify(g.world));
 assert.deepEqual(goalSnapshot(copy),goalSnapshot(g));assert.equal(clearGoal(copy,0).ok,true);assert.equal(goalSnapshot(copy).length,2);
 assert.equal(g.world.steward.enabled,false);assert.equal(g.world.steward.protectMeals,true);
});
test('steward goals: actual next-stage prices, hall special and unpaid stages only',()=>{
 const g=fresh(),hall=g.world.buildings.find(b=>b.type==='hall');setGoal(g,'main',{id:'project',buildingId:hall.id,targetTier:3});
 assert.deepEqual(goalSnapshot(g)[0].cost,{wood:200,gold:150});
 hall.level=2;hall.remaining=10;let goal=goalSnapshot(g)[0];assert.equal(goal.progress,0);assert.equal(goal.status,'Construction in progress');assert.deepEqual(goal.cost,{wood:400,gold:300});
 hall.level=3;goal=goalSnapshot(g)[0];assert.deepEqual(goal.cost,{});assert.notEqual(goal.status,'Complete');
 hall.remaining=0;assert.equal(goalSnapshot(g)[0].status,'Complete');assert.equal(goalSnapshot(g)[0].progress,1);
 const cottage=g.world.buildings.find(b=>b.type==='cottage');setGoal(g,'main',{id:'project',buildingId:cottage.id});assert.deepEqual(goalSnapshot(g)[0].cost,buildingCost(cottage.type,2,g.world,data));
});
test('steward goals: fortify records damaged target and stops charging after repair',()=>{
 const g=fresh(),gate=makeBuilding('gate',15,15,data);gate.hp=10;gate.remaining=0;g.world.buildings.push(gate);
 assert.equal(setGoal(g,'main','fortify').ok,true);let s=goalSnapshot(g)[0];assert.equal(s.buildingId,gate.id);assert.equal(s.progress,0);assert.equal(s.cost.wood,Math.ceil((data.buildings.gate.tiers[0].hp-10)/15));
 gate.hp=data.buildings.gate.tiers[0].hp;s=goalSnapshot(g)[0];assert.equal(s.status,'Complete');assert.deepEqual(s.cost,{});
});
test('steward goals: conquest reports actual readiness, prerequisites and departure basket without launching',()=>{
 const g=fresh(),before=JSON.stringify(g.world.resources);setGoal(g,'main',{id:'conquest',tribeId:'ironshield'});
 const m=data.missions.find(m=>m.id===data.conquest.tribe.assault);let s=goalSnapshot(g)[0];assert.deepEqual(s.cost,m.launchCost);assert.match(s.status,/Scout/);
 g.state.vlevel=9;g.world.renown=2;const barracks=g.world.buildings.find(b=>b.type==='barracks');barracks.level=3;barracks.remaining=0;
 for(let i=0;i<8;i++)g.world.troops.push(makeUnit('warrior',data));ensureConquest(g.world).scouted=true;
 for(const p of data.conquest.tribe.preliminaries)recordPreliminary(g.world,p.id);
 g.state.completed=[...(m.requires||[])];g.world.resources={...g.world.resources,...m.launchCost};s=goalSnapshot(g)[0];assert.equal(s.status,'Ready — depart manually');assert.equal(s.progress,1);
 g.world.raidPending={timer:10};assert.notEqual(goalSnapshot(g)[0].status,'Ready — depart manually');assert.equal(g.state.mission,null);
 assert.notEqual(JSON.stringify(g.world.resources),before,'test setup funded the basket');assert.deepEqual(g.world.resources,{...g.world.resources,...m.launchCost});
});
test('steward goals: snapshots detach resource quotes and record live gates',()=>{
 const g=fresh(),b=makeBuilding('scriptorium',15,15,data);b.level=2;b.remaining=0;g.world.buildings.push(b);
 setGoal(g,'main',{id:'project',buildingId:b.id,targetTier:3});const before=JSON.stringify(g.world),s=goalSnapshot(g)[0];assert.match(s.status,/level|unlock/);s.cost.wood=999999;s.requirements[0].ok=true;
 assert.equal(JSON.stringify(g.world),before);assert.notEqual(goalSnapshot(g)[0].cost.wood,999999);
 g.world.buildings=g.world.buildings.filter(x=>x!==b);assert.equal(goalSnapshot(g)[0].status,'Target building is missing');
});
test('steward goals: price changes follow current builder gear without stale quotes',()=>{
 const g=fresh(),b=g.world.buildings.find(b=>b.type==='cottage');setGoal(g,'main',{id:'project',buildingId:b.id});
 const crew=makeUnit('builder',data);g.world.troops.push(crew);const before=goalSnapshot(g)[0].cost;
 const gear=Object.entries(data.items).find(([,item])=>item.roles?.includes('builder')&&(item.stats?.costReduction||item.stats?.discount)>=.2);assert.ok(gear);
 crew.gear=gear[0];const after=goalSnapshot(g)[0].cost;assert.deepEqual(after,buildingCost(b.type,b.level+1,g.world,data));assert.ok(after.wood<before.wood);
});
