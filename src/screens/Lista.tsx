import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { X, Plus } from "lucide-react";
import { db, getOrCreateProfilo, REPARTI_DEFAULT } from "../lib/db";
import { getOrCreatePiano } from "../lib/piano";
import { inizioCiclo, cicloSuccessivo, toIsoDate, etichettaCiclo } from "../lib/settimana";
import {
  eliminaVoce,
  aggiornaQuantita,
  eliminaListaCompleta,
  getOrCreaListaAperta,
  aggiungiVoceLibera,
} from "../lib/lista";
import { costruisciTestoLista, condividiOScaricaTesto } from "../lib/exportText";
import { Button, Chip, NavigatoreCiclo } from "../components";
import type { VoceLista } from "../lib/types";

interface Props {
  cicloOffset: number;
  onCicloOffsetChange: (offset: number) => void;
  onIniziaSpesa: (listaId: string) => void;
}

export function Lista({ cicloOffset, onCicloOffsetChange, onIniziaSpesa }: Props) {
  const profilo = useLiveQuery(() => getOrCreateProfilo(), []);
  // La settimana mostrata deriva dall'offset scelto qui in Lista (navigatore ‹ oggi ›), non più
  // fissa su "oggi": così si può creare/rivedere la lista di una settimana specifica.
  const inizio = cicloSuccessivo(inizioCiclo(new Date(), profilo?.giornoSpesa ?? 5), cicloOffset);
  const cicloIso = toIsoDate(inizio);

  const piano = useLiveQuery(() => db.piani.where("settimanaIso").equals(cicloIso).first(), [cicloIso]);
  const lista = useLiveQuery(() => (piano ? db.liste.where("pianoId").equals(piano.id).last() : undefined), [piano?.id]);
  const voci = useLiveQuery(() => (lista ? db.voci.where("listaId").equals(lista.id).toArray() : []), [lista?.id]) ?? [];
  const ordineReparti = profilo?.ordineReparti ?? REPARTI_DEFAULT;

  // Le alternative (RF7) sono già pronte da una mappa locale (src/lib/sostituzioni.ts), niente
  // AI né rete: non serve nessuna preparazione asincrona prima di entrare in spesa attiva.
  async function chiudiEIniziaSpesa() {
    if (!lista) return;
    await db.liste.update(lista.id, { chiusa: true });
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

  async function aggiungiArticolo(nome: string, reparto: string, quantita: string) {
    const piano = await getOrCreatePiano(cicloIso);
    const listaAperta = await getOrCreaListaAperta(piano.id);
    await aggiungiVoceLibera(listaAperta.id, nome, quantita, reparto);
  }

  // Header e navigatore restano sempre visibili (anche a lista vuota) così da poter scorrere le
  // settimane e iniziare una lista a mano da qualsiasi settimana.
  const haVoci = !!lista && voci.length > 0;

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-5 pb-3 flex-none border-b" style={{ borderColor: "var(--quadretto)" }}>
        <div className="flex items-center justify-between gap-2">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>Lista della spesa</div>
          <NavigatoreCiclo
            onPrecedente={() => onCicloOffsetChange(cicloOffset - 1)}
            onOggi={() => onCicloOffsetChange(0)}
            onSuccessivo={() => onCicloOffsetChange(cicloOffset + 1)}
          />
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
          {etichettaCiclo(inizio)}
          {haVoci && ` · ${voci.length} articoli`}
        </div>
      </header>

      {haVoci ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {voci.map((v) => (
            <RigaListaRevisione key={v.id} voce={v} />
          ))}
          <div className="px-5 py-3">
            <FormAggiungiArticolo reparti={ordineReparti} onAggiungi={aggiungiArticolo} />
          </div>
          {/* Le CTA scorrono insieme all'elenco invece di stare in un footer fisso: così non
              si sovrappongono al form "Aggiungi articolo" (soprattutto con la tastiera aperta)
              né rischi di toccare "Inizia la spesa" mentre inserisci un articolo. */}
          <div className="px-5 pt-3 pb-6 flex flex-col gap-2 border-t" style={{ borderColor: "var(--quadretto)" }}>
            <Button variant="ghost" onClick={esportaTesto}>
              Esporta testo
            </Button>
            <Button onClick={() => void chiudiEIniziaSpesa()}>Inizia la spesa</Button>
            <button
              type="button"
              onClick={() => void svuotaLista()}
              style={{ color: "var(--pomodoro)", fontSize: 13, marginTop: 4 }}
            >
              Svuota lista
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center text-center gap-4 px-8">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>Nessuna lista ancora</div>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Pianifica qualche pasto in Settimana e genera la lista da lì, oppure aggiungi articoli a mano.
          </p>
          <div className="w-full">
            <FormAggiungiArticolo reparti={ordineReparti} onAggiungi={aggiungiArticolo} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Aggiunge un articolo a mano (RF8 "articoli extra fuori menù"): sempre visibile, non solo
 * quando la lista arriva dai piatti pianificati. Crea piano/lista al volo se non esistono
 * ancora (vedi getOrCreatePiano/getOrCreaListaAperta). */
function FormAggiungiArticolo({
  reparti,
  onAggiungi,
}: {
  reparti: string[];
  onAggiungi: (nome: string, reparto: string, quantita: string) => Promise<void>;
}) {
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [quantita, setQuantita] = useState("");
  const [reparto, setReparto] = useState(reparti[0] ?? "Dispensa");
  const [salvando, setSalvando] = useState(false);

  async function conferma() {
    const nomeTrim = nome.trim();
    if (!nomeTrim || salvando) return;
    setSalvando(true);
    try {
      await onAggiungi(nomeTrim, reparto, quantita.trim());
      setNome("");
      setQuantita("");
    } finally {
      setSalvando(false);
    }
  }

  if (!aperto) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm"
        style={{ color: "var(--biro)", fontWeight: 600 }}
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
          className="border rounded-lg px-2.5 py-1.5 text-sm flex-1"
          style={{ borderColor: "var(--quadretto)" }}
          placeholder="Nome articolo…"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void conferma();
          }}
        />
        <input
          className="border rounded-lg px-2.5 py-1.5 text-sm text-right"
          style={{ borderColor: "var(--quadretto)", width: 88 }}
          placeholder="quantità"
          value={quantita}
          onChange={(e) => setQuantita(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {reparti.map((r) => (
          <Chip key={r} state={reparto === r ? "selected" : "default"} onClick={() => setReparto(r)}>
            {r}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => void conferma()} disabled={!nome.trim() || salvando} style={{ flex: 1 }}>
          Aggiungi
        </Button>
        <button
          type="button"
          className="text-xs px-1"
          style={{ color: "var(--text-secondary)" }}
          onClick={() => setAperto(false)}
        >
          chiudi
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
        style={{ color: "var(--pomodoro)", flex: "none", display: "flex" }}
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
