# waysout backend (Node)

Riscrittura in Node/Express del backend originale Python/FastAPI. Stessa logica,
stesse route, stesso output — solo stack JS.

## Avvio

```bash
npm install
cp .env.example .env   # poi compila le chiavi in .env
npm run dev
```

L'API ascolta su `http://localhost:3001` (vedi `PORT` in `.env`).

Se `MONGO_URL` non è raggiungibile, il server parte comunque: si perde solo
il log delle ricerche (fire-and-forget, non blocca mai le richieste).

Se nessun provider voli è configurato (Amadeus, ecc.), la ricerca funziona
comunque usando solo le stime di prezzo locali (`price_source: "stima"`).

## Struttura

```
src/
  data/
    airports.js       # carica e indicizza data/airports.dat (dataset OpenFlights)
    staticData.js      # costanti: destinazioni curate, immagini, nomi IT, ecc.
  lib/
    geo.js              # haversine
    deterministic.js     # hash deterministico (per stime/date riproducibili)
    tripLogic.js          # meta destinazione, prezzo fallback, calcolo date
    tripSearch.js          # orchestratore della ricerca (equivalente a /api/search)
    db.js                   # connessione Mongo + log ricerche
    validation.js            # validazione input (zod)
  providers/
    amadeus.js               # provider prezzi voli reali (Amadeus)
    index.js                  # registry provider — vedi sotto
  routes/
    api.js                     # route Express
  index.js                      # entry point
```

## Endpoint

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/api/airports` | Aeroporti italiani popolari (dropdown) |
| GET | `/api/airports/search?q=` | Ricerca aeroporti per città/nome/codice |
| GET | `/api/nearest-airports?lat=&lon=` | Aeroporti più vicini a una posizione |
| POST | `/api/search` | Ricerca destinazioni entro budget |

## Aggiungere un nuovo provider di prezzi voli

Il sistema è pensato per aggiungere fonti di prezzi (Kiwi, Skyscanner, ecc.)
senza toccare il resto del codice:

1. Crea `src/providers/<nome>.js` con questa forma (vedi `amadeus.js` come esempio completo):

```js
export const mioProvider = {
  name: "mio-provider",
  get configured() {
    return Boolean(process.env.MIO_PROVIDER_API_KEY);
  },
  async cheapestOffer(origin, dest, depDate, retDate) {
    // chiamata API, ritorna { price, departureDate, returnDate } oppure null
  },
};
```

2. Aggiungi la chiave in `.env` (e in `.env.example`).

3. In `src/providers/index.js`, importa il provider e aggiungilo all'array `PROVIDERS`.

Fatto: `tripSearch.js` interrogherà automaticamente tutti i provider
configurati in parallelo e userà il prezzo più basso trovato, taggando
il risultato con `price_source` (es. `"amadeus"`, `"mio-provider"`, o
`"stima"` se nessun provider ha risposto).

## Differenze rispetto all'originale Python

- Stessa logica di business (pool aeroporti, calcolo date, arricchimento prezzi), riscritta 1:1
- `Pydantic` → validazione con `zod`
- `Motor` (Mongo async Python) → driver ufficiale `mongodb` per Node
- L'`AmadeusClient` con caching token OAuth2 è stato astratto in un'interfaccia "provider" generica per permettere di aggiungerne altri in futuro (nel backend Python era hardcoded)
