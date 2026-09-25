export type Meal = "pranzo" | "cena";
export type IngredientOrigin = "seed" | "utente";
export type RecipeOrigin = "manuale" | "ai";
export type Theme = "chiaro" | "scuro" | "stitch";

/** Non-negotiable safety constraint: "noci" must always be present and must never be removed
 * without the user's explicit confirmation (see DESIGN.md §8.6 and ANALISI.md RF13). */
export interface Profile {
  id: string; // singleton
  porzioniDefault: number;
  vincoliAlimentari: string[];
  ordineReparti: string[];
  /** Shopping day: 0=Sunday … 6=Saturday (Date.getDay() convention). Defaults to 5 (Friday).
   * Anchors the shopping cycle from dinner on this day to lunch on the matching day next week. */
  giornoSpesa: number;
  tema: Theme;
  seedVersion: number;
  /** Example-dish seed version (src/seed/dishes.ts), separate from seedVersion (ingredient
   * catalog) because the two depend on and evolve independently from each other. */
  seedVersionPiatti: number;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  nome: string;
  reparto: string;
  unitaDefault: string;
  alias: string[];
  note?: string;
  origine: IngredientOrigin;
  updatedAt: string;
  deletedAt?: string;
}

export interface Dish {
  id: string;
  nome: string;
  procedimento?: string;
  preferito: boolean;
  origine: RecipeOrigin;
  porzioni: number;
  updatedAt: string;
  deletedAt?: string;
}

export interface DishIngredient {
  id: string;
  piattoId: string;
  /** Catalog reference, if the ingredient existed there when this row was created. It is not
   * used to resolve the name or department: those are permanent snapshots (see below), so a
   * catalog change can never make an ingredient disappear from the list. */
  ingredienteId?: string;
  nome: string;
  reparto: string;
  quantita: number;
  unita: string;
}

export interface WeeklyPlan {
  id: string;
  /** Monday of the week, in ISO format, e.g. "2026-07-14". */
  settimanaIso: string;
  updatedAt: string;
}

export interface Slot {
  id: string;
  pianoId: string;
  /** ISO date, e.g. "2026-07-14". */
  data: string;
  pasto: Meal;
  piattoId?: string;
}

export interface ShoppingListRecord {
  id: string;
  pianoId: string;
  /** When true, alternatives have been pre-generated and the list is ready for active shopping. */
  chiusa: boolean;
  updatedAt: string;
}

export interface ShoppingListItem {
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
  /** Alternatives pre-generated when the list is closed, available offline. */
  alternative: string[];
  sostituitoCon?: string;
  /** Locally stored, resized JPEG data URL for this shopping-list item. */
  fotoDataUrl?: string;
}
