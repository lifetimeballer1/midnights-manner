#!/usr/bin/env python3
"""Bake staged CC0 KayKit tools into flat-color, grip-local Canvas meshes.

Development dependencies: numpy, Pillow, fast-simplification (see bake_poses.py).
Run from any directory: python -B scripts/dev-rig/bake_gear.py
"""
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

import numpy as np
from bake_poses import GLB, quantize, simplify_and_cap, texture_sampler, world_matrices


ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / '.superpowers/sdd/2026-10-02-cosmetic-art-pass/sources/rpgtools'
NAMES = ('pickaxe', 'hammer', 'saw', 'shovel', 'tongs', 'trowel', 'axe',
         'chisel', 'mallet', 'knife', 'torch', 'lantern', 'journal_open', 'map')
FLOOR = (0x3a, 0x3f, 0x45)


class GLTF(GLB):
    """Use the pose baker's accessors and transforms with external glTF buffers."""
    def __init__(self, path):
        self.path = path
        self.doc = json.loads(path.read_text(encoding='utf-8'))
        self.buffers = [(path.parent / buffer['uri']).read_bytes()
                        for buffer in self.doc['buffers']]

    def view(self, index):
        view = self.doc['bufferViews'][index]
        start = view.get('byteOffset', 0)
        return self.buffers[view['buffer']][start:start + view['byteLength']]


def source_triangles(gltf):
    world = world_matrices(gltf, {})
    textures = {}
    triangles = []
    for node_index, node in enumerate(gltf.doc['nodes']):
        if 'mesh' not in node:
            continue
        for primitive in gltf.doc['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                raise ValueError('only triangle primitives are supported')
            attrs = primitive['attributes']
            points = gltf.accessor(attrs['POSITION']).astype(np.float64)
            positions = (world(node_index) @ np.c_[points, np.ones(len(points))].T).T
            positions = np.c_[positions[:, 0], -positions[:, 2], positions[:, 1]]
            indices = (gltf.accessor(primitive['indices']).reshape(-1).astype(int)
                       if 'indices' in primitive else np.arange(len(points)))
            material = gltf.doc.get('materials', [{}])[primitive.get('material', 0)]
            pbr = material.get('pbrMetallicRoughness', {})
            factor = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3])
            texture = None
            if 'baseColorTexture' in pbr:
                info = pbr['baseColorTexture']
                image_index = gltf.doc['textures'][info['index']]['source']
                if image_index not in textures:
                    image = gltf.doc['images'][image_index]
                    textures[image_index] = texture_sampler(gltf.path.parent / image['uri'])
                texture = textures[image_index]
                uv = gltf.accessor(attrs['TEXCOORD_%d' % info.get('texCoord', 0)])
            for face in indices.reshape(-1, 3):
                if texture is not None:
                    # Same centroid UV sampling and V convention as bake_poses.py.
                    u, v = uv[face].mean(axis=0)
                    px = min(texture.width - 1, max(0, int((u % 1.0) * texture.width)))
                    py = min(texture.height - 1, max(0, int((1 - v % 1.0) * texture.height)))
                    color = np.array(texture.getpixel((px, py)), dtype=np.float64)
                else:
                    color = np.where(factor <= .0031308, factor * 12.92,
                                     1.055 * factor ** (1 / 2.4) - .055) * 255
                triangles.append((positions[face], color))
    if not triangles:
        raise ValueError('source contains no triangles')
    return triangles


def grip_local(name, triangles):
    points = np.concatenate([p for p, _ in triangles])
    low, high = points.min(axis=0), points.max(axis=0)
    # Source-specific shaft bands exclude heads/blades and decorative end caps.
    # Geometry, not atlas color, determines the actual handle midpoint.
    handle_bands = {'pickaxe': (-.225, .87), 'hammer': (-.225, .19),
                    'shovel': (-.17, .47), 'tongs': (-.76, -.16),
                    'trowel': (-.24, .27), 'axe': (-.286, .205),
                    'chisel': (-.186, .218), 'mallet': (-.226, .28),
                    'knife': (-.24, .267), 'torch': (-.226, .55)}
    rotation = np.eye(3)
    if name in handle_bands:
        bottom, top = handle_bands[name]
        handle = points[(points[:, 2] >= bottom) & (points[:, 2] <= top)]
        grip = (handle.min(axis=0) + handle.max(axis=0)) / 2
        if name == 'shovel':
            rotation = np.diag([1, -1, -1])
    elif name == 'saw':
        handle = points[points[:, 0] >= -.25]
        grip = (handle.min(axis=0) + handle.max(axis=0)) / 2
        rotation = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]])
    elif name == 'lantern':
        # Carry loop is above the body; rotate around X so the body extends +Z.
        loop = points[points[:, 2] >= high[2] - (high[2] - low[2]) * .15]
        grip = (loop.min(axis=0) + loop.max(axis=0)) / 2
        rotation = np.diag([1, -1, -1])
    else:
        # Books/maps have no handle: hold the midpoint of their lower edge.
        grip = np.array([(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, low[2]])
    return [((p - grip) @ rotation.T, c) for p, c in triangles]


def main():
    license_path = SOURCES.parent / 'rpgtools-License.txt'
    if not re.search(r'\bCC0\b', license_path.read_text(encoding='utf-8'), re.IGNORECASE):
        raise SystemExit('refusing conversion: staged license does not contain CC0')
    if not (ROOT / 'assets/meshes').is_dir():
        raise SystemExit('missing assets/meshes parent directory')
    documents = []
    for name in NAMES:
        path = SOURCES / (name + '.gltf')
        triangles = grip_local(name, source_triangles(GLTF(path)))
        triangles = quantize(triangles, palette_size=12, color_floor=FLOOR)
        vertices, faces, _ = simplify_and_cap(triangles, 60)
        document = {'meta': {'source': path.relative_to(ROOT).as_posix(), 'faces': len(faces)},
                    'faces': [{'v': [[round(float(v), 4) for v in vertices[i]] for i in face],
                               'c': color} for face, color in faces]}
        if not 0 < len(faces) <= 60:
            raise ValueError('%s: invalid face count %d' % (name, len(faces)))
        documents.append((name, json.dumps(document, separators=(',', ':')).encode('ascii'), len(faces)))
    total = sum(len(payload) for _, payload, _ in documents)
    if total >= 200 * 1024:
        raise SystemExit('refusing output: %d bytes exceeds 200KiB budget' % total)
    out_dir = ROOT / 'assets/meshes/gear'
    out_dir.mkdir(exist_ok=True)
    for name, payload, count in documents:
        (out_dir / (name + '.json')).write_bytes(payload)
        print('%-18s %2d faces %6d bytes' % (name + '.json', count, len(payload)))
    print('Total: %d files, %d faces, %d bytes (%.2f KiB)' % (
        len(documents), sum(count for _, _, count in documents), total, total / 1024))


if __name__ == '__main__':
    main()
