import axios from "axios";

// ---------------------------------------------------------------------------
// Amadeus flight-price provider (OAuth2 client-credentials, token cached).
// Implements the common provider interface used by src/providers/index.js:
//   - name: string
//   - configured: boolean
//   - cheapestOffer(origin, dest, depDate, retDate) -> { price, departureDate, returnDate } | null
// ---------------------------------------------------------------------------
class AmadeusProvider {
  constructor() {
    this.name = "amadeus";
    this.clientId = process.env.AMADEUS_CLIENT_ID;
    this.clientSecret = process.env.AMADEUS_CLIENT_SECRET;
    this.baseUrl = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com";
    this._token = null;
    this._expiry = 0; // epoch ms
    this._tokenPromise = null; // in-flight token request, acts as a lock
  }

  get configured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async getToken() {
    if (!this.configured) return null;

    if (this._token && Date.now() < this._expiry) {
      return this._token;
    }

    // If a token fetch is already in flight, await it instead of firing a
    // second one (mirrors the asyncio.Lock in the Python version).
    if (this._tokenPromise) return this._tokenPromise;

    this._tokenPromise = this._fetchToken().finally(() => {
      this._tokenPromise = null;
    });
    return this._tokenPromise;
  }

  async _fetchToken() {
    try {
      const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });
      const { data } = await axios.post(`${this.baseUrl}/v1/security/oauth2/token`, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      });
      this._token = data.access_token;
      this._expiry = Date.now() + ((data.expires_in ?? 1799) - 30) * 1000;
      return this._token;
    } catch (e) {
      console.warn(`Amadeus token error: ${e.message}`);
      return null;
    }
  }

  async cheapestOffer(origin, dest, depDate, retDate) {
    const token = await this.getToken();
    if (!token) return null;

    try {
      const { data, status } = await axios.get(`${this.baseUrl}/v2/shopping/flight-offers`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          originLocationCode: origin,
          destinationLocationCode: dest,
          departureDate: depDate,
          returnDate: retDate,
          adults: 1,
          currencyCode: "EUR",
          max: 5,
        },
        timeout: 12000,
        validateStatus: () => true,
      });

      if (status !== 200) return null;
      const offers = data.data ?? [];
      if (!offers.length) return null;

      const best = offers.reduce((a, b) => (Number(a.price.total) <= Number(b.price.total) ? a : b));
      const itineraries = best.itineraries;
      const outDep = itineraries[0].segments[0].departure.at.slice(0, 10);
      const retDep = itineraries.length > 1 ? itineraries[itineraries.length - 1].segments[0].departure.at.slice(0, 10) : retDate;

      return {
        price: Number(best.price.total),
        departureDate: outDep,
        returnDate: retDep,
      };
    } catch (e) {
      console.warn(`Amadeus offer error ${origin}->${dest}: ${e.message}`);
      return null;
    }
  }
}

export const amadeus = new AmadeusProvider();
