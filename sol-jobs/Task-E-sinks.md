# SOL TASK E — Repeatable Sinks (queued, do NOT start until Muse releases)

Scope order (existing systems first): data/world.json townMeal → Well Supplied extension (new src/systems/supply.js or extend food.js, merge into auras()); data/endgame.json renown; data/world.json warChest + data/festivals.json; Town Projects (project flag, costCurve, flatAuras in data/buildings.json); data/traders.json bulk valves; data/conquest.json outpost/frontier supply upkeep.
Rules: no new currency, no harsh starvation/death (lose bonus only), exact-cost purchases, additive save fields with safe defaults, no duplicate building systems, Auto-Upgrade uses exact normal cost with protected reserves.
Gate: needs Task A + Muse approval of which sink first (Well Supplied first).


Implementation: Well Supplied first, extending food.js (no separate supply module). Completed daily settlement and conquest upkeep, Resources/Well Fed-adjacent chip, and food/wood/flour outlets through Renown, War Chest, Festivals, existing civic Project costs and trader rotation. No new currency or duplicate building pipeline. Territorial shortfall pauses auras, retaining land and building limits. Existing auto-upgrade pricing contracts remain unchanged; no People automation implemented. Tasks F-G remain untouched. See README's Grey Dawn Task E entry for extension fields and initial basket behavior.
