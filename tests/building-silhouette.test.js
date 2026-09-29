// Presentation pass, Phase 5 — housing silhouette pins. The cottage gets
// structurally richer per tier (loft, then porch and stack), and the
// longhouse out-silhouettes the row as a meadhall — counts and marker
// materials, not just paint. Geometry here is deliberately shape-based;
// the exact shaded look stays pinned in tests/lighting-baseline.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const context = new Proxy({}, {get: (t, k) => t[k] || (() => k === 'measureText' ? {width: 40} : k.includes('Gradient') ? {addColorStop() {}} : undefined), set: (t, k, v) => (t[k] = v, true)});
function housing(type, level) {
  const r = new Renderer({getContext: () => context}, data, {});
  r.resize(1280, 900, 1);
  r.cam.x = 9; r.cam.y = 9; r.cam.zoom = 1.8; r.cam.yaw = Math.PI / 4;
  const spec = data.buildings[type];
  const s = new MeshScene(r);
  const b = {id: type, type, x: 5, y: 5, level, hp: 100, remaining: 0};
  buildingModel(s, b, spec, {buildings: [b]});
  return s.faces;
}

test('housing: every cottage tier adds silhouette, never a palette swap', () => {
  const one = housing('cottage', 1), two = housing('cottage', 2), three = housing('cottage', 3);
  assert.ok(two.length > one.length, `tier 2 adds structure (${one.length} → ${two.length})`);
  assert.ok(three.length > two.length, `tier 3 adds structure (${two.length} → ${three.length})`);
  for (const faces of [one, two, three]) {
    assert.ok(faces.every(f => /^#[0-9a-f]{6}$/i.test(f.color) && f.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))), 'tiers stay paintable');
  }
});

test('housing: every longhouse tier adds real structure', () => {
  const one = housing('longhouse', 1), two = housing('longhouse', 2), three = housing('longhouse', 3), top = housing('cottage', 3);
  assert.ok(one.length > top.length, `the first hall out-silhouettes the best cottage (${one.length} > ${top.length})`);
  assert.ok(two.length > one.length, `tier 2 adds veranda/dormer structure (${one.length} → ${two.length})`);
  assert.ok(three.length > two.length, `tier 3 adds the warden loft (${two.length} → ${three.length})`);
  assert.ok(one.some(f => f.color === '#5e8c9b'), 'the first hall flies its blue banner');
  assert.ok(three.some(f => f.color === '#d3b45d'), 'tier 3 earns gold civic trim');
  assert.ok(three.some(f => f.color === '#ffe6ab'), 'tier 3 warden loft has a lit window');
  for(const hall of [one,two,three])assert.ok(hall.every(f => f.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))), 'longhouse tiers stay paintable');
});

test('production: tier 4 adds a visible work structure to each core producer', () => {
  for(const type of ['farm','lumber','mine']){
    const three=housing(type,3),four=housing(type,4);
    assert.ok(four.length>three.length,`${type} tier 4 adds structure (${three.length} → ${four.length})`);
  }
});
