import type { Ingrediente } from "./types";

/** Ordina i reparti secondo la preferenza dell'utente (profilo.ordineReparti); quelli non
 * presenti nell'ordine finiscono in fondo. Estratto per non duplicare la stessa logica in
 * export testo (src/lib/exportText.ts) e spesa attiva (src/screens/SpesaAttiva.tsx). */
export function ordinaReparti(reparti: string[], ordine: string[]): string[] {
  return [...reparti].sort((a, b) => {
    const ia = ordine.indexOf(a);
    const ib = ordine.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

/** Raggruppa le voci per reparto e restituisce i gruppi già ordinati secondo `ordine`. */
export function raggruppaPerReparto<T extends { reparto: string }>(
  voci: T[],
  ordine: string[],
): { reparto: string; voci: T[] }[] {
  const gruppi = new Map<string, T[]>();
  for (const v of voci) {
    const arr = gruppi.get(v.reparto) ?? [];
    arr.push(v);
    gruppi.set(v.reparto, arr);
  }
  return ordinaReparti([...gruppi.keys()], ordine).map((reparto) => ({
    reparto,
    voci: gruppi.get(reparto) ?? [],
  }));
}

function normalizza(nome: string): string {
  return nome.trim().toLowerCase();
}

/** Indice nome/alias → reparto costruito dal catalogo ingredienti: permette di dedurre il
 * reparto di un articolo senza rete né AI. Ogni nome e ogni suo alias puntano al reparto
 * dell'ingrediente (il nome vince sugli alias in caso di collisione). */
export function costruisciIndiceReparti(catalogo: Ingrediente[]): Map<string, string> {
  const indice = new Map<string, string>();
  // Prima gli alias, poi i nomi: così un nome esatto sovrascrive sempre un eventuale alias omonimo.
  for (const ing of catalogo) {
    if (ing.deletedAt) continue;
    for (const alias of ing.alias ?? []) {
      indice.set(normalizza(alias), ing.reparto);
    }
  }
  for (const ing of catalogo) {
    if (ing.deletedAt) continue;
    indice.set(normalizza(ing.nome), ing.reparto);
  }
  return indice;
}

/** Reparto dedotto localmente dal catalogo (match esatto su nome o alias, normalizzati), oppure
 * null se l'articolo non è riconosciuto (in tal caso l'orchestrazione può chiedere all'AI). */
export function deduciRepartoLocale(nome: string, indice: Map<string, string>): string | null {
  return indice.get(normalizza(nome)) ?? null;
}
