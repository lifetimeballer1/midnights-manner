import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {Renderer} from '../src/renderer.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest','expansion','biomes','music']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const context = new Proxy({}, {get: (t, k) => t[k] || (() => k === 'measureText' ? {width: 40} : k.includes('Gradient') ? {addColorStop() {}} : undefined), set: (t, k, v) => (t[k] = v, true)});
function renderer() {
  const r = new Renderer({getContext: () => context}, data, {});
  r.resize(1280, 900, 1);
  r.calm = true;
  return r;
}

test('J6: the celebration timer never leaks past stop', async () => {
  const {MusicPlayer} = await import('../src/music.js');
  const player = new MusicPlayer(data.music);
  player.celebrate(300000);
  player.start();
  assert.equal(player.score.id, 'ashen-choir');
  assert.ok(player.celebrateTimer, 'the 5-minute duck is armed');
  player.stop();
  assert.equal(player.celebrateTimer, null, 'stop disarms the duck');
  assert.equal(player.celebrationHold, false, 'stop releases the hold');
  assert.equal(player.pendingCelebrate, false, 'stop drops a queued celebration');
});

test('J6: burning the whole frontier rebuilds boundedly and ends camp-free', () => {
  const r = renderer(), g = new Game(data);
  g.world.wave = 20;
  r.cam.x = 26; r.cam.y = 22; r.cam.zoom = 0.6;
  const campFaces = () => [...new Set((r._meshStatic?.faces || []).filter(f => f.owner?.kind === 'faction-camp').map(f => f.owner.id))].sort();
  r.draw(g.world, 1000);
  assert.deepEqual(campFaces(), ['cinder-ashfall','ember-ashfall','pale-court-coast','pale-starwatch','thornband-whisper']);
  // Wide zoom trims small props but camp banners always draw; count rebuilds.
  let rebuilds = 0, last = r._meshStatic;
  const burns = ['ix-whisper-snare','ix-starwatch-veil','ix-slag-fire','ix-ember-works','ix-pale-pavilion'];
  assert.equal(burns.length, data.world.frontierCamps.length, 'one assault per camp');
  for (const id of burns) {
    g.world.clearedCamps = [...(g.world.clearedCamps || []), id];
    r.draw(g.world, 1016);
    if (r._meshStatic !== last) rebuilds++;
    last = r._meshStatic;
  }
  assert.equal(rebuilds, burns.length, 'one static rebuild per burn, never per frame');
  assert.deepEqual(campFaces(), [], 'the frontier ends camp-free');
});
