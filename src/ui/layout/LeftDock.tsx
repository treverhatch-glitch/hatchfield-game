import type { ReactNode } from 'react'

export type DockTab = 'phone' | 'airlines' | 'timetable' | 'building'

const TABS: { id: DockTab; label: string }[] = [
  { id: 'phone', label: 'Phone' },
  { id: 'airlines', label: 'Airlines' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'building', label: 'Building' },
]

/**
 * Bottom-left dock. One tab is open. The others are the queue, so the phone
 * cannot cover the timetable or the hall cards.
 */
export function LeftDock({
  tab,
  onTab,
  phone,
  airlines,
  building,
  goals,
  queued,
}: {
  tab: DockTab
  onTab: (tab: DockTab) => void
  phone: ReactNode
  airlines: ReactNode
  building: ReactNode
  /** Field goals. Shown above the closed phone and under the timetable note. */
  goals?: ReactNode
  queued?: string | null
}) {
  return (
    <div className="left-dock" data-testid="left-dock" data-hud-panel="dock" data-tab={tab}>
      <div className="left-dock-body">
        {tab === 'timetable' ? (
          <p className="left-dock-note" data-testid="timetable-dock-note">
            The timetable is open above the build bar.
          </p>
        ) : null}
        {goals && tab !== 'building' ? <div className="left-dock-goals">{goals}</div> : null}
        {tab === 'airlines' ? <div className="left-dock-relations">{airlines}</div> : null}
        {tab === 'building' ? building : null}
        {tab === 'phone' || tab === 'airlines' ? <div className="left-dock-pane left-dock-phone">{phone}</div> : null}
      </div>
      {queued ? (
        <p className="left-dock-note" data-testid="dock-queue">
          {queued}
        </p>
      ) : null}
      <div className="left-dock-tabs" role="tablist" aria-label="Bottom left">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'on' : ''}
            data-testid={`dock-tab-${item.id}`}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
