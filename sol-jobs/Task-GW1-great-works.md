# SOL TASK GW1 — Phase 9: Great Works (data-only prestige sinks)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Goal (plan §4)
The largest permanent resource sinks in the game: multi-stage projects so costly
that a developed stockpile still feels valuable. Player question becomes
"which Great Work next?" — never punishment, never upkeep, no decay (plan §13).

## Scope
- `data/buildings.json` (TWO new entries, spec below — reuse the Town Projects pipeline)
- Sprites: same method H2/H3 used for distinct 32x32 PNGs (read
  `sol-jobs/Task-H2-infra1.md` + its tests first and copy the method; no new pipeline)
- `tests/task-gw1-greatworks.test.js` (new, H-style pins)
- README: append `### Grey Dawn GW1`
- `src/` unchanged expected (pure project-pipeline reuse; small fixes only if a test
  proves a gap). Do NOT touch `dawn-gate` (existing 1-tier entry stays pinned).

## Design (Muse-locked)
Great Works ARE Town Projects, bigger: `project: true`, `costCurve`, `tierGates`,
`maxPerVillage: 1`, `flatAuras` (existing keys only), per-tier sprites, ruins grant
nothing — mirror `market-square` / `forge-quarter` entries exactly. Two Works:

1. **The Manner Citadel** (`manner-citadel`): 4 stages
   Clearing → Foundations → Walls → Crowned Citadel. Gated `minLevel 10`
   (final stage `tierGates` 11). Aura: armor + healing per finished tier
   (same keys/scale family as `city-wall`: +2% armor, +0.1/s heal per tier).
2. **Grand Watchtower** (`grand-watchtower`): 3 stages
   Footings → Timber tower → Beacon tower. Gated `minLevel 9`
   (final stage `tierGates` 10). Aura: damage + survey per finished tier
   (same keys as `forge-quarter`/`lantern-rows`: +2% damage, +0.05 survey per tier).

Both OPTIONAL prestige sinks: NOT conquest prerequisites (muster laws stay pinned),
NOT Renown requirements (the `endgame.js` hook comment stays a comment).

## Sizing rules (Muse-locked — read before choosing numbers)
1. FIRST read `docs/BALANCE_ECONOMY_TARGETS.md`, the Task-A audit (handoff), and
   `data/buildings.json` `storehouse`/`grand-granary` storage caps.
2. Plan §4 scale (Citadel ≈ 150k wood/lumber, 100k gold, 60k plate, 25k frostwood
   + food/bread; Watchtower ≈ one-third of that) is the TOTAL across all stages.
3. HARD CONSTRAINT: every single stage price must be payable from central stores —
   read how project stage payment works (`pay` exactness) and keep each stage
   within the corresponding developed storage cap. If a plan-scale stage cannot fit,
   split the Work into more smaller stages (same total) rather than exceeding caps.
   Report the chosen per-stage baskets + the cap math in your final report.
4. Early stages stay approachable (stage 1 ≈ Town-Project stage-3 scale); the
   top stage is the wallet-breaker. Multi-resource baskets (plan §10 endgame curve).

## Tests (`tests/task-gw1-greatworks.test.js`, ~8 checks)
- Shape: both entries `project: true`, `maxPerVillage: 1`, exact tiers/stages,
  gates, `costCurve`, per-tier sprites resolve to real files, `flatAuras` use only
  pre-existing keys (assert against the key set `city-wall`/`forge-quarter`/
  `lantern-rows` use — no new aura keys).
- Each stage payable within caps (compute cap per resource from data; assert).
- Build → stage up → ruins/scaffold grants no aura; one-per-village enforced;
  exact staged payment; save round-trip (phase4-projects.test.js patterns).
- Fingerprints: `data/conquest.json` + `data/missions.json` untouched (hash pins);
  `dawn-gate` entry byte-identical (JSON-subset pin); no save version bump
  (import an old save in-test like H-tasks do).
- Update ONLY pins that enumerate buildings/projects (grep `project` in tests/
  first; prefer zero edits outside your new file + README).

## Rules
- No new mechanics, currencies, aura keys, save fields/version, or gating systems.
  Additive data + sprites only.
- After edits run `npm test` and `npm run build` (Windows: `npm.cmd`).
  Report pass/fail, chosen per-stage baskets + cap math, files changed.
  Do not start gap fixes.
