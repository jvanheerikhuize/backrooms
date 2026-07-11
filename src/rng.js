// Small, fast, seedable PRNG (mulberry32) plus helpers for deriving a
// deterministic sub-seed per grid cell. Deterministic layout lets any client
// regenerate the same base Backrooms from a single world seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash two signed integers (cell coords) + a world seed into a 32-bit value.
// Order-sensitive and well-mixed so neighbouring cells look uncorrelated.
export function hashCell(seed, x, y) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x >>> 0), 0x27d4eb2d);
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h ^ (y >>> 0), 0x165667b1);
  h = (h ^ (h >>> 13)) >>> 0;
  return h >>> 0;
}

// A per-cell RNG: same seed + same cell always yields the same stream.
export function cellRng(seed, x, y) {
  return mulberry32(hashCell(seed, x, y));
}
