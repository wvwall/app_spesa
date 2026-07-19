import type { CSSProperties } from "react";

const TICK_PATH = "M5 13 L11 20 L26 4";
const STROKE_PATH = "M2 8 C 60 3, 108 12, 156 7 S 220 9, 240 6";

interface RigaListaProps {
  name: string;
  qty?: string;
  note?: string;
  checked?: boolean;
  substituted?: boolean;
  onToggle?: () => void;
  style?: CSSProperties;
}

export function RigaLista({ name, qty, note, checked = false, substituted = false, onToggle, style }: RigaListaProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        boxSizing: "border-box",
        minHeight: "var(--riga-corsia,56px)",
        padding: "8px 20px",
        border: 0,
        borderBottom: "1px dashed var(--quadretto)",
        background: "none",
        font: "inherit",
        fontFamily: "var(--font-text)",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        opacity: checked ? 0.72 : 1,
        ...style,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          flex: "none",
          border: "2px solid " + (checked ? "var(--biro)" : "var(--inchiostro-70)"),
          borderRadius: 5,
          position: "relative",
          background: "#fff",
        }}
      >
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          style={{ position: "absolute", inset: -4, width: 32, height: 32, overflow: "visible" }}
        >
          <path
            d={TICK_PATH}
            style={{
              stroke: "var(--biro)",
              strokeWidth: 3,
              fill: "none",
              strokeLinecap: "round",
              strokeDasharray: 34,
              strokeDashoffset: checked ? 0 : 34,
              transition: checked
                ? "stroke-dashoffset var(--dur-check,220ms) var(--ease-pennata,cubic-bezier(.6,0,.3,1))"
                : "none",
            }}
          />
        </svg>
      </span>
      <span
        style={{
          position: "relative",
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: "-.01em",
          color: checked ? "var(--inchiostro-70)" : "var(--text-body)",
        }}
      >
        {name}
        {qty && (
          <span style={{ color: "var(--inchiostro-70)", fontWeight: 500, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
            {" "}· {qty}
          </span>
        )}
        {substituted && (
          <span
            style={{
              fontSize: 11,
              color: "#fff",
              background: "var(--biro)",
              borderRadius: 99,
              padding: "2px 8px",
              marginLeft: 8,
              verticalAlign: "middle",
              fontWeight: 500,
            }}
          >
            sostituito
          </span>
        )}
        {note && (
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-hand)",
              fontSize: 17,
              color: "var(--biro)",
              transform: "rotate(-1.2deg)",
              fontWeight: 500,
            }}
          >
            “{note}”
          </span>
        )}
        <svg
          viewBox="0 0 244 14"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -4,
            right: -6,
            top: "50%",
            height: 14,
            width: "calc(100% + 10px)",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        >
          <path
            d={STROKE_PATH}
            style={{
              stroke: "var(--biro)",
              strokeWidth: 2.4,
              fill: "none",
              strokeLinecap: "round",
              opacity: 0.9,
              strokeDasharray: 260,
              strokeDashoffset: checked ? 0 : 260,
              transition: checked ? "stroke-dashoffset var(--dur-stroke,240ms) cubic-bezier(.55,0,.2,1) 50ms" : "none",
            }}
          />
        </svg>
      </span>
    </button>
  );
}
