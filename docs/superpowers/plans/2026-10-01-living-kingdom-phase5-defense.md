# Phase 5 Defense Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-tap rally presets steer defender posting; enemies probe weak walls and valuable structures. Combat stays readable.

**Architecture:** Preset weight table in autoFill + `world.defenseRally` string; two small discounts in `enemyBuildingTarget`; select control in defense header + HUD line.

**Tech Stack:** Vanilla JS, Node 22, static build. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-phase5-defense-design.md`

## Global Constraints

- Save-additive, VERSION 15; default preset reproduces current behavior exactly.
- Distance dominates enemy scoring; discounts are small ints.
- Manual posts never overridden; civilians/shelter untouched.
- `npm test && npm run build` green per task; caps held.
- One commit per task; fetch + rebase, never force-push. DeepSeek = A, GPT = B.

## File Structure

- Modify `src/systems/defense-posts.js:7-40` — RALLY table, setRally, autoFill weights, reserve holdback.
- Modify `src/systems/tactics.js:48-61` — weak-wall + valuable discounts.
- Modify `src/automation-ui.js:6-11`, `src/ui.js:240-243` — rally control (B only).
- Create `tests/living-kingdom-phase5-defense.test.js`.

---

### Task A: Rally presets + enemy targeting (DeepSeek, code)

**Files:**
- Modify: `src/systems/defense-posts.js`, `src/systems/tactics.js`
- Test: `tests/living-kingdom-phase5-defense.test.js`

**Interfaces:**
- Consumes: `defensePostCapacity`, `stats(u,d).range/speed`, `center/distance`, `buildingMaxHp` (for wall hp fraction — import from endgame.js like automation.js does).
- Produces: `setRally(world,id)` (validates, returns bool); `world.defenseRally`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,makeBuilding,makeUnit} from '../src/model.js';
import {setRally} from '../src/systems/defense-posts.js';
import {enemyBuildingTarget} from '../src/systems/tactics.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('defense: rally presets validate and damaged walls draw enemies',()=>{
  const w=createWorld(data);
  assert.equal(setRally(w,'gates'),true);assert.equal(w.defenseRally,'gates');
  assert.equal(setRally(w,'nope'),false);assert.equal(w.defenseRally,'gates');
  const e={x:5,y:5,hp:10,role:'raider'};
  const wall=makeBuilding('wall',8,5,data);wall.hp=1;w.buildings.push(wall);
  const farm=makeBuilding('farm',8,5,data);w.buildings.push(farm);
  assert.equal(enemyBuildingTarget(w,data,e).id,wall.id);
});
```

- [ ] **Step 2: Run it (FAIL — setRally undefined).**

Run: `node --test tests/living-kingdom-phase5-defense.test.js`

- [ ] **Step 3: Minimal implementation**

RALLY weight table `{balanced:{},gates:{gate:-30},manor:{hall:-30},walls:{gate:-20,tower:-20,archer_tower:-20},storage:{anchor:'storage'},reserve:{hold:2}}` applied in autoFill score (anchor = distance to nearest storehouse/grand-granary replaces distance-to-post term); reserve skips 2 fastest from auto-assign (they muster via existing movement when raidActive). tactics.js: `-(hpFrac<0.33?4:hpFrac<0.66?2:0)` for walls, `-2` for grand-granary/storehouse/market/market-square. Default `defenseRally` balanced = zero weights (current behavior byte-identical).

- [ ] **Step 4: Tests + build (add: reserve holdback, valuable preference, round-trip, planningRuns bound).**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/defense-posts.js src/systems/tactics.js tests/living-kingdom-phase5-defense.test.js
git commit -m "feat(defense): rally presets + weak-wall targeting" -m "Additive, default reproduces current behavior."
```

### Task B: Rally control UI (GPT, controls only)

**Files:**
- Modify: `src/automation-ui.js:6-11`, `src/ui.js:240-243`

- [ ] **Step 1: Add preset select + HUD line**

`<select data-rally>` with 6 presets in the defense header; battle HUD shows `Rally: X` when raidPending/enemies. Reuse existing change/click handlers pattern.

- [ ] **Step 2: Verify + commit**

Run: `npm test 2>&1 | Select-Object -Last 5; npm run build 2>&1 | Select-Object -Last 2`

```bash
git fetch origin
git add src/automation-ui.js src/ui.js
git commit -m "art(defense): rally preset control" -m "Controls only, no sim."
```
