import type { Handler } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

/** Stateless AI proxy (ANALISI.md §5.1/§5.4): no database and no user data.
 * Uses the same Netlify Function + Gemini pattern as the dude_images_generator project. */

const MODEL = "gemini-2.5-flash";
const HEADERS_NO_STORE = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(statusCode: number, body: unknown) {
  return { statusCode, headers: HEADERS_NO_STORE, body: JSON.stringify(body) };
}

/** Two-layer nut safety check (DESIGN.md §8.6): the system prompt excludes tree nuts, and each
 * response is also scanned against this blocklist before it is returned. */
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

const ApiKeySchema = z.string().trim().min(1).max(512).optional();

const RichiestaSchema = z.discriminatedUnion("azione", [
  z.object({
    azione: z.literal("stato"),
  }),
  z.object({
    azione: z.literal("generaPiatto"),
    apiKey: ApiKeySchema,
    ingredienti: z.array(z.string()).default([]),
    vincoli: z.array(z.string()).default([]),
    porzioni: z.number().int().positive().default(4),
    pasto: z.enum(["pranzo", "cena"]).default("cena"),
    // Dishes already selected for other meals in the current week; avoid proposing them again.
    evitaPiatti: z.array(z.string()).default([]),
  }),
  // Generate all empty meals in one request. Separate requests with the same generic prompt
  // tend to converge on the same dishes; one request gives the model the full list to vary.
  z.object({
    azione: z.literal("generaSettimana"),
    apiKey: ApiKeySchema,
    pasti: z.array(z.object({ id: z.string(), pasto: z.enum(["pranzo", "cena"]) })).min(1).max(20),
    vincoli: z.array(z.string()).default([]),
    porzioni: z.number().int().positive().default(4),
  }),
  // Classifies user-selected ingredients into the app's departments. This does not generate
  // food, so the nut restriction is not relevant; it only assigns a department label to a name.
  z.object({
    azione: z.literal("classificaReparti"),
    apiKey: ApiKeySchema,
    ingredienti: z.array(z.string()).min(1).max(60),
    reparti: z.array(z.string()).min(1).max(20),
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

const RispostaClassificaSchema = z.object({
  assegnazioni: z.array(z.object({ nome: z.string(), reparto: z.string() })),
});

const SISTEMA_CLASSIFICA =
  "Sei un assistente che classifica ingredienti della spesa nei reparti di un supermercato " +
  "italiano. Assegna a ciascun ingrediente uno solo dei reparti indicati, usando esattamente " +
  "quelle etichette. Rispondi SOLO con il JSON richiesto.";

async function chiamaGemini(
  apiKey: string,
  prompt: string,
  responseSchema: object,
  opzioni?: { temperature?: number; sistema?: string },
): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey });
  const sistema = opzioni?.sistema ?? SISTEMA_BASE;
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: { parts: [{ text: `${sistema}\n\n${prompt}` }] },
    config: {
      responseMimeType: "application/json",
      responseSchema,
      // The higher-than-usual 1.3 default reduces repeated dishes when the same prompt is reused
      // across meals, such as when regenerating one slot. Department classification uses 0.
      temperature: opzioni?.temperature ?? 1.3,
    },
  });
  const testo = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!testo) {
    throw new Error("La risposta AI è vuota.");
  }
  return JSON.parse(testo);
}

async function generaPiatto(input: Extract<Richiesta, { azione: "generaPiatto" }>, apiKey: string) {
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
    const grezzo = await chiamaGemini(apiKey, prompt, responseSchema);
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

async function generaSettimana(input: Extract<Richiesta, { azione: "generaSettimana" }>, apiKey: string) {
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
    const grezzo = await chiamaGemini(apiKey, prompt, responseSchema);
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

async function classificaReparti(input: Extract<Richiesta, { azione: "classificaReparti" }>, apiKey: string) {
  const reparti = input.reparti;
  // Match the app's fallback: "Dispensa" is the catch-all department (see shoppingList.ts/dishes.ts).
  const repartoRipiego = reparti.includes("Dispensa") ? "Dispensa" : reparti[reparti.length - 1];
  const prompt =
    `Assegna ogni ingrediente a UNO SOLO di questi reparti (usa esattamente queste etichette, ` +
    `senza inventarne altre): ${reparti.join(", ")}.\n` +
    `Se un ingrediente non rientra chiaramente in nessuno, usa "${repartoRipiego}".\n` +
    `Ingredienti:\n${input.ingredienti.map((n) => `- ${n}`).join("\n")}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      assegnazioni: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nome: { type: Type.STRING },
            reparto: { type: Type.STRING, enum: reparti },
          },
          required: ["nome", "reparto"],
        },
      },
    },
    required: ["assegnazioni"],
  };

  const grezzo = await chiamaGemini(apiKey, prompt, responseSchema, { temperature: 0, sistema: SISTEMA_CLASSIFICA });
  const parsed = RispostaClassificaSchema.parse(grezzo);
  // Defensive clamp: map any department outside the allowed list to the fallback.
  const consentiti = new Set(reparti);
  const assegnazioni = parsed.assegnazioni.map((a) => ({
    nome: a.nome,
    reparto: consentiti.has(a.reparto) ? a.reparto : repartoRipiego,
  }));
  return { assegnazioni };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { errore: "Metodo non consentito." });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { errore: "JSON non valido." });
  }

  const parsed = RichiestaSchema.safeParse(corpo);
  if (!parsed.success) {
    return jsonResponse(400, { errore: "Richiesta non valida." });
  }

  if (parsed.data.azione === "stato") {
    return jsonResponse(200, {
      ripiegoLocale: process.env.NETLIFY_DEV === "true" && Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
  }

  // Netlify CLI sets NETLIFY_DEV for local Function execution. Never fall back to a deploy
  // environment variable: production requests must use the user's own key from the POST body.
  const apiKey = parsed.data.apiKey || (process.env.NETLIFY_DEV === "true" ? process.env.GEMINI_API_KEY?.trim() : "") || "";
  if (!apiKey) {
    return jsonResponse(428, {
      codice: "GEMINI_API_KEY_REQUIRED",
      errore: "Per usare Google Gemini, inserisci la tua chiave API.",
    });
  }

  try {
    if (parsed.data.azione === "generaSettimana") {
      const piatti = await generaSettimana(parsed.data, apiKey);
      return jsonResponse(200, { piatti });
    }
    if (parsed.data.azione === "classificaReparti") {
      const risultato = await classificaReparti(parsed.data, apiKey);
      return jsonResponse(200, risultato);
    }
    const risultato = await generaPiatto(parsed.data, apiKey);
    return jsonResponse(200, risultato);
  } catch (errore) {
    // Do not log request bodies or provider error details: they may include user data or secrets.
    console.error("ai function error:", errore instanceof Error ? errore.name : "UnknownError");
    const messaggio = errore instanceof Error ? errore.message : "Errore sconosciuto.";
    return jsonResponse(502, { errore: messaggio.replaceAll(apiKey, "[redacted]") });
  }
};
