import { CATEGORIES, SPEC_BRANCHES, TIER_COSTS, type ResearchCategoryId, type SpecBranchId } from './config.ts'
import type { ResearchNode } from './types.ts'

interface LineSeed {
  name: string
  blurb: string
  unlocks: string
}

const LINES: Record<Exclude<ResearchCategoryId, 'specs'>, readonly LineSeed[]> = {
  airfield: [
    { name: 'Apron charter', blurb: 'A strip, a taxiway, and a small stand.', unlocks: 'Faster apron turns' },
    { name: 'De-ice pad', blurb: 'Winter turns stop stacking on the taxiway.', unlocks: 'De-ice pad' },
    { name: 'Large stands', blurb: 'Wide and jumbo gates on the same pier.', unlocks: 'Wide stand, jumbo stand, widebody aircraft' },
    { name: 'Heavy runway', blurb: 'The long strip for twin-aisle departures.', unlocks: 'Heavy strip' },
    { name: 'Control tower', blurb: 'A staffed tower instead of a radio in the hall.', unlocks: 'Tower' },
    { name: 'Code E pier', blurb: 'The pier and the hangar that can take it.', unlocks: 'Code E, jumbo hangar, heavy aircraft, tank farm III' },
  ],
  terminal: [
    { name: 'Hall shell', blurb: 'A walkable hall with a curb door.', unlocks: 'Faster security screening' },
    { name: 'Processing', blurb: 'Kiosks, bag drop, and a sorter beside the desks.', unlocks: 'Kiosks, bag sorter, Prefab II' },
    { name: 'Concourse', blurb: 'A moving walk so the pier does not eat the connection.', unlocks: 'Travelator' },
    { name: 'Jet bridge', blurb: 'Passengers leave the weather.', unlocks: 'Jet bridge' },
    { name: 'Skywalk', blurb: 'A covered link between the hall and the stands.', unlocks: 'Skywalk' },
    { name: 'People mover', blurb: 'The long pier gets a ride, not a hike.', unlocks: 'People mover, automated baggage' },
  ],
  airside: [
    { name: 'Fuel farm', blurb: 'Pits at the stand. Fuel comes from the farm, not a bowser.', unlocks: 'Hydrant fuel' },
    { name: 'Catering kitchen', blurb: 'Meals leave the kitchen instead of a van on the road.', unlocks: 'Catering kitchen' },
    { name: 'GSE depot', blurb: 'A home for the tugs and the belt loaders.', unlocks: 'GSE depot' },
    { name: 'Wide hangar', blurb: 'A bay that can hold a twin-aisle overnight.', unlocks: 'Wide hangar, tank farm II' },
    { name: 'MRO bay', blurb: 'Checks that used to divert now stay on the field.', unlocks: 'MRO' },
    { name: 'Night bank', blurb: 'Fuel by rail and a bank that flies after dark.', unlocks: 'Night hub, fuel rail, night bank' },
    { name: 'Fuel pipeline', blurb: 'A pipe to the map edge and a receipt manifold at the farm.', unlocks: 'Fuel pipeline, receipt manifold' },
  ],
  landside: [
    { name: 'Curb road', blurb: 'A public road to the hall door.', unlocks: 'More catchment demand' },
    { name: 'Inn', blurb: 'Crew and misconnects sleep on the plot.', unlocks: 'Inn' },
    { name: 'Long-stay park', blurb: 'Cars stop using the curb as a lot.', unlocks: 'Higher retail spend' },
    { name: 'Bus station', blurb: 'A bay for the city bus, off the departures lane.', unlocks: 'More catchment demand' },
    { name: 'Rail spur', blurb: 'A platform on the boundary.', unlocks: 'Rail station' },
    { name: 'Airport hotel', blurb: 'The hotel sits on the terminal, not down the road.', unlocks: 'Airport hotel' },
  ],
  safety: [
    { name: 'ARFF station', blurb: 'A fire crew that can reach the strip.', unlocks: 'Faster security screening' },
    { name: 'Police post', blurb: 'A desk for the airside police.', unlocks: 'Faster apron turns' },
    { name: 'Guard lanes', blurb: 'A staffed post on the landside door.', unlocks: 'Faster security screening' },
    { name: 'Security hall', blurb: 'Screening gets its own room.', unlocks: 'Security hall, scanner lanes' },
    { name: 'Incident drill', blurb: 'A hangar-side ramp for military and government flights.', unlocks: 'Military ramp' },
    { name: 'Hardened perimeter', blurb: 'Automated passport gates for a jumbo bank.', unlocks: 'E-gates' },
  ],
  retail: [
    { name: 'Transfer Centre', blurb: 'Airside transfer desk. Costs $42,000 to build plus daily upkeep. Connection time drops from 60 to 45 game-minutes.', unlocks: 'Transfer Centre' },
    { name: 'RFID bag line', blurb: 'Tagged through-bags skip the slow sort. Costs $28,000 to build plus daily upkeep. Needs the Transfer Centre. Connection time drops to 25 game-minutes.', unlocks: 'RFID bag line' },
    { name: 'Food hall', blurb: 'A kitchen the public can sit in.', unlocks: 'Higher retail spend' },
    { name: 'Lounge', blurb: 'A quiet room with a door.', unlocks: 'Higher retail spend' },
    { name: 'Seating', blurb: 'Seats that are not the floor by the gate.', unlocks: 'More catchment demand' },
    { name: 'Comfort', blurb: 'Décor and a place to wait that is not a corridor.', unlocks: 'Higher retail spend' },
  ],
}

const SPEC_LINES: Record<SpecBranchId, readonly LineSeed[]> = {
  hub: [
    { name: 'Transfer bank', blurb: 'Connections are a product, not an accident.', unlocks: 'Hub transfers' },
    { name: 'Wave scheduling', blurb: 'Banks arrive together and leave together.', unlocks: 'Wave timetable' },
    { name: 'Minimum connect', blurb: 'The published connect time matches the pier.', unlocks: 'Minimum connect time' },
    { name: 'Hub pier', blurb: 'A pier laid out for the transfer, not the curb.', unlocks: 'Hub pier' },
    { name: 'Alliance desk', blurb: 'Partners sell the connection in their own name.', unlocks: 'Alliance desk' },
  ],
  cargo: [
    { name: 'Freight shed', blurb: 'Freight has a door that is not the hall.', unlocks: 'Cargo shed' },
    { name: 'Night freight', blurb: 'The shed stays open after the last passenger bank.', unlocks: 'Night freight' },
    { name: 'Sorter', blurb: 'ULDs stop crossing the passenger pier.', unlocks: 'Cargo sorter' },
    { name: 'Freighter stand', blurb: 'A stand that does not need a jet bridge.', unlocks: 'Freighter stand' },
    { name: 'Cargo airline', blurb: 'A contract written for tonnes, not seats.', unlocks: 'Cargo contract' },
  ],
  lowcost: [
    { name: 'Fast turn', blurb: 'The stand is priced for a twenty-five minute turn.', unlocks: 'Fast-turn policy' },
    { name: 'Remote stand', blurb: 'Buses are the product, not a fallback.', unlocks: 'Remote-stand policy' },
    { name: 'Thin lounge', blurb: 'No marble. A seat and a socket.', unlocks: 'Basic lounge' },
    { name: 'High frequency', blurb: 'The same city, many times a day.', unlocks: 'High-frequency slots' },
    { name: 'Low-cost deal', blurb: 'Fees the carrier can put on a slide.', unlocks: 'Low-cost contract' },
  ],
  premium: [
    { name: 'Premium lane', blurb: 'A check-in that is not the same queue.', unlocks: 'Premium check-in' },
    { name: 'Fast track', blurb: 'Security with a shorter line.', unlocks: 'Fast track' },
    { name: 'VIP room', blurb: 'A room with a door and a name.', unlocks: 'VIP room' },
    { name: 'Bridge service', blurb: 'The jet bridge is the only way on.', unlocks: 'Bridge-only policy' },
    { name: 'Flagship deal', blurb: 'A contract that asks for the pier, not the price.', unlocks: 'Premium contract' },
  ],
  green: [
    { name: 'SAF blend', blurb: 'A tank that can take a blended load.', unlocks: 'SAF blending' },
    { name: 'Quiet hours', blurb: 'The night bank has a noise cap.', unlocks: 'Quiet-hours policy' },
    { name: 'Electric GSE', blurb: 'The depot charges tugs instead of fuelling them.', unlocks: 'Electric GSE' },
    { name: 'Rail first', blurb: 'Staff and bags prefer the rail over the road.', unlocks: 'Rail-first policy' },
    { name: 'Green report', blurb: 'The year report carries a fuel line the board can read.', unlocks: 'Green year report' },
  ],
}

function lineNode(category: Exclude<ResearchCategoryId, 'specs'>, tier: number, seed: LineSeed): ResearchNode {
  const id = `${category}-${tier}`
  return {
    id,
    category,
    tier,
    name: seed.name,
    blurb: seed.blurb,
    unlocks: seed.unlocks,
    requires: tier === 1 ? [] : [`${category}-${tier - 1}`],
    baseCost: TIER_COSTS[tier - 1] ?? 0,
  }
}

function specNode(branch: SpecBranchId, tier: number, seed: LineSeed): ResearchNode {
  const id = `spec-${branch}-${tier}`
  return {
    id,
    category: 'specs',
    tier,
    branch,
    name: seed.name,
    blurb: seed.blurb,
    unlocks: seed.unlocks,
    requires: tier === 1 ? ['spec-charter'] : [`spec-${branch}-${tier - 1}`],
    baseCost: TIER_COSTS[tier] ?? 1,
  }
}

export const RESEARCH_NODES: readonly ResearchNode[] = buildNodes()

export function buildNodes(): ResearchNode[] {
  const nodes: ResearchNode[] = []
  for (const category of CATEGORIES) {
    if (category.id === 'specs') continue
    const seeds = LINES[category.id]
    seeds.forEach((seed, index) => nodes.push(lineNode(category.id, index + 1, seed)))
  }
  nodes.push({
    id: 'spec-charter',
    category: 'specs',
    tier: 1,
    name: 'Specialisation charter',
    blurb: 'Pick a direction. The other branches stay open, at a higher price.',
    unlocks: 'Hub, Cargo, Low-cost, Premium, and Green',
    requires: [],
    baseCost: 0,
  })
  for (const branch of SPEC_BRANCHES) {
    SPEC_LINES[branch.id].forEach((seed, index) => nodes.push(specNode(branch.id, index + 1, seed)))
  }
  return nodes
}

const BY_ID = new Map(RESEARCH_NODES.map((node) => [node.id, node]))

export function nodeById(id: string): ResearchNode | undefined {
  return BY_ID.get(id)
}

export function nodesInCategory(category: ResearchCategoryId): ResearchNode[] {
  return RESEARCH_NODES.filter((node) => node.category === category)
}
