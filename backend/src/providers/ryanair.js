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

// Somma/giorni sottrae giorni a una data ISO yyyy-mm-dd (aritmetica UTC).
function shiftIso(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Data ISO di una tariffa: i nomi dei campi sono cambiati in passato
// (day vs arrivalDate vs departureDate), si provano piu' varianti.
function fareDate(fare, monthParam) {
  let date = fare.arrivalDate || fare.departureDate || fare.date || null;
  if (!date && fare.day) {
    // Ricostruisce yyyy-mm-dd dal giorno del mese + il mese richiesto.
    const day = String(fare.day).padStart(2, "0");
    date = `${monthParam.slice(0, 7)}-${day}`;
  }
  return date ? String(date).slice(0, 10) : null;
}

// Tariffa piu' economica la cui data cade nella finestra [fromIso..toIso].
// Prendere il minimo del mese SENZA finestra produce coppie andata/ritorno
// indipendenti anche a settimane di distanza (es. andata 8/9 ritorno 29/9):
// non e' il viaggio che l'utente ha chiesto.
function cheapestFareInWindow(leg, monthParam, fromIso, toIso) {
  const fares = leg?.fares;
  if (!Array.isArray(fares)) return null;

  let best = null;
  for (const f of fares) {
    if (!f || f.unavailable || f.soldOut || f.price?.value == null) continue;
    const date = fareDate(f, monthParam);
    if (!date) continue;
    if (fromIso && date < fromIso) continue;
    if (toIso && date > toIso) continue;
    const price = Number(f.price.value);
    if (!best || price < best.price) best = { price, date };
  }
  return best;
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
        params: {
          outboundMonthOfDate: outboundMonth,
          inboundMonthOfDate: inboundMonth,
          // SENZA questo parametro l'endpoint risponde con la valuta del
          // geo-IP del chiamante (es. GBP da IP UK/USA): prezzi ~17% sottostimati
          // trattati come euro. Verificato dal vivo il 21/08/2026 su STN->DUB.
          currency: "EUR",
        },
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

      // Andata entro +/-3 giorni dalla data candidata, ritorno coerente
      // con la durata richiesta (dur-2 .. dur+3 dalla partenza scelta):
      // il risultato resta un viaggio della lunghezza chiesta dall'utente.
      const requestedDays = Math.max(
        1,
        Math.round((new Date(retDate + "T00:00:00Z") - new Date(depDate + "T00:00:00Z")) / 86400000)
      );
      const outboundFare = cheapestFareInWindow(
        data?.outbound,
        outboundMonth,
        shiftIso(depDate, -3),
        shiftIso(depDate, 3)
      );
      if (!outboundFare) return null;

      const inboundFare = cheapestFareInWindow(
        data?.inbound,
        inboundMonth,
        // Almeno 1 giorno di distanza dall'andata: niente "round trip"
        // con ritorno lo stesso giorno.
        shiftIso(outboundFare.date, Math.max(1, requestedDays - 2)),
        shiftIso(outboundFare.date, requestedDays + 3)
      );

      // Se non c'e' un ritorno coerente con la durata, l'offerta non viene
      // proposta per niente (niente "sola andata" travestita da round trip).
      if (!inboundFare) return null;

      const totalPrice = outboundFare.price + inboundFare.price;

      return {
        price: totalPrice,
        departureDate: outboundFare.date,
        returnDate: inboundFare.date,
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
