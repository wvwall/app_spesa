import type { Meal, Slot } from "./models";

// Pure text parsing for the two import flows (weekly menu and shopping list). Nothing here
// touches the database: screens preview the result and let the user correct it before saving.

const PREFISSI_GIORNO: Record<string, number> = {
  dom: 0,
  lun: 1,
  mar: 2,
  mer: 3,
  gio: 4,
  ven: 5,
  sab: 6,
};

const REPARTO_RIPIEGO = "Dispensa";

/** A meal line recognized in the pasted text, already bound to one of the plan's slots. */
export interface MealDraft {
  slotId: string;
  dataIso: string;
  pasto: Meal;
  nome: string;
  raw: string;
}

export interface MealParseResult {
  pasti: MealDraft[];
  /** Meal-looking lines that could not be bound to a slot in the selected week. */
  senzaSlot: string[];
}

/** A shopping line recognized in the pasted text, with an inferred department. */
export interface ShoppingDraft {
  nome: string;
  /** Numeric quantity only (for example "2"); units live in `nota`. */
  quantita: string;
  nota?: string;
  reparto: string;
  ingredienteId?: string;
  /** True when the name matched the catalog or a local department rule. */
  riconosciuto: boolean;
  raw: string;
}

export interface ShoppingParseResult {
  righe: ShoppingDraft[];
  /** Non-meal lines that produced no usable item (headers and noise). */
  ignorate: string[];
}

/** Minimal shape accepted for department inference, so seed data and DB rows both work. */
export interface CatalogIngredient {
  nome: string;
  reparto: string;
  alias?: string[];
  id?: string;
  deletedAt?: string;
}

function normalizza(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compattaSpazi(testo: string): string {
  return testo.replace(/\s+/g, " ").trim();
}

function giornoDellaData(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay();
}

// Day prefix, meal, an optional parenthetical note ("Mercoledì cena (Walter):") and the dish.
const RE_RIGA_PASTO =
  /^\s*(?:[-•*]\s*)?(dom(?:enica)?|lun(?:edi)?|mar(?:tedi)?|mer(?:coledi)?|gio(?:vedi)?|ven(?:erdi)?|sab(?:ato)?)\s+(pranzo|cena)\b\s*(?:\([^)]*\))?\s*:\s*(.*)$/;

const RE_INTESTAZIONE = /^(spesa|lista(?: della spesa)?|ingredienti|menu)$/;

/** Units and containers recognized after a quantity ("2 confezioni", "500 g"). */
const UNITA =
  "confezion[ei]|pacchett[oi]|pacch[ei]|bottigli[ae]|barattol[oi]|vasett[oi]|sacchett[oi]|scatol[ae]|vaschett[ae]|bust[ae]|pezz[oi]|pz|kg|g|gr|ml|l|lt|ett[oi]|litr[oi]";

const RE_QUANTITA = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*(?:x\\s*)?((?:${UNITA})\\b)?\\s*(?:di\\s+)?(.+)$`,
  "i",
);

const RE_SOLO_UNITA = new RegExp(`^(?:${UNITA})$`, "i");

/** The parser stores the unit as the first segment of `nota` (so the quantity field stays
 * numeric). For display, splits it back out so it can sit next to the quantity ("500 g")
 * instead of reading like a handwritten note. */
export function splitUnitFromNote(nota?: string): { unita?: string; nota?: string } {
  if (!nota) return {};
  const [primo, ...resto] = nota.split(" · ");
  if (!RE_SOLO_UNITA.test(primo.trim())) return { nota };
  return { unita: primo.trim(), nota: resto.length > 0 ? resto.join(" · ") : undefined };
}

/** Inverse of splitUnitFromNote: stores unit and free note in the single `nota` field. */
export function joinUnitAndNote(unita?: string, nota?: string): string | undefined {
  const parti = [unita?.trim(), nota?.trim()].filter((p): p is string => Boolean(p));
  return parti.length > 0 ? parti.join(" · ") : undefined;
}

/** Common units offered as suggestions when typing an item by hand. */
export const UNITA_SUGGERITE = ["g", "kg", "ml", "l", "pz", "confezione", "bottiglia", "vasetto", "busta"];

/** Infers a department locally, without AI, from common Italian grocery words. Only used when
 * the name is not found in the ingredient catalog. */
const INDIZI_REPARTO: { reparto: string; regex: RegExp }[] = [
  {
    reparto: "Casa e igiene",
    regex:
      /\b(detersivo|ammorbidente|sapone|shampoo|dentifricio|carta igienica|sacchi|spugne|tovaglioli)\b/,
  },
  {
    reparto: "Bevande",
    regex:
      /\b(acqua|coca|cola|aranciata|succo|birra|vino|latte di avena|latte di soia|latte di mandorla|te freddo)\b/,
  },
  {
    reparto: "Ortofrutta",
    regex:
      /\b(avocado|mela|mele|prugna|prugne|insalata|lattuga|lattughino|spinaci|cavolo|cipollotto|pomodorini|pomodori|zucchine|melanzane|carote|patate|cipolle|limoni|banane|fragole|kiwi|pere|uva|finocchi|radicchio|porri|funghi|basilico|prezzemolo)\b/,
  },
  {
    reparto: "Surgelati",
    regex: /\b(surgelat|piselli|minestrone|gelato|bastoncini)\b/,
  },
  {
    reparto: "Macelleria e pesce",
    regex:
      /\b(gamberi|polipo|salmone|merluzzo|orata|branzino|sogliola|calamari|cozze|vongole|tonno fresco|pollo|manzo|maiale|tacchino|salsiccia|bistecca|spezzatino)\b/,
  },
  {
    reparto: "Banco frigo",
    regex:
      /\b(uova|uovo|yogurt|latte|formaggio|formaggi|affettati|danacol|ricotta|mozzarella|parmigiano|grana|burro|panna|pecorino|scamorza|stracchino|prosciutto|bresaola|salame|pancetta|wurstel|tortellini)\b/,
  },
  {
    reparto: "Forno",
    regex: /\b(pane|grissini|focaccia|piadine|cracker|fette biscottate|brioche)\b/,
  },
  {
    reparto: "Dispensa",
    regex:
      /\b(ceci|farro|noodles|pappe|soffritto|tonno|riso|pasta|spaghetti|penne|olio|sale|zucchero|farina|biscotti|marmellata|miele|caffe)\b/,
  },
];

function indiceCatalogo(catalogo: CatalogIngredient[]): Map<string, { reparto: string; id?: string }> {
  const indice = new Map<string, { reparto: string; id?: string }>();
  // Aliases first, then names, so an exact name always overrides a colliding alias.
  for (const ing of catalogo) {
    if (ing.deletedAt) continue;
    for (const alias of ing.alias ?? []) {
      indice.set(normalizza(alias), { reparto: ing.reparto, id: ing.id });
    }
  }
  for (const ing of catalogo) {
    if (ing.deletedAt) continue;
    indice.set(normalizza(ing.nome), { reparto: ing.reparto, id: ing.id });
  }
  return indice;
}

function repartoValido(reparto: string | undefined, ordineReparti: string[]): string {
  if (reparto && ordineReparti.includes(reparto)) return reparto;
  if (ordineReparti.includes(REPARTO_RIPIEGO)) return REPARTO_RIPIEGO;
  return ordineReparti[0] ?? REPARTO_RIPIEGO;
}

/** Parses meal lines and binds each one to a free slot of the selected week. Weekdays are matched
 * by actual slot date, so in a Friday–Friday cycle "Venerdì cena" goes to the first Friday and
 * "Venerdì pranzo" to the last one. Unmatched meal lines are reported, while shopping lines are
 * ignored here. */
export function parseMealText(
  testo: string,
  slots: Pick<Slot, "id" | "data" | "pasto">[],
): MealParseResult {
  const pasti: MealDraft[] = [];
  const senzaSlot: string[] = [];
  const usati = new Set<string>();

  for (const riga of testo.split(/\r?\n/)) {
    const originale = riga.trim();
    if (!originale) continue;
    const match = RE_RIGA_PASTO.exec(normalizza(originale));
    if (!match) continue;

    const giorno = PREFISSI_GIORNO[match[1].slice(0, 3)];
    const pasto = match[2] as Meal;
    const duePunti = originale.indexOf(":");
    const nomeGrezzo = duePunti >= 0 ? originale.slice(duePunti + 1) : "";
    const nome = compattaSpazi(nomeGrezzo)
      .replace(/^[-•*]\s*/, "")
      .replace(/[.;,]+$/, "")
      .trim();

    const slot = slots.find(
      (s) => s.pasto === pasto && giornoDellaData(s.data) === giorno && !usati.has(s.id),
    );
    if (!slot) {
      senzaSlot.push(originale);
      continue;
    }
    usati.add(slot.id);
    pasti.push({
      slotId: slot.id,
      dataIso: slot.data,
      pasto: slot.pasto,
      nome,
      raw: originale,
    });
  }

  return { pasti, senzaSlot };
}

/** Parses shopping lines, separating the numeric quantity from the unit (kept as a note)
 * together with notes such as "(già tagliato)". Meal lines and headings are ignored. Catalog
 * matches provide the department and ingredient link; otherwise a local keyword rule assigns the
 * department, with "Dispensa" as fallback. */
export function parseShoppingText(
  testo: string,
  catalogo: CatalogIngredient[],
  ordineReparti: string[],
): ShoppingParseResult {
  const righe: ShoppingDraft[] = [];
  const ignorate: string[] = [];
  const indice = indiceCatalogo(catalogo);
  const reparti = ordineReparti.length > 0 ? ordineReparti : [REPARTO_RIPIEGO];

  for (const riga of testo.split(/\r?\n/)) {
    const originale = riga.trim();
    if (!originale) continue;
    const normalizzata = normalizza(originale);
    if (RE_RIGA_PASTO.test(normalizzata)) continue;
    if (RE_INTESTAZIONE.test(normalizzata)) continue;

    const note: string[] = [];
    const senzaNote = originale
      .replace(/\s*\(([^)]*)\)/g, (_intero: string, nota: string) => {
        if (nota.trim()) note.push(nota.trim());
        return "";
      })
      .trim();

    const rigaPulita = senzaNote.replace(/^[-•*]\s*/, "").trim();
    if (!rigaPulita) continue;

    const match = RE_QUANTITA.exec(rigaPulita);
    let quantita = "";
    let nome = rigaPulita;
    if (match) {
      quantita = match[1];
      const unita = match[2]?.toLowerCase();
      // The quantity field stays numeric (and keeps the numeric keyboard): container/weight
      // words move to the note instead, which the user can still edit in the review sheet.
      if (unita) note.unshift(unita);
      nome = match[3];
    }

    nome = compattaSpazi(nome)
      .replace(/^[\s.:;,-]+/, "")
      .replace(/[.;,]+$/, "")
      .trim();
    if (!nome) {
      ignorate.push(originale);
      continue;
    }

    const catalogoTrovato = indice.get(normalizza(nome));
    let reparto: string | undefined = catalogoTrovato?.reparto;
    let riconosciuto = Boolean(catalogoTrovato);
    if (!reparto) {
      const indizio = INDIZI_REPARTO.find((i) => i.regex.test(normalizza(nome)));
      if (indizio) {
        reparto = indizio.reparto;
        riconosciuto = true;
      }
    }

    righe.push({
      nome,
      quantita,
      nota: note.length > 0 ? note.join(" · ") : undefined,
      reparto: repartoValido(reparto, reparti),
      ingredienteId: catalogoTrovato?.id,
      riconosciuto,
      raw: originale,
    });
  }

  return { righe, ignorate };
}
