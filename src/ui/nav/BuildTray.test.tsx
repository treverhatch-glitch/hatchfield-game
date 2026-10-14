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
    expect(stands).toContain('data-testid="research-badge-widebody_ops"')
    expect(stands).toContain('Widebody ops')
    expect(stands).toContain('data-testid="research-badge-heavy_pack"')
    expect(stands).toContain('Heavy metal pack')

    const fuel = renderToStaticMarkup(
      <BuildTray game={game} menu={groupMenu('airside', 'fuel')} onOpen={() => {}} />,
    )
    expect(fuel).toContain('data-testid="lock-badge-saf_blending"')
    expect(fuel).not.toContain('research-badge-saf_blending')
    expect(fuel).toContain('data-testid="research-badge-rail_fuel"')
    expect(fuel).toContain('Fuel rail')
  })
})
