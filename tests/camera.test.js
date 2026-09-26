import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld, makeBuilding} from '../src/model.js';
import {nextStep} from '../src/systems/pathfinding.js';
import {Renderer} from '../src/renderer.js';
const data = Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));

function fakeCanvas() {
  return {width: 1100, height: 740, getContext: ()=>new Proxy({}, {get: (t,k)=> (k==='canvas'?{}:()=>({}))})};
}

test('camera project/unproject round-trips on default map', ()=>{
  const r = new Renderer(fakeCanvas(), data, {});
  const p = r.project(9.5, 7.5);
  const cell = r.unproject(p.x, p.y);
  assert.equal(cell.x, 9);
  assert.equal(cell.y, 7);
});

test('camera pan/zoom keeps round-trip accurate', ()=>{
  const r = new Renderer(fakeCanvas(), data, {});
  r.pan(4, 3);
  r.zoomBy(1.5);
  const p = r.project(12.5, 10.5);
  const cell = r.unproject(p.x, p.y);
  assert.equal(cell.x, 12);
  assert.equal(cell.y, 10);
  r.zoomBy(0.2); // clamps at 0.5
  assert.ok(r.cam.zoom >= 0.5 && r.cam.zoom <= 2);
  r.resetCam();
  assert.equal(r.cam.zoom, 1);
});

test('hand-edited 40x30 world routes end to end (fixture only)', ()=>{
  const big = structuredClone(data);
  big.world = {...big.world, width: 40, height: 30};
  const w = createWorld(big);
  w.buildings = [];
  const step = nextStep(w, big, {x: 2.5, y: 2.5}, {x: 37.5, y: 27.5}, 1);
  assert.ok(step, 'open 40x30 map should route corner to corner');
  // A full wall across a 40-wide map with one gap still routes.
  for (let x=0;x<40;x++) if (x!==20) w.buildings.push(makeBuilding('wall', x, 15, big));
  const step2 = nextStep(w, big, {x: 2.5, y: 2.5}, {x: 37.5, y: 27.5}, 1);
  assert.ok(step2, 'wall with a gap should still route on 40x30');
});
