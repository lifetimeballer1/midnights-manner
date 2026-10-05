"""Rebuild complete vegetated-site LODs from their hash-matching building exports.

Usage: python scripts/rebuild-mixar-site-lods.py part-1.glb part-2.glb
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('converter', Path(__file__).with_name('convert-mixar-buildings.py'))
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
sizes = {k: v['size'] for k, v in json.loads(Path('data/buildings.json').read_text()).items()}
requested = {}
for family in ['farm', 'grove', 'frostgrove', 'whisper-grove', 'manor-gardens']:
    for tier in range(1, 7):
        key = 'mmr-' + family + '-' + str(tier)
        mesh = json.loads(Path('assets/meshes/' + key + '.json').read_text())
        requested[key] = mesh['meta']['sourceSHA256']
done = set()
for source in sys.argv[1:]:
    digest = hashlib.sha256(Path(source).read_bytes()).hexdigest()
    ids = {key for key, expected in requested.items() if expected == digest}
    if not ids:
        continue
    for key, mesh in converter.convert_glb(source, sizes, ids).items():
        Path('assets/meshes/' + key + '.json').write_text(json.dumps(mesh, separators=(',', ':')), encoding='utf8')
        done.add(key)
        print(key, len(mesh['faces']), 'complete faces at both LODs')
if done != set(requested):
    raise ValueError('Missing hash-matching source exports: ' + ', '.join(sorted(set(requested) - done)))
