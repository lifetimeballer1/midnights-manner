import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Game} from '../src/game.js';
import {createWorld, makeBuilding} from '../src/model.js';
import {storageCap} from '../src/systems/storage.js';
import {tickRefine, refinerCrew} from '../src/systems/crafting.js';
import {RESOURCES} from '../src/resources.js';
import {validateSave, exportSave, importSaveBlob, VERSION} from '../src/storage.js';

const data = Object.fromEntries(await Promise.all(
  ['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'levels', 'calendar', 'traders', 'endgame', 'festivals', 'conquest']
    .map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const hash = value => createHash('sha256').update(value).digest('hex');
const bakery = () => data.buildings.bakery;

function crewed() {
  const g = new Game(data);
  g.state.vlevel = 6;
  const b = makeBuilding('bakery', 2, 2, data);
  b.remaining = 0;
  g.world.buildings.push(b);
  const miller = g.world.troops.find(t => t.type === 'miller' && t.hp > 0)
    || {id: 'u-miller', type: 'miller', hp: 100, level: 1, workplace: b.id};
  miller.workplace = b.id; miller.hp = 100;
  if (!g.world.troops.includes(miller)) g.world.troops.push(miller);
  return {g, b, miller};
}

test('GAP1: bakery is a level-6 miller-hosted refiner with three exact recipes', () => {
  const b = bakery();
  assert.equal(b.name, 'Bakery'); assert.equal(b.size, 2);
  assert.equal(b.minLevel, 6); assert.equal(b.workplace, 'miller');
  assert.deepEqual(b.hosts, ['miller']);
  assert.equal(b.maxCount.length, 11); assert.equal(b.maxCount[5], 1);
  assert.deepEqual(b.refine, [
    {in: {flour: 2}, out: {bread: 1}, perSec: 0.5},
    {in: {food: 2, flour: 2}, out: {rations: 2}, perSec: 0.4},
    {in: {bread: 2, gold: 20}, out: {'feast-supplies': 1}, perSec: 0.3},
  ]);
  assert.equal(b.tiers.length, 6);
  assert.deepEqual(b.tiers.map(t => t.sprite), ['bakery-1.png', 'bakery-2.png', 'bakery-3.png', 'bakery-4.png', 'bakery-5.png', 'bakery-6.png']);
  // The Gristmill keeps its original two-step chain untouched.
  assert.deepEqual(data.buildings.mill.refine.length, 2);
});

test('GAP1: bakery stage sprites are distinct 32px PNGs', async () => {
  const files = [];
  for (const name of ['bakery-1.png', 'bakery-2.png']) {
    const png = await readFile(new URL(`../assets/sprites/${name}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 32); assert.equal(png.readUInt32BE(20), 32);
    files.push(hash(png));
  }
  assert.notEqual(files[0], files[1]);
});

test('GAP1: rations and feast-supplies are registered, capped, badged goods', async () => {
  for (const [key, label, sprite] of [['rations', 'Rations', 'resource-rations.svg'], ['feast-supplies', 'Feast Supplies', 'resource-feast.svg']]) {
    assert.equal(RESOURCES[key].label, label);
    assert.equal(RESOURCES[key].sprite, sprite);
    await readFile(new URL(`../assets/sprites/${sprite}`, import.meta.url));
    assert.equal(data.world.storageBase[key] > 0, true);
    const g = new Game(data);
    assert.ok(Number.isFinite(storageCap(g.world, data, key)));
  }
  assert.equal(data.world.storageBase.rations, 800);
  assert.equal(data.world.storageBase['feast-supplies'], 400);
});

test('GAP1: posted millers bake bread, bind rations and lay in feast stores', () => {
  const {g, b} = crewed();
  assert.equal(refinerCrew(g.world, data, b).length, 1);
  g.world.resources = {...g.world.resources, flour: 100, food: 100, bread: 100, gold: 1000};
  const made = tickRefine(g.world, data, 10);
  assert.ok(made.bread > 0 && made.rations > 0 && made['feast-supplies'] > 0);
  assert.ok(g.world.resources.rations > 0 && g.world.resources['feast-supplies'] > 0);
  // An empty bakery refines nothing; a ruined one neither.
  const idle = crewed(); idle.g.world.buildings.find(x => x.type === 'bakery').hp = 0;
  assert.deepEqual(tickRefine(idle.g.world, data, 10), {});
});

test('GAP1: level gate, exact payment and save round-trip without a version bump', () => {
  assert.equal(VERSION, 14);
  const g = new Game(data);
  g.state.vlevel = 5;
  const locked = structuredClone(g.world.resources);
  assert.equal(g.build('bakery', 2, 2), undefined);
  assert.match(g.message, /village level 6/);
  assert.deepEqual(g.world.resources, locked);
  g.state.vlevel = 6;
  const b = g.build('bakery', 2, 2);
  assert.ok(b);
  assert.equal(validateSave(g.state, data), true);
  const back = importSaveBlob(exportSave(g.state), data);
  assert.equal(back.ok, true); assert.equal(back.state.version, 14);
  assert.ok(back.state.world.buildings.some(x => x.type === 'bakery'));
});

test('GAP1: war feast marches on rations, founders feast on feast stores', () => {
  const war = data.festivals.find(f => f.id === 'war-feast');
  const founders = data.festivals.find(f => f.id === 'founders-festival');
  assert.equal(war.cost.rations, 100);
  assert.equal(founders.cost['feast-supplies'], 100);
  // Original baskets intact beneath the new goods.
  assert.equal(war.cost.bread, 300); assert.equal(founders.cost.bread, 800);
  const g = new Game(data);
  g.state.vlevel = 8;
  g.world.resources = {...Object.fromEntries(Object.keys(g.world.resources).map(k => [k, 99999])), rations: 99999, 'feast-supplies': 99999};
  assert.equal(g.holdFestival('war-feast'), true);
  assert.equal(g.world.resources.rations, 99999 - 100);
  g.world.elapsed = 240 + 480 + 1; // war-feast ends, its cooldown passes
  assert.equal(g.holdFestival('founders-festival'), true);
  assert.equal(g.world.resources['feast-supplies'], 99999 - 100);
});
