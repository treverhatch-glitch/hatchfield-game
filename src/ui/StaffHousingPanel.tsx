import { useState } from 'react'
import type { HousingTierId } from '../staffhousing/types.ts'
import { money } from '../game/catalog.ts'
import type { Game } from '../game/sim.ts'

type MenuId = 'commute' | 'housing' | 'crew'

/**
 * Headlines stay qualitative. Minutes, percents, beds, and money open on click.
 */
export function StaffHousingPanel({
  game,
  focus,
}: {
  game: Game
  focus?: 'housing' | 'commute' | 'morale'
}) {
  const [open, setOpen] = useState<MenuId | null>(null)
  const panel = game.staffPanel()
  const toggle = (id: MenuId) => setOpen((cur) => (cur === id ? null : id))
  const show = (id: MenuId) => (focus ? focus === (id === 'crew' ? 'morale' : id) : open === id)
  const allow = (id: MenuId) => (focus ? show(id) : true)

  return (
    <section data-testid="staff-panel">
      <h3>Staff housing</h3>
      <p className="muted">Crew commute in until a house stands on an expansion plot.</p>
      <div className="staff-subs">
        {allow('commute') && !focus ? (
        <button
          type="button"
          aria-expanded={open === 'commute'}
          data-testid="staff-commute"
          onClick={() => toggle('commute')}
        >
          Commute
          <span className="muted">{panel.commuteSummary}</span>
        </button>
        ) : null}
        {show('commute') || (focus === 'commute') ? (
          <div className="staff-detail" data-testid="staff-commute-detail">
            <p>
              {panel.commute.minutes} min · {panel.commute.reliabilityPct}% on time ·{' '}
              {panel.commute.lateMinutes} min late · {panel.commute.failurePct}% no-show
            </p>
            <p className="muted">
              Roads {panel.commute.roadCells}
              {panel.commute.roadReachesEdge ? ' · reaches the city edge' : ' · no city edge'}
              {' · '}bus stops {panel.commute.busStops}
              {' · '}
              {panel.commute.passengerRail ? 'city rail open' : 'no city rail'}
              {panel.commute.tier3Name ? ` · ${panel.commute.tier3Name}` : ''}
            </p>
          </div>
        ) : null}

        {allow('housing') && !focus ? (
        <button
          type="button"
          aria-expanded={open === 'housing'}
          data-testid="staff-housing"
          onClick={() => toggle('housing')}
        >
          Housing
          <span className="muted">{panel.housingSummary}</span>
        </button>
        ) : null}
        {show('housing') || focus === 'housing' ? (
          <div className="staff-detail" data-testid="staff-housing-detail">
            <p>
              {panel.housing.housed} housed / {panel.housing.beds} beds · upkeep{' '}
              {money(panel.housing.upkeep)}/day
              {panel.housing.plotIds.length ? ` · plots ${panel.housing.plotIds.join(', ')}` : ''}
            </p>
            <ul className="airlines">
              {panel.housing.offers.map((offer) => (
                <li key={offer.tier}>
                  <b>
                    {offer.name}{' '}
                    <span className="muted">{offer.built ? '· standing' : `· Field Level ${offer.fieldLevel}`}</span>
                  </b>
                  <span className="muted">{offer.blurb}</span>
                  <span className="muted">
                    {money(offer.cost)} build · {money(offer.upkeep)}/day · {offer.beds} beds · {offer.plots}{' '}
                    {offer.plots === 1 ? 'plot' : 'plots'}
                  </span>
                  {offer.built ? null : (
                    <button
                      type="button"
                      className="wide"
                      disabled={offer.locked}
                      title={offer.locked ? offer.reason : `Build ${offer.name}`}
                      data-testid={`build-${offer.tier}`}
                      onClick={() => game.buildStaffHousing(offer.tier as HousingTierId)}
                    >
                      {offer.locked ? offer.reason : `Build · ${money(offer.cost)}`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {allow('crew') && !focus ? (
        <button
          type="button"
          aria-expanded={open === 'crew'}
          data-testid="staff-crew"
          onClick={() => toggle('crew')}
        >
          Crew
          <span className="muted">{panel.crewSummary}</span>
        </button>
        ) : null}
        {show('crew') || focus === 'morale' ? (
          <div className="staff-detail" data-testid="staff-crew-detail">
            <p>
              Morale {panel.crew.moralePct}% · retention {panel.crew.retentionPct}% · hire −
              {panel.crew.hireOffPct}%
            </p>
            <p className="muted">
              {panel.crew.employed} on the roster · {panel.crew.commuters} still commute
              {panel.crew.shiftLate ? ' · this shift is running late' : ''}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
