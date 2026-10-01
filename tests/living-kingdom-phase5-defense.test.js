import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {setRally,tickDefensePosts,defensePlanningMetrics} from '../src/systems/defense-posts.js';
import {enemyBuildingTarget} from '../src/systems/tactics.js';
import {Game} from '../src/game.js';
import {exportSave,importSaveBlob} from '../src/storage.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('defense: rally presets validate and damaged walls draw enemies',()=>{
  const w=createWorld(data);
  assert.equal(setRally(w,'gates'),true);assert.equal(w.defenseRally,'gates');
  assert.equal(setRally(w,'nope'),false);assert.equal(w.defenseRally,'gates');
  const e={x:5,y:5,hp:10,role:'raider'};
  const wall=makeBuilding('wall',8,5,data);wall.hp=1;w.buildings.push(wall);
  const farm=makeBuilding('farm',8,5,data);w.buildings.push(farm);
  assert.equal(enemyBuildingTarget(w,data,e).id,wall.id);
});
test('defense: reserve rally holds two fastest from auto-assign',()=>{
  const w=createWorld(data);
  w.buildings=[makeBuilding('hall',10,10,data),makeBuilding('gate',5,5,data),makeBuilding('tower',7,5,data)];
  const ranger=makeUnit('ranger',data,0),archer=makeUnit('archer',data,1),warrior=makeUnit('warrior',data,2);
  w.troops=[ranger,archer,warrior];
  assert.equal(setRally(w,'reserve'),true);
  tickDefensePosts(w,data,.05);
  assert.equal(ranger.defensePost,undefined);assert.equal(archer.defensePost,undefined);
  assert.ok(warrior.defensePost);
});
test('defense: enemies prefer valuable stores but distance dominates',()=>{
  const w=createWorld(data);
  const store=makeBuilding('storehouse',8,5,data);w.buildings.push(store);
  const farm=makeBuilding('farm',8,5,data);w.buildings.push(farm);
  assert.equal(enemyBuildingTarget(w,data,{x:5,y:5,hp:10,role:'raider'}).id,store.id);
  const w2=createWorld(data);w2.buildings=[];
  const nearFarm=makeBuilding('farm',6,5,data);w2.buildings.push(nearFarm);
  const farStore=makeBuilding('storehouse',15,5,data);w2.buildings.push(farStore);
  assert.equal(enemyBuildingTarget(w2,data,{x:5,y:5,hp:10,role:'raider'}).id,nearFarm.id);
});
test('defense: rally round-trips through export/import with no storage changes',()=>{
  const g=new Game(data);
  assert.equal(setRally(g.world,'walls'),true);
  const blob=exportSave(g.state);
  assert.ok(typeof blob==='string'&&blob.includes('"defenseRally":"walls"'));
  const result=importSaveBlob(blob,data);
  assert.equal(result.ok,true);assert.equal(result.state.world.defenseRally,'walls');
});
test('defense: rally planning stays bounded',()=>{
  const w=createWorld(data);
  w.buildings=[makeBuilding('hall',10,10,data),makeBuilding('gate',5,5,data),makeBuilding('tower',7,5,data)];
  w.troops=['warrior','archer','warrior'].map((t,i)=>makeUnit(t,data,i));
  assert.equal(setRally(w,'gates'),true);
  w.enemies=[{id:'e',x:5,y:5,hp:100}];
  for(let i=0;i<100;i++)tickDefensePosts(w,data,.05);
  assert.ok(defensePlanningMetrics(w).planningRuns<=11);
});
