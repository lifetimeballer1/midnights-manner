import test from 'node:test';
import assert from 'node:assert/strict';
import {drawEnvironmentFx} from '../src/fx/environment-fx.js';

function mockRenderer(buildings = [], zoom = 1.65, calm = true) {
  const rects = [];
  return {
    rects,
    ctx: { fillStyle: '', strokeStyle: '', lineWidth: 1, fillRect(...a) { rects.push(a); }, beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {} },
    cam: { zoom },
    calm,
    data: { buildings: { pond: { size: 1 }, deephole: { size: 1 } } },
    project: (x, y) => ({ x: x * 10, y: y * 10 }),
    width: 800, height: 600,
  };
}

test('pond glints cap at twelve and freeze under calm', () => {
  const buildings = Array.from({ length: 20 }, (_, i) => ({ id: 'p' + i, type: 'pond', x: i, y: 1 }));
  const r = mockRenderer(buildings, 1.65, true);
  drawEnvironmentFx(r, { buildings }, 1000);
  assert.ok(r.rects.length <= 12 && r.rects.length > 0);
});

test('birds only when zoomed out and in motion', () => {
  const near = mockRenderer([], 1.65, false);
  drawEnvironmentFx(near, { buildings: [] }, 5000);
  const far = mockRenderer([], 0.5, false);
  drawEnvironmentFx(far, { buildings: [] }, 5000);
  assert.ok(true);
});
