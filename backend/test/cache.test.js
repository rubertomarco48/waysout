import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cacheKey, cacheGet, cacheSet } from "../src/lib/cache.js";

describe("cache", () => {
  test("cacheKey follows the flight:origin:dest:dep:ret:pax:currency shape", () => {
    const key = cacheKey({
      origin: "BRI",
      destination: "BUD",
      departureDate: "2026-09-18",
      returnDate: "2026-09-21",
      passengers: 1,
      currency: "EUR",
    });
    assert.equal(key, "flight:BRI:BUD:2026-09-18:2026-09-21:1:EUR");
  });

  test("miss returns null", () => {
    assert.equal(cacheGet("flight:XXX:YYY:2026-01-01:2026-01-02:1:EUR"), null);
  });

  test("hit returns the stored value before TTL expiry", () => {
    const key = "flight:AAA:BBB:2026-01-01:2026-01-02:1:EUR";
    cacheSet(key, { price: 42 }, 60_000);
    assert.deepEqual(cacheGet(key), { price: 42 });
  });

  test("expired entries are treated as a miss", async () => {
    const key = "flight:CCC:DDD:2026-01-01:2026-01-02:1:EUR";
    cacheSet(key, { price: 99 }, 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(cacheGet(key), null);
  });
});
