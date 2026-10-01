# Living Kingdom Phase 7 — weather gameplay (design, 2026-10-01)

Crew: Boss Muse Spark, Grunt DeepSeek (code), Artist GPT (UI text only).
20Q locked: Q13 mud 10–15% off-road, roads negate; Q14 FULL set (fog ranged, storm
repairs, night lighting value). Noticeable, never punishing.

## Finding: sky exists, mud doesn't
Phase 10 sky (`src/systems/daynight.js:1-281`): deterministic phases/weather, mesh
lighting, `world.night/weather` transients, sim hooks (night +10% enemy dmg, fog −10%
enemy speed, night −5%/rain +5% gather). Missing vs §7: (a) rain/mud travel effect;
(b) fog ranged penalty; (c) storm repair jobs (no storm id — reuse rain days);
(d) night value for lit defense. `describeClock` hints render in the sky board
(`src/ui.js:456-457`).

## Reuse (read-once)
- `src/systems/pathfinding.js:105-111` move(): `friendly` flag + trailMultiplier hook.
- `src/systems/trails.js:20-21` + `src/systems/roads.js:4-6` roadAt/trailWearAt (import into pathfinding; both already its deps).
- `src/systems/combat.js:208-218` defender hits, `:245` tower mult, `:349` enemy raw.
- `src/systems/daynight.js:31-51` DEFAULTS table (new keys, old saves default) + hash().
- `src/game.js:592-603` clock tick (storm wire home).

## Rule (all data-driven under data.world.daynight, DEFAULTS fallback)
- Mud: rain + friendly + roadAt=0 → ×(1−mudOffRoad 0.12); trail (stage≥1, no road) halves
  it (×(1−0.06)). Roads full speed. Enemies untouched (fog slow already theirs).
- Fog ranged: attacker range>2 + fog → dealt ×(1−fogRanged 0.1), BOTH sides (defenders,
  towers, enemies). Fair, readable.
- Storm: qualifying rain days (hash%3==0) → at most every stormInterval 120s, one random
  finished living non-wall building takes stormDamage 6% maxHp → existing repair loop.
  Silent (markers show it). Deterministic per elapsed, no save fields.
- Night watch: posted defender (`u.defensePost`) at night → damage ×(1+nightWatch 0.05).
  Posts are lit positions (watchfires/torches in art). Status line shows it (B).

## Packets
### A — Mud + fog + night-watch + storm (DeepSeek, code)
daynight.js DEFAULTS + `mudMult(world,x,y)` + `fogRangedMult(world,rangeGT2)` +
`nightWatchMult(world,unit)` + `tickStorm(world,data)`; pathfinding move hook
(friendly only); combat hooks (3 unit sites + tower + enemy raw); game.js tick wire.
Tests: mud values (road/trail/off-road/clear/enemy-untouched), fog both sides,
watch bonus, storm damage+cap+determinism, table defaults.
Accept: noticeable ≤ caps above; suite + build green.

### B — Sky-board effect text (GPT, text only)
`describeClock` hints for mud/fog-ranged/night-watch/storm + Night-watch status in
defenseStatus. No sim. Accept: hints read in sky board; suite green.

## Gates
`npm test && npm run build` green · old saves load · VERSION 15 · caps held · one
commit per packet · fetch + rebase, never force-push.
