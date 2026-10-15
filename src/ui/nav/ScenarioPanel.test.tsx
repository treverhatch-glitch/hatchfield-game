import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScenarioPanel, type ScenarioPanelGame } from './ScenarioPanel.tsx'

function sheet(run: ScenarioPanelGame['scenarioRun'] = null): ScenarioPanelGame {
  return {
    scenarioRun: run,
    startScenario: () => true,
  }
}

describe('ScenarioPanel', () => {
  it('lists every scenario and leaves the field idle until Start', () => {
    const html = renderToStaticMarkup(<ScenarioPanel game={sheet()} />)
    expect(html).toContain('data-testid="scenario-panel"')
    expect(html).toContain('No scenario running.')
    expect(html).toContain('Island Hop')
    expect(html).toContain('Rescue a Failing Airport')
    expect(html).toContain('Net-zero is not on the day book')
    expect(html).toContain('scenario-start-island-hop')
    expect(html).not.toContain('disabled')
  })

  it('holds the other starts while one scenario is running', () => {
    const html = renderToStaticMarkup(
      <ScenarioPanel
        game={sheet({ id: 'mega-hub', startedDay: 2, status: 'running', progress: 0.1, profitDays: 0 })}
      />,
    )
    expect(html).toContain('Mega-Hub · running')
    expect(html).toContain('window ends day 22')
    expect(html).toContain('disabled')
  })
})
