import { useCallback, useSyncExternalStore } from 'react'
import type { Game } from '../../game/sim.ts'
import { subscribeTerminalVersion, terminalVersion } from '../../game/terminalVersion.ts'
import { fittingSpec } from '../../terminalbuild/fittings.ts'
import {
  fittingCardModel,
  fittingCardText,
  type FittingCardModel,
  type FittingMetric,
} from './fittingCard.ts'

const REFRESH_MS = 250

/** terminalVersion, held to 4 Hz so an open card does not repaint every sim tick. */
export function subscribeFittingCard(listener: () => void): () => void {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const fire = () => {
    last = Date.now()
    timer = null
    listener()
  }
  const onVersion = () => {
    const wait = REFRESH_MS - (Date.now() - last)
    if (wait <= 0) fire()
    else if (!timer) timer = setTimeout(fire, wait)
  }
  const off = subscribeTerminalVersion(onVersion)
  return () => {
    off()
    if (timer) clearTimeout(timer)
  }
}

let cachedKey = ''
let cachedText = ''

/** Live text for one fitting. Cached on the terminal version so React can subscribe. */
export function fittingSnapshot(game: Game, id: string): string {
  const key = `${id}@${terminalVersion()}`
  if (key === cachedKey) return cachedText
  const model = readFittingCard(game, id)
  cachedKey = key
  cachedText = model ? fittingCardText(model) : ''
  return cachedText
}

export function readFittingCard(game: Game, id: string): FittingCardModel | null {
  const layout = game.activeHall()?.layout
  const fitting = layout?.version === 2 ? layout.fittings?.find((row) => row.id === id) : undefined
  if (!fitting) return null
  const spec = fittingSpec(fitting.kind)
  const row = game.hallNav.live ? game.hallNav.metrics().find((metric) => metric.id === id) : undefined
  const metric: FittingMetric | null = row
    ? {
        queueLength: row.queueLength,
        avgWaitSec: row.avgWaitSec,
        served: row.served,
        serving: row.serving,
        serviceSec: row.serviceSec,
      }
    : null
  const info = game.facilityInfo(id)?.lines.filter((line) => line.length > 0) ?? []
  return fittingCardModel({
    fitting,
    metric,
    info,
    intlDue: fitting.kind === 'passport_booth' ? game.intlArrivalsDue() : 0,
    connected: !game.hallNav.live || spec.servers <= 0 || Boolean(row),
  })
}

const ACTION_LABEL: Record<FittingCardModel['actions'][number], string> = {
  staff: 'Staff',
  unstaff: 'Unstaff',
  repair: 'Repair',
  move: 'Move',
  sell: 'Sell',
}

export function FittingCardView({
  model,
  onAction,
}: {
  model: FittingCardModel
  onAction: (action: FittingCardModel['actions'][number]) => void
}) {
  return (
    <aside className="facility-card" data-testid="fitting-card" data-kind={model.kind} data-id={model.id} style={{ padding: 12, pointerEvents: 'auto', zIndex: 24 }}>
      <h2 data-testid="fitting-name">{model.name}</h2>
      <p className="mood" data-testid="fitting-status">
        {model.status}
      </p>
      <ul>
        <li data-testid="fitting-queue">Queue {model.queueNow}</li>
        <li data-testid="fitting-wait">Wait {Math.round(model.avgWaitSec)}s</li>
        <li data-testid="fitting-served">Served {model.servedToday}</li>
        <li data-testid="fitting-throughput">
          {model.throughputPerMin.toFixed(1)} / {model.capacityPerMin.toFixed(1)} per min
        </li>
        <li data-testid="fitting-wear">Wear {Math.round(model.wear)}%</li>
        <li data-testid="fitting-upkeep">${model.upkeepPerDay}/day</li>
        <li data-testid="fitting-staff">{model.staff}</li>
        <li data-testid="fitting-stage">{model.stage}</li>
        {model.passportNote ? <li data-testid="fitting-passport">{model.passportNote}</li> : null}
        {model.info.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="building-actions">
        {model.actions.map((action) => (
          <button key={action} type="button" data-testid={`fitting-action-${action}`} onClick={() => onAction(action)}>
            {ACTION_LABEL[action]}
          </button>
        ))}
      </div>
    </aside>
  )
}

/** Right-hand inspector for the selected fitting. Walker selection uses this same slot. */
export function FittingCard({ game, id }: { game: Game; id?: string | null }) {
  const facilityId = id === undefined ? game.selectedFacility : id
  const subscribe = useCallback((listener: () => void) => subscribeFittingCard(listener), [])
  const text = useSyncExternalStore(
    subscribe,
    () => (facilityId ? fittingSnapshot(game, facilityId) : ''),
    () => (facilityId ? fittingSnapshot(game, facilityId) : ''),
  )
  if (!facilityId || !text) return null
  const model = readFittingCard(game, facilityId)
  if (!model) return null
  return (
    <FittingCardView
      model={model}
      onAction={(action) => {
        if (action === 'staff') game.setFittingStaffed(model.id, true)
        else if (action === 'unstaff') game.setFittingStaffed(model.id, false)
        else if (action === 'repair') game.repairLayoutFitting(model.id)
        else if (action === 'move') game.beginFittingMove(model.id)
        else game.sellLayoutFitting(model.id)
      }}
    />
  )
}
