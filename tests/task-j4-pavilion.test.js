import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {missionLockReason} from '../src/systems/campaign.js';
import {campaignCards} from '../src/adventure.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const mission = id => data.missions.find(m => m.id === id);

test('J4: chapter 38 reconverges the diamond through requiresAny', () => {
  const pavilion = mission('ix-pale-pavilion');
  assert.equal(pavilion.name, 'The Pale Pavilion');
  assert.equal(pavilion.chapter, '38'); assert.equal(pavilion.act, 'XI');
  assert.equal(pavilion.giver, 'Sorrel the watcher');
  assert.deepEqual(pavilion.requires, []);
  assert.deepEqual(pavilion.requiresAny, ['ix-slag-fire','ix-ember-works']);
  assert.deepEqual(pavilion.objectives, [{kind:'defeat',amount:28},{kind:'survive',seconds:300}]);
  assert.deepEqual(pavilion.raids.map(r => r.count), [8,11,12]);
  assert.deepEqual(pavilion.unlocks, []);
  for (const key of ['warning','victory','defeat']) assert.ok(pavilion.ceremony?.[key], `ceremony.${key}`);
  for (const b of pavilion.map.buildings) assert.ok(data.buildings[b.type], `map building ${b.type}`);
  for (const t of pavilion.map.troops) assert.ok(data.troops[t], `map troop ${t}`);
  assert.ok(missionLockReason(pavilion, [], createWorld(data), data));
  assert.ok(missionLockReason(pavilion, ['ix-starwatch-veil'], createWorld(data), data), 'reaching the branch is not clearing it');
  assert.equal(missionLockReason(pavilion, ['ix-slag-fire'], createWorld(data), data), null, 'one road suffices');
  assert.equal(missionLockReason(pavilion, ['ix-ember-works'], createWorld(data), data), null, 'either road suffices');
});

test('J4: the pavilion map mirrors the Pale Coast camp', () => {
  const pavilion = mission('ix-pale-pavilion');
  assert.equal(pavilion.map.biome, 'plains'); assert.equal(pavilion.map.seed, 3407);
  assert.deepEqual(pavilion.map.tiles, [{x:12,y:5,biome:'plains',landmark:'Pale Coast',claimed:true}]);
});

test('J4: fallen camps carry their chapter epilogues, geometry untouched', () => {
  const camps = data.world.frontierCamps;
  assert.equal(camps.length, 5);
  const epilogue = { 'thornband-whisper': '35', 'pale-starwatch': '36', 'cinder-ashfall': '37', 'ember-ashfall': '37', 'pale-court-coast': '38' };
  for (const camp of camps) {
    assert.ok(camp.text.includes(epilogue[camp.id]), `${camp.id} names its fall`);
    assert.ok(Number.isFinite(camp.x) && Number.isFinite(camp.y) && Number.isFinite(camp.minWave), `${camp.id} geometry pins hold`);
  }
});

test('J4: the full arc reads 34-39 with the crown gated on the pavilion', () => {
  const d = structuredClone(data);
  const state = {world: createWorld(d), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
  const cards = campaignCards(d, state);
  assert.equal(cards.length, 41);
  assert.deepEqual(
    cards.filter(c => c.id.startsWith('ix-')).map(c => [c.chapter, c.id]),
    [['34','ix-ashen-wake'],['35','ix-whisper-snare'],['36','ix-starwatch-veil'],['37','ix-slag-fire'],['37','ix-ember-works'],['38','ix-pale-pavilion'],['39','ix-ashen-crown']]);
  assert.equal(cards.at(-1).id, 'ix-ashen-crown', 'the crown still closes the list');
  state.completed.push('grey-dawn-crown', 'ix-ashen-wake', 'ix-whisper-snare', 'ix-starwatch-veil', 'ix-ember-works');
  const open = campaignCards(d, state);
  assert.equal(open.find(c => c.id === 'ix-pale-pavilion').state, 'available', 'ember road alone opens the pavilion');
  assert.equal(open.find(c => c.id === 'ix-ashen-crown').state, 'locked', 'crown waits for the pavilion clear');
  state.completed.push('ix-pale-pavilion');
  assert.equal(campaignCards(d, state).find(c => c.id === 'ix-ashen-crown').state, 'available', 'the arc completes end to end');
});
