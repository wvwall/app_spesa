import type { CSSProperties } from "react";
import { Sun, Moon, Sparkles, Plus } from "lucide-react";

interface CardPiattoProps {
  when?: "Pranzo" | "Cena";
  dish?: string;
  empty?: boolean;
  ai?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function CardPiatto({ when = "Pranzo", dish, empty = false, ai = false, onClick, style }: CardPiattoProps) {
  const Icona = when.toLowerCase().startsWith("c") ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        boxSizing: "border-box",
        background: empty ? "transparent" : "var(--surface-card,#fff)",
        border: "1px " + (empty ? "dashed" : "solid") + " var(--quadretto)",
        borderRadius: "var(--radius-card,14px)",
        padding: "12px 14px",
        font: "inherit",
        fontFamily: "var(--font-text)",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 12,
          color: "var(--inchiostro-70)",
          width: 52,
          flex: "none",
        }}
      >
        <Icona size={13} strokeWidth={2} /> {when}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontWeight: 600,
          fontSize: 15.5,
          color: empty ? "var(--biro)" : "var(--text-body)",
        }}
      >
        {empty && !dish && <Plus size={16} strokeWidth={2.25} />}
        {empty ? dish || "aggiungi piatto" : dish}
      </span>
      {ai && (
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "var(--biro)",
            background: "var(--biro-chiaro)",
            borderRadius: 99,
            padding: "3px 8px",
            flex: "none",
          }}
        >
          <Sparkles size={12} strokeWidth={2} /> AI
        </span>
      )}
    </button>
  );
}
