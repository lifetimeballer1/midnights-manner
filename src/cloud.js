// Cloud sync via the Supabase REST + Auth APIs — no SDK, no dependency.
// Every method degrades to {ok:false, offline/local} when unconfigured or
// when the network fails. The game always runs local-first; the cloud is
// a quiet shelf the village copies itself onto, never a gate.
//
// Privacy: only the public snapshot shape + the save blob cross the wire,
// authenticated as the signed-in user (row-level security per SETUP doc).
// Email addresses and tokens live in memory + localStorage config only.
const CONFIG_KEY = 'midnights-manner-supabase';
const SESSION_KEY = 'midnights-manner-session';

function readJson(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeJson(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

export function getConfig() {
  const cfg = readJson(CONFIG_KEY) || {};
  const url = String(cfg.url || '').replace(/\/+$/, '');
  const anonKey = String(cfg.anonKey || '');
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function saveConfig(url, anonKey) {
  return writeJson(CONFIG_KEY, { url: String(url || '').trim(), anonKey: String(anonKey || '').trim() });
}

export function clearConfig() {
  try { localStorage?.removeItem(CONFIG_KEY); } catch {}
  try { localStorage?.removeItem(SESSION_KEY); } catch {}
}

export function configured() {
  return !!getConfig();
}

export function getSession() {
  return readJson(SESSION_KEY);
}

function authed(url, anonKey, session) {
  return {
    'apikey': anonKey,
    'Authorization': `Bearer ${session?.access_token || anonKey}`,
    'Content-Type': 'application/json',
  };
}

async function authCall(path, body) {
  const cfg = getConfig();
  if (!cfg) return { ok: false, offline: true, error: 'Cloud is not set up — local play only. See docs/MULTIPLAYER_SETUP.md.' };
  try {
    const res = await fetch(`${cfg.url}/auth/v1${path}`, {
      method: 'POST',
      headers: { 'apikey': cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.msg || data.error_description || data.error || `Sign-in failed (${res.status}).` };
    if (data.access_token) writeJson(SESSION_KEY, data);
    return { ok: true, session: data };
  } catch (e) {
    return { ok: false, offline: true, error: `Network unreachable — village stays local. (${e?.message || e})` };
  }
}

export function signUpEmail(email, password) {
  return authCall('/signup', { email, password });
}

export function signInEmail(email, password) {
  return authCall('/token?grant_type=password', { email, password });
}

export function signOut() {
  try { localStorage?.removeItem(SESSION_KEY); } catch {}
  return { ok: true };
}

// Google sign-in is an OAuth redirect — returns the URL to visit, or an
// offline notice when unconfigured. The access token returns in the URL
// hash; finishGoogleSession() harvests and stores it.
export function googleAuthUrl(redirectTo) {
  const cfg = getConfig();
  if (!cfg) return { ok: false, offline: true, error: 'Cloud is not set up — local play only.' };
  const to = encodeURIComponent(redirectTo || (typeof location !== 'undefined' ? location.href : ''));
  return { ok: true, url: `${cfg.url}/auth/v1/authorize?provider=google&redirect_to=${to}` };
}

export function finishGoogleSession() {
  try {
    const hash = new URLSearchParams(String(location?.hash || '').slice(1));
    const access_token = hash.get('access_token');
    if (!access_token) return { ok: false };
    const session = { access_token, refresh_token: hash.get('refresh_token'), expires_at: Number(hash.get('expires_at')) || 0 };
    writeJson(SESSION_KEY, session);
    history?.replaceState?.(null, '', location.pathname + location.search);
    return { ok: true, session };
  } catch { return { ok: false }; }
}

// Table layout lives in docs/MULTIPLAYER_SETUP.md (SQL included):
//   villages (user_id PK, username UNIQUE, friend_code, save JSONB, public JSONB, updated_at)
//   helps   (id PK, to_code, payload JSONB, claimed, created_at)
async function rest(table, { method = 'GET', params = '', body = null } = {}) {
  const cfg = getConfig();
  if (!cfg) return { ok: false, offline: true, error: 'Cloud is not set up.' };
  const session = getSession();
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}${params}`, {
      method,
      headers: { ...authed(cfg.url, cfg.anonKey, session), 'Prefer': 'resolution=merge-duplicates' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { ok: true, data: null };
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.message || `Cloud request failed (${res.status}).` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, offline: true, error: `Network unreachable — village stays local. (${e?.message || e})` };
  }
}

export async function pushVillage(userId, record) {
  return rest('villages', {
    method: 'POST',
    params: '?on_conflict=user_id',
    body: { user_id: userId, ...record, updated_at: new Date().toISOString() },
  });
}

export async function pullVillage(userId) {
  const r = await rest('villages', { params: `?user_id=eq.${encodeURIComponent(userId)}&select=*` });
  if (!r.ok) return r;
  return { ok: true, data: Array.isArray(r.data) ? r.data[0] || null : null };
}

export async function visitVillage(friendCode) {
  const code = String(friendCode || '').toUpperCase();
  const r = await rest('villages', {
    params: `?friend_code=eq.${encodeURIComponent(code)}&select=username,public,updated_at`,
  });
  if (!r.ok) return r;
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row) return { ok: false, error: 'No village answers to that code — check the letters with your friend.' };
  return { ok: true, data: row };
}

export async function sendHelpRow(toCode, payload) {
  return rest('helps', { method: 'POST', body: { to_code: String(toCode).toUpperCase(), payload, claimed: false } });
}

export async function collectHelpRows(myCode) {
  const r = await rest('helps', {
    params: `?to_code=eq.${encodeURIComponent(String(myCode).toUpperCase())}&claimed=eq.false&select=*`,
  });
  if (!r.ok) return r;
  const rows = Array.isArray(r.data) ? r.data : [];
  // Best-effort claim; a double-delivery is harmless (inbox dedupes by id).
  for (const row of rows) {
    await rest('helps', { method: 'PATCH', params: `?id=eq.${encodeURIComponent(row.id)}`, body: { claimed: true } });
  }
  return { ok: true, data: rows.map(x => x.payload).filter(Boolean) };
}
