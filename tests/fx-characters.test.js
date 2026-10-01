import test from 'node:test';
import assert from 'node:assert/strict';
import {drawLevelFlair, drawHitFlash} from '../src/fx/level-flair.js';

function mockScene() {
  const boxes = [];
  return {
    boxes,
    emissive: 0,
    r: { flash: new Map(), cam: { zoom: 1.65 }, ctx: { globalAlpha: 1, fillStyle: '', fillRect() { boxes.push('flash'); } }, project: (x, y) => ({ x, y }) },
    box() { boxes.push('box'); },
    pyramid() { boxes.push('pyr'); },
  };
}

test('flair ladder adds geometry at 5/10/15/20/25', () => {
  const counts = {};
  for (const lvl of [1, 5, 10, 15, 20, 25]) {
    const s = mockScene();
    drawLevelFlair(s, { level: lvl }, 0, 0, 0, true);
    counts[lvl] = s.boxes.length;
  }
  assert.equal(counts[1], 0);
  assert.ok(counts[5] > 0 && counts[10] > counts[5] && counts[15] > counts[10] && counts[20] > counts[15] && counts[25] > counts[20]);
});

test('hit flash draws only inside the window', () => {
  const s = mockScene();
  drawHitFlash(s, { id: 'a' }, 0, 0, false, 1000);
  assert.equal(s.boxes.length, 0);
  s.r.flash.set('ua', 1100);
  drawHitFlash(s, { id: 'a' }, 0, 0, false, 1000);
  assert.ok(s.boxes.includes('flash'));
});
