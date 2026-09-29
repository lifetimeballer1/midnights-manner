import test from 'node:test';
import assert from 'node:assert/strict';
import { MapInput } from '../src/input.js';
// Stormglass Phase D: forgiving tap threshold + smooth wheel zoom. Feel only.
function input(placing = null) {
  const handlers = {}, calls = { pan: 0, zoom: 0, hint: 0, select: 0, factors: [] };
  const c = { addEventListener: (name, fn) => handlers[name] = fn, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const r = { placing, cell: e => ({ x: Math.floor(e.clientX / 10), y: Math.floor(e.clientY / 10) }), panPixels: () => calls.pan++, zoomAt: f => { calls.zoom++; calls.factors.push(f); }, pick: () => null };
  const ui = { blocked: () => false, placementHint: () => calls.hint++, selectCell: () => calls.select++ };
  new MapInput(c, r, ui);
  const send = (type, id, x, y) => handlers[type]({ pointerId: id, clientX: x, clientY: y, pointerType: 'touch' });
  const wheel = dy => handlers.wheel({ deltaY: dy, deltaMode: 0, clientX: 50, clientY: 50, preventDefault() {} });
  return { calls, send, wheel };
}
test('shaky taps within 10px still select; real drags still pan', () => {
  const t9 = input(); t9.send('pointerdown', 1, 20, 20); t9.send('pointermove', 1, 29, 20); t9.send('pointerup', 1, 29, 20);
  assert.equal(t9.calls.select, 1); assert.equal(t9.calls.pan, 0);
  const t12 = input(); t12.send('pointerdown', 1, 20, 20); t12.send('pointermove', 1, 32, 20); t12.send('pointerup', 1, 32, 20);
  assert.equal(t12.calls.select, 0); assert.equal(t12.calls.pan, 1);
});
test('wheel zoom is delta-proportional and anchored, never jumpy', () => {
  const w = input(); w.wheel(100); w.wheel(-100); w.wheel(10);
  assert.equal(w.calls.zoom, 3);
  const [out, inn, small] = w.calls.factors;
  assert.ok(out < 1 && out >= .85); assert.ok(inn > 1 && inn <= 1.2);
  assert.ok(Math.abs(small - 1) < Math.abs(out - 1), 'trackpad ticks ease instead of jumping');
});
