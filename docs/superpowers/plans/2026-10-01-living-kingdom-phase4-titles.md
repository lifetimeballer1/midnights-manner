# Phase 4 Earned Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Veteran villagers earn persistent titles (Master Builder/Smith/Miner, Veteran Guard) with a 5% job-output bonus, displayed in People UI.

**Architecture:** New `tickTitles(world,data,notify)` in villagers.js (one pass, optional-notify pattern); 1-line bonus in `jobLevelMult`; title chip in 4 existing UI spots.

**Tech Stack:** Vanilla JS, Node 22 (`node --test`), static build. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-01-living-kingdom-phase4-titles-design.md`

## Global Constraints

- Save-additive only; VERSION stays 15; old saves backfill titles on next tick.
- Bonus exactly ×1.05 titled, no new aura/stat keys.
- `npm test && npm run build` green per task; phone caps untouched.
- One commit per task; fetch + rebase, never force-push.
- DeepSeek = Task A code; GPT = Task B UI text.

## File Structure

- Modify `src/systems/villagers.js` — TITLES table, `tickTitles`, `jobLevelMult`, `ensureIdentity`.
- Modify `src/game.js:723` — wire `tickTitles` with notify.
- Modify `src/ui.js:294-298,519,524` — title chips (Task B only).
- Create `tests/living-kingdom-phase4-titles.test.js`.

---

### Task A: Title awards + bonus (DeepSeek, code)

**Files:**
- Modify: `src/systems/villagers.js`, `src/game.js:723`
- Test: `tests/living-kingdom-phase4-titles.test.js`

**Interfaces:**
- Consumes: `jobLevelForXp`, `JOB_XP_LEVELS`, existing `notify(msg)` convention.
- Produces: `tickTitles(world,data,notify=null)` returns titled units; `u.title` string|null.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeUnit} from '../src/model.js';
import {ensureIdentity,tickTitles,jobLevelMult,JOB_XP_LEVELS} from '../src/systems/villagers.js';
const data=Object.fromEntries(await Promise.all(['world','troops','items','abilities','buildings','missions','quests'].map(async n=>[n,JSON.parse(await readFile(new URL(`../data/${n}.json`,import.meta.url)))])));
test('titles: posted master smith earns title once with 5% bonus',()=>{
  const w={buildings:[{id:'b1',type:'forge',hp:10,remaining:0}],troops:[]};
  const u=makeUnit('weaponsmith',data,0);ensureIdentity(u,data,[]);
  u.workplace='b1';u.jobXp=JOB_XP_LEVELS[4];u.jobLevel=5;w.troops.push(u);
  const said=[];assert.deepEqual(tickTitles(w,data,m=>said.push(m)).map(t=>t.id),[u.id]);
  assert.equal(u.title,'Master Smith');assert.equal(jobLevelMult(u),1.32*1.05);
  assert.equal(said.length,1);assert.equal(tickTitles(w,data,()=>{throw new Error('re-notify');}).length,0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/living-kingdom-phase4-titles.test.js`
Expected: FAIL (`tickTitles` not defined).

- [ ] **Step 3: Minimal implementation**

TITLES table + `tickTitles` (one pass; posted `(u.jobLevel||1)>=5` → table hit; builder/combat `(u.level||1)>=15` → table hit; skip titled/dead; `notify` optional); `jobLevelMult` appends `* (unit?.title?1.05:1)`; `ensureIdentity` adds title default null without touching existing; `game.js:723` calls `tickTitles(this.world,this.data,m=>this.notify(m))` after `tickVillagerJobs`.

- [ ] **Step 4: Run tests + build**

Run: `npm test 2>&1 | Select-Object -Last 8; npm run build 2>&1 | Select-Object -Last 2`
Expected: PASS full suite + build green. Add tests: level-15 builder/combat award, no award below thresholds, persistence round-trip (ensureIdentity keeps title), old-save backfill (veteran without title gains it).

- [ ] **Step 5: Commit**

```bash
git fetch origin
git add src/systems/villagers.js src/game.js tests/living-kingdom-phase4-titles.test.js
git commit -m "feat(titles): earned veteran titles + 5% bonus" -m "Additive, backfills veterans, VERSION 15."
```

### Task B: Title display (GPT, UI text only)

**Files:**
- Modify: `src/ui.js:294-298,519,524`

**Interfaces:**
- Consumes: `u.title` (string|null). Produces: `🏅 Title` chip reusing `.trait` style in person-card h3, jobLine, workplace row, inspector.

- [ ] **Step 1: Add chips**

Render `u.title?`<span class="trait">🏅 ${escape(title)}</span>`` in all 4 spots; null renders nothing.

- [ ] **Step 2: Verify + commit**

Run: `npm test 2>&1 | Select-Object -Last 5; npm run build 2>&1 | Select-Object -Last 2`
Expected: green, no pin changes.

```bash
git fetch origin
git add src/ui.js
git commit -m "art(titles): veteran title chips in People UI" -m "Text-only, reuses .trait style."
```
