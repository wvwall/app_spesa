import { db, nowIso, nuovoId } from "./db";
import type { Ingrediente, Piatto } from "./types";
import type { PiattoGenerato } from "./ai";

/** Crea un Piatto (origine "ai") + le sue PiattoIngrediente a partire da un risultato di
 * generazione: gli ingredienti già disponibili (dato noto lato client — mai un'invenzione
 * dell'AI, vedi src/screens/Piatti.tsx) e quelli "da comprare" proposti dal modello, che
 * ereditano reparto e collegamento al catalogo quando il nome corrisponde a un ingrediente
 * già noto. Nome e reparto sono uno snapshot permanente su ogni PiattoIngrediente (mai un
 * riferimento fragile): un ingrediente non deve mai sparire dalla lista della spesa.
 * Ritorna l'id del nuovo piatto. */
export async function salvaPiattoGenerato(
  generato: PiattoGenerato,
  ingredientiGiaDisponibili: Ingrediente[],
  catalogoCompleto: Ingrediente[]
): Promise<string> {
  const piattoId = nuovoId();
  const piatto: Piatto = {
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
      id: nuovoId(),
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
      id: nuovoId(),
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
