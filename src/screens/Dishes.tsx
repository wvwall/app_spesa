import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Pencil, Plus, ShieldCheck, Sparkles, Star, Trash2 } from "lucide-react";
import { db, getOrCreateProfile, DEFAULT_DEPARTMENTS } from "../lib/database";
import { deleteDishWithUndo, formatQuantita, toggleFavorite } from "../lib/dishes";
import { Button, PageHeader, useUndoToast, SearchInput, Skeleton, IconButton, BottomSheet } from "../components";
import { NewDishSheet } from "../components/dishes/NewDishSheet";
import { DishEditor } from "../components/dishes/DishEditor";
import { UseInMealSheet } from "../components/dishes/UseInMealSheet";
import type { Dish } from "../lib/models";

type Filtro = "tutti" | "preferiti" | "ai";

const FILTRI: { id: Filtro; label: string }[] = [
  { id: "tutti", label: "Tutti" },
  { id: "preferiti", label: "Preferiti" },
  { id: "ai", label: "AI" },
];

/** "Piatti": the recipe book first. Search, quick filters, rows that open the dish detail, and
 * "+" for a new dish (generated from ingredients or composed by hand). */
export function Dishes() {
  const showUndo = useUndoToast();
  const piattiRaw = useLiveQuery(() => db.piatti.toArray(), []);
  const righe = useLiveQuery(() => db.piattoIngredienti.toArray(), []) ?? [];
  const ingredienti = useLiveQuery(() => db.ingredienti.toArray(), []) ?? [];
  const profilo = useLiveQuery(() => getOrCreateProfile(), []);
  const caricamento = piattiRaw === undefined;

  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [aperto, setAperto] = useState<string | null>(null);
  const [nuovo, setNuovo] = useState(false);

  const testo = query.trim().toLowerCase();
  const conteggi = new Map<string, number>();
  for (const r of righe) conteggi.set(r.piattoId, (conteggi.get(r.piattoId) ?? 0) + 1);
  const piatti = (piattiRaw ?? [])
    .filter((p) => !p.deletedAt)
    .filter((p) => (filtro === "preferiti" ? p.preferito : filtro === "ai" ? p.origine === "ai" : true))
    .filter((p) => !testo || p.nome.toLowerCase().includes(testo))
    // Favorites first, then alphabetical.
    .sort((a, b) => Number(b.preferito) - Number(a.preferito) || a.nome.localeCompare(b.nome, "it"));

  const piattoAperto = aperto ? piattiRaw?.find((p) => p.id === aperto) : undefined;
  if (piattoAperto) {
    return (
      <DishDetail
        piatto={piattoAperto}
        giornoSpesa={profilo?.giornoSpesa ?? 5}
        porzioniDefault={profilo?.porzioniDefault ?? 2}
        onBack={() => setAperto(null)}
      />
    );
  }

  async function elimina(id: string) {
    const r = await deleteDishWithUndo(id);
    if (r) showUndo({ message: `${r.nome} eliminato`, onUndo: r.restore });
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Piatti"
        actions={
          <IconButton tone="accent" size={40} aria-label="Nuovo piatto" onClick={() => setNuovo(true)}>
            <Plus size={20} strokeWidth={2.25} />
          </IconButton>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8 flex flex-col gap-3">
        <SearchInput placeholder="Cerca un piatto…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div role="tablist" aria-label="Filtro" className="flex p-1 rounded-full" style={{ background: "var(--border-quiet)" }}>
          {FILTRI.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className="flex-1 rounded-full"
              style={{
                padding: "7px 0",
                fontSize: 13.5,
                fontWeight: filtro === f.id ? 700 : 500,
                background: filtro === f.id ? "var(--evidenziatore)" : "transparent",
                color: filtro === f.id ? "var(--on-evidenziatore)" : "var(--text-secondary)",
                boxShadow: filtro === f.id ? "inset 0 0 0 1px var(--evidenziatore-bordo)" : undefined,
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {caricamento && (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton height={56} radius={16} />
            <Skeleton height={56} radius={16} />
            <Skeleton height={56} radius={16} />
          </div>
        )}

        {!caricamento &&
          piatti.map((p) => {
            const n = conteggi.get(p.id) ?? 0;
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 border rounded-2xl"
                style={{
                  // Favorites carry a faint highlighter wash, like a marked page.
                  borderColor: p.preferito ? "var(--evidenziatore-bordo)" : "var(--border-quiet)",
                  background: p.preferito ? "var(--evidenziatore-velo)" : "var(--surface-card)",
                  minHeight: 56,
                }}>
                <button type="button" onClick={() => setAperto(p.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left px-3.5 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                      {p.preferito && <Star size={13} fill="var(--evidenziatore-bordo)" stroke="var(--evidenziatore-bordo)" aria-label="Preferito" />}
                      <span className="truncate">{p.nome}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text-secondary)" }}>
                      {n === 0 ? "Senza ingredienti" : n === 1 ? "1 ingrediente" : `${n} ingredienti`}
                    </span>
                  </span>
                  {p.origine === "ai" && <AiBadge />}
                  <ChevronRight size={16} style={{ color: "var(--text-secondary)", flex: "none" }} />
                </button>
                <button
                  type="button"
                  aria-label={`Elimina ${p.nome}`}
                  onClick={() => void elimina(p.id)}
                  style={{ color: "var(--pomodoro)", minWidth: 40, minHeight: 44, display: "grid", placeItems: "center", flex: "none" }}>
                  <Trash2 size={16} strokeWidth={2} />
                </button>
              </div>
            );
          })}

        {!caricamento && piatti.length === 0 && (
          <div className="text-center flex flex-col gap-2" style={{ padding: "28px 8px", color: "var(--text-secondary)", fontSize: 14 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "var(--text-body)" }}>
              {filtro === "preferiti"
                ? "Nessun preferito"
                : filtro === "ai"
                  ? "Nessun piatto generato"
                  : testo
                    ? "Nessun piatto trovato"
                    : "Il ricettario è vuoto"}
            </div>
            {filtro === "preferiti" && <p style={{ margin: 0 }}>Apri un piatto e tocca la stella.</p>}
            {filtro === "ai" && <p style={{ margin: 0 }}>Tocca + e scegli gli ingredienti che hai: l’AI ti propone un piatto.</p>}
            {filtro === "tutti" && !testo && (
              <p style={{ margin: 0 }}>Tocca + per generare un piatto dagli ingredienti che hai, o per scriverne uno.</p>
            )}
          </div>
        )}
      </div>

      <NewDishSheet
        open={nuovo}
        catalogo={ingredienti}
        reparti={profilo?.ordineReparti ?? DEFAULT_DEPARTMENTS}
        porzioniDefault={profilo?.porzioniDefault ?? 2}
        onClose={() => setNuovo(false)}
        onCreated={(id) => {
          setNuovo(false);
          setAperto(id);
        }}
      />
    </div>
  );
}

function AiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{ fontSize: 11, color: "var(--biro)", background: "var(--biro-chiaro)", borderRadius: 99, padding: "3px 8px", flex: "none" }}>
      <Sparkles size={11} strokeWidth={2} /> AI
    </span>
  );
}

/** A dish: ingredients with quantities, numbered method, servings, verified allergens; star,
 * edit, delete and "Usa in un pasto". */
function DishDetail({
  piatto,
  giornoSpesa,
  porzioniDefault,
  onBack,
}: {
  piatto: Dish;
  giornoSpesa: number;
  porzioniDefault: number;
  onBack: () => void;
}) {
  const showUndo = useUndoToast();
  const righe = useLiveQuery(() => db.piattoIngredienti.where("piattoId").equals(piatto.id).toArray(), [piatto.id]) ?? [];
  const catalogo = useLiveQuery(() => db.ingredienti.toArray(), []) ?? [];
  const [editing, setEditing] = useState(false);
  const [usando, setUsando] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  const ordinate = [...righe].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const passi = (piatto.procedimento ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  async function elimina() {
    const r = await deleteDishWithUndo(piatto.id);
    onBack();
    if (r) showUndo({ message: `${r.nome} eliminato`, onUndo: r.restore });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-4 flex items-center justify-between flex-none">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-0.5" style={{ color: "var(--biro)", fontWeight: 600, minHeight: 44, padding: "0 6px" }}>
          <ChevronLeft size={20} strokeWidth={2.25} /> Piatti
        </button>
        <div className="flex items-center gap-1.5 pr-2">
          <IconButton
            size={40}
            aria-label={piatto.preferito ? "Togli dai preferiti" : "Aggiungi ai preferiti"}
            aria-pressed={piatto.preferito}
            onClick={() => void toggleFavorite(piatto)}>
            <Star
              size={18}
              strokeWidth={2}
              fill={piatto.preferito ? "var(--evidenziatore-bordo)" : "none"}
              stroke={piatto.preferito ? "var(--evidenziatore-bordo)" : "currentColor"}
            />
          </IconButton>
          <IconButton size={40} aria-label="Modifica" onClick={() => setEditing(true)}>
            <Pencil size={16} strokeWidth={2} />
          </IconButton>
          <IconButton size={40} tone="danger" aria-label="Elimina" onClick={() => void elimina()}>
            <Trash2 size={16} strokeWidth={2} />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 flex flex-col gap-2">
        <h1 style={{ fontFamily: "var(--font-hand)", fontWeight: 800, fontSize: 30, lineHeight: 1.15, color: "var(--biro)", margin: "4px 0 0", paddingRight: ".2em" }}>
          <span className="tratto-evidenziatore">{piatto.nome}</span>
        </h1>
        <div className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {piatto.porzioni === 1 ? "1 porzione" : `${piatto.porzioni} porzioni`}
          {piatto.origine === "ai" && <AiBadge />}
        </div>
        {piatto.allergieVerificate && piatto.allergieVerificate.length > 0 && (
          <div className="flex items-center gap-1" style={{ fontSize: 12.5, color: "var(--basilico)" }}>
            <ShieldCheck size={14} strokeWidth={2} /> verificato: senza {piatto.allergieVerificate.join(", ")}
          </div>
        )}

        <Label>Ingredienti</Label>
        {ordinate.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Nessun ingrediente. Tocca la matita per aggiungerli.</p>
        ) : (
          <div className="border rounded-2xl" style={{ borderColor: "var(--border-quiet)", background: "var(--surface-card)" }}>
            {ordinate.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3.5"
                style={{ minHeight: 44, borderTop: i > 0 ? "1px solid var(--border-quiet)" : undefined }}>
                <span style={{ fontWeight: 500 }}>{r.nome}</span>
                <span style={{ fontSize: 14, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{formatQuantita(r.quantita, r.unita)}</span>
              </div>
            ))}
          </div>
        )}

        <Label>Procedimento</Label>
        {passi.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Nessun procedimento scritto.</p>
        ) : (
          <ol className="flex flex-col gap-2.5" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {passi.map((passo, i) => (
              <li key={i} className="flex gap-2.5" style={{ fontSize: 15 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--biro)", width: 18, textAlign: "right", flex: "none" }}>{i + 1}</span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
        )}
        {esito && <p style={{ color: "var(--basilico)", fontSize: 13, margin: "8px 0 0" }}>{esito}</p>}
      </div>

      <div className="px-5 pb-3 flex-none">
        <Button onClick={() => setUsando(true)}>Usa in un pasto</Button>
      </div>

      <BottomSheet open={editing} title="Modifica piatto" onClose={() => setEditing(false)} style={{ zIndex: 40, maxHeight: "92dvh", overflowY: "auto" }}>
        {editing && (
          <DishEditor
            piatto={piatto}
            righeIniziali={righe}
            catalogo={catalogo}
            porzioniDefault={porzioniDefault}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        )}
      </BottomSheet>
      <UseInMealSheet
        open={usando}
        piatto={piatto}
        giornoSpesa={giornoSpesa}
        onClose={() => setUsando(false)}
        onAssigned={(etichetta) => {
          setUsando(false);
          setEsito(`Aggiunto a ${etichetta}.`);
        }}
      />
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div className="text-xs font-bold uppercase" style={{ letterSpacing: ".12em", color: "var(--text-secondary)", marginTop: 14 }}>
      {children}
    </div>
  );
}
