// Presentation pass, Phase 2 — skyLightAt(): the mesh-light resolver.
// One pure object per moment: key light (dir/color/intensity), ambient, sky
// fill and the emissive boost, crossfaded out of the previous phase. The
// overlay descriptor the renderer always used rides along, so screen tint and
// mesh light come from a single clock read. Save files never see any of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DAY_LENGTH, skyLightAt, lightingFor, clockConfig} from '../src/systems/daynight.js';
const world = JSON.parse(await readFile(new URL('../data/world.json', import.meta.url)));
const DAY = DAY_LENGTH * 0.3, NIGHT = DAY_LENGTH * 0.8, DAWN = DAY_LENGTH * 0.02, DUSK = DAY_LENGTH * 0.54;

test('lighting: day defaults are the legacy constants, every phase stays sane', () => {
  const day = skyLightAt(DAY, null);
  assert.deepEqual(day.keyDir, [-0.4, -0.5, 1]);
  assert.equal(day.keyNorm, 1.187);
  assert.deepEqual(day.keyRGB, [1, 1, 1]);
  assert.equal(day.keyI, 0.26);
  assert.deepEqual(day.ambRGB, [1, 1, 1]);
  assert.equal(day.ambI, 0.72);
  assert.equal(day.sky, 0.12);
  assert.equal(day.emissive, 0);
  for (const elapsed of [DAWN, DAY, DUSK, NIGHT]) {
    const l = skyLightAt(elapsed, {world});
    assert.ok(l.keyDir.length === 3 && l.keyDir.every(Number.isFinite), 'key dir is three finite numbers');
    assert.ok(l.keyNorm > 0 && Number.isFinite(l.keyNorm), 'norm stays positive');
    assert.ok(l.keyI >= 0 && l.keyI <= 1.5 && l.ambI >= 0 && l.ambI <= 1.5, 'intensities stay clamped');
    assert.ok(l.sky >= 0 && l.sky <= 0.5 && l.emissive >= 0 && l.emissive <= 2, 'fill and glow stay bounded');
    assert.ok(l.keyRGB.every(c => c >= 0 && c <= 1) && l.ambRGB.every(c => c >= 0 && c <= 1), 'colors are unit fractions');
    assert.equal(typeof l.key, 'string');
    assert.ok(l.overlay, 'overlay rides along');
  }
});

test('lighting: resolving is pure, bucketed, and unknown clocks read as noon', () => {
  assert.deepEqual(skyLightAt(NIGHT, null), skyLightAt(NIGHT, null), 'same moment, same light');
  assert.equal(skyLightAt(NIGHT, null).key, skyLightAt(NIGHT, null).key);
  assert.notEqual(skyLightAt(NIGHT, null).key, skyLightAt(DAY, null).key, 'different phases bucket apart');
  assert.match(skyLightAt(NIGHT, null).key, /^night:\d+$/, 'bucket id names its phase');
  const broken = skyLightAt(NaN, null);
  assert.equal(broken.phase.id, 'day', 'a broken clock opens on a bright field');
  assert.equal(broken.ambI, 0.72);
});

test('lighting: phases crossfade and calm players get a plain step', () => {
  const blendStart = DAY_LENGTH * 0.081; // just inside the day span
  const easing = skyLightAt(blendStart, null);
  const calm = skyLightAt(blendStart, null, {calm: true});
  assert.ok(easing.ambI > 0.6 && easing.ambI < 0.72, 'day light eases out of dawn');
  assert.ok(easing.keyI >= 0.24 && easing.keyI <= 0.26);
  assert.equal(calm.ambI, 0.72, 'calm steps straight to the phase light');
  assert.equal(calm.keyI, 0.26);
  const midDay = skyLightAt(DAY, null);
  assert.equal(midDay.ambI, 0.72, 'past the blend window the phase light holds');
  const lateDusk = skyLightAt(DAY_LENGTH * 0.575, null), earlyNight = skyLightAt(DAY_LENGTH * 0.582, null);
  assert.notEqual(lateDusk.phase.id, earlyNight.phase.id, 'dusk hands over to night');
  assert.ok(earlyNight.ambI < lateDusk.ambI, 'night enters darker');
});

test('lighting: data overrides merge, clamp, and fall back on bad values', () => {
  const data = {world: {daynight: {lighting: {night: {
    key: {intensity: 9, color: '#b9c9ff', dir: ['a', 0, 0]},
    ambient: {intensity: 0.5, color: 'not-a-color'},
    sky: 99, emissive: 99,
  }}}}};
  const l = skyLightAt(NIGHT, data);
  assert.equal(l.keyI, 1.5, 'runaway intensity clamps');
  assert.equal(l.ambI, 0.5, 'override intensity wins');
  assert.deepEqual(l.keyDir, [0.45, -0.3, 0.85], 'bad dir falls back to the base');
  assert.deepEqual(l.keyRGB, [0xb9 / 255, 0xc9 / 255, 0xff / 255], 'override color parses');
  assert.deepEqual(l.ambRGB, [0x4a / 255, 0x5f / 255, 0x8e / 255], 'bad color falls back to the base');
  assert.equal(l.sky, 0.5, 'sky clamps at its ceiling');
  assert.equal(l.emissive, 2, 'glow clamps at its ceiling');
  assert.deepEqual(skyLightAt(NIGHT, {world}).overlay, lightingFor('night', {world}), 'overlay is the same object contract');
  assert.equal(clockConfig({world: {daynight: {lightBlend: 0.1}}}).lightBlend, 0.1, 'blend window is data-tunable');
});
