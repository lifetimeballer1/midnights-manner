import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeUnit,makeBuilding,center,distance} from '../src/model.js';
import {spawnRaid,tickCombat} from '../src/systems/combat.js';
import {factionFor,defenseTarget,retreat} from '../src/systems/tactics.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('factions introduce ranged and siege roles gradually with distinct configurations',()=>{
 assert.equal(factionFor(data,1).id,'thornband');assert.equal(factionFor(data,2).id,'thornband');
 const seen=new Set();for(let wave=1;wave<10;wave++){const f=factionFor(data,wave);assert.ok(wave>=f.minWave);seen.add(f.id);for(const role of f.roles)assert.ok(data.world.enemyRoles[role]);}assert.equal(seen.size,3);
 const w=createWorld(data);spawnRaid(w,4,null,data,data.world.enemyFactions[2]);assert.equal(w.enemies[0].role,'breaker');assert.ok(w.enemies[0].hp>w.enemies[1].hp);assert.equal(w.enemies[3].role,'archer');
 const legacy=createWorld(data);spawnRaid(legacy,3,null,data);assert.equal(legacy.enemies[0].role,undefined);assert.equal(legacy.enemies[0].hp,77);
});
test('defenders prioritize a nearby manor breach over a slightly closer raider',()=>{
 const w=createWorld(data),u={x:5,y:5},hall=w.buildings.find(b=>b.type==='hall');w.enemies=[{id:'scout',hp:30,x:6,y:5},{id:'breach',hp:30,x:8,y:5,targetId:hall.id}];assert.equal(defenseTarget(w,data,u).id,'breach');w.enemies[1].hp=0;assert.equal(defenseTarget(w,data,u).id,'scout');
});
test('retreat increases distance without entering buildings or leaving bounds',()=>{
 const w=createWorld(data);w.buildings=[];const u={x:5.5,y:5.5},e={x:6.5,y:5.5,hp:30};w.enemies=[e];assert.equal(retreat(w,data,u,e,1,.1),true);assert.ok(distance(u,e)>1);w.bounds={w:1,h:1};u.x=.5;u.y=.5;assert.equal(retreat(w,data,u,e,1,.1),false);
});
test('enemy archers attack from range and breakers inflict extra wall damage',()=>{
 const w=createWorld(data);w.troops=[];w.buildings=[makeBuilding('wall',5,5,data)];const b=w.buildings[0],hp=b.hp;
 w.enemies=[{id:'archer',role:'archer',x:3,y:5.5,hp:100,damage:10,attackTimer:0}];tickCombat(w,data,.05);assert.ok(b.hp<hp);assert.equal(w.enemies[0].x,3);
 b.hp=hp;w.enemies=[{id:'breaker',role:'breaker',x:4.5,y:5.5,hp:100,damage:10,attackTimer:0}];tickCombat(w,data,.05);assert.equal(hp-b.hp,25);
});
test('ranging villagers neither fight nor become ordinary enemy targets',()=>{
 const w=createWorld(data);const u=makeUnit('warrior',data,0);u.x=1.5;u.y=1.5;u.expedition={};w.troops=[u];w.enemies=[{id:'e',x:1.6,y:1.5,hp:100,damage:10,attackTimer:0}];const hp=u.hp;tickCombat(w,data,.05);assert.equal(u.hp,hp);assert.equal(w.enemies[0].hp,100);
});
