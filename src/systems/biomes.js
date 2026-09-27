// Biome data layer (Phase 1): deterministic visual-only tiles.
// All content lives in data/biomes.json + data/world.json tiles.
// No troop/building-specific conditionals here — generic by biome id.
// Landmark tiles are hand-placed in world.json and NEVER overwritten
// by procedural fill (guard in tileFor/buildTiles).
export const BIOME_IDS = ['plains', 'forest', 'water', 'hills', 'unclaimed-fringe'];

// Deterministic hash: same (x,y,seed) always yields the same biome.
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h >>> 0;
}

// Default biome distribution (visual only in Phase 1):
// plains ~50%, forest ~25%, hills ~12%, water ~13%.
// unclaimed-fringe is reserved for Phase 2 wilderness — never rolled here.
export function biomeFor(x, y, seed = 0) {
  const roll = hash2(x, y, seed) % 100;
  if (roll < 50) return 'plains';
  if (roll < 75) return 'forest';
  if (roll < 87) return 'hills';
  return 'water';
}

export function seedFor(dataWorld) {
  return Number.isFinite(dataWorld?.seed) ? dataWorld.seed : 0;
}

export function landmarkAt(dataWorld, x, y) {
  const tiles = dataWorld?.tiles;
  if (!Array.isArray(tiles)) return null;
  return tiles.find(t => t.x === x && t.y === y && t.landmark) || null;
}

// Single tile lookup: landmark wins, otherwise deterministic default.
// Guard: procedural fill must never overwrite a landmark tile.
export function tileFor(dataWorld, x, y) {
  const marked = landmarkAt(dataWorld, x, y);
  if (marked) return {x, y, biome: marked.biome, landmark: marked.landmark, claimed: marked.claimed !== false};
  return {x, y, biome: biomeFor(x, y, seedFor(dataWorld)), landmark: null, claimed: true};
}

// Full grid build (w*h tiles). Landmarks preserved by construction.
export function buildTiles(dataWorld) {
  const w = dataWorld?.width || 20;
  const h = dataWorld?.height || 17;
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out.push(tileFor(dataWorld, x, y));
    }
  }
  return out;
}

// Renderer helper: tint string for a biome id (visual only, no gameplay).
export function biomeTint(dataBiomes, biomeId) {
  return dataBiomes?.[biomeId]?.tint || null;
}
