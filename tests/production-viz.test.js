// Presentation pass, Phase 6 — the on-site haul on the building itself.
// Stockpiles grow in four steps with the tap reserve (harvest.capacity), a
// gold pennant flies when the haul crosses reserveNotifyAt, and the static
// mesh cache keys on those steps — a tick-by-tick reserve must never rebuild
// the village every frame. The 2D bubble/badge stays the tap affordance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
import {MeshScene,buildingModel,productionStage} from '../src/scene3d.js';
import {reserveCapacity,reserveNotifyAt} from '../src/resources.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests','art-manifest'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const resourceLumber=JSON.parse(await readFile(new URL('../assets/meshes/catalog/resource-lumber.json',import.meta.url)));
const context = new Proxy({}, {get: (t, k) => t[k] || (() => k === 'measureText' ? {width: 40} : k.includes('Gradient') ? {addColorStop() {}} : undefined), set: (t, k, v) => (t[k] = v, true)});
function renderer(meshes={}) {
  const r = new Renderer({getContext: () => context}, data, {});
  r.resize(1280, 900, 1);
  r.cam.x = 9; r.cam.y = 9; r.cam.zoom = 1.8; r.cam.yaw = Math.PI / 4;
  r.meshes=meshes;
  return r;
}
function farmAt(r, held, extra = {}) {
  const spec = data.buildings.farm;
  const s = new MeshScene(r);
  const b = {id: 'farm', type: 'farm', x: 5, y: 5, level: 1, hp: 100, remaining: 0, harvestBonus: held, ...extra};
  buildingModel(s, b, spec, {buildings: [b]});
  return s.faces;
}
function sawmillAt(r,held){
  const spec=data.buildings.sawmill,s=new MeshScene(r),b={id:'sawmill',type:'sawmill',x:5,y:5,level:1,hp:100,remaining:0,outputReserve:{lumber:held}};
  buildingModel(s,b,spec,{buildings:[b]});return s.faces;
}

test('production: the stockpile grows with the reserve, in four steps', () => {
  const r = renderer(), spec = data.buildings.farm, cap = reserveCapacity(spec, 1);
  const empty = farmAt(r, 0), low = farmAt(r, cap * 0.3), mid = farmAt(r, cap * 0.55), full = farmAt(r, cap * 0.9);
  assert.ok(empty.length < low.length, `stage 1 stacks something (${empty.length} → ${low.length})`);
  assert.ok(low.length < mid.length && mid.length < full.length, 'every step adds to the pile');
  assert.ok(low.length - empty.length >= 5, 'a stage-1 pile is real geometry, not trim');
  assert.equal(productionStage({hp: 100, remaining: 0, level: 1, harvestBonus: 0}, spec), 0);
  assert.equal(productionStage({hp: 100, remaining: 3, level: 1, harvestBonus: 999}, spec), -1, 'scaffolds hold no stock');
  assert.equal(productionStage({hp: 0, remaining: 0, level: 1, harvestBonus: 999}, spec), -1, 'ruins hold no stock');
  assert.equal(productionStage({hp: 100, remaining: 0, level: 1, harvestBonus: 999}, data.buildings.hall), -1, 'non-producers never pile');
});

test('production: local Mixar lumber pile scales by output stage and keeps its fallback',()=>{
 const id='catalog-resource-lumber',manifest=data['art-manifest'].meshes[id],enabled=renderer({[id]:resourceLumber}),native=renderer({});
 let previous=sawmillAt(enabled,0).length;
 for(const held of [24,48,72]){
  const local=sawmillAt(enabled,held),fallback=sawmillAt(native,held);
  assert.notDeepEqual(local,fallback,'the enabled source pile replaces the procedural timber stack');
  assert.ok(local.length>previous,'more on-site output grows the visible pile');
  previous=local.length;
 }
 const disabledData=structuredClone(data);disabledData['art-manifest'].meshes[id].enabled=false;
 const disabled=new Renderer({getContext:()=>context},disabledData,{});disabled.resize(1280,900,1);disabled.cam.x=9;disabled.cam.y=9;disabled.cam.zoom=1.8;disabled.cam.yaw=Math.PI/4;disabled.meshes={[id]:resourceLumber};
 assert.deepEqual(sawmillAt(disabled,48),sawmillAt(native,48),'disabled source keeps procedural timber stack');
 assert.deepEqual(sawmillAt(renderer({[id]:{faces:[]}}),48),sawmillAt(native,48),'empty source keeps procedural timber stack');
 assert.equal(manifest?.releaseStatus,'approved-public');
 assert.equal(manifest?.rightsEvidence,'game-assets-mixar');
});

test('production: the gold pennant flies only when the haul is ready', () => {
  const r = renderer(), spec = data.buildings.farm, ready = reserveNotifyAt(spec, 1);
  const below = farmAt(r, ready - 10), at = farmAt(r, ready + 10);
  assert.ok(!below.some(f => f.color === '#f2c96e'), 'no pennant under the badge threshold');
  assert.ok(at.some(f => f.color === '#f2c96e'), 'pennant at the badge threshold');
});

test('production: offscreen sawmills cannot consume the visible source-pile budget',()=>{
 const r=renderer({'catalog-resource-lumber':resourceLumber});r.resize(390,844,1);r.cam.zoom=1.65;
 const s=new MeshScene(r),spec=data.buildings.sawmill;
 const make=(id,x,y)=>({id,type:'sawmill',x,y,level:1,hp:100,remaining:0,outputReserve:{lumber:72}});
 const buildings=[make('hidden-a',-100,-100),make('hidden-b',-110,-110),make('visible',9,9)],world={buildings};
 for(const b of buildings.slice(0,2))buildingModel(s,b,spec,world);
 assert.equal(s.externalPropFaces||0,0,'hidden piles do not spend the phone face budget');
 buildingModel(s,buildings[2],spec,world);
 assert.equal(s.externalPropFaces,390,'the visible three-stage source pile still fits');
});

test('production: the static cache repaints at steps, never per reserve unit', () => {
  const r = renderer(), g = new Game(data);
  const farm = g.world.buildings.find(b => b.type === 'farm');
  r.calm = true;
  const draw = () => { r.draw(g.world, 1000); return r._meshStatic; };
  farm.harvestBonus = 0;
  const m0 = draw();
  farm.harvestBonus = 126; // floor(.252 × 4) = 1 — first step
  const m1 = draw();
  assert.notEqual(m1, m0, 'a step repaints');
  farm.harvestBonus = 127;
  assert.equal(draw(), m1, 'a tick inside the same step reuses the cached geometry');
  farm.harvestBonus = 150; // ready flips at notifyAt
  assert.notEqual(draw(), m1, 'the ready flip repaints');
  farm.harvestBonus = 250; // stage 2
  const m2 = draw();
  assert.notEqual(m2, m1, 'the next step repaints');
  farm.harvestBonus = 260;
  assert.equal(draw(), m2, 'and holds again');
  farm.hp = 0;
  assert.notEqual(draw(), m2, 'ruins still repaint');
});
