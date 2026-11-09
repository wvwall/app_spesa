import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../core/IconButton";

/** Control for navigating shopping cycles (weeks). Extracted from WeeklyPlanner so both it and
 * ShoppingList use the same navigator. Each page keeps its own offset, while behavior stays
 * consistent. The arrows are IconButtons (soft background) like the other icon actions in the app. */
export function CycleNavigator({
  onPrecedente,
  onOggi,
  onSuccessivo,
}: {
  onPrecedente: () => void;
  onOggi: () => void;
  onSuccessivo: () => void;
}) {
  return (
    <div className="flex items-center text-sm">
      <IconButton size={40} aria-label="Settimana precedente" onClick={onPrecedente}>
        <ChevronLeft size={22} strokeWidth={2} />
      </IconButton>
      <button
        type="button"
        onClick={onOggi}
        style={{
          color: "var(--biro)",
          fontWeight: 600,
          minHeight: 44,
          padding: "0 10px",
        }}>
        oggi
      </button>
      <IconButton size={40} aria-label="Settimana successiva" onClick={onSuccessivo}>
        <ChevronRight size={22} strokeWidth={2} />
      </IconButton>
    </div>
  );
}
