# SOL TASK H4 — Auto-Upgrade People (scoped system task)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `src/game.js` (new toggle + tick hook reusing `level()`), `src/ui.js` (People panel toggle), `src/storage.js` ONLY if a save default is needed (additive, default off)
- `tests/` new `tests/task-h4-autotrain.test.js`
- README: append a short `### Grey Dawn H4` section

## Existing path (reuse exactly — no parallel cost formula)
Manual training is `Game.level(id)` in `src/game.js:328`: cost = `levelCost × level × (level>=5 ? 1.5 : 1) × (1 - tutorDiscount)`, paid all-or-nothing via `pay()`. The People panel `Train ↑` button calls it.

## Design (Muse-locked)
- New `world.autoTrain` boolean, default `false`, persisted additively (old saves read off, never auto-enabled).
- People panel gets an `Auto-train: on/off` toggle beside the idle-bar (`idle-bar` in `src/ui.js`). 44px touch target, existing styles.
- When on, during active village sim time only (not paused, not in a campaign expedition — same gating as the town-meal tick), every 5 seconds of active time run one pass in roster order: for each troop below max level, attempt the EXACT `Game.level()` call (same formula, same `pay()`, tutor discount applies exactly as manual — it is positional, not an automation discount).
- No automation discount anywhere. One level per troop per pass. Skip max-level troops silently.
- Notifications: suppress the per-level manual chime/notify during auto passes (no spam); a single quiet line only when a pass trains nothing newly affordable is unnecessary — stay silent except keep the existing full-storage/level behavior untouched.
- Protected reserves: auto-train spends central stores only via `pay()`; it must never touch `pendingRewards`, carried collector loads, or on-site `harvestBonus` (it cannot — assert this in tests).
- Refusal semantics: a troop that cannot be afforded is skipped; the pass continues to cheaper later troops (keeps the sink smooth without starving the town).

## Rules
- Do not change the manual cost formula, curve, tutor discount, or `pay()`.
- Additive save field only. No new currency, no new resources.
- After edits run `npm test` and `npm run build`. Report pass/fail plus files changed. Do not start H5.
