import type { ButtonHTMLAttributes, CSSProperties } from "react";

type ChipState = "default" | "selected" | "owned" | "allergen";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  state?: ChipState;
  style?: CSSProperties;
}

export function Chip({ state = "default", children, style, ...rest }: ChipProps) {
  const s: CSSProperties = {
    border: "1px solid var(--quadretto)",
    background: "var(--surface-card,#fff)",
    color: "var(--text-body)",
    borderRadius: "var(--radius-chip,8px)",
    padding: "9px 14px",
    font: "inherit",
    fontFamily: "var(--font-text)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    lineHeight: 1.3,
  };
  if (state === "selected") {
    Object.assign(s, { background: "var(--biro-chiaro)", color: "var(--biro)", border: "1px solid var(--biro)" });
  }
  if (state === "owned") {
    Object.assign(s, { background: "transparent", color: "var(--basilico)", border: "1px solid var(--basilico)" });
  }
  if (state === "allergen") {
    Object.assign(s, { background: "transparent", color: "var(--pomodoro)", border: "1px solid var(--pomodoro)" });
  }
  return (
    <button type="button" style={{ ...s, ...style }} {...rest}>
      {children}
    </button>
  );
}
