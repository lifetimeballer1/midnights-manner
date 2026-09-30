# SOL TASK H3 — Infrastructure Projects Batch 2: Forge + Lantern Rows (scoped)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/buildings.json` (two new entries), `assets/sprites/` (new PNGs)
- `tests/phase4-projects.test.js` (extend H2 style) or `tests/task-h3-infra2.test.js`
- README: append a short `### Grey Dawn H3` section

## Precedent
H2 (`stone-road`, `city-wall`) and Phase 4 (`market-square`, `grand-granary`, `manor-gardens`, `monument`): `project: true`, `maxPerVillage: 1`, `costCurve: [1, 2, 8]`, `tierGates` for stage 3, `flatAuras` with existing aura keys only, 3 tiers with distinct 32×32 PNG sprites. No new systems, aura keys, or save fields.

## Add two projects
1. **Royal Forge Quarter** (`forge-quarter`): size 2, minLevel 7, stage 3 gated at 10. Smithy-yard fiction. Costs lumber + plate + gold (plate-heavy at stage 3 via `tierCosts`). Aura: small `damage` + `discount` (existing keys), per finished tier.
2. **Lantern Rows** (`lantern-rows`): size 2, minLevel 6, stage 3 gated at 9. Settlement lighting fiction (torch/lantern stages: posts → rows → lit rows). Costs wood + gold, stage 3 adds small frostwood (cold lamps). Aura: small `survey` + `xp` (watchful lit streets fiction), per finished tier.

Stage-1 baskets comparable to H2/existing projects. Friendly opening intact.

## Rules
- Existing aura keys only. Distinct sprite PNG per tier.
- After edits run `npm test` and `npm run build`. Report pass/fail plus files changed. Do not start H4.
