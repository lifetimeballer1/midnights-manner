import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene, buildingModel} from '../src/scene3d.js';
import {addConvertedAccents} from '../src/asset-art.js';

const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
data['art-manifest'] = JSON.parse(await readFile(new URL('../data/art-manifest.json', import.meta.url)));
async function meshDoc(id) {
  return JSON.parse(await readFile(new URL('../assets/meshes/' + id + '.json', import.meta.url)));
}
const IDS = ['dummy', 'weapon-stand', 'book-stand', 'crate', 'barrel', 'crate-apple', 'crate-carrot', 'workbench', 'pennant', 'log-stack', 'fence'];
const meshes = Object.fromEntries(await Promise.all(IDS.map(async id => [id, await meshDoc(id)])));
function renderer() {
  const r = new Renderer({getContext: () => ({})}, data, {});
  r.cam.x = 6; r.cam.y = 6; r.cam.zoom = 1.65; r.cam.yaw = Math.PI / 4;
  r.meshes = meshes;
  return r;
}
function model(r, type, ext = {}) {
  const s = new MeshScene(r);
  const b = {id: type, type, x: 5, y: 5, level: 3, hp: 100, remaining: 0, ...ext};
  buildingModel(s, b, data.buildings[type], {buildings: [b]});
  return s.faces;
}

test('targeted workplaces gain converted accents and stay selectable', () => {
  for (const type of ['barracks', 'schoolroom', 'storehouse', 'market', 'farm', 'forge', 'longhouse', 'pasture']) {
    const faces = model(renderer(), type);
    assert.ok(faces.length > 0, type + ' draws');
    assert.ok(faces.every(f => f.owner?.id === type), type + ' selectable');
  }
  const bare = renderer();
  bare.meshes = {};
  const b = {id: 'barracks', type: 'barracks', x: 5, y: 5, level: 3, hp: 100, remaining: 0};
  const plainScene = new MeshScene(bare);
  buildingModel(plainScene, b, data.buildings.barracks, {buildings: [b]});
  assert.ok(model(renderer(), 'barracks').length > plainScene.faces.length, 'accents add geometry over the original look');
});

test('pinned baseline buildings are untouched by accents', () => {
  const r = renderer();
  for (const type of ['hall', 'cottage', 'tower', 'wall', 'gate', 'mill', 'sawmill']) {
    const s = new MeshScene(r);
    const b = {id: type, type, x: 5, y: 5, level: 3, hp: 100, remaining: 0};
    assert.equal(addConvertedAccents(s, b, data.buildings[type]), 0, type + ' keeps its frozen digest');
  }
});

test('ruins, scaffolds and missing meshes render the original look', () => {
  const r = renderer();
  const s = new MeshScene(r);
  const ruin = {id: 'barracks', type: 'barracks', x: 5, y: 5, level: 3, hp: 0, remaining: 0};
  assert.equal(addConvertedAccents(s, ruin, data.buildings.barracks), 0, 'ruins gain nothing');
  const scaffold = {id: 'barracks', type: 'barracks', x: 5, y: 5, level: 3, hp: 100, remaining: 5};
  assert.equal(addConvertedAccents(s, scaffold, data.buildings.barracks), 0, 'scaffolds gain nothing');
  const bare = new MeshScene(renderer());
  bare.r.meshes = {};
  assert.equal(addConvertedAccents(bare, {id: 'forge', type: 'forge', x: 5, y: 5, level: 3, hp: 100, remaining: 0}, data.buildings.forge), 0, 'missing meshes fall back silently');
});
