import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { db } from "../../lib/database";
import { addIngredient, deleteIngredientWithUndo, updateIngredient } from "../../lib/dishes";
import { groupByDepartment } from "../../lib/departments";
import type { Ingredient } from "../../lib/models";
import { BottomSheet } from "../navigation/BottomSheet";
import { Button } from "../core/Button";
import { Chip } from "../core/Chip";
import { SearchInput } from "../core/SearchInput";
import { useUndoToast } from "../feedback/UndoToast";

const CAMPO = { borderColor: "var(--border-quiet)", background: "var(--surface-card)", color: "var(--text-body)" } as const;

interface Props {
  open: boolean;
  reparti: string[];
  onClose: () => void;
}

/** Opzioni → Ingredienti: the catalog used by "Nuovo piatto" and the dish editor. Search,
 * grouped by department; edit name, unit and department; add new; delete with undo. */
export function IngredientsSheet({ open, reparti, onClose }: Props) {
  const showUndo = useUndoToast();
  const ingredienti = useLiveQuery(() => db.ingredienti.toArray(), []) ?? [];
  const [query, setQuery] = useState("");
  const [modifica, setModifica] = useState<Ingredient | "nuovo" | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setModifica(null);
    }
  }, [open]);

  const testo = query.trim().toLowerCase();
  const visibili = ingredienti
    .filter((i) => !i.deletedAt)
    .filter((i) => !testo || i.nome.toLowerCase().includes(testo) || i.alias.some((a) => a.toLowerCase().includes(testo)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));

  async function elimina(i: Ingredient) {
    const restore = await deleteIngredientWithUndo(i.id);
    setModifica(null);
    showUndo({ message: `${i.nome} eliminato`, onUndo: restore });
  }

  return (
    <BottomSheet
      open={open}
      title={modifica === "nuovo" ? "Nuovo ingrediente" : modifica ? "Modifica ingrediente" : "Ingredienti"}
      intro={modifica ? undefined : `${visibili.length} nel catalogo. Li usi per comporre e generare i piatti.`}
      onClose={onClose}
      style={{ zIndex: 40, maxHeight: "92dvh", overflowY: "auto" }}>
      {modifica ? (
        <IngredientForm
          key={modifica === "nuovo" ? "nuovo" : modifica.id}
          ingrediente={modifica === "nuovo" ? undefined : modifica}
          nomeIniziale={modifica === "nuovo" ? query.trim() : undefined}
          reparti={reparti}
          onCancel={() => setModifica(null)}
          onDelete={modifica === "nuovo" ? undefined : () => void elimina(modifica)}
          onSaved={() => setModifica(null)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <SearchInput placeholder="Cerca un ingrediente…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button fullWidth={false} variant="ghost" aria-label="Nuovo ingrediente" onClick={() => setModifica("nuovo")} style={{ padding: "10px 14px" }}>
              <Plus size={16} strokeWidth={2.25} />
            </Button>
          </div>
          {groupByDepartment(visibili, reparti).map(({ reparto, voci }) => (
            <section key={reparto}>
              <div className="text-xs font-bold uppercase mb-1.5" style={{ letterSpacing: ".12em", color: "var(--text-secondary)" }}>
                {reparto} <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>({voci.length})</span>
              </div>
              <div className="border rounded-2xl" style={{ borderColor: "var(--border-quiet)", background: "var(--surface-card)" }}>
                {voci.map((i, n) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setModifica(i)}
                    className="w-full flex items-center gap-2 px-3.5 text-left"
                    style={{ minHeight: 44, borderTop: n > 0 ? "1px solid var(--border-quiet)" : undefined }}>
                    <span className="flex-1 min-w-0 truncate" style={{ fontWeight: 500 }}>
                      {i.nome}
                    </span>
                    {i.unitaDefault && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{i.unitaDefault}</span>}
                    <ChevronRight size={15} style={{ color: "var(--text-secondary)", flex: "none" }} />
                  </button>
                ))}
              </div>
            </section>
          ))}
          {visibili.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, padding: "16px 0" }}>
              Nessun ingrediente trovato.{" "}
              {testo && (
                <button type="button" onClick={() => setModifica("nuovo")} style={{ color: "var(--biro)", fontWeight: 600 }}>
                  Aggiungi “{query.trim()}”
                </button>
              )}
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function IngredientForm({
  ingrediente,
  nomeIniziale,
  reparti,
  onCancel,
  onDelete,
  onSaved,
}: {
  ingrediente?: Ingredient;
  nomeIniziale?: string;
  reparti: string[];
  onCancel: () => void;
  onDelete?: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(ingrediente?.nome ?? nomeIniziale ?? "");
  const [unita, setUnita] = useState(ingrediente?.unitaDefault ?? "");
  const [reparto, setReparto] = useState(ingrediente?.reparto ?? reparti[0] ?? "Dispensa");
  // Keep a department that is no longer in the profile's order selectable.
  const opzioni = reparti.includes(reparto) ? reparti : [...reparti, reparto];

  async function salva() {
    const n = nome.trim();
    if (!n) return;
    if (ingrediente) await updateIngredient(ingrediente.id, { nome: n, reparto, unitaDefault: unita.trim() });
    else await addIngredient({ nome: n, reparto, unitaDefault: unita.trim() });
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        className="w-full rounded-lg border px-3 py-2.5"
        style={{ ...CAMPO, fontWeight: 600 }}
        placeholder="Nome"
        aria-label="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <input
        className="w-full rounded-lg border px-3 py-2.5"
        style={CAMPO}
        placeholder="Unità predefinita (es. g, pz, ml)"
        aria-label="Unità predefinita"
        autoCapitalize="none"
        value={unita}
        onChange={(e) => setUnita(e.target.value)}
      />
      <div className="text-xs font-bold uppercase" style={{ letterSpacing: ".12em", color: "var(--text-secondary)", marginTop: 4 }}>
        Reparto
      </div>
      <div className="flex flex-wrap gap-2">
        {opzioni.map((r) => (
          <Chip key={r} state={reparto === r ? "selected" : "default"} onClick={() => setReparto(r)}>
            {r}
          </Chip>
        ))}
      </div>
      <Button onClick={() => void salva()} disabled={!nome.trim()}>
        {ingrediente ? "Salva" : "Aggiungi"}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Annulla
      </Button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-1.5"
          style={{ color: "var(--pomodoro)", fontWeight: 600, minHeight: 44 }}>
          <Trash2 size={15} strokeWidth={2} /> Elimina ingrediente
        </button>
      )}
    </div>
  );
}
