import { describe, expect, it } from 'vitest'
import { ADVISOR_TUNING } from './advisorData.ts'
import { Game } from './sim.ts'
import type { ZoneId } from './terminal.ts'

/** A custom shell painted C / S / G / Shops / Arrivals, one zone per row, nothing placed. */
function paintedShell() {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.buyLand('city')
  game.cash = 200_000
  game.scheduleAuto = false
  game.schedule = []
  game.spawnCool = 1e9
  game.offerCool = 1e9
  game.enqueueBuild({
    kind: 'terminal',
    cells: [{ c: 4, r: 4 }],
    tile: 'terminal',
    cost: 0,
    name: 'Terminal shell',
    origin: { c: 4, r: 4 },
  })
  game.finishSite(game.sites[game.sites.length - 1])
  const fit = game.activeHall()!
  const plan: ZoneId[] = ['checkin', 'security', 'gates', 'retail', 'arrivals']
  for (let r = 0; r < plan.length; r++) {
    for (let c = 0; c < 8; c++) game.paintHallCell(c, r, plan[r])
  }
  return { game, fit }
}

const ids = (game: Game) => game.advice.map((a) => a.id)

describe('Terminal Advisor in the live game', () => {
  it('builds and bulldozes re-run the layout checks', () => {
    const { game } = paintedShell()
    expect(ids(game)).toContain('no_curb')
    expect(game.advice[0].severity).toBe('blocker')

    expect(game.placeHallItemAt('entrance', 0, 0)).toBe(true)
    expect(ids(game)).not.toContain('no_curb')
    // Security is painted but has no lane yet: the strip is just floor.
    expect(ids(game)).toContain('security_bypass')

    expect(game.placeHallItemAt('security_small', 3, 1)).toBe(true)
    expect(ids(game)).not.toContain('security_bypass')

    const lane = game.activeHall()!.items!.find((it) => it.def === 'security_small')!
    expect(game.removeHallItem(lane.id)).toBe(true)
    expect(ids(game)).toContain('security_bypass')
  })

  it('one list: layout and kit notes are merged, worst first, without duplicates', () => {
    const { game } = paintedShell()
    game.placeHallItemAt('entrance', 0, 0)
    const got = ids(game)
    expect(got.filter((id) => id === 'security_bypass' || id === 'security-bypass')).toHaveLength(1)
    const rank = { blocker: 0, warning: 1, tip: 2 }
    const ranks = game.advice.map((a) => rank[a.severity!])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('the refresh tick reuses the layout run until the layout changes', () => {
    const { game } = paintedShell()
    game.tickAdvisor(ADVISOR_TUNING.refreshSec + 0.1)
    const first = game.layoutHintCache
    game.tickAdvisor(ADVISOR_TUNING.refreshSec + 0.1)
    expect(game.layoutHintCache).toBe(first)
    game.placeHallItemAt('bench', 0, 2)
    expect(game.layoutHintCache).not.toBe(first)
  })

  it('"Show me" highlights the cells and asks the hall camera to pan', () => {
    const { game } = paintedShell()
    expect(game.view).toBe('apron')
    const hint = game.advice.find((a) => a.id === 'no_curb')!
    game.showHint('no_curb')
    expect(game.view).toBe('hall')
    expect(game.advisorCells).toEqual(hint.cells)
    expect(game.cameraFocus).toMatchObject({ view: 'hall', r: 0, seq: 1 })
    game.showHint('no_curb')
    expect(game.cameraFocus?.seq).toBe(2)
  })

  it('only one floating panel is open at a time', () => {
    const { game } = paintedShell()
    game.toggleHints()
    expect(game.openPanel).toBe('hints')
    game.toggleInfo('fuel')
    expect(game.openPanel).toBe('info')
    expect(game.infoOpen).toBe('fuel')
    game.toggleHints()
    expect(game.openPanel).toBe('hints')
    expect(game.infoOpen).toBeNull()
    game.claimPanel('hud')
    expect(game.openPanel).toBe('hud')
    game.toggleHints()
    game.toggleHints()
    expect(game.openPanel).toBeNull()
  })
})
