import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getOrCreateProfilo } from "../lib/db";
import { toggleVoce, sostituisciVoce } from "../lib/lista";
import { RigaLista, ProgressSpesa, Badge, Button, BottomSheet, AltOption } from "../components";
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
    <div className="flex flex-col h-full" style={{ background: "var(--carta)", color: "var(--inchiostro)" }}>
      <div className="px-5 pt-4 pb-2 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={onChiudi} aria-label="Chiudi" style={{ fontSize: 18 }}>
              ✕
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
              <RigaLista
                key={v.id}
                name={v.sostituitoCon ?? v.nome}
                qty={v.quantita}
                note={v.nota}
                checked={v.checked}
                substituted={Boolean(v.sostituitoCon)}
                onToggle={() => void toggleVoce(v.id, !v.checked)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="text-center pt-2 pb-0.5 flex-none">
        <Badge kind="offline" />
      </div>
      <div className="px-5 pt-2 pb-5 flex-none">
        <Button
          variant="warn"
          onClick={() => setVoceMancante(voci.find((v) => !v.checked) ?? null)}
          disabled={totale === 0 || fatti === totale}
        >
          ⚠ Manca qualcosa?
        </Button>
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
        footer={voceMancante && voceMancante.alternative.length > 0 ? "✓ verificate: senza noci" : undefined}
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
