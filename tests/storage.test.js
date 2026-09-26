import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {migrateToLatest, save, VERSION} from '../src/storage.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

test('migration registry upgrades v1 without losing progress', ()=>{
  const w = createWorld(data);
  delete w.bounds;
  const old = {version: 1, world: w, home: null, mission: null, completed: [], unlocks: [], xp: 5, questsCompleted: []};
  const out = migrateToLatest(structuredClone(old), data);
  assert.equal(out.version, VERSION);
  assert.ok(out.world.bounds);
  assert.equal(out.xp, 5);
});

test('unknown future versions refuse rather than corrupt', ()=>{
  const w = createWorld(data);
  const out = migrateToLatest({version: 99, world: w}, data);
  assert.equal(out, null);
});

test('save works without localStorage via memory fallback', ()=>{
  const w = createWorld(data);
  const ok = save({world: w, version: VERSION});
  assert.equal(ok, true);
});
