# PRESENTATION PASS — HANDOFF (phases 7–20)

Status: written 2026-09-28 at `main @ 5af5588`, after phases 1–6 shipped.
Audience: any capable coding agent (ChatGPT/Codex/Claude/Gemini/OpenCode) taking
over the presentation pass. You do not need this session's history — everything
is in this file and the repository.

---

## 1. The job

**Repo:** https://github.com/lifetimeballer1/midnights-manner (public).
**Live game:** https://lifetimeballer1.github.io/midnights-manner/
**Mission:** a 20-phase "presentation pass" — visual/gameplay polish layered on
a finished game. Phases 1–6 are done (lighting, weather, AO/shadows/vignette,
housing silhouettes, production state). **Your job: phases 7–20, one at a time.**

**Locked decisions (do not relitigate):**
- Balanced visuals + gameplay (readability beats drama; mobile-first).
- Strict save compatibility: additive optional fields only; no save-version
  bump unless a field truly can't be derived.
- Mobile 60fps: no per-frame allocations in the draw loop, respect
  `prefers-reduced-motion` (`renderer.calm`), verify with `?perf` +
  `npm run capture`.
- Data-driven rules (README "Data-driven extension guide"); docs
  (`README.md`, `AGENTS.md`, `docs/LIGHTING.md`) stay honest per phase.

## 2. Stack + how to run anything

Vanilla JS ES modules, HTML5 Canvas, no runtime deps, no bundler.

```sh
gh repo clone lifetimeballer1/midnights-manner && cd midnights-manner
node --test tests/*.test.js     # expect 474 passing at handoff
npm run build                   # dist/ (342 precache entries at handoff)
npm run dev                     # python3 -m http.server 4173, open /index.html
CHROME_BIN=<chrome|edge> npm run test:browser   # real-UI smoke (needs build first)
```

- Windows local dev is supported: `npm test` works, browser smoke works with
  Edge: `CHROME_BIN="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`.
  Both harness scripts tree-kill the browser (`taskkill /T`) — do not remove
  that, it prevents shell hangs from crashpad children.
- CI (`.github/workflows/pages.yml`): tests + build + browser smoke on PRs and
  `main`; **only `main` pushes deploy**; a browser-smoke failure blocks deploy.
- Never force-push. Another worker shares this repo (a multiplayer PR landed
  mid-pass): `git fetch` before pushing and **rebase if `origin/main` moved**;
  then re-run tests/build/smoke and update any test-count numbers in docs.
- No secrets in the client. No external art assets (original placeholder
  sprites only; optional dev-only `@napi-rs/canvas` for review sheets, install
  with `npm install --no-save --no-package-lock`).

## 3. The verification harness (from phase 1 — use it every phase)

- `npm run capture` (`scripts/look-capture.mjs`): deterministic screenshots —
  dawn/day/dusk/night, day-rain, night-fog, phone-night — to `artifacts/`
  (gitignored). Pins camera + calm motion + a clear sky via the test-only
  `window.midnightsManner.setElapsed(sec)` / `setCamera({yaw,pitch,zoom,x,y})`
  hooks in `src/main.js` (they touch transient view/clock state only).
- `?perf` badge + `window.midnightsManner.frameReport()` → frame avg/p50/p95
  plus painted and cached face counts. **Headless numbers are software-rendered
  (p95 ≈ 66–83 ms is the local baseline)** — treat them as relative signals,
  not the mobile budget.
- Review sheets for actual meshes (optional canvas package):
  `node scripts/detail-preview.mjs` (structures+people),
  `node scripts/housing-preview.mjs` (cottage tiers + longhouse day/night),
  `node scripts/production-preview.mjs` (producer stockpiles by step).
  Write new ones in this style when a phase needs mesh review.
- `tests/lighting-baseline.test.js` freeze protocol: raw geometry digests,
  frozen-light formula equality, day/night/dawn painted digests. **Any phase
  that changes geometry or shading must update those digests deliberately, in
  the same commit, and say so in the changelog.** Face digests are
  order-canonical (sorted) because `paint()` depth-sorts.

## 4. What phases 1–6 shipped (so you don't redo or break it)

| Phase | Content | Key files | Commit |
|---|---|---|---|
| 1 | Baseline harness: look-capture, test hooks, face counters, Windows smoke fix, shading characterization | `scripts/look-capture.mjs`, `src/main.js`, `tests/lighting-baseline.test.js` | `2721334` |
| 2 | Midnight lighting core: `skyLightAt()` resolver, paint-time `shade()`, emissive windows/flames, crossfade + `calm`, data overrides under `world.daynight.lighting` | `src/systems/daynight.js`, `src/scene3d.js`, `docs/LIGHTING.md` | `47db0c1` |
| 3 | Sun/moon arcs (`key.arc`), weather on meshes (`weatherLightAt`, fog veil + rain dim), fire flicker glow | same + `src/renderer.js` | `eedbe78` |
| 4 | Ground-contact AO per face, contact shadows that swing with the key arc, phase vignette, moon glow sweep | `src/scene3d.js`, `src/renderer.js` | `18785ca` |
| 5 | Housing silhouettes: cottage loft (t2) / porch + raised stack (t3); longhouse meadhall; `hut(...,chimney)` flag | `src/scene3d.js`, `scripts/housing-preview.mjs` | `2b53e46` |
| 6 | Production state on meshes: four-step stockpiles per resource + gold pennant at `reserveReady`; mesh cache keyed on quantized stage | `src/scene3d.js`, `tests/production-viz.test.js`, `scripts/production-preview.mjs` | `5af5588` |

Invariants you must keep green (pinned by tests):
- Day light reproduces the legacy fixed-light formula byte-for-byte against a
  frozen light at flat AO; raw geometry digests frozen per deliberate update.
- The **sky clock never rebuilds the static mesh cache**; reserves repaint only
  at quantized steps; camera rotation invalidates only what it must.
- `renderer.draw()` never mutates game state/saves; `npm test` 474 passing
  includes save-blob/migration and old-save fixtures.
- Data reads are defensive: bad overrides clamp/fall back, never black-screen.

## 5. Remaining phases (the original brief, verbatim scope)

7. **Walls/gates/traps** — connection-aware silhouettes (corners, ends, caps),
   gate state/animation, trap armed/sprung readability.
8. **Character/tool silhouette** — `src/character-art.js` `equipment()`: every
   held tool/weapon needs a distinct mesh (sword/axe/warhammer/pike/longbow…),
   profession outfits readable at gameplay zoom.
9. **Rarity/profession** — visual language for item rarity + profession
   identification (trim/glow/accents), still data-driven off `items.json` /
   `troops.json`.
10. **Input/camera** — polish `src/input.js` + `src/camera.js` feel; keep
    picking tests (`modelPoints`, orbit tests) green.
11. **HUD/drawers/onboarding** — mobile pass on `src/ui.js` drawers, first-run
    guidance; keep focus containment + labels.
12. **Sound + music** — NEW `src/music.js` + `data/music.json`: generative
    WebAudio score (original composition, no rips), starts on "Enter village",
    respects `opt-sound` + `calm`; extend existing `src/systems/audio.js` SFX.
13. **Juice** — pooled particles/shake/numbers (replace ad-hoc effects caps
    with a pool), calm-mode parity.
14. **Economy pacing** — tune against `docs/BALANCE_ECONOMY_TARGETS.md`.
15. **Defense factions** — presentation/hook-up on top of the existing
    `world.homeRaids.director`, `enemyFactions`, `enemyRoles`.
16. **Midnight events engine** — NEW `data/events.json` + system reading the
    day/night clock; additive save tokens only.
17. **Quests/rumors/wishes** — wire wishes into the quest/rumor systems.
18. **Tech tree hook** — UX/visual hook-up for `world.technologies`.
19. **Perf/a11y/saves** — full budget gate (mobile-60fps evidence), a11y audit,
    save-compat matrix.
20. **Verify + ship** — expanded browser smoke, docs/CHANGELOG final, confirm
    the Pages deploy.

## 6. Per-phase workflow (follow exactly)

1. Read `README.md` + `AGENTS.md` + the relevant source before editing.
2. Spec the phase in the reply (short); if it's visual, state what the review
   artifact will be.
3. Implement + tests (tests grow; never delete other workers' tests).
4. `node --test tests/*.test.js` → green; `npm run build` → green;
   `CHROME_BIN=… npm run test:browser` → green.
5. `npm run capture` (and/or a preview sheet) → **review the images** and
   describe what you saw honestly.
6. Update `CHANGELOG.md` (header style: `## Presentation pass — Phase N: …`),
   README counts/paragraphs, and `docs/LIGHTING.md` if lighting-adjacent.
7. `git fetch` → rebase if needed → re-verify → commit (`Presentation PhN …`)
   → push to `main` (deploys Pages). Never force-push.

## 7. Environment notes for a fresh machine

- Node ≥ 22 (24 verified), Python 3 for the dev server, Chrome or Chromium Edge
  for browser tests. No `npm install` needed for the game itself.
- The repo's own `docs/NEXT20_DESIGN.md` is the *old content roadmap* (Acts
  V–VIII, shipped). This file is the *presentation pass* roadmap — different
  program, same repo.
- If using OpenCode with an `opencode-go` model and you hit a 403 RegionError,
  either opt in at the workspace link shown in the error or temporarily set
  `model`/`small_model` to `opencode/deepseek-v4.1-flash` in
  `~/.config/opencode/opencode.jsonc`.
- `artifacts/` and `dist/` are gitignored — regenerate, never commit them.
