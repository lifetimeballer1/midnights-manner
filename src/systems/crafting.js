// Phase 8 — Production chains and crafting.
// Refiner buildings (Sawmill, Gristmill) turn raw stores into refined
// goods through posted crews; the Emberforge and Wardarmory work queued
// craft orders into tiered gear with rarity. Every new resource has a
// real reader: lumber feeds master craftwork, flour feeds the bake,
// bread feeds the village in a famine (see edibleFood).
//
// Dependency-light on purpose: villagers.js only (traits, job levels).
// model.js, economy.js, village.js, game.js and storage.js import from
// here, so this module must import nothing from them (no cycles).
import {hasTrait, jobLevelMult} from './villagers.js';

// Weapon/armor tiers ARE the rarity ladder: common → uncommon → rare →
// epic → legendary, one crafted step per tier. Old gear without a rarity
// reads common — never a wipe, never a re-price.
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_INFO = {
  common: {name: 'Common', color: '#c9c9c9'},
  uncommon: {name: 'Uncommon', color: '#7fc76f'},
  rare: {name: 'Rare', color: '#6fa8dc'},
  epic: {name: 'Epic', color: '#b678e0'},
  legendary: {name: 'Legendary', color: '#f0b429'},
};
export function itemRarity(item) {
  const r = item?.rarity;
  return r && RARITY_INFO[r] ? r : 'common';
}
export function rarityName(item) {
  return RARITY_INFO[itemRarity(item)].name;
}

// A loaf in the stores eats as three food: famine insurance, not a second
// stomach. Readers: village.js pantry/starvation gates.
export const BREAD_FOOD_VALUE = 3;
export function edibleFood(world) {
  return (world?.resources?.food || 0) + (world?.resources?.bread || 0) * BREAD_FOOD_VALUE;
}

// Posted refiner crew: living hands whose calling belongs at this shop
// (own line or hosted). Mirrors the model.js crew law without importing
// it — same answer, no cycle.
export function refinerCrew(world, data, building) {
  const spec = data?.buildings?.[building?.type];
  if (!spec || !building) return [];
  return (world?.troops || []).filter(u => {
    if (!u || u.hp <= 0 || u.workplace !== building.id) return false;
    const job = data?.troops?.[u.type]?.job;
    if (!job) return false;
    return job.workplace === building.type || (spec.hosts || []).includes(u.type);
  });
}
// Crew power: job skill sharpens every hand (+8%/level past the first),
// Hard Workers lend a little everywhere, Craftsmen count a quarter more
// at the benches. An empty shop refines nothing — jobs matter.
export function crewPower(crew) {
  let power = 0;
  for (const u of crew || []) {
    let m = jobLevelMult(u);
    if (hasTrait(u, 'hard_worker')) m *= 1.12;
    if (hasTrait(u, 'craftsman')) m *= 1.25;
    power += m;
  }
  return power;
}
function tierMult(building, data) {
  const tiers = data?.buildings?.[building?.type]?.tiers || [];
  const tier = tiers[Math.max(0, (building?.level || 1) - 1)];
  return Number.isFinite(tier?.rateMultiplier) ? tier.rateMultiplier : 1;
}
// One refiner tick: each data recipe converts input stores into output
// stores, crew-scaled and tier-scaled, never spending what is not there
// (partial progress, no debt). Returns what was made, for floaters/tests.
export function tickRefine(world, data, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return {};
  const made = {};
  for (const b of world?.buildings || []) {
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const recipes = data?.buildings?.[b.type]?.refine;
    if (!Array.isArray(recipes) || !recipes.length) continue;
    const power = crewPower(refinerCrew(world, data, b));
    if (power <= 0) continue;
    const mult = tierMult(b, data);
    for (const r of recipes) {
      if (!r || typeof r !== 'object') continue;
      const runs = (Number.isFinite(r.perSec) ? r.perSec : 0) * mult * power * dt;
      if (runs <= 0) continue;
      let capped = runs;
      for (const [k, v] of Object.entries(r.in || {})) {
        if (!Number.isFinite(v) || v <= 0) { capped = 0; break; }
        capped = Math.min(capped, (world.resources[k] || 0) / v);
      }
      if (capped <= 0) continue;
      for (const [k, v] of Object.entries(r.in || {})) world.resources[k] = (world.resources[k] || 0) - v * capped;
      for (const [k, v] of Object.entries(r.out || {})) {
        if (!Number.isFinite(v) || v <= 0) continue;
        world.resources[k] = (world.resources[k] || 0) + v * capped;
        world.gathered[k] = (world.gathered[k] || 0) + v * capped;
        made[k] = (made[k] || 0) + v * capped;
      }
    }
  }
  return made;
}
// Craft timing: a posted crew shortens the work — each effective hand
// quickens the order, Craftsmen most of all, capped at quadruple speed
// so legendary steel still takes its evening. No crew, no craft.
export function craftDuration(item, power) {
  const base = Number.isFinite(item?.craft?.seconds) ? item.craft.seconds : 10;
  if (!(power > 0)) return null;
  return base / Math.min(4, Math.max(1, power));
}
// Masterwork thrift: a Craftsman on the crew wastes nothing — a quarter
// of the material cost is spared, rounded up, never below one of each.
export function craftCost(item, crew) {
  const cost = {...(item?.cost || {})};
  if ((crew || []).some(u => hasTrait(u, 'craftsman'))) {
    for (const k of Object.keys(cost)) cost[k] = Math.max(1, Math.ceil(cost[k] * 0.75));
  }
  return cost;
}
// Queue a craft order at a finished smithy. Returns {ok} or {error} —
// callers (game.startCraft, tests) read the verdict, never a throw.
export function startCraftOrder(world, data, buildingId, itemId) {
  const b = (world?.buildings || []).find(x => x?.id === buildingId);
  const item = data?.items?.[itemId];
  if (!b || !item) return {error: 'Nothing to forge.'};
  if (b.hp <= 0 || b.remaining > 0) return {error: 'The shop must stand finished first.'};
  if (!item.craft || item.craft.building !== b.type) return {error: `${item.name} is not forged here.`};
  if (b.craft) return {error: 'The forge is already at work — one order at a time.'};
  const crew = refinerCrew(world, data, b);
  const power = crewPower(crew);
  if (power <= 0) return {error: 'Post a smith first — idle forges shape nothing.'};
  const cost = craftCost(item, crew);
  const short = Object.entries(cost).some(([k, v]) => (world.resources[k] || 0) < v);
  if (short) return {error: 'Not enough stores for this order.'};
  for (const [k, v] of Object.entries(cost)) world.resources[k] = (world.resources[k] || 0) - v;
  const duration = craftDuration(item, power);
  b.craft = {item: itemId, remaining: duration, total: duration};
  return {ok: true, duration, cost};
}
// Burn craft orders down. Finished pieces land in the village stock
// (world.stock), ready to fit from the People panel. Returns completions.
export function tickCraft(world, data, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return [];
  const done = [];
  for (const b of world?.buildings || []) {
    if (!b?.craft || b.hp <= 0) continue;
    if (b.remaining > 0) continue;
    b.craft.remaining -= dt;
    if (b.craft.remaining > 0) continue;
    const itemId = b.craft.item;
    b.craft = null;
    world.stock = world.stock || {};
    world.stock[itemId] = (world.stock[itemId] || 0) + 1;
    done.push({buildingId: b.id, item: itemId});
  }
  return done;
}
export function stockCount(world, itemId) {
  return Math.max(0, Math.floor(world?.stock?.[itemId] || 0));
}
