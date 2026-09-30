import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeBuilding, auras} from '../src/model.js';
import {tickTownSupply, supplyCost, supplyStatus, supplyBonus, territorySupplyCost} from '../src/systems/food.js';
import {conquestAuraEffects, conquestLimitBonus} from '../src/systems/conquest.js';
import {tickEconomy} from '../src/systems/economy.js';
import {performTrade, dealsFor} from '../src/systems/calendar.js';
import {save, load, VERSION} from '../src/storage.js';
const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
    .map(async name => [name, JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)))])));
function rich() {
  const w = createWorld(data);
  w.resources = Object.fromEntries(['wood','food','gold','bread','flour','lumber','plate','frostwood'].map(k => [k, 20000]));
  return w;
}
test('Task E: full daily supply is exact and never double charged or backdated', () => {
  const w = rich(), cost = supplyCost(w, data), before = {...w.resources};
  assert.equal(tickTownSupply(w, data), null);
  w.elapsed = 180;
  assert.equal(tickTownSupply(w, data).supplied, true);
  for (const [key, value] of Object.entries(cost)) assert.equal(w.resources[key], before[key] - value);
  const paid = {...w.resources};
  assert.equal(tickTownSupply(w, data), null);
  assert.deepEqual(w.resources, paid);
  w.elapsed = 1800;
  tickTownSupply(w, data);
  for (const [key, value] of Object.entries(cost)) assert.equal(w.resources[key], paid[key] - value);
});
test('Task E: shortfall draws nothing, notices once, preserves people and recovers next day', () => {
  const w = rich(), notes = [];
  w.elapsed = 180; tickTownSupply(w, data);
  w.elapsed = 360; w.resources.flour = 0;
  const stores = {...w.resources}, troops = structuredClone(w.troops);
  tickTownSupply(w, data, n => notes.push(n));
  assert.deepEqual(w.resources, stores);
  assert.deepEqual(w.troops, troops);
  assert.equal(w.wellSupplied, false);
  assert.equal(notes.length, 1);
  w.elapsed = 540; tickTownSupply(w, data, n => notes.push(n));
  assert.equal(notes.length, 1);
  w.resources.flour = 20000; w.elapsed = 720; tickTownSupply(w, data);
  assert.equal(w.wellSupplied, true);
});
test('Task E: old saves and breadless villages have a quiet supply grace day', () => {
  const w = rich(); delete w.lastSupplyDay; delete w.wellSupplied;
  w.elapsed = 2000; w.resources.bread = 0;
  const before = {...w.resources}, notes = [];
  tickTownSupply(w, data, n => notes.push(n));
  assert.equal(w.wellSupplied, false);
  assert.equal(w.lastSupplyDay, 11);
  w.elapsed = 2160; tickTownSupply(w, data, n => notes.push(n));
  assert.deepEqual(w.resources, before);
  assert.deepEqual(notes, []);
});
test('Task E: development adds worked goods; read-only supply views do not write state', () => {
  const w = rich(), small = supplyCost(w, data);
  w.buildings.find(b => b.type === 'hall').level = 3;
  assert.ok(supplyCost(w, data).plate > 0);
  w.buildings.push(makeBuilding('grand-granary', 2, 2, data, 3), makeBuilding('manor-gardens', 4, 4, data, 3));
  const big = supplyCost(w, data), before = structuredClone(w);
  assert.ok(big.food > small.food && big.wood > small.wood && big.flour > small.flour && big.frostwood > 0);
  assert.equal(supplyStatus(w, data).nextIn, 180);
  assert.deepEqual(w, before);
});
test('Task E: supply powers existing auras and actual passive output only while covered', () => {
  const bare = rich(), supplied = structuredClone(bare), base = auras(bare, data);
  supplied.wellSupplied = true;
  assert.equal(supplyBonus(bare, data, 'jobXp'), 0);
  assert.equal(supplyBonus(supplied, data, 'jobXp'), 0.15);
  const active = auras(supplied, data);
  assert.ok(Math.abs(active.build - base.build - 0.05) < 1e-9);
  assert.ok(Math.abs(active.heal - base.heal - 0.1) < 1e-9);
  tickEconomy(bare, data, 1); tickEconomy(supplied, data, 1);
  const farm = w => w.buildings.find(b => b.type === 'farm').harvestBonus;
  assert.ok(Math.abs(farm(supplied) - farm(bare) * 1.05) < 1e-9);
});
test('Task E: territory upkeep pauses auras without losing land or building room', () => {
  for (const annexed of ['outpost', 'settlement']) {
    const w = rich(); w.conquest = {annexed};
    assert.deepEqual(conquestAuraEffects(w, data), {});
    const cost = territorySupplyCost(w, data), before = {...w.resources}, local = supplyCost(w, data);
    w.elapsed = 180; tickTownSupply(w, data);
    for (const [key, value] of Object.entries(cost)) assert.equal(w.resources[key], before[key] - value - (local[key] || 0));
    assert.ok(Object.keys(conquestAuraEffects(w, data)).length > 0);
    const cap = conquestLimitBonus(w, data);
    w.resources.gold = 0; w.elapsed = 360;
    const short = {...w.resources}; tickTownSupply(w, data);
    assert.deepEqual(w.resources, short);
    assert.deepEqual(conquestAuraEffects(w, data), {});
    assert.equal(w.conquest.annexed, annexed);
    assert.equal(conquestLimitBonus(w, data), cap);
  }
});
test('Task E: wood/flour bulk order uses rotation, exact prices, daily cap and output room', () => {
  const id = 'road-timber-order'; let date;
  for (let day = 1; day <= 30; day++) {
    const candidate = new Date(2026, 8, day);
    if (dealsFor(data.traders, data.calendar, candidate, 9).some(d => d.id === id)) { date = candidate; break; }
  }
  assert.ok(date);
  const w = rich(); w.resources.gold = 0;
  const state = {world: w, vlevel: 9}, before = {...w.resources};
  const deal = data.traders.find(d => d.id === id);
  assert.equal(performTrade(state, data, id, date).ok, true);
  for (const [key, value] of Object.entries(deal.give)) assert.equal(w.resources[key], before[key] - value);
  assert.equal(w.resources.gold, deal.take.gold);
  const paid = {...w.resources};
  assert.equal(performTrade(state, data, id, date).ok, false);
  assert.deepEqual(w.resources, paid);
  const full = rich(), fullBefore = {...full.resources};
  assert.equal(performTrade({world: full, vlevel: 9}, data, id, date).ok, false);
  assert.deepEqual(full.resources, fullBefore);
});
test('Task E: additive supply fields survive save/load', () => {
  const world = rich(); world.elapsed = 180; tickTownSupply(world, data);
  assert.equal(save({version: VERSION, world, completed: [], questsCompleted: [], unlocks: [], vlevel: 1, xp: 0}), true);
  const restored = load(data);
  assert.ok(restored);
  assert.equal(restored.world.wellSupplied, true);
  assert.equal(restored.world.lastSupplyDay, 1);
  assert.deepEqual(restored.world.resources, world.resources);
});
