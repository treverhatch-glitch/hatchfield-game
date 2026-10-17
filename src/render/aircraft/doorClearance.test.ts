import { expect, it } from 'vitest'
import { MODEL_SPECS, DERIVED_SPECS } from './specs'
import { doorBoxes, renderDoorBoxes } from './stands'
import { airframeStations, engineLayout } from './layout'
it('no door or hatch leaf (closed or swung open) cuts into a wing root or nacelle on any airframe', () => {
  const out: string[] = []
  for (const spec of [...Object.values(MODEL_SPECS), ...Object.values(DERIVED_SPECS)]) {
    const st = airframeStations(spec)
    const eng = engineLayout(spec)
    for (const b of renderDoorBoxes(spec)) {
      if (b.door.side === 0) continue
      const sw = b.door.kind === 'cargo' ? 1 : b.swing ?? 1; const x0 = sw > 0 || b.door.kind === 'cargo' ? b.x - b.w / 2 : b.x - b.w * 1.5 - 0.15, x1 = b.x + b.w / 2 + (b.door.kind === 'cargo' || sw < 0 ? 0 : b.w + 0.15)
      const y0 = b.y - b.h / 2, y1 = b.y + b.h / 2 + (b.door.kind === 'cargo' && b.swing !== -1 ? b.h * 0.35 : 0)
      const hits: string[] = []
      for (const p of eng) {
        if (Math.sign(p.z) !== b.door.side) continue
        const r = spec.engines.radius * 1.15
        const ex0 = p.x - spec.engines.length * 0.6, ex1 = p.x + spec.engines.length * 0.6
        const inner = Math.abs(p.z) - r
        if (inner < spec.rx + 0.35 && ex1 > x0 && ex0 < x1 && p.y + r > y0 && p.y - r < y1) hits.push(`engine x${ex0.toFixed(1)}..${ex1.toFixed(1)}`)
      }
      const wx0 = st.wingX - spec.rootChord / 2 - 0.25, wx1 = st.wingX + spec.rootChord / 2 + 0.25
      const wy0 = st.wingY - spec.thickness / 2 - 0.25, wy1 = st.wingY + spec.thickness / 2 + 0.25
      if (spec.family !== 'helo' && wx1 > x0 && wx0 < x1 && wy1 > y0 && wy0 < y1) hits.push(`wing x${wx0.toFixed(1)}..${wx1.toFixed(1)} y${wy0.toFixed(1)}..${wy1.toFixed(1)}`)
      if (hits.length) out.push(`${spec.id} ${b.door.kind} t=${b.door.t} side=${b.door.side} x${x0.toFixed(1)}..${x1.toFixed(1)} y${y0.toFixed(1)}..${y1.toFixed(1)}: ${hits.join('; ')}`)
    }
  }
  expect(out).toEqual([])
})

it('leaves the sim-facing door stations untouched (service sockets read doorBoxes)', () => {
  for (const spec of [...Object.values(MODEL_SPECS), ...Object.values(DERIVED_SPECS)]) {
    const raw = doorBoxes(spec)
    const drawn = renderDoorBoxes(spec)
    raw.forEach((b, i) => {
      const nose = spec.lengthM / 2
      if (b.door.side !== 0) expect(b.x).toBeCloseTo(nose - b.door.t * spec.lengthM)
      expect(drawn[i].door).toBe(b.door)
    })
  }
})
