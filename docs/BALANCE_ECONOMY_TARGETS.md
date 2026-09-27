# Target Economy Sheet — Midnights Manner

Design targets for tuning buildings, collectors, costs, and rewards.
Numbers are **goals for a competent player**, not minimums or maximums.

## Per-minute income bands (assigned workplaces, 60s measure)

| Village level | Food / min | Wood / min | Gold / min |
|---------------|------------|------------|------------|
| 1 (opening) | 8–14 | 6–12 | 4–8 |
| 2–3 | 14–22 | 12–20 | 8–14 |
| 4–5 (mid) | 18–28 | 16–26 | 12–20 |
| 6–7 | 22–34 | 20–32 | 16–26 |
| 8–9 | 26–40 | 24–38 | 20–32 |
| 10–11 | 28–45 | 26–42 | 22–36 |

## Mid-game throttle (implemented)

- Full rates until **300s** elapsed.
- Linear ease to floor by **600s**: passive/reserve fill → **0.75**, collectors → **0.85**.
- Upgrade build time eases with the same curve (up to 1.5× at floor).

## Passive vs collector share

| Phase | Passive | Collectors |
|-------|---------|------------|
| 0–5 min | ~60–70% | ~30–40% |
| After ramp | ~40–50% | ~50–60% |

## Reward budget

Level/mission caches should stay ≤ **3–5 minutes** of target income at that level.

## Measure

Idle 60s at a given `vlevel`, no builds; Δ resources × 1 = per-minute. Compare to bands. Tune `rate` / costs before rewards.

*Keep one light. Mend the rest.*
