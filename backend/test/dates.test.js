import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateCandidateDates } from "../src/lib/candidateGeneration.js";
import { MAX_SEARCH_DAYS, MIN_DEPARTURE_DAYS_AHEAD } from "../src/config/constants.js";

function today() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

describe("generateCandidateDates - standard/flexible mode", () => {
  const req = { date_mode: "standard" };

  test("never proposes a departure before MIN_DEPARTURE_DAYS_AHEAD", () => {
    const t = today();
    const candidates = generateCandidateDates(req, "BUD", 4, t);
    for (const c of candidates) {
      assert.ok(daysBetween(t, c.departureDate) >= MIN_DEPARTURE_DAYS_AHEAD);
    }
  });

  test("never proposes a departure beyond MAX_SEARCH_DAYS (90)", () => {
    const t = today();
    const candidates = generateCandidateDates(req, "BUD", 4, t);
    for (const c of candidates) {
      assert.ok(daysBetween(t, c.departureDate) <= MAX_SEARCH_DAYS);
    }
  });

  test("respects requested trip duration", () => {
    const t = today();
    const candidates = generateCandidateDates(req, "BUD", 4, t);
    for (const c of candidates) {
      assert.equal(daysBetween(c.departureDate, c.returnDate), 4);
      assert.equal(c.tripDays, 4);
    }
  });

  test("is deterministic for the same destination/day", () => {
    const t = today();
    const a = generateCandidateDates(req, "BUD", 4, t);
    const b = generateCandidateDates(req, "BUD", 4, t);
    assert.deepEqual(
      a.map((c) => c.departureDate.toISOString()),
      b.map((c) => c.departureDate.toISOString())
    );
  });

  test("produces multiple distinct candidate dates spread across the window", () => {
    const t = today();
    const candidates = generateCandidateDates(req, "BUD", 4, t);
    assert.ok(candidates.length > 1, "expected more than one candidate date within a 90-day window");
    const offsets = candidates.map((c) => daysBetween(t, c.departureDate));
    assert.equal(new Set(offsets).size, offsets.length, "candidate offsets should be distinct");
  });

  test("different destinations get different (but each internally valid) dates", () => {
    const t = today();
    const a = generateCandidateDates(req, "BUD", 4, t);
    const b = generateCandidateDates(req, "FCO", 4, t);
    assert.notDeepEqual(
      a.map((c) => c.departureDate.toISOString()),
      b.map((c) => c.departureDate.toISOString())
    );
  });
});

describe("generateCandidateDates - weekend mode", () => {
  const req = { date_mode: "weekend" };

  test("departure always falls on a Friday", () => {
    const t = today();
    const candidates = generateCandidateDates(req, "BUD", 4, t);
    for (const c of candidates) {
      assert.equal(c.departureDate.getUTCDay(), 5); // Friday
    }
  });

  test("trip length is 2 or 3 nights", () => {
    const t = today();
    const candidates = generateCandidateDates(req, "BUD", 4, t);
    for (const c of candidates) {
      assert.ok(c.tripDays === 2 || c.tripDays === 3);
    }
  });

  test("stays within the 90-day window", () => {
    const t = today();
    const candidates = generateCandidateDates(req, "BUD", 4, t);
    for (const c of candidates) {
      assert.ok(daysBetween(t, c.departureDate) <= MAX_SEARCH_DAYS);
    }
  });
});

describe("generateCandidateDates - range mode", () => {
  test("departure and return stay within the user-provided range", () => {
    const t = today();
    const from = new Date(t);
    from.setUTCDate(from.getUTCDate() + 10);
    const to = new Date(t);
    to.setUTCDate(to.getUTCDate() + 20);
    const req = {
      date_mode: "range",
      date_from: from.toISOString().slice(0, 10),
      date_to: to.toISOString().slice(0, 10),
    };
    const [c] = generateCandidateDates(req, "BUD", 4, t);
    assert.ok(c.departureDate >= from);
    assert.ok(c.returnDate <= to);
  });

  test("a range entirely in the past is pulled forward to at least tomorrow", () => {
    const t = today();
    const req = { date_mode: "range", date_from: "2020-01-01", date_to: "2020-01-10" };
    const [c] = generateCandidateDates(req, "BUD", 4, t);
    assert.ok(daysBetween(t, c.departureDate) >= 1);
  });
});

describe("month/year rollover", () => {
  test("standard mode near a month boundary still produces valid future dates", () => {
    const t = new Date(Date.UTC(2026, 0, 30)); // Jan 30, 2026
    const candidates = generateCandidateDates({ date_mode: "standard" }, "BUD", 4, t);
    for (const c of candidates) {
      assert.ok(c.departureDate.getTime() > t.getTime());
      assert.ok(c.returnDate.getTime() > c.departureDate.getTime());
    }
  });

  test("standard mode near a year boundary still produces valid future dates", () => {
    const t = new Date(Date.UTC(2026, 11, 28)); // Dec 28, 2026
    const candidates = generateCandidateDates({ date_mode: "standard" }, "BUD", 4, t);
    for (const c of candidates) {
      assert.ok(c.departureDate.getUTCFullYear() >= 2026);
      assert.ok(c.departureDate.getTime() > t.getTime());
    }
  });
});
