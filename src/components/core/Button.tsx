import type { ButtonHTMLAttributes, CSSProperties } from "react";

type ButtonVariant = "primary" | "ghost" | "warn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  style?: CSSProperties;
}

export function Button({ variant = "primary", fullWidth = true, children, style, ...rest }: ButtonProps) {
  const base: CSSProperties = {
    display: "block",
    width: fullWidth ? "100%" : "auto",
    border: 0,
    borderRadius: "var(--radius-card,14px)",
    padding: "15px 16px",
    font: "inherit",
    fontFamily: "var(--font-text)",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    textAlign: "center",
    background: "var(--biro)",
    color: "#fff",
    lineHeight: 1.3,
  };
  if (variant === "ghost") {
    Object.assign(base, {
      background: "transparent",
      color: "var(--biro)",
      border: "1.5px solid var(--biro)",
      padding: "13.5px 16px",
    });
  }
  if (variant === "warn") {
    Object.assign(base, {
      background: "transparent",
      color: "var(--pomodoro)",
      border: "1.5px solid var(--pomodoro)",
      padding: "13.5px 16px",
    });
  }
  if (rest.disabled) {
    Object.assign(base, { opacity: 0.45, cursor: "default" });
  }
  return (
    <button type="button" style={{ ...base, ...style }} {...rest}>
      {children}
    </button>
  );
}
