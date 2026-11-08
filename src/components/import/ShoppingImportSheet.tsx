import { useEffect, useState } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { BottomSheet } from "../navigation/BottomSheet";
import { Button } from "../core/Button";
import { ImportInput } from "./ImportInput";
import {
  parseShoppingText,
  type CatalogIngredient,
  type ShoppingDraft,
} from "../../lib/textImport";
import type { ShoppingImportEntry } from "../../lib/shoppingList";

interface RigaSpesaLavorata extends ShoppingDraft {
  chiave: string;
  includi: boolean;
}

interface Props {
  open: boolean;
  catalogo: CatalogIngredient[];
  reparti: string[];
  onClose: () => void;
  onConfirm: (righe: ShoppingImportEntry[]) => Promise<void>;
}

/** Imports shopping items from pasted text or a text file. Every row can be corrected, excluded
 * or reassigned to another department before saving. */
export function ShoppingImportSheet({ open, catalogo, reparti, onClose, onConfirm }: Props) {
  const [testo, setTesto] = useState("");
  const [righe, setRighe] = useState<RigaSpesaLavorata[] | null>(null);
  const [ignorate, setIgnorate] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) {
      setTesto("");
      setRighe(null);
      setIgnorate(0);
      setErrore(null);
      setSalvando(false);
    }
  }, [open]);

  function analizza() {
    const risultato = parseShoppingText(testo, catalogo, reparti);
    setIgnorate(risultato.ignorate.length);
    if (risultato.righe.length === 0) {
      setRighe(null);
      setErrore("Non ho trovato articoli da comprare. Controlla il testo e riprova.");
      return;
    }
    setRighe(
      risultato.righe.map((r, indice) => ({
        ...r,
        chiave: `${indice}-${r.nome}`,
        includi: true,
      })),
    );
    setErrore(null);
  }

  function aggiorna(chiave: string, patch: Partial<RigaSpesaLavorata>) {
    setRighe((correnti) =>
      correnti ? correnti.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)) : correnti,
    );
  }

  function invertiTutti() {
    setRighe((correnti) => {
      if (!correnti) return correnti;
      const tutti = correnti.every((r) => r.includi);
      return correnti.map((r) => ({ ...r, includi: !tutti }));
    });
  }

  async function conferma() {
    if (!righe) return;
    const incluse = righe.filter((r) => r.includi);
    if (incluse.length === 0) return;
    setSalvando(true);
    setErrore(null);
    try {
      await onConfirm(
        incluse.map((r) => ({
          nome: r.nome,
          quantita: r.quantita,
          reparto: r.reparto,
          nota: r.nota,
          ingredienteId: r.ingredienteId,
        })),
      );
      onClose();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare la lista. Riprova.");
    } finally {
      setSalvando(false);
    }
  }

  const incluse = righe?.filter((r) => r.includi).length ?? 0;
  const tuttoIncluso = !!righe && righe.length > 0 && righe.every((r) => r.includi);

  return (
    <BottomSheet
      open={open}
      title="Importa la lista della spesa"
      intro="Incolla o carica gli ingredienti, poi controlla ogni articolo. Quelli già presenti vengono aggiornati, senza duplicati; i pasti si importano da Settimana."
      onClose={onClose}
      style={{ zIndex: 50, maxHeight: "92dvh", overflowY: "auto" }}
    >
      {righe === null ? (
        <div className="flex flex-col gap-3">
          <ImportInput
            value={testo}
            onChange={setTesto}
            placeholder={"4 uova\n1 confezione di spinaci\n2 confezioni di gamberi\n…"}
          />
          {errore && (
            <p role="alert" style={{ color: "var(--pomodoro)", fontSize: 13 }}>
              {errore}
            </p>
          )}
          <Button onClick={analizza} disabled={!testo.trim() || reparti.length === 0}>
            Controlla il testo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div style={{ fontWeight: 700 }}>{incluse} articoli da importare</div>
            <button
              type="button"
              className="text-xs"
              style={{ color: "var(--biro)", fontWeight: 600, minHeight: 36 }}
              onClick={invertiTutti}
            >
              {tuttoIncluso ? "Deseleziona tutti" : "Seleziona tutti"}
            </button>
          </div>

          {ignorate > 0 && (
            <p style={{ color: "var(--text-secondary)", fontSize: 12.5, lineHeight: 1.4, margin: 0 }}>
              {ignorate === 1
                ? "Una riga non conteneva un articolo e resta fuori."
                : `${ignorate} righe non contenevano articoli e restano fuori.`}
            </p>
          )}

          <div className="flex flex-col" style={{ maxHeight: "50dvh", overflowY: "auto" }}>
            {righe.map((riga) => (
              <div
                key={riga.chiave}
                className="flex items-start gap-2 py-3 border-b"
                style={{ borderColor: "var(--border-quiet)", opacity: riga.includi ? 1 : 0.55 }}
              >
                <label
                  className="flex items-center justify-center flex-none"
                  style={{ width: 32, minHeight: 44, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={riga.includi}
                    onChange={(event) => aggiorna(riga.chiave, { includi: event.target.checked })}
                    aria-label={`Includi ${riga.nome || "articolo"}`}
                    style={{ width: 18, height: 18, accentColor: "var(--biro)" }}
                  />
                </label>

                <div className="flex-1 flex flex-col gap-1.5">
                  <input
                    className="w-full rounded-lg border px-2.5 py-2 text-sm"
                    style={{
                      borderColor: "var(--border-quiet)",
                      background: "var(--surface-card)",
                      color: "var(--text-body)",
                      fontWeight: 600,
                    }}
                    value={riga.nome}
                    onChange={(event) => aggiorna(riga.chiave, { nome: event.target.value })}
                    placeholder="Nome articolo"
                    aria-label="Nome articolo"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      className="rounded-lg border px-2.5 py-2 text-sm"
                      style={{
                        borderColor: "var(--border-quiet)",
                        background: "var(--surface-card)",
                        color: "var(--text-body)",
                        width: 116,
                      }}
                      inputMode="decimal"
                      value={riga.quantita}
                      onChange={(event) => aggiorna(riga.chiave, { quantita: event.target.value })}
                      placeholder="quantità"
                      aria-label="Quantità"
                    />
                    <select
                      className="rounded-lg border px-2 py-2 text-sm flex-1 min-w-0"
                      style={{
                        borderColor: "var(--border-quiet)",
                        background: "var(--surface-card)",
                        color: "var(--text-body)",
                      }}
                      value={riga.reparto}
                      onChange={(event) => aggiorna(riga.chiave, { reparto: event.target.value })}
                      aria-label="Reparto"
                    >
                      {reparti.map((reparto) => (
                        <option key={reparto} value={reparto}>
                          {reparto}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                    style={{
                      borderColor: "var(--border-quiet)",
                      background: "var(--surface-card)",
                      color: "var(--text-secondary)",
                    }}
                    value={riga.nota ?? ""}
                    onChange={(event) =>
                      aggiorna(riga.chiave, { nota: event.target.value || undefined })
                    }
                    placeholder="nota (es. confezione)"
                    aria-label="Nota"
                  />
                  {!riga.riconosciuto && (
                    <span style={{ color: "var(--pomodoro)", fontSize: 11.5 }}>
                      Da controllare: reparto non riconosciuto.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  aria-label={riga.includi ? "Escludi questo articolo" : "Includi questo articolo"}
                  onClick={() => aggiorna(riga.chiave, { includi: !riga.includi })}
                  className="flex items-center justify-center flex-none"
                  style={{
                    color: riga.includi ? "var(--basilico)" : "var(--pomodoro)",
                    width: 32,
                    minHeight: 44,
                  }}
                >
                  {riga.includi ? <Check size={17} strokeWidth={2.25} /> : <RotateCcw size={17} strokeWidth={2.25} />}
                </button>
              </div>
            ))}
          </div>

          {errore && (
            <p role="alert" style={{ color: "var(--pomodoro)", fontSize: 13 }}>
              {errore}
            </p>
          )}

          <Button onClick={() => void conferma()} disabled={salvando || incluse === 0}>
            {salvando ? "Salvo…" : `Salva ${incluse} articoli`}
          </Button>
          <Button variant="ghost" onClick={() => setRighe(null)} disabled={salvando}>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={15} strokeWidth={2.25} /> Indietro
            </span>
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
