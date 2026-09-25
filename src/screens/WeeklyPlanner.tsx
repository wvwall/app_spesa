import { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, X, RotateCcw, Plus } from "lucide-react";
import { db, getOrCreateProfile, nowIso, createId } from "../lib/database";
import {
  getOrCreateWeeklyPlan,
  getOrCreatePlanSlots,
  assignDishToSlot,
} from "../lib/weeklyPlan";
import { generateListFromPlan } from "../lib/shoppingList";
import { generateDish, generateWeek, type GeneratedDish } from "../lib/ai";
import { saveGeneratedDish } from "../lib/dishes";
import {
  cycleStart,
  shiftCycle,
  cycleDays,
  toIsoDate,
  formatDayLabel,
  formatCycleLabel,
  isToday,
} from "../lib/calendar";
import { DishCard, Button, SearchInput, Badge, CycleNavigator, Skeleton } from "../components";
import type { Ingredient, Dish, Slot } from "../lib/models";

// Meals per AI request: generating the entire week (up to ~14 complete dishes) in one response
// can easily exceed the function timeout. Smaller parallel batches remain fast and let the
// model see multiple meals at once, encouraging variety over repeated one-meal prompts.
const DIMENSIONE_BLOCCO_SETTIMANA = 4;

function splitIntoChunks<T>(elementi: T[], dimensione: number): T[][] {
  const blocchi: T[][] = [];
  for (let i = 0; i < elementi.length; i += dimensione) {
    blocchi.push(elementi.slice(i, i + dimensione));
  }
  return blocchi;
}

// Disabled for now: even in batches, generating the whole week at once has not met expectations
// for speed and quality. Single-meal generation remains and accounts for dishes already chosen
// during the week to avoid duplicates.
const GENERA_SETTIMANA_ABILITATO = false;

interface WeekProposal {
  slotId: string;
  dayAndMeal: string;
  generato: GeneratedDish;
  esclusa: boolean;
}

interface Props {
  cycleOffset: number;
  onCycleOffsetChange: (offset: number) => void;
  onListGenerated: (cycleOffset: number) => void;
}

export function WeeklyPlanner({ cycleOffset, onCycleOffsetChange, onListGenerated }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [todayEl, setTodayEl] = useState<HTMLDivElement | null>(null);

  const profilo = useLiveQuery(() => getOrCreateProfile(), []);
  const giornoSpesa = profilo?.giornoSpesa ?? 5;

  const inizio = shiftCycle(
    cycleStart(new Date(), giornoSpesa),
    cycleOffset,
  );
  const cicloIso = toIsoDate(inizio);
  const giorni = cycleDays(inizio);

  const [pianoId, setPianoId] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    void (async () => {
      const piano = await getOrCreateWeeklyPlan(cicloIso);
      await getOrCreatePlanSlots(piano.id, inizio);
      if (!annullato) setPianoId(piano.id);
    })();
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloIso]);

  // Smoothly scroll the current day near the top of the scroll area so the movement is clear:
  // the page starts at the top and glides toward today. Keep the previous day visible above it
  // as context instead of pinning today to the edge, so target the previous day's block. A short
  // initial delay lets dish/ingredient useLiveQuery calls finish and the layout settle; an early
  // smooth scroll would be interrupted by rerenders and stop halfway. Scroll the known container
  // directly to avoid ambiguity about which ancestor should move.
  const DELAY_SCROLL_MS = 350;
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!todayEl || !container) return;
    const timer = setTimeout(() => {
      const target = todayEl.previousElementSibling ?? todayEl;
      const top =
        target.getBoundingClientRect().top -
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
  const dishById = (id?: string) => piatti.find((p) => p.id === id);
  const dishesAssignedThisWeek = slots
    .filter((s) => s.piattoId)
    .map((s) => ({ slotId: s.id, nome: dishById(s.piattoId)?.nome }))
    .filter((p): p is { slotId: string; nome: string } => !!p.nome);

  const tuttiVuoti = slots.length > 0 && slots.every((s) => !s.piattoId);
  const slotsAssegnati = slots.filter((s) => s.piattoId).length;

  const [generandoSettimana, setGenerandoSettimana] = useState(false);
  const [propostaSettimana, setPropostaSettimana] = useState<WeekProposal[] | null>(null);
  const [erroreSettimana, setErroreSettimana] = useState<string | null>(null);
  const [generandoLista, setGenerandoLista] = useState(false);
  const [erroreLista, setErroreLista] = useState<string | null>(null);

  async function generateList() {
    if (!pianoId) return;
    setGenerandoLista(true);
    setErroreLista(null);
    try {
      await generateListFromPlan(pianoId);
      onListGenerated(cycleOffset);
    } catch (e) {
      // Without this try/catch, errors were silently ignored: the button appeared to do nothing
      // because the app neither opened the Shopping List screen nor explained why.
      setErroreLista(e instanceof Error ? e.message : "Non sono riuscito a generare la lista. Riprova.");
    } finally {
      setGenerandoLista(false);
    }
  }

  async function generateFullWeek() {
    const slotVuoti = slots.filter((s) => !s.piattoId);
    if (slotVuoti.length === 0) return;
    const giornoPerData = new Map(giorni.map((g) => [toIsoDate(g), g]));
    const slotPerId = new Map(slotVuoti.map((s) => [s.id, s]));
    const blocchi = splitIntoChunks(slotVuoti, DIMENSIONE_BLOCCO_SETTIMANA);

    setGenerandoSettimana(true);
    setErroreSettimana(null);
    try {
      const risultatiPerBlocco = await Promise.allSettled(
        blocchi.map((blocco) =>
          generateWeek({
            pasti: blocco.map((s) => ({ id: s.id, pasto: s.pasto })),
            vincoli: profilo?.vincoliAlimentari ?? ["noci"],
            porzioni: profilo?.porzioniDefault ?? 4,
          })
        )
      );

      const proposte: WeekProposal[] = [];
      for (const risultatoBlocco of risultatiPerBlocco) {
        if (risultatoBlocco.status !== "fulfilled") continue;
        for (const { id, generato } of risultatoBlocco.value) {
          const slot = slotPerId.get(id);
          if (!slot) continue;
          const giorno = giornoPerData.get(slot.data);
          const etichettaPasto = slot.pasto === "pranzo" ? "Pranzo" : "Cena";
          proposte.push({
            slotId: slot.id,
            dayAndMeal: giorno ? `${formatDayLabel(giorno)} · ${etichettaPasto}` : etichettaPasto,
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

  function toggleProposalExclusion(slotId: string) {
    setPropostaSettimana((proposte) =>
      proposte ? proposte.map((p) => (p.slotId === slotId ? { ...p, esclusa: !p.esclusa } : p)) : proposte
    );
  }

  async function confirmWeekProposal() {
    if (!propostaSettimana) return;
    for (const p of propostaSettimana.filter((p) => !p.esclusa)) {
      // eslint-disable-next-line no-await-in-loop
      const piattoId = await saveGeneratedDish(p.generato, [], ingredientiCatalogo);
      // eslint-disable-next-line no-await-in-loop
      await assignDishToSlot(p.slotId, piattoId);
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
            {formatCycleLabel(inizio)}
          </h1>
          <CycleNavigator
            onPrecedente={() => onCycleOffsetChange(cycleOffset - 1)}
            onOggi={() => onCycleOffsetChange(0)}
            onSuccessivo={() => onCycleOffsetChange(cycleOffset + 1)}
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4" ref={scrollContainerRef}>
        {/* pianoId is null only until getOrCreateWeeklyPlan/getOrCreatePlanSlots finish. The day
            skeleton prevents a brief flash of the "empty menu" message. */}
        {!pianoId && <WeeklyPlannerSkeleton />}
        {pianoId && tuttiVuoti && (
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
                <Button onClick={() => void generateFullWeek()} disabled={generandoSettimana}>
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
        {pianoId && giorni.map((giorno) => {
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
              ref={isToday(giorno) ? setTodayEl : undefined}
              style={
                isToday(giorno)
                  ? {
                      border: "2px solid var(--biro)",
                      borderRadius: "var(--radius-card)",
                      padding: "var(--sp-4)",
                    }
                  : undefined
              }
            >
              <div
                className="text-xs font-bold mb-2 flex items-center gap-2"
                style={{
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: isToday(giorno)
                    ? "var(--biro)"
                    : "var(--text-secondary)",
                }}>
                {formatDayLabel(giorno)}
                {isToday(giorno) && (
                  <Badge kind="sostituito" style={{ fontWeight: 700, letterSpacing: ".04em" }}>
                    Oggi
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {slotGiorno.map((slot) => (
                  <PlanSlotRow
                    key={slot.id}
                    slot={slot}
                    piatto={dishById(slot.piattoId)}
                    piattiDisponibili={piatti}
                    porzioniDefault={profilo?.porzioniDefault ?? 4}
                    vincoliAlimentari={profilo?.vincoliAlimentari ?? ["noci"]}
                    ingredientiCatalogo={ingredientiCatalogo}
                    dishesAssignedThisWeek={dishesAssignedThisWeek}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!tuttiVuoti && (
        <div className="px-5 pb-3 flex-none">
          <Button onClick={() => void generateList()} disabled={slotsAssegnati === 0 || generandoLista}>
            {generandoLista ? "Preparo la lista…" : `Genera lista spesa · ${slotsAssegnati} piatti`}
          </Button>
          {erroreLista && <p style={{ color: "var(--pomodoro)", fontSize: 13, marginTop: 6 }}>{erroreLista}</p>}
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
                      {p.dayAndMeal}
                    </div>
                    <div style={{ fontWeight: 600, textDecoration: p.esclusa ? "line-through" : "none" }}>
                      {p.generato.nome}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleProposalExclusion(p.slotId)}
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
            <Button onClick={() => void confirmWeekProposal()}>
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

function PlanSlotRow({
  slot,
  piatto,
  piattiDisponibili,
  porzioniDefault,
  vincoliAlimentari,
  ingredientiCatalogo,
  dishesAssignedThisWeek,
}: {
  slot: Slot;
  piatto?: Dish;
  piattiDisponibili: Dish[];
  porzioniDefault: number;
  vincoliAlimentari: string[];
  ingredientiCatalogo: Ingredient[];
  dishesAssignedThisWeek: { slotId: string; nome: string }[];
}) {
  const [ricerca, setRicerca] = useState(false);
  const [query, setQuery] = useState("");
  const [rigenerazione, setRigenerazione] = useState(false);
  const [erroreRigenerazione, setErroreRigenerazione] = useState<string | null>(null);
  const etichettaPasto = slot.pasto === "pranzo" ? "Pranzo" : "Cena";

  async function assign(piattoId: string | undefined) {
    await assignDishToSlot(slot.id, piattoId);
    setRicerca(false);
    setQuery("");
  }

  async function createCustomAndAssign(nome: string) {
    const piattoId = createId();
    const nuovo: Dish = {
      id: piattoId,
      nome,
      preferito: false,
      origine: "manuale",
      porzioni: porzioniDefault,
      updatedAt: nowIso(),
    };
    await db.piatti.add(nuovo);
    await assign(piattoId);
  }

  async function generateWithAI() {
    setRigenerazione(true);
    setErroreRigenerazione(null);
    try {
      const evitaPiatti = dishesAssignedThisWeek
        .filter((p) => p.slotId !== slot.id)
        .map((p) => p.nome);
      const generato = await generateDish({
        ingredienti: [],
        vincoli: vincoliAlimentari,
        porzioni: porzioniDefault,
        pasto: slot.pasto,
        evitaPiatti,
      });
      const nuovoPiattoId = await saveGeneratedDish(generato, [], ingredientiCatalogo);
      await assign(nuovoPiattoId);
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
          onClick={() => void generateWithAI()}
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
              onClick={() => void assign(p.id)}>
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
              onClick={() => void createCustomAndAssign(testoRicerca)}>
              <Plus size={15} strokeWidth={2.25} /> Usa “{testoRicerca}” così com'è
            </button>
          )}
          {piatto && (
            <button
              type="button"
              className="text-left px-2.5 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
              style={{ color: "var(--pomodoro)", fontWeight: 600 }}
              onClick={() => void assign(undefined)}>
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
          <DishCard
            when={etichettaPasto}
            dish={piatto.nome}
            ai={piatto.origine === "ai"}
            onClick={() => setRicerca(true)}
          />
        </div>
        <button
          type="button"
          aria-label={`Rimuovi ${piatto.nome} da questo pasto`}
          onClick={() => void assign(undefined)}
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
    <DishCard when={etichettaPasto} empty onClick={() => setRicerca(true)} />
  );
}

function WeeklyPlannerSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[1, 2, 3].map((giorno) => (
        <div key={giorno} className="mb-3">
          <Skeleton width={90} height={11} style={{ marginBottom: 8 }} />
          <div className="flex flex-col gap-2">
            <Skeleton height={48} radius={14} />
            <Skeleton height={48} radius={14} />
          </div>
        </div>
      ))}
    </div>
  );
}
