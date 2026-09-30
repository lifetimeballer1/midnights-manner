import test from 'node:test';
import assert from 'node:assert/strict';
import {STRIDE_LEN, hashId, unitPitch, surfaceAt, trackStride, footstepFor} from '../src/systems/footsteps.js';
import {resetAudioPools, audioStats} from '../src/systems/audio.js';

const data = {buildings: {'stone-road': {size: 1}, pond: {size: 2}, frostgrove: {size: 2}, farm: {size: 3}}};

test('strides convert travel into alternating contacts', () => {
  const strides = new Map();
  const u = {id: 'walker-1', x: 0, y: 0};
  assert.equal(trackStride(strides, u), null);
  u.x = STRIDE_LEN + 0.1;
  assert.equal(trackStride(strides, u), 'right');
  u.x += STRIDE_LEN + 0.1;
  assert.equal(trackStride(strides, u), 'left');
  u.x += 0.05;
  assert.equal(trackStride(strides, u), null);
});

test('standing still bleeds the accumulator', () => {
  const strides = new Map();
  const u = {id: 'idler', x: 0, y: 0};
  trackStride(strides, u);
  u.x = STRIDE_LEN - 0.05;
  assert.equal(trackStride(strides, u), null);
  for (let i = 0; i < 5; i++) assert.equal(trackStride(strides, u), null);
  u.x += 0.1;
  assert.equal(trackStride(strides, u), null, 'bled acc plus a twitch earns nothing');
});

test('pitch varies deterministically per villager', () => {
  assert.notEqual(unitPitch('a', false), unitPitch('b', false));
  assert.equal(unitPitch('a', false), unitPitch('a', false));
  assert.notEqual(unitPitch('a', true), unitPitch('a', false));
  assert.equal(hashId('x'), hashId('x'));
});

test('surfaces read building footprints, ruins excluded', () => {
  const world = {buildings: [
    {type: 'stone-road', x: 5, y: 5, hp: 10, remaining: 0},
    {type: 'pond', x: 10, y: 10, hp: 10, remaining: 0},
    {type: 'frostgrove', x: 20, y: 20, hp: 10, remaining: 0},
    {type: 'stone-road', x: 30, y: 30, hp: 0, remaining: 0},
  ]};
  assert.equal(surfaceAt(world, data, 5.2, 5.4), 'stone');
  assert.equal(surfaceAt(world, data, 10.5, 11), 'water');
  assert.equal(surfaceAt(world, data, 21, 21), 'frost');
  assert.equal(surfaceAt(world, data, 30.2, 30.2), 'dirt');
  assert.equal(surfaceAt(world, data, 0, 0), 'dirt');
});

test('footsteps are silent zoomed out, live zoomed in', () => {
  resetAudioPools();
  const u = {id: 'walker-2'};
  assert.equal(footstepFor(u, 'left', 'dirt', 0.8), false);
  assert.equal(footstepFor(u, 'left', 'dirt', 1.1), false);
  const before = audioStats().pools.step;
  assert.equal(footstepFor(u, 'left', 'dirt', 2.4), true);
  assert.ok(audioStats().pools.step > before, 'close-up step consumes the pool');
});
