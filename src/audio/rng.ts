/** FNV-1a string hash → 32-bit seed. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Mulberry32 PRNG in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Multiplicative jitter: 1 ± amt. */
export const jit = (rng: () => number, amt: number) => 1 + (rng() * 2 - 1) * amt;
