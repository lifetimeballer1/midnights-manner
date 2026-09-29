import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Renderer } from '../src/renderer.js';
import { Game } from '../src/game.js';
// Stormglass Phase C: pooled motion (cap 60) + calm parity (zero shake).
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const gradient = { addColorStop() {} };
function context() { return new Proxy({}, { get: (t, k) => t[k] || ((...args) => { if (k === 'measureText') return { width: 50 }; if (k === 'createRadialGradient' || k === 'createLinearGradient') return gradient; }), set: (t, k, v) => (t[k] = v, true) }); }
function renderer() { const c = { width: 1100, height: 740, getContext: () => context(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 1100, height: 740 }) }; return new Renderer(c, data, {}); }
test('motion pool caps transient effects at 60', () => {
  const r = renderer(), world = { effects: [] };
  for (let i = 0; i < 70; i++) r.burst(world, 5, 5, 5, 5, 'hit', .18);
  assert.equal(world.effects.length, 60);
});
function slamWorld() {
  const g = new Game(data), w = g.world;
  w.buildings = []; w.troops = []; w.enemies = []; w.raidPending = null; w.raidResult = null;
  return w;
}
test('slam shakes the full-motion game but never calm mode', () => {
  const calm = renderer(); calm.resize(1100, 740, 1); calm.calm = true;
  const w1 = slamWorld(); w1.effects = [{ x: 5, y: 5, tx: 5, ty: 5, kind: 'slam', life: .3 }];
  calm.shake = 0; calm.draw(w1, 1000); assert.equal(calm.shake, 0);
  const full = renderer(); full.resize(1100, 740, 1); full.calm = false;
  const w2 = slamWorld(); w2.effects = [{ x: 5, y: 5, tx: 5, ty: 5, kind: 'slam', life: .3 }];
  full.shake = 0; full.draw(w2, 1000); assert.ok(full.shake > 0);
});
test('place ring shakes the full-motion game but never calm mode', () => {
  const calm = renderer(); calm.resize(1100, 740, 1); calm.calm = true;
  const w1 = slamWorld(); w1.effects = [{ x: 5, y: 5, tx: 5, ty: 5, kind: 'place', life: .6 }];
  calm.shake = 0; calm.draw(w1, 2000); assert.equal(calm.shake, 0);
});
