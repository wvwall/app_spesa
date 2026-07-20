/** Mappa locale di sostituzioni tra ingredienti simili: nessuna chiamata AI, nessuna rete,
 * risultato istantaneo e sempre disponibile offline (RF7). Gruppi curati a mano, non esaustivi:
 * un ingrediente non presente in nessun gruppo semplicemente non ha alternative suggerite. */
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

/** Fino a 3 alternative per l'ingrediente indicato, o nessuna se non è in un gruppo curato. */
export function trovaAlternative(nome: string): string[] {
  const gruppo = INDICE.get(nome.trim().toLowerCase());
  if (!gruppo) return [];
  return gruppo.filter((n) => n.toLowerCase() !== nome.trim().toLowerCase()).slice(0, 3);
}
