# Alive village: zoom-gated synchronized sound, work audio, four new themes

- Sound follows the camera: far hears only music/weather/settlement wash, village zoom adds faint work, near zoom individual buildings (nearest 5, distance-faded), close/intimate adds footsteps/machinery/combat detail. Independent cooldown pools per class, 12-voice cap, per-call vol/pitch, release/impact scheduler (capped, mute-dropping).
- Impacts match action: forge bellows->CLANG->hiss on the pulse peak, mine picks/carts, lumber chops/log drops, sawmill rasps/feeds, mill creaks on the wheel angle, farm rustles, bakery/mason/fletcher/tannery/butchery/water/market/homes/barracks voices, footsteps from real stride with stone/water/frost surfaces, bow release vs flight-delayed impact, ballista strain/THUNK with bolt visual, wood/stone wall damage, gate transit creaks + raid-close thuds, trap resets, watchfire crackle, rare raven/owl/rooster/dog/livestock/gust/thunder.
- Four procedural themes: Village Awakens (dawn), Walls of Midnight (danger/tension), After the Raid (90s aftermath memory, save-free), A Manor Ascendant (vlevel 7+ populous daylight).
- Review: `npm test` 881 green (30 new audio/sync/music checks incl. a fake-AudioContext ambience driver and real-time release/impact timing), `npm run build` green, browser smoke green, look-capture pixel-stable with identical face counts.

# Midnight Manor visual overhaul: six tiers for every reasonable building

- All 53 permanent player-built buildings now climb six tiers (T1–T3 byte-identical, saves compatible): 9 core (farm/mine/lumber/cottage/hall/longhouse/storehouse/barracks/forge), 10 production, 13 defenses, 21 nature/civic/projects. Upper tiers add lumber/plate costs and village-level gates (max 11, reachable). Combat stats carry forward unchanged per tier; only hp/rate scale.
- Procedural L4–L6 geometry in `src/scene3d.js` (both render paths in `src/building-art.js` for walls/gates): longhouse meadhall wings/shields/braziers, farm scarecrow/irrigation/shed, mine pulley/second cart, sawmill gantry, mill wheel bands, wall foundations/pennants, gate lanterns, project gold trim, plus a `masterworkDetails()` prop layer and deterministic per-building variants. One distinct 32×32 PNG per tier (warmed upper-stage art for project pairs).
- Ambient life: jobless villagers breathe (`workMotionFor` idle branch, zero at time 0 so frozen digests hold, calm freezes); occupied homes emit level-gated chimney smoke (`hearthSmokeFor`); bakery/tannery/groves join the layered probabilistic ambience sets.
- Pins updated deliberately (tier lengths, stonewall hp ladder, GW1 earlier-hash/caps, H2/H3 twelve-asset distinctness, paragon now crowns T6 walls); GW1 raw-file pins normalize CRLF/LF so Windows and CI agree.
- Review: `npm test` 846 green, `npm run build` 598 precached, browser smoke green, 60s frontier soak green (max ~3k/30k faces, 4/60 effects, zero page errors), look-capture day/dusk/night + rain/fog + phone judged.

# Late-Game Economy — Phase 8: spawn protection and the Ironshield conquest

- Spawn protection in `spawnRaid`: `spawnExclusion(world, data, buffer)` builds the settlement's exclusion ring (structures + `world.spawnBuffer`, default 2) once per raid; entries must fall outside it, and a built-up near edge pushes the muster outward into the wild before any fallback. Per-raid tile dedup added. Deliberate contract update in wall-controls ("on the grid" = the navigation grid; a side's party holds its edge or beyond).
- New `src/systems/conquest.js` + `data/conquest.json`: one tribe (Ironshield) with the muster law (level 9 / Renown 2 / barracks tier 3 / 8 fighters), scout intel, leader roster, and three annex judgements (outpost +2 limits; dismantle salvage through the storage gate; settlement gather/hearth auras). Read-only views never write save keys.
- Chapters 15–17 in `data/missions.json`: Break the Border Patrol, Silence the Watch Post, The Ironshield Keep — first-clears write the `world.conquest` ledger; the assault pays a Campaign War Chest at launch and its final wave carries Warden-Captain Brannoc via the shared boss machinery (`bossSpec` searches conquest leaders; home rotation untouched).
- Adventure → Home frontier card: scout → intel + readiness checks + outer-work marches → assault → one-time annex. Campaign cards show muster costs.
- `main.js` now loads `festivals` and `conquest` (the Phase 6 festival data was never fetched in the browser — caught while wiring this phase).
- Deliberate pin updates: mission counts 15→18 (act7, adventure), conquest missions exempt from the unlock-chain test, homeSummary read-only test drove the conquest read/write split.
- Review: `npm test` 659 green, `npm run build` 378 precached, browser smoke green (Edge) with no console errors.

# Late-Game Economy — Phase 7: the economy dashboard

- New `src/systems/dashboard.js` (pure math): per-second ledger of passive output (full reserves pause), hearth trickles, both sides of worked recipes and the town table's meal draw, presented per game-day.
- Resources panel gains the "Economy at a glance" card, a "Where wealth goes" sink list with live prices (Renown, festivals, war-chest stocks, project stages) and "The wagons" with today's deals, remaining caps and strike buttons. Read-only; no sim or save changes.
- Review: `npm test` 649 green (6 new dashboard checks), `npm run build` 375 precached, browser smoke green (Edge) with no console errors.

# Late-Game Economy — Phase 4: Town Projects

- Four staged grand works as data-driven buildings (`project: true`): Grand Market Square (3×3), Grand Granary, Manor Gardens, Monument of the Manner. Stage art added (12 PNGs, distinct per tier), multi-resource stage prices via `costCurve [1, 2, 6]`, `minLevel` + `tierGates`, one per village. Build panel gains a Projects filter.
- New generic `flatAuras` building field merged in `auras()` (tier-scaled, known keys, caps hold): market trade/carry/xp, granary storage through the Phase 1 caps, gardens beds + mend/gather, monument revival + study. Ruins and scaffolds contribute nothing.
- 3D: four new mesh silhouettes (stall plaza, grain hall, gardens, obelisk) in scene3d — the orbit sweep test caught two undefined palette names in review before shipping.
- No save-version change: projects ride the existing building schema (validated and round-tripped in tests).
- Review: `npm test` 643 green, `npm run build` 375 precached, browser smoke green (Edge) with no console errors.

# Late-Game Economy — Phase 6: war chest, festivals and the bulk market

- New `src/systems/warchest.js` + `data/world.json warChest` (level 5): five stockpiles (rations/arrows/wagons/armor/stakes) bought with real goods, armed only when raiders are on the road, and burned at raid's end — win or lose. Effects are combat-only: aura damage/armor/heal, revival lift (80% ceiling), wall guard, siege slow, and free worst-first repairs including ruins. Battle HUD gains a 🛡 War Chest button during the warning.
- New `src/systems/festivals.js` + `data/festivals.json`: Harvest Feast, War Feast, Founder's Festival — pay once, timed aura warmth plus growth/job-training bonuses, one at a time with per-festival cooldown; Founder's pays 400 village XP. Held from Adventure → Home.
- Market widened: trades may now move lumber/plate/frostwood/flour/bread, and two lossy bulk valves (provender run, northern caravan; level 7–8, one run a day) ride the existing rotation, caps and storage room check. Deliberate update to the trader-shape test.
- `auras()` merges war-chest and festival effects beside Well Fed; `reviveFraction` gains the ration lift.
- Additive save fields (`warChest`, `warChestArmed`, `festival`). Phase 3's promised rations/feast supplies land as these consumers instead of new dead resources.
- Review: `npm test` 636 green, `npm run build` 363 precached, browser smoke green (Edge) with no console errors; Home board render checked in Node (cards, buttons, no template leaks).

# Late-Game Economy — Phase 3: the town table and Well Fed

- New `src/systems/food.js` (pure math): once per game-day the town eats — food + bread by population (data `world.townMeal`). A full table is drawn exactly and grants Well Fed; a short pantry draws nothing (no partial, no debt, no starvation) and the bonus simply lapses. The loss is announced once; a village without a bread chain is never nagged.
- Well Fed rides existing systems by data: aura effects (gather/xp/heal) merge in `auras()`, child growth quickens in village.js, posted-crew job training quickens in villagers.js — all from `townMeal.wellFed`.
- Bread is now the mill chain's daily reader; travel rations / feast supplies are deferred to Phase 6 where the War Chest and festivals become their consumers.
- UI: `🍲 Well Fed` chip in the Build strip; the Resources panel reports the table, the basket and the next-meal countdown.
- Additive save fields `world.wellFed`/`lastMealDay` (fresh worlds start quiet on day zero; old saves eat on their first new day). Two existing tests that assert the last message after ticking were restored to green by the loss-only messaging rule.
- Review: `npm test` 623 green, `npm run build` 360 precached, browser smoke green (Edge) with no console errors.

# Late-Game Economy — Phase 5: renown, the endless multi-resource sink

- `data/endgame.json renown` now asks the whole basket — gold, food, lumber, bread, plate, frostwood — climbing 35%/level (was gold/food/plate at 60%). A missing good refuses before payment; the purchase is exact.
- Ten data-driven milestones (`renown.rewards`) land via `src/systems/endgame.js`: titles (hall inspector line), building-limit bumps fed into `buildingLimit`, muster room fed into the home recruit cap, and unlocks (grey banner cloak, keeper's ring, dawn regalia). Table is read live from `world.renown` — no new save fields; earned unlocks merge once per purchase so old saves heal on their next level.
- Guarded by construction: the reward table allows only cap/cosmetic keys, and a test pins that renown moves no production aura.
- Deliberate fixture update: the phase12 renown purchase test now stocks the full basket.
- Review: `npm test` 614 green, `npm run build` 359 precached, browser smoke green (Edge) with no console errors.

# Late-Game Economy — Phase 2: upper-tier curves + building limits

- `buildingCost` in `src/model.js` now reads data: `costCurve` names the multiplier per tier (index = tier − 1) and `tierCosts` adds flat per-tier extras in sawn lumber / forged plate. Tier 1 = base and tier 2 = double are pinned invariants; curve-less buildings keep the legacy formula byte-for-byte. Builder discounts trim curve prices and extras alike.
- 39 buildings tuned in `data/buildings.json`: steeper tier-3/tier-4 curves on defenses (Watchtower tier 4 now 16× base + 20 plate + 30 lumber), spirits of place, economy producers (tier 3 asks for lumber), and the Storehouse. Fixed a would-be `+null` bug that zeroed curve-less prices — caught by the legacy-fallback test.
- Building limits (`maxCount`): flat numbers or per-village-level arrays, enforced in `Game.build` beside the wonder/chain gates. Production, storage and workshop lines capped; walls/traps/housing stay uncapped. Build panel shows `built / cap`, tags FULL, and explains the reason; over-limit villages keep every building and can always repair ruins into slots.
- Deliberate baseline updates: tower tier-4 cost pins in `tests/act7.test.js`, resource fixtures in act5/act6/act7/phase12 that now need the whole multi-resource basket.
- Review: `npm test` 606 green, `npm run build` 359 precached, browser smoke green (Edge) with no console errors.

# Late-Game Economy — Phase 1: central storage caps

- Central storage lands: new `src/systems/storage.js` (pure math) sizes every resource from `data/world.json storageBase` plus `data/buildings.json storage` maps — Manor Hall and the new 3-tier **Storehouse** (village level 4) — scaled by tier `rateMultiplier`. On-site reserves keep their existing tier-scaled caps.
- Nothing vanishes when a store is full: taps, collector deliveries and refiner output bank what fits and hold the rest in place (reserve, carried load, un-refined input); reward overflow waits in `world.pendingRewards` and banks as room opens; trade deals and frontier responses refuse before paying when goods cannot fit. Over-cap saves keep every unit — inflow holds until the village spends below the cap.
- All inflow paths routed through the gate: harvest/collect-all, collector delivery, sawmill/gristmill refining, trade, quest/level/mission caches, raid salvage, gifts, expeditions and the tutorial bonus.
- Storehouse sprites (`storehouse-1..3.png`) added in the original placeholder pipeline; art lockstep stays green (distinct tier sprites, every reference on disk).
- UI: HUD totals gain a gold full state; Resources panel shows `stored / capacity`, room, held rewards and a full-stores note.
- Save v14: additive migration adds only the reward shelf; deliberate version pins updated in outer-frontier/raids/story tests.
- Presentation: posted keepers step indoors once they reach a finished shop (renderer-only read; orders, emergency and expeditions bring them out; collectors stay visible).
- Review: `npm test` 597 green, `npm run build` 359 precached, browser smoke green (Edge as Chromium) with no console errors.

# Stormglass Folklore — Phase E: lighting rework + design spec

- Stormglass light retune in `src/systems/daynight.js`: cooler moonblue night key (`#8fb0f0` × 0.17) over deeper blue ambient (`#42578a` × 0.42), warmer window emissive (0.75), deeper night vignette (0.55); rose-gold dawn, deeper ember dusk; cooler fog veil (`#8fa3bd`); night overlay alpha 0.22. Day is byte-identical to the legacy formula — all day digests verified unchanged.
- Baselines updated deliberately in the same commit: night/dawn painted digests in `tests/lighting-baseline.test.js`, fog-veil pins + night-ambient fallback in `tests/lighting.test.js`. Geometry, frozen formula, directionality, windows-outshine-walls and cache invariants hold.
- New `docs/STORMGLASS_SPEC.md`: mood/non-goals, palette tokens, 8-icon set, UI states, motion budget, lighting table, review matrix and verify commands. `docs/LIGHTING.md` sky table updated.
- Review: `npm run capture` dawn/day/dusk/night + rain/fog + phone-night checked — warm windows against deep blue night, readable silhouettes/HUD on both angles; browser smoke green (one headless-audio threshold flake passed on retry), no console errors. `npm test` 587 green, `npm run build` 355 precached.

# Stormglass Folklore — Phase D: input feel

- Tap threshold 7→10px so shaky fingers select instead of panning; real drags still pan. Wheel zoom is now delta-proportional (trackpad ticks ease, wheel notches land ~old steps), still anchored at the pointer; Firefox line-deltas handled.
- Feel-only: no picking, camera-math, gameplay or save changes; camera round-trips and wall/pinch tests stay green. Double-tap zoom deferred (would fight tap-select).
- Review: `npm run capture` desktop + phone night checked (layout intact); browser smoke green incl. touch pan/pinch, no console errors. `npm test` 587 green, `npm run build` 355 precached.

# Stormglass Folklore — Phase C: pooled motion + calm parity

- Motion pool capped at 60 transient effects (was 48) so raids stay flat on phones; `tests/renderer.test.js` cap updated deliberately in the same commit.
- Calm parity fixed: place-ring and slam shake are now calm-gated like all other shake sources. Also fixed mid-frame shake being wiped same-frame (`else this.shake=0` → residue-only clear), so slam/place shake actually renders the next frame in full-motion play and never in calm mode.
- No save fields or gameplay changes. Review: `npm run capture` desktop + phone night checked (hint/HUD clear, warm windows intact); browser smoke green, no console errors. `npm test` 585 green, `npm run build` 355 precached.

# Stormglass Folklore — Phase B: tokens + first-run hint

- Stormglass tokens land in `src/kingdom.css` (`--night:#1a2c4e`, `--brass:#f4cc73`, `--parchment:#eee4c9`, new `--lamp:#ffb95b`); theme-color matches. CSS-only, no gameplay or save changes.
- The existing guide system (`src/systems/tutorial.js`, separate localStorage key) is now visible: a Stormglass pill under the quest chip on desktop, below the sky toast on phones; it walks place → collect → recruit → raid → survive, retires for veterans, and joins bubble-avoidance obstacles.
- Review: `npm run capture` desktop + phone night checked — hint clear of troop rail/dock, warm windows intact; browser smoke green with no console errors. `npm test` 577 green, `npm run build` 354 precached.

# Stormglass Folklore — Phase A: distinct resource icons

- Lumber, flour and bread get original 64px SVG silhouettes (sawn planks, tied sack, bakery loaves); 8 resources now use 8 distinct sprites. No palette-swap reuse.
- Data-only: `RESOURCES.sprite` map in `src/resources.js`; no save fields or gameplay changes. Test expectation 5→8 in `tests/resources.test.js`.
- Review: `npm run capture` dawn/day/dusk/night + phone-night checked (warm windows at night, readable HUD); new icons verified distinct at gameplay zoom. `npm test` 575 green, `npm run build` 354 precached.

# UI — Moonlit kingdom

- Unified navy-and-gold HUD, menus, camera controls, inspector, settings and welcome screen.
- Original scalable dock icons, clearer card hierarchy and selected-menu states.
- Compact phone dock, responsive layouts and keyboard focus styling.
- Added in-menu navigation, settings toggles, research states, empty search feedback and responsive Friends forms.
- Prioritized building cards above village statistics on small screens.
- No gameplay, economy, progression or save changes.

## Detail/world/story expansion — Phase 15: Final ship verification (2026-09-29)

- Hardened the real-Chromium update smoke path after two unrelated feature PRs exposed the same service-worker timing race: a controller/update transition may hide the pause/settings sheet without reloading the game.
- Before the second update check and the final apply click, the harness now explicitly asserts that the title screen has **not** returned, reopens Settings only when its overlay is hidden, waits for the live update button to become visible/enabled, then continues the existing player-approved update flow.
- Added a browser performance sanity guard using the existing `window.midnightsManner.frameReport()`: telemetry must be live and both visible/static mesh counts must remain below a deliberately loose **30,000-face** runaway threshold. No CI millisecond threshold was added because shared runners are timing-noisy.
- Refreshed the README's stale campaign count/status text to match the current 15-chapter game. No gameplay, save, balance or production code changes.

## Detail/world/story expansion — Phase 14: Atmosphere and travel juice (2026-09-29)

- Added a renderer-only atmosphere layer between terrain and the 3D village mesh: small building/camp smoke, short travel footprints behind moving villagers/raiders, and capped rain splashes.
- Ambient smoke is limited to finished living Hall/Cottage chimneys plus currently visible frontier camps, with at most **8** active sources. Active forge/smeltery/butchery smoke remains owned by the earlier state-driven workplace layer, avoiding doubled effects. Rain softens ambient smoke opacity rather than creating extra particles.
- Travel marks are derived from existing movement intent only: manual move/attack orders, expedition out/back legs, and enemy target movement. At most **12** actors receive three tiny ground marks each.
- Rain uses at most **14** deterministic ground splashes. The whole layer drops out below 0.9× zoom and is completely disabled under Calm/reduced-motion.
- Atmosphere draws before `drawVillage3D()`, so footprints/splashes/smoke sit under characters and architecture rather than covering UI or roofs. It writes no effects/save fields and never mutates simulation state.
- Added five `tests/atmosphere-art.test.js` regressions for hard caps, smoke/camp eligibility, entity-kind-safe trail targets, Calm/LOD/rain behavior, and world immutability. Test target: 565 → 570.

## Detail/world/story expansion — Phase 13: Enemy role silhouettes (2026-09-29)

- Reworked enemy equipment selection so siege roles no longer fall back to the generic sword silhouette. Archers keep bows, breakers keep heavy hammers, scouts use a lighter blade, while ram/bombard roles use purpose-built renderer geometry.
- Rams now carry a broad timber frame with iron cap and harness straps; bombards carry a compact metal field tube on a timber frame. Both read distinctly at village-map scale without changing collision, movement or combat stats.
- Elite enemies gain unique pale-gold shoulder/crest trim while retaining their faction coat color.
- Bosses now read as named characters: Gorm the Cinder-Maul gains dark-red heavy armor and crest work; the Pale Queen gains a pale cloak/hood, longbow and crown detail.
- Added five `tests/enemy-silhouettes.test.js` regressions for role gear mapping, ram/bombard profiles, elite recognition trim and boss differentiation. Test target: 560 → 565.

## Detail/world/story expansion — Phase 12: Living faction camps (2026-09-29)

- Added five data-driven persistent-home faction camps under `data/world.json.frontierCamps`: Thornband in Whisperwood, Pale Host at Starwatch Ridge, Cinder Clan and Ember Legion in Ashfall March, and a Pale Court pavilion on the Pale Coast.
- Camps appear only after their configured minimum raid wave and only while their named region is still unclaimed. Claiming the region removes the camp automatically; campaign expedition maps never inherit home-frontier camp presence.
- Added low-poly tent, banner, supply and cookfire geometry using each faction's existing color. Camp groups share the existing environment scenery LOD/budget and are depth-sorted with the village rather than drawn as a separate overlay.
- Camp faces carry a generic `faction-camp` hit owner. Tapping one recenters the camera and reads both the local camp text and the faction's existing lore through the normal status surface.
- The static mesh cache now includes `world.wave` so camps that become relevant at later threat levels refresh once on wave change, not every frame.
- Added five `tests/frontier-camps.test.js` regressions for data integrity, progressive wave visibility, claimed-region removal, mission isolation, tappable ownership and bounded scenery. Test target: 555 → 560.

## Detail/world/story expansion — Phase 11: Sparse frontier events (2026-09-28)

- Added seven claimed-region encounter definitions under `data/world.json.frontierEvents`: Southreach, Starwatch Ridge, Whisperwood, Blackwater Mouth, Ashfall March, Dawnfields and Pale Coast each receive a two-choice event using only existing wood/food/gold resources.
- Added a generic deterministic scheduler/resolver in `src/systems/frontier-events.js`. Old saves lazily receive their first event clock; normal delays are 300–479 seconds, with a short retry only when no eligible claimed region exists. The picker avoids immediately repeating the last event when alternatives exist.
- Events only open at the home village, while no raid is active/pending, and not within 60 seconds of scheduled horns. Active events persist until answered; campaign expeditions do not advance or reroll them.
- Adventure → Home renders the active event with its two choices. Resource choices are atomic and reject cleanly when unaffordable; free decline choices always remain available. Resolution clears the card, applies existing-resource rewards, saves, and schedules the next event.
- Added six `tests/frontier-events.test.js` regressions for data shape, claimed-region/level eligibility, deterministic sparse clocks, calm-time triggering, atomic spend/reward/reschedule, and unaffordable/free-choice behavior. Optional world fields require no save-version bump. Test target: 549 → 555.

## Detail/world/story expansion — Phase 10: Environmental story hotspots (2026-09-28)

- Added original lore entries for all ten named persistent-home landmarks: Stillwater, Timber Line, Moonwell, Starwatch Ridge, Whisperwood, Ashfall March, Blackwater Mouth, Southreach Crossing, Dawnfields and Pale Coast. Content lives under `data/world.json.hotspots` and adds no saved state.
- Home landmark geometry now carries a generic `{kind:'site'}` hit owner when a hotspot exists at that coordinate. Tapping the marker recenters the camera and reads the site's lore through the existing game-status/toast surface.
- Hotspot identity is restricted to the persistent full-size home tile sheet. Mission-local landmarks remain ordinary scenery even if their local coordinate happens to equal a home hotspot coordinate (for example Dawnfields at mission 15,12 vs Timber Line at home 15,12).
- Ordinary scenery remains noninteractive, and hotspot lookup is read-only. No rewards, resources, claims, progression, save keys or migration were added in this first environmental-story pass.
- Added four `tests/story-hotspots.test.js` regressions for data/landmark integrity, selectable site mesh ownership, expedition isolation, and read-only lookup. Test target: 545 → 549.

## Detail/world/story expansion — Phase 9: Destination expedition themes (2026-09-28)

- Campaign mission worlds now build their own visual tile sheet instead of inheriting the persistent home's landmark list. Expedition grids remain the intended **20×17 homestead scale**, avoiding a hidden 52×44 visual tile load after the home frontier expansion.
- Mission map data can generically declare `map.biome`, `map.seed`, and `map.tiles`. Unmarked mission tiles use the declared base biome; marked tiles remain deterministic landmarks.
- The three frontier-linked finales now look like the places the player claimed: **The Pale Court** is Southreach plains with Southreach Crossing, **The Longest Night** is Starwatch hills with Starwatch Ridge, and **Dawn** is Dawnfields plains with the Dawnfields landmark.
- Environment scenery now prefers the live world's `biomeSeed`, so two mission maps with the same biome can still place rocks/grass/stumps differently. Home worlds retain the world-data seed and complete 52×44 landmark sheet.
- Added four `tests/mission-map-themes.test.js` regressions for mission grid size/home-landmark isolation, destination biome/landmark/seed identity, home-frontier preservation, and per-world scenery variation. No gameplay or save-format changes. Test target: 541 → 545.

## Detail/world/story expansion — Phase 8: Mission objective variety (2026-09-28)

- Replaced the gather-only mission completion check with a generic objective evaluator. Existing `{resource, amount}` data remains a backward-compatible gather objective; new mission data can declare `protect`, `survive`, `defeat`, or `build`.
- Every objective reports a shared `have / need / complete / label / progressText` shape. Campaign logic, the live battle HUD, and Campaign cards now read the same evaluator instead of each assuming a resource counter.
- Added meaningful late-game variety: **The Pale Court** must keep its tower standing, **The Longest Night** must keep the Oathstone standing, and **Dawn** must keep its Oathstone standing and hold until 360 seconds before victory can resolve.
- Protect/build objectives count only living finished structures; survive progress caps at its target; defeat reads the existing cumulative raid-kill ledger. No new save fields, timers, or per-mission simulation branches were added.
- Added five `tests/mission-objectives.test.js` regressions covering legacy gather compatibility, protect/build state, survive/defeat progress, Oathstone-gated Longest Night victory, and Dawn's timed hold. Test target: 536 → 541.

## Detail/world/story expansion — Phase 7: Frontier story destinations (2026-09-28)

- Anchored three late Act VIII chapters to persistent home-frontier locations: **The Pale Court → Southreach Crossing**, **The Longest Night → Starwatch Ridge**, and **Dawn → Dawnfields**. Destination metadata lives on the mission data; campaign code contains no content-specific region ids.
- A destination chapter remains locked until its normal chapter prerequisites are satisfied **and** the home region is fully claimed. The same generic gate is enforced by direct mission starts and Adventure campaign cards. Chapters completed before destination gates existed remain replayable.
- Adventure now exposes destination state on campaign cards. When story prerequisites are met but the region is still wild, Home promotes that claim as the next action and the Campaign card offers a live **Claim destination** button instead of a dead disabled button.
- Story claim buttons enter the existing Expand mode, center the camera on the region landmark, enable the grid, and let the normal adjacency/cost system handle the actual claim. No new save fields or migration are required.
- Extended Act VIII and Adventure regression coverage for region gating, replay compatibility, destination metadata, and story-next-action flow. Test target: 535 → 536.

## Detail/world/story expansion — Phase 6: Outer Frontier (2026-09-28)

- Expanded the home data grid from 40×34 to **52×44** while preserving every original coordinate. Seven claimable regions extend east and south: Starwatch Ridge, Whisperwood, Ashfall March, Blackwater Mouth, Southreach, Dawnfields and Pale Coast, each with a new unclaimed landmark.
- Added save **v13** migration. Existing v12 tile-grid saves are projected onto the larger deterministic grid by coordinate; every old tile record is preserved and only newly appended coordinates are forced unclaimed. Tile-less vintage saves intentionally remain tile-less during storage migration so the existing Game bounds-reconstruction path keeps their old homestead claimed.
- Region rectangles now form an exact 4×4 partition of the 52×44 world (16 regions total). East and south outer regions unlock by adjacency from the existing frontier, so late expansion continues instead of gifting remote land.
- Added six `tests/outer-frontier.test.js` regressions plus dimension-agnostic wording in the vintage migration test. Coverage pins exact region tiling, wild landmarks, east/south claim chains, unchanged building coordinates, v12 grid preservation, and tile-less vintage handling. Test target: 529 → 535.

## Detail/world/story expansion — Phase 5: Biome scenery (2026-09-28)

- Added data-driven scenery profiles under `data/biomes.json`: plains, forest, water, hills and unclaimed fringe now choose sparse deterministic 3D props (grass, stones/rocks, shrubs, stumps/logs, pines, reeds and cairns) from their own density/prop tables.
- Wild tiles deliberately render denser than claimed territory; named landmark tiles always get a raised marker. Decorative scenery is suppressed under building footprints and never participates in collision, pathfinding, yields or resource simulation.
- Scenery depth-sorts with the village mesh, culls offscreen, drops ordinary clutter at far zoom and hard-caps visible prop groups (50/85/130 by LOD). The existing terrain claim count is exposed to the mesh cache so claiming a region refreshes scenery without a saved revision field.
- Added `tests/environment-art.test.js` with five regressions for determinism/landmarks, claimed-vs-wild density, footprint suppression/purity, bounded paintable geometry and claim-cache invalidation. Test target: 524 → 529.

## Detail/world/story expansion — Phase 4: Source lighting identity (2026-09-28)

- Tagged luminous scene geometry with explicit renderer profiles: window, lantern, torch, open fire, and fire trap. Each profile has its own projected reach, falloff, spill shape and warm palette instead of sharing one generic amber pool.
- Windows stay narrow and facade-directed; lanterns stay compact and steady; torches use a wider directional orange spill; forge/watch fires spread farther and hotter; armed fire traps pulse in a smaller footprint. The inexpensive local facade wash remains cached with the static mesh.
- Dynamic flicker is deterministic per source/time, restrained, and affects only ground spill. Calm/reduced-motion pins every source at steady intensity. No simulation state, saves, light-source count, or gameplay rules changed.
- Added three source-lighting regressions for profile assignment, deterministic/Calm flicker, fallback behavior and profile-specific falloff. Test target: 521 → 524.

## Detail/world/story expansion — Phase 3: Working villagers (2026-09-28)

- Held tools now move when the villager is actually working: posted noncombat trades animate at their workplace, assigned collectors animate during the gather phase once they are carrying output, and builders hammer during repair emergencies. Existing combat animation still takes priority.
- Carried loads now identify the resource at a glance: warm timber or pale frostwood bundles, moonstone ore crates, grain sacks, and fish creels. Unknown resource types keep the old generic pack fallback.
- Work motion is renderer-derived only, adds no save fields, stops for explicit orders/expeditions and inappropriate emergencies, and freezes under Calm/reduced-motion.
- Added `tests/working-villagers.test.js` with four regressions for work-state gating, Calm/combat priority, resource cargo identity, and fisher creels. Test target: 517 → 521.

## Detail/world/story expansion — Phase 2: Active workplaces (2026-09-28)

- Added lightweight renderer-only activity cues that come from actual building state: forge/smeltery/workshop sparks and smoke, lumber/sawmill saw strokes, mine/emberglass rail glints, pond/deephole ripples, a turning gristmill wheel, field/grove work sweeps, plus small work glints/dust for armory, fletcher, shieldwall, tannery, school/scriptorium, scout and masonry posts.
- Passive producers animate only while their on-site reserve still has room. Staffed workshops animate only while a living posted worker is available (not ordered away, on expedition, or serving an emergency). Fletcher-style autonomous stocking is recognized by the shared state resolver.
- Activity is drawn outside the static mesh cache, builds one available-crew index per frame (rather than rescanning villagers per building), disappears below 1.05× zoom, and freezes/removes motion under Calm/reduced-motion. No production rates, worker rules, save fields, or gameplay state changed.
- Added `tests/building-activity.test.js` with four state regressions. Test target: 513 → 517.

## Detail/world/story expansion — Phase 1: Workplace detail (2026-09-28)

- Added a renderer-only second detail layer to make under-detailed workplaces readable from the village view: barracks training racks/dummies, forge coal and quench stations, armory/fletcher supplies, farm sacks/barrels, pasture troughs, lumber sawbucks, mine rails/carts, tannery vats, study chests, butchery tables, masonry tools and market cargo.
- Detail is tier-aware where useful (extra crates, barrels, supplies) and uses zoom LOD: the layer drops out below 1.2×. It is suppressed on placement ghosts, unfinished buildings and ruins. No economy, combat, save fields or progression rules changed.
- Added `tests/building-detail-pass.test.js` with four regression checks for workplace identity props, tier growth, distant-zoom LOD, and construction/ruin gating. Test target: 509 → 513.

## Presentation pass — Phase 12: Sound + music (2026-09-28)

- Added an original generative 6/8 D-Dorian score: warm sine bass, soft triangle harmony, chord-tone plucks that vary each phrase, and a restrained single echo. Notes are synthesized live from `data/music.json`; no recordings or audio assets.
- The score starts on the **Enter village** gesture and shares the existing Sound control with SFX. Calm keeps the harmonic bed and reduces the melody to one pluck per bar. Muting fades the shared output and stops scheduled music voices. No save fields or gameplay changes.
- Tests: `tests/music.test.js` covers Node-safe startup, tonal/repeatable phrase generation, bounded melodic leaps across loops and mute/resume, sparse Calm arrangements, voice cleanup/retry, and shared output muting. `scripts/browser-smoke.mjs` checks start/mute/resume and measures a non-silent, unclipped WebAudio signal. `npm test` count: 500 → 509.

## Presentation pass — Phase 9: Rarity and profession (2026-09-28)

- Crafted gear and armor now render with the same rarity colors used by inventory labels. Every profession gets a narrow world-mesh accent from its unique `troops.json` color; item rarity comes from `items.json`. No new data fields, save keys, or gameplay effects.
- Review: `node scripts/equipment-preview.mjs` shows 31 held-tool archetypes, all crafted rarity tiers, and all 35 profession defaults from front/reverse at gameplay zoom (`artifacts/equipment-{front,reverse}.png`).
- Tests: `tests/character-art.test.js` checks all profession colors without extra geometry, rarity tiers, and invalid rarity fallbacks; `tests/phase8-chains-crafting.test.js` covers inherited rarity keys. `tests/lighting-baseline.test.js` pins the updated lineup. `npm test` count: 496 → 500.

## Presentation pass — Phase 8: Tools that tell the tale (2026-09-28)

- Held equipment now keeps its own gameplay-scale silhouette instead of falling through broad shape groups: bow/longbow (with visible strings below the detail threshold), carpenter/forge/war hammers, battle/felling axes, cleaver, pike/halberd, fishing and herding tools, carrying gear, craft kits, and calling instruments. Material-tier variants retain their archetype shape.
- Profession coats and headwear remain individually readable at 1.65× game zoom across all 35 troop definitions. Forager and Archer, Warden and Warrior, and Haggler and Builder now have separate silhouettes; Longbowman and Smelter coats have clearer color contrast. No combat stats, item data, or save fields changed.
- Review: `node scripts/equipment-preview.mjs` renders the 31 held-tool archetypes plus profession defaults at gameplay zoom from front/reverse camera angles (`artifacts/equipment-{front,reverse}.png`); reviewed: silhouettes remain distinct with detail-only trim disabled, and the profession palette reads across the row.
- Tests: `tests/character-art.test.js` adds gameplay-scale archetype, bow-string, outfit, same-shape color-contrast, close-uniform, Sawyer goggle-face, and no-extra-pyramid-tessellation checks; `tests/lighting-baseline.test.js` pins the mixed-profession equipment geometry, frozen formula, and day/night/dawn looks. `npm test` count: 489 → 496.

## Presentation pass — Phase 7: Hold the line (2026-09-28)

- Wall silhouettes now cap only exposed run ends, with caps meeting the wall body so connected straights, corners and junctions read as one defense line. Gates align with their connected wall axis; connector arms stop at the frame, leaving the raised passage clear. The portcullis raises/lowers across four cached stages as raiders approach, and `prefers-reduced-motion` snaps and synchronizes its state.
- Spike and fire traps show their existing cooldown as a sprung, retracted state, then rearm at zero. The mesh cache keys only the armed/sprung edge, not every cooldown tick.
- All state is derived in the renderer from existing enemies and building cooldowns. No simulation rules, save fields or save version changed. Geometry and day/night digests in `tests/lighting-baseline.test.js` were deliberately updated and now pin wall ends, gates, and both trap meshes.
- Review: `node scripts/defenses-preview.mjs` writes `artifacts/defenses-preview.png` (optional external `@napi-rs/canvas`); reviewed at game scale: straight ends, turns and junctions remain distinct, gate travel is visible, and raised/retracted trap teeth separate both cooldown states.
- Tests: `tests/defense-viz.test.js` adds 8 checks for wall topology/contact, connected gate clearance/travel/reduced motion, trap state, cache boundaries, and save-state purity. `npm test` count: 474 → 482.

## Presentation pass — Phase 6: The haul on the hill (2026-09-28)

- Producers show their on-site haul on the building itself: a stockpile of the matching resource (timber for wood/lumber/frostwood, grain sacks for food, ore for gold, plate bars for plate) grows in four steps as the tap reserve fills toward `harvest.capacity`, and a gold pennant flies once the haul crosses `reserveNotifyAt`. The 2D bubble and badge remain the tap affordance; the mesh is the at-a-glance state.
- The static mesh cache key now quantizes the reserve (four steps plus the ready flag): the village repaints when a step or the badge flips, never per reserve unit. Ticking reserves never touch the 60fps budget, and the terrain cache is untouched.
- Review: `node scripts/production-preview.mjs` renders five producers × three reserve levels from the actual meshes (`artifacts/production-preview.png`) — reviewed: piles read per resource and the pennant appears at the ready threshold.
- Tests: new `tests/production-viz.test.js` (3 checks — four-step growth and state gating, pennant at notifyAt, cache step quantization). `npm test` 471 → 474. No save fields, no save-version change.

## Presentation pass — Phase 5: Housing silhouettes (2026-09-28)

- Cottages read by shape, tier over tier: tier 2 grows a lit loft window in the front gable with a rail beneath it; tier 3 adds a porch (deck, posts, awning) over the door and raises the kitchen stack clear of the ridge line (the old stack barely cleared it at tier 3). Tier 1 stays the plain timber hut.
- The longhouse is now a meadhall, not a big cottage: long-axis ridge beam, twin capped stacks at both ridge ends, a banner over the door and a veranda rail with awning across the front gable. `hut()` gained an optional `chimney` flag so the hall's roof stays stack-free (the two ridge stacks are the hall's own).
- Review: `node scripts/housing-preview.mjs` renders all four homes from the actual orbit meshes at real day/night sky light (optional @napi-rs/canvas, installed `--no-save`; sheets at `artifacts/housing-{day,night}.png`). Reviewed: tier growth reads at a glance and the hall dominates the row.
- Harness fix found while reviewing: Windows Chromium leaves crashpad/utility children behind `kill()`; those inherit stdio and could hang a piping shell after node exited. Both `look-capture.mjs` and `browser-smoke.mjs` now kill the whole browser process tree (`taskkill /T` on Windows), so runs always return promptly.
- Tests: new `tests/building-silhouette.test.js` (2 checks — tier counts strictly grow; the hall out-silhouettes the top cottage and flies marker materials). cottage-3 baseline digests updated deliberately (207 → 249 faces). `npm test` 450 → 471 after the multiplayer merge (452 from this phase alone); README verification refreshed. No save fields, no save-version change.

## Presentation pass — Phase 4: AO, shadows and the frame (2026-09-28)

- Per-face ground-contact AO: faces shade darker the closer they sit to the dirt (`0.8 + 0.2 × clamp(height / 0.7)`), baked at construction so it never touches the paint cache; tall faces split 3×3 and grade from foot to crown. Roofs and anything above 0.7 tiles stay at full light.
- Contact shadows: every building footprint throws a flat ink polygon and every standing unit a small ellipse, offset away from the key light — so shadows swing with the Phase 3 sun/moon arcs and fade after dark. One polygon per body, no blur, never in the terrain cache.
- The vignette is phase-driven now (day 0.34 → night 0.52, data-tunable per phase, clamped ≤ 0.7) and the moon glow follows the key arc's east–west sweep instead of a fixed corner.
- The renderer resolves the sky once per frame and feeds shadows, vignette, overlay, glows and mesh shading from that single object (`drawVillage3D` takes it as an argument).
- Frozen-light formula equality still passes with a flat-AO contract; day/night/dawn painted digests updated deliberately for AO. New checks: vignette ladder/clamp, ground-vs-roof AO. `npm test` 449 → 450; captures reviewed (day shadows, deeper night frame). No save fields, no save-version change.

## Presentation pass — Phase 3: Dynamic lights, moon and weather (2026-09-28)

- The key light sweeps: `key.arc` samples sun/moon direction across each phase (east to west by day, back again over the night; dawn/dusk carry low sunrise/sunset light). The day arc's midpoint is the Phase 2 legacy direction; an explicit `key.dir` in data beats the base arc, and `calm` pins the arc at its midpoint.
- Weather now lands on the meshes: `WEATHERS[].mesh` adds a depth-weighted fog veil (far faces mix toward `fogColor`) and a flat rain `dim`; `weatherLightAt()` resolves and clamps it, and the light bucket id folds in the weather so a sky change repaints while a clock tick reuses. Overridable at `world.daynight.weather.<id>.mesh`.
- Fire sources (watchfire/forge/smeltery) draw a larger flickering halo — deterministic per building id, frozen under `calm`; other buildings keep the soft window halo.
- `shade()` gains `dim` and fog mixing (`depth01`; the depth scan runs only when a veil is active). Frozen-light formula equality and raw geometry digests still pass; day/night/dawn painted digests updated deliberately for the sweeping sky.
- `npm run capture` now writes seven deterministic views (adds day-rain and night-fog; both reviewed). `npm test` 446 → 449 (arcs, weather merge/clamps, fog/dim shade contract). Spec updated: `docs/LIGHTING.md`. No save fields, no save-version change.

## Presentation pass — Phase 2: Midnight lighting core (2026-09-28)

- Mesh shading now follows the sky clock. `skyLightAt()` (`src/systems/daynight.js`) resolves key light, ambient, sky fill and an emissive boost per phase from the new `SKIES` table, crossfading out of the previous phase over `lightBlend` (default 4% of a day); `calm` players get a plain step. Overrides live at `world.daynight.lighting.<phase>` and clamp exactly like the overlay always did.
- `scene3d.js` stores raw albedo and normals; `shade()` is exported and applied in `paint()`, once per face per light bucket (192/day, cached on the face). Windows, forge/smeltery flames and watchfires are emissive so the village reads at midnight. No point lights yet (Phase 3); terrain tinting and AO are Phase 4.
- Day is byte-identical to the old baked look: `tests/lighting-baseline.test.js` (5 checks) compares paint-time day output against a frozen copy of the legacy formula for all eight canonical meshes, pins raw geometry digests plus night/dawn painted digests, and keeps the static-cache invariant. New `tests/lighting.test.js` (4 checks) covers resolution, purity/buckets, crossfade/calm and overrides/clamps. Spec: `docs/LIGHTING.md`.
- The renderer's sky overlay reads the same resolved object (`skyLightAt().overlay`), so screen tint and mesh light come from one clock read per frame; the static mesh cache still ignores the clock.
- Reviewed captures: day matches the pre-Phase-2 baseline, dusk warms, midnight keeps lit windows. `npm test` 440 → 446; README gains an "Add a lighting phase" data guide. No save fields, no save-version change.

## Presentation pass — Phase 1: Baseline harness (2026-09-28)

- Local Windows verification is real: `npm test` 440/440 (rebase-merged with the Phase 12 endgame suite), `npm run build` green, `npm run test:browser` green on Chromium Edge. Fixed `scripts/browser-smoke.mjs`'s static-server path guard (`resolve('dist')` plus a hardcoded `/` never matches Windows backslash paths, so every file 404'd off-CI). No game behavior change.
- Deterministic look harness: `npm run capture` (`scripts/look-capture.mjs`) pins camera, calm motion and a clear-sky clock, then writes `artifacts/look-desktop-{dawn,day,dusk,night}.png` and `artifacts/look-phone-night.png`; run after `npm run build`.
- Test-only drivers added to `window.midnightsManner`: `setElapsed(seconds)` and `setCamera({yaw,pitch,zoom,x,y})` — transient view/clock state only, never saves, rules or placement.
- `frameReport()` now reports painted and cached face counts; the `?perf` badge shows them.
- `tests/lighting-baseline.test.js` (3 checks) characterizes fixed-light mesh shading (digests for 8 canonical meshes plus a four-yaw hall) and pins the invariant that the sky clock never rebuilds the static mesh cache. Phase 2 updates the digests deliberately in one reviewed commit, with a note.
- `npm test` total 412 → 440 (3 characterization checks here, 25 from the Phase 12 endgame merge); README verification refreshed. No save fields, no save-version change.

## Unreleased — Notice board (Phase 9)

- Patch notes live inside the game: a notice board fed by data/updates.json opens a "What's new" modal the first time a village sees a new version.
- Entries link straight into the relevant panels (workshop, people, jobs, stores). Dismissible in one tap, Escape closes it, and it never pauses the village.
- Save-compat is additive only: `seenUpdatesVersion` rides in the save blob when present; old saves see the board once, fresh villages stay quiet.

## 0.3.0 — A village from every angle

- Original low-poly buildings, connected walls, trees, villagers, raiders, and placement previews replace fixed-angle map sprites.
- Full 360° orbit, adjustable tilt, touch twist, desktop orbit controls, and three view presets.
- Ground placement, selection, and defense ranges follow the camera angle; saved villages remain compatible.
- Resource sounds play when collecting or when storage first fills, with simultaneous fills combined into one chime.

## 0.1.3 — Resource clarity and mobile finish

- Original wood, food, gold, frostwood and plate icons replace tool placeholders in the resource HUD; labels remain visible on phones.
- Collection bubbles and floating income name their resource. Touch targets stay a readable size and avoid overlap where space allows.
- Resource totals open a stores panel with per-building bonus collection.
- Build and People menus gain search; Adventure separates expeditions, quests, trading and lore.
- Polished HUD, cards, equipment rows, workplace controls, building inspector, settings, raid feedback, and portrait/landscape spacing.
- Includes the pending safe Home Screen update controls and the building-inspector merge fix.

## 0.1.2 — Home Screen updates

- Fixed a current-main merge regression that referenced wall-row controls before initialization and broke building selection; retained the Cairnfield memorial panel.
- Settings now includes Check for updates and Save & refresh, with a map notice when a build is ready.
- Refresh persists the village first and cancels on storage failure; updates wait for a player click.
- Built games check on resume and every five visible minutes, with offline/download failure feedback.
- Content-based, scope-specific service-worker caches detect code/data/art changes without manual version bumps and keep complete builds together.

## 0.1.1 — All-side raids and wall controls

- Home, test and campaign raids enter from rotating perimeter sides; four-or-more raiders cover all four sides. Countdown warnings list the sides.
- Dragging in wall build mode previews a connected straight row with a combined cost; confirmation builds the whole line or nothing.
- Build/Move previews slide with one finger; two fingers pan and zoom. Release never commits a build or move. Relocation previews preserve the current tier.
- Connected timber/stone wall rows can upgrade along either grid axis with a combined price and all-or-nothing affordability check. Gaps stop a row; unavailable segments are skipped.
- Unreachable defenders no longer keep raiders idle beside a wall; adjacent barriers can be breached.

# Midnights Manner — Extended Pass Changelog

## 20-phase: Act VIII Legends (2026-09-26)

Applies NEXT20_DESIGN.md Phases 16-20, the finale. Verify: `npm test` (see box output below), `npm run build` green - both on the free EC2 box per Jesce's standing rule (never on this PC). Save version 5 -> 6 (`migrateV5toV6` backfills prestigeStars 0, oath false, fallen [] on world+home; gear, resources, buildings, troops and progress untouched). NOTE: the contracting brief believed only Act VII phase 11 had landed; the working tree at 064239b already held phases 11-15 in full, so this act is phases 16-20 only.

- Ph16 Pale Court: Mission 12 `the-pale-court` (chapter 12, limit 8, 2 raids; `requiresAny: [red-banner, grey-banner]` - REUSES the Phase-10 generic OR-gate, no second mechanism) clearing unlocks the other banner mission path + Moon Dial + Envoy's Gift + grey Banner Cloak. Moon Dial (size 1, gold 150 + frostwood 80, `moonDial` + `maxPerVillage: 1` generic one-per-village flags; locks the raising day's calendar season at half strength via data/calendar.json effects, known aura keys only). Envoy's Gift (armor-slot, all keepers, armor 0.15 + armor-hand `xp` 0.03 pour read generically in auras). Pale Envoy giver with log quoting the new 6th legend (`pale-court` - first legends.json progression use, additive).
- Ph17 Prestige of the Bell: `Game.prestige()` (L25 troop -> L1, gear+kit kept, +1 star +5% all stats via `stats()`, max 3, oath cleared) + Bell Tower (size 2, wood 200 / gold 200 / plate 10, `minLevel: 9` - NEW village level 9 at 2100 XP with food/gold/plate payout; `prestigeAura` doubles starred veterans' aura share) + Starforged reforge line (`Game.reforge()`: oathblade/halberd/longbow -> starforged- prefix, +15% main stat, plate 5 + gold 500 - first vertical gear progression, generic prefix read off `data.items`, no per-weapon code). Quest 20 `the-bell-remembers` (new `prestige` task kind: one starred veteran; +160 XP -> 2290; Old Bell's farewell log). **[ADAPTED]** Dawnbringer costs gold 800 + plate 10 instead of consuming a starforged piece (no consume-reforge mechanic; the reforge line feeds it thematically through the plate sink).
- Ph18 Sunken Chapel: Tidecaller keeper (K1 scholarly kit attune/armor/mend/veteran-x/sage on handled effects only; `tide` job rate 0.5 pours food at its chapel or any `hosts` water - deephole + pond both declare `hosts: [tidecaller]`, Phase-13 shared-workplace pattern) + Sunken Chapel (size 2, wood 160 / gold 140 / plate 8, `requiresBuildings: [chapel-3, deephole-2]` - new generic AND-gate in `build()` + shop read-through, contrasting the mission OR-gate; dual-aura heal + `foodAura` 0.5 via existing keys, tier 2 doubles) + Tidebell (healAura 0.5 + foodAura 0.3) + Diver's Plate (armor 0.2, water-line plate sink). Quest 21 `what-the-water-kept` (deephole->2, +150 XP -> 2440; Wren's farewell). NEW level 10 at 2400 XP with food/gold/frostwood payout.
- Ph19 Warden-General: `Game.takeOath()` (L20+ warden-line troop via data `oathbound` flag: +50% damage in `stats()`, +0.25 armor in combat under the 0.8 ceiling) + opt-in permadeath carved in post-raid revive (oathbound fallen stay fallen, names go on `world.fallen`; the unsworn still rise) + Cairnfield (`cairn` flag monument, wood 60, lists the fallen on the map + inspector roll) + Oathkeeper Armor (`requiresOath` roster gate in `equip()`: best-in-slot armor 0.25 + damage 1.1, plate 12 + gold 800) + Squire's Blade + Squire (C1 kit brace/armor/rally/veteran/phalanx, recruit 30/15). Mission 13 `the-longest-night` (chapter 13, limit 9, 3 waves with scaling, requires pale-court AND one banner road; unlocks squire + blade + cairnfield + oathkeeper + dawn-gate build right). Sorrel payoff log. **[ADAPTED]** Dawn-gate *build right* arrives at M13 victory while Quest 22 still demands the *standing wonder* (earn the right, then pay the cost) - the quest gate stays arrival-impossible.
- Ph20 Dawn finale: Dawn Gate (size 3, one-of-everything cost, `dawnAura` 0.05 every key under existing caps, `maxPerVillage`) + Moonwarden's Regalia (`requiresName: Moonwarden` unit gate in `equip()`, all-keeper roles, armor 0.2 + `allAura` 0.02 read off both hands) + Dawnbringer (all-combat roles, damage 1.5). Quest 22 `dawn-of-the-manner` (new `wonder` task kind: dawn-gate built AND standing; +200 XP -> grand total 2640; giver roll-call of all 11 predecessors in text+log) + Mission 14 `dawn` (chapter 14, limit 10, 4-wave final siege, `crowning: Moonwarden` names the eldest unnamed roster hand on first victory - dual finale, either order). NEW level 11 at 2600 XP with credits + named NG+/prestige-village option payout.
- Test-fix judgment (mine): the box's 17 failures split 2 code-side, 15 test-side. Code earned: `deephole`/`primer` literals scrubbed from src comments (the act6/act7 no-hardcode guards scan comments too - data flags, never ids, even in prose). Tests owned: pre-war quest-total filters now exclude act VIII alongside VII (1690 pinned); story counts 19->22 / 12->15 / legends 5->6 + VIII index pins; troop 31->33 / mission 12->15 counts; migration asserts to v6; village quest-kind allowlist +`prestige`/`wonder`. New `tests/act8.test.js` (20 checks: OR-gate, dial lock-in + one-per-village, armor-ink pour, prestige flow/cap/tower-gate, reforge math, dual gate, hosted pour, oath gating + cairn roll, roster/unit gates, gate engine + caps, crowning, viii totals + guard + old-save quiet).
- Deferred with reasons: hard 11a/11b first-clear mutex (unchanged from Act VII - soft cross-grant + OR-gate pacing stands, nothing strands); armor paper-doll (pre-existing); trader-offer timer + market tier-2 (pre-existing, system-level); NG+/prestige-village loop itself (named as the level-11 payout, out of scope by design); Dawnbringer range is absolute 5.5 (spec sketched +0.5 - data-flat best-in-slot kept simple).
- Pitfalls per phase: P1 new SKUs only, all resolve + start locked (act8 suite pins every grant); P2 L9/L10/L11 ship payouts (tower access / chapel stores / credits + NG+ road); P3 prestige/wonder/flawless-adjacent gates read zero at arrival; P4 role kits only (K1/C1 reuse), no content ids in src (pinned, comments included); P5 Envoy/Old Bell/Wren/Sorrel/Issa logs persist, legends quoted, cairn roll on the map; P6 OR-gate merge + dual finale close the diamond.

## 20-phase: Act VII Oath (2026-09-26)

Applies NEXT20_DESIGN.md Phases 11-15. Verify: `npm test` 207/207, `npm run build` green (212 precached) - both on the free EC2 box per Jesce's standing rule (never on this PC). No save-version bump (still v5 - flawless/promoted/wear/stock/inRaid all tolerate missing keys, all changes additive or data-only). Merged over upstream's workplace-architecture-preview (one ui.js conflict, resolved by keeping both: worker-count assign button + yard service button).

- Ph11 War Band: Oathsworn (260/18, second C-kit: bulwark/armor-ii/oath/taunt-active/veteran/unbroken, recruit 60/45 - heaviest yet) + Oathstone (proximity armor aura 0.1/radius 3 via new generic `proximityArmor()`, NOT a workplace) + Oathblade (1.3/1.1) + Tower Shield (armor 0.2, speed stored 0.9 - the Act VI oilskin x1.1 precedent). Taunt pulls enemies generically in targeting; unbroken survives one killing blow per raid (flag resets on raid-end). Mission 10 `the-pale-host` (requires coin-and-cinder, `scaling: {hp 18, damage 3}` - new generic per-mission wave-steepening in `spawnRaid()`, home curve untouched; limit 8; Sorrel in all three ceremony lines; unlocks oathsworn+oathblade+tower-shield+oathstone).
- Ph12 Siege Engine: Fire Trap (60 damage + burn 4/3s via generic tier `burn`/`burnDuration`, first DoT) + Tower-4 (65/5.2, `tierGates {4: 8}`, tier-4 costs 2x via `buildingCost()`) + Watchfire-3 (30/6.5, gated 8) + Siege Tongs (buildSpeed 1.5, `trapDamage` 0.2 sharpening every defense via generic `siegeBonus()`) + Ashen Cloak (armor 0.12, burn-resist 1.0; troop-burn math live and pinned, no enemy source yet - documented like pre-market trade auras). Quest 17 `rue-s-terms` (new `defeat` task kind: flawless raid = zero building losses, home+away ledgers merged on return; +150 XP -> 1840). Level 8 at 1500 XP lands on Rue's terms and pays tier-4 access + food/gold cache. Rue + pale-host rumors open the notice board's first progression use.
- Ph13 Second Choir: Chorister (K1 full track, chapel/chorus job - shared workplaces stack generically in `auras()`, healer+chorister mend 3.0/s) + Chapel-3 (heal x3, `tierUnlocks: {3: [bellcote]}` - new generic building-completion unlock in `upgrade()`, 3rd unlock data point) + Bellcote (revive 50% via generic `reviveFraction()`, cold ground stays 30%) + Hymnal (healAura 0.8) + Choir Robe (armor 0.12, flat heal 10 read generically off armor-slot gear). Quest 18 `voices-in-the-dark` (assign 4, +140 XP -> 1980; Old Bell's log).
- Ph14 Master & Apprentice: `promotions` data on apprentice + `promotionOptions()` (cap 15, posted, tier-2 school) + `Game.promote()` (level 5 keeper, kit kept, gear reissued when the old tool doesn't fit, `promoted` flag = +10% aura share) + Schoolroom (xpRate 0.06, tutorDiscount 0.34) + Primer (flat `xp` 0.03 pours via auras) + Master's Ring (first % aura gear, 0.05, read off BOTH hands in `share()`). New generic `hosts` field (`assignmentValid()` + auras crew + both UI panels) lets apprentices post at the school - posting law intact, no exceptions. Quest 19 `tam-s-school` (recruit 3 apprentices - completable with zero Act VII content owned, the school's whole point; +150 XP -> 2130; Tam's log). **[ADAPTED]** Roads fork at the school (cottage->healer, schoolroom->healer/haggler), not at market/scriptorium postings - assignment law forbids those postings, so the graduate chooses at Tam's school instead.
- Ph15 Doctrine Fork: Halberdier (C1 reused end to end) + Longbowman (first C3: volley/passive-splash, keen, camouflage, arrowstorm/active-splash via new generic active-splash branch in `activateAbility()`) + Halberd/Longbow (longbow shared across 3 troops)/Banner Cloak + Fletcher (arrowBuff 0.15 damage for bows, one bundle per 120s, spent only when bows walk the map) + Shieldwall Yard (wear dulls armor 1/raid, halves at 3 via `gearArmor()`; manual `serviceArmor()` 20 wood + free auto-service on victorious returns). Missions 11a/11b `red-banner`/`grey-banner` (both require the-pale-host, limit 8, cross-grant mirror troop + shared cloak - showcase/recruit separated by design; NO permanent lock, the Phase-16 OR-gate formalizes the choice; raids-test dupes scoped to the documented pair).
- Test-fix judgment (mine): box-round failures split 4 code-side, 6 test-side. Code earned: `hosts` posting, armor-hand aura share, auras hosted-crew filter, no-waste Fletcher. Tests owned: oathblade baseline draws steel (stats assumes fitted gear), tower cost isolated from crew discount, chapel-stack strips hymnals, Fletcher starts via `g.mission()`, gearArmor returns the reduction (direction), returnHome needs a standing expedition. Old-suite allowlists extended, never frozen: quest kinds +`defeat`, handled effects +`taunt`/`unbroken`, workplace hosts-back rewritten for shared lines + hosts.
- Deferred with reasons: hard 11a/11b mutex (needs the Phase-16 OR-gate + re-unlock; soft cross-grant ships the pacing with nothing stranded); enemy burn source (Ashen math live, source doctrine later); armor paper-doll (pre-existing); trader-offer timer + market tier-2 (pre-existing, system-level).
- Pitfalls per phase: P1 new SKUs only, all 21 locked until earned (raids-test pins every grant); P2 L8 pays cache + tier-4, no map row (EXPANSION clamp holds 20x17); P3 flawless ledgers start at 0, arrival never auto-fires; P4 role kits only (C2/C3), no troop/item ids in src (pinned); P5 Rue/Old Bell/Tam logs persist; P6 both banners playable, nothing strands.

## 20-phase: Act VI Wilds (2026-09-26)

Applies NEXT20_DESIGN.md Phases 6–10 (docs/NEXT20_DESIGN.md now lives with the game). Verify: `npm test` 160/160, `npm run build` green (186 precached) — both on the free EC2 box per Jesce's standing rule (never on this PC; box recipe: `export PATH=$HOME/node-v22.17.0-linux-x64/bin:$PATH`). No save-version bump (still v5 — frostwood/plate tolerate missing keys, all changes additive or data-only).

- Ph6 Frostwood Treeline: Frostgrove (size 2, frostwood production, reserve 400, workplace woodward, 2 tiers, minLevel 6) + Woodward collector (120/10, frostwood, carry 14, frostaxe, G1 kit mapped to existing handlers) + Frostaxe + Winter Coat (armor-slot gather merges generically in the collector loop — main-hand-only reads would have left it a dead stat). Quest 13 `west-of-the-chalk` (150 frostwood, +150 XP → total 1280 = Level 7 through quests alone; unlocks woodward+frostaxe, else the recruit dead-locks). Sprites are frost-dusted variants, not reuses (the unique-name guard stays).
- Ph7 Hide & Plate: Smeltery (plate 0.6/s via `job.resource`-generalized produce, `requiresBuilding: {frostgrove, 2}` — new generic chain gate in `build()` + shop) + Smelter (B1 builder kit debut) + Iron Cap / Studded Vest / Knight's Plate (plate costs — the first plate sink). Quest 14 `first-pour` (plate 10, +140 XP → 1420). **[JUDGMENT]** Armor stays multiplicative via `gearArmor` under the existing 0.8 combat ceiling (the spec's 0.6 noted; the game already caps harder).
- Ph8 The Deep Pond: Deephole (food 2.2, reserve 350, requiresBuilding pond-2) + Diver (G1, job haul) + Pond Tier 3 + Weighted Net + Oilskin Coat (speed stored ×1.1 — `stats()` multiplies armor speed, so 0.1 would collapse it). Quest 15 `down-dark-water` (pond→3, +130 XP → 1550, Wren's arc continues).
- Ph9 Emberglass Mine: Emberglass (gold 2.4, reserve 500, requiresBuilding mine-2) + Sapper (G1, job cut) + Glasspick + Ember Ward (armor-slot damage read-through added generically in `stats()` — without it the 1.05 would be dead data). Quest 16 `glass-under-stone` (mine→3, +140 XP → 1690, Pella's blessing arc continues). **[ADAPTED]** Mine Tier 3 already existed in baseline (3 tiers + sprite on disk; the doc assumed two) — no edit, pinned by test instead.
- Ph10 The Wild Market: Market (size 3, workplace haggler, tradeAura, forge/armory pattern) + Haggler (K2 mercantile kit: haggle/appraise as `aura` 0.05 — no trade-offer handler exists, documented in-test) + new `trade` aura key (cap 0.3, min(.3) with the others) + Merchant Scales (tradeAura read-through via the pair list) + Coinmail (first discount armor; armor-slot discount reads generically in `builderBonuses()`, 0.5 ceiling intact). Mission 09 `coin-and-cinder` (`requiresAny: [ashen-ford, hollow-dam]` — new generic OR-gate in `missionLocked()`, the branch→diamond reconverges; gold 250 + frostwood 150, troop limit 7, Sarella named in all three ceremony lines).
- Test-fix judgment (mine): the box's 4 failures were all test-setup bugs — game code untouched. Chain-gate pin allowlists deephole/emberglass (2nd/3rd data points); pond/mine tests complete construction (`remaining = 0`) between stacked upgrades (`upgrade()` refuses stacked work by design); coinmail baseline sends the hammer-carrying starting roster home (its 0.05 was always real).
- Deferred with reasons: trader-offer timer + market tier-2 second offer (`traders.json` has no progression reader — system-level, Act VII/VIII); Emberglass 0.4× reserve floor (needs a data field + economy read, later); mission Unlock-line troop names render undefined (pre-existing cosmetic gap, pikewoman already had it).
- Pitfalls per phase: P1 new SKUs only (armors are shop-open but frostwood/plate-cost-gated — unbuyable before the treeline); P2 no levels touched (L7's Act V payout lands here through quest XP); P3 frostwood/plate banks start at 0, tier-3 costs are real walls; P4 role kits only (G1/B1/K2), generic read-throughs, no troop names in src/ (pinned by test); P5 Fen/Maro/Wren/Pella/Sarella logs persist; P6 Mission 09 closes the diamond.

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


## Survival city Phase 2 — raid director
- Added bounded, randomized home-raid pacing and threat from settlement growth.
- Added longer scout warnings, saved recovery periods, and Adventure survival feedback.
- Preserved campaign raid schedules, manual defense tests, first scouts, building damage, repair and salvage.
- Verified 312 unit tests and production build. Browser verification runs in GitHub Actions; local Chrome is unavailable.

## Survival city Phase 3 — factions and combat tactics
- Added three gradually introduced home-raid factions and four data-driven enemy roles.
- Added ranged attacks, wall-breaking specialization, structure defense priorities and archer retreat.
- Added faction warning/lore feedback and original 3D equipment silhouettes.
- Verified 317 unit tests and production build. Phase 2 Actions browser/mobile suite passed.

## Survival city Phase 4 — emergency behavior
- Added civilian sheltering, safe repair/healing, enemy-avoiding routes and automatic duty resumption.
- Paused construction and civilian gather loops during alarms; retained assignments and carried goods.
- Added 6 behavioral regressions and browser smoke assertions for faction raids/emergency state.
- Verified 323 unit tests and production build.

## Survival city Phase 5 — research foundation
- Added 12 technologies in six connected mobile research branches, real unlocks and a saved single-project queue.
- Added insight from the manor and assigned scholars, resource costs, prerequisite validation and raid/campaign pauses.
- Preserved legacy progression and saves; research provides another route to content rather than removing campaign rewards.
- Verified 329 unit tests and production build; added mobile research navigation/screenshot to browser suite.
