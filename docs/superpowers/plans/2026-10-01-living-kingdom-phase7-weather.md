# Phase 7 Weather Gameplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rain mud, fog-softened arrows, storm repairs, and lamp-lit night watches — all data-driven, all gentle.

**Architecture:** daynight.js helpers + table keys; one-line hooks in move() and 5 damage sites; storm tick wired at the clock; hint text in describeClock/defenseStatus.

**Tech Stack:** Vanilla JS, Node 22, static build. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-phase7-weather-design.md`

## Global Constraints

- Phase 10 behavior byte-identical when weather clear/day (new keys default, old tables untouched).
- No new weather ids, no save fields, VERSION 15, no new art/sound.
- Mud friendly-only; fog symmetric; storm capped + silent; watch posted-only.
- `npm test && npm run build` green per task; caps held.
- One commit per task; fetch + rebase, never force-push. DeepSeek = A, GPT = B.

## File Structure

- Modify `src/systems/daynight.js:31-51,236-264` — keys + 4 helpers.
- Modify `src/systems/pathfinding.js:105-111` — mud hook.
- Modify `src/systems/combat.js:208-218,245,349` — fog + watch hooks.
- Modify `src/game.js:592-603` — tickStorm wire.
- Modify `src/systems/daynight.js:266-281`, `src/systems/defense-posts.js:77-84` — hints/status (B only).
- Create `tests/living-kingdom-phase7-weather.test.js`.

---

### Task A: Weather effects (DeepSeek, code)

**Files:**
- Modify: `src/systems/daynight.js`, `src/systems/pathfinding.js`, `src/systems/combat.js`, `src/game.js`
- Test: `tests/living-kingdom-phase7-weather.test.js`

**Interfaces:**
- Consumes: `clockConfig`, `roadAt`, `trailWearAt/trailStage`, `buildingMaxHp`-via-data-tiers.
- Produces: `mudMult(world,x,y)`, `fogRangedMult(world,isRanged)`, `nightWatchMult(world,unit)`, `tickStorm(world,data)`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld} from '../src/model.js';
import {mudMult,fogRangedMult} from '../src/systems/daynight.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('weather: mud slows off-road, halves on trails, never on roads',()=>{
  const w=createWorld(data);w.weather='rain';
  assert.equal(mudMult(w,2.25,2.25),0.88);
  w.roads={'4,4':1};assert.equal(mudMult(w,2.25,2.25),1);
  w.weather='clear';delete w.roads['4,4'];assert.equal(mudMult(w,2.25,2.25),1);
  assert.equal(fogRangedMult({weather:'fog'},true),0.9);
});
```

- [ ] **Step 2: Run it (FAIL — helpers undefined).**

Run: `node --test tests/living-kingdom-phase7-weather.test.js`

- [ ] **Step 3: Minimal implementation**

DEFAULTS += mudOffRoad .12, mudTrail .06, fogRanged .1, nightWatch .05, stormDamage .06, stormInterval 120. Helpers read `clockConfig(data)` (pass data where available, else defaults). move(): `if(friendly)speed*=mudMult(world,actor.x,actor.y)`. Defender sites `dealt*=fogRangedMult(world,s.range>2)*nightWatchMult(world,unit)`; tower `dealt*=fogRangedMult(world,true)`; enemy raw `*=fogRangedMult(world,(role.range||1.1)>2)`. tickStorm: rain + hash(elapsed/interval,seed)%3==0 + elapsed-lastStormAt>=interval → one random finished living non-wall/trapless building −6% tier-hp, set lastStormAt. Wire after clock write in game.js tick.

- [ ] **Step 4: Tests + build (add: trail-half, enemy-untouched, watch posted-only, storm cap/determinism/defaults).**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/daynight.js src/systems/pathfinding.js src/systems/combat.js src/game.js tests/living-kingdom-phase7-weather.test.js
git commit -m "feat(weather): mud, fog arrows, night watch, storms" -m "Data-driven, capped, VERSION 15."
```

### Task B: Effect text (GPT, text only)

**Files:**
- Modify: `src/systems/daynight.js:266-281` (hints), `src/systems/defense-posts.js:77-84` (status)

- [ ] **Step 1: Hints + status**

describeClock hints: mud (`Off-road slow in the mud — roads run clean`), fog ranged, night watch, storm watch. defenseStatus: `Night watch at ${name}` when night + posted.

- [ ] **Step 2: Verify + commit**

Run: `npm test 2>&1 | Select-Object -Last 5; npm run build 2>&1 | Select-Object -Last 2`

```bash
git fetch origin
git add src/systems/daynight.js src/systems/defense-posts.js
git commit -m "art(weather): sky-board + watch text" -m "Text only, no sim."
```
