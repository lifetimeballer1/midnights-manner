# SOL TASK H7 — Conquest Tribe 4: Pale Host (Pale Coast), chapters 24–26

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/conquest.json` (fourth tribe entry in `tribes[]`), `data/missions.json` (3 missions)
- `src/` unchanged expected (reuse the H5/H6 per-tribe ledger; small fixes only if a test proves a gap)
- `tests/task-h7-palehost.test.js` (new, H6 style) + update mission-count pins (24 → 27) and max-chapter pin (23 → 26)
- README: append `### Grey Dawn H7`

## Precedent
H5/H6 (`tests/task-h5-thornband.test.js`, `tests/task-h6-cinder.test.js`): per-tribe ledger, missions carry `tribe/conquest/launchCost/map.biome`, muster law, war-chest march payment, first-clear ledger, annex with supply upkeep, byte-identical earlier-tribe proofs, Adventure per-tribe controls. Mirror all of it. Verify earlier data entries unchanged (git-show comparison as H6 did).

## Tribe 4 spec (Muse-locked)
- **Pale Host**, Pale Coast water (`map.biome: 'water'`, tiles water). Enemy-bowmen fiction (ranged pressure).
- Muster law: `vlevel 11, renown 5, barracksTier 3, troops 12`.
- Missions: `palehost-tide` ch24 requires `cinder-citadel` ("Turn the Tide Lines"); `palehost-mist` ch25 ("Scatter the Mist"); assault `palehost-court` ch26 ("The Pale Court").
- Leader: **The Grey Herald** (`palehost-herald`): archer boss — ranged volley + summon bowmen + enrage, above Sorr (hpBase ~2100, dmgBase ~76). Must not join the home crown rotation (wave 1–100 check).
- Annex: same three shapes with supply upkeep, values at/above Cinder.
- Assault rewards above Cinder citadel (4500/2500/650/400): e.g., 5500 gold/3000 lumber/800 plate/500 frostwood. Prelims escalate between.
- Max chapter after this task is 26 (pin it so H8 is separate). Mission total becomes 27.

## Rules
- No new mechanics, currencies, aura keys, or save version bumps. Additive data only.
- Earlier tribes' behavior unchanged (prove with legacy-comparison tests as H6 did).
- After edits run `npm test` and `npm run build`. Report pass/fail plus files changed. Do not start H8.
