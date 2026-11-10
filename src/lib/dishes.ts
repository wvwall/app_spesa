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
    allergieVerificate: generato.allergieVerificate,
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

/** One editable ingredient row of a dish (dish editor). `quantita` stays a string while typing. */
export interface DishRowDraft {
  key: string;
  ingredienteId?: string;
  nome: string;
  reparto: string;
  quantita: string;
  unita: string;
}

/** Creates or updates a dish with its full ingredient list (existing rows are replaced). */
export async function saveDish(
  existing: Dish | undefined,
  data: { nome: string; porzioni: number; procedimento: string; righe: DishRowDraft[] },
): Promise<string> {
  const piattoId = existing?.id ?? createId();
  await db.transaction("rw", db.piatti, db.piattoIngredienti, async () => {
    const procedimento = data.procedimento.trim() || undefined;
    if (existing) {
      await db.piatti.update(piattoId, {
        nome: data.nome,
        porzioni: data.porzioni,
        procedimento,
        updatedAt: nowIso(),
      });
      const vecchie = await db.piattoIngredienti.where("piattoId").equals(piattoId).toArray();
      await db.piattoIngredienti.bulkDelete(vecchie.map((r) => r.id));
    } else {
      await db.piatti.add({
        id: piattoId,
        nome: data.nome,
        procedimento,
        preferito: false,
        origine: "manuale",
        porzioni: data.porzioni,
        updatedAt: nowIso(),
      });
    }
    const righe = data.righe.filter((r) => r.nome.trim());
    await db.piattoIngredienti.bulkAdd(
      righe.map((r) => ({
        id: createId(),
        piattoId,
        ingredienteId: r.ingredienteId,
        nome: r.nome.trim(),
        reparto: r.reparto,
        quantita: Number(r.quantita.replace(",", ".")) || 1,
        unita: r.unita,
      })),
    );
  });
  return piattoId;
}

export async function toggleFavorite(piatto: Dish): Promise<void> {
  await db.piatti.update(piatto.id, { preferito: !piatto.preferito, updatedAt: nowIso() });
}

/** Deletes a dish (with its ingredients, clearing it from the plan) and returns a restore function. */
export async function deleteDishWithUndo(piattoId: string): Promise<{ nome: string; restore: () => Promise<void> } | null> {
  const piatto = await db.piatti.get(piattoId);
  if (!piatto) return null;
  const suoiIngredienti = await db.piattoIngredienti.where("piattoId").equals(piattoId).toArray();
  const slotInteressati = (await db.slot.toArray()).filter((s) => s.piattoId === piattoId).map((s) => s.id);
  await db.transaction("rw", db.piatti, db.piattoIngredienti, db.slot, async () => {
    await db.piatti.delete(piattoId);
    await db.piattoIngredienti.bulkDelete(suoiIngredienti.map((i) => i.id));
    for (const slotId of slotInteressati) {
      // eslint-disable-next-line no-await-in-loop
      await db.slot.update(slotId, { piattoId: undefined });
    }
  });
  return {
    nome: piatto.nome,
    restore: async () => {
      await db.transaction("rw", db.piatti, db.piattoIngredienti, db.slot, async () => {
        await db.piatti.put(piatto);
        await db.piattoIngredienti.bulkPut(suoiIngredienti);
        for (const slotId of slotInteressati) {
          // eslint-disable-next-line no-await-in-loop
          await db.slot.update(slotId, { piattoId });
        }
      });
    },
  };
}

export async function updateIngredient(id: string, data: { nome: string; reparto: string; unitaDefault: string }): Promise<void> {
  await db.ingredienti.update(id, { ...data, updatedAt: nowIso() });
}

export async function addIngredient(data: { nome: string; reparto: string; unitaDefault?: string }): Promise<Ingredient> {
  const nuovo: Ingredient = {
    id: createId(),
    nome: data.nome,
    reparto: data.reparto,
    unitaDefault: data.unitaDefault || "1 pz",
    alias: [],
    origine: "utente",
    updatedAt: nowIso(),
  };
  await db.ingredienti.add(nuovo);
  return nuovo;
}

/** Soft delete (deletedAt): dishes keep their own name/department snapshot. */
export async function deleteIngredientWithUndo(id: string): Promise<() => Promise<void>> {
  await db.ingredienti.update(id, { deletedAt: nowIso() });
  return async () => {
    await db.ingredienti.update(id, { deletedAt: undefined });
  };
}

/** "500 g", "4 pz", "2"; catalog units that already carry a number ("1 kg") are not prefixed. */
export function formatQuantita(q: number, unita: string): string {
  const n = Number.isInteger(q) ? String(q) : String(q).replace(".", ",");
  const u = unita.trim();
  if (!u) return n;
  if (/^\d/.test(u)) return q === 1 ? u : `${n} × ${u}`;
  return `${n} ${u}`;
}
