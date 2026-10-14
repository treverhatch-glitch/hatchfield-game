import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildingCard } from '../buildinginfo/card.ts'
import { BuildingPanelView } from './BuildingPanel.tsx'

function standCard() {
  return buildingCard({
    id: '5,5',
    name: 'Medium stand',
    plan: 'stand',
      fleet: { fuel_truck: 1, baggage_tug: 1, belt_loader: 1, catering_truck: 1 },
    staffAssigned: 1,
    demand: 1,
    upkeepPerDay: 0,
  })
}

describe('building panel', () => {
  it('keeps the counts inside a closed subsection and puts why on the bottleneck icon', () => {
    const card = standCard()
    const html = renderToStaticMarkup(
      <BuildingPanelView card={card} open={new Set()} onToggle={() => {}} onClose={() => {}} />,
    )
    expect(html).toContain('data-testid="building-panel"')
    expect(html).toContain('Medium stand')
    expect(html).toContain('Limited')
    expect(html).toContain('Bay 2 idle: no tug')
    expect(html).toContain('data-testid="bottleneck-icon-tug"')
    expect(html).toContain('title="Bay 2 idle: no tug"')
    expect(html).toContain('class="building-tip"')
    expect(html).not.toContain('data-testid="building-figure-throughput"')
    expect(html).not.toContain('data-testid="building-figure-bays"')
    expect(html).not.toContain('data-testid="building-figure-upkeep"')
    expect(html).not.toContain('data-testid="building-figure-staff"')
    expect(html).not.toContain('4 / 5')
    expect(html).not.toContain('$0 / day')
  })

  it('shows the bay count and the idle line once Bays is opened', () => {
    const card = standCard()
    const html = renderToStaticMarkup(
      <BuildingPanelView card={card} open={new Set(['bays'])} onToggle={() => {}} onClose={() => {}} />,
    )
    expect(html).toContain('data-testid="building-figure-bays"')
    expect(html).toContain('4 / 5')
    expect(html).toContain('Bay 2 · idle · no tug')
    expect(html).not.toContain('data-testid="building-figure-throughput"')
  })
})
