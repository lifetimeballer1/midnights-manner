import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importSaveBlob, VERSION } from '../src/storage.js';
import { Game } from '../src/game.js';

// Jesce's home-screen bookmark save: a vintage 20x16-era v1 blob with no
// bounds and no tile grid. The frontier migration must expand it into the
// current full frontier grid with the old footprint claimed, preserving every
// building, troop, resource and XP — never a reset, never gifted wilds.
const data = Object.fromEntries(await Promise.all(['world', 'troops', 'items', 'abilities', 'buildings', 'missions', 'quests', 'expansion'].map(async (n) => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

async function vintageState() {
  const raw = await readFile(new URL('./fixtures/old-save-v1.json', import.meta.url), 'utf8');
  const res = importSaveBlob(raw, data);
  assert.equal(res.ok, true, `fixture must import cleanly: ${res.error}`);
  return res.state;
}

test('vintage v1 bookmark save migrates to current version with content intact', async () => {
  const state = await vintageState();
  assert.equal(state.version, VERSION);
  assert.equal(state.world.buildings.length, 3);
  assert.equal(state.world.troops.length, 2);
  assert.deepEqual(state.world.resources, { food: 180, gold: 210, wood: 320, lumber: 0, flour: 0, bread: 0 });
  assert.equal(state.xp, 120);
  assert.equal(state.vlevel, 2);
});

test('vintage save expands into the current frontier grid with the old footprint claimed', async () => {
  const state = await vintageState();
  const before = {
    buildings: structuredClone(state.world.buildings),
    troops: structuredClone(state.world.troops),
    resources: structuredClone(state.world.resources),
    xp: state.xp,
  };
  const g = new Game(data);
  g.importState(state);
  const w = g.state.world;
  assert.equal(w.tiles.length, data.world.width * data.world.height, 'full frontier grid built');
  // Every vintage building tile reads claimed.
  for (const b of before.buildings) {
    const t = w.tiles.find(t => t.x === b.x && t.y === b.y);
    assert.ok(t && t.claimed === true, `old footprint tile (${b.x},${b.y}) claimed`);
  }
  // The far corner stays wild — migration never gifts the frontier.
  const far = w.tiles.find(t => t.x === data.world.width - 1 && t.y === data.world.height - 1);
  assert.ok(far && far.claimed !== true, 'far wilderness stays unclaimed');
  // Nothing else moved: buildings, troops, resources, XP preserved.
  assert.deepEqual(w.buildings, before.buildings);
  assert.deepEqual(w.troops, before.troops);
  assert.deepEqual(w.resources, before.resources);
  assert.equal(g.state.xp, before.xp);
});
