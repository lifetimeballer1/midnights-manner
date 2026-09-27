// Frontier expansion (Phase 2, Cities-Skylines style): paid tile claims.
// All numbers live in data/expansion.json (rings of cost by distance from
// the homestead rect). No tile-specific or troop-specific conditionals —
/// generic lookups by coordinate only.
export function homesteadOf(dataExpansion, dataWorld) {
  const h = dataExpansion?.homestead;
  return {
    w: Number.isFinite(h?.w) ? h.w : (dataWorld?.width || 20),
    h: Number.isFinite(h?.h) ? h.h : (dataWorld?.height || 17)
  };
}

// Distance ring outside the settled rect (Chebyshev overhang beyond the
// usable x<=w-2 / y<=h-2 rows). Reference is the live world bounds when
// given (nearer home = cheaper), else the homestead rect from data.
// 0 = settled heart (already claimed — claimCheck rejects those first).
export function ringFor(dataExpansion, dataWorld, x, y, bounds = null) {
  const ref = bounds ? {w: bounds.w, h: bounds.h} : homesteadOf(dataExpansion, dataWorld);
  const dx = Math.max(0, x - (ref.w - 2));
  const dy = Math.max(0, y - (ref.h - 2));
  return Math.max(dx, dy);
}

// Cost object for claiming (x,y); null inside the settled heart.
export function costFor(dataExpansion, dataWorld, x, y, bounds = null) {
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
export function claimCheck(world, dataExpansion, dataWorld, x, y) {
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
