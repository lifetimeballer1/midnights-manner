import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {makeBuilding, makeUnit, gatherBonus} from '../src/model.js';
import {tickEconomy} from '../src/systems/economy.js';
import {tickVillage} from '../src/systems/village.js';
import {Renderer} from '../src/renderer.js';
import {MeshScene, buildingModel} from '../src/scene3d.js';
const data = Object.fromEntries(await Promise.all(
  ['world', 'buildings', 'troops', 'items', 'abilities', 'quests', 'missions', 'levels']
    .map(async name => [name, JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)))])));

test('blackwater: weir and Mudlark follow the pond/collector extension contract', () => {
  const b = data.buildings['blackwater-weir'], u = data.troops.mudlark;
  assert.ok(b && u, 'Blackwater Weir and Mudlark exist');
  assert.deepEqual([b.size, b.production, b.rate, b.workplace], [1, 'food', 2.2, 'mudlark']);
  assert.deepEqual(b.requiresBuilding, {type: 'pond', level: 2});
  assert.deepEqual(b.cost, data.buildings.deephole.cost);
  assert.deepEqual([u.role, u.gatherResource, u.gatherFrom, u.carry], ['collector', 'food', 'blackwater-weir', 14]);
  assert.equal(u.defaultGear, 'blackwater-net');
  assert.equal(u.job.workplace, 'blackwater-weir');
  assert.deepEqual(u.abilities, data.troops.diver.abilities);
  assert.deepEqual(data.items['blackwater-net'].roles, ['mudlark']);
  assert.deepEqual(data.items['mire-coat'].roles, ['mudlark']);
  assert.equal(data.items['mire-coat'].slot, 'armor');
});

test('blackwater: Mooncleric unlocks the crew with one weir and zero XP', () => {
  const q = data.quests.find(q => q.id === 'white-thread');
  assert.ok(q);
  assert.equal(q.giver, 'Mooncleric');
  assert.equal(q.xp, 0);
  assert.deepEqual(q.task, {kind: 'build', type: 'blackwater-weir', count: 1});
  assert.deepEqual(q.unlocks, ['mudlark', 'blackwater-net', 'mire-coat']);
  const g = new Game(structuredClone(data));
  g.world.troops = []; g.state.xp = 2640; g.state.vlevel = 11;
  g.state.questsCompleted = data.quests.filter(x => x.id !== q.id).map(x => x.id);
  for (const id of q.unlocks) assert.ok(g.locked(id));
  const weir = makeBuilding('blackwater-weir', 2, 2, data);
  weir.remaining = 0; g.world.buildings.push(weir);
  tickVillage(g.state, data, .05, () => {});
  assert.ok(g.state.questsCompleted.includes(q.id));
  assert.equal(g.state.xp, 2640);
  for (const id of q.unlocks) assert.ok(!g.locked(id));
});

test('blackwater: pond gate refuses before spending and Mudlarks haul from their own weir', () => {
  assert.ok(data.buildings['blackwater-weir']);
  const g = new Game(structuredClone(data));
  g.state.vlevel = 6; g.world.troops = [];
  const before = {...g.world.resources};
  g.build('blackwater-weir', 2, 2);
  assert.deepEqual(g.world.resources, before);
  assert.match(g.message, /tier-2/);
  const pond = makeBuilding('pond', 7, 9, data, 2);
  pond.remaining = 0; g.world.buildings.push(pond);
  const weir = g.build('blackwater-weir', 2, 2);
  assert.equal(weir.type, 'blackwater-weir'); weir.remaining = 0;
  const u = makeUnit('mudlark', data);
  g.world.troops.push(u); g.assign(u.id, weir.id);
  assert.equal(gatherBonus(u, g.world, data), 1.25);
  for (let i = 0; i < 2000; i++) tickEconomy(g.world, data, .05);
  assert.ok(g.world.gathered.food > 0);
  assert.ok(weir.reserve < weir.maxReserve);
});

test('blackwater: tier two adds a drying rack and covered catch basket', () => {
  const spec = data.buildings['blackwater-weir']; assert.ok(spec);
  const r = new Renderer({getContext: () => ({})}, data, {});
  r.resize(1280, 900, 1); r.cam.x = 5; r.cam.y = 5; r.cam.zoom = 1.65;
  for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    r.cam.yaw = yaw;
    const counts = [1, 2].map(level => {
      const b = makeBuilding('blackwater-weir', 5, 5, data, level), s = new MeshScene(r);
      buildingModel(s, b, spec, {buildings: [b]});
      assert.ok(s.faces.every(f => /^#[0-9a-f]{6}$/i.test(f.color)
        && f.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))));
      return s.faces.length;
    });
    assert.ok(counts[0] > 0 && counts[1] > counts[0] && counts[1] < 500);
  }
});
