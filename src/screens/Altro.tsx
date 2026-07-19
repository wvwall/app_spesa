import { useRef, useState } from "react";
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

  async function spostaReparto(indice: number, direzione: -1 | 1) {
    const nuovoOrdine = [...profilo!.ordineReparti];
    const j = indice + direzione;
    if (j < 0 || j >= nuovoOrdine.length) return;
    [nuovoOrdine[indice], nuovoOrdine[j]] = [nuovoOrdine[j], nuovoOrdine[indice]];
    await db.profilo.update(profilo!.id, { ordineReparti: nuovoOrdine });
  }

  async function cambiaGiornoSpesa(valore: number) {
    await db.profilo.update(profilo!.id, { giornoSpesa: valore });
  }

  async function cambiaTema(tema: Tema) {
    await db.profilo.update(profilo!.id, { tema });
    const root = document.documentElement;
    if (tema === "sistema") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", tema === "scuro" ? "dark" : "light");
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
          <div className="flex flex-col gap-1.5">
            {profilo.ordineReparti.map((reparto, i) => (
              <div
                key={reparto}
                className="flex items-center gap-2.5 px-3 py-2.5 border rounded-xl"
                style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)" }}
              >
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{reparto}</span>
                <button onClick={() => void spostaReparto(i, -1)} aria-label="Sposta su" disabled={i === 0}>
                  ↑
                </button>
                <button
                  onClick={() => void spostaReparto(i, 1)}
                  aria-label="Sposta giù"
                  disabled={i === profilo.ordineReparti.length - 1}
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
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
            <Chip state={profilo.tema === "sistema" ? "selected" : "default"} onClick={() => void cambiaTema("sistema")}>
              Sistema
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
