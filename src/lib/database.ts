import Dexie, { type EntityTable } from "dexie";
import type {
  Profile,
  Ingredient,
  Dish,
  DishIngredient,
  WeeklyPlan,
  Slot,
  ShoppingListRecord,
  ShoppingListItem,
  Theme,
} from "./models";

export const db = new Dexie("LaSpesaDiCasa") as Dexie & {
  profilo: EntityTable<Profile, "id">;
  ingredienti: EntityTable<Ingredient, "id">;
  piatti: EntityTable<Dish, "id">;
  piattoIngredienti: EntityTable<DishIngredient, "id">;
  piani: EntityTable<WeeklyPlan, "id">;
  slot: EntityTable<Slot, "id">;
  liste: EntityTable<ShoppingListRecord, "id">;
  voci: EntityTable<ShoppingListItem, "id">;
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

export const PROFILE_ID = "profilo";

export const DEFAULT_DEPARTMENTS = [
  "Ortofrutta",
  "Banco frigo",
  "Macelleria e pesce",
  "Surgelati",
  "Dispensa",
  "Forno",
  "Bevande",
  "Casa e igiene",
];

export async function getOrCreateProfile(): Promise<Profile> {
  const esistente = await db.profilo.get(PROFILE_ID);
  if (esistente) return esistente;
  const nuovo: Profile = {
    id: PROFILE_ID,
    porzioniDefault: 2,
    vincoliAlimentari: ["noci"],
    ordineReparti: DEFAULT_DEPARTMENTS,
    giornoSpesa: 5, // Friday.
    tema: "chiaro",
    seedVersion: 0,
    seedVersionPiatti: 0,
    updatedAt: new Date().toISOString(),
  };
  try {
    await db.profilo.add(nuovo);
    return nuovo;
  } catch {
    // A concurrent call (for example, React StrictMode's duplicate development effect) may have
    // created the profile in the meantime.
    const giaCreato = await db.profilo.get(PROFILE_ID);
    if (giaCreato) return giaCreato;
    throw new Error("Impossibile creare il profilo.");
  }
}

const DATA_THEME_PER_TEMA: Record<Theme, string> = {
  chiaro: "light",
  scuro: "dark",
  stitch: "stitch",
};

export function applyTheme(tema: Theme): void {
  document.documentElement.setAttribute("data-theme", DATA_THEME_PER_TEMA[tema]);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  return crypto.randomUUID();
}
