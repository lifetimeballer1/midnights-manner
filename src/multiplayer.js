// Async multiplayer core: visiting + helping. Pure logic only — no DOM,
// no network, no localStorage. Safe to import from node tests and the
// browser alike. Privacy law (Jesce): identity is username + village only.
// Email / login tokens never enter these structures, ever.
import {grantCentral} from './systems/storage.js';
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,16}$/;
export const FRIEND_CODE_RE = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/;
export const GIFTABLE = ['wood', 'food', 'gold', 'lumber', 'flour', 'bread'];
export const GIFT_MIN = 1;
export const GIFT_MAX = 100;
export const GIFTS_PER_DAY = 3;
export const HELPS_PER_DAY = 3;
export const SPEEDUP_SECONDS = 60;
export const FEED_CAP = 30;
export const FRIEND_CAP = 50;
export const RENAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // Jesce privacy rule: one rename per 30 days

export function normalizeUsername(name) {
  return String(name || '').trim();
}

// Username-only identity. Rejects emails (@), blanks, and anything outside
// 3-16 letters/digits/_/-. Returns {ok, name} or {ok:false, error}.
export function validateUsername(name) {
  const clean = normalizeUsername(name);
  if (!clean) return { ok: false, error: 'Pick a village name to play under — 3 to 16 letters or numbers.' };
  if (clean.includes('@')) return { ok: false, error: 'Usernames only — never an email. Villages know names, not inboxes.' };
  if (!USERNAME_RE.test(clean)) return { ok: false, error: 'Use 3–16 letters, numbers, _ or -. No spaces, no emails.' };
  return { ok: true, name: clean };
}

// Collision helper (pure): when a username is taken (UNIQUE in the
// villages table, or already on the local friend list), suggest the
// nearest free alternative — base plus a number, kept within 3–16
// letters/digits/_/-. Returns a valid, untaken name.
export function suggestUsername(base, takenList = []) {
  const stripped = normalizeUsername(base).replace(/[^A-Za-z0-9_-]/g, '');
  const stem = (stripped || 'Villager').slice(0, 12) || 'Villager';
  const taken = new Set(
    (Array.isArray(takenList) ? takenList : []).map(s => String(s ?? '').toLowerCase())
  );
  const fits = c => USERNAME_RE.test(c) && !taken.has(c.toLowerCase());
  const fullBase = stripped.slice(0, 16);
  if (fullBase && fits(fullBase)) return fullBase;
  for (let n = 1; n <= 999; n++) {
    const suf = String(n);
    const cand = stem.slice(0, 16 - suf.length) + suf;
    if (fits(cand)) return cand;
  }
  // Deterministic fallback (no randomness — pure function of inputs).
  for (let n = taken.size + 1; n < taken.size + 1001; n++) {
    const suf = String(n);
    const cand = stem.slice(0, 16 - suf.length) + suf;
    if (fits(cand)) return cand;
  }
  return stem;
}

// Rename rule (Jesce privacy requirement): a village name can change at
// most once per 30 days. First-ever naming (no username yet) is always
// allowed. Reuses normalize/validateUsername; returns {ok, name} or
// {ok:false, error, daysLeft?[, suggestion]}. Local friend-list collisions
// also surface a suggestion; global (cloud UNIQUE) collisions are handled
// by the caller via suggestUsername(base, takenUsernames).
export function renameUsername(mp, newName, now = Date.now()) {
  const vu = validateUsername(newName);
  if (!vu.ok) return vu;
  const t = Number(now) || Date.now();
  if (mp.username && vu.name.toLowerCase() === String(mp.username).toLowerCase()) {
    return { ok: false, error: `You are already known as ${mp.username} — pick a different name to rename.` };
  }
  const clash = (mp.friends || []).some(
    f => String(f?.username || '').toLowerCase() === vu.name.toLowerCase()
  );
  if (clash) {
    const suggestion = suggestUsername(vu.name, (mp.friends || []).map(f => f?.username));
    return { ok: false, error: `${vu.name} is already on your friend list. Try ${suggestion}.`, suggestion };
  }
  const last = Number(mp.lastRenamedAt) || 0;
  if (last && t - last < RENAME_COOLDOWN_MS) {
    const daysLeft = Math.ceil((RENAME_COOLDOWN_MS - (t - last)) / 864e5);
    const dayWord = daysLeft === 1 ? 'day' : 'days';
    return {
      ok: false,
      error: `Village names rest for 30 days — ${daysLeft} ${dayWord} left before ${mp.username || 'your village'} can be renamed.`,
      daysLeft,
    };
  }
  const first = !mp.username;
  mp.username = vu.name;
  mp.lastRenamedAt = t;
  pushActivity(mp, first ? `${vu.name} raised their banner — welcome to the roads.` : `Now known as ${vu.name}.`);
  return { ok: true, name: vu.name, renamedAt: t };
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1 — readable over voice
export function randomCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validateFriendCode(code) {
  const clean = normalizeCode(code);
  if (clean.length !== 8) return { ok: false, error: 'Friend codes look like XXXX-XXXX — eight letters and numbers.' };
  if (!/^[A-Z0-9]{8}$/.test(clean)) return { ok: false, error: 'Friend codes look like XXXX-XXXX — eight letters and numbers.' };
  return { ok: true, code: clean.slice(0, 4) + '-' + clean.slice(4) };
}

export function sameCode(a, b) {
  return normalizeCode(a) === normalizeCode(b);
}

export function blankMultiplayer() {
  return {
    username: null,
    friendCode: null,
    friends: [], // [{username, code, addedAt}]
    lastRenamedAt: null, // ms epoch of last rename; enforces the 30-day rule
    inbox: [],   // incoming help awaiting pickup [{id, kind, from, ...}]
    outbox: [],  // sent help awaiting sync (cloud lights this up)
    activity: [],// newest-first feed strings with timestamps
    giftsSentDay: null,
    giftsSent: 0,
    helpsSentDay: null,
    helpsSent: 0,
  };
}

// Additive backfill for old saves: fills every missing multiplayer key,
// never touches resources/buildings/troops/progress. Idempotent.
export function ensureMultiplayer(state) {
  if (!state || typeof state !== 'object') return null;
  // Backfill in place so repeat calls return the same object (idempotent).
  const mp = state.multiplayer && typeof state.multiplayer === 'object'
    ? state.multiplayer
    : (state.multiplayer = {});
  const fresh = blankMultiplayer();
  for (const [k, v] of Object.entries(fresh)) if (mp[k] === undefined) mp[k] = v;
  if (!Array.isArray(mp.friends)) mp.friends = [];
  if (!Array.isArray(mp.inbox)) mp.inbox = [];
  if (!Array.isArray(mp.outbox)) mp.outbox = [];
  if (!Array.isArray(mp.activity)) mp.activity = [];
  if (!Number.isFinite(mp.giftsSent)) mp.giftsSent = 0;
  if (!Number.isFinite(mp.helpsSent)) mp.helpsSent = 0;
  return mp;
}

export function dayStamp(date = new Date()) {
  try { return date.toISOString().slice(0, 10); } catch { return 'unknown-day'; }
}

function countable(mp, sentKey, dayKeyName, cap, today) {
  if (mp[dayKeyName] !== today) { mp[dayKeyName] = today; mp[sentKey] = 0; }
  return (mp[sentKey] || 0) < cap;
}

export function canGiftToday(mp, today = dayStamp()) {
  return countable(mp, 'giftsSent', 'giftsSentDay', GIFTS_PER_DAY, today);
}

export function canHelpToday(mp, today = dayStamp()) {
  return countable(mp, 'helpsSent', 'helpsSentDay', HELPS_PER_DAY, today);
}

export function addFriend(mp, username, code) {
  const vu = validateUsername(username);
  if (!vu.ok) return vu;
  const vc = validateFriendCode(code);
  if (!vc.ok) return vc;
  if (mp.username && vu.name.toLowerCase() === String(mp.username).toLowerCase()) {
    return { ok: false, error: 'That is your own village — no need to add yourself.' };
  }
  const dup = mp.friends.some(f =>
    String(f.username || '').toLowerCase() === vu.name.toLowerCase() || sameCode(f.code, vc.code));
  if (dup) {
    const nameClash = mp.friends.some(f =>
      String(f.username || '').toLowerCase() === vu.name.toLowerCase());
    if (nameClash) {
      const suggestion = suggestUsername(vu.name, mp.friends.map(f => f.username));
      return { ok: false, error: `${vu.name} is already on your friend list. Try ${suggestion}.`, suggestion };
    }
    return { ok: false, error: `${vu.name} is already on your friend list.` };
  }
  if (mp.friends.length >= FRIEND_CAP) return { ok: false, error: `Friend list is full (${FRIEND_CAP}). Remove someone first.` };
  mp.friends.push({ username: vu.name, code: vc.code, addedAt: Date.now() });
  pushActivity(mp, `Befriended ${vu.name}.`);
  return { ok: true, name: vu.name, code: vc.code };
}

export function removeFriend(mp, username) {
  const before = mp.friends.length;
  const want = String(username || '').toLowerCase();
  mp.friends = mp.friends.filter(f => String(f.username || '').toLowerCase() !== want);
  return { ok: mp.friends.length < before, removed: before - mp.friends.length };
}

// Gift rule: giftable resource, 1..100, sender can afford it, daily cap,
// recipient is a friend (or self-ok flag for tests). Pure check — the
// caller moves the resources.
export function giftReason(mp, world, friendName, resource, amount, today = dayStamp()) {
  if (!GIFTABLE.includes(resource)) return `Only ${GIFTABLE.join(', ')} travel the roads — nothing else survives the trip.`;
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < GIFT_MIN || n > GIFT_MAX) return `Gifts run ${GIFT_MIN}–${GIFT_MAX} — a kindness, not a caravan.`;
  if (!mp.friends.some(f => String(f.username || '').toLowerCase() === String(friendName || '').toLowerCase())) {
    return `${friendName} is not on your friend list yet.`;
  }
  if (!canGiftToday(mp, today)) return `Three gifts a day keeps friendships honest — back tomorrow.`;
  const have = Math.floor(world?.resources?.[resource] || 0);
  if (have < n) return `Only ${have} ${resource} in storage — the gift must come from your own shelves.`;
  return null;
}

export function makeGift(mp, from, to, resource, amount) {
  const today = dayStamp();
  if (mp.giftsSentDay !== today) { mp.giftsSentDay = today; mp.giftsSent = 0; }
  mp.giftsSent += 1;
  return { id: `gift-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, kind: 'gift', from, to, resource, amount: Math.floor(amount), at: Date.now() };
}

// Speed-up rule: one in-progress build, daily cap, friend on the list.
export function speedupReason(mp, world, friendName, buildingId, today = dayStamp()) {
  if (!mp.friends.some(f => String(f.username || '').toLowerCase() === String(friendName || '').toLowerCase())) {
    return `${friendName} is not on your friend list yet.`;
  }
  if (!canHelpToday(mp, today)) return `Three helping hands a day — rest yours till tomorrow.`;
  const b = (world?.buildings || []).find(x => x.id === buildingId);
  if (!b) return 'That building is gone — the help has nowhere to land.';
  if (!(b.remaining > 0)) return 'That building already stands — lend the hand where scaffolds still rise.';
  return null;
}

export function makeSpeedup(mp, from, to, buildingId) {
  const today = dayStamp();
  if (mp.helpsSentDay !== today) { mp.helpsSentDay = today; mp.helpsSent = 0; }
  mp.helpsSent += 1;
  return { id: `help-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, kind: 'speedup', from, to, buildingId, seconds: SPEEDUP_SECONDS, at: Date.now() };
}

// Inbox pickup (runs on load + after sync): gifts pour into storage,
// speedups shorten the first still-rising build. Returns a report of what
// landed. Offline this still works for locally-queued help — no network.
// `data` is optional for old callers: without it, caps fall back to the
// world storage floor and gifts still bank.
export function applyInbox(state, data) {
  const mp = ensureMultiplayer(state);
  const report = [];
  const world = state.world;
  for (const item of mp.inbox) {
    if (!item || typeof item !== 'object') continue;
    if (item.kind === 'gift' && GIFTABLE.includes(item.resource)) {
      const n = Math.max(0, Math.min(GIFT_MAX, Math.floor(item.amount) || 0));
      if (n > 0 && world?.resources) {
        // Central storage caps (Phase 1): overflow waits on the ledgers.
        grantCentral(world, data, item.resource, n);
        report.push({ id: item.id, kind: 'gift', text: `${item.from} sent +${n} ${item.resource}.` });
        pushActivity(mp, `${item.from} sent +${n} ${item.resource}.`);
      }
    } else if (item.kind === 'speedup') {
      const secs = Math.max(0, Number(item.seconds) || SPEEDUP_SECONDS);
      const target = (world?.buildings || []).find(b => b.id === item.buildingId && b.remaining > 0)
        || (world?.buildings || []).find(b => b.remaining > 0);
      if (target) {
        target.remaining = Math.max(0, target.remaining - secs);
        report.push({ id: item.id, kind: 'speedup', text: `${item.from} lent hands — a build finishes ${secs}s sooner.` });
        pushActivity(mp, `${item.from} sped up a build (−${secs}s).`);
      } else {
        report.push({ id: item.id, kind: 'speedup', text: `${item.from} lent hands — but every scaffold already stands.` });
      }
    }
  }
  mp.inbox = [];
  return report;
}

// Read-only village visit: username + village shape only. No tokens, no
// email, no inbox, no friend codes of third parties — safe to render.
export function publicSnapshot(state) {
  const w = state?.world;
  const counts = {};
  for (const b of w?.buildings || []) counts[b.type] = (counts[b.type] || 0) + 1;
  return {
    username: state?.multiplayer?.username || 'Nameless village',
    vlevel: state?.vlevel || 1,
    xp: Math.floor(state?.xp || 0),
    population: (w?.troops || []).length,
    buildings: counts,
    updatedAt: state?.cloudUpdatedAt || null,
  };
}

// Cheap leaderboard over public snapshots: XP first, level breaks ties.
export function rankVillages(snapshots) {
  return [...snapshots]
    .filter(s => s && typeof s.username === 'string')
    .sort((a, b) => (b.xp || 0) - (a.xp || 0) || (b.vlevel || 1) - (a.vlevel || 1))
    .slice(0, 20);
}

export function pushActivity(mp, text) {
  mp.activity.unshift({ text: String(text), at: Date.now() });
  if (mp.activity.length > FEED_CAP) mp.activity.length = FEED_CAP;
  return mp.activity;
}

// Cloud merge: last-write-wins for the world, union for the social graph.
// Deterministic: same inputs always merge the same way. Local unsynced
// progress (newer updatedAt) is never clobbered by older cloud data.
export function mergeCloudSave(local, remote) {
  if (!remote || typeof remote !== 'object') return { state: local, winner: 'local' };
  if (!local || typeof local !== 'object') return { state: remote, winner: 'remote' };
  const lt = Number(local.cloudUpdatedAt) || 0;
  const rt = Number(remote.cloudUpdatedAt) || 0;
  const winner = rt > lt ? 'remote' : 'local';
  const base = winner === 'remote' ? structuredClone(remote) : structuredClone(local);
  const lmp = local.multiplayer || {};
  const rmp = remote.multiplayer || {};
  const seen = new Set();
  const friends = [];
  for (const f of [...(lmp.friends || []), ...(rmp.friends || [])]) {
    const key = String(f?.username || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    friends.push(f);
  }
  const seenAct = new Set();
  const activity = [...(lmp.activity || []), ...(rmp.activity || [])]
    .filter(e => e && !seenAct.has(e.text + '|' + e.at) && seenAct.add(e.text + '|' + e.at))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, FEED_CAP);
  const inboxIds = new Set((base.multiplayer?.inbox || []).map(i => i?.id));
  const inbox = [...(base.multiplayer?.inbox || [])];
  for (const item of [...(lmp.inbox || []), ...(rmp.inbox || [])]) {
    if (item?.id && !inboxIds.has(item.id)) { inboxIds.add(item.id); inbox.push(item); }
  }
  base.multiplayer = { ...blankMultiplayer(), ...(base.multiplayer || {}), friends, activity, inbox };
  base.cloudUpdatedAt = Math.max(lt, rt);
  return { state: base, winner };
}

export function stampCloud(state) {
  state.cloudUpdatedAt = Date.now();
  return state.cloudUpdatedAt;
}
