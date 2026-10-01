# Ranger dispatch

Open **Adventure → Expeditions** to choose a trip for an available ranger.

| Plan | Gathering time | Materials | Intel chance | Added mishap risk |
| --- | --- | --- | --- | --- |
| Woodland ranging | Existing profession time | Existing haul | Existing chance | None |
| Supply run | 1.5× | 1.5×, rounded down | Existing chance | 3 percentage points |
| Scout signs | 1.5× | 0.75×, rounded down | 1.5×, capped at 100% | 4 percentage points |

Travel adds time. The preview includes the current night/fog risk; actual mishap risk follows the sky at return. Rescue and artifact probabilities retain their existing values. Trip definitions are additive content under `data/artifacts.json.rangingPlans`; malformed entries are omitted. Data without that table offers the original trip.

New departures wait during raid warnings, live home raids, emergencies, manual orders, deliveries and building tasks. Campaign worlds cannot dispatch woodland rangers. A normal workplace assignment is preserved so the ranger resumes the same post after returning.

**Recall** is available while departing or gathering, including during a home raid. Departing rangers return empty. Gathering rangers bring only the completed fraction of their material haul, rounded down, still subject to the normal mishap roll. An unfinished trip grants no tablets, rescue, artifact or intel. Returning rangers cannot be recalled again. Rewards are paid only on arrival through existing capped storage and overflow ledgers. Homecoming records now include the material amounts.

Trip state adds `planId`, `intelMult` and an optional `recalled` flag to the existing saved expedition object. Save version remains 15; old active trips without these fields behave as before. Plan selection in the menu is transient, has no automatic dispatch, and adds no per-frame simulation system. The new UI helper uses existing parchment cards, native labeled selects, and existing 44px control styles. Only the selected card updates when its plan changes, preserving focus and scroll.

Verification: `node --test tests/ranger-dispatch.test.js` covers quotes, sky risk, dispatch protection, partial recall, once-only delivery, storage overflow, save round trips, old active trips and UI data/controls. Run `npm test` and `npm run build` before pushing; the repository's existing PR workflow supplies real-browser and phone-layout smoke/capture checks.

This update is isolated from the concurrent Living Kingdom work. It changes no roads, policies, districts, weather rules, defense AI, renderer, audio, save migrations or shared workflow files. The UI and Game edits are narrow dispatch/recall bridges; implementation and tests live in expedition-specific files.
