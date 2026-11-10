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
// Launch screen iOS: solo il disegno, senza il quadrato di fondo (lo sfondo è un colore).
const noBg = (svg) => svg.replace(/<rect width="100" height="100"[^>]*\/>/, "");
const launch = "../../ios/LaSpesaDiCasa/Resources/Assets.xcassets/LaunchLogo.imageset/";
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
  // App iOS: icona 1024 chiara e scura nell'asset catalog.
  ["../../ios/LaSpesaDiCasa/Resources/Assets.xcassets/AppIcon.appiconset/icon-light.png", light, 1024],
  ["../../ios/LaSpesaDiCasa/Resources/Assets.xcassets/AppIcon.appiconset/icon-dark.png", dark, 1024],
  // Logo della schermata di avvio iOS: 120 pt, @2x e @3x, chiaro e scuro, trasparente.
  [launch + "launch-logo@2x.png", noBg(light), 240, true],
  [launch + "launch-logo@3x.png", noBg(light), 360, true],
  [launch + "launch-logo-dark@2x.png", noBg(dark), 240, true],
  [launch + "launch-logo-dark@3x.png", noBg(dark), 360, true],
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
