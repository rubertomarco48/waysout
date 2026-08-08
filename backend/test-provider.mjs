// Script di diagnostica: verifica se il provider Sky-scrapper risponde
// con dati reali su una rotta popolare (dove sicuramente esistono voli),
// per capire se il problema è l'API in generale o solo rotte di nicchia
// come BDS -> SLD.
//
// USO: dalla cartella backend/, con il tuo .env già compilato:
//   node test-provider.mjs

import "dotenv/config";
import axios from "axios";
import { skyscrapper } from "./src/providers/skyscrapper.js";
import { amadeus } from "./src/providers/amadeus.js";
import { travelpayouts } from "./src/providers/travelpayouts.js";

const routes = [
  ["MXP", "BCN"], // Milano -> Barcellona, rotta molto trafficata
  ["FCO", "CDG"], // Roma -> Parigi
];

const depDate = "2026-09-15";
const retDate = "2026-09-18";

console.log("Sky-scrapper configurato:", skyscrapper.configured);
console.log("Amadeus configurato:", amadeus.configured);
console.log("Travelpayouts configurato:", travelpayouts.configured);
console.log("---");

// Chiamata "grezza" a Sky-scrapper, senza passare dal provider, per vedere
// lo status HTTP e il body esatto della risposta (il provider normale
// nasconde questi dettagli e ritorna solo null in caso di problemi).
async function rawSkyscrapperCall(origin, dest) {
  const host = process.env.RAPIDAPI_SKYSCRAPPER_HOST || "sky-scrapper.p.rapidapi.com";
  const key = process.env.RAPIDAPI_SKYSCRAPPER_KEY;
  console.log(`  Host usato: ${host}`);
  console.log(`  Chiave presente: ${key ? `sì (${key.length} caratteri)` : "NO"}`);
  try {
    const { data, status } = await axios.get(`https://${host}/api/v1/flights/searchFlights`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
      params: {
        originSkyId: origin,
        destinationSkyId: dest,
        date: depDate,
        returnDate: retDate,
        adults: 1,
        currency: "EUR",
        market: "IT",
        countryCode: "IT",
      },
      timeout: 12000,
      validateStatus: () => true, // non lanciare eccezione su 4xx/5xx, vogliamo vederli
    });
    console.log(`  HTTP status: ${status}`);
    console.log(`  Risposta (primi 800 caratteri):`);
    console.log("  " + JSON.stringify(data).slice(0, 800));
  } catch (e) {
    console.log(`  Errore di rete/connessione: ${e.message}`);
  }
}

for (const [origin, dest] of routes) {
  console.log(`\n== ${origin} -> ${dest} ==`);

  if (skyscrapper.configured) {
    console.log("--- Chiamata grezza (mostra status HTTP ed errore reale) ---");
    await rawSkyscrapperCall(origin, dest);

    console.log("--- Tramite il provider dell'app (quello che usa la ricerca) ---");
    try {
      const r = await skyscrapper.cheapestOffer(origin, dest, depDate, retDate);
      console.log("Sky-scrapper:", r ? JSON.stringify(r, null, 2) : "null (nessuna offerta trovata)");
    } catch (e) {
      console.log("Sky-scrapper ERRORE:", e.message);
    }
  }

  if (amadeus.configured) {
    try {
      const r = await amadeus.cheapestOffer(origin, dest, depDate, retDate);
      console.log("Amadeus:", r ? JSON.stringify(r, null, 2) : "null (nessuna offerta trovata)");
    } catch (e) {
      console.log("Amadeus ERRORE:", e.message);
    }
  }

  if (travelpayouts.configured) {
    try {
      const r = await travelpayouts.cheapestOffer(origin, dest, depDate, retDate);
      console.log("Travelpayouts:", r ? JSON.stringify(r, null, 2) : "null (nessuna offerta trovata)");
    } catch (e) {
      console.log("Travelpayouts ERRORE:", e.message);
    }
  }
}
