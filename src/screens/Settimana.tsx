import { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Sparkles, X, RotateCcw, Plus } from "lucide-react";
import { db, getOrCreateProfilo, nowIso, nuovoId } from "../lib/db";
import {
  getOrCreatePiano,
  getOrCreateSlots,
  assegnaPiattoASlot,
} from "../lib/piano";
import { generaListaDaPiano } from "../lib/lista";
import { generaPiatto, generaSettimana, type PiattoGenerato } from "../lib/ai";
import { salvaPiattoGenerato } from "../lib/piatti";
import {
  inizioCiclo,
  cicloSuccessivo,
  giorniDelCiclo,
  toIsoDate,
  etichettaGiorno,
  etichettaCiclo,
  isOggi,
} from "../lib/settimana";
import { CardPiatto, Button, SearchInput } from "../components";
import type { Ingrediente, Piatto, Slot } from "../lib/types";

// Pasti per chiamata AI: generare tutta la settimana (fino a ~14 piatti completi) in
// un'unica risposta supera facilmente il timeout della function. Blocchi più piccoli,
// lanciati in parallelo, restano veloci e il modello continua a vedere più pasti insieme
// (quindi a variarli) invece di ricevere sempre lo stesso prompt generico per uno alla volta.
const DIMENSIONE_BLOCCO_SETTIMANA = 4;

function suddividiInBlocchi<T>(elementi: T[], dimensione: number): T[][] {
  const blocchi: T[][] = [];
  for (let i = 0; i < elementi.length; i += dimensione) {
    blocchi.push(elementi.slice(i, i + dimensione));
  }
  return blocchi;
}

// Disabilitato per ora: anche a blocchi, generare tutta la settimana in un colpo solo non
// convince (tempi/qualità). Resta la generazione per singolo pasto, che tiene conto dei
// piatti già scelti nella settimana per evitare doppioni.
const GENERA_SETTIMANA_ABILITATO = false;

interface PropostaSettimana {
  slotId: string;
  giornoEPasto: string;
  generato: PiattoGenerato;
  esclusa: boolean;
}

interface Props {
  onListaGenerata: () => void;
}

export function Settimana({ onListaGenerata }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [todayEl, setTodayEl] = useState<HTMLDivElement | null>(null);

  const profilo = useLiveQuery(() => getOrCreateProfilo(), []);
  const giornoSpesa = profilo?.giornoSpesa ?? 5;

  const [cicloOffset, setCicloOffset] = useState(0);
  const inizio = cicloSuccessivo(
    inizioCiclo(new Date(), giornoSpesa),
    cicloOffset,
  );
  const cicloIso = toIsoDate(inizio);
  const giorni = giorniDelCiclo(inizio);

  const [pianoId, setPianoId] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    void (async () => {
      const piano = await getOrCreatePiano(cicloIso);
      await getOrCreateSlots(piano.id, inizio);
      if (!annullato) setPianoId(piano.id);
    })();
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloIso]);

  // Porta il giorno corrente in cima all'area scrollabile, con un'animazione morbida che fa
  // capire all'utente cosa sta succedendo: la pagina parte dall'alto e scorre dolcemente
  // verso oggi. Il piccolo delay iniziale serve a due cose: dà tempo ai useLiveQuery di
  // piatti/ingredienti di finire e al layout di stabilizzarsi (un'animazione smooth avviata
  // prima verrebbe interrotta dai re-render, lasciando lo scroll a metà), e rende il
  // movimento percepibile invece che istantaneo. Scrolliamo direttamente il container noto,
  // così non c'è ambiguità su quale antenato scrollabile si muove.
  const DELAY_SCROLL_MS = 350;
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!todayEl || !container) return;
    const timer = setTimeout(() => {
      const top =
        todayEl.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
      container.scrollTo({ top, behavior: "smooth" });
    }, DELAY_SCROLL_MS);
    return () => clearTimeout(timer);
  }, [todayEl]);

  const slots =
    useLiveQuery(
      () => (pianoId ? db.slot.where("pianoId").equals(pianoId).toArray() : []),
      [pianoId],
    ) ?? [];
  const piatti = useLiveQuery(() => db.piatti.toArray(), []) ?? [];
  const ingredientiCatalogo = useLiveQuery(() => db.ingredienti.toArray(), []) ?? [];
  const piattoDiId = (id?: string) => piatti.find((p) => p.id === id);
  const piattiAssegnatiSettimana = slots
    .filter((s) => s.piattoId)
    .map((s) => ({ slotId: s.id, nome: piattoDiId(s.piattoId)?.nome }))
    .filter((p): p is { slotId: string; nome: string } => !!p.nome);

  const tuttiVuoti = slots.length > 0 && slots.every((s) => !s.piattoId);
  const slotsAssegnati = slots.filter((s) => s.piattoId).length;

  const [generandoSettimana, setGenerandoSettimana] = useState(false);
  const [propostaSettimana, setPropostaSettimana] = useState<PropostaSettimana[] | null>(null);
  const [erroreSettimana, setErroreSettimana] = useState<string | null>(null);

  async function generaLista() {
    if (!pianoId) return;
    await generaListaDaPiano(pianoId);
    onListaGenerata();
  }

  async function generaInteraSettimana() {
    const slotVuoti = slots.filter((s) => !s.piattoId);
    if (slotVuoti.length === 0) return;
    const giornoPerData = new Map(giorni.map((g) => [toIsoDate(g), g]));
    const slotPerId = new Map(slotVuoti.map((s) => [s.id, s]));
    const blocchi = suddividiInBlocchi(slotVuoti, DIMENSIONE_BLOCCO_SETTIMANA);

    setGenerandoSettimana(true);
    setErroreSettimana(null);
    try {
      const risultatiPerBlocco = await Promise.allSettled(
        blocchi.map((blocco) =>
          generaSettimana({
            pasti: blocco.map((s) => ({ id: s.id, pasto: s.pasto })),
            vincoli: profilo?.vincoliAlimentari ?? ["noci"],
            porzioni: profilo?.porzioniDefault ?? 4,
          })
        )
      );

      const proposte: PropostaSettimana[] = [];
      for (const risultatoBlocco of risultatiPerBlocco) {
        if (risultatoBlocco.status !== "fulfilled") continue;
        for (const { id, generato } of risultatoBlocco.value) {
          const slot = slotPerId.get(id);
          if (!slot) continue;
          const giorno = giornoPerData.get(slot.data);
          const etichettaPasto = slot.pasto === "pranzo" ? "Pranzo" : "Cena";
          proposte.push({
            slotId: slot.id,
            giornoEPasto: giorno ? `${etichettaGiorno(giorno)} · ${etichettaPasto}` : etichettaPasto,
            generato,
            esclusa: false,
          });
        }
      }

      if (proposte.length === 0) {
        setErroreSettimana("Non sono riuscito a generare nessun piatto. Riprova.");
        return;
      }
      const mancanti = slotVuoti.length - proposte.length;
      if (mancanti > 0) {
        setErroreSettimana(`${mancanti} piatti non sono arrivati, riprova più tardi solo per quei giorni.`);
      }
      setPropostaSettimana(proposte);
    } catch (e) {
      setErroreSettimana(e instanceof Error ? e.message : "Non sono riuscito a generare la settimana. Riprova.");
    } finally {
      setGenerandoSettimana(false);
    }
  }

  function toggleEsclusioneProposta(slotId: string) {
    setPropostaSettimana((proposte) =>
      proposte ? proposte.map((p) => (p.slotId === slotId ? { ...p, esclusa: !p.esclusa } : p)) : proposte
    );
  }

  async function confermaPropostaSettimana() {
    if (!propostaSettimana) return;
    for (const p of propostaSettimana.filter((p) => !p.esclusa)) {
      // eslint-disable-next-line no-await-in-loop
      const piattoId = await salvaPiattoGenerato(p.generato, [], ingredientiCatalogo);
      // eslint-disable-next-line no-await-in-loop
      await assegnaPiattoASlot(p.slotId, piattoId);
    }
    setPropostaSettimana(null);
    setErroreSettimana(null);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-5 pb-2 flex-none">
        <div
          className="text-xs"
          style={{
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}>
          La spesa di casa
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <h1
            className="mt-0.5"
            style={{
              fontFamily: "var(--font-hand)",
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: "-0.02em",
              color: "var(--biro)",
            }}>
            {etichettaCiclo(inizio)}
          </h1>
          <div
            className="flex items-center text-sm"
            style={{ color: "var(--text-secondary)" }}>
            <button
              type="button"
              onClick={() => setCicloOffset((w) => w - 1)}
              aria-label="Settimana precedente"
              style={{
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setCicloOffset(0)}
              style={{
                color: "var(--biro)",
                fontWeight: 600,
                minHeight: 44,
                padding: "0 8px",
              }}>
              oggi
            </button>
            <button
              type="button"
              onClick={() => setCicloOffset((w) => w + 1)}
              aria-label="Settimana successiva"
              style={{
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <ChevronRight size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4" ref={scrollContainerRef}>
        {tuttiVuoti && (
          <div className="text-center flex flex-col items-center gap-3 py-6">
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "-0.01em",
              }}>
              Il menù è ancora in bianco
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 15,
                lineHeight: 1.5,
              }}>
              Scegli un piatto per un giorno qui sotto, o fatti proporre l'intera settimana.
            </p>
            {GENERA_SETTIMANA_ABILITATO && (
              <div className="w-full px-4">
                <Button onClick={() => void generaInteraSettimana()} disabled={generandoSettimana}>
                  {generandoSettimana ? (
                    "Sto pensando alla settimana…"
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles size={15} strokeWidth={2} /> Genera l'intera settimana
                    </span>
                  )}
                </Button>
              </div>
            )}
            {erroreSettimana && !propostaSettimana && (
              <p style={{ color: "var(--pomodoro)", fontSize: 13 }}>{erroreSettimana}</p>
            )}
          </div>
        )}
        {giorni.map((giorno) => {
          const dataIso = toIsoDate(giorno);
          const slotGiorno = slots
            .filter((s) => s.data === dataIso)
            .sort(
              (a, b) =>
                (a.pasto === "pranzo" ? 0 : 1) - (b.pasto === "pranzo" ? 0 : 1),
            );
          if (slotGiorno.length === 0) return null;
          return (
            <div
              key={dataIso}
              className="mb-3"
              ref={isOggi(giorno) ? setTodayEl : undefined}
            >
              <div
                className="text-xs font-bold mb-2"
                style={{
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: isOggi(giorno)
                    ? "var(--biro)"
                    : "var(--text-secondary)",
                }}>
                {etichettaGiorno(giorno)} {isOggi(giorno) && "· oggi"}
              </div>
              <div className="flex flex-col gap-2">
                {slotGiorno.map((slot) => (
                  <SlotRiga
                    key={slot.id}
                    slot={slot}
                    piatto={piattoDiId(slot.piattoId)}
                    piattiDisponibili={piatti}
                    porzioniDefault={profilo?.porzioniDefault ?? 4}
                    vincoliAlimentari={profilo?.vincoliAlimentari ?? ["noci"]}
                    ingredientiCatalogo={ingredientiCatalogo}
                    piattiAssegnatiSettimana={piattiAssegnatiSettimana}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!tuttiVuoti && cicloOffset === 0 && (
        <div className="px-5 pb-3 flex-none">
          <Button onClick={generaLista} disabled={slotsAssegnati === 0}>
            Genera lista spesa · {slotsAssegnati} piatti
          </Button>
        </div>
      )}

      {propostaSettimana && (
        <div
          className="fixed inset-0 flex flex-col justify-end"
          style={{ background: "rgba(35,38,30,.35)", zIndex: 20 }}
        >
          <div
            className="flex flex-col gap-3 p-4"
            style={{
              background: "var(--surface-card)",
              borderRadius: "20px 20px 0 0",
              maxHeight: "80vh",
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>
              Proposta per la settimana
            </div>
            {erroreSettimana && <p style={{ color: "var(--pomodoro)", fontSize: 13 }}>{erroreSettimana}</p>}
            <div className="flex flex-col gap-1.5 overflow-y-auto">
              {propostaSettimana.map((p) => (
                <div
                  key={p.slotId}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 border rounded-xl"
                  style={{ borderColor: "var(--quadretto)", opacity: p.esclusa ? 0.5 : 1 }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                      {p.giornoEPasto}
                    </div>
                    <div style={{ fontWeight: 600, textDecoration: p.esclusa ? "line-through" : "none" }}>
                      {p.generato.nome}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleEsclusioneProposta(p.slotId)}
                    aria-label={p.esclusa ? `Includi ${p.generato.nome}` : `Escludi ${p.generato.nome}`}
                    style={{
                      color: p.esclusa ? "var(--basilico)" : "var(--pomodoro)",
                      flex: "none",
                      minWidth: 44,
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {p.esclusa ? <RotateCcw size={18} strokeWidth={2} /> : <X size={18} strokeWidth={2} />}
                  </button>
                </div>
              ))}
            </div>
            <Button onClick={() => void confermaPropostaSettimana()}>
              Conferma {propostaSettimana.filter((p) => !p.esclusa).length} piatti
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPropostaSettimana(null);
                setErroreSettimana(null);
              }}
            >
              Annulla tutto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotRiga({
  slot,
  piatto,
  piattiDisponibili,
  porzioniDefault,
  vincoliAlimentari,
  ingredientiCatalogo,
  piattiAssegnatiSettimana,
}: {
  slot: Slot;
  piatto?: Piatto;
  piattiDisponibili: Piatto[];
  porzioniDefault: number;
  vincoliAlimentari: string[];
  ingredientiCatalogo: Ingrediente[];
  piattiAssegnatiSettimana: { slotId: string; nome: string }[];
}) {
  const [ricerca, setRicerca] = useState(false);
  const [query, setQuery] = useState("");
  const [rigenerazione, setRigenerazione] = useState(false);
  const [erroreRigenerazione, setErroreRigenerazione] = useState<string | null>(null);
  const etichettaPasto = slot.pasto === "pranzo" ? "Pranzo" : "Cena";

  async function assegna(piattoId: string | undefined) {
    await assegnaPiattoASlot(slot.id, piattoId);
    setRicerca(false);
    setQuery("");
  }

  async function creaLiberoEAssegna(nome: string) {
    const piattoId = nuovoId();
    const nuovo: Piatto = {
      id: piattoId,
      nome,
      preferito: false,
      origine: "manuale",
      porzioni: porzioniDefault,
      updatedAt: nowIso(),
    };
    await db.piatti.add(nuovo);
    await assegna(piattoId);
  }

  async function generaConAI() {
    setRigenerazione(true);
    setErroreRigenerazione(null);
    try {
      const evitaPiatti = piattiAssegnatiSettimana
        .filter((p) => p.slotId !== slot.id)
        .map((p) => p.nome);
      const generato = await generaPiatto({
        ingredienti: [],
        vincoli: vincoliAlimentari,
        porzioni: porzioniDefault,
        pasto: slot.pasto,
        evitaPiatti,
      });
      const nuovoPiattoId = await salvaPiattoGenerato(generato, [], ingredientiCatalogo);
      await assegna(nuovoPiattoId);
    } catch (e) {
      setErroreRigenerazione(e instanceof Error ? e.message : "Il piatto non è arrivato. Riprova.");
    } finally {
      setRigenerazione(false);
    }
  }

  if (ricerca) {
    const testoRicerca = query.trim();
    const risultati = piattiDisponibili.filter((p) =>
      p.nome.toLowerCase().includes(testoRicerca.toLowerCase()),
    );
    const corrispondenzaEsatta = risultati.some(
      (p) => p.nome.toLowerCase() === testoRicerca.toLowerCase(),
    );
    return (
      <div
        className="flex flex-col gap-2 border rounded-2xl p-2.5"
        style={{
          borderColor: "var(--biro)",
          background: "var(--surface-card)",
        }}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchInput
              autoFocus
              placeholder="Cerca o scrivi un piatto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="text-xs px-1 flex-none"
            style={{ color: "var(--text-secondary)" }}
            onClick={() => {
              setRicerca(false);
              setQuery("");
            }}>
            annulla
          </button>
        </div>
        <button
          type="button"
          className="text-left px-2.5 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
          style={{ color: "var(--biro)", fontWeight: 600 }}
          onClick={() => void generaConAI()}
          disabled={rigenerazione}
        >
          {rigenerazione ? (
            "Sto pensando a un piatto…"
          ) : (
            <>
              <Sparkles size={15} strokeWidth={2} /> {piatto ? "Rigenera con AI" : "Genera con AI"}
            </>
          )}
        </button>
        {erroreRigenerazione && (
          <p style={{ color: "var(--pomodoro)", fontSize: 13 }}>{erroreRigenerazione}</p>
        )}
        <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
          {risultati.map((p) => (
            <button
              key={p.id}
              type="button"
              className="text-left px-2.5 py-2 rounded-lg text-sm"
              style={{ color: "var(--text-body)", fontWeight: 600 }}
              onClick={() => void assegna(p.id)}>
              {p.nome}
            </button>
          ))}
          {risultati.length === 0 && testoRicerca === "" && (
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 13,
                padding: "4px 2px",
              }}>
              Scrivi per cercare nel ricettario, o descrivi un piatto al volo.
            </p>
          )}
          {testoRicerca !== "" && !corrispondenzaEsatta && (
            <button
              type="button"
              className="text-left px-2.5 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
              style={{ color: "var(--biro)", fontWeight: 600 }}
              onClick={() => void creaLiberoEAssegna(testoRicerca)}>
              <Plus size={15} strokeWidth={2.25} /> Usa “{testoRicerca}” così com'è
            </button>
          )}
          {piatto && (
            <button
              type="button"
              className="text-left px-2.5 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
              style={{ color: "var(--pomodoro)", fontWeight: 600 }}
              onClick={() => void assegna(undefined)}>
              <X size={15} strokeWidth={2.25} /> Rimuovi piatto da questo pasto
            </button>
          )}
        </div>
      </div>
    );
  }

  if (piatto) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <CardPiatto
            when={etichettaPasto}
            dish={piatto.nome}
            ai={piatto.origine === "ai"}
            onClick={() => setRicerca(true)}
          />
        </div>
        <button
          type="button"
          aria-label={`Rimuovi ${piatto.nome} da questo pasto`}
          onClick={() => void assegna(undefined)}
          style={{
            color: "var(--pomodoro)",
            padding: "6px 4px",
            flex: "none",
            display: "flex",
          }}>
          <X size={17} strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <CardPiatto when={etichettaPasto} empty onClick={() => setRicerca(true)} />
  );
}
