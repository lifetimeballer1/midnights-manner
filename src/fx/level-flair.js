// Level flair + hit flash for character meshes. Renderer-only, no saves.
// Thresholds from the spec: 5 armband, 10 shoulder trim, 15 plume/crest,
// 20 glowing trim, 25 gold trim. Static geometry (no per-frame allocs),
// detail-gated so phones keep silhouettes without tiny meshes.
export function drawLevelFlair(s, u, x, y, bob, detail) {
  const lvl = Math.max(1, Math.floor(+u.level || 1));
  if (lvl < 5) return;
  const brass = '#dfba6a', steel = '#b7c8ca';
  // 5: armband on the working arm.
  s.box(x + .15, y - .075, .36 + lift0(bob), .075, .14, .05, brass);
  if (lvl < 10) return;
  // 10: shoulder trim / cloak band.
  s.box(x - .16, y - .12, .5, .32, .24, .05, brass);
  if (detail) s.box(x - .17, y - .13, .2, .34, .05, .34, brass);
  if (lvl < 15) return;
  // 15: plume or crest spike.
  s.pyramid(x, y - .02, .9 + bob, .06, .16, '#b76053', 4);
  if (lvl < 20) return;
  // 20: glowing trim — emissive so it reads at midnight.
  const e = s.emissive;
  s.emissive = 1;
  s.box(x - .15, y - .11, .26 + bob, .3, .22, .04, '#ffe1a0');
  s.emissive = e;
  if (lvl < 25) return;
  // 25: gold trim + second plume tone.
  s.box(x - .16, y - .12, .56 + bob, .32, .03, .05, '#e8c673');
  if (detail) s.pyramid(x + .05, y - .02, .9 + bob, .045, .12, '#e8c673', 4);
}

function lift0(bob) { return Number.isFinite(bob) ? bob : 0; }

export function drawHitFlash(s, u, x, y, enemy, time) {
  const key = (enemy ? 'e' : 'u') + u.id;
  const until = s.r.flash?.get(key);
  if (until == null || !(time < until)) return;
  const a = Math.min(1, (until - time) / 150);
  const prev = s.alpha;
  s.alpha = Math.min(1, (prev ?? 1));
  // White chest plate at the flash alpha — 80-200ms read, no texture.
  const c = s.r.ctx;
  const p = s.r.project(x, y + .3);
  c.globalAlpha = a * 0.85;
  c.fillStyle = '#fff6e8';
  const w = 10 * s.r.cam.zoom, h = 14 * s.r.cam.zoom;
  c.fillRect(p.x - w / 2, p.y - h, w, h);
  c.globalAlpha = 1;
  void prev;
}
