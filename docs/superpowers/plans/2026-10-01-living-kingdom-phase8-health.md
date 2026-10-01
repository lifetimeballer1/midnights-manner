# Phase 8 Village Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resources panel gains a cached Settlement Health card: builder states + weakest wall.

**Architecture:** Pure `settlementHealth(world,data)` in dashboard.js with 5s WeakMap cache; one card in renderResources.

**Tech Stack:** Vanilla JS, Node 22, static build. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-phase8-health-design.md`

## Global Constraints

- Read-only: no sim/save/balance changes, VERSION 15.
- No ETA/traffic (deferred); no per-frame work (5s cache).
- `npm test && npm run build` green per task; caps held.
- One commit per task; fetch + rebase, never force-push. DeepSeek = A, GPT = B.

## File Structure

- Modify `src/systems/dashboard.js` — settlementHealth + cache.
- Modify `src/ui.js:260-277` — health card (B only).
- Create `tests/living-kingdom-phase8-health.test.js`.

---

### Task A: Health snapshot (DeepSeek, code)

**Files:**
- Modify: `src/systems/dashboard.js`
- Test: `tests/living-kingdom-phase8-health.test.js`

**Interfaces:**
- Consumes: `isWall`, `buildingMaxHp`, troop `builderTask`.
- Produces: `settlementHealth(world,data)` → `{builders, weakWall}`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {settlementHealth} from '../src/systems/dashboard.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('health: builders counted by task, weakest wall found',()=>{
  const w=createWorld(data);
  const b=makeUnit('builder',data);b.builderTask={kind:'repair',target:'x',working:true};w.troops.push(b);
  const wall=makeBuilding('wall',8,5,data);wall.hp=1;w.buildings.push(wall);
  const h=settlementHealth(w,data);
  assert.equal(h.builders.repair,1);assert.equal(h.weakWall.type,'wall');
});
```

- [ ] **Step 2: Run it (FAIL — not exported).**

Run: `node --test tests/living-kingdom-phase8-health.test.js`

- [ ] **Step 3: Minimal implementation**

Count living builder-role troops by `builderTask.kind` (construction/repair/road, else idle if taskless+orderless). Weakest living wall/gate/rampart by hp/maxHp; side by dx/dy vs map center (dominant axis → E/W/N/S). WeakMap cache keyed by world, recomputed when `Math.floor(elapsed/5)` changes.

- [ ] **Step 4: Tests + build (add: idle count, no-walls null, cache bucketing).**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/dashboard.js tests/living-kingdom-phase8-health.test.js
git commit -m "feat(health): settlement health snapshot" -m "Read-only, 5s cached, VERSION 15."
```

### Task B: Health card (GPT, UI only)

**Files:**
- Modify: `src/ui.js:260-277`

- [ ] **Step 1: Card above storage cards**

`<article class="resource-detail">` with `SETTLEMENT HEALTH` eyebrow: `Builders: X building / Y repairing / Z roads (N idle)` + weakest wall `East wall: weak (NN%)` or `Walls hold.` + note pointing at net/day card. Reuse classes only.

- [ ] **Step 2: Verify + commit**

Run: `npm test 2>&1 | Select-Object -Last 5; npm run build 2>&1 | Select-Object -Last 2`

```bash
git fetch origin
git add src/ui.js
git commit -m "art(health): settlement health card" -m "Read-only card, existing classes."
```
