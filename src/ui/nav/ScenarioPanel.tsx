import { scenarioById, scenarioDeadline, scenarioRuleLines, type ScenarioRun } from '../../scenarios/schedule.ts'
import { SCENARIOS } from '../../scenarios/templates.ts'

/** The slice of Game this sheet reads. It stays inside the Field Levels chrome. */
export interface ScenarioPanelGame {
  scenarioRun: ScenarioRun | null
  startScenario(id: string): boolean
}

/**
 * Opt-in scenario list. A new game does not start one.
 * The parent chrome is the side panel; this section does not cover the field.
 */
export function ScenarioPanel({ game }: { game: ScenarioPanelGame }) {
  const run = game.scenarioRun
  const active = run ? scenarioById(run.id) : null
  const running = run?.status === 'running'
  return (
    <section data-testid="scenario-panel">
      <h3>Scenarios</h3>
      <p className="muted">
        Optional. A new field stays a normal airport until you start one. One scenario at a time.
      </p>
      {run && active ? (
        <p data-testid="scenario-status">
          {active.name} · {run.status}
          {active.goal.kind === 'net_zero'
            ? ''
            : ` · ${run.progress} / ${active.goal.target}`}
          {running ? ` · window ends day ${scenarioDeadline(run, active.goal)}` : ''}
        </p>
      ) : (
        <p className="muted" data-testid="scenario-status">
          No scenario running.
        </p>
      )}
      <ul className="airlines">
        {SCENARIOS.map((scenario) => (
          <li key={scenario.id} data-testid={`scenario-${scenario.id}`}>
            <b>{scenario.name}</b>
            <span className="muted">{scenario.blurb}</span>
            {scenarioRuleLines(scenario).map((line) => (
              <span key={line} className="muted">
                {line}
              </span>
            ))}
            <button
              type="button"
              data-testid={`scenario-start-${scenario.id}`}
              disabled={running}
              onClick={() => game.startScenario(scenario.id)}
            >
              Start
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
