import type { Ingredient } from "./models";

/** Sorts departments according to the user's preference (profile.ordineReparti); departments
 * missing from that order are placed last. Shared by text export (src/lib/listExport.ts) and
 * active shopping (src/screens/ActiveShopping.tsx) to avoid duplicating the logic. */
export function sortDepartments(reparti: string[], ordine: string[]): string[] {
  return [...reparti].sort((a, b) => {
    const ia = ordine.indexOf(a);
    const ib = ordine.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

/** Groups items by department and returns the groups sorted according to `ordine`. */
export function groupByDepartment<T extends { reparto: string }>(
  voci: T[],
  ordine: string[],
): { reparto: string; voci: T[] }[] {
  const gruppi = new Map<string, T[]>();
  for (const v of voci) {
    const arr = gruppi.get(v.reparto) ?? [];
    arr.push(v);
    gruppi.set(v.reparto, arr);
  }
  return sortDepartments([...gruppi.keys()], ordine).map((reparto) => ({
    reparto,
    voci: gruppi.get(reparto) ?? [],
  }));
}

function normalize(nome: string): string {
  return nome.trim().toLowerCase();
}

/** Builds a name/alias-to-department index from the ingredient catalog, so an item's department
 * can be inferred offline without AI. Each name and alias maps to the ingredient's department;
 * an exact name takes precedence over a colliding alias. */
export function buildDepartmentIndex(catalogo: Ingredient[]): Map<string, string> {
  const indice = new Map<string, string>();
  // Add aliases first, then names, so an exact name always overrides a colliding alias.
  for (const ing of catalogo) {
    if (ing.deletedAt) continue;
    for (const alias of ing.alias ?? []) {
      indice.set(normalize(alias), ing.reparto);
    }
  }
  for (const ing of catalogo) {
    if (ing.deletedAt) continue;
    indice.set(normalize(ing.nome), ing.reparto);
  }
  return indice;
}

/** Infers a department locally from an exact, normalized catalog name or alias match. Returns
 * null for unknown items, which the caller may then send to AI classification. */
export function inferDepartmentLocally(nome: string, indice: Map<string, string>): string | null {
  return indice.get(normalize(nome)) ?? null;
}
