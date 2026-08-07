// ---------------------------------------------------------------------------
// Static data ported 1:1 from the original Python/FastAPI backend.
// Curated metadata (nice image, daily budget, suggested days, tags) for
// popular destinations. Everything else falls back to derived values +
// pooled images (see dest_meta in tripSearch.js).
// ---------------------------------------------------------------------------

export const CURATED = {
  FCO: { daily: 70, days: 3, tags: ["Città", "Storia"], image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  CDG: { daily: 90, days: 4, tags: ["Città", "Romantica"], image: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  BCN: { daily: 75, days: 4, tags: ["Città", "Mare"], image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  AMS: { daily: 95, days: 3, tags: ["Città", "Cultura"], image: "https://images.unsplash.com/photo-1584003564911-a7a321c84e1c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  LIS: { daily: 60, days: 4, tags: ["Città", "Mare"], image: "https://images.unsplash.com/photo-1697748525265-7431cba075b6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  PRG: { daily: 50, days: 3, tags: ["Città", "Economica"], image: "https://images.unsplash.com/photo-1600623471616-8c1966c91ff6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  LHR: { daily: 110, days: 3, tags: ["Città", "Shopping"], image: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  LGW: { daily: 110, days: 3, tags: ["Città", "Shopping"], image: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  JTR: { daily: 85, days: 6, tags: ["Mare", "Relax"], image: "https://images.unsplash.com/photo-1560703650-ef3e0f254ae0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  BER: { daily: 70, days: 3, tags: ["Città", "Cultura"], image: "https://images.unsplash.com/photo-1587330979470-3595ac045ab0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  VIE: { daily: 80, days: 3, tags: ["Città", "Storia"], image: "https://images.unsplash.com/photo-1567597435927-80055c207c1c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  IBZ: { daily: 100, days: 5, tags: ["Mare", "Movida"], image: "https://images.unsplash.com/photo-1672939113905-49237296683a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  MLA: { daily: 65, days: 5, tags: ["Mare", "Storia"], image: "https://images.unsplash.com/photo-1663535907182-aab825b412fa?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  BUD: { daily: 45, days: 3, tags: ["Città", "Economica"], image: "https://images.unsplash.com/photo-1555958493-1380d49ac1ef?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  ATH: { daily: 55, days: 4, tags: ["Città", "Storia"], image: "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  KRK: { daily: 40, days: 3, tags: ["Città", "Economica"], image: "https://images.unsplash.com/photo-1642278167684-4d8a6bd75def?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
  RAK: { daily: 45, days: 5, tags: ["Esotica", "Cultura"], image: "https://images.unsplash.com/photo-1697028703785-870aef30167f0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
};

// Generic fallback images (assigned deterministically by airport code).
export const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1761472871833-16399fde43fb?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1552674510-62c267e73ada?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1604223190546-a43e4c7f29d7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1667831083048-4ddd6a8cd4db?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1645451365229-676df30167f0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1499590206382-9f85678c0e3e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
];

// Popular Italian origin airports shown by default in the dropdown.
export const POPULAR_IT = new Set([
  "MXP", "LIN", "BGY", "FCO", "CIA", "NAP", "VCE", "BLQ", "TRN", "CTA",
  "PMO", "BRI", "BDS", "PSA", "FLR", "VRN", "TSF", "GOA", "CAG", "OLB",
]);

// English -> Italian country names for the most common ones.
export const COUNTRY_IT = {
  Italy: "Italia", France: "Francia", Spain: "Spagna", Germany: "Germania",
  "United Kingdom": "Regno Unito", Greece: "Grecia", Portugal: "Portogallo",
  Netherlands: "Paesi Bassi", Austria: "Austria", Poland: "Polonia",
  Hungary: "Ungheria", "Czech Republic": "Rep. Ceca", Belgium: "Belgio",
  Switzerland: "Svizzera", Ireland: "Irlanda", Croatia: "Croazia",
  Morocco: "Marocco", Malta: "Malta", Romania: "Romania", Norway: "Norvegia",
  Sweden: "Svezia", Denmark: "Danimarca", Finland: "Finlandia", Turkey: "Turchia",
  "United States": "Stati Uniti", Egypt: "Egitto", Tunisia: "Tunisia",
  Albania: "Albania", Serbia: "Serbia", Bulgaria: "Bulgaria", Slovakia: "Slovacchia",
  Slovenia: "Slovenia", Iceland: "Islanda", Luxembourg: "Lussemburgo",
  Russia: "Russia", Ukraine: "Ucraina", Cyprus: "Cipro", "Spain ": "Spagna",
  Montenegro: "Montenegro", "Bosnia and Herzegovina": "Bosnia", "North Macedonia": "Macedonia",
  Kosovo: "Kosovo", Estonia: "Estonia", Latvia: "Lettonia", Lithuania: "Lituania",
  Israel: "Israele", Jordan: "Giordania", Georgia: "Georgia", Armenia: "Armenia",
  Moldova: "Moldavia", Belarus: "Bielorussia", Lebanon: "Libano",
};

// Italian display names (city + airport) for major airports so users can
// search in Italian (Roma, Firenze, Parigi...) and see localized labels.
export const NAME_OVERRIDE = {
  MXP: ["Milano", "Milano Malpensa"], LIN: ["Milano", "Milano Linate"],
  BGY: ["Bergamo", "Orio al Serio"], FCO: ["Roma", "Roma Fiumicino"],
  CIA: ["Roma", "Roma Ciampino"], NAP: ["Napoli", "Napoli Capodichino"],
  VCE: ["Venezia", "Venezia Marco Polo"], BLQ: ["Bologna", "Bologna Marconi"],
  TRN: ["Torino", "Torino Caselle"], CTA: ["Catania", "Catania Fontanarossa"],
  PMO: ["Palermo", "Palermo"], BRI: ["Bari", "Bari Palese"],
  BDS: ["Brindisi", "Brindisi Salento"], PSA: ["Pisa", "Pisa Galilei"],
  FLR: ["Firenze", "Firenze Peretola"], VRN: ["Verona", "Verona Villafranca"],
  TSF: ["Treviso", "Treviso Canova"], GOA: ["Genova", "Genova Colombo"],
  TRS: ["Trieste", "Trieste"], PSR: ["Pescara", "Pescara"],
  AOI: ["Ancona", "Ancona Falconara"], RMI: ["Rimini", "Rimini"],
  PEG: ["Perugia", "Perugia"], CUF: ["Cuneo", "Cuneo Levaldigi"],
  CAG: ["Cagliari", "Cagliari Elmas"], OLB: ["Olbia", "Olbia Costa Smeralda"],
  AHO: ["Alghero", "Alghero"], SUF: ["Lamezia Terme", "Lamezia Terme"],
  REG: ["Reggio Calabria", "Reggio Calabria"], TPS: ["Trapani", "Trapani Birgi"],
  CIY: ["Comiso", "Comiso"], FOG: ["Foggia", "Foggia"],
  // Popular foreign destinations (Italian city names).
  CDG: ["Parigi", "Parigi Charles de Gaulle"], ORY: ["Parigi", "Parigi Orly"],
  BCN: ["Barcellona", "Barcellona"], MAD: ["Madrid", "Madrid Barajas"],
  AMS: ["Amsterdam", "Amsterdam Schiphol"], LIS: ["Lisbona", "Lisbona"],
  PRG: ["Praga", "Praga"], LHR: ["Londra", "Londra Heathrow"],
  LGW: ["Londra", "Londra Gatwick"], STN: ["Londra", "Londra Stansted"],
  BER: ["Berlino", "Berlino"], MUC: ["Monaco di Baviera", "Monaco"],
  VIE: ["Vienna", "Vienna"], IBZ: ["Ibiza", "Ibiza"],
  MLA: ["Malta", "Malta"], BUD: ["Budapest", "Budapest"],
  ATH: ["Atene", "Atene"], KRK: ["Cracovia", "Cracovia"],
  RAK: ["Marrakech", "Marrakech"], JTR: ["Santorini", "Santorini"],
  BRU: ["Bruxelles", "Bruxelles"], ZRH: ["Zurigo", "Zurigo"],
  DUB: ["Dublino", "Dublino"], CPH: ["Copenaghen", "Copenaghen"],
  IST: ["Istanbul", "Istanbul"], NCE: ["Nizza", "Nizza"],
};

// IATA carrier code -> display name, for the most common European airlines.
// Used only to make the flight-detail card friendlier; unknown codes just
// fall back to showing the raw code (see resolveAirlineName in tripLogic.js).
export const AIRLINE_NAMES = {
  FR: "Ryanair", U2: "easyJet", W6: "Wizz Air", VY: "Vueling",
  AZ: "ITA Airways", LH: "Lufthansa", AF: "Air France", KL: "KLM",
  IB: "Iberia", BA: "British Airways", TP: "TAP Air Portugal",
  LX: "Swiss", OS: "Austrian Airlines", SK: "SAS", EI: "Aer Lingus",
  TK: "Turkish Airlines", EK: "Emirates", QR: "Qatar Airways",
  SN: "Brussels Airlines", A3: "Aegean Airlines", LO: "LOT Polish Airlines",
  DY: "Norwegian", EW: "Eurowings", VLM: "VLM Airlines", PC: "Pegasus",
  WF: "Widerøe", D8: "Norwegian Air International", AY: "Finnair",
  TO: "Transavia France", HV: "Transavia", V7: "Volotea", UX: "Air Europa",
};
