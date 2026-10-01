# Living Kingdom Phase 5 — defense intelligence (design, 2026-10-01)

Crew: Boss Muse Spark, Grunt DeepSeek (code), Artist GPT (UI controls only).
20Q locked: Q9 simple rally presets; Q10 enemies target weak walls/gates + valuable
structures. Civilians shelter already (emergency.js). Keep combat readable.

## Finding: posts exist, direction doesn't
`src/systems/defense-posts.js:1-101` autoFill (ranged→tower, melee→gate), breach
response, 2s target commits; manual assign UI (`src/automation-ui.js:6-18`).
`src/systems/tactics.js:48-61` `enemyBuildingTarget`: distance − wallDamage walls − gate.
Missing: (a) one-tap rally presets steering autoFill; (b) enemy weak-wall probing +
valuable-structure targeting. No Defend drawer exists — defense UI lives in the
People panel + battle HUD (`src/ui.js:240-243`).

## Reuse (read-once)
- `defense-posts.js:7-10,21-40` capacities + autoFill scoring; `:41-72` plan loop (untouched).
- `tactics.js:48-61` enemy scorer (extend discounts only, distance still dominates).
- `src/ui.js:240-243` battle HUD; `src/automation-ui.js:6-11` defenseChoice (rally home).
- World serializes wholesale — plain-string `world.defenseRally` persists free (prove by round-trip test).

## Rule
- RALLY presets: balanced (default = current behavior exactly), gates, manor, walls,
  storage, reserve. Preset steers autoFill post weights only, never overrides manual posts.
  gates→gate posts; manor→hall; walls→gates+towers perimeter; storage→posts nearest
  storehouse/grand-granary; reserve→hold 2 fastest fighters unposted at hall.
- Enemies: damaged wall discount (hp<66% −2, <33% −4) + valuable
  (grand-granary/storehouse/market/market-square −2). Small ints; distance dominates.
- `world.defenseRally` string, default balanced; old saves default balanced.

## Packets
### A — Rally presets + enemy targeting (DeepSeek, code)
`world.defenseRally` + `setRally(world,id)` validator in defense-posts.js; autoFill
weight table per preset; reserve holdback; tactics.js discounts. Tests: steering
shifts distribution; reserve holds 2; damaged wall preferred at equal distance;
valuable preferred; round-trip persistence; planningRuns bounded.
Accept: presets change nothing when manual; raids pause-safe; suite + build green.

### B — Rally control UI (GPT, controls text only)
Preset `<select>` in defense header (`src/automation-ui.js:6-11` area) + current-rally
line in battle HUD (`src/ui.js:240-243`). No sim. Accept: one control, persists,
readable at phone size; suite green.

## Gates
`npm test && npm run build` green · old saves load · VERSION 15 · caps held · one
commit per packet · fetch + rebase, never force-push.
