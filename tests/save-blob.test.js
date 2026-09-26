import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportSave, importSaveBlob, VERSION } from '../src/storage.js';
import { createWorld } from '../src/model.js';
import { Game } from '../src/game.js';
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests'].map(async (n) => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));
function freshState() {
  const g = new Game(data);
  return g.state;
}
test('export/import round-trips a save with version intact', () => {
  const blob = exportSave(freshState());
  assert.ok(typeof blob === 'string' && blob.includes('"version"'));
  const res = importSaveBlob(blob, data);
  assert.equal(res.ok, true);
  assert.equal(res.state.version, VERSION);
});
test('import refuses garbage with a readable error and changes nothing', () => {
  const res = importSaveBlob('not a save{', data);
  assert.equal(res.ok, false);
  assert.match(res.error, /not a village save/i);
});
test('import refuses future versions with a readable error', () => {
  const blob = JSON.stringify({ ...freshState(), version: VERSION + 5 });
  const res = importSaveBlob(blob, data);
  assert.equal(res.ok, false);
  assert.match(res.error, new RegExp(`version ${VERSION + 5}`));
});
test('import migrates older saves instead of wiping them', () => {
  const old = { ...freshState(), version: 1 };
  delete old.world.bounds;
  const res = importSaveBlob(JSON.stringify(old), data);
  assert.equal(res.ok, true);
  assert.equal(res.state.version, VERSION);
  assert.ok(res.state.world.bounds, 'migration filled bounds');
});
test('import refuses saves with unknown content', () => {
  const bad = freshState();
  bad.world.buildings = [{ id: 999, type: 'nope', level: 1, hp: 10, x: 2, y: 2 }];
  const res = importSaveBlob(JSON.stringify(bad), data);
  assert.equal(res.ok, false);
  assert.match(res.error, /validation/i);
});
test('Game.canBuild pre-flights placement without spending', () => {
  const g = new Game(data);
  const before = { ...g.world.resources };
  // Find any buildable tile; canBuild must not mutate resources either way.
  let checked = 0;
  for (let y = 1; y < data.world.height - 1 && checked < 4; y++) for (let x = 1; x < data.world.width - 1 && checked < 4; x++) { g.canBuild('farm', x, y); checked++; }
  assert.deepEqual({ ...g.world.resources }, before);
  const locked = data.world.locked[0];
  if (locked && data.buildings[locked]) assert.equal(g.canBuild(locked, 9, 9).ok, false);
});
test('world exposes troops for the missions data file', () => {
  assert.ok(createWorld(data).troops.length > 0);
});
