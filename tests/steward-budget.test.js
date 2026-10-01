import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {budgetSnapshot,refreshStewardBudget,spendingAvailable,canSpend} from '../src/systems/steward-budget.js';
import {mealCost} from '../src/systems/food.js';
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function fixture(){const world=createWorld(data);world.buildings=[];world.troops=[];world.resources={wood:100,food:100,bread:100,gold:100};world.steward={enabled:true,protectMeals:true,protectRepairs:true};return {world,data};}
test('missing and disabled steward retain existing manual reserve behavior without save mutations',()=>{
 const g=fixture();delete g.world.steward;g.world.automation={reserves:{wood:25}};const before=JSON.stringify(g.world);refreshStewardBudget(g);assert.equal(spendingAvailable(g,'wood'),75);assert.equal(budgetSnapshot(g).enabled,false);assert.equal(JSON.stringify(g.world),before);
 g.world.steward={enabled:false};assert.equal(spendingAvailable(g,'wood',{purpose:'repair'}),75);
});
test('next actual meal basket is protected and overlaps manual resource floor',()=>{
 const g=fixture();g.world.troops=[makeUnit('builder',data),makeUnit('warrior',data)];const meal=mealCost(g.world,data);g.world.automation={reserves:{food:meal.food+3}};refreshStewardBudget(g);
 assert.equal(spendingAvailable(g,'food'),100-meal.food-3);assert.equal(budgetSnapshot(g).resources.food.protected,meal.food+3);assert.equal(spendingAvailable(g,'bread'),100-meal.bread);
});
test('repair and goal allocations share finite funds in priority order',()=>{
 const g=fixture(),b=makeBuilding('hall',2,2,data);b.hp-=150;g.world.buildings=[b];refreshStewardBudget(g,[{slot:'main',label:'Main',buildingId:'a',cost:{wood:70}},{slot:0,label:'Other',buildingId:'b',cost:{wood:40}}]);
 const snap=budgetSnapshot(g);assert.equal(snap.rows.find(r=>r.id==='repairs').protected.wood,10);assert.equal(snap.rows.find(r=>r.id==='goal:0').protected.wood,20);assert.equal(snap.rows.find(r=>r.id==='goal:0').missing.wood,20);
 assert.equal(spendingAvailable(g,'wood'),0);assert.equal(spendingAvailable(g,'wood',{purpose:'repair',buildingId:b.id}),100);assert.equal(spendingAvailable(g,'wood',{purpose:'upgrade',buildingId:'a'}),90);assert.equal(spendingAvailable(g,'wood',{purpose:'upgrade',buildingId:'b'}),20);
 assert.equal(canSpend(g,{wood:21},{purpose:'upgrade',buildingId:'b'}),false);
});
test('live spending cannot reuse spent funds and snapshots are detached',()=>{
 const g=fixture();refreshStewardBudget(g,[{slot:'main',label:'Project',buildingId:'a',cost:{wood:60}}]);assert.equal(spendingAvailable(g,'wood'),40);g.world.resources.wood-=30;assert.equal(spendingAvailable(g,'wood'),10);
 const snap=budgetSnapshot(g);snap.rows[0].cost.food=999;snap.rows.at(-1).cost.wood=0;snap.rows.at(-1).protected.wood=0;assert.equal(spendingAvailable(g,'wood'),10);
});
test('global repair basket does not double count fortify repair goal',()=>{
 const g=fixture(),b=makeBuilding('hall',2,2,data);b.hp-=150;g.world.buildings=[b];const goal={slot:'main',label:'Fortify',buildingId:b.id,action:'repair',cost:{wood:10}};refreshStewardBudget(g,[goal]);assert.equal(budgetSnapshot(g).resources.wood.planned,10);
 g.world.steward.protectRepairs=false;refreshStewardBudget(g,[goal]);assert.equal(budgetSnapshot(g).resources.wood.planned,10);assert.equal(spendingAvailable(g,'wood',{purpose:'repair',buildingId:b.id}),100);assert.equal(spendingAvailable(g,'wood',{purpose:'repair',buildingId:'other'}),90);
});
test('repair spending honors meal budgets and never scans buildings on a tick',()=>{
 const g=fixture();g.world.steward.protectRepairs=false;refreshStewardBudget(g,[{slot:'main',label:'Supplies',cost:{wood:100}}]);Object.defineProperty(g.world,'buildings',{get(){throw new Error('tick scan');}});
 for(let i=0;i<100;i++)assert.equal(spendingAvailable(g,'wood',{purpose:'repair'}),0);
});

test('automatic refining preserves shared plans while legacy refinement stays unchanged',async()=>{
 const {tickRefine}=await import('../src/systems/crafting.js');
 const g=fixture(),b=makeBuilding('sawmill',2,2,data),u=makeUnit('sawyer',data);b.remaining=0;u.workplace=b.id;g.world.buildings=[b];g.world.troops=[u];
 g.world.steward.protectMeals=false;g.world.steward.protectRepairs=false;g.world.resources.wood=100;
 refreshStewardBudget(g,[{slot:'main',label:'Project',buildingId:'other',cost:{wood:100}}]);
 tickRefine(g.world,data,1,false,k=>spendingAvailable(g,k,{purpose:'refine'}));assert.equal(g.world.resources.wood,100);
 delete g.world.steward;tickRefine(g.world,data,1);assert.ok(g.world.resources.wood<100);
});

test('queued goals share one allocation and remaining plans preserve queue priority',()=>{
 const g=fixture();g.world.steward.protectMeals=false;g.world.steward.protectRepairs=false;
 refreshStewardBudget(g,[{slot:'main',label:'Main project',buildingId:'a',cost:{wood:60}}],[{id:'same',label:'Same upgrade',buildingId:'a',cost:{wood:60}},{id:'next',label:'Next build',cost:{wood:30}},{id:'last',label:'Later build',cost:{wood:30}}]);
 const b=budgetSnapshot(g);assert.equal(b.resources.wood.planned,120);assert.equal(b.rows.filter(r=>r.buildingId==='a').length,1);assert.equal(b.rows.some(r=>r.id==='queue:same'),false);
 assert.equal(spendingAvailable(g,'wood',{purpose:'queue',buildingId:'queue:next'}),40);assert.equal(spendingAvailable(g,'wood',{purpose:'queue',buildingId:'queue:last'}),10);assert.equal(spendingAvailable(g,'wood',{purpose:'craft'}),0);
});
