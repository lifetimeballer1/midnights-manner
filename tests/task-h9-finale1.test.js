import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Game} from '../src/game.js';
import {makeUnit} from '../src/model.js';
import {finishMission, tickMission, missionLockReason} from '../src/systems/campaign.js';
import {tickTownSupply, territorySupplied} from '../src/systems/food.js';
import {applyAnnex, conquestState, conquestAuraEffects, conquestLimitBonus} from '../src/systems/conquest.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const id = 'grey-dawn-gathers';
const mission = data.missions.find(m => m.id === id);
 const baseline = {...data, missions: data.missions.filter(m => m.id !== 'grey-dawn-crown' && m.id !== id && m.id !== 'grey-dawn-muster' && m.id !== 'grey-dawn-road' && m.id !== 'ix-ashen-crown' && m.id !== 'ix-ashen-wake' && m.id !== 'ix-whisper-snare' && m.id !== 'ix-starwatch-veil' && m.id !== 'ix-slag-fire' && m.id !== 'ix-ember-works' && m.id !== 'ix-pale-pavilion')};
const tribes = ['ironshield','thornband','cinder','palehost','ember'];

function ready(d = data) {
  const g = new Game(d);
  g.state.vlevel = 11;
  g.state.completed = ['ember-throne'];
  g.world.renown = 6;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = d.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length: 14}, () => makeUnit('warrior', d));
  g.world.resources = Object.fromEntries(Object.keys(g.world.resources).map(k => [k, 99999]));
  return g;
}

test('H9: HEAD fingerprints preserve all 30 earlier missions and complete conquest data', () => {
  // JSON fingerprints from git show d22367c11476413f24c7f03f37a5be2d1900c88e:data/{missions,conquest}.json.
  // Literal pins also run in shallow CI checkouts without Git history.
  const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.equal(baseline.missions.length, 30);
  assert.equal(fingerprint(baseline.missions), '3083ebc3bcdcd2f7148fcfeeae05da3c8eef4dc605ae77bc1cbcfd6b6d529166');
  assert.equal(fingerprint({...data.conquest, leaders:data.conquest.leaders.filter(l => !['grey-sovereign','ashen-warlord'].includes(l.id))}), '6675d38e4c67c87993f1a7fd21e0e770529631167d7f5dc8f4ad4260b42f6491');
  assert.equal(data.conquest.tribes.length + 1, 5);
});

 test('H9: chapter 30 opens only after Ember Throne and campaign now has 41 missions', () => {
  assert.equal(mission.name, 'The Grey Dawn Gathers');
  assert.equal(mission.chapter, '30'); assert.equal(mission.act, 'X');
  assert.equal(mission.giver, 'Sorrel the watcher');
  assert.deepEqual(mission.requires, ['ember-throne']);
  assert.equal(data.missions.length, 41);
  assert.equal(Math.max(...data.missions.map(m => Number(m.chapter))), 39);
  const g = ready();
  assert.ok(missionLockReason(mission, [], g.world, data));
  assert.ok(missionLockReason(mission, ['ember-redoubt'], g.world, data));
  assert.equal(missionLockReason(mission, ['ember-throne'], g.world, data), null);
  g.state.completed = []; const before = JSON.stringify(g.world);
  g.mission(id);
  assert.equal(g.state.mission, null); assert.equal(g.state.home, null);
  assert.equal(JSON.stringify(g.world), before);
});

test('H9: the plains muster uses the exact prelim yard, objectives, limits and two scout waves', () => {
  const prelim = data.missions.find(m => m.id === 'ember-vanguard');
  assert.equal(mission.map.biome, 'plains'); assert.equal(mission.map.seed, 3011);
  assert.deepEqual(mission.map.tiles, [{x:15,y:12,biome:'plains',landmark:'Muster Fields',claimed:true}]);
  assert.ok(mission.map.tiles.every(t => t.biome === 'plains'));
  assert.deepEqual(mission.map.buildings, prelim.map.buildings);
  assert.deepEqual(mission.map.troops, ['warrior','pikewoman','archer','builder','miner']);
  assert.deepEqual(mission.objectives, [{kind:'defeat',amount:12},{resource:'gold',amount:200}]);
  assert.equal(mission.timeLimit, 240); assert.equal(mission.troopLimit, 8);
  assert.deepEqual(mission.startingResources, {wood:300,food:200,gold:140});
  assert.deepEqual(mission.raids, [{at:40,count:5},{at:140,count:7}]);
  for (const key of ['launchCost','log','conquest','tribe','destination','boss']) assert.equal(Object.hasOwn(mission, key), false, key);
  for (const raid of mission.raids) assert.equal(Object.hasOwn(raid, 'boss'), false);
  assert.deepEqual(mission.unlocks, []);
  for (const key of ['warning','victory','defeat']) assert.ok(mission.ceremony[key].includes('Sorrel'));
  assert.ok(mission.beat && mission.description);
});

test('H9: exact locked scaling and reward basket follow prelim pacing', () => {
  assert.deepEqual(mission.scaling, {hp:30,damage:5.5});
  assert.deepEqual(mission.rewards, {gold:4000,lumber:2200,plate:550,frostwood:350});
  // The locked basket is above Vanguard, below Redoubt and Throne.
  // The brief's "above ember-redoubt" comparison conflicts with its exact values.
  for (const [key, value] of Object.entries(mission.rewards)) {
    assert.ok(value > data.missions.find(m => m.id === 'ember-vanguard').rewards[key]);
    assert.ok(value < data.missions.find(m => m.id === 'ember-redoubt').rewards[key]);
    assert.ok(value < data.missions.find(m => m.id === 'ember-throne').rewards[key]);
  }
});

test('H9: scheduled waves and both objectives gate victory, then first-clear rewards pay once', () => {
  const g = ready();
  g.world.resources = Object.fromEntries(Object.keys(g.world.resources).map(k => [k, 0]));
  const home = g.world, before = JSON.stringify(home);
  g.mission(id);
  assert.equal(g.state.mission.id, id); assert.equal(g.state.home, home);
  assert.equal(JSON.stringify(home), before, 'story departure has no war chest');
  g.world.elapsed = 39; tickMission(g.state, data);
  assert.deepEqual(g.state.mission.fired, []);
  g.world.elapsed = 40; tickMission(g.state, data);
  assert.equal(g.world.enemies.length, 5);
  assert.ok(g.world.enemies.every(e => !e.bossId));
  assert.equal(g.world.enemies[0].hp, 65 + 30);
  assert.equal(g.world.enemies[0].damage, 9 + 5.5);
  g.world.raidKills = 5; g.world.enemies = []; g.world.gathered.gold = 200;
  tickMission(g.state, data); assert.equal(g.state.mission.status, 'active');
  g.world.elapsed = 140; tickMission(g.state, data);
  assert.deepEqual(g.state.mission.fired, [0,1]); assert.equal(g.world.enemies.length, 7);
  g.world.raidKills = 12;
  tickMission(g.state, data); assert.equal(g.state.mission.status, 'active', 'living scouts still block victory');
  g.world.enemies = []; g.world.gathered.gold = 199;
  tickMission(g.state, data); assert.equal(g.state.mission.status, 'active', 'gold must be gathered');
  g.world.gathered.gold = 200; tickMission(g.state, data);
  assert.equal(g.state.mission.status, 'won');
  assert.deepEqual(finishMission(g.state, data), {won:true,first:true});
  assert.equal(g.world, home); assert.deepEqual(g.state.completed, ['ember-throne',id]);
  for (const [key, value] of Object.entries(mission.rewards)) {
    assert.equal((home.resources[key] || 0) + (home.pendingRewards?.[key] || 0), value, key);
  }
  assert.equal(home.conquest, undefined, 'story victory writes no conquest ledger');
  const paid = JSON.stringify(home), unlocks = [...g.state.unlocks];
  g.mission(id); g.state.mission.status = 'won';
  assert.deepEqual(finishMission(g.state, data), {won:true,first:false});
  assert.equal(JSON.stringify(home), paid); assert.deepEqual(g.state.unlocks, unlocks);
});

test('H9: timeout and fallen manor return home without progress, rewards or ledger writes', () => {
  for (const cause of ['timeout','manor']) {
    const g = ready(), before = JSON.stringify(g.world), completed = [...g.state.completed];
    g.mission(id);
    if (cause === 'timeout') g.world.elapsed = 240;
    else g.world.buildings.find(b => b.type === 'hall').hp = 0;
    tickMission(g.state, data);
    assert.equal(g.state.mission.status, 'lost', cause);
    assert.deepEqual(finishMission(g.state, data), {won:false,first:false});
    assert.equal(JSON.stringify(g.world), before); assert.deepEqual(g.state.completed, completed);
    assert.equal(g.world.conquest, undefined);
  }
});

test('H9: all five tribes retain byte-identical scout, clear, annex and daily supply outcomes', () => {
  for (const tribe of tribes) for (const choice of ['outpost','settlement','dismantle']) {
    const modern = ready(), old = ready(baseline);
    modern.state.completed = [];
    old.state = structuredClone(modern.state);
    assert.deepEqual(modern.scoutTribe(tribe), old.scoutTribe(tribe));
    assert.equal(conquestState(modern.world, tribe).scouted, true);
    assert.equal(JSON.stringify(modern.state), JSON.stringify(old.state));
    const definition = tribe === 'ironshield' ? data.conquest.tribe : data.conquest.tribes.find(t => t.id === tribe);
    for (const mid of [...definition.preliminaries.map(p => p.id), definition.assault]) {
      const required = data.missions.find(m => m.id === mid).requires;
      modern.state.completed.push(...required); old.state.completed.push(...required);
      modern.mission(mid); old.mission(mid);
      assert.equal(modern.state.mission?.id, mid); assert.equal(old.state.mission?.id, mid);
      modern.state.mission.status = old.state.mission.status = 'won';
      assert.deepEqual(finishMission(modern.state, data), finishMission(old.state, baseline));
      assert.equal(JSON.stringify(modern.state), JSON.stringify(old.state));
    }
    assert.equal(conquestState(modern.world, tribe).assaultWon, true);
    const a = applyAnnex(modern.state, data, choice, tribe), b = applyAnnex(old.state, baseline, choice, tribe);
    assert.equal(a.ok, true); assert.deepEqual(a,b);
    for (const elapsed of [180,180,360,1800]) {
      modern.world.elapsed = old.world.elapsed = elapsed;
      if (elapsed === 360) modern.world.resources.food = old.world.resources.food = 0;
      const notes = [], legacyNotes = [];
      assert.deepEqual(tickTownSupply(modern.world, data, n => notes.push(n)), tickTownSupply(old.world, baseline, n => legacyNotes.push(n)));
      assert.equal(JSON.stringify(modern.world), JSON.stringify(old.world)); assert.deepEqual(notes, legacyNotes);
      assert.deepEqual(conquestAuraEffects(modern.world, data), conquestAuraEffects(old.world, baseline));
      assert.equal(conquestLimitBonus(modern.world, data), conquestLimitBonus(old.world, baseline));
      assert.equal(territorySupplied(modern.world, data, tribe), territorySupplied(old.world, baseline, tribe));
    }
  }
});
