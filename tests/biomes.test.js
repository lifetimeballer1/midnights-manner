import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {biomeFor, tileFor, buildTiles, landmarkAt} from '../src/systems/biomes.js';
import {createWorld} from '../src/model.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'biomes'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])
));

test('biomes.json has required entries with display/tint/yield fields', () => {
  for (const id of ['plains', 'forest', 'water', 'hills', 'unclaimed-fringe']) {
    const b = data.biomes[id];
    assert.ok(b, `missing biome ${id}`);
    assert.ok(typeof b.name === 'string' && b.name.length > 0, `${id} needs display name`);
    assert.ok(typeof b.tint === 'string' && b.tint.length > 0, `${id} needs tint`);
    assert.ok(typeof b.spriteVariant === 'string' && b.spriteVariant.length > 0, `${id} needs sprite variant`);
    assert.ok(Number.isFinite(b.yieldModifier), `${id} needs yield modifier`);
  }
});

test('three fixed landmarks at explicit coords with landmark field', () => {
  const tiles = data.world.tiles || [];
  const names = ['Stillwater', 'Timber Line', 'Moonwell'];
  for (const name of names) {
    const t = tiles.find(t => t.landmark === name);
    assert.ok(t, `missing landmark ${name}`);
    assert.ok(Number.isInteger(t.x) && Number.isInteger(t.y), `${name} needs explicit coords`);
    assert.ok(t.biome, `${name} needs biome key`);
    assert.ok(t.x >= 0 && t.x < data.world.width && t.y >= 0 && t.y < data.world.height, `${name} inside grid`);
  }
});

test('landmarks render at fixed coords via tileFor', () => {
  const still = tileFor(data.world, 3, 3);
  assert.equal(still.landmark, 'Stillwater');
  assert.equal(still.biome, 'water');
  const timber = tileFor(data.world, 15, 12);
  assert.equal(timber.landmark, 'Timber Line');
  assert.equal(timber.biome, 'forest');
  const moon = tileFor(data.world, 16, 4);
  assert.equal(moon.landmark, 'Moonwell');
});

test('biome determinism: same seed same layout', () => {
  const a = buildTiles(data.world);
  const b = buildTiles(structuredClone(data.world));
  assert.deepEqual(a, b);
  // Spot-check deterministic default matches biomeFor for non-landmark cells.
  for (const [x, y] of [[0, 0], [5, 5], [10, 10], [19, 16]]) {
    if (landmarkAt(data.world, x, y)) continue;
    assert.equal(tileFor(data.world, x, y).biome, biomeFor(x, y, data.world.seed));
  }
  // Different seed gives a different layout somewhere.
  const alt = buildTiles({...data.world, seed: (data.world.seed || 0) + 1, tiles: []});
  const same = buildTiles({...data.world, tiles: []});
  assert.ok(alt.some((t, i) => t.biome !== same[i].biome), 'seed change should alter layout');
});

test('landmarks never overwritten by procedural fill', () => {
  const tiles = buildTiles(data.world);
  for (const lm of (data.world.tiles || []).filter(t => t.landmark)) {
    const built = tiles.find(t => t.x === lm.x && t.y === lm.y);
    assert.ok(built, 'landmark cell exists');
    assert.equal(built.landmark, lm.landmark);
    assert.equal(built.biome, lm.biome);
  }
  // Procedural fill with empty tiles list still deterministic; landmarks only come from config.
  const bare = buildTiles({...data.world, tiles: []});
  assert.ok(bare.every(t => t.landmark === null));
});

test('createWorld carries tile grid with landmarks intact', () => {
  const w = createWorld(data);
  assert.ok(Array.isArray(w.tiles) && w.tiles.length === data.world.width * data.world.height);
  const still = w.tiles.find(t => t.x === 3 && t.y === 3);
  assert.equal(still.landmark, 'Stillwater');
});
