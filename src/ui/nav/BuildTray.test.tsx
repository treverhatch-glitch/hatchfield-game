import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Game } from '../../game/sim.ts'
import { BUILD_MENUS } from './taxonomy.ts'
import { BuildTray } from './BuildTray.tsx'

function groupMenu(menuId: string, groupId: string) {
  const menu = BUILD_MENUS.find((row) => row.id === menuId)
  if (!menu) throw new Error(menuId)
  const group = menu.groups.find((row) => row.id === groupId)
  if (!group) throw new Error(groupId)
  return { ...menu, groups: [group] }
}

describe('BuildTray lock badges', () => {
  it('prints the research node name on a widebody stand and keeps a padlock on a field-level lock', () => {
    const game = new Game()
    const stands = renderToStaticMarkup(
      <BuildTray game={game} menu={groupMenu('airfield', 'stands')} onOpen={() => {}} />,
    )
    expect(stands).toContain('data-testid="research-badge-airfield-3"')
    expect(stands).toContain('Large stands')
    expect(stands).not.toContain('research-badge-widebody_ops')

    const fuel = renderToStaticMarkup(
      <BuildTray game={game} menu={groupMenu('airside', 'fuel')} onOpen={() => {}} />,
    )
    expect(fuel).toContain('data-testid="research-badge-spec-green-1"')
    expect(fuel).toContain('SAF blend')
    expect(fuel).not.toContain('lock-badge-saf_blending')
    expect(fuel).toContain('data-testid="research-badge-airside-6"')
    expect(fuel).toContain('Night bank')
    expect(fuel).toContain('data-testid="research-badge-rail_fuel"')
    expect(fuel).toContain('Fuel rail')
  })
})
