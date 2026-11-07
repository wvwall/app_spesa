import { useId, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { CSSProperties } from "react";
import { Plus, ChevronDown, Pencil, Trash2, ImagePlus, X, Upload, Share2, ArrowDownWideNarrow } from "lucide-react";
import { db, getOrCreateProfile, DEFAULT_DEPARTMENTS } from "../lib/database";
import { getOrCreateWeeklyPlan } from "../lib/weeklyPlan";
import { cycleStart, shiftCycle, toIsoDate, formatCycleLabel } from "../lib/calendar";
import {
  deleteItem,
  updateQuantity,
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
import { Button, Chip, CycleNavigator, Skeleton, ShoppingImportSheet } from "../components";
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
    if (!window.confirm("Cancellare tutta la lista? Non si può annullare.")) return;
    await deleteCompleteList(lista.id);
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
      <header className="px-5 pt-5 pb-3 flex-none border-b" style={{ borderColor: "var(--quadretto)" }}>
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate min-w-0" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Lista della spesa</h1>
          <CycleNavigator
            onPrecedente={() => onCycleOffsetChange(cycleOffset - 1)}
            onOggi={() => onCycleOffsetChange(0)}
            onSuccessivo={() => onCycleOffsetChange(cycleOffset + 1)}
          />
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
          {formatCycleLabel(inizio)}
          {haVoci && ` · ${voci.length} articoli`}
        </div>
      </header>

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
              {vociReparto.map((v) =>
                itemBeingEdited?.id === v.id ? (
                  <div key={v.id} className="px-5 py-3 border-b" style={{ borderColor: "var(--quadretto)" }}>
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
                  <ShoppingListReviewRow key={v.id} voce={v} onEdit={() => setItemBeingEdited(v)} />
                ),
              )}
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
          <div className="px-5 pt-4 pb-6 flex flex-col gap-2 border-t" style={{ borderColor: "var(--quadretto)" }}>
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

  return (
    <div
      className="flex flex-col gap-2 border rounded-2xl p-3"
      style={{ borderColor: "var(--biro)", background: "var(--surface-card)" }}
    >
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="border rounded-lg px-2.5 py-1.5 text-sm flex-1 min-w-0"
          style={{ borderColor: "var(--quadretto)" }}
          placeholder="Nome articolo…"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <input
          inputMode="numeric"
          aria-label="Quantità"
          className="border rounded-lg px-2.5 py-1.5 text-sm text-right"
          style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)", width: 56 }}
          placeholder="q.tà"
          value={quantita}
          onChange={(e) => setQuantita(e.target.value)}
        />
        <input
          aria-label="Unità"
          list={idUnita}
          autoCapitalize="none"
          className="border rounded-lg px-2.5 py-1.5 text-sm"
          style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)", width: 76 }}
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
      <input
        aria-label="Nota"
        className="border rounded-lg px-2.5 py-1.5 text-sm"
        style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)" }}
        placeholder="Nota (es. quella in vetro)"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />
      <button
        type="button"
        className="inline-flex items-center gap-1 self-start text-sm"
        style={{ color: "var(--text-secondary)" }}
        onClick={() => setRepartiAperti((v) => !v)}
      >
        Reparto:{" "}
        {reparto ? (
          <span style={{ color: "var(--biro)", fontWeight: 600 }}>{reparto}</span>
        ) : (
          <span style={{ fontStyle: "italic" }}>opzionale</span>
        )}
        <ChevronDown
          size={15}
          strokeWidth={2.25}
          style={{ transform: departmentsOpen ? "rotate(180deg)" : undefined, transition: "transform .15s" }}
        />
      </button>
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
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: "var(--biro)" }}>
          <ImagePlus size={17} /> {fotoDataUrl ? "Cambia foto" : "Aggiungi foto"}
          <input
            type="file"
            accept="image/*"
            // No `capture`: the OS picker then offers both the camera and the photo library.
            className="sr-only"
            onChange={(event) => void loadPhoto(event.target.files?.[0])}
          />
        </label>
        {fotoDataUrl && (
          <>
            <img src={fotoDataUrl} alt="Anteprima" className="h-10 w-10 rounded-md object-cover" />
            <button type="button" aria-label="Rimuovi foto" onClick={() => setFotoDataUrl(undefined)}>
              <X size={16} />
            </button>
          </>
        )}
        {photoError && <span role="alert" className="text-xs" style={{ color: "var(--pomodoro)" }}>{photoError}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => void submit()} disabled={!nome.trim() || isSaving} style={{ flex: 1 }}>
           {confirmLabel}
        </Button>
        <button
          type="button"
          className="text-xs px-1"
          style={{ color: "var(--text-secondary)" }}
           onClick={() => {
             if (onCancel) onCancel();
             else setAperto(false);
           }}
        >
          chiudi
        </button>
      </div>
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

function ShoppingListReviewRow({ voce, onEdit }: { voce: ShoppingListItem; onEdit: () => void }) {
  const [quantita, setQuantita] = useState(voce.quantita);
  const { unita, nota } = splitUnitFromNote(voce.nota);

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "var(--quadretto)" }}>
      <div className="flex-1 min-w-0">
        <div style={{ fontWeight: 600 }}>{voce.nome}</div>
        {nota && (
          <div style={{ fontFamily: "var(--font-hand)", color: "var(--biro)", fontSize: 15 }}>“{nota}”</div>
        )}
      </div>
      <label className="flex items-center gap-1.5 flex-none" style={{ marginRight: 6 }}>
        {/* Unit sits left of the box, right-aligned: quantity boxes line up against the actions
            on every row, and rows without a unit leave no gap. */}
        {unita && (
          <span
            className="truncate text-right"
            style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 76 }}
          >
            {unita}
          </span>
        )}
        <input
          inputMode="numeric"
          className="border rounded-lg px-2 py-1.5 text-sm text-right"
          style={{
            borderColor: "var(--quadretto)",
            background: "var(--surface-card)",
            width: 56,
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label={`Quantità di ${voce.nome}`}
          placeholder="—"
          value={quantita}
          onChange={(e) => setQuantita(e.target.value)}
          onBlur={() => void updateQuantity(voce.id, quantita)}
        />
      </label>
      <button
        type="button"
        aria-label={`Modifica ${voce.nome}`}
        onClick={onEdit}
        style={{ color: "var(--biro)", flex: "none", display: "flex", marginRight: 10 }}
      >
        <Pencil size={16} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={`Rimuovi ${voce.nome}`}
        onClick={() => void deleteItem(voce.id)}
        style={{ color: "var(--text-secondary)", flex: "none", display: "flex" }}
      >
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
