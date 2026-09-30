# SOL TASK H2 — Infrastructure Projects Batch 1: Roads + Walls (scoped)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/buildings.json` (two new entries), `assets/sprites/` (new PNGs), `src/building-art.js` ONLY if the Phase 4 precedent requires entries there for new project buildings
- `tests/phase4-projects.test.js` (extend in the existing style) or a new `tests/task-h2-infra.test.js`
- README: append a short `### Grey Dawn H2` section

## Precedent (follow exactly — this is the same pipeline, not a new system)
Phase 4 Town Projects: `market-square`, `grand-granary`, `manor-gardens`, `monument` in `data/buildings.json`. Copy their shape: `project: true`, `maxPerVillage: 1`, `costCurve: [1, 2, 8]`, `tierGates` for stage 3, `flatAuras` with existing aura keys only, 3 tiers with distinct sprite files. Check how Phase 4 wired sprites (real PNG files on disk — tests enforce existence and distinctness) and any `building-art.js` registration, then do the same. No new save fields, no new systems.

## Add two projects
1. **Stone Road Network** (`stone-road`): size 2, minLevel 6. Stages read as trail → dirt road → reinforced road. Stage costs primarily wood/lumber + gold, stage 3 adds plate. Aura: small `carry` + `trade` warmth (road growth fiction), existing keys only.
2. **City Wall Project** (`city-wall`): size 2, minLevel 7. Regional reinforcement program. Costs lumber + plate + gold. Aura: small `armor` + `heal` (settlement defense fiction), existing keys only.

Keep stage-1 baskets comparable to existing projects (a few thousand wood/lumber/gold, tens of plate — see market-square/granary stage 1). Friendly opening: stage 1 at base, stage 2 at double (costCurve [1,2,8] does this).

## Rules
- No new aura keys, no new mechanics, no new currencies. Data + art + tests only.
- Distinct sprite PNG per tier (no recolor reuse); generate via the repo's existing sprite approach (`scripts/generate_sprites.py` pattern or hand-made 32×32 placeholders consistent with current originals).
- After edits run `npm test` and `npm run build`. Report pass/fail plus files changed. Do not start H3.
