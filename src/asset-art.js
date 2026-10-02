// Converted CC0 mesh adapter. Renderer-only, no save fields.
// Meshes are offline exports (scripts/export-art.py): {faces:[{v:[[x,y,z]x3],c:'#hex'}]},
// modeled in tile units around origin, ground at z=0. drawMesh places them at
// a tile anchor through MeshScene.face so lighting, orbit, picking and caches
// behave like native geometry. Far zoom draws only the largest-area faces
// first (the exporter sorts largest-first), keeping silhouettes cheap.
const cache = new Map();

export function artEnabled(data, id) {
  const manifest = data?.artManifest ?? data?.['art-manifest'];
  const entry = manifest?.meshes?.[id] ?? manifest?.baked?.[id];
  return entry?.enabled === true;
}

export function lodFaceCount(total, zoom, quality) {
  const q = quality?.maxEffects ?? 60;
  if (zoom < 0.75) return Math.min(total, 12);
  if (zoom < 1.2) return Math.min(total, q >= 60 ? 60 : 24);
  return total;
}

export function drawMesh(s, mesh, x, y, opts = {}) {
  if (!mesh || !Array.isArray(mesh.faces) || !mesh.faces.length) return 0;
  const zoom = s.r?.cam?.zoom ?? 1.65;
  const n = lodFaceCount(mesh.faces.length, zoom, s.r?.qualityCfg);
  const dx = opts.dx ?? 0, dy = opts.dy ?? 0, dz = opts.dz ?? 0;
  const prev = s.owner;
  if (opts.owner !== undefined) s.owner = opts.owner;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    const f = mesh.faces[i];
    if (!f || !Array.isArray(f.v) || f.v.length < 3 || typeof f.c !== 'string') continue;
    s.face(f.v.map(([vx, vy, vz]) => [x + vx + dx, y + vy + dy, vz + dz]), f.c);
    drawn++;
  }
  s.owner = prev;
  return drawn;
}

export function meshBounds(mesh) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const f of mesh?.faces || []) for (const [x, y, z] of f.v || []) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
    if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
  }
  return {x0, y0, z0, x1, y1, z1};
}

export function cachedMesh(key, doc) {
  if (!cache.has(key)) cache.set(key, doc);
  return cache.get(key);
}

// Converted-mesh workplace accents. Augment-only: targeted buildings keep
// every procedural face, meshes add readable trade props at footprint edges.
// Missing/disabled meshes, ruins and scaffolds render exactly the original
// look. Pinned baseline buildings (hall, cottage, tower, walls, gates, mill,
// sawmill, great works) are deliberately excluded so their frozen digests
// only move in a dedicated architecture pass.
const ACCENTS = {
  barracks: [['dummy', .15, .15], ['weapon-stand', .55, .1]],
  schoolroom: [['book-stand', .3, .3]],
  scriptorium: [['book-stand', .3, .3]],
  storehouse: [['crate', .1, .15], ['barrel', .6, .1]],
  market: [['crate-apple', .1, .7]],
  farm: [['crate-carrot', .1, .7]],
  forge: [['workbench', .55, .05]],
  longhouse: [['pennant', .45, .4, .95]],
  timber_yard: [['log-stack', .1, .1]],
  pasture: [['fence', .05, .05]],
};
// Compact KayKit structural modules supplement, never replace, authored tiers.
// Roof anchors follow each family's existing roof rather than the tile center.
const BUILDING_ROOFS = {
  hall: [.5, .68, l => .42+l*.16+(.4+l*.05)*.55],
  cottage: [.5, .68, l => .42+l*.16+(.36+l*.06)*.55],
  barracks: [.5, .68, l => .42+l*.16+(.42+l*.06)*.55],
  farm: [.335, .4, l => .42+l*.16+(.34+l*.05)*.55],
  lumber: [.34, .36, l => .36+l*.1+(.28+l*.04)*.55],
  mine: [.5, .4, l => .88+(.22+l*.04)*.55],
  market: [.63, .7, l => .42+l*.13+(.32+l*.05)*.55],
  forge: [.5, .68, l => .42+l*.16+(.42+l*.06)*.55],
};
export function addConvertedAccents(s, b, spec) {
  const list = ACCENTS[b.type];
  if (!list || b.id == null || b.hp <= 0 || b.remaining > 0) return 0;
  const meshes = s.r?.meshes;
  if (!meshes) return 0;
  const n = spec?.size || 1;
  let added = 0;
  for (const [id, fx, fy, fz] of list) {
    const doc = meshes[id];
    if (!doc || !artEnabled(s.r?.data, id)) continue;
    added += drawMesh(s, doc, b.x + n * fx, b.y + n * fy, {dz: fz ?? 0});
  }
  return added;
}
export function addConvertedBuildingTiers(s, b, spec) {
  if (b.id == null || b.hp <= 0 || b.remaining > 0) return 0;
  const roof = BUILDING_ROOFS[b.type], l = b.level;
  if (!roof || l < 2 || (s.r?.cam?.zoom ?? 1.65) < 1.35) return 0;
  const meshes = s.r?.meshes, n = spec.size;
  if (!meshes) return 0;
  let added = 0;
  const modules = [['fence', Math.max(.44,n*.25), n-.12, .12]];
  if (l >= 5) modules.push(['roof-gable', n*roof[0], n*roof[1], roof[2](l)]);
  if (l >= 6) modules.push(['fence', n-.44, .16, .12]);
  const budget = s.r.width < 600 ? 800 : 1400;
  for (const [id, x, y, z] of modules) {
    const doc = id === 'fence' && l >= 4 ? meshes[id]?.variants?.stone : meshes[id];
    if (!artEnabled(s.r.data,id) || !doc?.faces?.length || (s.buildingArtFaces || 0)+doc.faces.length > budget) continue;
    const count = drawMesh(s,doc,b.x+x,b.y+y,{dz:z});
    s.buildingArtFaces = (s.buildingArtFaces || 0)+count;
    added += count;
  }
  return added;
}
