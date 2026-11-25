import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const achFile = fs.readFileSync(path.join(root, "src/shared/lib/achievements.ts"), "utf8");
const rankFile = fs.readFileSync(path.join(root, "src/shared/lib/ranks.ts"), "utf8");

const achievements = [...achFile.matchAll(/id: "([^"]+)", title: "[^"]+", description: "[^"]+", rarity: "([^"]+)"/g)].map(
  (match) => ({ id: match[1], rarity: match[2] }),
);
const ranks = [...rankFile.matchAll(/id: "([^"]+)", name:/g)].map((match) => match[1]);

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function png(size, paint) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

const RARITY = {
  commun: [79, 140, 255],
  rare: [232, 93, 106],
  ardu: [167, 139, 250],
};

const METAL = {
  bronze: [196, 123, 74],
  fer: [141, 147, 156],
  argent: [213, 216, 224],
  or: [226, 182, 87],
  platine: [215, 226, 234],
  diamant: [159, 214, 255],
  emeraude: [60, 191, 142],
  jade: [31, 138, 98],
  perle: [244, 239, 230],
  amethyste: [155, 107, 184],
  titane: [110, 124, 147],
  tungstene: [90, 98, 120],
};

function icon(id, accent, kind) {
  const size = 96;
  const h = hash(id);
  const shape = h % 6;
  const buf = png(size, (x, y) => {
    const nx = (x + 0.5) / size;
    const ny = (y + 0.5) / size;
    const dx = nx - 0.5;
    const dy = ny - 0.5;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const r = Math.hypot(dx, dy);
    const rounded = ax < 0.38 || ay < 0.38 || (ax - 0.38) ** 2 + (ay - 0.38) ** 2 < 0.12 ** 2;
    if (!rounded) return [0, 0, 0, 0];
    const ring = r > 0.34 && r < 0.42;
    let mark = false;
    if (shape === 0) mark = r < 0.16;
    else if (shape === 1) mark = ax + ay < 0.18;
    else if (shape === 2) mark = dy > -0.16 && dy < 0.14 && ax < 0.16 - dy * 0.4 && ay < 0.16;
    else if (shape === 3) mark = (ax < 0.05 && ay < 0.18) || (ay < 0.05 && ax < 0.18);
    else if (shape === 4) mark = Math.abs(dy + 0.02) < 0.06 && ax < 0.2 && dx < 0.08;
    else mark = Math.max(ax * 0.9, ay) < 0.16 && Math.abs(dx) + Math.abs(dy) > 0.08;
    const speck = ((x * 13 + y * 7 + (h % 17)) % 29 === 0) && r < 0.3;
    if (mark || ring || speck) return [...accent, 255];
    const bg = mix([20, 26, 43], accent, kind === "rank" ? 0.22 : 0.12);
    return [...bg, 255];
  });
  return buf;
}

const rankDir = path.join(root, "public/ranks");
const achDir = path.join(root, "public/achievements");
fs.mkdirSync(rankDir, { recursive: true });
fs.mkdirSync(achDir, { recursive: true });

for (const id of ranks) {
  fs.writeFileSync(path.join(rankDir, `${id}.png`), icon(id, METAL[id] ?? [200, 200, 200], "rank"));
}
for (const item of achievements) {
  fs.writeFileSync(
    path.join(achDir, `${item.id}.png`),
    icon(item.id, RARITY[item.rarity] ?? RARITY.commun, "achievement"),
  );
}

console.log(`ranks ${ranks.length} achievements ${achievements.length}`);
