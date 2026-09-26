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

- **Build:** open Build, select a card, tap a tile to preview, then press Build to confirm the resource spend. Cancel leaves placement mode. Walls stay in placement mode for repeated confirmed placement. Select any building to upgrade, move, or repair it. No relocation during raids.
- **Controls:** one finger/mouse drag pans; two-finger pinch or wheel zooms around the gesture. Tap rendered buildings to select them. Use the bottom troop rail to select a fighter, then tap open ground to move or an enemy to attack. The camera buttons zoom/recenter. On a keyboard, arrows + Enter choose a tile, WASD pan, +/- zoom, 0 recenters, H holds the selected troop, and Escape dismisses the top menu/selection.
- **People:** twenty-two frontier professions (pikewomen and apprentices among them, plus fishers, shepherds, butchers, scholars, wayfinders, moonclerics, smiths, masons and lumberjacks). Assign each to its matching workplace from the People panel. Surplus food plus free cottage beds grows new villagers over time; hunger or crowding pauses it.
- **Economy:** farms, timber yards, mines, ponds, pastures and smokehouses produce each second from living nodes that visibly drain and refill. Collectors walk to matching buildings (fishermen need ponds, shepherds need pastures) and deliver to the manor. Assigned specialists work 25% faster; keepers at workplaces grant auras (sharper weapons, ward-plate, faster gathering, mending, XP, surveys).
- **Defense:** Test your defenses spawns an increasingly large raid from the west. Warriors/archers auto-engage, towers fire, and reusable traps trigger on cooldown. Walls block routes. Destroyed buildings remain for repair. Defeated troops revive after a raid. If the home manor falls, the raid ends and salvaged wood allows recovery.
- **Story:** a 12-step village-path quest chain (quests.json) teaches build order, tier upgrades and the housing track, and pays XP that levels the village; each level can open new buildable map rows. Plus eight campaign chapters (Acts III–V) with fresh starting layouts, time limits, recruitment caps and scheduled raids — chapters 07–08 branch off the same prerequisite and re-converge. Meet collection targets, defeat scheduled waves, and keep the manor alive. Return home explicitly to claim a chapter's one-time reward and unlocks. Replays cannot farm first-clear rewards; abandoning never changes the home village.
- **Saving:** local to this browser and origin; private browsing/clearing browser data can remove saves. A storage failure is shown in the status strip. Use the same browser/device to resume.

## Mobile game interface

### Workplace management and architecture preview

Select a workplace on the map and tap **Workers** to view its crew, assign an available matching profession, transfer someone from another workplace, or release a worker. **Hire** in this panel recruits directly into that building. Hiring from People automatically chooses the nearest finished, living matching workplace with a vacancy. If none is open, the recruit remains unassigned. A full or unavailable explicitly targeted workplace rejects the hire before charging resources. Existing barracks, unlock, and troop-limit requirements still apply. Assigned noncombat specialists walk to their workplace; collectors retain their gather/deliver cycle and explicit player orders take priority.

The architecture pass uses original Canvas geometry in `src/building-art.js`: connected timber/stone/fortified walls, raised foundations, dimensional manor/cottage/barracks roofs, crop beds, and crenellated towers. Each tier adds structural detail. Other buildings and inventory cards retain their pixel sprites. No save migration is required. `scripts/architecture-preview.mjs` optionally creates a review sheet using an externally installed `@napi-rs/canvas`; it adds no runtime dependency.

The map fills the viewport (including iPhone safe-area handling); the document never scrolls. Build, Army & people, and Adventure are overlay drawers. On phones they are bottom sheets; in landscape/desktop they use a side drawer. A quick fighter rail supports direct orders. Quest and raid status stay visible on the map. Menus have keyboard focus containment and labeled controls. The welcome and settings screens pause simulation; Build/Army/Adventure remain live during raids.

Production buildings keep generating automatically. They also accumulate a **capped, manually collected bonus**: tap a gold `+N` bubble or the selected building's Collect button. Configure `harvest.bonusRate` and `harvest.capacity` in buildings.json. This bonus accrues only during active simulation, cannot be double-claimed, and counts toward collection objectives.

Use **Safari → Share → Add to Home Screen** on iPhone for standalone play. The relative-path web manifest and local app icons support a home-screen shortcut. This does not promise offline operation or cross-device saves. Full Screen in Settings uses the browser Fullscreen API where supported.

### Visual direction and references

User-provided Clash of Clans village and battle screenshots informed edge-anchored resource HUDs, a dominant map, thumb-sized bottom actions, troop cards, and contextual controls. Online references reviewed:

- Clash of Clans village layout: https://gametaffy.com/blog/best-for-you/the-art-of-war-forming-alliances-in-clash-of-clans
- Kingdoms and Castles settlement readability: https://www.gamestar.de/galerien/kingdoms_and_castles,132271.html
- Stardew Valley farm paths and crop grouping: https://www.breakflip.com/guides/6590.html

These are design references only. No screenshots or commercial game assets are bundled; the repository's original pixel sprite set is retained. The brighter grass, dark framed HUD, camera scale and high-contrast selection treatment make it readable on a small phone.

### Verification

`npm test` includes 123 simulation/rendering regression checks. `npm run test:browser` requires a locally installed Chrome (`CHROME_BIN` may override its path). CI runs real pointer/touch input checks for placement preview/confirm, menus, equipment/training, missions, raids, save/reload, one-finger pan, pinch zoom, and no document overflow at portrait/landscape sizes. Screenshots are attached to the Actions run. A browser test failure blocks deployment.

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
