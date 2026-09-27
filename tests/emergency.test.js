import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeUnit,makeBuilding,stats} from '../src/model.js';
import {tickEmergency} from '../src/systems/emergency.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickCombat} from '../src/systems/combat.js';
import {nextStep} from '../src/systems/pathfinding.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('alarm suspends civilian orders and harvesting without losing assignment, goods or destination',()=>{
 const w=createWorld(data),u=w.troops.find(t=>data.troops[t.type].role==='collector');u.order={kind:'move',x:1,y:1};u.carry=4;u.workplace='kept';const order=structuredClone(u.order);w.raidPending={timer:25};tickEmergency(w,data,.1);assert.equal(u.emergency.kind,'shelter');const pos={x:u.x,y:u.y};tickEconomy(w,data,.1);tickCombat(w,data,.1);assert.deepEqual({x:u.x,y:u.y},pos);assert.equal(u.carry,4);assert.equal(u.workplace,'kept');assert.deepEqual(u.order,order);w.raidPending=null;tickEmergency(w,data,.1);assert.equal(u.emergency,undefined);assert.deepEqual(u.order,order);
});
test('safe builders repair with wood, never revive ruins or repair in immediate danger',()=>{
 const w=createWorld(data),u=makeUnit('builder',data,0);u.x=4.5;u.y=5.5;w.troops=[u];const wall=makeBuilding('wall',5,5,data);w.buildings=[wall];wall.hp-=40;const hp=wall.hp,wood=w.resources.wood;w.raidPending={timer:25};tickEmergency(w,data,1);assert.equal(wall.hp,hp+6);assert.ok(Math.abs(w.resources.wood-(wood-.4))<1e-8);wall.hp=0;tickEmergency(w,data,1);assert.equal(wall.hp,0);wall.hp=hp;w.enemies=[{x:5.5,y:6.5,hp:10}];tickEmergency(w,data,1);assert.equal(wall.hp,hp);
});
test('healers aid injured allies behind the fight but avoid exposed patients',()=>{
 const w=createWorld(data),h=makeUnit('healer',data,0),u=makeUnit('warrior',data,1);h.x=4;h.y=4;u.x=5;u.y=4;u.hp-=20;w.troops=[h,u];w.buildings=[];w.raidPending={timer:25};const hp=u.hp;tickEmergency(w,data,1);assert.equal(h.emergency.kind,'heal');assert.equal(u.hp,hp+3);assert.equal(u.emergency,undefined);w.enemies=[{x:6,y:4,hp:10}];tickEmergency(w,data,1);assert.equal(u.hp,hp+3);
});
test('safe routing avoids an enemy-blocked corridor and normal routing remains available',()=>{
 const w=createWorld(data);w.buildings=[];const narrow={...data,world:{...data.world,width:8,height:1}};w.enemies=[{x:4.5,y:.5,hp:10}];const u={x:.5,y:.5},target={x:7.5,y:.5};assert.ok(nextStep(w,narrow,u,target,.1));assert.equal(nextStep(w,narrow,u,target,.1,true),null);
});
test('ordinary construction pauses during warnings and resumes after safety returns',()=>{
 const w=createWorld(data),b=makeBuilding('wall',1,1,data);b.remaining=10;w.buildings.push(b);w.raidPending={timer:25};tickEconomy(w,data,1);assert.equal(b.remaining,10);w.raidPending=null;tickEconomy(w,data,1);assert.ok(b.remaining<10);
});
test('rangers outside settlement keep their expedition behavior',()=>{
 const w=createWorld(data),u=w.troops[0];u.expedition={phase:'out'};w.raidPending={timer:25};tickEmergency(w,data,1);assert.equal(u.emergency,undefined);assert.deepEqual(u.expedition,{phase:'out'});
});
