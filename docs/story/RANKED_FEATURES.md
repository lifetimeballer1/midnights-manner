# Ranked Feature & Content Additions — Lore Expansion Branch

All proposals respect the single-player, local-save, no-server contract. Ranked by leverage vs. implementation risk against the current vanilla-JS + JSON architecture.

## Completed on this branch

- **Expanded LORE.md** — full structured bible with cosmology, ages, factions, power system, open questions.
- **Living Workplace Keepers** — `docs/story/KEEPERS.md` + `data/keepers.json` (8 named seniors with agendas, wants/needs, relationships, state-aware dialogue).

## High Leverage / Low Risk (Data + Flavor + Light UI)

1. ~~Living Workplace Keepers~~ **DONE**
2. **Notice Board Engine**  
   Already sketched in MMO_FEEL.md and partially present as `rumors.json` / `traders.json` on main. On this branch: deepen the voice so every rumor and trader line speaks in the expanded lore (competing Thinning accounts, faction soft news, Grey Market tales). Pure data.
3. **Manner Memory / Hall Book**  
   After major events (raid, mission return, level-up, first of a profession), append a short dated entry the player can re-read. Issa and the Mooncleric are the natural voices. Simple array in the save + small UI panel.
4. **Lunar / Seasonal Calendar (Local Date Math)**  
   `calendar.json` already exists on main. Align flavor text with the expanded lore.
5. **Environmental Storytelling Hotspots**  
   Make a handful of existing map elements selectable (old terraces, bent clapper, tollman’s hat, Signal Watchfire, Maro’s sill mark). Yield short flavor text or tiny one-time bonuses.
6. **Expanded Quest Flavor**  
   Richer `giver`, `flavor`, and `act` fields that reference the keepers by name.

## Medium Leverage / Medium Risk

7. **Faction Soft Reputation (Local Only)**  
   Track simple counters (ransomed poachers, paid tolls, ignored warnings). Slightly alters raid composition, trader offers, or notice-board tone.
8. **Campaign Fingerprints on Home Village**  
   First-clear mission rewards can permanently unlock a small cosmetic or functional improvement on the home map.
9. **Charter / Guild Labels**  
   Workplaces with 3+ posted villagers earn a local charter name and a tiny passive.
10. **One New Profession + Workplace Pair** (only if needed later)

## Explicitly Out of Scope

- Real multiplayer, co-op, PvP, shared raids
- Cloud saves, cross-device sync, global leaderboards
- Server-pushed events or daily ops
- Anything that uploads player data
- Turning raiders into monsters or adding a dark-lord plot
- Returning the sun or ending the Long Dusk

---

**Recommended next step on this branch:**  
Deepen the Notice Board / Rumor / Trader voice so it speaks in the full expanded lore, using the keepers as natural sources of gossip and warning.

All work remains exclusively on `lore-expansion`.
