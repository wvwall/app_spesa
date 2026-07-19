import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getOrCreateProfilo, nowIso, nuovoId } from "../lib/db";
import {
  getOrCreatePiano,
  getOrCreateSlots,
  assegnaPiattoASlot,
} from "../lib/piano";
import { generaListaDaPiano } from "../lib/lista";
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
import type { Piatto, Slot } from "../lib/types";

interface Props {
  onListaGenerata: () => void;
}

export function Settimana({ onListaGenerata }: Props) {
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

  const slots =
    useLiveQuery(
      () => (pianoId ? db.slot.where("pianoId").equals(pianoId).toArray() : []),
      [pianoId],
    ) ?? [];
  const piatti = useLiveQuery(() => db.piatti.toArray(), []) ?? [];
  const piattoDiId = (id?: string) => piatti.find((p) => p.id === id);

  const tuttiVuoti = slots.length > 0 && slots.every((s) => !s.piattoId);
  const slotsAssegnati = slots.filter((s) => s.piattoId).length;

  async function generaLista() {
    if (!pianoId) return;
    await generaListaDaPiano(pianoId);
    onListaGenerata();
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
              fontSize: 32,
              letterSpacing: "-0.02em",
              color: "var(--biro)",
            }}>
            {etichettaCiclo(inizio)}
          </h1>
          <div
            className="flex items-center gap-2.5 text-sm"
            style={{ color: "var(--text-secondary)" }}>
            <button
              onClick={() => setCicloOffset((w) => w - 1)}
              aria-label="Ciclo precedente">
              ‹
            </button>
            <button
              onClick={() => setCicloOffset(0)}
              style={{ color: "var(--biro)", fontWeight: 600 }}>
              oggi
            </button>
            <button
              onClick={() => setCicloOffset((w) => w + 1)}
              aria-label="Ciclo successivo">
              ›
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {tuttiVuoti && (
          <div className="text-center flex flex-col items-center gap-2 py-6">
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
              Scegli un piatto per un giorno qui sotto, o vai su Piatti per
              generarne uno con l'AI.
            </p>
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
            <div key={dataIso} className="mb-3">
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
    </div>
  );
}

function SlotRiga({
  slot,
  piatto,
  piattiDisponibili,
  porzioniDefault,
}: {
  slot: Slot;
  piatto?: Piatto;
  piattiDisponibili: Piatto[];
  porzioniDefault: number;
}) {
  const [ricerca, setRicerca] = useState(false);
  const [query, setQuery] = useState("");
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
              className="text-left px-2.5 py-2 rounded-lg text-sm"
              style={{ color: "var(--biro)", fontWeight: 600 }}
              onClick={() => void creaLiberoEAssegna(testoRicerca)}>
              + Usa “{testoRicerca}” così com'è
            </button>
          )}
          {piatto && (
            <button
              type="button"
              className="text-left px-2.5 py-2 rounded-lg text-sm"
              style={{ color: "var(--pomodoro)", fontWeight: 600 }}
              onClick={() => void assegna(undefined)}>
              ✕ Rimuovi piatto da questo pasto
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
            fontSize: 17,
            padding: "6px 4px",
            flex: "none",
          }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <CardPiatto when={etichettaPasto} empty onClick={() => setRicerca(true)} />
  );
}
