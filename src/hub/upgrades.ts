import {
  HUB_MID_FIELD_LEVEL,
  RFID_COST,
  RFID_RP,
  RFID_UPKEEP,
  TRANSFER_CENTRE_COST,
  TRANSFER_CENTRE_RP,
  TRANSFER_CENTRE_UPKEEP,
} from './config.ts'
import type { HubUpgrade, HubUpgradeId } from './types.ts'

export const HUB_UPGRADES: readonly HubUpgrade[] = [
  {
    id: 'transfer_centre',
    name: 'Transfer Centre',
    rp: TRANSFER_CENTRE_RP,
    buildCost: TRANSFER_CENTRE_COST,
    upkeepPerDay: TRANSFER_CENTRE_UPKEEP,
    minFieldLevel: HUB_MID_FIELD_LEVEL,
    blurb: 'Airside transfer desk. Costs $42,000 to build plus daily upkeep. Connection time drops from 60 to 45 game-minutes.',
  },
  {
    id: 'rfid_bag_line',
    name: 'RFID bag line',
    rp: RFID_RP,
    buildCost: RFID_COST,
    upkeepPerDay: RFID_UPKEEP,
    minFieldLevel: HUB_MID_FIELD_LEVEL,
    requires: 'transfer_centre',
    blurb: 'Tagged through-bags skip the slow sort. Costs $28,000 to build plus daily upkeep. Connection time drops to 25 game-minutes.',
  },
]

export function hubUpgrade(id: string): HubUpgrade | undefined {
  return HUB_UPGRADES.find((node) => node.id === id)
}

export function isHubUpgrade(id: string): id is HubUpgradeId {
  return hubUpgrade(id) != null
}

export function hubUpkeep(owned: ReadonlySet<string>): number {
  let total = 0
  for (const node of HUB_UPGRADES) {
    if (owned.has(node.id)) total += node.upkeepPerDay
  }
  return total
}
