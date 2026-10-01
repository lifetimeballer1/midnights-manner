# Phase 9 Emergent Districts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inferred 6-kind district grid (30s cached) feeding road priority, event anchors, ambient voice, and a Stores readout.

**Architecture:** `districtGrid` + kind map in logistics.js; topology extension; 3 small consumer hooks; card list in Stores.

**Tech Stack:** Vanilla JS, Node 22, static build. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-phase9-districts-design.md`

## Global Constraints

- Old 5 topology keys byte-identical (pinned test); `trade` kept as alias.
- No manual painting, no zoning rules/multipliers, no raid/balance changes.
- 30s cache, WeakMap, detached returns; VERSION 15.
- `npm test && npm run build` green per task; caps held.
- One commit per task; fetch + rebase, never force-push. DeepSeek = A+B, GPT = C.

## File Structure

- Modify `src/systems/logistics.js:83` — kind map, districtGrid, topology extension.
- Modify `src/systems/roads.js` scorer, `src/systems/frontier-events.js` anchor, `src/systems/ambience.js:19-25` order.
- Modify `src/ui.js:264-265` card area (C only).
- Create `tests/living-kingdom-phase9-districts.test.js`.

---

### Task A: Inference + cache (DeepSeek, code)

**Files:**
- Modify: `src/systems/logistics.js`
- Test: `tests/living-kingdom-phase9-districts.test.js`

**Interfaces:**
- Consumes: living-building filter pattern.
- Produces: `districtKindOf(type)`, `districtGrid(world,data)` → `{cells:[{cx,cy,kind,count}], at}`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding} from '../src/model.js';
import {districtKindOf,districtGrid,settlementTopology} from '../src/systems/logistics.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('districts: farm cluster reads farming, old keys untouched',()=>{
  const w=createWorld(data);
  w.buildings.push(makeBuilding('farm',2,2,data),makeBuilding('farm',4,3,data),makeBuilding('mine',30,30,data));
  assert.equal(districtKindOf('farm'),'farming');
  const g=districtGrid(w,data);
  assert.ok(g.cells.some(c=>c.kind==='farming'&&c.count>=2));
  assert.deepEqual(settlementTopology(w,data).districts.industrial,['mine-id-missing']);
});
```

- [ ] **Step 2: Run it (FAIL — not exported; fix the industrial assertion to the real id).**

Run: `node --test tests/living-kingdom-phase9-districts.test.js`

- [ ] **Step 3: Minimal implementation**

Ordered kind map per spec; 6×6 cells over `data.world` w/h; living only (`hp>0 && !(remaining>0)`); majority ≥2 else null; WeakMap `{atBucket, value}` recompute when `Math.floor(elapsed/30)` changes; topology adds `cells` (detached), `civic`, `market` (market-family ids), keeps `trade`.

- [ ] **Step 4: Tests + build (add: civic/market keys, cache bucketing, detached).**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/logistics.js tests/living-kingdom-phase9-districts.test.js
git commit -m "feat(districts): inferred grid + topology" -m "30s cached, old keys identical."
```

### Task B: Consumers (DeepSeek, code)

**Files:**
- Modify: `src/systems/roads.js`, `src/systems/frontier-events.js`, `src/systems/ambience.js`
- Test: `tests/living-kingdom-phase9-districts.test.js` (append)

**Interfaces:**
- Consumes: `districtGrid` (cached — safe at 2s automation cadence).

- [ ] **Step 1: Append failing tests (road bonus on industrial cell; anchor tie-break; work order).**
- [ ] **Step 2: Run (FAIL).**
- [ ] **Step 3: Implement (roadImportance +2 wear-equiv on industrial/market/farming cells — formally unparks wear-only; anchor tie-break by district of place.near type; workKinds sort district-dominant first, no filtering).**
- [ ] **Step 4: Full suite + build.**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/roads.js src/systems/frontier-events.js src/systems/ambience.js tests/living-kingdom-phase9-districts.test.js
git commit -m "feat(districts): road/event/ambience consumers" -m "Wear-only unparked; ties break by district."
```

### Task C: District readout (GPT, UI only)

**Files:**
- Modify: `src/ui.js:264-265`

- [ ] **Step 1: District list in logistics card**

`Districts: Farming ×3 · Market ×1 …` from topology (counts only, no mesh changes).

- [ ] **Step 2: Verify + commit**

Run: `npm test 2>&1 | Select-Object -Last 5; npm run build 2>&1 | Select-Object -Last 2`

```bash
git fetch origin
git add src/ui.js
git commit -m "art(districts): district readout" -m "Counts only, no meshes."
```
