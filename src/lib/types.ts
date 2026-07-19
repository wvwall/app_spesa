export type Pasto = "pranzo" | "cena";
export type OrigineIngrediente = "seed" | "utente";
export type OrigineRicetta = "manuale" | "ai";
export type Tema = "chiaro" | "scuro" | "sistema";

/** Vincolo di sicurezza non negoziabile: "noci" è sempre presente e non va mai rimosso
 * senza una conferma esplicita dell'utente (vedi DESIGN.md §8.6 e ANALISI.md RF13). */
export interface Profilo {
  id: string; // singleton
  porzioniDefault: number;
  vincoliAlimentari: string[];
  ordineReparti: string[];
  /** Giorno in cui si fa la spesa: 0=domenica … 6=sabato (convenzione Date.getDay()). Default 5 (venerdì).
   * Ancora il ciclo spesa: da cena di questo giorno a pranzo del giorno successivo dello stesso tipo. */
  giornoSpesa: number;
  tema: Tema;
  seedVersion: number;
  updatedAt: string;
}

export interface Ingrediente {
  id: string;
  nome: string;
  reparto: string;
  unitaDefault: string;
  alias: string[];
  note?: string;
  origine: OrigineIngrediente;
  updatedAt: string;
  deletedAt?: string;
}

export interface Piatto {
  id: string;
  nome: string;
  procedimento?: string;
  preferito: boolean;
  origine: OrigineRicetta;
  porzioni: number;
  updatedAt: string;
  deletedAt?: string;
}

export interface PiattoIngrediente {
  id: string;
  piattoId: string;
  ingredienteId?: string;
  testoLibero?: string;
  quantita: number;
  unita: string;
}

export interface PianoSettimana {
  id: string;
  /** Lunedì della settimana, formato ISO "2026-07-14" */
  settimanaIso: string;
  updatedAt: string;
}

export interface Slot {
  id: string;
  pianoId: string;
  /** ISO date "2026-07-14" */
  data: string;
  pasto: Pasto;
  piattoId?: string;
}

export interface ListaSpesa {
  id: string;
  pianoId: string;
  /** Quando true, le alternative sono state pre-generate e la lista è pronta per la spesa attiva */
  chiusa: boolean;
  updatedAt: string;
}

export interface VoceLista {
  id: string;
  listaId: string;
  ingredienteId?: string;
  testoLibero?: string;
  nome: string;
  quantita: string;
  reparto: string;
  checked: boolean;
  checkedAt?: string;
  nota?: string;
  /** Alternative pre-generate alla chiusura lista, disponibili offline */
  alternative: string[];
  sostituitoCon?: string;
}
