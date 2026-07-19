import { z } from "zod";

const PiattoGeneratoSchema = z.object({
  nome: z.string(),
  procedimento: z.array(z.string()),
  porzioni: z.number(),
  minuti: z.number().optional(),
  // Niente "ingredientiPosseduti": ciò che è già disponibile lo sa solo l'app, dalla selezione
  // dell'utente — non va mai fatto decidere all'AI (rischio di invenzioni tipo "hai già l'olio").
  ingredientiDaComprare: z.array(z.object({ nome: z.string(), quantita: z.string() })),
  verificatoSenzaNoci: z.literal(true),
});
export type PiattoGenerato = z.infer<typeof PiattoGeneratoSchema>;

const NETLIFY_FUNCTIONS_BASE = "/.netlify/functions";

async function chiamaProxy(corpo: Record<string, unknown>): Promise<unknown> {
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

export async function generaPiatto(input: {
  ingredienti: string[];
  vincoli: string[];
  porzioni: number;
  pasto: "pranzo" | "cena";
}): Promise<PiattoGenerato> {
  const dati = await chiamaProxy({ azione: "generaPiatto", ...input });
  return PiattoGeneratoSchema.parse(dati);
}

export async function suggerisciAlternative(input: {
  nomeIngrediente: string;
  contestoPiatto: string;
  vincoli: string[];
}): Promise<string[]> {
  const dati = await chiamaProxy({ azione: "suggerisciAlternative", ...input });
  const parsed = z.object({ alternative: z.array(z.string()) }).parse(dati);
  return parsed.alternative;
}
