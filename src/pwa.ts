import { registerSW } from "virtual:pwa-register";

/** Registra il service worker e lo controlla per nuove versioni in due momenti:
 * appena l'app torna visibile (l'utente riapre l'icona dopo averla messa in background —
 * è esattamente il momento in cui il controllo automatico del browser di solito NON parte,
 * perché la pagina non viene ricaricata da zero) e periodicamente come riserva, per il caso
 * in cui l'app resti aperta a lungo senza mai passare in background (es. durante la spesa
 * con lo schermo sempre acceso). Con `registerType: "autoUpdate"` (vite.config.ts), appena
 * trovata una versione nuova il service worker prende il controllo e ricarica da solo. */
const CONTROLLO_PERIODICO_MS = 5 * 60 * 1000; // 5 minuti, di riserva

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registrazione) {
    if (!registrazione) return;

    async function controllaAggiornamento() {
      if (!registrazione || registrazione.installing || !navigator.onLine) return;
      const risposta = await fetch(swUrl, { cache: "no-store", headers: { cache: "no-store" } });
      if (risposta.status === 200) {
        await registrazione.update();
      }
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void controllaAggiornamento();
    });

    setInterval(() => void controllaAggiornamento(), CONTROLLO_PERIODICO_MS);
  },
});
