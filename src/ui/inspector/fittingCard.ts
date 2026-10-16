import { FITTING_KINDS, fittingSpec } from '../../terminalbuild/fittings.ts'
import { fittingWorkStatus } from '../../terminalbuild/interior.ts'
import { STAGES } from '../../terminalbuild/stages.ts'
import type { Fitting, FittingKind } from '../../terminalbuild/types.ts'

export interface FittingMetric {
  queueLength: number
  avgWaitSec: number
  served: number
  serving: boolean
  serviceSec: number
}

export interface FittingCardModel {
  id: string
  kind: FittingKind
  name: string
  status: ReturnType<typeof fittingWorkStatus>
  queueNow: number
  avgWaitSec: number
  servedToday: number
  throughputPerMin: number
  capacityPerMin: number
  wear: number
  upkeepPerDay: number
  staff: string
  stage: string
  /** Passport booths only. */
  passportNote: string | null
  info: string[]
  actions: Array<'staff' | 'unstaff' | 'repair' | 'move' | 'sell'>
}

export interface FittingCardInput {
  fitting: Fitting
  metric?: FittingMetric | null
  info?: readonly string[]
  /** International arrivals due in the next hour. Passport booths only. */
  intlDue?: number
  connected?: boolean
  closed?: boolean
}

function stageLine(kind: FittingKind): string {
  const row = STAGES.find((stage) => stage.servedBy.includes(kind))
  if (!row) return fittingSpec(kind).stage
  return `${row.id} · ${row.flow}`
}

/** One card for one placed fitting. Pure: the same input always returns the same card. */
export function fittingCardModel(input: FittingCardInput): FittingCardModel {
  const spec = fittingSpec(input.fitting.kind)
  const metric = input.metric
  const serviceSec = metric?.serviceSec || spec.serviceSec
  const servers = Math.max(1, spec.servers)
  const capacity = serviceSec > 0 ? (servers * 60) / serviceSec : 0
  const throughput = metric?.serving && serviceSec > 0 ? 60 / serviceSec : 0
  const onDuty = input.fitting.staffed !== false
  const passport =
    input.fitting.kind === 'passport_booth'
      ? (input.intlDue ?? 0) > 0
        ? `${input.intlDue} international arrivals due in the next hour`
        : 'Idle: no international flights'
      : null
  return {
    id: input.fitting.id,
    kind: input.fitting.kind,
    name: spec.label,
    status: fittingWorkStatus(input.fitting, { connected: input.connected, closed: input.closed }),
    queueNow: metric?.queueLength ?? 0,
    avgWaitSec: metric?.avgWaitSec ?? 0,
    servedToday: metric?.served ?? 0,
    throughputPerMin: throughput,
    capacityPerMin: capacity,
    wear: input.fitting.wear,
    upkeepPerDay: spec.upkeep,
    staff: `${onDuty ? spec.staff : 0} / ${spec.staff}`,
    stage: stageLine(input.fitting.kind),
    passportNote: passport,
    info: [...(input.info ?? [])],
    actions: [onDuty && spec.staff > 0 ? 'unstaff' : 'staff', 'repair', 'move', 'sell'],
  }
}

/** Every catalog kind can build a card. A test fails when one cannot. */
export function cardForEveryKind(): FittingCardModel[] {
  return FITTING_KINDS.map((kind) =>
    fittingCardModel({
      fitting: { id: `card-${kind}`, kind, x: 0, y: 0, floor: 0, rot: 0, wear: 0, staffed: true },
      metric: { queueLength: 0, avgWaitSec: 0, served: 0, serving: false, serviceSec: fittingSpec(kind).serviceSec },
    }),
  )
}

export function fittingCardText(card: FittingCardModel): string {
  return [
    card.name,
    card.status,
    `Queue ${card.queueNow}`,
    `Wait ${Math.round(card.avgWaitSec)}s`,
    `Served ${card.servedToday}`,
    `${card.throughputPerMin.toFixed(1)} / ${card.capacityPerMin.toFixed(1)} per min`,
    `Wear ${Math.round(card.wear)}%`,
    `$${card.upkeepPerDay}/day`,
    card.staff,
    card.stage,
    card.passportNote ?? '',
    ...card.info,
  ].join('\n')
}
