import type { CSSProperties, ReactNode } from "react";

interface ToastProps {
  children?: ReactNode;
  style?: CSSProperties;
}

export function Toast({ children, style }: ToastProps) {
  return (
    <div
      role="status"
      style={{
        // Inverted note: dark on a light page, light on the dark one.
        background: "var(--text-body)",
        color: "var(--surface-page)",
        borderRadius: 12,
        padding: "12px 16px",
        fontSize: 14,
        maxWidth: 320,
        fontFamily: "var(--font-text)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
