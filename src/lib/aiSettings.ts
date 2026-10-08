import { db, nowIso } from "./database";

export const GEMINI_SETTINGS_ID = "gemini" as const;

let localFallbackAvailable = false;

export async function getGeminiApiKey(): Promise<string | null> {
  const settings = await db.aiSettings.get(GEMINI_SETTINGS_ID);
  return settings?.geminiApiKey ?? null;
}

export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const normalized = apiKey.trim();
  if (!normalized) throw new Error("Inserisci una chiave API Gemini.");

  await db.aiSettings.put({
    id: GEMINI_SETTINGS_ID,
    geminiApiKey: normalized,
    setupPromptDismissed: true,
    updatedAt: nowIso(),
  });
}

export async function removeGeminiApiKey(): Promise<void> {
  const settings = await db.aiSettings.get(GEMINI_SETTINGS_ID);
  if (settings?.setupPromptDismissed) {
    await db.aiSettings.put({
      id: GEMINI_SETTINGS_ID,
      setupPromptDismissed: true,
      updatedAt: nowIso(),
    });
    return;
  }
  await db.aiSettings.delete(GEMINI_SETTINGS_ID);
}

export async function hasDismissedGeminiSetupPrompt(): Promise<boolean> {
  const settings = await db.aiSettings.get(GEMINI_SETTINGS_ID);
  return settings?.setupPromptDismissed ?? false;
}

export async function dismissGeminiSetupPrompt(): Promise<void> {
  const settings = await db.aiSettings.get(GEMINI_SETTINGS_ID);
  await db.aiSettings.put({
    id: GEMINI_SETTINGS_ID,
    geminiApiKey: settings?.geminiApiKey,
    setupPromptDismissed: true,
    updatedAt: nowIso(),
  });
}

/** Check only whether Netlify Dev has its local env fallback; never returns the key itself. */
export async function hasLocalGeminiFallback(): Promise<boolean> {
  if (localFallbackAvailable) return true;
  try {
    const response = await fetch("/.netlify/functions/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ azione: "stato" }),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    localFallbackAvailable =
      typeof result === "object" && result !== null && "ripiegoLocale" in result
        ? (result as { ripiegoLocale: unknown }).ripiegoLocale === true
        : false;
    return localFallbackAvailable;
  } catch {
    return false;
  }
}
