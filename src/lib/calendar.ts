import type { Meal } from "./models";

export const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

/** Finds the start of the shopping cycle: the most recent occurrence of `giornoInizio`
 * (0=Sunday…6=Saturday, following Date.getDay()), including today. */
export function cycleStart(data: Date, giornoInizio: number): Date {
  const d = new Date(data);
  const giorno = d.getDay();
  const offset = (giorno - giornoInizio + 7) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toIsoDate(d: Date): string {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, "0");
  const giorno = String(d.getDate()).padStart(2, "0");
  return `${anno}-${mese}-${giorno}`;
}

/** Returns eight days: from the cycle start (for example, Friday) through the next cycle's
 * start day, inclusive (the same weekday one week later). */
export function cycleDays(inizio: Date): Date[] {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(inizio);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** The first cycle day includes dinner only (shopping happens that day, so lunch need not be
 * planned). The final day includes lunch only (the next shopping trip happens before dinner).
 * Intermediate days include both meals. */
export function mealsForDay(indiceGiorno: number, totaleGiorni: number): Meal[] {
  if (indiceGiorno === 0) return ["cena"];
  if (indiceGiorno === totaleGiorni - 1) return ["pranzo"];
  return ["pranzo", "cena"];
}

const FORMATTER_GIORNO = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric" });

export function formatDayLabel(d: Date): string {
  const s = FORMATTER_GIORNO.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FORMATTER_MESE = new Intl.DateTimeFormat("it-IT", { month: "long" });

export function formatCycleLabel(inizio: Date): string {
  const fine = new Date(inizio);
  fine.setDate(fine.getDate() + 7);
  const meseInizio = FORMATTER_MESE.format(inizio);
  const meseFine = FORMATTER_MESE.format(fine);
  const rangeGiorni =
    meseInizio === meseFine
      ? `${inizio.getDate()}–${fine.getDate()} ${meseFine}`
      : `${inizio.getDate()} ${meseInizio} – ${fine.getDate()} ${meseFine}`;
  return `Settimana ${rangeGiorni}`;
}

export function isToday(d: Date): boolean {
  const oggi = new Date();
  return d.toDateString() === oggi.toDateString();
}

export function shiftCycle(inizio: Date, delta: number): Date {
  const d = new Date(inizio);
  d.setDate(d.getDate() + delta * 7);
  return d;
}
