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
  }),
  z.object({
    azione: z.literal("suggerisciAlternative"),
    nomeIngrediente: z.string(),
    contestoPiatto: z.string().default(""),
    vincoli: z.array(z.string()).default([]),
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

async function chiamaGemini(prompt: string, responseSchema: object): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: { parts: [{ text: `${SISTEMA_BASE}\n\n${prompt}` }] },
    config: {
      responseMimeType: "application/json",
      responseSchema,
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

async function suggerisciAlternative(input: Extract<Richiesta, { azione: "suggerisciAlternative" }>) {
  const prompt =
    `L'ingrediente "${input.nomeIngrediente}" non è disponibile al banco. ` +
    `Contesto: ${input.contestoPiatto || "nessuno"}. Vincoli: ${input.vincoli.join(", ") || "nessuno"}.\n` +
    "Suggerisci 3 alternative equivalenti in cucina italiana, brevi (2-4 parole ciascuna).";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      alternative: { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: "3" },
    },
    required: ["alternative"],
  };

  const grezzo = await chiamaGemini(prompt, responseSchema);
  const parsed = z.object({ alternative: z.array(z.string()) }).parse(grezzo);
  return { alternative: parsed.alternative.filter((a) => !contieneFruttaAGuscio(a)) };
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
    const risultato =
      parsed.data.azione === "generaPiatto"
        ? await generaPiatto(parsed.data)
        : await suggerisciAlternative(parsed.data);
    return { statusCode: 200, body: JSON.stringify(risultato) };
  } catch (errore) {
    console.error("ai function error:", errore);
    return {
      statusCode: 502,
      body: JSON.stringify({ errore: errore instanceof Error ? errore.message : "Errore sconosciuto." }),
    };
  }
};
