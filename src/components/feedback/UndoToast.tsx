import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export const UNDO_DURATION_MS = 5000;

interface UndoRequest {
  /** What just happened, e.g. "Latte eliminato". */
  message: string;
  /** Restores the deleted data. */
  onUndo: () => void | Promise<void>;
}

type ShowUndo = (request: UndoRequest) => void;

const UndoContext = createContext<ShowUndo>(() => {});

/** Deletes happen immediately; this toast gives UNDO_DURATION_MS to take them back. */
export function useUndoToast(): ShowUndo {
  return useContext(UndoContext);
}

/** Hosts the single undo toast above the tab bar. A newer deletion replaces the previous toast. */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(UndoRequest & { id: number }) | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  const show = useCallback<ShowUndo>(
    (request) => {
      window.clearTimeout(timer.current);
      counter.current += 1;
      setCurrent({ ...request, id: counter.current });
      timer.current = window.setTimeout(() => setCurrent(null), UNDO_DURATION_MS);
    },
    [],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <UndoContext.Provider value={show}>
      {children}
      {current && (
        <div
          key={current.id}
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            // Floats above the tab bar (≈76px tall + its own bottom margin).
            bottom: "calc(max(14px, env(safe-area-inset-bottom)) + 88px)",
            maxWidth: 420,
            margin: "0 auto",
            zIndex: 60,
            overflow: "hidden",
            background: "var(--text-body)",
            color: "var(--surface-page)",
            borderRadius: 12,
            boxShadow: "0 6px 20px rgba(0,0,0,.25)",
            fontFamily: "var(--font-text)",
            fontSize: 14,
          }}>
          <div className="flex items-center justify-between gap-3" style={{ padding: "6px 6px 6px 16px" }}>
            <span className="min-w-0">{current.message}</span>
            <button
              type="button"
              onClick={() => {
                const { onUndo } = current;
                dismiss();
                void onUndo();
              }}
              style={{
                minHeight: 44,
                padding: "0 14px",
                fontWeight: 700,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}>
              Annulla
            </button>
          </div>
          <div
            aria-hidden="true"
            className="undo-progress"
            style={{ animationDuration: `${UNDO_DURATION_MS}ms` }}
          />
        </div>
      )}
    </UndoContext.Provider>
  );
}
