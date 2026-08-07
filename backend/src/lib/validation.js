import { z } from "zod";

// Mirrors SearchRequest from the Python backend (Pydantic).
export const SearchRequestSchema = z.object({
  budget: z.number().gt(0),
  max_days: z.number().int().min(1).max(60),
  origin: z.string(),
  include_lodging: z.boolean().default(true),
  nearby_radius_km: z.number().int().min(0).max(800).default(250),
  date_mode: z.enum(["standard", "weekend", "range"]).default("standard"),
  date_from: z.string().optional().nullable(),
  date_to: z.string().optional().nullable(),
});
