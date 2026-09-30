import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkSync} from '../src/systems/worksync.js';
import {sfx, resetAudioPools, audioStats} from '../src/systems/audio.js';
import {AmbiencePlayer} from '../src/systems/ambience.js';

const quietR = {random: () => 0.99};

function swept(type, opts, ms = 16000) {
  resetAudioPools();
  const sync = new WorkSync(), b = {id: type + '-p4', type, level: 4};
  const base = JSON.stringify(audioStats().pools);
  let fired = null;
  for (let t = 0; t < ms; t += 50) fired = sync.fire(b, 0.5, t, 1, quietR, opts) || fired;
  return {fired, changed: JSON.stringify(audioStats().pools) !== base};
}

test('fields, mill, bakery, mason, fletcher, tannery and butchery fire', () => {
  for (const type of ['farm', 'pasture', 'mill', 'bakery', 'mason_yard', 'fletcher', 'tannery', 'butchery']) {
    const {fired, changed} = swept(type, {});
    assert.ok(fired, `${type} fires a channel`);
    assert.ok(changed, `${type} consumes a cooldown pool`);
  }
});

test('water laps, markets bustle quietly, barracks drill', () => {
  for (const type of ['pond', 'blackwater-weir', 'market', 'market-square', 'barracks']) {
    const {fired, changed} = swept(type, {});
    assert.ok(fired, `${type} fires a channel`);
    assert.ok(changed, `${type} consumes a cooldown pool`);
  }
});

test('homes hush: hearths after dark, doors by day, never workshops', () => {
  const night = swept('cottage', {night: true});
  assert.ok(night.fired === 'hearth', `night cottage breathes hearth, got ${night.fired}`);
  const day = swept('longhouse', {night: false}, 17000);
  assert.ok(day.fired === 'door', `day longhouse settles a door, got ${day.fired}`);
  resetAudioPools();
  const sync = new WorkSync();
  const base = JSON.stringify(audioStats().pools);
  for (let t = 0; t < 17000; t += 50) {
    const f = sync.fire({id: 'hall-day', type: 'hall', level: 3}, 0.5, t, 1, quietR, {});
    assert.ok(f !== 'hearth', 'no hearth crackle by day');
  }
  assert.ok(JSON.stringify(audioStats().pools) !== base, 'day homes still live a little');
});

test('new voices consume independent pools', () => {
  for (const [fn, pool] of [[() => sfx.rustle(), 'field'], [() => sfx.creak(), 'mill'], [() => sfx.murmur(), 'stall'], [() => sfx.coin(), 'stall']]) {
    resetAudioPools();
    const base = audioStats().pools[pool];
    fn();
    assert.ok(audioStats().pools[pool] > base, `${pool} pool consumed`);
  }
  resetAudioPools();
  sfx.murmur();
  const after = audioStats().pools;
  assert.equal(after.mach, audioStats().pools.mach, 'market murmur never suppresses saw or bellows');
});

function fakeAudio() {
  const nodes = [];
  const param = () => ({setValueAtTime() {}, exponentialRampToValueAtTime() {}});
  const node = () => ({type: '', frequency: param(), connect: () => {}, start() {}, stop() {}, gain: undefined});
  const ctx = {
    currentTime: 0,
    destination: {},
    state: 'running',
    resume() {},
    createOscillator() { const o = node(); o.gain = param(); nodes.push(o); return o; },
    createGain() { const g = node(); g.gain = param(); nodes.push(g); return g; },
  };
  return {ctx, nodes, Fake: function () { return ctx; }};
}

test('ambience rare voices play bounded across dawn, day, night and rain', () => {
  const {ctx, nodes, Fake} = fakeAudio();
  const previousWindow = globalThis.window;
  globalThis.window = {AudioContext: Fake};
  try {
    const rainy = {world: {daynight: {dayLength: 300, rainChance: 100, fogChance: 0}}};
    const clear = {world: {daynight: {dayLength: 300, rainChance: 0, fogChance: 0}}};
    const scenes = [
      {elapsed: 5, buildings: [], data: clear},                       // dawn rooster window
      {elapsed: 60, buildings: [{type: 'farm', hp: 9, remaining: 0}, {type: 'pasture', hp: 9, remaining: 0}, {type: 'cottage', hp: 9, remaining: 0}, {type: 'mill', hp: 9, remaining: 0}], data: clear},
      {elapsed: 240, buildings: [{type: 'cottage', hp: 9, remaining: 0}, {type: 'farm', hp: 9, remaining: 0}, {type: 'forge', hp: 9, remaining: 0}], data: clear}, // night owl/dog
      {elapsed: 60, buildings: [], data: rainy},                       // rain thunder window
    ];
    for (const scene of scenes) {
      const player = new AmbiencePlayer({world: {elapsed: scene.elapsed, buildings: scene.buildings}, data: scene.data});
      let worst = 0;
      for (let i = 0; i < 40; i++) {
        const before = nodes.length;
        ctx.currentTime += 8;
        assert.doesNotThrow(() => player.tick());
        worst = Math.max(worst, nodes.length - before);
      }
      assert.ok(worst < 40, `no runaway voices in one tick (${worst} worst)`);
    }
    assert.ok(nodes.length > 0, 'rare branches actually synthesize');
  } finally { if (previousWindow !== undefined) globalThis.window = previousWindow; else delete globalThis.window; }
});
