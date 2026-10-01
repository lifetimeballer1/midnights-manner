import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {MeshScene} from '../src/scene3d.js';
import {artEnabled, drawMesh, lodFaceCount, meshBounds} from '../src/asset-art.js';

const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'buildings'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
data['art-manifest'] = JSON.parse(await readFile(new URL('../data/art-manifest.json', import.meta.url)));
const anvil = JSON.parse(await readFile(new URL('../assets/meshes/anvil.json', import.meta.url)));
const tree = JSON.parse(await readFile(new URL('../assets/meshes/tree-simple.json', import.meta.url)));

const r = new Renderer({getContext: () => ({})}, data, {});
r.cam.x = 0; r.cam.y = 0; r.cam.zoom = 1.65; r.cam.yaw = Math.PI / 4;

function draw(mesh, zoom, yaw) {
  r.cam.zoom = zoom; r.cam.yaw = yaw;
  const s = new MeshScene(r);
  const n = drawMesh(s, mesh, 0, 0, {owner: {kind: 'prop', id: 'sample'}});
  return {n, faces: s.faces};
}

test('manifest enables only gated meshes (safe removal = flip the flag)', () => {
  const enabled = Object.entries(data['art-manifest'].meshes).filter(([, e]) => e.enabled).map(([id]) => id).sort();
  assert.deepEqual(enabled, ['bush', 'flower-purple', 'flower-red', 'flower-yellow', 'lily-large', 'lily-small', 'log', 'rock-small-a', 'rock-small-d', 'stone-small']);
});

test('converted samples are valid selectable geometry through a full orbit', () => {
  for (const [name, mesh] of [['anvil', anvil], ['tree', tree]]) {
    assert.ok(mesh.faces.length > 0 && mesh.faces.length <= 300, name + ' bounded');
    for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const {n, faces} = draw(mesh, 1.65, yaw);
      assert.equal(n, mesh.faces.length);
      assert.ok(faces.length > 0 && faces.length <= mesh.faces.length);
      assert.ok(faces.every(f => f.owner?.id === 'sample' && /^#[0-9a-f]{6}$/i.test(f.color)));
    }
  }
});

test('far zoom decimates while keeping a silhouette', () => {
  const near = draw(anvil, 1.65, Math.PI / 4).faces.length;
  const far = draw(anvil, 0.6, Math.PI / 4).faces.length;
  assert.ok(far < near && far > 0, `far ${far} < near ${near}`);
  assert.equal(lodFaceCount(300, 0.6), 12);
  assert.equal(lodFaceCount(300, 2), 300);
});

test('samples sit on the ground at tile scale', () => {
  for (const mesh of [anvil, tree]) {
    const b = meshBounds(mesh);
    assert.ok(b.z0 >= -0.01, 'grounded');
    assert.ok(b.z1 - b.z0 <= 1.7 && b.x1 - b.x0 <= 2, 'tile-scale footprint');
  }
});

test('every manifest mesh is valid, grounded, budgeted and stays disabled', async () => {
  const manifest = data['art-manifest'];
  let total = 0;
  for (const [id, entry] of Object.entries(manifest.meshes)) {
    assert.equal(typeof entry.enabled, 'boolean', id + ' has an explicit flag');
    assert.equal(entry.license, 'CC0', id + ' license pinned');
    assert.ok(entry.source && entry.creator && entry.file, id + ' provenance');
    const mesh = JSON.parse(await readFile(new URL('../' + entry.file, import.meta.url)));
    assert.ok(mesh.faces.length > 0 && mesh.faces.length <= 300, id + ' bounded');
    total += mesh.faces.length;
    const b = meshBounds(mesh);
    assert.ok(b.z0 >= -0.01 && b.z1 - b.z0 <= 1.7, id + ' grounded/tile-scale');
    for (const yaw of [0, Math.PI]) {
      const {faces} = draw(mesh, 1.65, yaw);
      assert.ok(faces.every(f => /^#[0-9a-f]{6}$/i.test(f.color) && f.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))), id + ' projects cleanly');
    }
  }
  assert.ok(total < 6000, `library total ${total} faces fits budget`);
});
