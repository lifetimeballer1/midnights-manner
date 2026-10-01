"""Convert one CC0 OBJ (+MTL Kd colors) into a Midnight Manner mesh sample.

Usage:
  python scripts/export-art.py <zip-url> <ObjNameWithoutExt> <out.json> <target-height-tiles> [max-faces]

Only stdlib. Normalizes: center XZ, ground min-Y to 0, scale so bbox height
matches target. Per-face color comes from the MTL diffuse (Kd) of the active
material, quantized to hex. Ngons are fan-triangulated. Faces capped
(largest-area kept) to protect the 30k-face budget.
"""
import io, json, sys, urllib.request, zipfile


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


def main():
    if len(sys.argv) < 5:
        print(__doc__)
        sys.exit(2)
    url, name, out, target = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
    max_faces = int(sys.argv[5]) if len(sys.argv) > 5 else 400
    raw = urllib.request.urlopen(url, timeout=120).read()
    z = zipfile.ZipFile(io.BytesIO(raw))
    obj_key = next(n for n in z.namelist() if n.lower().endswith('/' + name.lower() + '.obj') or n.lower().endswith(name.lower() + '.obj'))
    base = obj_key.rsplit('/', 1)[0] + '/'
    text = z.read(obj_key).decode('utf-8', 'replace')
    mats = {}
    for n in z.namelist():
        if n.lower().endswith('.mtl') and n.startswith(base):
            try:
                mats.update(parse_mtl(z.read(n).decode('utf-8', 'replace')))
            except KeyError:
                pass
    verts, faces, cur_mat = [], [], '#9aa0a3'
    for line in text.splitlines():
        p = line.strip().split()
        if not p:
            continue
        if p[0] == 'v' and len(p) >= 4:
            verts.append([float(p[1]), float(p[2]), float(p[3])])
        elif p[0] == 'usemtl' and len(p) > 1:
            cur_mat = mats.get(p[1], '#9aa0a3')
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
                    faces.append({'v': [idx[0], idx[k], idx[k + 1]], 'c': cur_mat})
    if not faces:
        sys.exit('no faces parsed from ' + obj_key)
    # normalize: center XZ, ground Y, scale height to target tiles
    xs = [verts[i][0] for f in faces for i in f['v']]
    ys = [verts[i][1] for f in faces for i in f['v']]
    zs = [verts[i][2] for f in faces for i in f['v']]
    h = max(ys) - min(ys) or 1.0
    s = target / h
    cx, gz = (max(xs) + min(xs)) / 2, min(ys)
    # OBJ Y-up -> game Z-up: map (x, y, z) -> (x - cx, z, y - gz) scaled
    pts = [((v[0] - cx) * s, v[2] * s, (v[1] - gz) * s) for v in verts]
    tris = [{'v': [pts[i] for i in f['v']], 'c': f['c']} for f in faces]
    if len(tris) > max_faces:
        def area(t):
            (ax, ay, az), (bx, by, bz), (cx_, cy, cz) = t['v']
            ux, uy, uz = bx - ax, by - ay, bz - az
            vx, vy, vz = cx_ - ax, cy - ay, cz - az
            return (uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2
        tris.sort(key=area, reverse=True)
        tris = tris[:max_faces]
    doc = {'meta': {'source_obj': obj_key, 'faces': len(tris), 'height_tiles': target}, 'faces': tris}
    with open(out, 'w') as fh:
        json.dump(doc, fh)
    print('wrote %s (%d faces)' % (out, len(tris)))
    print('source: ' + url)


main()
