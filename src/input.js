// Touch + mouse camera control for the village map. Pointer Events with
// pointer capture; a drag is never a tap (7px threshold), one finger pans,
// two fingers pinch-zoom around their midpoint, wheel zooms at the cursor.
// Callbacks: onTap(x, y) in CSS px, onPan(sdx, sdy), onPinch(factor, fx, fy).
export class MapInput {
  constructor(el, hooks = {}) {
    this.el = el;
    this.hooks = hooks;
    this.pointers = new Map();
    this.moved = 0;
    this.pinchDist = 0;
    this.bind();
  }
  bind() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      try { el.setPointerCapture(e.pointerId); } catch {}
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.moved = 0;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        // Single-finger drag pans; small jitter never becomes a tap.
        if (this.moved > 7) this.hooks.onPan?.(-dx, -dy);
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0 && dist > 0) {
          const r = el.getBoundingClientRect();
          this.hooks.onPinch?.(dist / this.pinchDist,
            (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        }
        this.pinchDist = dist;
        this.moved = 99; // a pinch is never a tap
      }
    });
    const up = (e) => {
      const had = this.pointers.size;
      this.pointers.delete(e.pointerId);
      if (had === 1 && this.moved <= 7) {
        const r = el.getBoundingClientRect();
        this.hooks.onTap?.(e.clientX - r.left, e.clientY - r.top);
      }
      if (this.pointers.size < 2) this.pinchDist = 0;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      this.hooks.onPinch?.(e.deltaY > 0 ? 0.9 : 1.1,
        e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }
}
