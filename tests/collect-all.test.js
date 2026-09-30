import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeBuilding} from '../src/model.js';
import {Game} from '../src/game.js';
import {storageCap} from '../src/systems/storage.js';
import {sfx} from '../src/systems/audio.js';
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const freshGame = () => {
 const g = new Game(structuredClone(data));
 g.paused = false;
 return g;
};
test('collectAll gathers every finished producer in one tap', () => {
 const g = freshGame();
 const farm = makeBuilding('farm', 6, 6, g.data); farm.harvestBonus = 5;
 const mine = makeBuilding('mine', 8, 8, g.data); mine.harvestBonus = 3;
 g.world.buildings.push(farm, mine);
 const before = {food: g.world.resources.food || 0, gold: g.world.resources.gold || 0};
 const totals = g.collectAll();
 assert.deepEqual(totals, {food: 5, gold: 3});
 assert.equal(g.world.resources.food, before.food + 5);
 assert.equal(g.world.resources.gold, before.gold + 3);
 assert.equal(farm.harvestBonus, 0);
 assert.equal(mine.harvestBonus, 0);
});
test('collectAll skips unfinished, ruined and empty producers', () => {
 const g = freshGame();
 const growing = makeBuilding('farm', 6, 6, g.data); growing.harvestBonus = 5; growing.remaining = 10;
 const ruined = makeBuilding('farm', 7, 7, g.data); ruined.harvestBonus = 5; ruined.hp = 0;
 const empty = makeBuilding('farm', 8, 8, g.data); empty.harvestBonus = 0;
 g.world.buildings.push(growing, ruined, empty);
 assert.deepEqual(g.collectAll(), {});
 assert.equal(growing.harvestBonus, 5);
 assert.equal(ruined.harvestBonus, 5);
});
test('collectAll while paused collects nothing', () => {
 const g = freshGame(); g.paused = true;
 const farm = makeBuilding('farm', 6, 6, g.data); farm.harvestBonus = 5;
 g.world.buildings.push(farm);
 assert.deepEqual(g.collectAll(), {});
 assert.equal(farm.harvestBonus, 5);
});

test('Collect Ready banks mixed resources once, retaining partial and blocked reserves', () => {
 const g=freshGame();g.world.buildings=[];
 const farm=makeBuilding('farm',6,6,g.data),other=makeBuilding('farm',8,6,g.data),mine=makeBuilding('mine',10,6,g.data);
 farm.harvestBonus=10.5;other.harvestBonus=4;mine.harvestBonus=8;
 g.world.buildings.push(farm,other,mine);
 g.world.resources.food=storageCap(g.world,g.data,'food')-3;
 g.world.resources.gold=0;
 const gathered=g.world.gathered.food||0;
 let batch=0,single=0,saves=0;const originals={batch:sfx.collectBatch,single:sfx.collect};
 sfx.collectBatch=()=>batch++;sfx.collect=()=>single++;g.persist=()=>{saves++;return true;};
 try{
  assert.deepEqual(g.collectAll(),{food:3,gold:8});
  assert.equal(farm.harvestBonus,7.5);assert.equal(other.harvestBonus,4);assert.equal(mine.harvestBonus,0);
  assert.equal(g.world.gathered.food,gathered+3);
  assert.match(g.message,/Food storage full — 11 waiting here\./);
  assert.equal(batch,1);assert.equal(single,0);assert.equal(saves,1);
  assert.deepEqual(g.collectAll(),{});assert.equal(batch,1,'blocked batch is silent');
  g.world.resources.food-=11;
  assert.deepEqual(g.collectAll(),{food:11});assert.equal(batch,2);
  assert.equal(farm.harvestBonus,.5);assert.equal(other.harvestBonus,0);
 }finally{sfx.collectBatch=originals.batch;sfx.collect=originals.single;}
});

test('fractional remaining storage is banked and subtracted exactly in batch and manual collection', () => {
 for(const method of ['collectAll','harvest']){
  const g=freshGame();g.world.buildings=[];
  const farm=makeBuilding('farm',6,6,g.data);farm.harvestBonus=5.5;g.world.buildings.push(farm);
  const cap=storageCap(g.world,g.data,'food');g.world.resources.food=cap-.5;
  const result=method==='harvest'?g.harvest(farm.id):g.collectAll();
  assert.deepEqual(result,method==='harvest'?.5:{food:.5});
  assert.equal(g.world.resources.food,cap);assert.equal(farm.harvestBonus,5);
  assert.match(g.message,/Food storage full — 5 waiting here\./);
 }
});

test('full manual collection explains the resource and held amount without changing reserves', () => {
 const g=freshGame(),farm=g.world.buildings.find(b=>b.type==='farm');farm.harvestBonus=430;
 g.world.resources.food=storageCap(g.world,g.data,'food');
 assert.equal(g.harvest(farm.id),false);assert.equal(farm.harvestBonus,430);
 assert.equal(g.message,'Food storage full — 430 waiting here.');
});
