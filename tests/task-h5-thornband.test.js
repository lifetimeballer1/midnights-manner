import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {UI} from '../src/ui.js';
import {createWorld, makeUnit, buildingLimit} from '../src/model.js';
import {finishMission, tickMission, missionLockReason} from '../src/systems/campaign.js';
import {bossSpec, bossFor, bossTick} from '../src/systems/endgame.js';
import {tickTownSupply, territorySupplyCost, territorySupplied} from '../src/systems/food.js';
import {conquestState, readinessReason, assaultReason, recordPreliminary, recordAssault,
  applyAnnex, conquestLimitBonus, conquestAuraEffects} from '../src/systems/conquest.js';
import {save, load, exportSave, importSaveBlob, VERSION} from '../src/storage.js';

const data = Object.fromEntries(await Promise.all(
  ['world','troops','items','abilities','buildings','missions','quests','levels','calendar','traders','endgame','festivals','conquest']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const tribe = 'thornband';
const mission = id => data.missions.find(m => m.id === id);
function ready() {
  const g = new Game(data);
  g.state = {...g.state, world: createWorld(data), home: null, mission: null, vlevel: 10, completed: ['ironshield-keep']};
  g.world.renown = 3;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = data.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length: 10}, () => makeUnit('warrior', data));
  g.world.resources = Object.fromEntries(['wood','food','gold','lumber','plate','frostwood','flour','bread'].map(k => [k, 99999]));
  return g;
}
function marchReady() {
  const g = ready();
  g.scoutTribe(tribe);
  for (const id of ['thornband-snares','thornband-camp']) {
    recordPreliminary(g.world, id, tribe); g.state.completed.push(id);
  }
  return g;
}
function annexBoth(g, choice = 'outpost') {
  recordAssault(g.world); recordAssault(g.world, tribe);
  assert.equal(applyAnnex(g.state, data, choice).ok, true);
  assert.equal(applyAnnex(g.state, data, choice, tribe).ok, true);
}

test('H5: chapters 18-20 chain from Ironshield, use forest maps and escalating baskets', () => {
  assert.equal(Math.max(...data.missions.map(m => Number(m.chapter))), 33, 'H12 completes the finale at chapter 33');
  const t = data.conquest.tribes[0];
  assert.equal(t.id, tribe); assert.equal(t.color, '#6a8a5a');
  assert.deepEqual(t.require, {vlevel: 10, renown: 3, barracksTier: 3, troops: 10});
  let previous = 'ironshield-keep', gold = 0;
  for (const [i, id] of [...t.preliminaries.map(p => p.id), t.assault].entries()) {
    const m = mission(id);
    assert.equal(m.chapter, String(18 + i)); assert.equal(m.tribe, tribe);
    assert.deepEqual(m.requires, [previous]);
    assert.equal(m.conquest, i === 2 ? 'assault' : 'preliminary');
    assert.equal(m.map.biome, 'forest'); assert.ok(m.rewards.gold > gold);
    assert.ok(missionLockReason(m, [], createWorld(data), data));
    assert.equal(missionLockReason(m, [previous], createWorld(data), data), null);
    previous = id; gold = m.rewards.gold;
  }
  assert.deepEqual(mission('thornband-hold').rewards, {gold:3500,lumber:2000,plate:500,frostwood:300});
});

test('H5: Thornband muster law checks each gate, Ironshield remains at its original law', () => {
  for (const fail of [g => g.state.vlevel = 9, g => g.world.renown = 2,
    g => g.world.buildings.find(b => b.type === 'barracks').level = 2,
    g => g.world.troops[0].hp = 0]) {
    const g = ready(); fail(g);
    assert.match(readinessReason(g.state, data, tribe), /muster falls short/);
    assert.equal(g.scoutTribe(tribe), undefined);
    assert.equal(conquestState(g.world, tribe).scouted, false);
  }
  const g = ready(); g.state.vlevel = 9; g.world.renown = 2; g.world.troops.length = 8;
  assert.equal(readinessReason(g.state, data), null);
  assert.equal(g.scoutTribe().ok, true);
  assert.equal(conquestState(g.world).scouted, true);
  assert.equal(conquestState(g.world, tribe).scouted, false);
});

test('H5: scout and outer-work ledgers are independent and reads never create a shelf', () => {
  const g = ready(), before = JSON.stringify(g.world);
  assert.deepEqual(conquestState(g.world, tribe), {scouted:false,preliminaries:[],assaultWon:false,annexed:null});
  assert.equal(JSON.stringify(g.world), before);
  assert.match(assaultReason(g.state, data, tribe), /Scout/);
  assert.equal(g.scoutTribe(tribe).ok, true);
  assert.equal(g.scoutTribe(tribe), undefined);
  recordPreliminary(g.world, 'ironshield-patrol'); recordPreliminary(g.world, 'ironshield-watch');
  assert.match(assaultReason(g.state, data, tribe), /outer works/);
  for (const id of ['thornband-snares','thornband-camp']) {
    recordPreliminary(g.world, id, tribe); recordPreliminary(g.world, id, tribe);
  }
  assert.deepEqual(conquestState(g.world, tribe).preliminaries, ['thornband-snares','thornband-camp']);
  assert.deepEqual(conquestState(g.world).preliminaries, ['ironshield-patrol','ironshield-watch']);
  assert.equal(assaultReason(g.state, data, tribe), null);
});

test('H5: real first-clears route to Thornband; replay and defeat leave rewards and ledger alone', () => {
  const g = ready(); g.scoutTribe(tribe);
  for (const id of ['thornband-snares','thornband-camp']) {
    g.mission(id); assert.ok(g.state.mission);
    g.state.mission.status = 'won'; assert.equal(finishMission(g.state, data).first, true);
  }
  assert.deepEqual(conquestState(g.world).preliminaries, []);
  assert.deepEqual(conquestState(g.world, tribe).preliminaries, ['thornband-snares','thornband-camp']);
  const before = JSON.stringify(g.world);
  g.mission('thornband-camp'); g.state.mission.status = 'won';
  assert.equal(finishMission(g.state, data).first, false);
  assert.equal(JSON.stringify(g.world), before);
  const loser = ready(); loser.mission('thornband-snares'); loser.state.mission.status = 'lost';
  finishMission(loser.state, data);
  assert.equal(loser.world.conquest, undefined);
});

test('H5: assault charges only a successful departure, spawns Vex, records only Thornband', () => {
  const g = marchReady(), before = {...g.world.resources};
  g.mission('thornband-hold'); assert.ok(g.state.mission);
  for (const [key, value] of Object.entries(mission('thornband-hold').launchCost)) {
    assert.equal(g.state.home.resources[key], before[key] - value);
  }
  g.world.elapsed = 300; tickMission(g.state, data);
  assert.ok(g.world.enemies.some(e => e.bossId === 'thornband-vex'));
  assert.match(g.state.mission.herald, /VEX/);
  g.state.mission.status = 'won'; finishMission(g.state, data);
  assert.equal(conquestState(g.world, tribe).assaultWon, true);
  assert.equal(conquestState(g.world).assaultWon, false);
  for (const block of ['short','raid','chain','unscouted','outer works','law']) {
    const h = marchReady();
    if (block === 'short') h.world.resources.bread = 999;
    if (block === 'raid') h.world.enemies.push({hp: 10});
    if (block === 'chain') h.state.completed = [];
    if (block === 'unscouted') h.world.conquest.tribes.thornband.scouted = false;
    if (block === 'outer works') h.world.conquest.tribes.thornband.preliminaries = [];
    if (block === 'law') h.world.renown = 2;
    const stores = {...h.world.resources};
    h.mission('thornband-hold');
    assert.equal(h.state.mission, null, block); assert.equal(h.state.home, null, block);
    assert.deepEqual(h.world.resources, stores, block);
  }
});

test('H5: Vex uses slam, raider summons and enrage without joining home crown rotation', () => {
  const spec = bossSpec(data, 'thornband-vex');
  assert.equal(spec.name, 'Briar-Captain Vex'); assert.equal(spec.hpBase, 1700); assert.equal(spec.dmgBase, 60);
  const legacy = {...data, conquest: {...data.conquest, leaders: data.conquest.leaders.filter(l => l.id !== spec.id)}};
  for (let wave = 1; wave <= 100; wave++) assert.deepEqual(bossFor(data, wave), bossFor(legacy, wave));
  const w = createWorld(data);
  const foe = {id:'vex',x:7.5,y:5.5,hp:250,maxHp:1000,damage:60,role:'boss',bossId:spec.id,attackTimer:0,animation:0,summonTimer:99,slamTimer:99};
  w.enemies.push(foe);
  const events = bossTick(w, data, foe, 0.1);
  for (const kind of ['slam','summon','enrage']) assert.ok(events.some(e => e.kind === kind), kind);
  assert.ok(w.enemies.some(e => e.role === 'raider')); assert.equal(foe.damage, 90);
});

test('H5: each tribe has one annex judgement, salvage uses storage caps and pending rewards', () => {
  const g = ready(); recordAssault(g.world);
  assert.equal(applyAnnex(g.state, data, 'outpost', tribe).ok, false);
  assert.equal(g.annex('outpost'), true);
  const iron = JSON.stringify(conquestState(g.world));
  recordAssault(g.world, tribe);
  g.world.resources = Object.fromEntries(Object.keys(g.world.resources).map(k => [k, 0]));
  assert.equal(g.annex('dismantle', tribe), true);
  assert.equal(g.world.resources.lumber, 1200); assert.equal(g.world.pendingRewards.lumber, 3800);
  assert.equal(g.world.resources.gold, 4000); assert.equal(g.world.resources.plate, 600);
  assert.equal(g.world.resources.frostwood, 350);
  assert.equal(applyAnnex(g.state, data, 'settlement', tribe).ok, false);
  assert.equal(JSON.stringify(conquestState(g.world)), iron);
});

test('H5: both outposts stack limits, pay independent upkeep and suppress only unpaid auras', () => {
  const g = ready(); annexBoth(g);
  assert.equal(conquestLimitBonus(g.world, data), 4);
  assert.equal(buildingLimit('farm', 10, data, 4), buildingLimit('farm', 10, data) + 4);
  assert.equal(buildingLimit('wall', 10, data, 4), Infinity);
  assert.deepEqual(territorySupplyCost(g.world, data), {food:1700,bread:90,gold:220,plate:18});
  const before = {...g.world.resources};
  g.world.elapsed = 180; const result = tickTownSupply(g.world, data);
  for (const [key, value] of Object.entries(result.territoryCost)) {
    assert.equal(g.world.resources[key], before[key] - value - (result.cost[key] || 0));
  }
  assert.equal(territorySupplied(g.world, data), true);
  assert.deepEqual(conquestAuraEffects(g.world, data), {armor:0.03,heal:0.2,damage:0.03});
  const paid = {...g.world.resources}; assert.equal(tickTownSupply(g.world, data), null);
  assert.deepEqual(g.world.resources, paid);
  g.world.elapsed = 360; g.world.resources.plate = 8;
  const notes = []; tickTownSupply(g.world, data, n => notes.push(n));
  assert.equal(g.world.resources.plate, 0);
  assert.equal(g.world.conquest.supplied, true);
  assert.equal(g.world.conquest.tribes.thornband.supplied, false);
  assert.equal(territorySupplied(g.world, data, 'ironshield'), true);
  assert.equal(territorySupplied(g.world, data), false);
  assert.deepEqual(conquestAuraEffects(g.world, data), {armor:0.03,heal:0.1});
  assert.equal(conquestLimitBonus(g.world, data), 4);
  assert.equal(notes.length, 1);
  g.world.elapsed = 540; tickTownSupply(g.world, data, n => notes.push(n));
  assert.equal(notes.length, 2, 'Ironshield loses coverage once, Thornband does not repeat');
  g.world.resources.plate = 100; g.world.elapsed = 720; tickTownSupply(g.world, data);
  assert.equal(territorySupplied(g.world, data), true);
});

test('H5: both settlements use their own supply baskets and existing aura keys', () => {
  const g = ready(); annexBoth(g, 'settlement');
  assert.equal(conquestLimitBonus(g.world, data), 2);
  assert.deepEqual(territorySupplyCost(g.world, data), {food:2100,gold:220,lumber:180});
  g.world.elapsed = 180; tickTownSupply(g.world, data);
  assert.deepEqual(conquestAuraEffects(g.world, data), {gather:0.07,food:0.8});
  g.world.conquest.supplied = false;
  assert.deepEqual(conquestAuraEffects(g.world, data), {gather:0.04,food:0.4});
});

test('H5: Ironshield-only ledgers and daily outcomes remain byte-identical with added content', () => {
  const legacy = {...data, conquest: {...data.conquest, tribes: []}};
  for (const choice of ['outpost','settlement','dismantle']) {
    const g = ready(); g.state.vlevel = 9; g.world.renown = 2;
    g.scoutTribe(); recordPreliminary(g.world, 'ironshield-patrol'); recordPreliminary(g.world, 'ironshield-watch');
    recordAssault(g.world); applyAnnex(g.state, data, choice);
    const old = structuredClone(g.world), modern = structuredClone(g.world);
    for (const elapsed of [180,180,360,1800]) {
      old.elapsed = modern.elapsed = elapsed;
      if (elapsed === 360) old.resources.food = modern.resources.food = 0;
      const a = [], b = [];
      assert.equal(JSON.stringify(tickTownSupply(modern, data, n => a.push(n))), JSON.stringify(tickTownSupply(old, legacy, n => b.push(n))));
      assert.equal(JSON.stringify(modern), JSON.stringify(old)); assert.deepEqual(a, b);
      assert.deepEqual(conquestAuraEffects(modern, data), conquestAuraEffects(old, legacy));
      assert.equal(conquestLimitBonus(modern, data), conquestLimitBonus(old, legacy));
      assert.equal(modern.conquest.tribes, undefined);
    }
  }
});

test('H5: local saves and imports round-trip both shelves; absent Thornband stays absent', () => {
  const g = marchReady(); annexBoth(g);
  g.world.elapsed = 180; tickTownSupply(g.world, data);
  assert.equal(save(g.state), true);
  assert.deepEqual(load(data).world.conquest, g.world.conquest);
  const blob = exportSave(g.state), imported = importSaveBlob(blob, data);
  assert.equal(imported.ok, true); assert.equal(imported.state.version, VERSION);
  assert.deepEqual(imported.state.world.conquest, g.world.conquest);
  delete g.world.conquest.tribes.thornband.supplied;
  assert.equal(importSaveBlob(exportSave(g.state), data).state.world.conquest.tribes.thornband.supplied, false);
  assert.equal(save(g.state), true); assert.equal(load(data).world.conquest.tribes.thornband.supplied, false);
  const old = ready(); old.scoutTribe(); old.world.conquest.supplied = false;
  const before = JSON.stringify(old.world.conquest);
  assert.equal(JSON.stringify(importSaveBlob(exportSave(old.state), data).state.world.conquest), before);
  assert.equal(conquestState(old.world, tribe).scouted, false);
  assert.equal(old.world.conquest.tribes, undefined);
});

test('H5: Adventure exposes separate scouting, mission and annex controls for both tribes', () => {
  const g = ready(), ui = Object.create(UI.prototype);
  let html = ui.homeBlock(g);
  assert.match(html, /data-scout-tribe="ironshield"/); assert.match(html, /data-scout-tribe="thornband"/);
  g.scoutTribe(); g.scoutTribe(tribe);
  html = ui.homeBlock(g);
  assert.match(html, /data-mission="thornband-snares"/); assert.match(html, /Briar-Captain Vex/);
  recordAssault(g.world); recordAssault(g.world, tribe);
  html = ui.homeBlock(g);
  assert.match(html, /data-annex="outpost" data-tribe="ironshield"/);
  assert.match(html, /data-annex="outpost" data-tribe="thornband"/);
});
