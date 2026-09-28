## 3D orbit camera

The village is rendered as original low-poly geometry with an orthographic orbit camera. Open the ↻ camera panel to turn through 360°, adjust the viewing height, or choose Low, Village, and Overhead views. Enable Orbit to rotate with one finger; turn it off to pan. Two fingers pan, pinch to zoom, and twist to rotate. On desktop, right-drag or Shift-drag rotates, Q/E turn, R/F tilt, and 0 restores the village view. Build placement automatically returns to pan mode. This is an orbit camera, not first-person movement.

Buildings, walls, villagers, raiders, trees, and placement previews share the same 3D projection and visible-face selection. Existing saves and game rules are preserved. Resource chimes play on manual collection or once when a producer reaches capacity.

# Midnights Manner

▶ **Play it here:** https://lifetimeballer1.github.io/midnights-manner/

A browser-based village builder with an isometric HTML5 Canvas map, farming economy, equippable pixel-art tools, tactical defenses, and a data-driven frontier campaign. Vanilla JavaScript modules; no runtime dependencies, backend, API keys, or build framework.

**Status:** mobile-first playable prototype. The systems below are implemented; Long-term balancing, richer combat AI, final art, multiplayer, and cloud saves are future work. Synthesized sound effects, responsive full-screen controls and six campaign chapters are implemented. Progress is saved locally in the browser every five seconds and on page exit. Hidden tabs pause simulation; there is no offline production. Campaign expeditions use separate maps and preserve the home village.

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

Night lighting follows the actual window panes, forge openings and watchfire flames. Windows cast tapered ground spill; fires cast a soft radial pool. Ground light is projected with the orbit camera and drawn beneath the meshes, while nearby faces of the source building receive a cached warm wash. Practical settlement lighting now extends to paired gate torches, spaced wall torches, farm/pasture lantern posts, mine entrances, towers, docks, groves, lumber yards, sawmills, markets and the Dawn Gate. Long wall runs deliberately light only about every third segment to keep the fortified-town rhythm without flooding the scene with light sources. Construction previews and ruins emit no ground light. This lightweight effect does not simulate cast shadows between buildings.

The orbit renderer in `src/scene3d.js` adds roof ridges, corner framing, entrance steps, chimney caps, banners, planters, anvils, shield racks, drying hides, and book stands. Production buildings pile their resource at the corner as the on-site reserve fills (four steps) and fly a gold pennant once the haul is ready to collect — the 3D mirror of the bubble badge; the static mesh cache keys on those steps, so a ticking reserve never rebuilds the village. Sawmills and gristmills have their own machinery; construction and ruins show scaffolds and rubble. `src/character-art.js` supplies profession outfits, headgear, distinct held tools/weapons, quivers, shields and armor, with rarity colors on metal equipment. Small trim drops out at far zoom, and offscreen character meshes are skipped. These are visual changes; saves and game rules are unchanged. To review the actual meshes from front and reverse camera angles, run `CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas/index.js node scripts/detail-preview.mjs` (structures and people), `node scripts/housing-preview.mjs` (cottage tiers and the longhouse at day and night light), or `node scripts/production-preview.mjs` (producer stockpiles by resource and step) with that optional package available. Sheets are written under `artifacts/`.

Defense meshes follow connected wall runs: exposed ends get caps that meet the wall body while straight-through arms stay open. Gates orient their portcullis to the joined wall axis, with connector arms ending at the frame so the raised passage stays clear. The gate rises at peace and lowers in four renderer-only stages when raiders press within 1.4 tiles; reduced-motion mode snaps to the current state. Traps show raised teeth while armed and retracted teeth during cooldown. These states derive from existing world data, add no saved fields, and do not change combat rules. `node scripts/defenses-preview.mjs` reviews connected walls, gate travel, and armed/sprung traps with the optional canvas package; its sheet is written to `artifacts/defenses-preview.png`.

Held tools and weapons use distinct low-poly silhouettes at the normal 1.65× gameplay zoom: the bow, longbow, pike, halberd, battle axe, felling axe, cleaver, heavy hammers, trade tools, kits and instruments no longer collapse into the same mesh. Both bow families retain visible strings below the detail-trim threshold. Tier/material variants retain the shape of their archetype. Profession coats and headwear remain distinguishable across all 35 troop types without fine-detail trim; shared outfit shapes keep clearly separated coat colors. Forager/Archer and Warden/Warrior have different headwear, while Haggler/Builder have different workwear. Review the 31 held-tool archetypes and all 35 profession defaults from front/reverse gameplay-scale angles with `node scripts/equipment-preview.mjs` (optional external `@napi-rs/canvas`); sheets are written to `artifacts/equipment-{front,reverse}.png`.

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

`npm test` includes 491 simulation/rendering/input/update regression checks. `npm run test:browser` requires a locally installed Chromium (`CHROME_BIN` may point at Chrome or Edge). CI runs real pointer/touch input checks for placement preview/confirm, menus, equipment/training, missions, raids, save/reload, one-finger pan, pinch zoom, and no document overflow at portrait/landscape sizes. Screenshots are attached to the Actions run. A browser test failure blocks deployment.

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
