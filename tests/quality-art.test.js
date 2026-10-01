import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../src/renderer.js';
import {qualityPreset, attachQuality} from '../src/fx/quality.js';

const data = {world: {width: 20, height: 16}, buildings: {}, troops: {}, items: {}};
function renderer() {
  const r = new Renderer({getContext: () => ({})}, data, {});
  attachQuality(r);
  return r;
}

test('quality presets order Low/Med/High detail up', () => {
  const low = qualityPreset('Low'), med = qualityPreset('Med'), high = qualityPreset('High');
  assert.deepEqual([low.dprCap, med.dprCap, high.dprCap], [1, 1.5, 2]);
  assert.deepEqual([low.maxEffects, med.maxEffects, high.maxEffects], [20, 40, 60]);
  assert.ok(low.ambientCap < med.ambientCap && med.ambientCap < high.ambientCap);
  assert.equal(qualityPreset('nope').dprCap, 2);
});

test('resize honors the quality pixel-density cap', () => {
  const r = renderer();
  r.setQuality('Low'); r.resize(800, 600, 2);
  assert.equal(r.dpr, 1);
  r.setQuality('High'); r.resize(800, 600, 2);
  assert.equal(r.dpr, 2);
});

test('effect bursts honor the quality cap', () => {
  const r = renderer();
  r.setQuality('Low');
  const world = {effects: []};
  for (let i = 0; i < 40; i++) r.burst(world, 0, 0, 0, 0, 'hit', .1);
  assert.equal(world.effects.length, 20);
  r.setQuality('High');
  const world2 = {effects: []};
  for (let i = 0; i < 80; i++) r.burst(world2, 0, 0, 0, 0, 'hit', .1);
  assert.equal(world2.effects.length, 60);
});

test('switching quality drops cached layers so new limits apply', () => {
  const r = renderer();
  r.staticLayer = {}; r.staticKey = 'x'; r._meshStatic = {faces: []}; r._pendingStaticKey = 'y';
  r.setQuality('Med');
  assert.equal(r.staticLayer, null);
  assert.equal(r.staticKey, '');
  assert.equal(r._meshStatic, null);
  assert.equal(r._pendingStaticKey, null);
});

test('frame report carries draw cost and quality', () => {
  const r = renderer();
  r.recordFrame(0); r.recordFrame(16); r.recordFrame(32);
  r.recordRender(4); r.recordRender(6);
  const report = r.frameReport();
  assert.equal(report.n, 2);
  assert.equal(report.renderAvg, 5);
  assert.equal(report.quality, 'High');
  assert.ok(Number.isFinite(report.renderP95));
});

test('sustained hot draw cost degrades quality even when frames look fine', () => {
  const r = renderer();
  assert.equal(r.quality, 'High');
  assert.equal(r.autoDegrade(10, 1000, 50), 'High');
  assert.equal(r.autoDegrade(10, 4001, 50), 'Med');
});
