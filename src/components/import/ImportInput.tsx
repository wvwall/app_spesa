import { useRef, useState } from "react";
import { FileText, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (testo: string) => void;
  placeholder?: string;
}

/** Textarea plus a local text-file picker. Files are read in the browser and never uploaded. */
export function ImportInput({ value, onChange, placeholder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [erroreFile, setErroreFile] = useState<string | null>(null);

  async function caricaFile(file?: File) {
    if (!file) return;
    try {
      const testo = await file.text();
      onChange(testo);
      setErroreFile(null);
    } catch {
      setErroreFile("Non riesco a leggere questo file. Prova a incollare il testo.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        rows={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border px-3 py-2.5 text-sm"
        style={{
          borderColor: "var(--border-quiet)",
          background: "var(--surface-card)",
          color: "var(--text-body)",
          resize: "vertical",
          minHeight: 160,
        }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--biro)", fontWeight: 600, minHeight: 44 }}
          onClick={() => fileRef.current?.click()}
        >
          <FileText size={16} /> Carica un file di testo
        </button>
        {value && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--text-secondary)", minHeight: 44 }}
            onClick={() => onChange("")}
          >
            <X size={14} /> Svuota
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void caricaFile(file);
          }}
        />
      </div>
      {erroreFile && (
        <p role="alert" style={{ color: "var(--pomodoro)", fontSize: 13 }}>
          {erroreFile}
        </p>
      )}
      <p style={{ color: "var(--text-secondary)", fontSize: 12.5, lineHeight: 1.4, margin: 0 }}>
        Puoi incollare anche l’intero testo: userò solo le righe che servono a questa pagina.
      </p>
    </div>
  );
}
