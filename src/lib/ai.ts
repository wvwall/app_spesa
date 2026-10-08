import { z } from "zod";
import { getGeminiApiKey, hasLocalGeminiFallback } from "./aiSettings";

export class GeminiApiKeyRequiredError extends Error {
  constructor() {
    super("Per usare Google Gemini, inserisci la tua chiave API.");
    this.name = "GeminiApiKeyRequiredError";
  }
}

const GeneratedDishSchema = z.object({
  nome: z.string(),
  procedimento: z.array(z.string()),
  porzioni: z.number(),
  minuti: z.number().optional(),
  // Do not send "ingredientiPosseduti": only the app knows what is available from the user's
  // selection. AI must not decide this, as it could invent claims such as "you already have oil".
  ingredientiDaComprare: z.array(z.object({ nome: z.string(), quantita: z.string() })),
  // Etichette degli allergeni controllati e superati, e vincoli non riconosciuti che l'app non
  // può verificare automaticamente (vedi src/lib/allergens.ts).
  allergieVerificate: z.array(z.string()),
  allergieNonVerificate: z.array(z.string()),
});
export type GeneratedDish = z.infer<typeof GeneratedDishSchema>;

const GeneratedDishWithIdSchema = GeneratedDishSchema.extend({ id: z.string() });
const WeekResponseSchema = z.object({ piatti: z.array(GeneratedDishWithIdSchema) });

const DepartmentClassificationResponseSchema = z.object({
  assegnazioni: z.array(z.object({ nome: z.string(), reparto: z.string() })),
});

const NETLIFY_FUNCTIONS_BASE = "/.netlify/functions";

async function callProxy(corpo: Record<string, unknown>): Promise<unknown> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey && !(await hasLocalGeminiFallback())) throw new GeminiApiKeyRequiredError();
  const risposta = await fetch(`${NETLIFY_FUNCTIONS_BASE}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...corpo, ...(apiKey ? { apiKey } : {}) }),
  });
  if (!risposta.ok) {
    const dati = await risposta.json().catch(() => ({}));
    if (dati.codice === "GEMINI_API_KEY_REQUIRED") throw new GeminiApiKeyRequiredError();
    throw new Error(dati.errore ?? "Il piatto non è arrivato. Riprova o componilo a mano.");
  }
  return risposta.json();
}

export async function generateDish(input: {
  ingredienti: string[];
  vincoli: string[];
  porzioni: number;
  pasto: "pranzo" | "cena";
  evitaPiatti?: string[];
}): Promise<GeneratedDish> {
  const dati = await callProxy({ azione: "generaPiatto", ...input });
  return GeneratedDishSchema.parse(dati);
}

export async function generateWeek(input: {
  pasti: { id: string; pasto: "pranzo" | "cena" }[];
  vincoli: string[];
  porzioni: number;
}): Promise<{ id: string; generato: GeneratedDish }[]> {
  const dati = await callProxy({ azione: "generaSettimana", ...input });
  const risposta = WeekResponseSchema.parse(dati);
  return risposta.piatti.map(({ id, ...generato }) => ({ id, generato }));
}

/** Classifies each ingredient into one of the app's `reparti`. Used as a fallback for items
 * that the local catalog cannot identify (see sortListByDepartment in shoppingList.ts). */
export async function classifyDepartments(input: {
  ingredienti: string[];
  reparti: string[];
}): Promise<{ nome: string; reparto: string }[]> {
  const dati = await callProxy({ azione: "classificaReparti", ...input });
  return DepartmentClassificationResponseSchema.parse(dati).assegnazioni;
}
