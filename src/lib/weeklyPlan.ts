import { db, nowIso, createId } from "./database";
import type { WeeklyPlan, Slot } from "./models";
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
