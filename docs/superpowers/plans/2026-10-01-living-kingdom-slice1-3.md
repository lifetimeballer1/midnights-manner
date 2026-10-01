# Living Kingdom Slice 1–3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Builders auto-upgrade worn trails to dirt/stone roads when idle, one Stores Policies screen controls 11 auto-upgrade categories, Stone Roads + Grand Granary visibly change logistics.

**Architecture:** Extend `planBuilders` idle tail + `busyRoutes`/`roadQuote`/`buildRoad` reuse; extend `automationSettings` + Stores card with category table; weight granary food routing in logistics destination choice. New code ≤400 lines/file, cached scores, 2s ticks.

**Tech Stack:** Vanilla JS modules, Node 22 tests (`node --test`), static build (`scripts/build.mjs`), no new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-slice1-3-design.md`

## Global Constraints

- Save-additive only; old saves load; VERSION stays 15 unless a new additive migration is proven necessary.
- Hold 30k faces / 60 fx / 12 voices; Calm freezes motion; LOD far<0.6/near>1.5.
- `npm test && npm run build` green per task; orbit/pinch/grid/Motion intact.
- One commit per task + ≤5-line summary; fetch + rebase, never force-push.
- DeepSeek = code tasks 1–3; GPT = visual task 4 only.
- Deferred to later slices (not this plan): enemy valuable-structure targeting, full storm/night weather, full district ambience.

## File Structure

- Modify `src/systems/automation.js:79-120` — idle-only road step, `kind='road'` travel loop.
- Modify `src/systems/roads.js:25` — importance scorer export (cached), no signature change to quote/build.
- Modify `src/automation-ui.js:24-28` — Policies categories UI; Modify `src/systems/steward-budget.js:52-64` — pct-reserve enforcement.
- Modify `src/systems/logistics.js` destination choice — granary food preference weight.
- Create `tests/living-kingdom-slice1-3.test.js` — gated roads, road jobs, priorities, reserves, categories, granary, migration.
- GPT only: `src/ui.js:260-261`, `src/logistics-art.js:12`, `src/systems/trails.js:50-71` readability; sheets to `artifacts/look-*.png`.

---

### Task 1: Builder road jobs (DeepSeek, code)

**Files:**
- Modify: `src/systems/automation.js:79-120`
- Modify: `src/systems/roads.js:25` (add cached scorer, keep exports)
- Test: `tests/living-kingdom-slice1-3.test.js`

**Interfaces:**
- Consumes: `busyRoutes(w,limit,d)`, `roadQuote(w,d,seed,tier)`, `buildRoad(w,d,seed,tier)`, `canSpend(game,cost,{purpose:'road'})`, `move(w,d,u,target,speed,dt,...)`.
- Produces: `u.builderTask={kind:'road',seed,tier,cells,working}`; `roadImportance(w,d,key)` export.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {recordTravel} from '../src/systems/trails.js';
const data=Object.fromEntries(await Promise.all(['world','buildings','troops','items','abilities','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('LK slice: idle builder takes gated road job, raids pause it',()=>{
  const g=new Game(data);g.state.vlevel=9;const w=g.state.world;
  w.buildings.push(makeBuilding('stone-road',18,15,data,3));
  for(let i=0;i<250;i++)recordTravel(w,data,2.25,8.25,8.25,8.25);
  w.resources={...w.resources,wood:1000,gold:1000,lumber:1000};
  const b=w.troops.find(u=>data.troops[u.type]?.role==='builder');
  assert.ok(b,'needs a builder');
  g.paused=false;
  assert.equal(typeof b.builderTask?.kind,'string');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/living-kingdom-slice1-3.test.js`
Expected: FAIL (`builderTask` undefined — no road step yet).

- [ ] **Step 3: Write minimal implementation**

In `src/systems/automation.js` after the `if(target){...return;}` repair/construction block and after the autoUpgrade early-return, add idle-only road planning inside `planBuilders` (2s tick only, never per-frame):
```js
import {greatWorkTier,busyRoutes,roadQuote,buildRoad} from './roads.js';
export function roadImportance(w,d,key){const e=w.trails?.[key];return (e?.[0]||0)+(states.get(w)?.jobs.filter(j=>j.key===key).length||0)*2;}
if(settings(w).policies?.roads===false)return;
const net=greatWorkTier(w,'stone-road');if(!net)return;
for(const row of busyRoutes(w,4,d)){
  const tier=row.road?2:1;if(tier===2&&net<3)continue;
  const q=roadQuote(w,d,row.key,tier);if(q.error)continue;
  if(!canSpend(game,q.cost,{purpose:'road'}))continue;
  for(const u of builders)u.builderTask={kind:'road',seed:row.key,tier,cells:q.cells,working:false};
  break;
}
```
In the movement loop add `kind==='road'` handling: `move()` toward seed center; on arrival `buildRoad(w,d,seed,tier)`, then re-quote within 12 half-cells for continuation. Clear on raid/mission like repairs.

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test 2>&1 | Select-Object -Last 8`
Expected: PASS including new LK test; full suite green.

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/automation.js src/systems/roads.js tests/living-kingdom-slice1-3.test.js
git commit -m "feat(roads): idle-only builder road upgrades" -m "Gated by stone-road tiers. Reserves enforced. Raids pause."
```

### Task 2: Settlement Policies categories (DeepSeek, code)

**Files:**
- Modify: `src/systems/automation.js:11-22`
- Modify: `src/automation-ui.js:24-28`
- Modify: `src/systems/steward-budget.js:52-64`
- Test: `tests/living-kingdom-slice1-3.test.js`

**Interfaces:**
- Consumes: `automationSettings(world)`, `autoUpgradeTypeEnabled(world,type)`, `spendingAvailable(game,res,{purpose})`.
- Produces: `world.automation.policies.{category}={on,maxTier,priority}`, `world.automation.reservePct.{category}.{res}`; `CATEGORY_OF` type→category table.

- [ ] **Step 1: Write the failing test**

```js
test('LK slice: policies gate categories with max-tier and pct reserve',()=>{
  const g=new Game(data);const w=g.state.world;
  const s=w.automation;assert.ok(s.policies.walls,'walls category exists');
  s.policies.walls={on:false,maxTier:4,priority:'high'};
  assert.equal(autoUpgradeTypeEnabled(w,'wall'),false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/living-kingdom-slice1-3.test.js`
Expected: FAIL (`policies` undefined).

- [ ] **Step 3: Write minimal implementation**

Add to `defaults()`: `policies` with 11 keys (walls,gates,towers,farms,mines,lumber,housing,storage,workshops,military,roads) each `{on:true,maxTier:6,priority:'normal'}`, plus `reservePct:{}`. Add `CATEGORY_OF` table mapping building types (wall→walls, gate→gates, tower/archer_tower/ballista→towers, farm→farms, mine→mines, lumber/timber_yard/sawmill→lumber, cottage/longhouse→housing, hall/storehouse/grand-granary→storage, forge/workshop/smeltery→workshops, barracks→military). `autoUpgradeTypeEnabled` checks category `on` first, then existing per-type. `spendingAvailable` computes floor as `max(manualReserve, cap(res)*pct/100)` per category purpose. Extend `automationStores` UI with one row per category: `ON | Max T4 | High` + pct inputs; reuse existing `data-automation-*` handlers.

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test 2>&1 | Select-Object -Last 8`
Expected: PASS; old saves migrate additive (policies default on).

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/automation.js src/automation-ui.js src/systems/steward-budget.js tests/living-kingdom-slice1-3.test.js
git commit -m "feat(policies): settlement policies 11 categories" -m "ON/max-tier/priority + pct reserves. Additive migration."
```

### Task 3: Project integrations roads+granary (DeepSeek, code)

**Files:**
- Modify: `src/systems/logistics.js` (destination weight)
- Test: `tests/living-kingdom-slice1-3.test.js`

**Interfaces:**
- Consumes: `greatWorkTier(w,'grand-granary')`, `settlementTopology(w,d)`, existing `chooseDestination`.
- Produces: food trips prefer finished living grand-granary; nearby food loading faster (bounded, no new aura key).

- [ ] **Step 1: Write the failing test**

```js
test('LK slice: finished granary attracts food trips',()=>{
  const g=new Game(data);const w=g.state.world;
  const gran=makeBuilding('grand-granary',7,4,data);gran.level=1;gran.remaining=0;w.buildings.push(gran);
  const dest=chooseDestination(w,data,{type:'farm'},'food');
  assert.equal(dest.building.id,gran.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/living-kingdom-slice1-3.test.js`
Expected: FAIL (chooses storehouse/manor instead).

- [ ] **Step 3: Write minimal implementation**

In destination scoring add: if resource is food/flour/bread and candidate is living finished `grand-granary`, subtract distance penalty (prefer it) and mark route importance +1 for road scorer. Stone Roads: no code — tier-1 formalize / tier-3 pave already gated in `roadQuote`; expose automation toggle only. No new multipliers beyond `ROAD_SPEED`/`trailMultiplier`.

- [ ] **Step 4: Run tests + build**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 3`
Expected: PASS + `639+ precached` build green.

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/logistics.js tests/living-kingdom-slice1-3.test.js
git commit -m "feat(projects): granary food routing + road gates" -m "Visible hub preference. No balance drift."
```

### Task 4: Road/project readability (GPT, visual only)

**Files:**
- Modify: `src/ui.js:260-261`, `src/logistics-art.js:12`, `src/systems/trails.js:50-71` (readability only)
- Test: `npm run build && npm run capture` sheets

**Interfaces:**
- Consumes: existing overlays + `busyRoutes` gold marks; Produces: contact sheet max 3 shots.

- [ ] **Step 1: Capture before sheet**

Run: `npm run build; npm run capture 2>&1 | Select-Object -Last 5`
Expected: `artifacts/look-*.png` refresh.

- [ ] **Step 2: Minimal readability pass (≤2 refinements)**

Emphasize desire→dirt→stone value steps + granary hub ring; reuse palette; Calm-safe; static cache keys unchanged.

- [ ] **Step 3: Boss scores 90/100, commit**

```bash
git fetch origin
git add src/ui.js src/logistics-art.js artifacts/look-desktop-day.png artifacts/look-phone-night.png
git commit -m "art(roads): road tier + granary readability" -m "Contact sheet reviewed 90/100. Calm-safe."
```
