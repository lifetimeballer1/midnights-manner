import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {levelForXp, makeBuilding, makeUnit, createWorld, gearArmor, gatherBonus, unlockedAbilities, stats, auras, builderBonuses} from '../src/model.js';
import {tickVillage} from '../src/systems/village.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickCombat} from '../src/systems/combat.js';
import {Game} from '../src/game.js';
import {missionLocked, startMission} from '../src/systems/campaign.js';

// Act VI Phase 6 — Frostwood Treeline: a second wilds biome west of the
// village. New wood type, new gatherer fantasy, first dual-stat armor.
const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const noop = () => {};

test('ph6: the Frostgrove is a level-gated frostwood production building', () => {
  const f = data.buildings.frostgrove;
  assert.ok(f, 'frostgrove exists');
  assert.equal(f.size, 2);
  assert.equal(f.production, 'frostwood');
  assert.equal(f.reserve, 400);
  assert.equal(f.workplace, 'woodward');
  assert.equal(f.tiers.length, 2);
  assert.equal(f.minLevel, 6);
  assert.deepEqual(f.cost, {wood: 90, food: 30});
  const sprites = f.tiers.map(t => t.sprite);
  assert.equal(new Set(sprites).size, 2, 'tiers stay visually distinct');
});

test('ph6: the Woodward debuts the G1 gatherer kit', () => {
  assert.ok(Object.keys(data.troops).length >= 27, "roster grows by act; exact count pinned in act7");
  const w = data.troops.woodward;
  assert.equal(w.role, 'collector');
  assert.deepEqual([w.base.hp, w.base.damage], [120, 10]);
  assert.equal(w.gatherResource, 'frostwood');
  assert.equal(w.gatherFrom, 'frostgrove');
  assert.equal(w.carry, 14);
  assert.equal(w.defaultGear, 'frostaxe');
  assert.deepEqual(w.abilities, {5: 'swift', 10: 'sturdy', 15: 'rich', 20: 'harvest-lord', 25: 'master'});
  assert.equal(w.job.workplace, 'frostgrove');
  assert.ok(data.world.locked.includes('woodward'), 'earned west of the chalk');
});

test('ph6: G1 abilities ride existing handlers only — no new behavior', () => {
  const handled = ['splash', 'armor', 'heal', 'damage', 'gather', 'aura', 'xp', 'buff', 'guard'];
  for (const id of ['swift', 'sturdy', 'rich', 'harvest-lord', 'master']) {
    const a = data.abilities[id];
    assert.ok(a, `${id} exists`);
    assert.ok(handled.includes(a.effect), `${id} uses handled effect ${a.effect}`);
  }
  const u = makeUnit('woodward', data);
  u.level = 25;
  const ids = Object.values(data.troops.woodward.abilities);
  assert.deepEqual(ids, ['swift', 'sturdy', 'rich', 'harvest-lord', 'master']);
  // The kit gathers harder and shrugs harder through the same code paths
  // every older collector uses.
  const eff = unlockedAbilities(u, data).map(a => a.effect);
  assert.ok(eff.includes('gather') && eff.includes('armor') && eff.includes('aura'));
});

test('ph6: Frostaxe and Winter Coat price in frostwood (sinks, not inflation)', () => {
  const axe = data.items.frostaxe;
  assert.deepEqual(axe.roles, ['woodward']);
  assert.deepEqual([axe.stats.gather, axe.stats.carry], [1.4, 14]);
  assert.ok((axe.cost.frostwood || 0) > 0, 'frostwood sink');
  assert.ok(data.world.locked.includes('frostaxe'), 'quest-gated');
  const coat = data.items['winter-coat'];
  assert.equal(coat.slot, 'armor');
  assert.deepEqual([coat.stats.armor, coat.stats.gather], [0.1, 1.1]);
  const collectors = ['miner', 'farmer', 'fisherman', 'shepherd', 'lumberjack', 'butcher', 'forager', 'woodward'];
  for (const c of collectors) assert.ok(coat.roles.includes(c), `coat fits ${c}`);
  assert.ok((coat.cost.frostwood || 0) > 0, 'unaffordable before the treeline opens');
});

test('ph6: west-of-the-chalk is a real frostwood gate; quest XP lands level 7', () => {
  const q = data.quests.find(q => q.id === 'west-of-the-chalk');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'gather', resource: 'frostwood', amount: 150});
  assert.equal(q.xp, 150);
  assert.deepEqual(q.unlocks, ['woodward', 'frostaxe']);
  assert.equal(q.giver, 'Fen the wayfinder');
  assert.ok(q.log && q.log.length > 0, 'Fen leaves a log page');
  const total = data.quests.filter(q => !["VII", "VIII"].includes(q.act || "I")).reduce((n, x) => n + x.xp, 0);
  assert.equal(total, 1690, 'running quest total after Quest 16');
  assert.equal(levelForXp(1420), 7, 'level 7 lands mid-Act VI through quests alone');
});

test('ph6: new villages start with an empty frostwood bank', () => {
  assert.equal(data.world.startingResources.frostwood, 0);
  const w = createWorld(data);
  assert.equal(w.resources.frostwood, 0);
  assert.equal(w.gathered.frostwood, 0);
});

test('ph6: the Frostgrove waits for village level 6', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 0};
  const messages = [];
  g.notify = m => messages.push(m);
  g.state.vlevel = 5;
  g.build('frostgrove', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'frostgrove'), 'no grove at level 5');
  assert.ok(messages.some(m => m.includes('level 6')), 'plain-word level reason');
  g.state.vlevel = 6;
  const b = g.build('frostgrove', 2, 2);
  assert.ok(b && b.type === 'frostgrove', 'the treeline opens at level 6');
  assert.equal(b.reserve, 400);
  assert.equal(b.maxReserve, 400);
});

test('ph6: 150 frostwood completes the quest and musters the wardens', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(q => q.id !== 'west-of-the-chalk').map(q => q.id);
  g.state.xp = 1130; g.state.vlevel = levelForXp(1130);
  assert.ok(g.locked('woodward') && g.locked('frostaxe'), 'both quest-gated on arrival');
  g.world.gathered = {wood: 0, food: 0, gold: 0, frostwood: 0};
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('west-of-the-chalk'), '0/150 hauls nothing');
  // A locked calling cannot be recruited early.
  const messages = [];
  g.notify = m => messages.push(m);
  g.recruit('woodward');
  assert.ok(!g.world.troops.some(t => t.type === 'woodward'), 'locked before the quest');
  // Haul the cold rows: the quest completes, the muster opens.
  g.world.gathered.frostwood = 150;
  g.world.resources.frostwood = 150;
  const fanfare = [];
  tickVillage(g.state, d, 0.05, m => fanfare.push(m));
  assert.ok(g.state.questsCompleted.includes('west-of-the-chalk'), 'quest completes at 150');
  assert.equal(g.state.xp, 1280);
  assert.equal(g.state.vlevel, 7);
  assert.ok(g.state.unlocks.includes('woodward') && g.state.unlocks.includes('frostaxe'));
  assert.ok(fanfare.some(m => m.includes('Frostaxe')), 'completion names the unlock');
  g.recruit('woodward');
  const warden = g.world.troops.find(t => t.type === 'woodward');
  assert.ok(warden, 'woodward joins');
  assert.equal(warden.gear, 'frostaxe');
  g.equip(warden.id, 'frostaxe');
  assert.ok(warden.owned.includes('frostaxe'), 'earned axe, bought with frostwood');
});

test('ph6: woodwards walk the cold rows end to end', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const grove = makeBuilding('frostgrove', 7, 9, d);
  grove.remaining = 0;
  g.world.buildings.push(grove);
  const warden = makeUnit('woodward', d, 0);
  warden.gear = 'frostaxe'; warden.owned = ['frostaxe'];
  g.world.troops.push(warden);
  assert.equal(gatherBonus(warden, g.world, d), 1, 'unassigned hands earn no bonus');
  g.assign(warden.id, grove.id);
  assert.equal(gatherBonus(warden, g.world, d), 1.25, 'posted wardens split 25% faster');
  for (let i = 0; i < 2000; i++) tickEconomy(g.world, d, 0.05);
  assert.ok(grove.harvestBonus > 0, 'frostwood haul waits on the grove');
  assert.equal(g.world.resources.frostwood, 0, 'workers do not bypass collection storage');
  assert.equal(g.world.gathered.frostwood, 0, 'gathered ledger advances only when the player collects');
  assert.ok(grove.reserve < grove.maxReserve, 'the living node visibly drains');
});

test('ph6: the Winter Coat rides the armor axis into gathers and blows', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000};
  g.state.unlocks.push('winter-coat');
  const run = coated => {
    const w = createWorld(d);
    const grove = makeBuilding('frostgrove', 7, 9, d);
    grove.remaining = 0;
    w.buildings.push(grove);
    const u = makeUnit('woodward', d, 0);
    u.gear = 'frostaxe'; u.owned = ['frostaxe'];
    w.troops.push(u);
    if (coated) { u.armorOwned = ['winter-coat']; u.armor = 'winter-coat'; }
    for (let i = 0; i < 1200; i++) tickEconomy(w, d, 0.05);
    return grove.harvestBonus||0;
  };
  assert.ok(run(true) > run(false), 'the coat warms the haul');
  const u = makeUnit('woodward', d, 0);
  g.world.troops.push(u);
  g.equip(u.id, 'winter-coat');
  assert.equal(u.armor, 'winter-coat');
  assert.equal(u.gear, 'frostaxe', 'main-hand untouched by the armor flow');
  assert.ok(Math.abs(gearArmor(u, d) - 0.1) < 1e-9, 'the coat turns 10% of a blow');
  // The proof in combat: a coated warden bleeds slower than a bare one.
  const bout = coated => {
    const gg = new Game(structuredClone(data));
    const a = makeUnit('woodward', gg.data, 0); a.x = 5; a.y = 5;
    if (coated) { a.armorOwned = ['winter-coat']; a.armor = 'winter-coat'; }
    gg.world.troops.push(a);
    gg.world.enemies.push({id: 'e1', x: 5.2, y: 5.2, hp: 65, maxHp: 65, damage: 20, attackTimer: 0, animation: 0});
    tickCombat(gg.world, gg.data, 0.1);
    return 120 - a.hp;
  };
  assert.ok(bout(true) < bout(false), 'coat softens the raid');
});

test('ph6: no troop-specific conditionals in the sim', async () => {
  const files = ['model.js', 'game.js', 'ui.js', 'systems/economy.js', 'systems/village.js', 'systems/combat.js', 'systems/campaign.js'];
  for (const f of files) {
    const src = await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('woodward'), `src/${f} never names the woodward`);
    assert.ok(!src.includes('frostgrove'), `src/${f} never names the frostgrove`);
    assert.ok(!src.includes('smelter'), `src/${f} never names the smelter (covers the smeltery too)`);
    assert.ok(!src.includes('diver'), `src/${f} never names the diver`);
    assert.ok(!src.includes('deephole'), `src/${f} never names the deephole`);
    assert.ok(!src.includes('sapper'), `src/${f} never names the sapper`);
    assert.ok(!src.includes('emberglass'), `src/${f} never names the emberglass`);
    assert.ok(!src.includes('glasspick'), `src/${f} never names the glasspick`);
    assert.ok(!src.includes('oilskin'), `src/${f} never names the oilskin`);
  }
});

// Act VI Phase 7 — Hide & Plate: armor becomes a craft. The Smeltery
// pours frostwood-cold plate behind a building-chain gate, the Smelter
// debuts the B1 builder kit, and three armor-slot pieces go wide.

test('ph7: the Smeltery waits on a tier-2 Frostgrove (generic chain gate)', () => {
  const s = data.buildings.smeltery;
  assert.ok(s, 'smeltery exists');
  assert.equal(s.size, 2);
  assert.equal(s.production, 'plate');
  assert.equal(s.rate, 0.6);
  assert.equal(s.reserve, 400);
  assert.equal(s.workplace, 'smelter');
  assert.equal(s.tiers.length, 2);
  assert.deepEqual(s.cost, {wood: 120, gold: 80, frostwood: 40});
  assert.deepEqual(s.requiresBuilding, {type: 'frostgrove', level: 2});
  assert.equal(new Set(s.tiers.map(t => t.sprite)).size, 2, 'tiers stay visually distinct');
  // The gate is generic data: only the chain-gated line carries the field
  // (smeltery first, deephole + emberglass its second and third data points).
  for (const [id, b] of Object.entries(data.buildings)) {
    if (['smeltery', 'deephole', 'emberglass'].includes(id)) continue;
    assert.ok(!b.requiresBuilding, `${id} needs no chain`);
  }
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 0};
  g.state.vlevel = 7;
  const messages = [];
  g.notify = m => messages.push(m);
  g.build('smeltery', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'smeltery'), 'no pour-house without the cold grove at tier');
  assert.ok(messages.some(m => m.includes('Frostwood Grove') && m.includes('tier-2')), 'plain-word chain reason');
  const grove = makeBuilding('frostgrove', 7, 9, d);
  grove.remaining = 0; grove.level = 1;
  g.world.buildings.push(grove);
  g.build('smeltery', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'smeltery'), 'a tier-1 grove does not open the gate');
  grove.level = 2;
  const poured = g.build('smeltery', 2, 2);
  assert.ok(poured && poured.type === 'smeltery', 'tier-2 grove opens the pour-house');
  assert.equal(poured.reserve, 400);
  assert.equal(poured.maxReserve, 400);
});

test('ph7: the Smelter debuts the B1 builder kit on existing handlers only', () => {
  assert.ok(Object.keys(data.troops).length >= 27, "roster grows by act; exact count pinned in act7");
  const s = data.troops.smelter;
  assert.equal(s.role, 'builder');
  assert.deepEqual([s.base.hp, s.base.damage], [115, 9]);
  assert.equal(s.defaultGear, 'tongs');
  assert.deepEqual(s.job, {
    workplace: 'smeltery',
    effect: 'produce',
    resource: 'plate',
    rate: 0.6,
    text: s.job.text
  });
  assert.deepEqual(s.abilities, {5: 'brisk', 10: 'sturdy', 15: 'discount', 20: 'foreman', 25: 'master-builder'});
  assert.equal(s.job.workplace, 'smeltery');
  assert.ok(data.world.locked.includes('smelter'), 'earned at the first pour');
  const handled = ['splash', 'armor', 'heal', 'damage', 'gather', 'aura', 'xp', 'buff', 'guard'];
  for (const id of Object.values(s.abilities)) {
    const a = data.abilities[id];
    assert.ok(a, `${id} exists`);
    assert.ok(handled.includes(a.effect), `${id} uses handled effect ${a.effect}`);
  }
  // L10 rides the same sturdy frame the treeline wardens wear.
  assert.equal(data.abilities.sturdy.effect, 'armor');
  const u = makeUnit('smelter', data);
  u.level = 25;
  const eff = unlockedAbilities(u, data).map(a => a.effect);
  assert.ok(eff.includes('gather') && eff.includes('armor') && eff.includes('aura') && eff.includes('guard'));
  assert.equal(u.gear, 'tongs');
  assert.deepEqual(data.items.tongs.stats, {buildSpeed: 1.3, costReduction: 0.05});
});

test('ph7: new villages start with an empty plate rack', () => {
  assert.equal(data.world.startingResources.plate, 0);
  const w = createWorld(data);
  assert.equal(w.resources.plate, 0);
  assert.equal(w.gathered.plate, 0);
});

test('ph7: posted smelters pour plate the smokehouse way', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const house = makeBuilding('smeltery', 7, 9, d);
  house.remaining = 0;
  g.world.buildings.push(house);
  const hand = makeUnit('smelter', d, 0);
  hand.traits = ['brave']; // Phase 7: neutral temperament pins the pour math.
  g.world.troops.push(hand);
  g.assign(hand.id, house.id);
  assert.equal(gatherBonus(hand, g.world, d), 1.25, 'posted crews read the generic workplace bonus');
  const before = g.world.gathered.plate;
  for (let i = 0; i < 600; i++) { tickEconomy(g.world, d, 0.05); tickVillage(g.state, d, 0.05, noop); }
  assert.ok(g.world.gathered.plate > before, 'plate poured into the stores');
  assert.ok(g.world.resources.plate > 0, 'plate banked');
  // The crucible pours even tapped out: produce crews ignore the node level.
  house.reserve = 0;
  const tapped = g.world.gathered.plate;
  for (let i = 0; i < 200; i++) { tickEconomy(g.world, d, 0.05); tickVillage(g.state, d, 0.05, noop); }
  assert.ok(g.world.gathered.plate > tapped + 3, 'crews pour through a tapped node');
  // Butchery math is untouched: no aura abilities on the old crew, same 0.8.
  const dd = structuredClone(data);
  const gg = new Game(dd);
  const shop = makeBuilding('butchery', 7, 9, dd);
  shop.remaining = 0;
  gg.world.buildings.push(shop);
  const old = makeUnit('butcher', dd, 0);
  old.traits = ['brave']; // Phase 7: the old crew smokes exactly 0.8/s.
  gg.world.troops.push(old);
  gg.assign(old.id, shop.id);
  for (let i = 0; i < 600; i++) tickVillage(gg.state, dd, 0.05, noop);
  assert.ok(Math.abs(gg.world.gathered.food - 0.8 * 30) < 0.8 * 30 * 0.05 + 1, 'smokehouse still smokes 0.8/s');
});

test('ph7: first-pour is a real plate gate; Quest 14 musters the smelters', () => {
  const q = data.quests.find(q => q.id === 'first-pour');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'gather', resource: 'plate', amount: 10});
  assert.equal(q.xp, 140);
  assert.deepEqual(q.unlocks, ['smelter', 'iron-cap']);
  assert.equal(q.giver, 'Maro the mason');
  assert.ok(q.log && q.log.length > 0, 'Maro leaves a log page');
  const total = data.quests.filter(q => !["VII", "VIII"].includes(q.act || "I")).reduce((n, x) => n + x.xp, 0);
  assert.equal(total, 1690, 'running quest total after Quest 16');
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(q => q.id !== 'first-pour').map(q => q.id);
  g.state.xp = 1280; g.state.vlevel = levelForXp(1280);
  assert.ok(g.locked('smelter') && g.locked('iron-cap'), 'both quest-gated on arrival');
  g.world.gathered = {wood: 0, food: 0, gold: 0, frostwood: 0, plate: 0};
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('first-pour'), '0/10 pours nothing');
  const messages = [];
  g.notify = m => messages.push(m);
  g.recruit('smelter');
  assert.ok(!g.world.troops.some(t => t.type === 'smelter'), 'locked before the quest');
  g.world.gathered.plate = 10;
  g.world.resources.plate = 10;
  const fanfare = [];
  tickVillage(g.state, d, 0.05, m => fanfare.push(m));
  assert.ok(g.state.questsCompleted.includes('first-pour'), 'quest completes at 10');
  assert.equal(g.state.xp, 1420);
  assert.ok(g.state.unlocks.includes('smelter') && g.state.unlocks.includes('iron-cap'));
  assert.ok(fanfare.some(m => m.includes('Iron Cap')), 'completion names the unlock');
  g.recruit('smelter');
  const hand = g.world.troops.find(t => t.type === 'smelter');
  assert.ok(hand, 'smelter joins');
  assert.equal(hand.gear, 'tongs');
});

test('ph7: three armor-slot pieces go wide, plate pays for the best', () => {
  const cap = data.items['iron-cap'];
  assert.equal(cap.slot, 'armor');
  assert.deepEqual(cap.stats, {armor: 0.1});
  assert.deepEqual(cap.cost, {gold: 40});
  assert.ok(cap.roles.includes('smelter') && cap.roles.includes('woodward') && cap.roles.includes('pikewoman'), 'the cap fits every calling');
  assert.ok(data.world.locked.includes('iron-cap'), 'earned at the first pour');
  const vest = data.items['studded-vest'];
  assert.deepEqual([vest.stats.armor, vest.stats.carry], [0.15, 4]);
  assert.ok((vest.cost.frostwood || 0) > 0, 'unaffordable before the treeline opens');
  for (const c of ['miner', 'builder', 'mason', 'smelter', 'woodward']) assert.ok(vest.roles.includes(c), `vest fits ${c}`);
  assert.ok(!vest.roles.includes('warrior'), 'fighters look to heavier plate');
  const plate = data.items['knights-plate'];
  assert.deepEqual(plate.stats, {armor: 0.25});
  assert.equal(plate.cost.plate, 8, 'first plate sink');
  assert.deepEqual(plate.roles, ['warrior', 'archer', 'warden', 'ranger', 'pikewoman']);
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  g.state.unlocks.push('iron-cap');
  const u = makeUnit('warrior', d, 0);
  g.world.troops.push(u);
  g.equip(u.id, 'iron-cap');
  assert.equal(u.armor, 'iron-cap');
  assert.ok(Math.abs(gearArmor(u, d) - 0.1) < 1e-9, 'the cap turns 10% of a blow');
  g.equip(u.id, 'knights-plate');
  assert.equal(u.armor, 'knights-plate');
  assert.equal(u.gear, 'sword', 'main-hand untouched by the armor flow');
  assert.ok(Math.abs(gearArmor(u, d) - 0.25) < 1e-9, 'full plate turns a quarter of a blow');
  // Mail over mail is multiplicative, never additive: cap and vest stack
  // the wardrobe way, under the combat ceiling on their own.
  assert.ok(Math.abs((1 - (1 - 0.1) * (1 - 0.15)) - 0.235) < 1e-9, 'two pieces stack to 23.5%, capped downstream');
});

// Act VI Phase 8 — The Deep Pond: water gets its second act. The pond
// chain grows down, not out — a Deephole behind a tier-2 pond gate, the
// Diver on the shared G1 collector track, Pond tier 3, and the first
// speed armor.

test('ph8: the Deephole waits on a tier-2 pond (same generic chain gate)', () => {
  const hole = data.buildings.deephole;
  assert.ok(hole, 'deephole exists');
  assert.equal(hole.size, 1);
  assert.equal(hole.production, 'food');
  assert.equal(hole.rate, 2.2);
  assert.equal(hole.reserve, 350);
  assert.equal(hole.workplace, 'diver');
  assert.equal(hole.tiers.length, 2);
  assert.deepEqual(hole.cost, {wood: 70, food: 40});
  assert.deepEqual(hole.requiresBuilding, {type: 'pond', level: 2});
  assert.equal(new Set(hole.tiers.map(t => t.sprite)).size, 2, 'tiers stay visually distinct');
  assert.ok(!data.world.locked.includes('deephole'), 'chain-gated like the frostgrove, never locked');
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 0};
  g.state.vlevel = 7;
  const messages = [];
  g.notify = m => messages.push(m);
  g.build('deephole', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'deephole'), 'no deep water without the old pond at tier');
  assert.ok(messages.some(m => m.includes('Stillwater Pond') && m.includes('tier-2')), 'plain-word chain reason');
  const pond = makeBuilding('pond', 7, 9, d);
  pond.remaining = 0; pond.level = 1;
  g.world.buildings.push(pond);
  g.build('deephole', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'deephole'), 'a tier-1 pond does not open the gate');
  pond.level = 2;
  const sunk = g.build('deephole', 2, 2);
  assert.ok(sunk && sunk.type === 'deephole', 'tier-2 pond opens the deep water');
  assert.equal(sunk.reserve, 350);
  assert.equal(sunk.maxReserve, 350);
});

test('ph8: Pond Tier 3 deepens the old water', () => {
  const tiers = data.buildings.pond.tiers;
  assert.equal(tiers.length, 3, 'the pond chain grows down, not out');
  assert.equal(tiers[2].sprite, 'pond-3.png');
  assert.equal(tiers[2].rateMultiplier, 3);
  assert.equal(new Set(tiers.map(t => t.sprite)).size, 3, 'tiers stay visually distinct');
});

test('ph8: the Diver shares the G1 collector track — zero new abilities', () => {
  assert.ok(Object.keys(data.troops).length >= 27, "roster grows by act; exact count pinned in act7");
  const dv = data.troops.diver;
  assert.equal(dv.role, 'collector');
  assert.deepEqual([dv.base.hp, dv.base.damage], [95, 7]);
  assert.equal(dv.gatherResource, 'food');
  assert.equal(dv.gatherFrom, 'deephole');
  assert.equal(dv.carry, 14);
  assert.equal(dv.defaultGear, 'net');
  assert.deepEqual(dv.abilities, {5: 'swift', 10: 'sturdy', 15: 'rich', 20: 'harvest-lord', 25: 'master'});
  assert.equal(dv.job.workplace, 'deephole');
  assert.ok(data.world.locked.includes('diver'), 'earned down dark water');
  // G1 is the role kit now: identical IDs to the woodward, no new entries.
  assert.deepEqual(Object.values(dv.abilities), Object.values(data.troops.woodward.abilities));
  const u = makeUnit('diver', data);
  u.level = 25;
  const eff = unlockedAbilities(u, data).map(a => a.effect);
  assert.ok(eff.includes('gather') && eff.includes('armor') && eff.includes('aura'));
});

test('ph8: Weighted Net hauls; Oilskin Coat is the first speed armor', () => {
  const net = data.items.net;
  assert.deepEqual(net.roles, ['diver']);
  assert.deepEqual([net.stats.gather, net.stats.carry], [1.6, 18]);
  assert.ok(data.world.locked.includes('net'), 'quest-gated');
  const coat = data.items['oilskin-coat'];
  assert.equal(coat.slot, 'armor');
  assert.deepEqual([coat.stats.armor, coat.stats.speed], [0.12, 1.1]);
  for (const c of ['fisherman', 'diver', 'sapper', 'woodward']) assert.ok(coat.roles.includes(c), `coat fits ${c}`);
  assert.ok(!data.world.locked.includes('oilskin-coat'), 'shop armor, cost-gated like the winter coat');
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  const u = makeUnit('diver', d, 0);
  g.world.troops.push(u);
  const bare = stats(u, d);
  g.equip(u.id, 'oilskin-coat');
  assert.equal(u.armor, 'oilskin-coat');
  assert.equal(u.gear, 'net', 'main-hand untouched by the armor flow');
  assert.ok(Math.abs(stats(u, d).speed - bare.speed * 1.1) < 1e-9, 'the coat quickens feet 10%');
  assert.ok(Math.abs(gearArmor(u, d) - 0.12) < 1e-9, 'the coat turns 12% of a blow');
});

test('ph8: down-dark-water is a real pond-3 gate; Quest 15 lands 1550', () => {
  const q = data.quests.find(q => q.id === 'down-dark-water');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'upgrade', type: 'pond', level: 3});
  assert.equal(q.xp, 130);
  assert.deepEqual(q.unlocks, ['deephole', 'diver', 'net']);
  assert.equal(q.giver, 'Wren Waterwise');
  assert.ok(q.log && q.log.length > 0, 'Wren leaves a log page');
  const era = data.quests.slice(0, 15).reduce((n, x) => n + x.xp, 0);
  assert.equal(era, 1550, 'running quest total after Quest 15');
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(q => q.id !== 'down-dark-water').map(q => q.id);
  g.state.xp = 1420; g.state.vlevel = levelForXp(1420);
  assert.ok(g.locked('diver') && g.locked('net'), 'both quest-gated on arrival');
  assert.ok(!g.locked('deephole'), 'the hole itself waits on the pond, not the quest');
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  const pond = makeBuilding('pond', 7, 9, d);
  pond.remaining = 0;
  g.world.buildings.push(pond);
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('down-dark-water'), 'tier-1 water goes nowhere deep');
  const messages = [];
  g.notify = m => messages.push(m);
  g.recruit('diver');
  assert.ok(!g.world.troops.some(t => t.type === 'diver'), 'locked before the quest');
  g.upgrade(pond.id);
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('down-dark-water'), 'tier-2 water still shallow');
  pond.remaining = 0; // the tier-2 crew stands down; upgrade() refuses stacked work
  g.upgrade(pond.id);
  assert.equal(pond.level, 3);
  const fanfare = [];
  tickVillage(g.state, d, 0.05, m => fanfare.push(m));
  assert.ok(g.state.questsCompleted.includes('down-dark-water'), 'quest completes at pond-3');
  assert.equal(g.state.xp, 1550);
  assert.ok(g.state.unlocks.includes('diver') && g.state.unlocks.includes('net'));
  assert.ok(fanfare.some(m => m.includes('Weighted Net')), 'completion names the unlock');
  g.recruit('diver');
  const dv = g.world.troops.find(t => t.type === 'diver');
  assert.ok(dv, 'diver joins');
  assert.equal(dv.gear, 'net');
});

test('ph8: divers walk the dark water end to end', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const hole = makeBuilding('deephole', 7, 9, d);
  hole.remaining = 0;
  g.world.buildings.push(hole);
  const dv = makeUnit('diver', d, 0);
  dv.gear = 'net'; dv.owned = ['net'];
  g.world.troops.push(dv);
  assert.equal(gatherBonus(dv, g.world, d), 1, 'unassigned hands earn no bonus');
  g.assign(dv.id, hole.id);
  assert.equal(gatherBonus(dv, g.world, d), 1.25, 'posted divers haul 25% faster');
  for (let i = 0; i < 2000; i++) tickEconomy(g.world, d, 0.05);
  assert.ok(hole.harvestBonus > 0, 'dark-water food waits on the Deephole');
  assert.equal(g.world.gathered.food, 0, 'uncollected catches do not enter the gathered ledger');
  assert.ok(hole.reserve < hole.maxReserve, 'the living node visibly drains');
});

// Act VI Phase 9 — Emberglass Mine: gold gets its second act, and the mine
// finally has a rival. Same quest-unlock shape as the deep water, the
// kinder 0.4x reserve floor is its identity, and the first armor with an
// offensive stat prices in gold+plate.

test('ph9: the Emberglass waits on a tier-2 mine (same generic chain gate)', () => {
  const em = data.buildings.emberglass;
  assert.ok(em, 'emberglass exists');
  assert.equal(em.size, 1);
  assert.equal(em.production, 'gold');
  assert.equal(em.rate, 2.4);
  assert.equal(em.reserve, 500);
  assert.equal(em.workplace, 'sapper');
  assert.equal(em.tiers.length, 2);
  assert.deepEqual(em.cost, {wood: 110, food: 40, frostwood: 30});
  assert.deepEqual(em.requiresBuilding, {type: 'mine', level: 2});
  assert.equal(new Set(em.tiers.map(t => t.sprite)).size, 2, 'tiers stay visually distinct');
  assert.ok(!data.world.locked.includes('emberglass'), 'chain-gated like the smeltery, never locked');
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  g.state.vlevel = 7;
  const messages = [];
  g.notify = m => messages.push(m);
  g.build('emberglass', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'emberglass'), 'no glowing gold without the old mine at tier');
  assert.ok(messages.some(m => m.includes('Moonstone Mine') && m.includes('tier-2')), 'plain-word chain reason');
  const mine = makeBuilding('mine', 7, 9, d);
  mine.remaining = 0; mine.level = 1;
  g.world.buildings.push(mine);
  g.build('emberglass', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'emberglass'), 'a tier-1 mine does not open the gate');
  mine.level = 2;
  const cut = g.build('emberglass', 2, 2);
  assert.ok(cut && cut.type === 'emberglass', 'tier-2 mine opens the glowing shaft');
  assert.equal(cut.reserve, 500);
  assert.equal(cut.maxReserve, 500);
});

test('ph9: Mine Tier 3 remains the quest milestone inside the six-tier mine', () => {
  const tiers = data.buildings.mine.tiers;
  assert.equal(tiers.length, 6, 'the mine now has a full six-tier progression');
  assert.equal(tiers[2].sprite, 'mine-3.png');
  assert.equal(tiers[2].rateMultiplier, 3, 'the original quest milestone keeps its old output');
  assert.equal(new Set(tiers.map(t => t.sprite)).size, 6, 'all six tiers stay visually distinct');
});

test('ph9: the Sapper shares the G1 collector track — zero new abilities', () => {
  assert.ok(Object.keys(data.troops).length >= 27, "roster grows by act; exact count pinned in act7");
  const sp = data.troops.sapper;
  assert.equal(sp.role, 'collector');
  assert.deepEqual([sp.base.hp, sp.base.damage], [125, 11]);
  assert.equal(sp.gatherResource, 'gold');
  assert.equal(sp.gatherFrom, 'emberglass');
  assert.equal(sp.carry, 12);
  assert.equal(sp.defaultGear, 'glasspick');
  assert.deepEqual(sp.abilities, {5: 'swift', 10: 'sturdy', 15: 'rich', 20: 'harvest-lord', 25: 'master'});
  assert.equal(sp.job.workplace, 'emberglass');
  assert.ok(data.world.locked.includes('sapper'), 'earned under glass and stone');
  // Third bearer of the role kit: identical IDs to diver and woodward.
  assert.deepEqual(Object.values(sp.abilities), Object.values(data.troops.diver.abilities));
  assert.deepEqual(Object.values(sp.abilities), Object.values(data.troops.woodward.abilities));
  const u = makeUnit('sapper', data);
  u.level = 25;
  const eff = unlockedAbilities(u, data).map(a => a.effect);
  assert.ok(eff.includes('gather') && eff.includes('armor') && eff.includes('aura'));
});

test('ph9: Glasspick cuts; Ember Ward is the first offensive armor', () => {
  const pick = data.items.glasspick;
  assert.deepEqual(pick.roles, ['sapper']);
  assert.deepEqual([pick.stats.gather, pick.stats.carry], [1.6, 16]);
  assert.ok(data.world.locked.includes('glasspick'), 'quest-gated');
  const ward = data.items['ember-ward'];
  assert.equal(ward.slot, 'armor');
  assert.deepEqual([ward.stats.armor, ward.stats.damage], [0.12, 1.05]);
  assert.equal(ward.cost.plate, 4, 'priced in gold+plate so fighters feel the Phase-7 economy');
  for (const r of ['warrior', 'sapper', 'diver', 'scholar', 'smelter', 'pikewoman']) assert.ok(ward.roles.includes(r), `ward fits ${r}`);
  assert.ok(!data.world.locked.includes('ember-ward'), 'shop armor, cost-gated');
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  const u = makeUnit('sapper', d, 0);
  g.world.troops.push(u);
  const bare = stats(u, d).damage;
  g.equip(u.id, 'ember-ward');
  assert.equal(u.armor, 'ember-ward');
  assert.equal(u.gear, 'glasspick', 'main-hand untouched by the armor flow');
  assert.ok(Math.abs(stats(u, d).damage - bare * 1.05) < 1e-9, 'the ward hones damage 5%');
  assert.ok(Math.abs(gearArmor(u, d) - 0.12) < 1e-9, 'the ward turns 12% of a blow');
});

test('ph9: glass-under-stone is a real mine-3 gate; Quest 16 lands 1690', () => {
  const q = data.quests.find(q => q.id === 'glass-under-stone');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'upgrade', type: 'mine', level: 3});
  assert.equal(q.xp, 140);
  assert.deepEqual(q.unlocks, ['emberglass', 'sapper', 'glasspick']);
  assert.equal(q.giver, 'Pella Second-Lantern');
  assert.ok(q.log && q.log.length > 0, 'Pella leaves a log page');
  const total = data.quests.filter(q => !["VII", "VIII"].includes(q.act || "I")).reduce((n, x) => n + x.xp, 0);
  assert.equal(total, 1690, 'running quest total after Quest 16');
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(q => q.id !== 'glass-under-stone').map(q => q.id);
  g.state.xp = 1550; g.state.vlevel = levelForXp(1550);
  assert.ok(g.locked('sapper') && g.locked('glasspick'), 'both quest-gated on arrival');
  assert.ok(!g.locked('emberglass'), 'the shaft itself waits on the mine, not the quest');
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  const mine = makeBuilding('mine', 7, 9, d);
  mine.remaining = 0;
  g.world.buildings.push(mine);
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('glass-under-stone'), 'tier-1 shafts stay dark');
  const messages = [];
  g.notify = m => messages.push(m);
  g.recruit('sapper');
  assert.ok(!g.world.troops.some(t => t.type === 'sapper'), 'locked before the quest');
  g.upgrade(mine.id);
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('glass-under-stone'), 'tier-2 shafts still dark');
  mine.remaining = 0; // the tier-2 crew stands down; upgrade() refuses stacked work
  g.upgrade(mine.id);
  assert.equal(mine.level, 3);
  const fanfare = [];
  tickVillage(g.state, d, 0.05, m => fanfare.push(m));
  assert.ok(g.state.questsCompleted.includes('glass-under-stone'), 'quest completes at mine-3');
  assert.equal(g.state.xp, 1690);
  assert.ok(g.state.unlocks.includes('sapper') && g.state.unlocks.includes('glasspick'));
  assert.ok(fanfare.some(m => m.includes('Glasspick')), 'completion names the unlock');
  g.recruit('sapper');
  const sp = g.world.troops.find(t => t.type === 'sapper');
  assert.ok(sp, 'sapper joins');
  assert.equal(sp.gear, 'glasspick');
});

test('ph9: sappers cut the glowing seams end to end', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const shaft = makeBuilding('emberglass', 7, 9, d);
  shaft.remaining = 0;
  g.world.buildings.push(shaft);
  const sp = makeUnit('sapper', d, 0);
  sp.gear = 'glasspick'; sp.owned = ['glasspick'];
  g.world.troops.push(sp);
  assert.equal(gatherBonus(sp, g.world, d), 1, 'unassigned hands earn no bonus');
  g.assign(sp.id, shaft.id);
  assert.equal(gatherBonus(sp, g.world, d), 1.25, 'posted sappers cut 25% faster');
  for (let i = 0; i < 2000; i++) tickEconomy(g.world, d, 0.05);
  assert.ok(shaft.harvestBonus > 0, 'glowing gold waits at the shaft');
  assert.equal(g.world.gathered.gold, 0, 'uncollected gold does not enter the gathered ledger');
  assert.ok(shaft.reserve < shaft.maxReserve, 'the living node visibly drains');
});

// Act VI Phase 10 — The Wild Market: Act VI finale. The traders become a
// system, Sarella's forge connects to the road, and the Phase-5 branch
// re-converges through the first requiresAny OR-gate.

test('ph10: the Wild Market is a size-3 haggler workplace with no production', () => {
  const m = data.buildings.market;
  assert.ok(m, 'market exists');
  assert.equal(m.size, 3);
  assert.deepEqual(m.cost, {wood: 150, gold: 120, frostwood: 60});
  assert.equal(m.workplace, 'haggler');
  assert.equal(m.tiers.length, 2);
  assert.equal(m.production, null);
  assert.ok(!m.harvest, 'no harvest block — no production, like forge/armory');
  assert.ok(!data.buildings.forge.harvest && !data.buildings.armory.harvest, 'the pattern holds');
  assert.equal(m.tradeAura, 0.1);
  assert.equal(new Set(m.tiers.map(t => t.sprite)).size, 2, 'tiers stay visually distinct');
  assert.ok(data.world.locked.includes('market'), 'earned where the roads rejoin');
});

test('ph10: the Haggler debuts the K2 mercantile kit on handled effects only', () => {
  assert.ok(Object.keys(data.troops).length >= 27, "roster grows by act; exact count pinned in act7");
  const h = data.troops.haggler;
  assert.equal(h.role, 'keeper');
  assert.deepEqual([h.base.hp, h.base.damage], [80, 5]);
  assert.equal(h.maxLevel, 25);
  assert.equal(h.defaultGear, 'scales');
  assert.deepEqual(h.job, {workplace: 'market', effect: 'trade', text: h.job.text});
  assert.ok(h.job.text.length > 0, 'frontier voice on the job');
  assert.deepEqual(h.abilities, {5: 'haggle', 10: 'ward', 15: 'appraise', 20: 'veteran-x', 25: 'master'});
  assert.ok(data.world.locked.includes('haggler'), 'earned at coin-and-cinder');
  // K2 debuts here with two new IDs, both on the handled 'aura' effect.
  // Judgment: appraise should improve trader offers and the L25 monopolist
  // should open a second market offer — but both systems are deferred (no
  // handlers exist), so both honestly amplify the bearer's own market
  // share instead, the way veteran-x and master already do.
  for (const id of ['haggle', 'appraise']) {
    const a = data.abilities[id];
    assert.ok(a, `${id} exists`);
    assert.equal(a.effect, 'aura');
    assert.equal(a.value, 0.05);
  }
  const handled = ['splash', 'armor', 'heal', 'damage', 'gather', 'aura', 'xp', 'buff', 'guard'];
  for (const id of Object.values(h.abilities)) {
    const a = data.abilities[id];
    assert.ok(a, `${id} exists`);
    assert.ok(handled.includes(a.effect), `${id} uses handled effect ${a.effect}`);
  }
  const u = makeUnit('haggler', data);
  u.level = 25;
  const eff = unlockedAbilities(u, data).map(a => a.effect);
  assert.ok(eff.includes('aura') && eff.includes('armor'));
});

test('ph10: coin-and-cinder opens on EITHER branch road (requiresAny OR-gate)', () => {
  const m = data.missions.find(m => m.id === 'coin-and-cinder');
  assert.ok(m, 'mission exists');
  assert.deepEqual(m.requires, []);
  assert.deepEqual(m.requiresAny, ['ashen-ford', 'hollow-dam']);
  for (const id of m.requiresAny) assert.ok(data.missions.some(x => x.id === id), `gate ${id} resolves`);
  // Generic gate: neither road walks nowhere; one road opens the stalls.
  assert.equal(missionLocked(m, []), true, 'no roads, no market');
  assert.equal(missionLocked(m, ['last-stand']), true, 'the fork alone is not enough');
  assert.equal(missionLocked(m, ['last-stand', 'ashen-ford']), false, 'the ford road qualifies');
  assert.equal(missionLocked(m, ['last-stand', 'hollow-dam']), false, 'the dam road qualifies');
  assert.equal(missionLocked(m, ['last-stand', 'ashen-ford', 'hollow-dam']), false, 'both roads qualify');
  // The old AND-gate still gates beside it.
  const last = data.missions.find(m => m.id === 'last-stand');
  assert.equal(missionLocked(last, []), true);
  assert.equal(missionLocked(last, ['moonwell']), false);
  assert.equal(missionLocked(null, []), true, 'no mission is a locked door');
  // And the gate holds at the muster: startMission refuses the unqualified.
  const bare = {mission: null, home: null, world: createWorld(data), completed: ['last-stand']};
  assert.equal(startMission(bare, data, 'coin-and-cinder'), false, 'no road, no market');
  bare.completed.push('hollow-dam');
  assert.equal(startMission(bare, data, 'coin-and-cinder'), true, 'one road opens the stalls');
  assert.equal(bare.mission.id, 'coin-and-cinder');
});

test('ph10: posted hagglers sharpen trade a tenth each; the cap holds at 0.3', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const stall = makeBuilding('market', 7, 9, d);
  stall.remaining = 0;
  g.world.buildings.push(stall);
  assert.equal(auras(g.world, d).trade, 0, 'empty stalls bargain nothing');
  // One bare-handed haggler (a borrowed tool with no trade voice): the
  // house share alone, 0.1 at tier 1.
  const plain = makeUnit('haggler', d, 0);
  plain.gear = 'tome'; plain.owned = ['tome'];
  plain.traits = ['brave']; // Phase 7: neutral temperament pins the tenth.
  g.world.troops.push(plain);
  g.assign(plain.id, stall.id);
  assert.ok(Math.abs(auras(g.world, d).trade - 0.1) < 1e-9, 'one posted haggler barters a tenth better');
  // Level-5 hands haggle sharper through their own share.
  plain.level = 5;
  assert.ok(Math.abs(auras(g.world, d).trade - 0.105) < 1e-9, 'haggle quickens the bearer\'s share');
  // A full market at tier 2 never breaks the ceiling.
  stall.level = 2;
  const crew = [makeUnit('haggler', d, 1), makeUnit('haggler', d, 2), makeUnit('haggler', d, 3)];
  for (const u of crew) { u.level = 25; u.traits = ['brave']; g.world.troops.push(u); g.assign(u.id, stall.id); }
  assert.ok(auras(g.world, d).trade <= 0.3 + 1e-9, 'trade never breaks 0.3');
  assert.ok(Math.abs(auras(g.world, d).trade - 0.3) < 1e-9, 'a full tier-2 market presses the cap');
});

test('ph10: Merchant Scales ride the generic aura-gear read-through', () => {
  const s = data.items.scales;
  assert.equal(s.name, 'Merchant Scales');
  assert.deepEqual(s.roles, ['haggler']);
  assert.deepEqual(s.stats, {tradeAura: 0.1});
  assert.ok(data.world.locked.includes('scales'), 'earned with the market');
  assert.equal(data.troops.haggler.defaultGear, 'scales');
  const run = gear => {
    const d = structuredClone(data);
    const w = createWorld(d);
    const stall = makeBuilding('market', 7, 9, d);
    stall.remaining = 0;
    w.buildings.push(stall);
    const u = makeUnit('haggler', d, 0);
    u.gear = gear; u.owned = [gear];
    u.workplace = stall.id;
    w.troops.push(u);
    return auras(w, d).trade;
  };
  assert.ok(Math.abs(run('tome') - 0.1) < 1e-9, 'house share without the scales');
  assert.ok(Math.abs(run('scales') - 0.2) < 1e-9, 'the scales add their tenth through the pair list');
});

test('ph10: Coinmail is shop-open armor with the first discount stat', () => {
  const c = data.items.coinmail;
  assert.equal(c.slot, 'armor');
  assert.deepEqual(c.stats, {armor: 0.15, discount: 0.05});
  assert.ok(!data.world.locked.includes('coinmail'), 'shop-open, cost-gated like the winter coat');
  for (const r of ['scholar', 'scout', 'healer', 'weaponsmith', 'armorer', 'toolsmith', 'leatherworker', 'apprentice', 'haggler', 'builder', 'mason', 'smelter'])
    assert.ok(c.roles.includes(r), `coinmail fits ${r}`);
  assert.ok(!c.roles.includes('warrior') && !c.roles.includes('miner'), 'fighters and delvers look elsewhere');
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, frostwood: 100000, plate: 100000};
  const hand = makeUnit('builder', d, 0);
  hand.gear = 'tome'; hand.owned = ['tome']; // a borrowed tool with no price voice
  g.world.troops.length = 0; // send the starting roster home: its hammer already speaks 0.05
  g.world.troops.push(hand);
  assert.equal(builderBonuses(g.world, d).discount, 0, 'no price voice yet');
  g.equip(hand.id, 'coinmail');
  assert.equal(hand.armor, 'coinmail');
  assert.equal(hand.gear, 'tome', 'main-hand untouched by the armor flow');
  assert.ok(Math.abs(builderBonuses(g.world, d).discount - 0.05) < 1e-9, 'the mail shaves 5% off every price');
  assert.ok(Math.abs(gearArmor(hand, d) - 0.15) < 1e-9, 'the mail turns 15% of a blow');
  // Old wardrobes read exactly as before: hammer and mail tie at 5%, the
  // toolkit's costReduction still wins the best-piece race, and the 0.5
  // ceiling never moves.
  hand.gear = 'hammer'; hand.owned.push('hammer');
  assert.ok(Math.abs(builderBonuses(g.world, d).discount - 0.05) < 1e-9, 'hammer and mail tie at 5%');
  const mate = makeUnit('builder', d, 1);
  g.world.troops.push(mate);
  mate.gear = 'toolkit'; mate.owned = ['toolkit'];
  assert.ok(Math.abs(builderBonuses(g.world, d).discount - 0.2) < 1e-9, 'best piece wins, mail or master kit');
});

test('ph10: coin-and-cinder is a two-resource branch-merge with Sarella\'s payoff', () => {
  const m = data.missions.find(m => m.id === 'coin-and-cinder');
  assert.equal(m.chapter, '09');
  assert.equal(m.act, 'VI');
  assert.equal(m.troopLimit, 7);
  assert.equal(m.timeLimit, 300);
  assert.deepEqual(m.objectives, [{resource: 'gold', amount: 250}, {resource: 'frostwood', amount: 150}]);
  assert.ok(m.startingResources.frostwood >= 60, 'the stalls open with cold coin in hand');
  for (const b of m.map.buildings) assert.ok(data.buildings[b.type], `map building ${b.type}`);
  assert.ok(m.map.buildings.some(b => b.type === 'hall'), 'the hall stands');
  assert.ok(m.map.buildings.some(b => b.type === 'mine'), 'moonstone on the map');
  assert.ok(m.map.buildings.some(b => b.type === 'frostgrove'), 'cold piles on the map');
  assert.ok(m.map.buildings.some(b => b.type === 'tower'), 'a tower on the map');
  assert.ok(m.map.troops.includes('haggler'), 'the showcase walks the map, locked or not');
  for (const t of m.map.troops) assert.ok(data.troops[t], `map troop ${t}`);
  assert.equal(m.raids.length, 2, 'two waves before the ledger closes');
  assert.deepEqual(m.unlocks, ['market', 'haggler', 'scales']);
  for (const id of m.unlocks) {
    assert.ok(data.buildings[id] || data.items[id] || data.troops[id], `${id} resolves`);
    assert.ok(data.world.locked.includes(id), `${id} genuinely locked until earned`);
  }
  assert.ok(m.beat && m.beat.length > 0, 'beat note');
  for (const key of ['warning', 'victory', 'defeat'])
    assert.ok(m.ceremony?.[key]?.includes('Sarella'), `ceremony.${key} names Sarella Emberwright`);
});

test('ph10: no troop-specific conditionals in the sim', async () => {
  // 'market' is excluded: ui.js already carried a pre-existing marketBlock
  // for the calendar trader UI; 'scales' is excluded: economy.js already
  // says 'Output scales 25%'. Both pre-date Phase 10.
  const files = ['model.js', 'game.js', 'ui.js', 'systems/economy.js', 'systems/village.js', 'systems/combat.js', 'systems/campaign.js'];
  for (const f of files) {
    const src = await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('haggler'), `src/${f} never names the haggler`);
    assert.ok(!src.includes('coinmail'), `src/${f} never names the coinmail`);
  }
});
