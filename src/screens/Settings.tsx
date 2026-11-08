import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus, GripVertical } from "lucide-react";
import { db, getOrCreateProfile } from "../lib/database";
import { applyTheme } from "../lib/theme";
import { removeGeminiApiKey, GEMINI_SETTINGS_ID } from "../lib/aiSettings";
import { downloadBackup, importBackup } from "../lib/backup";
import { Button, Chip, GeminiKeySheet } from "../components";
import type { Theme } from "../lib/models";
import { CATALOGO_ALLERGENI, trovaAllergene } from "../lib/allergens";
import packageJson from "../../package.json";

const GIORNI_OPZIONI: { label: string; valore: number }[] = [
  { label: "Lun", valore: 1 },
  { label: "Mar", valore: 2 },
  { label: "Mer", valore: 3 },
  { label: "Gio", valore: 4 },
  { label: "Ven", valore: 5 },
  { label: "Sab", valore: 6 },
  { label: "Dom", valore: 0 },
];

export function Settings() {
  const profilo = useLiveQuery(() => getOrCreateProfile(), []);
  const chiaveGeminiConfigurata = useLiveQuery(
    async () => Boolean((await db.aiSettings.get(GEMINI_SETTINGS_ID))?.geminiApiKey),
    [],
  );
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [dialogChiaveAI, setDialogChiaveAI] = useState(false);
  const [confermaRimozioneChiave, setConfermaRimozioneChiave] = useState(false);
  const [nuovoAllergene, setNuovoAllergene] = useState("");
  const [confermaRimozioneAllergene, setConfermaRimozioneAllergene] = useState<string | null>(null);

  if (!profilo) return null;

  async function addAllergene(nome: string) {
    const pulito = nome.trim();
    if (!pulito) return;
    const esistenti = profilo!.vincoliAlimentari.map((a) => a.toLowerCase());
    if (esistenti.includes(pulito.toLowerCase())) {
      setNuovoAllergene("");
      return;
    }
    await db.profilo.update(profilo!.id, { vincoliAlimentari: [...profilo!.vincoliAlimentari, pulito] });
    setNuovoAllergene("");
  }

  async function removeAllergene(nome: string) {
    await db.profilo.update(profilo!.id, {
      vincoliAlimentari: profilo!.vincoliAlimentari.filter((a) => a !== nome),
    });
    setConfermaRimozioneAllergene(null);
  }

  async function changeServings(delta: number) {
    const nuove = Math.max(1, profilo!.porzioniDefault + delta);
    await db.profilo.update(profilo!.id, { porzioniDefault: nuove });
  }

  async function changeShoppingDay(valore: number) {
    await db.profilo.update(profilo!.id, { giornoSpesa: valore });
  }

  async function changeTheme(tema: Theme) {
    await db.profilo.update(profilo!.id, { tema });
    applyTheme(tema);
  }

  async function handleRemoveGeminiKey() {
    await removeGeminiApiKey();
    setConfermaRimozioneChiave(false);
    setMessaggio("Chiave Gemini rimossa da questo browser.");
  }

  async function handleImport(file: File) {
    try {
      await importBackup(file);
      setMessaggio("Backup importato.");
    } catch (err) {
      setMessaggio(err instanceof Error ? err.message : "Import fallito.");
    }
  }

  const allergeniAttivi = new Set(
    profilo.vincoliAlimentari.map((a) => trovaAllergene(a)?.id).filter((id): id is string => Boolean(id)),
  );
  const allergeniSuggeriti = CATALOGO_ALLERGENI.filter(
    (a) =>
      !allergeniAttivi.has(a.id) &&
      !profilo.vincoliAlimentari.some((v) => v.toLowerCase() === a.etichetta.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-5 pb-3 flex-none">
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, lineHeight: "44px" }}>Altro</h1>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8 flex flex-col gap-6">
        <section>
          <Label>Porzioni</Label>
          <div
            className="flex items-center justify-between border rounded-2xl px-3.5 py-3"
            style={{ borderColor: "var(--border-quiet)", background: "var(--surface-card)" }}
          >
            <span style={{ fontWeight: 600 }}>Porzioni predefinite</span>
            <div className="flex items-center gap-3">
              <button onClick={() => void changeServings(-1)} aria-label="Diminuisci" style={{ display: "flex" }}>
                <Minus size={16} strokeWidth={2.25} />
              </button>
              <span style={{ fontWeight: 700, color: "var(--biro)" }}>{profilo.porzioniDefault} persone</span>
              <button onClick={() => void changeServings(1)} aria-label="Aumenta" style={{ display: "flex" }}>
                <Plus size={16} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </section>

        <section>
          <Label>Giorno della spesa</Label>
          <div className="flex flex-wrap gap-2">
            {GIORNI_OPZIONI.map((g) => (
              <Chip
                key={g.valore}
                state={profilo.giornoSpesa === g.valore ? "selected" : "default"}
                onClick={() => void changeShoppingDay(g.valore)}
              >
                {g.label}
              </Chip>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
            La settimana in "Settimana" parte da qui: dalla cena di questo giorno al pranzo dello stesso giorno la
            settimana successiva.
          </p>
        </section>

        <section>
          <Label>Allergie e vincoli</Label>
          {/* The heading and the red chips already say "avoid these": no extra label needed. */}
          {profilo.vincoliAlimentari.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Nessun vincolo attivo. L’AI non esclude nulla.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {profilo.vincoliAlimentari.map((a) => (
              <Chip
                key={a}
                state="allergen"
                onClick={() => {
                  if (trovaAllergene(a)?.id === "frutta-a-guscio") setConfermaRimozioneAllergene(a);
                  else void removeAllergene(a);
                }}
              >
                {a} ×
              </Chip>
            ))}
          </div>
          {confermaRimozioneAllergene && (
            <div
              className="flex flex-col gap-2 border rounded-2xl p-3 mt-3"
              style={{ borderColor: "var(--pomodoro)" }}
            >
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Rimuovere “{confermaRimozioneAllergene}”? È un vincolo di sicurezza: per la famiglia l’allergia è
                critica. Confermi di volerlo disattivare?
              </p>
              <div className="flex gap-2">
                <Button variant="warn" onClick={() => void removeAllergene(confermaRimozioneAllergene)}>
                  Rimuovi
                </Button>
                <Button variant="ghost" onClick={() => setConfermaRimozioneAllergene(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.5 }}>
            Le noci sono escluse di default. Ogni piatto generato dall’AI viene ricontrollato su questi vincoli;
            per allergie non riconosciute l’app non può garantire l’assenza, quindi controlla sempre gli ingredienti.
          </p>
          {allergeniSuggeriti.length > 0 && (
            <>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "12px 0 8px" }}>Aggiungi un allergene comune:</p>
              <div className="flex flex-wrap gap-2">
                {allergeniSuggeriti.map((a) => (
                  <Chip key={a.id} onClick={() => void addAllergene(a.etichetta)}>
                    + {a.etichetta}
                  </Chip>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <input
              className="border rounded-xl px-3 py-2.5 text-sm flex-1"
              style={{ borderColor: "var(--border-quiet)" }}
              placeholder="Altra allergia…"
              value={nuovoAllergene}
              onChange={(e) => setNuovoAllergene(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addAllergene(nuovoAllergene);
              }}
            />
            <Button
              fullWidth={false}
              onClick={() => void addAllergene(nuovoAllergene)}
              disabled={!nuovoAllergene.trim()}
              style={{ padding: "10px 14px", fontSize: 14, flex: "none" }}
            >
              Aggiungi
            </Button>
          </div>
        </section>

        <section>
          <Label>Ordine reparti</Label>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
            Tieni premuto e trascina per riordinare. Così vengono raggruppati in lista e in negozio.
          </p>
          <DepartmentOrder
            ordine={profilo.ordineReparti}
            onCambia={(nuovo) => void db.profilo.update(profilo.id, { ordineReparti: nuovo })}
          />
        </section>

        <section>
          <Label>Intelligenza artificiale</Label>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
            Per i suggerimenti AI puoi usare solo Google Gemini. La chiave resta salvata su questo dispositivo.
          </p>
          <div
            className="flex items-center justify-between gap-3 border rounded-2xl px-3.5 py-3"
            style={{ borderColor: "var(--border-quiet)", background: "var(--surface-card)" }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Google Gemini</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 3 }}>
                {chiaveGeminiConfigurata ? "Chiave configurata su questo browser" : "Chiave non configurata"}
              </div>
            </div>
            <Button
              fullWidth={false}
              onClick={() => setDialogChiaveAI(true)}
              style={{ padding: "10px 12px", fontSize: 13.5, flex: "none" }}
            >
              {chiaveGeminiConfigurata ? "Sostituisci" : "Configura"}
            </Button>
          </div>
          {chiaveGeminiConfigurata && !confermaRimozioneChiave && (
            <Button
              variant="warn"
              onClick={() => setConfermaRimozioneChiave(true)}
              style={{ marginTop: 8, fontSize: 14 }}
            >
              Rimuovi chiave
            </Button>
          )}
          {confermaRimozioneChiave && (
            <div className="flex flex-col gap-2 mt-2">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                Rimuovere la chiave da questo browser? Le funzioni base continueranno a essere disponibili.
              </p>
              <div className="flex gap-2">
                <Button variant="warn" onClick={() => void handleRemoveGeminiKey()}>
                  Rimuovi
                </Button>
                <Button variant="ghost" onClick={() => setConfermaRimozioneChiave(false)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </section>

        <section>
          <Label>Backup</Label>
          <div className="flex flex-col gap-2">
            <Button variant="ghost" onClick={() => void downloadBackup()}>
              Esporta backup (JSON)
            </Button>
            <Button variant="ghost" onClick={() => inputFileRef.current?.click()}>
              Importa backup
            </Button>
            <input
              ref={inputFileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
              }}
            />
            {messaggio && <p style={{ fontSize: 13, color: "var(--basilico)" }}>{messaggio}</p>}
          </div>
        </section>

        <section className="relative">
          <Label>Tema</Label>
          {profilo.tema === "stitch" && <StitchIllustration />}
          <div className="flex flex-wrap gap-2">
            <Chip state={profilo.tema === "sistema" ? "selected" : "default"} onClick={() => void changeTheme("sistema")}>
              Automatico
            </Chip>
            <Chip state={profilo.tema === "chiaro" ? "selected" : "default"} onClick={() => void changeTheme("chiaro")}>
              Chiaro
            </Chip>
            <Chip state={profilo.tema === "scuro" ? "selected" : "default"} onClick={() => void changeTheme("scuro")}>
              Scuro
            </Chip>
            <Chip state={profilo.tema === "stitch" ? "selected" : "default"} onClick={() => void changeTheme("stitch")}>
              Stitch
            </Chip>
          </div>
          {profilo.tema === "sistema" && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
              Chiaro o scuro come il telefono, anche per l'icona nella scheda del browser.
            </p>
          )}
        </section>

        <p style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", marginTop: 4 }}>
          Quaderno della spesa · v{packageJson.version} · dati salvati solo su questo telefono
        </p>
      </div>
      <GeminiKeySheet
        open={dialogChiaveAI}
        onClose={() => setDialogChiaveAI(false)}
        onSaved={() => {
          setDialogChiaveAI(false);
          setMessaggio("Chiave Gemini salvata su questo browser.");
        }}
      />
    </div>
  );
}

function StitchIllustration() {
  const [visibile, setVisibile] = useState(true);
  if (!visibile) return null;
  // A die-cut sticker (transparent art with a baked white outline) stuck on the page corner,
  // slightly tilted, instead of a framed picture.
  return (
    <img
      src="/stitch/stitch-sticker-3.webp"
      alt=""
      aria-hidden="true"
      onError={() => setVisibile(false)}
      style={{
        position: "absolute",
        right: -4,
        top: -10,
        width: 78,
        height: "auto",
        transform: "rotate(9deg)",
        filter: "drop-shadow(0 4px 6px rgba(20, 33, 61, 0.22))",
        pointerEvents: "none",
      }}
    />
  );
}

function Label({ children }: { children: string }) {
  return (
    <div className="text-xs font-bold uppercase mb-2" style={{ letterSpacing: ".12em", color: "var(--text-secondary)" }}>
      {children}
    </div>
  );
}

/** Reordering via Pointer Events works with touch, mouse, and pen without external libraries;
 * native HTML5 drag-and-drop is unreliable on mobile. During a drag, the item follows the
 * pointer using a translateY offset from its starting position. The rest of the list reorders
 * live when the pointer crosses the midpoint of a neighboring row. Row pitch is measured from
 * the actual distance between rows instead of using a fixed value. */
function DepartmentOrder({ ordine, onCambia }: { ordine: string[]; onCambia: (nuovo: string[]) => void }) {
  const [elementi, setElementi] = useState(ordine);
  const [trascinato, setTrascinato] = useState<string | null>(null);
  const [offsetY, setOffsetY] = useState(0);
  const trascinaRef = useRef<{ startY: number; startIndex: number; pitch: number } | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    setElementi(ordine);
  }, [ordine]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, reparto: string) {
    const riga = rowRefs.current.get(reparto);
    if (!riga) return;
    const righe = elementi.map((r) => rowRefs.current.get(r)).filter((el): el is HTMLDivElement => !!el);
    const pitch =
      righe.length > 1
        ? righe[1].getBoundingClientRect().top - righe[0].getBoundingClientRect().top
        : riga.getBoundingClientRect().height + 6;
    trascinaRef.current = { startY: e.clientY, startIndex: elementi.indexOf(reparto), pitch: pitch || 46 };
    setTrascinato(reparto);
    setOffsetY(0);
    riga.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!trascinato || !trascinaRef.current) return;
    const { startY, startIndex, pitch } = trascinaRef.current;
    const rawDelta = e.clientY - startY;
    const indiceAttuale = elementi.indexOf(trascinato);
    const indiceTarget = Math.max(0, Math.min(elementi.length - 1, startIndex + Math.round(rawDelta / pitch)));
    if (indiceTarget !== indiceAttuale) {
      const nuovi = [...elementi];
      nuovi.splice(indiceAttuale, 1);
      nuovi.splice(indiceTarget, 0, trascinato);
      setElementi(nuovi);
    }
    setOffsetY(rawDelta - (indiceTarget - startIndex) * pitch);
  }

  function handlePointerUp() {
    if (!trascinato) return;
    setTrascinato(null);
    setOffsetY(0);
    trascinaRef.current = null;
    onCambia(elementi);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {elementi.map((reparto) => (
        <div
          key={reparto}
          ref={(el) => {
            if (el) rowRefs.current.set(reparto, el);
            else rowRefs.current.delete(reparto);
          }}
          onPointerDown={(e) => handlePointerDown(e, reparto)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex items-center gap-2.5 px-3 py-2.5 border rounded-xl select-none"
          style={{
            borderColor: "var(--border-quiet)",
            background: "var(--surface-card)",
            touchAction: "none",
            position: trascinato === reparto ? "relative" : undefined,
            transform: trascinato === reparto ? `translateY(${offsetY}px)` : undefined,
            zIndex: trascinato === reparto ? 10 : undefined,
            boxShadow: trascinato === reparto ? "0 6px 16px rgba(0,0,0,.18)" : undefined,
            transition: trascinato === reparto ? "none" : "transform 160ms ease, box-shadow 160ms ease",
          }}
        >
          <span aria-hidden style={{ display: "flex", color: "var(--text-secondary)", cursor: "grab" }}>
            <GripVertical size={17} strokeWidth={2} />
          </span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{reparto}</span>
        </div>
      ))}
    </div>
  );
}
