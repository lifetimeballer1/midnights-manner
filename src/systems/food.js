// Town meals & Well Fed (Late-Game Economy Plan — Phase 3).
// Pure math, no imports: reads (world, data) only. Once per game-day the
// town sits down to eat: a full meal of food AND bread is drawn from the
// stores and the village earns the Well Fed bonus until the next meal.
// A short pantry is never punished — the meal simply is not served (no
// partial draw, no debt, no starvation); the bonus lapses and returns the
// moment the stores can cover the whole table. Tuning lives in
// data/world.json `townMeal`: the daily ration, the day length, and the
// Well Fed bonuses (aura effects, growth speed, job training).
const FALLBACK = {
  secondsPerDay: 180,
  foodPerVillager: 5,
  breadPerVillager: 1,
  wellFed: {effects: {gather: 0.08, xp: 0.05, heal: 0.2}, growth: 0.25, jobXp: 0.25},
};

export function mealConfig(data) {
  const cfg = data?.world?.townMeal;
  if (!cfg || typeof cfg !== 'object') return FALLBACK;
  return {
    secondsPerDay: Number.isFinite(+cfg.secondsPerDay) && +cfg.secondsPerDay > 0 ? +cfg.secondsPerDay : FALLBACK.secondsPerDay,
    foodPerVillager: Number.isFinite(+cfg.foodPerVillager) && +cfg.foodPerVillager >= 0 ? +cfg.foodPerVillager : FALLBACK.foodPerVillager,
    breadPerVillager: Number.isFinite(+cfg.breadPerVillager) && +cfg.breadPerVillager >= 0 ? +cfg.breadPerVillager : FALLBACK.breadPerVillager,
    wellFed: {...FALLBACK.wellFed, ...(cfg.wellFed && typeof cfg.wellFed === 'object' ? cfg.wellFed : {})},
  };
}

// Same law as housing: every living or reviving villager eats.
export function townMouths(world) {
  return (world?.troops || []).filter(t => t && (t.hp ?? 0) >= 0).length;
}

export function mealCost(world, data) {
  const cfg = mealConfig(data);
  const pop = townMouths(world);
  return {food: Math.ceil(pop * cfg.foodPerVillager), bread: Math.ceil(pop * cfg.breadPerVillager)};
}

export function mealDay(world, data) {
  return Math.floor((Number(world?.elapsed) || 0) / mealConfig(data).secondsPerDay);
}

// The aura-table merge (model.js auras()): data effects, only known keys.
export function wellFedAuraEffects(data) {
  const e = mealConfig(data).wellFed?.effects;
  return e && typeof e === 'object' ? e : {};
}

// Non-aura bonuses read where they apply: child growth (village.js) and
// job training (villagers.js). Zero whenever the table is bare.
export function wellFedBonus(world, data, key) {
  if (world?.wellFed !== true) return 0;
  const v = mealConfig(data).wellFed?.[key];
  return Number.isFinite(+v) ? +v : 0;
}

export function wellFedActive(world) {
  return world?.wellFed === true;
}

export function mealStatus(world, data) {
  const cfg = mealConfig(data);
  const day = mealDay(world, data);
  const last = Number.isFinite(world?.lastMealDay) ? world.lastMealDay : null;
  const nextIn = last === null ? 0 : Math.max(0, (last + 1) * cfg.secondsPerDay - (Number(world?.elapsed) || 0));
  return {wellFed: wellFedActive(world), cost: mealCost(world, data), mouths: townMouths(world), nextIn, day};
}

// One meal per game-day, charged only when the whole table is covered.
// Returns null when the day has not turned, else the meal ledger:
// {served, reason: 'fed'|'short'|'empty', cost}.
export function tickTownMeal(world, data, notify = () => {}) {
  if (!world) return null;
  const day = mealDay(world, data);
  const last = Number.isFinite(world.lastMealDay) ? world.lastMealDay : null;
  if (last === day) return null;
  world.lastMealDay = day;
  const cost = mealCost(world, data);
  if (townMouths(world) <= 0) {
    world.wellFed = false;
    return {served: false, reason: 'empty', cost};
  }
  const stores = world.resources || {};
  if ((Number(stores.food) || 0) < cost.food || (Number(stores.bread) || 0) < cost.bread) {
    // A short pantry only speaks when the bonus is actually lost — early
    // villages that never built the bread chain are never nagged.
    const wasFed = world.wellFed === true;
    world.wellFed = false;
    if (wasFed) notify(`🍲 The tables go plain — the stores cannot cover ${cost.food} food and ${cost.bread} bread. Well Fed fades until the pantry can fill the board again.`);
    return {served: false, reason: 'short', cost};
  }
  stores.food = (Number(stores.food) || 0) - cost.food;
  stores.bread = (Number(stores.bread) || 0) - cost.bread;
  world.wellFed = true;
  notify(`🍲 The town tables are full — ${cost.food} food and ${cost.bread} bread shared. Well Fed: quicker hands, faster growth, warmer recovery.`);
  return {served: true, reason: 'fed', cost};
}

// Kingdom and territorial supply share the town table's active-day clock.
// Missing configuration disables upkeep; old saves start uncovered on a
// quiet current day. No backdated bills or partial baskets are charged.
const GOODS = ['food', 'bread', 'gold', 'wood', 'lumber', 'flour', 'plate', 'frostwood'];
function basket(raw) {
  const out = {};
  for (const key of GOODS) {
    const value = raw?.[key];
    if (Number.isFinite(value) && value > 0) out[key] = Math.ceil(value);
  }
  return out;
}
export function supplyStage(world, data) {
  const living = (world?.buildings || []).filter(b => b.hp > 0 && b.remaining <= 0);
  const hallTier = Math.max(1, ...living.filter(b => b.type === 'hall').map(b => b.level || 1));
  const projectTiers = living.reduce((n, b) => n + (data?.buildings?.[b.type]?.project ? b.level || 1 : 0), 0);
  const stages = data?.world?.townMeal?.supply?.stages;
  return (Array.isArray(stages) ? stages : []).filter(s => s &&
    hallTier >= (s.hallTier || 1) && projectTiers >= (s.projectTiers || 0)
  ).at(-1) || null;
}
export function supplyCost(world, data) {
  const stage = supplyStage(world, data);
  if (!stage || townMouths(world) === 0) return {};
  const raw = {...stage.cost};
  for (const [key, value] of Object.entries(stage.perVillager || {})) {
    if (Number.isFinite(value) && value >= 0) raw[key] = (raw[key] || 0) + value * townMouths(world);
  }
  return basket(raw);
}
export function supplyBonus(world, data, key) {
  if (world?.wellSupplied !== true) return 0;
  const value = data?.world?.townMeal?.supply?.wellSupplied?.[key];
  return Number.isFinite(value) && value > 0 ? value : 0;
}
export function supplyAuraEffects(world, data) {
  return world?.wellSupplied === true ? data?.world?.townMeal?.supply?.wellSupplied?.effects || {} : {};
}
function territoryLedger(world, tribeId) {
  return tribeId === 'ironshield' ? world?.conquest : world?.conquest?.tribes?.[tribeId];
}
function territoryIds(data) {
  return ['ironshield', ...(Array.isArray(data?.conquest?.tribes) ? data.conquest.tribes : []).map(t => t.id)];
}
function tribeSupplyCost(world, data, tribeId) {
  const entries = tribeId === 'ironshield' ? data?.conquest?.annex : data?.conquest?.tribes?.find(t => t.id === tribeId)?.annex;
  const annex = (Array.isArray(entries) ? entries : []).find(a => a?.id === territoryLedger(world, tribeId)?.annexed);
  return basket(annex?.supply?.cost);
}
export function territorySupplyCost(world, data) {
  const total = {};
  for (const id of territoryIds(data)) for (const [key, value] of Object.entries(tribeSupplyCost(world, data, id))) total[key] = (total[key] || 0) + value;
  return total;
}
export function territorySupplied(world, data, tribeId = null) {
  const ids = tribeId ? [tribeId] : territoryIds(data);
  return ids.every(id => Object.keys(tribeSupplyCost(world, data, id)).length === 0 || territoryLedger(world, id)?.supplied === true);
}
export function supplyStatus(world, data) {
  const day = mealDay(world, data), seconds = mealConfig(data).secondsPerDay;
  return {wellSupplied: world?.wellSupplied === true, cost: supplyCost(world, data),
    stage: supplyStage(world, data)?.name || 'Not developed',
    nextIn: Math.max(0, (day + 1) * seconds - (Number(world?.elapsed) || 0)),
    territoryCost: territorySupplyCost(world, data), territorySupplied: territorySupplied(world, data)};
}
function drawSupply(world, cost) {
  const entries = Object.entries(cost), stores = world.resources || {};
  if (!entries.length || !entries.every(([key, value]) => Number.isFinite(stores[key]) && stores[key] >= value)) return false;
  for (const [key, value] of entries) stores[key] -= value;
  return true;
}
export function tickTownSupply(world, data, notify = () => {}) {
  if (!world) return null;
  const day = mealDay(world, data);
  if (!Number.isFinite(world.lastSupplyDay)) {
    world.lastSupplyDay = day;
    world.wellSupplied = false;
    return null;
  }
  if (world.lastSupplyDay >= day) return null;
  world.lastSupplyDay = day;
  const cost = supplyCost(world, data), wasSupplied = world.wellSupplied === true;
  world.wellSupplied = drawSupply(world, cost);
  if (wasSupplied && !world.wellSupplied) notify('Well Supplied lapses: the daily basket is short. Nothing was drawn; supply resumes when a full basket is available at the next daily check.');
  const territoryCost = territorySupplyCost(world, data);
  for (const id of territoryIds(data)) {
    const ledger = territoryLedger(world, id), cost = tribeSupplyCost(world, data, id);
    if (!ledger || !Object.keys(cost).length) continue;
    const wasCovered = ledger.supplied === true;
    ledger.supplied = drawSupply(world, cost);
    if (wasCovered && !ledger.supplied) notify('Frontier supply is short. Regional bonuses pause; your territory remains yours.');
  }
  return {supplied: world.wellSupplied, cost, territoryCost};
}
