# SOL TASK U1 — Collapsible HUD (declutter, first of two)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Problem
Late-game HUD crowds the village out (player screenshots, Day 123, 8 resources, 9 fighters):
top-right 8 resource cards cover the map (top half on portrait phones); the army rail
fills the whole bottom strip; 6 camera buttons float mid-screen; quest chip + toast
stack over the village. World must be the interface again.

## Scope
- `index.html` (HUD markup ONLY: add toggle chips/buttons; no nav/drawer changes)
- `src/ui.js` (refresh/render + bindings for the four collapses below)
- `src/styles.css` and/or `src/polish.css` (collapsed/expanded styles + existing
  responsive breakpoints; follow the `many-resources` precedent, extend it if needed)
- `tests/task-u1-declutter.test.js` (new)
- README: append `### Grey Dawn U1` (short: what collapses, defaults, where detail lives)

## Design (Muse-locked)
Four collapses, one shared pattern: compact summary affordance → tap expands →
tap collapses. Expanded state persists in `localStorage` (e.g. `mm.hud` JSON),
in-memory fallback if storage throws. NEVER in the world save (no save version bump,
no storage.js changes, old saves untouched).

1. **Resources** (`ui.js:187-194`, `#resources`): default COLLAPSED to one summary chip:
   gold + food + wood stored values (icons + short numbers via existing
   `formatShortAmount`), plus a `FULL` badge when ANY visible resource is at cap.
   Tap chip (or existing Stores drawer tab) expands the current full grid unchanged.
   Full per-resource detail stays in `renderResources` (Stores drawer) — always complete.
2. **Army rail** (`ui.js:209`, `#army-rail`): default COLLAPSED to one `Army N` chip
   (fighter count; selected-unit level pip if a unit is selected). Tap opens the
   People drawer (troops tab) where per-unit select already works. Keep the existing
   `data-select-unit` delegation path working when expanded.
3. **Camera tools** (`.camera-tools`, 6 buttons): default COLLAPSED behind one `⋯`
   toggle (44px target, keeps `aria-expanded`). Pause/settings button stays visible
   outside the collapse (it owns the pause overlay).
4. **Quest chip** (`#quest-chip`): add a dismiss affordance collapsing it to a small
   `✦` dot (keeps `aria-label` with quest name); tap dot reopens. Quest detail
   already lives in Adventure → quests.

## Hard constraints
- Every collapsed control keeps a ≥44px touch target and its current `aria-label`
  (update counts inside labels, don't drop them).
- `collectionObstacles` (`ui.js:212`): extend the selector list so canvas collection
  bubbles avoid the NEW chips/toggles (add their selectors; keep all existing ones).
- No game-logic, economy, save, or drawer changes. No new currencies/aura keys.
- Mobile portrait AND landscape AND desktop must all leave the map tappable:
  collapsed HUD may not cover canvas center on a 360px-wide viewport
  (assert via existing CSS only — no browser needed).
- U2 (canvas marker/label density in renderer.js) is OUT. Do not touch renderer.js.

## Tests (`tests/task-u1-declutter.test.js`, H-style)
- Extract the new summary HTML into small exported pure helpers off UI or a new
  `src/systems/hud.js` (Muse prefers a tiny new module over bloating ui.js IF ui.js
  has no existing export pattern for it — check first; either way helpers must be
  importable in node without DOM): resource summary (3 values + FULL iff any capped),
  army summary (count + selected pip), camera toggle (`aria-expanded` flips),
  quest dot (label keeps quest name). Unit-test each, including empty/low-count edges.
- Prefs: collapsed defaults true; expand/collapse round-trips through the
  localStorage wrapper (mock storage object — do not touch real localStorage in tests).
- Regression: full `npm test` green with NO other test file edits except pins that
  count HUD cards IF such pins exist (grep `army-card`, `class="resource"`,
  `camera-tools` in tests/ first; prefer keeping existing pins passing unchanged).

## Rules
- After edits run `npm test` and `npm run build` (on Windows use `npm.cmd` —
  `npm.ps1` is blocked). Report pass/fail plus files changed. Do not start U2.
