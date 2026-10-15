import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Game } from '../../game/sim.ts'
import { CarbonInfoView } from '../CarbonInfo.tsx'

describe('carbon info view', () => {
  it('renders per-flight and per-building emissions with Green Pioneer controls', () => {
    const game = new Game()
    game.tiles[3][4] = 'fuel'
    game.carbon.recordFlight({
      id: 'ui-flight',
      flightNo: 'HF808',
      aircraft: 'Airbus A320neo',
      aircraftClass: 'narrowbody',
      safBlend: 0.5,
    })

    const html = renderToStaticMarkup(
      <CarbonInfoView view={game.carbonView()} onStart={() => game.startGreenPioneer()} onOffset={() => game.buyCarbonOffsets()} />,
    )
    expect(html).toContain('data-testid="carbon-info-view"')
    expect(html).toContain('HF808')
    expect(html).toContain('Airbus A320neo')
    expect(html).toContain('SAF 50%')
    expect(html).toContain('Fuel farm')
    expect(html).toContain('data-testid="start-green-pioneer"')
  })
})
