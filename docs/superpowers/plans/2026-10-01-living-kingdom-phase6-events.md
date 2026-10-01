# Phase 6 Dynamic Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Village-condition-gated events with cooldowns and placement anchors, six new village events, View button on the event card.

**Architecture:** Optional `when`/`place`/`cooldown` fields evaluated in the existing director; data-only new entries; card View reuses road-Focus.

**Tech Stack:** Vanilla JS, Node 22, static build. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-phase6-events-design.md`

## Global Constraints

- Existing 9 entries byte-identical behavior (no `when` = eligible as now); timing/guards/atomicity untouched.
- New fields optional; old saves load; VERSION 15.
- No new units/meshes/popups; badge stays quiet.
- `npm test && npm run build` green per task; caps held.
- One commit per task; fetch + rebase, never force-push. DeepSeek = A, GPT = B.

## File Structure

- Modify `src/systems/frontier-events.js:18-28,44-66` — conditions, cooldown, anchor resolver export.
- Modify `data/world.json` — 6 appended entries (nothing else).
- Modify `src/ui.js:339` card area — View button (B only).
- Create `tests/living-kingdom-phase6-events.test.js`.

---

### Task A: Conditions + cooldowns + entries (DeepSeek, code)

**Files:**
- Modify: `src/systems/frontier-events.js`, `data/world.json`
- Test: `tests/living-kingdom-phase6-events.test.js`

**Interfaces:**
- Consumes: `housing()`, `storageCap` or resources read, `isRegionClaimed`, existing `schedule`.
- Produces: `eventConditionsMet(event,state,data)` bool; `eventAnchor(world,data,event)` building|null.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding} from '../src/model.js';
import {eventConditionsMet} from '../src/systems/frontier-events.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('events: market-gated merchant waits for a finished market',()=>{
  const w=createWorld(data),state={world:w,mission:null,vlevel:9};
  const ev={id:'x',title:'T',text:'t',when:{building:'market'},choices:[]};
  assert.equal(eventConditionsMet(ev,state,data),false);
  w.buildings.push(makeBuilding('market',8,10,data));
  assert.equal(eventConditionsMet(ev,state,data),true);
});
```

- [ ] **Step 2: Run it (FAIL — not exported).**

Run: `node --test tests/living-kingdom-phase6-events.test.js`

- [ ] **Step 3: Minimal implementation**

`eventConditionsMet`: building (living finished of type), freeBeds (`housing(w,data).beds - used >= N`), resourceBelow (`(w.resources[key]||0) < amount`), minWave (`(w.wave||0) >= N`); region gate unchanged (region-less skips it). Cooldown: `world.frontierEventSeen` map, skip if `elapsed - seen < (cooldown||0)`, record on resolve. `eventAnchor`: nearest living finished `place.near` building to village center (or first). 6 entries appended to world.json frontierEvents with real costs/rewards/results copy.

- [ ] **Step 4: Tests + build (add: cooldown, anchor, shortage, atomicity-unchanged).**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/frontier-events.js data/world.json tests/living-kingdom-phase6-events.test.js
git commit -m "feat(events): condition-gated village events" -m "Additive fields, 6 entries, existing 9 untouched."
```

### Task B: Placement View button (GPT, UI only)

**Files:**
- Modify: `src/ui.js` card area (~:339)

- [ ] **Step 1: View button reusing road-Focus**

If active event has a resolvable anchor, render `View` button (`data-event-focus`) centering camera like `dataset.roadFocus` (`src/ui.js:116`); quiet badge copy unchanged otherwise.

- [ ] **Step 2: Verify + commit**

Run: `npm test 2>&1 | Select-Object -Last 5; npm run build 2>&1 | Select-Object -Last 2`

```bash
git fetch origin
git add src/ui.js
git commit -m "art(events): placement View on event card" -m "Reuses road-Focus, no sim."
```
