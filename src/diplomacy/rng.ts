/** Seeded RNG. State is a plain number held on the serialisable state so saves replay exactly. */
export interface RngHolder {
  rngState: number;
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nextFloat(holder: RngHolder): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(holder: RngHolder, min: number, max: number): number {
  return min + Math.floor(nextFloat(holder) * (max - min + 1));
}

export function pick<T>(holder: RngHolder, items: readonly T[]): T {
  return items[Math.floor(nextFloat(holder) * items.length)];
}

/** A one-shot value stream from a seed, used for portraits and name generation. */
export function seededStream(seed: number): () => number {
  const holder: RngHolder = { rngState: seed >>> 0 };
  return () => nextFloat(holder);
}
