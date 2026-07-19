import type { CSSProperties } from "react";

interface ProgressSpesaProps {
  done?: number;
  total?: number;
  style?: CSSProperties;
}

export function ProgressSpesa({ done = 0, total = 0, style }: ProgressSpesaProps) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div style={{ fontFamily: "var(--font-text)", ...style }}>
      <div style={{ height: 6, borderRadius: 99, background: "var(--quadretto)", overflow: "hidden" }}>
        <i
          style={{
            display: "block",
            height: "100%",
            width: pct + "%",
            background: "var(--basilico)",
            borderRadius: 99,
            transition: "width .35s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 13, color: "var(--inchiostro-70)", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
        <b style={{ color: "var(--text-body)" }}>{done}</b> di {total}
      </div>
    </div>
  );
}
