import { db, nowIso, createId } from "./database";
import type { WeeklyPlan, Slot, Dish } from "./models";
import { cycleDays, mealsForDay, toIsoDate } from "./calendar";

// Each function uses a Dexie transaction. Dexie serializes concurrent "rw" transactions on the
// same tables, keeping the operation safe when React StrictMode invokes an effect twice quickly.

export async function getOrCreateWeeklyPlan(cicloIso: string): Promise<WeeklyPlan> {
  return db.transaction("rw", db.piani, async () => {
    const esistente = await db.piani.where("settimanaIso").equals(cicloIso).first();
    if (esistente) return esistente;
    const piano: WeeklyPlan = { id: createId(), settimanaIso: cicloIso, updatedAt: nowIso() };
    await db.piani.add(piano);
    return piano;
  });
}

/** Creates meals for the eight-day shopping cycle, anchored to its start day (for example,
 * Friday). The first day contains dinner only and the last contains lunch only (see mealsForDay). */
export async function getOrCreatePlanSlots(pianoId: string, cycleStart: Date): Promise<Slot[]> {
  return db.transaction("rw", db.slot, async () => {
    const esistenti = await db.slot.where("pianoId").equals(pianoId).toArray();
    if (esistenti.length > 0) return esistenti;

    const giorni = cycleDays(cycleStart);
    const nuovi: Slot[] = [];
    giorni.forEach((giorno, indice) => {
      for (const pasto of mealsForDay(indice, giorni.length)) {
        nuovi.push({ id: createId(), pianoId, data: toIsoDate(giorno), pasto });
      }
    });
    await db.slot.bulkAdd(nuovi);
    return nuovi;
  });
}

export async function assignDishToSlot(slotId: string, piattoId: string | undefined): Promise<void> {
  await db.slot.update(slotId, { piattoId });
}

export interface MealImportAssignment {
  slotId: string;
  /** Empty string clears the slot; a name assigns an existing dish or creates a manual one. */
  nome: string;
}

export interface MealImportResult {
  assegnati: number;
  svuotati: number;
  piattiCreati: number;
}

function normalizzaNomePiatto(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Applies reviewed meal rows to the plan. Reuses a dish with the same name when possible and
 * creates a manual dish otherwise. Slots not mentioned in the import stay untouched. */
export async function importMealsIntoPlan(
  righe: MealImportAssignment[],
  porzioni: number,
): Promise<MealImportResult> {
  return db.transaction("rw", db.piatti, db.slot, async () => {
    const piatti = await db.piatti.toArray();
    const perNome = new Map<string, Dish>();
    for (const piatto of piatti) {
      if (!piatto.deletedAt) perNome.set(normalizzaNomePiatto(piatto.nome), piatto);
    }

    let assegnati = 0;
    let svuotati = 0;
    let piattiCreati = 0;

    for (const riga of righe) {
      const nome = riga.nome.replace(/\s+/g, " ").trim();
      if (!nome) {
        await db.slot.update(riga.slotId, { piattoId: undefined });
        svuotati++;
        continue;
      }

      let piatto = perNome.get(normalizzaNomePiatto(nome));
      if (!piatto) {
        piatto = {
          id: createId(),
          nome,
          preferito: false,
          origine: "manuale",
          porzioni,
          updatedAt: nowIso(),
        };
        await db.piatti.add(piatto);
        perNome.set(normalizzaNomePiatto(nome), piatto);
        piattiCreati++;
      }

      await db.slot.update(riga.slotId, { piattoId: piatto.id });
      assegnati++;
    }

    return { assegnati, svuotati, piattiCreati };
  });
}
