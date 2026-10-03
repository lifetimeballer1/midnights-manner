#!/usr/bin/env python3
"""Rebuild the ten existing pose paths from staged CC0 KayKit GLBs, offline.

The historical command name is retained. Staged rigs have no animation clips;
the baker authors four discrete bone poses using the supplied skin weights.
Requires numpy, Pillow, fast-simplification. No downloads or Desktop access.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCES = ROOT / '.superpowers/sdd/2026-10-02-cosmetic-art-pass/sources'
OUT_DIR = ROOT / 'assets/meshes/baked'
BUDGET_BYTES = int(4 * 1024 * 1024)
POSES = ['stand:KayKit_Stand:0', 'walk-a:KayKit_Walk:0',
         'walk-b:KayKit_Walk:0.5', 'work-a:KayKit_Work:0', 'work-b:KayKit_Work:0.5',
         'attack:KayKit_Attack:0.45', 'attack-2:KayKit_Attack2:0.75']
POSES_HI_EXTRA = ['special:KayKit_Stand:0']
# lo LOD keeps 4 legacy poses so villages never pay near-zoom cost.
POSES_LO = ['stand:KayKit_Stand:0', 'walk-a:KayKit_Walk:0',
            'walk-b:KayKit_Walk:0.5', 'attack:KayKit_Attack:0.45']
# Knight HD source ships real combat clips (augmented via c1-augment.py from
# the CC0 Character Animations pack), so bake attacks from sampled animation;
# the rest stays KayKit-authored. Slice contact reads best at 0.65.
POSES_KNIGHT = ['stand:KayKit_Stand:0', 'walk-a:KayKit_Walk:0',
                'walk-b:KayKit_Walk:0.5', 'work-a:KayKit_Work:0', 'work-b:KayKit_Work:0.5',
                'attack:Melee_1H_Attack_Slice_Horizontal:0.6', 'attack-2:Melee_1H_Attack_Stab:0.5']
POSES_LO_KNIGHT = ['stand:KayKit_Stand:0', 'walk-a:KayKit_Walk:0',
                   'walk-b:KayKit_Walk:0.5', 'attack:Melee_1H_Attack_Slice_Horizontal:0.6']
# Monk HD export ships NLA work clips, so bake its two work poses from real
# sampled animation at high-lift moments; the rest stays KayKit-authored.
POSES_MONK = ['stand:KayKit_Stand:0', 'walk-a:KayKit_Walk:0',
              'walk-b:KayKit_Walk:0.5', 'work-a:Pickaxing:0.5', 'work-b:Hammering:0.5',
              'attack:KayKit_Attack:0.45', 'attack-2:KayKit_Attack2:0.75']
PACKS = {
    'adventurers': ('KayKit Adventurers 2.0 FREE', 'https://kaylousberg.itch.io/kaykit-adventurers'),
    # HD Barbarian worker export: object scales applied into mesh data (chunky
    # head/hat/body/arms) and the four work actions kept as NLA tracks.
    'adventurers-hd': ('KayKit Adventurers 2.0 FREE (HD worker export)',
                       'https://kaylousberg.itch.io/kaykit-adventurers'),
    'skeletons': ('KayKit Skeletons 1.1 FREE', 'https://kaylousberg.itch.io/kaykit-skeletons'),
    'skeletons-hd': ('KayKit Skeletons 1.1 FREE (HD worker export)',
                     'https://kaylousberg.itch.io/kaykit-skeletons'),
}
# Existing set IDs are also persisted manifest/file contracts, including human-*.
# Prop nodes that must never bake into bodies (HD Blender exports can smuggle
# quivers, debug cubes, or weapons alongside the rigged parts).
EXCLUDE_NODES = {
    'ranger': [r'Quiver'],
    'rogue': [r'^Cube$'],
    'human-ember': [r'^Cube$'],
    'warrior': [r'Icosphere'],
    'human-cinder': [r'Icosphere'],
}
KNIGHT_SETS = ('warrior', 'human-cinder')
SETS = {
    'warrior': ('adventurers-hd', 'Knight', 'knight_texture.png', None, 0),
    'ranger': ('adventurers-hd', 'Ranger', 'ranger_texture.png', None, 0),
    'rogue': ('adventurers-hd', 'Rogue_Hooded', 'rogue_texture.png', None, 0),
    'wizard': ('adventurers-hd', 'Mage', 'mage_texture.png', None, 0),
    'cleric': ('adventurers-hd', 'Mage', 'mage_texture.png', '#b9c7b2', .4),
    'monk': ('adventurers-hd', 'Barbarian', 'barbarian_texture.png', None, 0),
    'skeleton': ('skeletons-hd', 'Skeleton_Warrior', 'skeleton_texture.png', '#d8d3c2', .25),
    'human-thornband': ('adventurers-hd', 'Barbarian', 'barbarian_texture.png', '#4a5a3f', .25),
    'human-cinder': ('adventurers-hd', 'Knight', 'knight_texture.png', '#3a3f45', .25),
    'human-ember': ('adventurers-hd', 'Rogue_Hooded', 'rogue_texture.png', '#b6402e', .25),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+')
    parser.add_argument('--list', action='store_true')
    args = parser.parse_args()
    if args.list:
        print('\n'.join(SETS))
        return
    chosen = args.only or list(SETS)
    if any(key not in SETS for key in chosen):
        raise SystemExit('unknown set id')
    if not OUT_DIR.is_dir():
        raise SystemExit('missing baked output directory')
    entries = {}
    for set_id in chosen:
        pack, model, texture, tint, strength = SETS[set_id]
        if set_id == 'monk':
            poses, lo_poses = POSES_MONK, POSES_LO
        elif set_id in KNIGHT_SETS:
            poses, lo_poses = POSES_KNIGHT, POSES_LO_KNIGHT
        else:
            poses, lo_poses = POSES, POSES_LO
        glb = SOURCES / pack / (model + '.glb')
        license_file = SOURCES / (pack + '-License.txt')
        if 'Creative Commons Zero, CC0' not in license_file.read_text():
            raise SystemExit('unverified CC0 license: ' + str(license_file))
        relative = glb.relative_to(ROOT).as_posix()
        for lod, budget in (('hi', 450), ('lo', 180)):
            base = lo_poses if lod == 'lo' else poses
            lod_poses = (base + POSES_HI_EXTRA) if lod == 'hi' else base
            command = [sys.executable, str(HERE / 'bake_poses.py'), '--glb', relative,
                       '--texture', (SOURCES / pack / texture).relative_to(ROOT).as_posix(),
                       '--creator', 'Kay Lousberg', '--source-url', PACKS[pack][1],
                       '--source-fbx', relative, '--out-dir', str(OUT_DIR), '--prefix', set_id,
                       '--target-height', '1.1', '--max-faces', str(budget), '--lod', lod,
                       '--color-floor', '#3a3f45', '--poses', *lod_poses]
            if tint:
                command += ['--tint', tint, '--tint-strength', str(strength)]
            for pattern in EXCLUDE_NODES.get(set_id, []):
                command += ['--exclude-node', pattern]
            subprocess.run(command, check=True, cwd=ROOT)
        # Any set sourced from the adventurers-hd Blender export arrives
        # mirrored in X relative to the original staged sources; mirror back
        # (with a winding swap so lighting normals survive) to keep
        # hand/face/gear on their sides.
        if pack in ('adventurers-hd', 'skeletons-hd'):
            for path in sorted(OUT_DIR.glob(f'{set_id}-*.json')):
                document = json.loads(path.read_text())
                for face in document['faces']:
                    v = face['v']
                    face['v'] = [[-v[0][0], v[0][1], v[0][2]], [-v[2][0], v[2][1], v[2][2]], [-v[1][0], v[1][1], v[1][2]]]
                for name, point in document['meta']['anchors'].items():
                    document['meta']['anchors'][name] = [-point[0], point[1], point[2]]
                path.write_text(json.dumps(document, separators=(',', ':')))
        entries[set_id] = {
            'enabled': True, 'phase': 'R4', 'pack': PACKS[pack][0], 'creator': 'Kay Lousberg',
            'license': 'CC0-1.0', 'source': PACKS[pack][1], 'sourceGlb': relative,
            'sourceSHA256': hashlib.sha256(glb.read_bytes()).hexdigest(),
            'textureSHA256': hashlib.sha256((SOURCES / pack / texture).read_bytes()).hexdigest(),
            'licenseFile': license_file.relative_to(ROOT).as_posix(),
            'clips': {p.split(':')[0]: '@'.join(p.split(':')[1:]) for p in (poses + POSES_HI_EXTRA)},
            'poseMethod': ('KayKit authored bone transforms; work-a/work-b sampled from HD NLA clips'
                             if set_id == 'monk' else
                             'KayKit authored bone transforms; attack/attack-2 sampled from CC0 combat clips'
                             if set_id in KNIGHT_SETS else
                             'authored bone transforms (staged GLBs have no animation clips)'),
            'poseBudget': {'hi': 450, 'lo': 180},
            'use': 'Role-group body; gear attaches as separate sub-mesh at hand/back/chest anchors',
            'poses': {f'{pose}-hi': f'assets/meshes/baked/{set_id}-{pose}-hi.json'
                      for pose in ('stand', 'walk-a', 'walk-b', 'work-a', 'work-b', 'attack', 'attack-2', 'special')} | {f'{pose}-lo': f'assets/meshes/baked/{set_id}-{pose}-lo.json'
                      for pose in ('stand', 'walk-a', 'walk-b', 'attack')},
        }
    total = sum(p.stat().st_size for p in OUT_DIR.glob('*.json'))
    print('baked %d files, %d bytes (%.2f MiB)' % (len(list(OUT_DIR.glob('*.json'))), total, total / 1048576))
    if total >= BUDGET_BYTES:
        raise SystemExit('baked library exceeds 4 MiB guard')
    manifest_path = ROOT / 'data/art-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['baked'].update(entries)
    manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')


if __name__ == '__main__':
    main()
