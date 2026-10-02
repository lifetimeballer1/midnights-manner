# R1+R2 report — rigged character toolchain and Warrior pilot

Date: 2026-10-01 · Repo: midnights-manner · Author: tools-engineer dev-rig session

Scope constraints respected: nothing under `src/`, `data/` or `tests/` was modified, no commit and no
push was made. Pre-existing working-tree edits by other contributors (`src/*`, `data/art-manifest.json`,
`tests/*-replace.test.js`) were left untouched. All new files live under `scripts/dev-rig/`.

## 1. Environment

| Tool | Version | Notes |
| --- | --- | --- |
| Python | 3.11.0 | `pip 22.3`; `pip install --user fast-simplification` **succeeded** (0.2.0) |
| numpy | 2.4.6 | already installed |
| Pillow | 12.3.0 | already installed (also used by `convert-external-assets.py`) |
| Node | 24.19.0 | `package.json` has `"type":"module"`, so the pilot test is ESM |
| FBX2glTF | v0.9.7 (2020, archived) | Windows x64 exe, 10,550,784 bytes, sha256 `8d90fb5e0a8d186a3d9a7ff8c75eaee541c3975ce4df0d80351f20092ae0877f` |

`bpy` was **not** required. It is installable in principle (`bpy` 4.x ships a cp311 wheel, ~300 MB), and it
would give Blender's native FBX importer/actions, but FBX2glTF + a stdlib GLB parser + numpy skinning is
~10 MB, scriptable, and already proved sufficient for every tested pack. Keep `bpy` as the fallback only if
retargeting/IK/Blender-only processing is ever needed.

## 2. Toolchain chosen

```
Quaternius FBX (rig + actions) --FBX2glTF--> GLB --scripts/dev-rig/bake_poses.py--> game JSON
```

`scripts/dev-rig/bake_poses.py` (new, ~490 lines) does everything offline with the standard library plus
numpy/Pillow/fast-simplification:

1. Parses the GLB JSON/BIN chunks (no runtime or pip glTF library).
2. Samples real animation channels at `fraction × clip_duration` (LINEAR/STEP/CUBICSPLINE, quaternion slerp).
3. Computes node world matrices and CPU linear-blend skinning (`worldJoint × inverseBindMatrix`), plus rigid
   bone-parented meshes (face, shoulder pads, sword) via their animated node transform.
4. Maps glTF right-handed Y-up to the game's Z-up exactly like `scripts/convert-external-assets.py`
   (`x, -z, y`), then scales the stand pose to `--target-height` tiles, centers XZ and grounds every pose at
   `z = 0`.
5. Samples the character texture per triangle (UV centroid) and quantizes to one shared flat palette
   (`--palette-size 28`, threshold 22) so all poses share colors.
6. Decimates with whole-mesh quadric simplification (`fast-simplification`, watertight) and re-colors each new
   face from the nearest source triangle; falls back to per-color reduction + vertex clustering if the
   optional dependency is absent. Final hard cap `--max-faces` (area-ranked).
7. Refits all poses with one shared scale from the simplified stand pose and writes
   `{meta, faces:[{v:[[x,y,z]×3], c:'#rrggbb'}]}`.

### Exact reproduction

One-shot (downloads FBX2glTF + the CC0 pack, verifies sha256, converts, bakes, runs the test):

```sh
python -m pip install --user numpy Pillow fast-simplification
python scripts/dev-rig/rebuild_pilot.py
```

Manual equivalent:

```sh
# 1. converter (Windows; Linux/Darwin assets exist in the same release)
curl -L -o FBX2glTF.exe https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-windows-x64.exe
# 2. CC0 source pack (12,852,133 bytes, sha256 5399e0cfaf313ff362455de4086488d093465434b1b93b0ced649f3773a15fd7)
curl -L -o rpg.zip https://opengameart.org/sites/default/files/rpg_characters_-_nov_2020.zip
# 3. extract "RPG Characters - Nov 2020/FBX/Warrior.fbx" and ".../Textures/Warrior_Texture.png"
# 4. FBX -> GLB
FBX2glTF.exe --binary --input Warrior.fbx --output Warrior.glb
# 5. bake (run from the repo root)
python scripts/dev-rig/bake_poses.py \
  --glb Warrior.glb --texture Warrior_Texture.png \
  --source-url https://opengameart.org/sites/default/files/rpg_characters_-_nov_2020.zip \
  --source-fbx "RPG Characters - Nov 2020/FBX/Warrior.fbx" \
  --out-dir scripts/dev-rig --prefix warrior --target-height 1.1 --max-faces 799 \
  --poses stand:Idle:0.0 walk:Walk:0.5 swing:Sword_Attack:0.45
# 6. verify
node scripts/dev-rig/pilot.test.js
```

`bake_poses.py --list-animations` is the inventory helper used for every FBX below.

## 3. Pack inventory (verified by download and inspection)

| Pack | Creator | License | Direct download | Rig / animation | Contents verified |
| --- | --- | --- | --- | --- | --- |
| RPG Characters (Nov 2020) | Quaternius | CC0-1.0 (`License.txt` in zip) | **Yes**, OGA zip 12.25 MB | **Rigged + animated FBX** (binary, 32-joint armature, 11–15 clips each) + static OBJ + Blend + 1024² painted atlas | Warrior, Ranger, Rogue, Wizard, Cleric, Monk + 6 weapon FBX/OBJ/Blend |
| Animated Monster Pack | Quaternius | CC0-1.0 | **Yes**, OGA zip 1.4 MB | **Rigged + animated FBX** (5–6 stacks each) + OBJ + Blend, no textures (material colors) | Bat, Dragon, Skeleton, Slime |
| Low poly medieval weapons | Quaternius | CC0-1.0 | **Yes**, OGA zip 0.8 MB | Static OBJ + Blend only (no FBX, no rig) | Club, Dagger, DoubleAxe, Katana, LongSword, ShortSword, SimpleAxe, Spear |
| Modular Medieval Buildings | Quaternius | CC0-1.0 | **Yes**, OGA zip 2.6 MB | Static FBX + OBJ + MTL + Blend (no rig) | 30 pieces: towers, walls, gates, well, bridge, banner, dummy, target, windows |
| Animated Human Low Poly | Quaternius | CC0-1.0 | **Yes**, OGA zip 5.0 MB | **Rigged + animated FBX** (10 stacks) + OBJ + Blend | 1 human; idle, jump, punch, run, walk, work, death |
| Blocky Characters 2.0 | Kenney | CC0 | **Yes**, kenney.nl zip 2.15 MB | **Rigged + animated FBX (28 stacks) and GLB shipped directly** + OBJ | 18 characters; static, idle, walk, sprint, sit, drive, die, pick-up, emotes, holding-*, attack-melee/kick, interact, wheelchair-* |
| KayKit Adventurers (free tier) | Kay Lousberg | CC0 (itch asset license) | **No** — itch purchase/download flow; CLI POST `/download` returned 404, file URLs 302 back to the page | Rigged + animated FBX/glTF per page; free tier 5 characters + 25 accessories | page verified only |
| Quaternius Easy Enemy Pack | Quaternius | CC0 per pack page | **No direct zip** — quaternius.com download button opens a public Google Drive folder; itch page requires its own download flow | 5 animated enemies, FBX/OBJ/Blend | page verified only |
| Quaternius Ultimate Monsters / Medieval Village MegaKit / Universal Animation Library / Bestiary | Quaternius | CC0 per pages | **No direct zip** — itch + Google Drive only | rigged/animated or modular per pack | catalog verified on quaternius.com |
| Kenney Nature/Town/Castle, Quaternius Fantasy Props | Kenney / Quaternius | CC0 | already in repo | static | existing `bulk-export.py` pipeline |

Source hashes (sha256) for the packs downloaded during this session:

| File | sha256 |
| --- | --- |
| `rpg_characters_-_nov_2020.zip` | `5399e0cfaf313ff362455de4086488d093465434b1b93b0ced649f3773a15fd7` |
| `Animated Monster Pack by @Quaternius.zip` | `acab2bddc5939f9b1b92c930507d73e0fd80037a39631cf2049bb6cfcaec1acd` |
| `MedievalPack.zip` | `f3c46690903f7b489cdd7b3697bbc56a610872b657d6583604323cf4d80737fb` |
| `Modular Medieval Pack by @Quaternius_0.zip` | `a54ab75eba5eb7ff4a95736bf6d16016684370eebd986e3ef64f281d66290891` |
| `Animated Human by @Quaternius_0.zip` | `dcd72162b5e59495efc629fb624d9e1deb12124b68291ad4fa3ce66b4fc24db3` |
| `kenney_blocky-characters_20.zip` | `5e123859aa0c1598342b600c6db197024a1d63eb9ec531398b310725f589887e` |

License texts are retained under `scripts/dev-rig/sources/`. Per AGENTS.md, shipping any of these in the game
still requires an entry in `data/external_assets.json` and a credits row; the pilot intentionally does not
touch `data/`.

### Clip inventory (RPG Characters, via FBX2glTF)

| Character | Clips |
| --- | --- |
| Warrior (14) | Death, Idle, Idle_Attacking, Idle_Weapon, PickUp, Punch, RecieveHit, RecieveHit_Attacking, Roll, Run, Run_Weapon, Sword_Attack, Sword_AttackFast, Walk |
| Ranger (14) | Bow_Attack_Draw, Bow_Attack_Shoot, Death, Idle, Idle_Attacking, Idle_Weapon, PickUp, Punch, RecieveHit, RecieveHit_Attacking, Roll, Run, Run_Holding, Walk |
| Rogue (12) | Attacking_Idle, Dagger_Attack, Dagger_Attack2, Death, Idle, PickUp, Punch, RecieveHit, RecieveHit_Attacking, Roll, Run, Walk |
| Wizard (15) | Death, Idle, Idle_Attacking, Idle_Weapon, PickUp, Punch, RecieveHit, RecieveHit_Attacking, Roll, Run, Run_Weapon, Spell1, Spell2, Staff_Attack, Walk |
| Cleric (15) | Attack_Idle, Death, Idle, Idle_Weapon, PickUp, Punch, RecieveHit, RecieveHit_Attacking, Roll, Run, Run_Weapon, Spell1, Spell2, Staff_Attack, Walk |
| Monk (11) | Attack, Attack2, Death, Idle, Idle_Attacking, PickUp, RecieveHit, RecieveHit_Attacking, Roll, Run, Walk |

Skeleton (Animated Monster Pack): `Skeleton_Attack`, `Skeleton_Death`, `Skeleton_Idle`, `Skeleton_Running`,
`Skeleton_Spawn`; Bat/Dragon have 6 stacks, Slime 5.

## 4. Pilot results

Poses come from the real Warrior armature and actions — no hand-made geometry. `Idle @ 0.0 s`,
`Walk @ 0.5 × 1.25 s` (the contact/max-stride frame; 0.25 is the passing frame), `Sword_Attack @ 0.45 × 0.833 s`.

| File | Clip | Faces | Height (tiles) | Grounded | Feet Y-span | L/R feet gap | Size |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `scripts/dev-rig/warrior-stand.json` | Idle 0.0 s | 757 | 1.100 | 0.0000 | 0.323 | 0.007 | 77 KB |
| `scripts/dev-rig/warrior-walk.json` | Walk 0.625 s | 758 | 1.141 | 0.0000 | 0.555 | 0.200 | 77 KB |
| `scripts/dev-rig/warrior-swing.json` | Sword_Attack 0.375 s | 755 | 1.120 | 0.0000 | 0.471 | 0.173 | 77 KB |

Each JSON carries `meta` with source zip URL, FBX path, creator, CC0 license, clip name/time/duration,
32-joint armature, 288 animation channels, the 14 clip names, target height and face count. Visual QA renders
(orthographic, painter-sorted) showed a coherent armored warrior: arms at sides with sword held low in stand,
opposite leg/arm swing in walk, sword raised overhead in the swing.

`node scripts/dev-rig/pilot.test.js` (standalone, not under `tests/`, so it does not change `npm test`) proves:

- each file parses and every face is a triangle of finite `[x,y,z]` with a `#rrggbb` color;
- `faces < 800`, `meta.rig.joints === 32`, animation channels > 0, expected clip per pose;
- the three poses have distinct geometry signatures and <80 % vertex overlap;
- the walk pose strides: foot span > 1.3× stand, left/right gap > 0.1 and > stand + 0.05, centroid shift > 0.005;
- every pose is grounded (|min z| ≤ 0.01) and tile-scaled (0.95–1.3 tiles tall, footprint ≤ 1.6 tiles).

Result: `pilot ok` (see table above). Generalization smoke test: the same toolchain baked the Animated Monster
Pack `Skeleton` to 774 faces / 1.0 tile, grounded, using the material-color fallback (no texture); Kenney
Blocky Characters ship GLBs directly and `--list-animations` read all 28 clips without FBX2glTF.

## 5. Recommendation for the full conversion

1. **Keep this pipeline; do not add a runtime skeletal loader.** Bake discrete pose sets offline exactly as
   the existing prop pass bakes static meshes. This matches the Canvas renderer and the
   `enabled:false → phased rollout` contract in `data/external_assets.json`.
2. **Bake the six RPG characters with the same command**, one run per character and pose set. Suggested pose
   set per troop state: `stand` (Idle 0), `walk-a`/`walk-b` (Walk 0.0/0.5, alternating per gait phase),
   `run` (Run 0.5), `attack` (Sword_Attack 0.45 / Bow_Attack_Shoot 0.5 / Dagger_Attack 0.4 / Spell1 0.5 /
   Staff_Attack 0.5 / Monk Attack 0.4), `hit` (RecieveHit 0.4), `death` (Death 0.8). The weapon is already
   parented to the hand in the FBX, so the default loadout comes for free.
3. **Budget faces for the game, not for the pilot.** 757 faces is a fidelity proof; the browser smoke guard is
   30,000 visible faces and a mature village can show 100+ villagers. Recommended bake budgets:
   ~90–140 faces for crowd/distance LOD, ~200–260 for normal gameplay zoom, ~500–700 for heroes/bosses and
   close-up capture. `--max-faces` is the only switch needed; the refit keeps LODs the same height. Follow the
   existing external-prop pattern: distance/zoom trim, offscreen skip, static mesh cache keyed by pose, and the
   procedural character stays as the fallback.
4. **Static content stays on the existing OBJ pipeline.** Weapons (`Only Weapons` OBJ+MTL, MedievalPack) and
   buildings (Modular Medieval Pack ships OBJ+MTL) convert with `scripts/export-art.py` /
   `scripts/bulk-export.py` — no FBX2glTF needed. Keep procedural building tiers; use the modular pack for
   props/details only, consistent with the current asset policy.
5. **Monsters/enemies:** Animated Monster Pack is the directly downloadable choice (4 rigged monsters). Its
   meshes have no texture, so the material-factor fallback yields one flat color per material (Skeleton baked
   as a single bone color). Map those materials to the game palette in the baker (like
   `convert-external-assets.py` does) or accept a one-color silhouette per monster. Easy Enemies is **not**
   directly downloadable; if it is wanted, a human must download it from itch/quaternius.com first, then the
   same FBX2glTF path applies.
6. **KayKit:** free CC0 tiers exist but itch blocks direct CLI download (POST `/download` → 404; file URLs
   redirect to the page). Either download manually in a browser and commit the reviewed source files under
   `scripts/asset-sources/`, or skip in favor of Quaternius/Kenney, which are directly scriptable. Do not
   scrape itch.
7. **Dependencies to vendor or avoid:** do **not** commit the 10 MB archived FBX2glTF executable; download it
   at conversion time (`rebuild_pilot.py` verifies its sha256) or keep it outside the repo. `numpy`, `Pillow`
   and `fast-simplification` are already dev-only dependencies of `scripts/convert-external-assets.py`; the
   baker degrades to a dependency-free per-color path if `fast-simplification` is missing. No runtime
   dependency, texture download or network request is added to the game.
8. **Provenance and review before shipping:** add `data/external_assets.json` entries (pack, creator, CC0
   URL, source zip sha256, source FBX path, clip/time, modifications) and a `docs/ASSET_CREDITS.md` row; keep
   source zips/GLBs out of the Pages build (`scripts/build.mjs` already ships public files only); retain
   `scripts/dev-rig/sources/*License.txt`. The pilot JSONs are format-validated artifacts only — they are not
   wired into `src/` by this session.

## 6. Artifacts produced

```
scripts/dev-rig/
  bake_poses.py          GLB -> skinned/posed game JSON converter (numpy + Pillow + optional fast-simplification)
  rebuild_pilot.py       one-shot reproduction: download, convert, bake, test (sha256-checked)
  pilot.test.js          standalone node:assert verification (node scripts/dev-rig/pilot.test.js)
  warrior-stand.json     pilot pose, Idle @ 0.0 s
  warrior-walk.json      pilot pose, Walk @ 0.625 s (max stride)
  warrior-swing.json     pilot pose, Sword_Attack @ 0.375 s
  REPORT.md              this report
  sources/               retained CC0 license texts (Quaternius RPG/monsters/human, Kenney Blocky)
```
