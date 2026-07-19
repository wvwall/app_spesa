import type { CSSProperties } from "react";

interface TabItem {
  id: string;
  icon: string;
  label: string;
}

interface TabBarProps {
  tabs?: TabItem[];
  active?: string;
  onChange?: (id: string) => void;
  style?: CSSProperties;
}

const DEFAULT_TABS: TabItem[] = [
  { id: "settimana", icon: "▦", label: "Settimana" },
  { id: "lista", icon: "☑", label: "Lista" },
  { id: "piatti", icon: "🍲", label: "Piatti" },
  { id: "altro", icon: "⋯", label: "Altro" },
];

export function TabBar({ tabs = DEFAULT_TABS, active = "settimana", onChange, style }: TabBarProps) {
  return (
    <nav
      aria-label="Navigazione"
      style={{
        display: "flex",
        borderTop: "1px solid var(--quadretto)",
        background: "var(--surface-page,var(--carta))",
        padding: "6px 6px 12px",
        fontFamily: "var(--font-text)",
        ...style,
      }}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange?.(t.id)}
            style={{
              flex: 1,
              border: 0,
              background: on ? "var(--biro-chiaro)" : "none",
              font: "inherit",
              fontSize: 11.5,
              color: on ? "var(--biro)" : "var(--inchiostro-70)",
              fontWeight: on ? 700 : 400,
              padding: "7px 2px",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <span style={{ display: "block", fontSize: 17, marginBottom: 2 }}>{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
