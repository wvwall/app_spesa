# Documento di Analisi — App Spesa Settimanale

> **Versione:** 0.3 (bozza da validare) · **Data:** 15 luglio 2026 · **Autore:** Walter Velardo (con supporto AI)
> **Changelog 0.2:** rimosso il sync famiglia — uso one-shot, dati per dispositivo; backend ridotto a proxy stateless.
> **Changelog 0.3:** rimossa l'integrazione Pepesto/Esselunga — catalogo generico curato da noi (seed JSON), niente prezzi; il backend resta solo proxy AI, senza DB.
> **Changelog 0.4:** domande aperte risolte — seed generato con AI (~300 voci), vincolo critico "niente noci", React + Vite confermato, backup JSON anticipato all'MVP.

---

## 1. Visione

Una **web app mobile-first (PWA)** per pianificare i pasti della settimana (pranzo e cena, giorno per giorno), generare i piatti con l'aiuto di un LLM a partire dagli ingredienti disponibili, e trasformare il piano in una **lista della spesa** ordinata per reparto, basata su un **catalogo di ingredienti generico curato da noi**, utilizzabile in negozio (per noi: Esselunga) in modalità "spesa attiva" anche offline. Uso "one-shot" per dispositivo: **ogni dispositivo ha i propri dati**, senza account né sincronizzazione.

---

## 2. Utenti e scenari d'uso

**Utenti:** Walter + famiglia (2–5 persone), ma **senza account né dati condivisi**: chiunque apra l'app su un dispositivo lavora sui dati di quel dispositivo. Se serve passare la lista a qualcun altro, si usa l'export testo (RF5).

### Scenari principali

| # | Scenario | Descrizione |
|---|----------|-------------|
| S1 | Pianificazione | A casa, sul divano: compongo il menù della settimana, piatto per piatto o generandolo con l'AI |
| S2 | Generazione AI | Seleziono ingredienti → l'AI propone un piatto; oppure "riempi la settimana" dalla lista globale |
| S3 | Spesa attiva | In negozio, telefono in mano: lista ordinata per reparto, spunto gli articoli, chiedo un'alternativa se un prodotto manca. **Deve funzionare senza rete** |
| S4 | Passaggio di mano | Se la spesa la fa un altro, gli condivido la lista come testo (WhatsApp); la spunta la fa sul messaggio o rigenerando la lista sul suo dispositivo |
| S5 | Export | Esporto la lista in testo semplice (condivisibile via WhatsApp) |

---

## 3. Requisiti funzionali

### 3.1 Base (dal brief)

- **RF1 — Piano settimanale**: griglia giorni × pasti (pranzo/cena) per la settimana corrente e le successive; ogni slot contiene un piatto.
- **RF2 — Ingredienti globali + piatti**: catalogo ingredienti globale dell'utente; ogni piatto è composto da ingredienti con quantità.
- **RF3 — Generazione AI**:
  - (a) da ingredienti selezionati → un piatto;
  - (b) dalla lista globale → piano completo pranzo/cena giorno per giorno;
  - (c) rigenerazione di un singolo slot senza toccare il resto.
- **RF4 — Catalogo ingredienti curato**: catalogo generico di ingredienti creato da noi (nome, reparto, unità di default, alias per la ricerca), precaricato come **seed** e liberamente estendibile/modificabile dentro l'app. Niente prezzi, niente dipendenze esterne.
- **RF5 — Export testo**: lista della spesa esportabile come testo semplice, raggruppata per reparto, con quantità; condivisione via Web Share API (WhatsApp ecc.).
- **RF6 — Modalità spesa attiva**: vista dedicata con checkbox; articoli spuntati barrati/spostati in fondo; stato persistente (sopravvive a chiusura browser e riavvio del telefono).
- **RF7 — Ingrediente alternativo**: se un prodotto manca a scaffale, l'app suggerisce un'alternativa. Le alternative sono **pre-generate dall'AI alla creazione della lista** (funzionano offline), con fallback a chiamata AI live se c'è rete.

### 3.2 Estensioni suggerite (da confermare, in ordine di valore stimato)

- **RF8 — Aggregazione automatica**: la lista spesa si genera sommando gli ingredienti dei piatti pianificati (stesso ingrediente in più piatti → una riga con quantità totale) + articoli extra fuori menù (detersivi, ecc.).
- **RF9 — Ricettario personale**: piatti salvati, preferiti, riutilizzabili trascinandoli su uno slot; l'AI impara dai piatti apprezzati.
- **RF10 — Ordinamento per reparto**: ogni ingrediente ha un reparto (ortofrutta, banco frigo, scatolame…); in modalità spesa la lista segue l'ordine del negozio (personalizzabile).
- **RF11 — Dispensa**: elenco di ciò che è già in casa, sottratto automaticamente dalla lista.
- **RF12 — Copia settimana / template**: ripartire dal menù di una settimana precedente.
- **RF13 — Vincoli alimentari**: allergie/preferenze come contesto fisso per ogni generazione AI. Vincolo già noto e **critico**: **niente noci** — esclusione assoluta (allergia), mai proposte in piatti né come alternative.
- **RF14 — Note per articolo**: "prendi quella in vetro", "solo se in offerta".

> *Scartato:* budget stimato / promozioni — richiedeva i prezzi (integrazione Pepesto), fuori interesse.

---

## 4. Requisiti non funzionali

- **RNF1 — Mobile-first**: progettata per schermo telefono, uso con una mano in negozio; desktop come adattamento.
- **RNF2 — Offline-first**: pianificazione e soprattutto spesa attiva funzionano senza rete; i dati vivono **esclusivamente in locale** (IndexedDB). PWA installabile (manifest + service worker). La rete serve **solo** per la generazione AI: tutto il resto, catalogo incluso, è locale.
- **RNF3 — Dati per dispositivo**: nessun account, nessun sync. Il modello dati usa comunque UUID e `updatedAt`, così un eventuale sync futuro (§5.2) non richiede migrazioni. Backup/ripristino manuale via export/import JSON (mitigazione contro perdita dati del browser).
- **RNF4 — Sicurezza**: le chiavi API (LLM, Pepesto) vivono **solo lato server**; il client non le vede mai.
- **RNF5 — Costi**: hosting a costo ~zero (piani free); unico costo vivo l'LLM (centesimi per generazione).
- **RNF6 — Provider AI astratto**: nessun lock-in; interfaccia interna unica, provider intercambiabile via configurazione.

---

## 5. Architettura

### 5.1 Scelta: PWA local-only + proxy AI stateless

Nessun sync e nessuna integrazione esterna per il catalogo: tutti i dati applicativi vivono sul dispositivo. Il backend esiste per un solo motivo — la chiave API dell'LLM non può stare nel client — ed è **stateless e senza database**: può essere anche una singola serverless function.

```
┌────────────────────────┐         ┌──────────────────────────┐
│  PWA (React + TS)      │  HTTPS  │  Proxy AI stateless       │
│  ──────────────────    │────────►│  (serverless function)    │
│  IndexedDB: unica      │  solo   │  ───────────────────────  │
│  fonte di verità       │   AI    │  • layer astratto         │
│  (dati + catalogo)     │         │    provider LLM           │
│  Seed catalogo (JSON   │         │  • chiave app + rate      │
│  nel bundle dell'app)  │         │    limit anti-abuso       │
│  Service Worker        │         └──────────┬───────────────┘
│  (offline)             │                    │
└────────────────────────┘         ┌──────────▼───────────────┐
                                   │  API LLM (Claude/GPT/…)   │
                                   └──────────────────────────┘
```

Principi:

1. **Il client legge e scrive sempre e solo in locale** (IndexedDB): l'app è istantanea e funziona offline per definizione. La rete serve unicamente per generare piatti, piani e alternative.
2. **Il backend è "stupido" di proposito**: solo endpoint `/ai/*`, nessun dato utente, nessun DB, nessuna auth utente — solo una protezione leggera anti-abuso (chiave app statica + rate limit) per non farsi consumare i crediti LLM da terzi.
3. **Catalogo nel bundle**: il seed del catalogo è un JSON versionato che viaggia con l'app (§5.3), caricato in IndexedDB al primo avvio → ricerca ingredienti sempre offline, zero chiamate di rete.
4. **Privacy gratis**: i dati della famiglia non lasciano mai il dispositivo (all'LLM arrivano solo gli ingredienti della singola richiesta).

### 5.2 Evoluzione futura (fuori scope, ma prevista)

Se in futuro servisse la lista condivisa in famiglia, l'architettura lo consente senza rifare nulla: le entità locali hanno già UUID e `updatedAt`, quindi basterà aggiungere al backend uno store di sync (o passare a Supabase/PowerSync). Decisione rimandata deliberatamente.

### 5.3 Catalogo ingredienti generico (curato da noi)

- **Seed iniziale**: un file JSON di ~200–400 ingredienti comuni della cucina italiana, ognuno con nome, reparto (ricalcato sul layout tipico Esselunga: ortofrutta, banco frigo, macelleria, pescheria, scatolame, surgelati, forno, bevande, casa/igiene…), unità di default e alias per la ricerca ("pomodori pelati" ↔ "pelati"). Lo generiamo una tantum con l'AI e lo rifiniamo a mano — costo zero e nessuna dipendenza esterna. Coerentemente con RF13, **le noci non compaiono nel seed** (aggiungibili manualmente solo per scelta esplicita).
- **Versionato nel repo**: il seed viaggia con l'app; a ogni release gli aggiornamenti vengono applicati in modo **additivo** (merge per `seedVersion`), senza mai sovrascrivere le personalizzazioni fatte dall'utente in app.
- **Estendibile in app**: aggiunta, rinomina, cambio reparto e cancellazione di ingredienti direttamente dall'interfaccia (`origine: seed | utente`).
- **Decisione**: scartata l'integrazione con l'API Pepesto (catalogo Esselunga reale) — il suo valore erano prezzi e promozioni, che non interessano; senza quelli restavano solo costi (€29,90+) e una dipendenza da un servizio terzo di scraping.

### 5.4 Integrazione AI (layer astratto)

Interfaccia interna unica sul backend, provider scelto via env:

```ts
interface RecipeAI {
  generateDish(input: { ingredienti: Ingrediente[]; vincoli: VincoliDietetici; porzioni: number }): Promise<Piatto>;
  generateWeekPlan(input: { ingredientiGlobali: Ingrediente[]; giorni: Slot[]; vincoli: VincoliDietetici }): Promise<PianoSettimana>;
  suggestAlternatives(input: { ingrediente: Ingrediente; contesto: Piatto[] }): Promise<Alternativa[]>;
}
```

- Output sempre **JSON strutturato e validato** (schema con Zod): mai testo libero da parsare.
- Prompt di sistema con: cucina italiana/mediterranea di default, stagionalità, vincoli dietetici della famiglia, porzioni.
- L'AI può proporre ingredienti extra non selezionati → mostrati come "da aggiungere alla lista" con **conferma esplicita** dell'utente.
- Le **alternative** (RF7) vengono generate in batch alla chiusura della lista e salvate localmente → disponibili offline in negozio.
- **Vincoli critici come doppia barriera**: l'esclusione delle noci (allergia) sta sia nel prompt di sistema di ogni chiamata, sia in una **validazione post-generazione** sull'output JSON (blocklist di termini: noci, gherigli, salsa di noci…) che scarta e rigenera il piatto in caso di violazione. Non ci si affida mai al solo prompt per un vincolo di sicurezza.

---

## 6. Modello dati (concettuale)

Tutto risiede in IndexedDB sul dispositivo:

```
Profilo (singleton)                 (porzioni default, vincoli dietetici, ordine reparti,
                                     seedVersion applicata)
Ingrediente                         (nome, reparto, unitàDefault, alias[], note,
                                     origine: seed|utente)
Piatto       ──< PiattoIngrediente  (quantità, unità; piatto: nome, procedimento?, preferito,
                                     origine: manuale|AI)
PianoSettimana ──< Slot             (data, pasto: pranzo|cena, piattoId)
PianoSettimana ──1 ListaSpesa
ListaSpesa   ──< VoceLista          (ingredienteId | testoLibero, quantità, reparto,
                                     checked, checkedAt, alternative[] pre-generate, nota)
```

Le entità portano `id` UUID e `updatedAt`: oggi servono per l'export/import JSON di backup, domani renderebbero indolore l'aggiunta del sync (§5.2).

---

## 7. Flussi UX principali (mobile-first)

1. **Home = ciclo spesa corrente**: griglia verticale di 8 giorni ancorata al giorno della spesa (default venerdì: da cena del venerdì a pranzo del venerdì successivo, il primo giorno mostra solo cena e l'ultimo solo pranzo) con chip pranzo/cena; tap su slot vuoto → scegli da ricettario / componi / ✨ genera con AI.
2. **Generazione**: selezione ingredienti a chip → "Genera piatto" → card risultato con ingredienti evidenziati (posseduti vs da comprare) → accetta / rigenera / modifica.
3. **Lista spesa**: bottone "Genera lista" dal piano → aggregazione (RF8) → revisione (quantità, extra fuori menù) → "chiudi lista" (pre-genera le alternative AI).
4. **Spesa attiva**: schermata ad alto contrasto, righe grandi, raggruppate per reparto in ordine negozio; tap = check (salvato subito in locale); long-press / bottone "manca" → sheet con alternative pre-generate; barra di progresso.
5. **Export**: testo tipo:

   ```
   SPESA 20–26 LUG — Esselunga
   ── Ortofrutta ──
   ☐ Zucchine 500 g
   ☐ Basilico 1 mazzo
   ── Banco frigo ──
   ☐ Mozzarella 2×125 g (quella in vetro)
   ```

---

## 8. Stack tecnologico proposto

| Livello | Scelta | Motivazione |
|---------|--------|-------------|
| Frontend | **React 19 + TypeScript + Vite** | Stack abituale di Walter; Vite ottimo per PWA |
| PWA/offline | `vite-plugin-pwa` (Workbox) + **IndexedDB via Dexie.js** | Dexie: API ergonomica, `liveQuery` per UI reattiva sui dati locali |
| UI | **Tailwind CSS** (+ componenti headless, es. shadcn-style) | Controllo totale sul design mobile-first, leggero |
| Stato | Dexie liveQuery + Zustand per stato UI effimero | I dati "veri" stanno in IndexedDB, non in uno store in memoria |
| Backend | **Serverless functions** (Vercel/Netlify) — o micro NestJS se preferisci lo stack abituale | Unica responsabilità: proxy AI. Stateless, **nessun database server** |
| Auth | Nessuna auth utente; chiave app statica + rate limit sul proxy | Protegge i crediti LLM da abusi, zero attrito per la famiglia |
| AI | Layer astratto (§5.4), provider via env | Claude e GPT entrambi adeguati; si decide con un A/B sui prompt reali |
| Deploy | **Unico progetto** Vercel/Netlify: frontend statico + function proxy | Costo zero, una sola cosa da deployare |

**Alternative scartate (e perché):**
- *Full-stack classico server-centrico*: ogni azione richiede rete → inaccettabile in negozio.
- *Sync multi-dispositivo / lista condivisa*: scartato per scelta d'uso (one-shot per dispositivo); il modello dati lo tiene comunque possibile in futuro (§5.2).
- *Supabase/Firebase*: sovradimensionati ora che non c'è né auth né sync.
- *API Pepesto (catalogo Esselunga reale)*: il valore erano prezzi/promo, fuori interesse — restavano costi e dipendenza da terzi (§5.3).
- *Scraping diretto Esselunga*: fragile, problemi ToS.

---

## 9. Assunzioni da validare

Assunzioni fatte dove mancava una risposta esplicita (segnalate come da processo):

| # | Assunzione | Impatto se sbagliata |
|---|------------|----------------------|
| A1 | ~~Settimana fissa lunedì–domenica~~ **Risolto (19 lug 2026)**: il ciclo è ancorato al giorno in cui si fa la spesa — di solito **venerdì** — non a un lunedì fisso. Copre da cena del giorno di inizio (incluso) a pranzo del giorno di inizio successivo (incluso): 8 giorni, 14 pasti, primo giorno solo cena, ultimo solo pranzo. Configurabile in Altro, default venerdì | — |
| A2 | Solo **pranzo e cena**; il modello dati prevede però `pasto` estensibile (colazione, snack) | Nullo — già previsto |
| A3 | Piatto = nome + ingredienti con quantità + **procedimento breve opzionale** generato dall'AI | Basso |
| A4 | Porzioni: default famiglia, override per piatto | Basso |
| A5 | ~~Vincoli dietetici da compilare~~ **Risolto**: niente noci (allergia, esclusione assoluta); nessun altro vincolo noto, profilo estendibile in app | — |
| A5b | ~~Perdita dati~~ **Risolto**: export/import JSON di backup anticipato all'MVP (F1) | — |
| A6 | ~~Seed da definire~~ **Risolto**: ~300 ingredienti generati con AI e rifiniti a mano, reparti in stile Esselunga | — |
| A7 | Check spuntati: barrati e spostati in fondo al reparto (non nascosti) | Nullo |
| A8 | Nessuna chiave API già disponibile: serve solo una chiave LLM (centesimi per generazione) | Blocca la sola parte AI, il resto dell'app funziona |

## 10. Domande aperte — tutte risolte (15 lug 2026)

| Domanda | Decisione |
|---------|-----------|
| Seed catalogo | Generato con AI, ~300 voci, reparti stile Esselunga, rifinitura insieme |
| Vincoli dietetici | **Niente noci — esclusione assoluta (allergia)**; nessun altro vincolo |
| Framework | **React 19 + TypeScript + Vite** confermato |
| Backup dati | Export/import JSON **anticipato all'MVP (F1)** |

---

## 11. Roadmap proposta

| Fase | Contenuto | Requisiti |
|------|-----------|-----------|
| **MVP (F1)** | PWA offline, piano settimanale, seed catalogo con reparti, generazione AI piatto singolo (con esclusione noci), lista aggregata, spesa attiva, export testo, **backup/import JSON** | RF1–3a, RF4, RF5, RF6, RF8, RF13 (vincolo noci) |
| **F2** | Ordinamento negozio personalizzabile, generazione piano intero e rigenerazione slot, alternative pre-generate, gestione catalogo in app | RF3b-c, RF7, RF10 |
| **F3** | Ricettario, template settimana, gestione vincoli dietetici in app, dispensa, note | RF9, RF11–14 |

Razionale: senza integrazioni esterne il seed catalogo entra già nell'MVP (è solo un JSON); la F2 raffina l'esperienza AI e la spesa in negozio, la F3 aggiunge il contorno.
