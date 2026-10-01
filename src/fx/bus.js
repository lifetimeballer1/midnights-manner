// Visual event bus: systems emit, fx/ subscribes. Systems never import fx
// modules — this file has zero imports so the exception in the spec
// ("emit lightweight visual events") stays dependency-free.
const subs = new Map();
export const VISUAL_EVENTS = ['hit', 'kill', 'deliver', 'build-progress', 'level-up', 'trap', 'tower-fire'];
export function onVisual(event, fn) {
  if (!VISUAL_EVENTS.includes(event)) return () => {};
  if (!subs.has(event)) subs.set(event, new Set());
  subs.get(event).add(fn);
  return () => subs.get(event)?.delete(fn);
}
export function emitVisual(event, payload) {
  if (!VISUAL_EVENTS.includes(event)) return;
  const set = subs.get(event);
  if (!set || !set.size) return;
  for (const fn of [...set]) {
    try { fn(payload); } catch {}
  }
}
export function visualSubCount(event) {
  return subs.get(event)?.size || 0;
}
