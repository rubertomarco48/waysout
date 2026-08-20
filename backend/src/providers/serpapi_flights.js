import axios from "axios";

// ---------------------------------------------------------------------------
// SerpApi - Google Flights Results API.
//
// A VERO servizio a pagamento (non uno scraper fatto in casa): SerpApi
// gestisce loro l'infrastruttura di scraping/anti-bot/proxy contro Google
// Flights e restituisce risultati già in JSON pulito, identici a quelli che
// vedresti nel browser. Documentazione: https://serpapi.com/google-flights-api
//
// ATTENZIONE COSTI: piano gratuito (verificare il numero esatto e
// aggiornato sul tuo account - a seconda della fonte è ~100-250
// ricerche/mese), poi si paga a ricerca (credit-based). Con
// MAX_VERIFIED_DESTINATIONS=24 di default, UNA sola ricerca utente può
// consumare fino a 24 chiamate a questo provider (in parallelo agli
// altri) - anche con 250/mese il piano gratuito si esaurisce in circa
// 10 ricerche reali. Se vuoi tenerlo attivo ma limitare la spesa,
// valuta di abbassare MAX_VERIFIED_DESTINATIONS in config/constants.js
// quando questo provider è configurato, oppure disattivalo e riattivalo
// solo per test mirati.
//
// Implementa l'interfaccia comune usata da src/providers/index.js:
//   - name: string
//   - configured: boolean
//   - cheapestOffer(origin, dest, depDate, retDate) -> { price, departureDate, returnDate, details } | null
//
// NOTA: come per kiwi.js, questo file è scritto dalla documentazione
// ufficiale SerpApi (ben documentata e stabile, a differenza di Ryanair),
// ma non è stato testato con una chiamata reale (serve una API key a
// pagamento/free-tier che non ho). Verifica con una prima chiamata reale
// prima di fidarti ciecamente della struttura di `flights[]` che uso per
// separare andata/ritorno in `splitLegs()`.
// ---------------------------------------------------------------------------

const ENDPOINT = "https://serpapi.com/search";

// Nella risposta di Google Flights per un round trip, `flights` contiene
// TUTTI i segmenti del viaggio (andata + ritorno) in un unico array. Li
// separiamo cercando il primo segmento che atterra sulla destinazione
// richiesta: tutto fino a lì (incluso) è l'andata, il resto è il ritorno.
function splitLegs(flights, destCode) {
  if (!Array.isArray(flights) || !flights.length) return { outboundLegs: [], inboundLegs: [] };
  const idx = flights.findIndex((f) => f.arrival_airport?.id === destCode);
  if (idx === -1) return { outboundLegs: flights, inboundLegs: [] };
  return { outboundLegs: flights.slice(0, idx + 1), inboundLegs: flights.slice(idx + 1) };
}

function legInfo(legs) {
  if (!legs.length) return null;
  return {
    departureTime: legs[0].departure_airport?.time ?? null,
    arrivalTime: legs[legs.length - 1].arrival_airport?.time ?? null,
    stops: legs.length - 1,
    durationMinutes: legs.reduce((sum, l) => sum + (l.duration ?? 0), 0) || null,
  };
}

function dateOnly(datetimeStr, fallback) {
  // Google Flights orari nel formato "YYYY-MM-DD HH:MM"
  if (!datetimeStr) return fallback;
  return datetimeStr.slice(0, 10);
}

export const serpapiGoogleFlights = {
  name: "serpapi-google-flights",

  get configured() {
    return Boolean(process.env.SERPAPI_API_KEY);
  },

  async cheapestOffer(origin, dest, depDate, retDate) {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return null;

    try {
      const { data, status } = await axios.get(ENDPOINT, {
        params: {
          engine: "google_flights",
          departure_id: origin,
          arrival_id: dest,
          outbound_date: depDate,
          return_date: retDate,
          type: 1, // round trip
          currency: "EUR",
          hl: "en",
          adults: 1,
          api_key: apiKey,
        },
        timeout: 15000,
        validateStatus: () => true,
      });

      if (status !== 200) {
        console.warn(`SerpApi/GoogleFlights ${origin}->${dest}: HTTP ${status}`);
        return null;
      }
      if (data?.error) {
        console.warn(`SerpApi/GoogleFlights ${origin}->${dest}: ${data.error}`);
        return null;
      }

      const candidates = [...(data?.best_flights ?? []), ...(data?.other_flights ?? [])];
      if (!candidates.length) return null;

      const best = candidates.reduce((a, b) => (a.price <= b.price ? a : b));
      const { outboundLegs, inboundLegs } = splitLegs(best.flights, dest);
      const outbound = legInfo(outboundLegs);
      const inbound = legInfo(inboundLegs);

      return {
        price: Number(best.price),
        departureDate: dateOnly(outbound?.departureTime, depDate),
        returnDate: dateOnly(inbound?.departureTime, retDate),
        details: {
          airlineCode: outboundLegs[0]?.airline ?? null, // nome compagnia, non codice IATA - vedi resolveAirlineName
          outbound,
          inbound,
        },
      };
    } catch (e) {
      console.warn(`SerpApi/GoogleFlights offer error ${origin}->${dest}: ${e.message}`);
      return null;
    }
  },
};
