import axios from "axios";

// ---------------------------------------------------------------------------
// Ryanair "farfnd" (fare finder) provider.
//
// Non è un'API ufficiale/documentata - è l'endpoint JSON che il sito
// ryanair.com stessa chiama per popolare il suo fare finder. Nessuna API
// key richiesta, quindi `configured` è sempre true (disattivabile via env
// var RYANAIR_ENABLED=false se in futuro smettesse di funzionare o Ryanair
// la bloccasse). Restituisce prezzi reali dal loro motore, non una cache
// di terzi come Travelpayouts - per questo è taggato "verified" in
// config/constants.js, come Amadeus/Sky-scrapper/Kiwi.
//
// L'endpoint lavora a livello di MESE, non di giorno esatto: restituisce
// il prezzo più economico per ciascun giorno del mese richiesto, sia per
// l'andata (outboundMonthOfDate) sia per il ritorno (inboundMonthOfDate).
// Qui si prende il minimo del mese per ciascuna tratta, esattamente come
// già fatto con Travelpayouts (vedi travelpayouts.js) - è un compromesso
// ragionevole per un'app di "esplorazione entro budget", non di booking
// esatto.
//
// ATTENZIONE: questo endpoint non è documentato ufficialmente e la sua
// forma è nota per cambiare nel tempo. Il parsing sotto è scritto in modo
// difensivo (controlla più nomi di campo possibili) ma NON è stato
// verificato con una chiamata reale: la rete della sandbox in cui è stato
// scritto questo file ha un allowlist che blocca services-api.ryanair.com
// (viene mascherato da HTTP 403 con header "x-deny-reason: host_not_allowed"
// - se testando tu vedi lo stesso pattern di 403 su ogni rotta, controlla
// prima questo, non è detto sia Ryanair a bloccare voi).
//
// Prima di fidarti dei prezzi, testa con:
//
//   curl "https://services-api.ryanair.com/farfnd/3/roundTripFares/BRI/CIA/cheapestPerDay?outboundMonthOfDate=2026-10-01&inboundMonthOfDate=2026-10-01"
//
// Se la forma della risposta non corrisponde a quella attesa qui sotto,
// aggiorna `extractCheapestFare()` di conseguenza.
// ---------------------------------------------------------------------------

const BASE_URL = "https://services-api.ryanair.com/farfnd/3/roundTripFares";

function toMonthParam(isoDate) {
  // L'API vuole il primo giorno del mese: yyyy-mm-01
  return `${isoDate.slice(0, 7)}-01`;
}

// La risposta osservata storicamente ha la forma:
//   { outbound: { fares: [ { day, arrivalDate, price: { value, ... }, unavailable, soldOut }, ... ] },
//     inbound:  { fares: [ ... ] } }
// ma i nomi dei campi data (day vs arrivalDate vs departureDate) sono
// cambiati in passato - questa funzione prova più varianti.
function extractCheapestFare(leg, monthParam) {
  const fares = leg?.fares;
  if (!Array.isArray(fares) || !fares.length) return null;

  const usable = fares.filter((f) => f && !f.unavailable && !f.soldOut && f.price?.value != null);
  if (!usable.length) return null;

  const cheapest = usable.reduce((a, b) => (a.price.value <= b.price.value ? a : b));

  let date = cheapest.arrivalDate || cheapest.departureDate || cheapest.date || null;
  if (!date && cheapest.day) {
    // Ricostruisce yyyy-mm-dd dal giorno del mese + il mese richiesto.
    const day = String(cheapest.day).padStart(2, "0");
    date = `${monthParam.slice(0, 7)}-${day}`;
  }

  return { price: Number(cheapest.price.value), date: date ? date.slice(0, 10) : null };
}

export const ryanair = {
  name: "ryanair",

  get configured() {
    return process.env.RYANAIR_ENABLED !== "false";
  },

  async cheapestOffer(origin, dest, depDate, retDate) {
    const outboundMonth = toMonthParam(depDate);
    const inboundMonth = toMonthParam(retDate);

    try {
      const { data, status } = await axios.get(`${BASE_URL}/${origin}/${dest}/cheapestPerDay`, {
        params: { outboundMonthOfDate: outboundMonth, inboundMonthOfDate: inboundMonth },
        headers: {
          // Alcuni endpoint "semi-pubblici" come questo rifiutano richieste
          // senza uno User-Agent da browser - non verificato con certezza
          // per questo endpoint specifico (vedi nota in cima al file: la
          // mia rete sandbox non riesce a raggiungere ryanair.com per un
          // test reale), ma è una precauzione ragionevole e innocua.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (status === 404) return null; // rotta non operata da Ryanair
      if (status !== 200) {
        console.warn(`Ryanair ${origin}->${dest}: HTTP ${status}`);
        return null;
      }

      const outboundFare = extractCheapestFare(data?.outbound, outboundMonth);
      const inboundFare = extractCheapestFare(data?.inbound, inboundMonth);
      if (!outboundFare) return null;

      // Sola andata se non troviamo un ritorno utilizzabile nel mese
      // richiesto (es. rotta stagionale, o ritorno oltre fine mese).
      const totalPrice = outboundFare.price + (inboundFare?.price ?? 0);

      return {
        price: totalPrice,
        departureDate: outboundFare.date ?? depDate,
        returnDate: inboundFare?.date ?? retDate,
        details: {
          airlineCode: "FR",
          outbound: {
            departureTime: outboundFare.date ?? null,
            arrivalTime: null,
            stops: 0, // Ryanair opera solo voli diretti
            durationMinutes: null,
          },
          inbound: inboundFare
            ? { departureTime: inboundFare.date ?? null, arrivalTime: null, stops: 0, durationMinutes: null }
            : null,
        },
      };
    } catch (e) {
      console.warn(`Ryanair offer error ${origin}->${dest}: ${e.message}`);
      return null;
    }
  },
};
