import test from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, snapZoom, ZOOM_LADDER, project, screenToWorld, panPixels, zoomAt } from '../src/camera.js';
const geom = (cam = { x: 10, y: 8, zoom: 1 }) => ({ tw: 43, th: 22, ox: 510, oy: 97, cx: 550, cy: 320, cam: { ...cam } });
test('zoom clamps to the 32px-honest ceiling and snaps to the ladder', () => {
  assert.equal(clampZoom(99), 3);
  assert.equal(clampZoom(0.01), 0.55);
  for (const rung of ZOOM_LADDER) assert.equal(snapZoom(rung), rung);
  assert.equal(snapZoom(1.3), 1.25);
  assert.equal(snapZoom(3.6), 3);
});
test('project/screenToWorld round-trip at every ladder rung', () => {
  for (const zoom of ZOOM_LADDER) {
    const g = geom({ x: 10, y: 8, zoom });
    const p = project(g, 12.5, 9.5);
    const w = screenToWorld(g, p.x, p.y);
    assert.ok(Math.abs(w.x - 12.5) < 1e-9 && Math.abs(w.y - 9.5) < 1e-9, `rung ${zoom}`);
  }
});
test('panPixels inverts project (drag tracks the finger)', () => {
  const g = geom({ x: 10, y: 8, zoom: 1.5 });
  const before = screenToWorld(g, 400, 300);
  panPixels(g, { w: 20, h: 16 }, 43, 22);
  const after = screenToWorld(g, 400 + 43, 300 + 22);
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 1e-9);
});
test('zoomAt keeps the focal world point fixed', () => {
  const g = geom({ x: 10, y: 8, zoom: 1 });
  const before = screenToWorld(g, 300, 250);
  zoomAt(g, { w: 40, h: 30 }, 2, 300, 250);
  const after = screenToWorld(g, 300, 250);
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 1e-9);
  assert.ok(g.cam.zoom > 1);
});
