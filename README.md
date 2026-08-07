# waysout

Comparatore di viaggi budget-first: imposti budget e giorni a disposizione, e trova le destinazioni raggiungibili entro quel budget, ordinate dalla più economica.

## Struttura del progetto

waysout/
├── backend/ → API Node/Express (porta 3001)
└── frontend/ → interfaccia React/Vite (porta 3000)

Sono due progetti indipendenti (ognuno col proprio `package.json` e `node_modules`), da avviare separatamente.

## Requisiti

- Node.js 18 o superiore
- Un cluster MongoDB (locale o Atlas)
- Chiavi API per almeno un provider di prezzi voli (Amadeus e/o Sky-scrapper via RapidAPI) — senza, l'app funziona comunque ma usa solo stime locali

## Avvio

Apri due terminali separati.

**Terminale 1 — backend**
```bash
cd backend
npm install
cp .env.example .env   # poi compila le variabili in .env
npm run dev
```
L'API sarà su `http://localhost:3001`.

**Terminale 2 — frontend**
```bash
cd frontend
npm install
npm run dev
```
L'interfaccia sarà su `http://localhost:3000`.

## Configurazione

Il file `backend/.env` contiene:
- `MONGO_URL`, `DB_NAME` — connessione al database
- `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` — provider prezzi voli Amadeus
- `RAPIDAPI_SKYSCRAPPER_KEY` — provider prezzi voli Sky-scrapper
- `CORS_ORIGINS` — origini frontend consentite (`*` per sviluppo locale)

Il file `frontend/.env` contiene:
- `VITE_BACKEND_URL` — URL del backend (default `http://localhost:3001`)

Documentazione dettagliata del backend (endpoint API, come aggiungere nuovi provider di prezzi voli) in `backend/README.md`.

## Provider di prezzi voli

Il backend interroga in parallelo tutti i provider configurati e usa il prezzo più basso trovato. Aggiungere un nuovo provider (es. Kiwi) non richiede modifiche al resto del codice — vedi `backend/README.md` per la guida.