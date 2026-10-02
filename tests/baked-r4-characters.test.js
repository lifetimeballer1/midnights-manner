import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {characterModel} from '../src/character-art.js';

const root = new URL('../', import.meta.url);
const files = (await readdir(new URL('assets/meshes/baked/', root))).filter(f => f.endsWith('.json'));
const meshes = Object.fromEntries(await Promise.all(files.map(async f => [f.slice(0, -5), JSON.parse(await readFile(new URL('assets/meshes/baked/' + f, root)))])));
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings', 'art-manifest'].map(async n => [n, JSON.parse(await readFile(new URL(`data/${n}.json`, root)))])));

test('r4 flat colors meet the cloth floor without arbitrary dark-face exemptions', () => {
  for (const [id, mesh] of Object.entries(meshes)) for (const face of mesh.faces) {
    const rgb = [1, 3, 5].map(i => parseInt(face.c.slice(i, i + 2), 16));
    assert.ok(rgb.every((v, i) => v >= [58, 63, 69][i]) || face.eyePit === true, `${id} ${face.c} below floor`);
  }
});

test('r4 preserves ten sets, four distinct grounded poses, and bounded LODs and weight', async () => {
  assert.equal(files.length, 80);
  let total = 0;
  for (const [id, entry] of Object.entries(data['art-manifest'].baked)) {
    assert.equal(entry.phase, 'R4');
    const signatures = new Set();
    for (const pose of ['stand', 'walk-a', 'walk-b', 'attack']) for (const lod of ['hi', 'lo']) {
      const mesh = meshes[`${id}-${pose}-${lod}`];
      assert.ok(mesh.faces.length > (lod === 'hi' ? 350 : 130));
      assert.ok(mesh.faces.length <= (lod === 'hi' ? 450 : 180));
      assert.ok(mesh.faces.flatMap(f => f.v).every(v => v.length === 3 && v.every(Number.isFinite)));
      assert.ok(Math.abs(Math.min(...mesh.faces.flatMap(f => f.v.map(v => v[2])))) < .001);
      if (lod === 'hi') signatures.add(JSON.stringify(mesh.faces));
    }
    assert.equal(signatures.size, 4, id + ' distinct poses');
  }
  for (const f of files) total += (await stat(new URL('assets/meshes/baked/' + f, root))).size;
  assert.ok(total < 4 * 1024 * 1024, `${total} bytes`);
});

test('r4 hand and head anchors sit inside baked anatomy and faces stay welded', () => {
  for (const [id, mesh] of Object.entries(meshes)) {
    const points = mesh.faces.flatMap(f => f.v);
    for (const name of ['hand', 'head']) {
      const anchor = mesh.meta.anchors?.[name];
      assert.ok(Array.isArray(anchor) && anchor.length === 3, `${id} ${name} anchor`);
      assert.ok(Math.min(...points.map(p => Math.hypot(...p.map((v, i) => v - anchor[i])))) < .12, `${id} ${name} attached`);
    }
    const unique = new Set(points.map(p => p.join(',')));
    assert.ok(unique.size < points.length * .65, id + ' shared welded vertices');
    for (const face of mesh.faces) {
      assert.equal(new Set(face.v.map(p => p.join(','))).size, 3, id + ' no collapsed triangles');
    }
  }
});

test('r4 retains verified staged-source hashes and CC0 provenance', async () => {
  for (const entry of Object.values(data['art-manifest'].baked)) {
    assert.equal(entry.creator, 'Kay Lousberg');
    const source = await readFile(new URL(entry.sourceGlb, root));
    assert.equal(createHash('sha256').update(source).digest('hex'), entry.sourceSHA256);
    assert.match(await readFile(new URL(entry.licenseFile, root), 'utf8'), /Creative Commons Zero, CC0/);
  }
});

function render(type, gear, time = 0, options = {}) {
  const r = new Renderer({getContext: () => ({})}, options.data || data, {});
  r.cam.x = 0; r.cam.y = 0; r.cam.zoom = 1.65; r.cam.yaw = Math.PI / 4;
  r.calm = true; r.meshes = options.meshes || meshes;
  const s = new MeshScene(r), raw = [], face = s.face;
  s.face = (v, c, split) => {raw.push({v, c, emissive: s.emissive}); return face.call(s, v, c, split);};
  characterModel(s, {id: 'r4', type, gear, hp: 100, x: 0, y: 0, attackTimer: .1}, options.data || data, time);
  return {raw, faces: s.faces};
}

test('r4 held shaft reaches the baked hand, miner lamp emits, and Calm freezes', () => {
  const anchor = meshes['warrior-attack-lo'].meta.anchors?.hand;
  assert.ok(anchor, 'baked hand available');
  const armed = render('warrior', 'sword'), bare = render('warrior', '');
  const equipment = armed.raw.slice(bare.raw.length);
  assert.ok(equipment.flatMap(f => f.v).some(p => Math.hypot(...p.map((v, i) => v - anchor[i])) < .06), 'sword grip is in the baked palm');
  assert.ok(render('miner', 'pickaxe').raw.some(f => f.c === '#f6df9a' && f.emissive >= .7), 'baked miner lamp');
  assert.deepEqual(render('miner', 'pickaxe', 100).faces, render('miner', 'pickaxe', 3000).faces);
});

test('r4 baked professions retain data-colored accents and distinct work headwear', () => {
  for (const type of Object.keys(data.troops)) {
    assert.ok(render(type, '').raw.some(f => f.c === data.troops[type].color), type + ' profession color');
  }
  const shape = type => JSON.stringify(render(type, '').raw.map(f => f.v));
  assert.notEqual(shape('farmer'), shape('builder'), 'straw brim versus work cap');
  assert.notEqual(shape('builder'), shape('haggler'), 'builder apron versus merchant cap');
});

test('r4 disabled, missing and empty pose meshes silently use procedural fallback', () => {
  const disabled = structuredClone(data);
  disabled['art-manifest'].baked.warrior.enabled = false;
  const missing = render('warrior', 'sword', 0, {meshes: {}}).faces;
  assert.deepEqual(render('warrior', 'sword', 0, {data: disabled}).faces, missing);
  assert.deepEqual(render('warrior', 'sword', 0, {meshes: {'warrior-attack-lo': {faces: []}}}).faces, missing);
  assert.ok(missing.length > 0 && missing.length < 160);
});
