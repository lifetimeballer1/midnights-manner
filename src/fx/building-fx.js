// Building state overlays: construction stakes, damage cracks + fire.
// Screen-space, deterministic per building id, Calm-aware. Meshes stay
// static (cache key only tracks alive/finished), so these live in the
// dynamic pass and never thrash the static mesh cache.
import {phaseSeed} from '../camera.js';

function frac(b, spec) {
  const max = spec?.tiers?.[b.level - 1]?.hp || 1;
  return Math.max(0, Math.min(1, b.hp / max));
}

function buildFrac(b, spec) {
  const total = spec?.buildSeconds || 8;
  if (!(b.remaining > 0)) return 1;
  return Math.max(0, Math.min(1, 1 - b.remaining / total));
}

export function drawBuildingStates(r, world, time) {
  const c = r.ctx;
  if (r.cam.zoom < 0.6) return;
  for (const b of world.buildings || []) {
    const spec = r.data.buildings[b.type];
    if (!spec) continue;
    const n = spec.size || 1;
    const cx = b.x + n / 2, cy = b.y + n / 2;
    const p = r.project(cx, cy);
    if (p.x < -60 || p.x > r.width + 60 || p.y < -80 || p.y > r.height + 60) continue;
    const seed = phaseSeed(b.id ?? b.type);
    // Construction: foundation stakes while the scaffold rises (<12%).
    if (b.remaining > 0 && b.hp > 0) {
      const f = buildFrac(b, spec);
      if (f < 0.12) {
        c.fillStyle = '#6e4429';
        const s = Math.max(2, 3 * r.cam.zoom);
        for (const [dx, dy] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) {
          const q = r.project(cx + dx * n * .5, cy + dy * n * .5);
          c.fillRect(q.x - s / 2, q.y - s, s, s * 2);
        }
      }
      continue;
    }
    if (b.hp <= 0) continue; // rubble mesh + scorch already in static pass
    const f = frac(b, spec);
    // Damage: cracks below two-thirds, darkening + fire below one-third.
    if (f < 0.66) {
      c.strokeStyle = 'rgba(26,20,36,0.75)';
      c.lineWidth = Math.max(1, r.cam.zoom);
      const w = 14 * r.cam.zoom, h = 10 * r.cam.zoom;
      c.beginPath();
      c.moveTo(p.x - w / 2 + seed % 5, p.y - h / 2);
      c.lineTo(p.x - w / 6, p.y);
      c.lineTo(p.x - w / 2 + 3, p.y + h / 2);
      c.moveTo(p.x + w / 3, p.y - h / 2 + 2);
      c.lineTo(p.x + w / 6, p.y + 1);
      c.lineTo(p.x + w / 2 - 2, p.y + h / 2);
      c.stroke();
    }
    if (f < 0.34) {
      // Ember flicker: deterministic sin noise, frozen under Calm.
      const fl = r.calm ? 0.5 : 0.5 + 0.5 * Math.sin(time / 130 + seed * 2.3);
      const s = (2.2 + fl * 2) * r.cam.zoom;
      c.fillStyle = `rgba(255,154,60,${0.55 + fl * 0.4})`;
      c.beginPath();
      c.arc(p.x + ((seed % 11) - 5), p.y - 8 * r.cam.zoom, Math.max(1.2, s / 2), 0, Math.PI * 2);
      c.fill();
      if (!r.calm && (Math.floor(time / 900) + seed) % 4 === 0) {
        c.globalAlpha = 0.25;
        c.fillStyle = '#3b2a22';
        c.beginPath();
        c.arc(p.x - 4, p.y - 16 * r.cam.zoom, 3 * r.cam.zoom, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
      }
    }
  }
}
