// Rasterizza le sorgenti SVG in scripts/icons/ nei PNG di public/icons/.
// Richiede Playwright con Chromium (non è una dipendenza del progetto):
//   npx -y playwright@1 install chromium   # solo la prima volta
//   node scripts/generate-icons.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (name) => readFileSync(join(root, "scripts/icons", name), "utf8");
const out = (name) => join(root, "public/icons", name);

// Maskable: il disegno scala all'80% per restare nella zona sicura (cerchio di raggio 40%).
const maskable = (svg) =>
  svg.replace(/(<rect width="100" height="100"[^>]*\/>)([\s\S]*)(<\/svg>)/, (_, bg, art, end) =>
    `${bg}<g transform="translate(50 50) scale(.8) translate(-50 -50)">${art}</g>${end}`);

const light = src("spesa-light.svg");
const dark = src("spesa-dark.svg");
const jobs = [
  ["icon-notebook-192.png", light, 192],
  ["icon-notebook-512.png", light, 512],
  ["icon-notebook-maskable-192.png", maskable(light), 192],
  ["icon-notebook-maskable-512.png", maskable(light), 512],
  ["icon-dark-192.png", dark, 192],
  ["icon-dark-512.png", dark, 512],
  ["icon-dark-maskable-192.png", maskable(dark), 192],
  ["icon-dark-maskable-512.png", maskable(dark), 512],
  ["apple-touch-icon.png", light, 180],
  ["apple-touch-icon-dark.png", dark, 180],
  ["favicon-16.png", src("favicon-light.svg"), 16, true],
  ["favicon-32.png", src("favicon-light.svg"), 32, true],
  ["favicon-dark-16.png", src("favicon-dark.svg"), 16, true],
  ["favicon-dark-32.png", src("favicon-dark.svg"), 32, true],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, svg, size, transparent] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: out(file), omitBackground: !!transparent });
  console.log("✓", file);
}
await browser.close();
