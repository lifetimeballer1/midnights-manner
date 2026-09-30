# SOL TASK H8 — Conquest Tribe 5: Ember Legion (Starwatch Ridge), chapters 27–29

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/conquest.json` (fifth tribe entry in `tribes[]`), `data/missions.json` (3 missions)
- `src/` unchanged expected (reuse the per-tribe ledger + combatRole opt-in; small fixes only if a test proves a gap)
- `tests/task-h8-ember.test.js` (new, H7 style) + update mission-count pins (27 → 30) and max-chapter pin (26 → 29)
- README: append `### Grey Dawn H8`

## Precedent
H5/H6/H7: per-tribe ledger, missions carry `tribe/conquest/launchCost/map.biome`, muster law, war-chest march payment, first-clear ledger, annex with supply upkeep, byte-identical/fingerprinted earlier-tribe proofs, Adventure per-tribe controls. Mirror all of it. This is the LAST tribe — after it, `data.conquest.tribes` holds Ironshield (legacy shape) + 4 additive tribes.

## Tribe 5 spec (Muse-locked) — the hardest conquest
- **Ember Legion**, Starwatch Ridge hills (`map.biome: 'hills'`, tiles hills). Elite combined-arms fiction (veterans, engines, disciplined lines).
- Muster law: `vlevel 11, renown 6, barracksTier 3, troops 14` (the highest gate).
- Missions: `ember-vanguard` ch27 requires `palehost-court` ("Break the Vanguard"); `ember-redoubt` ch28 ("Storm the Redoubt"); assault `ember-throne` ch29 ("The Ember Throne").
- Leader: **Legion-Marshal Cindral** (`ember-cindral`): slam + summon (raiders AND breakers pressure — use the existing summon machinery; if it supports one role per entry, pick breakers, the siege threat) + enrage, above the Herald (hpBase ~2400, dmgBase ~84). Must not join the home crown rotation (wave 1–100 check).
- Annex: same three shapes with supply upkeep, values at/above Pale Host.
- Assault rewards above Pale Host court (5500/3000/800/500): e.g., 6500 gold/3500 lumber/1000 plate/650 frostwood. Prelims escalate between.
- Max chapter after this task is 29 (pin it; story finale H9–H12 takes 30–33). Mission total becomes 30.

## Rules
- No new mechanics, currencies, aura keys, or save version bumps. Additive data only.
- Earlier tribes' behavior unchanged (legacy-comparison + fingerprint proofs as H7 did).
- After edits run `npm test` and `npm run build`. Report pass/fail plus files changed. Do not start H9.
