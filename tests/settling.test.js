import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld} from '../src/model.js';
import {storageCap} from '../src/systems/storage.js';
import {tickEconomy} from '../src/systems/economy.js';
import {economyDashboard} from '../src/systems/dashboard.js';
import {makeBuilding, makeUnit} from '../src/model.js';
import {tickCombat} from '../src/systems/combat.js';
const data = Object.fromEntries(await Promise.all(
  ['world', 'buildings', 'troops', 'items', 'abilities', 'quests', 'missions', 'levels']
    .map(async name => [name, JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)))])));
const fresh = () => {const w = createWorld(data); w.troops = []; return w;};

test('settling: over-cap central goods drain by the authored formula without feedback', () => {
  const w = fresh(), cap = storageCap(w, data, 'wood');
  w.resources.wood = cap + 100; w.pendingRewards = {wood: 20};
  const effects = structuredClone(w.effects), gathered = {...w.gathered};
  tickEconomy(w, data, .5);
  assert.ok(Math.abs(w.resources.wood - (cap + 100 - 1.02 * .5)) < 1e-9);
  assert.deepEqual(w.effects, effects, 'no popup');
  assert.deepEqual(w.gathered, gathered, 'no objective credit');
  assert.equal(w.pendingRewards.wood, 20, 'held rewards are not drained');
});

test('settling: never crosses the cap and leaves full/under-cap/uncapped goods alone', () => {
  const w = fresh(), cap = storageCap(w, data, 'wood');
  w.resources.wood = cap + .001;
  w.resources.food = storageCap(w, data, 'food');
  w.resources.gold = 100; w.resources.future = 100000;
  const before = {...w.resources};
  tickEconomy(w, data, 1000);
  assert.equal(w.resources.wood, cap);
  for (const key of ['food', 'gold', 'future']) assert.equal(w.resources[key], before[key]);
});

test('settling: invalid dt and paused game ticks do not drain stores', () => {
  const g = new Game(structuredClone(data));
  g.world.resources.wood = storageCap(g.world, data, 'wood') + 100;
  const before = g.world.resources.wood;
  for (const dt of [0, -1, NaN, Infinity]) tickEconomy(g.world, data, dt);
  assert.equal(g.world.resources.wood, before);
  g.paused = true; g.tick(1);
  assert.equal(g.world.resources.wood, before);
});

test('settling: dashboard folds the live drain into use and stays read-only', () => {
  const w = fresh();
  w.resources.wood = storageCap(w, data, 'wood') + 100;
  const before = JSON.stringify(w), dash = economyDashboard(w, data);
  const row = dash.rows.find(r => r.key === 'wood');
  assert.ok(row, 'over-cap wood joins the existing ledger');
  assert.equal(row.use, 1.02);
  assert.equal(row.net, row.prod - row.use);
  assert.equal(JSON.stringify(w), before);
  w.resources.food = storageCap(w, data, 'food') + 100;
  assert.equal(economyDashboard(w, data).rows.find(r => r.key === 'food').use, 1.02);
});

test('settling: one-hour frontier economy soak keeps resources finite and effects bounded', () => {
  const w = fresh(), cap = storageCap(w, data, 'wood');
  w.resources.wood = cap + 1000;
  for (const [type, troop, x] of [['whisper-grove', 'heartwarden', 2], ['blackwater-weir', 'mudlark', 5]]) {
    const b = makeBuilding(type, x, 2, data, 2), u = makeUnit(troop, data);
    b.remaining = 0; u.workplace = b.id;
    w.buildings.push(b); w.troops.push(u);
  }
  let peak = 0;
  for (let i = 0; i < 72000; i++) {
    w.elapsed += .05;
    tickEconomy(w, data, .05); tickCombat(w, data, .05);
    peak = Math.max(peak, w.effects.length);
  }
  assert.equal(w.resources.wood, cap, 'excess settles to the cap without crossing it');
  assert.ok(w.gathered.food > 0, 'the weir keeps hauling throughout the soak');
  assert.ok(peak <= 60, `effect peak ${peak}`);
  for (const value of Object.values(w.resources)) assert.ok(Number.isFinite(value) && value >= 0);
  for (const b of w.buildings) if (b.maxReserve) assert.ok(b.reserve >= 0 && b.reserve <= b.maxReserve);
});
