import { useState } from "react";
import { MinusCircle, Minus, Plus } from "lucide-react";
import { createId } from "../../lib/database";
import { saveDish, type DishRowDraft } from "../../lib/dishes";
import type { Dish, DishIngredient, Ingredient } from "../../lib/models";
import { Button } from "../core/Button";

const CAMPO = {
  borderColor: "var(--border-quiet)",
  background: "var(--surface-card)",
  color: "var(--text-body)",
} as const;

interface Props {
  /** The dish to edit; undefined composes a new one. */
  piatto?: Dish;
  righeIniziali?: DishIngredient[];
  /** Catalog ingredients preselected when composing from the "Nuovo piatto" sheet. */
  preselezionati?: Ingredient[];
  catalogo: Ingredient[];
  porzioniDefault: number;
  onCancel: () => void;
  onSaved: (piattoId: string) => void;
}

/** Name, servings, ingredient rows (quantity + unit, removable, addable by name) and method. */
export function DishEditor({ piatto, righeIniziali = [], preselezionati = [], catalogo, porzioniDefault, onCancel, onSaved }: Props) {
  const [nome, setNome] = useState(piatto?.nome ?? "");
  const [porzioni, setPorzioni] = useState(piatto?.porzioni ?? porzioniDefault);
  const [procedimento, setProcedimento] = useState(piatto?.procedimento ?? "");
  const [righe, setRighe] = useState<DishRowDraft[]>(() =>
    piatto
      ? [...righeIniziali]
          .sort((a, b) => a.nome.localeCompare(b.nome, "it"))
          .map((r) => ({
            key: r.id,
            ingredienteId: r.ingredienteId,
            nome: r.nome,
            reparto: r.reparto,
            quantita: String(r.quantita).replace(".", ","),
            unita: r.unita,
          }))
      : preselezionati.map((i) => ({
          key: createId(),
          ingredienteId: i.id,
          nome: i.nome,
          reparto: i.reparto,
          quantita: "1",
          unita: i.unitaDefault,
        })),
  );
  const [nuovo, setNuovo] = useState("");
  const [salvando, setSalvando] = useState(false);

  function aggiorna(key: string, patch: Partial<DishRowDraft>) {
    setRighe((rr) => rr.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** Adds a row; department and unit come from the catalog when the name matches it. */
  function aggiungi() {
    const n = nuovo.trim();
    if (!n) return;
    const match = catalogo.find((i) => !i.deletedAt && i.nome.toLowerCase() === n.toLowerCase());
    setRighe((rr) => [
      ...rr,
      {
        key: createId(),
        ingredienteId: match?.id,
        nome: match?.nome ?? n,
        reparto: match?.reparto ?? "Dispensa",
        quantita: "1",
        unita: match?.unitaDefault ?? "",
      },
    ]);
    setNuovo("");
  }

  async function salva() {
    const n = nome.trim();
    if (!n || salvando) return;
    setSalvando(true);
    try {
      const id = await saveDish(piatto, { nome: n, porzioni, procedimento, righe });
      onSaved(id);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        className="w-full rounded-lg border px-3 py-2.5"
        style={{ ...CAMPO, fontWeight: 600 }}
        placeholder="Nome del piatto"
        aria-label="Nome del piatto"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <div className="flex items-center justify-between">
        <span>Porzioni</span>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Diminuisci" onClick={() => setPorzioni((p) => Math.max(1, p - 1))} style={{ display: "flex" }}>
            <Minus size={16} strokeWidth={2.25} />
          </button>
          <span style={{ fontWeight: 700, color: "var(--biro)", fontVariantNumeric: "tabular-nums" }}>{porzioni}</span>
          <button type="button" aria-label="Aumenta" onClick={() => setPorzioni((p) => Math.min(20, p + 1))} style={{ display: "flex" }}>
            <Plus size={16} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <Label>Ingredienti</Label>
      {righe.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14, fontWeight: 600 }}>
            {r.nome}
          </span>
          <input
            inputMode="decimal"
            aria-label={`Quantità di ${r.nome}`}
            className="rounded-lg border px-2 py-2 text-sm text-right"
            style={{ ...CAMPO, width: 56, fontVariantNumeric: "tabular-nums" }}
            value={r.quantita}
            onChange={(e) => aggiorna(r.key, { quantita: e.target.value })}
          />
          <input
            aria-label={`Unità di ${r.nome}`}
            autoCapitalize="none"
            className="rounded-lg border px-2 py-2 text-sm"
            style={{ ...CAMPO, width: 84 }}
            placeholder="unità"
            value={r.unita}
            onChange={(e) => aggiorna(r.key, { unita: e.target.value })}
          />
          <button
            type="button"
            aria-label={`Togli ${r.nome}`}
            onClick={() => setRighe((rr) => rr.filter((x) => x.key !== r.key))}
            style={{ color: "var(--pomodoro)", display: "flex", minWidth: 32, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
            <MinusCircle size={18} strokeWidth={2} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border px-3 py-2.5 text-sm"
          style={CAMPO}
          placeholder="Aggiungi un ingrediente…"
          aria-label="Nuovo ingrediente"
          list="catalogo-ingredienti"
          value={nuovo}
          onChange={(e) => setNuovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aggiungi();
          }}
        />
        <datalist id="catalogo-ingredienti">
          {catalogo.filter((i) => !i.deletedAt).map((i) => (
            <option key={i.id} value={i.nome} />
          ))}
        </datalist>
        <Button variant="ghost" fullWidth={false} onClick={aggiungi} disabled={!nuovo.trim()} style={{ padding: "10px 14px", fontSize: 14 }}>
          Aggiungi
        </Button>
      </div>

      <Label>Procedimento</Label>
      <textarea
        rows={6}
        className="w-full rounded-xl border px-3 py-2.5 text-sm"
        style={{ ...CAMPO, resize: "vertical" }}
        placeholder="Un passo per riga"
        aria-label="Procedimento"
        value={procedimento}
        onChange={(e) => setProcedimento(e.target.value)}
      />

      <Button onClick={() => void salva()} disabled={!nome.trim() || salvando}>
        {salvando ? "Salvo…" : "Salva piatto"}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Annulla
      </Button>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div className="text-xs font-bold uppercase" style={{ letterSpacing: ".12em", color: "var(--text-secondary)", marginTop: 6 }}>
      {children}
    </div>
  );
}
