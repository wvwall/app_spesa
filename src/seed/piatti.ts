export const SEED_PIATTI_VERSION = 1;

export interface SeedPiatto {
  nome: string;
  porzioni: number;
  procedimento: string[];
  /** Nomi esatti (case-insensitive) di ingredienti che devono esistere nel catalogo seed
   * (src/seed/ingredienti.ts): se uno manca, viene semplicemente saltato per quel piatto. */
  ingredienti: string[];
}

/** Piatti d'esempio pronti all'uso, per non partire con un ricettario vuoto.
 * Nessuna noce/frutta a guscio (allergia in famiglia, RF13 di ANALISI.md). */
export const SEED_PIATTI: SeedPiatto[] = [
  {
    nome: "Pasta al pomodoro e basilico",
    porzioni: 4,
    procedimento: [
      "Cuoci gli spaghetti in acqua bollente salata secondo i tempi indicati.",
      "Scalda l'olio con l'aglio in padella, aggiungi la passata e cuoci 10 minuti.",
      "Scola la pasta, mantecala nel sugo con basilico spezzettato e parmigiano.",
    ],
    ingredienti: ["Spaghetti", "Passata di pomodoro", "Aglio", "Basilico", "Olio extravergine d'oliva", "Parmigiano Reggiano"],
  },
  {
    nome: "Insalata di riso",
    porzioni: 4,
    procedimento: [
      "Cuoci il riso, scolalo e lascialo raffreddare.",
      "Taglia i pomodorini e la mozzarella a cubetti.",
      "Unisci tutto con olive verdi e tonno sgocciolato, condisci con olio.",
    ],
    ingredienti: ["Riso", "Pomodorini", "Mozzarella", "Olive verdi", "Tonno sott'olio", "Olio extravergine d'oliva"],
  },
  {
    nome: "Zucchine ripiene",
    porzioni: 4,
    procedimento: [
      "Svuota le zucchine tagliate a metà e trita la polpa.",
      "Mescola la polpa con uova, mozzarella, parmigiano e pane grattugiato.",
      "Riempi le zucchine e cuoci in forno a 180° per 30 minuti.",
    ],
    ingredienti: ["Zucchine", "Uova", "Mozzarella", "Parmigiano Reggiano", "Pane grattugiato"],
  },
  {
    nome: "Parmigiana di melanzane",
    porzioni: 4,
    procedimento: [
      "Taglia le melanzane a fette e grigliale o friggile.",
      "Alterna in una teglia melanzane, passata di pomodoro, mozzarella e parmigiano.",
      "Cuoci in forno a 180° per 25 minuti, guarnisci con basilico.",
    ],
    ingredienti: ["Melanzane", "Passata di pomodoro", "Mozzarella", "Parmigiano Reggiano", "Basilico", "Olio extravergine d'oliva"],
  },
  {
    nome: "Orecchiette con cime di rapa",
    porzioni: 4,
    procedimento: [
      "Cuoci le orecchiette insieme alle cime di rapa nella stessa pentola.",
      "Scalda l'olio con aglio e acciughe fino a farle sciogliere.",
      "Scola pasta e cime di rapa, saltale nel condimento.",
    ],
    ingredienti: ["Orecchiette", "Cime di rapa", "Aglio", "Acciughe sott'olio", "Olio extravergine d'oliva"],
  },
  {
    nome: "Minestrone",
    porzioni: 4,
    procedimento: [
      "Taglia a pezzetti carote, patate, zucchine, cipolla e sedano.",
      "Fai soffriggere la cipolla, aggiungi le altre verdure e la passata di pomodoro.",
      "Copri con acqua e cuoci 30-40 minuti, aggiungi i fagioli verso fine cottura.",
    ],
    ingredienti: ["Carote", "Patate", "Zucchine", "Cipolle", "Sedano", "Passata di pomodoro", "Fagioli in scatola"],
  },
];
