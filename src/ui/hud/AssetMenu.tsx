import { useEffect, useRef, useState } from 'react'
import type { Game } from '../../game/sim'
import { ASSETS, assetLock, assetsFor, subtabNote, SUBTABS, type AssetDef } from '../assetCatalog'
import { moneyAbbrev } from '../moneyFormat'
import { getUiState, setSearch, type BuildCategory } from '../uiStore'
import { Icon } from './icons'

export function AssetMenu({
  game,
  onPick,
}: {
  game: Game
  onPick: (asset: AssetDef) => void
}) {
  const menu = getUiState().openMenu
  const search = getUiState().search
  const [pickedTab, setPickedTab] = useState<string | null>(null)
  const subtab =
    menu && pickedTab && SUBTABS[menu].includes(pickedTab) ? pickedTab : menu ? SUBTABS[menu][0] : ''
  const [tip, setTip] = useState<{ asset: AssetDef; left: number; bottom: number } | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTip(null)
  }, [menu])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      row.scrollLeft += e.deltaY
      e.preventDefault()
    }
    row.addEventListener('wheel', onWheel, { passive: false })
    return () => row.removeEventListener('wheel', onWheel)
  }, [menu, subtab, search])

  useEffect(() => {
    const focus = () => searchRef.current?.focus()
    window.addEventListener('hf-focus-search', focus)
    return () => window.removeEventListener('hf-focus-search', focus)
  }, [])

  if (!menu) return null
  const tabs = SUBTABS[menu]
  const assets = assetsFor(menu, subtab, search)
  const note = search.trim() ? null : subtabNote(menu, subtab)

  const showTip = (asset: AssetDef, el: HTMLElement) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const card = el.getBoundingClientRect()
      const host = menuRef.current?.getBoundingClientRect()
      const bottom = host ? window.innerHeight - host.top + 8 : window.innerHeight - card.top + 8
      const left = Math.min(window.innerWidth - 292, Math.max(8, card.left))
      setTip({ asset, left, bottom })
    }, 250)
  }

  const hideTip = () => {
    window.clearTimeout(timer.current)
    setTip(null)
  }

  return (
    <>
      <div
        className="hf-menu"
        data-hud-part="menu"
        data-testid="asset-menu"
        ref={menuRef}
        role="dialog"
        aria-label={`${labelFor(menu)} assets`}
      >
        <div className="hf-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={subtab === tab && !search.trim()}
              className={subtab === tab && !search.trim() ? 'on' : ''}
              onClick={() => {
                setSearch('')
                setPickedTab(tab)
              }}
            >
              {tab}
            </button>
          ))}
          <label className="hf-search">
            <Icon name="search" />
            <input
              ref={searchRef}
              value={search}
              placeholder="Search"
              aria-label="Search assets"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {note && assets.length === 0 ? <p className="hf-note">{note}</p> : null}
        <div className="hf-row" ref={rowRef} data-testid="build-tray">
          {assets.map((asset) => {
            const lock = assetLock(game, asset)
            const unaffordable = !game.sandbox && game.cash < asset.cost
            return (
              <button
                key={asset.id}
                type="button"
                className="hf-card"
                data-locked={lock.locked ? '1' : '0'}
                data-asset={asset.id}
                aria-label={asset.name}
                onMouseEnter={(e) => showTip(asset, e.currentTarget)}
                onMouseLeave={hideTip}
                onFocus={(e) => showTip(asset, e.currentTarget)}
                onBlur={hideTip}
                onClick={() => {
                  if (lock.locked) return
                  hideTip()
                  onPick(asset)
                }}
              >
                {lock.locked ? <Icon name="lock" className="hf-ico hf-lock" /> : null}
                <Icon name={menu} />
                <span className="hf-card-name">{asset.name}</span>
                <span className={`hf-card-price${unaffordable ? ' bad' : ''}`}>
                  {moneyAbbrev(asset.cost)}
                </span>
              </button>
            )
          })}
        </div>
        {note && assets.length > 0 ? <p className="hf-note">{note}</p> : null}
      </div>
      {tip ? (
        <AssetTooltip
          game={game}
          asset={tip.asset}
          left={tip.left}
          bottom={tip.bottom}
        />
      ) : null}
    </>
  )
}

function AssetTooltip({
  game,
  asset,
  left,
  bottom,
}: {
  game: Game
  asset: AssetDef
  left: number
  bottom: number
}) {
  const lock = assetLock(game, asset)
  const unaffordable = !game.sandbox && game.cash < asset.cost
  return (
    <div
      className="hf-tooltip"
      data-hud-transient="1"
      role="tooltip"
      style={{ left, bottom }}
    >
      <strong>{asset.name}</strong>
      <p>{asset.blurb}</p>
      <p>
        Cost{' '}
        <b className={unaffordable ? 'hf-bad' : ''}>{moneyAbbrev(asset.cost)}</b>
        {unaffordable ? <span className="hf-bad"> · short on cash</span> : null}
      </p>
      <p data-money-unit="day">Upkeep {moneyAbbrev(asset.upkeepPerDay)}/day</p>
      <p>Size {asset.size}</p>
      <p>Capacity {asset.capacity}</p>
      <p>{lock.locked ? lock.reason : `Field Level ${asset.fieldLevel}`}</p>
      <p>Shortcut {asset.shortcut}</p>
    </div>
  )
}

function labelFor(menu: BuildCategory): string {
  return menu
}

export function assetById(id: string | null): AssetDef | undefined {
  return ASSETS.find((a) => a.id === id)
}
