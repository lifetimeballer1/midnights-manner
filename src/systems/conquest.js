// Tribal conquest (Late-Game Economy Plan — Phase 8): one frontier tribe —
// scouted, worn down by preliminary battles, then broken at its stronghold,
// and finally annexed into the Manner. The battles themselves are ordinary
// campaign missions (data/missions.json entries carrying
// `conquest: 'preliminary' | 'assault'`); this module owns the state, the
// readiness law, the leader roster (read by endgame's boss machinery) and
// the annex ledger. Pure math + storage grants; no DOM, no new save
// version — everything lands additively on world.conquest.
import {territorySupplied} from './food.js';
import {grantCentral} from './storage.js';

const AURA_KEYS = ['damage', 'armor', 'gather', 'carry', 'build', 'discount', 'heal', 'xp', 'survey', 'food', 'plate', 'produce', 'beds', 'trade'];

export function conquestData(data) {
  const c = data?.conquest;
  return c && typeof c === 'object' ? c : null;
}
export function tribeOf(data) {
  const t = conquestData(data)?.tribe;
  return t && typeof t === 'object' ? t : null;
}
export function preliminaryList(data) {
  const list = tribeOf(data)?.preliminaries;
  return Array.isArray(list) ? list.filter(p => p && typeof p.id === 'string') : [];
}
export function annexList(data) {
  const list = conquestData(data)?.annex;
  return Array.isArray(list) ? list.filter(a => a && typeof a.id === 'string') : [];
}
export function annexById(data, id) {
  return annexList(data).find(a => a.id === id) || null;
}
export function leaderList(data) {
  const list = data?.conquest?.leaders;
  return Array.isArray(list) ? list.filter(l => l && typeof l.id === 'string') : [];
}

// Read-only view: old saves arrive unscouted, with nothing recorded, and
// asking never writes a save key (panels and aura math stay pure).
export function conquestState(world) {
  const c = world?.conquest;
  const view = c && typeof c === 'object' ? c : null;
  return {
    scouted: view?.scouted === true,
    preliminaries: Array.isArray(view?.preliminaries) ? view.preliminaries : [],
    assaultWon: view?.assaultWon === true,
    annexed: view?.annexed ?? null,
  };
}
// Writers call this first: the shelf is created (or healed) additively.
export function ensureConquest(world) {
  if (!world) return {scouted: false, preliminaries: [], assaultWon: false, annexed: null};
  const c = world.conquest;
  if (!c || typeof c !== 'object') {
    world.conquest = {scouted: false, preliminaries: [], assaultWon: false, annexed: null};
    return world.conquest;
  }
  if (typeof c.scouted !== 'boolean') c.scouted = false;
  if (!Array.isArray(c.preliminaries)) c.preliminaries = [];
  if (typeof c.assaultWon !== 'boolean') c.assaultWon = false;
  if (!('annexed' in c)) c.annexed = null;
  return c;
}
export function preliminaryDone(world, id) {
  return conquestState(world).preliminaries.includes(id);
}
export function recordPreliminary(world, id) {
  const c = ensureConquest(world);
  if (id && !c.preliminaries.includes(id)) c.preliminaries.push(id);
  return c;
}
export function recordAssault(world) {
  const c = ensureConquest(world);
  c.assaultWon = true;
  return c;
}

// The muster law (data `tribe.require`): village level, renown, a barracks
// at tier, and living fighters. Every key is optional; unknown keys never
// block. Returns plain-word checks for the panel and a single reason line.
export function readinessChecks(state, data) {
  const req = tribeOf(data)?.require || {};
  const w = state?.world || {};
  const checks = [];
  if (Number.isFinite(+req.vlevel)) checks.push({label: `Village level ${req.vlevel}`, ok: (state?.vlevel || 1) >= +req.vlevel});
  if (Number.isFinite(+req.renown)) checks.push({label: `Manner Renown ${req.renown}`, ok: (w.renown || 0) >= +req.renown});
  if (Number.isFinite(+req.barracksTier)) {
    const b = (w.buildings || []).find(x => x.type === 'barracks' && x.hp > 0 && x.remaining <= 0);
    checks.push({label: `Barracks tier ${req.barracksTier}`, ok: !!b && (b.level || 1) >= +req.barracksTier});
  }
  if (Number.isFinite(+req.troops)) {
    const n = (w.troops || []).filter(t => t && t.hp > 0 && data?.troops?.[t.type]?.role === 'combat').length;
    checks.push({label: `${req.troops} fighters in the muster`, ok: n >= +req.troops});
  }
  return checks;
}
export function readinessReason(state, data) {
  const missing = readinessChecks(state, data).filter(c => !c.ok);
  return missing.length ? `The muster falls short: ${missing.map(c => c.label).join(' · ')}.` : null;
}

export function scoutReason(state, data) {
  if (!tribeOf(data)) return 'No tribe waits on this frontier.';
  if (state?.mission) return 'Scouting waits at home.';
  if (conquestState(state?.world).scouted) return 'The tribe has already been scouted.';
  return readinessReason(state, data);
}
export function beginScout(state, data) {
  const reason = scoutReason(state, data);
  if (reason) return {ok: false, error: reason};
  ensureConquest(state.world).scouted = true;
  return {ok: true, tribe: tribeOf(data)};
}

export function assaultReason(state, data) {
  if (!tribeOf(data)) return 'No tribe waits on this frontier.';
  const c = conquestState(state?.world);
  if (!c.scouted) return 'Scout the tribe before marching on its stronghold.';
  const pending = preliminaryList(data).filter(p => !c.preliminaries.includes(p.id));
  if (pending.length) return `Break the tribe's outer works first: ${pending.map(p => p.name).join(' · ')}.`;
  return readinessReason(state, data);
}

export function annexReason(state, data, id) {
  if (!annexById(data, id)) return 'That choice is not written.';
  const c = conquestState(state?.world);
  if (!c.assaultWon) return 'The stronghold still stands — there is no land to settle yet.';
  if (c.annexed) return 'The conquered keep is already claimed.';
  return null;
}
// One judgement per conquest: resources are granted through the storage
// gate (caps hold, overflow waits), caps and auras land on the same tables
// as renown and projects. Never production-for-production — it is land.
export function applyAnnex(state, data, id) {
  const reason = annexReason(state, data, id);
  if (reason) return {ok: false, error: reason};
  const annex = annexById(data, id);
  for (const [k, v] of Object.entries(annex.resources || {})) {
    if (Number.isFinite(+v) && +v > 0) grantCentral(state.world, data, k, +v);
  }
  ensureConquest(state.world).annexed = id;
  return {ok: true, annex};
}
export function conquestLimitBonus(world, data) {
  const v = annexById(data, conquestState(world).annexed)?.limitBonus;
  return Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0;
}
export function conquestAuraEffects(world, data) {
  if (!territorySupplied(world, data)) return {};
  const fx = annexById(data, conquestState(world).annexed)?.flatAuras;
  if (!fx || typeof fx !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(fx)) {
    if (AURA_KEYS.includes(k) && Number.isFinite(+v)) out[k] = +v;
  }
  return out;
}
