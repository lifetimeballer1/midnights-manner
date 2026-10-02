#!/usr/bin/env python3
"""Rebuild the Quaternius Warrior pilot end to end and run its test.

Steps: download FBX2glTF + the CC0 RPG Characters zip, extract the Warrior FBX
and texture, convert to GLB, bake stand/walk/swing into the game JSON format,
then run scripts/dev-rig/pilot.test.js.

Requires: Python 3.11 with numpy, Pillow and fast-simplification
(python -m pip install --user numpy Pillow fast-simplification), Node 22+.
Usage: python scripts/dev-rig/rebuild_pilot.py
"""
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
WORK = Path(os.environ.get('MIDNIGHTS_RIG_WORK', Path(tempfile.gettempdir()) / 'midnights-manner-rig'))
WORK.mkdir(parents=True, exist_ok=True)

RPG_ZIP_URL = 'https://opengameart.org/sites/default/files/rpg_characters_-_nov_2020.zip'
RPG_ZIP_SHA256 = '5399e0cfaf313ff362455de4086488d093465434b1b93b0ced649f3773a15fd7'
WARRIOR_FBX = 'RPG Characters - Nov 2020/FBX/Warrior.fbx'
WARRIOR_TEXTURE = 'RPG Characters - Nov 2020/Textures/Warrior_Texture.png'

FBX2GLTF = {
    'Windows': ('https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-windows-x64.exe',
                'FBX2glTF.exe', '8d90fb5e0a8d186a3d9a7ff8c75eaee541c3975ce4df0d80351f20092ae0877f'),
    'Linux': ('https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-linux-x64',
              'FBX2glTF', None),
    'Darwin': ('https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-darwin-x64',
               'FBX2glTF', None),
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


def run(command):
    print('run', ' '.join(str(part) for part in command))
    subprocess.run(command, check=True)


def main():
    system = platform.system()
    if system not in FBX2GLTF:
        raise SystemExit('no FBX2glTF release for ' + system)
    url, filename, expected = FBX2GLTF[system]
    converter = download(url, WORK / filename, expected)
    if system != 'Windows':
        os.chmod(converter, 0o755)

    archive = download(RPG_ZIP_URL, WORK / 'rpg_characters_nov2020.zip', RPG_ZIP_SHA256)
    with zipfile.ZipFile(archive) as bundle:
        for entry, target in ((WARRIOR_FBX, WORK / 'Warrior.fbx'),
                              (WARRIOR_TEXTURE, WORK / 'Warrior_Texture.png')):
            with bundle.open(entry) as source, open(target, 'wb') as out:
                out.write(source.read())
    print('extracted Warrior.fbx + Warrior_Texture.png')

    glb = WORK / 'Warrior.glb'
    run([str(converter), '--binary', '--input', str(WORK / 'Warrior.fbx'), '--output', str(glb)])
    run([sys.executable, str(HERE / 'bake_poses.py'),
         '--glb', str(glb), '--texture', str(WORK / 'Warrior_Texture.png'),
         '--source-url', RPG_ZIP_URL, '--source-fbx', WARRIOR_FBX,
         '--out-dir', str(HERE), '--prefix', 'warrior',
         '--target-height', '1.1', '--max-faces', '799',
         '--poses', 'stand:Idle:0.0', 'walk:Walk:0.5', 'swing:Sword_Attack:0.45'])
    run(['node', str(HERE / 'pilot.test.js')])


if __name__ == '__main__':
    main()
