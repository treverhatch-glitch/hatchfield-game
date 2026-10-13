import { getUiState, setInfoView, type InfoViewId } from '../uiStore'

const VIEWS: { id: InfoViewId; label: string; legend: string; colors: string[] }[] = [
  {
    id: 'pax',
    label: 'Passenger flow',
    legend: 'Quiet → crowded',
    colors: ['#0ea5e9', '#22d3ee', '#fbbf24', '#f43f5e'],
  },
  {
    id: 'congestion',
    label: 'Congestion',
    legend: 'Clear → jammed',
    colors: ['#34d399', '#fbbf24', '#fb7185'],
  },
  {
    id: 'noise',
    label: 'Noise',
    legend: 'Low → high',
    colors: ['#64748b', '#a78bfa', '#7c3aed'],
  },
  {
    id: 'satisfaction',
    label: 'Satisfaction',
    legend: 'Unhappy → happy',
    colors: ['#fb7185', '#fbbf24', '#34d399'],
  },
  {
    id: 'power',
    label: 'Power',
    legend: 'Dark → supplied',
    colors: ['#334155', '#facc15'],
  },
  {
    id: 'wear',
    label: 'Maintenance',
    legend: 'Fresh → worn',
    colors: ['#34d399', '#f59e0b', '#b91c1c'],
  },
]

export function InfoViews() {
  if (getUiState().openPanel !== 'info') return null
  const current = getUiState().infoView
  const view = VIEWS.find((v) => v.id === current) ?? null
  return (
    <aside className="hf-legend" data-hud-part="legend" data-testid="info-views" aria-label="Info views">
      <h2>Info views</h2>
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={current === v.id ? 'on' : ''}
          aria-pressed={current === v.id}
          onClick={() => setInfoView(current === v.id ? null : v.id)}
        >
          {v.label}
        </button>
      ))}
      {view ? (
        <>
          <div className="hf-swatch" aria-hidden>
            {view.colors.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
          <p className="hf-muted">{view.legend}</p>
        </>
      ) : (
        <p className="hf-muted">Pick a view. Esc closes this list.</p>
      )}
    </aside>
  )
}
