import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Sparkles } from "lucide-react";
import { getOrCreateProfile } from "../../lib/database";
import { generateDish, GeminiApiKeyRequiredError, type GeneratedDish } from "../../lib/ai";
import { addIngredient, saveGeneratedDish } from "../../lib/dishes";
import { groupByDepartment } from "../../lib/departments";
import type { Ingredient } from "../../lib/models";
import { BottomSheet } from "../navigation/BottomSheet";
import { Button } from "../core/Button";
import { Chip } from "../core/Chip";
import { SearchInput } from "../core/SearchInput";
import { ProposalCard } from "./ProposalCard";
import { GeminiKeySheet } from "../ai/GeminiKeySheet";
import { DishEditor } from "./DishEditor";

interface Props {
  open: boolean;
  catalogo: Ingredient[];
  reparti: string[];
  porzioniDefault: number;
  onClose: () => void;
  /** Called with the new dish id (generated or composed). */
  onCreated: (piattoId: string) => void;
}

/** "+" in Piatti: pick ingredients from the catalog, then Genera (AI) or Componi (by hand).
 * The selection and the two actions stay pinned at the bottom of the sheet. */
export function NewDishSheet({ open, catalogo, reparti, porzioniDefault, onClose, onCreated }: Props) {
  const [query, setQuery] = useState("");
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [espansi, setEspansi] = useState<Set<string>>(new Set());
  const [generato, setGenerato] = useState<GeneratedDish | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [componendo, setComponendo] = useState(false);
  const [richiestaChiave, setRichiestaChiave] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelezionati([]);
      setEspansi(new Set());
      setGenerato(null);
      setErrore(null);
      setComponendo(false);
    }
  }, [open]);

  const attivi = catalogo.filter((i) => !i.deletedAt);
  const testo = query.trim().toLowerCase();
  const filtrati = attivi.filter(
    (i) => !testo || i.nome.toLowerCase().includes(testo) || i.alias.some((a) => a.toLowerCase().includes(testo)),
  );
  const esatto = attivi.some((i) => i.nome.toLowerCase() === testo);
  const scelti = selezionati
    .map((id) => attivi.find((i) => i.id === id))
    .filter((i): i is Ingredient => Boolean(i));

  function toggle(id: string) {
    setSelezionati((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function genera() {
    setCaricamento(true);
    setErrore(null);
    try {
      const profilo = await getOrCreateProfile();
      setGenerato(
        await generateDish({
          ingredienti: scelti.map((i) => i.nome),
          vincoli: profilo.vincoliAlimentari,
          porzioni: profilo.porzioniDefault,
          pasto: "cena",
        }),
      );
    } catch (e) {
      if (e instanceof GeminiApiKeyRequiredError) {
        setRichiestaChiave(true);
        return;
      }
      setErrore(e instanceof Error ? e.message : "Il piatto non è arrivato. Riprova o componilo a mano.");
    } finally {
      setCaricamento(false);
    }
  }

  async function salvaGenerato() {
    if (!generato) return;
    const id = await saveGeneratedDish(generato, scelti, attivi);
    onCreated(id);
  }

  return (
    <>
      <BottomSheet
        open={open}
        title={componendo ? "Nuovo piatto" : "Nuovo piatto"}
        intro={componendo ? undefined : "Scegli gli ingredienti che hai: l’AI propone un piatto, oppure lo componi tu."}
        onClose={onClose}
        style={{ zIndex: 40, maxHeight: "92dvh", overflowY: "auto", paddingBottom: 0 }}>
        {componendo ? (
          <div style={{ paddingBottom: 24 }}>
            <DishEditor
              preselezionati={scelti}
              catalogo={attivi}
              porzioniDefault={porzioniDefault}
              onCancel={() => setComponendo(false)}
              onSaved={onCreated}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SearchInput placeholder="Cerca o aggiungi un ingrediente…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {generato && (
              <ProposalCard
                title={generato.nome}
                meta={`${generato.minuti ? generato.minuti + " min · " : ""}${generato.porzioni} porzioni`}
                have={scelti.length > 0 ? scelti.map((i) => i.nome).join(", ") : "nessuno"}
                buy={generato.ingredientiDaComprare.map((i) => `${i.nome} ${i.quantita}`).join(", ")}
                allergieVerificate={generato.allergieVerificate}
                allergieNonVerificate={generato.allergieNonVerificate}
                onAccept={() => void salvaGenerato()}
                onRegenerate={() => void genera()}
              />
            )}
            {errore && <p style={{ color: "var(--pomodoro)", fontSize: 13 }}>{errore}</p>}
            {groupByDepartment(filtrati, reparti).map(({ reparto, voci }) => {
              const espanso = testo !== "" || espansi.has(reparto);
              const n = voci.filter((i) => selezionati.includes(i.id)).length;
              return (
                <section key={reparto}>
                  <button
                    type="button"
                    onClick={() =>
                      setEspansi((s) => {
                        const nuovo = new Set(s);
                        if (nuovo.has(reparto)) nuovo.delete(reparto);
                        else nuovo.add(reparto);
                        return nuovo;
                      })
                    }
                    className="flex items-center gap-2 w-full text-left mb-2"
                    style={{ letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", minHeight: 28 }}>
                    {espanso ? <ChevronDown size={15} strokeWidth={2.25} /> : <ChevronRight size={15} strokeWidth={2.25} />}
                    <span>{reparto}</span>
                    <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                      ({voci.length}
                      {n > 0 ? ` · ${n} scelti` : ""})
                    </span>
                  </button>
                  {espanso && (
                    <div className="flex flex-wrap gap-2">
                      {voci.map((ing) => (
                        <Chip key={ing.id} state={selezionati.includes(ing.id) ? "selected" : "default"} onClick={() => toggle(ing.id)}>
                          {ing.nome}
                        </Chip>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {testo !== "" && !esatto && (
              <AddIngredientInline
                query={query.trim()}
                reparti={reparti}
                onConferma={async (reparto) => {
                  const ing = await addIngredient({ nome: query.trim(), reparto });
                  setSelezionati((s) => [...s, ing.id]);
                  setQuery("");
                }}
              />
            )}

            {/* Pinned selection: chosen ingredients (tap to remove) and the two actions. */}
            <div
              className="flex flex-col gap-2"
              style={{
                position: "sticky",
                bottom: 0,
                margin: "4px -20px 0",
                padding: "12px 20px max(16px, env(safe-area-inset-bottom))",
                background: "var(--surface-page)",
                borderTop: "1px solid var(--border-quiet)",
              }}>
              {scelti.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, textAlign: "center" }}>
                  Nessun ingrediente scelto: l’AI sceglie liberamente.
                </p>
              ) : (
                <div className="flex gap-1.5 overflow-x-auto" style={{ paddingBottom: 2 }}>
                  {scelti.map((i) => (
                    <Chip key={i.id} state="selected" aria-label={`Togli ${i.nome}`} onClick={() => toggle(i.id)} style={{ flex: "none" }}>
                      {i.nome} ×
                    </Chip>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => void genera()} disabled={caricamento}>
                  {caricamento ? (
                    "Ci penso…"
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles size={15} strokeWidth={2} /> Genera
                    </span>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setComponendo(true)}>
                  Componi
                </Button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
      <GeminiKeySheet
        open={richiestaChiave}
        onClose={() => setRichiestaChiave(false)}
        onSaved={() => {
          setRichiestaChiave(false);
          void genera();
        }}
      />
    </>
  );
}

function AddIngredientInline({ query, reparti, onConferma }: { query: string; reparti: string[]; onConferma: (reparto: string) => void }) {
  const [scelto, setScelto] = useState(reparti[0] ?? "Dispensa");
  return (
    <div className="flex flex-col gap-2 border rounded-2xl p-3" style={{ borderColor: "var(--biro)", background: "var(--surface-card)" }}>
      <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: 0 }}>“{query}” non è nel catalogo. Scegli il reparto per aggiungerlo:</p>
      <div className="flex flex-wrap gap-2">
        {reparti.map((r) => (
          <Chip key={r} state={scelto === r ? "selected" : "default"} onClick={() => setScelto(r)}>
            {r}
          </Chip>
        ))}
      </div>
      <Button onClick={() => onConferma(scelto)}>
        <span className="inline-flex items-center gap-1.5">
          <Plus size={15} strokeWidth={2.25} /> Aggiungi “{query}”
        </span>
      </Button>
    </div>
  );
}
