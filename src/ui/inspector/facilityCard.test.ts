import { describe, expect, it } from 'vitest'
import { Game } from '../../game/sim.ts'
import type { FacilityMetrics } from '../../paxnav/paxnav.ts'
import { cardForMetric, inspectorCard, nearestFacilityId } from './facilityCard.ts'

function metric(patch: Partial<FacilityMetrics> & Pick<FacilityMetrics, 'id' | 'queueLength'>): FacilityMetrics {
  return {
    id: patch.id,
    kind: patch.kind ?? 'security_lane',
    roomId: patch.roomId ?? 'security',
    queueLength: patch.queueLength,
    serving: patch.serving ?? false,
    incoming: patch.incoming ?? 0,
    avgWaitSec: patch.avgWaitSec ?? 0,
    longestWaitSec: patch.longestWaitSec ?? 0,
    estWaitSec: patch.estWaitSec ?? 0,
    staffed: patch.staffed ?? true,
    inUse: patch.inUse ?? patch.queueLength > 0,
    serviceSec: patch.serviceSec ?? 30,
    served: patch.served ?? 0,
    leftQueue: patch.leftQueue ?? 0,
    stock: patch.stock ?? null,
    line: patch.line ?? [
      { x: 4, z: 2 },
      { x: 4, z: 6 },
    ],
  }
}

describe('facility inspector card', () => {
  it('keeps the queue count in the click-open line and one headline on the card', () => {
    const quiet = cardForMetric(metric({ id: 'lane-a', queueLength: 0, served: 3 }))
    const busy = cardForMetric(metric({ id: 'lane-a', queueLength: 7, served: 4, serving: true }))
    expect(quiet.note).toBe('Clear')
    expect(quiet.queueText).toBe('0 waiting')
    expect(busy.note).toBe('7 waiting')
    expect(busy.queueText).toBe('7 waiting')
    expect(busy.name).toBe('Security lane')
    expect(busy.bays[0]?.line).toContain('Served 4')
  })

  it('picks the nearest lane inside the click radius', () => {
    const lanes = [
      metric({ id: 'near', queueLength: 1, line: [{ x: 0, z: 0 }] }),
      metric({ id: 'far', queueLength: 1, line: [{ x: 10, z: 0 }] }),
    ]
    expect(nearestFacilityId(lanes, 1, 0, 0, 0, 3.2)).toBe('near')
    expect(nearestFacilityId(lanes, 14, 0, 0, 0, 3.2)).toBeNull()
    expect(nearestFacilityId(lanes, 5, 0, -6, 0, 3.2)).toBe('far')
  })

  it('opens a live security-lane card when that lane is selected', () => {
    const game = new Game()
    game.sandbox = true
    game.beginNew('easy')
    game.startFocus = 'pax'
    game.buyLand('city')
    game.buildStarterKit()
    game.setView('hall')
    game.tickHallNav(0.05)
    const lane = game.hallNav.metrics().find((row) => row.kind === 'security_lane')
    expect(lane).toBeTruthy()
    game.selectFacility(lane!.id)
    const card = inspectorCard(game)
    expect(card?.id).toBe(lane!.id)
    expect(card?.name).toBe('Security lane')
    expect(card?.queueText).toBe(`${lane!.queueLength} waiting`)
    expect(card?.note).toBe(lane!.queueLength > 0 ? `${lane!.queueLength} waiting` : lane!.serving ? 'Serving' : lane!.staffed ? 'Clear' : 'Unstaffed')
  })
})
