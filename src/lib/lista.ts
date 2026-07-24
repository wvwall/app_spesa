import { db, nowIso, nuovoId } from "./db";
import type { ListaSpesa, VoceLista } from "./types";
import { trovaAlternative } from "./sostituzioni";
import { costruisciIndiceReparti, deduciRepartoLocale } from "./reparti";
import { classificaReparti } from "./ai";

/** Reparto catch-all: le voci senza un reparto riconosciuto finiscono qui (vedi piatti.ts). */
const REPARTO_NON_CATEGORIZZATO = "Dispensa";

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

/** La lista della settimana (piano): ce n'è una sola per piano. Sostituisce il vecchio `.last()`,
 * che ordinava per chiave primaria — cioè per id casuale (crypto.randomUUID) — e restituiva una
 * lista *a caso* tra quelle del piano, facendo divergere la lista mostrata da quella scritta
 * (gli articoli aggiunti finivano fuori vista). Include anche la lista già "chiusa" (spesa
 * iniziata): la tab Lista deve continuare a mostrarla, non svuotarsi dopo "Inizia la spesa".
 * Deterministica anche se dati pregressi ne hanno lasciata più d'una: sceglie la più recente. */
export async function getListaDelPiano(pianoId: string): Promise<ListaSpesa | undefined> {
  const liste = await db.liste.where("pianoId").equals(pianoId).toArray();
  if (liste.length === 0) return undefined;
  return liste.reduce((piuRecente, l) => (l.updatedAt > piuRecente.updatedAt ? l : piuRecente));
}

/** Lista del piano corrente, per aggiungere articoli a mano senza passare dai piatti pianificati:
 * riusa quella della settimana (anche se già "chiusa") invece di crearne una nuova a ogni
 * articolo aggiunto — così ce n'è sempre una sola per settimana e non nascono duplicati. */
export async function getOrCreaListaAperta(pianoId: string): Promise<ListaSpesa> {
  return db.transaction("rw", db.liste, async () => {
    const esistente = await getListaDelPiano(pianoId);
    if (esistente) return esistente;
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

export interface EsitoOrdinaReparti {
  /** Voci a cui è stato assegnato un reparto nuovo (diverso da quello di partenza). */
  sistemati: number;
  /** Di quelle sistemate, quante grazie all'AI (le altre dal catalogo locale). */
  viaAI: number;
  /** Voci non categorizzate rimaste in "Dispensa" (non riconosciute). */
  irrisolti: number;
  /** true se c'erano voci da mandare all'AI ma non è stato possibile (offline o errore). */
  aiSaltata: boolean;
}

/** Assegna il reparto corretto alle voci non categorizzate della lista (in "Dispensa" o senza
 * reparto), così da poterle raggruppare/ordinare per reparto. Strategia: prima il catalogo
 * locale (nome + alias, offline e gratis), poi — solo per ciò che resta irriconosciuto — l'AI,
 * vincolata ai reparti gestiti dall'app (`ordineReparti`). Le voci già categorizzate (reparto
 * da catalogo o scelto a mano) NON vengono toccate. Il reparto viene salvato sulla voce, quindi
 * diventa coerente ovunque (revisione, export, spesa attiva). */
export async function ordinaListaPerReparto(
  listaId: string,
  ordineReparti: string[],
): Promise<EsitoOrdinaReparti> {
  const voci = await db.voci.where("listaId").equals(listaId).toArray();
  const daSistemare = voci.filter((v) => !v.reparto || v.reparto === REPARTO_NON_CATEGORIZZATO);
  if (daSistemare.length === 0) {
    return { sistemati: 0, viaAI: 0, irrisolti: 0, aiSaltata: false };
  }

  const catalogo = await db.ingredienti.toArray();
  const indice = costruisciIndiceReparti(catalogo);

  const nuovoReparto = new Map<string, string>(); // voceId → reparto
  const irrisolte: VoceLista[] = [];
  for (const v of daSistemare) {
    const locale = deduciRepartoLocale(v.nome, indice);
    if (locale) {
      if (locale !== v.reparto) nuovoReparto.set(v.id, locale);
    } else {
      irrisolte.push(v);
    }
  }

  let viaAI = 0;
  let aiSaltata = false;
  if (irrisolte.length > 0) {
    const online = typeof navigator === "undefined" || navigator.onLine;
    if (!online) {
      aiSaltata = true;
    } else {
      try {
        const nomiUnici = [...new Set(irrisolte.map((v) => v.nome))];
        const assegnazioni = await classificaReparti({ ingredienti: nomiUnici, reparti: ordineReparti });
        const perNome = new Map(assegnazioni.map((a) => [a.nome.trim().toLowerCase(), a.reparto]));
        for (const v of irrisolte) {
          const rep = perNome.get(v.nome.trim().toLowerCase());
          if (rep && rep !== v.reparto) {
            nuovoReparto.set(v.id, rep);
            viaAI++;
          }
        }
      } catch {
        // AI non disponibile: le voci irrisolte restano in "Dispensa" (degrado morbido).
        aiSaltata = true;
      }
    }
  }

  if (nuovoReparto.size > 0) {
    await db.transaction("rw", db.voci, async () => {
      for (const [id, reparto] of nuovoReparto) {
        // eslint-disable-next-line no-await-in-loop
        await db.voci.update(id, { reparto });
      }
    });
  }

  return {
    sistemati: nuovoReparto.size,
    viaAI,
    irrisolti: daSistemare.length - nuovoReparto.size,
    aiSaltata,
  };
}
