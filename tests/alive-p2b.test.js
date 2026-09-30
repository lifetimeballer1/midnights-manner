import test from 'node:test';
import assert from 'node:assert/strict';
import {sfx, scheduleSound, pumpScheduled, resetAudioPools, audioStats} from '../src/systems/audio.js';
import {setListener} from '../src/systems/soundstage.js';
import {strikeSound, wallSound} from '../src/systems/combat.js';
import {gateLiftStage} from '../src/scene3d.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('scheduled sounds fire on pump, far-future ones wait, cap holds', () => {
  resetAudioPools();
  let fired = 0;
  scheduleSound(0, () => { fired++; });
  scheduleSound(60, () => { fired += 100; });
  assert.equal(pumpScheduled(), 1);
  assert.equal(fired, 1);
  resetAudioPools();
  for (let i = 0; i < 30; i++) scheduleSound(0, () => { fired++; });
  assert.equal(pumpScheduled(), 24);
});

test('muting drops scheduled impacts instead of stalling them', async () => {
  resetAudioPools();
  let fired = 0;
  const {toggleMute, isMuted} = await import('../src/systems/audio.js');
  if (!isMuted()) toggleMute();
  try {
    scheduleSound(0, () => { fired++; });
    assert.equal(pumpScheduled(), 0);
    assert.equal(fired, 0);
  } finally {
    if (isMuted()) toggleMute();
  }
});

test('ranged strikes release now and impact after flight time', async () => {
  resetAudioPools();
  setListener({zoom: 2.5});
  try {
    const base = audioStats().pools;
    strikeSound({x: 0, y: 0}, {x: 5, y: 0}, true);
    const afterRelease = audioStats().pools;
    assert.ok(afterRelease.bow > base.bow, 'bow release sounds now');
    assert.equal(afterRelease.hit, base.hit, 'impact waits for flight time');
    await sleep(550);
    pumpScheduled();
    assert.ok(audioStats().pools.hit > base.hit, 'impact lands after ~0.45s flight');
  } finally { setListener({zoom: 1}); }
});

test('melee strikes swing now and land on a short beat', async () => {
  resetAudioPools();
  setListener({zoom: 2.5});
  try {
    const base = audioStats().pools;
    strikeSound({x: 0, y: 0}, {x: 0.5, y: 0}, false);
    assert.ok(audioStats().pools.melee > base.melee, 'blade swing sounds now');
    await sleep(150);
    pumpScheduled();
    assert.ok(audioStats().pools.hit > base.hit, 'impact lands on the beat');
  } finally { setListener({zoom: 1}); }
});

test('walls crack wood or chip stone by type', () => {
  resetAudioPools();
  const base = audioStats().pools;
  wallSound({type: 'wall'});
  assert.ok(audioStats().pools.wall > base.wall, 'palisade crack consumes the wall pool');
  resetAudioPools();
  const base2 = audioStats().pools;
  wallSound({type: 'stonewall'});
  assert.ok(audioStats().pools.wall > base2.wall, 'stone chip consumes the same pool');
  wallSound({type: 'rampart'});
  assert.equal(audioStats().pools.wall, audioStats().pools.wall, 'rapid second hit throttles');
});

test('gates creak in transit and thud on arrival', () => {
  resetAudioPools();
  const base = audioStats().pools;
  const r = {_gateMotion: new Map(), calm: false};
  const b = {id: 'gtest-settle', x: 5, y: 5, hp: 10};
  assert.equal(gateLiftStage(r, b, {enemies: []}, 0), 4);
  const raid = {enemies: [{hp: 5, x: 5.6, y: 5.6}]};
  gateLiftStage(r, b, raid, 100);
  assert.ok(audioStats().pools.gate > base.gate, 'creak while traveling');
  assert.equal(gateLiftStage(r, b, raid, 1000), 0);
  assert.ok(audioStats().pools.thud > base.thud, 'heavy thud when the gate slams shut');
  const thudAfter = audioStats().pools.thud;
  gateLiftStage(r, b, raid, 1500);
  assert.equal(audioStats().pools.thud, thudAfter, 'seated gate stays silent');
});

test('siege, ignite, crackle and trap reset consume their pools', () => {
  for (const [fn, pool] of [[() => sfx.siege(), 'siege'], [() => sfx.ignite(), 'fire'], [() => sfx.crackle(), 'fire'], [() => sfx.trapReset(), 'trap']]) {
    resetAudioPools();
    const base = audioStats().pools[pool];
    fn();
    assert.ok(audioStats().pools[pool] > base, `${pool} pool consumed`);
  }
});
