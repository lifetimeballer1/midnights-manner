# Living Kingdom Phase 10 — optimization + polish (design, 2026-10-01)

Crew: Boss Muse Spark, Grunt DeepSeek (logic sweep), Artist GPT (strings only).
Closes the Living Kingdom update: parked-item sweep + bounded-work soak proof.
Browser capture/smoke stay CI-owned (no Chrome here) like all prior phases.

## Parked ledger (all phases — this slice burns it down or re-parks with reason)
1. Storage rally preset ~balanced (Ph5): weight near-store posts by distance, bounded.
2. Region-less card hardening (Ph6): pure `eventRegionLabel(event)` + ui.js use + test.
3. First-tick storm suppression (Ph7): seed `lastStormAt=elapsed` on first tick.
4. Watchtower in walls preset (Ph5): grand-watchtower −20 + test pin.
5. Health `other` bucket + frac clamp 0..1 (Ph8); UI ignores extra key (additive shape).
6. Mirror-equality test (Ph9): roads mirror === logistics DISTRICT map.
7. Soak proof: 150-villager mature fixture, N full ticks, assert BOUNDED WORK ONLY
   (planningRuns, pathCalculations, cache sizes, jobs/carts caps) — never milliseconds.

## Text items (GPT — strings only, no logic)
8. Rally notify uses player label (`Rally preset: Stores.`); keep ids in code.
9. Mud hint names trails (`…roads run clean, trails half it`).
10. Readout stays bucket-counts labeled Districts (accepted v1; cell-derived = future).

## Reuse (read-once)
- defense-posts.js RALLY_WEIGHTS/autoFill; steward-budget floor pattern NOT needed here
  (storage preset is post choice, not reserves).
- daynight.js tickStorm + game.js first-tick branch; dashboard.js health shape;
  logistics.js:85 map vs roads.js:32 mirror; ui.js:344 card region line.
- Existing 150-idle-hands bound test (logistics.test.js) as soak pattern.

## Rule
- One batched logic dispatch (A): items 1–6 + soak test 7. Small same-shape fixes,
  one test file, one commit. Behavior changes stay capped/bounded/tested.
- Strings dispatch (B): items 8–10 (notify label, hint, readout decision = keep).
- Item dropped: watchtower omission needs no other change; unknown-kind `other`
  ignored by UI (documented).

## Gates
`npm test && npm run build` green · old saves load · VERSION 15 · caps held · one
commit per packet · fetch + rebase, never force-push.
