import axios from "axios";
import { cacheGet, cacheSet } from "../lib/cache.js";
import { CACHE_TTL_CACHED_MS } from "../config/constants.js";

// Provider "prices/cheap" di Travelpayouts (Aviasales Data API).
//
// IMPORTANTE: a differenza di Amadeus/Sky-scrapper, questa non è una
// ricerca live - restituisce i prezzi più bassi osservati di recente
// dalla cache di Travelpayouts per quella rotta. Ottimo per un'app di
// "esplorazione entro budget" come WaysOut, ma il prezzo esatto va
// riconfermato quando l'utente arriva su Aviasales per prenotare (il
// pulsante "Prenota" della modal lo fa già).
//
// Documentazione: https://travelpayouts.github.io/slate/
// Token: si ottiene dalla pagina Tools > API del programma Aviasales
// nella dashboard Travelpayouts (stessa pagina dove si trova il "marker").
export const travelpayouts = {
  name: "travelpayouts",
  get configured() {
    return Boolean(process.env.TRAVELPAYOUTS_TOKEN);
  },  async cheapestOffer(origin, dest, depDate, retDate) {
    const token = process.env.TRAVELPAYOUTS_TOKEN;
    if (!token) return null;

    try {
      // NOTA IMPORTANTE: /v1/prices/cheap è una cache di prezzi già
      // osservati da ricerche reali su Aviasales, non una ricerca live.
      // Passare un giorno esatto (yyyy-mm-dd) su rotte regionali poco
      // popolari spesso non trova NESSUN dato in cache per quello
      // specifico giorno (anche se la rotta in generale ha dati),
      // risultando in "success:true, data: {}" e quindi sempre stima.
      // Usando la granularità mese (yyyy-mm, supportata dall'API) si
      // recupera il prezzo più basso trovato in cache in tutto il mese,
      // aumentando molto il tasso di successo - accettabile perché il
      // risultato è comunque taggato "cached", non "verified": il codice
      // usa già la data reale (`departure_at`) restituita dalla risposta,
      // non quella richiesta.
      const departMonth = depDate.slice(0, 7);
      const returnMonth = retDate.slice(0, 7);

      const { data, status } = await axios.get("https://api.travelpayouts.com/v1/prices/cheap", {
        headers: { "x-access-token": token },
        params: {
                  origin,
                  destination: dest,
                  depart_date: departMonth,
                  return_date: returnMonth,
                  currency: "eur",
                },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (status !== 200 || !data?.success) {
        console.warn(`Travelpayouts ${origin}->${dest}: HTTP ${status}`);
        return null;
      }

      // La risposta è raggruppata per destinazione e poi per numero di
      // scali: { data: { [dest]: { "0": {...diretto}, "1": {...1 scalo} } } }
      const byStops = data?.data?.[dest];
      if (!byStops) {
        console.warn(`Travelpayouts ${origin}->${dest} ${departMonth}: nessun prezzo in cache per questo mese`);
        return null;
      }

      const entries = Object.entries(byStops); // [["0", {...}], ["1", {...}]]
      if (!entries.length) return null;

      const [stopsKey, cheapest] = entries.reduce((a, b) => (a[1].price <= b[1].price ? a : b));

      return {
        price: cheapest.price,
        departureDate: cheapest.departure_at?.slice(0, 10) ?? depDate,
        returnDate: cheapest.return_at?.slice(0, 10) ?? retDate,
        details: {
          airlineCode: cheapest.airline ?? null,
          outbound: {
            departureTime: cheapest.departure_at ?? null,
            arrivalTime: null, // non fornito da questo endpoint
            stops: Number(stopsKey),
            durationMinutes: null, // non fornito da questo endpoint
          },
          inbound: cheapest.return_at
            ? {
                departureTime: cheapest.return_at,
                arrivalTime: null,
                stops: Number(stopsKey),
                durationMinutes: null,
              }
            : null,
        },
      };
    } catch (e) {
      console.warn(`Travelpayouts offer error ${origin}->${dest}: ${e.message}`);
      return null;
    }
  },
};

// ---------------------------------------------------------------------------
// SWEEP AGGREGATO: /v1/prices/cheap SENZA parametro "destination" restituisce
// in UNA chiamata tutte le destinazioni servite dall'origine con il prezzo
// osservato piu' basso (round trip, EUR), data di partenza/ritorno reale,
// compagnia e durate. E' la fonte primaria della discovery in tripSearch.js:
// decine di destinazioni REALI per ricerca invece delle stime chilometriche.
//
// Granularita' mensile via depart_date=yyyy-mm (stesso compromesso del
// cheapestOffer per-route). Cache interna per (origina, mese): i dati sono
// osservazioni, non ricerche live.
// ---------------------------------------------------------------------------
export async function travelpayoutsSweep(origin, month) {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return [];

  const cacheK = `tp-sweep:${origin}:${month}`;
  const cached = cacheGet(cacheK);
  if (cached) return cached;

  try {
    const { data, status } = await axios.get("https://api.travelpayouts.com/v1/prices/cheap", {
      headers: { "x-access-token": token },
      params: { origin, depart_date: month, currency: "eur" },
      timeout: 12000,
      validateStatus: () => true,
    });

    if (status !== 200 || !data?.success || !data?.data) {
      console.warn(`Travelpayouts sweep ${origin} ${month}: HTTP ${status}`);
      return [];
    }

    const offers = [];
    for (const [dest, byStops] of Object.entries(data.data)) {
      if (!byStops || typeof byStops !== "object") continue;
      let best = null;
      for (const [stopsKey, v] of Object.entries(byStops)) {
        if (!v || typeof v.price !== "number") continue;
        if (!best || v.price < best.price) {
          best = { price: v.price, stops: Number(stopsKey), raw: v };
        }
      }
      const departureDate = best?.raw?.departure_at ? String(best.raw.departure_at).slice(0, 10) : null;
      const returnDate = best?.raw?.return_at ? String(best.raw.return_at).slice(0, 10) : null;
      if (!departureDate || !returnDate || !Number.isFinite(best.price)) continue;

      offers.push({
        destination: dest,
        price: best.price,
        departureDate,
        returnDate,
        details: {
          airlineCode: best.raw.airline ?? null,
          outbound: {
            departureTime: best.raw.departure_at ?? null,
            arrivalTime: null,
            stops: best.stops,
            durationMinutes: best.raw.duration_to ?? null,
          },
          inbound: {
            departureTime: best.raw.return_at ?? null,
            arrivalTime: null,
            stops: best.stops,
            durationMinutes: best.raw.duration_back ?? null,
          },
        },
      });
    }

    cacheSet(cacheK, offers, CACHE_TTL_CACHED_MS);
    return offers;
  } catch (e) {
    console.warn(`Travelpayouts sweep ${origin} ${month}: ${e.message}`);
    return [];
  }
}
