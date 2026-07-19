import type { CSSProperties } from "react";

interface CardPiattoProps {
  when?: "Pranzo" | "Cena";
  dish?: string;
  empty?: boolean;
  ai?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function CardPiatto({ when = "Pranzo", dish, empty = false, ai = false, onClick, style }: CardPiattoProps) {
  const icon = when.toLowerCase().startsWith("c") ? "☾" : "☀";
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
      <span style={{ fontSize: 12, color: "var(--inchiostro-70)", width: 52, flex: "none" }}>
        {icon} {when}
      </span>
      <span style={{ fontWeight: 600, fontSize: 15.5, color: empty ? "var(--biro)" : "var(--text-body)" }}>
        {empty ? dish || "+ aggiungi piatto" : dish}
      </span>
      {ai && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--biro)",
            background: "var(--biro-chiaro)",
            borderRadius: 99,
            padding: "3px 8px",
            flex: "none",
          }}
        >
          ✨ AI
        </span>
      )}
    </button>
  );
}
