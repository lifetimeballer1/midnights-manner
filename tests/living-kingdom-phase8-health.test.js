import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {settlementHealth} from '../src/systems/dashboard.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('health: builders counted by task, weakest wall found',()=>{
  const w=createWorld(data);
  const b=makeUnit('builder',data);b.builderTask={kind:'repair',target:'x',working:true};w.troops.push(b);
  const wall=makeBuilding('wall',8,5,data);wall.hp=1;w.buildings.push(wall);
  const h=settlementHealth(w,data);
  assert.equal(h.builders.repair,1);assert.equal(h.weakWall.type,'wall');
});
test('health: idle counts taskless builders, ordered ones excluded',()=>{
  const base=settlementHealth(createWorld(data),data).builders.idle;
  const w=createWorld(data);
  const idle=makeUnit('builder',data);w.troops.push(idle);
  const busy=makeUnit('builder',data);busy.order={kind:'move',x:1,y:1};w.troops.push(busy);
  const dead=makeUnit('builder',data);dead.hp=0;w.troops.push(dead);
  const miner=makeUnit('miner',data);w.troops.push(miner);
  const h=settlementHealth(w,data);
  assert.equal(h.builders.idle,base+1);
});
test('health: no living walls means null weakWall',()=>{
  const w=createWorld(data);
  w.buildings=w.buildings.filter(b=>!(b.hp>0&&['wall','stonewall','rampart','gate'].includes(b.type)));
  const h=settlementHealth(w,data);
  assert.equal(h.weakWall,null);
});
test('health: cached within 5s bucket, recomputed after',()=>{
  const w=createWorld(data);
  const a=settlementHealth(w,data);
  assert.equal(settlementHealth(w,data),a);
  const wall=makeBuilding('wall',8,5,data);wall.hp=1;w.buildings.push(wall);
  assert.equal(settlementHealth(w,data),a);
  w.elapsed=5;
  const b=settlementHealth(w,data);
  assert.notEqual(b,a);assert.equal(b.weakWall.type,'wall');
});
