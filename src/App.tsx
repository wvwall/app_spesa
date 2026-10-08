import { useEffect, useState } from "react";
import { GeminiKeySheet, TabBar } from "./components";
import { WeeklyPlanner } from "./screens/WeeklyPlanner";
import { ShoppingList } from "./screens/ShoppingList";
import { ActiveShopping } from "./screens/ActiveShopping";
import { Dishes } from "./screens/Dishes";
import { Settings } from "./screens/Settings";
import { getOrCreateProfile, applyTheme } from "./lib/database";
import {
  dismissGeminiSetupPrompt,
  getGeminiApiKey,
  hasDismissedGeminiSetupPrompt,
} from "./lib/aiSettings";
import { applyIngredientSeed } from "./seed/applyIngredients";
import { applyDishSeed } from "./seed/applyDishes";

type Tab = "settimana" | "lista" | "piatti" | "altro";

export function App() {
  const [tab, setTab] = useState<Tab>("settimana");
  const [activeShoppingListId, setActiveShoppingListId] = useState<string | null>(null);
  const [setupGeminiOpen, setSetupGeminiOpen] = useState(false);
  // Each screen remembers its own week (an offset from the current cycle). State lives in App
  // so it survives tab changes. Weekly planning and the shopping list navigate independently;
  // "Generate list" is the only synchronization point and opens the week it was generated from.
  const [weekOffset, setOffsetSettimana] = useState(0);
  const [listOffset, setOffsetLista] = useState(0);

  useEffect(() => {
    void getOrCreateProfile().then((profilo) => {
      applyTheme(profilo.tema);
    });
    // The dish seed resolves ingredients by name from the catalog, so it must run only after
    // the ingredient seed has completed.
    void applyIngredientSeed().then(() => applyDishSeed());
  }, []);

  useEffect(() => {
    let annullato = false;
    void (async () => {
      const [apiKey, setupGiaRimandato] = await Promise.all([
        getGeminiApiKey(),
        hasDismissedGeminiSetupPrompt(),
      ]);
      if (annullato || apiKey || setupGiaRimandato) return;
      if (!annullato) setSetupGeminiOpen(true);
    })();
    return () => {
      annullato = true;
    };
  }, []);

  function closeInitialGeminiSetup() {
    setSetupGeminiOpen(false);
    void dismissGeminiSetupPrompt();
  }

  if (activeShoppingListId) {
    return <ActiveShopping listId={activeShoppingListId} onClose={() => setActiveShoppingListId(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto bg-quadretti" data-tab={tab}>
        {tab === "settimana" && (
          <WeeklyPlanner
            cycleOffset={weekOffset}
            onCycleOffsetChange={setOffsetSettimana}
            onListGenerated={(offset) => {
              setOffsetLista(offset);
              setTab("lista");
            }}
          />
        )}
        {tab === "lista" && (
          <ShoppingList
            cycleOffset={listOffset}
            onCycleOffsetChange={setOffsetLista}
            onStartShopping={setActiveShoppingListId}
          />
        )}
        {tab === "piatti" && <Dishes />}
        {tab === "altro" && <Settings />}
      </div>
      <TabBar active={tab} onChange={(id) => setTab(id as Tab)} />
      <GeminiKeySheet
        open={setupGeminiOpen}
        onClose={closeInitialGeminiSetup}
        onSaved={() => setSetupGeminiOpen(false)}
      />
    </div>
  );
}
