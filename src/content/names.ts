export const NAME_PREFIXES: readonly string[] = [
  "Harbor", "Summit", "Cedar", "Palm", "Iron", "Silver",
  "Golden", "Grand", "Pine", "Oak", "Maple", "River",
  "Lake", "Ocean", "Valley", "Mountain", "Desert", "Crystal",
  "Blue", "Red", "White", "Black", "Green", "Hidden", "Sunny"
];

export const NAME_ROOTS: readonly string[] = [
  "Field", "Grove", "Bay", "Ridge", "Falls", "Mesa",
  "Springs", "Hills", "Meadow", "Crest", "Point", "Canyon",
  "Cove", "Island", "Peak", "Rock", "Cliff", "Basin",
  "Plains", "Woods", "Forest", "Park", "Breeze", "Haven",
  "Heights", "Landing", "Crossing", "Estates", "Oasis", "Bluff",
  "Gorge", "Flats", "Shores"
];

export const NAME_SUFFIXES: readonly string[] = [
  "International", "Regional", "Municipal", "Field", "Airpark", "Gateway",
  "Airport", "Executive", "County", "City", "Metro", "Aviation"
];

export const RESERVED_IATA: readonly string[] = [
  "HFD", "HTF", "XXX", "ZZZ",
  "PH", "NX", "MH", "VK", "SB", "HW", "BZ", "PJ"
];

export interface GeneratedAirportName {
  name: string;
  iata: string;
  seed: number;
}

export function mulberry32(a: number): () => number {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deriveBaseIata(name: string): string {
  const words = name.split(/\s+/).filter(w => !NAME_SUFFIXES.includes(w));
  const targetWords = words.length > 0 ? words : name.split(/\s+/);
  
  let letters = "";
  // First letters
  for (const w of targetWords) {
    const m = w.match(/[A-Za-z]/);
    if (m) letters += m[0].toUpperCase();
    if (letters.length >= 3) break;
  }
  
  // Consonant fill
  if (letters.length < 3) {
    for (const w of targetWords) {
      const chars = w.substring(1).toUpperCase().replace(/[^A-Z]/g, '');
      for (const char of chars) {
        if (!"AEIOU".includes(char)) {
          letters += char;
          if (letters.length >= 3) break;
        }
      }
      if (letters.length >= 3) break;
    }
  }

  // Vowel fill if still needed
  if (letters.length < 3) {
    for (const w of targetWords) {
      const chars = w.substring(1).toUpperCase().replace(/[^A-Z]/g, '');
      for (const char of chars) {
        if ("AEIOU".includes(char)) {
          letters += char;
          if (letters.length >= 3) break;
        }
      }
      if (letters.length >= 3) break;
    }
  }

  // Pad with X
  while (letters.length < 3) {
    letters += "X";
  }

  return letters.substring(0, 3);
}

export function generateAirportName(seed: number, opts?: { takenNames?: string[]; takenIata?: string[] }): GeneratedAirportName {
  const rng = mulberry32(seed);
  let name = "";
  const takenNames = opts?.takenNames || [];
  const takenIata = opts?.takenIata || [];
  const allReservedIata = new Set([...RESERVED_IATA, ...takenIata]);

  let attempt = 0;
  do {
    const p = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)];
    const r = NAME_ROOTS[Math.floor(rng() * NAME_ROOTS.length)];
    const hasSuffix = rng() > 0.5;
    const s = hasSuffix ? " " + NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)] : "";
    
    name = `${p} ${r}${s}`.trim();
    attempt++;
  } while (takenNames.includes(name) && attempt < 1000);

  let iata = deriveBaseIata(name);

  if (allReservedIata.has(iata)) {
    let found = false;
    // Walk deterministic alphabet suffix (cap 26*26)
    for (let i = 0; i < 26 * 26; i++) {
      const c2 = String.fromCharCode(65 + Math.floor(i / 26));
      const c3 = String.fromCharCode(65 + (i % 26));
      const candidate = iata[0] + c2 + c3;
      if (!allReservedIata.has(candidate)) {
        iata = candidate;
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback: seeded random letters
      for (let i = 0; i < 1000; i++) {
        const c1 = String.fromCharCode(65 + Math.floor(rng() * 26));
        const c2 = String.fromCharCode(65 + Math.floor(rng() * 26));
        const c3 = String.fromCharCode(65 + Math.floor(rng() * 26));
        const candidate = c1 + c2 + c3;
        if (!allReservedIata.has(candidate)) {
          iata = candidate;
          break;
        }
      }
    }
  }

  return { name, iata, seed };
}

export function validateGenerated(g: GeneratedAirportName, takenNames: string[], takenIata: string[]): string[] {
  const errors: string[] = [];
  
  if (!g.name || g.name.trim().length < 3 || g.name.trim().length > 32) {
    errors.push("Invalid name length");
  }
  
  if (!/^[A-Z]{3}$/.test(g.iata)) {
    errors.push("Invalid IATA format");
  }
  
  if (takenNames.includes(g.name)) {
    errors.push("Duplicate name");
  }
  
  if (takenIata.includes(g.iata) || RESERVED_IATA.includes(g.iata)) {
    errors.push("Duplicate or reserved IATA");
  }
  
  return errors;
}
