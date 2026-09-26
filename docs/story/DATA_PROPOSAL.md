# Midnights Manner — Data Proposal (Future Work Only)

Proposed future data additions to support the story bible and MMO-feel
systems. **Nothing here is implemented.** No code, schema, or migration
changes ship with this document. Implement only after the active merge
lands, one item at a time, with tests per item.

## Proposed New Files (all under `data/`)

- `data/rumors.json` — notice-board lines: `{ id, text, weight, season?,
  requires? }`. Pure flavor; UI picks by date-seed + state.
- `data/bounties.json` — repeatable chore templates reusing quest task kinds:
  `{ id, name, text, task, xp, rewards, dailyCap }`. Rewards below story
  quest levels by design.
- `data/traders.json` — Grey Market deal tables:
  `{ id, give, take, flavor, minLevel, season? }`. Rotation is date-seeded,
  3 offers per game-day, per-day caps.
- `data/calendar.json` — daily modifiers + 28-day season names:
  `{ daily: [{ id, name, text, effects }], seasons: [4 names w/ effects] }`.
  Effects reference existing aura/stat keys only.
- `data/charters.json` — workplace guild titles and rank words:
  `{ workplace, charterName, ranks: [names], auraStep }`.
- `data/records.json` — Hall of Lanterns plaque definitions:
  `{ id, name, flavor, stat }`. Values live in the save; this file is labels.
- `data/names.json` — trade-name pools for every-10th-villager naming:
  `{ given: [...], trade: [...] }`. All original names.

## Proposed Field Additions (existing files, additive only)

- `quests.json` entries: optional `giver` (string), `flavor` (string),
  `act` ("I"|"II"|"III"|"IV"). All optional; old entries load unchanged.
- `missions.json` entries: optional `act`, `beat` (one-line design note),
  `ceremony` (`{ warning, victory, defeat }` strings). All optional.
- `world.json`: optional `calendar` (`{ seasonLength, epoch }`) and
  `records` (array of record IDs to track). Absent = feature off.
- Troop entries (`troops.json`): optional `tradeName` pool key and
  `charter` (workplace id). Buildings (`buildings.json`): optional
  `charterName`. Never rename existing keys.

## Save-Migration Notes

- Current save version is **v2** with a `MIGRATIONS[1]` registry
  (see CHANGELOG Items 2/8). Every addition below follows that pattern.
- New save keys (`records`, `boardSeen`, `tradeDay`, `calendarDay`,
  `tradeNames`) must be **optional with defaults**; a `MIGRATIONS[2]`
  step backfills them so v2 saves load untouched.
- Never bump the version for flavor-only tables (rumors, names) — they
  need no save state. Bump only when persisted state gains a key.
- Unknown future versions still refuse to load (fresh world) per Item 2.
- Export/import blob (`importSaveBlob`) must run the same registry; new
  keys included in the blob with readable failure messages preserved.
- Suggested order after the merge: (1) quest/mission flavor fields, (2)
  rumors + names (no migration), (3) calendar + traders (MIGRATIONS[2]),
  (4) charters + records (same migration or [3] if split).

## Explicit Non-Goals

No server fields, no player IDs, no auth tokens, no cloud-save pointers,
no cross-device anything. No schema change that requires wiping saves.
