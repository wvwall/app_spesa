import { useEffect, useState, type FormEvent } from "react";
import { BottomSheet } from "../navigation/BottomSheet";
import { Button } from "../core/Button";
import { saveGeminiApiKey } from "../../lib/aiSettings";

interface GeminiKeySheetProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function GeminiKeySheet({ open, onClose, onSaved }: GeminiKeySheetProps) {
  const [apiKey, setApiKey] = useState("");
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setApiKey("");
      setErrore(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSalvataggio(true);
    setErrore(null);
    try {
      await saveGeminiApiKey(apiKey);
      setApiKey("");
      onSaved();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare la chiave.");
    } finally {
      setSalvataggio(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      title="Attiva i suggerimenti AI"
      intro="Aggiungi la tua chiave Google Gemini. Puoi continuare a usare l’app anche senza."
      onClose={onClose}
      style={{ zIndex: 50, maxHeight: "90dvh", overflowY: "auto" }}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", color: "var(--biro)", fontWeight: 700, fontSize: 13.5 }}
        >
          Crea una chiave Gemini ↗
        </a>
        <label htmlFor="gemini-api-key" style={{ fontWeight: 700, fontSize: 13 }}>
          Chiave API
        </label>
        <input
          id="gemini-api-key"
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Incolla la chiave qui"
          className="w-full rounded-xl border px-3 py-3 text-sm"
          style={{ borderColor: "var(--quadretto)", background: "var(--surface-card)", color: "var(--text-body)" }}
        />
        {errore && <p role="alert" style={{ color: "var(--pomodoro)", fontSize: 13 }}>{errore}</p>}
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12.5, lineHeight: 1.4 }}>
          La chiave resta su questo dispositivo e viene usata per collegarsi a Gemini.
        </p>
        <Button type="submit" disabled={salvataggio || !apiKey.trim()}>
          {salvataggio ? "Salvo…" : "Salva e continua"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={salvataggio}>
          Non ora
        </Button>
      </form>
    </BottomSheet>
  );
}
