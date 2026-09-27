// Frontier regression (Phase 4): cross-cutting guarantees for the
// region + expedition frontier. Complements biomes/expansion/expeditions
// suites: cost repoint, the full south-to-Emberfall late-game chain,
// save migration, biome determinism through createWorld, and expedition
// countdown exactness. Seeded rng only; no wall-clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeUnit} from '../src/model.js';
import {buildTiles} from '../src/systems/biomes.js';
import {costFor, regionFor, isRegionClaimed, claimPreclaimed} from '../src/systems/expansion.js';
import {startExpedition, tickExpeditions, expeditionStatus} from '../src/systems/expeditions.js';
import {Game} from '../src/game.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'expansion', 'biomes'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])
));
const lucky = () => 0.999;

test('cost lookup repoints at regions, not rings', () => {
  assert.deepEqual(costFor(data.expansion, data.world, 26, 10), {gold: 250, wood: 400});
  assert.deepEqual(costFor(data.expansion, data.world, 30, 25), {food: 2000, frostwood: 300, gold: 5000, plate: 80, wood: 4000});
  assert.equal(costFor(data.expansion, data.world, 10, 10), null, 'pre-claimed center is free');
});

test('late-game chain: Southfields then Emberfall with tier goods', () => {
  const g = new Game(structuredClone(data));
  g.world.resources = {wood: 20000, gold: 20000, food: 20000, frostwood: 2000, plate: 500};
  const ember = regionFor(data.expansion, 30, 25);
  assert.equal(g.expandClaim(30, 25), false, 'Emberfall locked behind its neighbors');
  assert.equal(g.expandClaim(10, 25), true, 'Southfields borders the center');
  assert.equal(isRegionClaimed(g.world, regionFor(data.expansion, 10, 25)), true);
  const before = {...g.world.resources};
  assert.equal(g.expandClaim(30, 25), true, 'Emberfall opens after Southfields');
  assert.equal(isRegionClaimed(g.world, ember), true);
  assert.equal(g.world.resources.wood, before.wood - 4000);
  assert.equal(g.world.resources.gold, before.gold - 5000);
  assert.equal(g.world.resources.food, before.food - 2000);
  assert.equal(g.world.resources.frostwood, before.frostwood - 300);
  assert.equal(g.world.resources.plate, before.plate - 80);
});

test('migration: old bounds-built grids gain the pre-claimed center', () => {
  // A legacy tile grid (bounds claiming only, no region reset).
  const tiles = buildTiles({...data.world}, {w: 14, h: 12});
  const world = {tiles};
  assert.equal(isRegionClaimed(world, regionFor(data.expansion, 10, 10)), false, 'center incomplete before migration');
  const n = claimPreclaimed(world, data.expansion);
  assert.ok(n > 0, 'migration flips tiles');
  assert.equal(isRegionClaimed(world, regionFor(data.expansion, 10, 10)), true, 'center whole after migration');
  assert.equal(isRegionClaimed(world, regionFor(data.expansion, 26, 10)), false, 'wild regions stay wild');
});

test('biome determinism holds through createWorld', () => {
  const a = createWorld(structuredClone(data));
  const b = createWorld(structuredClone(data));
  assert.deepEqual(a.tiles, b.tiles, 'same seed, same grid, twice');
});

test('expedition countdown ticks exact seconds (scout 90s)', () => {
  const g = new Game(structuredClone(data));
  const u = makeUnit('scout', g.data, 0);
  g.world.troops.push(u);
  startExpedition(g.world, g.data, u, lucky);
  u.x = u.expedition.entryX; u.y = u.expedition.entryY;
  tickExpeditions(g.world, g.data, 0.5, lucky);
  assert.equal(u.expedition.phase, 'gather');
  assert.equal(expeditionStatus(u, g.data), 'Gathering — 90s');
  tickExpeditions(g.world, g.data, 1, lucky);
  assert.equal(expeditionStatus(u, g.data), 'Gathering — 89s');
  tickExpeditions(g.world, g.data, 89, lucky);
  assert.equal(u.expedition.phase, 'back');
});
