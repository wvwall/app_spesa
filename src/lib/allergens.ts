/** Catalogo condiviso tra app e Netlify Function (importato anche da `netlify/functions/ai.ts`).
 * Per ogni allergene `termini` elenca i nomi (anche parziali) con cui può comparire in un piatto:
 * il controllo sull'output rigenera il piatto se uno di questi compare. Il matching è volutamente
 * prudente (sottostringa), quindi può produrre falsi positivi: meglio rigenerare che rischiare.
 * `sinonimi` mappa invece le diciture che l'utente può scrivere nel profilo. */

export interface Allergene {
  id: string;
  etichetta: string;
  sinonimi: string[];
  termini: string[];
}

export const CATALOGO_ALLERGENI: Allergene[] = [
  {
    id: "frutta-a-guscio",
    etichetta: "noci e frutta a guscio",
    sinonimi: [
      "noci",
      "noce",
      "nocciole",
      "nocciola",
      "frutta a guscio",
      "mandorle",
      "mandorla",
      "pistacchi",
      "pistacchio",
      "anacardi",
      "pinoli",
      "pinolo",
      "noci pecan",
      "macadamia",
    ],
    termini: [
      "noce",
      "noci",
      "nocciola",
      "nocciole",
      "gheriglio",
      "gherigli",
      "macadamia",
      "anacardi",
      "anacardio",
      "pistacchio",
      "pistacchi",
      "mandorla",
      "mandorle",
      "pinolo",
      "pinoli",
      "pecan",
      "noce del brasile",
    ],
  },
  {
    id: "arachidi",
    etichetta: "arachidi",
    sinonimi: ["arachidi", "arachide", "burro di arachidi"],
    termini: ["arachide", "arachidi"],
  },
  {
    id: "latte",
    etichetta: "latte e lattosio",
    sinonimi: ["latte", "lattosio", "latticini", "formaggio", "burro"],
    termini: [
      "latte",
      "latticini",
      "burro",
      "panna",
      "formaggio",
      "formaggi",
      "mozzarella",
      "ricotta",
      "yogurt",
      "parmigiano",
      "grana",
      "pecorino",
      "mascarpone",
      "gorgonzola",
      "provolone",
      "scamorza",
      "stracchino",
      "fontina",
      "besciamella",
    ],
  },
  {
    id: "glutine",
    etichetta: "glutine",
    sinonimi: ["glutine", "grano", "frumento", "celiachia"],
    termini: [
      "glutine",
      "farina",
      "frumento",
      "grano",
      "semola",
      "pasta",
      "pane",
      "pizz",
      "orzo",
      "segale",
      "avena",
      "farro",
      "spaghett",
      "penne",
      "fusilli",
      "tagliatell",
      "cracker",
      "biscott",
      "pangrattato",
      "cous cous",
      "bulgur",
    ],
  },
  {
    id: "crostacei",
    etichetta: "crostacei",
    sinonimi: ["crostacei", "gamberi", "gamberetti"],
    termini: [
      "gamber",
      "scampi",
      "aragosta",
      "granchio",
      "astice",
      "mazzancolle",
      "crostacei",
    ],
  },
  {
    id: "molluschi",
    etichetta: "molluschi",
    sinonimi: ["molluschi", "vongole", "cozze"],
    termini: [
      "vongole",
      "cozze",
      "calamari",
      "seppie",
      "polpo",
      "ostriche",
      "molluschi",
      "frutti di mare",
    ],
  },
  {
    id: "soia",
    etichetta: "soia",
    sinonimi: ["soia", "edamame", "tofu"],
    termini: ["soia", "edamame", "tofu", "tamari"],
  },
];

function normalizza(testo: string): string {
  return testo.trim().toLowerCase();
}

export function trovaAllergene(nome: string): Allergene | undefined {
  const n = normalizza(nome);
  if (!n) return undefined;
  return CATALOGO_ALLERGENI.find(
    (a) =>
      normalizza(a.etichetta) === n ||
      a.sinonimi.some((s) => normalizza(s) === n),
  );
}

/** Allergeni riconosciuti (con controllo automatico) tra i vincoli configurati, senza duplicati. */
export function allergeniRiconosciuti(vincoli: string[]): Allergene[] {
  const visti = new Set<string>();
  const risultato: Allergene[] = [];
  for (const vincolo of vincoli) {
    const allergene = trovaAllergene(vincolo);
    if (allergene && !visti.has(allergene.id)) {
      visti.add(allergene.id);
      risultato.push(allergene);
    }
  }
  return risultato;
}

/** Vincoli scritti dall'utente che non corrispondono a un allergene del catalogo. */
export function allergeniNonRiconosciuti(vincoli: string[]): string[] {
  return vincoli.map((v) => v.trim()).filter((v) => v && !trovaAllergene(v));
}

/** Allergeni del catalogo i cui termini compaiono nel testo generato. */
export function allergeniViolati(
  testo: string,
  allergeni: Allergene[],
): Allergene[] {
  const normalizzato = testo.toLowerCase();
  return allergeni.filter((a) =>
    a.termini.some((termine) => normalizzato.includes(termine)),
  );
}
