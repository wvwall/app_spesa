import { db, nowIso, createId, getOrCreateProfile } from "../lib/database";
import type { Dish } from "../lib/models";
import { SEED_DISHES, SEED_DISHES_VERSION } from "./dishes";

/** Applies the example-dish seed additively (like applyIngredientSeed): skips dishes already
 * present by name and never changes user-created dishes. Run this AFTER applyIngredientSeed:
 * it resolves ingredients by name from the catalog and uses the DishIngredient name/department
 * snapshot instead of a fragile reference. */
export async function applyDishSeed(): Promise<void> {
  await db.transaction("rw", db.profilo, db.piatti, db.piattoIngredienti, db.ingredienti, async () => {
    const profilo = await getOrCreateProfile();
    if (profilo.seedVersionPiatti >= SEED_DISHES_VERSION) return;

    const catalogo = await db.ingredienti.toArray();
    const perNome = new Map(catalogo.map((i) => [i.nome.toLowerCase(), i]));

    const piattiEsistenti = await db.piatti.toArray();
    const nomiEsistenti = new Set(piattiEsistenti.map((p) => p.nome.toLowerCase()));

    for (const seedPiatto of SEED_DISHES) {
      if (nomiEsistenti.has(seedPiatto.nome.toLowerCase())) continue;

      const piattoId = createId();
      const piatto: Dish = {
        id: piattoId,
        nome: seedPiatto.nome,
        procedimento: seedPiatto.procedimento.join("\n"),
        preferito: false,
        origine: "manuale",
        porzioni: seedPiatto.porzioni,
        updatedAt: nowIso(),
      };
      await db.piatti.add(piatto);

      for (const nomeIngrediente of seedPiatto.ingredienti) {
        const ing = perNome.get(nomeIngrediente.toLowerCase());
        if (!ing) continue; // Defensive: skip only this row if the catalog does not contain it.
        await db.piattoIngredienti.add({
          id: createId(),
          piattoId,
          ingredienteId: ing.id,
          nome: ing.nome,
          reparto: ing.reparto,
          quantita: 1,
          unita: ing.unitaDefault,
        });
      }
    }

    await db.profilo.update(profilo.id, { seedVersionPiatti: SEED_DISHES_VERSION });
  });
}
