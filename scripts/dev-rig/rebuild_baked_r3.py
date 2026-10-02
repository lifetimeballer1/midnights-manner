#!/usr/bin/env python3
"""R3 — rebuild every baked CC0 character pose set end to end.

Downloads the three CC0 Quaternius packs plus FBX2glTF (sha256-checked, cached
under MIDNIGHTS_RIG_WORK), extracts the FBX rigs and textures, converts each to
GLB, then bakes stand / walk-a / walk-b / attack at hi (260 faces) and lo (110
faces) into assets/meshes/baked/<set>-<pose>-<lod>.json with
scripts/dev-rig/bake_poses.py.

Weapon mesh nodes are excluded at bake time (the game's gear system draws
weapons); enemy sets receive a flat faction tint wash in the baker. The script
fails if the baked directory reaches the 2.5 MB budget.

Requires: Python 3.11 with numpy, Pillow and fast-simplification
(python -m pip install --user numpy Pillow fast-simplification).
Usage: python scripts/dev-rig/rebuild_baked_r3.py [--only warrior skeleton ...]
"""
import argparse
import hashlib
import os
import platform
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT_DIR = ROOT / 'assets' / 'meshes' / 'baked'
WORK = Path(os.environ.get('MIDNIGHTS_RIG_WORK', Path(tempfile.gettempdir()) / 'midnights-manner-rig'))
WORK.mkdir(parents=True, exist_ok=True)
BUDGET_BYTES = int(2.5 * 1024 * 1024)

FBX2GLTF = {
    'Windows': ('https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-windows-x64.exe',
                'FBX2glTF.exe', '8d90fb5e0a8d186a3d9a7ff8c75eaee541c3975ce4df0d80351f20092ae0877f'),
    'Linux': ('https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-linux-x64',
              'FBX2glTF', None),
    'Darwin': ('https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-darwin-x64',
               'FBX2glTF', None),
}

RPG = {
    'zip': 'rpg_characters_nov2020.zip',
    'url': 'https://opengameart.org/sites/default/files/rpg_characters_-_nov_2020.zip',
    'sha256': '5399e0cfaf313ff362455de4086488d093465434b1b93b0ced649f3773a15fd7',
    'dir': 'RPG Characters - Nov 2020',
}
MONSTER = {
    'zip': 'Animated Monster Pack by @Quaternius.zip',
    'url': 'https://opengameart.org/sites/default/files/Animated%20Monster%20Pack%20by%20%40Quaternius.zip',
    'sha256': 'acab2bddc5939f9b1b92c930507d73e0fd80037a39631cf2049bb6cfcaec1acd',
    'dir': 'Animated Monster Pack by @Quaternius',
}
HUMAN = {
    'zip': 'Animated Human by @Quaternius_0.zip',
    'url': 'https://opengameart.org/sites/default/files/Animated%20Human%20by%20%40Quaternius_0.zip',
    'sha256': 'dcd72162b5e59495efc629fb624d9e1deb12124b68291ad4fa3ce66b4fc24db3',
    'dir': 'Animated Human by @Quaternius',
}

# set id -> (pack, fbx path inside zip, texture entry or None, exclude regex, poses, tint, tint strength)
SETS = {
    'warrior': (RPG, 'FBX/Warrior.fbx', 'Textures/Warrior_Texture.png', r'_Sword$',
                'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Sword_Attack:0.45', None, 0.0),
    'ranger': (RPG, 'FBX/Ranger.fbx', 'Textures/Ranger_Texture.png', r'_Bow$',
               'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Bow_Attack_Shoot:0.45', None, 0.0),
    'rogue': (RPG, 'FBX/Rogue.fbx', 'Textures/Rogue_Texture.png', r'_Dagger$',
              'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Dagger_Attack:0.45', None, 0.0),
    'wizard': (RPG, 'FBX/Wizard.fbx', 'Textures/Wizard_Texture.png', r'_Staff$',
               'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Staff_Attack:0.45', None, 0.0),
    'cleric': (RPG, 'FBX/Cleric.fbx', 'Textures/Cleric_Texture.png', r'_Staff$',
               'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Staff_Attack:0.45', None, 0.0),
    'monk': (RPG, 'FBX/Monk.fbx', 'Textures/Monk_Texture.png', None,
             'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Attack:0.45', None, 0.0),
    'skeleton': (MONSTER, 'FBX/Skeleton.fbx', None, None,
                 'stand:Skeleton_Idle:0.0 walk-a:Skeleton_Running:0.0 walk-b:Skeleton_Running:0.5 attack:Skeleton_Attack:0.45',
                 '#d8d3c2', 0.45),
    'human-thornband': (HUMAN, 'FBX/Animated Human.fbx', None, None,
                        'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Punch:0.4', '#4a5a3f', 0.75),
    'human-cinder': (HUMAN, 'FBX/Animated Human.fbx', None, None,
                     'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Punch:0.4', '#3a3d3f', 0.75),
    'human-ember': (HUMAN, 'FBX/Animated Human.fbx', None, None,
                    'stand:Idle:0.0 walk-a:Walk:0.0 walk-b:Walk:0.5 attack:Punch:0.4', '#b6402e', 0.75),
}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def download(url, destination, expected=None):
    if destination.exists() and (expected is None or sha256(destination) == expected):
        print('cached', destination)
        return destination
    print('download', url)
    request = urllib.request.Request(url, headers={'User-Agent': 'midnights-manner-dev-rig'})
    with urllib.request.urlopen(request, timeout=300) as response, open(destination, 'wb') as out:
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
    if expected and sha256(destination) != expected:
        raise SystemExit('sha256 mismatch for %s' % destination)
    return destination


def extract(archive, entry, target):
    if target.exists():
        return target
    with zipfile.ZipFile(archive) as bundle, bundle.open(entry) as source, open(target, 'wb') as out:
        out.write(source.read())
    print('extracted', target.name)
    return target


def run(command):
    print('run', ' '.join(str(part) for part in command))
    subprocess.run(command, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--only', nargs='+', default=None, help='subset of set ids to rebuild')
    parser.add_argument('--list', action='store_true', help='list set ids and exit')
    args = parser.parse_args()
    if args.list:
        print('\n'.join(SETS))
        return

    system = platform.system()
    if system not in FBX2GLTF:
        raise SystemExit('no FBX2glTF release for ' + system)
    url, filename, expected = FBX2GLTF[system]
    converter = download(url, WORK / filename, expected)
    if system != 'Windows':
        os.chmod(converter, 0o755)

    packs = {}
    for pack in (RPG, MONSTER, HUMAN):
        packs[pack['zip']] = download(pack['url'], WORK / pack['zip'], pack['sha256'])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chosen = args.only or list(SETS)
    for set_id in chosen:
        if set_id not in SETS:
            raise SystemExit('unknown set id ' + set_id)
        pack, fbx_rel, texture_rel, exclude, poses, tint, tint_strength = SETS[set_id]
        stem = set_id.replace('-', '_')
        fbx = extract(packs[pack['zip']], '%s/%s' % (pack['dir'], fbx_rel), WORK / (stem + '.fbx'))
        glb = WORK / (stem + '.glb')
        if not glb.exists() or glb.stat().st_mtime < fbx.stat().st_mtime:
            run([str(converter), '--binary', '--input', str(fbx), '--output', str(glb)])
        texture = extract(packs[pack['zip']], '%s/%s' % (pack['dir'], texture_rel), WORK / Path(texture_rel).name) if texture_rel else None
        for lod, max_faces in (('hi', 260), ('lo', 110)):
            command = [sys.executable, str(HERE / 'bake_poses.py'),
                       '--glb', str(glb),
                       '--source-url', pack['url'], '--source-fbx', '%s/%s' % (pack['dir'], fbx_rel),
                       '--out-dir', str(OUT_DIR), '--prefix', set_id,
                       '--target-height', '1.1', '--max-faces', str(max_faces), '--lod', lod,
                       '--poses', *poses.split(' ')]
            if texture:
                command += ['--texture', str(texture)]
            if exclude:
                command += ['--exclude-node', exclude]
            if tint:
                command += ['--tint', tint, '--tint-strength', str(tint_strength)]
            run(command)

    total = sum(path.stat().st_size for path in OUT_DIR.glob('*.json'))
    print('baked %d files, %.2f MB / %.2f MB budget' % (
        len(list(OUT_DIR.glob('*.json'))), total / (1024 * 1024), BUDGET_BYTES / (1024 * 1024)))
    if total >= BUDGET_BYTES:
        raise SystemExit('baked weight over budget: %d >= %d bytes' % (total, BUDGET_BYTES))


if __name__ == '__main__':
    main()
