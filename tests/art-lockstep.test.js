import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
// Art lockstep (ART_DIRECTION §3.7): data/*.json sprite names and sprite
// filenames stay in lockstep — boot rejects a missing sprite, so this fails
// loudly in CI before the browser white-screens.
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings'].map(async (n) => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const refs = new Set([
  ...Object.values(data.buildings).flatMap((b) => b.tiers.map((t) => t.sprite)),
  ...Object.values(data.troops).map((t) => t.sprite),
  ...Object.values(data.items).map((i) => i.sprite),
  'raider.png',
]);
test('every referenced sprite exists on disk', async () => {
  const onDisk = new Set(await readdir(new URL('../assets/sprites/', import.meta.url)));
  const missing = [...refs].filter((s) => !onDisk.has(s));
  assert.deepEqual(missing, []);
});
test('every tier has a distinct sprite file (no palette-swap reuse)', () => {
  for (const [id, b] of Object.entries(data.buildings)) {
    const sprites = b.tiers.map((t) => t.sprite);
    assert.equal(new Set(sprites).size, sprites.length, `${id} reuses a tier sprite`);
  }
  const troops = Object.entries(data.troops).map(([id, t]) => [t.sprite, id]);
  const seen = new Map();
  for (const [sprite, id] of troops) {
    assert.ok(!seen.has(sprite), `${id} shares sprite ${sprite} with ${seen.get(sprite)}`);
    seen.set(sprite, id);
  }
});
test('all sprites are 32px-grid names the renderer can load', () => {
  for (const s of refs) assert.match(s, /\.png$/, `${s} must be a PNG`);
});
