// Survival raid director (Phase 2): randomized attacks driven by threat.
// Pure functions — no DOM, no RNG imports. `rng` is injectable for tests.
// Threat blends village size, wealth, population, progression and victories;
// the schedule, party size and warning all read the resulting band.
export const THREAT_LABELS = ['QUIET', 'GUARDED', 'THREATENED', 'MENACING'];

export function directorConfig(data) {
  const c = data?.world?.homeRaids || {};
  const theft = c.theft || {};
  return {
    interval: Number.isFinite(c.interval) ? c.interval : 240,
    minQuiet: Number.isFinite(c.minQuiet) ? c.minQuiet : 150,
    majorAt: Number.isFinite(c.majorAt) ? c.majorAt : 6,
    majorWarning: Number.isFinite(c.majorWarning) ? c.majorWarning : 30,
    bandBonus: Array.isArray(c.bandBonus) && c.bandBonus.length === 4 ? c.bandBonus : [0, 0, 1, 2],
    recoverySeconds: Number.isFinite(c.recoverySeconds) ? c.recoverySeconds : 90,
    theftAfterWave: Number.isFinite(theft.afterWave) ? theft.afterWave : 1,
    theftGoldPct: Number.isFinite(theft.goldPct) ? theft.goldPct : 0.08,
    theftFoodPct: Number.isFinite(theft.foodPct) ? theft.foodPct : 0.05,
    theftCap: Number.isFinite(theft.cap) ? theft.cap : 150,
  };
}

// Weighted settlement pressure, roughly 0..5+. Fresh villages sit under 1.2.
export function threatOf(world, state, data) {
  const w = world || {};
  const buildings = (w.buildings || []).filter(b => b && b.hp > 0 && !b.remaining).length;
  const wealth = ['wood', 'food', 'gold', 'frostwood', 'plate']
    .reduce((n, k) => n + (w.resources?.[k] || 0), 0);
  const population = (w.troops || []).length;
  const progress = (state?.vlevel || 1) + (state?.unlocks || []).length + (state?.completed || []).length;
  const victories = (w.wave || 0) + (w.flawlessRaids || 0);
  const parts = {
    size: buildings / 12,
    wealth: wealth / 1500,
    population: population / 8,
    progress: progress / 10,
    victories: victories / 6,
  };
  const score = parts.size + parts.wealth + parts.population + parts.progress + parts.victories;
  const band = score < 1.2 ? 0 : score < 2.2 ? 1 : score < 3.4 ? 2 : 3;
  return { score, band, label: THREAT_LABELS[band], parts };
}

// How long after `elapsed` the next horn sounds. Higher bands come sooner,
// jittered ±25%, never below minQuiet so there is always room to rebuild.
export function nextDelay(world, state, data, rng = Math.random) {
  const cfg = directorConfig(data);
  const { band } = threatOf(world, state, data);
  const scale = [1.15, 1.0, 0.85, 0.7][band];
  const roll = typeof rng === 'function' ? rng() : 0.5;
  const jitter = 0.75 + roll * 0.5;
  return Math.max(cfg.minQuiet, cfg.interval * scale * jitter);
}

// Party size: the classic wave curve plus a threat-band bonus, capped.
// Wave 0 keeps the gentle first-contact pair exactly.
export function raidSize(world, state, data) {
  const c = data?.world?.homeRaids || {};
  const firstCount = Number.isFinite(c.firstCount) ? c.firstCount : 2;
  if ((world?.wave || 0) === 0) return firstCount;
  const base = Number.isFinite(c.baseCount) ? c.baseCount : 3;
  const perWave = Number.isFinite(c.perWave) ? c.perWave : 1;
  const max = Number.isFinite(c.maxCount) ? c.maxCount : 8;
  const cfg = directorConfig(data);
  const { band } = threatOf(world, state, data);
  return Math.min(max, base + (world.wave || 0) * perWave + (cfg.bandBonus[band] || 0));
}

// Warnings: routine horns keep the base countdown; major assaults
// (big parties or MENACING threat) get the long horn so walls can be manned.
export function warningFor(count, band, data) {
  const c = data?.world?.homeRaids || {};
  const cfg = directorConfig(data);
  const base = Number.isFinite(c.warning) ? c.warning : 15;
  const major = count >= cfg.majorAt || band >= 3;
  return { seconds: major ? cfg.majorWarning : base, major };
}

// Theft at raid's end: raiders strip a small cut of gold/food for every
// building they flattened. Grace period through wave 1 — new villages lose
// roofs, never stores. Returns null when nothing was taken.
export function theftFor(world, data) {
  const cfg = directorConfig(data);
  if ((world?.wave || 0) <= cfg.theftAfterWave) return null;
  const flattened = (world?.buildings || []).filter(b => b && b.hp <= 0 && b.type !== 'trap').length;
  if (!flattened) return null;
  const gold = Math.min(cfg.theftCap, Math.floor((world.resources?.gold || 0) * cfg.theftGoldPct));
  const food = Math.min(cfg.theftCap, Math.floor((world.resources?.food || 0) * cfg.theftFoodPct));
  if (gold <= 0 && food <= 0) return null;
  return { gold, food, buildings: flattened };
}

export function applyTheft(world, data) {
  const taken = theftFor(world, data);
  if (!taken) return null;
  world.resources.gold = Math.max(0, (world.resources.gold || 0) - taken.gold);
  world.resources.food = Math.max(0, (world.resources.food || 0) - taken.food);
  return taken;
}
