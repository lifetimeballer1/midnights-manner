# SOL TASK A — Economy Audit (READ-ONLY, no code changes)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

Repo root: C:\Users\Bubs\midnights-manner
Read-only: use --sandbox read-only. Do NOT edit files. Do NOT run build. `npm test` read is allowed but do not modify.

## Scope (only these files)
- data/buildings.json (production rate, harvest.capacity/perTier, maxCount, storage)
- data/world.json (storageBase, storageSettling, townMeal, warChest, renown pointer)
- data/endgame.json (renown.baseCost/costGrowth/rewards), data/traders.json (bulk valves provender-run, northern-caravan), data/festivals.json, data/conquest.json
- src/systems/economy.js (midgameRate, reserveMult, collector loop), src/systems/storage.js (storageCap, depositCentral, settlingRate), src/systems/dashboard.js, src/systems/food.js, src/resources.js (reserveCapacity, CROWDED_READY_THRESHOLD)

## Deliverable
Return concise findings (max ~40 lines):
1. Late-game production per minute by resource for a developed settlement (assume tier-3 producers at maxCount, midgameRate floor applied). Show math.
2. Central caps vs on-site reserve caps. Time-to-fill storage from empty at that production.
3. Existing sinks with live prices: townMeal basket, next Renown cost, warChest investments, festival costs, open Town Projects stages, bulk trader deals. Which resource has no good sink?
4. Top 3 surplus bottlenecks ranked (resource, why it piles up).
5. One-line recommendation per bottleneck reusing an existing sink (no new systems).

Do NOT propose new currencies, starvation penalties, or duplicate building systems. Do NOT send back the master plan. Audit only.
