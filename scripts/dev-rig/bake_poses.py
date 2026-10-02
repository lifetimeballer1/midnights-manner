#!/usr/bin/env python3
"""Bake rigged/animated glTF (GLB) characters into Midnights Manner flat-color posed meshes.

Toolchain (development only):
  1. FBX2glTF v0.9.7 converts a Quaternius FBX (armature + actions) to GLB.
  2. This script parses the GLB with the Python standard library, samples real
     animation channels, applies CPU linear-blend skinning (plus rigid bone-parented
     parts), samples the character texture per triangle, quantizes to a flat palette,
     decimates, and writes the game's {faces:[{v:[[x,y,z]x3],c:'#hex'}]} JSON.

No runtime loader is added to the game; this is an offline conversion step.

Dependencies: numpy, Pillow, fast-simplification (all already used by
scripts/convert-external-assets.py). Install with:
  python -m pip install --user numpy Pillow fast-simplification

Example:
  python scripts/dev-rig/bake_poses.py \
    --glb build/warrior/Warrior.glb --texture build/warrior/Warrior_Texture.png \
    --out-dir scripts/dev-rig --target-height 1.1 --max-faces 799 \
    --poses stand:Idle:0.0 walk:Walk:0.25 swing:Sword_Attack:0.45
"""
import argparse
import json
import re
import struct
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

try:
    import fast_simplification
except ImportError:  # pragma: no cover - fallback keeps the pilot reproducible
    fast_simplification = None


class GLB:
    def __init__(self, path):
        raw = Path(path).read_bytes()
        if raw[:4] != b'glTF':
            raise SystemExit('not a GLB: ' + str(path))
        json_len = struct.unpack_from('<I', raw, 12)[0]
        self.doc = json.loads(raw[20:20 + json_len].decode('utf-8'))
        bin_off = 20 + json_len
        self.blob = raw[bin_off + 8:]

    def view(self, index):
        v = self.doc['bufferViews'][index]
        start = v.get('byteOffset', 0)
        return self.blob[start:start + v['byteLength']]

    def accessor(self, index):
        a = self.doc['accessors'][index]
        v = self.doc['bufferViews'][a['bufferView']]
        dtype = {5120: '<i1', 5121: '<u1', 5122: '<i2', 5123: '<u2',
                 5125: '<u4', 5126: '<f4'}[a['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        step = v.get('byteStride', np.dtype(dtype).itemsize * width)
        out = np.ndarray((a['count'], width), dtype=dtype,
                         buffer=self.view(a['bufferView']),
                         offset=a.get('byteOffset', 0),
                         strides=(step, np.dtype(dtype).itemsize)).copy()
        if a.get('normalized'):
            out = out.astype(np.float64) / np.iinfo(np.dtype(dtype)).max
        return out

    def parent_map(self):
        parents = {}
        for i, node in enumerate(self.doc['nodes']):
            for child in node.get('children', []):
                parents[child] = i
        return parents

    def clip_index(self, name):
        wanted = name.lower()
        for i, anim in enumerate(self.doc.get('animations', [])):
            label = (anim.get('name') or '').split('|')[-1].lower()
            if label == wanted:
                return i
        available = ', '.join((a.get('name') or '?').split('|')[-1] for a in self.doc.get('animations', []))
        raise SystemExit('clip %r not found; available: %s' % (name, available))


def trs_matrix(translation, rotation, scale):
    x, y, z, w = rotation
    n = (x * x + y * y + z * z + w * w) ** .5 or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    m = np.eye(4)
    m[:3, :3] = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]) @ np.diag(scale)
    m[:3, 3] = translation
    return m


def slerp(a, b, t):
    a = a / (np.linalg.norm(a) or 1.0)
    b = b / (np.linalg.norm(b) or 1.0)
    dot = float(np.clip(np.dot(a, b), -1.0, 1.0))
    if dot > 0.9995:
        return a + (b - a) * t
    if dot < -0.9995:
        return a
    theta = np.arccos(dot)
    return (np.sin((1 - t) * theta) * a + np.sin(t * theta) * b) / np.sin(theta)


def sample_animation(glb, clip, time):
    anim = glb.doc['animations'][clip]
    overrides = {}
    for channel in anim['channels']:
        target = channel['target']
        path = target['path']
        if path not in ('translation', 'rotation', 'scale'):
            continue
        sampler = anim['samplers'][channel['sampler']]
        times = glb.accessor(sampler['input']).reshape(-1).astype(np.float64)
        values = glb.accessor(sampler['output']).astype(np.float64)
        interp = sampler.get('interpolation', 'LINEAR')
        if time <= times[0]:
            value = values[0]
        elif time >= times[-1]:
            value = values[-1]
        else:
            i = int(np.searchsorted(times, time, side='right'))
            a = (time - times[i - 1]) / (times[i] - times[i - 1])
            if interp == 'STEP':
                value = values[i - 1]
            elif interp == 'CUBICSPLINE':
                v0, out0 = values[3 * (i - 1) + 1], values[3 * (i - 1) + 2]
                in1, v1 = values[3 * i], values[3 * i + 1]
                dt = times[i] - times[i - 1]
                h00 = 2 * a ** 3 - 3 * a ** 2 + 1
                h10 = a ** 3 - 2 * a ** 2 + a
                h01 = -2 * a ** 3 + 3 * a ** 2
                h11 = a ** 3 - a ** 2
                value = h00 * v0 + h10 * dt * out0 + h01 * v1 + h11 * dt * in1
            elif path == 'rotation':
                value = slerp(values[i - 1], values[i], a)
            else:
                value = values[i - 1] * (1 - a) + values[i] * a
        overrides.setdefault(target['node'], {})[path] = value
    return overrides


def world_matrices(glb, overrides):
    nodes = glb.doc['nodes']
    parents = glb.parent_map()
    cache = {}

    def local(i):
        node = nodes[i]
        if 'matrix' in node:
            return np.array(node['matrix']).reshape(4, 4).T
        over = overrides.get(i, {})
        return trs_matrix(over.get('translation', node.get('translation', [0, 0, 0])),
                          over.get('rotation', node.get('rotation', [0, 0, 0, 1])),
                          over.get('scale', node.get('scale', [1, 1, 1])))

    def world(i):
        if i not in cache:
            m = local(i)
            if i in parents:
                m = world(parents[i]) @ m
            cache[i] = m
        return cache[i]

    for root in glb.doc['scenes'][glb.doc.get('scene', 0)]['nodes']:
        world(root)
    return world


def texture_sampler(texture):
    if texture is None:
        return None
    image = Image.open(texture).convert('RGB')
    return image


def bake_pose(glb, clip_name, fraction, texture, debug=False, exclude_nodes=(), tint=None,
              tint_strength=0.0):
    clip = glb.clip_index(clip_name)
    times = glb.accessor(glb.doc['animations'][clip]['samplers'][0]['input']).reshape(-1)
    duration = float(times[-1])
    time = fraction * duration
    overrides = sample_animation(glb, clip, time)
    world = world_matrices(glb, overrides)
    triangles = []
    stats = {'skinned': 0, 'rigid': 0}
    for node_index, node in enumerate(glb.doc['nodes']):
        if 'mesh' not in node:
            continue
        if exclude_nodes and any(pattern.search(node.get('name') or '') for pattern in exclude_nodes):
            stats['excluded'] = stats.get('excluded', 0) + 1
            if debug:
                print('  node %-18s excluded by --exclude-node' % node.get('name'))
            continue
        skin = glb.doc['skins'][node['skin']] if 'skin' in node else None
        joint_matrices = None
        if skin:
            ibm = glb.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
            joint_matrices = np.array([world(skin['joints'][j]) @ ibm[j]
                                       for j in range(len(skin['joints']))])
        for primitive in glb.doc['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                continue
            points = glb.accessor(primitive['attributes']['POSITION']).astype(np.float64)
            homogeneous = np.c_[points, np.ones(len(points))]
            if joint_matrices is not None:
                joints = glb.accessor(primitive['attributes']['JOINTS_0']).astype(int)
                weights = glb.accessor(primitive['attributes']['WEIGHTS_0']).astype(np.float64)
                skinned = np.zeros((len(points), 4))
                for k in range(4):
                    m = joint_matrices[joints[:, k]]
                    skinned += weights[:, k, None] * np.einsum('nij,nj->ni', m, homogeneous)
                positions = skinned[:, :3]
                stats['skinned'] += 1
            else:
                positions = (world(node_index) @ homogeneous.T).T[:, :3]
                stats['rigid'] += 1
            # glTF right-handed Y-up -> game right-handed Z-up (matches
            # scripts/convert-external-assets.py: x, -z, y).
            positions = np.c_[positions[:, 0], -positions[:, 2], positions[:, 1]]
            if debug:
                low, high = positions.min(axis=0), positions.max(axis=0)
                print('  node %-18s %s bbox %s .. %s' % (
                    node.get('name'), 'skinned' if joint_matrices is not None else 'rigid',
                    np.round(low, 3), np.round(high, 3)))
            uv = glb.accessor(primitive['attributes']['TEXCOORD_0']).astype(np.float64) \
                if 'TEXCOORD_0' in primitive['attributes'] else None
            indices = glb.accessor(primitive['indices']).reshape(-1).astype(int) \
                if 'indices' in primitive else np.arange(len(points))
            material = glb.doc.get('materials', [{}])[primitive.get('material', 0)]
            factor = np.array(material.get('pbrMetallicRoughness', {})
                              .get('baseColorFactor', [1, 1, 1, 1])[:3], dtype=np.float64)
            for face in indices.reshape(-1, 3):
                if texture is not None and uv is not None:
                    u, v = uv[face].mean(axis=0)
                    px = min(texture.width - 1, max(0, int((u % 1.0) * texture.width)))
                    py = min(texture.height - 1, max(0, int((v % 1.0) * texture.height)))
                    color = np.array(texture.getpixel((px, py)), dtype=np.float64)
                else:
                    # glTF factors are linear; Canvas hex colors are sRGB.
                    color = np.where(factor <= .0031308, factor * 12.92,
                                     1.055 * factor ** (1 / 2.4) - .055) * 255
                if tint is not None and tint_strength > 0:
                    # Faction/profession tint at bake time: a flat material wash
                    # keeps the pack's shape but reads the faction color.
                    color = color * (1.0 - tint_strength) + np.asarray(tint, dtype=np.float64) * tint_strength
                triangles.append((positions[face], color))
    return {'triangles': triangles, 'clip': clip_name, 'fraction': fraction,
            'time': time, 'duration': duration, 'stats': stats}


def quantize(triangles, palette_size=28, threshold=22.0):
    counts = Counter(tuple(int(round(c)) for c in color) for _, color in triangles)
    centers = []
    for rgb, _ in sorted(counts.items(), key=lambda item: -item[1]):
        if all(sum((rgb[i] - center[i]) ** 2 for i in range(3)) > threshold ** 2 for center in centers):
            centers.append(rgb)
        if len(centers) >= palette_size:
            break
    if not centers:
        centers = [(154, 160, 163)]
    mapped = []
    for points, color in triangles:
        rgb = tuple(int(round(c)) for c in color)
        best = min(centers, key=lambda center: sum((rgb[i] - center[i]) ** 2 for i in range(3)))
        mapped.append((points, '#%02x%02x%02x' % best))
    return mapped


def finish(vertices, faces, max_faces):
    """Drop degenerate/duplicate faces, then cap by area as the final guard."""
    def area(item):
        a, b, c = (np.asarray(vertices[i]) for i in item[0])
        return float(np.linalg.norm(np.cross(b - a, c - a)))

    seen, kept = {}, []
    for indices, color in faces:
        if len(set(indices)) != 3 or area((indices, color)) <= 1e-10:
            continue
        signature = (tuple(sorted(indices)), color)
        if signature in seen:
            continue
        seen[signature] = True
        kept.append((indices, color))
    kept.sort(key=area, reverse=True)
    return kept[:max_faces]


def simplify_and_cap(triangles, max_faces):
    # Preferred path: one watertight quadric simplification over the whole
    # character, then each new face inherits the color of the nearest source
    # triangle. Per-color reduction (fallback) can open seams between groups.
    if fast_simplification is not None:
        source_points = np.array([points for points, _ in triangles], dtype=np.float64)
        source_colors = [color for _, color in triangles]
        flat = source_points.reshape(-1, 3)
        unique, inverse = np.unique(np.round(flat, 6), axis=0, return_inverse=True)
        indices = inverse.reshape(-1, 3).astype(np.int32)
        target = max(12, max_faces - 12)
        if len(indices) > target:
            try:
                unique, indices = fast_simplification.simplify(
                    unique.astype(np.float32), indices, target_count=target, agg=5)
                unique = unique.astype(np.float64)
                source_centroids = source_points.mean(axis=1)
                new_centroids = unique[indices].mean(axis=1)
                faces = []
                for start in range(0, len(indices), 256):
                    chunk = new_centroids[start:start + 256]
                    nearest = ((chunk[:, None, :] - source_centroids[None, :, :]) ** 2).sum(-1).argmin(1)
                    faces.extend((indices[start + j], source_colors[k]) for j, k in enumerate(nearest))
                return unique, finish(unique, faces, max_faces), 0.0
            except Exception as exc:  # fall through to the dependency-free path
                print('  whole-mesh simplify fallback (%s)' % exc)

    groups = {}
    for points, color in triangles:
        groups.setdefault(color, []).append(points)
    total = sum(len(v) for v in groups.values())
    ratio = min(1.0, (max_faces * 1.25) / max(1, total))
    simplified = []
    for color, faces in groups.items():
        points = np.array(faces, dtype=np.float64).reshape(-1, 3)
        unique, inverse = np.unique(np.round(points, 6), axis=0, return_inverse=True)
        indices = inverse.reshape(-1, 3).astype(np.int64)
        target = max(6, int(round(len(indices) * ratio)))
        if fast_simplification is not None and len(indices) > target:
            try:
                unique, indices = fast_simplification.simplify(
                    unique.astype(np.float32), indices.astype(np.int32),
                    target_count=target, agg=5)
                unique = unique.astype(np.float64)
            except Exception as exc:
                print('  simplify fallback (%s) for %s' % (exc, color))
        simplified.extend((unique[face], color) for face in indices)
    cell = None
    for attempt_cell in (1 / 40, 1 / 28, 1 / 20, 1 / 14):
        cell = attempt_cell
        lookup, vertices, faces = {}, [], []
        for points, color in simplified:
            keyed = []
            for point in points:
                key = tuple(round(float(v) / cell) for v in point)
                if key not in lookup:
                    lookup[key] = len(vertices)
                    vertices.append([key[i] * cell for i in range(3)])
                keyed.append(lookup[key])
            if len(set(keyed)) == 3:
                faces.append([keyed, color])
        if len(faces) <= max_faces:
            break
    return vertices, finish(vertices, faces, max_faces), cell


def normalize(poses, target_height):
    stand = poses[0]
    points = np.array([p for tri, _ in stand['triangles'] for p in tri])
    low, high = points.min(axis=0), points.max(axis=0)
    height = float(high[2] - low[2])
    if height <= 0:
        raise SystemExit('degenerate stand pose height')
    scale = target_height / height
    center = np.array([(low[0] + high[0]) / 2, (low[1] + high[1]) / 2])
    for pose in poses:
        scaled = [(np.c_[(triangle[:, :2] - center) * scale, triangle[:, 2] * scale], color)
                  for triangle, color in pose['triangles']]
        # Ground the whole pose (not each triangle) so feet sit at z = 0.
        min_z = min(triangle[:, 2].min() for triangle, _ in scaled)
        pose['triangles'] = [(np.c_[triangle[:, :2], triangle[:, 2] - min_z], color)
                             for triangle, color in scaled]
    return scale, height


def used_bounds(vertices, faces):
    used = np.unique([index for indices, _ in faces for index in indices])
    points = np.asarray(vertices, dtype=np.float64)[used]
    return points.min(axis=0), points.max(axis=0)


def write_mesh(path, pose, meta, vertices, faces, cell):
    document = {
        'meta': {
            'source': meta['source'],
            'creator': meta['creator'],
            'license': meta['license'],
            'source_file': meta['source_file'],
            'intermediate_glb': meta.get('intermediate_glb'),
            'converter': 'scripts/dev-rig/bake_poses.py',
            'clip': pose['clip'],
            'clip_time_seconds': round(pose['time'], 4),
            'clip_duration_seconds': round(pose['duration'], 4),
            'pose_fraction': pose['fraction'],
            'rig': {'joints': meta['joints'], 'animation_channels': meta['channels'],
                    'animations': meta['animations']},
            'target_height_tiles': meta['target_height'],
            'cluster_cell_tiles': round(cell, 5),
            'faces': len(faces),
            'excluded_nodes': meta.get('excluded_nodes', []),
            'tint': meta.get('tint'),
            'tint_strength': meta.get('tint_strength', 0.0),
        },
        'faces': [
            {'v': [[round(float(v), 5) for v in vertices[i]] for i in indices], 'c': color}
            for indices, color in faces
        ],
    }
    Path(path).write_text(json.dumps(document, separators=(',', ':')))
    points = np.array([v for face in document['faces'] for v in face['v']])
    print('wrote %-28s %4d faces  height %.3f  grounded %.4f' % (
        path, len(faces), points[:, 2].max() - points[:, 2].min(), points[:, 2].min()))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--glb', required=True)
    parser.add_argument('--texture')
    parser.add_argument('--source-url', default=None, help='canonical pack page or zip URL for provenance')
    parser.add_argument('--source-fbx', default=None, help='path of the FBX inside the source zip')
    parser.add_argument('--creator', default='Quaternius')
    parser.add_argument('--license', default='CC0-1.0')
    parser.add_argument('--out-dir', default='scripts/dev-rig')
    parser.add_argument('--prefix', default=None, help='output name prefix (default: GLB stem lowercased)')
    parser.add_argument('--poses', nargs='+', default=[],
                        help='name:Clip:fraction entries, e.g. stand:Idle:0.0')
    parser.add_argument('--target-height', type=float, default=1.1)
    parser.add_argument('--max-faces', type=int, default=799)
    parser.add_argument('--palette-size', type=int, default=28)
    parser.add_argument('--exclude-node', action='append', default=[],
                        help='regex of GLB node names to skip (e.g. weapon meshes); repeatable')
    parser.add_argument('--tint', default=None, help='#rrggbb faction wash applied at bake time')
    parser.add_argument('--tint-strength', type=float, default=0.0)
    parser.add_argument('--lod', default='', help='suffix appended to each output name, e.g. hi/lo')
    parser.add_argument('--list-animations', action='store_true')
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()

    glb = GLB(args.glb)
    if args.list_animations:
        for i, anim in enumerate(glb.doc.get('animations', [])):
            times = glb.accessor(anim['samplers'][0]['input']).reshape(-1)
            print('%-26s %6.3fs  %2d channels' % (
                (anim.get('name') or '?').split('|')[-1], float(times[-1]), len(anim['channels'])))
        return
    if not args.poses:
        raise SystemExit('--poses is required unless --list-animations is used')

    texture = texture_sampler(Path(args.texture)) if args.texture else None
    exclude_nodes = [re.compile(pattern) for pattern in args.exclude_node]
    tint = None
    if args.tint:
        value = args.tint.lstrip('#')
        tint = [int(value[i:i + 2], 16) for i in (0, 2, 4)]
    poses = []
    for spec in args.poses:
        name, clip, fraction = spec.split(':')
        if args.debug:
            print('baking %s = %s @ %s' % (name, clip, fraction))
        baked = bake_pose(glb, clip, float(fraction), texture, args.debug,
                          exclude_nodes, tint, args.tint_strength)
        baked['name'] = name
        poses.append(baked)

    scale, stand_height = normalize(poses, args.target_height)
    print('stand source height %.4f -> scale %.3f' % (stand_height, scale))

    # One shared flat palette across every pose keeps the character consistent.
    combined = [triangle for pose in poses for triangle in pose['triangles']]
    mapped = quantize(combined, args.palette_size)
    cursor = 0
    for pose in poses:
        count = len(pose['triangles'])
        pose['triangles'] = mapped[cursor:cursor + count]
        cursor += count

    meta = {
        'source': args.source_url or args.glb,
        'creator': args.creator,
        'license': args.license,
        'source_file': args.source_fbx or str(args.glb),
        'intermediate_glb': str(args.glb),
        'joints': len(glb.doc.get('skins', [{}])[0].get('joints', [])) if glb.doc.get('skins') else 0,
        'channels': sum(len(a['channels']) for a in glb.doc.get('animations', [])),
        'animations': [ (a.get('name') or '?').split('|')[-1] for a in glb.doc.get('animations', []) ],
        'target_height': args.target_height,
        'max_faces': args.max_faces,
        'excluded_nodes': args.exclude_node,
        'tint': args.tint,
        'tint_strength': args.tint_strength,
        'lod': args.lod,
    }
    # Simplify each pose, then refit them all with one shared scale taken from
    # the stand pose so poses stay consistent and exactly tile-scaled.
    built = [(pose,) + simplify_and_cap(pose['triangles'], args.max_faces) for pose in poses]
    stand_low, stand_high = used_bounds(built[0][1], built[0][2])
    refit = args.target_height / (stand_high[2] - stand_low[2])
    print('simplified stand height %.4f -> refit %.4f' % (stand_high[2] - stand_low[2], refit))

    prefix = args.prefix or Path(args.glb).stem.lower()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for pose, vertices, faces, cell in built:
        points = np.asarray(vertices, dtype=np.float64) * refit
        low, _ = used_bounds(points, faces)
        points[:, 2] -= low[2]  # ground the simplified pose at z = 0
        suffix = ('-%s' % args.lod) if args.lod else ''
        write_mesh(out_dir / ('%s-%s%s.json' % (prefix, pose['name'], suffix)), pose, meta,
                   points, faces, cell)


if __name__ == '__main__':
    main()
