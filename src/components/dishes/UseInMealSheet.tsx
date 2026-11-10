import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Moon, Sun } from "lucide-react";
import { db } from "../../lib/database";
import { assignDishToSlot, getOrCreatePlanSlots, getOrCreateWeeklyPlan } from "../../lib/weeklyPlan";
import { cycleDays, cycleStart, formatCycleLabel, formatDayLabel, isToday, shiftCycle, toIsoDate } from "../../lib/calendar";
import type { Dish } from "../../lib/models";
import { BottomSheet } from "../navigation/BottomSheet";
import { CycleNavigator } from "../navigation/CycleNavigator";

interface Props {
  open: boolean;
  piatto: Dish;
  giornoSpesa: number;
  onClose: () => void;
  onAssigned: (etichetta: string) => void;
}

/** Picks a lunch/dinner of a week (current cycle by default) and assigns the dish to it. */
export function UseInMealSheet({ open, piatto, giornoSpesa, onClose, onAssigned }: Props) {
  const [offset, setOffset] = useState(0);
  const [pianoId, setPianoId] = useState<string | null>(null);
  const inizio = shiftCycle(cycleStart(new Date(), giornoSpesa), offset);
  const cicloIso = toIsoDate(inizio);

  useEffect(() => {
    if (!open) {
      setOffset(0);
      return;
    }
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
  }, [open, cicloIso]);

  const slots = useLiveQuery(() => (pianoId ? db.slot.where("pianoId").equals(pianoId).toArray() : []), [pianoId]) ?? [];
  const piatti = useLiveQuery(() => db.piatti.toArray(), []) ?? [];
  const nomeDi = (id?: string) => piatti.find((p) => p.id === id)?.nome;

  async function assegna(slotId: string, etichetta: string) {
    await assignDishToSlot(slotId, piatto.id);
    onAssigned(etichetta);
  }

  return (
    <BottomSheet
      open={open}
      title="Usa in un pasto"
      intro={piatto.nome}
      onClose={onClose}
      style={{ zIndex: 40, maxHeight: "85dvh", overflowY: "auto" }}>
      <div className="flex items-center justify-between gap-2" style={{ marginTop: -6 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{formatCycleLabel(inizio)}</span>
        <CycleNavigator onPrecedente={() => setOffset((o) => o - 1)} onOggi={() => setOffset(0)} onSuccessivo={() => setOffset((o) => o + 1)} />
      </div>
      <div className="flex flex-col gap-2" style={{ marginTop: 8 }}>
        {cycleDays(inizio).map((giorno) => {
          const iso = toIsoDate(giorno);
          const delGiorno = slots
            .filter((s) => s.data === iso)
            .sort((a, b) => (a.pasto === "pranzo" ? 0 : 1) - (b.pasto === "pranzo" ? 0 : 1));
          if (delGiorno.length === 0) return null;
          return (
            <div key={iso} className="flex flex-col gap-1.5">
              <div
                className="text-xs font-bold"
                style={{ letterSpacing: ".12em", textTransform: "uppercase", color: isToday(giorno) ? "var(--biro)" : "var(--text-secondary)", marginTop: 6 }}>
                {formatDayLabel(giorno)}
              </div>
              {delGiorno.map((slot) => {
                const etichetta = slot.pasto === "pranzo" ? "Pranzo" : "Cena";
                const attuale = nomeDi(slot.piattoId);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => void assegna(slot.id, `${formatDayLabel(giorno)} · ${etichetta}`)}
                    className="flex items-center gap-2.5 border rounded-xl px-3.5 text-left"
                    style={{ minHeight: 46, borderColor: "var(--border-quiet)", background: "var(--surface-card)" }}>
                    <span className="inline-flex items-center gap-1" style={{ width: 70, fontSize: 12, color: "var(--text-secondary)", flex: "none" }}>
                      {slot.pasto === "cena" ? <Moon size={13} /> : <Sun size={13} />} {etichetta}
                    </span>
                    <span className="flex-1 min-w-0 truncate" style={{ color: attuale ? "var(--text-body)" : "var(--text-secondary)", fontWeight: attuale ? 500 : 400 }}>
                      {attuale ?? "libero"}
                    </span>
                    {slot.piattoId === piatto.id && <Check size={16} style={{ color: "var(--biro)", flex: "none" }} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
