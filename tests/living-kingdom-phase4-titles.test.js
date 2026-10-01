import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeUnit} from '../src/model.js';
import {ensureIdentity,tickTitles,jobLevelMult,JOB_XP_LEVELS} from '../src/systems/villagers.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('titles: posted master smith earns title once with 5% bonus',()=>{
  const w={buildings:[{id:'b1',type:'forge',hp:10,remaining:0}],troops:[]};
  const u=makeUnit('weaponsmith',data,0);ensureIdentity(u,data,[]);
  u.workplace='b1';u.jobXp=JOB_XP_LEVELS[4];u.jobLevel=5;w.troops.push(u);
  const said=[];assert.deepEqual(tickTitles(w,data,m=>said.push(m)).map(t=>t.id),[u.id]);
  assert.equal(u.title,'Master Smith');assert.equal(jobLevelMult(u),1.32*1.05);
  assert.equal(said.length,1);assert.equal(tickTitles(w,data,()=>{throw new Error('re-notify');}).length,0);
});
test('titles: level-15 builder and combat earn veteran titles',()=>{
  const w={buildings:[],troops:[]};
  const b=makeUnit('builder',data,0);ensureIdentity(b,data,[]);b.level=15;w.troops.push(b);
  const g=makeUnit('warrior',data,1);ensureIdentity(g,data,[]);g.level=15;w.troops.push(g);
  const said=[];const got=tickTitles(w,data,m=>said.push(m));
  assert.equal(got.length,2);assert.equal(b.title,'Master Builder');assert.equal(g.title,'Veteran Guard');
  assert.equal(said.length,2);
});
test('titles: no award below thresholds or off the table',()=>{
  const w={buildings:[{id:'b1',type:'forge',hp:10,remaining:0}],troops:[]};
  const smith=makeUnit('weaponsmith',data,0);ensureIdentity(smith,data,[]);smith.workplace='b1';smith.jobXp=JOB_XP_LEVELS[3];smith.jobLevel=4;w.troops.push(smith);
  const green=makeUnit('warrior',data,1);ensureIdentity(green,data,[]);green.level=14;w.troops.push(green);
  const farmer=makeUnit('farmer',data,2);ensureIdentity(farmer,data,[]);farmer.jobXp=JOB_XP_LEVELS[4];farmer.jobLevel=5;w.troops.push(farmer);
  assert.equal(tickTitles(w,data,()=>{throw new Error('no-notify');}).length,0);
  assert.equal(smith.title,null);assert.equal(green.title,null);assert.equal(farmer.title,null);
  assert.equal(jobLevelMult({jobLevel:5}),1.32);
});
test('titles: ensureIdentity keeps titles, defaults null',()=>{
  const u=makeUnit('miner',data,0);ensureIdentity(u,data,[]);
  assert.equal(u.title,null);
  u.title='Master Miner';ensureIdentity(u,data,[u]);
  assert.equal(u.title,'Master Miner');
});
test('titles: old-save veterans backfill on next tick',()=>{
  const w={buildings:[],troops:[]};
  const vet=makeUnit('archer',data,0);delete vet.title;vet.level=20;w.troops.push(vet);
  const master=makeUnit('miner',data,1);delete master.title;master.jobXp=JOB_XP_LEVELS[4];master.jobLevel=5;w.troops.push(master);
  const dead=makeUnit('warrior',data,2);delete dead.title;dead.level=20;dead.hp=0;w.troops.push(dead);
  const got=tickTitles(w,data,()=>{});
  assert.equal(got.length,2);assert.equal(vet.title,'Veteran Guard');assert.equal(master.title,'Master Miner');
  assert.equal(dead.title,undefined);
});
