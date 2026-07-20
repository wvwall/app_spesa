import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getOrCreateProfilo } from "../lib/db";
import { scaricaBackup, importaBackup } from "../lib/backup";
import { Button, Chip, Badge } from "../components";
import type { Tema } from "../lib/types";

const GIORNI_OPZIONI: { label: string; valore: number }[] = [
  { label: "Lun", valore: 1 },
  { label: "Mar", valore: 2 },
  { label: "Mer", valore: 3 },
  { label: "Gio", valore: 4 },
  { label: "Ven", valore: 5 },
  { label: "Sab", valore: 6 },
  { label: "Dom", valore: 0 },
];

export function Altro() {
  const profilo = useLiveQuery(() => getOrCreateProfilo(), []);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);

  if (!profilo) return null;

  async function cambiaPorzioni(delta: number) {
    const nuove = Math.max(1, profilo!.porzioniDefault + delta);
    await db.profilo.update(profilo!.id, { porzioniDefault: nuove });
  }

  async function cambiaGiornoSpesa(valore: number) {
    await db.profilo.update(profilo!.id, { giornoSpesa: valore });
  }

  async function cambiaTema(tema: Tema) {
    await db.profilo.update(profilo!.id, { tema });
    document.documentElement.setAttribute("data-theme", tema === "scuro" ? "dark" : "light");
  }

  async function gestisciImport(file: File) {
    try {
      await importaBackup(file);
      setMessaggio("Backup importato.");
    } catch (err) {
      setMessaggio(err instanceof Error ? err.message : "Import fallito.");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-5 pb-3 flex-none">
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>Altro</h1>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8 flex flex-col gap-6">
        <section>
          <Etichetta>Porzioni</Etichetta>
          <div
            className="flex items-center justify-between border rounded-2xl px-3.5 py-3"
            style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)" }}
          >
            <span style={{ fontWeight: 600 }}>Porzioni predefinite</span>
            <div className="flex items-center gap-3">
              <button onClick={() => void cambiaPorzioni(-1)} aria-label="Diminuisci">
                −
              </button>
              <span style={{ fontWeight: 700, color: "var(--biro)" }}>{profilo.porzioniDefault} persone</span>
              <button onClick={() => void cambiaPorzioni(1)} aria-label="Aumenta">
                +
              </button>
            </div>
          </div>
        </section>

        <section>
          <Etichetta>Giorno della spesa</Etichetta>
          <div className="flex flex-wrap gap-2">
            {GIORNI_OPZIONI.map((g) => (
              <Chip
                key={g.valore}
                state={profilo.giornoSpesa === g.valore ? "selected" : "default"}
                onClick={() => void cambiaGiornoSpesa(g.valore)}
              >
                {g.label}
              </Chip>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--inchiostro-70)", marginTop: 8, lineHeight: 1.5 }}>
            La settimana in "Settimana" parte da qui: dalla cena di questo giorno al pranzo dello stesso giorno la
            settimana successiva.
          </p>
        </section>

        <section>
          <Etichetta>Vincoli alimentari</Etichetta>
          <Badge kind="allergene" />
          <p style={{ fontSize: 12.5, color: "var(--inchiostro-70)", marginTop: 8, lineHeight: 1.5 }}>
            Per disattivarlo serve una conferma doppia. Ogni piatto generato dall'AI riporta «✓ verificato: senza noci».
          </p>
        </section>

        <section>
          <Etichetta>Ordine reparti</Etichetta>
          <p style={{ fontSize: 12.5, color: "var(--inchiostro-70)", marginBottom: 8, lineHeight: 1.5 }}>
            Tieni premuto e trascina per riordinare. Così vengono raggruppati in lista e in negozio.
          </p>
          <OrdineReparti
            ordine={profilo.ordineReparti}
            onCambia={(nuovo) => void db.profilo.update(profilo.id, { ordineReparti: nuovo })}
          />
        </section>

        <section>
          <Etichetta>Backup</Etichetta>
          <div className="flex flex-col gap-2">
            <Button variant="ghost" onClick={() => void scaricaBackup()}>
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
                if (file) void gestisciImport(file);
              }}
            />
            {messaggio && <p style={{ fontSize: 13, color: "var(--basilico)" }}>{messaggio}</p>}
          </div>
        </section>

        <section>
          <Etichetta>Tema</Etichetta>
          <div className="flex gap-2">
            <Chip state={profilo.tema === "chiaro" ? "selected" : "default"} onClick={() => void cambiaTema("chiaro")}>
              Chiaro
            </Chip>
            <Chip state={profilo.tema === "scuro" ? "selected" : "default"} onClick={() => void cambiaTema("scuro")}>
              Scuro
            </Chip>
          </div>
        </section>

        <p style={{ fontSize: 12, color: "var(--inchiostro-70)", textAlign: "center", marginTop: 4 }}>
          Quaderno della spesa · v1.0 · dati salvati solo su questo telefono
        </p>
      </div>
    </div>
  );
}

function Etichetta({ children }: { children: string }) {
  return (
    <div className="text-xs font-bold uppercase mb-2" style={{ letterSpacing: ".12em", color: "var(--inchiostro-70)" }}>
      {children}
    </div>
  );
}

/** Riordino via Pointer Events (funziona con touch, mouse e penna senza librerie esterne:
 * la DnD nativa HTML5 non è affidabile su mobile). Durante il trascinamento l'elemento
 * segue il dito con un translateY calcolato sulla posizione di partenza; il resto della
 * lista si riordina "dal vivo" quando lo spostamento supera la metà di una riga vicina,
 * col passo (pitch) misurato dalla distanza reale fra due righe invece di un valore fisso. */
function OrdineReparti({ ordine, onCambia }: { ordine: string[]; onCambia: (nuovo: string[]) => void }) {
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
            borderColor: "var(--quadretto)",
            background: "var(--surface-card)",
            touchAction: "none",
            position: trascinato === reparto ? "relative" : undefined,
            transform: trascinato === reparto ? `translateY(${offsetY}px)` : undefined,
            zIndex: trascinato === reparto ? 10 : undefined,
            boxShadow: trascinato === reparto ? "0 6px 16px rgba(0,0,0,.18)" : undefined,
            transition: trascinato === reparto ? "none" : "transform 160ms ease, box-shadow 160ms ease",
          }}
        >
          <span aria-hidden style={{ color: "var(--inchiostro-70)", fontSize: 17, letterSpacing: "-1.5px", cursor: "grab" }}>
            ⋮⋮
          </span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{reparto}</span>
        </div>
      ))}
    </div>
  );
}
