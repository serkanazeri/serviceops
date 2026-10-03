import { readdir, readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
// Dependency-free, original geometric application icon. No external artwork.
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) {
    c ^= v;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const type = Buffer.from(name),
    length = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, sum]);
};
function icon(n, mask = false) {
  const raw = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const scale = mask ? 0.75 : 1,
        X = (x / n - 0.5) / scale + 0.5,
        Y = (y / n - 0.5) / scale + 0.5;
      const line =
        (X > 0.28 && X < 0.68 && Math.abs(Y - 0.3) < 0.025) ||
        (Math.abs(X - 0.65) < 0.025 && Y > 0.3 && Y < 0.7) ||
        (X > 0.3 && X < 0.65 && Math.abs(Y - 0.7) < 0.025) ||
        (Math.abs(X - 0.3) < 0.025 && Y > 0.51 && Y < 0.7) ||
        (X > 0.3 && X < 0.65 && Math.abs(Y - 0.51) < 0.025);
      const node = [
        [0.3, 0.3],
        [0.65, 0.51],
        [0.3, 0.7],
      ].some(
        ([cx, cy]) =>
          Math.abs(X - cx) < 0.09 &&
          Math.abs(Y - cy) < 0.09 &&
          (Math.abs(X - cx) > 0.052 || Math.abs(Y - cy) > 0.052),
      );
      const p = y * (n * 4 + 1) + 1 + x * 4;
      [raw[p], raw[p + 1], raw[p + 2], raw[p + 3]] =
        line || node ? [255, 255, 255, 255] : [36, 92, 219, 255];
    }
  const h = Buffer.alloc(13);
  h.writeUInt32BE(n);
  h.writeUInt32BE(n, 4);
  h[8] = 8;
  h[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
for (const [name, n, mask] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable.png", 512, true],
])
  await writeFile(`dist/${name}`, icon(n, mask));
const assets = (await readdir("dist/assets")).map((n) => `/assets/${n}`);
const files = [
  "/",
  "/icon.svg",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
  ...assets,
];
const version = createHash("sha256")
  .update(await readFile("dist/index.html"))
  .digest("hex")
  .slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const CACHE='serviceops-${version}';const FILES=${JSON.stringify(files)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('serviceops-')&&k!==CACHE).map(k=>caches.delete(k))))));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return}if(FILES.includes(u.pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`,
);
console.log(
  `PWA shell: ${files.length} assets; version ${version}. API responses are never cached.`,
);
