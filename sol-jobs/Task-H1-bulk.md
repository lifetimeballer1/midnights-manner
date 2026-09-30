# SOL TASK H1 — Bulk Commissions (data-only, scoped)

You are Sol (GPT-6.1). Muse owns design. Do exactly this task, nothing else.

## Scope
- `data/traders.json` (add deals), `data/world.json` only if a level gate needs wiring
- `tests/phase6-valves.test.js` (extend with new-deal checks in the existing style)
- README: append a short `### Grey Dawn H1` section documenting the new deals

## Precedent (follow exactly)
- `road-timber-order`: `{id, trader, flavor, give:{...}, take:{...}, minLevel, cap:1}` — bulk surplus in, modest single payout out, lossy rate, daily cap, existing rotation + Phase 1 room check. Nothing else.

## Add three deals (all cap 1/day, minLevel 7–9)
1. **Armory Contract** (minLevel 8): give plate + gold → take: army training progress. Simplest honest payout through the trader pipeline is gold-neutral craft stock is NOT allowed (no new currency tricks) — pay out in `take: {gold}` at a lossy rate like the precedent OR grant equipment-adjacent goods already supported by `take` keys. Check what `take` keys performTrade supports (existing deals use gold, frostwood) and stay inside those keys.
2. **Harvest Shipment** (minLevel 7): give food + bread → take gold at a lossy bulk rate (mirrors provender-run but larger and once daily).
3. **Frostwood Commission** (minLevel 9): give frostwood + plate → take gold (large, lossy) — high-tier surplus outlet.

## Rules
- No new currency, no new `take` key support code — data only. If a payout you want needs code, pick a supported key instead.
- Lossy rates (bulk in, modest out), one run a day each, level-gated 7–9.
- Exact payment, room-check refusal before any cost moves (existing behavior — do not reimplement).
- After edits run `npm test` only. Report pass/fail plus files changed. Do not start H2.
