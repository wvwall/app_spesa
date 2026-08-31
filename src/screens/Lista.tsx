import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { db, getOrCreateProfilo, REPARTI_DEFAULT } from "../lib/db";
import { getOrCreatePiano } from "../lib/piano";
import { inizioCiclo, cicloSuccessivo, toIsoDate, etichettaCiclo } from "../lib/settimana";
import {
  eliminaVoce,
  aggiornaQuantita,
  eliminaListaCompleta,
  getListaDelPiano,
  getOrCreaListaAperta,
  aggiungiVoceLibera,
  aggiornaVoce,
  ordinaListaPerReparto,
} from "../lib/lista";
import { raggruppaPerReparto } from "../lib/reparti";
import { costruisciTestoLista, condividiOScaricaTesto } from "../lib/exportText";
import { Button, Chip, NavigatoreCiclo, Skeleton } from "../components";
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
  // Mostra la lista della settimana (la stessa in cui scrivono aggiunta manuale e generazione),
  // non una a caso: vedi getListaDelPiano. La include anche dopo "Inizia la spesa" (chiusa), così
  // la lista non "sparisce" tornando qui.
  const lista = useLiveQuery(() => (piano ? getListaDelPiano(piano.id) : undefined), [piano?.id]);
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

  const [ordinando, setOrdinando] = useState(false);
  const [esitoOrdina, setEsitoOrdina] = useState<string | null>(null);
  const [voceInModifica, setVoceInModifica] = useState<VoceLista | null>(null);

  async function ordinaPerReparto() {
    if (!lista) return;
    setOrdinando(true);
    setEsitoOrdina(null);
    try {
      const esito = await ordinaListaPerReparto(lista.id, ordineReparti);
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

  // Header e navigatore restano sempre visibili (anche a lista vuota) così da poter scorrere le
  // settimane e iniziare una lista a mano da qualsiasi settimana.
  const haVoci = !!lista && voci.length > 0;
  const gruppiReparto = raggruppaPerReparto(voci, ordineReparti);

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

      {profilo === undefined ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3.5 flex flex-col gap-2" aria-hidden="true">
          <Skeleton height={44} radius={14} />
          <Skeleton height={44} radius={14} />
          <Skeleton height={44} radius={14} />
        </div>
      ) : haVoci ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Voci raggruppate per reparto (nell'ordine impostato in Altro), come la spesa
              attiva. Prima di "Ordina per reparto" molte voci sono sotto "Dispensa". */}
          {gruppiReparto.map(({ reparto, voci: vociReparto }) => (
            <div key={reparto}>
              <div
                className="text-xs font-bold px-5 pt-3.5 pb-1"
                style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-secondary)" }}
              >
                {reparto}
              </div>
              {vociReparto.map((v) =>
                voceInModifica?.id === v.id ? (
                  <div key={v.id} className="px-5 py-3 border-b" style={{ borderColor: "var(--quadretto)" }}>
                    <FormAggiungiArticolo
                      apertoInizialmente
                      nomeIniziale={v.nome}
                      quantitaIniziale={v.quantita}
                      repartoIniziale={v.reparto}
                      testoConferma="Salva"
                      onAggiungi={async (nome, reparto, quantita) => {
                        await aggiornaVoce(v, { nome, reparto, quantita });
                        setVoceInModifica(null);
                      }}
                      onAnnulla={() => setVoceInModifica(null)}
                      reparti={ordineReparti}
                    />
                  </div>
                ) : (
                  <RigaListaRevisione key={v.id} voce={v} onModifica={() => setVoceInModifica(v)} />
                ),
              )}
            </div>
          ))}
          <div className="px-5 py-3">
            <FormAggiungiArticolo reparti={ordineReparti} onAggiungi={aggiungiArticolo} />
          </div>
          {/* Le CTA scorrono insieme all'elenco invece di stare in un footer fisso: così non
              si sovrappongono al form "Aggiungi articolo" (soprattutto con la tastiera aperta)
              né rischi di toccare "Inizia la spesa" mentre inserisci un articolo. */}
          <div className="px-5 pt-3 pb-6 flex flex-col gap-2 border-t" style={{ borderColor: "var(--quadretto)" }}>
            <Button variant="ghost" onClick={() => void ordinaPerReparto()} disabled={ordinando}>
              {ordinando ? "Ordino per reparto…" : "Ordina per reparto"}
            </Button>
            {esitoOrdina && (
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{esitoOrdina}</p>
            )}
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
  apertoInizialmente = false,
  nomeIniziale = "",
  quantitaIniziale = "1",
  repartoIniziale = null,
  testoConferma = "Aggiungi",
  onAnnulla,
}: {
  reparti: string[];
  onAggiungi: (nome: string, reparto: string, quantita: string) => Promise<void>;
  apertoInizialmente?: boolean;
  nomeIniziale?: string;
  quantitaIniziale?: string;
  repartoIniziale?: string | null;
  testoConferma?: string;
  onAnnulla?: () => void;
}) {
  // Nessun reparto preselezionato: le chips restano nascoste finché non le apri, e se non
  // scegli niente l'articolo finisce nel catch-all "Dispensa" (come gli altri fallback dell'app).
  const REPARTO_RIPIEGO = "Dispensa";
  const [aperto, setAperto] = useState(apertoInizialmente);
  const [nome, setNome] = useState(nomeIniziale);
  const [quantita, setQuantita] = useState(quantitaIniziale);
  const [reparto, setReparto] = useState<string | null>(repartoIniziale);
  const [repartiAperti, setRepartiAperti] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function conferma() {
    const nomeTrim = nome.trim();
    if (!nomeTrim || salvando) return;
    setSalvando(true);
    try {
      await onAggiungi(nomeTrim, reparto ?? REPARTO_RIPIEGO, quantita.trim());
      setNome("");
      setQuantita("1");
      setReparto(null);
      setRepartiAperti(false);
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
          style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)", width: 88 }}
          placeholder="quantità"
          value={quantita}
          onChange={(e) => setQuantita(e.target.value)}
        />
      </div>
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
          style={{ transform: repartiAperti ? "rotate(180deg)" : undefined, transition: "transform .15s" }}
        />
      </button>
      {repartiAperti && (
        <div className="flex flex-wrap gap-2">
          {reparti.map((r) => (
            <Chip
              key={r}
              state={reparto === r ? "selected" : "default"}
              onClick={() => {
                // Ritocca la stessa chip per deselezionarla e tornare a "opzionale".
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
        <Button onClick={() => void conferma()} disabled={!nome.trim() || salvando} style={{ flex: 1 }}>
           {testoConferma}
        </Button>
        <button
          type="button"
          className="text-xs px-1"
          style={{ color: "var(--text-secondary)" }}
           onClick={() => {
             if (onAnnulla) onAnnulla();
             else setAperto(false);
           }}
        >
          chiudi
        </button>
      </div>
    </div>
  );
}

function RigaListaRevisione({ voce, onModifica }: { voce: VoceLista; onModifica: () => void }) {
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
        style={{
          borderColor: "var(--quadretto)",
          background: "var(--surface-card)",
          width: 96,
          marginRight: 6,
        }}
        placeholder="quantità"
        value={quantita}
        onChange={(e) => setQuantita(e.target.value)}
        onBlur={() => void aggiornaQuantita(voce.id, quantita)}
      />
      <button
        type="button"
        aria-label={`Modifica ${voce.nome}`}
        onClick={onModifica}
        style={{ color: "var(--biro)", flex: "none", display: "flex", marginRight: 10 }}
      >
        <Pencil size={16} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={`Rimuovi ${voce.nome}`}
        onClick={() => void eliminaVoce(voce.id)}
        style={{ color: "var(--pomodoro)", flex: "none", display: "flex" }}
      >
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
