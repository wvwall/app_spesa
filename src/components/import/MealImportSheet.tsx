import { useEffect, useState } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { BottomSheet } from "../navigation/BottomSheet";
import { Button } from "../core/Button";
import { ImportInput } from "./ImportInput";
import { formatDayLabel } from "../../lib/calendar";
import { parseMealText, type MealDraft } from "../../lib/textImport";
import type { MealImportAssignment } from "../../lib/weeklyPlan";
import type { Slot } from "../../lib/models";

interface RigaPastoLavorata extends MealDraft {
  includi: boolean;
}

interface Props {
  open: boolean;
  slots: Slot[];
  onClose: () => void;
  onConfirm: (righe: MealImportAssignment[]) => Promise<void>;
}

function etichettaGiorno(iso: string): string {
  return formatDayLabel(new Date(`${iso}T00:00:00`));
}

/** Imports a weekly menu from pasted text or a text file. The user always reviews and can edit
 * each meal before it is written to the plan. */
export function MealImportSheet({ open, slots, onClose, onConfirm }: Props) {
  const [testo, setTesto] = useState("");
  const [righe, setRighe] = useState<RigaPastoLavorata[] | null>(null);
  const [senzaSlot, setSenzaSlot] = useState<string[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) {
      setTesto("");
      setRighe(null);
      setSenzaSlot([]);
      setErrore(null);
      setSalvando(false);
    }
  }, [open]);

  function analizza() {
    const risultato = parseMealText(testo, slots);
    setSenzaSlot(risultato.senzaSlot);
    if (risultato.pasti.length === 0) {
      setRighe(null);
      setErrore("Non ho trovato pasti tipo “Sabato pranzo: …”. Controlla il testo e riprova.");
      return;
    }
    setRighe(risultato.pasti.map((p) => ({ ...p, includi: true })));
    setErrore(null);
  }

  function aggiorna(slotId: string, patch: Partial<RigaPastoLavorata>) {
    setRighe((correnti) =>
      correnti ? correnti.map((r) => (r.slotId === slotId ? { ...r, ...patch } : r)) : correnti,
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
      await onConfirm(incluse.map((r) => ({ slotId: r.slotId, nome: r.nome })));
      onClose();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare il menù. Riprova.");
    } finally {
      setSalvando(false);
    }
  }

  const incluse = righe?.filter((r) => r.includi).length ?? 0;
  const tuttoIncluso = !!righe && righe.length > 0 && righe.every((r) => r.includi);

  return (
    <BottomSheet
      open={open}
      title="Importa il menù"
      intro="Incolla o carica il testo della settimana, poi controlla e correggi i pasti prima di salvarli. Gli ingredienti si importano dalla pagina Lista."
      onClose={onClose}
      style={{ zIndex: 50, maxHeight: "92dvh", overflowY: "auto" }}
    >
      {righe === null ? (
        <div className="flex flex-col gap-3">
          <ImportInput
            value={testo}
            onChange={setTesto}
            placeholder={"Venerdì cena: affettati e formaggi\nSabato pranzo: spinaci e uova\n…"}
          />
          {slots.length === 0 && (
            <p style={{ color: "var(--text-secondary)", fontSize: 12.5, margin: 0 }}>
              Sto preparando la settimana: tra un istante potrai controllare il testo.
            </p>
          )}
          {errore && (
            <p role="alert" style={{ color: "var(--pomodoro)", fontSize: 13 }}>
              {errore}
            </p>
          )}
          <Button onClick={analizza} disabled={!testo.trim() || slots.length === 0}>
            Controlla il testo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div style={{ fontWeight: 700 }}>{incluse} pasti da importare</div>
            <button
              type="button"
              className="text-xs"
              style={{ color: "var(--biro)", fontWeight: 600, minHeight: 36 }}
              onClick={invertiTutti}
            >
              {tuttoIncluso ? "Deseleziona tutti" : "Seleziona tutti"}
            </button>
          </div>

          {senzaSlot.length > 0 && (
            <p style={{ color: "var(--text-secondary)", fontSize: 12.5, lineHeight: 1.4, margin: 0 }}>
              {senzaSlot.length === 1
                ? "Una riga non corrisponde a un pasto di questa settimana e resta fuori."
                : `${senzaSlot.length} righe non corrispondono a pasti di questa settimana e restano fuori.`}
            </p>
          )}

          <div className="flex flex-col" style={{ maxHeight: "48dvh", overflowY: "auto" }}>
            {righe.map((riga) => {
              const pasto = riga.pasto === "pranzo" ? "Pranzo" : "Cena";
              return (
                <div
                  key={riga.slotId}
                  className="flex items-start gap-2 py-2.5 border-b"
                  style={{ borderColor: "var(--border-quiet)", opacity: riga.includi ? 1 : 0.55 }}
                >
                  <label
                    className="flex items-center justify-center flex-none"
                    style={{ width: 32, minHeight: 44, cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={riga.includi}
                      onChange={(event) => aggiorna(riga.slotId, { includi: event.target.checked })}
                      aria-label={`Includi ${etichettaGiorno(riga.dataIso)} ${pasto}`}
                      style={{ width: 18, height: 18, accentColor: "var(--biro)" }}
                    />
                  </label>
                  <div className="flex-1 flex flex-col gap-1">
                    <div
                      className="text-xs font-bold"
                      style={{ letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-secondary)" }}
                    >
                      {etichettaGiorno(riga.dataIso)} · {pasto}
                    </div>
                    <input
                      className="w-full rounded-lg border px-2.5 py-2 text-sm"
                      style={{
                        borderColor: "var(--border-quiet)",
                        background: "var(--surface-card)",
                        color: "var(--text-body)",
                      }}
                      value={riga.nome}
                      onChange={(event) => aggiorna(riga.slotId, { nome: event.target.value })}
                      placeholder="Nessun piatto (slot vuoto)"
                      aria-label={`Piatto per ${etichettaGiorno(riga.dataIso)} ${pasto}`}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={riga.includi ? "Escludi questo pasto" : "Includi questo pasto"}
                    onClick={() => aggiorna(riga.slotId, { includi: !riga.includi })}
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
              );
            })}
          </div>

          {errore && (
            <p role="alert" style={{ color: "var(--pomodoro)", fontSize: 13 }}>
              {errore}
            </p>
          )}

          <Button onClick={() => void conferma()} disabled={salvando || incluse === 0}>
            {salvando ? "Salvo…" : `Salva ${incluse} pasti`}
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
