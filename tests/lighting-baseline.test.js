// Presentation pass — deliberate baseline updates per phase.
// Phase 1 froze construction-time baked colors. Phase 2 moved shading into
// paint() and drove it from the sky clock. Phase 3 sweeps the key light
// (sun/moon arcs) and lets weather touch the meshes. The guarantees now are:
//  - raw digests pin geometry and albedo, independent of light,
//  - the frozen-light test proves paint-time shading still reproduces the
//    legacy formula byte-for-byte (the Phase 1 digests' exact guarantee),
//  - day/night/dawn digests pin the current look so later phases diff it
//    deliberately, in one reviewed commit.
// Face digests are canonical (per-face entries sorted) on purpose: paint()
// reorders faces by depth, so hashing construction order would flake.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {MeshScene,buildingModel} from '../src/scene3d.js';
import {DAY_LENGTH,skyLightAt} from '../src/systems/daynight.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const context = new Proxy({}, {get: (t, k) => t[k] || (() => k === 'measureText' ? {width: 40} : k.includes('Gradient') ? {addColorStop() {}} : undefined), set: (t, k, v) => (t[k] = v, true)});
function renderer() {
  const r = new Renderer({getContext: () => context}, data, {});
  r.resize(1280, 900, 1);
  r.cam.x = 9; r.cam.y = 9; r.cam.zoom = 1.8;
  return r;
}
function mesh(r, type, level, yaw) {
  r.cam.yaw = yaw;
  const s = new MeshScene(r);
  const b = {id: type, type, x: 5, y: 5, level, hp: 100, remaining: 0};
  buildingModel(s, b, data.buildings[type], {buildings: [b]});
  return s;
}
// The frozen Phase 1 formula — any drift here fails the test by construction.
const legacyShade = (hex, n) => {
  const value = parseInt(hex.slice(1), 16), light = .72 + .26 * Math.max(0, (-n[0] * .4 - n[1] * .5 + n[2]) / 1.187) + .12 * Math.max(0, n[2]);
  return '#' + [value >> 16, (value >> 8) & 255, value & 255].map(v => Math.min(255, Math.round(v * light)).toString(16).padStart(2, '0')).join('');
};
// The Phase 2 day light, frozen as a synthetic descriptor (Phase 3's arcs
// move the real sun, so the formula contract gets its own constant light).
const LEGACY_LIGHT = {keyDir: [-0.4, -0.5, 1], keyNorm: 1.187, keyRGB: [1, 1, 1], keyI: 0.26, ambRGB: [1, 1, 1], ambI: 0.72, sky: 0.12, emissive: 0, dim: 1, fog: 0, key: 'legacy'};
const entry = (hex, f) => JSON.stringify([hex, ...f.points.flatMap(p => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100])]);
const digest = (faces, field) => createHash('sha256').update(faces.map(f => entry(f[field], f)).sort().join('|')).digest('hex').slice(0, 16);
const PI = Math.PI;
// Day 1 (seed 7) is a clear sky; these times are whole phase points of it.
const canon = fraction => skyLightAt(DAY_LENGTH * (1 + fraction), null);
const dayLight = canon(0.3), nightLight = canon(0.8), dawnLight = canon(0.01);
// Frozen from main after the Phase 3 implementation (Windows V8; coordinates
// rounded to 2dp so cross-platform float noise can never flake the pins).
const CASES = [
  ['hall-1', 'hall', 1, 195, 'f2e96c729f43a75b', 'e379961ae19263e6', '413c40bf1a7e577d', '98076b6f6caf95e0'],
  ['hall-2', 'hall', 2, 255, 'b3c8e3eb68ee98d7', '6ede7136f8c2dd9e', '6370985d4e91bfa3', '2438a3fe414d470b'],
  ['hall-3', 'hall', 3, 263, '2aa94608b1269dee', 'adb160dbfe070e56', 'c99983d13300ed2e', '6216fd8b16916c24'],
  ['cottage-3', 'cottage', 3, 207, '4238134ae11499b0', '79bcf24e30d5ae24', '83cde4f1c64aedb6', '6fcd1f220093befe'],
  ['wall-3', 'wall', 3, 36, '7fcf762d1357358b', 'eab79823456bed6a', 'eab79823456bed6a', '87437f5a9d62e86d'],
  ['tower-3', 'tower', 3, 54, '58af5e84fee769b5', 'f8ed97103fac8643', 'f8ed97103fac8643', 'a8f4676a630fac3d'],
  ['sawmill-2', 'sawmill', 2, 132, 'ba8c21aace31c17a', 'e998dd16132d397e', 'cefe74adc687af84', '6a407cd843e194a3'],
  ['mill-2', 'mill', 2, 236, '92705efbc770ca5f', 'f6ad68c40637b2a9', '896acc04d8f4c594', 'aacf976b276b60dd'],
];
const ORBIT = {faces: 712, day: 'dca3d3715011238e', night: 'eb934b27903eda04', dawn: '1e3d416ae5b4a12d'};

test('baseline: canonical meshes keep their raw geometry and albedo', () => {
  const r = renderer();
  for (const [name, type, level, faces, raw] of CASES) {
    const s = mesh(r, type, level, PI / 4);
    assert.equal(s.faces.length, faces, `${name} face count moved`);
    assert.equal(digest(s.faces, 'color'), raw, `${name} geometry or albedo moved`);
  }
});

test('baseline: the frozen legacy light still bakes the Phase 1 shading', () => {
  const r = renderer();
  for (const [name, type, level, , , legacy] of CASES) {
    const s = mesh(r, type, level, PI / 4);
    const expected = s.faces.map(f => entry(legacyShade(f.color, f.normal), f)).sort().join('|');
    s.light = LEGACY_LIGHT; s.paint();
    assert.equal(s.faces.map(f => entry(f.painted, f)).sort().join('|'), expected, `${name} shading formula drifted`);
    assert.equal(digest(s.faces, 'painted'), legacy, `${name} legacy digest moved`);
  }
});

test('baseline: the sky keeps its exact painted look at day and midnight', () => {
  const r = renderer();
  for (const [name, type, level, , , , day, night] of CASES) {
    const s = mesh(r, type, level, PI / 4);
    s.light = dayLight; s.paint();
    assert.equal(digest(s.faces, 'painted'), day, `${name} day look moved`);
    s.light = nightLight; s.paint();
    assert.equal(digest(s.faces, 'painted'), night, `${name} night look moved`);
  }
  const orbit = t => {
    const faces = [];
    for (const yaw of [0, PI / 2, PI, 3 * PI / 2]) { const s = mesh(r, 'hall', 3, yaw); s.light = skyLightAt(t, null); s.paint(); faces.push(...s.faces); }
    return faces;
  };
  assert.equal(orbit(DAY_LENGTH * 1.8).length, ORBIT.faces, 'orbited hall face count moved');
  assert.equal(digest(orbit(DAY_LENGTH * 1.3), 'painted'), ORBIT.day, 'orbited hall day look moved');
  assert.equal(digest(orbit(DAY_LENGTH * 1.8), 'painted'), ORBIT.night, 'orbited hall night look moved');
  assert.equal(digest(orbit(DAY_LENGTH * 1.01), 'painted'), ORBIT.dawn, 'orbited hall dawn look moved');
});

test('baseline: shading stays directional, dims at night, keeps lit windows', () => {
  const r = renderer();
  const lum = hex => parseInt(hex.slice(1), 16) >> 16;
  const box = light => { const s = new MeshScene(r); s.box(0, 0, 0, 1, 1, 1, '#808080'); s.light = light; s.paint(); return s.faces.map(f => f.painted); };
  const day = box(dayLight), night = box(nightLight);
  assert.ok(Math.max(...day.map(lum)) > Math.min(...day.map(lum)), 'the sun still lights one side brighter');
  assert.ok(Math.min(...day.map(lum)) >= 85 && Math.max(...day.map(lum)) <= 136, 'day ambient floor and key ceiling hold');
  assert.ok(Math.max(...night.map(lum)) < Math.min(...day.map(lum)), 'midnight is darker than any daylight face');
  // Windows are emissive: at midnight they keep more of their albedo than the
  // same geometry without the flag, and the boost vanishes at noon.
  const windowFace = light => { const s = new MeshScene(r); s.emissive = 1; s.box(0, 0, 0, 1, 1, 1, '#ffe6ab'); s.light = light; s.paint(); return s.faces[0].painted; };
  const plainFace = light => { const s = new MeshScene(r); s.box(0, 0, 0, 1, 1, 1, '#ffe6ab'); s.light = light; s.paint(); return s.faces[0].painted; };
  assert.ok(lum(windowFace(nightLight)) > lum(plainFace(nightLight)), 'lit windows outshine walls at midnight');
  assert.equal(windowFace(dayLight), plainFace(dayLight), 'no noon glow above the daylight shading');
});

test('baseline: the sky clock never rebuilds the static mesh cache', () => {
  const r = renderer(), g = new Game(data);
  r.calm = true;
  r.draw(g.world, 1000);
  const cached = r._meshStatic, key = r.staticCacheKey(g.world);
  g.world.elapsed = 390; r.draw(g.world, 1016);
  assert.equal(r._meshStatic, cached, 'noon keeps the cached geometry');
  assert.equal(r.staticCacheKey(g.world), key, 'clock time is not a cache key');
  g.world.elapsed = 540; r.draw(g.world, 1032);
  assert.equal(r._meshStatic, cached, 'midnight keeps the cached geometry');
});
