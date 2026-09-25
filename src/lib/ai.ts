import { z } from "zod";

const GeneratedDishSchema = z.object({
  nome: z.string(),
  procedimento: z.array(z.string()),
  porzioni: z.number(),
  minuti: z.number().optional(),
  // Do not send "ingredientiPosseduti": only the app knows what is available from the user's
  // selection. AI must not decide this, as it could invent claims such as "you already have oil".
  ingredientiDaComprare: z.array(z.object({ nome: z.string(), quantita: z.string() })),
  verificatoSenzaNoci: z.literal(true),
});
export type GeneratedDish = z.infer<typeof GeneratedDishSchema>;

const GeneratedDishWithIdSchema = GeneratedDishSchema.extend({ id: z.string() });
const WeekResponseSchema = z.object({ piatti: z.array(GeneratedDishWithIdSchema) });

const DepartmentClassificationResponseSchema = z.object({
  assegnazioni: z.array(z.object({ nome: z.string(), reparto: z.string() })),
});

const NETLIFY_FUNCTIONS_BASE = "/.netlify/functions";

async function callProxy(corpo: Record<string, unknown>): Promise<unknown> {
  const risposta = await fetch(`${NETLIFY_FUNCTIONS_BASE}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!risposta.ok) {
    const dati = await risposta.json().catch(() => ({}));
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
