import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { db, getOrCreateProfilo, nowIso, nuovoId, REPARTI_DEFAULT } from "../lib/db";
import { generaPiatto, type PiattoGenerato } from "../lib/ai";
import { salvaPiattoGenerato } from "../lib/piatti";
import { Button, Chip, SearchInput, ProposalCard } from "../components";
import type { Ingrediente, Piatto } from "../lib/types";

export function Piatti() {
  const ingredienti = useLiveQuery(() => db.ingredienti.toArray(), []) ?? [];
  const piatti = useLiveQuery(() => db.piatti.toArray(), []) ?? [];
  const profilo = useLiveQuery(() => getOrCreateProfilo(), []);

  const [query, setQuery] = useState("");
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [repartiEspansi, setRepartiEspansi] = useState<Set<string>>(new Set());

  const [generato, setGenerato] = useState<PiattoGenerato | null>(null);
  const [caricamentoAI, setCaricamentoAI] = useState(false);
  const [erroreAI, setErroreAI] = useState<string | null>(null);
  const [componendo, setComponendo] = useState(false);

  const testoRicerca = query.trim().toLowerCase();
  const filtrati = ingredienti.filter((i) => {
    if (!testoRicerca) return true;
    return i.nome.toLowerCase().includes(testoRicerca) || i.alias.some((a) => a.toLowerCase().includes(testoRicerca));
  });
  const corrispondenzaEsatta = ingredienti.some((i) => i.nome.toLowerCase() === testoRicerca);

  const perReparto = new Map<string, Ingrediente[]>();
  for (const i of filtrati) {
    const arr = perReparto.get(i.reparto) ?? [];
    arr.push(i);
    perReparto.set(i.reparto, arr);
  }
  const ordine = profilo?.ordineReparti ?? REPARTI_DEFAULT;
  const reparti = [...perReparto.keys()].sort((a, b) => {
    const ia = ordine.indexOf(a);
    const ib = ordine.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const nomiSelezionati = ingredienti.filter((i) => selezionati.includes(i.id)).map((i) => i.nome);

  function toggleSelezionato(id: string) {
    setSelezionati((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  }

  function toggleReparto(reparto: string) {
    setRepartiEspansi((set) => {
      const nuovo = new Set(set);
      if (nuovo.has(reparto)) nuovo.delete(reparto);
      else nuovo.add(reparto);
      return nuovo;
    });
  }

  async function aggiungiIngredienteAlVolo(reparto: string) {
    const id = nuovoId();
    const nuovo: Ingrediente = {
      id,
      nome: query.trim(),
      reparto,
      unitaDefault: "1 pz",
      alias: [],
      origine: "utente",
      updatedAt: nowIso(),
    };
    await db.ingredienti.add(nuovo);
    setSelezionati((sel) => [...sel, id]);
    setQuery("");
  }

  async function generaConAI() {
    setCaricamentoAI(true);
    setErroreAI(null);
    try {
      const profiloAttuale = await getOrCreateProfilo();
      const piatto = await generaPiatto({
        ingredienti: nomiSelezionati,
        vincoli: profiloAttuale.vincoliAlimentari,
        porzioni: profiloAttuale.porzioniDefault,
        pasto: "cena",
      });
      setGenerato(piatto);
    } catch (e) {
      setErroreAI(e instanceof Error ? e.message : "Il piatto non è arrivato. Riprova o componilo a mano.");
    } finally {
      setCaricamentoAI(false);
    }
  }

  async function salvaGenerato() {
    if (!generato) return;
    await salvaPiattoGenerato(generato, ingredienti.filter((i) => selezionati.includes(i.id)), ingredienti);
    setGenerato(null);
    setSelezionati([]);
  }

  async function eliminaPiatto(piattoId: string) {
    await db.transaction("rw", db.piatti, db.piattoIngredienti, db.slot, async () => {
      await db.piatti.delete(piattoId);
      const suoiIngredienti = await db.piattoIngredienti.where("piattoId").equals(piattoId).toArray();
      await db.piattoIngredienti.bulkDelete(suoiIngredienti.map((i) => i.id));
      const tuttiSlot = await db.slot.toArray();
      for (const slot of tuttiSlot.filter((s) => s.piattoId === piattoId)) {
        // eslint-disable-next-line no-await-in-loop
        await db.slot.update(slot.id, { piattoId: undefined });
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-5 pb-3 flex-none">
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Piatti</h1>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8 flex flex-col gap-4">
        <SearchInput placeholder="Cerca o aggiungi un ingrediente…" value={query} onChange={(e) => setQuery(e.target.value)} />

        {reparti.map((reparto) => (
          <RepartoCollassabile
            key={reparto}
            nome={reparto}
            ingredienti={perReparto.get(reparto) ?? []}
            espanso={testoRicerca !== "" || repartiEspansi.has(reparto)}
            onToggle={() => toggleReparto(reparto)}
            selezionati={selezionati}
            onToggleIngrediente={toggleSelezionato}
          />
        ))}

        {testoRicerca !== "" && !corrispondenzaEsatta && (
          <AggiungiIngredienteInline query={query.trim()} reparti={ordine} onConferma={aggiungiIngredienteAlVolo} />
        )}

        <section className="border-t pt-4" style={{ borderColor: "var(--quadretto)" }}>
          <Etichetta>
            {selezionati.length > 0 ? `Con ${selezionati.length} ingredienti selezionati` : "Nessun ingrediente selezionato"}
          </Etichetta>
          <div className="flex gap-2 mb-2">
            <Button onClick={() => void generaConAI()} disabled={caricamentoAI}>
              {caricamentoAI ? (
                "Sto pensando a un piatto…"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles size={15} strokeWidth={2} /> Genera con AI
                </span>
              )}
            </Button>
            <Button variant="ghost" onClick={() => setComponendo(true)} disabled={selezionati.length === 0}>
              Componi piatto
            </Button>
          </div>
          {erroreAI && <p style={{ color: "var(--pomodoro)", fontSize: 13 }}>{erroreAI}</p>}
          {generato && (
            <ProposalCard
              title={generato.nome}
              meta={`${generato.minuti ? generato.minuti + " min · " : ""}${generato.porzioni} porzioni`}
              have={nomiSelezionati.length > 0 ? nomiSelezionati.join(", ") : "nessuno"}
              buy={generato.ingredientiDaComprare.map((i) => `${i.nome} ${i.quantita}`).join(", ")}
              onAccept={() => void salvaGenerato()}
              onRegenerate={() => void generaConAI()}
            />
          )}
          {componendo && (
            <FormComposizioneManuale
              ingredienti={ingredienti.filter((i) => selezionati.includes(i.id))}
              porzioniDefault={profilo?.porzioniDefault ?? 4}
              onAnnulla={() => setComponendo(false)}
              onSalvato={() => {
                setComponendo(false);
                setSelezionati([]);
              }}
            />
          )}
        </section>

        <section className="border-t pt-4" style={{ borderColor: "var(--quadretto)" }}>
          <Etichetta>I tuoi piatti</Etichetta>
          <div className="flex flex-col gap-2">
            {piatti.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border rounded-2xl px-3.5 py-3"
                style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)" }}
              >
                <span style={{ fontWeight: 600 }}>{p.nome}</span>
                <div className="flex items-center gap-2 flex-none">
                  {p.origine === "ai" && (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{
                        fontSize: 11,
                        color: "var(--biro)",
                        background: "var(--biro-chiaro)",
                        borderRadius: 99,
                        padding: "3px 8px",
                      }}
                    >
                      <Sparkles size={11} strokeWidth={2} /> AI
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Elimina ${p.nome}`}
                    onClick={() => void eliminaPiatto(p.id)}
                    style={{ color: "var(--pomodoro)", display: "flex" }}
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
            {piatti.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Nessun piatto salvato.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function RepartoCollassabile({
  nome,
  ingredienti,
  espanso,
  onToggle,
  selezionati,
  onToggleIngrediente,
}: {
  nome: string;
  ingredienti: Ingrediente[];
  espanso: boolean;
  onToggle: () => void;
  selezionati: string[];
  onToggleIngrediente: (id: string) => void;
}) {
  if (ingredienti.length === 0) return null;
  const numSelezionati = ingredienti.filter((i) => selezionati.includes(i.id)).length;
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left mb-2"
        style={{ letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}
      >
        {espanso ? <ChevronDown size={15} strokeWidth={2.25} /> : <ChevronRight size={15} strokeWidth={2.25} />}
        <span>{nome}</span>
        <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
          ({ingredienti.length}{numSelezionati > 0 ? ` · ${numSelezionati} selezionati` : ""})
        </span>
      </button>
      {espanso && (
        <div className="flex flex-wrap gap-2">
          {ingredienti.map((ing) => (
            <Chip
              key={ing.id}
              state={selezionati.includes(ing.id) ? "selected" : "default"}
              onClick={() => onToggleIngrediente(ing.id)}
            >
              {ing.nome}
            </Chip>
          ))}
        </div>
      )}
    </section>
  );
}

function AggiungiIngredienteInline({
  query,
  reparti,
  onConferma,
}: {
  query: string;
  reparti: string[];
  onConferma: (reparto: string) => void;
}) {
  const [repartoScelto, setRepartoScelto] = useState(reparti[0] ?? "Dispensa");
  return (
    <div
      className="flex flex-col gap-2 border rounded-2xl p-3"
      style={{ borderColor: "var(--biro)", background: "var(--surface-card)" }}
    >
      <p style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
        “{query}” non è nel catalogo. Scegli il reparto per aggiungerlo:
      </p>
      <div className="flex flex-wrap gap-2">
        {reparti.map((r) => (
          <Chip key={r} state={repartoScelto === r ? "selected" : "default"} onClick={() => setRepartoScelto(r)}>
            {r}
          </Chip>
        ))}
      </div>
      <Button onClick={() => onConferma(repartoScelto)}>
        <span className="inline-flex items-center gap-1.5">
          <Plus size={15} strokeWidth={2.25} /> Aggiungi “{query}”
        </span>
      </Button>
    </div>
  );
}

function FormComposizioneManuale({
  ingredienti,
  porzioniDefault,
  onAnnulla,
  onSalvato,
}: {
  ingredienti: Ingrediente[];
  porzioniDefault: number;
  onAnnulla: () => void;
  onSalvato: () => void;
}) {
  const [nomePiatto, setNomePiatto] = useState("");
  const [porzioni, setPorzioni] = useState(porzioniDefault);
  const [quantita, setQuantita] = useState<Record<string, { valore: number; unita: string }>>(() =>
    Object.fromEntries(ingredienti.map((i) => [i.id, { valore: 1, unita: i.unitaDefault }]))
  );

  async function salva() {
    if (!nomePiatto.trim()) return;
    const piattoId = nuovoId();
    const piatto: Piatto = {
      id: piattoId,
      nome: nomePiatto.trim(),
      preferito: false,
      origine: "manuale",
      porzioni,
      updatedAt: nowIso(),
    };
    await db.piatti.add(piatto);
    for (const ing of ingredienti) {
      const q = quantita[ing.id] ?? { valore: 1, unita: ing.unitaDefault };
      // eslint-disable-next-line no-await-in-loop
      await db.piattoIngredienti.add({
        id: nuovoId(),
        piattoId,
        ingredienteId: ing.id,
        nome: ing.nome,
        reparto: ing.reparto,
        quantita: q.valore,
        unita: q.unita,
      });
    }
    onSalvato();
  }

  return (
    <div
      className="flex flex-col gap-3 border rounded-2xl p-3"
      style={{ borderColor: "var(--biro)", background: "var(--surface-card)" }}
    >
      <input
        className="border rounded-lg px-3 py-2 text-sm"
        style={{ borderColor: "var(--quadretto)" }}
        placeholder="Nome del piatto"
        value={nomePiatto}
        onChange={(e) => setNomePiatto(e.target.value)}
      />
      <div className="flex items-center gap-2 text-sm">
        <span style={{ color: "var(--text-secondary)" }}>Porzioni</span>
        <input
          type="number"
          min={1}
          className="border rounded-lg px-2 py-1 w-16"
          style={{ borderColor: "var(--quadretto)" }}
          value={porzioni}
          onChange={(e) => setPorzioni(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {ingredienti.map((ing) => (
          <div key={ing.id} className="flex items-center gap-2">
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{ing.nome}</span>
            <input
              type="number"
              min={0}
              step="any"
              className="border rounded-lg px-2 py-1 w-16 text-sm"
              style={{ borderColor: "var(--quadretto)" }}
              value={quantita[ing.id]?.valore ?? 1}
              onChange={(e) =>
                setQuantita((q) => ({ ...q, [ing.id]: { ...q[ing.id], valore: Number(e.target.value) || 0 } }))
              }
            />
            <input
              className="border rounded-lg px-2 py-1 w-20 text-sm"
              style={{ borderColor: "var(--quadretto)" }}
              value={quantita[ing.id]?.unita ?? ing.unitaDefault}
              onChange={(e) => setQuantita((q) => ({ ...q, [ing.id]: { ...q[ing.id], unita: e.target.value } }))}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void salva()} disabled={!nomePiatto.trim()}>
          Salva piatto
        </Button>
        <Button variant="ghost" onClick={onAnnulla}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

function Etichetta({ children }: { children: string }) {
  return (
    <div className="text-xs font-bold uppercase mb-2" style={{ letterSpacing: ".12em", color: "var(--text-secondary)" }}>
      {children}
    </div>
  );
}
