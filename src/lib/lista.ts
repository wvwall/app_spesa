import { db, nowIso, nuovoId } from "./db";
import type { ListaSpesa, VoceLista } from "./types";
import { trovaAlternative } from "./sostituzioni";

/** Aggrega gli ingredienti dei piatti pianificati nella lista aperta del piano (RF8).
 * Riusa la lista già in corso (vedi getOrCreaListaAperta) invece di crearne una nuova a ogni
 * click: prima non lo faceva, così "Genera lista" ripetuto (o usato dopo aver già aggiunto
 * articoli a mano da Lista) perdeva/nascondeva le liste precedenti dietro l'ultima creata.
 * Le voci aggiunte a mano (testoLibero) restano intatte; solo quelle derivate dai piatti
 * vengono ricalcolate da zero. Ogni ingrediente compare una sola volta anche se richiesto da
 * più piatti: niente somma numerica delle quantità (le fonti — AI, catalogo, testo libero —
 * non sono confrontabili in modo affidabile). La quantità di ogni voce parte vuota: la scrive
 * l'utente, se vuole. Nome e reparto vengono letti dallo snapshot su PiattoIngrediente (mai da
 * un ri-lookup nel catalogo): così un ingrediente non può mai sparire dalla lista, anche se
 * non più catalogato. */
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
    if (ingredienti.length === 0) {
      // Piatto assegnato scrivendo solo il nome ("+ Usa così com'è" in Settimana), senza
      // ingredienti collegati: senza questo fallback non finisce in lista, e se la settimana
      // è fatta soprattutto di piatti così "Genera lista" produce una lista vuota o quasi.
      // eslint-disable-next-line no-await-in-loop
      const piatto = await db.piatti.get(piattoId);
      const nome = piatto?.nome ?? "Piatto da verificare";
      const chiave = `piatto:${piattoId}`;
      if (!aggregate.has(chiave)) {
        aggregate.set(chiave, { nome, reparto: "Dispensa" });
      }
      continue;
    }
    for (const pi of ingredienti) {
      // Dato legacy: righe create prima dello snapshot nome/reparto permanente potrebbero
      // non averli affatto. Non deve mai far saltare la generazione della lista né far
      // sparire l'ingrediente: si recupera come si può, con un ultimo fallback visibile.
      let nome = pi.nome;
      let reparto = pi.reparto;
      if (!nome) {
        if (pi.ingredienteId) {
          // eslint-disable-next-line no-await-in-loop
          const ing = await db.ingredienti.get(pi.ingredienteId);
          nome = ing?.nome ?? "Ingrediente da verificare";
          reparto = ing?.reparto ?? "Dispensa";
        } else {
          nome = "Ingrediente da verificare";
          reparto = reparto ?? "Dispensa";
        }
      }
      const chiave = pi.ingredienteId ?? nome.toLowerCase();
      if (!aggregate.has(chiave)) {
        aggregate.set(chiave, { nome, reparto, ingredienteId: pi.ingredienteId });
      }
    }
  }

  const lista = await getOrCreaListaAperta(pianoId);

  await db.transaction("rw", db.voci, async () => {
    const esistenti = await db.voci.where("listaId").equals(lista.id).toArray();
    const daPiatti = esistenti.filter((v) => !v.testoLibero);
    await db.voci.bulkDelete(daPiatti.map((v) => v.id));

    const nuove: VoceLista[] = Array.from(aggregate.values()).map((r) => ({
      id: nuovoId(),
      listaId: lista.id,
      ingredienteId: r.ingredienteId,
      nome: r.nome,
      quantita: "",
      reparto: r.reparto,
      checked: false,
      alternative: trovaAlternative(r.nome),
    }));
    if (nuove.length > 0) {
      await db.voci.bulkAdd(nuove);
    }
  });

  return lista;
}

/** Lista aperta (non chiusa) del piano corrente, per aggiungere articoli a mano senza
 * passare dai piatti pianificati: riusa quella eventualmente già in corso invece di
 * crearne una nuova a ogni articolo aggiunto. */
export async function getOrCreaListaAperta(pianoId: string): Promise<ListaSpesa> {
  return db.transaction("rw", db.liste, async () => {
    const esistente = await db.liste.where("pianoId").equals(pianoId).last();
    if (esistente && !esistente.chiusa) return esistente;
    const lista: ListaSpesa = { id: nuovoId(), pianoId, chiusa: false, updatedAt: nowIso() };
    await db.liste.add(lista);
    return lista;
  });
}

export async function aggiungiVoceLibera(listaId: string, nome: string, quantita: string, reparto: string): Promise<void> {
  const voce: VoceLista = {
    id: nuovoId(),
    listaId,
    nome,
    // Marca la voce come aggiunta a mano: generaListaDaPiano la lascia intatta quando
    // ricalcola le voci derivate dai piatti pianificati.
    testoLibero: nome,
    quantita,
    reparto,
    checked: false,
    alternative: trovaAlternative(nome),
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
