import { db, nowIso, createId, getOrCreateProfile } from "../lib/database";
import type { Ingredient } from "../lib/models";
import { SEED_INGREDIENTS, SEED_VERSION } from "./ingredients";

/** Applies the catalog seed additively: adds missing entries and never overwrites user changes
 * made in the app (DESIGN.md §5.3). A single Dexie transaction keeps this safe if the function
 * is invoked twice in quick succession (for example, by React StrictMode's duplicate effect). */
export async function applyIngredientSeed(): Promise<void> {
  await db.transaction("rw", db.profilo, db.ingredienti, async () => {
    const profilo = await getOrCreateProfile();
    if (profilo.seedVersion >= SEED_VERSION) return;

    const esistenti = await db.ingredienti.toArray();
    const nomiEsistenti = new Set(esistenti.map((i) => i.nome.toLowerCase()));

    const nuovi: Ingredient[] = SEED_INGREDIENTS.filter((s) => !nomiEsistenti.has(s.nome.toLowerCase())).map((s) => ({
      id: createId(),
      nome: s.nome,
      reparto: s.reparto,
      unitaDefault: s.unitaDefault,
      alias: s.alias ?? [],
      origine: "seed",
      updatedAt: nowIso(),
    }));

    if (nuovi.length > 0) {
      await db.ingredienti.bulkAdd(nuovi);
    }
    await db.profilo.update(profilo.id, { seedVersion: SEED_VERSION });
  });
}
