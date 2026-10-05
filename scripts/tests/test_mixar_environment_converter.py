import hashlib
import importlib.util
import io
import json
import struct
import tempfile
import unittest
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location('external_converter', Path(__file__).parents[1] / 'convert-external-assets.py')
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


def png_bytes(color):
    output = io.BytesIO()
    Image.new('RGB', (1, 1), color).save(output, format='PNG')
    return output.getvalue()


def fixture(folder, image_bytes=(), selected_images=(0,), with_uv=True):
    points = [(-.5, 0, -.5), (.5, 0, -.5), (.5, 2, -.5), (-.5, 2, -.5)]
    blob = b''.join(struct.pack('<3f', *p) for p in points) + struct.pack('<6H', 0, 1, 2, 0, 2, 3)
    doc = {
        'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0, 1]}],
        'nodes': [
            {'name': 'tree_single_A.008', 'mesh': 0},
            {'name': 'unselected-prop', 'mesh': 0, 'translation': [10, 0, 0]},
        ],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1, 'material': 0}]}],
        'materials': [{'name': 'Source material', 'pbrMetallicRoughness': {'baseColorFactor': [.5, .25, .1, 1]}}],
        'buffers': [{'byteLength': len(blob)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': 48},
            {'buffer': 0, 'byteOffset': 48, 'byteLength': 12},
        ],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 4, 'type': 'VEC3'},
            {'bufferView': 1, 'componentType': 5123, 'count': 6, 'type': 'SCALAR'},
        ],
    }
    if image_bytes:
        primitive = doc['meshes'][0]['primitives'][0]
        if with_uv:
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': 32})
            blob += struct.pack('<8f', 0, 0, 1, 0, 1, 1, 0, 1)
            doc['accessors'].append({'bufferView': 2, 'componentType': 5126, 'count': 4, 'type': 'VEC2'})
            primitive['attributes']['TEXCOORD_0'] = 2
        doc['images'], doc['textures'] = [], []
        for index, data in enumerate(image_bytes):
            blob += b'\0' * (-len(blob) % 4)
            doc['images'].append({'bufferView': len(doc['bufferViews']), 'mimeType': 'image/png'})
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)})
            blob += data
            doc['textures'].append({'source': index})
            doc['materials'].append({'pbrMetallicRoughness': {'baseColorTexture': {'index': index}}})
        doc['meshes'].append({'primitives': [
            dict(primitive, material=0 if index is None else index + 1) for index in selected_images
        ]})
        doc['nodes'][0]['mesh'] = 1
        primitive['material'] = 1
        doc['buffers'][0]['byteLength'] = len(blob)
    text = json.dumps(doc).encode(); text += b' ' * (-len(text) % 4)
    blob += b'\0' * (-len(blob) % 4)
    raw = struct.pack('<III', 0x46546c67, 2, 28 + len(text) + len(blob))
    raw += struct.pack('<II', len(text), 0x4e4f534a) + text
    raw += struct.pack('<II', len(blob), 0x004e4942) + blob
    path = Path(folder) / 'environment-fixture.glb'; path.write_bytes(raw)
    return path, raw


class MixarEnvironmentConverterTests(unittest.TestCase):
    def test_named_node_becomes_grounded_flat_faces_at_requested_height(self):
        with tempfile.TemporaryDirectory() as folder:
            path, raw = fixture(folder)
            mesh = converter.convert_node(path, 'tree_single_A.008', 1.4)

        self.assertEqual(mesh['meta']['format'], 'flat-face-v1')
        self.assertEqual(mesh['meta']['sourceObject'], 'tree_single_A.008')
        self.assertEqual(mesh['meta']['sourceSHA256'], hashlib.sha256(raw).hexdigest())
        self.assertIsNone(mesh['meta']['textureSHA256'])
        self.assertEqual(len(mesh['faces']), 1)
        points = [p for face in mesh['faces'] for p in face['v']]
        self.assertAlmostEqual(min(p[2] for p in points), 0, places=6)
        self.assertAlmostEqual(max(p[2] for p in points), 1.4, places=6)
        self.assertLess(max(abs(p[0]) for p in points), .36)
        self.assertTrue(all(face['c'].startswith('#') for face in mesh['faces']))

    def test_texture_hash_uses_selected_nodes_nonzero_image_index(self):
        textures = (png_bytes((96, 74, 57)), png_bytes((49, 93, 67)))
        with tempfile.TemporaryDirectory() as folder:
            path, _ = fixture(folder, textures, selected_images=(1,))
            mesh = converter.convert_node(path, 'tree_single_A.008')

        self.assertEqual({face['c'] for face in mesh['faces']}, {'#315d43'})
        self.assertEqual(mesh['meta']['textureSHA256'], hashlib.sha256(textures[1]).hexdigest())

    def test_one_sampled_image_preserves_singular_hash_across_primitives(self):
        texture = png_bytes((96, 74, 57))
        with tempfile.TemporaryDirectory() as folder:
            path, _ = fixture(folder, (texture,), selected_images=(0, 0))
            mesh = converter.convert_node(path, 'tree_single_A.008')

        self.assertEqual(mesh['meta']['textureSHA256'], hashlib.sha256(texture).hexdigest())

    def test_unsampled_images_have_no_texture_hash(self):
        for selected_images, with_uv in [((None,), True), ((0,), False)]:
            with self.subTest(selected_images=selected_images, with_uv=with_uv):
                with tempfile.TemporaryDirectory() as folder:
                    path, _ = fixture(folder, (png_bytes((96, 74, 57)),), selected_images, with_uv)
                    mesh = converter.convert_node(path, 'tree_single_A.008')
                self.assertIsNone(mesh['meta']['textureSHA256'])

    def test_multiple_sampled_images_are_rejected_for_singular_provenance(self):
        textures = (png_bytes((96, 74, 57)), png_bytes((49, 93, 67)))
        with tempfile.TemporaryDirectory() as folder:
            path, _ = fixture(folder, textures, selected_images=(0, 1))
            with self.assertRaisesRegex(ValueError, 'Multiple sampled textures'):
                converter.convert_node(path, 'tree_single_A.008')

    def test_missing_named_node_and_nonpositive_height_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path, _ = fixture(folder)
            with self.assertRaisesRegex(ValueError, 'Missing requested GLB node'):
                converter.convert_node(path, 'missing-tree', 1.0)
            with self.assertRaisesRegex(ValueError, 'target height'):
                converter.convert_node(path, 'tree_single_A.008', 0)

    def test_empty_mesh_below_geometric_tolerance_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path, _ = fixture(folder)
            with self.assertRaisesRegex(ValueError, 'Empty converted mesh'):
                converter.convert_node(path, 'tree_single_A.008', .000001)


if __name__ == '__main__':
    unittest.main()
