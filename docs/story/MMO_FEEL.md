# Midnights Manner — MMO Feel (Single-Player Only)

Feasible single-player systems that *feel* like a living realm with zero
backend, zero multiplayer, and zero network claims. Everything here runs on
the existing stack: vanilla JS, JSON data, and the versioned local save.
Nothing here sends, receives, or syncs anything.

> Rule: never promise real multiplayer, cloud saves, or cross-device play.
> Anything needing a server is marked **OUT OF SCOPE** at the end.

## 1. Village Roles & Guilds via NPCs

- **Workplace keepers as guild-faces:** each profession's senior NPC
  (e.g. *Mara the mason*, *Old Bell the shepherd*) gets one line of
  flavor and a posted-keeper aura that already exists in systems. The
  "guild" is the set of villagers sharing a workplace — shown as a roster
  with a name (*The Stillwater Cast*, *The Timber Line Crew*).
- **Guild charters (data-only):** a workplace with 3+ posted villagers
  earns a charter title and a tiny passive (e.g. +5% gather). Charters are
  local labels + aura numbers, not factions with servers.
- **Ranks without grind:** villager count per profession unlocks rank words
  (Hand → Keeper → Warden-of-the-X). Cosmetic + small aura step. No XP
  per villager needed; counts already exist.

## 2. Daily & Seasonal Events (Local Calendar)

- **Daily lighting (local-time based):** one modifier per calendar day,
  derived from the date seed — e.g. *Bright Moon* (collectors +10%),
  *Grey Day* (builders +10%), *High Water* (ponds refill faster). Same day
  = same modifier for everyone, which *feels* shared while being fully
  local. No streak punishments; missing a day costs nothing.
- **Seasonal week (28-day local cycle):** four named weeks — *Sowing*,
  *Timber*, *Moonstone*, *Mending* — each favoring one resource with
  matching notice-board flavor. Pure date math; no downloads, no events
  server.
- **Nightly bell:** a small "day rollover" ritual at first load each day —
  bell rings, yesterday's totals are read aloud in the event log, today's
  modifier is announced. This is the ritual that makes the place feel
  lived-in.

## 3. Notice Board (Quest Flavor Engine)

- A board UI fed by data tables: rumor lines, Grey Market prices, charter
  news, and milestone prompts ("The Masons seek 200 wood — the east wall
  remembers"). Entries rotate by date-seed + game state.
- **Bounty slips:** repeatable chores dealt from a table, drawn from
  existing task kinds (build/recruit/assign/population/level/gather) with
  small payouts. Reuses the quest auto-complete path; rewards are deliberately
  smaller than story quests so the story quests stay the real pay.
- All text lives in JSON; adding a rumor never touches logic.

## 4. Trading Post (Grey Markets, Single-Player)

- **Traveling offers:** 3 rotating deals refreshed per game-day from a
  date-seeded table (e.g. 60 wood → 25 gold). Prices drift within a fixed
  band so it feels like a market without any other humans.
- **Trader tales:** each deal carries one line of origin flavor (*"Down from
  the Lantern Towns, two axles lost to the mud"*). Fiction for a price list.
- Caps per day prevent economy breaks; everything resolves instantly in
  local resources. No escrow, no other players, no waiting.

## 5. World Events (Local Raids with Ceremony)

- **Horn warnings:** scheduled campaign-style waves on the home map with
  advance notice ("Dust on the west road — raiders by dusk"), scaled to
  village level and garrison size. Uses the existing raid spawner; the
  ceremony is the new part.
- **After-action:** bell, casualty list (revived, per the fiction — *"dragged
  home"*), loot tally, and a one-line village verdict. So a bad night
  reads like news, not a ledger.
- **Fled-raider mercy:** bands that flee a dragged-out raid (the existing
  failsafe) drop a small cache and a parting line. A stuck raid ends with
  raiders dropping their packs and running — plus one joke in the log.

## 6. Local Leaderboards & Records (No Humans Needed)

- **Hall of Lanterns:** personal-best records kept in the local save —
  fastest chapter clear, largest single raid repelled, richest harvest day,
  tallest population. Displayed as carved plaques with dates.
- **Ghost comparisons:** milestone bands per record ("most manners fall
  between 12–15 raiders here") shipped as static data so a solo player can
  feel *measured* without anyone else's data ever moving.
- **Exportable boasts:** records included in the existing save export blob
  so players can share screenshots/text freely. Sharing is manual; the game
  uploads nothing.

## 7. Social-Feel Rituals

- **Bell cadence:** build-finish chime, raid horn, victory bell, nightly
  rollover. Same sounds, same order, every time. That is what makes it
a ritual.
- **Lantern count:** one lit window per villager on the title screen.
  Population growth is visible from the first frame.
- **Naming:** every 10th villager arrives with a generated trade-name;
  charter rosters list names, not counts. Twelve souls beat twelve units.
- **Seasons greet:** the seasonal week changes title-screen flavor line and
  stream shimmer tint. Cheap to build, easy to feel.

## OUT OF SCOPE (Needs a Server — Do Not Build)

Real-time multiplayer or co-op; PvP or shared raids; global chat, guilds
with other humans, or friend lists; server-authoritative leaderboards;
cloud saves or cross-device sync; daily ops pushed from a server; live
events; anything that uploads player data anywhere. If a design needs
another human's device or a database, it is cut.
