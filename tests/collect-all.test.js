import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeBuilding} from '../src/model.js';
import {Game} from '../src/game.js';
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions'].map(async n => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
const freshGame = () => {
 const g = new Game(structuredClone(data));
 g.paused = false;
 return g;
};
test('collectAll gathers every finished producer in one tap', () => {
 const g = freshGame();
 const farm = makeBuilding('farm', 6, 6, g.data); farm.harvestBonus = 5;
 const mine = makeBuilding('mine', 8, 8, g.data); mine.harvestBonus = 3;
 g.world.buildings.push(farm, mine);
 const before = {food: g.world.resources.food || 0, gold: g.world.resources.gold || 0};
 const totals = g.collectAll();
 assert.deepEqual(totals, {food: 5, gold: 3});
 assert.equal(g.world.resources.food, before.food + 5);
 assert.equal(g.world.resources.gold, before.gold + 3);
 assert.equal(farm.harvestBonus, 0);
 assert.equal(mine.harvestBonus, 0);
});
test('collectAll skips unfinished, ruined and empty producers', () => {
 const g = freshGame();
 const growing = makeBuilding('farm', 6, 6, g.data); growing.harvestBonus = 5; growing.remaining = 10;
 const ruined = makeBuilding('farm', 7, 7, g.data); ruined.harvestBonus = 5; ruined.hp = 0;
 const empty = makeBuilding('farm', 8, 8, g.data); empty.harvestBonus = 0;
 g.world.buildings.push(growing, ruined, empty);
 assert.deepEqual(g.collectAll(), {});
 assert.equal(growing.harvestBonus, 5);
 assert.equal(ruined.harvestBonus, 5);
});
test('collectAll while paused collects nothing', () => {
 const g = freshGame(); g.paused = true;
 const farm = makeBuilding('farm', 6, 6, g.data); farm.harvestBonus = 5;
 g.world.buildings.push(farm);
 assert.deepEqual(g.collectAll(), {});
 assert.equal(farm.harvestBonus, 5);
});
