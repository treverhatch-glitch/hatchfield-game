import { describe, expect, it } from 'vitest'
import { AIRLINES, NEUTRAL_CONTEXT, SERVICE_IDS } from './data.ts'
import { createNegotiation } from './engine.ts'

describe('negotiation.edge: counter-offers stay within bounds', () => {
  it('clamps fee percentage setter within [-80%, +80%]', () => {
    const desk = createNegotiation(42)
    desk.open('harbor', NEUTRAL_CONTEXT)

    desk.setFee('landing', 150)
    expect(desk.session?.ask.feePct.landing).toBe(80)

    desk.setFee('landing', -100)
    expect(desk.session?.ask.feePct.landing).toBe(-80)

    desk.setFee('landing', 25)
    expect(desk.session?.ask.feePct.landing).toBe(25)
  })

  it('ensures airline counter-offers move fee percentages toward target within bounded ratios', () => {
    const desk = createNegotiation(100)
    desk.open('summit', NEUTRAL_CONTEXT)
    const personality = desk.personality('summit')

    // Set an ask fee above target cost
    const askRatio = (personality.targetCost + personality.reservation) / 2
    desk.setRatio(askRatio)
    const initialAskPct = (askRatio - 1) * 100

    const result = desk.counter()
    expect(result.reply).toBe('counter')

    const targetPct = (personality.targetCost - 1) * 100
    for (const serviceId of SERVICE_IDS) {
      const counterFee = desk.session?.theirs.feePct[serviceId] ?? 0
      // Counter fee should strictly be between initial ask and target cost
      if (initialAskPct > targetPct) {
        expect(counterFee).toBeLessThan(initialAskPct)
        expect(counterFee).toBeGreaterThanOrEqual(targetPct)
      } else {
        expect(counterFee).toBeGreaterThan(initialAskPct)
        expect(counterFee).toBeLessThanOrEqual(targetPct)
      }
    }
  })
})

describe('negotiation.edge: no infinite rounds', () => {
  it('guarantees every airline negotiation terminates within maxCounters rounds', () => {
    for (const airline of AIRLINES) {
      const desk = createNegotiation(77)
      desk.open(airline.id, NEUTRAL_CONTEXT)
      const personality = desk.personality(airline.id)
      const maxCounters = personality.maxCounters

      // Repeatedly ask for a fee ratio that causes counters without walking
      const askRatio = (personality.targetCost + personality.reservation) / 2

      let roundCount = 0
      while (desk.session?.status === 'open' && roundCount < 20) {
        desk.setRatio(askRatio)
        desk.counter()
        roundCount++
      }

      // Must have terminated (status no longer 'open')
      expect(desk.session?.status).not.toBe('open')
      // Must terminate within maxCounters + 1 attempts
      expect(roundCount).toBeLessThanOrEqual(maxCounters + 1)
      expect(['signed', 'grudge', 'walked', 'accepted', 'player_walk']).toContain(desk.session?.status)
    }
  })

  it('terminates immediately on walk when player ask exceeds reservation', () => {
    for (const airline of AIRLINES) {
      const desk = createNegotiation(123)
      desk.open(airline.id, NEUTRAL_CONTEXT)
      desk.setRatio(2.5) // Exceeds reservation for all carriers

      const result = desk.counter()
      expect(result.reply).toBe('walk')
      expect(result.outcome).toBe('walked')
      expect(desk.session?.status).toBe('walked')
    }
  })
})

describe('negotiation.edge: result determinism', () => {
  it('produces identical state and outcomes across identical seeds', () => {
    const runSimulation = (seed: number) => {
      const desk = createNegotiation(seed)
      desk.open('skypenny_max', NEUTRAL_CONTEXT)

      desk.setRatio(1.2)
      const result1 = desk.counter()

      desk.setRatio(1.1)
      const result2 = desk.counter()

      const theirs = desk.session?.theirs.feePct.landing
      const saveState = desk.save()
      return { result1, result2, theirs, saveState }
    }

    const simA = runSimulation(999)
    const simB = runSimulation(999)
    const simC = runSimulation(1000)

    expect(simA.result1).toEqual(simB.result1)
    expect(simA.result2).toEqual(simB.result2)
    expect(simA.theirs).toBe(simB.theirs)
    expect(simA.saveState).toBe(simB.saveState)

    // Different seed should yield different counter proposal value or RNG state
    expect(simA.saveState).not.toBe(simC.saveState)
  })

  it('restores exact state and determinism after save and load', () => {
    const desk1 = createNegotiation(50)
    desk1.open('budgie_ultra', NEUTRAL_CONTEXT)
    desk1.setRatio(1.15)
    desk1.counter()

    const json = desk1.save()

    const desk2 = createNegotiation(1)
    desk2.load(json)

    expect(desk2.session?.airlineId).toBe('budgie_ultra')
    expect(desk2.session?.mood).toBe(desk1.session?.mood)

    desk1.setRatio(1.1)
    const res1 = desk1.counter()

    desk2.setRatio(1.1)
    const res2 = desk2.counter()

    expect(res1).toEqual(res2)
    expect(desk1.save()).toBe(desk2.save())
  })
})
