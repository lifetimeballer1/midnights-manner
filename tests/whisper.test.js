import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {makeBuilding, makeUnit, gatherBonus, gearArmor, buildingCost} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickVillage} from '../src/systems/village.js';
import {claimRegion, regionById} from '../src/systems/expansion.js';
import {frontierEventEligible, resolveFrontierEvent} from '../src/systems/frontier-events.js';
import {Renderer} from '../src/renderer.js';
import {MeshScene, buildingModel} from '../src/scene3d.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'buildings', 'troops', 'items', 'abilities', 'quests', 'missions', 'levels', 'expansion']
    .map(async name => [name, JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)))])));
const unlocks = ['heartwarden', 'heartwood-axe', 'whisper-coat'];

test('whisper: grove has authored production and the existing tier/level gates', () => {
  const spec = data.buildings['whisper-grove'];
  assert.ok(spec, 'Whisper Grove exists');
  assert.deepEqual([spec.size, spec.production, spec.rate, spec.reserve, spec.minLevel], [2, 'wood', 1.8, 400, 6]);
  assert.equal(spec.workplace, 'heartwarden');
  assert.deepEqual(spec.requiresBuilding, {type: 'grove', level: 2});
  assert.deepEqual(spec.cost, data.buildings.frostgrove.cost);
  assert.equal(spec.tiers.length, 2);
  assert.equal(new Set(spec.tiers.map(t => t.sprite)).size, 2);
});

test('whisper: rejected construction spends nothing; both gates must pass', () => {
  assert.ok(data.buildings['whisper-grove']);
  const g = new Game(structuredClone(data));
  g.world.resources = {wood: 1000, food: 1000, gold: 1000};
  const before = {...g.world.resources};
  g.state.vlevel = 5;
  g.build('whisper-grove', 2, 2);
  assert.deepEqual(g.world.resources, before);
  assert.match(g.message, /level 6/);
  g.state.vlevel = 6;
  g.build('whisper-grove', 2, 2);
  assert.deepEqual(g.world.resources, before);
  assert.match(g.message, /tier-2/);
  const old = makeBuilding('grove', 7, 9, data, 2);
  old.remaining = 0;
  g.world.buildings.push(old);
  const quote = buildingCost('whisper-grove', 1, g.world, data);
  const built = g.build('whisper-grove', 2, 2);
  assert.equal(built.type, 'whisper-grove');
  assert.equal(built.maxReserve, 400);
  for (const [resource, cost] of Object.entries(quote))
    assert.equal(g.world.resources[resource], before[resource] - cost);
});

test('whisper: Heartwarden uses the gatherer kit and matching equipment', () => {
  const spec = data.troops.heartwarden;
  assert.ok(spec, 'Heartwarden exists');
  assert.deepEqual([spec.role, spec.gatherResource, spec.gatherFrom, spec.carry, spec.defaultGear],
    ['collector', 'wood', 'whisper-grove', 14, 'heartwood-axe']);
  assert.deepEqual(spec.abilities, data.troops.woodward.abilities);
  assert.equal(spec.job.workplace, 'whisper-grove');
  for (const id of unlocks) {
    assert.ok(data.world.locked.includes(id), `${id} is earned`);
    if (data.items[id]) assert.deepEqual(data.items[id].roles, ['heartwarden']);
  }
  assert.equal(data.items['whisper-coat'].slot, 'armor');
  const u = makeUnit('heartwarden', data);
  u.armor = 'whisper-coat';
  assert.ok(Math.abs(gearArmor(u, data) - 0.1) < 1e-9);
});

test('whisper: Tomm unlocks the crew and gear once without adding quest XP', () => {
  const quest = data.quests.find(q => q.id === 'whisper-cuts');
  assert.ok(quest, 'Whisper Cuts exists');
  assert.equal(quest.giver, 'Tomm');
  assert.deepEqual(quest.task, {kind: 'build', type: 'whisper-grove', count: 1});
  assert.equal(quest.xp, 0);
  assert.deepEqual(quest.unlocks, unlocks);
  assert.equal(data.quests.reduce((sum, q) => sum + q.xp, 0), 2640);
  const g = new Game(structuredClone(data));
  g.world.troops = [];
  g.state.xp = 2640; g.state.vlevel = 11;
  g.state.questsCompleted = data.quests.filter(q => q.id !== quest.id).map(q => q.id);
  tickVillage(g.state, g.data, .05, () => {});
  assert.ok(!g.state.questsCompleted.includes(quest.id));
  const grove = makeBuilding('whisper-grove', 7, 9, data);
  grove.remaining = 0;
  g.world.buildings.push(grove);
  tickVillage(g.state, g.data, .05, () => {});
  assert.ok(g.state.questsCompleted.includes(quest.id));
  assert.equal(g.state.xp, 2640);
  for (const id of unlocks) assert.equal(g.state.unlocks.filter(u => u === id).length, 1);
  tickVillage(g.state, g.data, .05, () => {});
  assert.equal(g.state.questsCompleted.filter(id => id === quest.id).length, 1);
});

test('whisper: passive wood stays on site and posted Heartwardens haul it', () => {
  assert.ok(data.buildings['whisper-grove'] && data.troops.heartwarden);
  const g = new Game(structuredClone(data));
  g.world.troops = [];
  const grove = makeBuilding('whisper-grove', 7, 9, data);
  grove.remaining = 0;
  g.world.buildings.push(grove);
  const before = g.world.resources.wood;
  tickEconomy(g.world, data, 1);
  assert.equal(g.world.resources.wood, before);
  assert.equal(grove.harvestBonus, 1.8);
  const u = makeUnit('heartwarden', data);
  g.world.troops.push(u);
  g.assign(u.id, grove.id);
  assert.equal(gatherBonus(u, g.world, data), 1.25);
  for (let i = 0; i < 2000; i++) tickEconomy(g.world, data, .05);
  assert.ok(g.world.gathered.wood > 0);
  assert.ok(g.world.resources.wood > before);
  assert.ok(grove.reserve < grove.maxReserve);
});

test('whisper: paired-cut frontier event gates and resolves without XP', () => {
  const event = data.world.frontierEvents.find(e => e.id === 'whisperwood-paired-cuts');
  assert.ok(event, 'new Whisperwood event exists');
  const g = new Game(structuredClone(data));
  g.state.vlevel = 6;
  assert.equal(frontierEventEligible(event, g.state, data), false);
  claimRegion(g.world, regionById(data.expansion, 'whisperwood'));
  assert.equal(frontierEventEligible(event, g.state, data), true);
  g.state.vlevel = 5;
  assert.equal(frontierEventEligible(event, g.state, data), false);
  g.state.vlevel = 6;
  g.world.frontierEvent = {id: event.id};
  const paid = event.choices.find(c => c.cost);
  g.world.resources.food = 0;
  const before = {...g.world.resources}, xp = g.state.xp;
  assert.equal(resolveFrontierEvent(g.state, data, paid.id).ok, false);
  assert.deepEqual(g.world.resources, before);
  const free = event.choices.find(c => !c.cost);
  assert.equal(resolveFrontierEvent(g.state, data, free.id).ok, true);
  assert.equal(g.state.xp, xp);
  assert.equal(g.world.frontierEvent, null);
  g.world.frontierEvent = {id: event.id};
  g.world.resources.food = 50;
  const gold = g.world.resources.gold;
  assert.equal(resolveFrontierEvent(g.state, data, paid.id).ok, true);
  assert.equal(g.world.resources.food, 0);
  assert.equal(g.world.resources.gold, gold + 80);
});

test('whisper: grove tiers add structure, stay finite and select through a full orbit', () => {
  const spec = data.buildings['whisper-grove'];
  assert.ok(spec);
  const r = new Renderer({getContext: () => ({})}, data, {});
  r.resize(1280, 900, 1); r.cam.x = 6; r.cam.y = 6; r.cam.zoom = 1.65;
  for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    r.cam.yaw = yaw;
    const counts = [];
    for (const level of [1, 2]) {
      const b = makeBuilding('whisper-grove', 5, 5, data, level), scene = new MeshScene(r);
      buildingModel(scene, b, spec, {buildings: [b]});
      assert.ok(scene.faces.length > 0 && scene.faces.length < 500);
      assert.ok(scene.faces.every(f => f.owner?.id === b.id && /^#[0-9a-f]{6}$/i.test(f.color)
        && f.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))));
      counts.push(scene.faces.length);
    }
    assert.ok(counts[1] > counts[0], 'tier 2 adds a sawbuck and covered log rack');
  }
});
