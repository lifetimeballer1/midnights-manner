import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auras, housing, gearArmor, levelForXp, makeBuilding, makeUnit, stats, createWorld} from '../src/model.js';
import {tickVillage} from '../src/systems/village.js';
import {tickCombat, activateAbility} from '../src/systems/combat.js';
import {startMission} from '../src/systems/campaign.js';
import {migrateToLatest,VERSION} from '../src/storage.js';
import {Game} from '../src/game.js';

// Act V Phase 1 — Scriptorium's Due: XP levels 5-7 pay out, the Scholar
// earns a real identity, and Issa's chart becomes a readable record.
const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const noop = () => {};

test('ph1: frontier grid keeps a 20x17 homestead inside the expanded world; quest XP alone reaches level 6', () => {
  assert.deepEqual([data.world.width, data.world.height], [52, 44]);
  const total = data.quests.reduce((n, q) => n + q.xp, 0);
  assert.ok(total >= 860, `quest XP ${total} covers the Act V foundation (Q9 lands level 6)`);
  assert.ok(levelForXp(total) >= 6);
  assert.equal(levelForXp(860), 6);
});

test('ph1: chart-the-dark is a real gather gate, never arrival-satisfied', () => {
  const q = data.quests.find(q => q.id === 'chart-the-dark');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'gather', resource: 'gold', amount: 400});
  assert.equal(q.xp, 150);
  assert.deepEqual(q.unlocks, ['orrery']);
  assert.ok(q.log && q.log.length > 0, 'chart-log page');
  // A quest-rich village (all 8 prior quests done = 710 XP) still has 0/400 gold.
  const g = new Game(structuredClone(data));
  g.state.questsCompleted = data.quests.filter(q => q.id !== 'chart-the-dark').map(q => q.id);
  g.state.xp = 710; g.state.vlevel = levelForXp(710);
  g.world.gathered = {wood: 0, food: 0, gold: 0};
  tickVillage(g.state, structuredClone(data), 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('chart-the-dark'), '0/400 gold hauls nothing');
});

test('ph1: completing chart-the-dark unlocks the Orrery (earned, not bought)', () => {
  assert.ok(data.world.locked.includes('orrery'), 'orrery starts locked');
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(q => q.id !== 'chart-the-dark').map(q => q.id);
  g.state.xp = 710; g.state.vlevel = levelForXp(710);
  g.world.gathered = {wood: 0, food: 0, gold: 400};
  const messages = [];
  tickVillage(g.state, d, 0.05, m => messages.push(m));
  assert.ok(g.state.questsCompleted.includes('chart-the-dark'), 'quest completes at 400 gold');
  assert.ok(g.state.unlocks.includes('orrery'), 'orrery unlocked by the quest');
  assert.ok(!g.locked('orrery'), 'no longer locked');
  assert.ok(messages.some(m => m.includes("Scholar's Orrery")), 'completion names the unlock');
  // A scholar can now equip it free — earned, not bought.
  const scholar = g.world.troops.find(t => t.type === 'scholar') || (() => {
    const u = {id: 's1', type: 'scholar', level: 1, hp: 50, gear: 'tome', owned: ['tome'], x: 8, y: 10, attackTimer: 0, abilityTimer: 0, carry: 0, phase: 'gather', animation: 0, workplace: null, order: null};
    g.world.troops.push(u); return u;
  })();
  g.world.resources = {wood: 0, food: 0, gold: 0};
  g.equip(scholar.id, 'orrery');
  assert.equal(scholar.gear, 'orrery');
  assert.ok(scholar.owned.includes('orrery'));
});

test('ph1: the Orrery sharpens a posted scholar (keeper-gear read-through)', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const scrip = makeBuilding('scriptorium', 2, 2, d);
  scrip.remaining = 0;
  g.world.buildings.push(scrip);
  const scholar = {id: 's1', type: 'scholar', level: 1, hp: 50, gear: 'tome', owned: ['tome', 'orrery'], x: 8, y: 10, attackTimer: 0, abilityTimer: 0, carry: 0, phase: 'gather', animation: 0, workplace: scrip.id, order: null};
  g.world.troops.push(scholar);
  const plain = auras(g.world, d);
  assert.equal(plain.xp, 0.12, 'tome-era xp unchanged (back-compat)');
  scholar.gear = 'orrery';
  const keen = auras(g.world, d);
  assert.ok(Math.abs(keen.xp - 0.18) < 1e-9, `xp 0.12 -> 0.18 with the Orrery (got ${keen.xp})`);
  // The survey share is generic too: a survey workplace honors gear `survey`.
  d.items.compass.stats = {survey: 1.5};
  const post = makeBuilding('scout_post', 3, 3, d);
  post.remaining = 0;
  g.world.buildings.push(post);
  const scout = {id: 's2', type: 'scout', level: 1, hp: 50, gear: 'compass', owned: ['compass'], x: 8, y: 10, attackTimer: 0, abilityTimer: 0, carry: 0, phase: 'gather', animation: 0, workplace: post.id, order: null};
  g.world.troops.push(scout);
  const rate = d.buildings.scout_post.surveyRate;
  assert.ok(Math.abs(auras(g.world, d).survey - rate * 1.5) < 1e-9, 'gear survey multiplies the bearer share');
});

test('ph1: scriptorium tier 3 waits for village level 7', () => {
  assert.equal(data.buildings.scriptorium.tiers.length, 3);
  assert.equal(data.buildings.scriptorium.tiers[2].rateMultiplier, 3);
  assert.deepEqual(data.buildings.scriptorium.tierGates, {3: 7});
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000, lumber: 100000};
  const scrip = makeBuilding('scriptorium', 2, 2, d);
  scrip.remaining = 0; scrip.level = 2;
  g.world.buildings.push(scrip);
  g.state.vlevel = 6;
  const messages = [];
  const notify = g.notify.bind(g);
  g.notify = m => messages.push(m);
  g.upgrade(scrip.id);
  assert.equal(scrip.level, 2, 'no observatory at level 6');
  assert.ok(messages.some(m => m.includes('level 7')), 'plain-word gate reason');
  g.state.vlevel = 7;
  g.upgrade(scrip.id);
  assert.equal(scrip.level, 3, 'observatory rises at level 7');
  g.notify = notify;
});

test('ph1: chart log pages persist for completed giver quests', () => {
  const logged = data.quests.filter(q => q.log);
  assert.ok(logged.some(q => q.id === 'every-hand'), 'Issa promoted to the log');
  assert.ok(logged.some(q => q.id === 'chart-the-dark'), 'quest 9 leaves a page');
  for (const q of logged) assert.ok(q.giver && q.giver.length > 0, `${q.id} log has a giver`);
});

test('ph1: no cloned kits; the branch missions arrive in phase 5', () => {
  assert.ok(data.missions.length >= 9, "nine chapters shipped; Act VII grows the campaign (exact count pinned in act7)");
  for (const [, t] of Object.entries(data.troops))
    for (const ab of Object.values(t.abilities)) assert.ok(data.abilities[ab], `ability ${ab} resolves`);
});

test('ph2: tomm-s-flocks teaches tier upgrades and pays quest-gated gear', () => {
  const q = data.quests.find(q => q.id === 'tomm-s-flocks');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'upgrade', type: 'pasture', level: 2});
  assert.equal(q.xp, 130);
  assert.deepEqual(q.unlocks, ['herding-crook', 'berry-basket']);
  assert.ok(q.log && q.giver === 'Tomm the herder', 'Tomm graduates to giver + log');
  const total = data.quests.reduce((n, x) => n + x.xp, 0);
  assert.ok(total >= 990, `quest XP ${total} covers the Act V foundation (Q10 lands 990)`);
  assert.ok(levelForXp(990) < 7, 'Q10 alone stays short of level 7');
  // Gear mirrors the scythe/cart upgrade pattern and starts locked.
  for (const id of ['herding-crook', 'berry-basket']) {
    assert.ok(data.world.locked.includes(id), `${id} quest-gated`);
    assert.ok(data.items[id], `${id} exists`);
  }
  assert.deepEqual([data.items['herding-crook'].stats.gather, data.items['herding-crook'].stats.carry], [1.5, 16]);
  assert.deepEqual([data.items['berry-basket'].stats.gather, data.items['berry-basket'].stats.carry], [1.4, 18]);
});

test('ph2: the upgrade task kind measures real future work', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(q => q.id !== 'tomm-s-flocks').map(q => q.id);
  g.state.xp = 860; g.state.vlevel = levelForXp(860);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000};
  // A tier-1 pasture is not enough.
  const pasture = makeBuilding('pasture', 2, 2, d);
  pasture.remaining = 0;
  g.world.buildings.push(pasture);
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('tomm-s-flocks'), 'tier-1 pasture does not satisfy');
  // Raising it to tier 2 completes the quest and unlocks both tools.
  g.upgrade(pasture.id);
  assert.equal(pasture.level, 2);
  const messages = [];
  tickVillage(g.state, d, 0.05, m => messages.push(m));
  assert.ok(g.state.questsCompleted.includes('tomm-s-flocks'), 'tier-2 pasture completes');
  assert.ok(g.state.unlocks.includes('herding-crook') && g.state.unlocks.includes('berry-basket'));
  assert.ok(messages.some(m => m.includes('Herding Crook') && m.includes('Berry Basket')));
  // And the shepherd can now buy (not granted) the upgrade.
  const shepherd = {id: 'sh1', type: 'shepherd', level: 1, hp: 50, gear: 'crook', owned: ['crook'], x: 8, y: 10, attackTimer: 0, abilityTimer: 0, carry: 0, phase: 'gather', animation: 0, workplace: null, order: null};
  g.world.troops.push(shepherd);
  g.world.resources = {wood: 100, food: 100, gold: 100};
  g.equip(shepherd.id, 'herding-crook');
  assert.equal(shepherd.gear, 'herding-crook');
});

test('ph3: the Apprentice debuts the K1 scholarly kit at a lower cap', () => {
  assert.ok(Object.keys(data.troops).length >= 21);
  assert.ok(data.troops.apprentice, 'apprentice exists');
  const a = data.troops.apprentice;
  assert.equal(a.role, 'keeper');
  assert.equal(a.maxLevel, 15, 'first lower cap — a deliberate cadence tool');
  assert.equal(a.job.workplace, 'cottage');
  assert.equal(a.job.effect, 'welcome');
  assert.deepEqual(a.abilities, {5: 'attune', 10: 'armor', 15: 'mend'});
  assert.ok(data.items[a.defaultGear], 'default gear resolves');
  assert.ok(data.world.locked.includes('apprentice'), 'recruit-gated behind open-doors');
});

test('ph3: welcoming hands raise cottage beds, capped at +3', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  let cottage = g.world.buildings.find(b => b.type === 'cottage');
  if (!cottage) { cottage = makeBuilding('cottage', 2, 2, d); g.world.buildings.push(cottage); }
  cottage.remaining = 0;
  const beds0 = housing(g.world, d).beds;
  const mkAppr = id => ({id, type: 'apprentice', level: 1, hp: 75, gear: 'apron', owned: ['apron'], armor: null, armorOwned: [], x: 8, y: 10, attackTimer: 0, abilityTimer: 0, carry: 0, phase: 'gather', animation: 0, workplace: cottage.id, order: null});
  g.world.troops.push(mkAppr('a1'));
  assert.equal(housing(g.world, d).beds, beds0 + 2, 'one aproned apprentice: +1 welcome, +1 apron');
  g.world.troops.push(mkAppr('a2'), mkAppr('a3'), mkAppr('a4'));
  assert.equal(housing(g.world, d).beds, beds0 + 3, 'four aproned hands still grant only +3');
  for (const t of g.world.troops) t.workplace = null;
  assert.equal(housing(g.world, d).beds, beds0, 'unassigned hands warm no beds');
});

test('ph3: cottage tier 3 houses 16; the Longhouse waits for level 5', () => {
  assert.deepEqual(data.buildings.cottage.housing, [6, 10, 16, 22, 28, 36]);
  assert.equal(data.buildings.cottage.tiers.length, 6);
  assert.equal(data.buildings.cottage.tiers[2].hp, 640);
  assert.deepEqual(data.buildings.longhouse.housing, [14, 22, 30, 38, 46, 56]);
  assert.equal(data.buildings.longhouse.minLevel, 5);
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000};
  const messages = [];
  g.notify = m => messages.push(m);
  g.state.vlevel = 4;
  g.build('longhouse', 2, 2);
  assert.ok(!g.world.buildings.some(b => b.type === 'longhouse'), 'no longhouse at level 4');
  assert.ok(messages.some(m => m.includes('level 5')), 'plain-word level reason');
  g.state.vlevel = 5;
  const b = g.build('longhouse', 2, 2);
  assert.ok(b && b.type === 'longhouse', 'level 5 retroactively pays out');
});

test('ph3: open-doors unlocks apprentice recruits at population 10', () => {
  const q = data.quests.find(q => q.id === 'open-doors');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'population', count: 10});
  assert.deepEqual(q.unlocks, ['apprentice']);
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(x => x.id !== 'open-doors').map(x => x.id);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000};
  const messages = [];
  g.notify = m => messages.push(m);
  g.recruit('apprentice');
  assert.ok(!g.world.troops.some(t => t.type === 'apprentice'), 'locked before the quest');
  assert.ok(messages.some(m => m.includes('not yet earned')));
  while (g.world.troops.length < 10) g.world.troops.push(makeUnit('farmer', d, g.world.troops.length));
  tickVillage(g.state, d, 0.05, m => messages.push(m));
  assert.ok(g.state.questsCompleted.includes('open-doors'));
  assert.ok(g.state.unlocks.includes('apprentice'));
  g.recruit('apprentice');
  const appr = g.world.troops.find(t => t.type === 'apprentice');
  assert.ok(appr, 'apprentice joins');
  assert.equal(appr.gear, 'apron');
  assert.equal(appr.armor, null);
});

test('ph3: the Padded Coat rides a second gear axis into combat math', () => {
  const coat = data.items['padded-coat'];
  assert.equal(coat.slot, 'armor');
  assert.equal(coat.stats.armor, 0.1);
  assert.ok(coat.roles.includes('warrior') && coat.roles.includes('apprentice'));
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000};
  const u = makeUnit('warrior', d, 0);
  g.world.troops.push(u);
  assert.equal(gearArmor(u, d), 0);
  g.equip(u.id, 'padded-coat');
  assert.equal(u.armor, 'padded-coat');
  assert.ok(u.armorOwned.includes('padded-coat'));
  assert.ok(Math.abs(gearArmor(u, d) - 0.1) < 1e-9);
  assert.equal(u.gear, 'sword', 'main-hand gear untouched by the armor flow');
});

test('ph3: mend knits its bearer mid-raid; saves migrate to v5', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const appr = makeUnit('apprentice', d, 0);
  appr.level = 15; appr.hp = 10;
  g.world.troops.push(appr);
  g.world.enemies.push({id: 'e1', x: 0.5, y: 0.5, hp: 65, maxHp: 65, damage: 9, attackTimer: 99, animation: 0});
  assert.equal(activateAbility(g.world, d, appr, 'mend'), false, 'mend is never cast');
  tickCombat(g.world, d, 1);
  assert.ok(appr.hp > 10 && appr.hp <= 10.5, `mend knit ${appr.hp} HP`);
  const old = {version: 4, world: structuredClone(g.world), home: null, mission: null, completed: [], unlocks: ['tower'], xp: 0, vlevel: 1, questsCompleted: []};
  delete old.world.troops[0].armor; delete old.world.troops[0].armorOwned;
  const out = migrateToLatest(old, d);
  assert.equal(out.version, VERSION);
  assert.equal(out.world.troops[0].armor, null);
  assert.deepEqual(out.world.troops[0].armorOwned, []);
});

test('ph4: sarella-s-standard demands two tier-2 upgrades, then a real choice', () => {
  const q = data.quests.find(q => q.id === 'sarella-s-standard');
  assert.ok(q, 'quest exists');
  assert.deepEqual(q.task, {kind: 'upgrade', type: ['forge', 'armory'], level: 2});
  assert.equal(q.xp, 140);
  assert.deepEqual(q.unlocks, ['runed-forgehammer', 'etched-armorkit', 'fine-tinkerkit', 'oiled-awl', 'brass-chalice']);
  assert.equal(q.giver, 'Sarella Emberwright');
  assert.ok(q.log && q.log.length > 0, 'Sarella persists as forge vendor');
  const total = data.quests.reduce((n, x) => n + x.xp, 0);
  assert.equal(data.quests.filter(q => !["VII", "VIII"].includes(q.act || "I")).reduce((n, x) => n + x.xp, 0), 1690, 'Quest 16 pushes the running total to 1690 (Act V still closed 20 short of 7; war and legend trials count separately)');
  // All five tools are new SKUs in the toolkit cost band, quest-gated.
  const tools = {
    'runed-forgehammer': ['weaponsmith', 'damageAura', 0.1],
    'etched-armorkit': ['armorer', 'armorAura', 0.1],
    'fine-tinkerkit': ['toolsmith', 'gatherAura', 0.1],
    'oiled-awl': ['leatherworker', 'carryAura', 10],
    'brass-chalice': ['healer', 'healAura', 1.0]
  };
  for (const [id, [role, stat, value]] of Object.entries(tools)) {
    const item = data.items[id];
    assert.ok(item, `${id} exists`);
    assert.deepEqual(item.roles, [role]);
    assert.equal(item.stats[stat], value);
    assert.deepEqual(item.cost, {gold: 90, wood: 30});
    assert.ok(data.world.locked.includes(id), `${id} quest-gated`);
  }
});

test('ph4: one upgrade is not enough; both tiers complete the standard', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  g.state.questsCompleted = d.quests.filter(x => x.id !== 'sarella-s-standard').map(x => x.id);
  g.state.xp = 990; g.state.vlevel = levelForXp(990);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000};
  const forge = makeBuilding('forge', 2, 2, d); forge.remaining = 0;
  const armory = makeBuilding('armory', 4, 4, d); armory.remaining = 0;
  g.world.buildings.push(forge, armory);
  g.upgrade(forge.id);
  tickVillage(g.state, d, 0.05, noop);
  assert.ok(!g.state.questsCompleted.includes('sarella-s-standard'), 'forge-2 alone does not satisfy');
  g.upgrade(armory.id);
  const messages = [];
  tickVillage(g.state, d, 0.05, m => messages.push(m));
  assert.ok(g.state.questsCompleted.includes('sarella-s-standard'), 'both tier-2s complete');
  for (const id of ['runed-forgehammer', 'etched-armorkit', 'fine-tinkerkit', 'oiled-awl', 'brass-chalice'])
    assert.ok(g.state.unlocks.includes(id), `${id} unlocked`);
  assert.ok(messages.some(m => m.includes('Runed Forgehammer') && m.includes('Brass Chalice')));
});

test('ph4: upgraded keeper tools buff their workplace auras when posted', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const setup = (btype, ttype, gear) => {
    const b = makeBuilding(btype, 2, 2, d); b.remaining = 0; g.world.buildings.push(b);
    const u = makeUnit(ttype, d, g.world.troops.length);
    u.gear = gear; u.owned = [d.troops[ttype].defaultGear, gear]; u.workplace = b.id;
    g.world.troops.push(u); return u;
  };
  const smith = setup('forge', 'weaponsmith', 'forgehammer');
  const base = auras(g.world, d);
  smith.gear = 'runed-forgehammer';
  assert.ok(Math.abs(auras(g.world, d).damage - base.damage - 0.1) < 1e-9, 'runed hammer sharpens the aura');
  const healer = setup('chapel', 'healer', 'chalice');
  const baseHeal = auras(g.world, d).heal;
  healer.gear = 'brass-chalice';
  assert.ok(Math.abs(auras(g.world, d).heal - baseHeal - 1.0) < 1e-9, 'brass chalice swells the mending');
  const tanner = setup('tannery', 'leatherworker', 'awl');
  const baseCarry = auras(g.world, d).carry;
  tanner.gear = 'oiled-awl';
  assert.equal(auras(g.world, d).carry, baseCarry + 10, 'oiled awl lightens every pack');
});

test('ph5: the Pikewoman debuts the C1 melee-control kit', () => {
  assert.ok(Object.keys(data.troops).length >= 27, "roster grows by act; exact count pinned in act7");
  const p = data.troops.pikewoman;
  assert.equal(p.role, 'combat');
  assert.deepEqual([p.base.hp, p.base.damage, p.base.range], [150, 14, 1.6]);
  assert.deepEqual(p.recruitCost, {food: 40, gold: 25});
  assert.equal(p.defaultGear, 'pike');
  assert.deepEqual(p.abilities, {5: 'brace', 10: 'armor', 15: 'rally', 20: 'veteran', 25: 'phalanx'});
  assert.ok(data.world.locked.includes('pikewoman'), 'earned on the forked road');
  const pike = data.items.pike, shield = data.items['kite-shield'];
  assert.deepEqual(pike.roles, ['pikewoman']);
  assert.deepEqual([pike.stats.damage, pike.stats.range], [1.0, 1.6]);
  assert.equal(pike.animation, 'brace');
  assert.equal(shield.slot, 'armor');
  assert.deepEqual([shield.stats.armor, shield.stats.hp], [0.15, 20]);
  assert.ok(data.world.locked.includes('pike') && data.world.locked.includes('kite-shield'));
  const wall = data.buildings.stonewall;
  assert.equal(wall.size, 1);
  assert.deepEqual(wall.cost, {wood: 30, gold: 25});
  // Phase 12 raised a fourth stonewall course (2600, village level 10) —
  // the old three stand exactly as the act built them.
  assert.deepEqual(wall.tiers.map(t => t.hp), [520, 1040, 1560, 2600, 3510, 4550]);
  assert.equal(wall.tierGates['4'], 10);
  assert.ok(wall.repeatPlace, 'stone walls lay like palisades');
  assert.ok(data.buildings.wall.repeatPlace, 'palisades keep their rhythm');
  assert.ok(data.world.locked.includes('stonewall'));
});

test('ph5: brace lengthens the spear, then the drill fades', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const pike = makeUnit('pikewoman', d, 0);
  pike.level = 5;
  g.world.troops.push(pike);
  assert.ok(Math.abs(stats(pike, d).range - 1.6) < 1e-9, 'unbraced reach');
  assert.equal(activateAbility(g.world, d, pike, 'brace'), true);
  assert.ok(Math.abs(stats(pike, d).range - 2.6) < 1e-9, 'spear-wall braced');
  assert.equal(activateAbility(g.world, d, pike, 'brace'), false, 'drill needs its breath back');
  tickCombat(g.world, d, 8.1);
  assert.ok(Math.abs(stats(pike, d).range - 1.6) < 1e-9, 'the wall stands down');
});

test('ph5: rally lends its neighbors courage; phalanx lends its shields', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  const pike = makeUnit('pikewoman', d, 0);
  pike.level = 15; pike.x = 5; pike.y = 5;
  const near = makeUnit('warrior', d, 1);
  near.x = 6; near.y = 5;
  const far = makeUnit('warrior', d, 2);
  far.x = 15; far.y = 15;
  g.world.troops.push(pike, near, far);
  const calm = stats(near, d).damage;
  assert.equal(activateAbility(g.world, d, pike, 'rally'), true);
  assert.ok(Math.abs(stats(near, d).damage - calm * 1.1) < 1e-9, 'near ally rallied');
  assert.equal(stats(far, d).damage, calm, 'far ally unmoved');
  // The shield-line: a raid blow lands softer shoulder-to-shoulder.
  const plain = new Game(structuredClone(data));
  const w1 = makeUnit('warrior', data, 0); w1.x = 5; w1.y = 5;
  plain.world.troops.push(w1);
  plain.world.enemies.push({id: 'e1', x: 5.2, y: 5.2, hp: 65, maxHp: 65, damage: 11, attackTimer: 0, animation: 0});
  tickCombat(plain.world, structuredClone(data), 0.1);
  const soloLoss = 140 - w1.hp;
  assert.ok(soloLoss > 0, 'the blow lands');
  const lined = new Game(structuredClone(data));
  const w2 = makeUnit('warrior', data, 0); w2.x = 5; w2.y = 5;
  const guard = makeUnit('pikewoman', data, 1); guard.level = 25; guard.x = 5.5; guard.y = 5;
  lined.world.troops.push(w2, guard);
  lined.world.enemies.push({id: 'e1', x: 5.2, y: 5.2, hp: 65, maxHp: 65, damage: 11, attackTimer: 0, animation: 0});
  tickCombat(lined.world, structuredClone(data), 0.1);
  assert.ok(140 - w2.hp < soloLoss, `phalanx softens ${soloLoss} -> ${140 - w2.hp}`);
});

test('ph5: the forked road branches on last-stand; showcase matches unlock', () => {
  const ford = data.missions.find(m => m.id === 'ashen-ford');
  const dam = data.missions.find(m => m.id === 'hollow-dam');
  for (const m of [ford, dam]) {
    assert.ok(m, 'mission exists');
    assert.deepEqual(m.requires, ['last-stand'], 'first shared prerequisite');
    assert.equal(m.act, 'V');
    assert.ok(m.ceremony && m.ceremony.warning && m.ceremony.victory && m.ceremony.defeat);
    assert.ok(m.beat && m.beat.length > 0);
    for (const b of m.map.buildings) assert.ok(data.buildings[b.type], `${m.id} building ${b.type}`);
    for (const t of m.map.troops) assert.ok(data.troops[t], `${m.id} troop ${t}`);
    assert.ok(!m.unlocks.includes('tower'), 'the dead-unlock pattern stays banned');
  }
  assert.equal(ford.troopLimit, 6);
  assert.equal(dam.troopLimit, 7);
  assert.ok(ford.map.buildings.some(b => b.type === 'stonewall'), 'ford showcases stone');
  assert.deepEqual(ford.unlocks, ['pikewoman', 'pike', 'kite-shield']);
  assert.ok(dam.map.troops.includes('pikewoman'), 'dam showcases pikes');
  assert.deepEqual(dam.unlocks, ['stonewall']);
  // Either road qualifies; neither needs the other.
  const d = structuredClone(data);
  assert.equal(startMission({world: createWorld(d), completed: [], unlocks: []}, d, 'ashen-ford'), false);
  const game = {world: createWorld(d), completed: ['last-stand'], unlocks: []};
  assert.ok(startMission(game, d, 'ashen-ford'), 'ford opens off last-stand');
  const game2 = {world: createWorld(d), completed: ['last-stand'], unlocks: []};
  assert.ok(startMission(game2, d, 'hollow-dam'), 'dam opens off last-stand');
});

test('ph5: kite-shield pads max HP; quest XP totals 1420 after the first pour', () => {
  const d = structuredClone(data);
  const g = new Game(d);
  g.world.resources = {wood: 100000, food: 100000, gold: 100000};
  g.state.unlocks.push('kite-shield');
  const u = makeUnit('warrior', d, 0);
  g.world.troops.push(u);
  const bare = stats(u, d).hp;
  g.equip(u.id, 'kite-shield');
  assert.equal(u.armor, 'kite-shield');
  assert.equal(stats(u, d).hp, bare + 20);
  assert.ok(Math.abs(gearArmor(u, d) - 0.15) < 1e-9);
  assert.equal(data.quests.filter(q => !["VII", "VIII"].includes(q.act || "I")).reduce((n, x) => n + x.xp, 0), 1690, 'Quest 16 keeps level 7 landed through quest play');
});
