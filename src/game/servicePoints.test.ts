import { describe, expect, it } from 'vitest'
import { CLOSED_NO_STAFF_LINE, SERVICE_POINT_TUNING, WALK_PAUSED_LINE, openPointIds } from '../servicepoints/index.ts'
import { HALL_POST, onPostNow, spawnHallGuest } from './guests.ts'
import { openCheckinCount, openSecurityCount, prefabNavLayout, staffPoints } from './hallNav.ts'
import { Game } from './sim.ts'
import { itemDef, schemeItems, schemeZones } from './terminal.ts'
import type { ShowUpPlan } from '../pax/showup.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = true
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  game.hallGuests = game.hallGuests.filter((g) => !g.preview)
  game.deskStaff = 0
  game.hallStaff = []
  game.deskStaffCool = 1e9
  return game
}

function walkLanes(game: Game): number {
  return game.hallNav.nav!.facilities.list.filter((f) => f.kind === 'security_lane' && f.staffed).length
}

function sync(game: Game) {
  game.tickHallNav(0.05)
}

/** Starter lanes stay with the building. A bought lane needs a screener on the post. */
function oneBundleLane(game: Game) {
  const fit = game.activeHall()!
  const lanes = (fit.items ?? []).filter((it) => itemDef(it.def)?.room === 'security')
  expect(lanes.length).toBeGreaterThan(0)
  lanes.forEach((it, i) => {
    it.bundle = i === 0
  })
  const before = (fit.layout?.equipment ?? []).filter((eq) => eq.kind === 'security_lane').length
  game.placeHallItem('security_small')
  const after = (fit.layout?.equipment ?? []).filter((eq) => eq.kind === 'security_lane').length
  expect(after).toBe(before + 1)
  game.hallRev++
}

function screener(game: Game, stage: number) {
  game.deskStaff = 1
  game.deskStaffCool = 1e9
  game.hallStaff = [
    { id: 'screener', node: 'security', label: 'Screener', color: '#c9a227', stage },
  ]
}

describe('service point source of truth', () => {
  it('classifies desks from the item def, not the id string', () => {
    const facilities = [
      { id: 'desk-7-0', kind: 'checkin_desk' },
      { id: 'bundle-kiosk-trap-0', kind: 'checkin_desk' },
      { id: 'lane-0', kind: 'security_lane' },
      { id: 'lane-1', kind: 'security_lane' },
    ]
    const items = [
      { id: 'desk-7', def: 'kiosk', bundle: false },
      { id: 'bundle-kiosk-trap', def: 'checkin_belt', bundle: false },
      { id: 'belt', def: 'checkin_belt', bundle: true },
      { id: 'sec-a', def: 'security_small', bundle: true },
      { id: 'sec-b', def: 'security_small', bundle: false },
    ]
    const points = staffPoints(
      [...facilities, { id: 'belt-0', kind: 'checkin_desk' }],
      items,
    )
    expect(points.find((p) => p.id === 'desk-7-0')).toMatchObject({ automatic: true, included: false })
    // The id says bundle and kiosk. The def is a staffed belt that is not in the bundle.
    expect(points.find((p) => p.id === 'bundle-kiosk-trap-0')).toMatchObject({ automatic: false, included: false })
    expect(points.find((p) => p.id === 'belt-0')).toMatchObject({ automatic: false, included: true })
    const open = openPointIds(points, { checkin: 0, security: 0 })
    expect(open.has('desk-7-0')).toBe(true)
    expect(open.has('belt-0')).toBe(true)
    expect(open.has('bundle-kiosk-trap-0')).toBe(false)
    expect(open.has('lane-0')).toBe(true)
    expect(open.has('lane-1')).toBe(false)
    expect(openSecurityCount(facilities, items, 1)).toBe(2)
  })

  it('reads the prefab kiosk and belt off the placed defs', () => {
    const items = schemeItems(1)
    const layout = prefabNavLayout(schemeZones(1), items)
    const points = staffPoints(layout.equipment, items)
    const desks = points.filter((p) => p.kind === 'checkin_desk')
    expect(desks.some((p) => p.automatic)).toBe(true)
    expect(desks.some((p) => p.included && !p.automatic)).toBe(true)
    const open = openPointIds(points, { checkin: 0, security: 0 })
    expect(desks.every((p) => open.has(p.id))).toBe(true)
  })

  it('keeps the sim lane count equal to the walk across prefab, custom and kiosk halls', () => {
    const prefab = field()
    oneBundleLane(prefab)
    sync(prefab)
    const bundleOnly = walkLanes(prefab)
    expect(bundleOnly).toBeGreaterThan(0)
    expect(prefab.securityServers()).toBe(bundleOnly)
    expect(prefab.hallNav.nav!.facilities.list.filter((f) => f.kind === 'security_lane').length).toBeGreaterThan(bundleOnly)

    screener(prefab, HALL_POST.onPost)
    sync(prefab)
    expect(walkLanes(prefab)).toBe(bundleOnly + 1)
    expect(prefab.securityServers()).toBe(walkLanes(prefab))

    for (const stage of [HALL_POST.onBreak, HALL_POST.commuting, 4]) {
      screener(prefab, stage)
      sync(prefab)
      expect(prefab.onPostCount('security')).toBe(0)
      expect(walkLanes(prefab)).toBe(bundleOnly)
      expect(prefab.securityServers()).toBe(bundleOnly)
    }

    const custom = field()
    const customFit = custom.activeHall()!
    customFit.premade = false
    for (const it of customFit.items ?? []) it.bundle = false
    custom.hallRev++
    sync(custom)
    const customLanes = custom.hallNav.nav!.facilities.list.filter((f) => f.kind === 'security_lane')
    const customDesks = custom.hallNav.nav!.facilities.list.filter((f) => f.kind === 'checkin_desk')
    expect(customLanes.length).toBeGreaterThan(0)
    expect(customLanes.every((f) => !f.staffed)).toBe(true)
    expect(custom.securityServers()).toBe(0)
    expect(custom.onPostCount('security')).toBe(0)
    expect(customDesks.some((f) => f.id.includes('kiosk') && f.staffed)).toBe(true)
    expect(customDesks.some((f) => !f.staffed)).toBe(true)
    expect(custom.checkinServers()).toBe(customDesks.filter((f) => f.staffed).length)
    expect(custom.servicePointLines('security')).toContain(CLOSED_NO_STAFF_LINE)
    expect(custom.servicePointLines('checkin')).toContain(CLOSED_NO_STAFF_LINE)
    expect(custom.servicePointLines('security')).not.toContain('open: building service')

    const kiosk = field()
    const fit = kiosk.activeHall()!
    const taken = new Set((fit.items ?? []).map((it) => `${it.c},${it.r}`))
    let spot: { c: number; r: number } | null = null
    const zones = fit.zones ?? []
    for (let r = 0; r < zones.length && !spot; r++) {
      for (let c = 0; c < (zones[r]?.length ?? 0); c++) {
        if (zones[r][c] === 'checkin' && !taken.has(`${c},${r}`)) {
          spot = { c, r }
          break
        }
      }
    }
    expect(spot).toBeTruthy()
    fit.items!.push({ id: 'self-serve-9', def: 'kiosk', c: spot!.c, r: spot!.r, wear: 0, bundle: false })
    fit.layout!.equipment = [...fit.layout!.equipment, { id: 'self-serve-9', kind: 'checkin_desk', x: 16, y: 37, wear: 0 }]
    kiosk.hallRev++
    sync(kiosk)
    const desk = kiosk.hallNav.nav!.facilities.list.find((f) => f.id.startsWith('self-serve-9'))
    expect(desk?.kind).toBe('checkin_desk')
    expect(desk?.staffed).toBe(true)
    expect(kiosk.securityServers()).toBe(walkLanes(kiosk))
  })

  it('says the walk is paused when the lines are an estimate', () => {
    const game = field()
    expect(game.hallNav.live).toBe(false)
    const paused = game.servicePointLines('security')
    expect(paused[0]).toBe(WALK_PAUSED_LINE)
    expect(paused.some((l) => l.includes('waiting'))).toBe(true)
    sync(game)
    expect(game.hallNav.live).toBe(true)
    const live = game.servicePointLines('security')
    expect(live).not.toContain(WALK_PAUSED_LINE)
    expect(live.some((l) => l.startsWith('Lane'))).toBe(true)
  })

  it('counts only a body on the post, not break, commute or off-shift', () => {
    expect(onPostNow(HALL_POST.onPost)).toBe(true)
    expect(onPostNow(HALL_POST.onBreak)).toBe(false)
    expect(onPostNow(HALL_POST.commuting)).toBe(false)
    // Desk staff have no off-shift stage. A home stage must not count if it appears.
    expect(onPostNow(4)).toBe(false)

    const game = field()
    game.deskStaff = 1
    game.deskStaffCool = 1e9
    game.hallStaff = [
      { id: 'walk', node: 'security', label: 'Screener', color: '#c9a227', stage: HALL_POST.commuting, walkLeft: 0.3 },
    ]
    expect(game.onPostCount('security')).toBe(0)
    expect(game.staffedPost('security')).toBe(false)
    game.tick(0.5)
    expect(game.hallStaff.find((s) => s.id === 'walk')?.stage).toBe(HALL_POST.onPost)
    expect(game.onPostCount('security')).toBe(1)
  })

  it('does not slow a prefab lane the walk has open when nobody is posted', () => {
    const game = field()
    sync(game)
    expect(walkLanes(game)).toBeGreaterThan(0)
    expect(game.onPostCount('security')).toBe(0)
    const hallId = game.hallKey(game.activeHall()!)
    const g = spawnHallGuest('lane-body', 'depart', 'budget', { hallId })
    g.node = 'security'
    g.path = []
    g.clearedSec = false
    g.serviceLeft = 0
    g.queueSeq = 0
    game.hallGuests.push(g)
    game.tick(0.05)
    // Prefab service is 3.2s. The old unstaffed multiplier (1.35) would push this past 4.
    expect(g.serviceLeft).toBeGreaterThan(2.5)
    expect(g.serviceLeft).toBeLessThan(4)
  })

  it('serves a kiosk in 40 to 50 percent of a staffed desk and leaves a bag drop at desk speed', () => {
    const game = field()
    const fit = game.activeHall()!
    const spot = freeCheckinCell(fit)
    expect(spot).toBeTruthy()
    fit.items!.push({ id: 'drop-1', def: 'bag_drop', c: spot!.c, r: spot!.r, wear: 0, bundle: false })
    fit.layout!.equipment = [...fit.layout!.equipment, { id: 'drop-1', kind: 'checkin_desk', x: 10, y: 33, wear: 0 }]
    game.hallRev++
    sync(game)
    const list = game.hallNav.nav!.facilities.list
    const kiosk = list.find((f) => f.kind === 'checkin_desk' && f.id.includes('kiosk'))
    const belt = list.find((f) => f.kind === 'checkin_desk' && f.id === 's1-desk-0')
    const drop = list.find((f) => f.id.startsWith('drop-1'))
    expect(kiosk).toBeTruthy()
    expect(belt).toBeTruthy()
    expect(drop?.staffed).toBe(true)
    const ratio = kiosk!.serviceSec / belt!.serviceSec
    expect(ratio).toBeGreaterThanOrEqual(0.4)
    expect(ratio).toBeLessThanOrEqual(0.5)
    expect(ratio).toBeCloseTo(SERVICE_POINT_TUNING.kioskServiceShare)
    expect(drop!.serviceSec).toBeCloseTo(belt!.serviceSec)
    const points = staffPoints(list, fit.items ?? [])
    expect(points.find((p) => p.id.startsWith('drop-1'))).toMatchObject({ automatic: true, included: false })
    expect(openPointIds(points, { checkin: 0, security: 0 }).has(drop!.id)).toBe(true)
    expect(game.checkinServers()).toBe(openCheckinCount(list, fit.items ?? [], 0))
  })

  it('lets an open kiosk check a passenger in with no clerk, and waits when nothing is open', () => {
    const open = field()
    const openFit = open.activeHall()!
    for (const it of openFit.items ?? []) {
      const def = itemDef(it.def)
      if (def?.room === 'checkin' && def.staff > 0) it.bundle = false
    }
    open.hallRev++
    sync(open)
    expect(open.onPostCount('checkin')).toBe(0)
    expect(open.checkinServers()).toBeGreaterThan(0)
    const served = spawnHallGuest('kiosk-pax', 'depart', 'budget', { hallId: open.hallKey(openFit) })
    served.node = 'checkin'
    served.bagsDropped = true
    served.path = []
    open.serveNode(served, open.hallOpen())
    expect(served.thought).not.toBe('Empty check-in — waiting on a clerk')
    expect(served.thought).toBe('Heading to security')

    const shut = field()
    const shutFit = shut.activeHall()!
    shutFit.items = (shutFit.items ?? []).filter((it) => {
      const def = itemDef(it.def)
      return !(def && def.staff <= 0 && (def.room === 'checkin' || def.room === 'bagdrop'))
    })
    for (const it of shutFit.items) {
      const def = itemDef(it.def)
      if (def?.room === 'checkin' || def?.room === 'bagdrop') it.bundle = false
    }
    shut.hallRev++
    sync(shut)
    expect(shut.checkinServers()).toBe(0)
    const waiting = spawnHallGuest('desk-pax', 'depart', 'budget', { hallId: shut.hallKey(shutFit) })
    waiting.node = 'checkin'
    waiting.path = []
    shut.serveNode(waiting, shut.hallOpen())
    expect(waiting.thought).toBe('Empty check-in — waiting on a clerk')
  })

  it('puts the paused estimate on the building card, and a hire on a closed lane', () => {
    const game = field()
    game.setView('hall')
    game.selectFacility('security')
    const paused = game.buildingCard()
    expect(paused?.note).toBe(WALK_PAUSED_LINE)
    expect(paused?.hire).toBe(false)

    sync(game)
    const live = game.buildingCard()
    expect(live?.note).toMatch(/^Security forecast:/)
    expect(live?.hire).toBe(false)

    const custom = field()
    const fit = custom.activeHall()!
    for (const it of fit.items ?? []) it.bundle = false
    custom.hallRev++
    custom.setView('hall')
    custom.selectFacility('security')
    sync(custom)
    const card = custom.buildingCard()
    expect(card?.note).toMatch(/^Security forecast:/)
    expect(card?.hire).toBe(true)
    expect(card?.bays.some((bay) => bay.limit === CLOSED_NO_STAFF_LINE)).toBe(true)
    expect(card?.why).toContain(CLOSED_NO_STAFF_LINE)
  })
})

function freeCheckinCell(fit: NonNullable<ReturnType<Game['activeHall']>>): { c: number; r: number } | null {
  const taken = new Set((fit.items ?? []).map((it) => `${it.c},${it.r}`))
  const zones = fit.zones ?? []
  for (let r = 0; r < zones.length; r++) {
    for (let c = 0; c < (zones[r]?.length ?? 0); c++) {
      if (zones[r][c] === 'checkin' && !taken.has(`${c},${r}`)) return { c, r }
    }
  }
  return null
}

function release(game: Game, n: number, leadClock: number, tag: string) {
  const hallId = game.hallKey(game.activeHall()!)
  game.showUps.push({ slotId: tag, flightId: tag, std: game.clock + leadClock } as ShowUpPlan)
  for (let i = 0; i < n; i++) {
    const g = spawnHallGuest(`${tag}-${i}`, 'depart', 'budget', { hallId })
    g.id = `${tag}-${i}`
    g.flightId = tag
    g.happiness = 70
    // Carry-on only: the bank hits security together, so the lane count is the constraint.
    g.bags = false
    game.hallGuests.push(g)
  }
}

function securityWait(game: Game): number {
  // A closed lane reports a fixed unstaffed wait. The queue that matters is the lane that is open.
  let wait = 0
  for (const m of game.hallNav.metrics()) {
    if (m.kind === 'security_lane' && m.staffed) wait = Math.max(wait, m.estWaitSec)
  }
  return wait
}

function walk(game: Game, seconds: number): { peakWait: number; peakLane: number } {
  const steps = Math.ceil(seconds / 0.25)
  let peakWait = 0
  let peakLane = 0
  for (let i = 0; i < steps; i++) {
    game.tickHallNav(0.25)
    peakWait = Math.max(peakWait, securityWait(game))
    let lane = 0
    for (const m of game.hallNav.metrics()) {
      if (m.kind === 'security_lane' && m.staffed) lane = Math.max(lane, m.queueLength)
    }
    peakLane = Math.max(peakLane, lane)
  }
  return { peakWait, peakLane }
}

function meanMood(game: Game, flightId: string): number {
  const rows = game.hallGuests.filter((g) => !g.dead && !g.preview && g.flightId === flightId)
  if (!rows.length) return 0
  return rows.reduce((s, g) => s + g.happiness, 0) / rows.length
}

function flushReputation(game: Game, dt: number) {
  ;(game as unknown as { flushReputation(step: number): void }).flushReputation(dt)
}

describe('waits feed misses, mood and reputation', () => {
  it('removing a screener lengthens waits, misses and mood, and restaffing recovers', () => {
    const staffed = field()
    oneBundleLane(staffed)
    screener(staffed, HALL_POST.onPost)
    sync(staffed)
    const openStaffed = walkLanes(staffed)

    const thin = field()
    oneBundleLane(thin)
    screener(thin, HALL_POST.onBreak)
    sync(thin)
    const openThin = walkLanes(thin)
    expect(openThin).toBeLessThan(openStaffed)

    release(staffed, 80, 2.4, 'bank')
    release(thin, 80, 2.4, 'bank')
    const staffedRun = walk(staffed, 140)
    const thinRun = walk(thin, 140)

    const staffedMood = meanMood(staffed, 'bank')
    const thinMood = meanMood(thin, 'bank')
    expect(thinRun.peakWait).toBeGreaterThan(staffedRun.peakWait)
    expect(thinRun.peakLane).toBeGreaterThan(staffedRun.peakLane)
    expect(thin.hallNav.missed).toBeGreaterThan(staffed.hallNav.missed)
    expect(thinMood).toBeLessThan(staffedMood)

    const repStaffed = staffed.reputation
    const repThin = thin.reputation
    flushReputation(staffed, 20)
    flushReputation(thin, 20)
    expect(thin.reputation).toBeLessThan(staffed.reputation)
    expect(thin.reputation).toBeLessThan(repThin)
    expect(staffed.reputation).toBeLessThanOrEqual(repStaffed)

    const missedBefore = thin.hallNav.missed
    screener(thin, HALL_POST.onPost)
    sync(thin)
    expect(walkLanes(thin)).toBe(openStaffed)
    release(thin, 12, 40, 'again')
    const recovered = walk(thin, 50)
    expect(recovered.peakWait).toBeLessThan(thinRun.peakWait)
    expect(thin.hallNav.missed - missedBefore).toBeLessThan(missedBefore)
    expect(meanMood(thin, 'again')).toBeGreaterThan(thinMood)
    const repAfterQueue = thin.reputation
    flushReputation(thin, 20)
    // The kiosk is faster than the desk, so this bank reaches the lane a little sooner.
    // The flush may nick reputation. It does not give back the unstaffed drop.
    expect(thin.reputation).toBeGreaterThanOrEqual(repAfterQueue - 0.1)
  }, 120_000)
})
