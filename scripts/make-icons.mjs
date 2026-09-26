// PWA icon set: dependency-free PNG writer (node:zlib only). Gold crescent
// on full-bleed night green (#182d27, palette ui.themeColor). The 512 icon
// keeps the crescent inside the ~60% maskable safe zone with no transparency
// and no baked rounded corners; the 180 icon is opaque for iOS compositing.
// Run: node scripts/make-icons.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', (() => { const b = Buffer.alloc(13); b.writeUInt32BE(w); b.writeUInt32BE(h, 4); b[8] = 8; b[9] = 6; return b; })()),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
// Night green backdrop; gold crescent (offset circle cut) + faint starfield.
function icon(size, crescentScale) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [0x18, 0x2d, 0x27];
  const gold = [0xf2, 0xc9, 0x6e];
  const cx = size / 2, cy = size / 2, r = (size / 2) * crescentScale;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = Array.from({ length: 40 }, () => [rnd(), rnd()]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    px[i] = bg[0]; px[i + 1] = bg[1]; px[i + 2] = bg[2]; px[i + 3] = 255;
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    const cut = Math.hypot(dx + r * 0.45, dy - r * 0.18);
    if (d < r && cut > r * 0.82) { px[i] = gold[0]; px[i + 1] = gold[1]; px[i + 2] = gold[2]; }
    for (const [sx, sy] of stars) {
      const px2 = sx * size, py2 = sy * size;
      if (Math.abs(x - px2) < size / 256 && Math.abs(y - py2) < size / 256) {
        px[i] = 255; px[i + 1] = 243; px[i + 2] = 216;
      }
    }
  }
  return png(size, size, px);
}
await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
await writeFile(new URL('../assets/icon-192.png', import.meta.url), icon(192, 0.62));
await writeFile(new URL('../assets/icon-512.png', import.meta.url), icon(512, 0.58));
await writeFile(new URL('../assets/icon-180.png', import.meta.url), icon(180, 0.62));
console.log('PWA icons written: icon-192.png, icon-512.png (maskable-safe), icon-180.png (iOS)');
