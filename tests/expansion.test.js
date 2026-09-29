import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, canPlace, inBounds} from '../src/model.js';
import {ringFor, costFor, isClaimed, regionFor, regionCost, isRegionClaimed, regionAdjacent, claimRegion, raidPerimeter} from '../src/systems/expansion.js';
import {claimRect} from '../src/systems/expansion.js';
import {Game} from '../src/game.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'expansion', 'biomes'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])
));

test('expansion.json holds 16 named regions across the 52x44 frontier', () => {
  assert.ok(Array.isArray(data.expansion.regions), 'regions array present');
  assert.equal(data.expansion.regions.length, 16);
  const ids = data.expansion.regions.map(r => r.id);
  assert.equal(new Set(ids).size, data.expansion.regions.length, 'region ids unique');
  for (const r of data.expansion.regions) {
    assert.ok(r.name, `${r.id} has a name`);
    assert.ok(r.rect && Number.isFinite(r.rect.x) && Number.isFinite(r.rect.w), `${r.id} has a rect`);
    assert.ok(Array.isArray(r.biomes) && r.biomes.length, `${r.id} has a biome mix`);
    assert.ok(r.landmark?.name, `${r.id} names a nearby landmark`);
  }
  // Full coverage of the current world grid, no overlaps.
  const seen = new Set();
  for (const r of data.expansion.regions) {
    for (let y = r.rect.y; y < r.rect.y + r.rect.h; y++) {
      for (let x = r.rect.x; x < r.rect.x + r.rect.w; x++) {
        const k = x + ',' + y;
        assert.ok(!seen.has(k), `no overlap at ${k}`);
        seen.add(k);
      }
    }
  }
  assert.equal(seen.size, data.world.width * data.world.height, 'regions cover the whole grid');
});

test('center pre-claimed, every other region carries a positive frontier cost', () => {
  const center = data.expansion.regions.find(r => r.preclaimed);
  assert.ok(center, 'one pre-claimed center');
  assert.equal(regionCost(center), null);
  const rest = data.expansion.regions.filter(r => !r.preclaimed);
  assert.equal(rest.length, data.expansion.regions.length - 1);
  for (const r of rest) {
    const c = regionCost(r);
    assert.ok(c && Object.values(c).every(v => Number.isFinite(v) && v > 0), `${r.id} has a positive cost`);
  }
  // Adjacent edge regions read cheap wood/food; the far corner wants late goods.
  const n = data.expansion.regions.find(r => r.id === 'moonwell-steps');
  assert.deepEqual(regionCost(n), {wood: 150, food: 100});
  const far = data.expansion.regions.find(r => r.id === 'emberfall');
  assert.ok(far.cost.plate > 0 && far.cost.frostwood > 0, 'last region needs ember-tier goods');
  assert.ok(far.cost.gold > regionCost(n).wood, 'far costs more than near');
});

test('world grid extends to 52x44', () => {
  assert.equal(data.world.width, 52);
  assert.equal(data.world.height, 44);
});

test('raid perimeter follows actual claimed frontier rather than legacy XP bounds', () => {
  const g = new Game(data);
  const before = raidPerimeter(g.world, data.world);
  assert.equal(before.source, 'claimed');
  assert.ok(before.east.every(p => isClaimed(g.world, Math.floor(p.x), Math.floor(p.y))), 'initial east entries are owned tiles');
  const oldEast = before.bounds.maxX;
  g.world.resources = {wood: 10000, gold: 10000, food: 10000, frostwood: 10000, plate: 10000};
  assert.equal(g.expandClaim(26, 10), true, 'Timber Deep claimed');
  const after = raidPerimeter(g.world, data.world);
  assert.equal(after.bounds.maxX, 39, 'east frontier reaches the purchased region edge');
  assert.ok(after.bounds.maxX > oldEast, 'claim pushes raid edge outward');
  assert.ok(after.east.length > 0 && after.east.every(p => p.x === 39.5), 'east raid entries sit on the new outer edge');
  assert.ok(after.east.every(p => isClaimed(g.world, Math.floor(p.x), Math.floor(p.y))), 'raid entries never use unclaimed gaps');
});

test('raid perimeter keeps legacy rectangular fallback when tile claims are absent', () => {
  const p = raidPerimeter({bounds:{w:20,h:17},tiles:null}, {width:52,height:44});
  assert.equal(p.source, 'bounds');
  assert.equal(p.west[0].x, .5);
  assert.equal(p.east[0].x, 19.5);
  assert.equal(p.north[0].y, .5);
  assert.equal(p.south[0].y, 16.5);
});

test('region lookups: center tiles claimed, wild regions blocked', () => {
  assert.equal(regionFor(data.expansion, 10, 10)?.id, 'hearthlands');
  assert.equal(regionFor(data.expansion, 10, 1)?.id, 'moonwell-steps');
  assert.equal(regionFor(data.expansion, 30, 25)?.id, 'emberfall');
  const w = createWorld(data);
  assert.equal(isRegionClaimed(w, regionFor(data.expansion, 10, 10)), true);
  assert.equal(isRegionClaimed(w, regionFor(data.expansion, 26, 10)), false);
  // (26,10) sits in wild land beyond settled bounds and blocks builds.
  assert.equal(isClaimed(w, 26, 10), false);
  assert.equal(inBounds(w, data, 'wall', 26, 10), false);
  assert.equal(canPlace(w, data, 'wall', 26, 10), false);
  // Deep wilderness is equally blocked.
  assert.equal(inBounds(w, data, 'wall', 30, 25), false);
});

test('edge regions touch claimed land, corners wait their turn', () => {
  const w = createWorld(data);
  assert.equal(regionAdjacent(w, regionFor(data.expansion, 10, 1)), true);
  assert.equal(regionAdjacent(w, regionFor(data.expansion, 1, 10)), true);
  assert.equal(regionAdjacent(w, regionFor(data.expansion, 26, 10)), true);
  // NW kisses the Stillwater landmark tile (3,3) — landmark-anchored.
  // NE/SW/SE touch nothing claimed until an edge region falls.
  assert.equal(regionAdjacent(w, regionFor(data.expansion, 1, 1)), true);
  assert.equal(regionAdjacent(w, regionFor(data.expansion, 30, 1)), false);
  assert.equal(regionAdjacent(w, regionFor(data.expansion, 1, 25)), false);
  assert.equal(regionAdjacent(w, regionFor(data.expansion, 30, 25)), false);
});

test('expandClaim buys a whole adjacent region and deducts cost', () => {
  const g = new Game(data);
  g.world.resources = {wood: 10000, gold: 10000, food: 10000, frostwood: 10000, plate: 10000};
  // Unclaimed region beyond settled bounds blocks construction before purchase.
  assert.ok(!g.build('wall', 26, 10), 'unclaimed blocks build');
  // Far corner with no border: rejected, nothing spent.
  const before = {...g.world.resources};
  assert.equal(g.expandClaim(30, 25), false);
  assert.deepEqual(g.world.resources, before);
  assert.equal(isRegionClaimed(g.world, regionFor(data.expansion, 30, 25)), false);
  // East stretch beside claimed land: region price, whole rect flips.
  const cost = {wood: 400, gold: 250};
  const wood = g.world.resources.wood, gold = g.world.resources.gold;
  assert.equal(g.expandClaim(26, 10), true);
  const east = regionFor(data.expansion, 26, 10);
  assert.equal(isRegionClaimed(g.world, east), true);
  assert.equal(g.world.resources.wood, wood - cost.wood);
  assert.equal(g.world.resources.gold, gold - cost.gold);
  // Claimed land now builds.
  assert.equal(inBounds(g.world, data, 'wall', 26, 10), true);
  assert.equal(canPlace(g.world, data, 'wall', 26, 10), true);
  assert.ok(g.build('wall', 26, 10), 'claimed allows build');
  // NE corner unlocks once its E neighbor is taken.
  assert.equal(g.expandClaim(30, 1), true);
  assert.equal(isRegionClaimed(g.world, regionFor(data.expansion, 30, 1)), true);
  // Re-claiming is rejected without charge.
  const stock = {...g.world.resources};
  assert.equal(g.expandClaim(26, 10), false);
  assert.deepEqual(g.world.resources, stock);
});

test('expandClaim rejects unaffordable regions without flipping', () => {
  const g = new Game(data);
  g.world.resources = {wood: 1, gold: 1, food: 1};
  assert.equal(g.expandClaim(26, 10), false);
  assert.equal(isRegionClaimed(g.world, regionFor(data.expansion, 26, 10)), false);
});

test('XP settling claims newly opened rows', () => {
  const w = createWorld(data);
  assert.equal(isClaimed(w, 13, 9), true, 'center tile starts claimed');
  const n = claimRect(w, 16, 13);
  assert.ok(n >= 0);
  assert.equal(isClaimed(w, 13, 9), true);
});

test('landmarks survive the full frontier grid build', () => {
  const w = createWorld(data);
  assert.equal(w.tiles.length, data.world.width * data.world.height);
  const still = w.tiles.find(t => t.x === 3 && t.y === 3);
  assert.equal(still.landmark, 'Stillwater');
  assert.equal(still.biome, 'water');
  const timber = w.tiles.find(t => t.x === 15 && t.y === 12);
  assert.equal(timber.landmark, 'Timber Line');
  const moon = w.tiles.find(t => t.x === 16 && t.y === 4);
  assert.equal(moon.landmark, 'Moonwell');
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

test('legacy ring lookups still serve maps without regions', () => {
  const bare = {homestead: {w: 20, h: 17}, rings: [{upto: 1, cost: {wood: 60, gold: 25}}, {upto: 999, cost: {wood: 250, gold: 130}}]};
  assert.equal(ringFor(bare, data.world, 10, 10), 0);
  assert.equal(costFor(bare, data.world, 10, 10), null);
  assert.deepEqual(costFor(bare, data.world, 13, 9, {w: 14, h: 12}), {wood: 60, gold: 25});
});
