# SOL TASK PAT1 — Plan §16: tribe-locked territory + patrol pressure

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Goal (plan §16, the last open system)
Enemy tribes become territorial powers: their core region cannot be claimed while
they stand, and they keep sending patrols. Rule: **if a tribe controls the land,
defeat the tribe before the land joins the Manner.** Grandfather everything
already claimed (plan §2 over-cap doctrine applied to land: never take earned ground).

## Scope
- `data/expansion.json` (additive `tribe` gate per tribe-core region — see mapping)
- `src/systems/expansion.js` and/or `src/game.js` claim path (MINIMAL gate check)
- Patrol pressure: smallest hook in the existing raid director
  (`src/systems/raid-director.js` — read it first) reusing existing faction/role
  machinery. NO new combat mechanics, roles, or factions.
- `tests/task-pat1-territory.test.js` (new, H-style)
- README: append `### Grey Dawn PAT1`
- No save version bump (additive reads only; claim state already stored).

## Design (Muse-locked)
### Region mapping (verify against data, report any correction)
- `whisperwood` → `thornband`, `ashfall-march` → `cinder`,
  `pale-coast` → `palehost`, `starwatch-ridge` → `ember`.
- Ironshield: investigate — if no expansion region matches its valley, Ironshield
  keeps current behavior (no gate) and you state that in README + report.
- Gate shape: `"tribe": "<id>"` on the region. Claim requires that tribe's
  `assaultWon` (read via existing `conquestState(world, tribe)` — same ledger
  H5–H8 built). Refusal speaks plain words naming the undefeated tribe
  (follow `assaultReason`/`readinessReason` voice in `src/systems/conquest.js`).
- Grandfather: regions claimed before this task stay claimed and usable even if
  their tribe stands (gate applies to NEW claims only — assert this in tests).

### Patrols (minimal viable pressure)
- While a tribe stands (not `assaultWon`), its region may send a patrol: a small
  raid (2–4 enemies) using that tribe's existing pressure role —
  thornband raider, cinder breaker, palehost bowman, ember breaker (the same roles
  their leaders summon; H5–H8 established these).
- Cadence: reuse the raid director's existing scheduling (read it first) —
  patrols ride its clock, never a new timer system; at most one patrol pending;
  patrols NEVER spawn inside the spawn-exclusion footprint (reuse `spawnExclusion`).
- After `assaultWon`: no more patrols from that region, forever (assert).
- No patrol UI beyond existing raid warnings/toasts (no new HUD).

## Tests (`tests/task-pat1-territory.test.js`, ~7 checks)
- Each mapped region refuses new claims while its tribe stands (all four), with
  the tribe named in the refusal; claim succeeds after `recordAssault(world, tribe)`.
- Grandfather: pre-claimed region remains usable with tribe standing.
- Unrelated regions (no `tribe` key) claim exactly as before (legacy comparison).
- Patrols: with tribe standing, director can produce that tribe's role patrol;
  composition matches the mapping; spawn respects the exclusion footprint;
  after `recordAssault`, no patrols ever for that tribe.
- Fingerprints: `data/missions.json` + `data/conquest.json` leaders/tribes
  unchanged (hash pins); muster laws, assaults, annex, upkeep byte-identical
  (reuse the H-legacy approach for at least one tribe end-to-end).
- Save round-trip with a locked region + refused claim: no new save fields
  (assert `VERSION` unchanged and old-save import clean).

## Rules
- No new mechanics beyond the claim gate + director patrol hook; no new combat
  roles, factions, currencies, aura keys, or save version bump.
- After edits run `npm test` and `npm run build` (Windows: `npm.cmd`).
  Report pass/fail, the ironshield mapping verdict, files changed.
  Do not start anything else.
