import { ESTIMATION_TOLERANCE, PRICE_TYPE } from "../config/constants.js";

// Used during DISCOVERY: should this candidate survive to the verification
// phase? A candidate slightly over budget on a *pessimistic estimate* still
// deserves a real provider check (see refactor brief: Roma->Budapest
// estimated €210 but really €75 - must not be excluded before verification).
export function passesPreliminaryBudget(estimatedTotal, budget) {
  return estimatedTotal <= budget * (1 + ESTIMATION_TOLERANCE);
}

const PRICE_TYPE_WEIGHT = {
  [PRICE_TYPE.VERIFIED]: 1,
  [PRICE_TYPE.CACHED]: 0.75,
  [PRICE_TYPE.ESTIMATED]: 0.5,
  [PRICE_TYPE.UNAVAILABLE]: 0.3,
};

// Combines price efficiency (savings vs budget), price confidence, and
// route quality (stops) into a single 0-100 "valueScore" used as the
// default sort. Deliberately simple and explainable - not a black box -
// so it's easy to reason about why a destination ranks where it does.
export function computeValueScore(result, budget) {
  const savingsRatio = budget > 0 ? Math.max(0, Math.min(1, (budget - result.total_cost) / budget)) : 0;
  const confidenceWeight = PRICE_TYPE_WEIGHT[result.price_type] ?? 0.5;
  const stops = result.flight_details?.outbound?.stops;
  const stopsPenalty = typeof stops === "number" ? Math.min(stops * 4, 12) : 0;

  const score = savingsRatio * 55 + confidenceWeight * 35 + 10 - stopsPenalty;
  return Math.max(0, Math.round(score));
}

// Default final ordering: best value first, cheapest as tiebreak.
export function sortByValue(results) {
  return [...results].sort((a, b) => b.value_score - a.value_score || a.total_cost - b.total_cost);
}
