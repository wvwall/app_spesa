import { useEffect, useState } from "react";
import { TabBar } from "./components";
import { Settimana } from "./screens/Settimana";
import { Lista } from "./screens/Lista";
import { SpesaAttiva } from "./screens/SpesaAttiva";
import { Piatti } from "./screens/Piatti";
import { Altro } from "./screens/Altro";
import { getOrCreateProfilo } from "./lib/db";
import { applicaSeedIngredienti } from "./seed/applica";
import { applicaSeedPiatti } from "./seed/applicaPiatti";

type Tab = "settimana" | "lista" | "piatti" | "altro";

export function App() {
  const [tab, setTab] = useState<Tab>("settimana");
  const [listaSpesaAttivaId, setListaSpesaAttivaId] = useState<string | null>(null);

  useEffect(() => {
    void getOrCreateProfilo().then((profilo) => {
      document.documentElement.setAttribute("data-theme", profilo.tema === "scuro" ? "dark" : "light");
    });
    // Il seed dei piatti cerca gli ingredienti per nome nel catalogo: deve partire solo
    // dopo che quello degli ingredienti è completo.
    void applicaSeedIngredienti().then(() => applicaSeedPiatti());
  }, []);

  if (listaSpesaAttivaId) {
    return <SpesaAttiva listaId={listaSpesaAttivaId} onChiudi={() => setListaSpesaAttivaId(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto bg-quadretti">
        {tab === "settimana" && <Settimana onListaGenerata={() => setTab("lista")} />}
        {tab === "lista" && <Lista onIniziaSpesa={setListaSpesaAttivaId} />}
        {tab === "piatti" && <Piatti />}
        {tab === "altro" && <Altro />}
      </div>
      <TabBar active={tab} onChange={(id) => setTab(id as Tab)} />
    </div>
  );
}
