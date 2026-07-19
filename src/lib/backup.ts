import { db, nowIso } from "./db";
import type {
  Profilo,
  Ingrediente,
  Piatto,
  PiattoIngrediente,
  PianoSettimana,
  Slot,
  ListaSpesa,
  VoceLista,
} from "./types";

interface BackupPayload {
  versione: 1;
  esportatoIl: string;
  profilo: Profilo[];
  ingredienti: Ingrediente[];
  piatti: Piatto[];
  piattoIngredienti: PiattoIngrediente[];
  piani: PianoSettimana[];
  slot: Slot[];
  liste: ListaSpesa[];
  voci: VoceLista[];
}

export async function esportaBackup(): Promise<BackupPayload> {
  const [profilo, ingredienti, piatti, piattoIngredienti, piani, slot, liste, voci] = await Promise.all([
    db.profilo.toArray(),
    db.ingredienti.toArray(),
    db.piatti.toArray(),
    db.piattoIngredienti.toArray(),
    db.piani.toArray(),
    db.slot.toArray(),
    db.liste.toArray(),
    db.voci.toArray(),
  ]);
  return { versione: 1, esportatoIl: nowIso(), profilo, ingredienti, piatti, piattoIngredienti, piani, slot, liste, voci };
}

export async function scaricaBackup(): Promise<void> {
  const payload = await esportaBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `spesa-di-casa-backup-${payload.esportatoIl.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importaBackup(file: File): Promise<void> {
  const testo = await file.text();
  const payload = JSON.parse(testo) as BackupPayload;
  if (payload.versione !== 1) {
    throw new Error("Formato di backup non riconosciuto.");
  }
  await db.transaction(
    "rw",
    [db.profilo, db.ingredienti, db.piatti, db.piattoIngredienti, db.piani, db.slot, db.liste, db.voci],
    async () => {
      await Promise.all([
        db.profilo.clear(),
        db.ingredienti.clear(),
        db.piatti.clear(),
        db.piattoIngredienti.clear(),
        db.piani.clear(),
        db.slot.clear(),
        db.liste.clear(),
        db.voci.clear(),
      ]);
      await Promise.all([
        db.profilo.bulkAdd(payload.profilo),
        db.ingredienti.bulkAdd(payload.ingredienti),
        db.piatti.bulkAdd(payload.piatti),
        db.piattoIngredienti.bulkAdd(payload.piattoIngredienti),
        db.piani.bulkAdd(payload.piani),
        db.slot.bulkAdd(payload.slot),
        db.liste.bulkAdd(payload.liste),
        db.voci.bulkAdd(payload.voci),
      ]);
    }
  );
}
