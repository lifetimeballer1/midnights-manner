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
function ready(completed) {
  const g = new Game(data);
  g.state.vlevel = 11; g.state.completed = completed; g.world.renown = 6;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = data.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length: 14}, () => makeUnit('warrior', data));
  g.world.resources = Object.fromEntries(['wood','food','gold','lumber','plate','frostwood','flour','bread'].map(k => [k,99999]));
  return g;
}

test('J2: chapters 34-36 chain wake into whisper into starwatch', () => {
  const wake = mission('ix-ashen-wake'), whisper = mission('ix-whisper-snare'), star = mission('ix-starwatch-veil');
  assert.equal(wake.chapter, '34'); assert.equal(whisper.chapter, '35'); assert.equal(star.chapter, '36');
  for (const m of [wake, whisper, star]) {
    assert.equal(m.act, 'XI');
    assert.ok(m.beat, `${m.id} beat`);
    assert.equal(m.giver, 'Sorrel the watcher');
    assert.equal(m.troopLimit, 10);
    assert.deepEqual(m.unlocks, []);
    for (const key of ['warning','victory','defeat']) assert.ok(m.ceremony?.[key], `${m.id} ceremony.${key}`);
    for (const b of m.map.buildings) assert.ok(data.buildings[b.type], `${m.id} building ${b.type}`);
    for (const t of m.map.troops) assert.ok(data.troops[t], `${m.id} troop ${t}`);
  }
  assert.deepEqual(wake.requires, ['grey-dawn-crown']);
  assert.deepEqual(whisper.requires, ['ix-ashen-wake']);
  assert.deepEqual(star.requires, ['ix-whisper-snare']);
  assert.ok(missionLockReason(whisper, [], createWorld(data), data));
  assert.equal(missionLockReason(whisper, ['ix-ashen-wake'], createWorld(data), data), null);
  assert.ok(missionLockReason(star, ['ix-ashen-wake'], createWorld(data), data));
  assert.equal(missionLockReason(star, ['ix-whisper-snare'], createWorld(data), data), null);
  const g = ready([]);
  assert.ok(missionLockReason(wake, [], g.world, data));
  assert.equal(missionLockReason(wake, ['grey-dawn-crown'], g.world, data), null);
});

test('J2: defeat-plus-survive escalates past the Grey Dawn road', () => {
  const wake = mission('ix-ashen-wake'), whisper = mission('ix-whisper-snare'), star = mission('ix-starwatch-veil');
  assert.deepEqual(wake.objectives, [{kind:'defeat',amount:20},{kind:'survive',seconds:240}]);
  assert.deepEqual(whisper.objectives, [{kind:'defeat',amount:22},{kind:'survive',seconds:270}]);
  assert.deepEqual(star.objectives, [{kind:'defeat',amount:24},{kind:'survive',seconds:270}]);
  assert.deepEqual(wake.raids.map(r => r.count), [7,9,11]);
  assert.deepEqual(whisper.raids.map(r => r.count), [8,10,11]);
  assert.deepEqual(star.raids.map(r => r.count), [8,10,12]);
  assert.ok(star.rewards.gold > whisper.rewards.gold && whisper.rewards.gold > wake.rewards.gold, 'baskets escalate');
  assert.ok(wake.scaling.hp >= 37 && star.scaling.hp >= wake.scaling.hp, 'scaling climbs with the arc');
});

test('J2: assault maps mirror their home regions', () => {
  const wake = mission('ix-ashen-wake'), whisper = mission('ix-whisper-snare'), star = mission('ix-starwatch-veil');
  assert.equal(wake.map.biome, 'plains'); assert.equal(wake.map.seed, 3402);
  assert.deepEqual(wake.map.tiles, [{x:12,y:5,biome:'plains',landmark:'Muster Fields',claimed:true}]);
  assert.equal(whisper.map.biome, 'forest'); assert.equal(whisper.map.seed, 3403);
  assert.deepEqual(whisper.map.tiles, [{x:12,y:5,biome:'forest',landmark:'Whisperwood',claimed:true}]);
  assert.equal(star.map.biome, 'hills'); assert.equal(star.map.seed, 3404);
  assert.deepEqual(star.map.tiles, [{x:12,y:5,biome:'hills',landmark:'Starwatch Ridge',claimed:true}]);
});

test('J2: the chapter cards run crown-last behind the new chain', () => {
  const d = structuredClone(data);
  const state = {world: createWorld(d), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
  const cards = campaignCards(d, state);
  assert.equal(cards.length, 41);
  const order = cards.map(c => c.id);
  assert.ok(order.indexOf('ix-ashen-wake') < order.indexOf('ix-whisper-snare'), 'wake before whisper');
  assert.ok(order.indexOf('ix-whisper-snare') < order.indexOf('ix-starwatch-veil'), 'whisper before starwatch');
  assert.equal(order.at(-1), 'ix-ashen-crown', 'the crown still closes the list');
  state.completed.push('grey-dawn-crown', 'ix-ashen-wake', 'ix-whisper-snare');
  assert.equal(campaignCards(d, state).find(c => c.id === 'ix-starwatch-veil').state, 'available');
});
