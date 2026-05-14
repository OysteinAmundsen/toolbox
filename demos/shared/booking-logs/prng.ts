/**
 * Tiny seeded pseudo-random number generator (mulberry32).
 *
 * Pure function: `mulberry32(seed)(n)` returns the same value for the same
 * inputs across every JavaScript engine. We do not use `Math.random()` —
 * the entire log dataset is regenerated from `(SEED, rowIndex)` so the
 * Vanilla / React / Vue / Angular demos see byte-identical rows.
 */

/**
 * Returns a stateless PRNG: call `prng(n)` to get a deterministic float in [0, 1)
 * for the given integer `n`. Calling with the same `n` always returns the same float.
 */
export function mulberry32(seed: number): (n: number) => number {
  return (n: number): number => {
    let t = (seed + n * 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convenience: derive an integer in [0, max) from a uniform float.
 */
export function randInt(rand01: number, max: number): number {
  return Math.floor(rand01 * max) % max;
}

/**
 * Pick an item from a fixed array using a uniform float.
 */
export function pick<T>(rand01: number, items: readonly T[]): T {
  return items[randInt(rand01, items.length)];
}

/**
 * Weighted pick. `weights` must sum to a positive number; the returned index
 * is the bucket whose cumulative weight first exceeds `rand01 * total`.
 */
export function pickWeighted(rand01: number, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  const target = rand01 * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (target < acc) return i;
  }
  return weights.length - 1;
}
