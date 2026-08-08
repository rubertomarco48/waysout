# Deploy su Vercel

Questo repository usa **Vercel Services** (funzione in beta) per pubblicare
frontend e backend come un unico progetto Vercel, sotto lo stesso dominio.
La configurazione è in `vercel.json` alla radice.

## ⚠️ Prima di tutto: rimuovi i file .env dal repository

Il repository era privo di `.gitignore`, quindi `frontend/.env` e
`backend/.env` sono finiti nella cronologia Git — incluse la vera stringa
di connessione MongoDB e la vera chiave RapidAPI dentro `backend/.env`.
Questo è il motivo per cui il sito in produzione chiamava
`localhost:3001`: Vite legge `.env` anche in build di produzione se lo
trova, quindi il valore locale sovrascriveva tutto.

Segui questi passaggi, in ordine:

1. **Cambia subito le credenziali esposte** — anche dopo averle tolte da
   Git, chiunque abbia visto il repository (specie se pubblico) le ha
   già viste. Rimuoverle dal codice non le invalida:
   - MongoDB Atlas → cambia la password dell'utente del database (o crea
     un nuovo utente ed elimina il vecchio)
   - RapidAPI → dashboard Sky-scrapper → rigenera la API key
2. Rimuovi i file dal tracking Git (restano sul disco, solo non più
   versionati):
   ```bash
   git rm --cached frontend/.env backend/.env
   git add .gitignore frontend/.env.example
   git commit -m "rimuove .env dal repo, aggiunge .gitignore"
   git push
   ```
3. Da questo momento, i file `.env` restano **solo in locale** e non
   vengono mai committati (il nuovo `.gitignore` li esclude
   automaticamente)
4. Inserisci le credenziali **nuove** (dopo averle rigenerate) sia nel
   tuo `backend/.env` locale sia nelle Environment Variables del
   progetto Vercel (vedi sezione sotto)

## Passaggio obbligatorio nel pannello Vercel

`vercel.json` da solo non basta: bisogna anche impostare il **Framework
Preset** del progetto su **Services**, altrimenti Vercel ignora la
configurazione `services` e prova ad autorilevare un progetto normale
(fallendo subito dopo il clone del repo).

1. Vercel → il tuo progetto → **Settings → General**
2. **Framework Preset** → seleziona **Services**
3. Salva

## Variabili d'ambiente da impostare

Nel pannello **Settings → Environment Variables**, aggiungi (stessi nomi
di `backend/.env.example`):

- `MONGO_URL`
- `DB_NAME`
- `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` (il portale self-service di
  Amadeus è stato chiuso il 17 luglio 2026 — non più utilizzabile, lasciare
  vuoto)
- `RAPIDAPI_SKYSCRAPPER_KEY` / `RAPIDAPI_SKYSCRAPPER_HOST` (opzionali, si è
  dimostrato inaffidabile nei test — l'app funziona bene anche senza)
- `TRAVELPAYOUTS_TOKEN` — token dalla dashboard Travelpayouts (programma
  Aviasales → Tools → API), è il provider di prezzi reali attualmente
  raccomandato
- `CORS_ORIGINS` → puoi lasciare `*`, ma nota che in produzione con
  Services frontend e backend condividono lo stesso dominio: le chiamate
  dal frontend a `/api/...` sono same-origin, quindi CORS non entra
  praticamente in gioco (serve solo se qualcun altro chiama l'API da un
  dominio esterno)

**Non serve** impostare `VITE_BACKEND_URL` in produzione: il frontend usa
un percorso relativo (`/api/...`) quando la variabile non è definita in
build di produzione, e Vercel instrada internamente al servizio backend
tramite le "rewrites" in `vercel.json`.

## Come Vercel Services identifica il backend Node

A differenza del deploy "zero-config" di Express descritto sopra, quando
si usa **Services** Vercel richiede un `entrypoint` esplicito se rileva
un framework (qui: Express) — non basta più che il file chiami
`app.listen()`. Nel nostro caso:

```json
"backend": { "root": "backend/", "entrypoint": "src/index.js" }
```

`entrypoint` è relativo alla cartella del servizio (`backend/`), quindi
punta a `backend/src/index.js`. Non ho trovato un esempio ufficiale
Vercel con un `entrypoint` `.js` per Node (solo esempi Python tipo
`"main:app"`), quindi se il prossimo deploy desse ancora errore su
questo punto, prova in alternativa il percorso completo dalla radice del
progetto: `"entrypoint": "backend/src/index.js"`.

## Se "Services" (beta) dovesse dare problemi

In alternativa più collaudata (non beta): due progetti Vercel separati
sullo stesso repository, ciascuno con **Root Directory** diversa
(`frontend` e `backend`), oppure backend ospitato altrove (Railway,
Render) con URL assoluto in `VITE_BACKEND_URL`.
