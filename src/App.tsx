import { useEffect, useState } from "react";
import { TabBar } from "./components";
import { Settimana } from "./screens/Settimana";
import { Lista } from "./screens/Lista";
import { SpesaAttiva } from "./screens/SpesaAttiva";
import { Piatti } from "./screens/Piatti";
import { Altro } from "./screens/Altro";
import { getOrCreateProfilo, applicaTema } from "./lib/db";
import { applicaSeedIngredienti } from "./seed/applica";
import { applicaSeedPiatti } from "./seed/applicaPiatti";

type Tab = "settimana" | "lista" | "piatti" | "altro";

export function App() {
  const [tab, setTab] = useState<Tab>("settimana");
  const [listaSpesaAttivaId, setListaSpesaAttivaId] = useState<string | null>(null);
  // Ogni schermata ricorda la propria settimana (offset rispetto al ciclo corrente): lo stato
  // vive qui in App così sopravvive ai cambi di tab. Settimana e Lista navigano in modo
  // indipendente; l'unico punto di sincronizzazione è "Genera lista", che porta la Lista sulla
  // stessa settimana da cui si è generato.
  const [offsetSettimana, setOffsetSettimana] = useState(0);
  const [offsetLista, setOffsetLista] = useState(0);

  useEffect(() => {
    void getOrCreateProfilo().then((profilo) => {
      applicaTema(profilo.tema);
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
      <div className="flex-1 min-h-0 overflow-y-auto bg-quadretti" data-tab={tab}>
        {tab === "settimana" && (
          <Settimana
            cicloOffset={offsetSettimana}
            onCicloOffsetChange={setOffsetSettimana}
            onListaGenerata={(offset) => {
              setOffsetLista(offset);
              setTab("lista");
            }}
          />
        )}
        {tab === "lista" && (
          <Lista
            cicloOffset={offsetLista}
            onCicloOffsetChange={setOffsetLista}
            onIniziaSpesa={setListaSpesaAttivaId}
          />
        )}
        {tab === "piatti" && <Piatti />}
        {tab === "altro" && <Altro />}
      </div>
      <TabBar active={tab} onChange={(id) => setTab(id as Tab)} />
    </div>
  );
}
