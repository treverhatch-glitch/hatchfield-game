import { describe, expect, it } from 'vitest'
import { LogisticsSim, defaultConfig } from './index.ts'

describe('fixed ground power', () => {
  it('runs the GPU clock without calling a truck', () => {
    const plain = defaultConfig()
    const open = new LogisticsSim(plain)
    const plainId = open.startTurnaround('stand-2', 'b738', 60)
    open.tick(1)
    expect(open.getTurnaround(plainId)?.services.gpu).not.toBe('done')
    expect(open.vehicles.some((vehicle) => vehicle.type === 'gpu' && vehicle.requestId)).toBe(true)

    const powered = defaultConfig()
    powered.stands = powered.stands.map((stand) => (stand.id === 'stand-2' ? { ...stand, fixedPower: true } : stand))
    const sim = new LogisticsSim(powered)
    const id = sim.startTurnaround('stand-2', 'b738', 60)
    sim.tick(1)
    expect(sim.getTurnaround(id)?.services.gpu).toBe('active')
    expect(sim.vehicles.some((vehicle) => vehicle.type === 'gpu' && vehicle.requestId)).toBe(false)
  })
})
