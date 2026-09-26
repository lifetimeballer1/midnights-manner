# Midnights Manner — Extended Pass Changelog

## 20-phase: Act V Foundations (2026-09-26)

Applies NEXT20_DESIGN.md Phases 1–5 (docs/NEXT20_DESIGN.md now lives with the game). Jesce approved the full plan; where main had already moved past the doc baseline, the plan ADAPTED — never reverted. Verify: `npm test` 123/123, `npm run build` green (153 precached). Save version 4 → 5 (armor wardrobe backfill only).

- Ph1 Scriptorium's Due: world 20×16 → 20×17 with a 5th EXPANSION row (L6 payout); Scriptorium tier 3 observatory gated by `tierGates: {3: 7}` (new generic level-gated-tier mechanism in `upgrade()` + inspector); Scholar's Orrery (first keeper gear with real stats: survey ×1.25, +0.06 XP/s) earned via Quest 9 `chart-the-dark` (gather gold 400, +150 XP — quest XP total 860, L6 reachable through quests); quests gain generic `unlocks` (mirrors missions) and `log` (Chart Log panel in Tales of the Frontier — Issa's record, not a toast). Keeper-gear read-through in `auras()` (survey mult, xpAura/xpMult, aura-key flat adds; empty-stat tomes behave exactly as before).
- Ph2 The Second Trade: new `upgrade` task kind (`{kind, type|string|array, level}`) in `taskDone`/`questProgress`; Quest 10 `tomm-s-flocks` (pasture→2, +130 XP, unlocks Herding Crook + Berry Basket — buyable at scythe-band costs once earned); Tomm the herder graduates from flavor mention to giver + log. **[ADAPTED]** The doc assumed a 4-type growth monopoly; main already runs an 18-type rotation including shepherd/forager, so no growth change was needed.
- Ph3 Beds for Dozens: Apprentice troop (keeper, maxLevel 15 — first lower cap, cottage/welcome job) debuting the K1 kit (attune/aura-share, armor, mend/passive-regen; veteran-x + sage /xp-trickle/ defined for later K-tracks); `beds` aura key (+1/welcome hand, gear stacks, +3 cap) read in `housing()`; cottage tier 3 (16 beds) + `workplace: apprentice`; Longhouse (14 beds, `minLevel: 5` — new generic level-gated-building mechanism in `build()` + shop); Hearth Apron (beds+1); Padded Coat on a real second gear axis (`slot: armor`, `armor`/`armorOwned` unit fields, `gearArmor()` multiplicative helper, combat reads it under the 0.8 ceiling); Quest 11 `open-doors` (pop 10, unlocks apprentice; recruit() now honors locks). Save v5 backfills empty wardrobes. **[JUDGMENT]** Armor stacks additively into the existing reduction sum for now; the full multiplicative-capped-0.6 doctrine lands with Phase 7's armor economy. Armor pieces have no renderer paper-doll yet (deferred with reason — per-item draw fns needed).
- Ph4 Keeper's Tools: Quest 12 `sarella-s-standard` (forge-2 AND armory-2 via array upgrade task, +140 XP — total 1130, deliberately 20 short of L7) unlocks all five toolkit-band tools; the player's scarce gold picks the ONE (choice-by-scarcity, replay/counter-pick hook). **[JUDGMENT]** A modal choice dialog would be truer to "choice of one" but costs a UI flow; scarcity-choice preserves the design intent with zero new UI. Fixed a real find: main-hand `carry` stats (cart/awl) leaked into the global aura — gear→aura now uses distinct `carryAura` (oiled-awl), per-unit capacity untouched.
- Ph5 The Forked Road: M07 `ashen-ford` / M08 `hollow-dam` share `requires: [last-stand]` (first branch); showcase=unlock on both (ford pre-places stonewall→unlocks pikewoman+pike+kite-shield; dam fields pikewomen→unlocks stonewall; neither grants tower). Pikewoman debuts C1 (brace/range-drill, armor, rally/damage-drill, veteran, phalanx/guard-aura) on a new generic transient-buff system (`u.buffs`, `buff`/`guard` ability effects, UI casts any active); Pike + Kite Shield (armor 0.15, HP+20 — gear HP/speed read-through in `stats()`); Stone Wall 520/1040/1560 with data-driven `repeatPlace` (palisade converted to the same flag, behavior unchanged).
- Deferred with reasons: full Appendix-A migration of the 20 old troops to C/G/K/B kits (old kits are already role-differentiated; new troops debut new kits; migration stays optional polish, never a blocker); Q11 "branching" is gate-independence (the quest engine auto-claims in file order — pop-10 never depended on gold-400, which is the doc's actual requirement).
- Pitfalls per phase: P1 new SKUs only (no tower grants anywhere); P2 every touched level ships a payout (L5 Longhouse retroactive, L6 map row, L7 observatory); P3 no arrival-satisfiable gates (gold-400, tier-2s, pop-10, flawless-gated later); P4 no kit clones (C1/K1 debut); P5 persistent giver logs (Chart Log pages for Issa/Tomm/Old Bell/Sarella); P6 branch itself is the fix (shared prerequisite, either road qualifies).

## Progression fixes — DeepSeek review (2026-09-26)

Credit: the 7 findings below come from the DeepSeek progression review. Choice on #1 was payouts over re-tuning: thresholds stay put (market opens at L2, expansion rows, quest pacing and old saves untouched) and levels 5–7 now pay data-driven caches instead.

- 1. XP ladder: new `data/levels.json` (loaded in `main.js`, granted in `tickVillage`). L2 +30 wood, L3 +40 food, L4 +60 gold, L5 +100 wood/+80 gold, L6 +150 food/+120 gold, L7 +200 wood/+150 food/+200 gold. Quests total 710 XP (level 5); 6–7 are now earned through scholars, surveys, traders and growth, not empty. Multi-level jumps grant every skipped level. Old saves keep their level and claim nothing retroactively — no dupes, no migration.
- 2. Role kits (`data/troops.json`, 7 new `data/abilities.json` entries reusing existing effects only — no new handlers): combat = cleave/armor/heal/veteran/warlord; collectors = haste/ward/steady-hands/second-wind/harvest-master; keepers = second-wind/ward/heal/armor/focus; builders = ward/steady-hands/second-wind/haste/armor. No splash outside combat, no big damage outside combat. New abilities: ward (armor 0.15), second-wind (heal 12, 15s), steady-hands (gather 0.15), harvest-master (gather 0.35), warlord (damage 0.5), focus (damage 0.15). Combat keeps heal at 15 so the existing active-heal test still holds.
- 3. First reward: `first-harvest` now unlocks `trap` (was the free `tower`). One line; new players meet traps before the chapter-2 raids. `timber-line` still lists `trap` too (duplicate is harmless — unlocks merge by Set) — deliberately left for a later pass to re-deal chapter-2's unlock.
- 4. Unlock swap: `ember-road` (showcases a watchfire) now unlocks `watchfire`; `moonwell` (pre-places a grove + forager) now unlocks `grove`.
- 5. `east-field`: was `reach level 3` (auto-done at level 4). Now `gather 100 wood` — undone work with the same frontier-clearing teaching intent. `game.test.js` tower-unlock assertion updated to trap; quest-chain compat tests untouched.
- 6. Starvation no longer hard-resets `childTimer` to 0 — it decays at the same 0.5×/s as bed-blocking, so a short famine never wipes a nearly-grown villager. HUD: village strip shows `🌱 NN%` growth plus the plain-word stall reason (hungry / no free beds / food barely covers mouths / keeping a pantry first) and the next level cache (`🎁`) via new `growthStatus()` in `village.js`.
- 7. Growth rotation widened 4 → 18 (`START_CHILD_TYPES`): indices 0–7 stay food/wood/gold hands (pop-8/12 pacing safe — every birth counts toward population quests), builders/crafters join at 8+, healer at 12, archers/scouts/warriors/scholars after. Deterministic roster-size index, no save impact.
- Verify: `npm test` 93/93 green (7 new `tests/progression.test.js`), `npm run build` green (133 precached). No save-version bump (still v3, no migration — all changes additive or data-only). Balance numbers above are starting points; watch whether L5–L7 caches trivialize the mid-game slowdown before tuning further.

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


## Mobile-game conversion — September 26

- Replaced scrolling website chrome with a full-viewport game, edge HUD, quick fighter rail, large bottom actions and contextual selection controls.
- Added touch pan/pinch, zoom anchoring, high-DPI Canvas resize, precise sprite hit areas and responsive portrait/landscape overlay menus.
- Added preview/confirm placement to prevent accidental purchases; menu filters for economy, defense, village jobs, fighters and recruitment.
- Fixed UUID-based animation arithmetic producing NaN coordinates (invisible characters/smoke), and balanced Canvas save/restore around screen shake.
- Retained all professions, six missions, quests, assignments, population/expansion, revised sprites and existing save migration.
- Added capped tap-to-collect production bonuses, visible raid/quest progress, welcome pause, settings focus management, app icons and a standalone home-screen manifest.
- Added movement destination validation, blocked relocation during raid warning, corrected displayed high-level training costs and defeat repair totals.
- Extended real-browser tests to exercise actual pointer/touch input, portrait/landscape and save continuity.

## Item 8 — MOBILE COMPLETION (Phases A-E + 1-3 catch-up, 2026-09-26)

### Catch-up (Phases 1-3, were absent — verified by reading code, not assumed)
- `src/camera.js` (new): projection/pan/zoom math in CSS-px space, zoom ladder [0.55..3], focal-anchored `zoomAt`, `panPixels` inverts projection. Renderer delegates; old `Renderer.project/unproject/pan/resetCam` API kept so `tests/camera.test.js` still passes.
- `src/input.js` (new): `MapInput` Pointer Events, 7px drag-vs-tap threshold, one-finger pan, two-finger pinch, wheel zoom; a drag never becomes a build tap.
- `renderer.resize()` (new): canvas backing = CSS box x min(DPR,2), `cx=w/2, cy=h*.51`; boot + ResizeObserver + orientationchange. `cell()`/`cellAt()` pick in CSS px (DPR can no longer skew taps).
- Two-step placement (2b): first tap stages a ghost preview with zero spend (`Game.canBuild` pure pre-flight), second tap on the same tiles or `#confirm-place` commits exactly once. `browser-smoke.mjs` updated to pointer-event taps asserting preview-spends-nothing then builds-once, plus drag-pans and pinch-zooms assertions.
- Zoom ladder/ceiling (fixes the 3.6x-vs-docs drift): wheel/keys/fit snap to rungs; pinch clamps free. CHANGELOG Item 3's "0.5-2x" is superseded by 0.55-3x (honest ceiling for 32px art).

### Phase A — Performance
- Static isometric layer cached keyed by (cam.x, cam.y, zoom, width, height, grid, map, bounds); per frame the cached layer blits and only buildings/troops/enemies/effects/selection/ghost/overlays draw. Capture skips shaken frames so combat shake never bakes in; node/DOM-less contexts fall back to direct paint (`_noCache`).
- Integer sprite scaling: draw size snaps to 32*k (32/64/96/128) — no fractional shimmer under `image-rendering:pixelated`. UI sprite sizes snapped to whole multiples (build cards 64, people 48, gear 32).
- Hot path: DPR transform set once per frame, size-derived clear/vignette/banner/grade rects (no more 1100x740 constants), reused draw list (no spread-copy per frame), stream shimmer kept dynamic in one short loop, vignette/moon-glow baked into the static layer.
- `?perf` overlay + `renderer.frameReport()` (avg/p50/p95) + smoke writes `artifacts/frame-stats-390x844-dpr2.json`. **UNVERIFIED: no measured before/after numbers — no Chrome on this host; run `npm run test:browser` in CI and paste the JSON.**
- Outline-bug fix ported (immutable mask) into `generate_sprites.py`, `content_sprites.py`, `generate_village_sprites.py`. Did NOT run the two banned scripts; `generate_village_sprites.py` was read and fixed but NOT run (no Python on this host) — re-verify sprites before/after if run.
- `scripts/contact-sheet.mjs` (new, dependency-free): `artifacts/contact-sheet.html` + data<->file lockstep gate; `tests/art-lockstep.test.js` enforces distinct-silhouette-per-tier in CI. 95 sprites, 0 missing, 0 orphan at write time.

### Phase B — PWA
- `manifest.webmanifest` (standalone, theme #182d27, any + any-maskable icons), `assets/icon-192/512.png` (maskable-safe, full-bleed, crescent in safe zone) + `assets/icon-180.png` (opaque, iOS) via dependency-free `scripts/make-icons.mjs`.
- `build.mjs` generates versioned `dist/sw.js` (cache `midnights-manner-v0.1.0`, 125 files precached: shell + data + all sprites) with activate-time cleanup and runtime cache-population; registration is injected into `dist/index.html` only — repo root/`npm run dev` never serves or registers a worker.
- Display choice **[JUDGMENT]**: `standalone`, not `fullscreen` — fullscreen gains nothing on desktop and risks trapping iOS navigation; edge-to-edge still holds via viewport-fit + safe-area CSS.
- **UNVERIFIED: offline second-load boot + Lighthouse installability — no Chrome on this host; verify in CI/on device.**

### Phase C — Fonts/touch polish
- HUD font commits to `system-ui` stack (was `Arial,Helvetica` resolving 3 ways across Android/iOS/desktop); display serif stack unchanged.
- 44px minimum touch targets at <=760px, bottom `#dock` tab bar (Build/People/Story) with safe-area padding, `#panel` scroll regions, subtle drop-shadow on build-card sprites for the light drawer panel, landscape (max-height:500px) compact-chrome audit.
- Full `#drawer` overlay NOT built — dock + scrollable panel covers the same navigation on honest scope; say so if Jesce wants the overlay.

### Phase D — Persistence
- Export (clipboard + prompt fallback, version-labelled) / Import (prompt) in the village footer; `importSaveBlob` runs the versioned migration registry and fails with readable messages (garbage / future-version / failed-migration / failed-validation). No `MIGRATIONS[2]` — nothing persisted changed, so no wipe and no bump (still v2). `Game.importState` applies restores. Tests in `tests/save-blob.test.js`.

### Phase E — Accessibility
- Resource identity is shape + label + hue: wood=square, food=circle, gold=rotated-diamond (gold) via `data-res` + existing WOOD/FOOD/GOLD labels; low-stock restyle kept.
- `#status` is explicitly `aria-live=polite`; new visually-hidden `#event-log` live region announces every `game.notify` event (build/raid/save/import); `#grid` exposes `aria-pressed`.

### Verification on this host
- `npm test`: 65/65 pass (51 baseline + 14 new: art-lockstep 3, save-blob 6, camera-ladder 4, +1 model import check).
- `npm run build`: green, 125 files precached.
- `npm run test:browser`: NOT RUN (no Chrome) — smoke was updated but is CI-only until a headed host runs it. Screenshots at 320/390/430/landscape + frame-stats JSON are smoke outputs, not committed artifacts.
- No new npm dependencies (still zero), no framework, no mega-file, no force-push, original art only.

## Integration — mobile lines merged (2026-09-26)

Merged local 63fe75a into upstream c91af06/ab1d536 on work branch integrate-mobile (merge, upstream wins overlaps, no rebase, no force).
Upstream kept whole: full-screen mobile HUD/drawer/placement-confirm/harvest (index.html, ui.js, input.js, camera.js, main.js boot, buildings.json harvest fields, browser-smoke pointer/touch flow, 95 fixed sprites, generate_art_pass.py mask fix, README/CHANGELOG mobile entries).
Discarded local catch-up duplicates: camera.js/input.js/renderer two-step/canBuild/preview/MapInput-callback variant, old-chrome index/styles/ui placement, local smoke additions, tests/camera-ladder.test.js (tested the discarded camera API).
Re-applied genuinely-new A-E work on top: (A) static-ground canvas cache + integer 32k sprite scale + ?perf badge + frameReport + contact-sheet.mjs + art-lockstep test + immutable-mask fixes in generate_sprites.py/content_sprites.py/generate_village_sprites.py; (B) dist-only versioned sw.js + registration + make-icons.mjs icon set (180/192/512, maskable-safe) + manifest purposes; (C) system-ui font stack + resource shape CSS; (D) storage.js exportSave/importSaveBlob + pause-overlay Export/Import + Game.importState + save-blob tests, no migration bump (still v2, no wipe); (E) data-resource shape+label CSS + #event-log live region fed by UI.refresh.
Vignette/moon-glow/day-grade stay dynamic overlays (not baked) so the cached build looks identical to upstream; stream shimmer stays a one-loop dynamic pass.

## Story-in-game pass (quest flavor, rumors, names, legends)
- data/quests.json: additive `giver`, `flavor`, `act` (I/II) on all 8 steps; data/missions.json: additive `act` (III/IV), `beat`, `ceremony` (warning/victory/defeat) on all 6 chapters. Pure additions — old entries and old saves load unchanged, still v2, no migration.
- New flavor-only tables: data/rumors.json (14 notice-board lines), data/names.json (trade-name pools), data/legends.json (5 title-screen tales). Loaded via the existing main.js JSON path (relative URLs, Pages-safe).
- Wiring: quest list + completion toasts show giver/flavor; mission cards show act/beat/warning, result overlay and return-home toasts speak ceremony lines; notice board rotates daily in the story panel; legends rotate on the title screen; every 10th newborn arrival earns a trade-name shown in the People panel.
- Tests: tests/story.test.js (7 checks: field shape, stripped-data compat, deterministic picks, named arrival, no save keys). Next: calendar + traders (needs MIGRATIONS[2]), charters + records (needs UI surface) — design only.

