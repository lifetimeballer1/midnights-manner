import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkSync, HAMMER_PERIOD, SAW_HALF_PERIOD, phaseOffset} from '../src/systems/worksync.js';
import {resetAudioPools, audioStats} from '../src/systems/audio.js';

const quietR = {random: () => 0.99};

test('wrap arms on first sighting, fires once per cycle', () => {
  const sync = new WorkSync();
  assert.equal(sync.wrap('b1', 'hammer', 1000, 1000, 0), false);
  assert.equal(sync.wrap('b1', 'hammer', 1500, 1000, 0), false);
  assert.equal(sync.wrap('b1', 'hammer', 2000, 1000, 0), true);
  assert.equal(sync.wrap('b1', 'hammer', 2001, 1000, 0), false);
  assert.equal(sync.wrap('b1', 'hammer', 3000, 1000, 0), true);
});

test('hammer wraps land on the workGlint pulse peak', () => {
  // workGlint peaks when sin(t*.006+seed*11)=1 -> t=(PI/2-seed*11+2PI*k)/.006
  const seed = 0.37, off = phaseOffset(seed, 11, 0.006, Math.PI / 2);
  const peak = (Math.PI / 2 - seed * 11) / 0.006;
  assert.ok(Math.abs(((peak + off) / HAMMER_PERIOD) - Math.round((peak + off) / HAMMER_PERIOD)) < 1e-9, 'peak sits on a wrap edge');
  const sync = new WorkSync();
  sync.wrap('f1', 'hammer', peak - HAMMER_PERIOD, HAMMER_PERIOD, off);
  assert.equal(sync.wrap('f1', 'hammer', peak, HAMMER_PERIOD, off), true);
});

test('saw wraps match the sawStroke extremes cadence', () => {
  assert.ok(Math.abs(SAW_HALF_PERIOD - 261.799) < 0.01, `saw half-period ${SAW_HALF_PERIOD}`);
  assert.ok(Math.abs(HAMMER_PERIOD - 1047.198) < 0.01, `hammer period ${HAMMER_PERIOD}`);
});

test('forge fires bellows then hammer through the work pool', () => {
  resetAudioPools();
  const sync = new WorkSync(), b = {id: 'forge-9', type: 'forge', level: 3};
  const base = audioStats().pools;
  let fired = null;
  for (let t = 0; t < 7000; t += 50) fired = sync.fire(b, 0.5, t, 1, quietR) || fired;
  assert.ok(fired, 'a full cycle fires at least one channel');
  const after = audioStats().pools;
  assert.ok(after.work > base.work || after.mach > base.mach, 'forge consumes work or bellows pools');
});

test('mine, lumber and sawmill each fire their signature channels', () => {
  for (const [type, pool] of [['mine', 'work'], ['lumber', 'work'], ['sawmill', 'mach']]) {
    resetAudioPools();
    const sync = new WorkSync(), b = {id: type + '-1', type, level: 6};
    const base = audioStats().pools[pool];
    for (let t = 0; t < 9000; t += 50) sync.fire(b, 0.5, t, 1, quietR);
    assert.ok(audioStats().pools[pool] > base, `${type} consumes the ${pool} pool`);
  }
});

test('silent volume fires nothing; unknown types are ignored', () => {
  resetAudioPools();
  const sync = new WorkSync();
  const base = JSON.stringify(audioStats().pools);
  assert.equal(sync.fire({id: 'forge-1', type: 'forge', level: 1}, 0.5, 5000, 0, quietR), null);
  assert.equal(sync.fire({id: 'hall-1', type: 'hall', level: 1}, 0.5, 5000, 1, quietR), null);
  assert.equal(JSON.stringify(audioStats().pools), base);
});

test('prune drops cycles for vanished buildings', () => {
  const sync = new WorkSync();
  sync.wrap('wgone-1', 'hammer', 1000, 1000, 0);
  sync.wrap('wkept-1', 'hammer', 1000, 1000, 0);
  sync.prune(new Set(['wkept-1']));
  assert.equal(sync.last.has('wgone-1|hammer'), false);
  assert.equal(sync.last.has('wkept-1|hammer'), true);
});
