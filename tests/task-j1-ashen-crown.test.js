import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld, makeUnit} from '../src/model.js';
import {missionLockReason} from '../src/systems/campaign.js';
import {bossSpec} from '../src/systems/endgame.js';
import {campaignCards} from '../src/adventure.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const id = 'ix-ashen-crown';
const mission = data.missions.find(m => m.id === id);
function ready() {
  const g = new Game(data);
  g.state.vlevel = 11; g.state.completed = ['grey-dawn-crown']; g.world.renown = 6;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = data.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length: 14}, () => makeUnit('warrior', data));
  g.world.resources = Object.fromEntries(['wood','food','gold','lumber','plate','frostwood','flour','bread'].map(k => [k,99999]));
  return g;
}

 test('J1: chapter 39 chains the Act XI arc and pays resources only', () => {
  assert.ok(mission, 'ix-ashen-crown ships');
  assert.equal(mission.name, 'The Ashen Crown');
  assert.equal(mission.chapter, '39'); assert.equal(mission.act, 'XI');
  assert.equal(mission.giver, 'Sorrel the watcher');
  assert.deepEqual(mission.requires, ['ix-pale-pavilion']);
  assert.deepEqual(mission.objectives, [{kind:'defeat',amount:32},{kind:'survive',seconds:360}]);
  assert.deepEqual(mission.unlocks, []);
  assert.deepEqual(mission.rewards, {gold:9000,lumber:5000,plate:1400,frostwood:900});
  for (const b of mission.map.buildings) assert.ok(data.buildings[b.type], `map building ${b.type}`);
  for (const t of mission.map.troops) assert.ok(data.troops[t], `map troop ${t}`);
  assert.ok(mission.act && mission.beat, 'act and beat ship');
  for (const key of ['warning','victory','defeat']) assert.ok(mission.ceremony?.[key], `ceremony.${key} ships`);
  const g = ready();
  assert.ok(missionLockReason(mission, [], g.world, data));
  assert.ok(missionLockReason(mission, ['grey-dawn-crown'], g.world, data), 'the old gate no longer opens the crown');
  assert.ok(missionLockReason(mission, ['ix-slag-fire'], g.world, data), 'a branch alone is not the pavilion');
  assert.equal(missionLockReason(mission, ['ix-pale-pavilion'], g.world, data), null);
});

test('J1: the scorched hills assault runs heavier horns than the Dawn', () => {
  const crown = data.missions.find(m => m.id === 'grey-dawn-crown');
  assert.equal(mission.map.biome, 'hills'); assert.equal(mission.map.seed, 3401);
  assert.deepEqual(mission.map.tiles, [{x:12,y:5,biome:'hills',landmark:'Ashen Crown',claimed:true}]);
  assert.deepEqual(mission.map.buildings, crown.map.buildings);
  assert.equal(mission.timeLimit, 450); assert.equal(mission.troopLimit, 10);
  assert.deepEqual(mission.raids.map(r => r.count), [8,10,12,14]);
  const bossWave = mission.raids.at(-1);
  assert.equal(bossWave.boss, 'ashen-warlord');
  assert.match(bossWave.herald, /ASHEN WARLORD/);
  const warlord = bossSpec(data, 'ashen-warlord'), sovereign = bossSpec(data, 'grey-sovereign');
  assert.equal(warlord.name, 'The Ashen Warlord');
  assert.ok(warlord.hpBase > sovereign.hpBase && warlord.dmgBase > sovereign.dmgBase, 'the Warlord out-stats the Sovereign');
});

test('J1: the crown card closes the chapter list behind its prerequisite', () => {
  const d = structuredClone(data);
  const state = {world: createWorld(d), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
  const cards = campaignCards(d, state);
  assert.equal(cards.length, 41);
  assert.equal(cards.at(-1).id, 'ix-ashen-crown');
  assert.equal(cards.at(-1).state, 'locked');
  state.completed.push('grey-dawn-crown', 'ix-ashen-wake', 'ix-whisper-snare', 'ix-starwatch-veil', 'ix-slag-fire', 'ix-pale-pavilion');
  assert.equal(campaignCards(d, state).find(c => c.id === 'ix-ashen-crown').state, 'available');
});
