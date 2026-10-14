import type { ResearchId, StandClass, Tile, Vec } from '../game/types'
import { VEHICLE_CATALOG } from '../logistics/defaults'
import type { VehicleType } from '../logistics/types'
import {
  BAG_ORDER,
  BAG_SYSTEMS,
  BRIDGES_FOR,
  CARTS_PER_VEHICLE,
  DEPOT_GRANT,
  FUEL_CONTRACTS,
  GAME_MINUTES_PER_SECOND,
  HANGAR_OFFERS,
  HYDRANT_UPKEEP_PER_DAY,
  JUMBO_AIRFRAMES,
  LINK_OFFERS,
  LITRES_PER_LEGACY_LOAD,
  MOVE_SPEED,
  MOVE_STEP_COST,
  PAX_UNITS,
  SIZE_TIERS,
  SMALL_SERVICE_KIT,
  STAND_OFFERS,
  TANK_TIERS,
  TIER_FREE,
  TIER_RANK,
  VEHICLE_OFFERS,
  VEHICLE_TIER,
  WALK_METRES_PER_SEC,
  WIDE_AIRFRAMES,
} from './data'
import type {
  BagSystemId,
  FieldSnapshot,
  FuelTickResult,
  PaxUnit,
  PillarReport,
  PillarState,
  ScaleHint,
  SizeTier,
} from './types'

const WIDE_SET = new Set<string>(WIDE_AIRFRAMES)
const JUMBO_SET = new Set<string>(JUMBO_AIRFRAMES)

export function emptyPillar(): PillarState {
  return {
    contractId: null,
    tankTier: 1,
    litres: 0,
    supply: 'road',
    roadMinutes: 0,
    fleet: {},
    bagSystem: 'carts',
    desks: 2,
    kiosks: 0,
    bagDrops: 0,
    scannerLanes: 1,
    eGates: 0,
  }
}

export function sizeTierOf(airframeId: string): SizeTier {
  if (JUMBO_SET.has(airframeId)) return 'jumbo'
  if (WIDE_SET.has(airframeId)) return 'wide'
  return 'small'
}

export function tierOpen(airframeId: string, fieldLevel: number, research: ResearchId[]): boolean {
  const tier = SIZE_TIERS[sizeTierOf(airframeId)]
  if (fieldLevel < tier.fieldLevel) return false
  if (tier.research && !research.includes(tier.research)) return false
  return true
}

export function rankAtLeast(have: SizeTier, need: SizeTier): boolean {
  return TIER_RANK[have] >= TIER_RANK[need]
}

export function vehicleTier(type: VehicleType): SizeTier {
  return VEHICLE_TIER[type]
}

/** A big jet is served only by a vehicle of its tier or a larger one. */
export function vehicleCanServe(type: VehicleType, tier: SizeTier): boolean {
  if (TIER_FREE.includes(type)) return true
  return rankAtLeast(VEHICLE_TIER[type], tier)
}

export function contractById(id: string | null) {
  return FUEL_CONTRACTS.find((c) => c.id === id) ?? null
}

export function tankDef(tier: 1 | 2 | 3) {
  return TANK_TIERS.find((t) => t.tier === tier) ?? TANK_TIERS[0]
}

export function previewAirframe(tier: SizeTier): string {
  if (tier === 'jumbo') return 'a380'
  if (tier === 'wide') return 'b789'
  return 'b738'
}

function keyOf(c: number, r: number): string {
  return `${c},${r}`
}

function cellsOf(tiles: Tile[][], tile: Tile): Vec[] {
  const out: Vec[] = []
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      if (row[c] === tile) out.push({ c, r })
    }
  }
  return out
}

export function standRating(field: FieldSnapshot, stand: Vec): SizeTier {
  const key = keyOf(stand.c, stand.r)
  const marked = field.standScale[key]
  if (marked) return marked
  if (field.standClass[key] === 'L') return 'jumbo'
  return 'small'
}

export function hangarRating(field: FieldSnapshot, at: Vec): SizeTier {
  return field.hangarScale[keyOf(at.c, at.r)] ?? 'small'
}

function orthogonal(a: Vec, b: Vec): boolean {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1
}

function neighbors4(at: Vec, size: number): Vec[] {
  const out: Vec[] = []
  if (at.c > 0) out.push({ c: at.c - 1, r: at.r })
  if (at.c + 1 < size) out.push({ c: at.c + 1, r: at.r })
  if (at.r > 0) out.push({ c: at.c, r: at.r - 1 })
  if (at.r + 1 < size) out.push({ c: at.c, r: at.r + 1 })
  return out
}

function onEdge(at: Vec, size: number): boolean {
  return at.c === 0 || at.r === 0 || at.c === size - 1 || at.r === size - 1
}

export interface RailLink {
  unlocked: boolean
  hasLine: boolean
  hasStation: boolean
  stationOnLine: boolean
  reachesEdge: boolean
  touchesFarm: boolean
  flowing: boolean
}

/**
 * Buying the rail upgrade only unlocks the tool.
 * Fuel moves when a rail cell on the station's line touches the map edge
 * and the oil transfer station sits against the tank farm.
 */
export function railLink(field: FieldSnapshot, researchUnlocked: boolean): RailLink {
  const rails = cellsOf(field.tiles, 'fuel_rail')
  const stations = cellsOf(field.tiles, 'oil')
  const farms = cellsOf(field.tiles, 'fuel')
  const station = stations[0] ?? null
  const railKeys = new Set(rails.map((p) => keyOf(p.c, p.r)))
  const stationOnLine = Boolean(station && neighbors4(station, field.size).some((n) => railKeys.has(keyOf(n.c, n.r))))
  let reachesEdge = false
  if (station && stationOnLine) {
    const seen = new Set<string>()
    const queue = rails.filter((p) => orthogonal(p, station))
    for (const seed of queue) seen.add(keyOf(seed.c, seed.r))
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i]
      if (onEdge(cur, field.size)) reachesEdge = true
      for (const n of neighbors4(cur, field.size)) {
        const k = keyOf(n.c, n.r)
        if (!railKeys.has(k) || seen.has(k)) continue
        seen.add(k)
        queue.push(n)
      }
    }
  }
  const touchesFarm = Boolean(station && farms.some((f) => orthogonal(station, f)))
  const unlocked = researchUnlocked
  return {
    unlocked,
    hasLine: rails.length > 0,
    hasStation: Boolean(station),
    stationOnLine,
    reachesEdge,
    touchesFarm,
    flowing: unlocked && stationOnLine && reachesEdge && touchesFarm,
  }
}

function componentLinks(field: FieldSnapshot, tile: Tile, need: SizeTier): boolean {
  const nodes = cellsOf(field.tiles, tile)
  if (!nodes.length) return false
  const terminals = cellsOf(field.tiles, 'terminal')
  const stands = cellsOf(field.tiles, 'stand').filter((s) => rankAtLeast(standRating(field, s), need))
  if (!terminals.length || !stands.length) return false
  const keys = new Set(nodes.map((p) => keyOf(p.c, p.r)))
  const seen = new Set<string>()
  const groups: Vec[][] = []
  for (const start of nodes) {
    const sk = keyOf(start.c, start.r)
    if (seen.has(sk)) continue
    const group: Vec[] = []
    const q = [start]
    seen.add(sk)
    for (let i = 0; i < q.length; i++) {
      const cur = q[i]
      group.push(cur)
      for (const n of neighbors4(cur, field.size)) {
        const k = keyOf(n.c, n.r)
        if (!keys.has(k) || seen.has(k)) continue
        seen.add(k)
        q.push(n)
      }
    }
    groups.push(group)
  }
  return groups.some(
    (group) =>
      group.some((g) => terminals.some((t) => orthogonal(g, t))) &&
      group.some((g) => stands.some((s) => orthogonal(g, s))),
  )
}

export function travelatorLinked(field: FieldSnapshot, need: SizeTier): boolean {
  return componentLinks(field, 'travelator', need)
}

export function skywalkLinked(field: FieldSnapshot, need: SizeTier): boolean {
  return componentLinks(field, 'skywalk', need)
}

export function moverLinked(field: FieldSnapshot, need: SizeTier): boolean {
  return componentLinks(field, 'mover', need)
}

export function personSpeedMult(tile: string | null | undefined): number {
  if (tile === 'mover') return MOVE_SPEED.mover
  if (tile === 'travelator') return MOVE_SPEED.travelator
  if (tile === 'skywalk') return MOVE_SPEED.skywalk
  return MOVE_SPEED.walk
}

export function personStepCost(tile: string | null | undefined): number {
  if (tile === 'mover') return MOVE_STEP_COST.mover
  if (tile === 'travelator') return MOVE_STEP_COST.travelator
  if (tile === 'skywalk') return MOVE_STEP_COST.skywalk
  return 1
}

/** Minutes to walk `cells` at the given movement tile. */
export function walkMinutes(cells: number, mode: 'walk' | 'travelator' | 'skywalk' | 'mover'): number {
  const metres = Math.max(0, cells) * 22
  const speed = WALK_METRES_PER_SEC * MOVE_SPEED[mode]
  return metres / speed / 60
}

export function cartCount(fleet: Partial<Record<VehicleType, number>>): number {
  let n = 0
  for (const [type, count] of Object.entries(CARTS_PER_VEHICLE) as [VehicleType, number][]) {
    n += (fleet[type] ?? 0) * count
  }
  return n
}

function countOf(fleet: Partial<Record<VehicleType, number>>, type: VehicleType): number {
  return fleet[type] ?? 0
}

function addFleet(
  into: Partial<Record<VehicleType, number>>,
  grant: Partial<Record<VehicleType, number>>,
  times: number,
) {
  for (const [type, count] of Object.entries(grant) as [VehicleType, number][]) {
    into[type] = (into[type] ?? 0) + count * times
  }
}

/** Purchased heavies, plus the small kit a farm or depot already fields. */
export function operatingFleet(field: FieldSnapshot, state: PillarState): Partial<Record<VehicleType, number>> {
  const fleet: Partial<Record<VehicleType, number>> = { ...state.fleet }
  const depots = cellsOf(field.tiles, 'depot').length
  if (depots > 0) addFleet(fleet, DEPOT_GRANT, depots)
  else if (cellsOf(field.tiles, 'fuel').length > 0) addFleet(fleet, SMALL_SERVICE_KIT, 1)
  return fleet
}

function fuelRole(fleet: Partial<Record<VehicleType, number>>, tier: SizeTier): boolean {
  if (tier === 'jumbo') return countOf(fleet, 'hydrant_dispenser') > 0
  if (tier === 'wide') return countOf(fleet, 'heavy_fuel_truck') > 0 || countOf(fleet, 'hydrant_dispenser') > 0
  return countOf(fleet, 'fuel_truck') > 0 || countOf(fleet, 'heavy_fuel_truck') > 0 || countOf(fleet, 'hydrant_dispenser') > 0
}

function tugRole(fleet: Partial<Record<VehicleType, number>>, tier: SizeTier): boolean {
  if (tier === 'jumbo') return countOf(fleet, 'heavy_tug') > 0
  return countOf(fleet, 'pushback_tug') > 0 || countOf(fleet, 'heavy_tug') > 0
}

function cateringRole(fleet: Partial<Record<VehicleType, number>>, tier: SizeTier): boolean {
  if (tier === 'jumbo') return countOf(fleet, 'highlift_catering') > 0
  return countOf(fleet, 'catering_truck') > 0 || countOf(fleet, 'highlift_catering') > 0
}

function loaderRole(fleet: Partial<Record<VehicleType, number>>, tier: SizeTier): boolean {
  if (tier === 'jumbo') return countOf(fleet, 'main_deck_loader') > 0
  if (tier === 'wide') return countOf(fleet, 'uld_loader') > 0 || countOf(fleet, 'main_deck_loader') > 0
  return countOf(fleet, 'belt_loader') > 0 || countOf(fleet, 'uld_loader') > 0 || countOf(fleet, 'main_deck_loader') > 0
}

function bagRole(fleet: Partial<Record<VehicleType, number>>, tier: SizeTier): boolean {
  const carts = cartCount(fleet)
  if (carts < SIZE_TIERS[tier].bagCarts) return false
  if (tier === 'small') return countOf(fleet, 'baggage_tug') > 0 || countOf(fleet, 'heavy_baggage_tug') > 0
  return countOf(fleet, 'heavy_baggage_tug') > 0
}

export function checkinPerMin(state: PillarState): number {
  return state.desks * PAX_UNITS.desk.perMin + state.kiosks * PAX_UNITS.kiosk.perMin
}

export function securityPerMin(state: PillarState): number {
  return state.scannerLanes * PAX_UNITS.scanner.perMin + state.eGates * PAX_UNITS.egate.perMin
}

export function bagPerMin(state: PillarState): number {
  return BAG_SYSTEMS[state.bagSystem].bagsPerMin + state.bagDrops * PAX_UNITS.bagdrop.perMin
}

export function earlyBagStore(state: PillarState): number {
  return BAG_SYSTEMS[state.bagSystem].earlyStore
}

function jetwayBridges(field: FieldSnapshot, need: SizeTier): number {
  let best = 0
  for (const stand of cellsOf(field.tiles, 'stand')) {
    if (field.standAccess[keyOf(stand.c, stand.r)] !== 'jetway') continue
    const rating = standRating(field, stand)
    if (!rankAtLeast(rating, need)) continue
    best = Math.max(best, BRIDGES_FOR[rating])
  }
  return best
}

function bestHangar(field: FieldSnapshot): SizeTier | null {
  const hangars = cellsOf(field.tiles, 'hangar')
  if (!hangars.length) return null
  let best: SizeTier = 'small'
  for (const h of hangars) {
    const rating = hangarRating(field, h)
    if (TIER_RANK[rating] > TIER_RANK[best]) best = rating
  }
  return best
}

function activeContract(field: FieldSnapshot, state: PillarState) {
  return contractById(state.contractId) ?? (field.legacyFuel ? FUEL_CONTRACTS[0] : null)
}

function hint(id: string, title: string, detail: string, fix: string): ScaleHint {
  return { id, title, detail, fix }
}

export function railHints(field: FieldSnapshot): ScaleHint[] {
  const unlocked = field.research.includes('rail_fuel')
  const link = railLink(field, unlocked)
  const relevant = unlocked || link.hasLine || link.hasStation
  if (!relevant) return []
  const out: ScaleHint[] = []
  if (!unlocked) {
    out.push(
      hint(
        'rail-locked',
        'Fuel rail is locked',
        'The line and the oil station are on the map, but the rail supply upgrade is not bought.',
        'Research Fuel rail. Buying it only unlocks the tools — it does not start the trains.',
      ),
    )
  }
  if (!link.hasLine) {
    out.push(
      hint(
        'rail-line',
        'No fuel rail',
        'Rail supply stays empty until a line is painted.',
        'Place fuel rail from the oil station out to the map edge.',
      ),
    )
  }
  if (!link.hasStation) {
    out.push(
      hint(
        'rail-station',
        'No oil transfer station',
        'A rail line does not unload itself.',
        'Build an Oil Transfer Station on the fuel rail, beside the tank farm.',
      ),
    )
  }
  if (link.hasStation && link.hasLine && !link.stationOnLine) {
    out.push(
      hint(
        'rail-join',
        'Oil station is off the rail',
        'The transfer station is not touching the fuel rail, so trains cannot unload.',
        'Move the station onto the rail line, or extend the rail to the station.',
      ),
    )
  }
  if (link.hasLine && link.stationOnLine && !link.reachesEdge) {
    out.push(
      hint(
        'rail-edge',
        'Fuel rail stops short of the map edge',
        'The line does not reach the boundary, so no train can arrive.',
        'Extend the fuel rail until a cell sits on the map edge.',
      ),
    )
  }
  if (link.hasStation && !link.touchesFarm) {
    out.push(
      hint(
        'rail-farm',
        'Oil station is not on the tank farm',
        'Unloaded fuel has nowhere to go until the station touches a fuel farm.',
        'Place the Oil Transfer Station beside the fuel farm.',
      ),
    )
  }
  return out
}

/** Why this airframe cannot turn here. Empty when the whole pillar matches. */
export function pillarReport(field: FieldSnapshot, state: PillarState, airframeId: string): PillarReport {
  const tier = sizeTierOf(airframeId)
  const demand = SIZE_TIERS[tier]
  const fleet = operatingFleet(field, state)
  const hints: ScaleHint[] = []
  if (field.fieldLevel < demand.fieldLevel) {
    hints.push(
      hint(
        `level-${tier}`,
        `${demand.label} metal is locked`,
        `${demand.label} aircraft open at Field level ${demand.fieldLevel}.`,
        `Reach Field level ${demand.fieldLevel}.`,
      ),
    )
  }
  if (demand.research && !field.research.includes(demand.research)) {
    hints.push(
      hint(
        `research-${tier}`,
        `${demand.label} research missing`,
        `${demand.label} flights stay off the strip until that project is bought.`,
        `Research the ${demand.label.toLowerCase()} project.`,
      ),
    )
  }
  if (jetwayBridges(field, tier) < demand.bridges) {
    hints.push(
      hint(
        `stand-${tier}`,
        `No ${demand.label.toLowerCase()} gate`,
        `This aircraft needs a jetway stand rated ${demand.label.toLowerCase()} or higher, with ${demand.bridges} bridge${demand.bridges === 1 ? '' : 's'}.`,
        tier === 'jumbo'
          ? 'Stamp a jumbo stand with a jetway after Heavy metal pack.'
          : tier === 'wide'
            ? 'Stamp a widebody stand with a jetway.'
            : 'Stamp a jetway stand.',
      ),
    )
  }
  if (tier !== 'small') {
    const hangar = bestHangar(field)
    if (!hangar || !rankAtLeast(hangar, tier)) {
      hints.push(
        hint(
          `hangar-${tier}`,
          `Hangar is too small`,
          `${demand.label} line maintenance needs a ${demand.label.toLowerCase()} hangar.`,
          `Build a ${HANGAR_OFFERS[tier].name.toLowerCase()}.`,
        ),
      )
    }
  }
  if (!fuelRole(fleet, tier)) {
    hints.push(
      hint(
        `fuel-truck-${tier}`,
        `Fuel vehicles are too small`,
        tier === 'jumbo'
          ? 'A jumbo can only be fuelled by a hydrant dispenser.'
          : tier === 'wide'
            ? 'A widebody can only be fuelled by a heavy fuel truck or a hydrant dispenser.'
            : 'No fuel truck is on the fleet.',
        tier === 'jumbo' ? 'Buy a hydrant dispenser.' : 'Buy a heavy fuel truck or a hydrant dispenser.',
      ),
    )
  }
  if (!tugRole(fleet, tier)) {
    hints.push(
      hint(
        `tug-${tier}`,
        `Tug is too small`,
        tier === 'jumbo' ? 'A jumbo needs a heavy towbarless tug.' : 'No pushback tug is on the fleet.',
        tier === 'jumbo' ? 'Buy a heavy tug.' : 'Buy a pushback tug.',
      ),
    )
  }
  if (!cateringRole(fleet, tier)) {
    hints.push(
      hint(
        `cater-${tier}`,
        `Catering truck is too small`,
        tier === 'jumbo' ? 'The upper deck needs a high-lift catering truck.' : 'No catering truck is on the fleet.',
        tier === 'jumbo' ? 'Buy a high-lift catering truck.' : 'Buy a catering truck.',
      ),
    )
  }
  if (!bagRole(fleet, tier)) {
    hints.push(
      hint(
        `carts-${tier}`,
        `Bag carts are too small`,
        `${demand.label} flights need ${demand.bagCarts} carts on a tug of this tier or higher.`,
        tier === 'small' ? 'Add a baggage tug.' : 'Buy another heavy baggage tug.',
      ),
    )
  }
  if (!loaderRole(fleet, tier)) {
    hints.push(
      hint(
        `loader-${tier}`,
        `Loader is too small`,
        tier === 'jumbo'
          ? 'A jumbo hold needs a main-deck loader.'
          : tier === 'wide'
            ? 'A widebody hold needs a container loader.'
            : 'No belt loader is on the fleet.',
        tier === 'jumbo' ? 'Buy a main-deck loader.' : tier === 'wide' ? 'Buy a ULD loader.' : 'Buy a belt loader.',
      ),
    )
  }
  const contract = activeContract(field, state)
  if (!contract || !rankAtLeast(contract.tier, tier)) {
    hints.push(
      hint(
        `contract-${tier}`,
        `Fuel contract is too small`,
        `${demand.label} uplift needs a ${demand.label.toLowerCase()} supplier contract or larger.`,
        `Sign a ${demand.label.toLowerCase()} fuel contract.`,
      ),
    )
  }
  const tank = tankDef(state.tankTier)
  const farm = cellsOf(field.tiles, 'fuel').length > 0
  if (!farm || tank.capacityLitres < demand.fuelLitres) {
    hints.push(
      hint(
        `tank-${tier}`,
        `Tank farm is too small`,
        `${demand.label} uplift is ${demand.fuelLitres.toLocaleString('en-US')} L. The farm holds ${farm ? tank.capacityLitres.toLocaleString('en-US') : '0'} L.`,
        farm ? 'Upgrade the tank farm.' : 'Build a fuel farm, then upgrade the tanks.',
      ),
    )
  }
  if (demand.hydrant && !field.research.includes('hydrant_fuel')) {
    hints.push(
      hint(
        'hydrant',
        'Hydrant system missing',
        'Jumbo fuel is pumped from the farm through hydrant pits, not a bowser.',
        'Research the hydrant system.',
      ),
    )
  }
  if (demand.supply === 'rail') {
    const link = railLink(field, field.research.includes('rail_fuel'))
    if (!link.flowing) {
      hints.push(
        hint(
          'rail-flow',
          'Rail fuel is not flowing',
          'A jumbo contract does not arrive by road. The rail upgrade, the line to the map edge, and the oil station on the farm all have to be in place.',
          'Research Fuel rail, lay the line to the map edge, and build the Oil Transfer Station beside the farm.',
        ),
      )
    }
  }
  const bags = BAG_SYSTEMS[state.bagSystem]
  if (!rankAtLeast(bags.tier, tier) || bagPerMin(state) < demand.bagsPerMin) {
    hints.push(
      hint(
        `bags-${tier}`,
        `Baggage system is too small`,
        `${demand.label} turns need ${demand.bagsPerMin} bags a minute. This hall does ${bagPerMin(state)}.`,
        tier === 'jumbo'
          ? 'Upgrade to the automated baggage system with early-bag storage.'
          : 'Add belts and a sorter, or more bag-drop positions.',
      ),
    )
  }
  if (tier === 'jumbo' && earlyBagStore(state) < demand.fuelLitres / 400) {
    hints.push(
      hint(
        'early-bags',
        'No early-bag storage',
        'A jumbo bank drops bags before the outbound flight is on the gate. Manual carts cannot hold them.',
        'Upgrade to the automated baggage system.',
      ),
    )
  }
  if (checkinPerMin(state) < demand.paxPerMin) {
    hints.push(
      hint(
        `checkin-${tier}`,
        `Check-in is too small`,
        `${demand.label} needs ${demand.paxPerMin} passengers a minute at check-in. Desks and kiosks clear ${checkinPerMin(state)}.`,
        'Add check-in desks, kiosks, or bag drop.',
      ),
    )
  }
  if (securityPerMin(state) < demand.paxPerMin) {
    hints.push(
      hint(
        `security-${tier}`,
        `Security is too small`,
        `${demand.label} needs ${demand.paxPerMin} passengers a minute through security. Lanes clear ${securityPerMin(state)}.`,
        tier === 'jumbo' ? 'Add scanner lanes or e-gates.' : 'Add a scanner lane.',
      ),
    )
  }
  if (tier !== 'small') {
    if (!travelatorLinked(field, tier)) {
      hints.push(
        hint(
          'travelator',
          'No travelator to the gate',
          'Widebody passengers need a moving walkway between the terminal and the stand. People on it move faster.',
          'Place travelator tiles from the terminal to a widebody stand.',
        ),
      )
    }
    if (!skywalkLinked(field, tier)) {
      hints.push(
        hint(
          'skywalk',
          'No skywalk to the pier',
          'The pier is not bridged to the terminal, so the widebody gate is a dead walk.',
          'Place a skywalk from the terminal to the pier stand.',
        ),
      )
    }
  }
  if (tier === 'jumbo' && !moverLinked(field, tier)) {
    hints.push(
      hint(
        'mover',
        'No people mover',
        'A jumbo pier is too far to walk. The automated people mover has to join the terminal to the jumbo stand.',
        'Place people-mover tiles from the terminal to a jumbo stand.',
      ),
    )
  }
  return { ok: hints.length === 0, tier, hints }
}

/** Advisor notes for the next tier the field can see, plus any broken rail chain. */
export function scaleAdvice(field: FieldSnapshot, state: PillarState): ScaleHint[] {
  const out: ScaleHint[] = []
  const seen = new Set<string>()
  const push = (list: ScaleHint[]) => {
    for (const h of list) {
      if (seen.has(h.id)) continue
      seen.add(h.id)
      out.push(h)
    }
  }
  push(railHints(field))
  if (field.fieldLevel >= SIZE_TIERS.wide.fieldLevel) {
    const wide = pillarReport(field, state, SIZE_TIERS.wide.example)
    if (!wide.ok) push(wide.hints)
  }
  if (field.fieldLevel >= SIZE_TIERS.jumbo.fieldLevel) {
    const jumbo = pillarReport(field, state, SIZE_TIERS.jumbo.example)
    if (!jumbo.ok) push(jumbo.hints)
  }
  return out
}

export function placementBlock(
  tool: string,
  fieldLevel: number,
  research: ResearchId[],
): string | null {
  const table: Record<string, { fieldLevel: number; research: ResearchId | null; name: string }> = {
    stand_w: { fieldLevel: STAND_OFFERS.wide.fieldLevel, research: null, name: STAND_OFFERS.wide.name },
    stand_l: { fieldLevel: STAND_OFFERS.jumbo.fieldLevel, research: null, name: 'Jumbo stand' },
    hangar_w: { fieldLevel: HANGAR_OFFERS.wide.fieldLevel, research: null, name: HANGAR_OFFERS.wide.name },
    hangar_j: { fieldLevel: HANGAR_OFFERS.jumbo.fieldLevel, research: null, name: HANGAR_OFFERS.jumbo.name },
    fuel_rail: { fieldLevel: LINK_OFFERS.fuel_rail.fieldLevel, research: null, name: LINK_OFFERS.fuel_rail.name },
    oil: { fieldLevel: LINK_OFFERS.oil.fieldLevel, research: null, name: LINK_OFFERS.oil.name },
    travelator: { fieldLevel: LINK_OFFERS.travelator.fieldLevel, research: null, name: LINK_OFFERS.travelator.name },
    skywalk: { fieldLevel: LINK_OFFERS.skywalk.fieldLevel, research: null, name: LINK_OFFERS.skywalk.name },
    mover: { fieldLevel: LINK_OFFERS.mover.fieldLevel, research: null, name: LINK_OFFERS.mover.name },
  }
  const rule = table[tool]
  if (!rule) return null
  if (fieldLevel < rule.fieldLevel) return `${rule.name} needs Field level ${rule.fieldLevel}.`
  if (rule.research && !research.includes(rule.research)) return `${rule.name} is still locked in research.`
  return null
}

export function offerFor(type: VehicleType) {
  return VEHICLE_OFFERS.find((o) => o.type === type) ?? null
}

export function canBuyVehicle(
  type: VehicleType,
  fieldLevel: number,
  research: ResearchId[],
): { ok: boolean; why: string; cost: number } {
  const offer = offerFor(type)
  const cost = VEHICLE_CATALOG[type].cost
  if (!offer) return { ok: false, why: 'That vehicle is part of the starter depot.', cost }
  if (fieldLevel < offer.fieldLevel) return { ok: false, why: `Needs Field level ${offer.fieldLevel}.`, cost }
  if (offer.research && !research.includes(offer.research)) return { ok: false, why: 'Research it first.', cost }
  return { ok: true, why: '', cost }
}

export function nextBagSystem(current: BagSystemId): BagSystemId | null {
  const i = BAG_ORDER.indexOf(current)
  return BAG_ORDER[i + 1] ?? null
}

export function canUpgradeBags(
  current: BagSystemId,
  fieldLevel: number,
  research: ResearchId[],
): { ok: boolean; why: string; next: BagSystemId | null; cost: number } {
  const next = nextBagSystem(current)
  if (!next) return { ok: false, why: 'Baggage system is already fully automated.', next: null, cost: 0 }
  const def = BAG_SYSTEMS[next]
  if (fieldLevel < def.fieldLevel) return { ok: false, why: `Needs Field level ${def.fieldLevel}.`, next, cost: def.cost }
  if (def.research && !research.includes(def.research)) return { ok: false, why: 'Research it first.', next, cost: def.cost }
  return { ok: true, why: '', next, cost: def.cost }
}

export function canBuyPax(
  unit: PaxUnit,
  fieldLevel: number,
  research: ResearchId[],
): { ok: boolean; why: string; cost: number } {
  const def = PAX_UNITS[unit]
  if (fieldLevel < def.fieldLevel) return { ok: false, why: `Needs Field level ${def.fieldLevel}.`, cost: def.cost }
  if (def.research && !research.includes(def.research)) return { ok: false, why: 'Research it first.', cost: def.cost }
  return { ok: true, why: '', cost: def.cost }
}

export function canSignContract(
  id: string,
  fieldLevel: number,
  research: ResearchId[],
): { ok: boolean; why: string; cost: number } {
  const def = contractById(id)
  if (!def) return { ok: false, why: 'Unknown fuel contract.', cost: 0 }
  if (fieldLevel < def.fieldLevel) return { ok: false, why: `Needs Field level ${def.fieldLevel}.`, cost: def.sign }
  if (def.research && !research.includes(def.research)) return { ok: false, why: 'Research it first.', cost: def.sign }
  return { ok: true, why: '', cost: def.sign }
}

export function canUpgradeTank(
  current: 1 | 2 | 3,
  fieldLevel: number,
  research: ResearchId[],
): { ok: boolean; why: string; next: 1 | 2 | 3 | null; cost: number } {
  if (current >= 3) return { ok: false, why: 'Tank farm is already at full size.', next: null, cost: 0 }
  const next = (current + 1) as 2 | 3
  const def = tankDef(next)
  if (fieldLevel < def.fieldLevel) return { ok: false, why: `Needs Field level ${def.fieldLevel}.`, next, cost: def.cost }
  if (def.research && !research.includes(def.research)) return { ok: false, why: 'Research it first.', next, cost: def.cost }
  return { ok: true, why: '', next, cost: def.cost }
}

export interface UpkeepCounts {
  fuelFarms: number
  hangars: Record<SizeTier, number>
  fuelRail: number
  oil: number
  travelator: number
  skywalk: number
  mover: number
  wideStands: number
  jumboStands: number
  hydrant: boolean
}

export function pillarUpkeep(state: PillarState, counts: UpkeepCounts): number {
  let n = 0
  if (counts.fuelFarms > 0) n += tankDef(state.tankTier).upkeepPerDay
  const contract = contractById(state.contractId)
  if (contract) n += contract.upkeepPerDay
  if (counts.hydrant) n += HYDRANT_UPKEEP_PER_DAY
  n += BAG_SYSTEMS[state.bagSystem].upkeepPerDay
  n += state.desks * PAX_UNITS.desk.upkeepPerDay
  n += state.kiosks * PAX_UNITS.kiosk.upkeepPerDay
  n += state.bagDrops * PAX_UNITS.bagdrop.upkeepPerDay
  n += state.scannerLanes * PAX_UNITS.scanner.upkeepPerDay
  n += state.eGates * PAX_UNITS.egate.upkeepPerDay
  n += counts.hangars.small * HANGAR_OFFERS.small.upkeepPerDay
  n += counts.hangars.wide * HANGAR_OFFERS.wide.upkeepPerDay
  n += counts.hangars.jumbo * HANGAR_OFFERS.jumbo.upkeepPerDay
  n += counts.wideStands * STAND_OFFERS.wide.upkeepPerDay
  n += counts.jumboStands * STAND_OFFERS.jumbo.upkeepPerDay
  n += counts.fuelRail * LINK_OFFERS.fuel_rail.upkeepPerDay
  n += counts.oil * LINK_OFFERS.oil.upkeepPerDay
  n += counts.travelator * LINK_OFFERS.travelator.upkeepPerDay
  n += counts.skywalk * LINK_OFFERS.skywalk.upkeepPerDay
  n += counts.mover * LINK_OFFERS.mover.upkeepPerDay
  for (const offer of VEHICLE_OFFERS) {
    n += (state.fleet[offer.type] ?? 0) * Math.round(VEHICLE_CATALOG[offer.type].cost / 200)
  }
  return n
}

/**
 * One delivery step. Road tankers roll on a lead time.
 * Rail litres move only while the line, the station, and the farm are connected.
 * Hydrant is distribution, so it never fills the tank by itself.
 */
export function tickFuel(
  field: FieldSnapshot,
  state: PillarState,
  gameMinutes: number,
  cash: number,
): FuelTickResult {
  const none: FuelTickResult = { delivered: 0, paid: 0, method: 'none', railFlowing: false, waitingOnCash: false }
  if (cellsOf(field.tiles, 'fuel').length === 0) return none
  const contract = activeContract(field, state)
  if (!contract || gameMinutes <= 0) return none
  const capacity = tankDef(state.tankTier).capacityLitres
  const room = Math.max(0, capacity - state.litres)
  if (room <= 0) return none
  if (state.supply === 'rail') {
    const link = railLink(field, field.research.includes('rail_fuel'))
    if (!link.flowing) return { ...none, method: 'rail' }
    const litres = Math.min(room, (contract.railLitresPerHour * gameMinutes) / 60)
    const paid = litres * contract.wholesalePerLitre
    if (paid > cash + 1e-6) return { ...none, method: 'rail', waitingOnCash: true }
    state.litres += litres
    return { delivered: litres, paid, method: 'rail', railFlowing: true, waitingOnCash: false }
  }
  state.roadMinutes += gameMinutes
  if (state.roadMinutes + 1e-6 < contract.leadMinutes) return { ...none, method: 'road' }
  const litres = Math.min(room, contract.tankerLitres)
  const paid = litres * contract.wholesalePerLitre
  if (paid > cash + 1e-6) return { ...none, method: 'road', waitingOnCash: true }
  state.roadMinutes = 0
  state.litres += litres
  return { delivered: litres, paid, method: 'road', railFlowing: false, waitingOnCash: false }
}

export function seedLitresFromLoads(loads: number): number {
  return Math.max(0, loads) * LITRES_PER_LEGACY_LOAD
}

export function loadsFromLitres(litres: number): number {
  if (litres <= 0) return 0
  return Math.max(1, Math.round(litres / LITRES_PER_LEGACY_LOAD))
}

export function standClassForTool(tool: string): StandClass | null {
  if (tool === 'stand_s') return 'S'
  if (tool === 'stand') return 'M'
  if (tool === 'stand_w' || tool === 'stand_l') return 'L'
  return null
}

export function standScaleForTool(tool: string, jumboUnlocked: boolean): SizeTier | null {
  if (tool === 'stand_s' || tool === 'stand') return 'small'
  if (tool === 'stand_w') return 'wide'
  if (tool === 'stand_l') return jumboUnlocked ? 'jumbo' : 'wide'
  return null
}

export function hangarScaleForTool(tool: string): SizeTier | null {
  if (tool === 'hangar') return 'small'
  if (tool === 'hangar_w') return 'wide'
  if (tool === 'hangar_j') return 'jumbo'
  return null
}

/** Minutes of game time in a real-time step. */
export function gameMinutes(stepSeconds: number): number {
  return stepSeconds * GAME_MINUTES_PER_SECOND
}

export { GAME_MINUTES_PER_SECOND }
