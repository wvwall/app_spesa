import type { Pasto } from "./types";

export const GIORNI_SETTIMANA = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

/** Trova l'inizio del ciclo spesa: l'occorrenza di `giornoInizio` (0=domenica…6=sabato,
 * convenzione Date.getDay()) più recente, oggi compreso. */
export function inizioCiclo(data: Date, giornoInizio: number): Date {
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

/** 8 giornate: dal giorno di inizio ciclo (es. venerdì) al giorno di inizio del ciclo
 * successivo incluso (lo stesso giorno della settimana dopo). */
export function giorniDelCiclo(inizio: Date): Date[] {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(inizio);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Il primo giorno del ciclo copre solo la cena (la spesa si fa quel giorno stesso, il pranzo
 * non serve pianificarlo); l'ultimo giorno copre solo il pranzo (si farà la spesa successiva
 * prima di cena). I giorni intermedi coprono entrambi i pasti. */
export function pastiDelGiorno(indiceGiorno: number, totaleGiorni: number): Pasto[] {
  if (indiceGiorno === 0) return ["cena"];
  if (indiceGiorno === totaleGiorni - 1) return ["pranzo"];
  return ["pranzo", "cena"];
}

const FORMATTER_GIORNO = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric" });

export function etichettaGiorno(d: Date): string {
  const s = FORMATTER_GIORNO.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FORMATTER_MESE = new Intl.DateTimeFormat("it-IT", { month: "long" });

export function etichettaCiclo(inizio: Date): string {
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

export function isOggi(d: Date): boolean {
  const oggi = new Date();
  return d.toDateString() === oggi.toDateString();
}

export function cicloSuccessivo(inizio: Date, delta: number): Date {
  const d = new Date(inizio);
  d.setDate(d.getDate() + delta * 7);
  return d;
}
