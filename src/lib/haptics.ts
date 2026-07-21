/**
 * Feedback aptico "leggero" per i tap sull'interfaccia.
 *
 * Safari su iOS non espone la Vibration API (navigator.vibrate è assente),
 * quindi su iPhone/iPad questa funzione non produce alcun effetto a meno
 * che l'app non sia installata come PWA e il sistema/browser la supporti
 * in futuro. Su Android e altri browser compatibili genera una vibrazione
 * breve che simula il "tap" aptico di iOS.
 */
export function hapticTap() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  navigator.vibrate(10);
}
