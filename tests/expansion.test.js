import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, canPlace, inBounds} from '../src/model.js';
import {ringFor, costFor, isClaimed} from '../src/systems/expansion.js';
import {claimRect} from '../src/systems/expansion.js';
import {Game} from '../src/game.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'expansion', 'biomes'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])
));
const BOUNDS_14 = {w: 14, h: 12};

test('expansion.json is a tunable ring cost table', () => {
  assert.ok(data.expansion.homestead, 'homestead rect present');
  assert.deepEqual(data.expansion.homestead, {w: 20, h: 17});
  assert.ok(Array.isArray(data.expansion.rings) && data.expansion.rings.length > 0);
  for (const r of data.expansion.rings) {
    assert.ok(Number.isFinite(r.upto), 'ring needs upto');
    assert.ok(r.cost && Object.values(r.cost).every(v => Number.isFinite(v) && v > 0), 'ring needs positive cost');
  }
});

test('world grid grew to 40x34', () => {
  assert.equal(data.world.width, 40);
  assert.equal(data.world.height, 34);
});

test('ring/cost lookups: settled heart free, farther rings cost more', () => {
  assert.equal(ringFor(data.expansion, data.world, 10, 10), 0);
  assert.equal(costFor(data.expansion, data.world, 10, 10), null);
  // Bounds-relative: just outside the 14x12 settled rect reads ring 1.
  assert.equal(ringFor(data.expansion, data.world, 13, 9, BOUNDS_14), 1);
  assert.equal(ringFor(data.expansion, data.world, 12, 9, BOUNDS_14), 0);
  const c1 = costFor(data.expansion, data.world, 13, 9, BOUNDS_14);
  assert.deepEqual(c1, {wood: 60, gold: 25});
  const far = costFor(data.expansion, data.world, 39, 33, BOUNDS_14);
  assert.ok(far.wood >= c1.wood && far.gold >= c1.gold, 'distance never gets cheaper');
});

test('unclaimed wilderness blocks builds, claimed allows', () => {
  const w = createWorld(data);
  // (13,9) sits outside settled bounds and starts unclaimed.
  assert.equal(isClaimed(w, 13, 9), false);
  assert.equal(inBounds(w, data, 'wall', 13, 9), false);
  assert.equal(canPlace(w, data, 'wall', 13, 9), false);
  // Deep wilderness is equally blocked.
  assert.equal(inBounds(w, data, 'wall', 25, 25), false);
});

test('expandClaim enforces adjacency and deducts cost', () => {
  const g = new Game(data);
  g.world.resources = {wood: 10000, gold: 10000, food: 10000, frostwood: 0, plate: 0};
  // Unclaimed border blocks construction before purchase.
  assert.ok(!g.build('wall', 13, 9), 'unclaimed blocks build');
  // Far from claimed land: rejected, nothing spent.
  const before = {...g.world.resources};
  assert.equal(g.expandClaim(30, 30), false);
  assert.deepEqual(g.world.resources, before);
  assert.equal(isClaimed(g.world, 30, 30), false);
  // Border tile beside claimed land: ring-1 price, flipped to claimed.
  const cost = costFor(data.expansion, data.world, 13, 9, g.world.bounds);
  const wood = g.world.resources.wood, gold = g.world.resources.gold;
  assert.equal(g.expandClaim(13, 9), true);
  assert.equal(isClaimed(g.world, 13, 9), true);
  assert.equal(g.world.resources.wood, wood - cost.wood);
  assert.equal(g.world.resources.gold, gold - cost.gold);
  // Claimed land now builds.
  assert.equal(inBounds(g.world, data, 'wall', 13, 9), true);
  assert.equal(canPlace(g.world, data, 'wall', 13, 9), true);
  assert.ok(g.build('wall', 13, 9), 'claimed allows build');
  // Re-claiming is rejected without charge.
  const stock = {...g.world.resources};
  assert.equal(g.expandClaim(13, 9), false);
  assert.deepEqual(g.world.resources, stock);
});

test('expandClaim rejects unaffordable claims without flipping', () => {
  const g = new Game(data);
  g.world.resources = {wood: 1, gold: 1, food: 1};
  assert.equal(g.expandClaim(13, 10), false);
  assert.equal(isClaimed(g.world, 13, 10), false);
});

test('XP settling claims newly opened rows', () => {
  const w = createWorld(data);
  assert.equal(isClaimed(w, 13, 9), false);
  const n = claimRect(w, 16, 13);
  assert.ok(n > 0);
  assert.equal(isClaimed(w, 13, 9), true);
});

test('landmarks survive the 40x34 grid build', () => {
  const w = createWorld(data);
  assert.equal(w.tiles.length, 40 * 34);
  const still = w.tiles.find(t => t.x === 3 && t.y === 3);
  assert.equal(still.landmark, 'Stillwater');
  assert.equal(still.biome, 'water');
  assert.equal(still.claimed, true);
});

test('expandClaim works without expansion data (default cost)', () => {
  const bare = structuredClone(data);
  delete bare.expansion;
  const g = new Game(bare);
  g.world.resources = {wood: 10000, gold: 10000, food: 10000};
  assert.equal(g.expandClaim(13, 9), true);
  assert.equal(isClaimed(g.world, 13, 9), true);
  assert.equal(g.world.resources.wood, 10000 - 60);
});
