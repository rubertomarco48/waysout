const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const API = `${BASE}/api`;

async function req(path, opts) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Errore ${res.status}`);
  }
  return res.json();
}

export const getAirports = () => req("/airports");

export const searchAirports = (q) => req(`/airports/search?q=${encodeURIComponent(q)}`);

export const getNearestAirports = (lat, lon) => req(`/nearest-airports?lat=${lat}&lon=${lon}`);

export const searchTrips = (payload) =>
  req("/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
