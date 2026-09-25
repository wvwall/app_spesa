import type { ShoppingListItem } from "./models";
import { groupByDepartment } from "./departments";

export function buildListText(voci: ShoppingListItem[], ordineReparti: string[], titolo: string): string {
  let testo = `${titolo}\n`;
  for (const { reparto, voci: vociReparto } of groupByDepartment(voci, ordineReparti)) {
    testo += `\n── ${reparto} ──\n`;
    for (const v of vociReparto) {
      const simbolo = v.checked ? "☑" : "☐";
      const nome = v.sostituitoCon ? `${v.sostituitoCon} (al posto di ${v.nome})` : v.nome;
      const nota = v.nota ? ` — “${v.nota}”` : "";
      const quantita = v.quantita ? ` ${v.quantita}` : "";
      testo += `${simbolo} ${nome}${quantita}${nota}\n`;
    }
  }
  return testo;
}

export async function shareOrDownloadText(testo: string, nomeFile: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text: testo, title: nomeFile });
      return;
    } catch {
      // Sharing was canceled by the user; continue with the download.
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
