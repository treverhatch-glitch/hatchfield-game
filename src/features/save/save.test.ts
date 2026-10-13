import { describe, expect, it } from 'vitest'
import { SaveError, SaveSlots, decodeLayout, deserialize, encodeLayout, memoryStore, packVarints, unpackVarints, serialize, type SaveAdapter } from './save.ts'

interface V2 { cash: number; airport: { name: string; code: string } }
const mkAdapter = (state: V2): SaveAdapter<V2> & { state: V2 } => ({
  version: 2, state,
  snapshot: () => structuredClone(state),
  restore(d) { this.state = d },
})
const migrations = { 1: (d: unknown) => { const o = d as { money: number; name: string }; return { cash: o.money, airport: { name: o.name, code: 'HTF' } } } }

describe('save', () => {
  it('round-trips through slots', () => {
    const a = mkAdapter({ cash: 500, airport: { name: 'Hatchfield', code: 'HTF' } })
    const store = memoryStore()
    const slots = new SaveSlots(store, a, migrations)
    slots.save('auto', 123)
    a.state = { cash: 0, airport: { name: '', code: '' } }
    expect(slots.load('auto')?.savedAt).toBe(123)
    expect(a.state.cash).toBe(500)
    expect(slots.load('missing')).toBeNull()
    slots.remove('auto')
    expect(Object.keys(store.dump())).toHaveLength(0)
  })
  it('migrates old versions', () => {
    const v1 = { format: 'hatchfield-save', version: 1, savedAt: 0, data: { money: 42, name: 'Old' } }
    const text = serialize({ version: 1, snapshot: () => v1.data, restore: () => {} }, 0)
    const env = deserialize<V2>(text, 2, migrations)
    expect(env.data).toEqual({ cash: 42, airport: { name: 'Old', code: 'HTF' } })
    expect(() => deserialize(text, 3, migrations)).toThrow(/no migration from v2/)
  })
  it('rejects corrupt, foreign and future saves', () => {
    const a = mkAdapter({ cash: 1, airport: { name: 'A', code: 'AAA' } })
    const text = serialize(a, 0)
    expect(() => deserialize(text.replace('"cash":1', '"cash":999'), 2)).toThrow(SaveError)
    expect(() => deserialize('{nope', 2)).toThrow(/valid JSON/)
    expect(() => deserialize('{"format":"x"}', 2)).toThrow(/not a Hatchfield/)
    expect(() => deserialize(text, 1)).toThrow(/newer version/)
  })
  it('encodes a compact, URL-safe, order-independent layout code with logo', () => {
    const layout = {
      name: 'Prefab Pier ✈', code: 'HTF',
      pieces: [{ t: 'gate', x: 10, y: 2, r: 1 }, { t: 'floor', x: 0, y: 0 }, { t: 'checkin', x: 3, y: 0 }],
      logo: { shape: 'roundel', colors: ['#123456', '#fff'], glyph: 'plane' },
    }
    const code = encodeLayout(layout)
    expect(code).toMatch(/^HF1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[0-9a-f]{6}$/)
    expect(encodeLayout({ ...layout, pieces: [...layout.pieces].reverse() })).toBe(code)
    const back = decodeLayout(code)
    expect(back.name).toBe('Prefab Pier ✈')
    expect(back.logo).toEqual(layout.logo)
    expect(back.pieces).toContainEqual({ t: 'gate', x: 10, y: 2, r: 1 })
    expect(back.pieces).toHaveLength(3)
  })
  it('rejects tampered layout codes', () => {
    const code = encodeLayout({ name: 'x', pieces: [{ t: 'gate', x: 1, y: 1 }] })
    const [p, m, b, c] = code.split('.')
    expect(() => decodeLayout(`${p}.${m}.${b}A.${c}`)).toThrow(SaveError)
    expect(() => decodeLayout('HF2.aaa.bbb.ccc')).toThrow(/not a Hatchfield/)
    expect(() => decodeLayout(`${p}.${m}.${b}`)).toThrow(SaveError)
  })
  it('varints round-trip negatives and large values', () => {
    const xs = [0, 1, -1, 63, -64, 127, 300, -300, 100000]
    expect(unpackVarints(packVarints(xs))).toEqual(xs)
  })
  it('a large layout stays compact', () => {
    const pieces = Array.from({ length: 400 }, (_, i) => ({ t: i % 3 ? 'floor' : 'seat', x: i % 20, y: Math.floor(i / 20) }))
    expect(encodeLayout({ name: 'big', pieces }).length).toBeLessThan(JSON.stringify(pieces).length / 3)
  })
})
