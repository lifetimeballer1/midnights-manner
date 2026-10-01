import {refinementEfficiency} from './logistics.js';
// Economy dashboard (Late-Game Economy Plan — Phase 7).
// Pure math, read-only: passive output, hearth trickles, worked recipes
// and the town table, all as per-second rates the panel turns into
// per-game-day numbers. Collectors are deliberately NOT estimated — their
// hand-hauled loads are player-driven and already visible as building
// reserves; the panel says so in plain words instead of guessing.
import {auras} from '../model.js';
import {isWall} from './walls.js';
import {buildingMaxHp} from './endgame.js';
import {midgameRate, reserveMult} from './economy.js';
import {refinerCrew, crewPower} from './crafting.js';
import {mealCost, mealConfig, townMouths, supplyCost, territorySupplyCost, supplyBonus} from './food.js';
import {reserveCapacity} from '../resources.js';
import {settlingRate} from './storage.js';

export function economyDashboard(world, data) {
  const dayLength = mealConfig(data).secondsPerDay;
  const rows = {};
  const bump = (key, field, amount) => {
    if (!key || !Number.isFinite(amount) || amount === 0) return;
    rows[key] = rows[key] || {key, prod: 0, use: 0};
    rows[key][field] += amount;
  };
  const aura = auras(world, data);
  // Passive producers fill their on-site reserves; a full reserve pauses
  // the drip, exactly like the sim.
  for (const b of world.buildings || []) {
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const spec = data.buildings[b.type];
    if (!spec?.production) continue;
    const tier = spec.tiers?.[Math.max(0, (b.level || 1) - 1)];
    const mult = Number.isFinite(tier?.rateMultiplier) ? tier.rateMultiplier : 1;
    const held = Number.isFinite(b.harvestBonus) ? Math.max(0, b.harvestBonus) : 0;
    if (held >= reserveCapacity(spec, b.level || 1)) continue;
    bump(spec.production, 'prod', (1 + supplyBonus(world, data, 'production')) * spec.rate * mult * reserveMult(b) * midgameRate(world.elapsed, 0.75));
  }
  // Hearth trickles (posted shops pour food and plate straight in).
  bump('food', 'prod', Number(aura.food) || 0);
  bump('plate', 'prod', Number(aura.plate) || 0);
  // Worked recipes: crewed refiners eat inputs and pour outputs at pace.
  for (const b of world.buildings || []) {
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const spec = data.buildings[b.type];
    const recipes = spec?.refine;
    if (!Array.isArray(recipes) || !recipes.length) continue;
    const power = crewPower(refinerCrew(world, data, b))*refinementEfficiency(world,data,b);
    if (power <= 0) continue;
    const tier = spec.tiers?.[Math.max(0, (b.level || 1) - 1)];
    const mult = Number.isFinite(tier?.rateMultiplier) ? tier.rateMultiplier : 1;
    for (const r of recipes) {
      const runs = (Number.isFinite(r?.perSec) ? r.perSec : 0) * mult * power;
      if (runs <= 0) continue;
      for (const [k, v] of Object.entries(r.in || {})) bump(k, 'use', v * runs);
      for (const [k, v] of Object.entries(r.out || {})) bump(k, 'prod', v * runs);
    }
  }
  // The town table: one meal per game-day in food and bread.
  if (townMouths(world) > 0) {
    const meal = mealCost(world, data);
    bump('food', 'use', meal.food / dayLength);
    bump('bread', 'use', meal.bread / dayLength);
  }
  for (const cost of [supplyCost(world, data), territorySupplyCost(world, data)]) {
    for (const [key, amount] of Object.entries(cost)) bump(key, 'use', amount / dayLength);
  }
  for (const key of Object.keys(world.resources || {})) bump(key, 'use', settlingRate(world, data, key));
  const list = Object.values(rows)
    .map(r => ({...r, net: r.prod - r.use}))
    .filter(r => Math.abs(r.prod) > 1e-9 || Math.abs(r.use) > 1e-9)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || (a.key < b.key ? -1 : 1));
  return {dayLength, rows: list};
}

// Settlement health snapshot (Living Kingdom Phase 8).
// Pure math, read-only: living builder-role troops counted by builderTask
// kind (else idle when taskless and orderless), plus the weakest living
// wall/gate/rampart by hp/maxHp with its map side. Cached 5s per world.
const healthCache = new WeakMap();
export function settlementHealth(world, data) {
  const bucket = Math.floor((world.elapsed || 0) / 5);
  const hit = healthCache.get(world);
  if (hit && hit.bucket === bucket) return hit.value;
  const builders = {construction: 0, repair: 0, road: 0, idle: 0};
  for (const u of world.troops || []) {
    if (!u || u.hp <= 0) continue;
    if (data.troops[u.type]?.role !== 'builder') continue;
    const kind = u.builderTask?.kind;
    if (kind === 'construction' || kind === 'repair' || kind === 'road') builders[kind]++;
    else if (!u.builderTask && !u.order && !u.emergency && !u.expedition) builders.idle++;
  }
  let weakWall = null;
  const cx = (data.world.width || 0) / 2, cy = (data.world.height || 0) / 2;
  for (const b of world.buildings || []) {
    if (!b || b.hp <= 0 || !isWall(b)) continue;
    const max = buildingMaxHp(b, data);
    if (!Number.isFinite(max) || max <= 0) continue;
    const frac = b.hp / max;
    if (weakWall && frac >= weakWall.frac) continue;
    const size = data.buildings[b.type]?.size || 1;
    const dx = (b.x + size / 2) - cx, dy = (b.y + size / 2) - cy;
    weakWall = {id: b.id, type: b.type, side: Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N'), frac};
  }
  const value = {builders, weakWall};
  healthCache.set(world, {bucket, value});
  return value;
}
