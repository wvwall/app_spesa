import { db, nowIso, nuovoId, getOrCreateProfilo } from "../lib/db";
import type { Piatto } from "../lib/types";
import { SEED_PIATTI, SEED_PIATTI_VERSION } from "./piatti";

/** Applica il seed di piatti d'esempio in modo additivo (come applicaSeedIngredienti):
 * salta i piatti già presenti per nome, non tocca mai quelli creati dall'utente.
 * Va eseguito DOPO applicaSeedIngredienti: cerca gli ingredienti per nome nel catalogo
 * e usa lo snapshot nome/reparto su PiattoIngrediente (mai un riferimento fragile). */
export async function applicaSeedPiatti(): Promise<void> {
  await db.transaction("rw", db.profilo, db.piatti, db.piattoIngredienti, db.ingredienti, async () => {
    const profilo = await getOrCreateProfilo();
    if (profilo.seedVersionPiatti >= SEED_PIATTI_VERSION) return;

    const catalogo = await db.ingredienti.toArray();
    const perNome = new Map(catalogo.map((i) => [i.nome.toLowerCase(), i]));

    const piattiEsistenti = await db.piatti.toArray();
    const nomiEsistenti = new Set(piattiEsistenti.map((p) => p.nome.toLowerCase()));

    for (const seedPiatto of SEED_PIATTI) {
      if (nomiEsistenti.has(seedPiatto.nome.toLowerCase())) continue;

      const piattoId = nuovoId();
      const piatto: Piatto = {
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
        if (!ing) continue; // difensivo: se il catalogo non lo contiene, si salta solo questa riga
        await db.piattoIngredienti.add({
          id: nuovoId(),
          piattoId,
          ingredienteId: ing.id,
          nome: ing.nome,
          reparto: ing.reparto,
          quantita: 1,
          unita: ing.unitaDefault,
        });
      }
    }

    await db.profilo.update(profilo.id, { seedVersionPiatti: SEED_PIATTI_VERSION });
  });
}
