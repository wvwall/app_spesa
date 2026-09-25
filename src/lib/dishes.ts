import { db, nowIso, createId } from "./database";
import type { Ingredient, Dish } from "./models";
import type { GeneratedDish } from "./ai";

/** Creates a Dish (origin "ai") and its DishIngredients from a generated result: ingredients
 * already available (known by the client and never invented by AI; see src/screens/Dishes.tsx)
 * and ingredients to buy proposed by the model. Proposed items inherit their department and
 * catalog link when their name matches a known ingredient. Each DishIngredient stores a
 * permanent name and department snapshot rather than a fragile reference, so an ingredient
 * can never disappear from the shopping list. Returns the new dish ID. */
export async function saveGeneratedDish(
  generato: GeneratedDish,
  ingredientiGiaDisponibili: Ingredient[],
  catalogoCompleto: Ingredient[]
): Promise<string> {
  const piattoId = createId();
  const piatto: Dish = {
    id: piattoId,
    nome: generato.nome,
    procedimento: generato.procedimento.join("\n"),
    preferito: false,
    origine: "ai",
    porzioni: generato.porzioni,
    updatedAt: nowIso(),
  };
  await db.piatti.add(piatto);

  for (const ing of ingredientiGiaDisponibili) {
    // eslint-disable-next-line no-await-in-loop
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
  for (const voce of generato.ingredientiDaComprare) {
    const nomeVoce = voce.nome.trim() || "Ingrediente da comprare";
    const corrispondenza = catalogoCompleto.find((i) => i.nome.toLowerCase() === nomeVoce.toLowerCase());
    // eslint-disable-next-line no-await-in-loop
    await db.piattoIngredienti.add({
      id: createId(),
      piattoId,
      ingredienteId: corrispondenza?.id,
      nome: corrispondenza?.nome ?? nomeVoce,
      reparto: corrispondenza?.reparto ?? "Dispensa",
      quantita: 1,
      unita: voce.quantita,
    });
  }

  return piattoId;
}
