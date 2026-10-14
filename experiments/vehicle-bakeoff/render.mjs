/**
 * Headless studio renders + mesh/triangle stats.
 * Run from the repo root: node experiments/vehicle-bakeoff/render.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createTanker } from './tanker.js';
import { createCatering } from './catering.js';
import { createBeltLoader } from './belt_loader.js';
import { createPushbackTug } from './pushback_tug.js';
import { createApronBus } from './apron_bus.js';
import { countStats } from './lib/kit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const renderDir = path.join(here, 'renders');
const artifactDir = '/opt/cursor/artifacts';

const builders = {
  tanker: createTanker,
  catering: createCatering,
  belt_loader: createBeltLoader,
  pushback_tug: createPushbackTug,
  apron_bus: createApronBus,
};

const stats = {};
for (const [name, build] of Object.entries(builders)) {
  const group = build();
  const counted = countStats(group);
  stats[name] = {
    meshes: counted.meshes,
    triangles: counted.triangles,
  };
  if (counted.meshes > 150) {
    throw new Error(`${name} has ${counted.meshes} meshes (limit 150)`);
  }
}

fs.mkdirSync(renderDir, { recursive: true });
fs.writeFileSync(path.join(here, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);
console.log(JSON.stringify(stats, null, 2));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const rel = decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end('no');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}/experiments/vehicle-bakeoff/render.html`;

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--hide-scrollbars',
  ],
});

fs.mkdirSync(artifactDir, { recursive: true });
const page = await browser.newPage({
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (err) => console.error('PAGE', err));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('CONSOLE', msg.text());
});

const views = ['side', '34'];
for (const asset of Object.keys(builders)) {
  for (const view of views) {
    const url = `${base}?asset=${asset}&view=${view}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true || window.__error, { timeout: 30000 });
    const err = await page.evaluate(() => window.__error || null);
    if (err) throw new Error(`${asset} ${view}: ${err}`);
    const live = await page.evaluate(() => window.__stats);
    stats[asset] = { meshes: live.meshes, triangles: live.triangles };
    const filename = `${asset}_${view}.png`;
    const dest = path.join(renderDir, filename);
    await page.screenshot({ path: dest, type: 'png' });
    fs.copyFileSync(dest, path.join(artifactDir, filename));
    console.log('wrote', dest, live);
  }
}

fs.writeFileSync(path.join(here, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);
await browser.close();
server.close();
console.log('done');
