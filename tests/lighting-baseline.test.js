// Presentation pass, Phase 1 — look baseline characterization.
// Freezes today's fixed-light face shading (scene3d.js shade()) plus the
// renderer invariant that the sky clock never invalidates the static mesh
// cache. Phase 2 replaces the fixed light with a day/night model: it MUST
// update the digests below deliberately, in one reviewed commit, and keep
// every structural invariant green. If a digest changes without that note,
// something in the mesh geometry or shading moved by accident.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const context = new Proxy({}, {get: (t, k) => t[k] || (() => k === 'measureText' ? {width: 40} : k.includes('Gradient') ? {addColorStop() {}} : undefined), set: (t, k, v) => (t[k] = v, true)});
function renderer() {
  const r = new Renderer({getContext: () => context}, data, {});
  r.resize(1280, 900, 1);
  r.cam.x = 9; r.cam.y = 9; r.cam.zoom = 1.8;
  return r;
}
function facesFor(r, type, level, yaw) {
  r.cam.yaw = yaw;
  const s = new MeshScene(r);
  const b = {id: type, type, x: 5, y: 5, level, hp: 100, remaining: 0};
  buildingModel(s, b, data.buildings[type], {buildings: [b]});
  return s.faces;
}
const digest = faces => createHash('sha256').update(JSON.stringify(faces.map(f => [f.color, ...f.points.flatMap(p => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100])]))).digest('hex').slice(0, 16);
const PI = Math.PI;
// Frozen from main @ Phase 1 (Windows V8; coordinates rounded to 2dp so
// cross-platform float noise can never flake the pin).
const CASES = [
  ['hall-1', 'hall', 1, 195, '638f52c03d0076f8'],
  ['hall-2', 'hall', 2, 255, 'e3e5a1e12690385a'],
  ['hall-3', 'hall', 3, 263, 'df26e31173db3339'],
  ['cottage-3', 'cottage', 3, 207, '94cebc488361fbbc'],
  ['wall-3', 'wall', 3, 36, 'd69d16e32eccf151'],
  ['tower-3', 'tower', 3, 54, '2751b0bbbd3d7c21'],
  ['sawmill-2', 'sawmill', 2, 132, 'cacbce04042f2ff9'],
  ['mill-2', 'mill', 2, 236, '7494d1f27d2603f4'],
];
const ORBIT = ['hall-3-orbit', 712, '83837d3b1b1d65a3'];

test('baseline: canonical meshes keep their exact shaded faces', () => {
  const r = renderer();
  for (const [name, type, level, faces, hash] of CASES) {
    const built = facesFor(r, type, level, PI / 4);
    assert.equal(built.length, faces, `${name} face count moved`);
    assert.equal(digest(built), hash, `${name} shading moved`);
  }
  const orbit = [0, PI / 2, PI, 3 * PI / 2].flatMap(y => facesFor(r, 'hall', 3, y));
  assert.equal(orbit.length, ORBIT[1], 'orbited hall face count moved');
  assert.equal(digest(orbit), ORBIT[2], 'orbited hall shading moved');
});

test('baseline: shading stays deterministic, legal and directional', () => {
  const a = renderer(), b = renderer();
  const one = facesFor(a, 'hall', 1, PI / 4), two = facesFor(b, 'hall', 1, PI / 4);
  assert.deepEqual(one.map(f => f.color), two.map(f => f.color), 'same mesh, same colors');
  for (const f of one) assert.match(f.color, /^#[0-9a-f]{6}$/, 'every face paints a real hex color');
  // One bare box: the lit top face is brightest, walls share one shade, the
  // ambient floor never lets any face fall below ~70% of its albedo.
  const s = new MeshScene(a);
  s.box(0, 0, 0, 1, 1, 1, '#808080');
  const lum = hex => parseInt(hex.slice(1), 16) >> 16;
  const top = Math.max(...s.faces.map(f => lum(f.color)));
  const floor = Math.min(...s.faces.map(f => lum(f.color)));
  assert.ok(top > floor, 'the fixed sun still lights one side brighter');
  assert.ok(floor >= 90, `ambient floor holds (got ${floor})`);
  assert.ok(top <= 136, `key light never blows out the albedo (got ${top})`);
});

test('baseline: the sky clock never rebuilds the static mesh cache', () => {
  const r = renderer(), g = new Game(data);
  r.calm = true;
  r.draw(g.world, 1000);
  const cached = r._meshStatic, key = r.staticCacheKey(g.world);
  g.world.elapsed = 90; r.draw(g.world, 1016);
  assert.equal(r._meshStatic, cached, 'noon keeps the cached geometry');
  assert.equal(r.staticCacheKey(g.world), key, 'clock time is not a cache key');
  g.world.elapsed = 240; r.draw(g.world, 1032);
  assert.equal(r._meshStatic, cached, 'midnight keeps the cached geometry');
});
