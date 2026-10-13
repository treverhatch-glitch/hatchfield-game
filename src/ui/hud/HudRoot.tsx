import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Game } from '../../game/sim'
import type { Speed, Tool } from '../../game/types'
import type { AssetDef } from '../assetCatalog'
import {
  clearTool,
  closePanel,
  getUiState,
  openPanel,
  pressEscape,
  reopenLastMenu,
  selectAsset,
  setHidden,
  setSearch,
  setUiScale,
  subscribeUi,
  toggleHidden,
  toggleMenu,
  togglePanel,
  type BuildCategory,
} from '../uiStore'
import { AssetMenu } from './AssetMenu'
import { CategoryBar } from './CategoryBar'
import { InfoViews } from './InfoViews'
import { coachLine, letterCount, Notifications } from './Notifications'
import { SidePanel } from './panels'
import { StatusStrip } from './StatusStrip'
import { ToolOptions } from './ToolOptions'
import '../hud.css'

function useUi() {
  return useSyncExternalStore(subscribeUi, getUiState, getUiState)
}

const BUILD_KEYS: Record<string, BuildCategory> = {
  r: 'pavement',
  s: 'stands',
  t: 'terminal',
  o: 'ops',
  l: 'landside',
}

export function HudRoot({ game }: { game: Game }) {
  const ui = useUi()
  const resumeSpeed = useRef<Speed>(1)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('clean') === '1') setHidden(true)
    if (import.meta.env.DEV) {
      const w = window as unknown as { __ui?: object }
      w.__ui = {
        getUiState,
        toggleMenu,
        togglePanel,
        openPanel,
        selectAsset,
        pressEscape,
        setHidden,
        toggleHidden,
        setSearch,
        setUiScale,
        reopenLastMenu,
      }
    }
  }, [])

  useEffect(() => {
    let lastTile = ''
    const off = game.subscribe(() => {
      const tile = game.selectedTile
      const tileKey = `${tile?.c ?? ''},${tile?.r ?? ''}|${game.selectedFlight ?? ''}`
      if (tileKey === lastTile) return
      lastTile = tileKey
      if (getUiState().hidden) return
      if (game.view !== 'apron') return
      if (game.tool !== 'pan') return
      if (!tile) return
      const kind = game.tile(tile)
      const inspect = game.inspectAt(tile)
      if (kind === 'grass' && !inspect) {
        if (getUiState().openPanel === 'selection') closePanel()
        return
      }
      if (kind === 'terminal') return
      if (inspect || (kind && kind !== 'grass')) openPanel('selection')
    })
    return () => {
      off()
    }
  }, [game])

  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.altKey) return
      if (e.ctrlKey || e.metaKey) {
        if ((e.key === 'z' || e.key === 'Z') && !typing(e)) {
          e.preventDefault()
          game.pushNews('Undo has no history yet — the last stamp stays.', 'ok')
        }
        return
      }
      if (typing(e) && e.key !== 'Escape') return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (e.key === '`' || e.code === 'Backquote' || key === 'h') {
        e.preventDefault()
        toggleHidden()
        return
      }
      if (getUiState().hidden) return

      if (e.key === 'Escape') {
        e.preventDefault()
        const step = pressEscape(game.view === 'hall')
        if (step === 'tool') game.setTool('pan')
        if (step === 'hall') game.exitHall()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (game.speed === 0) game.setSpeed(resumeSpeed.current || 1)
        else {
          resumeSpeed.current = game.speed
          game.setSpeed(0)
        }
        return
      }
      if (key === '1' || key === '2' || key === '3') {
        const map: Record<string, Speed> = { '1': 1, '2': 3, '3': 5 }
        game.setSpeed(map[key])
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        if (!getUiState().openMenu) reopenLastMenu()
        window.setTimeout(() => window.dispatchEvent(new Event('hf-focus-search')), 0)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        reopenLastMenu()
        return
      }
      if (key === 'v') {
        e.preventDefault()
        game.setView(game.view === 'apron' ? 'hall' : 'apron')
        return
      }
      if (key === 'b') {
        e.preventDefault()
        selectAsset('clear', 'clear')
        game.setTool('clear')
        return
      }
      if (key === 'u') {
        e.preventDefault()
        togglePanel('research')
        return
      }
      if (key === 'a') {
        e.preventDefault()
        togglePanel('airlines')
        return
      }
      if (key === 'p') {
        e.preventDefault()
        togglePanel('planner')
        return
      }
      if (key === 'g') {
        e.preventDefault()
        togglePanel('services')
        return
      }
      if (key === 'i') {
        e.preventDefault()
        togglePanel('info')
        return
      }
      const category = BUILD_KEYS[key]
      if (category) {
        e.preventDefault()
        toggleMenu(category)
      }
    }
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-hud-part], .hf-panel, .hf-menu, .hf-tooltip')) return
      if (getUiState().tool === 'pan') return
      e.preventDefault()
      clearTool()
      game.setTool('pan')
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('contextmenu', onContext)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('contextmenu', onContext)
    }
  }, [game])

  const pick = (asset: AssetDef) => {
    if (asset.access) game.setStandAccessMode(asset.access)
    selectAsset(asset.tool, asset.id)
    game.setTool(asset.tool)
  }

  const cancel = () => {
    clearTool()
    game.setTool('pan')
  }

  if (ui.hidden) return null

  const count = letterCount(game, false) + (game.showCoach() ? 1 : 0)
  const latest = game.news[0]?.text
  const coach = coachLine(game)
  const ticker =
    count > 0 && !latest
      ? `${count} waiting — open the bell`
      : coach && !latest
        ? coach
        : latest
          ? latest
          : coach ?? 'Field quiet'

  return (
    <div
      className="hf-root"
      data-menu-open={ui.openMenu ? '1' : '0'}
      data-ui-scale={ui.uiScale}
      style={{ ['--ui-scale' as string]: String(ui.uiScale) }}
    >
      <StatusStrip game={game} bellCount={count} ticker={ticker} />
      <InfoViews />
      <SidePanel game={game} notices={<Notifications game={game} />} />
      <AssetMenu game={game} onPick={pick} />
      <ToolOptions game={game} onCancel={cancel} />
      <CategoryBar
        onTool={(tool: Tool) => {
          game.setTool(tool)
        }}
      />
    </div>
  )
}
