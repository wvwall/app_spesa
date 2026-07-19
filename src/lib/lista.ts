import { db, nowIso, nuovoId } from "./db";
import type { ListaSpesa, VoceLista } from "./types";

/** Aggrega gli ingredienti dei piatti pianificati in una nuova lista della spesa (RF8).
 * Ogni ingrediente compare una sola volta anche se richiesto da più piatti: niente somma
 * numerica delle quantità (le fonti — AI, catalogo, testo libero — non sono confrontabili
 * in modo affidabile). La quantità di ogni voce parte vuota: la scrive l'utente, se vuole. */
export async function generaListaDaPiano(pianoId: string): Promise<ListaSpesa> {
  const slots = await db.slot.where("pianoId").equals(pianoId).toArray();
  const piattoIds = [...new Set(slots.map((s) => s.piattoId).filter((id): id is string => Boolean(id)))];

  interface RigaAggregata {
    nome: string;
    reparto: string;
    ingredienteId?: string;
  }
  const aggregate = new Map<string, RigaAggregata>();

  for (const piattoId of piattoIds) {
    const ingredienti = await db.piattoIngredienti.where("piattoId").equals(piattoId).toArray();
    for (const pi of ingredienti) {
      let nome = pi.testoLibero ?? "";
      let reparto = "Dispensa";
      if (pi.ingredienteId) {
        const ing = await db.ingredienti.get(pi.ingredienteId);
        if (ing) {
          nome = ing.nome;
          reparto = ing.reparto;
        }
      }
      const chiave = pi.ingredienteId ?? nome.toLowerCase();
      if (!aggregate.has(chiave)) {
        aggregate.set(chiave, { nome, reparto, ingredienteId: pi.ingredienteId });
      }
    }
  }

  const lista: ListaSpesa = { id: nuovoId(), pianoId, chiusa: false, updatedAt: nowIso() };
  await db.liste.add(lista);

  const voci: VoceLista[] = Array.from(aggregate.values()).map((r) => ({
    id: nuovoId(),
    listaId: lista.id,
    ingredienteId: r.ingredienteId,
    nome: r.nome,
    quantita: "",
    reparto: r.reparto,
    checked: false,
    alternative: [],
  }));
  if (voci.length > 0) {
    await db.voci.bulkAdd(voci);
  }

  return lista;
}

export async function aggiungiVoceLibera(listaId: string, nome: string, quantita: string, reparto: string): Promise<void> {
  const voce: VoceLista = {
    id: nuovoId(),
    listaId,
    nome,
    quantita,
    reparto,
    checked: false,
    alternative: [],
  };
  await db.voci.add(voce);
}

export async function toggleVoce(voceId: string, checked: boolean): Promise<void> {
  await db.voci.update(voceId, { checked, checkedAt: checked ? nowIso() : undefined });
}

export async function eliminaVoce(voceId: string): Promise<void> {
  await db.voci.delete(voceId);
}

export async function aggiornaQuantita(voceId: string, quantita: string): Promise<void> {
  await db.voci.update(voceId, { quantita });
}

export async function sostituisciVoce(voceId: string, sostitutoNome: string): Promise<void> {
  await db.voci.update(voceId, { sostituitoCon: sostitutoNome });
}

/** Cancella l'intera lista (e le sue voci): si torna allo stato "nessuna lista ancora". */
export async function eliminaListaCompleta(listaId: string): Promise<void> {
  await db.transaction("rw", db.liste, db.voci, async () => {
    const voci = await db.voci.where("listaId").equals(listaId).toArray();
    await db.voci.bulkDelete(voci.map((v) => v.id));
    await db.liste.delete(listaId);
  });
}
