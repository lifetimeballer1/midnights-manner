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
const tribe = 'cinder';
const mission = id => data.missions.find(m => m.id === id);
function ready() {
  const g = new Game(data);
  g.state = {...g.state, world: createWorld(data), home: null, mission: null, vlevel: 10, completed: ['thornband-hold']};
  g.world.renown = 4;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = data.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length: 12}, () => makeUnit('warrior', data));
  g.world.resources = Object.fromEntries(['wood','food','gold','lumber','plate','frostwood','flour','bread'].map(k => [k, 99999]));
  return g;
}
function marchReady() {
  const g = ready();
  g.scoutTribe(tribe);
  for (const id of ['cinder-slags','cinder-forge']) {
    recordPreliminary(g.world, id, tribe); g.state.completed.push(id);
  }
  return g;
}
function annexBoth(g, choice = 'outpost') {
  recordAssault(g.world); recordAssault(g.world, tribe);
  assert.equal(applyAnnex(g.state, data, choice).ok, true);
  assert.equal(applyAnnex(g.state, data, choice, tribe).ok, true);
}

test('H6: chapters 21-23 chain from Thornband, use hills maps and escalating baskets', () => {
  assert.equal(Math.max(...data.missions.map(m => Number(m.chapter))), 30, 'H9 ends at chapter 30; H10 has not started');
  const t = data.conquest.tribes[1];
  assert.equal(t.id, tribe); assert.equal(t.color, '#c76b43');
  assert.deepEqual(t.require, {vlevel: 10, renown: 4, barracksTier: 3, troops: 12});
  assert.equal(data.missions.length, 31);
  let previous = 'thornband-hold', rewards = {};
  for (const [i, id] of [...t.preliminaries.map(p => p.id), t.assault].entries()) {
    const m = mission(id);
    assert.equal(m.chapter, String(21 + i)); assert.equal(m.tribe, tribe);
    assert.deepEqual(m.requires, [previous]);
    assert.equal(m.conquest, i === 2 ? 'assault' : 'preliminary');
    assert.equal(m.map.biome, 'hills');
    assert.ok(m.map.tiles.every(tile => tile.biome === 'hills'));
    for (const [key, value] of Object.entries(m.rewards)) assert.ok(value > (rewards[key] || 0), key);
    assert.ok(missionLockReason(m, [], createWorld(data), data));
    assert.equal(missionLockReason(m, [previous], createWorld(data), data), null);
    previous = id; rewards = m.rewards;
  }
  assert.deepEqual(mission('cinder-citadel').rewards, {gold:4500,lumber:2500,plate:650,frostwood:400});
  const thorn = data.conquest.tribes[0];
  for (const option of t.annex) {
    const prior = thorn.annex.find(a => a.id === option.id);
    assert.equal(option.limitBonus, prior.limitBonus);
    for (const field of ['resources','flatAuras']) for (const [key, value] of Object.entries(prior[field] || {})) {
      assert.ok(option[field][key] >= value, `${option.id} ${key}`);
    }
    for (const [key, value] of Object.entries(prior.supply?.cost || {})) assert.ok(option.supply.cost[key] >= value);
  }
});

test('H6: Cinder muster law checks each gate, Ironshield remains at its original law', () => {
  for (const fail of [g => g.state.vlevel = 9, g => g.world.renown = 3,
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

test('H6: scout and outer-work ledgers are independent and reads never create a shelf', () => {
  const g = ready(), before = JSON.stringify(g.world);
  assert.deepEqual(conquestState(g.world, tribe), {scouted:false,preliminaries:[],assaultWon:false,annexed:null});
  assert.equal(JSON.stringify(g.world), before);
  assert.match(assaultReason(g.state, data, tribe), /Scout/);
  assert.equal(g.scoutTribe(tribe).ok, true);
  assert.equal(g.scoutTribe(tribe), undefined);
  recordPreliminary(g.world, 'ironshield-patrol'); recordPreliminary(g.world, 'ironshield-watch');
  assert.match(assaultReason(g.state, data, tribe), /outer works/);
  for (const id of ['cinder-slags','cinder-forge']) {
    recordPreliminary(g.world, id, tribe); recordPreliminary(g.world, id, tribe);
  }
  assert.deepEqual(conquestState(g.world, tribe).preliminaries, ['cinder-slags','cinder-forge']);
  assert.deepEqual(conquestState(g.world).preliminaries, ['ironshield-patrol','ironshield-watch']);
  assert.equal(assaultReason(g.state, data, tribe), null);
});

test('H6: real first-clears route to Cinder; replay and defeat leave rewards and ledger alone', () => {
  const g = ready(); g.scoutTribe(tribe);
  for (const id of ['cinder-slags','cinder-forge']) {
    g.mission(id); assert.ok(g.state.mission);
    g.state.mission.status = 'won'; assert.equal(finishMission(g.state, data).first, true);
  }
  assert.deepEqual(conquestState(g.world).preliminaries, []);
  assert.deepEqual(conquestState(g.world, tribe).preliminaries, ['cinder-slags','cinder-forge']);
  const before = JSON.stringify(g.world);
  g.mission('cinder-forge'); g.state.mission.status = 'won';
  assert.equal(finishMission(g.state, data).first, false);
  assert.equal(JSON.stringify(g.world), before);
  const loser = ready(); loser.mission('cinder-slags'); loser.state.mission.status = 'lost';
  finishMission(loser.state, data);
  assert.equal(loser.world.conquest, undefined);
});

test('H6: assault charges only a successful departure, spawns Sorr, records only Cinder', () => {
  const g = marchReady(), before = {...g.world.resources};
  g.mission('cinder-citadel'); assert.ok(g.state.mission);
  for (const [key, value] of Object.entries(mission('cinder-citadel').launchCost)) {
    assert.equal(g.state.home.resources[key], before[key] - value);
  }
  g.world.elapsed = 300; tickMission(g.state, data);
  assert.ok(g.world.enemies.some(e => e.bossId === 'cinder-sorr'));
  assert.match(g.state.mission.herald, /SORR/);
  g.state.mission.status = 'won'; finishMission(g.state, data);
  assert.equal(conquestState(g.world, tribe).assaultWon, true);
  assert.equal(conquestState(g.world).assaultWon, false);
  for (const block of ['short','raid','chain','unscouted','outer works','law']) {
    const h = marchReady();
    if (block === 'short') h.world.resources.bread = 1199;
    if (block === 'raid') h.world.enemies.push({hp: 10});
    if (block === 'chain') h.state.completed = [];
    if (block === 'unscouted') h.world.conquest.tribes.cinder.scouted = false;
    if (block === 'outer works') h.world.conquest.tribes.cinder.preliminaries = [];
    if (block === 'law') h.world.renown = 3;
    const stores = {...h.world.resources};
    h.mission('cinder-citadel');
    assert.equal(h.state.mission, null, block); assert.equal(h.state.home, null, block);
    assert.deepEqual(h.world.resources, stores, block);
  }
});

test('H6: Sorr uses slam, breaker summons and enrage without joining home crown rotation', () => {
  const spec = bossSpec(data, 'cinder-sorr');
  assert.equal(spec.name, 'Furnace-Captain Sorr'); assert.equal(spec.hpBase, 1900); assert.equal(spec.dmgBase, 68);
  const legacy = {...data, conquest: {...data.conquest, leaders: data.conquest.leaders.filter(l => l.id !== spec.id)}};
  for (let wave = 1; wave <= 100; wave++) assert.deepEqual(bossFor(data, 10, wave), bossFor(legacy, 10, wave));
  const w = createWorld(data);
  const foe = {id:'sorr',x:7.5,y:5.5,hp:250,maxHp:1000,damage:68,role:'boss',bossId:spec.id,attackTimer:0,animation:0,summonTimer:99,slamTimer:99};
  w.enemies.push(foe);
  const events = bossTick(w, data, foe, 0.1);
  for (const kind of ['slam','summon','enrage']) assert.ok(events.some(e => e.kind === kind), kind);
  assert.ok(w.enemies.some(e => e.role === 'breaker')); assert.equal(foe.damage, 102);
});

test('H6: each tribe has one annex judgement, salvage uses storage caps and pending rewards', () => {
  const g = ready(); recordAssault(g.world);
  assert.equal(applyAnnex(g.state, data, 'outpost', tribe).ok, false);
  assert.equal(g.annex('outpost'), true);
  const iron = JSON.stringify(conquestState(g.world));
  recordAssault(g.world, tribe);
  g.world.resources = Object.fromEntries(Object.keys(g.world.resources).map(k => [k, 0]));
  assert.equal(g.annex('dismantle', tribe), true);
  assert.equal(g.world.resources.lumber, 1200); assert.equal(g.world.pendingRewards.lumber, 4800);
  assert.equal(g.world.resources.gold, 4500); assert.equal(g.world.pendingRewards.gold, 500);
  assert.equal(g.world.resources.plate, 750);
  assert.equal(g.world.resources.frostwood, 450);
  assert.equal(applyAnnex(g.state, data, 'settlement', tribe).ok, false);
  assert.equal(JSON.stringify(conquestState(g.world)), iron);
});

test('H6: both outposts stack limits, pay independent upkeep and suppress only unpaid auras', () => {
  const g = ready(); annexBoth(g);
  assert.equal(conquestLimitBonus(g.world, data), 4);
  assert.equal(buildingLimit('farm', 10, data, 4), buildingLimit('farm', 10, data) + 4);
  assert.equal(buildingLimit('wall', 10, data, 4), Infinity);
  assert.deepEqual(territorySupplyCost(g.world, data), {food:1800,bread:100,gold:240,plate:20});
  const before = {...g.world.resources};
  g.world.elapsed = 180; const result = tickTownSupply(g.world, data);
  for (const [key, value] of Object.entries(result.territoryCost)) {
    assert.equal(g.world.resources[key], before[key] - value - (result.cost[key] || 0));
  }
  assert.equal(territorySupplied(g.world, data), true);
  assert.deepEqual(conquestAuraEffects(g.world, data), {armor:0.03,heal:0.2,damage:0.04});
  const paid = {...g.world.resources}; assert.equal(tickTownSupply(g.world, data), null);
  assert.deepEqual(g.world.resources, paid);
  g.world.elapsed = 360; g.world.resources.plate = 8;
  const notes = []; tickTownSupply(g.world, data, n => notes.push(n));
  assert.equal(g.world.resources.plate, 0);
  assert.equal(g.world.conquest.supplied, true);
  assert.equal(g.world.conquest.tribes.cinder.supplied, false);
  assert.equal(territorySupplied(g.world, data, 'ironshield'), true);
  assert.equal(territorySupplied(g.world, data), false);
  assert.deepEqual(conquestAuraEffects(g.world, data), {armor:0.03,heal:0.1});
  assert.equal(conquestLimitBonus(g.world, data), 4);
  assert.equal(notes.length, 1);
  g.world.elapsed = 540; tickTownSupply(g.world, data, n => notes.push(n));
  assert.equal(notes.length, 2, 'Ironshield loses coverage once, Cinder does not repeat');
  g.world.resources.plate = 100; g.world.elapsed = 720; tickTownSupply(g.world, data);
  assert.equal(territorySupplied(g.world, data), true);
});

test('H6: both settlements use their own supply baskets and existing aura keys', () => {
  const g = ready(); annexBoth(g, 'settlement');
  assert.equal(conquestLimitBonus(g.world, data), 2);
  assert.deepEqual(territorySupplyCost(g.world, data), {food:2200,gold:240,lumber:200});
  g.world.elapsed = 180; tickTownSupply(g.world, data);
  assert.deepEqual(conquestAuraEffects(g.world, data), {gather:0.08,food:0.8});
  g.world.conquest.supplied = false;
  assert.deepEqual(conquestAuraEffects(g.world, data), {gather:0.05,food:0.4});
});

test('H6: Ironshield-only ledgers and daily outcomes remain byte-identical with added content', () => {
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

test('H6: local saves and imports round-trip both shelves; absent Cinder stays absent', () => {
  const g = marchReady(); annexBoth(g);
  g.world.elapsed = 180; tickTownSupply(g.world, data);
  assert.equal(save(g.state), true);
  assert.deepEqual(load(data).world.conquest, g.world.conquest);
  const blob = exportSave(g.state), imported = importSaveBlob(blob, data);
  assert.equal(imported.ok, true); assert.equal(imported.state.version, VERSION);
  assert.deepEqual(imported.state.world.conquest, g.world.conquest);
  delete g.world.conquest.tribes.cinder.supplied;
  assert.equal(importSaveBlob(exportSave(g.state), data).state.world.conquest.tribes.cinder.supplied, false);
  assert.equal(save(g.state), true); assert.equal(load(data).world.conquest.tribes.cinder.supplied, false);
  const old = ready(); old.scoutTribe(); old.world.conquest.supplied = false;
  const before = JSON.stringify(old.world.conquest);
  assert.equal(JSON.stringify(importSaveBlob(exportSave(old.state), data).state.world.conquest), before);
  assert.equal(conquestState(old.world, tribe).scouted, false);
  assert.equal(old.world.conquest.tribes, undefined);
});

test('H6: Adventure exposes separate scouting, mission and annex controls for both tribes', () => {
  const g = ready(), ui = Object.create(UI.prototype);
  let html = ui.homeBlock(g);
  assert.match(html, /data-scout-tribe="ironshield"/); assert.match(html, /data-scout-tribe="cinder"/);
  g.scoutTribe(); g.scoutTribe(tribe);
  html = ui.homeBlock(g);
  assert.match(html, /data-mission="cinder-slags"/); assert.match(html, /Furnace-Captain Sorr/);
  recordAssault(g.world); recordAssault(g.world, tribe);
  html = ui.homeBlock(g);
  assert.match(html, /data-annex="outpost" data-tribe="ironshield"/);
  assert.match(html, /data-annex="outpost" data-tribe="cinder"/);
});

test('H6: Ironshield and Thornband outcomes stay byte-identical to the H5 data', () => {
  const legacy = {...data, conquest: {...data.conquest,
    tribes: data.conquest.tribes.filter(t => t.id !== tribe),
    leaders: data.conquest.leaders.filter(l => l.id !== 'cinder-sorr')},
    missions: data.missions.filter(m => m.tribe !== tribe)};
  for (const id of ['ironshield','thornband']) for (const choice of ['outpost','settlement','dismantle']) {
    const modern = ready(), old = new Game(legacy);
    old.state = structuredClone(modern.state);
    assert.deepEqual(modern.scoutTribe(id), old.scoutTribe(id));
    const definition = id === 'ironshield' ? data.conquest.tribe : data.conquest.tribes[0];
    for (const p of definition.preliminaries) {
      recordPreliminary(modern.world, p.id, id); recordPreliminary(old.world, p.id, id);
    }
    recordAssault(modern.world, id); recordAssault(old.world, id);
    assert.deepEqual(applyAnnex(modern.state, data, choice, id), applyAnnex(old.state, legacy, choice, id));
    for (const elapsed of [180,180,360,1800]) {
      modern.world.elapsed = old.world.elapsed = elapsed;
      if (elapsed === 360) modern.world.resources.food = old.world.resources.food = 0;
      const a = [], b = [];
      assert.deepEqual(tickTownSupply(modern.world, data, n => a.push(n)), tickTownSupply(old.world, legacy, n => b.push(n)));
      assert.equal(JSON.stringify(modern.world), JSON.stringify(old.world)); assert.deepEqual(a,b);
      assert.deepEqual(conquestAuraEffects(modern.world, data), conquestAuraEffects(old.world, legacy));
      assert.equal(conquestLimitBonus(modern.world, data), conquestLimitBonus(old.world, legacy));
      assert.equal(modern.world.conquest.tribes?.cinder, undefined);
    }
  }
});

test('H6: three territories pay separately, only Cinder loses coverage, and all shelves persist', () => {
  const g = ready();
  for (const id of ['ironshield','thornband',tribe]) {
    g.scoutTribe(id); recordAssault(g.world,id);
    assert.equal(applyAnnex(g.state,data,'outpost',id).ok,true);
  }
  assert.equal(conquestLimitBonus(g.world,data),6);
  assert.deepEqual(territorySupplyCost(g.world,data),{food:2700,bread:150,gold:360,plate:30});
  g.world.elapsed=180; tickTownSupply(g.world,data);
  assert.deepEqual(conquestAuraEffects(g.world,data),{armor:0.03,heal:0.30000000000000004,damage:0.07});
  const older = JSON.stringify([conquestState(g.world),conquestState(g.world,'thornband')]);
  g.world.elapsed=360; g.world.resources.plate=18;
  const notes=[]; tickTownSupply(g.world,data,n=>notes.push(n));
  assert.equal(g.world.resources.plate,0);
  assert.equal(territorySupplied(g.world,data,'ironshield'),true);
  assert.equal(territorySupplied(g.world,data,'thornband'),true);
  assert.equal(territorySupplied(g.world,data,tribe),false);
  assert.equal(JSON.stringify([conquestState(g.world),conquestState(g.world,'thornband')]),older);
  assert.deepEqual(conquestAuraEffects(g.world,data),{armor:0.03,heal:0.2,damage:0.03});
  assert.equal(conquestLimitBonus(g.world,data),6); assert.equal(notes.length,1);
  assert.equal(save(g.state),true);
  assert.deepEqual(load(data).world.conquest,g.world.conquest);
  assert.deepEqual(importSaveBlob(exportSave(g.state),data).state.world.conquest,g.world.conquest);
  g.world.elapsed=540; g.world.resources.plate=30; tickTownSupply(g.world,data);
  assert.equal(territorySupplied(g.world,data),true);
});
