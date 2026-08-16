import axios from "axios";

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
  },

  async cheapestOffer(origin, dest, depDate, retDate) {
    const token = process.env.TRAVELPAYOUTS_TOKEN;
    if (!token) return null;

    try {
      const { data, status } = await axios.get("https://api.travelpayouts.com/v1/prices/cheap", {
        headers: { "x-access-token": token },
        params: {
                  origin,
                  destination: dest,
                  depart_date: depDate,
                  return_date: retDate,
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
      if (!byStops) return null;

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
