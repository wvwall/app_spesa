/** Local map of substitutions between similar ingredients: no AI or network calls,
 * with instant results that are always available offline (RF7). Groups are curated by hand
 * and are not exhaustive: ingredients absent from every group have no suggested alternatives. */
const GRUPPI_SOSTITUZIONE: string[][] = [
  ["Spinaci freschi", "Bietole", "Cime di rapa", "Friarielli surgelati", "Rucola"],
  ["Limoni", "Arance"],
  ["Ricotta", "Stracchino", "Formaggio spalmabile"],
  ["Parmigiano Reggiano", "Grana Padano", "Pecorino"],
  ["Prosciutto cotto", "Prosciutto crudo", "Speck", "Bresaola", "Salame"],
  ["Macinato di manzo", "Macinato misto"],
  ["Petto di pollo", "Cosce di pollo", "Tacchino a fette"],
  ["Merluzzo fresco", "Filetti di merluzzo surgelati", "Sogliola", "Orata", "Branzino"],
  ["Cozze", "Vongole", "Gamberi", "Gamberetti surgelati", "Calamari", "Misto mare surgelato"],
  ["Passata di pomodoro", "Pomodori pelati", "Concentrato di pomodoro"],
  ["Spaghetti", "Tagliatelle secche", "Pasta fresca all'uovo"],
  ["Penne", "Orecchiette"],
  ["Ceci in scatola", "Fagioli in scatola", "Lenticchie secche", "Ceci secchi"],
  ["Riso", "Riso per risotti", "Farro", "Orzo perlato", "Cous cous", "Polenta"],
  ["Piselli surgelati", "Verdure miste surgelate", "Spinaci surgelati", "Spinaci in cubetti"],
  ["Olive verdi", "Olive nere", "Capperi"],
  ["Pane comune", "Pane in cassetta", "Focaccia", "Piadine", "Pane carasau"],
  ["Aranciata", "Cola", "Tè freddo"],
  ["Aceto balsamico", "Aceto di vino"],
  ["Cipolle", "Cipollotto", "Porri"],
  ["Zucchine", "Melanzane"],
  ["Yogurt bianco", "Yogurt greco"],
  ["Latte fresco", "Latte a lunga conservazione"],
];

const INDICE: Map<string, string[]> = new Map();
for (const gruppo of GRUPPI_SOSTITUZIONE) {
  for (const nome of gruppo) {
    INDICE.set(nome.toLowerCase(), gruppo);
  }
}

/** Returns up to three alternatives for an ingredient, or none if it is not in a curated group. */
export function findAlternatives(nome: string): string[] {
  const gruppo = INDICE.get(nome.trim().toLowerCase());
  if (!gruppo) return [];
  return gruppo.filter((n) => n.toLowerCase() !== nome.trim().toLowerCase()).slice(0, 3);
}
