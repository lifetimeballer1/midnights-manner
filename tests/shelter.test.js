import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {tickEmergency} from '../src/systems/emergency.js';
import {isSheltered,shelterOccupants} from '../src/systems/shelter.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
function setup(){const w=createWorld(data),u=makeUnit('forager',data),b=makeBuilding('cottage',5,5,data);w.troops=[u];w.buildings=[b];w.enemies=[];w.raidPending={timer:25};u.x=2.5;u.y=7.5;return {w,u,b};}
function ticks(w,n=100){for(let i=0;i<n;i++){w.elapsed+=.1;tickEmergency(w,data,.1);}}
test('civilians walk to an exterior doorway before entering and resume intact after peace',()=>{
 const {w,u,b}=setup();u.order={kind:'move',x:1,y:1};u.workplace='kept';u.carry=9;const order=structuredClone(u.order);tickEmergency(w,data,.1);assert.equal(isSheltered(w,data,u),false);assert.ok(u.x<5);ticks(w);assert.equal(isSheltered(w,data,u),true);assert.equal(u.shelteredIn,b.id);assert.equal(shelterOccupants(w,b.id),1);assert.ok(u.y>=b.y+data.buildings[b.type].size);const pos=[u.x,u.y];ticks(w,10);assert.deepEqual([u.x,u.y],pos);w.raidPending=null;ticks(w,1);assert.equal(u.shelteredIn,undefined);assert.equal(u.emergency,undefined);assert.deepEqual(u.order,order);assert.equal(u.workplace,'kept');assert.equal(u.carry,9);
});
test('a destroyed or removed shelter loses protection immediately and occupants seek another home',()=>{
 const {w,u,b}=setup();ticks(w);assert.equal(isSheltered(w,data,u),true);b.hp=0;assert.equal(isSheltered(w,data,u),false);ticks(w,1);assert.equal(u.shelteredIn,undefined);const second=makeBuilding('cottage',10,5,data);w.buildings=[second];ticks(w,150);assert.equal(u.shelteredIn,second.id);w.buildings=[];assert.equal(isSheltered(w,data,u),false);ticks(w,1);assert.equal(u.shelteredIn,undefined);
});
test('a sealed wall enclosure cannot teleport civilians through walls into a shelter',()=>{
 const {w,u,b}=setup();const size=data.buildings[b.type].size;for(let x=4;x<=6+size;x++){w.buildings.push(makeBuilding('wall',x,4,data),makeBuilding('wall',x,6+size,data));}for(let y=5;y<6+size;y++)w.buildings.push(makeBuilding('wall',4,y,data),makeBuilding('wall',6+size,y,data));ticks(w,200);assert.equal(u.shelteredIn,undefined);assert.equal(u.x,2.5);assert.equal(u.y,7.5);
});
test('shelter searches admit only a bounded batch per tick, including campaign-shaped worlds',()=>{
 const {w,u,b}=setup();const roster=Array.from({length:20},()=>{const t=makeUnit(u.type,data);t.x=2.5;t.y=7.5;return t;});w.troops=roster;tickEmergency(w,data,.1);assert.equal(roster.filter(t=>t.emergency.target===b.id).length,4);ticks(w,1);assert.equal(roster.filter(t=>t.emergency.target===b.id).length,8);ticks(w,150);assert.equal(shelterOccupants(w,b.id),20);
});
test('emergency repair consumes only wood above a protected reserve',()=>{
 const {w,b}=setup();const u=makeUnit('builder',data);u.x=4.5;u.y=5.5;const wall=makeBuilding('wall',5,5,data);wall.hp-=40;w.buildings=[wall];w.troops=[u];w.resources.wood=10;w.automation={reserves:{wood:9.8}};const hp=wall.hp;tickEmergency(w,data,1);assert.ok(Math.abs(wall.hp-hp-3)<1e-8);assert.equal(w.resources.wood,9.8);tickEmergency(w,data,1);assert.equal(w.resources.wood,9.8);
});
