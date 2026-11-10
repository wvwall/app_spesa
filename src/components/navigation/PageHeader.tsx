import type { ReactNode } from "react";

interface Props {
  /** Page title, drawn in the handwritten biro style. */
  title: string;
  /** Controls aligned to the right of the title (e.g. the cycle navigator). */
  actions?: ReactNode;
  /** Small secondary line under the title. */
  subtitle?: ReactNode;
}

/**
 * Shared header for the four tab screens. The title row has a fixed 44px height, so the title
 * sits at the same y on every tab and does not jump when switching.
 */
export function PageHeader({ title, actions, subtitle }: Props) {
  return (
    <header className="px-5 pt-5 pb-2 flex-none">
      <div className="flex items-center justify-between gap-2" style={{ minHeight: 44 }}>
        <h1
          className="min-w-0 flex-1"
          style={{
            fontFamily: "var(--font-hand)",
            fontWeight: 800,
            fontSize: 28,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "var(--biro)",
            paddingRight: ".2em", // Caveat's last glyph overhangs its advance width
            overflowWrap: "anywhere",
          }}>
          <span className="tratto-evidenziatore">{title}</span>
        </h1>
        {actions}
      </div>
      {subtitle && <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{subtitle}</div>}
    </header>
  );
}
