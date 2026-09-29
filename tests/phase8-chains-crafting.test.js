import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld, makeBuilding, makeUnit, stats} from '../src/model.js';
import {tickRefine, tickCraft, startCraftOrder, crewPower, refinerCrew, craftCost, craftDuration, itemRarity, rarityName, edibleFood, stockCount, RARITY_ORDER, BREAD_FOOD_VALUE} from '../src/systems/crafting.js';
import {tickVillage} from '../src/systems/village.js';
import {tickEconomy} from '../src/systems/economy.js';
import {exportSave, importSaveBlob, VERSION} from '../src/storage.js';
import {RESOURCES} from '../src/resources.js';

const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'names'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

function setup() {
  const g = new Game(data);
  g.state = {...g.state, world: createWorld(data), home: null, mission: null, completed: [], vlevel: 1};
  g.world.resources = {wood: 10000, food: 10000, gold: 10000, frostwood: 1000, plate: 200, lumber: 500, flour: 500, bread: 20};
  g.world.buildings.push(makeBuilding('barracks', 3, 3, data));
  return g;
}
function postCrew(g, type, building, traits) {
  const u = makeUnit(type, data, g.world.troops.length);
  u.traits = traits || ['hard_worker'];
  u.jobXp = 0; u.jobLevel = 1;
  u.workplace = building.id;
  g.world.troops.push(u);
  return u;
}

test('phase8: rarity ladder resolves, old gear reads common', () => {
  assert.deepEqual(RARITY_ORDER, ['common', 'uncommon', 'rare', 'epic', 'legendary']);
  assert.equal(itemRarity(data.items.sword), 'common');
  assert.equal(rarityName(data.items.sword), 'Common');
  assert.equal(itemRarity(data.items['steel-blade']), 'uncommon');
  assert.equal(itemRarity(data.items['runed-blade']), 'rare');
  assert.equal(itemRarity(data.items['dawn-blade']), 'epic');
  assert.equal(itemRarity(data.items['first-dawn-blade']), 'legendary');
  assert.equal(itemRarity(data.items['aegis-of-dawn']), 'legendary');
});

test('phase8: inherited rarity keys fall back to common', () => {
  for (const rarity of ['constructor', '__proto__']) {
    assert.equal(itemRarity({rarity}), 'common');
    assert.equal(rarityName({rarity}), 'Common');
  }
});

test('phase8: forged tiers hit strictly harder and guard strictly better', () => {
  const blades = ['ash-blade', 'steel-blade', 'runed-blade', 'dawn-blade', 'first-dawn-blade'];
  const damages = blades.map(id => data.items[id].stats.damage);
  assert.deepEqual([...damages].sort((a, b) => a - b), damages, 'blade damage climbs with rarity');
  const wards = ['levy-gambeson', 'steel-chain', 'runed-ward', 'dawn-ward', 'aegis-of-dawn'];
  const armors = wards.map(id => data.items[id].stats.armor);
  assert.deepEqual([...armors].sort((a, b) => a - b), armors, 'ward armor climbs with rarity');
  for (const id of [...blades, ...wards]) {
    assert.equal(data.items[id].craftOnly, true, `${id} is forge-only`);
    assert.ok(data.buildings[data.items[id].craft.building], `${id} names a real smithy`);
  }
});

test('phase8: chain data — shops, callings, stores', () => {
  assert.ok(data.buildings.sawmill.refine?.length === 1, 'sawmill refines wood to lumber');
  assert.ok(data.buildings.mill.refine?.length === 2, 'mill mills flour and bakes bread');
  assert.equal(data.buildings.sawmill.workplace, 'sawyer');
  assert.equal(data.buildings.mill.workplace, 'miller');
  assert.equal(data.troops.sawyer.job.workplace, 'sawmill');
  assert.equal(data.troops.miller.job.workplace, 'mill');
  assert.ok(data.items[data.troops.sawyer.defaultGear], 'sawyer tool resolves');
  assert.ok(data.items[data.troops.miller.defaultGear], 'miller tool resolves');
  for (const k of ['lumber', 'flour', 'bread']) {
    assert.ok(RESOURCES[k]?.label, `${k} has a store identity`);
    assert.equal(data.world.startingResources[k], 0, `${k} starts empty`);
  }
  const w = createWorld(data);
  for (const k of ['lumber', 'flour', 'bread']) assert.equal(w.gathered[k], 0, `gathered tracks ${k}`);
});

test('phase8: sawmill turns timber into planks, crew-scaled', () => {
  const g = setup();
  const mill = makeBuilding('sawmill', 5, 5, data);
  g.world.buildings.push(mill);
  g.world.resources.wood = 100;
  const before = g.world.resources.lumber;
  tickRefine(g.world, data, 10);
  assert.equal(g.world.resources.lumber, before, 'an empty shop refines nothing — jobs matter');
  postCrew(g, 'sawyer', mill);
  tickRefine(g.world, data, 10);
  const made = g.world.resources.lumber - before;
  assert.ok(made > 0, `crewed shop refines (made ${made})`);
  assert.ok(g.world.resources.wood < 100, 'inputs are spent, never conjured');
  assert.ok(g.world.resources.wood >= 0, 'no input debt');
});

test('phase8: craftsman hands refine a quarter more', () => {
  const run = traits => {
    const g = setup();
    const mill = makeBuilding('sawmill', 5, 5, data);
    g.world.buildings.push(mill);
    g.world.resources.wood = 10000;
    postCrew(g, 'sawyer', mill, traits);
    const before = g.world.resources.lumber;
    tickRefine(g.world, data, 10);
    return g.world.resources.lumber - before;
  };
  const plain = run(['brave']);
  const craft = run(['craftsman']);
  assert.ok(craft > plain * 1.2, `craftsman ${craft.toFixed(1)} beats plain ${plain.toFixed(1)}`);
});

test('phase8: wheat to loaf end to end', () => {
  const g = setup();
  const mill = makeBuilding('mill', 5, 5, data);
  g.world.buildings.push(mill);
  g.world.resources.food = 500; g.world.resources.flour = 0; g.world.resources.bread = 20;
  postCrew(g, 'miller', mill);
  tickRefine(g.world, data, 20);
  assert.ok(g.world.resources.flour > 0, 'grain milled to flour');
  assert.ok(g.world.resources.bread > 20, 'flour baked to bread');
  assert.ok(g.world.resources.food < 500, 'milling spends wheat');
});

test('phase8: craft orders need a posted smith and finish into stock', () => {
  const g = setup();
  const forge = makeBuilding('forge', 5, 5, data);
  g.world.buildings.push(forge);
  let res = startCraftOrder(g.world, data, forge.id, 'ash-blade');
  assert.ok(res.error, `idle forge refuses: ${res.error}`);
  postCrew(g, 'weaponsmith', forge);
  res = startCraftOrder(g.world, data, forge.id, 'ash-blade');
  assert.ok(res.ok, `crewed forge accepts: ${res.error || ''}`);
  assert.ok(forge.craft && forge.craft.remaining > 0, 'order is on the anvil');
  const busy = startCraftOrder(g.world, data, forge.id, 'steel-blade');
  assert.ok(busy.error, 'one order at a time');
  assert.equal(stockCount(g.world, 'ash-blade'), 0, 'nothing before its time');
  const done = tickCraft(g.world, data, forge.craft.remaining + 1);
  assert.equal(done.length, 1, 'order completes');
  assert.equal(stockCount(g.world, 'ash-blade'), 1, 'blade lands in village stock');
  assert.equal(forge.craft, null, 'anvil clears');
});

test('phase8: craftsman thrift spares a quarter of the stores', () => {
  const item = data.items['ash-blade'];
  const plain = [makeUnit('weaponsmith', data, 0)];
  plain[0].traits = ['brave']; plain[0].jobXp = 0; plain[0].jobLevel = 1;
  const craft = [makeUnit('weaponsmith', data, 1)];
  craft[0].traits = ['craftsman']; craft[0].jobXp = 0; craft[0].jobLevel = 1;
  assert.deepEqual(craftCost(item, plain), item.cost, 'plain crew pays full');
  const thrifty = craftCost(item, craft);
  assert.equal(thrifty.lumber, Math.max(1, Math.ceil(item.cost.lumber * 0.75)), 'craftsman spares lumber');
  assert.ok(thrifty.wood < item.cost.wood, 'craftsman spares wood');
  assert.ok(craftDuration(item, crewPower(craft)) < craftDuration(item, crewPower(plain)), 'craftsman smiths faster');
});

test('phase8: forged steel equips from stock, never off the shelf', () => {
  const g = setup();
  const warrior = g.recruit('warrior');
  const sword = warrior.gear;
  g.equip(warrior.id, 'steel-blade');
  assert.equal(warrior.gear, sword, 'no stock, no steel');
  g.world.stock = {'steel-blade': 1};
  g.equip(warrior.id, 'steel-blade');
  assert.equal(warrior.gear, 'steel-blade', 'stock steel fits');
  assert.equal(g.world.stock['steel-blade'], 0, 'stock spent');
  assert.ok(stats(warrior, data).damage > stats({...warrior, gear: sword}, data).damage, 'forged steel hits harder in combat');
});

test('phase8: forged armor guards in combat and hauls on the job', () => {
  const g = setup();
  const farm = g.world.buildings.find(b => b.type === 'farm');
  farm.remaining = 0;
  const mkHauler = () => {
    const h = makeUnit('farmer', data, g.world.troops.length);
    h.traits = ['brave']; h.jobXp = 0; h.jobLevel = 1;
    h.workplace = farm.id;
    h.x = farm.x + 0.5; h.y = farm.y + 0.5;
    h.carry = 0; h.phase = 'gather';
    g.world.troops.push(h);
    return h;
  };
  const plain = mkHauler();
  const ward = mkHauler();
  ward.armor = 'levy-gambeson';
  assert.ok(stats(ward, data).hp >= stats(plain, data).hp, 'warded farmer stands tougher');
  let guard = 0;
  while ((plain.phase !== 'return' || ward.phase !== 'return') && guard++ < 800) {
    tickEconomy(g.world, data, 0.25);
  }
  assert.equal(plain.phase, 'return', 'plain basket filled');
  assert.equal(ward.phase, 'return', 'warded basket filled');
  assert.equal(ward.carry, plain.carry + 2, 'gambeson hauls +2 — armor works the job too');
});

test('phase8: bread feeds the village in a famine', () => {
  assert.equal(BREAD_FOOD_VALUE, 3, 'a loaf eats as three');
  const g = setup();
  g.world.buildings.push(makeBuilding('cottage', 2, 2, data));
  for (const b of g.world.buildings.filter(b => b.type === 'farm')) b.hp = 0;
  g.world.resources.food = 0; g.world.resources.bread = 2;
  assert.equal(edibleFood(g.world), 6, 'loaves count toward the pantry');
  let notes = 0;
  tickVillage(g.state, data, 5, () => notes++);
  assert.equal(g.world.resources.bread, 1, 'a loaf broke for meals');
  assert.ok(g.world.resources.food > 0.5, 'the pantry breathes again');
});

test('phase8: v10 saves gain chain stores, stock and quiet defaults', () => {
  const g = setup();
  const raw = JSON.parse(exportSave(g.state));
  raw.version = 10;
  delete raw.world.resources.lumber; delete raw.world.resources.flour; delete raw.world.resources.bread;
  delete raw.world.gathered.lumber; delete raw.world.gathered.flour; delete raw.world.gathered.bread;
  delete raw.world.stock;
  raw.world.buildings[0].craft = 'garbage';
  const out = importSaveBlob(JSON.stringify(raw), data);
  assert.ok(out.ok, `migrates cleanly: ${out.error}`);
  assert.equal(out.state.version, VERSION);
  for (const k of ['lumber', 'flour', 'bread']) {
    assert.equal(out.state.world.resources[k], 0, `${k} defaults without touching food/gold/wood`);
    assert.equal(out.state.world.gathered[k], 0, `gathered ${k} defaults`);
  }
  assert.deepEqual(out.state.world.stock, {}, 'empty armory stock, never a wipe');
  assert.equal(out.state.world.buildings[0].craft, null, 'garbage craft orders clear');
  assert.equal(out.state.world.resources.wood, raw.world.resources.wood, 'old stores untouched');
});
