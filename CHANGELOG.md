# Midnights Manner — Extended Pass Changelog

Running log for Jesce's extended autonomous pass. One entry per item. Judgment calls flagged with **[JUDGMENT]** for Jesce's review.

---

## Item 1 — BUG PASS (combat / pathfinding / economy edge cases)
- combat.js: guard `attackTimer`/`abilityTimer` init (`??= 0`) so hand-built or
  migrated units/enemies without timers can't produce NaN cooldowns; guard
  `activateAbility` against missing gear/ability data.
- combat.js: enclosed raiders now chew the adjacent blocking building instead of
  idling forever (fixes walled-in soft-lock; raiders damage the barrier they
  stand next to when `nextStep` returns null).
- combat.js: raid failsafe — `raidAge` tracked; if a raid drags past 240s the
  remaining raiders lose heart and flee (clears soft-locked waves, counts as
  repelled with loot kept, marked `fled:true`).
- economy.js: guard zero/NaN carry capacity (division-by-zero on empty carry
  loads) — capacity floors at 1, fill/room clamped finite; collectors with no
  valid source or hall idle safely instead of NaN-ing resources.
- pathfinding.js: clamp actor/target to grid, guard NaN inputs, return null
  safely when start equals target-in-range; `move` validates speed/dt finite.
- campaign.js: guard missing mission data, clamp elapsed, require `fired`
  array — prevents fixed-step-loop races double-firing raids.
- Regression tests: `tests/extended.test.js` — 4 new tests (barrier-chew,
  zero-carry, stuck-pathfinder, raid-failsafe).
- **[JUDGMENT]** Raid failsafe at 240s is generous on purpose — real raids last
  30-90s; 240s only triggers on genuine soft-locks, never on slow-but-fair
  fights. Flag if Jesce wants harsher (120s) or a loss instead of fled-win.

## Item 2 — SAVE SCHEMA (storage.js hardened, no version bump)
- Verified the village-sim pass already added a v1→v2 migration — extended it,
  did not duplicate. Migration is now a registry (`MIGRATIONS[1]`); future
  schema steps get added as `MIGRATIONS[2]`, etc., never a wipe.
- Unknown future versions now refuse to load (return null → fresh world) rather
  than corrupt saves. `peekVersion()` helper for debugging.
- `localStorage` missing (private mode/tests) or full (quota) falls back to an
  in-memory store so the session keeps working; `persist()` still warns via
  the existing status-strip path when the browser can't keep the save.
- Old troops without `order` migrate to `order:null`. No save bump — still v2,
  all existing player saves load untouched.
- Tests: `tests/storage.test.js` (registry upgrade, future-version refuse,
  fallback save).

## Item 3 — CAMERA + LARGER MAPS (renderer.js, main.js)
- Camera `{x, y, zoom}` (0.5–2x) with `pan`/`zoomBy`/`resetCam`. Projection is
  camera-relative but pixel-identical at defaults, so the 20×16 home map
  looks exactly as before.
- Tile diamonds and sprite sizes scale with zoom; ground loops, edge falloff,
  stream and treeline now derive from `data.world.width/height` instead of
  hardcoded 20×16.
- Input: mouse wheel zooms, WASD pans, +/- zoom, 0 resets. Arrow-key hover +
  Enter placement unchanged (keyboard nav consistent).
- Verified against a synthetic 40×30 world in `tests/camera.test.js` (corner-
  to-corner routing, wall-with-gap routing, project/unproject round-trips
  incl. panned+zoomed). Default `world.json` still ships 20×16 — no giant
  default map.

## Item 4 — TROOP COMMANDS (move-to / attack-target / hold)
- `unit.order = {kind:'move',x,y} | {kind:'attack',targetId} | {kind:'hold'} | null`.
  Orders override autonomy until arrival / target death / resume.
- Combat troops: move ignores enemies en route; attack chases the named raider;
  hold stands and strikes only in range. Collectors obey move/hold (pause
  gathering while displaced). Old saves migrate `order:null` — saves safe.
- UI: click/tap own troop to select (gold ring + order tag), click tile =
  move (dashed leader line), click raider = attack, H or Hold button = hold,
  Resume/Esc clears. Keyboard: arrows+Enter flow unchanged, extended to
  troops.
- Tests: `tests/commands.test.js` (move overrides, attack chases, hold stays,
  collectors refuse attack orders).

## Item 5 — CONTENT (data JSON only, no logic changes)
- Checked the village-sim pass first: 17 troops / 20 buildings / 3 missions on
  main. New content complements, nothing duplicated.
- 3 troops: **Warden** (slow tank, 210 HP, splash), **Ranger** (fragile
  sniper, 5.0 range, fastest), **Forager** (fast food collector bound to the
  Grove). Stat lines all differ — no reskins. Reuse existing gear
  (sword/bow/sickle with roles extended) so no new items needed.
- 2 buildings: **Moonberry Grove** (2×2 food + forager workplace) and **Signal
  Watchfire** (1×1 long-range light defense — outranges the tower at lower
  damage; distinct triangle: tower = damage, watchfire = reach, trap = burst).
- 3 missions: **Ember Road** (04, wood sprint + one late raid), **Moonwell
  Plenty** (05, dual food+gold), **The Last Stand** (06, 3 waves, 5-troop cap).
  Chain: long-night → ember-road → moonwell → last-stand. Grove/watchfire
  added to `locked` so missions meaningfully unlock them; existing saves
  unaffected (they simply haven't earned them yet).
- 7 original sprites via `scripts/content_sprites.py` (same outline/shade
  pass as the base set). Tests: `tests/content.test.js`.
- **[JUDGMENT]** Forager gathers ONLY from groves (`gatherFrom`). Without a
  grove it idles — intended pairing, but flag if Jesce wants a fallback food
  source.

## Item 6 — BALANCE PASS (simulated chapters 1-6, economy note applied)
- Simulated all 6 chapters' objectives in `tests/balance.test.js` — every
  target reachable inside its timer (no soft-locks, quick wins kept).
- Jesce's economy note applied to MID-GAME ONLY, opening preserved:
  passive income ×0.75 and collector fill ×0.85 once `elapsed > 300s`;
  upgrades after 5 min take ×1.5 longer; tier-3 costs ×1.5; troop training
  L6+ costs ×1.5. New construction (4–6s), tier-1/2 costs, L1–5 training and
  all mission targets untouched.
- **[JUDGMENT — TENSION FLAGGED]** The earlier fun pass sped up the first 5
  minutes on purpose; this pass slows everything after it. The 300s cliff is
  a step (full → 75%), not a curve — a sharp-eyed player may feel the
  downshift at minute 5. If Jesce wants, replace with a gradual ramp
  (e.g. lerp 1.0→0.75 over minutes 5–10). Chose the step for simplicity and
  testability; easy to smooth later.

## Item 7 — VISUAL/UI POLISH (time-boxed, gaps only)
- Checked main: prior visual passes + pro-art worker cover palette, density,
  chrome and phone layout. Filled two genuine gaps only, left the rest:
- Title screen (`index.html` overlay + styles + boot dismiss) — the game
  previously dropped players straight into the village with no landing.
  Cosmetic only; sim runs behind, no logic touched.
- Death poof particle on slain raiders + troop order markers (selection ring,
  move leader-line, ➤/⚔/✋ tags) supporting Item 4.
- NOT done (pro-art territory, deliberately untouched): final sprite art,
  phone-device screenshot check, audio expansion.
