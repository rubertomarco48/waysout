// In sviluppo locale, frontend e backend girano su porte diverse (3000 e
// 3001): serve l'URL assoluto del backend. In produzione su Vercel,
// frontend e backend sono serviti sotto lo stesso dominio grazie alle
// "rewrites" in vercel.json, quindi basta un percorso relativo ("/api")
// che Vercel instrada internamente al servizio backend.
const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const BASE = RAW_BACKEND_URL ?? (import.meta.env.DEV ? "http://localhost:3001" : "");
const API = `${BASE}/api`;

// --- DEBUG TEMPORANEO: rimuovere dopo la diagnosi ---
console.log(
  "%c[waysout-debug] Configurazione client API:",
  "font-weight:bold",
  JSON.stringify({
    VITE_BACKEND_URL_al_build: RAW_BACKEND_URL === undefined ? "(non impostata)" : RAW_BACKEND_URL,
    dev_mode: import.meta.env.DEV,
    base_usato: BASE,
    dominio_pagina: window.location.origin,
  })
);
// ----------------------------------------------------

async function req(path, opts = {}) {
  const url = `${API}${path}`;
  console.log(`%c[waysout-debug] → ${opts.method || "GET"} ${url}`, "color:#7dd3fc");

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    // Fallimento PRIMA di una risposta HTTP: DNS errato, mixed-content
    // (http chiamato da https), CORS bloccato sul preflight, server giù.
    console.error(`[waysout-debug] ✗ ${path}: nessuna risposta HTTP`, e);
    throw new Error(`Impossibile contattare il server: ${e.message}`);
  }

  const ctype = res.headers.get("content-type") || "(nessuno)";
  console.log(
    `%c[waysout-debug] ← ${res.status} ${res.statusText} · ${opts.method || "GET"} ${path} · content-type: ${ctype}`,
    res.ok ? "color:#86efac" : "color:#fca5a5"
  );

  const raw = await res.text();

  // Caso classico su Vercel: la rewrite /api non raggiunge il backend e
  // la richiesta finisce sul frontend, che risponde con l'index.html
  // (status 200 ma content-type text/html).
  if (!ctype.includes("application/json")) {
    console.error(
      `%c[waysout-debug] ✗ ${path}: risposta NON-JSON (content-type: ${ctype}, status ${res.status}). Primi 300 caratteri:`,
      "color:#fca5a5",
      raw.slice(0, 300)
    );
    throw new Error(`Risposta inattesa dal server (HTTP ${res.status}, ${ctype})`);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    console.error(`[waysout-debug] ✗ ${path}: JSON malformato. Primi 300 caratteri:`, raw.slice(0, 300));
    throw new Error("Risposta non valida dal server");
  }

  if (!res.ok) {
    console.error(`[waysout-debug] ✗ ${path}: errore API ${res.status}:`, body);
    throw new Error(body.error || `Errore ${res.status}`);
  }

  return body;
}

export const getAirports = () => req("/airports");

export const searchAirports = (q) => req(`/airports/search?q=${encodeURIComponent(q)}`);

export const getNearestAirports = (lat, lon) => req(`/nearest-airports?lat=${lat}&lon=${lon}`);

export function searchTrips(payload) {
  // --- DEBUG TEMPORANEO ---
  console.log("[waysout-debug] payload /api/search:", JSON.stringify(payload));
  return req("/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
