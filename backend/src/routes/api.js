import { Router } from "express";
import { AIRPORTS } from "../data/airports.js";
import { POPULAR_IT } from "../data/staticData.js";
import { haversine } from "../lib/geo.js";
import { SearchRequestSchema } from "../lib/validation.js";
import { searchTrips } from "../lib/tripSearch.js";

export const router = Router();

router.get("/", (_req, res) => {
  console.log("GET");
  res.json({ message: "waysout API" });
});

// Default list = popular Italian origins (for the quick dropdown).
router.get("/airports", (_req, res) => {
  console.log("GET airport");
  const pop = AIRPORTS.filter((a) => POPULAR_IT.has(a.code));
  pop.sort((a, b) => a.city.localeCompare(b.city));
  res.json(pop);
});

router.get("/airports/search", (req, res) => {
  console.log("GET airport search");
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const limit = Number(req.query.limit ?? 20);
  if (q.length < 2) return res.json([]);

  const scored = [];
  for (const a of AIRPORTS) {
    const hayCode = a.code.toLowerCase();
    const hayCity = a.city.toLowerCase();
    const hayName = a.name.toLowerCase();
    if (hayCode === q) scored.push([0, a]);
    else if (hayCity.startsWith(q) || hayCode.startsWith(q)) scored.push([1, a]);
    else if (hayCity.includes(q) || hayName.includes(q) || hayCode.includes(q)) scored.push([2, a]);
  }
  scored.sort((x, y) => x[0] - y[0] || x[1].city.localeCompare(y[1].city));
  res.json(scored.slice(0, limit).map(([, a]) => a));
});

router.get("/nearest-airports", (req, res) => {
  console.log("GET nearest airports");
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const limit = Number(req.query.limit ?? 3);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "I parametri lat e lon devono essere numerici." });
  }
  const ranked = [...AIRPORTS].sort((a, b) => haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon));
  const out = ranked.slice(0, limit).map((a) => ({ ...a, distance_km: Math.round(haversine(lat, lon, a.lat, a.lon)) }));
  res.json(out);
});

router.post("/search", async (req, res) => {
  console.log("POST search");
  const parsed = SearchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Richiesta non valida" });
  }
  try {
    const results = await searchTrips(parsed.data);
    res.json(results);
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? "Errore interno" });
  }
});
