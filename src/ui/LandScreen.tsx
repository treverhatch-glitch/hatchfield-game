import { useState } from 'react'
import { LAND, money } from '../game/catalog'
import { scenarioRuleLines } from '../scenarios/schedule'
import { SCENARIOS } from '../scenarios/templates'
import { STARTER_KITS } from '../game/starterLayout'
import { Game } from '../game/sim'
import type { SiteKind, StartFocus } from '../game/types'
import { MAP_LIST, mapById, mapSwatch } from '../maps/index'
import { MenuRail } from './menu/MenuRail'
import type { MenuSection } from './menu/sections'

const PAX_NEEDS = STARTER_KITS.pax.includes
const CARGO_NEEDS = STARTER_KITS.cargo.includes
const HYBRID_NEEDS = STARTER_KITS.hybrid.includes

export function LandScreen({
  game,
  enableHints,
  onEnableHintsChange,
  onBought,
  onBack,
  onContinue,
  onNavigate,
}: {
  game: Game
  enableHints: boolean
  onEnableHintsChange: (on: boolean) => void
  onBought: () => void
  onBack: () => void
  onContinue: () => void
  onNavigate: (section: MenuSection) => void
}) {
  const [hintsOn, setHintsOn] = useState(enableHints)
  const [mapId, setMapId] = useState(game.mapId)
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  const [quitNote, setQuitNote] = useState('')
  const chosen = scenarioId ? SCENARIOS.find((scenario) => scenario.id === scenarioId) : null
  const buy = (kind: SiteKind, focus: StartFocus) => {
    if (!game.buyLand(kind, focus)) return
    if (scenarioId) game.startScenario(scenarioId)
    onBought()
  }

  return (
    <div className="hf-shell" data-testid="new-game-sheet">
      <MenuRail
        current="new"
        hasSave={Game.hasSave()}
        onContinue={onContinue}
        onNew={() => {}}
        onLoad={() => onNavigate('load')}
        onSettings={() => onNavigate('settings')}
        onCredits={() => onNavigate('credits')}
        onQuit={() => setQuitNote('Close this tab to leave. Named saves stay in this browser.')}
        quitNote={quitNote}
      />
      <div className="hf-stage">
        <button type="button" className="hf-back" data-testid="back-to-title" onClick={onBack}>
          Title
        </button>
        <p className="hf-kicker">
          New game · {money(game.cash)} on hand
          {game.sandbox ? ' · sandbox' : ''}
        </p>
        <h2>New game</h2>
        <p className="lede">
          Pick a climate, then a starter kit. Free play leaves the rules alone. A scenario
          starts when the plot is bought.
        </p>
        <label className="sandbox-toggle" title="The first-session hints stay hidden until Settings.">
          <input
            type="checkbox"
            checked={!hintsOn}
            data-testid="new-game-hints-off"
            onChange={(e) => {
              setHintsOn(!e.target.checked)
              onEnableHintsChange(!e.target.checked)
            }}
          />
          <span>Start with hints off</span>
        </label>
        <p className="menu-label">Scenario</p>
        <div className="hf-choices" data-testid="scenario-pick">
          <button
            type="button"
            className={`hf-choice${scenarioId == null ? ' on' : ''}`}
            data-testid="new-scenario-free"
            aria-pressed={scenarioId == null}
            onClick={() => setScenarioId(null)}
          >
            <strong>Free play</strong>
          </button>
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={`hf-choice${scenarioId === scenario.id ? ' on' : ''}`}
              data-testid={`new-scenario-${scenario.id}`}
              aria-pressed={scenarioId === scenario.id}
              onClick={() => setScenarioId(scenario.id)}
            >
              <strong>{scenario.name}</strong>
            </button>
          ))}
        </div>
        <p className="hf-muted" data-testid="new-scenario-blurb">
          {chosen ? chosen.blurb : 'A normal airport. No deadline and no extra rule.'}
        </p>
        {chosen ? (
          <ul className="hf-rules" data-testid="new-scenario-rules">
            {scenarioRuleLines(chosen).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <p className="menu-label">Climate</p>
        <div className="map-cards" data-testid="map-select">
          {MAP_LIST.map((id) => {
            const map = mapById(id)
            const on = mapId === id
            return (
              <button
                key={id}
                type="button"
                className={`map-card${on ? ' on' : ''}`}
                data-testid={`map-${id}`}
                aria-pressed={on}
                onClick={() => {
                  setMapId(id)
                  game.setMap(id)
                }}
              >
                <i className="map-swatch" style={{ background: mapSwatch(id) }} />
                <strong>{map.name}</strong>
                <em>{map.region}</em>
                <p>{map.blurb}</p>
                <ul>
                  {map.challenges.map((goal) => (
                    <li key={goal.id}>{goal.title}</li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
        <p className="menu-label">Starter kit</p>
        <div className="route-cards">
          <button
            type="button"
            className={`route-card${game.startFocus === 'pax' ? ' primary' : ''}`}
            data-testid="start-pax"
            aria-pressed={game.startFocus === 'pax'}
            onClick={() => buy('city', 'pax')}
          >
            <strong>{STARTER_KITS.pax.label}</strong>
            <em>City plot · {money(LAND.city.cost)}</em>
            <p>{STARTER_KITS.pax.summary}</p>
            <ul>
              {PAX_NEEDS.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </button>
          <button
            type="button"
            className={`route-card${game.startFocus === 'cargo' ? ' primary' : ''}`}
            data-testid="start-cargo"
            aria-pressed={game.startFocus === 'cargo'}
            onClick={() => buy('factory', 'cargo')}
          >
            <strong>{STARTER_KITS.cargo.label}</strong>
            <em>Factory plot · {money(LAND.factory.cost)}</em>
            <p>{STARTER_KITS.cargo.summary}</p>
            <ul>
              {CARGO_NEEDS.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </button>
        </div>
        <button
          type="button"
          className={`ghost hybrid-link${game.startFocus === 'hybrid' ? ' on' : ''}`}
          data-testid="start-hybrid"
          aria-pressed={game.startFocus === 'hybrid'}
          onClick={() => buy('city', 'hybrid')}
        >
          {STARTER_KITS.hybrid.label}
          <span>{HYBRID_NEEDS.join(' · ')}</span>
        </button>
      </div>
    </div>
  )
}
