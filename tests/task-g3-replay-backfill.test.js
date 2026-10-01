import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld, makeUnit} from '../src/model.js';
import {finishMission} from '../src/systems/campaign.js';
import {visibleFrontierCamps} from '../src/environment-art.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest','expansion','biomes']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
function ready(completed) {
  const g = new Game(data);
  g.state.vlevel = 11; g.state.completed = [...completed]; g.world.renown = 6;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = data.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length: 14}, () => makeUnit('warrior', data));
  g.world.resources = Object.fromEntries(['wood','food','gold','lumber','plate','frostwood','flour','bread'].map(k => [k,99999]));
  return g;
}

test('G3: first-clear writes the ledger once, never duplicates', () => {
  const g = ready(['grey-dawn-crown','ix-ashen-wake']);
  const home = g.world;
  g.mission('ix-whisper-snare'); g.state.mission.status = 'won';
  assert.deepEqual(finishMission(g.state, data), {won:true,first:true});
  assert.deepEqual(home.clearedCamps, ['ix-whisper-snare']);
  g.mission('ix-whisper-snare'); g.state.mission.status = 'won';
  assert.deepEqual(finishMission(g.state, data), {won:true,first:false});
  assert.deepEqual(home.clearedCamps, ['ix-whisper-snare']);
});

test('G3: replay backfills a missing entry additively with no rewards', () => {
  const g = ready(['grey-dawn-crown','ix-ashen-wake','ix-whisper-snare']);
  const home = g.world;
  delete home.clearedCamps;
  home.clearedCamps = ['ix-starwatch-veil'];
  g.mission('ix-whisper-snare'); g.state.mission.status = 'won';
  const beforeRes = JSON.stringify(home.resources);
  const beforeCompleted = [...g.state.completed];
  assert.deepEqual(finishMission(g.state, data), {won:true,first:false});
  assert.ok(home.clearedCamps.includes('ix-whisper-snare'), 'missing entry backfilled');
  assert.ok(home.clearedCamps.includes('ix-starwatch-veil'), 'existing entries kept');
  assert.equal(JSON.stringify(home.resources), beforeRes, 'replay pays no rewards');
  assert.deepEqual(g.state.completed, beforeCompleted, 'replay never reduplicates completion');
});

test('G3: defeat writes nothing, never removes entries', () => {
  const g = ready(['grey-dawn-crown','ix-ashen-wake','ix-whisper-snare']);
  const home = g.world;
  home.clearedCamps = ['ix-whisper-snare'];
  g.mission('ix-starwatch-veil'); g.state.mission.status = 'lost';
  assert.deepEqual(finishMission(g.state, data), {won:false,first:false});
  assert.deepEqual(home.clearedCamps, ['ix-whisper-snare']);
});

test('G3: old saves without the ledger show every camp', () => {
  const d = structuredClone(data), w = createWorld(d);
  w.wave = 20;
  assert.equal('clearedCamps' in w, false, 'lazy field only, no save-version change');
  assert.equal(visibleFrontierCamps(w, d).length, 5, 'no ledger shows all camps');
});

test('G3: finale victories clear no camp', () => {
  const chain = ['grey-dawn-crown','ix-ashen-wake','ix-whisper-snare','ix-starwatch-veil','ix-slag-fire','ix-pale-pavilion'];
  const g = ready(chain);
  const home = g.world;
  g.mission('ix-ashen-crown'); g.state.mission.status = 'won';
  assert.deepEqual(finishMission(g.state, data), {won:true,first:true});
  assert.equal(home.clearedCamps, undefined, 'crown burns no home camp');
  const g2 = ready(['grey-dawn-crown']);
  const home2 = g2.world;
  g2.mission('ix-ashen-wake'); g2.state.mission.status = 'won';
  finishMission(g2.state, data);
  assert.equal(home2.clearedCamps, undefined, 'wake burns no home camp');
});
