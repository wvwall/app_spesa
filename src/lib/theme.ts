import type { Theme } from "./models";

type DataTheme = "light" | "dark" | "stitch";

const DATA_THEME_PER_TEMA: Record<Exclude<Theme, "sistema">, DataTheme> = {
  chiaro: "light",
  scuro: "dark",
  stitch: "stitch",
};

const sistemaScuro =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

let temaCorrente: Theme | null = null;

// With "sistema" the app follows the OS: re-resolve whenever the system switches light/dark.
sistemaScuro?.addEventListener("change", () => {
  if (temaCorrente === "sistema") applyTheme("sistema");
});

function resolveTheme(tema: Theme): DataTheme {
  if (tema === "sistema") return sistemaScuro?.matches ? "dark" : "light";
  return DATA_THEME_PER_TEMA[tema];
}

/** Applies the profile theme to <html data-theme> and switches favicon and home-screen icon
 * to the matching variant (dark icons only for the dark theme; Stitch uses the light ones). */
export function applyTheme(tema: Theme): void {
  temaCorrente = tema;
  const dataTheme = resolveTheme(tema);
  document.documentElement.setAttribute("data-theme", dataTheme);
  applyAppIcons(dataTheme === "dark");
}

function applyAppIcons(scuro: boolean): void {
  const suffisso = scuro ? "-dark" : "";
  // index.html picks the favicon with media queries before JS runs; from here on it follows the
  // theme actually applied, which can differ from the system when the user forces one.
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][sizes]').forEach((link) => {
    const lato = link.sizes.value.split("x")[0];
    link.removeAttribute("media");
    link.href = `/icons/favicon${suffisso}-${lato}.png`;
  });
  // iOS reads it when the user adds the app to the home screen.
  const appleTouch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (appleTouch) appleTouch.href = `/icons/apple-touch-icon${suffisso}.png`;
}
