import { describe, expect, it } from 'vitest'
import { freshMemory, carefulIntents, chaoticIntents, greedyIntents } from './personas.ts'
import type { AirportView } from './types.ts'

function board(partial: Partial<AirportView> = {}): AirportView {
  return {
    day: 1,
    clock: 200,
    cash: 40_000,
    speed: 5,
    hasLand: true,
    kitAvailable: false,
    kitCost: 48_000,
    runway: 1,
    stands: 2,
    terminals: 9,
    snacks: 0,
    rooms: { food: 1, souvenir: 1, checkin: 2, security: 2, gate: 2 },
    shopUnits: 2,
    leasedShops: 0,
    openShopBids: 0,
    signed: [],
    offer: null,
    loanBalance: 0,
    loans: [
      { id: 'micro', label: 'Micro strip', principal: 25_000 },
      { id: 'bridge', label: 'Bridge loan', principal: 45_000 },
    ],
    fieldLevel: 1,
    prestigeStars: 0,
    fieldRating: 50,
    satisfaction: 70,
    guestCount: 4,
    janitors: 0,
    mechanics: 1,
    researchPoints: 0,
    wave3Points: 0,
    nextResearch: null,
    treePoints: 0,
    treeUnlocked: [],
    nextTree: null,
    deskStaff: 2,
    checkinStaffed: true,
    securityStaffed: true,
    deskHireCost: 3600,
    checkinWaiting: 0,
    securityWaiting: 0,
    curbPressure: 0,
    curbQueue: 0,
    curbDelaySec: 0,
    lanes: 2,
    busBays: 1,
    curbLanes: 1,
    taxiRanks: 1,
    yearReportPending: false,
    flightsDone: 1,
    activeFlights: 1,
    fuelTerm: 'apex_local',
    fuelSignCost: 3_500,
    fieldAsk: null,
    ...partial,
  }
}

describe('playtest personas', () => {
  it('careful buys land, stamps the kit, and only signs a letter that passes', () => {
    const empty = carefulIntents(board({ hasLand: false, day: 0, clock: 0, cash: 150_000 }), freshMemory())
    expect(empty.intents).toEqual([{ do: 'buyLand', kind: 'city' }])

    const kit = carefulIntents(
      board({ kitAvailable: true, cash: 55_000, runway: 0, stands: 0, terminals: 0 }),
      freshMemory(),
    )
    expect(kit.intents.map((intent) => intent.do)).toContain('starterKit')

    const met = carefulIntents(
      board({ offer: { name: 'Bushline', met: true, missing: [], deadline: 40 } }),
      freshMemory(),
    )
    expect(met.intents.some((intent) => intent.do === 'accept')).toBe(true)

    const unmet = carefulIntents(
      board({ offer: { name: 'Northline', met: false, missing: ['security ×2'], deadline: 20 } }),
      freshMemory(),
    )
    expect(unmet.intents.some((intent) => intent.do === 'snooze')).toBe(true)
    expect(unmet.intents.some((intent) => intent.do === 'accept')).toBe(false)
  })

  it('careful adds one expansion on a new day and then waits', () => {
    const first = carefulIntents(board({ cash: 30_000, stands: 2 }), freshMemory())
    expect(first.intents.some((intent) => intent.do === 'stamp' && intent.tool === 'stand')).toBe(true)
    const again = carefulIntents(board({ cash: 30_000, stands: 2 }), first.memory)
    expect(again.intents.some((intent) => intent.do === 'stamp')).toBe(false)
  })

  it('greedy takes the biggest loan and tries to sign whatever letter is open', () => {
    const decision = greedyIntents(
      board({
        cash: 7_000,
        offer: { name: 'Zoomjet', met: false, missing: ['bag sort'], deadline: 30 },
      }),
      freshMemory(),
    )
    expect(decision.intents).toContainEqual({ do: 'accept' })
    expect(decision.intents).toContainEqual({ do: 'loan', id: 'bridge' })
  })

  it('builds a research room once the operations trickle has banked a point', () => {
    const quiet = carefulIntents(board({ wave3Points: 0, cash: 20_000 }), freshMemory())
    expect(quiet.intents.some((intent) => intent.do === 'room' && intent.id === 'rdesk')).toBe(false)

    const careful = carefulIntents(board({ wave3Points: 2, cash: 30_000, stands: 2 }), freshMemory())
    expect(careful.intents).toContainEqual({ do: 'room', id: 'rdesk' })
    expect(careful.intents.some((intent) => intent.do === 'stamp')).toBe(false)

    const broke = carefulIntents(board({ wave3Points: 2, cash: 1_000 }), freshMemory())
    expect(broke.intents.some((intent) => intent.do === 'room' && intent.id === 'rdesk')).toBe(false)

    const chalkboard = carefulIntents(
      board({
        wave3Points: 3,
        cash: 20_000,
        rooms: { food: 1, souvenir: 1, checkin: 2, security: 2, gate: 2, rdesk: 1 },
      }),
      freshMemory(),
    )
    expect(chalkboard.intents).toContainEqual({ do: 'room', id: 'rboard' })

    const greedy = greedyIntents(
      board({
        wave3Points: 2,
        cash: 40_000,
        offer: { name: 'Zoomjet', met: false, missing: ['bag sort'], deadline: 30 },
      }),
      freshMemory(),
    )
    expect(greedy.intents).toContainEqual({ do: 'room', id: 'rdesk' })

    const chaotic = chaoticIntents(board({ wave3Points: 2, cash: 20_000 }), freshMemory(), () => 0)
    expect(chaotic.intents).toContainEqual({ do: 'room', id: 'rdesk' })

    const stamped = carefulIntents(board({ cash: 30_000, stands: 2, wave3Points: 0 }), freshMemory())
    const afterTrickle = carefulIntents(board({ cash: 30_000, stands: 2, wave3Points: 2 }), stamped.memory)
    expect(afterTrickle.intents).toContainEqual({ do: 'room', id: 'rdesk' })
  })

  it('buys one affordable research-tree node a day and staffs empty desks', () => {
    const open = board({
      nextTree: { id: 'airfield-1', name: 'Apron charter', cost: 0 },
      treePoints: 0,
      deskStaff: 0,
      checkinStaffed: false,
      securityStaffed: false,
      cash: 40_000,
    })
    const first = carefulIntents(open, freshMemory())
    expect(first.intents).toContainEqual({ do: 'tree', id: 'airfield-1' })
    expect(first.intents).toContainEqual({ do: 'desk' })
    const again = carefulIntents(open, first.memory)
    expect(again.intents.some((intent) => intent.do === 'tree')).toBe(false)

    const broke = carefulIntents(board({ deskStaff: 0, checkinStaffed: false, cash: 2_000 }), freshMemory())
    expect(broke.intents.some((intent) => intent.do === 'desk')).toBe(false)

    const greedy = greedyIntents(
      board({
        nextTree: { id: 'terminal-1', name: 'Hall shell', cost: 0 },
        deskStaff: 0,
        checkinStaffed: false,
        securityStaffed: true,
        cash: 20_000,
      }),
      freshMemory(),
    )
    expect(greedy.intents).toContainEqual({ do: 'tree', id: 'terminal-1' })
    expect(greedy.intents).toContainEqual({ do: 'desk' })
  })

  it('careful answers a jammed curb with a bay or a lane, after the lab', () => {
    const jammed = carefulIntents(
      board({ curbPressure: 1.4, busBays: 0, lanes: 1, cash: 30_000, stands: 2 }),
      freshMemory(),
    )
    expect(jammed.intents).toContainEqual({ do: 'curb' })
    expect(jammed.intents.some((intent) => intent.do === 'stamp')).toBe(false)

    const labFirst = carefulIntents(
      board({ curbPressure: 1.8, busBays: 0, lanes: 1, wave3Points: 2, cash: 30_000 }),
      freshMemory(),
    )
    expect(labFirst.intents).toContainEqual({ do: 'room', id: 'rdesk' })
    expect(labFirst.intents.some((intent) => intent.do === 'curb')).toBe(false)

    const clear = carefulIntents(board({ curbPressure: 0.4, busBays: 0, cash: 30_000, stands: 2 }), freshMemory())
    expect(clear.intents.some((intent) => intent.do === 'curb')).toBe(false)

    const rank = carefulIntents(
      board({ curbPressure: 1.3, busBays: 1, curbLanes: 1, taxiRanks: 0, cash: 30_000, stands: 4 }),
      freshMemory(),
    )
    expect(rank.intents).toContainEqual({ do: 'curb' })

    const built = carefulIntents(
      board({ curbPressure: 1.3, busBays: 1, curbLanes: 1, taxiRanks: 1, cash: 30_000, stands: 4 }),
      freshMemory(),
    )
    expect(built.intents.some((intent) => intent.do === 'curb')).toBe(false)
  })

  it('builds a field ask the till can cover and declines one that would empty it', () => {
    const police = {
      kind: 'police' as const,
      title: 'Police post',
      cost: 11_000,
      bonus: 12_500,
      secondsLeft: 80,
      canBuild: true,
    }
    const careful = carefulIntents(board({ fieldAsk: police, cash: 40_000 }), freshMemory())
    expect(careful.intents).toContainEqual({ do: 'fieldBuild' })
    const tight = carefulIntents(
      board({
        fieldAsk: { kind: 'hotel', title: 'Landside hotel', cost: 18_000, bonus: 7_000, secondsLeft: 40, canBuild: true },
        cash: 25_000,
      }),
      freshMemory(),
    )
    expect(tight.intents).toContainEqual({ do: 'fieldDecline' })
    const comfortable = carefulIntents(
      board({
        fieldAsk: { kind: 'hotel', title: 'Landside hotel', cost: 18_000, bonus: 7_000, secondsLeft: 40, canBuild: true },
        cash: 40_000,
      }),
      freshMemory(),
    )
    expect(comfortable.intents).toContainEqual({ do: 'fieldBuild' })
    const blocked = carefulIntents(board({ fieldAsk: { ...police, canBuild: false } }), freshMemory())
    expect(blocked.intents).toContainEqual({ do: 'fieldDecline' })
    const greedy = greedyIntents(
      board({
        fieldAsk: { kind: 'hotel', title: 'Landside hotel', cost: 18_000, bonus: 7_000, secondsLeft: 40, canBuild: true },
        cash: 19_000,
      }),
      freshMemory(),
    )
    expect(greedy.intents).toContainEqual({ do: 'fieldBuild' })
  })

  it('chaotic clicks are stable for a seed', () => {
    const rngA = sequence(4)
    const rngB = sequence(4)
    const a = chaoticIntents(board(), freshMemory(), rngA)
    const b = chaoticIntents(board(), freshMemory(), rngB)
    expect(a.intents).toEqual(b.intents)
  })
})

function sequence(seed: number): () => number {
  let n = seed
  return () => {
    n = (n * 17 + 3) % 100
    return n / 100
  }
}
