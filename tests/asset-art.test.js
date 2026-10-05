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
  assert.deepEqual(enabled, ['barrel', 'book-stand', 'bush', 'catalog-resource-lumber', 'catalog-resource-stone', 'catalog-tree-a-medium', 'catalog-tree-a-small', 'catalog-tree-single-a', 'chimney', 'crate', 'crate-apple', 'crate-carrot', 'dummy', 'fence', 'flower-purple', 'flower-red', 'flower-yellow', 'lantern-wall', 'lily-large', 'lily-small', 'log', 'log-stack', 'overhang', 'pennant', 'rock-small-a', 'rock-small-d', 'roof-gable', 'roof-window', 'shutters', 'stairs-stone', 'stone-small', 'torch-metal', 'town-lantern', 'weapon-stand', 'wood-door', 'workbench']);
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

test('drawMesh scales flat geometry around its tile anchor when requested',()=>{
  r.cam.zoom=1.65;r.cam.yaw=Math.PI/4;
  const base=new MeshScene(r),scaled=new MeshScene(r);
  drawMesh(base,tree,2,3);
  drawMesh(scaled,tree,2,3,{scale:2});
  assert.ok(base.faces.length&&scaled.faces.length);
  const a=base.faces[0].vertices[0],b=scaled.faces[0].vertices[0];
  assert.equal(b[0],2+(a[0]-2)*2);
  assert.equal(b[1],3+(a[1]-3)*2);
  assert.equal(b[2],a[2]*2);
});

test('malformed and empty flat meshes reject before any partial drawing',()=>{
 for(const mesh of [{faces:[]},{faces:[{c:'#ffffff',v:[null,null,null]}]},{faces:[{c:'#ffffff',v:[[0,0,0],[0,0,0],[0,0,0]]}]}]){
  const s=new MeshScene(r);assert.equal(drawMesh(s,mesh,0,0),0);assert.equal(s.faces.length,0);
 }
});

test('samples sit on the ground at tile scale', () => {
  for (const mesh of [anvil, tree]) {
    const b = meshBounds(mesh);
    assert.ok(b.z0 >= -0.01, 'grounded');
    assert.ok(b.z1 - b.z0 <= 1.7 && b.x1 - b.x0 <= 2, 'tile-scale footprint');
  }
});

test('every manifest mesh is valid, grounded, budgeted and has explicit rights status', async () => {
  const manifest = data['art-manifest'];
  let total = 0;
  for (const [id, entry] of Object.entries(manifest.meshes)) {
    assert.equal(typeof entry.enabled, 'boolean', id + ' has an explicit flag');
    if(entry.rightsEvidence)assert.equal(entry.rightsEvidence,'game-assets-mixar',id+' has ownership evidence');
    else if(entry.releaseStatus==='local-only')assert.equal(entry.license,'UNVERIFIED',id+' remains local-only');
    else assert.equal(entry.license, 'CC0', id + ' license pinned');
    assert.ok(entry.source && entry.creator && entry.file, id + ' provenance');
    const mesh = JSON.parse(await readFile(new URL('../' + entry.file, import.meta.url)));
    assert.ok(mesh.faces.length > 0 && mesh.faces.length <= (!entry.enabled?3000:entry.domain==='environment'?320:300), id + ' bounded');
    if(entry.enabled)total += mesh.faces.length;
    const b = meshBounds(mesh);
    assert.ok(b.z0 >= -0.01 && b.z1 - b.z0 <= 1.7, id + ' grounded/tile-scale');
    for (const yaw of [0, Math.PI]) {
      const {faces} = draw(mesh, 1.65, yaw);
      assert.ok(faces.every(f => /^#[0-9a-f]{6}$/i.test(f.color) && f.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))), id + ' projects cleanly');
    }
  }
  assert.ok(total < 6000, `library total ${total} faces fits budget`);
});
