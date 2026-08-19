import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { passesPreliminaryBudget, computeValueScore } from "../src/lib/ranking.js";
import { ESTIMATION_TOLERANCE, PRICE_TYPE } from "../src/config/constants.js";

describe("passesPreliminaryBudget - estimation tolerance", () => {
  test("a destination priced exactly at budget passes", () => {
    assert.ok(passesPreliminaryBudget(200, 200));
  });

  test("a destination priced well under budget passes", () => {
    assert.ok(passesPreliminaryBudget(50, 200));
  });

  test("a destination slightly over budget (within tolerance) still passes discovery", () => {
    // Regression test for the core bug in the refactor brief: Roma->Budapest
    // estimated at €210 for a €200 budget must NOT be excluded before a
    // real provider gets a chance to reveal it's actually €75.
    const estimate = 200 * (1 + ESTIMATION_TOLERANCE) - 1;
    assert.ok(passesPreliminaryBudget(estimate, 200));
  });

  test("a destination far above budget (beyond tolerance) is excluded from discovery", () => {
    const estimate = 200 * (1 + ESTIMATION_TOLERANCE) + 50;
    assert.ok(!passesPreliminaryBudget(estimate, 200));
  });

  test("very low budgets still work without dividing by zero weirdness", () => {
    assert.ok(!passesPreliminaryBudget(100, 1));
  });
});

describe("computeValueScore", () => {
  const base = { total_cost: 150, price_type: PRICE_TYPE.ESTIMATED, flight_details: null };

  test("a verified price scores higher than an estimated one at the same total cost", () => {
    const estimated = computeValueScore({ ...base, price_type: PRICE_TYPE.ESTIMATED }, 300);
    const verified = computeValueScore({ ...base, price_type: PRICE_TYPE.VERIFIED }, 300);
    assert.ok(verified > estimated);
  });

  test("a cheaper result scores higher than a pricier one of the same confidence", () => {
    const cheap = computeValueScore({ ...base, total_cost: 50 }, 300);
    const expensive = computeValueScore({ ...base, total_cost: 290 }, 300);
    assert.ok(cheap > expensive);
  });

  test("more stops reduces the score", () => {
    const direct = computeValueScore(
      { ...base, price_type: PRICE_TYPE.VERIFIED, flight_details: { outbound: { stops: 0 } } },
      300
    );
    const oneStop = computeValueScore(
      { ...base, price_type: PRICE_TYPE.VERIFIED, flight_details: { outbound: { stops: 1 } } },
      300
    );
    assert.ok(direct > oneStop);
  });

  test("score is always between 0 and 100", () => {
    for (const cost of [0, 1, 150, 299, 300, 1000]) {
      const score = computeValueScore({ ...base, total_cost: cost }, 300);
      assert.ok(score >= 0 && score <= 100);
    }
  });
});
