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
  it('pads a field-level lock on the heavy stand and names the research on a progression row', () => {
    const game = new Game()
    const stands = renderToStaticMarkup(
      <BuildTray game={game} menu={groupMenu('airfield', 'stands')} onOpen={() => {}} />,
    )
    expect(stands).toContain('data-testid="tray-stand_light"')
    expect(stands).toContain('data-testid="tray-stand_narrow"')
    expect(stands).toContain('data-testid="lock-badge-stand_heavy"')
    expect(stands).toContain('Field level 3')
    expect(stands).not.toContain('tray-stand_w')
    expect(stands).toContain('data-testid="research-badge-airfield-6"')
    expect(stands).toContain('Code E pier')

    const fuel = renderToStaticMarkup(
      <BuildTray game={game} menu={groupMenu('airside', 'fuel')} onOpen={() => {}} />,
    )
    expect(fuel).toContain('data-testid="research-badge-spec-green-1"')
    expect(fuel).toContain('SAF blend')
    expect(fuel).not.toContain('lock-badge-saf_blending')
    expect(fuel).toContain('data-testid="research-badge-airside-6"')
    expect(fuel).toContain('Fuel rail')
    expect(fuel).not.toContain('Night bank')
    expect(fuel).not.toContain('research-badge-rail_fuel')
  })
})
