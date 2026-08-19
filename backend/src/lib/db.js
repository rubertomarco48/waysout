import { MongoClient } from "mongodb";

let db = null;

export async function connectDb() {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  db = client.db(process.env.DB_NAME);
  console.log("Connected to MongoDB");
  return db;
}

// Fire-and-forget search logging, same behavior as the Python backend
// (errors are logged but never break the request). `entry` carries the
// full analytics funnel data produced by tripSearch.js: results_count,
// verified_count, cached_count, estimated_count, cache_hits,
// providers_tried, providers_failed. Client-side events (result_shown,
// destination_opened, affiliate_click) are logged separately once the
// frontend wires up an analytics endpoint - not yet implemented, see
// "Problemi ancora aperti" in the refactor notes.
export function logSearch(entry) {
  if (!db) return;
  db.collection("searches")
    .insertOne(entry)
    .catch((e) => console.warn(`Could not log search: ${e.message}`));
}
