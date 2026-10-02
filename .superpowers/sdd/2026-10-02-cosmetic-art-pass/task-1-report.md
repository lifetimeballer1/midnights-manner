# Task 1 Characters Resume Report

Date: 2026-10-02
Status: BLOCKED on targeted verification; no commit created.

## Verification

Ran the requested command twice without rebaking:

```sh
node --test tests/baked-r4-characters.test.js tests/baked-r3.test.js tests/character-art.test.js
```

Both runs reported 27 tests: 26 passed, 1 failed, 0 skipped.

Failure: `r4 baked professions retain data-colored accents and distinct work headwear`, at `tests/baked-r4-characters.test.js:86`, assertion at line 88: `warrior profession color`.

The baked branch in `src/character-art.js:365-376` draws the baked body and the miner lamp but does not draw a profession-colored accent. The existing profession-colored sleeve is inside the procedural fallback at line 392. Procedural work headwear is also in that fallback. The failing test stops at the warrior assertion, so its subsequent headwear assertions have not been verified.

The remaining targeted tests passed, including the 80-file pose library, color floor, welded vertices, anchors, source hashes and CC0 license checks, held-tool attachment, miner lamp, Calm stability, LOD and procedural fallback checks.

## Repository Handling

Read README.md, including the original brief. Inspected git status, the approved text-file diff, and the latest ten commits.

No assets were regenerated. No implementation files, exports, signatures, gameplay or existing contributor changes were edited. No files were staged. No commit, merge, rebase or push was performed. Requested commit message remains pending:

```text
art(r4): KayKit character rebake + luminance/seam fixes
```

Unrelated untracked files were left untouched:

- `assets/meshes/hexagon-stone-rail.json`
- `assets/meshes/hexagon-wood-rail.json`

`data/external_assets.json` and `docs/ASSET_CREDITS.md` had no working-tree diff at inspection time. The existing rebake and its test remain uncommitted. This report is the only file created by this resume attempt and is not staged.

Full `npm test`, build and browser checks were not run; no deployment is claimed.

## Next Decision

Confirm whether to repair the baked profession accents/headwear without rebaking, then rerun the exact targeted command before staging only the approved paths and creating the requested commit.

## Fix Round 1/5

Date: 2026-10-02
Status: FIXED; targeted verification 27/27 green.

Reproduced the original failure before editing: 26 passed, 1 failed at the
`warrior profession color` assertion. The test is correct and was not changed.

Changed only `src/character-art.js` implementation code. After the baked mesh
draw, friendly characters now receive a narrow sleeve accent in the same
`troop.color` used by the procedural path. Its endpoints follow the baked hand
and head anchors. Added compact head-anchor-relative straw brims, work caps,
goggles, hood/robe cues, helmet trim and crests, plus the apron workwear cue.
The existing miner/sapper/diver lamp and its emissive-state restoration are
preserved. These static pose-relative overlays remain Calm-safe. No exports,
save fields, gameplay, baked assets or conversion scripts were changed.

Verification after the fix:

```sh
node --test tests/baked-r4-characters.test.js tests/baked-r3.test.js tests/character-art.test.js
```

Result: 27 tests passed, 0 failed, 0 skipped. `git diff --check` passed with
only Git's existing Windows line-ending warnings. Full npm tests, build and
browser/visual checks were not run; no deployment or visual certification is
claimed.

Commit: `cd1fdf4` - `art(r4): KayKit character rebake + luminance/seam fixes`.
Only `src/character-art.js` was staged and committed, including the existing
R4 renderer edits already present in that approved file. The unchanged,
pre-existing untracked R4 test and all pre-existing mesh, manifest, conversion
script and rail changes remain unstaged/uncommitted. No rebake or push occurred.
This report was appended after the commit and was not staged.

## Judge Fix Wave

Date: 2026-10-02
Status: Scoped fixes implemented; requested tests and full regression suite green.
Commit message: `art(r4): fit character identities and group fringe habitat`.
This report is included in that scoped commit; no push or deployment performed.

Changes:

- Baked professions now carry broad, outward-facing flat-hex clothing panels in existing troop colors, with distinct aprons/work belts and head-anchor-following headwear above the selected mesh envelope. Open hood rims leave the authored face exposed. Tools retain their palm grip and use a fixed outward cant for body separation.
- Baked characters retain their complete selected LOD at 1.0x instead of generic area-based truncation that could remove the face and limbs. Missing/disabled assets still use the procedural fallback.
- Regenerated only eight monk pose/LOD files. Monk head/hat reduction preserves the neck pivot; separate face, torso and limb simplification budgets protect low-LOD anatomy. High LOD has 421 faces, low LOD 155-160, within existing 450/180 budgets. Grounding and 1.1-tile stand height remain intact. Only the monk manifest entry changed; all non-monk bakes remain untouched.
- Thornband uses a fitted open cowl attached to the baked head/bounds. Role profiles follow baked anatomy or carried siege hand anchors, while faction armor remains on the body. Scout cues survive below the 1.8 detail cutoff; ram, bombard, elite and boss profiles remain distinct.
- Wild shrubs, grass, reeds and stones/rocks form bounded deterministic three-part groups with scale variation inside their selected unoccupied tile. Claimed center geometry, palettes, footprint exclusion, static seeds and 50/85/130 scenery caps remain unchanged.
- Character tests now invoke `characterModel(..., true)` across five factions and seven role variants at 1.0x/1.65x, check actual wood grip attachment, head-cowl attachment, body-attached siege faction cues, visible clothing from opposite angles and Calm stability. Environment tests check local bounds, bounded faces, larger primary forms and Calm/time invariance.

Verification on the final implementation:

```sh
node --test tests/baked-r4-characters.test.js tests/baked-r3.test.js tests/character-art.test.js tests/enemy-silhouettes.test.js tests/terrain-r4-biomes.test.js tests/biomes.test.js tests/environment-art.test.js
npm test
npm run build
npm run capture
```

- Requested targeted command: 55 passed, 0 failed, 0 skipped.
- Full `npm test`: 1296 passed, 0 failed, 0 skipped.
- Build: successful, `0.3.0-aa53a5eb2fd22971`, 763 precached assets.
- Capture with local Microsoft Edge: seven desktop/phone phase/weather images generated, no runtime exceptions. Inspected desktop day and phone night captures. Capture telemetry reached Low quality; it is not a performance certification or an all-profession/role comparison sheet.
- Independent code review caught panel winding and siege faction-proxy errors; corrected both and added regression coverage. Follow-up review found no remaining concrete regressions in those corrections or actual grip attachment.
- `git diff --check`: passed, with existing Windows line-ending warnings only.

No gameplay, balance, troop/biome data, save fields, public renderer exports/signatures, UI or building art changed. Calm remains time-invariant under the tested compositions. A renewed independent visual score is still required: test and capture results do not certify the requested 90+ verdict. Full browser interaction smoke was not run.
