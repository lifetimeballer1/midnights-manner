// Art verification artifact (ART_DIRECTION §3.7): renders every sprite into
// one reviewable contact sheet. Dependency-free (no Pillow): an HTML grid at
// whole-multiple scales on the game's ground colour, plus a data<->file
// lockstep check (boot rejects a missing sprite, so this fails loudly first).
// Run: node scripts/contact-sheet.mjs  (writes artifacts/contact-sheet.html)
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const names = ['world', 'troops', 'items', 'buildings'];
const data = Object.fromEntries(await Promise.all(names.map(async (n) => [n, JSON.parse(await readFile(new URL(`data/${n}.json`, root), 'utf8'))])));
const refs = new Set([
  ...Object.values(data.buildings).flatMap((b) => b.tiers.map((t) => t.sprite)),
  ...Object.values(data.troops).map((t) => t.sprite),
  ...Object.values(data.items).map((i) => i.sprite),
  'raider.png',
]);
const onDisk = new Set(await readdir(new URL('assets/sprites/', root)));
const missing = [...refs].filter((s) => !onDisk.has(s));
const orphan = [...onDisk].filter((s) => s.endsWith('.png') && !refs.has(s));
const groups = new Map();
for (const s of [...refs].sort()) {
  const g = s.split('-')[0].replace('.png', '');
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(s);
}
const cards = (list) => list.map((s) => `<figure><img src=\"../assets/sprites/${s}\" alt=\"${s}\" width=\"64\" height=\"64\"><figcaption>${s}</figcaption></figure>`).join('');
const html = `<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Midnights Manner — sprite contact sheet</title><style>body{font-family:system-ui,sans-serif;background:#203b2a;color:#eee4c9;margin:0;padding:24px}h1{font-size:20px}h2{font-size:14px;color:#f4cc73;margin:28px 0 8px}section{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;background:#668b46;border:2px solid #0b1220;padding:8px;text-align:center}img{image-rendering:pixelated;display:block}.warn{color:#ffbb99}figcaption{font-size:10px;margin-top:4px;max-width:96px;overflow:hidden;text-overflow:ellipsis}</style></head><body><h1>Sprite contact sheet — ${refs.size} referenced sprites (8x nearest-neighbour on ground #668b46)</h1><p class=\"warn\">Missing: ${missing.length ? missing.join(', ') : 'none'} · Unreferenced on disk: ${orphan.length ? orphan.join(', ') : 'none'}</p>${[...groups].map(([g, l]) => `<h2>${g} (${l.length})</h2><section>${cards(l)}</section>`).join('')}</body></html>`;
await mkdir(new URL('artifacts/', root), { recursive: true });
await writeFile(new URL('artifacts/contact-sheet.html', root), html);
console.log(`contact sheet: ${refs.size} sprites, missing=${missing.length}, orphan=${orphan.length}`);
if (missing.length) process.exit(1);
