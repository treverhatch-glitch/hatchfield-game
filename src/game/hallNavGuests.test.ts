import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { HallNavCrowd } from '../render/hallNavCrowd.ts'
import { spawnHallGuest } from './guests.ts'
import { HallNav, hallSignage, prefabClaimHall, prefabNavLayout } from './hallNav.ts'
import { HALL_NAV_TUNING } from './hallNavData.ts'
import { schemeItems, schemeSigns, schemeZones, type PlacedItem } from './terminal.ts'
import { Game } from './sim.ts'

function field(): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = 'pax'
  game.buyLand('city')
  game.buildStarterKit()
  return game
}

function prefabHall(tier: 1 | 2 | 3 = 1, items: PlacedItem[] = schemeItems(tier) as PlacedItem[]) {
  const zones = schemeZones(tier)
  const nav = new HallNav()
  const fit = { zones, items, signs: schemeSigns(tier) }
  nav.setHall('h', '1', () => prefabNavLayout(zones, items), () => prefabClaimHall(zones, items), () => hallSignage(fit))
  return nav
}

describe('hall walkers are guests', () => {
  it('the starter kit walks guests with traits, needs and a guest card', () => {
    const game = field()
    game.tickHallNav(0.01)
    expect(game.hallNav.live).toBe(true)
    expect(game.hallNav.nav!.guests).toBe(HALL_NAV_TUNING.guests)
    const hallId = game.hallKey(game.activeHall()!)
    for (let i = 0; i < 30; i++) game.hallGuests.push(spawnHallGuest(`f-${i % 3}`, 'depart', i % 2 ? 'business' : 'family', { hallId }))
    game.tickHallNav(0.01)
    const walkers = game.hallNav.nav!.poses()
    expect(walkers.length).toBeGreaterThan(0)
    const card = game.hallNav.guestCard(walkers[0].id)!
    expect(card).not.toBeNull()
    expect(card.traits.length).toBeGreaterThan(0)
    expect(card.needs.hunger).toBeGreaterThanOrEqual(0)
    expect(card.satisfaction).toBeGreaterThan(0)
    // Business fares walk as business guests.
    const biz = game.hallGuests.filter((g) => g.tag === 'business').map((g) => game.hallNav.guestCard(g.id)).filter(Boolean)
    expect(biz.length).toBeGreaterThan(0)
    for (const c of biz) expect(c!.purpose).toBe('business')
    // Clicking the floor where a walker stands picks them.
    const p = walkers[0]
    expect(game.hallNav.pickAt(p.x + game.hallNav.originX, p.z + game.hallNav.originZ)).toBe(p.id)
  })

  it('family fares on one flight walk as parties', () => {
    const nav = prefabHall()
    const guests = Array.from({ length: 40 }, () => spawnHallGuest('fam-flight', 'depart', 'family', {}))
    nav.admit(guests, 0, () => 30)
    const cards = guests.map((g) => nav.guestCard(g.id)).filter((c) => c !== null)
    expect(cards.length).toBe(40)
    const parties = cards.filter((c) => c.group.length > 1)
    expect(parties.length).toBeGreaterThan(0)
    for (const c of parties) expect(c.group.length).toBeLessThanOrEqual(HALL_NAV_TUNING.familyGroups.maxFollowers + 1)
  })

  it('reads placed signs and info screens for wayfinding, plus the scheme signs', () => {
    const zones = schemeZones(1)
    const items = schemeItems(1) as PlacedItem[]
    const base = hallSignage({ zones, items, signs: schemeSigns(1) })
    // The scheme's signs are placed items: each stands where it is, none are counted twice.
    expect(base.signs.length + base.schemeSigns).toBe(schemeSigns(1))
    const more: PlacedItem[] = [
      ...items,
      { id: 's1', def: 'wayfinding', c: 1, r: 1, wear: 0 },
      { id: 'b1', def: 'info_screen', c: 2, r: 1, wear: 0 },
    ]
    const s = hallSignage({ zones, items: more, signs: schemeSigns(1) + 1 })
    expect(s.signs.length).toBe(base.signs.length + 1)
    expect(s.boards.length).toBe(base.boards.length + 1)
    expect(s.schemeSigns).toBe(base.schemeSigns)
  })

  it('walk feedback becomes owed reputation the sim takes once', () => {
    const nav = prefabHall()
    const guests = Array.from({ length: 200 }, (_, i) => spawnHallGuest(`fl-${i % 4}`, 'depart', 'budget', {}))
    // A short lead: some miss, everyone has thoughts.
    nav.admit(guests, 0, (id) => (id === 'fl-0' ? 1 : 30))
    for (let i = 0; i < 1500; i++) nav.tick(0.05)
    const fb = nav.feedback
    expect(fb.satDelta).not.toBe(0)
    const rep = nav.takeReputation()
    expect(Number.isFinite(rep)).toBe(true)
    expect(rep).not.toBe(0)
    expect(nav.takeReputation()).toBe(0)
    expect(nav.missed).toBeGreaterThan(0)
  })

  it('the sim feeds walk reputation into the eased reputation meter', () => {
    const game = field()
    game.tickHallNav(0.01)
    const hallId = game.hallKey(game.activeHall()!)
    for (let i = 0; i < 60; i++) game.hallGuests.push(spawnHallGuest(`r-${i % 2}`, 'depart', 'budget', { hallId }))
    for (let i = 0; i < 400; i++) game.tickHallNav(0.05)
    // Everything the walk owed has been handed to the sim.
    expect(game.hallNav.takeReputation()).toBe(0)
  })

  it('lost and rebooking guests get a thought marker drawn over them', () => {
    const nav = prefabHall()
    const guests = Array.from({ length: 300 }, (_, i) => spawnHallGuest(`m-${i % 3}`, 'depart', 'budget', {}))
    nav.admit(guests, 0, () => 1)
    const crowd = new HallNavCrowd()
    const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600)
    // Inside the head-and-bag range: markers draw with the near detail.
    cam.position.set(0, 26, 22)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()
    let marks = 0
    for (let f = 0; f < 600; f++) {
      nav.tick(0.05)
      crowd.sync(nav, f * 0.05, cam)
      marks = Math.max(marks, crowd.stats.marks)
    }
    expect(nav.missed).toBeGreaterThan(0)
    expect(marks).toBeGreaterThan(0)
    crowd.dispose()
  })
})
