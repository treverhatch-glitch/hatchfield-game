import { describe, expect, it } from 'vitest'
import { DEFAULT_CATERING } from '../catering/defaults.ts'
import { LogisticsSim, defaultConfig, type LogisticsEvent } from '../logistics/index.ts'
import { CATER_STAND_PHASES, CREW_SHARES, type CrewRole, type CrewService, type CrewStepId } from './crewConfig.ts'
import { crewStepSpans, sampleCateringStand, sampleService } from './crewActions.ts'
import { assembleCrew, placeLocal, wingAimLocal } from './present.ts'

const ORDER: CrewStepId[] = ['park', 'exit', 'walk', 'connect', 'work', 'disconnect', 'board', 'drive_off']

function jump(service: CrewService, start = 0, end = 10): number {
  let worst = 0
  let prev: Record<CrewRole, { x: number; y: number; z: number }> | null = null
  let prevLink = 0
  let prevWork = 0
  for (let t = start; t <= end + 1e-9; t += 0.02) {
    const sample = sampleService(service, start, end, t)
    if (prev) {
      for (const member of sample.crew) {
        const was = prev[member.role]
        worst = Math.max(worst, Math.hypot(member.x - was.x, member.y - was.y, member.z - was.z))
      }
      expect(Math.abs(sample.link - prevLink)).toBeLessThan(0.08)
      expect(Math.abs(sample.work - prevWork)).toBeLessThan(0.08)
    }
    prev = {
      driver: sample.crew[0],
      helper: sample.crew[1],
    }
    prevLink = sample.link
    prevWork = sample.work
    for (const member of sample.crew) {
      expect(Number.isFinite(member.x + member.y + member.z + member.heading)).toBe(true)
    }
  }
  return worst
}

describe('crew step machine', () => {
  it.each(['fuel', 'bags', 'catering'] as const)('%s steps run in order and fill the service window', (service) => {
    const start = 4
    const end = 19
    const spans = crewStepSpans(service, start, end)
    expect(spans.map((span) => span.id)).toEqual(ORDER)
    expect(spans[0].start).toBe(start)
    expect(spans[spans.length - 1].end).toBeCloseTo(end, 8)
    const sum = spans.reduce((total, span) => total + (span.end - span.start), 0)
    expect(sum).toBeCloseTo(end - start, 8)
    const shareSum = CREW_SHARES[service].reduce((total, step) => total + step.share, 0)
    expect(shareSum).toBeCloseTo(1, 8)

    const seen: CrewStepId[] = []
    for (let t = start; t <= end; t += 0.05) {
      const step = sampleService(service, start, end, t).step
      if (seen[seen.length - 1] !== step) seen.push(step)
    }
    expect(seen).toEqual(ORDER)

    const mid = spans.find((span) => span.id === 'work')!
    const working = sampleService(service, start, end, (mid.start + mid.end) / 2)
    expect(working.work).toBeGreaterThan(0.2)
    expect(working.work).toBeLessThan(0.8)
    expect(working.link).toBe(1)
    const before = sampleService(service, start, end, spans[0].start + 0.01)
    expect(before.work).toBe(0)
    expect(before.link).toBe(0)
    const after = sampleService(service, start, end, end)
    expect(after.work).toBe(1)
    expect(after.step).toBe('drive_off')
  })

  it('keeps both crew on a continuous path', () => {
    expect(jump('fuel')).toBeLessThan(0.55)
    expect(jump('bags')).toBeLessThan(0.55)
    expect(jump('catering')).toBeLessThan(0.55)
  })

  it('returns the helper to the belt at both ends of the bag shuttle', () => {
    const spans = crewStepSpans('bags', 0, 10)
    const work = spans.find((span) => span.id === 'work')!
    const start = sampleService('bags', 0, 10, work.start).crew[1]
    const end = sampleService('bags', 0, 10, work.end - 1e-6).crew[1]
    expect(Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z)).toBeLessThan(0.05)
    const mid = sampleService('bags', 0, 10, work.start + (work.end - work.start) * 0.5).crew[1]
    expect(Math.hypot(mid.x - start.x, mid.z - start.z)).toBeGreaterThan(0.4)
  })

  it('matches a fuel truck window to the sim pump, without stretching it', () => {
    const sim = new LogisticsSim(defaultConfig())
    const ev: LogisticsEvent[] = []
    sim.on((e) => ev.push(e))
    sim.startTurnaround('stand-2', 'b738', 120)
    let window: { start: number; end: number } | null = null
    for (let i = 0; i < 800 && !ev.some((e) => e.type === 'refuel_stop'); i++) {
      sim.tick(0.5)
      const job = sim.activeCrew().find((row) => row.service === 'fuel')
      if (job && !window) window = { start: job.start, end: job.end }
    }
    expect(window).toBeTruthy()
    const started = ev.find((e) => e.type === 'refuel_start' && e.method === 'truck')
    const stopped = ev.find((e) => e.type === 'refuel_stop' && e.method === 'truck')
    expect(started && stopped).toBeTruthy()
    if (!started || started.type !== 'refuel_start' || !stopped || stopped.type !== 'refuel_stop' || !window) return
    expect(stopped.time - started.time).toBeCloseTo(window.end - window.start, 4)
    const spans = crewStepSpans('fuel', window.start, window.end)
    expect(spans.reduce((total, span) => total + (span.end - span.start), 0)).toBeCloseTo(window.end - window.start, 6)
    const sample = sampleService('fuel', window.start, window.end, (window.start + window.end) / 2)
    expect(sample.step === 'work' || sample.step === 'connect' || sample.step === 'disconnect').toBe(true)
  })
})

describe('catering stand path', () => {
  it('walks through the module phases with no position jump', () => {
    const durations = DEFAULT_CATERING.durations
    let worst = 0
    let prev: { x: number; y: number; z: number }[] | null = null
    for (const phase of CATER_STAND_PHASES) {
      const dur = durations[phase]
      const steps = 24
      for (let i = 0; i <= steps; i++) {
        const sample = sampleCateringStand(phase, i / steps)
        if (prev) {
          for (let c = 0; c < 2; c++) {
            const a = prev[c]
            const b = sample.crew[c]
            worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
          }
        }
        prev = sample.crew.map((member) => ({ x: member.x, y: member.y, z: member.z }))
        expect(sample.lift).toBeGreaterThanOrEqual(0)
        expect(sample.lift).toBeLessThanOrEqual(1)
      }
      expect(dur).toBeGreaterThan(0)
    }
    expect(worst).toBeLessThan(0.35)
    expect(sampleCateringStand('lift_raise', 0).lift).toBe(0)
    expect(sampleCateringStand('lift_raise', 1).lift).toBe(1)
    expect(sampleCateringStand('carts_in', 0.5).lift).toBe(1)
    expect(sampleCateringStand('crew_board', 1).crew.every((member) => member.pose === 'seated')).toBe(true)
  })
})

describe('apron placement', () => {
  it('hides crew inside the cab and shows the hose while the pump runs', () => {
    const parked = assembleCrew({
      services: [{ id: 'fuel-1', service: 'fuel', x: 12, y: 6, heading: 0, start: 0, end: 10, now: 0.05 }],
      catering: [],
      metersPerUnit: 22,
    })
    expect(parked.people).toEqual([])
    expect(parked.jobs[0]?.step).toBe('park')

    const pumping = assembleCrew({
      services: [{ id: 'fuel-1', service: 'fuel', x: 12, y: 6, heading: 0, start: 0, end: 10, now: 5 }],
      catering: [],
      metersPerUnit: 22,
    })
    expect(pumping.people).toHaveLength(2)
    expect(pumping.jobs[0]?.step).toBe('work')
    expect(pumping.props.some((prop) => prop.kind === 'hose')).toBe(true)
    expect(pumping.props.find((prop) => prop.kind === 'bar')?.fill).toBeGreaterThan(0)
    const [a, b] = pumping.people
    expect(Math.hypot(a.c - b.c, a.r - b.r)).toBeGreaterThan(0.01)
  })

  it('places a walked point back on the wing it was aimed at', () => {
    const aircraft = { x: 4, y: 9, heading: 0.4, lengthM: 39.5, spanM: 35.8, wingAt: 0.42 }
    const vehicle = { x: 4, y: 9, heading: 0.4 }
    const aim = wingAimLocal(aircraft, vehicle, 22)
    const at = placeLocal(vehicle, { x: aim.x, y: 0, z: aim.z }, 22)
    const back = Math.hypot((at.c - vehicle.x) * 22, (at.r - vehicle.y) * 22)
    expect(back).toBeGreaterThan(3)
    expect(back).toBeLessThan(12)
  })
})
