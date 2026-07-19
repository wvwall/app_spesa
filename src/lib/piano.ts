import { db, nowIso, nuovoId } from "./db";
import type { PianoSettimana, Slot } from "./types";
import { giorniDelCiclo, pastiDelGiorno, toIsoDate } from "./settimana";

// Ogni funzione è avvolta in una transazione Dexie (che su Dexie serializza le transazioni
// "rw" concorrenti sulle stesse tabelle) per restare corretta anche se invocata due volte
// in rapida successione, come fa React StrictMode in sviluppo con gli effect.

export async function getOrCreatePiano(cicloIso: string): Promise<PianoSettimana> {
  return db.transaction("rw", db.piani, async () => {
    const esistente = await db.piani.where("settimanaIso").equals(cicloIso).first();
    if (esistente) return esistente;
    const piano: PianoSettimana = { id: nuovoId(), settimanaIso: cicloIso, updatedAt: nowIso() };
    await db.piani.add(piano);
    return piano;
  });
}

/** Genera i pasti del ciclo spesa: 8 giorni ancorati al giorno di inizio (es. venerdì),
 * con il primo giorno solo cena e l'ultimo solo pranzo (vedi pastiDelGiorno). */
export async function getOrCreateSlots(pianoId: string, inizioCiclo: Date): Promise<Slot[]> {
  return db.transaction("rw", db.slot, async () => {
    const esistenti = await db.slot.where("pianoId").equals(pianoId).toArray();
    if (esistenti.length > 0) return esistenti;

    const giorni = giorniDelCiclo(inizioCiclo);
    const nuovi: Slot[] = [];
    giorni.forEach((giorno, indice) => {
      for (const pasto of pastiDelGiorno(indice, giorni.length)) {
        nuovi.push({ id: nuovoId(), pianoId, data: toIsoDate(giorno), pasto });
      }
    });
    await db.slot.bulkAdd(nuovi);
    return nuovi;
  });
}

export async function assegnaPiattoASlot(slotId: string, piattoId: string | undefined): Promise<void> {
  await db.slot.update(slotId, { piattoId });
}
