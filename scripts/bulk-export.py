"""Bulk-convert the approved P2 static set (one download per pack) and emit manifest entries.

Usage: python scripts/bulk-export.py
Writes assets/meshes/<id>.json + prints a manifest JSON fragment to stdout.
All entries default enabled:false (rollout phases flip them after gates).
"""
import io, json, urllib.request, zipfile

ZIPS = {
    'nature': 'https://opengameart.org/sites/default/files/Nature%20Kit%20%282.1%29.zip',
    'town': 'https://opengameart.org/sites/default/files/kenney_fantasy-town-kit_2.0.zip',
    'props': 'https://opengameart.org/sites/default/files/fantasy_props_megakitstandard.zip',
    'castle': 'https://opengameart.org/sites/default/files/kenney_castle-kit.zip',
}

# (id, zipkey, objname, height-tiles, maxfaces, use)
SPEC = [
    ('lily-small', 'nature', 'lily_small', .18, 60, 'Pond decoration'),
    ('lily-large', 'nature', 'lily_large', .22, 60, 'Pond decoration'),
    ('log', 'nature', 'log', .3, 60, 'Fallen timber'),
    ('log-stack', 'nature', 'log_stack', .5, 100, 'Lumber workplace dressing'),
    ('flower-red', 'nature', 'flower_redA', .3, 60, 'Cottage flowers'),
    ('flower-yellow', 'nature', 'flower_yellowB', .3, 60, 'Cottage flowers'),
    ('flower-purple', 'nature', 'flower_purpleC', .3, 60, 'Cottage flowers'),
    ('rock-small-a', 'nature', 'rock_smallA', .35, 80, 'Rocky patches'),
    ('rock-small-d', 'nature', 'rock_smallD', .45, 80, 'Rocky patches'),
    ('bush', 'nature', 'plant_bush', .6, 100, 'Low vegetation'),
    ('bush-small', 'nature', 'plant_bushSmall', .4, 80, 'Low vegetation'),
    ('stone-small', 'nature', 'stone_smallB', .3, 80, 'Shore/path stones'),
    ('roof-gable', 'town', 'roof-gable', .8, 200, 'Cottage/hall roof upgrade'),
    ('roof-window', 'town', 'roof-window', .5, 120, 'Roof dormer detail'),
    ('shutters', 'town', 'wall-wood-window-shutters', .5, 120, 'Window detail'),
    ('wood-door', 'town', 'wall-wood-door', .8, 150, 'Entrance detail'),
    ('chimney', 'town', 'chimney', .7, 120, 'Smoke-stack detail (anchors lighting)'),
    ('stairs-stone', 'town', 'stairs-stone', .5, 150, 'Entrance steps'),
    ('overhang', 'town', 'overhang', .4, 120, 'Market stall canopy detail'),
    ('fence', 'town', 'fence', .5, 120, 'Paddock borders'),
    ('town-lantern', 'town', 'lantern', .5, 100, 'Street lantern (light anchor)'),
    ('workbench', 'props', 'Workbench', .55, 160, 'Smithy/workshop prop'),
    ('dummy', 'props', 'Dummy', .8, 150, 'Barracks training prop'),
    ('weapon-stand', 'props', 'WeaponStand', .7, 150, 'Barracks/armory prop'),
    ('crate', 'props', 'Crate_Wooden', .45, 100, 'Storage/market prop'),
    ('barrel', 'props', 'Barrel', .55, 120, 'Storage/market prop'),
    ('crate-apple', 'props', 'FarmCrate_Apple', .4, 120, 'Farm produce prop'),
    ('crate-carrot', 'props', 'FarmCrate_Carrot', .4, 120, 'Farm produce prop'),
    ('book-stand', 'props', 'BookStand', .7, 150, 'School/scriptorium prop'),
    ('lantern-wall', 'props', 'Lantern_Wall', .4, 100, 'Wall lantern (light anchor)'),
    ('torch-metal', 'props', 'Torch_Metal', .6, 100, 'Gate/wall torch (light anchor)'),
    ('pennant', 'castle', 'flag-pennant', .5, 80, 'Faction banner cloth'),
]

PACK = {
    'nature': ('Kenney Nature Kit 2.1', 'Kenney', 'https://opengameart.org/content/nature-kit'),
    'town': ('Kenney Fantasy Town Kit 2.0', 'Kenney', 'https://opengameart.org/content/fantasy-town-kit'),
    'props': ('Quaternius Fantasy Props MegaKit (Standard)', 'Quaternius', 'https://opengameart.org/content/fantasy-props-megakit'),
    'castle': ('Kenney Castle Kit', 'Kenney', 'https://opengameart.org/content/castle-kit'),
}


def parse_mtl(text):
    mats, cur = {}, None
    for line in text.splitlines():
        p = line.strip().split()
        if not p:
            continue
        if p[0] == 'newmtl' and len(p) > 1:
            cur = p[1]
            mats[cur] = '#9aa0a3'
        elif p[0] == 'Kd' and cur and len(p) >= 4:
            try:
                r, g, b = (max(0.0, min(1.0, float(p[i]))) for i in (1, 2, 3))
                mats[cur] = '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))
            except ValueError:
                pass
    return mats


def convert(z, name, target, max_faces):
    obj_key = next(n for n in z.namelist() if n.lower().endswith('/' + name.lower() + '.obj') or n.lower().endswith(name.lower() + '.obj'))
    base = obj_key.rsplit('/', 1)[0] + '/'
    mats = {}
    for n in z.namelist():
        if n.lower().endswith('.mtl') and n.startswith(base):
            mats.update(parse_mtl(z.read(n).decode('utf-8', 'replace')))
    verts, faces, cur = [], [], '#9aa0a3'
    for line in z.read(obj_key).decode('utf-8', 'replace').splitlines():
        p = line.strip().split()
        if not p:
            continue
        if p[0] == 'v' and len(p) >= 4:
            verts.append([float(p[1]), float(p[2]), float(p[3])])
        elif p[0] == 'usemtl' and len(p) > 1:
            cur = mats.get(p[1], '#9aa0a3')
        elif p[0] == 'f' and len(p) >= 4:
            idx = []
            for q in p[1:]:
                try:
                    idx.append(int(q.split('/')[0]) - 1)
                except ValueError:
                    pass
            idx = [i for i in idx if 0 <= i < len(verts)]
            if len(idx) >= 3:
                for k in range(1, len(idx) - 1):
                    faces.append({'v': [idx[0], idx[k], idx[k + 1]], 'c': cur})
    xs = [verts[i][0] for f in faces for i in f['v']]
    ys = [verts[i][1] for f in faces for i in f['v']]
    h = (max(ys) - min(ys)) or 1.0
    s = target / h
    cx, gz = (max(xs) + min(xs)) / 2, min(ys)
    pts = [((v[0] - cx) * s, v[2] * s, (v[1] - gz) * s) for v in verts]
    tris = [{'v': [pts[i] for i in f['v']], 'c': f['c']} for f in faces]

    def area(t):
        (ax, ay, az), (bx, by, bz), (cx_, cy, cz) = t['v']
        ux, uy, uz = bx - ax, by - ay, bz - az
        vx, vy, vz = cx_ - ax, cy - ay, cz - az
        return (uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2
    tris.sort(key=area, reverse=True)
    return obj_key, tris[:max_faces]


def main():
    cache = {}
    manifest = {}
    total_kb = 0
    for mid, zk, obj, th, mf, use in SPEC:
        if zk not in cache:
            print('fetch', zk, flush=True)
            cache[zk] = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(ZIPS[zk], timeout=120).read()))
        obj_key, tris = convert(cache[zk], obj, th, mf)
        with open('assets/meshes/%s.json' % mid, 'w') as fh:
            json.dump({'meta': {'source_obj': obj_key, 'faces': len(tris), 'height_tiles': th}, 'faces': tris}, fh)
        import os
        kb = os.path.getsize('assets/meshes/%s.json' % mid) / 1024
        total_kb += kb
        pack, creator, source = PACK[zk]
        manifest[mid] = {'enabled': False, 'phase': 2, 'pack': pack, 'creator': creator,
                         'license': 'CC0', 'source': source, 'sourceObj': obj_key,
                         'file': 'assets/meshes/%s.json' % mid, 'use': use}
        print('%-14s %3d faces %6.1f KB' % (mid, len(tris), kb), flush=True)
    with open('assets/meshes/_manifest-fragment.json', 'w') as fh:
        json.dump(manifest, fh, indent=1)
    print('TOTAL %.1f KB' % total_kb)


main()
