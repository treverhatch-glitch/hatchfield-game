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
  queued,
}: {
  tab: DockTab
  onTab: (tab: DockTab) => void
  phone: ReactNode
  airlines: ReactNode
  building: ReactNode
  queued?: string | null
}) {
  return (
    <div className="left-dock" data-testid="left-dock" data-hud-panel="dock" data-tab={tab}>
      <div className="left-dock-body">
        <div className="left-dock-pane" hidden={tab !== 'phone'}>{phone}</div>
        {tab === 'airlines' ? airlines : null}
        {tab === 'timetable' ? (
          <p className="left-dock-note" data-testid="timetable-dock-note">
            The timetable is open above the build bar.
          </p>
        ) : null}
        {tab === 'building' ? building : null}
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
