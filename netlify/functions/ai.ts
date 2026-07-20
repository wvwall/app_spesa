import type { Handler } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

/** Proxy AI stateless (ANALISI.md §5.1/§5.4): nessun database, nessun dato utente.
 * Stesso pattern Netlify Function + Gemini del progetto dude_images_generator. */

const apiKey = process.env.GEMINI_API_KEY || "";
const MODEL = "gemini-2.5-flash";

/** Doppia barriera anti-noci (DESIGN.md §8.6): il prompt di sistema esclude la frutta a guscio,
 * e in più ogni output viene scansionato con questa blocklist prima di essere restituito. */
const BLOCKLIST_FRUTTA_A_GUSCIO = [
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
];

function contieneFruttaAGuscio(testo: string): boolean {
  const normalizzato = testo.toLowerCase();
  return BLOCKLIST_FRUTTA_A_GUSCIO.some((termine) => normalizzato.includes(termine));
}

const SISTEMA_BASE =
  "Sei un assistente che propone piatti di cucina italiana/mediterranea, di stagione, in italiano. " +
  "Vincolo assoluto e non negoziabile: NON includere mai noci, nocciole, mandorle, pistacchi, anacardi, " +
  "pinoli né alcuna frutta a guscio, in nessuna forma (anche tracce in salse, pesti o dolci) — " +
  "in famiglia c'è un'allergia. Se un ingrediente selezionato dall'utente contiene frutta a guscio, ignoralo. " +
  "Rispondi SOLO con il JSON richiesto.";

const RichiestaSchema = z.discriminatedUnion("azione", [
  z.object({
    azione: z.literal("generaPiatto"),
    ingredienti: z.array(z.string()).default([]),
    vincoli: z.array(z.string()).default([]),
    porzioni: z.number().int().positive().default(4),
    pasto: z.enum(["pranzo", "cena"]).default("cena"),
    // Piatti già scelti per altri pasti della settimana corrente: evita di riproporli uguali.
    evitaPiatti: z.array(z.string()).default([]),
  }),
  // Un'unica chiamata per tutti i pasti vuoti della settimana: generarli con N chiamate
  // indipendenti (stesso prompt generico ripetuto) fa convergere il modello sempre sugli
  // stessi piatti. Con un'unica chiamata il modello vede l'intero elenco e può variare davvero.
  z.object({
    azione: z.literal("generaSettimana"),
    pasti: z.array(z.object({ id: z.string(), pasto: z.enum(["pranzo", "cena"]) })).min(1).max(20),
    vincoli: z.array(z.string()).default([]),
    porzioni: z.number().int().positive().default(4),
  }),
]);
type Richiesta = z.infer<typeof RichiestaSchema>;

const PiattoGeneratoSchema = z.object({
  nome: z.string(),
  procedimento: z.array(z.string()).max(6),
  porzioni: z.number(),
  minuti: z.number().optional(),
  ingredientiDaComprare: z.array(z.object({ nome: z.string(), quantita: z.string() })),
});
const PiattoGeneratoConIdSchema = PiattoGeneratoSchema.extend({ id: z.string() });
const RispostaSettimanaSchema = z.object({ piatti: z.array(PiattoGeneratoConIdSchema) });

async function chiamaGemini(prompt: string, responseSchema: object): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: { parts: [{ text: `${SISTEMA_BASE}\n\n${prompt}` }] },
    config: {
      responseMimeType: "application/json",
      responseSchema,
      // Più alta del default: con lo stesso prompt ripetuto per più pasti (rigenerazione
      // di un singolo slot) riduce la tendenza del modello a ripetere sempre gli stessi piatti.
      temperature: 1.3,
    },
  });
  const testo = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!testo) {
    throw new Error("La risposta AI è vuota.");
  }
  return JSON.parse(testo);
}

async function generaPiatto(input: Extract<Richiesta, { azione: "generaPiatto" }>) {
  const vincoliTesto = input.vincoli.length ? input.vincoli.join(", ") : "nessuno";
  const prompt =
    `Ingredienti già disponibili (forniti dall'utente, NON elencarli come da comprare): ` +
    `${input.ingredienti.join(", ") || "nessuno, scegli tu liberamente il piatto"}.\n` +
    `Pasto: ${input.pasto}. Porzioni: ${input.porzioni}. Altri vincoli: ${vincoliTesto}.\n` +
    (input.evitaPiatti.length
      ? `Piatti già scelti per altri pasti di questa settimana, NON riproporre questi né varianti troppo simili: ${input.evitaPiatti.join(", ")}.\n`
      : "") +
    "Proponi UN piatto che usi il più possibile gli ingredienti disponibili. In 'ingredientiDaComprare' elenca " +
    "SOLO ciò che la ricetta richiede oltre a quelli già disponibili (comprese eventuali spezie, condimenti o " +
    "altro che dai per scontato: se non è nell'elenco dei disponibili, va comprato), con quantità.";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      nome: { type: Type.STRING },
      procedimento: { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: "6" },
      porzioni: { type: Type.NUMBER },
      minuti: { type: Type.NUMBER },
      ingredientiDaComprare: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { nome: { type: Type.STRING }, quantita: { type: Type.STRING } },
          required: ["nome", "quantita"],
        },
      },
    },
    required: ["nome", "procedimento", "porzioni", "ingredientiDaComprare"],
  };

  const massimoTentativi = 2;
  for (let tentativo = 0; tentativo < massimoTentativi; tentativo++) {
    const grezzo = await chiamaGemini(prompt, responseSchema);
    const piatto = PiattoGeneratoSchema.parse(grezzo);
    const testoCompleto = [
      piatto.nome,
      ...piatto.procedimento,
      ...piatto.ingredientiDaComprare.map((i) => i.nome),
    ].join(" ");
    if (!contieneFruttaAGuscio(testoCompleto)) {
      return { ...piatto, verificatoSenzaNoci: true as const };
    }
  }
  throw new Error("Non sono riuscito a generare un piatto che rispetti il vincolo senza noci. Componilo a mano.");
}

async function generaSettimana(input: Extract<Richiesta, { azione: "generaSettimana" }>) {
  const vincoliTesto = input.vincoli.length ? input.vincoli.join(", ") : "nessuno";
  const elencoPasti = input.pasti.map((p) => `- id "${p.id}": ${p.pasto}`).join("\n");
  const prompt =
    `Proponi un piatto per ciascuno di questi pasti della settimana, uno per riga (usa esattamente ` +
    `gli id indicati, senza inventarne altri o ometterne):\n${elencoPasti}\n` +
    `Porzioni: ${input.porzioni}. Altri vincoli: ${vincoliTesto}.\n` +
    "Varia il più possibile tra un pasto e l'altro: alterna proteine principali (carne, pesce, legumi, " +
    "uova, formaggi), tipi di preparazione (primo, secondo, piatto unico) e metodi di cottura. Non " +
    "riproporre mai lo stesso piatto due volte nella settimana. In 'ingredientiDaComprare' elenca tutti " +
    "gli ingredienti richiesti da ciascuna ricetta, comprese spezie e condimenti, con quantità.";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      piatti: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            nome: { type: Type.STRING },
            procedimento: { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: "6" },
            porzioni: { type: Type.NUMBER },
            minuti: { type: Type.NUMBER },
            ingredientiDaComprare: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { nome: { type: Type.STRING }, quantita: { type: Type.STRING } },
                required: ["nome", "quantita"],
              },
            },
          },
          required: ["id", "nome", "procedimento", "porzioni", "ingredientiDaComprare"],
        },
      },
    },
    required: ["piatti"],
  };

  const massimoTentativi = 2;
  for (let tentativo = 0; tentativo < massimoTentativi; tentativo++) {
    const grezzo = await chiamaGemini(prompt, responseSchema);
    const risposta = RispostaSettimanaSchema.parse(grezzo);
    const idRichiesti = new Set(input.pasti.map((p) => p.id));
    const piatti = risposta.piatti.filter((p) => idRichiesti.has(p.id));
    const testoCompleto = piatti
      .map((p) => [p.nome, ...p.procedimento, ...p.ingredientiDaComprare.map((i) => i.nome)].join(" "))
      .join(" ");
    if (!contieneFruttaAGuscio(testoCompleto)) {
      return piatti.map((p) => ({ ...p, verificatoSenzaNoci: true as const }));
    }
  }
  throw new Error("Non sono riuscito a generare la settimana rispettando il vincolo senza noci. Riprova.");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ errore: "Metodo non consentito." }) };
  }
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ errore: "GEMINI_API_KEY non configurata sul server." }) };
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ errore: "JSON non valido." }) };
  }

  const parsed = RichiestaSchema.safeParse(corpo);
  if (!parsed.success) {
    return { statusCode: 400, body: JSON.stringify({ errore: "Richiesta non valida." }) };
  }

  try {
    if (parsed.data.azione === "generaSettimana") {
      const piatti = await generaSettimana(parsed.data);
      return { statusCode: 200, body: JSON.stringify({ piatti }) };
    }
    const risultato = await generaPiatto(parsed.data);
    return { statusCode: 200, body: JSON.stringify(risultato) };
  } catch (errore) {
    console.error("ai function error:", errore);
    return {
      statusCode: 502,
      body: JSON.stringify({ errore: errore instanceof Error ? errore.message : "Errore sconosciuto." }),
    };
  }
};
