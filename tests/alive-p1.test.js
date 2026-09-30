import test from 'node:test';
import assert from 'node:assert/strict';
import {sfx, audioStats, resetAudioPools} from '../src/systems/audio.js';
import {zoomBand, zoomFade, pickEmitters, bandGain} from '../src/systems/soundstage.js';

test('zoom bands follow the spec thresholds', () => {
  assert.equal(zoomBand(0.5), 'far');
  assert.equal(zoomBand(1.04), 'far');
  assert.equal(zoomBand(1.05), 'village');
  assert.equal(zoomBand(1.29), 'village');
  assert.equal(zoomBand(1.3), 'near');
  assert.equal(zoomBand(1.64), 'near');
  assert.equal(zoomBand(1.65), 'close');
  assert.equal(zoomBand(2.19), 'close');
  assert.equal(zoomBand(2.2), 'intimate');
  assert.equal(zoomBand(3.6), 'intimate');
});

test('zoom fades are silent below, full above, smooth between', () => {
  assert.equal(zoomFade(1.0, 1.3, 1.65), 0);
  assert.equal(zoomFade(2.0, 1.3, 1.65), 1);
  const mid = zoomFade(1.475, 1.3, 1.65);
  assert.ok(mid > 0.4 && mid < 0.6, `mid fade ${mid} near 0.5`);
  assert.ok(zoomFade(1.4, 1.3, 1.65) < zoomFade(1.55, 1.3, 1.65), 'monotonic');
});

test('emitter pick is nearest-first, capped, ranged and attenuated', () => {
  const items = [
    {id: 'far', x: 100, y: 100},
    {id: 'a', x: 1, y: 0},
    {id: 'b', x: 0, y: 3},
    {id: 'c', x: 0, y: 5},
    {id: 'd', x: 0, y: 7},
  ];
  const picked = pickEmitters(items, 0, 0, 2, 12);
  assert.deepEqual(picked.map(p => p.item.id), ['a', 'b']);
  assert.ok(picked[0].vol > picked[1].vol, 'nearer is louder');
  assert.ok(picked[0].vol > 0.9 && picked[0].vol <= 1, 'point-blank near full');
  const edge = pickEmitters([{id: 'e', x: 12, y: 0}], 0, 0, 5, 12);
  assert.equal(edge[0].vol, 0);
  assert.deepEqual(pickEmitters(items, 0, 0, 5, 2), [{item: items[1], dist: 1, vol: 0.5}]);
});

test('cooldown pools are independent across sound classes', () => {
  resetAudioPools();
  const base = audioStats().pools;
  sfx.footstep();
  sfx.footstep();
  const pools = audioStats().pools;
  assert.ok(pools.step > base.step, 'step pool consumed');
  assert.equal(pools.work, base.work, 'work pool untouched by footsteps');
  sfx.workHammer();
  const after = audioStats().pools;
  assert.ok(after.work > base.work, 'work pool consumed independently');
  assert.equal(after.bow, base.bow, 'bow pool untouched by hammer');
  assert.equal(after.melee, base.melee, 'melee pool untouched by hammer');
  sfx.arrow();
  sfx.blade();
  const combat = audioStats().pools;
  assert.ok(combat.bow > base.bow && combat.melee > base.melee, 'bow and melee track separately');
});

test('band gains keep zoomed-out detail quiet but raids audible', () => {
  assert.equal(bandGain('far', 'footstep'), 0);
  assert.equal(bandGain('far', 'work'), 0);
  assert.ok(bandGain('far', 'combat') > 0, 'raid warning carries when zoomed out');
  assert.equal(bandGain('intimate', 'footstep'), 1);
  assert.ok(bandGain('village', 'work') < bandGain('near', 'work'), 'work swells on approach');
  assert.equal(bandGain('close', 'unknown-kind'), 0);
});
