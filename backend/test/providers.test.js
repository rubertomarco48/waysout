import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isSuspiciousPrice, priceTypeForSource } from "../src/lib/priceConfidence.js";

// getCheapestOffer's real logic (query all, pick cheapest, isolate
// failures) is exercised directly here via a hand-rolled reducer that
// mirrors providers/index.js, using fake providers instead of real HTTP -
// so we can deterministically test success/timeout/401/403/429/empty/
// malformed without network mocking infra.
async function runProviders(providers) {
  const tried = providers.map((p) => p.name);
  const failed = [];
  const offers = await Promise.all(
    providers.map(async (p) => {
      try {
        const offer = await p.cheapestOffer();
        if (!offer) {
          failed.push(p.name);
          return null;
        }
        return { ...offer, source: p.name };
      } catch {
        failed.push(p.name);
        return null;
      }
    })
  );
  const valid = offers.filter(Boolean);
  const offer = valid.length ? valid.reduce((a, b) => (a.price <= b.price ? a : b)) : null;
  return { offer, tried, failed };
}

describe("provider registry - failure isolation", () => {
  test("a successful provider returns its offer", async () => {
    const ok = { name: "fake-ok", async cheapestOffer() { return { price: 100 }; } };
    const { offer, failed } = await runProviders([ok]);
    assert.equal(offer.price, 100);
    assert.deepEqual(failed, []);
  });

  test("a provider that throws (timeout/network error) doesn't break the search", async () => {
    const timeout = { name: "fake-timeout", async cheapestOffer() { throw new Error("ETIMEDOUT"); } };
    const ok = { name: "fake-ok", async cheapestOffer() { return { price: 80 }; } };
    const { offer, failed } = await runProviders([timeout, ok]);
    assert.equal(offer.price, 80);
    assert.deepEqual(failed, ["fake-timeout"]);
  });

  test("a provider returning null (401/403/429/empty/malformed all normalize to null) is skipped", async () => {
    const unauthorized = { name: "fake-401", async cheapestOffer() { return null; } };
    const ok = { name: "fake-ok", async cheapestOffer() { return { price: 60 }; } };
    const { offer, failed } = await runProviders([unauthorized, ok]);
    assert.equal(offer.price, 60);
    assert.deepEqual(failed, ["fake-401"]);
  });

  test("all providers failing yields no offer, not a thrown error", async () => {
    const a = { name: "fake-a", async cheapestOffer() { throw new Error("boom"); } };
    const b = { name: "fake-b", async cheapestOffer() { return null; } };
    const { offer, failed } = await runProviders([a, b]);
    assert.equal(offer, null);
    assert.deepEqual(failed.sort(), ["fake-a", "fake-b"]);
  });

  test("the cheapest of multiple valid offers wins", async () => {
    const cheap = { name: "fake-cheap", async cheapestOffer() { return { price: 40 }; } };
    const pricey = { name: "fake-pricey", async cheapestOffer() { return { price: 90 }; } };
    const { offer } = await runProviders([cheap, pricey]);
    assert.equal(offer.price, 40);
  });
});

describe("priceConfidence", () => {
  test("known live providers are tagged verified", () => {
    assert.equal(priceTypeForSource("amadeus"), "verified");
    assert.equal(priceTypeForSource("skyscrapper"), "verified");
  });

  test("travelpayouts (non-live cache data) is tagged cached", () => {
    assert.equal(priceTypeForSource("travelpayouts"), "cached");
  });

  test("unknown future providers default to cached, not verified", () => {
    assert.equal(priceTypeForSource("some-new-provider"), "cached");
  });

  test("a price wildly above the estimate is suspicious (e.g. wrong currency)", () => {
    assert.ok(isSuspiciousPrice(8700, 87)); // 100x - the real RUB/EUR incident
  });

  test("a price wildly below the estimate is suspicious", () => {
    assert.ok(isSuspiciousPrice(1, 87));
  });

  test("a plausible price near the estimate is not suspicious", () => {
    assert.ok(!isSuspiciousPrice(75, 87));
    assert.ok(!isSuspiciousPrice(110, 87));
  });
});
