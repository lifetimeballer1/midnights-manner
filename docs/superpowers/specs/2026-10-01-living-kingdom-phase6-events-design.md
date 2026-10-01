# Living Kingdom Phase 6 — dynamic settlement events (design, 2026-10-01)

Crew: Boss Muse Spark, Grunt DeepSeek (code), Artist GPT (UI only).
20Q locked: Q11 5–8 min director w/ cooldowns, never in raids/expeditions; Q12 physical
placement + quiet badge, no popup spam.

## Finding: director exists, conditions don't
`src/systems/frontier-events.js:1-88` director: 300+180s cadence, raid/mission/horn
guards, region+level eligibility, atomic cost/reward, no-immediate-repeat. 9 events in
`data/world.json` (region-bound, level-gated). Missing vs §6: (a) village-condition
gates (beds, buildings, low stores, post-wave); (b) physical placement anchors
(merchant→market, refugees→gate, warning→tower, festival→hall); (c) per-event
cooldowns; (d) village (non-region) events. Festivals/caravans exist separately —
no new event game, extend this director.

## Reuse (read-once)
- frontier-events.js:11-28 eligibility/delay; :44-66 tick guards; :68-88 atomic resolve.
- `data/world.json` frontierEvents entries + frontierEventTiming (additive fields only).
- `src/ui.js:116` road-Focus camera pattern; `:339` frontier card (View button home).
- `housing()` beds, `storageCap`, `isRegionClaimed` for conditions.

## Rule
- New optional entry fields: `when` {building, freeBeds, resourceBelow{key,amount},
  minWave} (all must hold; absent = no gate), `place` {near: building type, label},
  `cooldown` seconds (track `world.frontierEventSeen={id:at}`).
- Region-bound entries keep their region gate AND may carry `when`/`cooldown`/`place`.
  Region-less entries (no `when` support for `survey` yet) are a follow-up, not this
  slice — all 6 shipped entries are region+`when` hybrids. Harden `ui.js` card for
  region-less before any such entry lands.
- 6 new village events: merchant (market), refugees (freeBeds≥2), wounded scout
  (wave≥3), shortage (food below 3-day meal cost), discovery (survey≥25), apprentice
  (cottage + freeBeds≥1). Existing 9 entries untouched (no `when` = always eligible as now).
- Placement = card View button centering the anchor building (no new units/meshes).

## Packets
### A — Conditions + cooldowns + events (DeepSeek, code)
`eventConditionsMet(event,state,data)`, per-id cooldown check in tick, `place`
anchor resolver (nearest living finished of type), 6 world.json entries.
Accept: gates fire/skip correctly; cooldown holds; anchor resolves live building;
atomicity unchanged; suite + build green.

### B — Placement View UI (GPT, UI only)
View button on event card (`src/ui.js:339` area) reusing road-Focus pattern + quiet
badge copy. No sim. Accept: centers anchor; badge quiet; suite green.

## Gates
`npm test && npm run build` green · old saves load (new fields optional) · VERSION 15 ·
caps held · one commit per packet · fetch + rebase, never force-push.
