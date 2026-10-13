import { describe, expect, it } from 'vitest'
import { LAND_PLOT } from '../game/catalog.ts'
import {
  commitPlot,
  nextPlotOffer,
  plotById,
  plotGrid,
  plotPrice,
  restoreOwned,
  seedOwned,
  starterHolding,
  starterPlotId,
} from './plots.ts'

const config = LAND_PLOT

describe('land plots', () => {
  it('starts on one core plot and prices the fringe by zone and distance', () => {
    const grid = plotGrid(config)
    expect(grid).toHaveLength(config.cols * config.rows)
    const starter = plotById(config, starterPlotId(config))!
    expect(starter.zone).toBe('core')
    expect(starter.distance).toBe(0)
    const industrial = grid.find((plot) => plot.zone === 'industrial' && plot.distance === 1)!
    const apron = grid.find((plot) => plot.zone === 'apron' && plot.distance === 1)!
    expect(plotPrice(industrial, 1, config)).toBeLessThan(plotPrice(apron, 1, config))
    expect(plotPrice(apron, 3, config)).toBeGreaterThan(plotPrice(apron, 1, config))
    expect(starterHolding(config).assessed).toBe(plotPrice(starter, 1, config))
  })

  it('only sells a plot that touches owned land, and field level caps the count', () => {
    const owned = [starterHolding(config)]
    const far = plotGrid(config).find((plot) => plot.col === 3 && plot.row === 3)!
    expect(commitPlot(owned, far.id, 5, config).ok).toBe(false)

    const locked = nextPlotOffer(owned, 1, config)
    expect(locked?.locked).toBe(true)
    expect(locked?.needLevel).toBe(2)
    expect(commitPlot(owned, locked!.id, 1, config)).toEqual({
      ok: false,
      reason: 'Parcel locked — reach Field Level 2 first.',
    })

    const open = nextPlotOffer(owned, 2, config)!
    expect(open.locked).toBe(false)
    const bought = commitPlot(owned, open.id, 2, config)
    expect(bought.ok).toBe(true)
    if (!bought.ok) return
    expect(bought.price).toBe(open.price)
    expect(bought.owned).toHaveLength(2)
    expect(bought.owned[1]?.assessed).toBe(open.price)
  })

  it('reseeds a save that forgot the starter and keeps a valid holding', () => {
    const seeded = seedOwned(4, config)
    expect(seeded).toHaveLength(4)
    expect(seeded[0]?.id).toBe(starterPlotId(config))
    const restored = restoreOwned(seeded, 1, config)
    expect(restored.map((plot) => plot.id)).toEqual(seeded.map((plot) => plot.id))
    const reseed = restoreOwned([{ id: 'nope', assessed: 10 }], 2, config)
    expect(reseed.map((plot) => plot.id)).toEqual(seedOwned(2, config).map((plot) => plot.id))
  })
})
