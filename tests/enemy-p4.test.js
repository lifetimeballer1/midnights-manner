import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';

const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const r = new Renderer({getContext: () => ({})}, data, {});
r.cam.x = 0; r.cam.y = 0; r.cam.yaw = Math.PI / 4; r.calm = true; r.cam.zoom = 2;
function mesh(u) {
  const s = new MeshScene(r);
  s.characterDetail = true;
  characterModel(s, u, data, 0, true);
  return s.faces;
}
const FACTIONS = ['thornband', 'pale-host', 'cinder-clan', 'ember-legion', 'pale-court'];
const ROLES = ['archer', 'breaker', 'scout', 'raider'];

test('every faction x role renders valid selectable enemy geometry', () => {
  for (const faction of FACTIONS) for (const role of ROLES) {
    const u = {id: faction + '-' + role, hp: 50, x: 0, y: 0, role, faction};
    const before = JSON.stringify(u);
    const faces = mesh(u);
    assert.ok(faces.length > 0 && faces.length < 200, faction + '/' + role + ' bounded');
    assert.ok(faces.every(f => f.owner?.kind === 'enemy'), 'selectable as enemy');
    assert.equal(JSON.stringify(u), before, 'art never mutates units');
  }
});

test('pale factions read skeletal: bone face, pits, ribs', () => {
  for (const [faction, bone] of [['pale-host', '#d6cfb8'], ['pale-court', '#e8e2d2']]) {
    const faces = mesh({id: 'p', hp: 50, x: 0, y: 0, role: 'raider', faction});
    assert.ok(faces.some(f => f.color === bone), faction + ' bone present');
    assert.ok(faces.some(f => f.color === '#14181c'), faction + ' eye pits present');
  }
  const thorn = mesh({id: 't', hp: 50, x: 0, y: 0, role: 'raider', faction: 'thornband'});
  assert.ok(!thorn.some(f => f.color === '#d6cfb8'), 'no bone leaks to thornband');
});

test('thornband hoods, cinder guards and ember crests mark their factions', () => {
  assert.ok(mesh({id: 't', hp: 50, x: 0, y: 0, role: 'raider', faction: 'thornband'}).some(f => f.color === '#5d7348'), 'moss hood');
  assert.ok(mesh({id: 'c', hp: 50, x: 0, y: 0, role: 'breaker', faction: 'cinder-clan'}).some(f => f.color === '#c76b43'), 'rust guards');
  assert.ok(mesh({id: 'e', hp: 50, x: 0, y: 0, role: 'raider', faction: 'ember-legion'}).some(f => f.color === '#c2502f'), 'red crest');
});

test('faction silhouettes stay distinct at gameplay zoom', () => {
  r.cam.zoom = 1.65;
  const shapes = new Set();
  for (const faction of FACTIONS) {
    const s = new MeshScene(r);
    characterModel(s, {id: faction, hp: 50, x: 0, y: 0, role: 'raider', faction}, data, 0, true);
    shapes.add(JSON.stringify(s.faces.map(f => f.color).sort()));
  }
  r.cam.zoom = 2;
  assert.ok(shapes.size >= 4, 'factions differ by palette, not just trim');
});
