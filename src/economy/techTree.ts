import type { TechBranch, TechBranchId, TechNode, TechTier } from './types'

export const TECH_TIER_COST: Readonly<Record<TechTier, number>> = { 1: 1, 2: 2, 3: 4, 4: 8 }
export const TECH_TIER_FIELD_LEVEL: Readonly<Record<TechTier, number>> = { 1: 1, 2: 3, 3: 5, 4: 8 }

type NodeSeed = readonly [name: string, description: string, modifiers: Readonly<Record<string, number>>]

const SEEDS: Readonly<Record<TechBranchId, readonly [NodeSeed, NodeSeed, NodeSeed, NodeSeed]>> = {
  terminal_ops: [
    ['Self-Service Kiosks', 'Check-in throughput +30%.', { 'terminal.checkinSpeed': 1.3 }],
    ['Bag-Drop Automation', 'Automates bag acceptance and releases terminal staff.', { 'terminal.bagDropSpeed': 1.35 }],
    ['Biometric Boarding', 'Faster gate processing.', { 'terminal.boardingSpeed': 1.4 }],
    ['Smart Terminal', 'Dynamic staffing reduces peak queue pressure.', { 'staff.dynamicAllocation': 1, 'terminal.peakCapacity': 1.25 }],
  ],
  airside_ops: [
    ['Stand Planning', 'Unlocks automatic stand allocation.', { 'airside.autoStandAllocation': 1 }],
    ['Jet Bridges', 'Unlocks powered jet bridges.', { 'airside.jetBridges': 1 }],
    ['Apron Expansion', 'Unlocks wide-body stands.', { 'airside.widebodyStands': 1 }],
    ['A-CDM', 'Collaborative decisions reduce operational delays.', { 'failure.delayMultiplier': 0.75 }],
  ],
  ground_logistics: [
    ['Vehicle Bays & Faster Belts', 'Adds GSE capacity and speeds the first baggage link.', { 'ground.vehicleCapacity': 1.2, 'baggage.beltSpeed': 1.2 }],
    ['Hydrant & Tilt-Tray Systems', 'Unlocks hydrant fuel and higher-capacity bag sorting.', { 'fuel.hydrant': 1, 'baggage.sorterSpeed': 1.35 }],
    ['Remote Hubs & Early Bag Storage', 'Shortens catering trips, buffers early bags, and opens a Transfer Centre (connection time 45 min).', { 'catering.tripTime': 0.75, 'baggage.storageCapacity': 1.5, 'hub.transferCentre': 45 }],
    ['Autonomous GSE & RFID', 'Speeds tugs and carts, cuts mishandling, and adds the RFID bag line (connection time 25 min).', { 'ground.vehicleSpeed': 1.35, 'baggage.mishandling': 0.15, 'hub.rfidBagLine': 25 }],
  ],
  commercial: [
    ['Duty-Free', 'Unlocks duty-free retail.', { 'retail.spend': 1.1 }],
    ['Food Court Leases', 'Adds leased food capacity.', { 'retail.foodIncome': 1.2 }],
    ['Premium Lounges', 'Unlocks premium lounges.', { 'retail.premiumSpend': 1.3 }],
    ['Dynamic Pricing', 'Adapts prices to demand.', { 'retail.dynamicPricing': 1, 'retail.spend': 1.2 }],
  ],
  safety_security: [
    ['Extra Lane Kit', 'Unlocks additional staffed screening lanes.', { 'security.laneCapacity': 1.2 }],
    ['CT Scanners', 'Screening lane speed +50%.', { 'security.laneSpeed': 1.5 }],
    ['Fast-Track & Rescue II', 'Unlocks fast-track income and wide-body fire cover.', { 'security.fastTrack': 1, 'safety.widebodyCover': 1 }],
    ['Remote Screening Centre', 'Centralizes screening and evens out queues.', { 'security.peakCapacity': 1.35 }],
  ],
  cargo: [
    ['Belly Cargo Handling', 'Unlocks cargo carried on passenger aircraft.', { 'cargo.bellyHandling': 1 }],
    ['Cargo Shed II', 'Raises cargo storage and handling capacity.', { 'cargo.shedCapacity': 1.5 }],
    ['Freighter Stands', 'Unlocks dedicated freighter stands.', { 'cargo.freighterStands': 1 }],
    ['Cold-Chain & Express Hub', 'Unlocks premium temperature-controlled and express freight.', { 'cargo.premiumIncome': 1.35 }],
  ],
  staff_hr: [
    ['Staff Canteen', 'Improves morale and reduces break downtime.', { 'staff.moraleThroughput': 1.05 }],
    ['Training Centre', 'Unlocks role specialists.', { 'staff.training': 1, 'staff.specialistThroughput': 1.15 }],
    ['Staff Village', 'Unlocks tier III housing and a large on-site staff cap.', { 'staff.housingTier': 3 }],
    ['Rail Link', 'Unlocks the largest commuter cap.', { 'staff.railTransit': 1 }],
  ],
  sustainability: [
    ['LED & Solar', 'Cuts load and adds renewable site capacity.', { 'power.demand': 0.9, 'power.capacity': 1.1 }],
    ['Battery Storage', 'Softens brown-outs by adding reserve capacity.', { 'power.batteryCapacity': 150 }],
    ['Electric GSE', 'Reduces vehicle upkeep and noise.', { 'ground.upkeep': 0.75, 'ground.noise': 0.7 }],
    ['SAF Blending', 'Raises airline approval and unlocks premium contracts.', { 'airline.approval': 1.1, 'fuel.saf': 1 }],
  ],
  maintenance: [
    ['Preventive Schedules', 'Reduces wear accumulation.', { 'maintenance.wearRate': 0.8 }],
    ['Maintenance Depot II', 'Raises repair throughput.', { 'maintenance.capacity': 1.5 }],
    ['Predictive Maintenance', 'Warns before failures and reduces their frequency.', { 'maintenance.failureRate': 0.55 }],
    ['Hangar MRO', 'Unlocks third-party maintenance income.', { 'maintenance.mroIncome': 1 }],
  ],
}

const BRANCH_NAMES: Readonly<Record<TechBranchId, string>> = {
  terminal_ops: 'Terminal Ops',
  airside_ops: 'Airside Ops',
  ground_logistics: 'Ground Logistics & Baggage',
  commercial: 'Commercial / Retail',
  safety_security: 'Safety / Security',
  cargo: 'Cargo',
  staff_hr: 'Staff and HR',
  sustainability: 'Sustainability',
  maintenance: 'Maintenance',
}

export const TECH_BRANCH_IDS = Object.keys(SEEDS) as TechBranchId[]

function techId(branch: TechBranchId, tier: TechTier): string {
  return `${branch}.t${tier}`
}

function crossRequirements(branch: TechBranchId, tier: TechTier): string[] {
  if (branch === 'airside_ops' && tier === 2) return [techId('sustainability', 1)]
  if (branch === 'cargo' && tier === 3) return [techId('safety_security', 3)]
  return []
}

export const TECH_TREE: readonly TechBranch[] = TECH_BRANCH_IDS.map((branch) => {
  const nodes = SEEDS[branch].map((seed, index): TechNode => {
    const tier = (index + 1) as TechTier
    const requires = tier === 1 ? [] : [techId(branch, (tier - 1) as TechTier)]
    requires.push(...crossRequirements(branch, tier))
    return {
      id: techId(branch, tier),
      branch,
      tier,
      name: seed[0],
      description: seed[1],
      costRp: TECH_TIER_COST[tier],
      fieldLevel: TECH_TIER_FIELD_LEVEL[tier],
      requires,
      modifiers: seed[2],
    }
  })
  return { id: branch, name: BRANCH_NAMES[branch], nodes }
})

export const TECH_NODES: readonly TechNode[] = TECH_TREE.flatMap((branch) => branch.nodes)

const NODE_BY_ID = new Map(TECH_NODES.map((node) => [node.id, node]))

export function techNode(id: string): TechNode | undefined {
  return NODE_BY_ID.get(id)
}

export function availableTech(fieldLevel: number, unlocked: ReadonlySet<string>): TechNode[] {
  return TECH_NODES.filter(
    (node) =>
      !unlocked.has(node.id) &&
      node.fieldLevel <= fieldLevel &&
      node.requires.every((requirement) => unlocked.has(requirement)),
  )
}

export function techModifiers(unlocked: ReadonlySet<string>): Readonly<Record<string, number>> {
  const result: Record<string, number> = {}
  for (const id of unlocked) {
    const node = techNode(id)
    if (!node) continue
    for (const [key, value] of Object.entries(node.modifiers)) {
      result[key] = result[key] === undefined ? value : result[key] * value
    }
  }
  return result
}
