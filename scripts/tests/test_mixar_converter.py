import importlib.util
import inspect
import json
import struct
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('converter', Path(__file__).parents[1] / 'convert-mixar-buildings.py')
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


def fixture(folder, extra=None, scale=None, double_sided=False):
    points = [(-1, 0, -1), (1, 0, -1), (1, 2, -1), (-1, 2, -1)]
    blob = b''.join(struct.pack('<3f', *p) for p in points) + struct.pack('<6H', 0, 1, 2, 0, 2, 3)
    doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
           'nodes': [{'name': 'MMR | hall | T01 Architecture', 'mesh': 0, 'scale': scale or [1, 1, 1]}],
           'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1, 'material': 0}]}],
           'materials': [{'name': 'MMR | amber', 'doubleSided': double_sided, 'pbrMetallicRoughness': {'baseColorFactor': [.5, .25, .1, 1]}, 'emissiveFactor': [.5, .25, .1]}],
           'buffers': [{'byteLength': len(blob)}],
           'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 48}, {'buffer': 0, 'byteOffset': 48, 'byteLength': 12}],
           'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 4, 'type': 'VEC3'}, {'bufferView': 1, 'componentType': 5123, 'count': 6, 'type': 'SCALAR'}]}
    doc.update(extra or {})
    text = json.dumps(doc).encode(); text += b' ' * (-len(text) % 4)
    blob += b'\0' * (-len(blob) % 4)
    raw = struct.pack('<III', 0x46546c67, 2, 28 + len(text) + len(blob)) + struct.pack('<II', len(text), 0x4e4f534a) + text + struct.pack('<II', len(blob), 0x004e4942) + blob
    path = Path(folder) / 'fixture.glb'; path.write_bytes(raw)
    return path


class ConverterTests(unittest.TestCase):
    def test_linear_palette_color_is_encoded_to_srgb_not_remapped(self):
        self.assertEqual(converter.linear_hex([.5, .25, .1]), '#bc8959')
        self.assertEqual(converter.linear_hex([0, 1, 0]), '#00ff00')

    def test_uniform_fit_preserves_height_ground_and_ownership_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            mesh = converter.convert_glb(fixture(folder), {'hall': 2})['mmr-hall-1']
        points = [p for f in mesh['faces'] for p in f['v']]
        self.assertEqual(min(p[2] for p in points), 0)
        self.assertAlmostEqual(max(p[2] for p in points), 1.88, places=4)
        self.assertTrue(all(abs(p[0]) <= .941 and abs(p[1]) <= .941 for p in points))
        self.assertEqual(mesh['meta']['sourceObject'], 'MMR | hall | T01 Architecture')
        self.assertEqual(len(mesh['meta']['sourceSHA256']), 64)
        self.assertTrue(mesh['meta']['complete'])
        self.assertEqual(mesh['faces'][0]['c'], '#bc8959')
        self.assertGreater(mesh['faces'][0]['e'], 0)
        self.assertTrue(mesh['lods']['low']['faces'])
        self.assertTrue(mesh['sources'])
        self.assertAlmostEqual(mesh['sources'][0]['position'][2], .94, places=4)

    def test_optional_id_filter_converts_only_requested_building_tiers(self):
        self.assertIn('only', inspect.signature(converter.convert_glb).parameters)
        with tempfile.TemporaryDirectory() as folder:
            output = converter.convert_glb(fixture(folder), {'hall': 2}, {'mmr-hall-1'})
        self.assertEqual(list(output), ['mmr-hall-1'])

    def test_coplanar_adjacent_triangles_merge_without_discarding_surface(self):
        with tempfile.TemporaryDirectory() as folder:
            mesh = converter.convert_glb(fixture(folder), {'hall': 2})['mmr-hall-1']
        self.assertEqual(len(mesh['faces']), 1)
        self.assertEqual(len(mesh['faces'][0]['v']), 4)
        self.assertEqual(mesh['meta']['sourceTriangles'], 2)

    def test_coplanar_grid_caches_face_normals_during_merging(self):
        import numpy as np
        triangles = []
        for y in range(8):
            for x in range(8):
                a, b = [x, y, 0], [x + 1, y, 0]
                c, d = [x + 1, y + 1, 0], [x, y + 1, 0]
                for face in ([a, b, c], [a, c, d]):
                    triangles.append((np.array(face, dtype=float), '#bc8959', 0, False))
        cross = converter.np.cross
        calls = 0

        def counted_cross(*args, **kwargs):
            nonlocal calls
            calls += 1
            return cross(*args, **kwargs)

        converter.np.cross = counted_cross
        try:
            faces = converter.merge_faces(triangles)
        finally:
            converter.np.cross = cross
        self.assertEqual(len(faces), 1)
        self.assertLess(calls, 1000)

    def test_source_double_sided_material_survives_conversion(self):
        with tempfile.TemporaryDirectory() as folder:
            mesh = converter.convert_glb(fixture(folder, double_sided=True), {'hall': 2})['mmr-hall-1']
        self.assertTrue(all(f['d'] for f in mesh['faces']))
        self.assertTrue(all(f['d'] for f in mesh['lods']['low']['faces']))

    def test_closed_inverted_solids_get_consistent_outward_normals(self):
        import numpy as np
        points = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=float)
        triangles = [(points[list(reversed(face))], '#bc8959', 0, True) for face in [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]]]
        repaired = converter.repair_solids(triangles)
        volume = sum(np.dot(t[0], np.cross(t[1], t[2])) for t, _, _, _ in repaired) / 6
        self.assertGreater(volume, 0)
        self.assertTrue(all(not d for _, _, _, d in repaired))
        self.assertEqual(len(repaired), len(triangles))

    def test_low_lod_retains_thin_roof_sheets_instead_of_collapsing_them(self):
        import numpy as np
        triangles = []
        for i in range(30):
            a = [0, i*.05, 1+(i % 2)*.05]; b = [1, i*.05, 1+(i % 2)*.05]
            c = [1, (i+1)*.05, 1+((i+1) % 2)*.05]; d = [0, (i+1)*.05, 1+((i+1) % 2)*.05]
            for points in [[a, b, c], [a, c, d]]:
                triangles.append((np.array(points), '#386e98', 0, True))
        expected = converter.merge_faces(triangles)
        self.assertEqual(converter.low_mesh(triangles)['faces'], expected)

    def test_catalog_low_lod_stays_inside_the_building_footprint(self):
        path = Path(__file__).parents[2] / 'assets/meshes/mmr-chapel-5.json'
        mesh = json.loads(path.read_text())
        limit = mesh['meta']['footprint'] / 2
        for lod in (mesh['faces'], mesh['lods']['low']['faces']):
            for face in lod:
                for x, y, z in face['v']:
                    self.assertLessEqual(abs(x), limit)
                    self.assertLessEqual(abs(y), limit)
                    self.assertGreaterEqual(z, 0)

    def test_vegetated_work_sites_keep_complete_small_component_silhouettes_at_low_lod(self):
        for family in ['farm', 'grove', 'frostgrove', 'whisper-grove', 'manor-gardens']:
            mesh = json.loads((Path(__file__).parents[2] / ('assets/meshes/mmr-' + family + '-5.json')).read_text())
            self.assertEqual(mesh['lods']['low']['faces'], mesh['faces'], family + ' complete component fallback')

    def test_negative_node_transform_does_not_invert_winding(self):
        with tempfile.TemporaryDirectory() as folder:
            mesh = converter.convert_glb(fixture(folder, scale=[-1, 1, 1]), {'hall': 2})['mmr-hall-1']
        a, b, c = mesh['faces'][0]['v'][:3]
        import numpy as np
        self.assertLess(np.cross(np.array(b) - a, np.array(c) - a)[1], 0)

    def test_animation_and_unknown_required_extensions_are_rejected(self):
        for extra in [{'animations': [{}]}, {'extensionsRequired': ['UNKNOWN']}]:
            with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
                converter.convert_glb(fixture(folder, extra), {'hall': 2})


if __name__ == '__main__':
    unittest.main()
