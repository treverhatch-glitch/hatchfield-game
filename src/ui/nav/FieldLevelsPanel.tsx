import { fieldLevels, unlocksAtLevel } from './levelUnlocks.ts'

/** Progression list: every field level and the stamps and research nodes it opens. */
export function FieldLevelsPanel({
  level,
  focus,
}: {
  level: number
  focus: string | null
}) {
  return (
    <section data-testid="field-levels">
      <h3>Field Levels</h3>
      <p className="muted">
        Field level {level}. A level opens the stamps below and, where listed, a research node. The node
        tree itself is still the research desk.
      </p>
      <ol className="level-list">
        {fieldLevels().map((step) => {
          const rows = unlocksAtLevel(step)
          const anchor = `level-${step}`
          return (
            <li key={step} id={anchor} data-focus={focus === anchor ? 'true' : undefined} data-current={step === level ? 'true' : undefined}>
              <b>
                Field level {step}
                {step === level ? ' · current' : ''}
              </b>
              {rows.length === 0 ? (
                <span className="muted">No new stamp at this level.</span>
              ) : (
                <span className="muted">
                  {rows.map((row) => (row.kind === 'research' ? `Research: ${row.name}` : row.name)).join(' · ')}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
