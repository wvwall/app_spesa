import { useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { X, TriangleAlert, ShieldCheck, Image } from "lucide-react";
import { db, getOrCreateProfile } from "../lib/database";
import { toggleItem, replaceItem } from "../lib/shoppingList";
import { groupByDepartment } from "../lib/departments";
import { ShoppingListRow, ShoppingProgress, Badge, BottomSheet, AltOption } from "../components";
import type { ShoppingListItem } from "../lib/models";

interface Props {
  listId: string;
  onClose: () => void;
}

export function ActiveShopping({ listId, onClose }: Props) {
  const voci = useLiveQuery(() => db.voci.where("listaId").equals(listId).toArray(), [listId]) ?? [];
  const profilo = useLiveQuery(() => getOrCreateProfile(), []);
  const [missingItem, setMissingItem] = useState<ShoppingListItem | null>(null);
  const [openPhoto, setFotoAperta] = useState<ShoppingListItem | null>(null);

  const totale = voci.length;
  const fatti = voci.filter((v) => v.checked).length;

  const ordine = profilo?.ordineReparti ?? [];
  const gruppiReparto = groupByDepartment(voci, ordine);

  return (
    <div
      className="flex flex-col h-full"
      style={
        {
          background: "var(--carta)",
          color: "var(--inchiostro)",
          // Explicitly pin the shopping aisle colors so they remain consistent in every theme,
          // including the accent color and not just the background (see DESIGN.md §4.1).
          "--biro": "#2f58d4",
          "--biro-chiaro": "#e8ecf9",
        } as CSSProperties
      }
    >
      <div className="px-5 pt-4 pb-2 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} aria-label="Chiudi" style={{ display: "flex" }}>
              <X size={18} strokeWidth={2} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Esselunga</span>
          </div>
        </div>
        <div className="mt-2.5">
          <ShoppingProgress done={fatti} total={totale} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border-t" style={{ borderColor: "var(--quadretto)" }}>
        {gruppiReparto.map(({ reparto, voci: vociReparto }) => (
          <div key={reparto}>
            <div
              className="text-xs font-bold px-5 pt-3.5 pb-1"
              style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--inchiostro-70)" }}
            >
              {reparto}
            </div>
            {vociReparto.map((v) => (
              <div key={v.id} className="flex items-center">
                <div className="flex-1 min-w-0">
                  <ShoppingListRow
                    name={v.sostituitoCon ?? v.nome}
                    qty={v.quantita}
                    note={v.nota}
                    checked={v.checked}
                    substituted={Boolean(v.sostituitoCon)}
                    onToggle={() => void toggleItem(v.id, !v.checked)}
                  />
                </div>
                {v.fotoDataUrl && (
                  <button
                    type="button"
                    aria-label={`Apri foto di ${v.nome}`}
                    onClick={() => setFotoAperta(v)}
                    style={{ minWidth: 44, minHeight: 44, display: "grid", placeItems: "center", color: "var(--biro)" }}
                  >
                    <Image size={20} />
                  </button>
                )}
                {!v.checked && (
                  <button
                    type="button"
                    aria-label={`Manca ${v.nome}?`}
                    onClick={() => setMissingItem(v)}
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
        open={Boolean(missingItem)}
        onClose={() => setMissingItem(null)}
        title={missingItem ? `Non trovi ${missingItem.nome}?` : undefined}
        intro={
          missingItem && missingItem.alternative.length > 0
            ? "Vanno bene anche:"
            : "Nessuna alternativa pre-generata per questo articolo."
        }
        footer={
          missingItem && missingItem.alternative.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={13} strokeWidth={2} /> verificate: senza noci
            </span>
          ) : undefined
        }
      >
        {missingItem?.alternative.map((alt) => (
          <AltOption
            key={alt}
            label={alt}
            onClick={() => {
              void replaceItem(missingItem.id, alt);
              setMissingItem(null);
            }}
          />
        ))}
      </BottomSheet>
      {openPhoto?.fotoDataUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto di ${openPhoto.nome}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          style={{ background: "rgba(0,0,0,.82)" }}
          onClick={() => setFotoAperta(null)}
        >
          <button
            type="button"
            aria-label="Chiudi foto"
            className="absolute right-4 top-4 text-white"
            style={{ minWidth: 44, minHeight: 44, display: "grid", placeItems: "center" }}
            onClick={() => setFotoAperta(null)}
          >
            <X size={24} />
          </button>
          <img
            src={openPhoto.fotoDataUrl}
            alt={openPhoto.nome}
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
