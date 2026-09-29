// Festivals (Late-Game Economy Plan — Phase 6).
// Pure math, no imports: reads (state, data) only. A festival is a
// voluntary, one-shot resource sink: pay the basket once, the whole town
// celebrates for data `seconds`, and the aura table warms (data `effects`)
// plus growth speed and job training (`growth`, `jobXp`) — and an optional
// one-time `rewardXp` for the village. One festival at a time; a per-
// festival `cooldown` after it ends keeps the calendar readable. Tuning
// lives in data/festivals.json; old saves have no festival to read.
export function festivalList(data) {
  const list = data?.festivals;
  return Array.isArray(list) ? list.filter(f => f && typeof f.id === 'string') : [];
}
export function festivalById(data, id) {
  return festivalList(data).find(f => f.id === id) || null;
}
export function festivalCost(f) {
  return f?.cost && typeof f.cost === 'object' ? f.cost : {};
}
export function festivalActive(world, data) {
  const active = world?.festival;
  if (!active || typeof active.id !== 'string') return null;
  const spec = festivalById(data, active.id);
  if (!spec) return null;
  const until = Number(active.until);
  if (!Number.isFinite(until) || (Number(world?.elapsed) || 0) >= until) return null;
  return {id: active.id, spec, until, remaining: until - (Number(world?.elapsed) || 0)};
}
// Time before another festival may begin: the active one must end, then
// the last festival's own cooldown runs out. Zero when the town is free.
export function festivalCooldownLeft(world, data) {
  const last = world?.festival;
  if (!last || typeof last.id !== 'string') return 0;
  const spec = festivalById(data, last.id);
  const cooldown = Number.isFinite(+spec?.cooldown) ? Math.max(0, +spec.cooldown) : 0;
  const elapsed = Number(world?.elapsed) || 0;
  const until = Number(last.until);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until + cooldown - elapsed);
}
// Aura-table merge (model.js auras()): data effects, only known keys.
export function festivalAuraEffects(world, data) {
  const active = festivalActive(world, data);
  const e = active?.spec?.effects;
  return e && typeof e === 'object' ? e : {};
}
// Non-aura bonuses read where they apply: child growth (village.js) and
// job training (villagers.js). Zero when no festival is live.
export function festivalBonus(world, data, key) {
  const active = festivalActive(world, data);
  const v = active?.spec?.[key];
  return Number.isFinite(+v) ? +v : 0;
}
function afford(resources, cost) {
  return Object.entries(cost).every(([k, v]) => (Number(resources?.[k]) || 0) >= v);
}
// Why a festival cannot be held right now (null = it can). Plain words
// for the panel; the Game command turns this into a notice.
export function festivalReason(state, data, id) {
  const f = festivalById(data, id);
  if (!f) return 'That festival is not kept here.';
  if (state?.mission) return 'The town is away — festivals wait at home.';
  if ((state?.vlevel || 1) < (f.minLevel || 1)) return `The ${f.name} needs village level ${f.minLevel}.`;
  const cooling = festivalCooldownLeft(state?.world, data);
  if (cooling > 0) return `The town is still catching its breath — ${Math.ceil(cooling)}s until the next festival.`;
  const cost = festivalCost(f);
  const missing = Object.entries(cost).filter(([k, v]) => (Number(state?.world?.resources?.[k]) || 0) < v);
  if (missing.length) return `The ${f.name} needs ${missing.map(([k, v]) => `${v} ${k}`).join(' + ')}.`;
  return null;
}
// Pay once and light the town. Returns {ok, festival, cost, xp, until} or
// {ok:false, error} with a player-facing line. Mutates only on success.
export function beginFestival(state, data, id) {
  const reason = festivalReason(state, data, id);
  if (reason) return {ok: false, error: reason};
  const f = festivalById(data, id);
  const cost = festivalCost(f);
  const resources = state.world.resources;
  for (const [k, v] of Object.entries(cost)) resources[k] = (Number(resources[k]) || 0) - v;
  const until = (Number(state.world.elapsed) || 0) + (Number(f.seconds) || 240);
  state.world.festival = {id, until};
  return {ok: true, festival: f, cost, xp: Number.isFinite(+f.rewardXp) ? +f.rewardXp : 0, until};
}
