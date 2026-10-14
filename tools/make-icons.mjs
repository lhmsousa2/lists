// Generates the app icons (PNG) with no dependencies: amber square + three white list rows with tick boxes.
// Run: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Unit-space shapes (0..1): three rows, each a rounded box on the left and a bar on the right.
const ROWS = [0.32, 0.5, 0.68];
const BOX = 0.065; // half-size of the tick box
const BAR_H = 0.03; // half-height of the text bar
const roundRect = (u, v, cx, cy, hw, hh, r) => {
  const qx = Math.abs(u - cx) - (hw - r), qy = Math.abs(v - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

function sample(u, v) {
  // background: vertical amber gradient
  const top = [228, 164, 72], bot = [196, 120, 44];
  let c = top.map((t, i) => t + (bot[i] - t) * v);
  ROWS.forEach((y, n) => {
    const box = roundRect(u, v, 0.29, y, BOX, BOX, 0.025);
    const checked = n < 2;
    if (checked ? box < 0 : box < 0 && box > -0.018) c = [255, 255, 255];
    if (checked) {
      const d = Math.min(distSeg(u, v, 0.255, y + 0.002, 0.28, y + 0.027), distSeg(u, v, 0.28, y + 0.027, 0.325, y - 0.025));
      if (d < 0.013) c = [208, 136, 54];
    }
    const bar = roundRect(u, v, 0.56, y, 0.17, BAR_H, BAR_H);
    if (bar < 0) c = n < 2 ? [252, 236, 212] : [255, 255, 255];
  });
  return c;
}

const pixel = (x, y, size) => {
  const SS = 4;
  const acc = [0, 0, 0];
  for (let i = 0; i < SS; i++)
    for (let j = 0; j < SS; j++) {
      const s = sample((x + (i + 0.5) / SS) / size, (y + (j + 0.5) / SS) / size);
      acc[0] += s[0]; acc[1] += s[1]; acc[2] += s[2];
    }
  return acc.map((a) => Math.round(a / (SS * SS)));
};

const out = new URL('../icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const size of [180, 192, 512]) writeFileSync(new URL(`icon-${size}.png`, out), png(size, pixel));
console.log('icons written');
