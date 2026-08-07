import axios from "axios";

// ---------------------------------------------------------------------------
// Sky-scrapper provider (via RapidAPI - unofficial Skyscanner-data scraper).
// Same provider interface as amadeus.js:
//   - name: string
//   - configured: boolean
//   - cheapestOffer(origin, dest, depDate, retDate) -> { price, departureDate, returnDate } | null
//
// NOTE: this is a third-party scraper API, not an official flight-data
// source like Amadeus. It can be slower/less reliable and its endpoints
// have changed before (e.g. searchFlightEverywhereDetails is marked
// "Deprecated" on RapidAPI as of writing) - double check the current
// endpoint name/params in the RapidAPI console if this stops working.
// ---------------------------------------------------------------------------
class SkyscrapperProvider {
  constructor() {
    this.name = "skyscrapper";
    this.apiKey = process.env.RAPIDAPI_SKYSCRAPPER_KEY;
    this.host = process.env.RAPIDAPI_SKYSCRAPPER_HOST || "sky-scrapper.p.rapidapi.com";
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  async cheapestOffer(origin, dest, depDate, retDate) {
    if (!this.configured) return null;

    try {
      const { data, status } = await axios.get(
        `https://${this.host}/api/v1/flights/searchFlights`,
        {
          headers: {
            "x-rapidapi-key": this.apiKey,
            "x-rapidapi-host": this.host,
          },
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
          validateStatus: () => true,
        }
      );

      if (status !== 200 || !data?.status) return null;

      const itineraries = data?.data?.itineraries ?? [];
      if (!itineraries.length) return null;

      // Itineraries are usually pre-sorted by price, but sort defensively.
      const cheapest = itineraries.reduce((a, b) =>
        (a.price?.raw ?? Infinity) <= (b.price?.raw ?? Infinity) ? a : b
      );

      const price = cheapest?.price?.raw;
      if (!Number.isFinite(price)) return null;

      // Sky-scrapper returns the actual flown dates on the leg objects;
      // fall back to the requested dates if the shape differs.
      const outDate = cheapest?.legs?.[0]?.departure?.slice(0, 10) ?? depDate;
      const retLeg = cheapest?.legs?.length > 1 ? cheapest.legs[cheapest.legs.length - 1] : null;
      const returnOut = retLeg?.departure?.slice(0, 10) ?? retDate;

      return { price, departureDate: outDate, returnDate: returnOut };
    } catch (e) {
      console.warn(`Sky-scrapper offer error ${origin}->${dest}: ${e.message}`);
      return null;
    }
  }
}

export const skyscrapper = new SkyscrapperProvider();
