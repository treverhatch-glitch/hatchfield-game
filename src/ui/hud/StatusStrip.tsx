import { useEffect, useRef, useState } from 'react'
import type { Game } from '../../game/sim'
import { formatSimDate } from '../../game/sim'
import type { Speed } from '../../game/types'
import type { CashFlowView, FlowFloat } from '../cashFlow'
import { moneyFull, moneyTick, ratePerDay } from '../moneyFormat'
import { selectCashFlow } from '../selectors'
import { togglePanel } from '../uiStore'
import { Icon } from './icons'

const SPEEDS: { speed: Speed; label: string; icon: string }[] = [
  { speed: 0, label: 'Pause', icon: 'pause' },
  { speed: 1, label: '1x', icon: 'play' },
  { speed: 3, label: '3x', icon: 'fast' },
  { speed: 5, label: '5x', icon: 'faster' },
]

export function StatusStrip({
  game,
  bellCount,
  ticker,
}: {
  game: Game
  bellCount: number
  ticker: string
}) {
  const xp = game.fieldXpToNext()
  const site = game.site ? game.site : null
  const flow = selectCashFlow(game)
  const cashRef = useRef<HTMLButtonElement>(null)
  const [tip, setTip] = useState(false)
  const [anchor, setAnchor] = useState({ left: 8, bottom: 32 })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!flow.floats.length) return
    const id = window.setTimeout(() => setTick((n) => n + 1), 400)
    return () => window.clearTimeout(id)
  }, [flow.floats, tick])

  useEffect(() => {
    const el = cashRef.current
    if (!el) return
    const place = () => {
      const r = el.getBoundingClientRect()
      setAnchor({ left: r.left, bottom: r.bottom })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [flow.estimateText, flow.cash, tip])

  const runwayShort =
    flow.runwayDays == null
      ? ''
      : flow.runwayDays < 1
        ? ' · <1d'
        : ` · ~${flow.runwayDays >= 10 ? Math.min(999, Math.round(flow.runwayDays)) : Math.round(flow.runwayDays * 10) / 10}d`

  return (
    <>
    <header className="hf-strip" data-hud-part="strip" data-testid="stats-bar">
      <button
        type="button"
        className="hf-icon-btn"
        aria-label="Menu"
        title="Game menu"
        onClick={() => togglePanel('menu')}
      >
        <Icon name="menu" />
      </button>
      <div className="hf-brand" title={site ?? 'Hatchfield'}>
        Hatchfield <span>· {game.view === 'hall' ? 'Hall' : 'Apron'}</span>
      </div>
      <button
        type="button"
        data-testid="tab-research"
        title="Research (U)"
        onClick={() => togglePanel('research')}
      >
        Field Lv {xp.level}
        <span className="hf-muted">
          {' '}
          {xp.level < 5 ? `${xp.xp}/${xp.need}` : xp.xp}
        </span>
      </button>
      <time dateTime={`P${Math.floor(game.clock / 180)}`}>{formatSimDate(game.clock)}</time>
      <div className="hf-speeds" aria-label="Speed">
        {SPEEDS.map((s) => (
          <button
            key={s.speed}
            type="button"
            className={game.speed === s.speed ? 'on' : ''}
            aria-label={s.label}
            title={s.label}
            onClick={() => game.setSpeed(s.speed)}
          >
            <Icon name={s.icon} />
          </button>
        ))}
      </div>
      <button
        ref={cashRef}
        type="button"
        className="hf-cash"
        data-testid="tab-economy"
        aria-label={`${moneyFull(flow.cash)}. ${flow.estimateText}${flow.runwayText ? `. ${flow.runwayText}` : ''}`}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
        onClick={() => togglePanel('finances', 'overview')}
      >
        <span className="hf-cash-amt" data-testid="cash-amount">
          {moneyFull(flow.cash)}
        </span>
        <span className={`hf-cash-est ${flow.arrow}`} data-money-unit="day" data-testid="cash-estimate">
          {flow.arrow === 'up' ? '▲' : flow.arrow === 'down' ? '▼' : '·'} {flow.estimateText}
          {flow.runwayText ? runwayShort : ''}
        </span>
      </button>
      <button type="button" data-testid="tab-budget" title="Budget" onClick={() => togglePanel('finances', 'budget')}>
        Budget
      </button>
      <label className="hf-flows" data-testid="flow-toggle" title="Show passenger flows (F)">
        <input type="checkbox" checked={game.showFlows} onChange={() => game.toggleFlows()} />
        Flows
      </label>
      <span className="hf-muted" title="Weather">
        {game.weatherLabel()}
      </span>
      <div className="hf-ticker" data-testid="ticker" title={ticker}>
        {ticker}
      </div>
      <button
        type="button"
        className="hf-bell"
        aria-label={bellCount ? `Notifications ${bellCount}` : 'Notifications'}
        title="Notifications"
        onClick={() => togglePanel('notifications')}
      >
        <Icon name="bell" />
        {bellCount > 0 ? <span className="hf-badge">{bellCount}</span> : null}
      </button>
      <div className="hf-view" aria-label="Apron or Hall">
        <button
          type="button"
          className={game.view === 'apron' ? 'on' : ''}
          onClick={() => game.setView('apron')}
        >
          Apron
        </button>
        <button
          type="button"
          className={game.view === 'hall' ? 'on' : ''}
          title="Hall (V)"
          onClick={() => game.setView('hall')}
        >
          Hall
        </button>
      </div>
    </header>
    {tip ? <FlowTip flow={flow} anchor={anchor} /> : null}
    <FlowFloats floats={flow.floats} anchor={anchor} />
    </>
  )
}

function FlowTip({ flow, anchor }: { flow: CashFlowView; anchor: { left: number; bottom: number } }) {
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - 336))
  return (
    <div
      className="hf-flow-tip"
      data-hud-transient
      role="tooltip"
      data-testid="cash-tip"
      style={{ left, top: anchor.bottom + 6 }}
    >
      <p className="hf-flow-head">
        {flow.runwayText ?? 'Daily pace'}
        <span data-money-unit="day">{flow.estimateText}</span>
      </p>
      <div>
        <b>Income</b>
        {flow.incomeLines.length ? (
          <ul>
            {flow.incomeLines.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <span data-money-unit="day">{ratePerDay(line.perDay)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No flight income yet.</p>
        )}
      </div>
      <div>
        <b>Costs</b>
        {flow.costLines.length ? (
          <ul>
            {flow.costLines.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <span data-money-unit="day">{ratePerDay(line.perDay)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No running costs.</p>
        )}
      </div>
      <p className="hf-flow-next">Next charge in {Math.max(0, Math.ceil(flow.nextChargeSec))}s</p>
    </div>
  )
}

function FlowFloats({
  floats,
  anchor,
}: {
  floats: FlowFloat[]
  anchor: { left: number; bottom: number }
}) {
  if (!floats.length) return null
  return (
    <div className="hf-floats" data-hud-transient>
      {floats.map((f, i) => (
        <span
          key={f.id}
          className={`hf-float ${f.dir}`}
          style={{ left: anchor.left + (i % 3) * 18, top: anchor.bottom - 4 }}
        >
          {f.dir === 'up' ? '+' : '−'}
          {moneyTick(f.amount)}
          <small>{f.label}</small>
        </span>
      ))}
    </div>
  )
}
