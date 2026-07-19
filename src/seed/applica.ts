import { db, nowIso, nuovoId, getOrCreateProfilo } from "../lib/db";
import type { Ingrediente } from "../lib/types";
import { SEED_INGREDIENTI, SEED_VERSION } from "./ingredienti";

/** Applica il seed catalogo in modo additivo: aggiunge solo le voci mancanti,
 * non sovrascrive mai le personalizzazioni fatte dall'utente in app (DESIGN.md §5.3).
 * Tutto avviene in un'unica transazione Dexie per restare corretto anche se la funzione
 * viene invocata due volte in rapida successione (es. doppio effect di React StrictMode). */
export async function applicaSeedIngredienti(): Promise<void> {
  await db.transaction("rw", db.profilo, db.ingredienti, async () => {
    const profilo = await getOrCreateProfilo();
    if (profilo.seedVersion >= SEED_VERSION) return;

    const esistenti = await db.ingredienti.toArray();
    const nomiEsistenti = new Set(esistenti.map((i) => i.nome.toLowerCase()));

    const nuovi: Ingrediente[] = SEED_INGREDIENTI.filter((s) => !nomiEsistenti.has(s.nome.toLowerCase())).map((s) => ({
      id: nuovoId(),
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
