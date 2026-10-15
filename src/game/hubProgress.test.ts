import { describe, expect, it } from 'vitest'
import { Game } from './sim.ts'
import { readHubTiers } from './hubProgress.ts'

describe('hub progress on the sim', () => {
  it('keeps an unsigned carrier off the ladder', () => {
    const game = new Game()
    const list = game.hubChecklistFor('brisa')
    expect(list.next).toBeNull()
    expect(list.lines[0]?.detail).toBe('No contract yet')
    expect(game.hubCarrierViews()).toEqual([])
  })

  it('reads Brisa, Atlas Cargo, and Harbor Heli from the field without a desk table', () => {
    const game = new Game()
    game.signed = ['brisa', 'atlas_cargo', 'harbor_heli', 'gulf_pearl']
    const brisa = game.hubChecklistFor('brisa')
    expect(brisa.next).toBe('focus')
    expect(brisa.lines.find((line) => line.id === 'desk')).toMatchObject({ detail: '0 / 1', status: 'missing' })
    expect(brisa.lines.some((line) => line.id === 'lounge')).toBe(false)

    const atlas = game.hubChecklistFor('atlas_cargo')
    expect(atlas.lines.some((line) => line.id === 'lounge')).toBe(false)
    expect(atlas.lines.some((line) => line.id === 'desk')).toBe(false)

    const heli = game.hubChecklistFor('harbor_heli')
    expect(heli.lines.some((line) => line.id === 'pier')).toBe(false)
    expect(heli.lines.some((line) => line.id === 'lounge')).toBe(false)

    game.hubTiers.gulf_pearl = 'hub'
    const gulf = game.hubChecklistFor('gulf_pearl')
    expect(gulf.next).toBe('primary')
    expect(gulf.eligible).toBe(false)
    expect(gulf.lines.find((line) => line.id === 'desk')?.status).toBe('missing')

    const fee = game.wave3.feeLine('brisa')
    expect(fee.match(/×/g)).toHaveLength(1)
  })

  it('drops an unknown stored tier back to Station', () => {
    expect(readHubTiers({ brisa: 'base', ghost: 'fortress' })).toEqual({ brisa: 'base' })
  })
})
