import Dexie, { type EntityTable } from "dexie";
import type {
  Profilo,
  Ingrediente,
  Piatto,
  PiattoIngrediente,
  PianoSettimana,
  Slot,
  ListaSpesa,
  VoceLista,
  Tema,
} from "./types";

export const db = new Dexie("LaSpesaDiCasa") as Dexie & {
  profilo: EntityTable<Profilo, "id">;
  ingredienti: EntityTable<Ingrediente, "id">;
  piatti: EntityTable<Piatto, "id">;
  piattoIngredienti: EntityTable<PiattoIngrediente, "id">;
  piani: EntityTable<PianoSettimana, "id">;
  slot: EntityTable<Slot, "id">;
  liste: EntityTable<ListaSpesa, "id">;
  voci: EntityTable<VoceLista, "id">;
};

db.version(1).stores({
  profilo: "id",
  ingredienti: "id, nome, reparto, origine",
  piatti: "id, nome, preferito, origine",
  piattoIngredienti: "id, piattoId, ingredienteId",
  piani: "id, settimanaIso",
  slot: "id, pianoId, data, pasto",
  liste: "id, pianoId",
  voci: "id, listaId, reparto, checked",
});

export const PROFILO_ID = "profilo";

export const REPARTI_DEFAULT = [
  "Ortofrutta",
  "Banco frigo",
  "Macelleria e pesce",
  "Surgelati",
  "Dispensa",
  "Forno",
  "Bevande",
  "Casa e igiene",
];

export async function getOrCreateProfilo(): Promise<Profilo> {
  const esistente = await db.profilo.get(PROFILO_ID);
  if (esistente) return esistente;
  const nuovo: Profilo = {
    id: PROFILO_ID,
    porzioniDefault: 2,
    vincoliAlimentari: ["noci"],
    ordineReparti: REPARTI_DEFAULT,
    giornoSpesa: 5, // venerdì
    tema: "chiaro",
    seedVersion: 0,
    seedVersionPiatti: 0,
    updatedAt: new Date().toISOString(),
  };
  try {
    await db.profilo.add(nuovo);
    return nuovo;
  } catch {
    // Chiamata concorrente (es. doppio effect di React StrictMode in sviluppo):
    // un'altra invocazione ha già creato il profilo nel frattempo.
    const giaCreato = await db.profilo.get(PROFILO_ID);
    if (giaCreato) return giaCreato;
    throw new Error("Impossibile creare il profilo.");
  }
}

const DATA_THEME_PER_TEMA: Record<Tema, string> = {
  chiaro: "light",
  scuro: "dark",
  stitch: "stitch",
};

export function applicaTema(tema: Tema): void {
  document.documentElement.setAttribute("data-theme", DATA_THEME_PER_TEMA[tema]);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nuovoId(): string {
  return crypto.randomUUID();
}
