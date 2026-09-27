import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeUnit} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {migrateToLatest,VERSION} from '../src/storage.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

// The butcher walks no gather loop (job crews earn at their workplace) and
// must never mint a phantom "null" resource, whatever its posting.
test('null-gather crews deliver nothing and mint no null key',()=>{
 const w=createWorld(data);w.troops=[];
 const b=makeUnit('butcher',data,0);b.hp=100;w.troops.push(b);
 for(let i=0;i<300;i++)tickEconomy(w,data,.05);
 assert.ok(!('null' in w.resources),'no phantom null in the pool');
 assert.ok(!('null' in (w.gathered||{})),'no phantom null in gathered');
 assert.ok(Number.isFinite(w.resources.gold),'gold stays a clean number');
});

// One-time amnesty: banked phantom pays out to gold, then the key is gone.
test('v6 saves fold banked null into gold on the way to v7',()=>{
 const v={version:6,world:{resources:{gold:100,'null':1128,wood:5},gathered:{gold:10,'null':7}},home:null};
 const out=migrateToLatest(v,data);
 assert.equal(out.version,VERSION);
 assert.equal(out.world.resources.gold,1228);
 assert.ok(!('null' in out.world.resources),'null key removed');
 assert.equal(out.world.gathered.gold,17);
});
