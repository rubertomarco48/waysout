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
// (errors are logged but never break the request).
export function logSearch(entry) {
  if (!db) return;
  db.collection("searches")
    .insertOne(entry)
    .catch((e) => console.warn(`Could not log search: ${e.message}`));
}
