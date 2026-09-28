# Multiplayer Setup — Midnights Manner visits + helping

The game is **local-first**: without any of the steps below, everything runs
exactly as before — local saves, friends list on this browser, gifts and help
queued locally. These steps light up the **cloud shelf**: cross-device saves,
visits to real friend villages, and delivered gifts.

You will need a free [Supabase](https://supabase.com) account. Nothing in the
game invents keys — you paste your own project's values.

## 1. Create the project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name it `midnights-manner`, pick a region near you, set a database password.
3. Wait for provisioning, then open **Project Settings → API**. Copy:
   - **Project URL** → this is `YOUR_SUPABASE_URL` (looks like `https://xyzcompany.supabase.co`)
   - **anon public key** → this is `YOUR_SUPABASE_ANON_KEY` (a long `eyJ…` string)

## 2. Create the tables (SQL Editor → New query → Run)

```sql
-- One row per player. RLS keeps every player on their own row;
-- friend villages are readable by code, public columns only.
create table villages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  friend_code text unique not null,
  save jsonb not null default '{}'::jsonb,
  public jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table villages enable row level security;
create policy "own row full access" on villages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "friend villages readable by code" on villages
  for select using (true);  -- only username/public/updated_at are ever selected by code (see queries below)

-- Help deliveries: gifts + build speed-ups waiting for pickup.
create table helps (
  id uuid primary key default gen_random_uuid(),
  to_code text not null,
  payload jsonb not null,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table helps enable row level security;
```

> Tightening note: the "readable by code" policy above allows selecting rows;
> the game only ever selects `username, public, updated_at` when visiting, so
> full `save` blobs stay unasked-for. If you prefer strictness, replace that
> policy with a `SECURITY DEFINER` function returning only those columns.

```sql
create policy "anyone can send help" on helps
  for insert with check (true);
create policy "anyone can read unclaimed help" on helps
  for select using (claimed = false);
create policy "anyone can claim help" on helps
  for update using (true) with check (true);
```

Help rows carry only `{id, kind, from, to, resource?, amount?, seconds?}` —
a sender username and a gift, never emails or tokens. Inbox delivery dedupes
by `id`, so double-claims are harmless.

## 3. Enable auth providers (Authentication → Providers)

- **Email**: on by default — no action needed.
- **Google**: turn on **Google**, add your **Client ID / Secret** from
  [Google Cloud Console](https://console.cloud.google.com) → APIs & Services →
  Credentials → OAuth client (Web). Add your game's URL under
  **Authentication → URL Configuration → Redirect URLs**.

## 4. Paste the keys into the game

The game never ships keys. On the device that plays:

1. Open the village, then the browser console (or a tiny bookmarklet), and run:

```js
localStorage.setItem('midnights-manner-cloud', JSON.stringify({
  url: 'YOUR_SUPABASE_URL',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
}));
```

2. Reload, open **Friends → Cloud shelf → Save to cloud**.
3. Sign in with Google or email when prompted.

To go back to pure local play, clear that key:

```js
localStorage.removeItem('midnights-manner-cloud');
localStorage.removeItem('midnights-manner-cloud-session');
```

## 5. What works where

| Feature | Offline / local-only | With Supabase |
|---|---|---|
| Build, raid, campaign, saves | ✅ untouched | ✅ untouched |
| Username + friend code | ✅ on this browser | ✅ synced |
| Friend list (username-only add) | ✅ local list | ✅ synced |
| Send gift / lend hands | ✅ queued in outbox | ✅ delivered to inbox |
| Receive help | ✅ local loopback on load | ✅ from friends |
| Read-only village visits | ❌ waits for cloud | ✅ by friend code |
| Cloud save (second device) | ❌ | ✅ last-write-wins + social union |
| Activity feed / chronicle | ✅ local events | ✅ merged across devices |
| Leaderboard | local friends only | ✅ ranks visiting snapshots |

Privacy law, enforced in code (`src/multiplayer.js`): identity is **username +
village** only. Friend-add accepts a name and a code — never an email, never a
contact search. Public snapshots expose `username, vlevel, xp, population,
buildings, updatedAt` — nothing else.
