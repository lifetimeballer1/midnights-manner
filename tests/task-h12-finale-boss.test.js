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
import {bossSpec, bossFor, bossTick} from '../src/systems/endgame.js';
const id = 'grey-dawn-crown';
const mission = data.missions.find(m => m.id === id);
const baseline = {...data, missions:data.missions.filter(m => m.id !== id),
  conquest:{...data.conquest, leaders:data.conquest.leaders.filter(l => l.id !== 'grey-sovereign')}};
const tribes = ['ironshield','thornband','cinder','palehost','ember'];
function ready(d = data) {
  const g = new Game(d);
  g.state.vlevel = 11; g.state.completed = ['grey-dawn-road']; g.world.renown = 6;
  const b = g.world.buildings.find(b => b.type === 'barracks');
  b.level = 3; b.hp = d.buildings.barracks.tiers[2].hp; b.remaining = 0;
  g.world.troops = Array.from({length:14}, () => makeUnit('warrior', d));
  g.world.resources = Object.fromEntries(['wood','food','gold','lumber','plate','frostwood','flour','bread'].map(k => [k,99999]));
  return g;
}

test('H12: pins preserve all 33 earlier missions, five leaders and every conquest field', () => {
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.equal(baseline.missions.length, 33);
  assert.equal(hash(baseline.missions), 'ac3eed83c6d33c238885b58cd651848b80407ff30f808ba7024c02431db524d3');
  assert.equal(baseline.conquest.leaders.length, 5);
  assert.equal(hash(baseline.conquest), '6675d38e4c67c87993f1a7fd21e0e770529631167d7f5dc8f4ad4260b42f6491');
  assert.equal(hash(data.conquest.tribes), '36489cbcf51f49178b7dde19ae3c26dbed9d397088808182e7c17c035a3ee59b');
});

test('H12: chapter 33 chains from the Grey Road and completes the 34-mission campaign', () => {
  assert.equal(data.missions.length, 34);
  assert.equal(Math.max(...data.missions.map(m => Number(m.chapter))), 33);
  assert.equal(data.conquest.leaders.length, 6);
  assert.equal(mission.name, 'The Grey Dawn Crown');
  assert.equal(mission.chapter, '33'); assert.equal(mission.act, 'X');
  assert.equal(mission.giver, 'Sorrel the watcher');
  assert.deepEqual(mission.requires, ['grey-dawn-road']);
  assert.ok(missionLockReason(mission, [], ready().world, data));
  assert.ok(missionLockReason(mission, ['grey-dawn-muster'], ready().world, data));
  assert.equal(missionLockReason(mission, ['grey-dawn-road'], ready().world, data), null);
});

test('H12: exact plains assault, war chest, scaling and largest reward basket', () => {
  const keep = data.missions.find(m => m.id === 'ironshield-keep');
  const throne = data.missions.find(m => m.id === 'ember-throne');
  assert.equal(mission.map.biome, 'plains'); assert.equal(mission.map.seed, 3311);
  assert.deepEqual(mission.map.tiles, [{x:12,y:5,biome:'plains',landmark:'Crown Ridge',claimed:true}]);
  assert.deepEqual(mission.map.buildings, keep.map.buildings);
  assert.deepEqual(mission.map.troops, ['oathsworn','halberdier','pikewoman','longbowman','archer','builder','miner']);
  assert.deepEqual(mission.objectives, [{kind:'defeat',amount:30},{kind:'protect',type:'oathstone',count:1},{kind:'survive',seconds:360}]);
  assert.equal(mission.timeLimit, 420); assert.equal(mission.troopLimit, 10);
  assert.deepEqual(mission.startingResources, {wood:380,food:240,gold:180});
  assert.deepEqual(mission.launchCost, {food:10000,bread:2000,lumber:6500,plate:1000,gold:6000});
  assert.deepEqual(mission.raids.slice(0,3), [{at:60,count:7},{at:150,count:9},{at:230,count:10}]);
  assert.equal(mission.raids[3].at, 300); assert.equal(mission.raids[3].count, 12);
  assert.equal(mission.raids[3].boss, 'grey-sovereign');
  assert.match(mission.raids[3].herald, /THE GREY SOVEREIGN/);
  assert.deepEqual(mission.scaling, {hp:36,damage:7});
  assert.deepEqual(mission.rewards, {gold:8000,lumber:4500,plate:1200,frostwood:800});
  for (const [k,v] of Object.entries(mission.launchCost)) assert.ok(v > throne.launchCost[k]);
  for (const m of baseline.missions) for (const [k,v] of Object.entries(mission.rewards)) assert.ok(v > (m.rewards[k] || 0));
  for (const key of ['conquest','tribe','log','destination']) assert.equal(Object.hasOwn(mission,key), false);
  assert.deepEqual(mission.unlocks, []);
  for (const key of ['warning','victory','defeat']) assert.ok(mission.ceremony[key].includes('Sorrel'));
});

test('H12: successful departure pays once; six refused departures mutate nothing', () => {
  const g = ready(), home = g.world, before = {...home.resources};
  g.mission(id); assert.equal(g.state.mission.id, id); assert.equal(g.state.home, home);
  for (const [k,v] of Object.entries(before)) assert.equal(home.resources[k], v - (mission.launchCost[k] || 0));
  assert.equal(home.conquest, undefined);
  for (const cause of ['bread','plate','raid','pending','chain','hall']) {
    const h = ready();
    if (cause === 'bread' || cause === 'plate') h.world.resources[cause] = mission.launchCost[cause] - 1;
    if (cause === 'raid') h.world.enemies.push({id:'live',hp:1});
    if (cause === 'pending') h.world.raidPending = {timer:3,count:3};
    if (cause === 'chain') h.state.completed = [];
    if (cause === 'hall') h.world.buildings.find(b => b.type === 'hall').hp = 0;
    const snapshot = JSON.stringify(h.world);
    h.mission(id);
    assert.equal(h.state.mission, null, cause); assert.equal(h.state.home, null, cause);
    assert.equal(JSON.stringify(h.world), snapshot, cause);
    assert.equal(h.world.conquest, undefined);
  }
  const charged = JSON.stringify(home);
  g.mission(id); assert.equal(JSON.stringify(home), charged, 'already-away refusal never pays again');
});

test('H12: wave-four Sovereign uses exact stats, slam, capped breakers and one-time enrage', () => {
  const spec = bossSpec(data, 'grey-sovereign');
  assert.deepEqual(spec, {id:'grey-sovereign',name:'The Grey Sovereign',title:'Crown of the Grey Dawn',hpBase:2700,hpPerWave:140,dmgBase:92,dmgPerWave:5.5,speed:0.6,range:1.4,wallDamage:4,mechanics:{slam:{damage:72,radius:1.7,everySec:7},summon:{role:'breaker',count:2,everySec:20,cap:6},enrage:{hpFrac:0.3,dmgMult:1.5}}});
  for (let wave = 1; wave <= 100; wave++) {
    assert.deepEqual(bossFor(data, 11, wave), bossFor(baseline, 11, wave));
    assert.notEqual(bossFor(data, 11, wave)?.id, spec.id);
  }
  const g = ready(); g.mission(id);
  for (const [i,raid] of mission.raids.entries()) {
    g.world.enemies = []; g.world.elapsed = raid.at; tickMission(g.state, data);
    assert.equal(g.world.wave, i + 1);
    assert.equal(g.world.enemies.length, raid.count + (i === 3 ? 1 : 0));
    if (i < 3) assert.ok(g.world.enemies.every(e => !e.bossId));
  }
  assert.match(g.state.mission.herald, /THE GREY SOVEREIGN/);
  const boss = g.world.enemies.find(e => e.bossId === spec.id);
  assert.equal(boss.hp, 3260); assert.equal(boss.damage, 114);
  assert.equal(boss.speed, 0.6); assert.equal(boss.range, 1.4); assert.equal(boss.wallDamage, 4);
  const wall = g.world.buildings.find(b => b.type === 'stonewall'), hp = wall.hp;
  boss.x = wall.x + 0.5; boss.y = wall.y + 0.5; boss.hp = boss.maxHp * 0.3;
  boss.slamTimer = 7; boss.summonTimer = 20;
  const events = bossTick(g.world, data, boss, 0.1);
  for (const kind of ['slam','summon','enrage']) assert.ok(events.some(e => e.kind === kind));
  assert.equal(wall.hp, hp - 72); assert.equal(boss.damage, 171);
  for (let i = 0; i < 4; i++) bossTick(g.world, data, boss, 20);
  assert.equal(g.world.enemies.filter(e => e.summoned).length, 6);
  assert.ok(g.world.enemies.filter(e => e.summoned).every(e => e.role === 'breaker'));
  assert.equal(boss.damage, 171, 'enrage never stacks');
});

test('H12: objectives and all waves gate first-clear rewards; replay and losses never pay rewards or ledger', () => {
  const g = ready(); g.world.resources = {...mission.launchCost};
  const home = g.world; g.mission(id);
  g.world.elapsed = 59; tickMission(g.state, data); assert.deepEqual(g.state.mission.fired, []);
  g.world.elapsed = 299; g.world.raidKills = 30; tickMission(g.state, data);
  g.world.enemies = []; tickMission(g.state, data); assert.equal(g.state.mission.status, 'active');
  g.world.elapsed = 300; tickMission(g.state, data); assert.equal(g.state.mission.status, 'active');
  g.world.enemies = []; g.world.elapsed = 359; tickMission(g.state, data); assert.equal(g.state.mission.status, 'active');
  g.world.elapsed = 360; g.world.raidKills = 29; tickMission(g.state, data); assert.equal(g.state.mission.status, 'active');
  const stone = g.world.buildings.find(b => b.type === 'oathstone'), stoneHp = stone.hp;
  g.world.raidKills = 30; stone.hp = 0; tickMission(g.state, data); assert.equal(g.state.mission.status, 'active');
  stone.hp = stoneHp; tickMission(g.state, data); assert.equal(g.state.mission.status, 'won');
  assert.deepEqual(finishMission(g.state, data), {won:true,first:true}); assert.equal(g.world, home);
  assert.deepEqual(g.state.completed, ['grey-dawn-road',id]);
  for (const [k,v] of Object.entries(mission.rewards)) assert.equal((home.resources[k] || 0) + (home.pendingRewards?.[k] || 0), v);
  assert.ok(home.pendingRewards.lumber > 0); assert.equal(home.conquest, undefined);
  for (const cause of ['replay','defeat','timeout','hall']) {
    const h = ready(); if (cause === 'replay') h.state.completed.push(id);
    const completed = [...h.state.completed], unlocks = [...h.state.unlocks];
    h.mission(id); const departed = JSON.stringify(h.state.home);
    if (cause === 'replay') h.state.mission.status = 'won';
    else if (cause === 'defeat') h.state.mission.status = 'lost';
    else {
      if (cause === 'timeout') h.world.elapsed = 420;
      else h.world.buildings.find(b => b.type === 'hall').hp = 0;
      tickMission(h.state, data); assert.equal(h.state.mission.status, 'lost');
    }
    assert.deepEqual(finishMission(h.state, data), {won:cause === 'replay',first:false});
    assert.equal(JSON.stringify(h.world), departed, cause);
    assert.deepEqual(h.state.completed, completed); assert.deepEqual(h.state.unlocks, unlocks);
    assert.equal(h.world.conquest, undefined);
  }
});

test('H12: chapters 30-32 still depart free and retain byte-identical clear, replay and loss outcomes', () => {
  for (const mid of ['grey-dawn-gathers','grey-dawn-muster','grey-dawn-road']) for (const status of ['won','lost','active']) {
    const modern = ready(), old = ready(baseline), m = data.missions.find(m => m.id === mid);
    modern.state.completed = [...m.requires];
    modern.world.resources = Object.fromEntries(Object.keys(modern.world.resources).map(k => [k,0]));
    old.state = structuredClone(modern.state);
    const before = JSON.stringify(modern.world);
    modern.mission(mid); old.mission(mid);
    assert.equal(modern.state.mission.id, mid);
    assert.equal(JSON.stringify(modern.state.home), before, 'no launchCost means free departure');
    assert.deepEqual(modern.state.mission, old.state.mission);
    assert.equal(JSON.stringify(modern.state.home), JSON.stringify(old.state.home));
    modern.state.mission.status = old.state.mission.status = status;
    assert.deepEqual(finishMission(modern.state, data), finishMission(old.state, baseline));
    assert.equal(JSON.stringify(modern.state), JSON.stringify(old.state));
    if (status === 'won') {
      const paid = JSON.stringify(modern.world);
      modern.mission(mid); old.mission(mid);
      modern.state.mission.status = old.state.mission.status = 'won';
      assert.deepEqual(finishMission(modern.state, data), {won:true,first:false});
      finishMission(old.state, baseline);
      assert.equal(JSON.stringify(modern.world), paid);
      assert.equal(JSON.stringify(modern.state), JSON.stringify(old.state));
    }
  }
});

test('H12: all five tribes retain byte-identical scout, clear, annex and daily supply outcomes', () => {
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
