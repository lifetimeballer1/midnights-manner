// Presentation pass, Phases 2–3 — skyLightAt(): the mesh-light resolver.
// One pure object per moment: key light (dir/color/intensity), ambient, sky
// fill, emissive boost and the weather response (fog + dim), crossfaded out
// of the previous phase and swept along the phase's sun/moon arc. The overlay
// descriptor the renderer always used rides along, so screen tint and mesh
// light come from a single clock read. Save files never see any of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DAY_LENGTH, skyLightAt, weatherLightAt, lightingFor, clockConfig, weatherAt} from '../src/systems/daynight.js';
import {shade} from '../src/scene3d.js';
const world = JSON.parse(await readFile(new URL('../data/world.json', import.meta.url)));
const DAY = DAY_LENGTH * 0.3, NIGHT = DAY_LENGTH * 0.8, DAWN = DAY_LENGTH * 0.02, DUSK = DAY_LENGTH * 0.54;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('lighting: day constants hold, and mid-day lands on the legacy direction', () => {
  const day = skyLightAt(DAY, null);
  assert.deepEqual(day.keyRGB, [1, 1, 1]);
  assert.equal(day.keyI, 0.26);
  assert.deepEqual(day.ambRGB, [1, 1, 1]);
  assert.equal(day.ambI, 0.72);
  assert.equal(day.sky, 0.12);
  assert.equal(day.emissive, 0);
  // The sun sweeps, so .3 is already a touch west of the legacy direction;
  // the arc's midpoint is where the frozen shading constants live.
  const noon = skyLightAt(DAY_LENGTH * 0.29, null);
  assert.ok(noon.keyDir.every((v, i) => close(v, [-0.4, -0.5, 1][i])), 'mid-day is the legacy direction');
  assert.ok(close(noon.keyNorm, Math.hypot(-0.4, -0.5, 1)), 'mid-day length is the true magnitude');
  assert.ok(day.keyDir[0] > -0.4, 'the afternoon sun has moved west');
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
  assert.match(skyLightAt(NIGHT, null).key, /^night:\d+:[a-z]+$/, 'bucket id names its phase and sky');
  const broken = skyLightAt(NaN, null);
  assert.equal(broken.phase.id, 'day', 'a broken clock opens on a bright field');
  assert.equal(broken.ambI, 0.72);
});

test('lighting: the sun and moon sweep, and calm holds one step', () => {
  const morning = skyLightAt(DAY_LENGTH * 1.1, null), evening = skyLightAt(DAY_LENGTH * 1.49, null);
  assert.ok(morning.keyDir[0] < -0.5 && evening.keyDir[0] > 0, 'the sun crosses east to west');
  const moonrise = skyLightAt(DAY_LENGTH * 1.6, null), moonset = skyLightAt(DAY_LENGTH * 1.98, null);
  assert.ok(moonrise.keyDir[0] > 0.3 && moonset.keyDir[0] < -0.3, 'the moon crosses back over the night');
  const calm = skyLightAt(DAY, null, {calm: true}), noon = skyLightAt(DAY_LENGTH * 0.29, null);
  assert.ok(calm.keyDir.every((v, i) => close(v, noon.keyDir[i])), 'calm pins the arc at its midpoint');
  assert.ok(!close(skyLightAt(DAY, null).keyDir[0], calm.keyDir[0], 1e-3), 'moving time still sweeps the waking sky');
});

test('lighting: phases crossfade and calm players get a plain step', () => {
  const blendStart = DAY_LENGTH * 1.081; // just inside the day span of the clear day
  const easing = skyLightAt(blendStart, null);
  const calm = skyLightAt(blendStart, null, {calm: true});
  assert.ok(easing.ambI > 0.6 && easing.ambI < 0.72, 'day light eases out of dawn');
  assert.ok(easing.keyI >= 0.24 && easing.keyI <= 0.26);
  assert.equal(calm.ambI, 0.72, 'calm steps straight to the phase light');
  assert.equal(calm.keyI, 0.26);
  const midDay = skyLightAt(DAY_LENGTH * 1.3, null);
  assert.equal(midDay.ambI, 0.72, 'past the blend window the phase light holds');
  const lateDusk = skyLightAt(DAY_LENGTH * 1.575, null), earlyNight = skyLightAt(DAY_LENGTH * 1.582, null);
  assert.notEqual(lateDusk.phase.id, earlyNight.phase.id, 'dusk hands over to night');
  assert.ok(earlyNight.ambI < lateDusk.ambI, 'night enters darker');
});

test('lighting: weather lands on the meshes and stays clamped and tunable', () => {
  assert.deepEqual(weatherLightAt('clear', null), {fog: 0, dim: 1, fogRGB: [0.6, 0.65, 0.7]});
  assert.equal(weatherLightAt('rain', null).dim, 0.92);
  assert.equal(weatherLightAt('rain', null).fog, 0);
  const mist = weatherLightAt('fog', null);
  assert.equal(mist.fog, 0.5);
  assert.equal(mist.dim, 0.9);
  assert.ok(close(mist.fogRGB[0], 0x9a / 255) && close(mist.fogRGB[2], 0xb5 / 255), 'the veil matches the fog tint');
  const wild = {world: {daynight: {weather: {fog: {mesh: {fog: 9, dim: 0.1, fogColor: 'not-a-color'}}}}}};
  const clamped = weatherLightAt('fog', wild);
  assert.equal(clamped.fog, 0.85, 'fog clamps at its ceiling');
  assert.equal(clamped.dim, 0.5, 'dim clamps at its floor');
  assert.deepEqual(clamped.fogRGB, [0x9a / 255, 0xa7 / 255, 0xb5 / 255], 'bad color falls back to the base');
  assert.deepEqual(weatherLightAt('eclipse', null), weatherLightAt('clear', null), 'unknown skies read clear');
  // The bucket id folds in the weather, so a sky change forces a repaint.
  const rainDay = (() => { for (let d = 0; d < 60; d++) { const t = d * DAY_LENGTH + DAY; if (weatherAt(t, {world}).id === 'rain') return t; } throw Error('no rain day found'); })();
  const fogDay = (() => { for (let d = 0; d < 60; d++) { const t = d * DAY_LENGTH + NIGHT; if (weatherAt(t, {world}).id === 'fog') return t; } throw Error('no fog day found'); })();
  assert.match(skyLightAt(rainDay, {world}).key, /:rain$/, 'rain day buckets as rain');
  assert.match(skyLightAt(fogDay, {world}).key, /:fog$/, 'fog night buckets as fog');
  assert.ok(skyLightAt(fogDay, {world}).fog > 0 && skyLightAt(DAY_LENGTH * 1.3, null).fog === 0, 'the veil only appears in fog');
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

test('lighting: shade mixes fog with depth and dims the lit value', () => {
  const base = {keyDir: [0, 0, 1], keyNorm: 1, keyRGB: [1, 1, 1], keyI: 0, ambRGB: [1, 1, 1], ambI: 1, sky: 0, emissive: 0, dim: 1, fog: 0, fogRGB: [0, 0, 0]};
  assert.equal(shade('#ffffff', [0, 0, 1], base, 0, 0), '#ffffff', 'a clear full-ambient sky leaves the albedo alone');
  assert.equal(shade('#ffffff', [0, 0, 1], {...base, dim: 0.5}, 0, 0), '#808080', 'rain dims every channel');
  const fogged = {...base, fog: 0.5};
  assert.equal(shade('#ffffff', [0, 0, 1], fogged, 0, 0), '#ffffff', 'the near face stays clear');
  assert.equal(shade('#ffffff', [0, 0, 1], fogged, 0, 1), '#808080', 'the far face half-vanishes into the veil');
  const pale = {...base, fog: 1, fogRGB: [0.5, 0.5, 0.5]};
  assert.equal(shade('#000000', [0, 0, 1], {...pale, ambI: 0}, 0, 1), '#808080', 'the veil is absolute, not a multiplier');
});
