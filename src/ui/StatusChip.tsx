import { statusChipTarget, type StatusChipTarget, type StatusPhrase } from './statusChip.ts'

export function StatusChip({
  phrases,
  dockHasRows,
  onAct,
}: {
  phrases: StatusPhrase[]
  dockHasRows: boolean
  onAct: (target: StatusChipTarget) => void
}) {
  const label = phrases.length ? phrases.slice(0, 2).map((phrase) => phrase.text).join(' · ') : 'No alerts'
  const title = phrases.length ? phrases.map((phrase) => phrase.text).join(' · ') : 'No alerts'
  const target = statusChipTarget(phrases, dockHasRows)
  if (!target) {
    return (
      <div className={`stat${phrases.length ? ' alert' : ''}`} data-testid="status-chip" title={title}>
        {label}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`stat${phrases.length ? ' alert' : ''}`}
      data-testid="status-chip"
      data-opens={target.kind === 'letter' ? target.id : 'dock'}
      title={title}
      onClick={() => onAct(target)}
    >
      {label}
    </button>
  )
}
