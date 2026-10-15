import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInitialEconomyState } from '../economy/engine.ts'
import { walletView } from '../economy/wallet.ts'
import { OpsWalletPanel } from './OpsWalletPanel.tsx'

describe('ops wallet panel', () => {
  it('shows the banked points, every branch, and a ready node', () => {
    const state = { ...createInitialEconomyState(), researchPoints: 6, fieldLevel: 4 }
    const view = walletView(state, 4)
    const html = renderToStaticMarkup(<OpsWalletPanel game={{ opsWallet: () => view, buyOpsTech: () => true }} />)
    expect(html).toContain('data-testid="ops-wallet"')
    for (const branch of view.branches) expect(html).toContain(`data-testid="ops-branch-${branch.id}"`)
    expect(html).toContain('data-testid="ops-card"')
  })
})
