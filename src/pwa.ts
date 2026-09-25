import { registerSW } from "virtual:pwa-register";

/** Registers the service worker and checks for updates at two points: as soon as the app
 * becomes visible again (when the user returns after backgrounding it; browsers often skip
 * their automatic check because the page was not reloaded) and periodically as a fallback if
 * the app stays open for a long time, such as during shopping with the screen on. With
 * `registerType: "autoUpdate"` (vite.config.ts), an updated worker takes control and reloads. */
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Five-minute fallback interval.

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registrazione) {
    if (!registrazione) return;

    async function checkForUpdates() {
      if (!registrazione || registrazione.installing || !navigator.onLine) return;
      const risposta = await fetch(swUrl, { cache: "no-store", headers: { cache: "no-store" } });
      if (risposta.status === 200) {
        await registrazione.update();
      }
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void checkForUpdates();
    });

    setInterval(() => void checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
  },
});
