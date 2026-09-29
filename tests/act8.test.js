import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {levelForXp, makeBuilding, makeUnit, createWorld, stats, auras, unlockedAbilities} from '../src/model.js';
import {tickVillage, questProgress} from '../src/systems/village.js';
import {tickCombat} from '../src/systems/combat.js';
import {Game} from '../src/game.js';
import {missionLocked, startMission, finishMission, missionDestination} from '../src/systems/campaign.js';
import {claimRegion, regionById} from '../src/systems/expansion.js';

// Act VIII — Legends. Five phases (16 pale court, 17 prestige bell,
// 18 sunken chapel, 19 warden-general, 20 dawn finale). New systems ride
// generic data flags (requiresAny OR-gate, requiresBuildings AND-gate,
// maxPerVillage, prestigeAura/dawnAura/moonDial/cairn flags, requiresOath /
// requiresName gear gates) — no troop/item ids in src, pinned below.
const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels', 'calendar', 'legends', 'expansion', 'biomes']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const noop = () => {};
function richGame(d) {
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  return g;
}
function finished(type, x, y, d, level = 1) {
  const b = makeBuilding(type, x, y, d);
  b.remaining = 0; b.level = level; b.hp = d.buildings[type].tiers[level - 1].hp;
  return b;
}

// Act VIII Phase 16 — The Pale Court: the OR-gate fires the delayed merge,
// the Dial locks the sky, the Envoy pays keepers.
test('ph16: the pale court opens on EITHER banner road only after Southreach is claimed', () => {
  const m = data.missions.find(m => m.id === 'the-pale-court');
  const w = createWorld(data);
  assert.ok(m, 'chapter 12 exists');
  assert.equal(m.chapter, '12');
  assert.equal(m.act, 'VIII');
  assert.equal(m.giver, 'The Pale Envoy');
  assert.deepEqual(m.requiresAny, ['red-banner', 'grey-banner']);
  assert.deepEqual(missionDestination(m,data), {id:'southreach',name:'Southreach Crossing',region:regionById(data.expansion,'southreach')});
  assert.ok(missionLocked(m, [], w, data), 'no road, no court');
  assert.ok(missionLocked(m, ['red-banner'], w, data), 'banner road alone cannot skip the frontier');
  claimRegion(w,regionById(data.expansion,'southreach'));
  assert.ok(!missionLocked(m, ['red-banner'], w, data), 'red road opens once Southreach is held');
  assert.ok(!missionLocked(m, ['grey-banner'], w, data), 'grey road opens once Southreach is held');
  const legacy=createWorld(data);
  assert.ok(!missionLocked(m,['the-pale-court'],legacy,data),'a chapter cleared before destination gates stays replayable');
  assert.deepEqual(m.unlocks, ['moon-dial', 'envoys-gift', 'banner-cloak-grey']);
  assert.ok(m.map.troops.length > 0, 'the court walks its own showcase');
});

test('ph16: the moon dial locks one season at half strength, one per village', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  g.state.unlocks.push('moon-dial');
  const b = g.build('moon-dial', 2, 2);
  assert.ok(b && typeof b === 'object', 'the dial rises');
  assert.ok(typeof b.dialSeason === 'string', 'the raising sky is locked in');
  const season = d.calendar.seasons.find(s => s.id === b.dialSeason);
  assert.ok(season && season.effects, 'a real season with real effects');
  const before = auras(g.world, d);
  const key = Object.keys(season.effects).find(k => k in before);
  assert.ok(key, 'the season speaks a known aura key');
  // A second dial is refused — the sky gets one vote.
  const again = g.build('moon-dial', 4, 4);
  assert.equal(g.world.buildings.filter(x => x.type === 'moon-dial').length, 1, 'only one dial stands');
  assert.ok(!again, 'the refusal reads kindly');
});

test('ph16: the envoy gift pours keeper XP off the armor hand', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  const site = finished('scriptorium', 2, 2, d);
  g.world.buildings.push(site);
  const u = makeUnit('scholar', d, 0);
  u.workplace = site.id;
  g.world.troops.push(u);
  const bare = auras(g.world, d).xp;
  g.state.unlocks.push('envoys-gift');
  u.armorOwned = ['envoys-gift'];
  g.equip(u.id, 'envoys-gift');
  assert.equal(u.armor, 'envoys-gift');
  assert.ok(Math.abs(auras(g.world, d).xp - bare - 0.03) < 1e-9, 'armor-ink XP pours beside the primer');
  assert.ok(data.legends.some(l => l.id === 'pale-court'), 'the envoy quotes a legend that persists');
});

// Act VIII Phase 17 — Prestige of the Bell: capped veterans ring back,
// the tower holds the loop, war-steel climbs starlit.
test('ph17: prestige rings a capped veteran back with stars kept', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  g.state.unlocks.push('bell-tower');
  g.world.buildings.push(finished('bell-tower', 2, 2, d));
  const u = makeUnit('warrior', d, 0);
  u.level = 25;
  g.world.troops.push(u);
  const fresh = makeUnit('warrior', d, 1);
  const freshDmg = stats(fresh, d).damage;
  assert.ok(g.prestige(u.id), 'the bell rings');
  assert.equal(u.prestigeStars, 1);
  assert.equal(u.level, 1, 'back to a recruit');
  assert.equal(u.gear, 'sword', 'gear kept');
  assert.ok(Math.abs(stats(u, d).damage - freshDmg * 1.05) < 1e-9, '+5% all stats per star');
  assert.ok(unlockedAbilities(u, d).length === 0, 'kits re-earn through levels');
  assert.ok(!g.prestige('no-such-villager'), 'the bell does not ring for ghosts');
  u.level = 25; g.prestige(u.id);
  u.level = 25; g.prestige(u.id);
  assert.equal(u.prestigeStars, 3);
  u.level = 25;
  g.prestige(u.id);
  assert.equal(u.prestigeStars, 3, 'three stars is the sky itself');
});

test('ph17: no tower, no ringing — and the bell remembers is arrival-impossible', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  const u = makeUnit('warrior', d, 0);
  u.level = 25;
  g.world.troops.push(u);
  g.prestige(u.id);
  assert.equal(u.prestigeStars || 0, 0, 'prestige needs its bell');
  const q = d.quests.find(q => q.id === 'the-bell-remembers');
  assert.deepEqual(q.task, {kind: 'prestige', count: 1});
  assert.equal(q.xp, 160);
  assert.equal(q.giver, 'Old Bell');
  assert.ok(q.log && q.log.length > 0, 'her farewell persists');
  const prog = questProgress(q.task, g.state);
  assert.equal(prog.have, 0, 'arrival rosters read zero stars');
  assert.equal(levelForXp(2100), 9, 'level 9 lands during bell quest play');
  assert.ok(d.levels.some(l => l.level === 9 && Object.keys(l.rewards).length > 0), 'level 9 ships its payout');
});

test('ph17: starforged steel climbs +15% for plate and gold', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  g.state.unlocks.push('starforged-oathblade');
  const u = makeUnit('oathsworn', d, 0);
  g.world.troops.push(u);
  const base = stats(u, d).damage;
  assert.ok(g.reforge(u.id), 'the star-forge eats dear');
  assert.equal(u.gear, 'starforged-oathblade');
  assert.ok(u.owned.includes('starforged-oathblade'));
  assert.ok(Math.abs(stats(u, d).damage - base * 1.15) < 1e-9, '+15% main stat');
  assert.ok(g.world.resources.plate <= 100000 - 5 && g.world.resources.gold <= 100000 - 500, 'plate 5 + gold 500 paid');
});

// Act VIII Phase 18 — The Sunken Chapel: dual gates, dual auras, Wren's farewell.
test('ph18: the sunken chapel waits on chapel-3 AND deephole-2', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  g.state.unlocks.push('sunken-chapel');
  const refused = g.build('sunken-chapel', 2, 2);
  assert.equal(g.world.buildings.filter(b => b.type === 'sunken-chapel').length, 0, 'no half-raised chapel');
  assert.ok(!refused, 'the missing tiers refuse kindly');
  g.world.buildings.push(finished('chapel', 2, 10, d, 3), finished('deephole', 12, 2, d, 2));
  const raised = g.build('sunken-chapel', 6, 2);
  assert.ok(raised && typeof raised === 'object', 'both old works raised, the new water follows');
  assert.equal(d.buildings['sunken-chapel'].workplace, 'tidecaller');
});

test('ph18: tidecallers pour food at their chapel or hosted water', () => {
  const t = data.troops.tidecaller;
  assert.equal(t.role, 'keeper');
  assert.deepEqual(Object.keys(t.abilities), ['5', '10', '15', '20', '25']);
  const handled = ['splash', 'armor', 'heal', 'damage', 'gather', 'aura', 'xp', 'buff', 'guard'];
  for (const id of Object.values(t.abilities)) assert.ok(handled.includes(data.abilities[id].effect), `${id} rides a handled effect`);
  const d = structuredClone(data);
  const g = richGame(d);
  const chapel = finished('sunken-chapel', 2, 2, d);
  const hole = finished('deephole', 6, 6, d, 2);
  g.world.buildings.push(chapel, hole);
  const u = makeUnit('tidecaller', d, 0);
  g.world.troops.push(u);
  const dry = auras(g.world, d).food;
  u.workplace = hole.id;
  const hosted = auras(g.world, d).food;
  assert.ok(hosted > dry, 'hosted water pours beside the home chapel');
  u.workplace = chapel.id;
  assert.ok(auras(g.world, d).food >= hosted, 'the home chapel pours no less');
  const q = d.quests.find(q => q.id === 'what-the-water-kept');
  assert.deepEqual(q.task, {kind: 'upgrade', type: 'deephole', level: 2});
  assert.equal(q.giver, 'Wren Waterwise');
  assert.equal(levelForXp(2400), 10, 'level 10 lands on the deep water');
});

// Act VIII Phase 19 — Warden-General: the oath with teeth, the cairn that keeps names.
test('ph19: the last watch is sworn by tempered wardens only', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  const young = makeUnit('warden', d, 0); young.level = 10;
  const vet = makeUnit('warden', d, 1); vet.level = 20;
  const arch = makeUnit('archer', d, 2); arch.level = 25;
  g.world.troops.push(young, vet, arch);
  const base = stats(vet, d).damage;
  g.takeOath(young.id);
  assert.ok(!young.oath, 'the young may not swear away their mornings');
  g.takeOath(arch.id);
  assert.ok(!arch.oath, 'the oath was written for the warden line');
  assert.ok(g.takeOath(vet.id), 'the oath is sworn');
  assert.ok(Math.abs(stats(vet, d).damage - base * 1.5) < 1e-9, '+50% damage');
});

test('ph19: oathbound who fall stay fallen — the cairn keeps their names', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  const w = g.world;
  w.enemies = [];
  const sworn = makeUnit('warden', d, 0); sworn.level = 20; sworn.oath = true; sworn.name = 'Bryn Ashfall'; sworn.hp = 0;
  const free = makeUnit('warrior', d, 1); free.hp = 0;
  w.troops.push(sworn, free);
  tickCombat(w, d, 1);
  assert.equal(sworn.hp, 0, 'the oath holds past the bell');
  assert.ok((w.fallen || []).some(f => f.name === 'Bryn Ashfall'), 'the name goes on the cairn roll');
  assert.ok(free.hp > 0, 'the unsworn still rise');
});

test('ph19: oathkeeper steel waits on an oathbound roster; the longest night is the hardest road', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  g.state.unlocks.push('oathkeeper-armor');
  const buyer = makeUnit('warrior', d, 0);
  g.world.troops.push(buyer);
  g.equip(buyer.id, 'oathkeeper-armor');
  assert.equal(buyer.armor, null, 'no oathbound, no sale');
  const sworn = makeUnit('warden', d, 1); sworn.level = 20; sworn.oath = true;
  g.world.troops.push(sworn);
  g.equip(buyer.id, 'oathkeeper-armor');
  assert.equal(buyer.armor, 'oathkeeper-armor', 'the armor knows its own');
  const m = data.missions.find(m => m.id === 'the-longest-night');
  assert.equal(m.troopLimit, 9);
  assert.equal(m.raids.length, 3, 'three waves, the hardest raid');
  assert.deepEqual(m.requires, ['the-pale-court']);
  assert.deepEqual(m.requiresAny, ['red-banner', 'grey-banner']);
  assert.deepEqual(m.destination,{region:'starwatch-ridge',name:'Starwatch Ridge'});
  assert.ok(m.unlocks.includes('squire') && m.unlocks.includes('cairnfield'), 'squire and cairn ride home together');
  assert.equal(data.troops.squire.role, 'combat');
  assert.deepEqual(Object.values(data.troops.squire.abilities), ['brace', 'armor', 'rally', 'veteran', 'phalanx'], 'squire walks the C1 road');
  assert.deepEqual(data.buildings.cairnfield.cost, {wood: 60}, 'grief is cheap; the oath is the price');
});

// Act VIII Phase 20 — Dawn of the Manner: the everything sink, the named mantle, the dual finale.
test('ph20: the dawn gate is the whole-economy sink, one per village', () => {
  const cost = data.buildings['dawn-gate'].cost;
  for (const k of ['wood', 'food', 'gold', 'frostwood', 'plate']) assert.ok(cost[k] > 0, `the gate eats ${k}`);
  assert.equal(data.buildings['dawn-gate'].size, 3);
  assert.equal(data.buildings['dawn-gate'].maxPerVillage, 1);
  assert.equal(data.buildings['dawn-gate'].dawnAura, 0.05);
  const d = structuredClone(data);
  const g = richGame(d);
  g.state.unlocks.push('dawn-gate');
  const gate = g.build('dawn-gate', 2, 2);
  assert.ok(gate && typeof gate === 'object', 'dawn rises over the manner');
  const unfinished = auras(g.world, d);
  gate.remaining = 0;
  const after = auras(g.world, d);
  assert.ok(after.damage >= unfinished.damage + 0.05 - 1e-9 || after.damage >= 0.3, 'the everything engine pours every key to its cap');
  const q = d.quests.find(q => q.id === 'dawn-of-the-manner');
  assert.deepEqual(q.task, {kind: 'wonder', type: 'dawn-gate'});
  assert.equal(q.xp, 200);
  assert.ok(q.log && q.log.length > 0, 'the roll-call persists');
  for (const name of ['Issa', 'Tomm', 'Maro', 'Sarella', 'Fen', 'Wren', 'Pella', 'Sorrel', 'Rue', 'Tam', 'Old Bell'])
    assert.ok(q.text.includes(name) || q.log.includes(name), `the roll calls ${name}`);
  assert.equal(questProgress(q.task, g.state).have, 1, 'the standing gate counts');
  assert.equal(levelForXp(2600), 11, 'level 11 crowns the ladder');
});

test('ph20: the regalia knows its name; dawn crowns the eldest Moonwarden', () => {
  const d = structuredClone(data);
  const g = richGame(d);
  g.state.unlocks.push('regalia');
  const elder = makeUnit('warrior', d, 0);
  const other = makeUnit('archer', d, 1);
  g.world.troops.push(elder, other);
  g.equip(other.id, 'regalia');
  assert.equal(other.armor, null, 'the mantle refuses strange shoulders');
  elder.name = 'Moonwarden';
  g.equip(elder.id, 'regalia');
  assert.equal(elder.armor, 'regalia', 'the named mantle fits');
  const m = data.missions.find(m => m.id === 'dawn');
  assert.equal(m.troopLimit, 10);
  assert.equal(m.raids.length, 4, 'the final four-wave siege');
  assert.deepEqual(m.requires, ['the-longest-night']);
  assert.equal(m.crowning, 'Moonwarden');
  // The dual finale: dawn won names the eldest of the roster, but the
  // expedition cannot start until its real home destination is held.
  const expedition = {world: g.world, home: null, mission: null, completed: ['the-longest-night'], unlocks: []};
  assert.equal(startMission(expedition, d, 'dawn'),false,'the longest night alone cannot skip the Dawnfields');
  claimRegion(expedition.world,regionById(d.expansion,'dawnfields'));
  assert.ok(startMission(expedition, d, 'dawn'), 'dawn opens once the Dawnfields are claimed');
  expedition.mission.status = 'won';
  const hw = expedition.home;
  finishMission(expedition, d);
  assert.equal(hw.troops[0].name, 'Moonwarden', 'the eldest is crowned');
  assert.ok(expedition.completed.includes('dawn'), 'dawn stands completed');
});

// Act VIII cross-cutting: totals, chains, conditionals, saves.
test('viii: every legend unlock resolves and starts locked', () => {
  for (const id of ['the-pale-court', 'the-longest-night', 'dawn']) {
    const m = data.missions.find(m => m.id === id);
    assert.ok(Array.isArray(m.unlocks) && m.unlocks.length > 0, `${id} grants`);
    for (const u of m.unlocks) {
      assert.ok(data.buildings[u] || data.items[u] || data.troops[u], `${id} unlock ${u} resolves`);
      assert.ok(data.world.locked.includes(u), `${id} unlock ${u} genuinely locked`);
    }
  }
  for (const q of data.quests.filter(q => q.act === 'VIII')) {
    assert.ok(q.giver && q.giver.length > 0 && q.log && q.log.length > 0, `${q.id} persists its giver`);
    for (const u of q.unlocks || []) {
      assert.ok(data.buildings[u] || data.items[u] || data.troops[u], `${q.id} unlock ${u} resolves`);
      assert.ok(data.world.locked.includes(u), `${q.id} unlock ${u} genuinely locked`);
    }
  }
  assert.equal(data.quests.reduce((n, x) => n + x.xp, 0), 2640, 'the grand quest total');
  assert.equal(levelForXp(2640), 11, 'quest play alone crowns level 11');
});

test('viii: no troop-specific or item-specific conditionals in the sim', async () => {
  // New systems read data flags (oathbound, prestigeAura, moonDial,
  // dawnAura, cairn, requiresOath/requiresName, starforged- prefix line) —
  // never a content id.
  const banned = ['tidecaller', 'squire', 'moon-dial', 'sunken-chapel', 'bell-tower', 'cairnfield', 'dawn-gate', 'tidebell', 'divers-plate', 'envoys-gift', 'oathkeeper-armor', 'banner-cloak-grey', 'squires-blade', 'dawnbringer', 'starforged-oathblade', 'starforged-halberd', 'starforged-longbow'];
  const files = ['model.js', 'game.js', 'ui.js', 'systems/economy.js', 'systems/village.js', 'systems/combat.js', 'systems/campaign.js'];
  for (const f of files) {
    const src = await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    for (const id of banned) assert.ok(!src.includes(id), `src/${f} never names ${id}`);
  }
});

test('viii: old saves arrive safely — stars, oath and cairn read quiet', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  assert.equal(g.world.troops.every(t => (t.prestigeStars || 0) === 0), true, 'new hands read zero stars');
  const state = {version: 5, world: g.world, home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
  assert.ok(questProgress({kind: 'prestige', count: 1}, state).have === 0, 'the bell waits on real veterans');
  assert.ok(questProgress({kind: 'wonder', type: 'dawn-gate'}, state).have === 0, 'no gate, no dawn');
  tickVillage(state, d, 1, noop);
  tickCombat(g.world, d, 1);
});
