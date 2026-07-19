import type { CSSProperties, ReactNode } from "react";

interface BottomSheetProps {
  open?: boolean;
  title?: string;
  intro?: string;
  footer?: string;
  onClose?: () => void;
  children?: ReactNode;
  /** true = si posiziona dentro un contenitore relative (es. la cornice telefono di anteprima) invece che a schermo intero */
  container?: boolean;
  style?: CSSProperties;
}

export function BottomSheet({ open = false, title, intro, footer, onClose, children, container = false, style }: BottomSheetProps) {
  const pos = container ? "absolute" : "fixed";
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: pos,
          inset: 0,
          background: "rgba(35,38,30,.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .2s",
          zIndex: 5,
        }}
      />
      <div
        role="dialog"
        aria-label={title}
        style={{
          position: pos,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 6,
          background: "var(--carta)",
          borderRadius: "var(--radius-sheet,20px 20px 0 0)",
          padding: "18px 20px 24px",
          transform: open ? "translateY(0)" : "translateY(105%)",
          transition: "transform var(--dur-sheet,300ms) cubic-bezier(.3,.9,.3,1)",
          boxShadow: "var(--shadow-float,0 -8px 30px rgba(0,0,0,.18))",
          fontFamily: "var(--font-text)",
          color: "var(--inchiostro)",
          ...style,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--quadretto)", margin: "0 auto 14px" }} />
        {title && (
          <h5 style={{ margin: "0 0 2px", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, letterSpacing: "-.01em" }}>
            {title}
          </h5>
        )}
        {intro && <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--inchiostro-70)" }}>{intro}</p>}
        {children}
        {footer && <p style={{ fontSize: 12, color: "var(--basilico)", margin: "10px 0 0" }}>{footer}</p>}
      </div>
    </>
  );
}

interface AltOptionProps {
  label: string;
  hint?: string;
  onClick?: () => void;
}

export function AltOption({ label, hint, onClick }: AltOptionProps) {
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
        textAlign: "left",
        font: "inherit",
        fontFamily: "var(--font-text)",
        cursor: "pointer",
        background: "#fff",
        border: "1px solid var(--quadretto)",
        borderRadius: 12,
        padding: "13px 14px",
        marginBottom: 8,
        fontSize: 16,
        fontWeight: 600,
        color: "var(--inchiostro)",
      }}
    >
      {label}
      {hint && (
        <small style={{ marginLeft: "auto", color: "var(--inchiostro-70)", fontWeight: 500, fontSize: 12.5 }}>{hint}</small>
      )}
    </button>
  );
}
