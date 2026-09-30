# TASK A FINDINGS (Sol, gpt-6.1-sol, read-only audit)

No code changed. Assumptions: final base maxCount, tier 3 where available, tier-3 Hall + 6x tier-3 Storehouses + tier-3 Grand Granary, no Renown/conquest bonuses.

## Production vs caps (full-node, per min; sustained lower as nodes drain)
- Food: 4,392 peak / 2,685 sustained; cap 127,000; fill ~29 min; on-site 30,000
- Wood: 2,088 / 1,320; cap 118,000; fill ~57 min; on-site 12,500
- Gold: 1,998 / 1,350; cap 79,500; fill ~40 min; on-site 10,500
- Frostwood: 540 / 480; cap 23,100; fill ~43 min; on-site 4,000
- Plate: 162 / 162; cap 23,100; fill ~143 min; on-site 3,000
- Lumber/flour/bread caps: 38,000 / 44,000 / 44,000; no passive producer; 3x tier-2 sawmills = 360 lumber/min; 3x tier-2 mills = 108 bread/min consuming 540 food/min
- On-site fill 4.6–13.9 min depending on producer

## Sinks (live prices)
- Meal: 5N food + 1N bread per 180s (avg 1.67N food + 0.33N bread/min)
- Renown: 500 gold, 400 food, 30 lumber, 20 bread, 6 plate, 3 frostwood x 1.35^R; no wood/flour
- War Chest: Rations 600 food/120 bread; Arrows 300 lumber/20 plate; Wagons 400 wood/120 lumber; Armor 40 plate; Stakes 150 frostwood
- Festivals: Harvest 1500 food/200 bread/100 gold (600s cd); War 800/300/150 (480s); Founder's 4000/800/1500/100 frostwood (900s)
- Projects (stage 1; stages 2/3 = 2x/6x, finite): Market 2500 lumber/1200 gold/15 plate; Granary 2500 wood/2000 lumber/400 gold; Gardens 1500 wood/1200 food/800 gold; Monument 2500 gold/50 plate/150 frostwood
- Bulk: Provender 12000 food+3000 bread -> 1400 gold (lvl7, 1/day); Northern 7500 lumber+2000 plate -> 650 frostwood (lvl8, 1/day)
- Flour has no direct sink; bread conversion only outlet

## Top bottlenecks (reuse existing sink)
1. Food — biggest output, meal small, Provender gated on 3000 bread (~28 min mill output). Push through meal/festival baskets.
2. Wood — absent from Renown/bulk; wagon spends only 800 wood full. Raise Repair Wagons wood basket.
3. Flour — +216 net/min with no direct basket. Raise flour consumption in bread recipe.

## Caveats
- Dashboard hides full-reserve production but tickEconomy still drains living nodes while clamping harvest stock; dashboard recipe ledger ignores input/output room — not actual banked throughput.
