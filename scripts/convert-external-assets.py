"""Offline GLB -> flat Canvas geometry. Requires numpy, Pillow, fast-simplification.

Run from the repo root. The manifest path converts reviewed CC0 sources; --node
converts one named user-provided mesh locally without granting redistribution rights.
Reject unsupported animation/compression rather than silently damaging an asset.
"""
import hashlib
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
import fast_simplification
from PIL import Image

PALETTE = ['#604a39', '#8d6844', '#b88a55', '#d5bf8f', '#53544e',
           '#a8b7b5', '#315d43', '#4c7b4e', '#808881', '#adb0a5']
RGB = np.array([[int(c[i:i+2], 16) for i in (1, 3, 5)] for c in PALETTE])


def convert(path, only_nodes=None, target_height=1.0, include_source=False):
    path = Path(path)
    try:
        target_height = float(target_height)
    except (TypeError, ValueError) as error:
        raise ValueError('target height must be positive and finite') from error
    if not np.isfinite(target_height) or target_height <= 0:
        raise ValueError('target height must be positive and finite')
    only_nodes = set(only_nodes) if only_nodes is not None else None
    raw = path.read_bytes()
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+length])
    blob = raw[28+length:]
    assert not doc.get('skins') and not doc.get('animations')
    assert not doc.get('extensionsRequired'), 'Unsupported GLB extension'

    def view(i):
        v = doc['bufferViews'][i]
        return blob[v.get('byteOffset', 0):v.get('byteOffset', 0)+v['byteLength']]

    def accessor(i):
        a = doc['accessors'][i]
        assert not a.get('sparse') and not a.get('normalized')
        v = doc['bufferViews'][a['bufferView']]
        dtype = {5121: '<u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        step = v.get('byteStride', np.dtype(dtype).itemsize*width)
        return np.ndarray((a['count'], width), dtype=dtype, buffer=view(a['bufferView']),
                          offset=a.get('byteOffset', 0), strides=(step, np.dtype(dtype).itemsize)).copy()

    images = [Image.open(io.BytesIO(view(i['bufferView']))).convert('RGB') for i in doc.get('images', [])]
    sampled_images = set()
    triangles = []
    found_nodes = set()

    def visit(index, parent):
        node = doc['nodes'][index]
        if 'matrix' in node:
            local = np.array(node['matrix']).reshape(4, 4).T
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            local = np.eye(4)
            local[:3, :3] = np.array([
                [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]) @ np.diag(node.get('scale', [1, 1, 1]))
            local[:3, 3] = node.get('translation', [0, 0, 0])
        matrix = parent @ local
        if 'mesh' in node and (only_nodes is None or node.get('name') in only_nodes):
            found_nodes.add(node.get('name'))
            for p in doc['meshes'][node['mesh']]['primitives']:
                assert p.get('mode', 4) == 4
                vertices = accessor(p['attributes']['POSITION'])
                points = np.c_[vertices, np.ones(len(vertices))] @ matrix.T
                uv = accessor(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else None
                material = doc.get('materials', [{}])[p.get('material', 0)]
                mat = material.get('pbrMetallicRoughness', {})
                factor = np.array(mat.get('baseColorFactor', [1, 1, 1, 1])[:3])
                image_index = doc['textures'][mat['baseColorTexture']['index']]['source'] if 'baseColorTexture' in mat else None
                image = images[image_index] if image_index is not None else None
                indices = accessor(p['indices']).flatten() if 'indices' in p else np.arange(len(vertices))
                for face in indices.reshape(-1, 3):
                    # glTF factors are linear; Canvas hex colors are sRGB.
                    color = np.where(factor <= .0031308, factor*12.92, 1.055*factor**(1/2.4)-.055)*255
                    if image is not None and uv is not None:
                        sampled_images.add(image_index)
                        u, v = uv[face].mean(axis=0)
                        color = np.array(image.getpixel((min(image.width-1, int((u % 1)*image.width)), min(image.height-1, int((v % 1)*image.height)))))*factor
                    palette = {'DarkWood': '#604a39', 'Wood': '#8d6844', 'Stone': '#53544e', 'Bag': '#d5bf8f', 'Hay': '#b88a55'}.get(material.get('name'), PALETTE[int(np.argmin(((RGB-color)**2).sum(axis=1)))])
                    triangle = points[face, :3]
                    if np.linalg.det(matrix[:3, :3]) < 0:
                        triangle = triangle[::-1]
                    triangles.append((triangle, palette))
        for child in node.get('children', []):
            visit(child, matrix)

    for root in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(root, np.eye(4))
    if only_nodes is not None and found_nodes != only_nodes:
        raise ValueError('Missing requested GLB node: ' + ', '.join(sorted(only_nodes - found_nodes)))
    if not triangles:
        raise ValueError('No usable triangles in GLB')
    # Per-asset art-direction adaptation uses the existing workplace palette.
    if path.stem == 'crate':
        triangles = [(t, '#b88a55' if c == '#8d6844' and np.cross(t[1]-t[0], t[2]-t[0])[1] > .5*np.linalg.norm(np.cross(t[1]-t[0], t[2]-t[0])) else c) for t, c in triangles]
    if path.stem == 'barrel':
        triangles = [(t, '#8a6646' if c == '#604a39' else '#53544e' if c == '#808881' else c) for t, c in triangles]
    source_count = len(triangles)
    simplified = []
    # Quadric-error reduction per palette material keeps dark hoops and grain
    # separate. Small rocks retain their deliberately faceted silhouette.
    for color in sorted({c for _, c in triangles}):
        group = [t for t, c in triangles if c == color]
        points, inverse = np.unique(np.concatenate(group), axis=0, return_inverse=True)
        indices = inverse.reshape(-1, 3)
        if len(indices) > 120 and not include_source:
            points, indices = fast_simplification.simplify(points, indices,
                target_count=max(24, int(len(indices)*(.15 if source_count>1000 else .28))), agg=5)
        simplified.extend((points[face], color) for face in indices)
    triangles = simplified
    all_points = np.concatenate([t for t, _ in triangles])
    low, high = all_points.min(axis=0), all_points.max(axis=0)
    height = high[1]-low[1]
    assert height > 0 and np.isfinite(all_points).all()
    # Right-handed Y-up glTF -> Z-up game. Ground pivot at footprint center.
    origin = np.array([(low[0]+high[0])/2, low[1], (low[2]+high[2])/2])
    vertices, lookup, faces = [], {}, []
    scale = target_height / height
    for triangle, color in triangles:
        face = []
        for point in (triangle-origin)*scale:
            # 1/32-height vertex clustering removes tiny bevels below normal
            # game-scale readability. Recompute normals after clustering.
            key = tuple(round(float(v), 6) if include_source else round(round(float(v)*32)/32, 5) for v in [point[0], -point[2], point[1]])
            if key not in lookup:
                lookup[key] = len(vertices)
                vertices.append(list(key))
            face.append(lookup[key])
        if len(set(face)) == 3 and np.linalg.norm(np.cross(np.array(vertices[face[1]])-vertices[face[0]], np.array(vertices[face[2]])-vertices[face[0]])) > 1e-9:
            faces.append([face, color])
    unique = {}
    for face, color in faces:
        unique.setdefault((tuple(sorted(face)), color), [face, color])
    faces = list(unique.values())
    # Merge adjacent coplanar triangles into convex polygons, retaining seams,
    # winding, concavities and holes. No hidden geometry guesses.
    points = np.array(vertices)
    def normal(face):
        a, b, c = points[face[:3]]
        n = np.cross(b-a, c-a)
        length = np.linalg.norm(n)
        return n/length if length > 1e-9 else None
    changed = True
    while changed:
        changed = False
        edges = {}
        removed = set()
        for i, (face, color) in enumerate(faces):
            if i in removed:
                continue
            for a, b in zip(face, face[1:]+face[:1]):
                match = edges.get((b, a, color))
                if match is None or match in removed or match == i:
                    edges[(a, b, color)] = i
                    continue
                other = faces[match][0]
                n1, n2 = normal(face), normal(other)
                if n1 is None or n2 is None or np.dot(n1, n2) < .999999:
                    continue
                if abs(np.dot(points[other[0]]-points[face[0]], n1)) > 1e-5:
                    continue
                perimeter = [(u, v) for poly in [face, other] for u, v in zip(poly, poly[1:]+poly[:1]) if (u, v) not in [(a, b), (b, a)]]
                next_vertex = dict(perimeter)
                if len(next_vertex) != len(perimeter):
                    continue
                merged = [perimeter[0][0]]
                while len(merged) <= len(perimeter):
                    v = next_vertex.get(merged[-1])
                    if v == merged[0] or v is None:
                        break
                    merged.append(v)
                if len(merged) != len(perimeter):
                    continue
                p = points[merged]
                turns = [np.dot(np.cross(p[(j+1)%len(p)]-p[j], p[(j+2)%len(p)]-p[(j+1)%len(p)]), n1) for j in range(len(p))]
                if min(turns) < -1e-8:
                    continue
                # The Canvas face normal uses its first three corners; strip
                # straight boundary vertices so that normal never degenerates.
                merged = [v for j, v in enumerate(merged) if abs(turns[(j-1)%len(turns)]) > 1e-9]
                if len(merged) < 3:
                    continue
                faces[i] = [merged, color]
                removed.add(match)
                changed = True
                break
        faces = [f for i, f in enumerate(faces) if i not in removed]
    result = {'vertices': vertices, 'faces': faces, 'sourceTriangles': source_count}
    if include_source:
        if len(sampled_images) > 1:
            raise ValueError('Multiple sampled textures cannot be represented by singular textureSHA256 provenance')
        texture_hash = None
        if sampled_images:
            image_bytes = view(doc['images'][next(iter(sampled_images))]['bufferView'])
            texture_hash = hashlib.sha256(image_bytes).hexdigest()
        result['sourceSHA256'] = hashlib.sha256(raw).hexdigest()
        result['textureSHA256'] = texture_hash
    return result


def convert_node(path, node_name, target_height=1.0):
    path = Path(path)
    converted = convert(path, {node_name}, target_height, include_source=True)
    vertices = converted['vertices']
    faces = [{'v': [vertices[i] for i in indices], 'c': color} for indices, color in converted['faces']]
    if not faces:
        raise ValueError('Empty converted mesh after vertex clustering')
    return {
        'meta': {
            'format': 'flat-face-v1',
            'sourceObject': node_name,
            'sourceFile': path.name,
            'sourceSHA256': converted['sourceSHA256'],
            'textureSHA256': converted['textureSHA256'],
            'sourceTriangles': converted['sourceTriangles'],
            'height': float(target_height),
            'releaseStatus': 'local-only',
        },
        'faces': faces,
    }


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--node':
        if len(sys.argv) != 6:
            sys.exit('Usage: python scripts/convert-external-assets.py --node source.glb output.json node-name target-height')
        mesh = convert_node(Path(sys.argv[2]), sys.argv[4], float(sys.argv[5]))
        if len(mesh['faces']) > 3000:
            raise ValueError('Over the 3000-face conversion safety limit; runtime budgets are checked at registration')
        output = Path(sys.argv[3]); output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(mesh, separators=(',', ':')), encoding='utf8')
        print(mesh['meta']['sourceObject'], mesh['meta']['sourceTriangles'], 'triangles ->', len(mesh['faces']), 'faces')
        sys.exit(0)
    manifest = json.loads(Path('data/external_assets.json').read_text())
    output = {}
    for asset in manifest['assets']:
        assert asset['license'] == 'CC0-1.0'
        mesh = convert(Path(asset['sourceFile']))
        assert len(mesh['faces']) <= 400, 'Over the per-model Canvas face budget'
        output[asset['id']] = mesh
        print(asset['id'], mesh['sourceTriangles'], 'triangles ->', len(mesh['faces']), 'faces')
    Path('src/external-geometry.js').write_text('// Generated by scripts/convert-external-assets.py. CC0 sources: data/external_assets.json.\nexport const externalGeometry='+json.dumps(output, separators=(',', ':'))+';\n')
