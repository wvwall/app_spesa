import type { CSSProperties, ReactNode } from "react";
import { Sparkles, TriangleAlert, WifiOff, ShieldCheck } from "lucide-react";

type BadgeKind = "ai" | "allergene" | "offline" | "verificato" | "sostituito";

interface BadgeProps {
  kind?: BadgeKind;
  children?: ReactNode;
  style?: CSSProperties;
}

const KIND_STYLES: Record<BadgeKind, CSSProperties> = {
  ai: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "var(--biro)",
    background: "var(--biro-chiaro)",
    borderRadius: 99,
    padding: "3px 8px",
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
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
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
  ai: (
    <>
      <Sparkles size={12} strokeWidth={2} /> AI
    </>
  ),
  allergene: (
    <>
      <TriangleAlert size={16} strokeWidth={2} /> Niente noci — esclusione assoluta
    </>
  ),
  offline: (
    <>
      <WifiOff size={13} strokeWidth={2} style={{ color: "var(--basilico)" }} /> Offline — tutto salvato sul
      telefono
    </>
  ),
  verificato: (
    <>
      <ShieldCheck size={14} strokeWidth={2} /> verificato: senza noci
    </>
  ),
  sostituito: "sostituito",
};

export function Badge({ kind = "ai", children, style }: BadgeProps) {
  return (
    <span style={{ fontFamily: "var(--font-text)", ...KIND_STYLES[kind], ...style }}>
      {children ?? KIND_CONTENT[kind]}
    </span>
  );
}
