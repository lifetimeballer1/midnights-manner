## 3D orbit camera

The village is rendered as original low-poly geometry with an orthographic orbit camera. Open the ↻ camera panel to turn through 360°, adjust the viewing height, or choose Low, Village, and Overhead views. Enable Orbit to rotate with one finger; turn it off to pan. Two fingers pan, pinch to zoom, and twist to rotate. On desktop, right-drag or Shift-drag rotates, Q/E turn, R/F tilt, and 0 restores the village view. Build placement automatically returns to pan mode. This is an orbit camera, not first-person movement.

Buildings, walls, villagers, raiders, trees, and placement previews share the same 3D projection and visible-face selection. Existing saves and game rules are preserved. Resource chimes play on manual collection or once when a producer reaches capacity.

# Midnights Manner

▶ **Play it here:** https://lifetimeballer1.github.io/midnights-manner/

A browser-based village builder with an isometric HTML5 Canvas map, farming economy, equippable pixel-art tools, tactical defenses, and a data-driven frontier campaign. Vanilla JavaScript modules; no runtime dependencies, backend, API keys, or build framework.

**Status:** mobile-first playable prototype. The systems below are implemented; long-term balancing, richer combat AI, final art, and broader online features remain future work. Synthesized sound effects, an original generative music score, responsive full-screen controls and 15 campaign chapters are implemented. Progress is saved locally in the browser every five seconds and on page exit. Hidden tabs pause simulation; there is no offline production. Campaign expeditions use separate maps and preserve the home village.

## Start locally

Requires Node.js 22+ for tests/build, and Python 3 for the development server.

```sh
npm run dev
# Visit http://localhost:4173
npm test
npm run build
```

There are no npm dependencies to install. Serve over HTTP; opening `index.html` as a local file will prevent JSON loading. All runtime URLs are relative, including sprite/data fetches, so GitHub Pages project subpaths work.

## Play

- **Build:** open Build, select a card, tap or slide a finger to preview, then press Build to confirm the resource spend. Cancel leaves placement mode. Drag in wall build mode to preview a straight row along either grid axis, then confirm the combined cost. Blocked or unaffordable rows spend nothing. Walls stay in placement mode for repeated confirmed placement. Select any building to upgrade, move, or repair it. No relocation during raids. Buildings can sit directly beside walls (overlap is blocked); roomy buildings still keep their gap from other roomy buildings. Select a connected wall segment for **Upgrade row ↘ / ↙**: each ready segment in that straight line gains one tier, with a combined price shown before spending. Gaps end a row; corners offer both directions. Busy, ruined, gated and max-tier segments are skipped. Insufficient resources reject the entire row.
- **Controls:** one finger/mouse drag pans normally and slides the preview in Build/Move mode. Two fingers pan and pinch-zoom in either mode; wheel zooms around the pointer. Releasing a preview never spends resources; confirm explicitly. Tap rendered buildings to select them. Use the bottom troop rail to select a fighter, then tap open ground to move or an enemy to attack. The camera buttons zoom/recenter. On a keyboard, arrows + Enter choose a tile, WASD pan, +/- zoom, 0 recenters, H holds the selected troop, and Escape dismisses the top menu/selection.
- **People:** twenty-two frontier professions (pikewomen and apprentices among them, plus fishers, shepherds, butchers, scholars, wayfinders, moonclerics, smiths, masons and lumberjacks). Assign each to its matching workplace from the People panel. Surplus food plus free cottage beds grows new villagers over time; hunger or crowding pauses it.
- **Economy:** farms, timber yards, mines, ponds, pastures and smokehouses fill a capped on-site reserve each second from living nodes that visibly drain and refill — tap a glowing building, its bubble, or Collect to bank it with a single popup and ding. Collectors walk to matching buildings (fishermen need ponds, shepherds need pastures) and deliver to the manor. Assigned specialists work 25% faster; keepers at workplaces grant auras (sharper weapons, ward-plate, faster gathering, mending, XP, surveys).
- **Defense:** Test your defenses spawns an increasingly large raid around the village perimeter. Entry sides rotate each wave; waves of four or more attack from all four sides. The countdown names the approaching sides. Scheduled home and campaign raids use the same perimeter behavior. Warriors/archers auto-engage, towers fire, and reusable traps trigger on cooldown. Walls block routes. Destroyed buildings remain for repair. Defeated troops revive after a raid. If the home manor falls, the raid ends and salvaged wood allows recovery.
- **Story:** a 12-step village-path quest chain (quests.json) teaches build order, tier upgrades and the housing track, and pays XP that levels the village; each level can open new buildable map rows. Plus eight campaign chapters (Acts III–V) with fresh starting layouts, time limits, recruitment caps and scheduled raids — chapters 07–08 branch off the same prerequisite and re-converge. Meet collection targets, defeat scheduled waves, and keep the manor alive. Return home explicitly to claim a chapter's one-time reward and unlocks. Replays cannot farm first-clear rewards; abandoning never changes the home village.
- **Saving:** local to this browser and origin; private browsing/clearing browser data can remove saves. A storage failure is shown in the status strip. Use the same browser/device to resume.

## Mobile game interface

The moonlit kingdom interface (`src/kingdom.css`) unifies the HUD, camera controls, menus, welcome screen and settings with navy enamel, brass trim and light parchment cards. Original inline SVG action icons stay sharp at phone sizes. The bottom dock highlights the open menu, search and filters remain available, and reduced-motion preferences are respected. The drawer includes persistent navigation between Build, People, Adventure, Stores and Friends; settings use visible toggle states. Build cards appear before the village statistics, and research cards distinguish ready, active and completed discoveries. This presentation layer changes no gameplay or save data.


### Resource clarity and mobile polish

Collection bubbles show the exact resource with an original icon and a full label, such as **+40 Wood** or **+7 Food**. Automatic income and delivery feedback also name their resource. Bubbles keep fixed-size touch targets and spread apart in crowded villages. Tap a resource total in the HUD to open **Resources**, see stored amounts and ready bonuses, and collect from individual sources.

The mobile interface uses larger text, persistent resource names, matching resource colors, clearer equipment states and parchment cards. **Build** and **Army & people** support search. **Adventure** separates Expeditions, Village path, Trading and Chronicle; the quest chip opens Village path directly. Settings groups play preferences, saves and update controls. The same layouts adapt to narrow phones, landscape and desktop. These changes preserve game balance, progression, saves, wall controls and workplace hiring.

### Workplace management and architecture preview

Select a workplace on the map and tap **Workers** to view its crew, assign an available matching profession, transfer someone from another workplace, or release a worker. **Hire** in this panel recruits directly into that building. Hiring from People automatically chooses the nearest finished, living matching workplace with a vacancy. If none is open, the recruit remains unassigned. A full or unavailable explicitly targeted workplace rejects the hire before charging resources. Existing barracks, unlock, and troop-limit requirements still apply. Assigned noncombat specialists walk to their workplace; collectors retain their gather/deliver cycle and explicit player orders take priority.

Workers without a post now show **Jobless — looking for an open job**. They automatically check for a finished, matching workplace with room every five seconds of active village time. **Find open jobs** runs the same search immediately. Releasing a worker resumes that search, and old rest locks without a workplace no longer strand them. Manual assignments, movement/hold orders, expeditions and emergency duties keep their existing priority.

The architecture pass uses original Canvas geometry in `src/building-art.js`: connected timber/stone/fortified walls, raised foundations, dimensional manor/cottage/barracks roofs, crop beds, and crenellated towers. Each tier adds structural detail. Other buildings and inventory cards retain their pixel sprites. No save migration is required. `scripts/architecture-preview.mjs` optionally creates a review sheet using an externally installed `@napi-rs/canvas`; it adds no runtime dependency.

Night lighting follows the actual window panes, forge openings and watchfire flames. Windows cast tapered ground spill; fires cast a soft radial pool. Ground light is projected with the orbit camera and drawn beneath the meshes, while nearby faces of the source building receive a cached warm wash. Light sources now keep distinct identities: windows are pale, steady and tightly tapered; lanterns use compact gold pools; torches use wider orange directional spills with restrained flicker; forge/watch fires carry broader hotter pools; armed fire traps pulse in a compact footprint. Flicker is deterministic, affects only the dynamic ground spill, and freezes under Calm/reduced-motion. Practical settlement lighting now extends to paired gate torches, spaced wall torches, farm/pasture lantern posts, mine entrances, towers, docks, groves, lumber yards, sawmills, markets and the Dawn Gate. Long wall runs deliberately light only about every third segment to keep the fortified-town rhythm without flooding the scene with light sources. Construction previews and ruins emit no ground light. This lightweight effect does not simulate cast shadows between buildings.

The orbit renderer in `src/scene3d.js` adds roof ridges, corner framing, entrance steps, chimney caps, banners, planters, anvils, shield racks, drying hides, and book stands. Production buildings pile their resource at the corner as the on-site reserve fills (four steps) and fly a gold pennant once the haul is ready to collect — the 3D mirror of the bubble badge; the static mesh cache keys on those steps, so a ticking reserve never rebuilds the village. A second workplace-detail layer now gives under-detailed structures readable job props at normal play zoom: barracks training racks and dummies, forge coal/quench/tool areas, armory and fletcher supplies, farm sacks and water barrels, pasture troughs, lumber sawbucks, mine rails and carts, tannery vats, school/scriptorium chests, butchery tables, masonry tools and market cargo. Small props drop out below 1.2× zoom and never appear on construction ghosts, unfinished buildings or ruins. Active buildings now also show lightweight screen-space work cues derived from the existing simulation state rather than decorative always-on loops: forge/smeltery/workshop sparks and smoke, lumber/sawmill saw motion, mine cart glints, pond/deephole ripples, gristmill wheel motion, field/grove work sweeps, and small work glints/dust cues for armory, fletcher, tannery, school/scriptorium, scout and masonry posts. The passive-production cue stops when an on-site reserve is full; a posted collector can still keep that workplace visibly active while doing its separate gather/deliver job. Staffed workshops stop when their worker is ordered away, on an expedition or handling an emergency. These effects live outside the static mesh cache, build one available-crew index per frame instead of rescanning villagers per building, drop out below 1.05× zoom, and respect Calm/reduced-motion. Working villagers now animate the held tool itself using renderer-derived job state: posted trades lift/swing their tools, active collectors work while gathering, and repair builders hammer during emergency repair. Cargo also reads by resource instead of one generic box—wood/frostwood log bundles, moonstone ore crates, grain sacks and fish creels. The pose is visual-only, stops for manual orders/expeditions/emergencies as appropriate, and Calm freezes job motion. Sawmills and gristmills have their own machinery; construction and ruins show scaffolds and rubble. `src/character-art.js` supplies profession outfits, headgear, distinct held tools/weapons, quivers, shields and armor, with rarity colors on metal equipment. Small trim drops out at far zoom, and offscreen character meshes are skipped. These are visual changes; saves and game rules are unchanged. To review the actual meshes from front and reverse camera angles, run `CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js node scripts/detail-preview.mjs` (structures and people), `node scripts/housing-preview.mjs` (cottage tiers and the longhouse at day and night light), or `node scripts/production-preview.mjs` (producer stockpiles by resource and step) with that optional package available. Sheets are written under `artifacts/`.

Defense meshes follow connected wall runs: exposed ends get caps that meet the wall body while straight-through arms stay open. Gates orient their portcullis to the joined wall axis, with connector arms ending at the frame so the raised passage stays clear. The gate rises at peace and lowers in four renderer-only stages when raiders press within 1.4 tiles; reduced-motion mode snaps to the current state. Traps show raised teeth while armed and retracted teeth during cooldown. These states derive from existing world data, add no saved fields, and do not change combat rules. `node scripts/defenses-preview.mjs` reviews connected walls, gate travel, and armed/sprung traps with the optional canvas package; its sheet is written to `artifacts/defenses-preview.png`.

Held tools and weapons use distinct low-poly silhouettes at the normal 1.65× gameplay zoom: the bow, longbow, pike, halberd, battle axe, felling axe, cleaver, heavy hammers, trade tools, kits and instruments no longer collapse into the same mesh. Both bow families retain visible strings below the detail-trim threshold. Tier/material variants retain the shape of their archetype. Profession coats and headwear remain distinguishable across all 35 troop types without fine-detail trim; shared outfit shapes keep clearly separated coat colors. Forager/Archer and Warden/Warrior have different headwear, while Haggler/Builder have different workwear.

Crafted gear and armor use the same rarity colors as their inventory labels, driven by `items.json`. A narrow sleeve accent reads each profession's unique `color` in `troops.json`, reusing existing mesh faces. Both are renderer-only, with no save fields or gameplay effects. Review the 31 held-tool archetypes, crafted rarity ladder, and all 35 profession defaults from front/reverse gameplay-scale angles with `node scripts/equipment-preview.mjs` (optional external `@napi-rs/canvas`); sheets are written to `artifacts/equipment-{front,reverse}.png`.

An original generative score begins after **Enter village**. Its slow 6/8 D-Dorian harmony uses a warm bass, soft chord bed, varied plucked notes and a quiet echo, all synthesized with WebAudio rather than recorded music. **Sound** mutes music and effects together; **Calm** keeps the harmony but thins the melody. No audio assets, dependencies, or save fields are added.

The frontier now also uses sparse deterministic 3D biome scenery from `data/biomes.json`: plains can show grass/stone/stumps, forest adds pines/shrubs/logs, water adds reeds, hills add rocks/cairns, and unclaimed fringe stays visibly rougher. Wild tiles use a higher scenery density than claimed land, building footprints suppress decorative props, and named landmark tiles receive a generic raised marker. The scenery is visual-only—no collision, yield, pathfinding, resource or save changes—and is capped/LOD-trimmed for mobile performance.

The home frontier now extends to **52×44 tiles** without shifting the original 40×34 village coordinates. Seven outer regions continue the existing claim graph: **Starwatch Ridge, Whisperwood, Ashfall March, Blackwater Mouth, Southreach, Dawnfields, and Pale Coast**. Existing v12 tile-grid saves keep every old tile/claim/building coordinate exactly and append only new unclaimed tiles through save v13; tile-less vintage saves still use the established settled-bounds reconstruction path. Campaign expedition bounds remain homestead-sized.

Late campaign chapters now use that frontier as real story geography. **The Pale Court** waits at Southreach Crossing, **The Longest Night** at Starwatch Ridge, and **Dawn** in the Dawnfields. Once their chapter prerequisites are met, an unclaimed destination becomes the Adventure Home next action; its button enters Expand mode and centers the camera on the landmark. Direct mission starts use the same gate, while chapters completed before this system remain replayable.

Campaign objectives are now evaluated through one generic progress system. Legacy `{resource, amount}` objectives remain gather goals; new data can use **protect**, **survive**, **defeat**, or **build** without adding chapter-specific code. The Pale Court must keep its tower standing, The Longest Night must keep the Oathstone standing, and Dawn must protect its Oathstone and hold the field through 360 seconds. The battle HUD automatically follows the first unfinished objective and the Campaign panel shows progress for every objective.

Named destination expeditions now own their own **20×17 visual tile sheet** instead of inheriting the persistent home's 52×44 landmarks. Mission map data can declare `map.biome`, `map.seed`, and `map.tiles`: The Pale Court uses open Southreach plains, The Longest Night uses rocky Starwatch hills, and Dawn uses broad Dawnfields plains, each with its own visible landmark. Scenery uses the mission world's own biome seed, while the home frontier keeps its existing tile sheet and seed unchanged.

The persistent frontier's ten named landmarks are also **story hotspots**. Their lore lives in `world.json` as data-only `{id,x,y,name,text}` entries. A home-map landmark marker carries a selectable `site` hit target; tapping it recenters the camera and surfaces its story through the normal status message. Expedition landmarks deliberately do not inherit home hotspot identity even when a mission-local coordinate matches a home landmark.

Claimed outer regions can now also raise **sparse frontier events** while the home village is calm. Event definitions live in `world.json` and use only existing resource costs/rewards; the scheduler lazily initializes on old saves, waits roughly 5–8 in-game minutes between events, avoids opening a choice inside the final minute before scheduled horns, and never fires during campaign expeditions or active raids. Adventure → Home shows the event text and two player choices; unaffordable options disable, free decline options remain available, and resolving a choice atomically spends/rewards resources before scheduling the next event.

Wild outer regions can also show **visible faction camps** as the conflict escalates. Five data-driven camp records tie Thornband, Pale Host, Cinder Clan, Ember Legion and Pale Court presence to specific unclaimed frontier regions and minimum raid waves. Camps are renderer-only low-poly tents/banner/fire groups, share the existing scenery budget, disappear automatically when their region is claimed, never appear on expedition maps, and can be tapped to read the camp and faction lore. The static village mesh cache now keys on raid wave so newly relevant camps appear without forcing per-frame rebuilding.

Enemy characters now read by **role as well as faction**. Scouts use a lighter blade/hood profile, breakers keep the heavy hammer, rams carry a broad timber frame, bombards carry a compact field tube, elites gain unique pale-gold recognition trim, and the Cinder-Maul/Pale Queen use distinct boss silhouettes. These are renderer-only overlays on the existing combat entities; faction colors, hit boxes, stats, pathfinding and combat rules are unchanged.

A capped **atmosphere layer** now sits between terrain and the 3D village meshes: finished hall/cottage chimneys and visible faction camps can breathe small smoke puffs, moving villagers/raiders leave short ground footprints, and rain adds a handful of ground splashes. The layer is visual-only, disappears below 0.9× zoom, turns off completely under Calm/reduced-motion, and is hard-capped at 8 smoke sources, 12 trail actors and 14 rain splashes.

The map fills the viewport (including iPhone safe-area handling); the document never scrolls. Build, Army & people, and Adventure are overlay drawers. On phones they are bottom sheets; in landscape/desktop they use a side drawer. A quick fighter rail supports direct orders. Quest and raid status stay visible on the map. Menus have keyboard focus containment and labeled controls. The welcome and settings screens pause simulation; Build/Army/Adventure remain live during raids.

Production buildings store their output on-site in a **capped reserve**: tap a glowing building, its labeled bubble, or the selected building's Collect button to bank it with a single popup and ding. Nothing drips into storage unprompted, so the map stays quiet until you harvest. Configure the cap with `harvest.capacity` in buildings.json (500 at tier 1 on every producer today). The cap grows with building tier via `harvest.perTier` (500 per tier today, so 500/1000/1500 — or set an explicit `harvest.capacities` array per building); tune it per building, no code needed. The gold badge and labeled bubble stay quiet until the reserve reaches `harvest.notifyAt` (150 at tier 1, ~30% of cap, scaling proportionally with the tier cap); tapping a building always banks whatever whole units it holds. Reserves accrue only during active simulation, cannot be double-claimed, and count toward collection objectives.

Use **Safari → Share → Add to Home Screen** on iPhone for standalone play. The relative-path web manifest and local app icons support a home-screen shortcut. This does not promise offline operation or cross-device saves. Full Screen in Settings uses the browser Fullscreen API where supported.

### Updates from a Home Screen shortcut

Open **Settings → Check for updates**. When a new build finishes downloading, tap **Update ready · Save & refresh**, or the gold **Update ready ↻** notice on the map. **Save & refresh** also reloads the current game at any time. Refresh saves first and is cancelled if saving fails. It never clears village storage or removes the Home Screen shortcut.

Built games check on reopening/resuming and every five visible minutes. New versions wait for your click rather than interrupting play. Offline/update-download errors leave the current build playable. Every changed build gets a content-based cache ID, even without a package-version bump. Caches are scoped to this game; missing assets never return HTML. Local development has Save & refresh but does not register a service worker.

Existing shortcuts need to load this release once: fully close the game and reopen it online (close any other open copies too if the older build remains). Safari and a Home Screen installation can have separate storage; updating does not transfer saves between them.

### Visual direction and references

User-provided Clash of Clans village and battle screenshots informed edge-anchored resource HUDs, a dominant map, thumb-sized bottom actions, troop cards, and contextual controls. Online references reviewed:

- Clash of Clans village layout: https://gametaffy.com/blog/best-for-you/the-art-of-war-forming-alliances-in-clash-of-clans
- Kingdoms and Castles settlement readability: https://www.gamestar.de/galerien/kingdoms_and_castles,132271.html
- Stardew Valley farm paths and crop grouping: https://www.breakflip.com/guides/6590.html

These are design references only. No screenshots or commercial game assets are bundled; the repository's original pixel sprite set is retained. The brighter grass, dark framed HUD, camera scale and high-contrast selection treatment make it readable on a small phone.

### Verification

`npm test` includes 686 simulation/rendering/input/audio/update regression checks. `npm run test:browser` requires a locally installed Chromium (`CHROME_BIN` may point at Chrome or Edge). CI runs real pointer/touch input checks for placement preview/confirm, menus, equipment/training, missions, raids, save/reload, one-finger pan, pinch zoom, audio start/mute/resume, and no document overflow at portrait/landscape sizes. Screenshots are attached to the Actions run. A browser test failure blocks deployment. The update/refresh smoke path now restores the Settings sheet after service-worker controller transitions while separately asserting that no unapproved reload occurred; the same browser pass also requires live frame telemetry and keeps visible/static mesh face counts below a generous 30,000-face runaway guard.

For visual work, `npm run build && npm run capture` writes deterministic look snapshots (dawn/day/dusk/night desktop plus a phone night view — calm motion, clear skies, pinned camera) to `artifacts/look-*.png`. `tests/lighting-baseline.test.js` freezes the current mesh shading and the static-cache invariant until a phase updates them deliberately. The `?perf` badge and `window.midnightsManner.frameReport()` report frame times plus painted and cached face counts.

## Repository structure

```text
src/
  main.js              JSON/assets loading, fixed-step loop, responsive Canvas
  input.js             pointer, drag/pinch and keyboard controls
  camera.js            screen/world transforms and stable animation seeds
  game.js              commands and simulation orchestration
  model.js             unit/building factories, curves, costs, placement
  renderer.js          isometric Canvas map, sprites, equipment animation
  ui.js                build/people/story panels and selection inspector
  storage.js           versioned local save/load
  styles.css           responsive interface
  systems/
    economy.js         production, collectors, builder effects, living reserves
    village.js         quests/XP/levels, housing/population, expansion, job trickles
    pathfinding.js     grid routing and collision
    combat.js          raids, damage, towers, traps, ability handlers
    campaign.js        mission lifecycle, constraints, rewards
    storage.js         central storage caps, reward ledger, inflow gates
    conquest.js        tribal conquest state, readiness law, annex ledger
    dashboard.js       read-only per-day economy ledger
assets/sprites/        95 original 32×32 transparent PNG placeholders
assets/favicon.svg
data/                  editable game configuration JSON (buildings, troops, items, quests, missions, world)
scripts/
  build.mjs            creates deployable dist/ from public files only
  generate_sprites.py  optional Pillow-based sprite source
tests/                 Node simulation/data regression tests
.github/workflows/pages.yml
```

## Data-driven extension guide

### Add a troop

Add a unique key in `data/troops.json`. Supply `name`, `role` (`combat`, `collector`, or `builder`), `sprite`, `maxLevel`, `base` stats, `growth`, costs, `defaultGear`, `carry`, `gatherResource`, and a level-to-ability map. The stat curve is `base × (1 + growth × (level − 1))`, followed by equipment and passive modifiers. Add new thresholds at levels 30/35/etc and raise `maxLevel` to extend progression. Add the sprite to `assets/sprites/` and compatible items to `items.json`. The People panel discovers entries automatically. Add the troop ID to a starting roster or recruit it at a barracks.

Abilities at levels 5, 10, 15, 20 and 25 reference entries in `data/abilities.json`. Existing effects are `splash`, `armor`, `heal`, `damage`, and `gather`, plus `aura` (amplify the bearer's workplace-aura share), `xp` (trickle village XP), `buff` (transient timed combat drills, active with cooldown) and `guard` (lend armor to nearby allies). Active healing uses radius, value and cooldown data. Adding another ability using an existing effect only needs JSON. A genuinely new behavior requires a generic effect handler in the appropriate system; do not add troop-specific conditionals. Kits are per-role on purpose: combat cleaves, collectors gather, keepers mend, builders endure — a farmer never gets cleave. Role kits (C1 melee-control, K1 scholarly, etc.) debut with new troops; old troops keep their kits.

### Add equipment

Add an item in `data/items.json` with a distinct `sprite`, `roles` listing compatible troop IDs, purchase `cost`, `stats`, and `animation`. Supported stats: `damage` multiplier, `range`, `gather` multiplier, `carry`, `buildSpeed`, `costReduction`, `hp` (max-HP pad), `speed` (multiplier). Armor-slot pieces (`slot: "armor"`, one per villager alongside the main tool) use `armor` (multiplicative reduction via `gearArmor()`, under the combat ceiling). Keeper tools can carry aura stats (`survey` multiplier, `xpAura`/`xpMult`, `damageAura`/`armorAura`/`gatherAura`/`healAura`/`carryAura`/`beds`) that sharpen the bearer's share of their workplace aura while posted. Supported attack animations include `slash`, `sweep`, `slam`, and `arrow` (unknown labels render as a plain strike line); tool animation labels can be extended in the renderer. Every equipped item is drawn on the character and appears as an individual sprite in the inventory. The sword, axe and warhammer have different silhouettes, reach and swing behavior. Gear is not a hidden menu-only multiplier.

### Add a building

Add an entry in `data/buildings.json`: `name`, tile `size`, `cost`, `buildSeconds`, optional resource `production`, base `rate`, and a `tiers` array. Every tier needs its own `sprite`, `hp`, `rateMultiplier`, `damage`, and `range`. Nonzero damage enables a stationary defense. Provide a distinct sprite for every tier; do not simply recolor it. Tier count is read from data. Optional gates: `tierGates: {"3": 7}` holds a tier until the village level (Scriptorium observatory), `minLevel: 5` holds the whole building (Longhouse), `repeatPlace: true` keeps walls in placement mode. The Build panel automatically includes every entry except the unique manor. Traps are passable; other buildings obstruct movement. Special mechanics beyond production, ordinary defenses and traps need a system extension.

### Add a profession and workplace

Give the troop a `job` (`workplace` building type, `effect`, flavor `text`) and give the building a matching `workplace` (troop id) plus an aura field (`damageAura`, `armorAura`, `gatherAura`, `carryBonus`, `buildAura`, `healRate`, `xpRate`, `surveyRate`) or `production`. Collectors can scope to one building type with `gatherFrom`. Assign in the People panel; effects apply only while posted at a finished building, capped in `auras()` (model.js). Provide a distinct sprite and default gear item.

### Add a quest

Append to `data/quests.json`: `id`, `name`, `text`, `task` (`build`/`recruit`/`assign`/`population`/`level`/`gather`/`upgrade` with counts — `upgrade` takes a building `type` or array of types plus a `level`), `xp`, `rewards`. Optional: `unlocks` (building/item/troop IDs granted on completion, earned never bought), `log` (a persistent Chart-Log page once completed). Optional flavor: `giver` (who asks), `flavor` (one rumor-grade line shown on completion), `act` (`I` village-path, `II` growth, `V` foundations). Old entries without them load unchanged — never a migration for flavor. The first incomplete quest auto-completes with fanfare. XP thresholds (`XP_LEVELS`) and map sizes (`EXPANSION`) live in `src/model.js`; per-level resource caches live in `data/levels.json` (level → rewards + flavor line, granted on every level-up, even multi-level jumps).

### Add a mission

Append to `data/missions.json` with a unique `id`, `name`, `chapter`, `description`, `timeLimit`, `troopLimit`, `startingResources`, `objectives` (`resource`, `amount`), `map.buildings`, `map.troops`, `raids` (`at`, `count`), `rewards`, `unlocks`, and `requires` (prior mission IDs). Optional flavor: `act` (`III` defense, `IV` expansion), `beat` (one-line design note), `ceremony` (`warning` on launch, `victory`/`defeat` on return). All optional; old entries load unchanged. Multiple missions can share the same prerequisite for branching. Objectives track production/deliveries since mission start, excluding starting stock and combat loot. All scheduled waves must spawn and be defeated before victory. All resource objectives must be met before the timer expires, and the manor must survive. Rewards are applied to the saved home world only when returning from a first victory.

### Add a lighting phase

Mesh shading follows the sky clock through `skyLightAt()` (`src/systems/daynight.js`). Each phase (`dawn`, `day`, `dusk`, `night`) has a key light (`key.dir` or a sweeping `key.arc`, `key.color`, `key.intensity`), ambient (`ambient.color`, `ambient.intensity`), a `sky` fill for upward faces, an `emissive` boost for windows and flames, and a `vignette` depth. Weather lands on the meshes through `weather.mesh` (fog veil with `fogColor`, flat `dim`). Ground-contact AO and the shadows that swing with the key arc are geometric, not clock state. Override any field under `world.daynight.lighting.<phase>` or `world.daynight.weather.<id>`; missing fields keep their defaults and bad values clamp and fall back, so a broken table can never black the screen. `lightBlend` (fraction of a day, default 0.04) sets the crossfade out of the previous phase; `calm` players get a plain step per phase with the arc pinned at its midpoint. Day reproduces the legacy fixed-light formula byte-for-byte against a frozen light (`tests/lighting-baseline.test.js` pins it); `docs/LIGHTING.md` has the full model and test map.

Use `data/world.json` to change grid size, home resources/layout/roster and campaign-gated IDs. This prototype renderer is composed for the default 20×16 map; larger grids also need camera/projection work. Existing browser saves retain their current world; change the save version/migration policy deliberately when changing incompatible schemas.

## GitHub Pages

The workflow tests and builds on pull requests and pushes to `main`; only main pushes/manual runs deploy. It uses the official configure-pages, upload-pages-artifact and deploy-pages actions with a `github-pages` environment and scoped deployment permissions.

1. In this repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Push to `main`, or run **Test and deploy Midnights Manner** in Actions.
3. Open the URL reported by the deployment job. Expected project URL: `https://lifetimeballer1.github.io/midnights-manner/`.

Repository visibility and plan must support Pages; a private repository may require an eligible paid GitHub plan. The workflow cannot change those account settings. Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Worker handoff and implementation order

1. Scaffold and core loop: separate modules, fixed 20 Hz simulation, grid projection, placement, troop objects and resource production.
2. Progression and equipment: table-defined curves/abilities, explicit inventory, visible gear and distinct attack reach/animation.
3. Defenses: collision-aware movement, upgradable walls/towers/traps, enemy waves and repair/recovery.
4. Story: isolated campaign maps, timed collection, wave constraints, troop limits, first-clear rewards and unlocks.
5. Verify: simulation regression tests, browser loading/interaction checks, responsive rendering, Pages subpath build.

Read this README before editing. Keep game data separate from logic. Maintain honest status, preserve the original brief below, run tests/build before pushing, and never put secrets in this static client. Do not replace the structured repo with a single mega-file. Next useful work: stronger save-schema migration, richer routing/target priorities, more missions, cloud-save design and art polish.

## Original user prompt — preserved for all workers

> Build a browser-based village-builder/strategy game (Clash of Clans mechanics + farm-sim resource loop) as a web app I can deploy to GitHub Pages. Use HTML5 Canvas + vanilla JS (or React if it's cleaner for state management) in a structured repo, not a single mega-file, so it's maintainable.
> Core systems:
> 1. Troops — Each troop type (e.g. Warrior, Archer, Miner) has a level 1–20+. Leveling raises HP/damage/speed on a curve. Every 5 levels, unlock a new active or passive ability (e.g. lvl 5 = cleave attack, lvl 10 = armor buff, lvl 15 = area heal). Store this as a data table (JSON), not hardcoded logic, so it's easy to expand.
> 2. Roles need distinct gear, not just stat boosts:
> • Builders — hammers/tools that speed up construction or reduce upgrade cost.
> • Warriors — weapon tiers (sword → axe → warhammer) that change attack animation/range, not just damage number.
> • Resource collectors — tools (sickle, pickaxe, cart upgrades) that increase gather rate or carry capacity.
> • Each tool/weapon should be a separate equippable item with its own sprite, not a stat modifier hidden in a menu.
> 3. Base building — Grid-based placement system. Buildings have visual tiers (tier 1 hut looks different from tier 3 fortress — different sprite per level, not a recolor). Include walls as placeable/upgradable objects, plus defensive structures (towers, traps) that can be arranged freely for base layout strategy.
> 4. Story mode — A linear or branching campaign of missions where the objective is resource collection under constraints (time limit, enemy raids, limited troops). Completing missions grants resources/unlocks usable in the main base-building loop. Structure this as a mission-data file (objectives, rewards, map layout) so new missions can be added without touching game logic.
> 5. Visual distinction — Every building type/tier and every character/troop type needs a unique sprite or distinct silhouette+color scheme — no palette-swapped reuse. Use simple pixel-art placeholders to start (16x16 or 32x32) so the systems can be built before final art.
> Deliverables: a GitHub repo with a clear folder structure (/src, /assets, /data for JSON configs), a working GitHub Actions deploy to GitHub Pages, and a README describing how to add new troops/buildings/missions via the data files.
> Start by scaffolding the repo structure and the core game loop (grid rendering, troop object model, resource ticking), then layer in the ability/leveling system, then base defenses, then story mode.
> Can you start in the call it midnights manner save this prompt in the readme so all the workers can work off it

## Survival city upgrade — Phase 2

Adventure uses five sections: Home, Quests, Expeditions, Campaign, and Chronicle; the Grey Market remains reachable from Home. Home now shows settlement threat (buildings, people, stores, progression and previous waves) and recovery status.

The home raid director preserves the first scouting pair after five minutes. Later attacks roll a saved quiet window of 4–8 active-play minutes; higher threat shortens the random portion and increases the party within the existing eight-raider cap. Scouts give 25 seconds of warning. Victory grants at least three minutes of recovery, defeat six, plus time for damaged buildings. The next deadline cannot precede recovery. Buildings still require repair and ruins stop production; the manor defeat salvage and troop revival rules remain intact. Test your defenses explicitly bypasses quiet time. Campaign maps keep their authored timelines and pause the home clock. These optional saved fields load additively without resetting existing saves.

Balance settings live in `data/world.json` under `homeRaids.director`. Factions, emergency AI, research and the later survival-city phases are separate follow-up work.

### Phase 3 — faction combat foundation

Home raids now introduce the Thornband (raiders and fast scouts), Pale Host (bowmen, from wave 3), and Cinder Clan (wall breakers, from wave 5). Each has its own roster, colors, lore and counterplay; archers and breakers carry distinct low-poly equipment. `world.enemyFactions` and `world.enemyRoles` define the rotation and stats. Campaign spawns keep their existing compositions.

Automatic defenders prioritize enemies threatening structures, especially the manor; archers retreat to a safe neighboring tile when pressed. Wall breakers prefer nearby walls and deal bonus structural damage, while enemy bowmen attack from range. Explicit player orders still take priority. Ranging villagers are excluded from ordinary combat. This is the initial faction roster: bosses, support enemies, siege engines and faction-specific campaign encounters remain for later phases.

### Phase 4 — emergency village behavior

Scout warnings and active raids switch civilians into emergency duties. Civilians seek a safe living manor or home using routes that avoid nearby enemies. Builders and masons repair safe damaged defenses (6 HP/second, paid at the usual 15 HP per wood); healers, choristers and tidecallers mend safe wounded allies. Exposed workers try to retreat. Small gold, blue or green markers show shelter, repair or healing duties. Fighters retain the Phase 3 defense response.

Ordinary construction pauses during alarms. Carried goods, workplace assignments and manual orders are preserved and resume after the raid. Ranging villagers continue their separate expedition. Passive building reserves and existing support auras remain active. No automatic rebuilding of ruins or permanent civilian losses were added. This is local danger-aware routing, not a simulation of indoor occupancy or guaranteed safety behind every wall layout.

### Phase 5 — technology tree foundation

Open **Adventure → Home → Technology tree**. Twelve technologies form six two-step branches: Survival, Construction, Warfare, Industry, Society and Exploration. Each node shows its prerequisite, insight/resource cost, research duration and actual unlocks. The home manor produces 6 insight/minute; each living assigned scholar at a finished Scriptorium adds 9/minute per building tier, capped at 60 total. One technology researches at a time. Insight caps at 1,000. Both insight generation and the research timer pause during raids and campaign expeditions.

Research unlocks existing defenses, tools, professions and production options without requiring campaign victories. Campaign rewards and previously earned unlocks remain intact; village levels still govern existing map expansion and tier gates. Research costs are paid once on start; completion grants unlocks once. The queue, points and discoveries survive saves. Old saves begin with zero insight and no discoveries. The system is an initial progression alternative, not a complete rebalance of every legacy level gate. Technology definitions live in `world.technologies`, and Scriptorium productivity in `buildings.scriptorium.researchRate`.

### Late-game economy — Phase 1: central storage caps

Every central store now has a real capacity: a data floor (`world.storageBase`) plus the Manor Hall and any finished **Storehouse** tiers (new 3-tier building at village level 4), scaled by each tier's `rateMultiplier`, so storage grows with upgrades. On-site building reserves keep their own tier-scaled caps (`harvest.capacity`/`perTier`).

Nothing earned is ever voided by a full store. Taps, collector deliveries and refiner output bank what fits and hold the rest exactly where it was — reserves stay on the building, collectors keep carrying, refiners wait on their raw input. Reward overflow (quest and level caches, mission rewards, salvage, gifts, expedition hauls, the tutorial bonus) waits in `world.pendingRewards` and banks as room opens. Trade deals and frontier-event responses whose goods cannot fit refuse before any cost is paid. Over-cap saves load unchanged; during active play, excess central stock now settles quietly toward capacity (see Phase 1A below). Held rewards, carried goods and on-site reserves remain protected.

The Resources panel shows `stored / capacity`, remaining room, held rewards and a full-stores note, and HUD totals gain a gold **full** state so the hold is always explainable. Tuning lives in `data/world.json` (`storageBase`) and `data/buildings.json` (`storage` per building, per tier). Save v14 migrates additively — nothing but the new reward shelf is added, and over-cap balances pass through exactly as saved.

Posted specialists now work indoors (renderer-only): once a keeper reaches their finished workplace they are hidden from the map while the building's work cues carry the shop; any manual order, emergency duty or expedition brings them back out, and workers still walking to a new post stay visible. Collectors stay visible by design — their gather/deliver walk is the economy's readout.

Review: `npm test` 597 green (10 new storage-cap checks: caps math, grandfathering, partial banking, carried-load and refiner backup, trade refusal, migration, indoors read), `npm run build` 359 precached, browser smoke green (Edge as Chromium) with no console errors.

### Late-game economy — Phase 2: upper-tier curves + building limits

Upgrade prices are now data-driven above tier 2. A building can carry `costCurve` in `data/buildings.json` — the price multiplier for each tier (index = tier − 1). Tier 1 always stands at base cost and tier 2 at double (the friendly opening is a tested invariant); from tier 3 the curve steepens, and `tierCosts` adds flat per-tier extras in the worked goods (sawn **lumber**, forged **plate**) on top — extras are never multiplied by the curve, they already name the endgame price, and the builder discount trims them like coin. Buildings without a curve keep the legacy formula byte-for-byte, so untouched content and pinned balances stay exactly put. Tuning lives entirely in `data/buildings.json`.

Every economy line also has a real building limit: `maxCount` is either a flat number or a per-village-level array (clamped at the last entry, like housing arrays), so the settlement grows its ceiling with village levels and research can extend it later. Limits cover production, storage and workshop lines; walls, gates, ramparts, traps and housing stay uncapped for layout freedom. `Game.build` enforces the limit after the wonder and chain gates, the Build panel shows `built / cap`, tags a capped card **FULL** and explains the reason, and over-limit villages keep every standing building — only new work waits. Ruins never count, so a wrecked shop can be repaired or replaced in place.

Review: `npm test` 606 green (9 new curve/limit checks: friendly-opening invariant, flat extras, legacy fallback, discount on extras, numeric and per-level limits, growth with village level, grandfathering, ruin slots, multi-resource affordability), `npm run build` 359 precached, browser smoke green (Edge as Chromium) with no console errors.

### Late-game economy — Phase 5: renown, the endless multi-resource sink

Manner Renown now asks the whole basket: gold, food, sawn **lumber**, **bread**, forged **plate** and rare **frostwood**, climbing 35% per level forever (`data/endgame.json renown.baseCost`/`costGrowth`). A missing good refuses the purchase before anything is paid, and the purchase is exact. Every level still sharpens defenses (+3% damage) and enriches salvage (+5% loot).

Ten data-driven milestones (`renown.rewards`) add the real rewards — never production multipliers, so the surplus cure never seeds a new surplus: **titles** (shown at the hall inspector), **building-limit bumps** (each finite `maxCount` gains room; uncapped lines stay uncapped), **muster room** (extra troop slots above the hall beds) and **unlocks** (the grey banner cloak, the keeper's ring, the dawn regalia). The table is read live from `world.renown` — no new save fields — and earned unlocks merge once on purchase, so old renown saves heal their milestones on their next level. Great Works and Town Projects can join the same table as data once their phases land.

Review: `npm test` 614 green (8 new renown checks: basket ladder, refusal without payment, exact payment plus spoken milestone, once-only unlock merge, cap/cosmetic-only table guard, title ladder, no-production-aura guard, muster integration), `npm run build` 359 precached, browser smoke green (Edge as Chromium) with no console errors.

### Late-game economy — Phase 3: the town table and Well Fed

Once per game-day (`world.townMeal.secondsPerDay`, 180s of active village time) the town sits down to eat: every mouth costs food **and** bread (`foodPerVillager` 5, `breadPerVillager` 1, both data). A full table draws the basket exactly and earns **Well Fed** until the next meal; a short pantry is never punished — no partial draw, no debt, no starvation, the bonus simply lapses and returns the moment the stores can cover the board. The loss is announced once, and a village that never built the bread chain is never nagged.

Well Fed merges into the existing systems through data: aura effects (`+8% gather`, `+5% village XP`, `+0.2/s recovery`), `+25%` child growth in the cradle timer, and `+25%` job training for posted crews. Bread is now the daily reader of the mill chain — the finished product the stores actually demand. Rations and feast supplies arrive in Phase 6 as the War Chest's Rations line and the festival baskets, so food and bread feed three systems instead of piling up as dead inventory.

`world.wellFed` / `world.lastMealDay` are optional saved fields with safe defaults: fresh worlds start on a quiet day zero, and old saves eat on their first new day. The Build strip shows a `🍲 Well Fed` chip, and the Resources panel reports the table, the basket and the next meal countdown.

Review: `npm test` 623 green (9 new meal checks: basket cost, day cadence, no-partial shortfalls, loss-only messaging, aura merge, cradle and job-training bonuses, no-death guard, old-save grace, data fallbacks), `npm run build` 360 precached, browser smoke green (Edge as Chromium) with no console errors.

### Late-game economy — Phase 6: war chest, festivals and the bulk market

Three repeatable valves turn surplus into decisions, all data-driven and combat-only:

**War Chest** (`data/world.json warChest`, village level 5+): five investments — Rations, Arrow Stockpile, Repair Wagons, Reinforced Armor, Frostwood Stakes — stockpiled any time with real resources from the Adventure → Home board. The chest only helps while it is **open**, and it opens only when raiders are on the road (the battle HUD grows a 🛡 button during the warning). Whatever is inside is spent when the raid ends, win or lose: arrows sharpen towers and bows through the aura table, plate shrugs off blows, rations mend mid-raid and raise more of the fallen (revive up to the 80% ceiling), stakes slow the charge and blunt siege blows against walls, and wagons mend the worst-hit buildings — ruins included — before the victory tally is read. Easy raid, save the stores; crown wave, open everything.

**Festivals** (`data/festivals.json`): Harvest Feast, War Feast and Founder's Festival are held from the same board — pay once, the town glows for its full duration (timed aura effects, growth and job-training warmth, and Founder's glory in village XP), then a per-festival cooldown keeps the calendar readable. One festival at a time; the warmth fades on its own clock.

**Bulk market** (`data/traders.json`): the Grey Market now moves every real good — sawn lumber, plate, frostwood, flour and bread join the original three — and two late-game valves (level 7–8, one run a day) trade bulk surplus for a single prize at intentionally lossy rates, riding the existing rotation, daily caps and the Phase 1 room check.

Additive save fields (`world.warChest`, `world.warChestArmed`, `world.festival`) with safe defaults; old saves read an empty chest and no festival.

Review: `npm test` 636 green (13 new valve checks: chest data/caps/level gates, exact stocking, open-only-for-raids, combat-only auras, revive/wall/slow/recovery math, burn-at-raid-end integration, festival gates/exact payment/expiry/sim bonuses, deliberate trader-table widening, bulk conversion with daily caps and frostwood payouts), `npm run build` 363 precached, browser smoke green (Edge as Chromium) with no console errors.

### Late-game economy — Phase 4: Town Projects

Four grand staged works now stand beside the ordinary shop list — **Grand Market Square** (3×3), **Grand Granary**, **Manor Gardens** and the **Monument of the Manner** — data-driven buildings with a `project` flag, their own tier-staged art (clearing → stalls → stonework), multi-resource stage prices (`costCurve` [1, 2, 6] with the friendly opening intact), village-level gates (6/5/5/8 to raise, higher tiers gated by `tierGates`), and one per village. They appear under a new **Projects** filter in the Build panel and stage up through the normal inspector.

Each finished stage blesses the settlement through data: a generic `flatAuras` map (scaled by tier, merged into the existing aura table, caps hold) gives the Market Square trade/carry/study warmth, the Granary extends central storage through the Phase 1 cap system, the Gardens add beds and a small mend/gather hand, and the Monument improves revival and village study. Ruins and scaffolds bless nothing. More projects (Royal Forge Quarter, City Wall Project, Stone Road Network…) are data + sprite additions on this same pipeline.

Review: `npm test` 643 green (7 new project checks: data shape and distinct stage art, staged multi-resource prices, level gates and one-per-village, tier-gated stage-ups, flatAuras scaling and ruin/scaffold suppression, granary/gardens/monument payoffs, save validation and round-trip), `npm run build` 375 precached, browser smoke green (Edge as Chromium) with no console errors — including the four-sides/finite-faces orbit sweep across every new building and tier, which caught two undefined palette names in the new meshes before they shipped.

### Late-game economy — Phase 7: the economy dashboard

The Resources panel now reads the whole ledger. A per-game-day card (one day = 180s of active village time) lists each resource's passive output, hearth trickles and worked recipes on the plus side, and the town table's meal draw on the minus side, with the net per day — full reserves pause their drip exactly like the sim, and collectors are honestly excluded rather than guessed. Below it, **Where wealth goes** lists the open repeatable sinks with live prices (next Renown, festivals, war-chest stocks, unbuilt or next-stage Town Projects), and **The wagons** lists today's Grey Market deals with remaining daily caps and one-tap strike buttons. Read-only: `src/systems/dashboard.js` is pure math, and the panel writes nothing to the save.

Review: `npm test` 649 green (6 new dashboard checks: per-second rates and the mid-game throttle, full-reserve pause, daily meal draw and net, two-sided recipe reporting, trickle merges, empty ledger), `npm run build` 375 precached, browser smoke green (Edge as Chromium) with no console errors.

### Late-game economy — Phase 8: spawn protection and the Ironshield conquest

**Spawn protection.** Raids can no longer materialize on or beside the built-up town: every structure's footprint grown by a buffer (`world.spawnBuffer`, default 2) is an exclusion ring, and raid entries must fall outside it on unblocked ground. When a near edge is wall-to-wall with the settlement, the muster walks outward into the wild (up to six tiles) before any fallback, and every raid dedups its tiles. The roomy contract is unchanged — small waves still rotate sides and stay on the navigation grid.

**The Ironshield conquest (first tribal slice).** A data-driven endgame arm (`data/conquest.json` + chapters 15–17 in `data/missions.json`): scout the tribe from the Adventure → Home frontier card (gated on the muster law — village level 9, Renown 2, tier-3 barracks, 8 fighters), break its outer works in **Break the Border Patrol** and **Silence the Watch Post**, then march on **The Ironshield Keep** with the Campaign War Chest (food, bread, lumber, plate and gold paid only when the march starts). The Warden-Captain rides the final wave through the same boss machinery as the home crowns (`bossSpec` searches conquest leaders beside `endgame.bosses`, rotation untouched), and first-clears write a `world.conquest` ledger. When the keep falls, judge it once: **rebuild as an outpost** (+2 to every finite building limit), **dismantle for materials** (salvage granted through the Phase 1 storage gate, overflow waiting in the ledgers), or raise a **frontier settlement** (gathering and hearth auras on the same aura table). Every effect is data; four more tribes are content additions on this pipeline, not new systems. Saves gain only additive fields — old worlds wake unscouted with an empty ledger.

Review: `npm test` 659 green (10 new conquest checks: exclusion footprint and buffer math, outward-mustering, tribe/mission data shape, leader lookup without rotation bleed, the muster law, first-clear ledgers, war-chest payment and refusal, gated annex with storage overflow, outpost limits and settlement auras, old-save defaults), `npm run build` 378 precached, browser smoke green (Edge as Chromium) with no console errors.

### Phase 1A: Whisperwood and Blackwater

Two new collector lines reuse the existing building, workplace and quest systems. **Whisper Grove** is size 2, produces 1.8 wood/s, has a 400-unit living node, and requires village level 6 plus a tier-2 Moonberry Grove. Tomm's **Whisper Cuts** quest asks for one grove and unlocks the **Heartwarden**, **Heartwood Axe** and **Whisper Coat**. **Blackwater Weir** is size 1, produces 2.2 food/s, has a 350-unit living node, and requires village level 6 plus a tier-2 pond. The Mooncleric's **White Thread** quest asks for one weir and unlocks the **Mudlark**, **Blackwater Net** and **Mire Coat**. Both collectors carry 14 before gear, use the existing gatherer kit, and work only their matching workplace.

Both quests pay **0 XP**; the existing quest total stays **2,640 XP**. Unspecified balance values mirror the Frostwood/Woodward and Deephole/Diver lines. Each workplace has two original sprite tiers and tier-growing low-poly structures. Two additional region-gated frontier events use existing resource choices and rewards. Map dimensions, claim prices, existing missions and boss IDs are unchanged. Act X chapters 18-21 and the final boss are deferred pending the Grey Dawn handoff.

**Quiet settling:** only central stock above capacity drains by `over * 0.01 * dt + 0.02 * dt`, clamped at the cap. Coefficients live in `world.storageSettling`; the dashboard includes the live rate in its existing **used** total. No notifications, sounds or popups are emitted. Paused/hidden play does not drain; pending rewards, carried loads and building reserves do not settle.

For content captures and a live browser soak after building, set `CHROME_BIN` to Chromium/Edge, `FRONTIER_CAPTURE=1`, and optionally `SOAK_SECONDS` (default 60), then run `npm run capture`. The isolated browser profile contains both workplace tiers and equipped crews, writes `artifacts/look-frontier-{desktop,phone}.png`, and checks live `frameReport()` face counts below 30,000 and the effect pool at or below 60. The Node regression suite also runs a one-hour simulated frontier-economy soak. This is headless regression evidence, not a physical-device 60fps certification.


### Grey Dawn Task E: daily supply and existing sinks

Well Supplied extends `src/systems/food.js` and the town meal's 180-second active-play day. Its data lives under `world.townMeal.supply`: finished manor tiers and completed Project tiers choose the daily basket, with population additions. Food, wood and flour lead the basket; developed towns also spend bread, gold, lumber, plate and eventually frostwood. A full basket is drawn exactly once per day. Shortfalls draw nothing, pause only the bonus, and announce only a covered-to-uncovered transition. Coverage returns at the next successful daily check. Fresh worlds and older saves start uncovered with a quiet grace day; campaign maps never pay home supply.

Covered supply adds modest construction/recovery auras, passive production efficiency, job training, child growth and faster paid emergency repairs. The Build strip shows Well Supplied beside Well Fed; Resources reports its basket and next check, plus territory upkeep. The economy ledger includes both daily draws and the covered production bonus. Save fields `world.wellSupplied`, `world.lastSupplyDay` and `world.conquest.supplied` are additive and default safely on local load and import.

Existing sinks now accept the audited surplus: Renown adds wood/flour; Harvest and Founder's festivals add flour (and Founder's wood); Repair Wagons cost more wood; Grand Market Square stages also use wood through the normal cost curve. Provender Run spends less scarce bread and adds flour. A rotating, capped Road Crews order exchanges bulk wood/flour for a modest gold return using the existing trader room checks and pricing. Annexed outposts and frontier settlements pay separate daily baskets; a short basket pauses regional auras while territory, building limits and conquest progress remain intact. No new currency, building system or automation was added. Auto Upgrade People remains planned and must use normal prices and protected reserves when implemented.

### Grey Dawn Tasks F–G: balance review and clutter validation

Task F strengthened the sinks against the Task A audit: upper-tier cost curves steepen (tier-3 at 8–10× base, tier-4 defenses at 20–24×, Town Projects at 8×), tier 1 stays at base and tier 2 at double, and the first Renown basket now asks the whole developed basket (gold, food, wood, flour, lumber, bread, plate, frostwood) climbing 35% per level. Late Gristmill limits grow to four at level 9 and five at level 10 so paid flour processing can cover the supply basket. Targets live in `docs/BALANCE_ECONOMY_TARGETS.md`; six pinned price tests were updated to the new values.

Task G validated the collection UX: routine housing/crew readouts collapse below 1.2× zoom and during danger, collection markers avoid selection and name-pill obstacles, batch collection caps feedback at the 60-effect pool with one sound, and portrait/landscape/desktop mock-Canvas checks hold peak static faces at 7,773 (guard 30,000). Review: `npm test` 705 green, `npm run build` precached, browser smoke unverified (no Chromium in this environment).

### Grey Dawn H1

Three data-only bulk commissions join the existing Grey Market rotation, each capped at one run per day: **Armory Contract** (level 8) exchanges 2,500 plate + 500 gold for 900 gold (400 net); **Harvest Shipment** (level 7) exchanges 18,000 food + 1,000 bread for 1,600 gold; **Frostwood Commission** (level 9) exchanges 1,800 frostwood + 3,000 plate for 1,800 gold. All use modest, lossy gold payouts and the existing exact-payment and storage-room checks. Armory pays gold rather than training progress; no payout keys or runtime code were added.

### Grey Dawn H2

Two size-2 Town Projects reuse the Phase 4 pipeline, each limited to one per village with three distinct original sprites and stage prices at 1×, 2× and 8× base. **Stone Road Network** opens at level 6 (stage 3 at 9): trail → dirt road → reinforced road, spending wood, lumber and gold, with 120 plate added only at stage 3; each finished tier adds +1 carry and +2% trade. **City Wall Project** opens at level 7 (stage 3 at 10), spending lumber, plate and gold for +2% armor and +0.1/s healing per finished tier. Ruins and unfinished stages grant no aura. No new systems, aura keys or save fields were added. H3 remains outside this task.

### Grey Dawn H3

Two size-2 Town Projects extend the Phase 4/H2 pipeline, each limited to one per village with three distinct original 32x32 sprites and stage prices at 1x, 2x and 8x base. **Royal Forge Quarter** opens at level 7 (stage 3 at 10): open smithy yard, covered workshop, then a twin-chimney quarter. It spends lumber, plate and gold, with an extra 240 plate at stage 3; each finished tier grants +2% damage and +1% construction discount. **Lantern Rows** opens at level 6 (stage 3 at 9): posts, torch rows, then paved rows with cold lanterns. It spends wood and gold, adding 80 frostwood at stage 3; each finished tier grants +0.05 survey and +2% village XP. Ruins and unfinished stages grant no aura. No new systems, aura keys or save fields were added. H4 remains outside this task.

### Grey Dawn H4

People now has an **Auto-train: on/off** toggle, saved as additive `world.autoTrain` and defaulting off for fresh and older saves. Every five seconds of active home-village time, it silently attempts one level per eligible troop in roster order through the existing `Game.level()` payment path. Manual prices, the level curve and positional tutoring apply exactly; there is no automation discount. Unaffordable troops are skipped while later troops can still train. Only central stores pay; pending rewards, collector cargo and on-site reserves remain untouched. Pauses, hidden tabs and campaign expeditions do not advance the training interval.

### Grey Dawn H5

Thornband conquest follows the Ironshield pipeline in Whisperwood: **Cut the Snare Lines** (18, requires Ironshield Keep), **Burn the Briar Camp** (19), then **The Briar Hold** (20). Scouting and the assault use village level 10, Renown 3, tier-3 barracks and 10 living fighters. The hold pays its campaign war chest only on departure; Briar-Captain Vex uses the existing slam, raider summon and enrage machinery. First-clear rewards escalate to 3,500 gold, 2,000 lumber, 500 plate and 300 frostwood. Each captured tribe receives its own one-time outpost, dismantle or settlement judgement through existing storage, building-limit and aura systems.

Ironshield retains its original top-level `world.conquest` fields and default calls. Thornband progress lives additively under `world.conquest.tribes.thornband`, created only when written; absent progress reads unscouted with an empty ledger. Daily upkeep charges each annexed territory separately, pauses only that territory's auras on shortfall, and retains its building room. Local loads and imports default missing per-tribe supply coverage off. No save version or combat mechanics changed.

Chapter plan: H5 uses 18-20; H6 is reserved for 21-23, H7 for 24-26, H8 for 27-29. The story finale (H9-H12) moves to 30-33 plus the final boss. Chapters are display labels; mission `requires` chains gate progress. H6 and the finale are not implemented by H5.

Verification: `npm test` passed all 740 checks, including 12 H5 checks and the unchanged Phase 8 Ironshield checks. Browser interaction smoke was not run.

### Grey Dawn H6

Cinder Clan conquest follows the H5 per-tribe ledger in the hills of Ashfall March: **Break the Slag Lines** (21, requires Thornband Hold), **Quench the Forge** (22), then **The Cinder Citadel** (23). Scouting and the assault require village level 10, Renown 4, a tier-3 barracks and 12 living fighters. The citadel charges its campaign war chest only on departure. Furnace-Captain Sorr uses the existing slam, breaker summon and enrage machinery and stays outside the home crown rotation. First-clear rewards escalate to 4,500 gold, 2,500 lumber, 650 plate and 400 frostwood.

Cinder progress lives under `world.conquest.tribes.cinder`, created only when written. Its one-time outpost, dismantle or settlement judgement reuses storage overflow, building limits, existing aura keys and separate daily territory upkeep. Ironshield and Thornband retain their earlier behavior. No runtime code, mechanics, currencies or save version changed. H6 ends at chapter 23; H7 is not implemented.

Verification: `npm test` passed all 754 checks, including 14 H6 checks covering the chain, muster, ledgers, rewards, paid departure, boss mechanics and home rotation, annex choices, upkeep, saves, Adventure controls and unchanged earlier-tribe outcomes. `npm run build` passed with 400 precached files. On Windows, both commands used `npm.cmd` because PowerShell blocks `npm.ps1`. Browser interaction smoke was not run.

### Grey Dawn H7

Pale Host conquest follows the H5/H6 per-tribe ledger along the Pale Coast: **Turn the Tide Lines** (24, requires Cinder Citadel), **Scatter the Mist** (25), then **The Pale Court** (26). All three expedition maps use the water biome. Scouting and the assault require village level 11, Renown 5, a tier-3 barracks and 12 living fighters. The court charges its campaign war chest only on successful departure; first-clear rewards rise to 5,500 gold, 3,000 lumber, 800 plate and 500 frostwood.

The Grey Herald uses existing ranged arrow attacks, bowman summons and enrage, with 2,100 base HP and 76 base damage, and stays outside the home crown rotation. A regression test exposed that combat ignored a boss's stored range. A small generic `combatRole` opt-in now lets this leader reuse the bowman combat role and its declared range; earlier leaders keep their original combat behavior. No new attack mechanic was added.

Pale Host progress lives under `world.conquest.tribes.palehost`, created only when written. Its one-time outpost, dismantle or settlement judgement reuses storage overflow, building limits, existing aura keys and separate daily territory upkeep, with values matching Cinder. No currencies or save version changed. H7 ends at chapter 26 with 27 missions; H8 remains unstarted.

Verification: `npm test` passed all 770 checks, including 16 H7 checks for content, muster, ledgers, paid departure, ranged combat, leader mechanics, home rotation, annex choices, independent upkeep, saves and Adventure controls. Fingerprints from `git show e0e2764` prove earlier conquest and mission entries unchanged; legacy comparisons cover all three earlier tribes. `npm run build` passed. Both commands used `npm.cmd` on Windows. Browser interaction smoke was not run.
