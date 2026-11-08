import type { ButtonHTMLAttributes, CSSProperties } from "react";

type IconButtonTone = "neutral" | "accent" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  "aria-label": string;
  /** "accent" for the main row action (edit), "neutral" for secondary ones, "danger" for destructive
   * ones (delete): pomodoro icon on the same soft background. */
  tone?: IconButtonTone;
  size?: number;
  style?: CSSProperties;
}

/** Small square icon action with a soft background, used beside list rows and cards so the
 * icon reads as a button instead of floating on the grid paper. */
export function IconButton({ tone = "neutral", size = 36, style, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: "var(--radius-chip, 8px)",
        display: "grid",
        placeItems: "center",
        color: tone === "accent" ? "var(--biro)" : tone === "danger" ? "var(--pomodoro)" : "var(--text-secondary)",
        // Neutral/danger: card surface at 75% opacity, so the button is less prominent than the
        // opaque cards/inputs around it (and works the same in light, dark and any other theme).
        background:
          tone === "accent"
            ? "var(--biro-chiaro)"
            : "color-mix(in srgb, var(--surface-card) 75%, transparent)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
