# Phase 10 Polish + Soak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Burn down the parked ledger (6 logic fixes + soak proof) and finish player-facing strings (3 items). Living Kingdom update closes.

**Architecture:** One batched logic commit + one strings commit; soak test asserts bounded work, never wall-clock.

**Tech Stack:** Vanilla JS, Node 22, static build. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-phase10-polish-design.md`

## Global Constraints

- Every fix capped/bounded/tested; no behavior beyond the parked item.
- Soak asserts counts only (jobs≤24, carts≤10, planningRuns/interval, cache sizes) — NO millisecond asserts (shared runners are timing-noisy).
- `npm test && npm run build` green per task; VERSION 15; caps held.
- One commit per task; fetch + rebase, never force-push. DeepSeek = A, GPT = B.

## File Structure

- Modify: `src/systems/defense-posts.js`, `src/systems/daynight.js`, `src/game.js`,
  `src/systems/dashboard.js`, `src/systems/frontier-events.js`, `src/ui.js`,
  `src/automation-ui.js` (strings only in B).
- Extend: `tests/living-kingdom-phase10-polish.test.js` (new).

---

### Task A: Parked-logic sweep + soak (DeepSeek, code)

**Files:** as above except automation-ui strings. **Test:** new phase10 file.

- [ ] **Step 1: Write failing tests (one per item)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {eventRegionLabel} from '../src/systems/frontier-events.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('polish: region-less events label safely',()=>{
  assert.equal(eventRegionLabel({}),'frontier');
  assert.equal(eventRegionLabel({region:'ashfall-march'}),'ashfall-march');
});
```

Plus: storage preset prefers near-store post (fixture: two gates, store beside one); first-tick seeds lastStormAt (old-save elapsed=1e5, no strike tick 1); walls preset includes grand-watchtower weight; health `other` bucket + frac≤1; mirror maps deep-equal; soak (150 troops, 200 ticks of economy+logistics+automation+defense, assert jobs≤24/carts≤10/planning bounded/caches bounded).

- [ ] **Step 2: Run (FAIL — eventRegionLabel undefined).**

Run: `node --test tests/living-kingdom-phase10-polish.test.js`

- [ ] **Step 3: Implement (one small hunk per item)**

Storage preset: post score `-Math.min(10, dist(post,nearestStore)/4)` (bounded, nearer wins; balanced untouched). Region label helper + ui.js:344 use. First-tick: `w.lastStormAt=w.elapsed` in the `lastPhase===undefined` branch. Walls: grand-watchtower −20. Health: `other`++ for truthy unknown kinds; `frac=Math.min(1,...)`. Mirror test only (no code).

- [ ] **Step 4: Suite + build.**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/defense-posts.js src/systems/daynight.js src/game.js src/systems/dashboard.js src/systems/frontier-events.js src/ui.js tests/living-kingdom-phase10-polish.test.js
git commit -m "feat(polish): parked-item sweep + soak proof" -m "Bounded, tested, VERSION 15."
```

### Task B: Player strings (GPT, strings only)

**Files:** `src/automation-ui.js`, `src/systems/daynight.js` (hint line), `src/ui.js` (notify already in game.js? — check where `Rally preset:` is built; strings only).

- [ ] **Step 1: Three string edits**

Notify `Rally preset: ${label}.` via existing rallyLabel; mud hint `Off-road slow in the mud — roads run clean, trails half it`; readout unchanged (document keep-decision in report).

- [ ] **Step 2: Verify + commit**

Run: `npm test 2>&1 | Select-Object -Last 5; npm run build 2>&1 | Select-Object -Last 2`

```bash
git fetch origin
git add src/automation-ui.js src/systems/daynight.js src/game.js src/ui.js
git commit -m "art(polish): rally/hint strings" -m "Strings only, no logic."
```
