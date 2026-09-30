import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {barGeometry} from '../src/renderer.js';

test('bar frames surround track and fill, fractions clamp', () => {
  const g = barGeometry(100, 50, 0.5, 22);
  assert.deepEqual(g.frame, {x: 88, y: 49, w: 24, h: 5});
  assert.deepEqual(g.track, {x: 89, y: 50, w: 22, h: 3});
  assert.deepEqual(g.fill, {x: 89, y: 50, w: 11, h: 3});
  assert.equal(barGeometry(0, 0, 2, 10).fill.w, 10, 'overflow clamps full');
  assert.equal(barGeometry(0, 0, -1, 10).fill.w, 0, 'underflow clamps empty');
  assert.equal(barGeometry(0, 0, NaN, 10).fill.w, 0, 'NaN reads empty, never throws');
});

test('touch targets and mobile metrics survive the reskin', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const kingdom = await readFile(new URL('../src/kingdom.css', import.meta.url), 'utf8');
  const paint = styles + kingdom;
  assert.ok(paint.includes('min-height:44px'), '44px minimum touch target kept');
  assert.ok(paint.includes('safe-area-inset'), 'notch/safe-area handling kept');
  assert.ok(paint.includes('76dvh') || paint.includes('76dvh'.replace('dvh', 'vh')), 'drawer bottom-sheet kept');
  assert.ok(paint.includes('max-width:calc(100% - 24px)') || paint.includes('calc(100% - 24px)'), 'small-screen widths kept');
});
