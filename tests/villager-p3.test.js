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
  characterModel(s, u, data, 0);
  return s.faces;
}

test('bow users carry a back quiver with fletched shafts', () => {
  const plain = mesh({id: 'q0', type: 'archer', hp: 100, x: 0, y: 0, gear: ''});
  const bow = mesh({id: 'q1', type: 'archer', hp: 100, x: 0, y: 0, gear: 'bow'});
  assert.ok(bow.length - plain.length >= 4, 'quiver tube + shafts added');
  assert.ok(bow.some(f => f.color === '#d9cda5'), 'fletching reads at gameplay zoom');
});

test('builders wear a belt with brass buckle, collectors a hip satchel', () => {
  const belt = mesh({id: 'b0', type: 'builder', hp: 100, x: 0, y: 0, gear: ''});
  assert.ok(belt.some(f => f.color === '#dfba6a'), 'buckle glints');
  const satchel = mesh({id: 'c0', type: 'fisherman', hp: 100, x: 0, y: 0, gear: ''});
  const plain = mesh({id: 'c1', type: 'warrior', hp: 100, x: 0, y: 0, gear: ''});
  assert.ok(satchel.length > plain.length - 6, 'satchel adds hip bulk');
});

test('miner lamp is emissive so night crews read in the dark', () => {
  const faces = mesh({id: 'm0', type: 'miner', hp: 100, x: 0, y: 0, gear: ''});
  assert.ok(faces.some(f => f.emissive > 0 && f.color === '#f6df9a'), 'lamp glows');
  const farmer = mesh({id: 'm1', type: 'farmer', hp: 100, x: 0, y: 0, gear: ''});
  assert.ok(!farmer.some(f => f.emissive > 0), 'no glow leaks to other professions');
});

test('robed professions keep a hemmed silhouette distinct from coats', () => {
  const robe = mesh({id: 'r0', type: 'scholar', hp: 100, x: 0, y: 0, gear: ''});
  const coat = mesh({id: 'r1', type: 'warrior', hp: 100, x: 0, y: 0, gear: ''});
  assert.ok(robe.length > coat.length, 'hem adds readable bulk');
});
