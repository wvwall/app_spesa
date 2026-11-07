import { useState } from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  style?: CSSProperties;
}

export function SearchInput({ placeholder = "Cerca ingrediente…", style, onFocus, onBlur, ...rest }: SearchInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      type="search"
      placeholder={placeholder}
      onFocus={(e) => {
        setFocus(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        onBlur?.(e);
      }}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        border: `1px solid ${focus ? "var(--biro)" : "var(--quadretto)"}`,
        borderRadius: "var(--radius-chip,8px)",
        padding: "12px 14px",
        font: "inherit",
        fontFamily: "var(--font-text)",
        fontSize: 16,
        color: "var(--text-body)",
        background: "var(--surface-card,#fff)",
        // Hug the field instead of a ring 2px outside it: avoids a double outline in cards.
        outline: focus ? "1px solid var(--biro)" : "none",
        outlineOffset: 0,
        ...style,
      }}
      {...rest}
    />
  );
}
