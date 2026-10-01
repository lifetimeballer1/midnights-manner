import test from 'node:test';
import assert from 'node:assert/strict';
import {drawBuildingStates} from '../src/fx/building-fx.js';

function mockRenderer(buildings) {
  const calls = [];
  return {
    calls,
    ctx: {
      strokeStyle: '', lineWidth: 1, fillStyle: '', globalAlpha: 1,
      beginPath() { calls.push('begin'); },
      moveTo() {}, lineTo() {}, stroke() { calls.push('stroke'); },
      arc() {}, fill() { calls.push('fill'); }, fillRect() { calls.push('rect'); },
    },
    cam: { zoom: 1.65 },
    calm: true,
    data: { buildings: { hut: { size: 1, tiers: [{ hp: 100 }], buildSeconds: 8 } } },
    project: (x, y) => ({ x: x * 10, y: y * 10 }),
  };
}

test('cracks below two-thirds, embers below one-third, stakes while rising', () => {
  const world = { buildings: [
    { id: 'ok', type: 'hut', x: 1, y: 1, level: 1, hp: 100, remaining: 0 },
    { id: 'crack', type: 'hut', x: 3, y: 3, level: 1, hp: 50, remaining: 0 },
    { id: 'burn', type: 'hut', x: 5, y: 5, level: 1, hp: 20, remaining: 0 },
    { id: 'new', type: 'hut', x: 7, y: 7, level: 1, hp: 100, remaining: 8 },
  ]};
  const r = mockRenderer();
  drawBuildingStates(r, world, 1000);
  assert.ok(r.calls.includes('stroke'), 'cracks drawn');
  assert.ok(r.calls.includes('fill'), 'embers drawn');
  assert.ok(r.calls.includes('rect'), 'stakes drawn');
});
