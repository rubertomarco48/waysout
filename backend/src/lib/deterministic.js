import crypto from "crypto";

// Same technique as the Python backend: md5 the seed, take it modulo `span`.
// Used to derive stable "random-looking" but reproducible values (fallback
// prices, images, dates) from a string key so results don't jitter between
// searches.
export function deterministicOffset(seed, span) {
  const hash = crypto.createHash("md5").update(seed).digest("hex");
  // BigInt handles the full 128-bit hash safely (JS numbers can't).
  const asBigInt = BigInt("0x" + hash);
  return Number(asBigInt % BigInt(span));
}
