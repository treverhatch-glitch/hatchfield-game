import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as THREE from 'three'
import { spawnHallGuest } from '../../game/guests.ts'
import { Game } from '../../game/sim.ts'
import { buildFittingMeshes } from '../../render/interior/fittings.ts'
import { facilityIdOf, pickFacilityId } from '../../render/interior/picking.ts'
import { split1f } from '../../terminalbuild/starter/split1f.ts'
import { cardForEveryKind } from './fittingCard.ts'
import { FittingCard, FittingCardView, fittingSnapshot } from './FittingCard.tsx'

describe('fitting card view', () => {
  it('renders every fitting kind, including security', () => {
    const cards = cardForEveryKind()
    expect(cards.some((card) => card.kind === 'security_lane')).toBe(true)
    for (const card of cards) {
      const html = renderToStaticMarkup(<FittingCardView model={card} onAction={() => {}} />)
      expect(html).toContain(`data-kind="${card.kind}"`)
      expect(html).toContain(card.name)
      expect(html).toContain(card.status)
      expect(html).toContain('Queue ')
      expect(html).toContain('Served ')
      expect(html).toContain('per min')
      expect(html).toContain('Wear ')
      expect(html).toContain('/day')
      expect(html).toContain(card.stage)
      expect(html).toContain('Repair')
      expect(html).toContain('Move')
      expect(html).toContain('Sell')
    }
  })

  it('advances the walk and updates queue and served text without reselecting', () => {
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
    const open = renderToStaticMarkup(<FittingCard game={game} />)
    expect(open).toContain('Security lane')
    expect(open).toContain(`data-id="${lane!.id}"`)
    const before = fittingSnapshot(game, lane!.id)
    for (let n = 0; n < 8; n++) game.hallGuests.push(spawnHallGuest(`card-flight-${n}`, 'depart', 'business'))
    let after = before
    for (let t = 0; t < 1800 && after === before; t += 15) {
      game.tickHallNav(15)
      after = fittingSnapshot(game, lane!.id)
    }
    expect(game.selectedFacility).toBe(lane!.id)
    expect(after).not.toBe(before)
    expect(after).toContain('Queue ')
    expect(after).toContain('Served ')
  }, 60_000)

  it('selects the lane id carried on the lane mesh', () => {
    const layout = split1f()
    const lane = layout.fittings?.find((row) => row.kind === 'security_lane')
    expect(lane).toBeTruthy()
    const group = buildFittingMeshes(layout)
    group.updateMatrixWorld(true)
    let pick: THREE.Object3D | null = null
    group.traverse((obj) => {
      if (facilityIdOf(obj) === lane!.id) pick = obj
    })
    expect(pick).toBeTruthy()
    const mesh = pick as unknown as THREE.Object3D
    const at = new THREE.Vector3()
    mesh.getWorldPosition(at)
    const ray = new THREE.Raycaster(new THREE.Vector3(at.x, at.y + 6, at.z), new THREE.Vector3(0, -1, 0))
    expect(pickFacilityId(ray, [group], new THREE.Vector3())).toBe(lane!.id)
  })
})
