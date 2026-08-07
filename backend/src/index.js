import "dotenv/config";
import express from "express";
import cors from "cors";
import { router as apiRouter } from "./routes/api.js";
import { connectDb } from "./lib/db.js";
import { configuredProviders } from "./providers/index.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

const corsOrigins = process.env.CORS_ORIGINS ?? "*";
app.use(
  cors({
    origin: corsOrigins === "*" ? true : corsOrigins.split(","),
    credentials: true,
  })
);
app.use(express.json());

app.use("/api", apiRouter);

app.use((_req, res) => res.status(404).json({ error: "Endpoint non trovato." }));

async function start() {
  try {
    await connectDb();
  } catch (e) {
    console.warn(`MongoDB non disponibile, si continua senza log ricerche: ${e.message}`);
  }

  const active = configuredProviders().map((p) => p.name);
  console.log(active.length ? `Provider prezzi voli attivi: ${active.join(", ")}` : "Nessun provider prezzi voli configurato - uso solo stime locali.");

  app.listen(port, () => {
    console.log(`waysout API pronta su http://localhost:${port}`);
  });
}

start();
