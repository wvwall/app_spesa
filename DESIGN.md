# Design Brief — App Spesa Settimanale

> **Versione:** 1.0 · **Data:** 15 luglio 2026 · **Destinatario:** sessione di design (Claude / Figma)
> **Documento di riferimento funzionale:** [ANALISI.md](ANALISI.md) v0.4 — requisiti, architettura e modello dati. Questo brief copre solo UI/UX.

---

## 1. Il prodotto in una frase

PWA mobile-first, in italiano, per una famiglia: si pianificano pranzo e cena della settimana (anche generandoli con l'AI dagli ingredienti disponibili), il piano diventa una lista della spesa ordinata per reparto, e la lista si usa in negozio — offline — spuntando gli articoli e chiedendo alternative per ciò che manca.

**Vincolo non negoziabile ereditato dall'analisi:** in famiglia c'è un'**allergia alle noci**. Il design deve prevedere come i vincoli alimentari vengono comunicati e resi visibili (vedi §8.6).

---

## 2. Tesi di design: due tempi

L'app vive in due momenti opposti della settimana, e il design deve servirli entrambi senza diventare due app:

| | **Tempo 1 — Il divano** | **Tempo 2 — La corsia** |
|---|---|---|
| Dove | Casa, sera, con calma | Esselunga, carrello, fretta |
| Mano | Due mani, esplorazione | **Una mano sola**, pollice |
| Luce | Ambiente domestico | Neon del supermercato |
| Mood | Pianificare è un piacere | Trovare-spuntare-andare |
| Densità | Ricca: piatti, ingredienti, AI | Essenziale: righe grandi, contrasto |

La transizione tra i due tempi è **un solo gesto** (entrare in "spesa attiva") e deve sentirsi come un cambio di marcia: stessa identità, temperatura diversa.

## 3. Concept visivo: il quaderno della spesa

L'oggetto reale che questa app sostituisce è **il foglietto a quadretti scritto a biro** attaccato al frigo. Questo è il territorio visivo — domestico, pratico, affettuoso — da cui derivare ogni scelta.

- **Sfondo**: carta leggermente fredda con **quadrettatura sottilissima** (il quadretto da 5 mm del quaderno), percepibile ma mai invadente. È la texture identitaria dell'app, non un decoro: le righe della lista si appoggiano alla griglia.
- **Inchiostro**: il colore primario interattivo è il **blu biro**, non un blu "da app". I titoli e il testo restano in un nero-inchiostro caldo.
- **Elemento firma (signature)**: **il tratto di penna**. Spuntare un articolo in modalità spesa disegna una linea di barratura animata, leggermente irregolare, come un tratto di biro (SVG path, ~200 ms). È l'unico momento "espressivo" dell'app e il gesto che l'utente ripete più spesso: deve dare soddisfazione. Con `prefers-reduced-motion` il tratto appare senza animazione.
- **Accenti dal banco**: verde basilico per confermato/fatto, rosso pomodoro **solo** per mancanze, errori e allergeni. Usati come una biro rossa: raramente, e per segnare qualcosa.

### Cosa NON fare (anti-brief)

- Niente **tricolore** italiano, niente cliché rustico (legno, tovaglia a scacchi, corsivo "trattoria").
- Niente **foto stock di cibo**: l'app è offline-first, le immagini remote non esistono; l'identità è tipografica e di texture, non fotografica.
- Evitare il template "cream + serif ad alto contrasto + terracotta" e il dark theme con singolo accento acido: qui la direzione è già decisa (§3) e va eseguita, non sostituita con un default.
- Niente numerazioni decorative (01/02/03) — l'unica sequenza vera dell'app sono i giorni della settimana.

---

## 4. Design token

### 4.1 Colori

| Token | Hex | Uso |
|-------|-----|-----|
| `carta` | `#FAFAF6` | Sfondo pagina (tempo 1) |
| `quadretto` | `#E4E7DE` | Griglia di sfondo, bordi quieti, divisori |
| `inchiostro` | `#23261E` | Testo primario |
| `inchiostro-70` | `#5A5E52` | Testo secondario, label |
| `biro` | `#1D3EA5` | Interattivi: link, bottoni, tab attiva, focus |
| `biro-chiaro` | `#E8ECF9` | Sfondi selezione, chip attive |
| `basilico` | `#39724A` | Check fatto, conferme, badge "in dispensa" |
| `pomodoro` | `#BE3F27` | "Manca", errori, allergene. Mai decorativo |
| `lavagna` | `#15181C` | Sfondo dark mode (tempo 1, sera) |

**Dark mode** (pianificazione serale): sfondo `lavagna`, quadrettatura al 6% di bianco, inchiostro → `#E9EAE4`, biro schiarita per il contrasto (`#7C96E8`). La **modalità corsia resta sempre chiara** anche col tema scuro attivo: sotto i neon del supermercato il contrasto positivo (scuro su chiaro) è più leggibile — è una scelta funzionale, il design deve dichiararla nell'UI (nessun "bug del tema").

Tutte le coppie testo/sfondo ≥ 4.5:1 (AA); in modalità corsia puntare a ≥ 7:1 (AAA) per il testo delle voci.

### 4.2 Tipografia

| Ruolo | Font | Note |
|-------|------|------|
| Display (titoli, giorni, numeri grandi) | **Bricolage Grotesque** | Carattere, ma da usare con disciplina: pesi 600–800, mai sotto i 20 px |
| Testo e UI | **Instrument Sans** | 16 px base, line-height 1.5; quantità e numeri con `font-variant-numeric: tabular-nums` |
| Annotazione manuale | **Caveat** | SOLO per due momenti: la nota personale su una voce ("quella in vetro") e l'etichetta della settimana in copertina. Se compare una terza volta, è troppo |

Font self-hostati (vincolo PWA offline: nessun CDN). Scala type: 13 / 16 / 18 / 22 / 28 / 36. In **modalità corsia** la base sale: voci lista a 18–20 px.

### 4.3 Spaziatura, forma, elevazione

- Griglia di spacing **4 pt**; ritmi verticali multipli del quadretto (20 px) dove la lista incontra la griglia di sfondo.
- Radius: 8 px (chip, input), 14 px (card, sheet). Niente pill esasperati, niente spigoli vivi ovunque.
- Elevazione con bordi (`quadretto`) più che con ombre; una sola ombra morbida per gli elementi flottanti (FAB, bottom sheet).
- Touch target minimo **44×44 px**; in modalità corsia **56 px** di altezza riga.

---

## 5. Architettura informativa

Navigazione a **tab bar inferiore** (zona pollice), 4 voci:

```
┌──────────────────────────────────────┐
│              (contenuto)             │
├──────────────────────────────────────┤
│  Settimana │ Lista │ Piatti │ Altro  │
└──────────────────────────────────────┘
```

- **Settimana** (home): il piano Lun–Dom, pranzo/cena.
- **Lista**: la lista della spesa della settimana corrente; da qui si entra in **spesa attiva** (che è a schermo pieno, senza tab bar).
- **Piatti**: ricettario personale + catalogo ingredienti.
- **Altro**: profilo (porzioni, vincoli), backup/ripristino, tema.

La **generazione AI** non è una tab: è un'azione contestuale che compare dove serve (slot vuoto, selezione ingredienti, "riempi la settimana").

---

## 6. Schermate

Per ogni schermata: wireframe indicativo, contenuti d'esempio REALI (da usare nei mockup al posto del lorem ipsum), stati.

### 6.1 Settimana (home)

```
┌──────────────────────────────────────┐
│ La spesa di casa        [◐ tema] [⚙] │
│ Settimana 14–20 luglio    ‹  oggi  › │
├──────────────────────────────────────┤
│ LUNEDÌ 14                            │
│ ☀ Pranzo  Insalata di riso           │
│ ☾ Cena    Zucchine ripiene    [✨]   │
│ MARTEDÌ 15                           │
│ ☀ Pranzo  + aggiungi piatto          │
│ ☾ Cena    Orecchiette cime di rapa   │
│ …                                    │
├──────────────────────────────────────┤
│ [ Genera lista spesa (12 piatti) ]   │
└──────────────────────────────────────┘
```

- Giorno corrente evidenziato (bordo biro); giorni passati attenuati.
- Tap su slot pieno → dettaglio piatto; tap su vuoto → sheet con 3 scelte: *Dal ricettario* / *Componi* / *✨ Genera con AI*.
- **Stati**: settimana vuota (empty state = invito: "Il menù è ancora in bianco. Parti da un giorno o fatti proporre l'intera settimana"), settimana parziale, generazione AI in corso (skeleton sullo slot, mai blocco pagina).
- Contenuti d'esempio: insalata di riso, zucchine ripiene, orecchiette con cime di rapa, risotto ai frutti di mare, pollo al limone con patate, parmigiana di melanzane, minestrone. **Mai piatti con noci negli esempi.**

### 6.2 Generazione piatto con AI

Flusso in sheet/pagina: selezione ingredienti a chip (ricerca + reparti) → porzioni → "Genera" → **card risultato**:

```
┌──────────────────────────────────────┐
│ ✨ Proposta per martedì cena          │
│                                      │
│  ORECCHIETTE CON CIME DI RAPA        │
│  30 min · 4 porzioni                 │
│  Hai già: orecchiette, aglio, olio   │
│  Da comprare: cime di rapa 500 g,    │
│  acciughe 1 conf.                    │
│  ▸ procedimento (3 passi)            │
│                                      │
│  [ Va bene ]  [ Rigenera ]  [ ✎ ]    │
└──────────────────────────────────────┘
```

- Distinzione visiva netta tra ingredienti **posseduti** (basilico, check) e **da comprare** (biro, si aggiungeranno alla lista).
- Se l'AI propone ingredienti extra non selezionati → riga dedicata "L'AI aggiunge: … " con conferma esplicita.
- **Stati**: loading (3–8 s: messaggio di attesa che cita gli ingredienti scelti, non spinner muto), errore rete ("Serve la connessione per generare. Il resto dell'app funziona anche offline."), rigenerazione.

### 6.3 Lista spesa (revisione)

Raggruppata per reparto nell'ordine del negozio; quantità aggregate dai piatti; voci extra fuori menù aggiungibili in coda. Azioni: modifica quantità, nota (in Caveat), elimina, `[ Esporta testo ]`, `[ Inizia la spesa ]` (primaria).

### 6.4 Spesa attiva (schermo pieno) — la schermata più importante

```
┌──────────────────────────────────────┐
│ ✕ Esselunga · 14–20 lug    9 di 23   │
│ ████████████░░░░░░░░░  (progresso)   │
├──────────────────────────────────────┤
│ ORTOFRUTTA                           │
│ ◻ Cime di rapa · 500 g               │
│ ◻ Zucchine · 1 kg                    │
│ ~~Basilico · 1 mazzo~~        ✓      │
│                                      │
│ BANCO FRIGO                          │
│ ◻ Mozzarella · 2×125 g               │
│   “quella in vetro”                  │
├──────────────────────────────────────┤
│            [ ⚠ Manca qualcosa? ]     │
└──────────────────────────────────────┘
```

- **Tap sull'intera riga = check** (non solo sul quadratino) → tratto di biro animato + la voce scivola in fondo al reparto. Undo immediato con secondo tap.
- Righe 56 px, testo 18–20 px, contrasto AAA, niente elementi non essenziali.
- Reparto completato → header col segno di spunta e collasso automatico (riapribile).
- **"Manca"**: long-press su una voce (o bottone fisso in basso) → bottom sheet con le **alternative pre-generate**: "Non trovi le cime di rapa? Vanno bene anche: broccoletti · friarielli surgelati · spinaci freschi". Scelta → sostituzione in lista con etichetta "sostituito".
- **Indicatore offline** discreto ma presente ("Offline — tutto salvato sul telefono").
- **Stati**: lista completata (momento di chiusura gratificante ma sobrio: totale articoli, tempo, `[ Chiudi la spesa ]`), lista vuota (non si può entrare in modalità spesa senza lista).

### 6.5 Piatti & catalogo

Due segmenti: **Ricettario** (card compatte: nome, tempo, ★ preferito, origine ✨AI/manuale) e **Ingredienti** (catalogo seed + propri, raggruppati per reparto, ricerca con alias). Azioni CRUD leggere, swipe per eliminare con conferma.

### 6.6 Altro / Profilo

Porzioni default, **vincoli alimentari** (vedi §8.6), ordine reparti personalizzabile (drag), backup (esporta/importa JSON), tema, info versione seed.

---

## 7. Motion

- **Un solo momento firma**: il tratto di biro sul check (200 ms, easing tipo pennata: veloce al centro).
- Transizione ingresso "spesa attiva": salita a schermo pieno con cambio densità percepibile (300 ms).
- Tutto il resto: transizioni di posizione/opacity ≤ 150 ms, nessun parallax, nessun effetto ambientale.
- `prefers-reduced-motion`: tutte le animazioni sostituite da cambi di stato istantanei.

## 8. Regole trasversali

1. **Pollice prima di tutto**: azioni primarie nella metà inferiore dello schermo; niente azioni critiche nell'angolo alto.
2. **Offline è lo stato normale**, non un errore: solo le azioni AI dichiarano di aver bisogno di rete.
3. **Focus visibile** (anello biro 2 px) su ogni interattivo; navigazione da tastiera completa su desktop.
4. **Copy**: italiano piano, verbi attivi, sentence case. I bottoni dicono cosa succede ("Genera lista spesa", non "Procedi"). Gli errori spiegano e propongono ("Il piatto non è arrivato. Riprova o componilo a mano."), mai scuse generiche. Gli empty state invitano all'azione.
5. **Un'unica moneta di attenzione**: il rosso `pomodoro` compare solo per mancanze/errori/allergeni — se una schermata ne ha più di uno, qualcosa è sbagliato nel flusso, non nel colore.
6. **Allergene sempre visibile**: nel profilo il vincolo "niente noci" è mostrato come badge `pomodoro` non rimovibile con leggerezza (conferma doppia per disattivarlo). Ogni card generata dall'AI riporta in calce "✓ verificato: senza noci". Se l'utente aggiunge manualmente noci al catalogo o a una lista, l'app lo consente ma marca la voce con ⚠.
7. **Responsive**: mobile 360–430 px è il target di progetto; tablet/desktop = layout a colonna centrata max 640 px (la settimana può passare a griglia 2 colonne ≥ 768 px). Safe area iOS (notch, home indicator) rispettata; la PWA installata è l'esperienza di riferimento.

## 9. Deliverable richiesti alla sessione di design

1. **Design system minimo**: token (§4) tradotti in stili + componenti: bottone (3 varianti), chip ingrediente (default/selezionata/posseduta), card piatto, riga lista (default/checked/sostituita/con nota), tab bar, bottom sheet, input ricerca, badge allergene, toast.
2. **6 schermate chiave** in mobile 390×844: Settimana (piena), Generazione AI (risultato), Lista revisione, **Spesa attiva** (con un reparto completato e una nota Caveat visibile), sheet Alternative, Profilo/vincoli.
3. **2 stati critici**: empty state della Settimana; loading della generazione AI.
4. **Dark mode** della sola schermata Settimana (per validare i token).
5. Il **tratto di biro**: spec della micro-animazione del check (keyframe o descrizione Lottie/SVG).

Priorità se il tempo è poco: Spesa attiva > Settimana > Generazione AI > resto.

## 10. Vincoli tecnici per il design

- Implementazione: React 19 + Tailwind CSS; PWA offline-first → **nessun asset remoto** (font self-hostati, icone SVG inline — set consigliato: Lucide).
- Niente immagini raster: identità solo tipografica/vettoriale (anche per peso bundle).
- La quadrettatura di sfondo è un pattern CSS/SVG ripetuto, non un'immagine.
- Tutto il testo dell'interfaccia in **italiano**.
