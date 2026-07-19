import type { CSSProperties, ReactNode } from "react";

type BadgeKind = "ai" | "allergene" | "offline" | "verificato" | "sostituito";

interface BadgeProps {
  kind?: BadgeKind;
  children?: ReactNode;
  style?: CSSProperties;
}

const KIND_STYLES: Record<BadgeKind, CSSProperties> = {
  ai: {
    fontSize: 11,
    color: "var(--biro)",
    background: "var(--biro-chiaro)",
    borderRadius: 99,
    padding: "3px 8px",
    display: "inline-block",
  },
  allergene: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "var(--pomodoro-chiaro,#F7E5E0)",
    color: "var(--pomodoro)",
    border: "1px solid var(--pomodoro)",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    fontSize: 14,
  },
  offline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "var(--inchiostro-70)",
    fontSize: 12,
  },
  verificato: {
    display: "inline-block",
    fontSize: 12,
    color: "var(--basilico)",
  },
  sostituito: {
    display: "inline-block",
    fontSize: 11,
    color: "#fff",
    background: "var(--biro)",
    borderRadius: 99,
    padding: "2px 8px",
  },
};

const KIND_CONTENT: Record<BadgeKind, ReactNode> = {
  ai: "✨ AI",
  allergene: "⚠ Niente noci — esclusione assoluta",
  offline: (
    <>
      <i style={{ fontStyle: "normal", color: "var(--basilico)" }}>●</i> Offline — tutto salvato sul telefono
    </>
  ),
  verificato: "✓ verificato: senza noci",
  sostituito: "sostituito",
};

export function Badge({ kind = "ai", children, style }: BadgeProps) {
  return (
    <span style={{ fontFamily: "var(--font-text)", ...KIND_STYLES[kind], ...style }}>
      {children ?? KIND_CONTENT[kind]}
    </span>
  );
}
