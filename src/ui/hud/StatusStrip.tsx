import type { Game } from '../../game/sim'
import { formatSimDate } from '../../game/sim'
import type { Speed } from '../../game/types'
import { moneyAbbrev, perDayFromHour, signedRatePerDay } from '../moneyFormat'
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
  const last = game.econHist[game.econHist.length - 1]
  const netHour = last ? last.income - last.expense : game.incomePerHour
  const perDay = perDayFromHour(netHour)
  const site = game.site ? game.site : null

  return (
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
        type="button"
        className="hf-money"
        data-testid="tab-economy"
        title="Finances (F) · figures are per in-game day"
        onClick={() => togglePanel('finances', 'overview')}
      >
        {moneyAbbrev(game.cash)}{' '}
        <span className={perDay >= 0 ? 'up' : 'down'} data-money-unit="day">
          {signedRatePerDay(perDay)}
        </span>
      </button>
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
  )
}
