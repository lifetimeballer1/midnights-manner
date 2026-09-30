# SOL TASK H6 — Conquest Tribe 3: Cinder Clan (Ashfall March), chapters 21–23

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/conquest.json` (third tribe entry in `tribes[]`), `data/missions.json` (3 missions)
- `src/` ONLY if the H5 per-tribe ledger needs no changes (it should not — reuse it; small fixes allowed only if a test proves a gap)
- `tests/task-h6-cinder.test.js` (new, H5 style) + update mission-count pins (21 → 24) wherever they assert totals
- README: append `### Grey Dawn H6`

## Precedent
H5 Thornband (`tests/task-h5-thornband.test.js`): per-tribe ledger in `conquest.tribes[]`, missions carry `tribe/conquest/launchCost/map.biome`, muster law, war-chest march payment, first-clear ledger, annex with supply upkeep, byte-identical behavior for earlier tribes proven by cross-ledger tests. Mirror all of it.

## Tribe 3 spec (Muse-locked)
- **Cinder Clan**, Ashfall March hills (`map.biome: 'hills'`). Wall-breaker + forge-fire fiction.
- Muster law: `vlevel 10, renown 4, barracksTier 3, troops 12`.
- Missions: `cinder-slags` ch21 requires `thornband-hold` ("Break the Slag Lines"); `cinder-forge` ch22 ("Quench the Forge"); assault `cinder-citadel` ch23 ("The Cinder Citadel"). `conquest: preliminary/preliminary/assault`.
- Leader: **Furnace-Captain Sorr** (`cinder-sorr`): breaker boss — slam + summon breakers + enrage, above Vex (hpBase ~1900, dmgBase ~68). Must not join the home crown rotation (pin with the H5 wave 1–100 check).
- Annex: same three shapes with supply upkeep, values at/above Thornband.
- Assault rewards above Thornband hold (3500/2000/500/300): e.g., 4500 gold/2500 lumber/650 plate/400 frostwood. Prelims escalate between.
- Max chapter after this task is 23 (pin it so H7 is a separate task).

## Rules
- No new mechanics, currencies, aura keys, or save version bumps. Additive data only.
- Earlier tribes' tests must keep passing unchanged in behavior (update only count pins like 21 → 24).
- After edits run `npm test` and `npm run build`. Report pass/fail plus files changed. Do not start H7.
