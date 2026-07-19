import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getOrCreateProfilo } from "../lib/db";
import { inizioCiclo, toIsoDate, etichettaCiclo } from "../lib/settimana";
import { eliminaVoce, aggiornaQuantita, eliminaListaCompleta } from "../lib/lista";
import { costruisciTestoLista, condividiOScaricaTesto } from "../lib/exportText";
import { suggerisciAlternative } from "../lib/ai";
import { Button } from "../components";
import type { VoceLista } from "../lib/types";

interface Props {
  onIniziaSpesa: (listaId: string) => void;
}

export function Lista({ onIniziaSpesa }: Props) {
  const profilo = useLiveQuery(() => getOrCreateProfilo(), []);
  const inizio = inizioCiclo(new Date(), profilo?.giornoSpesa ?? 5);
  const cicloIso = toIsoDate(inizio);

  const piano = useLiveQuery(() => db.piani.where("settimanaIso").equals(cicloIso).first(), [cicloIso]);
  const lista = useLiveQuery(() => (piano ? db.liste.where("pianoId").equals(piano.id).last() : undefined), [piano?.id]);
  const voci = useLiveQuery(() => (lista ? db.voci.where("listaId").equals(lista.id).toArray() : []), [lista?.id]) ?? [];

  const [preparazione, setPreparazione] = useState(false);

  async function chiudiEIniziaSpesa() {
    if (!lista) return;
    setPreparazione(true);
    // Pre-genera le alternative per ogni voce, così funzionano offline in negozio (RF7).
    // Se l'AI non è disponibile (nessuna rete/chiave), si prosegue comunque: le alternative
    // restano vuote e la spesa attiva mostra che non ce ne sono per quell'articolo.
    for (const voce of voci) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const alternative = await suggerisciAlternative({
          nomeIngrediente: voce.nome,
          contestoPiatto: "",
          vincoli: profilo?.vincoliAlimentari ?? [],
        });
        if (alternative.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await db.voci.update(voce.id, { alternative });
        }
      } catch {
        // offline o AI non configurata: si prosegue senza alternative pre-generate
      }
    }
    await db.liste.update(lista.id, { chiusa: true });
    setPreparazione(false);
    onIniziaSpesa(lista.id);
  }

  async function esportaTesto() {
    if (!profilo) return;
    const titolo = `SPESA ${etichettaCiclo(inizio).replace("Settimana ", "")}`;
    const testo = costruisciTestoLista(voci, profilo.ordineReparti, titolo);
    await condividiOScaricaTesto(testo, "lista-spesa.txt");
  }

  async function svuotaLista() {
    if (!lista) return;
    if (!window.confirm("Cancellare tutta la lista? Dovrai rigenerarla da Settimana.")) return;
    await eliminaListaCompleta(lista.id);
  }

  if (!lista || voci.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-8">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>Nessuna lista ancora</div>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Pianifica qualche pasto in Settimana e genera la lista da lì.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-5 pb-3 flex-none border-b" style={{ borderColor: "var(--quadretto)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>Lista della spesa</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
          {etichettaCiclo(inizio)} · {voci.length} articoli
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {voci.map((v) => (
          <RigaListaRevisione key={v.id} voce={v} />
        ))}
      </div>
      <div className="px-5 py-4 flex flex-col gap-2 flex-none border-t" style={{ borderColor: "var(--quadretto)" }}>
        <Button variant="ghost" onClick={esportaTesto}>
          Esporta testo
        </Button>
        <Button onClick={chiudiEIniziaSpesa} disabled={preparazione}>
          {preparazione ? "Preparo la spesa…" : "Inizia la spesa"}
        </Button>
        <button
          type="button"
          onClick={() => void svuotaLista()}
          style={{ color: "var(--pomodoro)", fontSize: 13, marginTop: 4 }}
        >
          Svuota lista
        </button>
      </div>
    </div>
  );
}

function RigaListaRevisione({ voce }: { voce: VoceLista }) {
  const [quantita, setQuantita] = useState(voce.quantita);

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "var(--quadretto)" }}>
      <div className="flex-1">
        <div style={{ fontWeight: 600 }}>{voce.nome}</div>
        {voce.nota && (
          <div style={{ fontFamily: "var(--font-hand)", color: "var(--biro)", fontSize: 15 }}>“{voce.nota}”</div>
        )}
      </div>
      <input
        className="border rounded-lg px-2 py-1.5 text-sm text-right"
        style={{ borderColor: "var(--quadretto)", width: 96 }}
        placeholder="quantità"
        value={quantita}
        onChange={(e) => setQuantita(e.target.value)}
        onBlur={() => void aggiornaQuantita(voce.id, quantita)}
      />
      <button
        type="button"
        aria-label={`Rimuovi ${voce.nome}`}
        onClick={() => void eliminaVoce(voce.id)}
        style={{ color: "var(--pomodoro)", fontSize: 16, flex: "none" }}
      >
        ✕
      </button>
    </div>
  );
}
