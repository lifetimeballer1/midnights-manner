"""Actual Mixar GLB nodes -> complete flat-face building meshes, offline only.

Usage: python scripts/convert-mixar-buildings.py source.glb output-directory [asset-id ...]
Dependencies: numpy, Pillow (development only). No face truncation or recoloring.
The known project palette is linear/Non-Color; reject other image materials.
"""
import hashlib
from collections import defaultdict, deque
import io
import json
import re
import struct
import sys
from pathlib import Path

import numpy as np
import fast_simplification
from PIL import Image


def linear_hex(rgb):
    rgb = np.clip(np.asarray(rgb, dtype=float), 0, 1)
    srgb = np.where(rgb <= .0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - .055)
    return '#' + ''.join('%02x' % round(float(c) * 255) for c in srgb)


def repair_solids(triangles):
    """Orient closed components outward; retain two-sided open source surfaces."""
    edges = defaultdict(list); face_edges = []
    for i, (triangle, _, _, _) in enumerate(triangles):
        corners = [tuple(round(float(v), 6) for v in p) for p in triangle]
        refs = []
        for a, b in zip(corners, corners[1:] + corners[:1]):
            key = tuple(sorted([a, b])); forward = a == key[0]
            edges[key].append((i, forward)); refs.append((key, forward))
        face_edges.append(refs)
    repaired = list(triangles); visited = set()
    for start in range(len(triangles)):
        if start in visited:
            continue
        orient = {start: False}; queue = deque([start]); closed = True
        while queue:
            i = queue.popleft(); visited.add(i)
            for key, forward in face_edges[i]:
                linked = edges[key]
                if len(linked) != 2:
                    closed = False
                for other, other_forward in linked:
                    if other == i:
                        continue
                    flip = orient[i] ^ (forward == other_forward)
                    if other in orient:
                        if orient[other] != flip:
                            closed = False
                    elif other not in visited:
                        orient[other] = flip; queue.append(other)
        if not closed:
            continue
        volume = 0
        for i, flip in orient.items():
            t = triangles[i][0][::-1] if flip else triangles[i][0]
            volume += np.dot(t[0], np.cross(t[1], t[2]))
        if abs(volume) < 1e-10:
            continue
        for i, flip in orient.items():
            t, color, emission, _ = triangles[i]
            repaired[i] = (t[::-1] if flip ^ (volume < 0) else t, color, emission, False)
    return repaired


def merge_faces(triangles):
    """Merge only convex, same-material coplanar neighbors; retain all surfaces."""
    lookup, vertices, faces = {}, [], []
    for triangle, color, emission, double_sided in triangles:
        ids = []
        for p in triangle:
            key = tuple(round(float(v), 6) for v in p)
            if key not in lookup:
                lookup[key] = len(vertices); vertices.append(key)
            ids.append(lookup[key])
        if len(set(ids)) == 3:
            faces.append([ids, color, emission, double_sided])
    points = np.asarray(vertices)

    def normal(face):
        a, b, c = points[face[:3]]
        n = np.cross(b - a, c - a); size = np.linalg.norm(n)
        return n / size if size > 1e-10 else None

    changed = True
    while changed:
        changed = False; edges = {}; removed = set()
        normals = [normal(face) for face, _, _, _ in faces]
        for i, (face, color, emission, double_sided) in enumerate(faces):
            if i in removed:
                continue
            for a, b in zip(face, face[1:] + face[:1]):
                match = edges.get((b, a, color, emission, double_sided))
                if match is None or match in removed or match == i:
                    edges[(a, b, color, emission, double_sided)] = i; continue
                other = faces[match][0]; n1, n2 = normals[i], normals[match]
                if n1 is None or n2 is None or np.dot(n1, n2) < .999999:
                    continue
                if max(abs(np.dot(points[j] - points[face[0]], n1)) for j in other) > 1e-6:
                    continue
                perimeter = [(u, v) for poly in [face, other] for u, v in zip(poly, poly[1:] + poly[:1]) if (u, v) not in [(a, b), (b, a)]]
                next_vertex = dict(perimeter)
                if len(next_vertex) != len(perimeter):
                    continue
                merged = [perimeter[0][0]]
                while len(merged) <= len(perimeter):
                    v = next_vertex.get(merged[-1])
                    if v is None or v == merged[0]:
                        break
                    merged.append(v)
                if len(merged) != len(perimeter):
                    continue
                p = points[merged]
                turns = [np.dot(np.cross(p[(j+1) % len(p)] - p[j], p[(j+2) % len(p)] - p[(j+1) % len(p)]), n1) for j in range(len(p))]
                if min(turns) < -1e-10:
                    continue
                merged = [v for j, v in enumerate(merged) if abs(turns[(j-1) % len(turns)]) > 1e-10]
                if len(merged) < 3:
                    continue
                faces[i] = [merged, color, emission, double_sided]; removed.add(match); changed = True
                break
        faces = [f for i, f in enumerate(faces) if i not in removed and normals[i] is not None]
    return [{'v': [list(vertices[j]) for j in ids], 'c': color, 'e': emission, 'd': double_sided} for ids, color, emission, double_sided in faces]


def low_mesh(triangles):
    simplified = []
    source_points = np.concatenate([t for t, _, _, _ in triangles])
    source_low, source_high = source_points.min(axis=0), source_points.max(axis=0)
    for color, emission, double_sided in sorted({(c, e, d) for _, c, e, d in triangles}):
        group = [t for t, c, e, d in triangles if c == color and e == emission and d == double_sided]
        points, inverse = np.unique(np.concatenate(group), axis=0, return_inverse=True)
        faces = inverse.reshape(-1, 3)
        # Collapse solid detail, not thin roof veneers or emitting panes.
        if emission == 0 and not double_sided and len(faces) > 40:
            points, faces = fast_simplification.simplify(points, faces, target_count=max(12, int(len(faces)*.22)), agg=5)
        points = np.clip(points, source_low, source_high)
        simplified.extend((points[f], color, emission, double_sided) for f in faces)
    return {'faces': merge_faces(simplified)}


def emission_sources(faces, family):
    groups, owners = [], {}
    for f in faces:
        if f['e'] <= 0:
            continue
        points = {tuple(v) for v in f['v']}
        linked = {owners[p] for p in points if p in owners}
        group = min(linked) if linked else len(groups)
        if not linked:
            groups.append(set())
        for other in linked - {group}:
            groups[group].update(groups[other]); groups[other].clear()
        groups[group].update(points)
        for p in groups[group]:
            owners[p] = group
    sources = []
    for group in groups:
        if not group:
            continue
        points = np.asarray(list(group)); center = (points.min(axis=0)+points.max(axis=0))/2
        direction = [int(np.sign(center[0])), 0] if abs(center[0]) > abs(center[1]) else [0, int(np.sign(center[1]))]
        profile = 'fire' if family == 'forge' and center[2] < .6 else 'window'
        sources.append({'position': [round(float(v), 6) for v in center], 'direction': direction, 'radius': 1.25, 'power': .7, 'profile': profile})
    return sorted(sources, key=lambda s: s['position'])[:12]


def convert_glb(path, sizes, only=None):
    only = set(only) if only is not None else None
    raw = Path(path).read_bytes()
    if len(raw) < 20 or raw[:4] != b'glTF' or struct.unpack_from('<II', raw, 4) != (2, len(raw)):
        raise ValueError('Invalid GLB header')
    chunks = {}; offset = 12
    while offset < len(raw):
        length, kind = struct.unpack_from('<II', raw, offset); offset += 8
        chunks[kind] = raw[offset:offset+length]; offset += length
    doc = json.loads(chunks[0x4e4f534a]); blob = chunks.get(0x004e4942, b'')
    if doc.get('skins') or doc.get('animations') or set(doc.get('extensionsRequired', [])) - {'KHR_materials_emissive_strength'}:
        raise ValueError('Static uncompressed meshes required')
    source_hash = hashlib.sha256(raw).hexdigest()

    def view(index):
        v = doc['bufferViews'][index]
        if v.get('buffer', 0) != 0:
            raise ValueError('External buffers unsupported')
        return blob[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]

    def accessor(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        if a.get('sparse') or a.get('normalized'):
            raise ValueError('Sparse/normalized accessors unsupported')
        dtype = np.dtype({5121: '<u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']])
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        return np.ndarray((a['count'], width), dtype=dtype, buffer=view(a['bufferView']), offset=a.get('byteOffset', 0), strides=(v.get('byteStride', dtype.itemsize*width), dtype.itemsize)).copy()

    images = [Image.open(io.BytesIO(view(i['bufferView']))).convert('RGBA') for i in doc.get('images', [])]
    output = {}

    def visit(index, parent):
        node = doc['nodes'][index]
        if 'matrix' in node:
            local = np.array(node['matrix']).reshape(4, 4).T
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1]); local = np.eye(4)
            local[:3, :3] = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]) @ np.diag(node.get('scale', [1, 1, 1]))
            local[:3, 3] = node.get('translation', [0, 0, 0])
        matrix = parent @ local
        match = re.fullmatch(r'MMR \| ([a-z_-]+) \| T(\d+) Architecture', node.get('name', '')) if 'mesh' in node else None
        key = f'mmr-{match[1]}-{int(match[2])}' if match else None
        if 'mesh' in node and (only is None or key in only):
            if not match or match[1] not in sizes:
                raise ValueError('Unmapped source object: ' + node.get('name', ''))
            family, tier = match[1], int(match[2]); triangles = []
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                if primitive.get('mode', 4) != 4:
                    raise ValueError('Triangle primitives required')
                attributes = primitive['attributes']; pts = accessor(attributes['POSITION'])
                pts = (np.c_[pts, np.ones(len(pts))] @ matrix.T)[:, :3]
                # Right-handed Y-up -> Z-up, with no reflection.
                pts = pts[:, [0, 2, 1]] * [1, -1, 1]
                uv = accessor(attributes['TEXCOORD_0']) if 'TEXCOORD_0' in attributes else None
                mat = doc['materials'][primitive['material']]; pbr = mat.get('pbrMetallicRoughness', {})
                if mat.get('alphaMode', 'OPAQUE') != 'OPAQUE' or 'COLOR_0' in attributes or set(mat.get('extensions', {})) - {'KHR_materials_emissive_strength'}:
                    raise ValueError('Unsupported material: ' + mat.get('name', ''))
                factor = np.asarray(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3])
                image = None
                if 'baseColorTexture' in pbr:
                    if mat.get('name') != 'MMR | Shared Palette Atlas' or uv is None or pbr['baseColorTexture'].get('texCoord', 0) != 0:
                        raise ValueError('Only verified linear palette textures supported')
                    image = images[doc['textures'][pbr['baseColorTexture']['index']]['source']]
                strength = mat.get('extensions', {}).get('KHR_materials_emissive_strength', {}).get('emissiveStrength', 1)
                emission = round(float(max(mat.get('emissiveFactor', [0, 0, 0]))) * strength, 6)
                indices = accessor(primitive['indices']).flatten() if 'indices' in primitive else np.arange(len(pts))
                for face in indices.reshape(-1, 3):
                    rgb = factor
                    if image is not None:
                        samples = []
                        for u, v in uv[face]:
                            pixel = image.getpixel((min(image.width-1, int((float(u) % 1)*image.width)), min(image.height-1, int((float(v) % 1)*image.height))))
                            if pixel[3] != 255:
                                raise ValueError('Transparent palette cell')
                            samples.append(pixel[:3])
                        if len(set(samples)) != 1:
                            raise ValueError('Face spans multiple palette colors')
                        rgb = np.asarray(samples[0]) / 255 * factor
                    triangle = pts[face]
                    if np.linalg.det(matrix[:3, :3]) < 0:
                        triangle = triangle[::-1]
                    if not np.isfinite(triangle).all():
                        raise ValueError('Nonfinite geometry')
                    if np.linalg.norm(np.cross(triangle[1]-triangle[0], triangle[2]-triangle[0])) > 1e-10:
                        triangles.append((triangle, linear_hex(rgb), emission, mat.get('doubleSided', False)))
            if not triangles:
                raise ValueError('Empty building mesh')
            triangles = repair_solids(triangles)
            all_points = np.concatenate([t for t, _, _, _ in triangles]); low, high = all_points.min(axis=0), all_points.max(axis=0)
            span = max(high[0]-low[0], high[1]-low[1])
            if span <= 0 or high[2] <= low[2]:
                raise ValueError('Degenerate building bounds')
            scale = (sizes[family]-.12) / span; origin = np.array([(low[0]+high[0])/2, (low[1]+high[1])/2, low[2]])
            normalized = [((t-origin)*scale, c, e, d) for t, c, e, d in triangles]
            faces = merge_faces(normalized)
            # Global material reduction can erase entire crowns and barrel walls
            # in these disconnected-component sites. Keep whole bodies, or let
            # the runtime use its bounded procedural fallback.
            low_lod = {'faces': faces} if family in {'farm', 'grove', 'frostgrove', 'whisper-grove', 'manor-gardens'} else low_mesh(normalized)
            key = f'mmr-{family}-{tier}'
            if key in output:
                raise ValueError('Duplicate building tier')
            output[key] = {'meta': {'format': 'mixar-building-v1', 'source': 'Game Assets / Reference Redesign', 'sourceObject': node['name'], 'sourceSHA256': source_hash, 'type': family, 'tier': tier, 'footprint': sizes[family], 'scale': float(scale), 'sourceBounds': [low.tolist(), high.tolist()], 'complete': True, 'sourceTriangles': len(triangles), 'faces': len(faces), 'paletteEncoding': 'linear Non-Color -> sRGB'}, 'faces': faces, 'lods': {'low': low_lod}, 'sources': emission_sources(faces, family)}
        for child in node.get('children', []):
            visit(child, matrix)

    for root in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(root, np.eye(4))
    if only is not None and set(output) != only:
        raise ValueError('Missing requested building meshes: ' + ', '.join(sorted(only - set(output))))
    return output


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sizes = {k: v['size'] for k, v in json.loads(Path('data/buildings.json').read_text()).items()}
    output = convert_glb(sys.argv[1], sizes, sys.argv[3:] or None); directory = Path(sys.argv[2]); directory.mkdir(parents=True, exist_ok=True)
    for key, mesh in output.items():
        (directory / (key+'.json')).write_text(json.dumps(mesh, separators=(',', ':')), encoding='utf8')
        print(key, mesh['meta']['sourceTriangles'], 'triangles ->', len(mesh['faces']), 'near /', len(mesh['lods']['low']['faces']), 'low complete faces,', len(mesh['sources']), 'lights')
