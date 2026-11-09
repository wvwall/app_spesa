// Exports the TypeScript seed catalogs to JSON for the native iOS app bundle.
// Run with: node scripts/export-seed.mjs
import { writeFileSync } from "node:fs";
import { SEED_INGREDIENTS, SEED_VERSION } from "../src/seed/ingredients.ts";
import { SEED_DISHES, SEED_DISHES_VERSION } from "../src/seed/dishes.ts";

const out = "ios/LaSpesaDiCasa/Resources/Seed";
writeFileSync(`${out}/ingredients.json`, JSON.stringify({ version: SEED_VERSION, items: SEED_INGREDIENTS }, null, 2));
writeFileSync(`${out}/dishes.json`, JSON.stringify({ version: SEED_DISHES_VERSION, items: SEED_DISHES }, null, 2));
console.log(`ingredienti: ${SEED_INGREDIENTS.length} (v${SEED_VERSION}), piatti: ${SEED_DISHES.length} (v${SEED_DISHES_VERSION})`);
