import type { VoceLista } from "./types";

export function costruisciTestoLista(voci: VoceLista[], ordineReparti: string[], titolo: string): string {
  const gruppi = new Map<string, VoceLista[]>();
  for (const v of voci) {
    const arr = gruppi.get(v.reparto) ?? [];
    arr.push(v);
    gruppi.set(v.reparto, arr);
  }

  const reparti = [...gruppi.keys()].sort((a, b) => {
    const ia = ordineReparti.indexOf(a);
    const ib = ordineReparti.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  let testo = `${titolo}\n`;
  for (const reparto of reparti) {
    testo += `\n── ${reparto} ──\n`;
    for (const v of gruppi.get(reparto) ?? []) {
      const simbolo = v.checked ? "☑" : "☐";
      const nome = v.sostituitoCon ? `${v.sostituitoCon} (al posto di ${v.nome})` : v.nome;
      const nota = v.nota ? ` — “${v.nota}”` : "";
      const quantita = v.quantita ? ` ${v.quantita}` : "";
      testo += `${simbolo} ${nome}${quantita}${nota}\n`;
    }
  }
  return testo;
}

export async function condividiOScaricaTesto(testo: string, nomeFile: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text: testo, title: nomeFile });
      return;
    } catch {
      // l'utente ha annullato la condivisione: procedi col download
    }
  }
  const blob = new Blob([testo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  link.click();
  URL.revokeObjectURL(url);
}
