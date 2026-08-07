import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { NAME_OVERRIDE } from "./staticData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "airports.dat");

function loadAirports() {
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const rows = parse(raw, { relax_column_count: true, skip_empty_lines: true });

  const out = [];
  const seen = new Set();

  for (const row of rows) {
    if (row.length < 13) continue;
    const iata = (row[4] || "").trim();
    const atype = (row[12] || "").trim();
    if (iata.length !== 3 || !/^[A-Za-z]+$/.test(iata) || seen.has(iata)) continue;
    if (atype !== "airport") continue;

    const lat = Number(row[6]);
    const lon = Number(row[7]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    seen.add(iata);
    out.push({
      code: iata.toUpperCase(),
      name: (row[1] || "").trim().replace(" Airport", "").replace(" International", ""),
      city: (row[2] || "").trim(),
      country: (row[3] || "").trim(),
      lat,
      lon,
    });
  }
  return out;
}

export const AIRPORTS = loadAirports();

// Apply Italian display-name overrides in place, same as the Python version.
for (const a of AIRPORTS) {
  if (NAME_OVERRIDE[a.code]) {
    const [city, name] = NAME_OVERRIDE[a.code];
    a.city = city;
    a.name = name;
  }
}

export const AIRPORTS_BY_CODE = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));

console.log(`Loaded ${AIRPORTS.length} airports from OpenFlights dataset`);
