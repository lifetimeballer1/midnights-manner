import test from 'node:test';
import assert from 'node:assert/strict';
import {onVisual, emitVisual, VISUAL_EVENTS} from '../src/fx/bus.js';
import {qualityPreset, lodBand, attachQuality} from '../src/fx/quality.js';

test('visual bus carries the seven spec events only', () => {
  assert.deepEqual([...VISUAL_EVENTS].sort(), ['build-progress', 'deliver', 'hit', 'kill', 'level-up', 'tower-fire', 'trap'].sort());
  let got = null;
  const off = onVisual('deliver', (p) => { got = p; });
  emitVisual('deliver', { x: 1 });
  assert.deepEqual(got, { x: 1 });
  off();
  emitVisual('nope', {});
});

test('quality presets degrade but never auto-upgrade', () => {
  const r = {};
  attachQuality(r);
  assert.equal(r.quality, 'High');
  assert.equal(lodBand(0.3), 'far');
  assert.equal(lodBand(1), 'mid');
  assert.equal(lodBand(2), 'near');
  assert.ok(qualityPreset('Low').lightCap < qualityPreset('High').lightCap);
  r.autoDegrade(30, 1000);
  assert.equal(r.quality, 'High');
  r.autoDegrade(30, 5000);
  assert.equal(r.quality, 'Med');
  r.autoDegrade(5, 9000);
  assert.equal(r.quality, 'Med');
});
