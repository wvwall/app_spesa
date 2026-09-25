import { db, nowIso, createId } from "./database";
import type { ShoppingListRecord, ShoppingListItem } from "./models";
import { findAlternatives } from "./alternatives";
import { buildDepartmentIndex, inferDepartmentLocally } from "./departments";
import { classifyDepartments } from "./ai";

/** Catch-all department for items whose department is unknown (see dishes.ts). */
const REPARTO_NON_CATEGORIZZATO = "Dispensa";

/** Aggregates planned-dish ingredients into the plan's open list (RF8).
 * Reuses the existing list (see getOrCreateOpenList) instead of creating one on each click.
 * Previously, repeating "Generate list" or using it after manually adding items could hide
 * earlier lists behind the newest one. Manually added items (testoLibero) remain unchanged;
 * only dish-derived rows are rebuilt. Each ingredient appears once even if several dishes use
 * it. Quantities are not added because AI, catalog, and free-text sources cannot be compared
 * reliably. Quantities start blank for the user to fill in if needed. Names and departments
 * come from the DishIngredient snapshot rather than a catalog lookup, so catalog changes can
 * never make an ingredient disappear from the shopping list. */
export async function generateListFromPlan(pianoId: string): Promise<ShoppingListRecord> {
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
      // A dish may have been assigned by name alone ("+ Use as is" in Weekly Planner), without
      // linked ingredients. Include it through this fallback so weeks with such dishes do not
      // produce an empty or nearly empty shopping list.
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
      // Legacy rows created before permanent name/department snapshots may lack those fields.
      // They must not break list generation or make an ingredient disappear; recover what is
      // available and use a visible fallback as a last resort.
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

  const lista = await getOrCreateOpenList(pianoId);

  await db.transaction("rw", db.voci, async () => {
    const esistenti = await db.voci.where("listaId").equals(lista.id).toArray();
    const daPiatti = esistenti.filter((v) => !v.testoLibero);
    await db.voci.bulkDelete(daPiatti.map((v) => v.id));

    const nuove: ShoppingListItem[] = Array.from(aggregate.values()).map((r) => ({
      id: createId(),
      listaId: lista.id,
      ingredienteId: r.ingredienteId,
      nome: r.nome,
      quantita: "",
      reparto: r.reparto,
      checked: false,
      alternative: findAlternatives(r.nome),
    }));
    if (nuove.length > 0) {
      await db.voci.bulkAdd(nuove);
    }
  });

  return lista;
}

/** Returns the list for a plan. A plan should have one list. This replaces the old `.last()`,
 * which sorted by primary key (a random crypto.randomUUID) and could return an arbitrary list,
 * causing displayed rows to differ from the rows being edited. Includes lists already marked
 * closed (shopping started), so the Shopping List screen does not empty after "Start shopping".
 * If legacy data contains multiple lists, deterministically returns the most recently updated. */
export async function getListForPlan(pianoId: string): Promise<ShoppingListRecord | undefined> {
  const liste = await db.liste.where("pianoId").equals(pianoId).toArray();
  if (liste.length === 0) return undefined;
  return liste.reduce((piuRecente, l) => (l.updatedAt > piuRecente.updatedAt ? l : piuRecente));
}

/** Gets or creates the current plan's list for manually added items. Reuses that week's list,
 * even if it is already closed, instead of creating another for each item. This keeps one list
 * per week and prevents duplicates. */
export async function getOrCreateOpenList(pianoId: string): Promise<ShoppingListRecord> {
  return db.transaction("rw", db.liste, async () => {
    const esistente = await getListForPlan(pianoId);
    if (esistente) return esistente;
    const lista: ShoppingListRecord = { id: createId(), pianoId, chiusa: false, updatedAt: nowIso() };
    await db.liste.add(lista);
    return lista;
  });
}

export async function addFreeItem(
  listaId: string,
  nome: string,
  quantita: string,
  reparto: string,
  fotoDataUrl?: string,
): Promise<void> {
  const voce: ShoppingListItem = {
    id: createId(),
    listaId,
    nome,
    // Mark this as manually added so generateListFromPlan preserves it while rebuilding
    // items derived from planned dishes.
    testoLibero: nome,
    quantita,
    reparto,
    checked: false,
    alternative: findAlternatives(nome),
    fotoDataUrl,
  };
  await db.voci.add(voce);
}

export async function toggleItem(voceId: string, checked: boolean): Promise<void> {
  await db.voci.update(voceId, { checked, checkedAt: checked ? nowIso() : undefined });
}

export async function deleteItem(voceId: string): Promise<void> {
  await db.voci.delete(voceId);
}

export async function updateQuantity(voceId: string, quantita: string): Promise<void> {
  await db.voci.update(voceId, { quantita });
}

export async function updateItem(
  voce: ShoppingListItem,
  dati: { nome: string; quantita: string; reparto: string; fotoDataUrl?: string },
): Promise<void> {
  await db.voci.update(voce.id, {
    nome: dati.nome,
    quantita: dati.quantita,
    reparto: dati.reparto,
    fotoDataUrl: dati.fotoDataUrl,
    alternative: findAlternatives(dati.nome),
    ...(voce.testoLibero ? { testoLibero: dati.nome } : {}),
  });
}

export async function replaceItem(voceId: string, sostitutoNome: string): Promise<void> {
  await db.voci.update(voceId, { sostituitoCon: sostitutoNome });
}

/** Deletes the list and all its items, returning to the "no list yet" state. */
export async function deleteCompleteList(listaId: string): Promise<void> {
  await db.transaction("rw", db.liste, db.voci, async () => {
    const voci = await db.voci.where("listaId").equals(listaId).toArray();
    await db.voci.bulkDelete(voci.map((v) => v.id));
    await db.liste.delete(listaId);
  });
}

export interface DepartmentSortResult {
  /** Items assigned a new department, different from the original one. */
  sistemati: number;
  /** Number of items classified with AI; the rest were matched from the local catalog. */
  viaAI: number;
  /** Uncategorized items that remain in "Dispensa" because they were not recognized. */
  irrisolti: number;
  /** True when items needed AI classification but it was unavailable (offline or on error). */
  aiSaltata: boolean;
}

/** Assigns departments to uncategorized list items (in "Dispensa" or with no department) so
 * they can be grouped and sorted. First use the local catalog (name and aliases, offline and
 * free); send only unmatched items to AI, constrained to the app's departments (`ordineReparti`).
 * Existing classifications, whether catalog-based or manually selected, are left untouched.
 * The department is saved on the item and is therefore consistent in review, export, and active
 * shopping. */
export async function sortListByDepartment(
  listaId: string,
  ordineReparti: string[],
): Promise<DepartmentSortResult> {
  const voci = await db.voci.where("listaId").equals(listaId).toArray();
  const daSistemare = voci.filter((v) => !v.reparto || v.reparto === REPARTO_NON_CATEGORIZZATO);
  if (daSistemare.length === 0) {
    return { sistemati: 0, viaAI: 0, irrisolti: 0, aiSaltata: false };
  }

  const catalogo = await db.ingredienti.toArray();
  const indice = buildDepartmentIndex(catalogo);

  const nuovoReparto = new Map<string, string>(); // item ID → department
  const irrisolte: ShoppingListItem[] = [];
  for (const v of daSistemare) {
    const locale = inferDepartmentLocally(v.nome, indice);
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
        const assegnazioni = await classifyDepartments({ ingredienti: nomiUnici, reparti: ordineReparti });
        const perNome = new Map(assegnazioni.map((a) => [a.nome.trim().toLowerCase(), a.reparto]));
        for (const v of irrisolte) {
          const rep = perNome.get(v.nome.trim().toLowerCase());
          if (rep && rep !== v.reparto) {
            nuovoReparto.set(v.id, rep);
            viaAI++;
          }
        }
      } catch {
        // AI is unavailable; unmatched items remain in "Dispensa" (graceful degradation).
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
