import { useId, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { CSSProperties } from "react";
import { Plus, ChevronDown, Trash2, ImagePlus, X, Upload, Share2, ArrowDownWideNarrow } from "lucide-react";
import { db, getOrCreateProfile, DEFAULT_DEPARTMENTS } from "../lib/database";
import { getOrCreateWeeklyPlan } from "../lib/weeklyPlan";
import { cycleStart, shiftCycle, toIsoDate, formatCycleLabel, formatCycleTitle } from "../lib/calendar";
import {
  deleteItem,
  deleteCompleteList,
  getListForPlan,
  getOrCreateOpenList,
  addFreeItem,
  updateItem,
  sortListByDepartment,
  importShoppingItems,
} from "../lib/shoppingList";
import type { ShoppingImportEntry } from "../lib/shoppingList";
import { groupByDepartment } from "../lib/departments";
import { splitUnitFromNote, joinUnitAndNote, UNITA_SUGGERITE } from "../lib/textImport";
import { buildListText, shareOrDownloadText } from "../lib/listExport";
import { formatQuantita } from "../lib/dishes";
import { Button, PageHeader, useUndoToast, Chip, CycleNavigator, Skeleton, ShoppingImportSheet } from "../components";
import type { ShoppingListItem } from "../lib/models";

/** Secondary list tools: icon over a short label, three per row, still 44px+ tall. */
const COMPACT_ACTION: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "9px 4px",
  fontSize: 13,
  minHeight: 60,
};

interface Props {
  cycleOffset: number;
  onCycleOffsetChange: (offset: number) => void;
  onStartShopping: (listaId: string) => void;
}

export function ShoppingList({ cycleOffset, onCycleOffsetChange, onStartShopping }: Props) {
  const profilo = useLiveQuery(() => getOrCreateProfile(), []);
  const showUndo = useUndoToast();
  // The displayed week follows the offset selected here with the ‹ today › navigator, rather
  // than being fixed to today. This lets users create or review a list for a specific week.
  const inizio = shiftCycle(cycleStart(new Date(), profilo?.giornoSpesa ?? 5), cycleOffset);
  const cicloIso = toIsoDate(inizio);

  const piano = useLiveQuery(() => db.piani.where("settimanaIso").equals(cicloIso).first(), [cicloIso]);
  // Show this week's list, used by both manual additions and generation, rather than an arbitrary
  // one (see getListForPlan). Include it after "Start shopping" closes it, so it remains visible
  // when returning to this screen.
  const lista = useLiveQuery(() => (piano ? getListForPlan(piano.id) : undefined), [piano?.id]);
  const voci = useLiveQuery(() => (lista ? db.voci.where("listaId").equals(lista.id).toArray() : []), [lista?.id]) ?? [];
  const ordineReparti = profilo?.ordineReparti ?? DEFAULT_DEPARTMENTS;
  const ingredientiCatalogo = useLiveQuery(() => db.ingredienti.toArray(), []) ?? [];

  // Alternatives (RF7) come from a local map (src/lib/alternatives.ts), with no AI or network
  // dependency, so no async preparation is needed before entering active shopping.
  async function closeAndStartShopping() {
    if (!lista) return;
    await db.liste.update(lista.id, { chiusa: true });
    onStartShopping(lista.id);
  }

  async function exportText() {
    if (!profilo) return;
    const titolo = `SPESA ${formatCycleLabel(inizio).replace("Settimana ", "")}`;
    const testo = buildListText(voci, profilo.ordineReparti, titolo);
    await shareOrDownloadText(testo, "lista-spesa.txt");
  }

  async function clearList() {
    if (!lista) return;
    const restore = await deleteCompleteList(lista.id);
    showUndo({ message: "Lista svuotata", onUndo: restore });
  }

  async function addItem(nome: string, reparto: string, quantita: string, fotoDataUrl?: string, nota?: string) {
    const piano = await getOrCreateWeeklyPlan(cicloIso);
    const listaAperta = await getOrCreateOpenList(piano.id);
    await addFreeItem(listaAperta.id, nome, quantita, reparto, fotoDataUrl, nota);
  }

  const [ordinando, setOrdinando] = useState(false);
  const [esitoOrdina, setEsitoOrdina] = useState<string | null>(null);
  const [itemBeingEdited, setItemBeingEdited] = useState<ShoppingListItem | null>(null);
  const [departmentWithForm, setDepartmentWithForm] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [esitoImport, setEsitoImport] = useState<string | null>(null);

  async function importList(righe: ShoppingImportEntry[]) {
    const pianoCorrente = await getOrCreateWeeklyPlan(cicloIso);
    const listaAperta = await getOrCreateOpenList(pianoCorrente.id);
    const esito = await importShoppingItems(listaAperta.id, righe);
    const parti = [
      `${esito.aggiunti} ${esito.aggiunti === 1 ? "nuovo" : "nuovi"}`,
    ];
    if (esito.aggiornati > 0) parti.push(`${esito.aggiornati} aggiornati`);
    setEsitoImport(`Importati ${esito.aggiunti + esito.aggiornati} articoli (${parti.join(", ")}).`);
  }

  async function sortByDepartment() {
    if (!lista) return;
    setOrdinando(true);
    setEsitoOrdina(null);
    try {
      const esito = await sortListByDepartment(lista.id, ordineReparti);
      if (esito.sistemati === 0 && esito.irrisolti === 0) {
        setEsitoOrdina("Erano già tutti a posto.");
      } else {
        let msg =
          esito.sistemati > 0
            ? `Sistemati ${esito.sistemati} articoli${esito.viaAI ? ` (${esito.viaAI} con l'AI)` : ""}.`
            : "Nessun articolo spostato.";
        if (esito.irrisolti > 0) {
          msg += esito.aiSaltata
            ? ` ${esito.irrisolti} non riconosciuti (AI non disponibile), restano in Dispensa.`
            : ` ${esito.irrisolti} restano in Dispensa.`;
        }
        setEsitoOrdina(msg);
      }
    } catch (e) {
      setEsitoOrdina(e instanceof Error ? e.message : "Non sono riuscito a ordinare la lista. Riprova.");
    } finally {
      setOrdinando(false);
    }
  }

  // Keep the header and navigator visible even when the list is empty, so users can browse weeks
  // and start a manual list for any week.
  const haVoci = !!lista && voci.length > 0;
  const gruppiReparto = groupByDepartment(voci, ordineReparti);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={formatCycleTitle(inizio)}
        actions={
          <CycleNavigator
            onPrecedente={() => onCycleOffsetChange(cycleOffset - 1)}
            onOggi={() => onCycleOffsetChange(0)}
            onSuccessivo={() => onCycleOffsetChange(cycleOffset + 1)}
          />
        }
        subtitle={haVoci ? `Lista della spesa · ${voci.length} ${voci.length === 1 ? "articolo" : "articoli"}` : "Lista della spesa"}
      />

      {profilo === undefined ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3.5 flex flex-col gap-2" aria-hidden="true">
          <Skeleton height={44} radius={14} />
          <Skeleton height={44} radius={14} />
          <Skeleton height={44} radius={14} />
        </div>
      ) : haVoci ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Items are grouped by department in the order configured in Settings, as in active
              shopping. Before "Sort by department", many items remain under "Dispensa". */}
          {gruppiReparto.map(({ reparto, voci: vociReparto }) => (
            <div key={reparto}>
              <div
                className="text-xs font-bold px-5 pt-3.5 pb-1"
                style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-secondary)" }}
              >
                {reparto}
              </div>
              {/* One card per department, rows separated by hairlines. */}
              <div
                className="mx-5 border rounded-2xl overflow-hidden"
                style={{ borderColor: "var(--border-quiet)", background: "var(--surface-card)" }}
              >
              {vociReparto.map((v, i) =>
                itemBeingEdited?.id === v.id ? (
                  <div
                    key={v.id}
                    className="px-3.5 py-3"
                    style={{ borderTop: i > 0 ? "1px solid var(--border-quiet)" : undefined }}
                  >
                    <AddShoppingItemForm
                      initiallyOpen
                      initialName={v.nome}
                      initialQuantity={v.quantita}
                      initialDepartment={v.reparto}
                      initialPhoto={v.fotoDataUrl}
                      initialNote={v.nota}
                      confirmLabel="Salva"
                      onAdd={async (nome, reparto, quantita, fotoDataUrl, nota) => {
                        await updateItem(v, { nome, reparto, quantita, fotoDataUrl, nota });
                        setItemBeingEdited(null);
                      }}
                      onCancel={() => setItemBeingEdited(null)}
                      reparti={ordineReparti}
                    />
                  </div>
                ) : (
                  <ShoppingListReviewRow key={v.id} voce={v} first={i === 0} onEdit={() => setItemBeingEdited(v)} />
                ),
              )}
              </div>
              <div className="px-5 pt-1 pb-2">
                {departmentWithForm === reparto ? (
                  <AddShoppingItemForm
                    initiallyOpen
                    initialDepartment={reparto}
                    reparti={ordineReparti}
                    onAdd={async (nome, repartoSelezionato, quantita, fotoDataUrl, nota) => {
                      await addItem(nome, repartoSelezionato, quantita, fotoDataUrl, nota);
                      setDepartmentWithForm(null);
                    }}
                    onCancel={() => setDepartmentWithForm(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs"
                    style={{ color: "var(--biro)", minHeight: 36 }}
                    onClick={() => setDepartmentWithForm(reparto)}
                  >
                    <Plus size={14} /> Aggiungi in {reparto}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="px-5 py-3">
            <AddShoppingItemForm reparti={ordineReparti} onAdd={addItem} />
          </div>
          {/* Keep the actions in the scrolling list instead of a fixed footer. This prevents
              overlap with the "Add item" form, especially when the keyboard is open, and avoids
              accidental taps on "Start shopping" while entering an item.
              The primary action comes first; secondary tools sit in one compact row, and the
              destructive "Clear list" is kept well away from "Start shopping". */}
          <div className="px-5 pt-4 pb-6 flex flex-col gap-2 border-t" style={{ borderColor: "var(--border-quiet)" }}>
            <Button onClick={() => void closeAndStartShopping()}>Inizia la spesa</Button>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                style={COMPACT_ACTION}
                onClick={() => void sortByDepartment()}
                disabled={ordinando}
              >
                <ArrowDownWideNarrow size={17} strokeWidth={2} />
                {ordinando ? "Ordino…" : "Ordina"}
              </Button>
              <Button variant="ghost" style={COMPACT_ACTION} onClick={exportText}>
                <Share2 size={17} strokeWidth={2} />
                Esporta
              </Button>
              <Button variant="ghost" style={COMPACT_ACTION} onClick={() => setImportOpen(true)}>
                <Upload size={17} strokeWidth={2} />
                Importa
              </Button>
            </div>
            {esitoOrdina && (
              <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>{esitoOrdina}</p>
            )}
            {esitoImport && (
              <p style={{ color: "var(--basilico)", fontSize: 13, margin: 0 }}>{esitoImport}</p>
            )}
            <button
              type="button"
              onClick={() => void clearList()}
              className="self-center"
              style={{ color: "var(--pomodoro)", fontSize: 13, marginTop: 28, minHeight: 44, padding: "0 12px" }}
            >
              Svuota lista
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center text-center gap-4 px-8">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>Nessuna lista ancora</div>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Aggiungi gli articoli a mano, oppure importa una lista che hai già scritto.
          </p>
          <div className="w-full flex flex-col gap-2">
            <AddShoppingItemForm reparti={ordineReparti} onAdd={addItem} centered />
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Upload size={15} strokeWidth={2.25} /> Importa lista
              </span>
            </Button>
          </div>
        </div>
      )}

      <ShoppingImportSheet
        open={importOpen}
        catalogo={ingredientiCatalogo}
        reparti={ordineReparti}
        onClose={() => setImportOpen(false)}
        onConfirm={importList}
      />
    </div>
  );
}

/** Adds a manual item (RF8, an extra item outside the meal plan). Always available, including
 * when no list has been generated from planned dishes. Creates the plan and list on demand if
 * needed (see getOrCreateWeeklyPlan/getOrCreateOpenList). */
function AddShoppingItemForm({
  reparti,
  onAdd,
  initiallyOpen = false,
  initialName = "",
  initialQuantity = "1",
  initialDepartment = null,
  initialPhoto,
  initialNote,
  confirmLabel = "Aggiungi",
  onCancel,
  centered = false,
}: {
  reparti: string[];
  /** `nota` already combines unit and free note (see joinUnitAndNote). */
  onAdd: (nome: string, reparto: string, quantita: string, fotoDataUrl?: string, nota?: string) => Promise<void>;
  initiallyOpen?: boolean;
  initialName?: string;
  initialQuantity?: string;
  initialDepartment?: string | null;
  initialPhoto?: string;
  initialNote?: string;
  confirmLabel?: string;
  onCancel?: () => void;
  /** Center the collapsed "Add item" link (used in the centered empty state). */
  centered?: boolean;
}) {
  // No department is preselected: chips stay hidden until opened. If none is chosen, the item
  // goes to the "Dispensa" catch-all department, matching the app's other fallbacks.
  const REPARTO_RIPIEGO = "Dispensa";
  const [aperto, setAperto] = useState(initiallyOpen);
  const [nome, setNome] = useState(initialName);
  const [quantita, setQuantita] = useState(initialQuantity);
  const idUnita = useId();
  const iniziali = splitUnitFromNote(initialNote);
  const [unita, setUnita] = useState(iniziali.unita ?? "");
  const [nota, setNota] = useState(iniziali.nota ?? "");
  const [reparto, setReparto] = useState<string | null>(initialDepartment);
  const [departmentsOpen, setRepartiAperti] = useState(false);
  const [isSaving, setSalvando] = useState(false);
  const [fotoDataUrl, setFotoDataUrl] = useState<string | undefined>(initialPhoto);
  const [photoError, setErroreFoto] = useState<string | null>(null);

  async function loadPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErroreFoto("Scegli un'immagine valida.");
      return;
    }
    try {
      setFotoDataUrl(await resizePhoto(file));
      setErroreFoto(null);
    } catch {
      setErroreFoto("Non riesco a caricare questa foto.");
    }
  }

  async function submit() {
    const trimmedName = nome.trim();
    if (!trimmedName || isSaving) return;
    setSalvando(true);
    try {
      await onAdd(
        trimmedName,
        reparto ?? REPARTO_RIPIEGO,
        quantita.trim(),
        fotoDataUrl,
        joinUnitAndNote(unita, nota),
      );
      setNome("");
      setQuantita("1");
      setUnita("");
      setNota("");
      setReparto(null);
      setFotoDataUrl(undefined);
      setRepartiAperti(false);
    } finally {
      setSalvando(false);
    }
  }

  if (!aperto) {
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 text-sm${centered ? " self-center" : ""}`}
        style={{ color: "var(--biro)", fontWeight: 600, minHeight: 44 }}
        onClick={() => setAperto(true)}
      >
        <Plus size={16} strokeWidth={2.25} /> Aggiungi articolo
      </button>
    );
  }

  const campo: CSSProperties = { borderColor: "var(--border-quiet)", background: "var(--surface-card)" };

  return (
    <div
      className="flex flex-col gap-2 border rounded-2xl p-3"
      style={{ borderColor: "var(--biro)", background: "var(--surface-card)" }}
    >
      {/* What */}
      <input
        autoFocus
        aria-label="Nome articolo"
        className="border rounded-lg px-3 py-2.5 text-sm w-full"
        style={{ ...campo, fontWeight: 600 }}
        placeholder="Nome articolo…"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />

      {/* How much and where: quantity and unit read as one value ("1 kg"), department beside. */}
      <div className="flex items-stretch gap-2">
        <div
          className="flex items-stretch flex-none border rounded-lg overflow-hidden border-border-quiet focus-within:border-biro"
          style={{ background: "var(--surface-card)" }}
        >
          <input
            inputMode="decimal"
            aria-label="Quantità"
            className="px-2.5 py-2.5 text-sm text-right"
            style={{ width: 52, border: 0, outline: "none", background: "transparent", fontVariantNumeric: "tabular-nums" }}
            placeholder="q.tà"
            value={quantita}
            onChange={(e) => setQuantita(e.target.value)}
          />
          <span aria-hidden="true" style={{ width: 1, background: "var(--border-quiet)", margin: "8px 0" }} />
          <input
            aria-label="Unità"
            list={idUnita}
            autoCapitalize="none"
            className="px-2.5 py-2.5 text-sm"
            style={{ width: 84, border: 0, outline: "none", background: "transparent" }}
            placeholder="unità"
            value={unita}
            onChange={(e) => setUnita(e.target.value)}
          />
          <datalist id={idUnita}>
            {UNITA_SUGGERITE.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
        <button
          type="button"
          aria-expanded={departmentsOpen}
          aria-label={reparto ? `Reparto: ${reparto}` : "Scegli reparto (opzionale)"}
          className="flex-1 min-w-0 inline-flex items-center justify-between gap-1 border rounded-lg px-3 text-sm"
          style={campo}
          onClick={() => setRepartiAperti((v) => !v)}
        >
          <span
            className="truncate"
            style={reparto ? { color: "var(--text-body)", fontWeight: 600 } : { color: "var(--text-secondary)" }}
          >
            {reparto ?? "Reparto"}
          </span>
          <ChevronDown
            size={15}
            strokeWidth={2.25}
            style={{
              flex: "none",
              color: "var(--text-secondary)",
              transform: departmentsOpen ? "rotate(180deg)" : undefined,
              transition: "transform .15s",
            }}
          />
        </button>
      </div>
      {departmentsOpen && (
        <div className="flex flex-wrap gap-2">
          {reparti.map((r) => (
            <Chip
              key={r}
              state={reparto === r ? "selected" : "default"}
              onClick={() => {
                // Tap the selected chip again to deselect it and return to the optional state.
                setReparto((corrente) => (corrente === r ? null : r));
                setRepartiAperti(false);
              }}
            >
              {r}
            </Chip>
          ))}
        </div>
      )}

      <input
        aria-label="Nota"
        className="border rounded-lg px-3 py-2.5 text-sm"
        style={campo}
        placeholder="Nota (es. quella in vetro)"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />

      {/* Actions on one row: photo on the left, cancel and confirm on the right. */}
      <div className="flex items-center gap-1 pt-1">
        <label
          className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
          style={{ color: "var(--biro)", minHeight: 44 }}
        >
          {fotoDataUrl ? (
            <img src={fotoDataUrl} alt="Anteprima" className="h-8 w-8 rounded-md object-cover" />
          ) : (
            <ImagePlus size={18} />
          )}
          {fotoDataUrl ? "Cambia" : "Foto"}
          <input
            type="file"
            accept="image/*"
            // No `capture`: the OS picker then offers both the camera and the photo library.
            className="sr-only"
            onChange={(event) => void loadPhoto(event.target.files?.[0])}
          />
        </label>
        {fotoDataUrl && (
          <button
            type="button"
            aria-label="Rimuovi foto"
            onClick={() => setFotoDataUrl(undefined)}
            style={{ color: "var(--text-secondary)", minWidth: 32, minHeight: 44, display: "grid", placeItems: "center" }}
          >
            <X size={16} />
          </button>
        )}
        <button
          type="button"
          className="ml-auto text-sm px-3"
          style={{ color: "var(--text-secondary)", minHeight: 44 }}
          onClick={() => {
            if (onCancel) onCancel();
            else setAperto(false);
          }}
        >
          annulla
        </button>
        <Button
          fullWidth={false}
          onClick={() => void submit()}
          disabled={!nome.trim() || isSaving}
          style={{ padding: "11px 22px" }}
        >
          {confirmLabel}
        </Button>
      </div>
      {photoError && (
        <p role="alert" className="text-xs" style={{ color: "var(--pomodoro)", margin: 0 }}>
          {photoError}
        </p>
      )}
    </div>
  );
}

async function resizePhoto(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas non disponibile");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Quantity read-only next to the unit: "500 g", "2 × 1 kg", "3". */
function quantitaLeggibile(q: string, unita?: string): string {
  const t = q.trim();
  if (!unita) return t || "—";
  const n = Number(t.replace(",", "."));
  if (t && Number.isFinite(n)) return formatQuantita(n, unita);
  return t ? `${t} ${unita}` : unita;
}

/** A light row: name and note, quantity as text; tap to edit, small trash to remove (undo). */
function ShoppingListReviewRow({ voce, first, onEdit }: { voce: ShoppingListItem; first: boolean; onEdit: () => void }) {
  const { unita, nota } = splitUnitFromNote(voce.nota);
  const showUndo = useUndoToast();

  async function removeItem() {
    const restore = await deleteItem(voce.id);
    showUndo({ message: `${voce.nome} eliminato`, onUndo: restore });
  }

  return (
    <div className="flex items-center" style={{ borderTop: first ? undefined : "1px solid var(--border-quiet)" }}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Modifica ${voce.nome}`}
        className="flex-1 min-w-0 flex items-center gap-2.5 text-left pl-3.5 py-2.5"
        style={{ minHeight: 48 }}
      >
        <span className="flex-1 min-w-0">
          <span style={{ display: "block", fontWeight: 500 }}>{voce.nome}</span>
          {nota && (
            <span style={{ display: "block", fontFamily: "var(--font-hand)", color: "var(--biro)", fontSize: 15 }}>“{nota}”</span>
          )}
        </span>
        <span
          className="flex-none"
          style={{ color: "var(--text-secondary)", fontSize: 14, fontVariantNumeric: "tabular-nums" }}
        >
          {quantitaLeggibile(voce.quantita, unita)}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Rimuovi ${voce.nome}`}
        onClick={() => void removeItem()}
        style={{ color: "var(--pomodoro)", minWidth: 42, minHeight: 44, display: "grid", placeItems: "center", flex: "none" }}
      >
        <Trash2 size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
