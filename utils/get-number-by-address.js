function getNumberByAddress(
  address,
  max,
  exclude = []
) {
  if (!/^[0-9A-Z]+$/.test(address)) throw new Error("String must contain only 0-9A-Z");
  if (!Number.isInteger(max) || max <= 1) throw new Error("Y must be > 1");
  if (!Array.isArray(exclude)) throw new Error("exclude must be an array");
  if (exclude.some(x => x < 0 || x >= max))
    throw new Error("exclude values must be in range [0, Y)");

  const excludeSet = new Set(exclude);
  const excludeCount = excludeSet.size;
  if (excludeCount >= max)
    throw new Error("exclude set cannot cover the entire range [0, Y)");

  // Convert base36 string into BigInt
  let n = 0n;
  for (const ch of address) {
    const digit = BigInt(parseInt(ch, 36));
    n = n * 36n + digit;
  }

  // Start with deterministic base value
  let N = Number(n % BigInt(max));

  // Deterministic shift if N is excluded:
  // keep shifting by +1 mod Y until allowed.
  while (excludeSet.has(N)) {
    N = (N + 1) % max;
  }

  return N;
}

module.exports = getNumberByAddress;