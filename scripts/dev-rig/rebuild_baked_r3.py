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
BUDGET_BYTES = int(2.5 * 1024 * 1024)
POSES = ['stand:KayKit_Stand:0', 'walk-a:KayKit_Walk:0',
         'walk-b:KayKit_Walk:0.5', 'attack:KayKit_Attack:0.45']
PACKS = {
    'adventurers': ('KayKit Adventurers 2.0 FREE', 'https://kaylousberg.itch.io/kaykit-adventurers'),
    'skeletons': ('KayKit Skeletons 1.1 FREE', 'https://kaylousberg.itch.io/kaykit-skeletons'),
}
# Existing set IDs are also persisted manifest/file contracts, including human-*.
SETS = {
    'warrior': ('adventurers', 'Knight', 'knight_texture.png', None, 0),
    'ranger': ('adventurers', 'Ranger', 'ranger_texture.png', None, 0),
    'rogue': ('adventurers', 'Rogue_Hooded', 'rogue_texture.png', None, 0),
    'wizard': ('adventurers', 'Mage', 'mage_texture.png', None, 0),
    'cleric': ('adventurers', 'Mage', 'mage_texture.png', '#b9c7b2', .4),
    'monk': ('adventurers', 'Barbarian', 'barbarian_texture.png', None, 0),
    'skeleton': ('skeletons', 'Skeleton_Warrior', 'skeleton_texture.png', '#d8d3c2', .25),
    'human-thornband': ('skeletons', 'Skeleton_Rogue', 'skeleton_texture.png', '#4a5a3f', .65),
    'human-cinder': ('skeletons', 'Skeleton_Minion', 'skeleton_texture.png', '#3a3f45', .65),
    'human-ember': ('skeletons', 'Skeleton_Mage', 'skeleton_texture.png', '#b6402e', .65),
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
        glb = SOURCES / pack / (model + '.glb')
        license_file = SOURCES / (pack + '-License.txt')
        if 'Creative Commons Zero, CC0' not in license_file.read_text():
            raise SystemExit('unverified CC0 license: ' + str(license_file))
        relative = glb.relative_to(ROOT).as_posix()
        for lod, budget in (('hi', 450), ('lo', 180)):
            command = [sys.executable, str(HERE / 'bake_poses.py'), '--glb', relative,
                       '--texture', (SOURCES / pack / texture).relative_to(ROOT).as_posix(),
                       '--creator', 'Kay Lousberg', '--source-url', PACKS[pack][1],
                       '--source-fbx', relative, '--out-dir', str(OUT_DIR), '--prefix', set_id,
                       '--target-height', '1.1', '--max-faces', str(budget), '--lod', lod,
                       '--color-floor', '#3a3f45', '--poses', *POSES]
            if tint:
                command += ['--tint', tint, '--tint-strength', str(strength)]
            subprocess.run(command, check=True, cwd=ROOT)
        entries[set_id] = {
            'enabled': True, 'phase': 'R4', 'pack': PACKS[pack][0], 'creator': 'Kay Lousberg',
            'license': 'CC0-1.0', 'source': PACKS[pack][1], 'sourceGlb': relative,
            'sourceSHA256': hashlib.sha256(glb.read_bytes()).hexdigest(),
            'textureSHA256': hashlib.sha256((SOURCES / pack / texture).read_bytes()).hexdigest(),
            'licenseFile': license_file.relative_to(ROOT).as_posix(),
            'clips': {p.split(':')[0]: '@'.join(p.split(':')[1:]) for p in POSES},
            'poseMethod': 'authored bone transforms (staged GLBs have no animation clips)',
            'poseBudget': {'hi': 450, 'lo': 180},
            'use': 'Role-group body; existing gear translated to the baked hand anchor',
            'poses': {f'{pose}-{lod}': f'assets/meshes/baked/{set_id}-{pose}-{lod}.json'
                      for pose in ('stand', 'walk-a', 'walk-b', 'attack') for lod in ('hi', 'lo')},
        }
    total = sum(p.stat().st_size for p in OUT_DIR.glob('*.json'))
    print('baked %d files, %d bytes (%.2f MiB)' % (len(list(OUT_DIR.glob('*.json'))), total, total / 1048576))
    if total >= BUDGET_BYTES:
        raise SystemExit('baked library exceeds existing R3 2.5 MiB guard')
    manifest_path = ROOT / 'data/art-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['baked'].update(entries)
    manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')


if __name__ == '__main__':
    main()
