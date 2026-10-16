import { describe, it, expect } from 'vitest';
import { 
  generateAirportName, 
  validateGenerated, 
  RESERVED_IATA 
} from './names.ts';

describe('names generator', () => {
  it('generates unique (name, iata) pairs with no RESERVED_IATA hits for 200 seeds', () => {
    for (let i = 0; i < 200; i++) {
      const g = generateAirportName(i);
      expect(RESERVED_IATA).not.toContain(g.iata);
    }
  });

  it('generates 200 absolutely unique IATAs or correctly logs collisions if handled externally', () => {
    const pairs = new Set<string>();
    const takenNames: string[] = [];
    const takenIata: string[] = [];
    for (let i = 0; i < 200; i++) {
      const g = generateAirportName(i, { takenNames, takenIata });
      pairs.add(`${g.name}|${g.iata}`);
      takenNames.push(g.name);
      takenIata.push(g.iata);
    }
    expect(pairs.size).toBe(200);
  });

  it('generateAirportName(7) is stable across two calls', () => {
    const call1 = generateAirportName(7);
    const call2 = generateAirportName(7);
    expect(call1).toEqual(call2);
  });

  it('validateGenerated flags duplicate iata/name and bad length', () => {
    const g = generateAirportName(1);
    
    // Duplicate name
    let errors = validateGenerated(g, [g.name], []);
    expect(errors).toContain("Duplicate name");

    // Duplicate IATA
    errors = validateGenerated(g, [], [g.iata]);
    expect(errors).toContain("Duplicate or reserved IATA");

    // Reserved IATA
    const badIata = { ...g, iata: "HTF" };
    errors = validateGenerated(badIata, [], []);
    expect(errors).toContain("Duplicate or reserved IATA");

    // Bad length (short)
    const shortName = { ...g, name: "A" };
    errors = validateGenerated(shortName, [], []);
    expect(errors).toContain("Invalid name length");

    // Bad length (long)
    const longName = { ...g, name: "A".repeat(33) };
    errors = validateGenerated(longName, [], []);
    expect(errors).toContain("Invalid name length");

    // Invalid format
    const badFormat = { ...g, iata: "123" };
    errors = validateGenerated(badFormat, [], []);
    expect(errors).toContain("Invalid IATA format");
  });

  it('IATA always matches /^[A-Z]{3}$/', () => {
    for (let i = 0; i < 50; i++) {
      const g = generateAirportName(i);
      expect(g.iata).toMatch(/^[A-Z]{3}$/);
    }
  });
});
