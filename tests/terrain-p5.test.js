import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {drawProp, convertedId, addEnvironmentScenery} from '../src/environment-art.js';
import {addWindLife} from '../src/wind-art.js';

const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings', 'biomes'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
data['art-manifest'] = JSON.parse(await readFile(new URL('../data/art-manifest.json', import.meta.url)));
async function meshDoc(id) {
  return JSON.parse(await readFile(new URL('../assets/meshes/' + id + '.json', import.meta.url)));
}
function renderer(meshes) {
  const r = new Renderer({getContext: () => ({})}, data, {});
  r.cam.x = 0; r.cam.y = 0; r.cam.zoom = 1.65; r.cam.yaw = Math.PI / 4;
  r.meshes = meshes;
  return r;
}
function draw(r, kind, x = 3, y = 4, biome = 'plains') {
  r.cam.x = x; r.cam.y = y;
  const s = new MeshScene(r);
  drawProp(s, {x, y, kind, biome}, 0, false, 1.65);
  return s.faces;
}

test('biomes deal flowers on plains and lilies on water', () => {
  assert.ok(data.biomes.plains.scenery.props.includes('flowers'));
  assert.ok(data.biomes.water.scenery.props.includes('lilies'));
});

test('converted meshes render through drawProp when enabled and preloaded', async () => {
  const r = renderer({bush: await meshDoc('bush'), 'flower-red': await meshDoc('flower-red')});
  let converted = 0;
  for (let x = 0; x < 8; x++) {
    r.cam.x = x; r.cam.y = 5;
    const s = new MeshScene(r);
    drawProp(s, {x, y: 5, kind: 'shrub', biome: 'plains'}, 0, false, 1.65);
    if (convertedId(s, {x, y: 5, kind: 'shrub'})) { converted = s.faces.length; break; }
  }
  assert.ok(converted > 12, 'converted bush replaces the 2-pyramid procedural');
  const floral = draw(r, 'flowers', 4, 5);
  assert.ok(floral.length > 0, 'flowers draw from the converted set');
});

test('missing or disabled meshes fall back to procedural geometry', async () => {
  const r = renderer({});
  for (const kind of ['shrub', 'log', 'rock', 'stone', 'flowers', 'lilies']) {
    assert.equal(convertedId({r}, {x: 1, y: 2, kind}), null, kind + ' has no mesh -> null');
    assert.ok(draw(r, kind).length > 0, kind + ' procedural fallback draws');
  }
});

test('live scenery stays bounded and restores scene ownership', () => {
  const r = renderer({});
  const tiles = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) tiles.push({x, y, biome: 'plains', claimed: true, landmark: null});
  const s = new MeshScene(r);
  const before = s.owner;
  const drawn = addEnvironmentScenery(s, {tiles, buildings: [], biomeSeed: 7}, data);
  assert.ok(drawn > 0 && drawn <= 130, `bounded: ${drawn}`);
  assert.equal(s.owner, before, 'ownership restored');
});

test('new flower and lily kinds sway with the shared wind', () => {
  const r = renderer({});
  r.cam.zoom = 1.8; r.cam.x = 2; r.cam.y = 2;
  r._livingScenery = [{x: 2, y: 2, kind: 'flowers'}, {x: 3, y: 2, kind: 'lilies'}];
  const s = new MeshScene(r);
  addWindLife(s, {weather: 'clear', buildings: []}, 1000);
  assert.ok(s.faces.length >= 2, 'both new kinds breathe');
});
