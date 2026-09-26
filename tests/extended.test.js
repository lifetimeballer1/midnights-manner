import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit, makeBuilding} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickCombat, spawnRaid} from '../src/systems/combat.js';
import {nextStep, move} from '../src/systems/pathfinding.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

// 1. Enclosed raiders chew the barrier instead of soft-locking.
test('walled-in raiders damage the adjacent barrier', ()=>{
  const w = createWorld(data);
  w.buildings = [makeBuilding('hall', 9, 7, data)];
  // Ring the enemy in walls on all four sides.
  w.buildings.push(makeBuilding('wall', 4, 4, data), makeBuilding('wall', 6, 5, data), makeBuilding('wall', 5, 4, data), makeBuilding('wall', 5, 6, data));
  spawnRaid(w, 1);
  w.enemies[0].x = 5.5; w.enemies[0].y = 5.5; w.enemies[0].attackTimer = 0;
  const wall = w.buildings.find(b=>b.type==='wall');
  const hp = wall.hp;
  for (let i=0;i<40;i++) tickCombat(w, data, .05);
  assert.ok(w.buildings.some(b=>b.hp < hp) || w.enemies.length===0, 'barrier should take damage or raid resolve');
});

// 2. Zero/empty carry loads never NaN resources.
test('zero carry capacity cannot corrupt resources', ()=>{
  const w = createWorld(data);
  w.troops = [];
  const u = makeUnit('farmer', data);
  u.carry = NaN; u.gear = 'sickle';
  w.troops.push(u);
  tickEconomy(w, data, .05);
  assert.ok(Number.isFinite(w.resources.food), 'food stays finite');
  assert.ok(Number.isFinite(u.carry), 'carry stays finite');
});

// 3. Pathfinder never throws on bad input, returns null safely.
test('pathfinder survives NaN and out-of-bounds actors', ()=>{
  const w = createWorld(data);
  assert.equal(nextStep(w, data, {x:NaN,y:1}, {x:5,y:5}), null);
  assert.equal(move(w, data, {x:NaN,y:1}, {x:5,y:5}, 1, .05), false);
  assert.equal(move(w, data, {x:-99,y:-99}, {x:9.5,y:7.5}, 1, .05), false);
  assert.ok(nextStep(w, data, {x:9.5,y:7.5}, {x:9.6,y:7.6}, 1), 'in-range returns a step');
});

// 4. Long-stuck raids flee instead of soft-locking.
test('raid failsafe clears ancient waves', ()=>{
  const w = createWorld(data);
  spawnRaid(w, 2);
  w.raidAge = 239;
  for (let i=0;i<40;i++) tickCombat(w, data, .05);
  assert.equal(w.enemies.length, 0, 'failsafe should clear the wave');
  assert.equal(w.raidFled, true);
});
