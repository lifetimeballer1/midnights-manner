// Living-world calendar: 28-day seasons, date-seeded daily modifiers, and
// Grey Market deal rotation. Pure functions — the same calendar date yields
// the same season, modifier and deals for every player, which is what makes
// the frontier feel shared while staying fully local. No RNG, no saves to
// scum: the date is the seed.
import {afford, pay, auras} from '../model.js';

export const SEASON_LENGTH = 7; // days per season; 4 seasons = a 28-day cycle
export const CYCLE_DAYS = 28;
export const TRADE_CAP = 2; // times each deal can be taken per day
const DAY_MS = 86400000;
// Aura/stat keys a calendar effect may touch. Matches the keys auras()
// (model.js) actually consumes — never invent new ones here.
const VALID_EFFECTS = ['damage', 'armor', 'gather', 'carry', 'build', 'discount', 'heal', 'xp', 'survey', 'food'];
const RESOURCES = ['wood', 'food', 'gold'];

function hash(n) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^= x >>> 15) >>> 0;
}

// Whole UTC days since the epoch. UTC keeps the season boundary at the same
// moment for everyone on the same date line math, regardless of locale.
export function dayNumber(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
}

// 'YYYY-MM-DD' in UTC — the save key for per-day trade caps and the bell.
export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function seasonFor(calendar, date = new Date()) {
  const seasons = calendar?.seasons;
  if (!Array.isArray(seasons) || !seasons.length) return null;
  const length = Number.isFinite(calendar.seasonLength) && calendar.seasonLength > 0 ? Math.floor(calendar.seasonLength) : SEASON_LENGTH;
  const cycle = length * seasons.length;
  const n = ((dayNumber(date) % cycle) + cycle) % cycle;
  const index = Math.floor(n / length) % seasons.length;
  return {index, season: seasons[index], dayOfSeason: (n % length) + 1, dayOfCycle: n + 1};
}

export function modifierFor(calendar, date = new Date()) {
  const list = calendar?.daily;
  if (!Array.isArray(list) || !list.length) return null;
  return list[hash(dayNumber(date)) % list.length];
}

// Merged season + daily effects, filtered to real aura keys. Missing tables
// mean a quiet night: {} changes nothing downstream.
export function calendarEffects(calendar, date = new Date()) {
  const out = {};
  const add = effects => {
    if (!effects || typeof effects !== 'object') return;
    for (const [k, v] of Object.entries(effects)) {
      if (VALID_EFFECTS.includes(k) && Number.isFinite(v)) out[k] = (out[k] || 0) + v;
    }
  };
  add(seasonFor(calendar, date)?.season?.effects);
  add(modifierFor(calendar, date)?.effects);
  return out;
}

export function validEffectKeys() { return [...VALID_EFFECTS]; }

// The Grey Market road opens once quest XP has grown the village to level 2.
export function marketOpen(state) { return (state?.vlevel || 1) >= 2; }

export function tradeCap(deal) {
  return Number.isFinite(deal?.cap) && deal.cap > 0 ? Math.floor(deal.cap) : TRADE_CAP;
}

// Three rotating deals per day. Eligible traders (village level, in-season)
// sort stable by id with in-season wagons first, then rotate by the date
// seed — same day, same row of wagons, for everyone.
export function dealsFor(traders, calendar, date = new Date(), vlevel = 1) {
  if (!Array.isArray(traders) || !traders.length) return [];
  const seasonId = seasonFor(calendar, date)?.season?.id;
  const eligible = traders
    .filter(t => t && typeof t.id === 'string' && ((t.minLevel || 1) <= vlevel) && (!t.season || t.season === seasonId))
    .sort((a, b) => {
      const sa = a.season === seasonId ? 0 : 1, sb = b.season === seasonId ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  if (!eligible.length) return [];
  const start = hash(dayNumber(date) ^ 0x51ab) % eligible.length;
  const out = [];
  for (let i = 0; i < Math.min(3, eligible.length); i++) out.push(eligible[(start + i) % eligible.length]);
  return out;
}

const fmtBasket = basket => Object.entries(basket || {}).map(([k, v]) => `${v} ${k}`).join(' + ');
export function describeDeal(deal) { return `${fmtBasket(deal.give)} for ${fmtBasket(deal.take)}`; }

// Settles one trade against today's rotation and caps. Rolls the day over
// when the bell has not rung yet so caps never leak across dates. Returns
// {ok, deal, xp, left} or {ok:false, error} with a player-facing line.
export function performTrade(state, data, dealId, date = new Date()) {
  const key = dayKey(date);
  if (state.tradeDay !== key) { state.tradeDay = key; state.tradesUsed = {}; }
  if (!state.tradesUsed || typeof state.tradesUsed !== 'object') state.tradesUsed = {};
  const deal = dealsFor(data?.traders, data?.calendar, date, state.vlevel || 1).find(d => d.id === dealId);
  if (!deal) return {ok: false, error: 'That trader has moved on — new faces after the next bell.'};
  const cap = tradeCap(deal);
  const used = state.tradesUsed[dealId] || 0;
  if (used >= cap) return {ok: false, error: `${deal.trader || 'The trader'} shakes their head — that deal is done until tomorrow.`};
  // Phase 11 — the Lantern Towns Ledger haggles: recovered trade blessings
  // trim what the wagons take. Worlds without the shelf read exactly zero.
  let tradeCut = 0;
  try { tradeCut = Math.min(0.3, auras(state.world, data).trade || 0); } catch {}
  const give = {};
  for (const [k, v] of Object.entries(deal.give || {})) give[k] = tradeCut > 0 && Number.isFinite(v) ? Math.max(0, Math.ceil(v * (1 - tradeCut))) : v;
  if (!state.world || !afford(state.world.resources, give)) return {ok: false, error: 'Your stores fall short — gather a little more first.'};
  pay(state.world.resources, give);
  let xp = 0;
  for (const [k, v] of Object.entries(deal.take || {})) {
    if (!Number.isFinite(v) || v <= 0) continue;
    if (k === 'xp') { xp += v; continue; }
    if (!RESOURCES.includes(k)) continue;
    state.world.resources[k] = (state.world.resources[k] || 0) + v;
    state.world.gathered[k] = (state.world.gathered[k] || 0) + v;
  }
  state.tradesUsed[dealId] = used + 1;
  let haggled = 0;
  for (const [k, v] of Object.entries(deal.give || {})) haggled += Math.max(0, (Number.isFinite(v) ? v : 0) - (give[k] ?? 0));
  return {ok: true, deal, xp, left: cap - (used + 1), haggled};
}
