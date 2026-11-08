import type { ReactNode } from "react";

interface Props {
  /** Page title, drawn in the handwritten biro style. */
  title: string;
  /** Controls aligned to the right of the eyebrow row (e.g. the cycle navigator). */
  actions?: ReactNode;
  /** Small secondary line under the title. */
  subtitle?: ReactNode;
}

/**
 * Shared header for the four tab screens. Row 1 has a fixed 44px height (eyebrow left, actions
 * right) so the title sits at the same y on every tab and does not jump when switching.
 */
export function PageHeader({ title, actions, subtitle }: Props) {
  return (
    <header className="px-5 pt-5 pb-2 flex-none">
      <div className="flex items-center justify-between gap-2" style={{ minHeight: 44 }}>
        <div
          className="text-xs"
          style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
          La spesa di casa
        </div>
        {actions}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-hand)",
          fontWeight: 800,
          fontSize: 28,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: "var(--biro)",
        }}>
        {title}
      </h1>
      {subtitle && <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
    </header>
  );
}
