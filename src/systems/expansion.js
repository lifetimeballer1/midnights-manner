// Frontier expansion (Phase 2b, Skylines-style): 9 named regions on a 3x3
// grid. All content lives in data/expansion.json (regions with rect, name,
// biome mix, nearby landmark, cost). Center is pre-claimed; the other 8 are
// claimed whole via Expand mode + region adjacency. Generic lookups by
// coordinate/region id only — no per-region or troop conditionals.
// Legacy ring table (rings/homestead) is kept as a fallback for saves and
// maps without regions.
export function homesteadOf(dataExpansion, dataWorld) {
  const h = dataExpansion?.homestead;
  return {
    w: Number.isFinite(h?.w) ? h.w : (dataWorld?.width || 20),
    h: Number.isFinite(h?.h) ? h.h : (dataWorld?.height || 17)
  };
}

export function regionsOf(dataExpansion) {
  return Array.isArray(dataExpansion?.regions) ? dataExpansion.regions : [];
}

// Region containing (x,y), or null.
export function regionFor(dataExpansion, x, y) {
  for (const r of regionsOf(dataExpansion)) {
    const q = r?.rect;
    if (!q) continue;
    if (x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h) return r;
  }
  return null;
}

export function regionById(dataExpansion, id) {
  return regionsOf(dataExpansion).find(r => r?.id === id) || null;
}

// Cost object for a region; null for pre-claimed/center.
export function regionCost(region) {
  if (!region || region.preclaimed) return null;
  return {...(region.cost || {})};
}

function inRect(q, x, y) {
  return x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h;
}

function tileInRegion(region, t) {
  return region?.rect ? inRect(region.rect, t.x, t.y) : false;
}

// A region reads claimed when every tile of its rect is claimed.
// Worlds without a tile grid read unclaimed (except pre-claimed, which
// migration claims before this is consulted).
export function isRegionClaimed(world, region) {
  if (!region?.rect || !Array.isArray(world?.tiles)) return false;
  const q = region.rect;
  for (let y = q.y; y < q.y + q.h; y++) {
    for (let x = q.x; x < q.x + q.w; x++) {
      const t = world.tiles.find(t => t.x === x && t.y === y);
      if (!t || t.claimed !== true) return false;
    }
  }
  return true;
}

// Region adjacency: any tile of the region borders (4-dir) a claimed tile
// outside the region. Diagonal-only contact (corners vs center) does not
// count, so corners unlock after an edge region is taken.
export function regionAdjacent(world, region) {
  if (!region?.rect || !Array.isArray(world?.tiles)) return false;
  const byKey = new Map(world.tiles.map(t => [t.x + ',' + t.y, t]));
  const q = region.rect;
  for (let y = q.y; y < q.y + q.h; y++) {
    for (let x = q.x; x < q.x + q.w; x++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (inRect(q, nx, ny)) continue;
        const n = byKey.get(nx + ',' + ny);
        if (n && n.claimed === true) return true;
      }
    }
  }
  return false;
}

// Region claim validation without spending: {ok, region} or {ok:false, reason}.
export function regionClaimCheck(world, dataExpansion, dataWorld, x, y) {
  const W = dataWorld?.width || 40, H = dataWorld?.height || 34;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y >= H) {
    return {ok: false, reason: 'edge'};
  }
  const region = regionFor(dataExpansion, x, y);
  if (!region) return {ok: false, reason: 'edge'};
  if (region.preclaimed || isRegionClaimed(world, region)) return {ok: false, reason: 'claimed'};
  if (!regionAdjacent(world, region)) return {ok: false, reason: 'adjacent'};
  return {ok: true, region, cost: regionCost(region)};
}

// Claim every tile of a region rect. Returns tiles flipped.
export function claimRegion(world, region) {
  if (!region?.rect || !Array.isArray(world?.tiles)) return 0;
  const q = region.rect;
  let n = 0;
  for (const t of world.tiles) {
    if (inRect(q, t.x, t.y) && !t.claimed) { t.claimed = true; n++; }
  }
  return n;
}

// Claim every pre-claimed (center) region. Returns tiles flipped.
// Used for new worlds and save migration so old villages keep every tile.
export function claimPreclaimed(world, dataExpansion) {
  let n = 0;
  for (const r of regionsOf(dataExpansion)) {
    if (r?.preclaimed) n += claimRegion(world, r);
  }
  return n;
}

// Distance ring outside the settled rect (Chebyshev overhang beyond the
// usable x<=w-2 / y<=h-2 rows). Reference is the live world bounds when
// given (nearer home = cheaper), else the homestead rect from data.
// 0 = settled heart (already claimed — claimCheck rejects those first).
// Legacy tile path; used when no regions are configured.
export function ringFor(dataExpansion, dataWorld, x, y, bounds = null) {
  const ref = bounds ? {w: bounds.w, h: bounds.h} : homesteadOf(dataExpansion, dataWorld);
  const dx = Math.max(0, x - (ref.w - 2));
  const dy = Math.max(0, y - (ref.h - 2));
  return Math.max(dx, dy);
}

// Cost object for claiming (x,y); null inside the settled heart.
// When regions exist, cost comes from the containing region instead.
export function costFor(dataExpansion, dataWorld, x, y, bounds = null) {
  if (regionsOf(dataExpansion).length) {
    const r = regionFor(dataExpansion, x, y);
    if (!r || r.preclaimed) return null;
    return regionCost(r);
  }
  const ring = ringFor(dataExpansion, dataWorld, x, y, bounds);
  if (ring <= 0) return null;
  const rings = dataExpansion?.rings;
  if (!Array.isArray(rings) || !rings.length) return {wood: 60, gold: 25};
  const entry = rings.find(r => ring <= (r.upto ?? 999)) || rings[rings.length - 1];
  return {...(entry.cost || {})};
}

export function tileAt(world, x, y) {
  if (!Array.isArray(world?.tiles)) return null;
  return world.tiles.find(t => t.x === x && t.y === y) || null;
}

export function isClaimed(world, x, y) {
  const t = tileAt(world, x, y);
  // Worlds without a tile grid (very old saves, mission maps) read claimed.
  if (!t) return true;
  return t.claimed === true;
}

export function neighborsClaimed(world, x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isClaimed(world, x + dx, y + dy));
}

// Claim validation without spending: {ok} or {ok:false, reason}.
// Prefers region checks when regions are configured; otherwise the
// legacy adjacent-tile path.
export function claimCheck(world, dataExpansion, dataWorld, x, y) {
  if (regionsOf(dataExpansion).length) {
    const r = regionClaimCheck(world, dataExpansion, dataWorld, x, y);
    if (!r.ok) return r;
    return {ok: true, ring: 1, region: r.region.id, cost: r.cost};
  }
  const W = dataWorld?.width || 40, H = dataWorld?.height || 34;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y >= H) {
    return {ok: false, reason: 'edge'};
  }
  const t = tileAt(world, x, y);
  if (t && t.claimed) return {ok: false, reason: 'claimed'};
  const ring = ringFor(dataExpansion, dataWorld, x, y, world.bounds);
  if (ring <= 0) return {ok: false, reason: 'edge'};
  if (!neighborsClaimed(world, x, y)) return {ok: false, reason: 'adjacent'};
  return {ok: true, ring, cost: costFor(dataExpansion, dataWorld, x, y, world.bounds)};
}

export function setClaimed(world, x, y, claimed = true) {
  const t = tileAt(world, x, y);
  if (t) t.claimed = claimed;
  return !!t;
}

// Claim every tile inside a settled rect (XP settling + migration).
export function claimRect(world, w, h) {
  if (!Array.isArray(world?.tiles)) return 0;
  let n = 0;
  for (const t of world.tiles) {
    if (t.x >= 1 && t.y >= 1 && t.x <= w - 2 && t.y <= h - 2 && !t.claimed) {
      t.claimed = true;
      n++;
    }
  }
  return n;
}
