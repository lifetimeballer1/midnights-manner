// Presentation pass, Phase 2 — deliberate baseline update.
// Phase 1 froze construction-time baked colors; Phase 2 moved shading into
// paint() and drives it from the sky clock. The guarantees now are:
//  - raw digests pin geometry and albedo, independent of light,
//  - the day test proves paint-time day light reproduces the legacy formula
//    byte-for-byte, against a frozen copy of that formula (the old digests'
//    exact guarantee, order-independent because paint() depth-sorts),
//  - night/dawn digests pin the new midnight look so later phases diff it.
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
const entry = (hex, f) => JSON.stringify([hex, ...f.points.flatMap(p => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100])]);
const digest = (faces, field) => createHash('sha256').update(faces.map(f => entry(f[field], f)).sort().join('|')).digest('hex').slice(0, 16);
const PI = Math.PI;
const dayLight = skyLightAt(DAY_LENGTH * 0.3, null);
const nightLight = skyLightAt(DAY_LENGTH * 0.8, null);
const dawnLight = skyLightAt(DAY_LENGTH * 0.07, null);
// Frozen from main after the Phase 2 implementation (Windows V8; coordinates
// rounded to 2dp so cross-platform float noise can never flake the pins).
const CASES = [
  ['hall-1', 'hall', 1, 195, 'f2e96c729f43a75b', 'e379961ae19263e6', 'a24fb0b7a6154616'],
  ['hall-2', 'hall', 2, 255, 'b3c8e3eb68ee98d7', '6ede7136f8c2dd9e', '0277949333d77944'],
  ['hall-3', 'hall', 3, 263, '2aa94608b1269dee', 'adb160dbfe070e56', '82b8bcf94b720289'],
  ['cottage-3', 'cottage', 3, 207, '4238134ae11499b0', '79bcf24e30d5ae24', '5b51234a003ee917'],
  ['wall-3', 'wall', 3, 36, '7fcf762d1357358b', 'eab79823456bed6a', '4be2b34f90467243'],
  ['tower-3', 'tower', 3, 54, '58af5e84fee769b5', 'f8ed97103fac8643', 'e444fef06d5539cb'],
  ['sawmill-2', 'sawmill', 2, 132, 'ba8c21aace31c17a', 'e998dd16132d397e', 'a751a40d0b5996ac'],
  ['mill-2', 'mill', 2, 236, '92705efbc770ca5f', 'f6ad68c40637b2a9', '54f077903e3c45f1'],
];
const ORBIT = {faces: 712, night: '36dcd4bd48131fd2', dawn: '067154ae7e51e126'};

test('baseline: canonical meshes keep their raw geometry and albedo', () => {
  const r = renderer();
  for (const [name, type, level, faces, raw] of CASES) {
    const s = mesh(r, type, level, PI / 4);
    assert.equal(s.faces.length, faces, `${name} face count moved`);
    assert.equal(digest(s.faces, 'color'), raw, `${name} geometry or albedo moved`);
  }
});

test('baseline: paint-time day is byte-identical to the legacy baked shading', () => {
  const r = renderer();
  for (const [name, type, level, , , day] of CASES) {
    const s = mesh(r, type, level, PI / 4);
    const legacy = s.faces.map(f => entry(legacyShade(f.color, f.normal), f)).sort().join('|');
    s.light = dayLight; s.paint();
    assert.equal(s.faces.map(f => entry(f.painted, f)).sort().join('|'), legacy, `${name} day shading drifted from the legacy formula`);
    assert.equal(digest(s.faces, 'painted'), day, `${name} day digest moved`);
  }
});

test('baseline: midnight and dawn keep their exact painted look', () => {
  const r = renderer();
  for (const [name, type, level, , , , night] of CASES) {
    const s = mesh(r, type, level, PI / 4);
    s.light = nightLight; s.paint();
    assert.equal(digest(s.faces, 'painted'), night, `${name} night look moved`);
  }
  const orbit = yaw => { const s = mesh(r, 'hall', 3, yaw); return s; };
  const nightFaces = [], dawnFaces = [];
  for (const yaw of [0, PI / 2, PI, 3 * PI / 2]) {
    nightFaces.push(...[orbit(yaw)].map(s => { s.light = nightLight; s.paint(); return s.faces; }).flat());
    dawnFaces.push(...[orbit(yaw)].map(s => { s.light = dawnLight; s.paint(); return s.faces; }).flat());
  }
  assert.equal(nightFaces.length, ORBIT.faces, 'orbited hall face count moved');
  assert.equal(digest(nightFaces, 'painted'), ORBIT.night, 'orbited hall night look moved');
  assert.equal(digest(dawnFaces, 'painted'), ORBIT.dawn, 'orbited hall dawn look moved');
});

test('baseline: shading stays directional, dims at night, keeps lit windows', () => {
  const r = renderer();
  const lum = hex => parseInt(hex.slice(1), 16) >> 16;
  const box = light => { const s = new MeshScene(r); s.box(0, 0, 0, 1, 1, 1, '#808080'); s.light = light; s.paint(); return s.faces.map(f => f.painted); };
  const day = box(dayLight), night = box(nightLight);
  assert.ok(Math.max(...day.map(lum)) > Math.min(...day.map(lum)), 'the sun still lights one side brighter');
  assert.ok(Math.min(...day.map(lum)) >= 90 && Math.max(...day.map(lum)) <= 136, 'day ambient floor and key ceiling hold');
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
  g.world.elapsed = 90; r.draw(g.world, 1016);
  assert.equal(r._meshStatic, cached, 'noon keeps the cached geometry');
  assert.equal(r.staticCacheKey(g.world), key, 'clock time is not a cache key');
  g.world.elapsed = 240; r.draw(g.world, 1032);
  assert.equal(r._meshStatic, cached, 'midnight keeps the cached geometry');
});
