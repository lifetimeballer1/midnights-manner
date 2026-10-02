import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel, bakedSetId, bakedPoseFor} from '../src/character-art.js';

const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
data['art-manifest'] = JSON.parse(await readFile(new URL('../data/art-manifest.json', import.meta.url)));
const credits = await readFile(new URL('../docs/ASSET_CREDITS.md', import.meta.url), 'utf8');
const bakedFiles = (await readdir(new URL('../assets/meshes/baked/', import.meta.url))).filter(f => f.endsWith('.json'));
const meshes = Object.fromEntries(await Promise.all(bakedFiles.map(async f => [f.replace(/\.json$/, ''), JSON.parse(await readFile(new URL('../assets/meshes/baked/' + f, import.meta.url)))])));
const r = new Renderer({getContext: () => ({})}, data, {});
r.cam.x = 0; r.cam.y = 0; r.cam.yaw = Math.PI / 4; r.calm = true;
r.meshes = meshes;
function mesh(u, zoom = 1.65, enemy = false) {
  r.cam.zoom = zoom;
  const s = new MeshScene(r);
  s.characterDetail = true;
  characterModel(s, u, data, 0, enemy);
  return s.faces;
}

test('role groups map every troop and faction to a baked set', () => {
  for (const type of Object.keys(data.troops)) assert.ok(bakedSetId({type}, data.troops[type], false), type + ' mapped');
  for (const f of ['pale-host', 'pale-court', 'thornband', 'cinder-clan', 'ember-legion']) assert.ok(bakedSetId({faction: f}, null, true), f + ' mapped');
  assert.equal(bakedSetId({faction: 'nope'}, null, true), null);
});

test('baked bodies draw real rig geometry and stay selectable', () => {
  const faces = mesh({id: 'w', type: 'warrior', hp: 100, x: 0, y: 0, gear: 'sword'}, 2);
  assert.ok(faces.length > 100 && faces.length < 800, `rig mesh, not boxes (${faces.length})`);
  assert.ok(faces.every(f => f.owner?.id === 'w'), 'selectable');
  const skel = mesh({id: 's', hp: 50, x: 0, y: 0, role: 'raider', faction: 'pale-host'}, 2, true);
  assert.ok(skel.length > 100, 'skeleton rig draws');
});

test('pose follows state and LOD shrinks with zoom', () => {
  const still = mesh({id: 'a', type: 'archer', hp: 100, x: 0, y: 0, gear: 'bow'});
  const attacking = mesh({id: 'a', type: 'archer', hp: 100, x: 0, y: 0, gear: 'bow', attackTimer: .1});
  assert.notDeepEqual(
    still.map(f => f.color).sort().join(),
    attacking.map(f => f.color).sort().join(),
    'attack pose differs from stand'
  );
  assert.deepEqual(bakedPoseFor({attackTimer: .1}, {moving: true, swing: 1}, 2).pose, 'attack');
  assert.deepEqual(bakedPoseFor({}, {moving: true, swing: -1}, 2).pose, 'walk-b');
  assert.deepEqual(bakedPoseFor({}, null, 2).pose, 'stand');
  assert.deepEqual(bakedPoseFor({}, null, 2).lod, 'hi');
  assert.deepEqual(bakedPoseFor({}, null, 1).lod, 'lo');
  assert.equal(bakedPoseFor({}, null, .5), null);
  const near = mesh({id: 'b', type: 'warrior', hp: 100, x: 0, y: 0, gear: ''}, 2).length;
  const mid = mesh({id: 'b', type: 'warrior', hp: 100, x: 0, y: 0, gear: ''}, 1).length;
  assert.ok(mid < near, `lo LOD cheaper (${mid} < ${near})`);
});

test('missing or disabled meshes fall back to procedural bodies', () => {
  const bare = new Renderer({getContext: () => ({})}, data, {});
  bare.cam.x = 0; bare.cam.y = 0; bare.cam.yaw = Math.PI / 4; bare.calm = true; bare.cam.zoom = 1.65;
  bare.meshes = {};
  const s = new MeshScene(bare);
  characterModel(s, {id: 'f', type: 'warrior', hp: 100, x: 0, y: 0, gear: 'sword'}, data, 0);
  assert.ok(s.faces.length > 0 && s.faces.length < 160, 'procedural fallback draws');
  const before = JSON.stringify({t: data.troops.warrior.name});
  mesh({id: 'g', type: 'warrior', hp: 100, x: 0, y: 0, gear: ''});
  assert.equal(JSON.stringify({t: data.troops.warrior.name}), before, 'no data mutation');
});

test('provenance exists and the baked library fits its weight budget', async () => {
  for (const id of ['warrior', 'ranger', 'rogue', 'wizard', 'cleric', 'monk', 'skeleton', 'human-thornband', 'human-cinder', 'human-ember']) {
    const entry = data['art-manifest'].meshes[id] ?? data['art-manifest'].baked[id];
    assert.equal(entry?.enabled, true, id + ' enabled');
    assert.ok(/CC0/.test(entry?.license || ''), id + ' licensed');
  }
  assert.ok(/Quaternius/i.test(credits), 'credits row present');
  let total = 0;
  for (const f of bakedFiles) total += (await stat(new URL('../assets/meshes/baked/' + f, import.meta.url))).size;
  assert.ok(total < 2.5 * 1024 * 1024, `baked weight ${(total / 1048576).toFixed(2)}MB < 2.5MB`);
});
