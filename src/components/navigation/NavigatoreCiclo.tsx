import { ChevronLeft, ChevronRight } from "lucide-react";

/** Controllo `‹ oggi ›` per scorrere i cicli spesa (settimane). Estratto da Settimana così
 * che Settimana e Lista usino lo stesso identico navigatore: ogni pagina tiene il proprio
 * offset (navigazione indipendente), ma il comportamento e i target tap 44px restano uguali. */
export function NavigatoreCiclo({
  onPrecedente,
  onOggi,
  onSuccessivo,
}: {
  onPrecedente: () => void;
  onOggi: () => void;
  onSuccessivo: () => void;
}) {
  return (
    <div className="flex items-center text-sm" style={{ color: "var(--text-secondary)" }}>
      <button
        type="button"
        onClick={onPrecedente}
        aria-label="Settimana precedente"
        style={{
          minWidth: 44,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <ChevronLeft size={22} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onOggi}
        style={{
          color: "var(--biro)",
          fontWeight: 600,
          minHeight: 44,
          padding: "0 8px",
        }}>
        oggi
      </button>
      <button
        type="button"
        onClick={onSuccessivo}
        aria-label="Settimana successiva"
        style={{
          minWidth: 44,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <ChevronRight size={22} strokeWidth={2} />
      </button>
    </div>
  );
}
