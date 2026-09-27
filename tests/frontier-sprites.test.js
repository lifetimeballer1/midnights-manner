import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
// Frontier sprite kit: every sprite referenced in troops/buildings/items
// must exist on disk (boot rejects a missing sprite).
const data = Object.fromEntries(await Promise.all(['troops', 'buildings', 'items'].map(async (n) => [n, JSON.parse(await readFile(new URL(`../data/${n}.json`, import.meta.url)))])));

test('every referenced sprite exists on disk', async () => {
  const refs = [
    ...Object.values(data.buildings).flatMap((b) => b.tiers.map((t) => t.sprite)),
    ...Object.values(data.troops).map((t) => t.sprite),
    ...Object.values(data.items).map((i) => i.sprite),
  ];
  const onDisk = new Set(await readdir(new URL('../assets/sprites/', import.meta.url)));
  assert.deepEqual(refs.filter((s) => !onDisk.has(s)), []);
  for (const name of refs) await access(new URL(`../assets/sprites/${name}`, import.meta.url));
});

test('frontier kit wiring: troops, manor tiers, timber camp, tools', () => {
  assert.equal(data.troops.warrior.sprite, 'troop_warrior_32x32.png');
  assert.equal(data.troops.miner.sprite, 'troop_miner_32x32.png');
  assert.equal(data.troops.builder.sprite, 'troop_builder_32x32.png');
  assert.equal(data.troops.farmer.sprite, 'troop_farmer_32x32.png');
  assert.equal(data.buildings.hall.tiers[0].sprite, 'building_manor_tier1_32x32.png');
  assert.equal(data.buildings.hall.tiers[1].sprite, 'building_manor_tier2_32x32.png');
  const camp = data.buildings.timber_yard;
  assert.ok(camp, 'timber_yard entry exists');
  assert.equal(camp.production, 'wood');
  assert.equal(camp.tiers[0].sprite, 'building_timber_yard_tier1_32x32.png');
  for (const id of ['frontier_sword', 'frontier_axe', 'frontier_warhammer', 'frontier_sickle', 'frontier_pickaxe', 'frontier_hammer']) {
    const item = data.items[id];
    assert.ok(item, `${id} exists`);
    assert.ok(item.sprite && item.roles?.length > 0 && item.cost && item.stats, `${id} has sprite/roles/cost/stats`);
    for (const role of item.roles) assert.ok(data.troops[role], `${id} role ${role} resolves`);
  }
  const sprites = ['frontier_sword', 'frontier_axe', 'frontier_warhammer', 'frontier_sickle', 'frontier_pickaxe', 'frontier_hammer'].map((id) => data.items[id].sprite);
  assert.equal(new Set(sprites).size, 6, 'frontier tools use distinct sprites');
});
