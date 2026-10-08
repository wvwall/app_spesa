import { readFile, writeFile } from "node:fs/promises";

const tipo = process.argv[2] ?? "patch";
const tipiValidi = new Set(["major", "minor", "patch"]);

if (!tipiValidi.has(tipo)) {
  console.error("Uso: npm run bump -- [major|minor|patch]");
  process.exit(1);
}

const packagePath = new URL("../package.json", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const lockJson = JSON.parse(await readFile(lockPath, "utf8"));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version);

if (!match) {
  console.error(`Versione non valida in package.json: ${packageJson.version}`);
  process.exit(1);
}

let [major, minor, patch] = match.slice(1).map(Number);
if (tipo === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (tipo === "minor") {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const nuovaVersione = `${major}.${minor}.${patch}`;
packageJson.version = nuovaVersione;
lockJson.version = nuovaVersione;
if (!lockJson.packages?.[""]) {
  throw new Error('Voce root "" mancante in package-lock.json.');
}
lockJson.packages[""].version = nuovaVersione;

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(lockPath, `${JSON.stringify(lockJson, null, 2)}\n`);
console.log(`Versione aggiornata a ${nuovaVersione}`);
