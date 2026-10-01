import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld, makeUnit} from '../src/model.js';
import {missionLockReason} from '../src/systems/campaign.js';
import {campaignCards} from '../src/adventure.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const mission = id => data.missions.find(m => m.id === id);

test('J3: the branch shares chapter 37 off starwatch with mirrored horns', () => {
  const slag = mission('ix-slag-fire'), ember = mission('ix-ember-works');
  assert.equal(slag.chapter, '37'); assert.equal(ember.chapter, '37');
  for (const m of [slag, ember]) {
    assert.equal(m.act, 'XI');
    assert.ok(m.beat, `${m.id} beat`);
    assert.equal(m.giver, 'Sorrel the watcher');
    assert.equal(m.troopLimit, 10);
    assert.deepEqual(m.requires, ['ix-starwatch-veil']);
    assert.deepEqual(m.unlocks, []);
    assert.deepEqual(m.objectives, [{kind:'defeat',amount:26},{kind:'survive',seconds:300}]);
    assert.deepEqual(m.raids.map(r => r.count), [8,10,12]);
    for (const key of ['warning','victory','defeat']) assert.ok(m.ceremony?.[key], `${m.id} ceremony.${key}`);
    for (const b of m.map.buildings) assert.ok(data.buildings[b.type], `${m.id} building ${b.type}`);
    for (const t of m.map.troops) assert.ok(data.troops[t], `${m.id} troop ${t}`);
  }
  assert.ok(missionLockReason(slag, [], createWorld(data), data));
  assert.ok(missionLockReason(ember, ['ix-whisper-snare'], createWorld(data), data));
  assert.equal(missionLockReason(slag, ['ix-starwatch-veil'], createWorld(data), data), null);
  assert.equal(missionLockReason(ember, ['ix-starwatch-veil'], createWorld(data), data), null);
});

test('J3: slag-lines and works read as different camps on the same march', () => {
  const slag = mission('ix-slag-fire'), ember = mission('ix-ember-works');
  assert.equal(slag.map.biome, 'hills'); assert.equal(ember.map.biome, 'hills');
  assert.notEqual(slag.map.seed, ember.map.seed, 'different scenery rolls');
  assert.deepEqual(slag.map.tiles, [{x:12,y:5,biome:'hills',landmark:'Slag Lines',claimed:true}]);
  assert.deepEqual(ember.map.tiles, [{x:12,y:5,biome:'hills',landmark:'Ember Works',claimed:true}]);
  assert.match(slag.ceremony.warning, /slag-lines/i);
  assert.match(ember.ceremony.warning, /red canvas/i);
  assert.match(ember.ceremony.victory, /Pale Coast/);
});

test('J3: either branch clears the way while the crown still closes the list', () => {
  const d = structuredClone(data);
  const state = {world: createWorld(d), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
  const cards = campaignCards(d, state);
  assert.equal(cards.length, 41);
  const order = cards.map(c => c.id);
  assert.ok(order.indexOf('ix-starwatch-veil') < order.indexOf('ix-slag-fire'), 'branch follows starwatch');
  assert.ok(order.indexOf('ix-ember-works') < order.indexOf('ix-ashen-crown'), 'branch precedes the crown');
  assert.equal(order.at(-1), 'ix-ashen-crown', 'the crown still closes the list');
  state.completed.push('grey-dawn-crown', 'ix-ashen-wake', 'ix-whisper-snare', 'ix-starwatch-veil');
  const open = campaignCards(d, state);
  assert.equal(open.find(c => c.id === 'ix-slag-fire').state, 'available');
  assert.equal(open.find(c => c.id === 'ix-ember-works').state, 'available');
  // J4 rewired the crown onto the pavilion: a branch alone leaves it locked.
  assert.equal(open.find(c => c.id === 'ix-ashen-crown').state, 'locked', 'crown waits for the pavilion');
  assert.equal(open.find(c => c.id === 'ix-pale-pavilion').state, 'locked', 'pavilion waits for a branch clear');
});
