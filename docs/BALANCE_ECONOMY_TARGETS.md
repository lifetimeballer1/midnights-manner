# Target Economy Sheet — Midnights Manner

Design targets for tuning buildings, collectors, costs, and rewards.
Numbers are **goals for a competent player**, not minimums or maximums.

Use this sheet when changing `rate`, `cost`, `tiers`, recruit costs, or level/quest rewards.
If live income drifts far outside the bands, retune data — do not paper over with bigger rewards.

---

## 1. Design pillars (economy)

1. **Opening is generous** (0–5 min). Player should feel progress every 20–30 seconds.
2. **Mid game asks for decisions** (5–20 min). Scarcity of *one* resource at a time is good; scarcity of all three is bad.
3. **Late game is about allocation**, not AFK income. New buildings open sinks and identity, not infinite passive.
4. **Collectors + assignments beat pure passive** after the opening.
5. **Rewards are treats**, not the main engine. Quest/level dumps should not erase 5+ minutes of scarcity.

---

## 2. Resource roles

| Resource | Role | Should feel like |
|----------|------|------------------|
| **Food** | Population + stability | Beds and mouths; running out pauses growth |
| **Wood** | Construction + repair | Always needed; primary build gate |
| **Gold (moonstone)** | Upgrades, troops, gear, wards | Prestige currency; slightly tighter than wood |
| **Frostwood / plate** (late) | Specialty tiers only | Rare sinks; never required for basic survival |

Rule: a healthy village is never soft-locked out of *all* building for more than ~60s if the player has been expanding nodes.

---

## 3. Village level income targets

**Net income** = passive buildings + collectors delivering − nothing spent.  
Measure over a 60s window with no builds/recruits, competent assignment (most workplaces filled), no raid.

### Target bands (per minute)

| Village level | Food / min | Wood / min | Gold / min | Notes |
|---------------|------------|------------|------------|--------|
| **1** (opening) | 8–14 | 6–12 | 4–8 | 1–2 farms, lumber, maybe mine; few collectors |
| **2–3** | 14–22 | 12–20 | 8–14 | Specialists online; still pre-throttle or early throttle |
| **4–5** | 18–28 | 16–26 | 12–20 | Mid-game; throttle active; auras matter |
| **6–7** | 22–34 | 20–32 | 16–26 | Full roster pressure; dual food sources |
| **8–9** | 26–40 | 24–38 | 20–32 | Prestige toys; do not double passive rates |
| **10–11** | 28–45 | 26–42 | 22–36 | Ceiling: allocation and combat, not more AFK |

**How to read the bands**
- Below band → nodes/rates too low, or assignment UX failing.
- Above band by >30% → passive too strong, or rewards stacking with production.
- Gold should usually sit **slightly under** wood at the same level.

### Passive vs collector split (target)

| Phase | Passive share of income | Collector share |
|-------|-------------------------|-----------------|
| 0–5 min | ~60–70% | ~30–40% |
| After 300s | ~40–50% | ~50–60% |
| Late (L7+) | ~35–45% | ~55–65% |

If passive alone hits the full band, collectors are optional — retune down.

---

## 4. Mid-game throttle (300s)

**Current:** step to 0.75 passive / 0.85 collector after 300s.

**Target feel:** income drops ~15–25% from the end of the opening, not 40%+.

**Preferred future shape (when you touch code):**
- Lerp from 1.0 → 0.75 (passive) and 1.0 → 0.85 (collectors) over **300s–600s** elapsed.
- Or: keep step but ensure level-4 band is still reachable with full assignments.

**Do not** compensate a harsh throttle with huge level-up caches; that teaches players to ignore production.

---

## 5. Spend pressure targets

What a competent player should be able to afford **without** mission rewards:

| Milestone | Time / level guide | Afford without selling the farm |
|-----------|--------------------|----------------------------------|
| 2nd farm + pond | < 3 min | Yes |
| First cottage + 2 assigns | < 5 min | Yes |
| First tower or trap line | Level 2–3 | Yes after one short gather sprint |
| Barracks + 2 fighters | Level 3–4 | Tight but possible |
| Tier-2 on main economy buildings | Level 4–5 | Requires deliberate saving |
| Tier-3 | Level 6+ | Should feel like a decision (which node upgrades first) |
| Longhouse / big housing | Level 5+ | Gold+wood sink; OK if it pauses other upgrades |

**Upgrade cost rule of thumb**
- Tier 2 ≈ 1.5–2× time of tier-1 build in resource-minutes.
- Tier 3 ≈ 2.5–3.5× tier-1 (current ×1.5 cost multiplier is in the right family if rates match bands).

**Recruit rule of thumb**
- One basic collector ≈ ~30–45s of village income at current level.
- One combat recruit ≈ ~45–90s.
- If a full barracks fill costs >5 minutes of total income, recruits are too expensive.

---

## 6. Housing & growth

| Target | Number |
|--------|--------|
| Time to pop 8 (quest) | 6–12 min for attentive player |
| Time to pop 12 | 12–20 min |
| Growth while at food soft-cap | Slow or paused (current design OK) |
| Growth while beds full | Paused |
| Post-raid recovery to positive food | < 90s if farms/ponds intact |

Beds before bodies must remain true. Do not fix slow growth by deleting the food gate.

---

## 7. Combat economy budget

**Home raids (Test defenses / scheduled)**

| Village level | Raiders (approx) | Player should hold with |
|---------------|------------------|-------------------------|
| 1–2 | 2–4 | Walls + 1 tower or 2 fighters |
| 3–4 | 4–6 | Basic perimeter + mixed troops |
| 5–6 | 5–8 | Upgraded towers/traps + assignments |
| 7+ | Up to max curve | Layout skill matters; not raw HP inflation only |

**Repair after a won raid:** salvage + normal income should cover repairs in < 2 minutes.
**Manor loss:** salvage wood enough to restart core loop; not a full wipe of progress.

**Campaign missions**
- Objectives should take **50–80% of the timer** for a competent run with the troop cap.
- Finishing in <40% of timer = objective too low or rates too high for mission map.
- Consistent fails at 100% timer with full troop cap = objective too high or map income too low.

---

## 8. Reward budgets (quests, levels, missions)

| Source | Target size |
|--------|-------------|
| Early quest (60 XP steps) | ~20–40 of one resource |
| Mid quest (100–150 XP) | ~40–80, or mixed |
| Level-up cache L2–4 | ~30–60 one resource |
| Level-up cache L5–7 | ~100–200 mixed; **≤ 3 minutes** of target income |
| Level-up cache L8+ | Larger OK but **≤ 5 minutes** of target income |
| Mission first-clear | Meaningful unlock + **≤ 4 minutes** of home income equivalent |

If a single reward exceeds ~5 minutes of target income at that level, it flattens the economy.

---

## 9. Trader / calendar

| System | Target |
|--------|--------|
| Trader deals | Convert surplus → shortage at ~10–25% efficiency loss (not 1:1) |
| Deals per day | Capped; cannot replace nodes |
| Calendar daily bonus | ≤ +10% on one axis |
| Seasonal week | ≤ +5–10% feel; flavor first |

---

## 10. How to measure (practical)

1. **Stopwatch window:** at a given save/level, idle 60s with no builds; note Δ food/wood/gold.
2. **Multiply by 60** for per-minute; compare to the band for that `vlevel`.
3. **Repeat** with all relevant workplaces assigned vs none — gap is the collector contribution.
4. **Afford test:** from a clean state at that level, time-to-afford the next milestone in section 5.
5. **Raid test:** standard layout, note win/loss and repair time.

Optional: add a debug overlay later (`?econ`) that prints rolling 60s income. Until then, manual measure is enough.

---

## 11. Tuning order when something is wrong

1. **Node `rate` / tier multipliers** (buildings.json) — primary lever.
2. **Collector gather rate / carry** (troops + items) — secondary.
3. **Costs** (build/recruit/upgrade) — if income is correct but feels poor.
4. **Throttle curve** — if mid game cliffs.
5. **Rewards** — last; only if the loop is healthy and spikes are the issue.

Never buff rewards to hide weak nodes.

---

## 12. Quick reference card

```
Opening (L1):     F 8–14   W 6–12   G 4–8    /min
Early (L2–3):     F 14–22  W 12–20  G 8–14   /min
Mid (L4–5):       F 18–28  W 16–26  G 12–20  /min
Late mid (L6–7):  F 22–34  W 20–32  G 16–26  /min
Late (L8–9):      F 26–40  W 24–38  G 20–32  /min
End (L10–11):     F 28–45  W 26–42  G 22–36  /min

Passive share after 5 min: ~40–50%
Collector share after 5 min: ~50–60%
Level reward ≤ 3–5 min of income at that level
Mission objective: 50–80% of timer for a good run
```

---

*Keep one light. Mend the rest.*

Document version: 2026-09-27 — initial targets from balance review of main data and economy throttle design.
