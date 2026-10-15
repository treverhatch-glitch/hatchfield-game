import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CouncilPanel } from './CouncilPanel.tsx'
import { CouncilEngine } from './engine.ts'

describe('CouncilPanel', () => {
  it('renders a non-modal late-game request with costs and projected votes', () => {
    const engine = new CouncilEngine()
    const context = { day: 80, fieldLevel: 8, prestige: 6, cash: 30_000 }
    engine.advance(context)
    const html = renderToStaticMarkup(<CouncilPanel view={engine.view(context)} onVote={() => {}} />)

    expect(html).toContain('data-testid="council-panel"')
    expect(html).toContain('Regional access compact')
    expect(html).toContain('likely pass')
    expect(html).toContain('likely fall')
    expect(html).toContain('data-testid="council-choice-full" disabled=""')
    expect(html).not.toContain('role="dialog"')
  })

  it('explains the field-level gate before the council opens', () => {
    const engine = new CouncilEngine()
    const html = renderToStaticMarkup(
      <CouncilPanel
        view={engine.view({ day: 20, fieldLevel: 7, prestige: 0, cash: 100_000 })}
        onVote={() => {}}
      />,
    )
    expect(html).toContain('Opens at Field Level 8')
  })
})
