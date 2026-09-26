// Camera math in CSS-pixel space. Single source of truth for the
// isometric projection; Renderer delegates to these helpers so the
// projection stays identical everywhere (map, input, minimap later).
// Zoom ladder keeps sprite draw sizes near whole multiples of the 32px
// source (see renderer sprite(): s snaps to 32*k).
export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 3;
export const ZOOM_LADDER = [0.55, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function clampZoom(z) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

// Snap a free zoom value to the nearest ladder rung (pinch settles here,
// fitVillage and zoomBy land here).
export function snapZoom(z) {
  z = clampZoom(z);
  let best = ZOOM_LADDER[0], bd = Math.abs(z - best);
  for (const rung of ZOOM_LADDER) {
    const d = Math.abs(z - rung);
    if (d < bd) { bd = d; best = rung; }
  }
  return best;
}

// World <-> screen. geom = {tw, th, ox, oy, cx, cy, cam:{x,y,zoom}}.
export function project(geom, x, y) {
  const bx = geom.ox + (x - y) * geom.tw / 2;
  const by = geom.oy + (x + y) * geom.th / 2;
  const cx = geom.ox + (geom.cam.x - geom.cam.y) * geom.tw / 2;
  const cy = geom.oy + (geom.cam.x + geom.cam.y) * geom.th / 2;
  const z = geom.cam.zoom;
  return { x: geom.cx + (bx - cx) * z, y: geom.cy + (by - cy) * z };
}

export function screenToWorld(geom, sx, sy) {
  const z = geom.cam.zoom;
  const cx = geom.ox + (geom.cam.x - geom.cam.y) * geom.tw / 2;
  const cy = geom.oy + (geom.cam.x + geom.cam.y) * geom.th / 2;
  const bx = cx + (sx - geom.cx) / z;
  const by = cy + (sy - geom.cy) / z;
  const u = (bx - geom.ox) / (geom.tw / 2); // x - y
  const v = (by - geom.oy) / (geom.th / 2); // x + y
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

// Pan the camera by a screen-space drag (CSS px). Inverts project().
export function panPixels(geom, bounds, sdx, sdy) {
  const z = geom.cam.zoom;
  const wx = (sdx / z / (geom.tw / 2) + sdy / z / (geom.th / 2)) / 2;
  const wy = (sdy / z / (geom.th / 2) - sdx / z / (geom.tw / 2)) / 2;
  geom.cam.x = Math.max(0, Math.min(bounds.w, geom.cam.x - wx));
  geom.cam.y = Math.max(0, Math.min(bounds.h, geom.cam.y - wy));
}

// Zoom keeping the world point under the focal screen point fixed.
export function zoomAt(geom, bounds, factor, fx, fy) {
  const before = screenToWorld(geom, fx, fy);
  geom.cam.zoom = clampZoom(geom.cam.zoom * factor);
  const after = screenToWorld(geom, fx, fy);
  geom.cam.x = Math.max(0, Math.min(bounds.w, geom.cam.x + (before.x - after.x)));
  geom.cam.y = Math.max(0, Math.min(bounds.h, geom.cam.y + (before.y - after.y)));
}
