// Costruisce il link di prenotazione affiliato (Aviasales via Travelpayouts)
// per una destinazione specifica. Ogni click che porta a una prenotazione
// genera una commissione, tracciata tramite il "marker" (ID partner).
//
// Formato ufficiale della pagina di ricerca Aviasales:
// https://search.aviasales.com/flights/?origin_iata=..&destination_iata=..&depart_date=YYYY-MM-DD&return_date=YYYY-MM-DD&adults=1&children=0&infants=0&trip_class=0
//
// Questo URL viene poi "avvolto" nel link di tracciamento tp.media, che
// registra il click a nome del marker prima di rimandare l'utente alla
// pagina di ricerca vera e propria.

const MARKER = "761884";
const CAMPAIGN_ID = "100"; // ID del programma Aviasales su Travelpayouts
const P = "4114";
const TRS = "559961";

export function buildAviasalesBookingLink(trip) {
  if (!trip?.origin_code || !trip?.dest_code || !trip?.departure_date || !trip?.return_date) {
    return null;
  }

  const searchUrl = new URL("https://search.aviasales.com/flights/");
  searchUrl.searchParams.set("origin_iata", trip.origin_code);
  searchUrl.searchParams.set("destination_iata", trip.dest_code);
  searchUrl.searchParams.set("depart_date", trip.departure_date);
  searchUrl.searchParams.set("return_date", trip.return_date);
  searchUrl.searchParams.set("adults", "1");
  searchUrl.searchParams.set("children", "0");
  searchUrl.searchParams.set("infants", "0");
  searchUrl.searchParams.set("trip_class", "0"); // 0 = economica

  const wrapper = new URL("https://tp.media/r");
  wrapper.searchParams.set("campaign_id", CAMPAIGN_ID);
  wrapper.searchParams.set("marker", MARKER);
  wrapper.searchParams.set("p", P);
  wrapper.searchParams.set("trs", TRS);
  wrapper.searchParams.set("u", searchUrl.toString());

  return wrapper.toString();
}
