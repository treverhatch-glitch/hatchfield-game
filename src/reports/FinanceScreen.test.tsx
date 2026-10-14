import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Game } from '../game/sim.ts'
import { FinanceScreen } from './FinanceScreen.tsx'

/**
 * @vitest-environment jsdom
 */
describe('FinanceScreen', () => {
  it('renders and defaults to the current month', () => {
    const game = new Game()
    game.bank.post('passenger_fees', 1000, { simMinutes: 10, source: 'test' })
    game.bank.post('building_upkeep', -200, { simMinutes: 20, source: 'test' })

    render(<FinanceScreen game={game} />)

    expect(screen.getByTestId('finance-screen')).toBeDefined()

    // Check that we see the correct totals
    expect(screen.getByText('Operating Revenue')).toBeDefined()
    expect(screen.getByText('Operating Costs')).toBeDefined()
    expect(screen.getAllByText('$200').length).toBeGreaterThan(0)
    expect(screen.getByText('Net Operating Income')).toBeDefined()
    expect(screen.getAllByText('$800').length).toBeGreaterThan(0)
  })

  it('updates when selecting last month', () => {
    const game = new Game()
    game.clock = 180 * 2 // Day 2 (month 2)
    game.bank.post('passenger_fees', 5000, { simMinutes: 1440 + 10, source: 'test' }) // Day 1
    game.bank.post('building_upkeep', -1000, { simMinutes: 1440 + 20, source: 'test' }) // Day 1
    game.bank.post('passenger_fees', 200, { simMinutes: 2880 + 10, source: 'test' }) // Day 2

    render(<FinanceScreen game={game} />)

    // Default is month 2, so revenue is 200
    expect(screen.getAllByText('$200').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByTestId('period-last-month')[0])
    expect(screen.getAllByTestId('period-last-month')[0].className).toBe('on')
  })

  it('shows revenue and costs by source', () => {
    const game = new Game()
    game.bank.post('passenger_fees', 1000, { simMinutes: 10, source: 'test' })
    game.bank.post('retail_sales', 500, { simMinutes: 10, source: 'test' })
    game.bank.post('building_upkeep', -200, { simMinutes: 20, source: 'test' })

    render(<FinanceScreen game={game} />)

    expect(screen.getAllByText('passenger fees').length).toBeGreaterThan(0)
    expect(screen.getAllByText('retail sales').length).toBeGreaterThan(0)
    expect(screen.getAllByText('building upkeep').length).toBeGreaterThan(0)

    // 1000 and 500
    expect(screen.getAllByText('$500').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$200').length).toBeGreaterThan(0)
  })
})
