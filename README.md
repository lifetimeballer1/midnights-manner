# Midnights Manner

▶ **Play it here:** https://lifetimeballer1.github.io/midnights-manner/

A browser-based village builder with an isometric HTML5 Canvas map, farming economy, equippable pixel-art tools, tactical defenses, and a data-driven frontier campaign. Vanilla JavaScript modules; no runtime dependencies, backend, API keys, or build framework.

**Status:** first playable prototype. The systems below are implemented; balancing, deeper combat AI, final art, audio, multiplayer, and cloud saves are future work. Progress is saved locally in the browser every five seconds and on page exit. Hidden tabs pause simulation; there is no offline production. Campaign expeditions use separate maps and preserve the home village.

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

- **Build:** select a card, then tap/click an empty grid tile. Escape or Cancel leaves placement mode. Walls can be placed repeatedly. Select any building to upgrade, move, or repair it. No relocation during raids.
- **Keyboard:** focus the map, use arrow keys to choose a tile, Enter to place/select, Escape to cancel.
- **People:** recruit at a finished barracks, train to level 25, buy/equip visible tools, and cast unlocked active abilities. Equipment is individually owned; switching owned gear is free.
- **Economy:** farms, timber yards and mines produce each second. Farmers and miners walk to a matching building, fill their carried load and deliver it to the manor for bonus production. Builders' gear speeds all construction and discounts costs; discounts cap at 50%.
- **Defense:** Test your defenses spawns an increasingly large raid from the west. Warriors/archers auto-engage, towers fire, and reusable traps trigger on cooldown. Walls block routes. Destroyed buildings remain for repair. Defeated troops revive after a raid. If the home manor falls, the raid ends and salvaged wood allows recovery.
- **Story:** three linear chapters with fresh starting layouts, time limits, recruitment caps and scheduled raids. Meet collection targets, defeat scheduled waves, and keep the manor alive. Return home explicitly to claim a chapter's one-time reward and unlocks. Replays cannot farm first-clear rewards; abandoning never changes the home village.
- **Saving:** local to this browser and origin; private browsing/clearing browser data can remove saves. A storage failure is shown in the status strip. Use the same browser/device to resume.

## Repository structure

```text
src/
  main.js              JSON/assets loading, fixed-step loop, input
  game.js              commands and simulation orchestration
  model.js             unit/building factories, curves, costs, placement
  renderer.js          isometric Canvas map, sprites, equipment animation
  ui.js                build/people/story panels and selection inspector
  storage.js           versioned local save/load
  styles.css           responsive interface
  systems/
    economy.js         production, collectors, builder effects
    pathfinding.js     grid routing and collision
    combat.js          raids, damage, towers, traps, ability handlers
    campaign.js        mission lifecycle, constraints, rewards
assets/sprites/        40 original 32×32 transparent PNG placeholders
assets/favicon.svg
data/                  editable game configuration JSON
scripts/
  build.mjs            creates deployable dist/ from public files only
  generate_sprites.py  optional Pillow-based sprite source
tests/                 Node simulation/data regression tests
.github/workflows/pages.yml
```

## Data-driven extension guide

### Add a troop

Add a unique key in `data/troops.json`. Supply `name`, `role` (`combat`, `collector`, or `builder`), `sprite`, `maxLevel`, `base` stats, `growth`, costs, `defaultGear`, `carry`, `gatherResource`, and a level-to-ability map. The stat curve is `base × (1 + growth × (level − 1))`, followed by equipment and passive modifiers. Add new thresholds at levels 30/35/etc and raise `maxLevel` to extend progression. Add the sprite to `assets/sprites/` and compatible items to `items.json`. The People panel discovers entries automatically. Add the troop ID to a starting roster or recruit it at a barracks.

Abilities at levels 5, 10, 15, 20 and 25 reference entries in `data/abilities.json`. Existing effects are `splash`, `armor`, `heal`, `damage`, and `gather`. Active healing uses radius, value and cooldown data. Adding another ability using an existing effect only needs JSON. A genuinely new behavior requires a generic effect handler in the appropriate system; do not add troop-specific conditionals.

### Add equipment

Add an item in `data/items.json` with a distinct `sprite`, `roles` listing compatible troop IDs, purchase `cost`, `stats`, and `animation`. Supported stats: `damage` multiplier, `range`, `gather` multiplier, `carry`, `buildSpeed`, `costReduction`. Supported attack animations include `slash`, `sweep`, `slam`, and `arrow`; tool animation labels can be extended in the renderer. Every equipped item is drawn on the character and appears as an individual sprite in the inventory. The sword, axe and warhammer have different silhouettes, reach and swing behavior. Gear is not a hidden menu-only multiplier.

### Add a building

Add an entry in `data/buildings.json`: `name`, tile `size`, `cost`, `buildSeconds`, optional resource `production`, base `rate`, and a `tiers` array. Every tier needs its own `sprite`, `hp`, `rateMultiplier`, `damage`, and `range`. Nonzero damage enables a stationary defense. Provide a distinct sprite for every tier; do not simply recolor it. Tier count is read from data. The Build panel automatically includes every entry except the unique manor. Traps are passable; other buildings obstruct movement. Special mechanics beyond production, ordinary defenses and traps need a system extension.

### Add a mission

Append to `data/missions.json` with a unique `id`, `name`, `chapter`, `description`, `timeLimit`, `troopLimit`, `startingResources`, `objectives` (`resource`, `amount`), `map.buildings`, `map.troops`, `raids` (`at`, `count`), `rewards`, `unlocks`, and `requires` (prior mission IDs). Multiple missions can share the same prerequisite for branching. Objectives track production/deliveries since mission start, excluding starting stock and combat loot. All scheduled waves must spawn and be defeated before victory. All resource objectives must be met before the timer expires, and the manor must survive. Rewards are applied to the saved home world only when returning from a first victory.

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

Read this README before editing. Keep game data separate from logic. Maintain honest status, preserve the original brief below, run tests/build before pushing, and never put secrets in this static client. Do not replace the structured repo with a single mega-file. Next useful work: stronger save-schema migration, larger-world camera controls, richer routing/target priorities, troop commands, audio, more missions and art polish.

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
