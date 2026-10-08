# La spesa di casa

PWA mobile-first per pianificare pranzo e cena della settimana — generando i piatti anche con
l'AI a partire dagli ingredienti che hai — e trasformare il piano in una lista della spesa
ordinata per reparto, utilizzabile in negozio anche **offline**.

Il ciclo spesa è ancorato al giorno reale in cui si fa la spesa (di default **venerdì**, da cena
inclusa a pranzo del venerdì successivo incluso), configurabile in *Altro*.

## Perché esiste

Il progetto nasce per un uso familiare reale, non come esercizio: l'obiettivo è sostituire il
foglietto a quadretti scritto a biro sul frigo. Le decisioni di prodotto e di design sono
documentate per esteso in [ANALISI.md](ANALISI.md) (requisiti, architettura, modello dati,
roadmap) e [DESIGN.md](DESIGN.md) (identità visiva "il quaderno della spesa", token, schermate).

## Stack

- **Frontend**: Vite + React 19 + TypeScript (strict) + Tailwind CSS v4
- **Dati**: Dexie (IndexedDB) — tutto locale al dispositivo, nessun account, nessun backend dati
- **PWA**: `vite-plugin-pwa`, installabile, funziona offline (tranne la generazione AI)
- **AI**: Google Gemini (`gemini-2.5-flash`) via una Netlify Function stateless; la chiave personale
  è salvata solo nell'IndexedDB del browser e non viene inclusa nei backup
- **Hosting**: Netlify (deploy continuo dal branch `main`)

## Come funziona l'AI

`netlify/functions/ai.ts` è un proxy stateless: riceve la chiave Gemini fornita dall'utente e gli
ingredienti selezionati, propone un piatto e restituisce separatamente cosa hai già (la selezione
stessa, mai un'invenzione del modello) e cosa manca da comprare. La chiave viene usata solo per la
richiesta e non viene salvata dalla Function. In produzione ogni utente può configurare la chiave
al primo avvio, al primo uso dell'AI o da *Altro*; resta nel browser e non viene esportata nei backup.
I **vincoli alimentari** (di default "noci") sono modificabili da *Altro*: ogni generazione passa da
una doppia barriera per gli allergeni riconosciuti (prompt di sistema + controllo sull'output), mentre
per allergie scritte liberamente l'AI le riceve come contesto ma l'app non le verifica da sola.

I suggerimenti di ingredienti alternativi in negozio ("manca qualcosa?") **non** passano dall'AI:
sono una mappa locale curata a mano (`src/lib/sostituzioni.ts`) — istantanea, gratuita e
disponibile offline per costruzione.

## Sviluppo locale

```bash
npm install
```

Due modi di avviare il progetto, a seconda che serva o meno l'AI:

```bash
npm run dev            # solo Vite — http://localhost:5173, l'AI non funziona
npm run netlify:dev    # Vite + Netlify Functions — http://localhost:8888
```

Con `netlify:dev`, **apri il browser sulla porta stampata come "Netlify Dev" (di solito 8888)**,
non sulla porta nuda di Vite: solo il proxy di Netlify conosce le rotte `/.netlify/functions/*`.

Per lo sviluppo locale con `netlify:dev` puoi usare una chiave Gemini in un file `.env` in root
(vedi `.env.example`). Netlify Dev usa questa variabile solo come ripiego locale; in produzione
non è richiesta e l'utente inserisce la propria chiave dalla schermata *Altro*.

```
GEMINI_API_KEY=...
```

## Build e verifica

```bash
npm run build       # typecheck + build di produzione
npm run typecheck    # solo typecheck
```

## Versione

La versione mostrata in *Altro* viene da `package.json`. Per incrementarla e aggiornare anche il lockfile:

```bash
npm run bump                 # patch (es. 1.0.0 → 1.0.1)
npm run bump -- minor
npm run bump -- major
```

## Struttura del progetto

```
src/
  components/    componenti UI riutilizzabili (Button, Chip, RigaLista, TabBar, ...)
  screens/       le 5 schermate: Settimana, Lista, SpesaAttiva, Piatti, Altro
  lib/           logica di dominio (db, piano settimanale, lista, export testo, AI, backup)
  seed/          catalogo ingredienti e piatti d'esempio precaricati al primo avvio
  styles/        token di design (colori, tipografia, spaziatura) e font self-hostati
netlify/functions/ai.ts   proxy AI stateless
design-system/            token e componenti generati dal design system, riferimento visivo
```

## Deploy

Deploy continuo su Netlify a ogni push su `main`. Non serve configurare `GEMINI_API_KEY` sul sito:
in produzione l'AI usa la chiave Gemini configurata localmente dall'utente nell'app.
