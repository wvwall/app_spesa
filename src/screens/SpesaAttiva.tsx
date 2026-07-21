import { useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { X, TriangleAlert, ShieldCheck } from "lucide-react";
import { db, getOrCreateProfilo } from "../lib/db";
import { toggleVoce, sostituisciVoce } from "../lib/lista";
import { RigaLista, ProgressSpesa, Badge, BottomSheet, AltOption } from "../components";
import type { VoceLista } from "../lib/types";

interface Props {
  listaId: string;
  onChiudi: () => void;
}

export function SpesaAttiva({ listaId, onChiudi }: Props) {
  const voci = useLiveQuery(() => db.voci.where("listaId").equals(listaId).toArray(), [listaId]) ?? [];
  const profilo = useLiveQuery(() => getOrCreateProfilo(), []);
  const [voceMancante, setVoceMancante] = useState<VoceLista | null>(null);

  const totale = voci.length;
  const fatti = voci.filter((v) => v.checked).length;

  const ordine = profilo?.ordineReparti ?? [];
  const perReparto = new Map<string, VoceLista[]>();
  for (const v of voci) {
    const arr = perReparto.get(v.reparto) ?? [];
    arr.push(v);
    perReparto.set(v.reparto, arr);
  }
  const reparti = [...perReparto.keys()].sort((a, b) => {
    const ia = ordine.indexOf(a);
    const ib = ordine.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <div
      className="flex flex-col h-full"
      style={
        {
          background: "var(--carta)",
          color: "var(--inchiostro)",
          // Pin esplicito: la corsia resta sempre uguale a prescindere dal tema attivo
          // (anche per l'accento, non solo lo sfondo) — vedi DESIGN.md §4.1.
          "--biro": "#2f58d4",
          "--biro-chiaro": "#e8ecf9",
        } as CSSProperties
      }
    >
      <div className="px-5 pt-4 pb-2 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={onChiudi} aria-label="Chiudi" style={{ display: "flex" }}>
              <X size={18} strokeWidth={2} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Esselunga</span>
          </div>
        </div>
        <div className="mt-2.5">
          <ProgressSpesa done={fatti} total={totale} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border-t" style={{ borderColor: "var(--quadretto)" }}>
        {reparti.map((reparto) => (
          <div key={reparto}>
            <div
              className="text-xs font-bold px-5 pt-3.5 pb-1"
              style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--inchiostro-70)" }}
            >
              {reparto}
            </div>
            {(perReparto.get(reparto) ?? []).map((v) => (
              <div key={v.id} className="flex items-center">
                <div className="flex-1 min-w-0">
                  <RigaLista
                    name={v.sostituitoCon ?? v.nome}
                    qty={v.quantita}
                    note={v.nota}
                    checked={v.checked}
                    substituted={Boolean(v.sostituitoCon)}
                    onToggle={() => void toggleVoce(v.id, !v.checked)}
                  />
                </div>
                {!v.checked && (
                  <button
                    type="button"
                    aria-label={`Manca ${v.nome}?`}
                    onClick={() => setVoceMancante(v)}
                    style={{
                      color: "var(--pomodoro)",
                      flex: "none",
                      minWidth: 44,
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TriangleAlert size={19} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="text-center pt-2 pb-5 flex-none">
        <Badge kind="offline" />
      </div>

      <BottomSheet
        open={Boolean(voceMancante)}
        onClose={() => setVoceMancante(null)}
        title={voceMancante ? `Non trovi ${voceMancante.nome}?` : undefined}
        intro={
          voceMancante && voceMancante.alternative.length > 0
            ? "Vanno bene anche:"
            : "Nessuna alternativa pre-generata per questo articolo."
        }
        footer={
          voceMancante && voceMancante.alternative.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={13} strokeWidth={2} /> verificate: senza noci
            </span>
          ) : undefined
        }
      >
        {voceMancante?.alternative.map((alt) => (
          <AltOption
            key={alt}
            label={alt}
            onClick={() => {
              void sostituisciVoce(voceMancante.id, alt);
              setVoceMancante(null);
            }}
          />
        ))}
      </BottomSheet>
    </div>
  );
}
