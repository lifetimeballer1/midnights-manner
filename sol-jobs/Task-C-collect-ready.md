# SOL TASK C — Collect Ready / Aggregate (queued, do NOT start until Muse releases)

Scope: src/game.js harvest/collectAll, src/systems/storage.js depositCentral, src/ui.js collect-all button, src/systems/audio.js (single batch sound).
Goal: compact edge-anchored Collect Ready collects everything that fits; partial-banking respected (collect what fits, leave rest on-site, never destroy overflow). Full → explain `X storage full — N waiting here.` One collection sound per batch. Optional long-press expand: Collect Gold/Food/Wood/Frostwood — no permanent map buttons.
Reuse existing banking/overflow logic. Gate: needs Task B.
