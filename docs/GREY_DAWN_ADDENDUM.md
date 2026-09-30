# GREY DAWN ADDENDUM — Muse Design Decisions (Master Plan Extension)

Owner: Muse (design + delegation). Implementer: GPT-6.1 Sol via OpenAI Codex connection.
Status: design locked, implementation queued as scoped Sol tasks A–G. Sol gets one task at a time, never the full plan.

## Priority: resource flow

Late-game economy fills storage too easily. Fix by spending, not by deleting resources or gutting production.

Target loop: production → collection → meaningful spending → visible improvement.

Constraints:
- Reuse existing sinks before creating new ones: Renown (`data/endgame.json`), War Chest, Festivals (`data/festivals.json`), Town Projects (project flag in `data/buildings.json`), Grey Market bulk valves (`data/traders.json` provender-run / northern-caravan), Town Meal / Well Fed (`src/systems/food.js`, `data/world.json townMeal`).
- No new currency. No harsh starvation/death. Loss of bonus, not loss of progress.
- No duplicate building systems. Projects/infrastructure ride the existing `project` + `costCurve` + `flatAuras` pipeline.
- Collection/banking rules unchanged: `depositCentral` partial-banking, never destroy overflow (`src/systems/storage.js`, `src/game.js harvest/collectAll`).

## 1. Kingdom Supply / Upkeep (Well Supplied)

Extend townMeal architecture, do not fork it.
- Basket from existing resources by settlement development: food, bread, gold, wood/lumber, plate, frostwood at advanced stages.
- Cadence: once per game-day (same `secondsPerDay` 180s clock). Full basket drawn exactly → Well Supplied until next supply tick. Shortfall draws nothing, bonus lapses, single notice, returns when covered.
- Bonus via existing aura merge (`auras()` in `src/model.js`): production efficiency, faster training/job XP, faster repairs, slightly faster construction, settlement recovery. Same pattern as Well Fed effects + growth + jobXp.
- Save fields additive with safe defaults (`world.wellSupplied`, `world.lastSupplyDay`). Old saves start uncovered, never nagged if bread chain missing → same grace rule as meals.
- UI: chip beside Well Fed, Resources panel reports basket + countdown. Reuse `src/systems/food.js` pure-math shape → new `src/systems/supply.js` or extend food.js, Muse decides at Task E review.

## 2. Auto-Upgrade as sink

Planned Auto Upgrade People uses exact normal upgrade cost, no automation discount. Protected-resource reserves still apply. Large population then consumes naturally. No separate balance table.

## 3. Infrastructure spending (visible, repeatable)

Prefer Town Projects pipeline. New entries are data + sprite + `flatAuras`, not new systems:
- Roads: trail → dirt → reinforced. Costs wood/lumber + gold, later plate.
- Walls/defenses: regional reinforcement program via lumber + plate + gold.
- Lighting: staged torch/lantern investment.
- Civic: market expansion, granary improvements, town square, manor grounds, worker districts.
Granary precedent already extends central storage via Phase 1 cap system — reuse it.

## 4. Conquest supply

Captured territories create demand, not just bonuses. Data-driven on `data/conquest.json` + `world.conquest` ledger pattern:
- Outpost Supply (food, bread, plate, gold) → stronger regional defense, earlier raid warning, faster reinforcement.
- Frontier Settlement Supply (food, lumber, gold) → gather bonuses, trader activity, population support, road growth.
- Under-supplied = bonuses pause. Never destroy or permanently downgrade territory.
- War Chest march payment (`Break the Border Patrol` precedent) stays as the one-time march cost; supply is the recurring upkeep beside it.

## 5. Bulk resource orders

When storage nears full, offer lossy-but-useful bulk spends via existing trader/renown/project infra:
- Construction Contract: lumber + gold → regional improvement / building upgrade progress.
- Armory Contract: plate + gold → army training / defensive bonus / gear progress.
- Harvest Shipment: food + bread → Renown progress / settlement growth / regional support.
- Frostwood Commission: frostwood → high-tier cosmetic / structure detail / equipment / conquest support.
Ride `data/traders.json` rotation + daily caps + Phase 1 room check. No new currency.

## Storage target

Full storage remains valid feedback. In normal active play for a developed settlement, player should have several appealing spends before everything sits permanently capped. Balance for developed settlement, not only early game.

## Collection UX (world-first)

Second reference image is information-density reference only. Keep Midnights Manner navy/brass identity. Do not copy layout/shapes/art/colors.

- Default markers: replace giant `+430 Gold` pills with small building-anchored `resource icon + readiness dot`. Use existing `assets/resource-*.svg` icons, never emoji in production. Comfortable mobile target (~44px), dramatically smaller than current bubbles.
- Amount on demand: small icon normally; tap shows `Gold +430`; brief pulse on collect. HUD total responds.
- Collect Ready: one compact edge-anchored control. One tap collects everything that fits (`game.js collectAll` + `depositCentral` partial rules). One sound per batch, not per building. Optional long-press/expand: Collect Gold / Food / Wood / Frostwood — never permanent map buttons.
- Density (improve, don't replace): `CROWDED_READY_THRESHOLD=8`, `isCollectionCrowded`, `layoutCollectionBubbles` in `src/resources.js` + `renderer.js drawCollections`. Targets: few ready → small individual markers; many ready → suppress to one aggregate control; zoomed out → aggregate; zoomed in → more individuals. React to zoom + density.
- Full storage: compact `icon + !` or subtle full-ring. Tap explains `Gold storage full — 430 waiting here.` No giant bubble.
- HUD: compact two-column upper-right stack, `[icon] 31,500 / Gold`, recognizable icons, capacity/full readable, subtle brass border + `FULL`, no flashing. Less vertical/horizontal waste.
- Top-level mobile: world takes most space, controls at edges, bottom nav large, resources compact, map controls reachable, notifications don't cover buildings, comfortable touch targets.
- Clutter budget at normal zoom: priority 1 combat danger, 2 selected object, 3 major quest/event, 4 collection readiness, 5 routine worker info. Low-priority collapses at lower zoom.
- Animation: fly subtly to HUD if cheap OR pulse/disappear; short; no large repeated sound.

## Implementation order (Sol, one at a time)

- Task A: Audit production, caps, sinks. No code changes. Concise findings.
- Task B: Collection marker logic. Small icons + density/zoom.
- Task C: Collect Ready / aggregate. Reuse banking/overflow.
- Task D: Resource HUD polish. Mobile first.
- Task E: Repeatable sinks. Existing systems first.
- Task F: Late-game production vs spending balance.
- Task G: Mobile clutter/performance validation.

Economy success: player asks "What should I spend these on?" not "Why is everything full again?" Settlement visible first, not twenty floating buttons. World is the interface.
