import type { BuildCategory } from '../uiStore'
import { getUiState, selectAsset, toggleMenu, togglePanel } from '../uiStore'
import { Icon } from './icons'

const BUILD: { id: BuildCategory; label: string; key: string; tone: string }[] = [
  { id: 'pavement', label: 'Pavement', key: 'R', tone: 'pavement' },
  { id: 'stands', label: 'Stands', key: 'S', tone: 'stands' },
  { id: 'terminal', label: 'Terminal', key: 'T', tone: 'terminal' },
  { id: 'ops', label: 'Ops', key: 'O', tone: 'ops' },
  { id: 'landside', label: 'Landside', key: 'L', tone: 'landside' },
]

const MANAGE: { id: 'services' | 'airlines' | 'planner'; label: string; key: string; test: string }[] = [
  { id: 'services', label: 'Services', key: 'G', test: 'tab-services' },
  { id: 'airlines', label: 'Airlines', key: 'A', test: 'tab-airlines' },
  { id: 'planner', label: 'Planner', key: 'P', test: 'tab-planner' },
]

export function CategoryBar({
  onTool,
}: {
  onTool: (tool: 'clear' | 'pan') => void
}) {
  const menu = getUiState().openMenu
  const panel = getUiState().openPanel
  const tool = getUiState().tool

  return (
    <div className="hf-dock" data-hud-part="bar">
      <div className="hf-bar" role="toolbar" aria-label="Build and manage">
        {BUILD.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`hf-cat tone-${c.tone}${menu === c.id ? ' on' : ''}`}
            aria-label={c.label}
            aria-pressed={menu === c.id}
            aria-keyshortcuts={c.key}
            title={`${c.label} (${c.key})`}
            onClick={() => toggleMenu(c.id)}
          >
            <Icon name={c.id} />
            <span className="hf-cat-label">
              {c.label} {c.key}
            </span>
          </button>
        ))}
        <span className="hf-divider" />
        {MANAGE.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`hf-cat tone-manage${panel === c.id ? ' on' : ''}`}
            aria-label={c.label}
            aria-pressed={panel === c.id}
            data-testid={c.test}
            title={`${c.label} (${c.key})`}
            onClick={() => togglePanel(c.id)}
          >
            <Icon name={c.id} />
            <span className="hf-cat-label">
              {c.label} {c.key}
            </span>
          </button>
        ))}
        <span className="hf-divider" />
        <button
          type="button"
          className={`hf-cat tone-info${panel === 'info' ? ' on' : ''}`}
          aria-label="Info views"
          aria-pressed={panel === 'info'}
          title="Info views (I)"
          onClick={() => togglePanel('info')}
        >
          <Icon name="info" />
          <span className="hf-cat-label">Info views I</span>
        </button>
        <button
          type="button"
          className={`hf-cat tone-bulldoze${tool === 'clear' ? ' on' : ''}`}
          aria-label="Bulldoze"
          aria-pressed={tool === 'clear'}
          title="Bulldoze (B)"
          onClick={() => {
            selectAsset('clear', 'clear')
            onTool('clear')
          }}
        >
          <Icon name="bulldoze" />
          <span className="hf-cat-label">Bulldoze B</span>
        </button>
      </div>
    </div>
  )
}
