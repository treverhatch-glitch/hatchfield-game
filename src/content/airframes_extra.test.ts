import { describe, it, expect } from 'vitest';
import { AIRFRAMES_EXTRA, validateAirframesExtra, mergeAirframes } from './airframes_extra.ts';
import { EXISTING_AIRFRAME_IDS } from './_airframeShape.ts';

describe('AIRFRAMES_EXTRA', () => {
  it('contains exactly the 10 requested IDs', () => {
    const expectedIds = ['q400', 'atr42', 'crj900', 'b78x', 'a339', 'b779', 'a35k', 'b77f', 'a350f', 'b763bcf'];
    const actualIds = Object.keys(AIRFRAMES_EXTRA);
    
    expect(actualIds).toHaveLength(10);
    for (const id of expectedIds) {
      expect(actualIds).toContain(id);
    }
  });

  it('has no overlap with EXISTING_AIRFRAME_IDS', () => {
    const errors = validateAirframesExtra(AIRFRAMES_EXTRA, EXISTING_AIRFRAME_IDS);
    expect(errors).toHaveLength(0);
  });

  it('validates properly formatted extra airframes', () => {
    const errors = validateAirframesExtra(AIRFRAMES_EXTRA, EXISTING_AIRFRAME_IDS);
    expect(errors).toEqual([]);
  });

  it('catches empty names', () => {
    const badTable = {
      test: { ...AIRFRAMES_EXTRA.q400, id: 'test', name: '' }
    };
    const errors = validateAirframesExtra(badTable, EXISTING_AIRFRAME_IDS);
    expect(errors).toContain('Empty name for airframe: "test"');
  });

  it('freighters must have 0 seats and 0 bag volume', () => {
    const freighters = Object.values(AIRFRAMES_EXTRA).filter(a => a.kind === 'freighter');
    expect(freighters.length).toBeGreaterThan(0);
    
    for (const f of freighters) {
      expect(f.seats).toBe(0);
      expect(f.bagVolume).toBe(0);
      expect(f.paxMin).toBe(0);
      expect(f.paxMax).toBe(0);
      expect(f.cargoHold).toBeGreaterThan(0);
    }
  });

  it('regionals are kind regional', () => {
    const regionals = ['q400', 'atr42', 'crj900'];
    for (const id of regionals) {
      expect(AIRFRAMES_EXTRA[id].kind).toBe('regional');
    }
  });

  it('widebodies are kind widebody', () => {
    const widebodies = ['b78x', 'a339', 'b779', 'a35k'];
    for (const id of widebodies) {
      expect(AIRFRAMES_EXTRA[id].kind).toBe('widebody');
    }
  });
  
  it('mergeAirframes throws on collision', () => {
    const base = { q400: AIRFRAMES_EXTRA.q400 };
    const extra = { q400: AIRFRAMES_EXTRA.q400 };
    expect(() => mergeAirframes(base, extra)).toThrow(/Collision/);
  });
  
  it('mergeAirframes merges successfully without collisions', () => {
    const base = { test1: { ...AIRFRAMES_EXTRA.q400, id: 'test1' } };
    const extra = { test2: { ...AIRFRAMES_EXTRA.q400, id: 'test2' } };
    const merged = mergeAirframes(base, extra);
    expect(Object.keys(merged)).toHaveLength(2);
    expect(merged.test1).toBeDefined();
    expect(merged.test2).toBeDefined();
  });
});
