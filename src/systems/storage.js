// Central storage caps (Late-Game Economy Plan — Phase 1).
// Pure math, no DOM, no imports: reads (world, data) only. Every central
// inflow — harvest taps, collector deliveries, refiner output, trade,
// quest/mission rewards, loot, gifts — routes through depositCentral or
// grantCentral, so overflow never vanishes:
//   - production leftovers stay exactly where they were (on-site reserve,
//     carried goods, un-refined input) and resume when room opens;
//   - grant leftovers wait in world.pendingRewards until room opens.
// Old saves grandfather: an over-cap balance keeps every unit; only new
// central inflow is blocked until the player spends below the cap.
// Caps come from data: world.storageBase (the floor every village owns)
// plus every living, finished building whose spec carries a `storage` map,
// scaled by that tier's rateMultiplier, so storage grows with upgrades.
const FALLBACK_BASE = {wood: 3000, food: 3000, gold: 2000, lumber: 800, flour: 800, bread: 800, frostwood: 600, plate: 600};

function tierMult(building, spec) {
  const tier = spec?.tiers?.[Math.max(0, (building?.level || 1) - 1)];
  return Number.isFinite(tier?.rateMultiplier) ? tier.rateMultiplier : 1;
}

function baseStorage(data) {
  const base = data?.world?.storageBase;
  return base && typeof base === 'object' ? base : FALLBACK_BASE;
}

// Central limit for one resource. Keys with no data at all (a future
// resource someone forgets to size) stay uncapped — never a silent zero.
export function storageCap(world, data, key) {
  if (!key) return Infinity;
  let cap = 0, seen = false;
  const base = baseStorage(data)?.[key];
  if (Number.isFinite(base)) { cap += base; seen = true; }
  for (const b of world?.buildings || []) {
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const spec = data?.buildings?.[b.type];
    const value = spec?.storage?.[key];
    if (!Number.isFinite(value)) continue;
    cap += value * tierMult(b, spec);
    seen = true;
  }
  return seen ? cap : Infinity;
}

// Every resource the data sizes, capped or not (UI iteration helper).
export function storageCaps(world, data) {
  const keys = new Set(Object.keys(baseStorage(data) || {}));
  for (const b of world?.buildings || []) {
    if (!b || b.hp <= 0 || b.remaining > 0) continue;
    const spec = data?.buildings?.[b.type];
    if (spec?.storage) for (const key of Object.keys(spec.storage)) keys.add(key);
  }
  const out = {};
  for (const key of keys) out[key] = storageCap(world, data, key);
  return out;
}

export function centralStored(world, key) {
  const n = Number(world?.resources?.[key]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isOverCap(world, data, key) {
  const cap = storageCap(world, data, key);
  return Number.isFinite(cap) && centralStored(world, key) > cap;
}

export function centralRoom(world, data, key) {
  const cap = storageCap(world, data, key);
  if (!Number.isFinite(cap)) return Infinity;
  return Math.max(0, cap - centralStored(world, key));
}

// The single gate for central inflow. Banks what fits, hands back the
// remainder so the caller can keep it in the local buffer. `gathered`
// mirrors the legacy accounting of each call site: production paths count
// toward objectives, reward paths (grantCentral) do not.
export function depositCentral(world, data, key, amount, gathered = true) {
  const n = Number(amount);
  if (!key || !world?.resources || !Number.isFinite(n) || n <= 0) {
    return {banked: 0, leftover: Number.isFinite(n) && n > 0 ? n : 0};
  }
  const banked = Math.min(centralRoom(world, data, key), n);
  if (banked > 0) {
    world.resources[key] = centralStored(world, key) + banked;
    if (gathered && world.gathered) world.gathered[key] = (Number(world.gathered[key]) || 0) + banked;
  }
  return {banked, leftover: n - banked};
}

function queuePending(world, key, amount) {
  if (!world || !key || !Number.isFinite(amount) || amount <= 0) return;
  world.pendingRewards = world.pendingRewards || {};
  world.pendingRewards[key] = (Number(world.pendingRewards[key]) || 0) + amount;
}

// Reward flow (quest, level cache, mission, loot, gift, frontier event):
// banks now and parks the overflow on the ledger shelf; nothing is lost.
export function grantCentral(world, data, key, amount, gathered = false) {
  const {banked, leftover} = depositCentral(world, data, key, amount, gathered);
  if (leftover > 0) queuePending(world, key, leftover);
  return banked;
}

// Called once per economy tick: as room opens, held rewards land. Returns
// what landed this tick (tests read it; the sim ignores the return).
export function flushPending(world, data) {
  const pending = world?.pendingRewards;
  if (!pending || typeof pending !== 'object') return {};
  const landed = {};
  for (const [key, amount] of Object.entries(pending)) {
    if (!Number.isFinite(amount) || amount <= 0) { delete pending[key]; continue; }
    const {banked, leftover} = depositCentral(world, data, key, amount, false);
    if (banked > 0) landed[key] = banked;
    if (leftover > 0) pending[key] = leftover; else delete pending[key];
  }
  return landed;
}

export function pendingRewards(world) {
  const out = {};
  for (const [key, amount] of Object.entries(world?.pendingRewards || {})) {
    if (Number.isFinite(amount) && amount > 0) out[key] = amount;
  }
  return out;
}
