// War Chest (Late-Game Economy Plan — Phase 6).
// Pure math, no imports: reads (world, data) only. Investments are
// stockpiled any time with real resources; the player OPENS the chest for
// a raid (world.warChestArmed === true) and the whole chest burns when the
// raid ends — win or lose. Effects are combat multipliers only (aura
// damage/armor/heal, revival, wall guard, siege slow, free repairs), never
// production. Easy raid: save the stores. Crown wave: open everything.
// Tuning lives in data/world.json `warChest`; old saves read an empty chest.
export function warChestConfig(data) {
  const cfg = data?.world?.warChest;
  if (!cfg || typeof cfg !== 'object') return {minLevel: 5, investments: []};
  return cfg;
}
export function warChestMinLevel(data) {
  return Number.isFinite(+warChestConfig(data).minLevel) ? Math.max(1, Math.floor(+warChestConfig(data).minLevel)) : 5;
}
export function warChestList(data) {
  const list = warChestConfig(data).investments;
  return Array.isArray(list) ? list.filter(i => i && typeof i.id === 'string') : [];
}
export function warChestById(data, id) {
  return warChestList(data).find(i => i.id === id) || null;
}
export function warChestLevel(world, id) {
  const n = Number(world?.warChest?.[id]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
export function warChestMax(inv) {
  return Number.isFinite(+inv?.max) && +inv.max > 0 ? Math.floor(+inv.max) : 3;
}
export function warChestTotal(world, data) {
  let n = 0;
  for (const inv of warChestList(data)) n += warChestLevel(world, inv.id);
  return n;
}
export function warChestArmed(world) {
  return world?.warChestArmed === true;
}
// Stocked level 1..N → total effect from data `perLevel`. Reads only while
// the chest is open, so an unopened chest never bends a single number.
export function warChestBonus(world, data, key) {
  if (!warChestArmed(world)) return 0;
  let n = 0;
  for (const inv of warChestList(data)) {
    const v = inv?.perLevel?.[key];
    if (Number.isFinite(+v)) n += +v * warChestLevel(world, inv.id);
  }
  return n;
}
// Aura-table merge (model.js auras()): only the three combat keys, only
// while armed, held by the existing caps.
export function warChestAuraEffects(world, data) {
  if (!warChestArmed(world)) return {};
  const out = {};
  for (const inv of warChestList(data)) {
    for (const key of ['damage', 'armor', 'heal']) {
      const v = inv?.perLevel?.[key];
      if (Number.isFinite(+v)) out[key] = (out[key] || 0) + +v * warChestLevel(world, inv.id);
    }
  }
  return out;
}
export function warChestOpenable(world, data) {
  return !warChestArmed(world) && warChestTotal(world, data) > 0;
}
// The chest burns at raid's end: every stock returns to zero.
export function spendWarChest(world) {
  if (!world) return;
  world.warChest = {};
  world.warChestArmed = false;
}
// Repair wagons: free repairs for the raid's wreckage, worst first —
// ruins included. Returns the number of buildings restored.
export function warChestRecovery(world, data) {
  const crews = Math.floor(warChestBonus(world, data, 'repairBuildings'));
  if (crews <= 0 || !Array.isArray(world?.buildings)) return 0;
  const tierHp = b => {
    const tier = data?.buildings?.[b.type]?.tiers?.[Math.max(0, (b.level || 1) - 1)];
    return Number.isFinite(+tier?.hp) ? +tier.hp : 0;
  };
  const hurt = world.buildings
    .filter(b => b && tierHp(b) > 0 && (Number(b.hp) || 0) < tierHp(b))
    .sort((a, b) => (a.hp / tierHp(a)) - (b.hp / tierHp(b)));
  let restored = 0;
  for (const b of hurt.slice(0, crews)) { b.hp = tierHp(b); restored++; }
  return restored;
}
