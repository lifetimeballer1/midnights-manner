import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld, makeUnit} from '../src/model.js';
import {finishMission} from '../src/systems/campaign.js';
import {visibleFrontierCamps} from '../src/environment-art.js';
import {claimRegion, regionById} from '../src/systems/expansion.js';
import {Renderer} from '../src/renderer.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest','expansion','biomes']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const mission = id => data.missions.find(m => m.id === id);
function ready(completed) {
  const g = new Game(data);
  g.state.vlevel = 11; g.state.completed = completed; g.world.renown = 6;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = data.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length: 14}, () => makeUnit('warrior', data));
  g.world.resources = Object.fromEntries(['wood','food','gold','lumber','plate','frostwood','flour','bread'].map(k => [k,99999]));
  return g;
}
const context = new Proxy({}, {get: (t, k) => t[k] || (() => k === 'measureText' ? {width: 40} : k.includes('Gradient') ? {addColorStop() {}} : undefined), set: (t, k, v) => (t[k] = v, true)});
function renderer() {
  const r = new Renderer({getContext: () => context}, data, {});
  r.resize(1280, 900, 1);
  r.calm = true;
  return r;
}

test('J5: every camp names the assault chapter that burns it', () => {
  const camps = data.world.frontierCamps;
  assert.equal(camps.length, 5);
  const mapping = {'thornband-whisper':'ix-whisper-snare','pale-starwatch':'ix-starwatch-veil','cinder-ashfall':'ix-slag-fire','ember-ashfall':'ix-ember-works','pale-court-coast':'ix-pale-pavilion'};
  for (const camp of camps) {
    assert.equal(camp.clearedBy, mapping[camp.id], `${camp.id} clearedBy`);
    assert.ok(mission(camp.clearedBy), `${camp.clearedBy} resolves`);
  }
  assert.ok(!camps.some(c => ['ix-ashen-wake','ix-ashen-crown'].includes(c.clearedBy)), 'wake and crown burn no home camp');
});

test('J5: burned camps drop from the frontier while old saves show everything', () => {
  const d = structuredClone(data), w = createWorld(d);
  w.wave = 20;
  assert.deepEqual(visibleFrontierCamps(w, d).map(c => c.id).sort(),
    ['cinder-ashfall','ember-ashfall','pale-court-coast','pale-starwatch','thornband-whisper'],
    'no ledger (old-save shape) shows every camp');
  w.clearedCamps = ['ix-whisper-snare'];
  const shown = visibleFrontierCamps(w, d).map(c => c.id);
  assert.equal(shown.includes('thornband-whisper'), false, 'the burned Cut-Camp is gone');
  assert.equal(shown.length, 4, 'only the burned camp drops');
  claimRegion(w, regionById(d.expansion, 'whisperwood'));
  assert.equal(visibleFrontierCamps(w, d).some(c => c.id === 'thornband-whisper'), false, 'claim still clears too');
});

test('J5: first-clear writes the ledger once; defeat writes nothing', () => {
  const g = ready(['grey-dawn-crown','ix-ashen-wake']);
  const home = g.world;
  g.mission('ix-whisper-snare');
  g.state.mission.status = 'won';
  assert.deepEqual(finishMission(g.state, data), {won:true,first:true});
  assert.deepEqual(home.clearedCamps, ['ix-whisper-snare']);
  g.mission('ix-whisper-snare'); g.state.mission.status = 'won';
  assert.deepEqual(finishMission(g.state, data), {won:true,first:false});
  assert.deepEqual(home.clearedCamps, ['ix-whisper-snare'], 'replay never duplicates the ledger');
  assert.deepEqual(g.state.completed.filter(id => id === 'ix-whisper-snare'), ['ix-whisper-snare'], 'replay never reduplicates completion');
  const g2 = ready(['grey-dawn-crown','ix-ashen-wake','ix-whisper-snare']);
  const home2 = g2.world;
  g2.mission('ix-starwatch-veil'); g2.state.mission.status = 'lost';
  assert.deepEqual(finishMission(g2.state, data), {won:false,first:false});
  assert.equal(home2.clearedCamps, undefined, 'a lost assault burns nothing');
});

test('J5: the static mesh rebuilds once when a camp burns', () => {
  const r = renderer(), g = new Game(data);
  g.world.wave = 20;
  r.cam.x = 48.5; r.cam.y = 14.5; r.cam.zoom = 1.8;
  r.draw(g.world, 1000);
  const cached = r._meshStatic;
  const campFaces = faces => faces.filter(f => f.owner?.kind === 'faction-camp').map(f => f.owner.id);
  assert.ok(campFaces(cached.faces).includes('thornband-whisper'), 'the Cut-Camp stands in the mesh');
  g.world.clearedCamps = ['ix-whisper-snare'];
  r.draw(g.world, 1016);
  assert.notEqual(r._meshStatic, cached, 'the burn rebuilds the static mesh');
  assert.equal(campFaces(r._meshStatic.faces).includes('thornband-whisper'), false, 'the burned camp leaves the mesh');
});
