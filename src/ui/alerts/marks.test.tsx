import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { ALERT_TUNING } from '../../game/alertsData.ts'
import { AlertMarks } from './AlertMark.tsx'
import { criticalAlertMarks } from './marks.ts'
import { AlertStackView } from '../isolated/AlertStack.tsx'

describe('critical alert marks', () => {
  it('marks the first cell of a visible critical alert and skips warning and info', () => {
    const game = new Game()
    game.raiseAlert({
      key: 'cond:fuel-out',
      severity: 'critical',
      title: 'Fuel farm is empty',
      detail: '0 L',
      at: { view: 'apron', cells: [{ c: 3, r: 4 }, { c: 9, r: 9 }] },
    })
    game.raiseAlert({
      key: 'cond:cash',
      severity: 'warning',
      title: 'Cash is low',
      detail: '$4k',
      at: { view: 'apron', cells: [{ c: 1, r: 1 }] },
    })
    game.raiseAlert({
      key: 'ops:vip',
      severity: 'info',
      title: 'VIP visit',
      detail: 'A stand is held',
      at: { view: 'apron', cells: [{ c: 2, r: 2 }] },
    })

    const marks = criticalAlertMarks(game.alerts.ranked(), ALERT_TUNING.visible)
    expect(marks).toEqual([
      expect.objectContaining({ key: 'cond:fuel-out', cell: { c: 3, r: 4 } }),
    ])

    const html = renderToStaticMarkup(<AlertMarks game={game} />)
    expect(html.match(/data-testid="alert-mark-/g)).toHaveLength(1)
    expect(html).toContain('data-testid="alert-mark-cond:fuel-out"')
    expect(html).toContain('data-cell="3,4"')
    expect(html).not.toContain('data-cell="1,1"')
    expect(html).not.toContain('data-cell="9,9"')
    expect(html).not.toContain('VIP visit')
    expect(html).not.toContain('letter')
    expect(html).not.toContain('phone')

    const dock = renderToStaticMarkup(<AlertStackView game={game} />)
    expect(dock).toContain('data-testid="alert-cond:fuel-out"')
    expect(dock).toContain('data-testid="alert-mark-cond:fuel-out"')
  })

  it('drops the marker when the alert is dismissed', () => {
    const game = new Game()
    game.raiseAlert({
      key: 'cond:fuel-out',
      severity: 'critical',
      title: 'Fuel farm is empty',
      detail: '0 L',
      at: { view: 'apron', cells: [{ c: 3, r: 4 }] },
    })
    const id = game.alerts.active[0].id
    expect(renderToStaticMarkup(<AlertMarks game={game} />)).toContain('alert-mark-cond:fuel-out')
    game.dismissAlert(id)
    expect(renderToStaticMarkup(<AlertMarks game={game} />)).toBe('')
  })
})
