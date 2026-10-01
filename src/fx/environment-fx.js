// Environment dynamics: pond glints + distant birds. Screen-space,
// deterministic, Calm-aware, hard-capped for phones. Static meshes stay
// untouched (cache-safe); these read as sun and life on top.
export function drawEnvironmentFx(r, world, time) {
  const c = r.ctx;
  // Pond glints: 3-frame shimmer per pond, frozen frame under Calm.
  const frame = r.calm ? 0 : Math.floor(time / 400) % 3;
  let glints = 0;
  for (const b of world.buildings || []) {
    if (b.type !== 'pond' && b.type !== 'deephole') continue;
    if (glints >= 12) break;
    const spec = r.data.buildings[b.type];
    if (!spec) continue;
    const n = spec.size || 1;
    const p = r.project(b.x + n / 2, b.y + n / 2);
    if (p.x < -60 || p.x > r.width + 60 || p.y < -80 || p.y > r.height + 60) continue;
    const gx = p.x + ((b.id?.length || 1) * 7 + frame * 5) % 18 - 9;
    c.fillStyle = 'rgba(166,219,240,0.8)';
    c.fillRect(gx, p.y - 2, 6 - frame, 1.5);
    glints++;
  }
  // Distant birds: two strokes crossing only when zoomed out and in motion.
  if (r.calm || r.cam.zoom > 0.9) return;
  const t = (time / 24000) % 1;
  c.strokeStyle = 'rgba(26,32,44,0.7)';
  c.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const bx = r.width * ((t + i * 0.5) % 1);
    const by = r.height * (0.18 + i * 0.07) + Math.sin(time / 600 + i * 3) * 6;
    c.beginPath();
    c.moveTo(bx - 7, by);
    c.quadraticCurveTo(bx - 2, by - 4, bx, by);
    c.quadraticCurveTo(bx + 2, by - 4, bx + 7, by);
    c.stroke();
  }
}
