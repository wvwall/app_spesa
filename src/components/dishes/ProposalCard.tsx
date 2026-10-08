import type { CSSProperties } from "react";
import { Sparkles, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "../core/Button";

interface ProposalCardProps {
  eyebrow?: string;
  title: string;
  meta?: string;
  have?: string;
  buy?: string;
  extra?: string;
  /** Allergeni riconosciuti e verificati automaticamente. */
  allergieVerificate?: string[];
  /** Vincoli non riconosciuti: l'app non può verificarli da sola. */
  allergieNonVerificate?: string[];
  onAccept?: () => void;
  onRegenerate?: () => void;
  style?: CSSProperties;
}

export function ProposalCard({
  eyebrow = "Proposta",
  title,
  meta,
  have,
  buy,
  extra,
  allergieVerificate = [],
  allergieNonVerificate = [],
  onAccept,
  onRegenerate,
  style,
}: ProposalCardProps) {
  return (
    <div
      style={{
        background: "var(--surface-card,#fff)",
        border: "1px solid var(--quadretto)",
        borderRadius: "var(--radius-card,14px)",
        padding: 16,
        fontFamily: "var(--font-text)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--biro)",
          marginBottom: 6,
        }}
      >
        <Sparkles size={12} strokeWidth={2} /> {eyebrow}
      </div>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          margin: "0 0 2px",
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: "-.01em",
          color: "var(--text-body)",
        }}
      >
        {title}
      </h2>
      {meta && <div style={{ color: "var(--inchiostro-70)", fontSize: 13, marginBottom: 10 }}>{meta}</div>}
      {have && <div style={{ color: "var(--basilico)", fontSize: 13.5 }}>Hai già: {have}</div>}
      {buy && (
        <div style={{ color: "var(--biro)", fontSize: 13.5, marginBottom: extra ? 4 : 12 }}>Da comprare: {buy}</div>
      )}
      {extra && <div style={{ color: "var(--inchiostro-70)", fontSize: 13, marginBottom: 12 }}>L'AI aggiunge: {extra}</div>}
      {allergieVerificate.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--basilico)",
            marginBottom: allergieNonVerificate.length > 0 ? 4 : 12,
          }}
        >
          <ShieldCheck size={14} strokeWidth={2} /> verificato: senza {allergieVerificate.join(", ")}
        </div>
      )}
      {allergieNonVerificate.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 4,
            fontSize: 12,
            color: "var(--pomodoro)",
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          <TriangleAlert size={14} strokeWidth={2} style={{ flex: "none", marginTop: 1 }} />
          <span>Da controllare tu: l’AI non verifica automaticamente {allergieNonVerificate.join(", ")}.</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={onAccept} style={{ flex: 1, borderRadius: 10, padding: 11, fontSize: 14 }}>
          Va bene
        </Button>
        <Button variant="ghost" onClick={onRegenerate} style={{ flex: 1, borderRadius: 10, padding: 9.5, fontSize: 14 }}>
          Rigenera
        </Button>
      </div>
    </div>
  );
}
