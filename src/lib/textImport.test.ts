import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMealText, parseShoppingText, splitUnitFromNote, joinUnitAndNote } from "./textImport.ts";
import { cycleDays, mealsForDay, toIsoDate } from "./calendar.ts";
import { SEED_INGREDIENTS } from "../seed/ingredients.ts";

const TESTO_ESEMPIO = `Spesa
Venerdì cena: affettati e formaggi 
Sabato pranzo: spinaci e uova 
Sabato cena: noodles al cipollotto 
Domenica pranzo: gamberi e cavolo cappuccio 
Lunedì pranzo: polipo e insalata 
Lunedì cena: zuppa di farro
Martedì pranzo: insalata 
Mercoledì pranzo: insalata 
Mercoledì cena (Walter):
Giovedì pranzo: tonno e ceci 
Venerdì pranzo: insalata 

4 uova
1 confezione di spinaci 
1 confezione di cipollotto 
2 confezioni di gamberi
1 confezione di cavolo cappuccio (già tagliato) 
1 confezione di polipo
1 confezione di insalata lattughino
1 confezione di ceci (da 3 piccoline)
1 confezione di soffritto 
1 avocado
1 confezione di pomodorini 
5 yogurt (+ Walter)
1 confezione di latte di avena
1 confezione di latte 
1 coca zero
2 confezioni di acqua 
5 mele
5 prugne 
1 confezione di Danacol 
5 pappe Mimmo
1 detersivo lavatrice
`;

const GIORNI = cycleDays(new Date(2026, 10, 6)); // Friday 6 November 2026.
const SLOT = GIORNI.flatMap((giorno, indice) =>
  mealsForDay(indice, GIORNI.length).map((pasto) => ({
    id: `${toIsoDate(giorno)}-${pasto}`,
    data: toIsoDate(giorno),
    pasto,
  })),
);

const CATALOGO = SEED_INGREDIENTS.map((ingrediente, indice) => ({
  ...ingrediente,
  id: `ing-${indice}`,
}));

const REPARTI = [
  "Ortofrutta",
  "Banco frigo",
  "Macelleria e pesce",
  "Surgelati",
  "Dispensa",
  "Forno",
  "Bevande",
  "Casa e igiene",
];

test("legge i pasti del ciclo e distingue i due venerdì", () => {
  const risultato = parseMealText(TESTO_ESEMPIO, SLOT);

  assert.equal(risultato.pasti.length, 11);
  assert.equal(risultato.senzaSlot.length, 0);

  const primoVenerdi = risultato.pasti.find((p) => p.dataIso === "2026-11-06" && p.pasto === "cena");
  assert.equal(primoVenerdi?.nome, "affettati e formaggi");

  const ultimoVenerdi = risultato.pasti.find((p) => p.dataIso === "2026-11-13" && p.pasto === "pranzo");
  assert.equal(ultimoVenerdi?.nome, "insalata");

  const cenaVuota = risultato.pasti.find((p) => p.dataIso === "2026-11-11" && p.pasto === "cena");
  assert.equal(cenaVuota?.nome, "");
});

test("legge gli ingredienti con quantità, note e reparto", () => {
  const risultato = parseShoppingText(TESTO_ESEMPIO, CATALOGO, REPARTI);

  assert.equal(risultato.righe.length, 21);
  assert.equal(risultato.ignorate.length, 0);

  const uova = risultato.righe[0];
  assert.equal(uova.nome, "uova");
  assert.equal(uova.quantita, "4");
  assert.equal(uova.reparto, "Banco frigo");

  const spinaci = risultato.righe[1];
  assert.equal(spinaci.nome, "spinaci");
  assert.equal(spinaci.quantita, "1");
  assert.equal(spinaci.nota, "confezione");
  assert.equal(spinaci.reparto, "Ortofrutta");

  const gamberi = risultato.righe.find((r) => r.nome === "gamberi");
  assert.equal(gamberi?.quantita, "2");
  assert.equal(gamberi?.nota, "confezioni");

  const cavolo = risultato.righe.find((r) => r.nome === "cavolo cappuccio");
  assert.equal(cavolo?.nota, "confezione · già tagliato");
  assert.equal(cavolo?.reparto, "Ortofrutta");

  const ceci = risultato.righe.find((r) => r.nome === "ceci");
  assert.equal(ceci?.nota, "confezione · da 3 piccoline");
  assert.equal(ceci?.reparto, "Dispensa");

  const yogurt = risultato.righe.find((r) => r.nome === "yogurt");
  assert.equal(yogurt?.quantita, "5");
  assert.equal(yogurt?.nota, "+ Walter");
  assert.equal(yogurt?.reparto, "Banco frigo");

  const latteAvena = risultato.righe.find((r) => r.nome === "latte di avena");
  assert.equal(latteAvena?.reparto, "Bevande");

  const latte = risultato.righe.find((r) => r.nome === "latte");
  assert.equal(latte?.reparto, "Banco frigo");

  const detersivo = risultato.righe.find((r) => r.nome === "detersivo lavatrice");
  assert.equal(detersivo?.reparto, "Casa e igiene");
});

test("ignora le righe dei pasti quando importa la spesa", () => {
  const risultato = parseShoppingText(
    "Sabato pranzo: spinaci e uova\nSpesa\n1 confezione di spinaci",
    CATALOGO,
    REPARTI,
  );

  assert.equal(risultato.righe.length, 1);
  assert.equal(risultato.righe[0].nome, "spinaci");
});

test("separa l'unità dalla nota per mostrarla accanto alla quantità", () => {
  assert.deepEqual(splitUnitFromNote("kg"), { unita: "kg", nota: undefined });
  assert.deepEqual(splitUnitFromNote("confezione · già tagliato"), {
    unita: "confezione",
    nota: "già tagliato",
  });
  assert.deepEqual(splitUnitFromNote("quella in vetro"), { nota: "quella in vetro" });
  assert.deepEqual(splitUnitFromNote("+ Walter"), { nota: "+ Walter" });
  assert.deepEqual(splitUnitFromNote(undefined), {});
});

test("ricompone unità e nota nel campo nota", () => {
  assert.equal(joinUnitAndNote("kg", "quella in vetro"), "kg · quella in vetro");
  assert.equal(joinUnitAndNote("  ", "solo nota"), "solo nota");
  assert.equal(joinUnitAndNote("g", ""), "g");
  assert.equal(joinUnitAndNote(undefined, undefined), undefined);
  assert.deepEqual(splitUnitFromNote(joinUnitAndNote("confezione", "già tagliato")), {
    unita: "confezione",
    nota: "già tagliato",
  });
});
