import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeUnit,makeBuilding,distance} from '../src/model.js';
import {tickCombat} from '../src/systems/combat.js';
import {defenseTarget} from '../src/systems/tactics.js';
import {defensePostCapacity,assignDefensePost,defenseOccupants,tickDefensePosts,defenseStatus,defensePlanningMetrics,defenseRaidSummary} from '../src/systems/defense-posts.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function setup(){const w=createWorld(data);w.buildings=[makeBuilding('hall',10,10,data),makeBuilding('gate',5,5,data),makeBuilding('tower',7,5,data)];w.troops=['warrior','archer','warrior'].map((t,i)=>makeUnit(t,data,i));return w;}
test('defense jobs auto-fill compatible slots without changing civilian workplaces',()=>{
 const w=setup(),worker=makeUnit('builder',data,4);worker.workplace='legacy';w.troops.push(worker);tickDefensePosts(w,data,.05);
 assert.equal(w.buildings.find(b=>b.id===w.troops[0].defensePost).type,'gate');assert.equal(w.buildings.find(b=>b.id===w.troops[1].defensePost).type,'tower');
 assert.equal(defenseOccupants(w,w.buildings[1].id).length,2);assert.equal(worker.workplace,'legacy');assert.equal(worker.defensePost,undefined);
});
test('manual defense assignment, release and movement orders persist across auto-fill',()=>{
 const w=setup(),[hall,gate]=w.buildings,u=w.troops[0];assert.equal(assignDefensePost(w,data,u,hall.id),true);u.order={kind:'hold'};const x=u.x;
 tickDefensePosts(w,data,6);assert.equal(u.defensePost,hall.id);assert.equal(u.x,x);assert.equal(defenseStatus(w,data,u),'Following your order');
 assert.equal(assignDefensePost(w,data,u,null),true);u.order=null;tickDefensePosts(w,data,6);assert.equal(u.defensePost,null);
 gate.remaining=10;assert.equal(defensePostCapacity(gate,data),0);assert.equal(assignDefensePost(w,data,u,gate.id),false);
});
test('post slots reject overflow and dead/expedition fighters',()=>{
 const w=setup(),gate=w.buildings[1];for(const u of w.troops.slice(0,2))assert.ok(assignDefensePost(w,data,u,gate.id));
 assert.equal(assignDefensePost(w,data,w.troops[2],gate.id),false);w.troops[2].expedition={};assert.equal(assignDefensePost(w,data,w.troops[2],w.buildings[0].id),false);
});
test('local squads distribute threats, retain targets and avoid distant chasing',()=>{
 const w=setup(),gate=w.buildings[1];w.troops=w.troops.filter(u=>u.type==='warrior');for(const u of w.troops){u.x=5.5;u.y=5.5;assignDefensePost(w,data,u,gate.id);}
 w.enemies=[{id:'a',x:6,y:5.5,hp:100},{id:'b',x:6.5,y:5.5,hp:100},{id:'far',x:40,y:40,hp:100}];tickDefensePosts(w,data,.05);
 const a=defenseTarget(w,data,w.troops[0]),b=defenseTarget(w,data,w.troops[1]);assert.notEqual(a.id,b.id);w.enemies.reverse();tickDefensePosts(w,data,.55);assert.equal(defenseTarget(w,data,w.troops[0]).id,a.id);
 w.enemies=w.enemies.filter(e=>e.id==='far');tickDefensePosts(w,data,.55);assert.equal(defenseTarget(w,data,w.troops[0]),null);
 const before=distance(w.troops[0],{x:5.5,y:5.5});w.troops[0].x=9;tickDefensePosts(w,data,.05);assert.ok(w.troops[0].x<9);assert.ok(before<1);
});
test('hall reserves reinforce a nearby breach while other posts keep local limits',()=>{
 const w=setup(),u=w.troops[0],hall=w.buildings[0];w.troops=[u];u.x=10.5;u.y=10.5;assignDefensePost(w,data,u,hall.id);w.buildings[1].hp=0;w.enemies=[{id:'breach',x:5.5,y:4.5,hp:100}];
 tickDefensePosts(w,data,.05);assert.equal(defenseTarget(w,data,u).id,'breach');assert.equal(defenseStatus(w,data,u),'Reinforcing a breach');
});
test('planner runs at bounded cadence and uninitialized campaign worlds retain legacy targeting',()=>{
 const w=setup();w.enemies=[{id:'e',x:5,y:5,hp:100}];const u=w.troops[0];u.defensePost=w.buildings[0].id;assert.equal(defenseTarget(w,data,u).id,'e');
 for(let i=0;i<100;i++)tickDefensePosts(w,data,.05);assert.ok(defensePlanningMetrics(w).planningRuns<=11);
});
test('ranged retreat cannot be immediately canceled by approach in the same combat tick',()=>{
 const w=setup();w.buildings=[];w.troops=[makeUnit('archer',data,0)];const u=w.troops[0];u.x=5.5;u.y=5.5;w.enemies=[{id:'close',x:6.5,y:5.5,hp:100,damage:0,attackTimer:100}];tickCombat(w,data,.05);assert.ok(u.x<5.5);
});

test('peace moves ruined automatic posts to available jobs and keeps idle planning sparse',()=>{
 const w=setup();tickDefensePosts(w,data,.05);const gate=w.buildings[1];gate.hp=0;for(let i=0;i<220;i++)tickDefensePosts(w,data,.05);
 assert.ok(w.troops.every(u=>u.defensePost!==gate.id));assert.ok(defensePlanningMetrics(w).planningRuns<=3);
});
test('raid summary counts only new breaches and distinct reserve responders',()=>{
 const w=setup(),u=w.troops[0];w.troops=[u];u.x=10.5;u.y=10.5;assignDefensePost(w,data,u,w.buildings[0].id);w.enemies=[{id:'r',x:5.5,y:4.5,hp:100}];tickDefensePosts(w,data,.05);
 w.buildings[1].hp=0;tickDefensePosts(w,data,.6);assert.deepEqual(defenseRaidSummary(w),{breaches:1,responders:1});
 tickDefensePosts(w,data,.6);assert.deepEqual(defenseRaidSummary(w),{breaches:1,responders:1});
});
test('raid summary catches a final-tick stonewall breach before another planning tick',()=>{
 const w=setup();w.buildings.push(makeBuilding('stonewall',5,7,data));w.enemies=[{id:'r',x:5.5,y:6.5,hp:100}];tickDefensePosts(w,data,.05);
 w.buildings.at(-1).hp=0;w.enemies=[];assert.equal(defenseRaidSummary(w).breaches,1);
});
