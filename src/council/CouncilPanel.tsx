import type { SeasonMissionBoard } from '../maps/index.ts'
import type { CouncilChoiceId, CouncilView } from './types.ts'

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function SeasonalMissions({ board }: { board: SeasonMissionBoard }) {
  return (
    <section data-testid="seasonal-missions">
      <h3>Seasonal missions</h3>
      <p className="muted">{board.seasonName}</p>
      {board.missions.length ? (
        <ul className="airlines">
          {board.missions.map((mission) => (
            <li key={mission.id} data-testid={`mission-${mission.id}`} data-done={mission.done ? '1' : '0'}>
              {mission.title} · {mission.value}/{mission.target}
              {mission.done ? ' · done' : ''}
              <span className="muted"> {mission.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No missions this season.</p>
      )}
      <p className="muted" data-testid="next-season">
        {board.nextLine}
      </p>
    </section>
  )
}

export function CouncilPanel({
  view,
  missions,
  onVote,
}: {
  view: CouncilView
  missions: SeasonMissionBoard
  onVote: (requestId: string, choiceId: CouncilChoiceId) => void
}) {
  if (!view.unlocked) {
    return (
      <section data-testid="council-panel">
        <h3>Airport Council</h3>
        <SeasonalMissions board={missions} />
        <p className="muted">
          Opens at Field Level {view.unlockFieldLevel}. Regional requests and public votes begin in normal late play.
        </p>
      </section>
    )
  }

  return (
    <section data-testid="council-panel">
      <SeasonalMissions board={missions} />
      <p className="muted">
        Standing {view.standing}/100 · airport prestige {view.prestige}. Standing and existing award prestige add to
        every vote; this does not spend or change field XP.
      </p>
      {view.pending ? (
        <article className="bid-card" data-testid="council-request">
          <h3>{view.pending.title}</h3>
          <p className="muted">
            {view.pending.sponsor} · opened day {view.pending.openedDay + 1} · needs {view.pending.threshold}% support
          </p>
          <p>{view.pending.request}</p>
          {view.pending.choices.map((choice) => (
            <div key={choice.id} className="dip-sub">
              <button
                type="button"
                className="wide"
                data-testid={`council-choice-${choice.id}`}
                disabled={!choice.affordable}
                onClick={() => onVote(view.pending!.id, choice.id)}
              >
                {choice.label}
                {choice.cost ? ` · ${money(choice.cost)}` : ' · no cash cost'} · {choice.projectedSupport}%{' '}
                {choice.projectedPass ? 'likely pass' : 'likely fall'}
              </button>
              <p className="muted">{choice.detail}</p>
            </div>
          ))}
        </article>
      ) : (
        <p className="muted">
          No request on the floor.
          {view.nextRequestInDays != null
            ? ` The next council sitting is in ${view.nextRequestInDays} day${view.nextRequestInDays === 1 ? '' : 's'}.`
            : ''}
        </p>
      )}
      <h3>Recorded votes</h3>
      {view.votes.length ? (
        <ul className="airlines">
          {view.votes.map((vote) => (
            <li key={`${vote.requestId}-${vote.day}`}>
              Day {vote.day + 1} · {vote.title} · {vote.choiceLabel} · {vote.support}% ·{' '}
              {vote.passed ? `passed · prestige +${vote.prestigeAwarded}` : 'fell'}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No votes recorded yet.</p>
      )}
    </section>
  )
}
