import type {
  CargoKind,
  CargoTerminalConfig,
  FlightCargoMode,
  HandlingUnitKind,
  HandlingUnitSpec,
} from './types.ts'

export const HANDLING_UNITS: Record<HandlingUnitKind, HandlingUnitSpec> = {
  loose: {
    kind: 'loose',
    label: 'Loose freight pallet',
    tareTonnes: 0,
    maxGrossTonnes: 1,
    nominalPayloadTonnes: 1,
    mainDeckOnly: false,
  },
  ake: {
    kind: 'ake',
    label: 'LD-3 / AKE container',
    tareTonnes: 0.082,
    maxGrossTonnes: 1.588,
    nominalPayloadTonnes: 1.506,
    mainDeckOnly: false,
  },
  pmc: {
    kind: 'pmc',
    label: 'PMC / P6P pallet',
    tareTonnes: 0.12,
    maxGrossTonnes: 6.8,
    nominalPayloadTonnes: 4.5,
    mainDeckOnly: true,
  },
  oversize_piece: {
    kind: 'oversize_piece',
    label: 'Oversize piece',
    tareTonnes: 0,
    maxGrossTonnes: 20,
    nominalPayloadTonnes: 20,
    mainDeckOnly: true,
  },
}

export interface CargoProductDefaults {
  revenuePerTonne: number
  penaltyPerTonne: number
  unitKind: HandlingUnitKind
  allowedModes: readonly FlightCargoMode[]
  suggestedDeadlineMinutes: number
}

/**
 * Gross shipper rates, not pure airport profit. They are deliberately visible
 * here so the economy owner can apply a handling-share multiplier at wiring.
 */
export const CARGO_PRODUCTS: Record<CargoKind, CargoProductDefaults> = {
  general: {
    revenuePerTonne: 2470,
    penaltyPerTonne: 900,
    unitKind: 'ake',
    allowedModes: ['belly', 'freighter'],
    suggestedDeadlineMinutes: 18 * 60,
  },
  express: {
    revenuePerTonne: 3350,
    penaltyPerTonne: 2100,
    unitKind: 'ake',
    allowedModes: ['belly', 'freighter'],
    suggestedDeadlineMinutes: 6 * 60,
  },
  perishable: {
    revenuePerTonne: 3100,
    penaltyPerTonne: 2600,
    unitKind: 'ake',
    allowedModes: ['belly', 'freighter'],
    suggestedDeadlineMinutes: 10 * 60,
  },
  oversize: {
    revenuePerTonne: 5500,
    penaltyPerTonne: 3500,
    unitKind: 'oversize_piece',
    allowedModes: ['freighter'],
    suggestedDeadlineMinutes: 24 * 60,
  },
}

/**
 * A compact starter terminal. Rates are playable abstractions around one dock,
 * one screening line and one ULD build/break team; all capacities are tonnes.
 */
export function starterCargoTerminal(): CargoTerminalConfig {
  return {
    facilities: [
      {
        id: 'truck_dock',
        label: 'Landside truck dock',
        inputCapacityTonnes: 60,
        outputCapacityTonnes: 45,
        rateTonnesPerMin: 2,
        staffRequired: 4,
        staffAssigned: 4,
      },
      {
        id: 'customs',
        label: 'Customs acceptance',
        inputCapacityTonnes: 45,
        outputCapacityTonnes: 40,
        rateTonnesPerMin: 1.5,
        staffRequired: 3,
        staffAssigned: 3,
      },
      {
        id: 'screening',
        label: 'Cargo screening',
        inputCapacityTonnes: 40,
        outputCapacityTonnes: 60,
        rateTonnesPerMin: 1.25,
        staffRequired: 3,
        staffAssigned: 3,
      },
      {
        id: 'warehouse',
        label: 'Cargo warehouse',
        inputCapacityTonnes: 120,
        outputCapacityTonnes: 45,
        rateTonnesPerMin: 2.5,
        staffRequired: 5,
        staffAssigned: 5,
      },
      {
        id: 'cold_storage',
        label: 'Export cold store',
        inputCapacityTonnes: 30,
        outputCapacityTonnes: 20,
        rateTonnesPerMin: 0.8,
        staffRequired: 2,
        staffAssigned: 2,
      },
      {
        id: 'build_up',
        label: 'ULD build-up',
        inputCapacityTonnes: 45,
        outputCapacityTonnes: 80,
        rateTonnesPerMin: 1,
        staffRequired: 4,
        staffAssigned: 4,
      },
      {
        id: 'ready',
        label: 'Airside ready rack',
        inputCapacityTonnes: 80,
        outputCapacityTonnes: 80,
        rateTonnesPerMin: 0,
        staffRequired: 0,
        staffAssigned: 0,
      },
      {
        id: 'import_airside',
        label: 'Import airside dock',
        inputCapacityTonnes: 80,
        outputCapacityTonnes: 60,
        rateTonnesPerMin: 2,
        staffRequired: 4,
        staffAssigned: 4,
      },
      {
        id: 'import_breakdown',
        label: 'Import ULD break-down',
        inputCapacityTonnes: 60,
        outputCapacityTonnes: 50,
        rateTonnesPerMin: 1.2,
        staffRequired: 4,
        staffAssigned: 4,
      },
      {
        id: 'import_screening',
        label: 'Import transfer screening',
        inputCapacityTonnes: 50,
        outputCapacityTonnes: 45,
        rateTonnesPerMin: 1.25,
        staffRequired: 3,
        staffAssigned: 3,
      },
      {
        id: 'import_customs',
        label: 'Import customs release',
        inputCapacityTonnes: 45,
        outputCapacityTonnes: 80,
        rateTonnesPerMin: 1.5,
        staffRequired: 3,
        staffAssigned: 3,
      },
      {
        id: 'import_warehouse',
        label: 'Import warehouse',
        inputCapacityTonnes: 120,
        outputCapacityTonnes: 45,
        rateTonnesPerMin: 2.5,
        staffRequired: 5,
        staffAssigned: 5,
      },
      {
        id: 'import_cold_storage',
        label: 'Import cold store',
        inputCapacityTonnes: 30,
        outputCapacityTonnes: 20,
        rateTonnesPerMin: 0.8,
        staffRequired: 2,
        staffAssigned: 2,
      },
      {
        id: 'import_truck_dock',
        label: 'Import collection dock',
        inputCapacityTonnes: 60,
        outputCapacityTonnes: 60,
        rateTonnesPerMin: 1,
        staffRequired: 2,
        staffAssigned: 2,
      },
    ],
    trucks: {
      count: 4,
      payloadTonnes: 20,
      inboundTravelMinutes: 25,
      roundTripMinutes: 90,
      unloadTonnesPerMin: 1,
    },
    revenueShare: {
      airport: 0.1,
      handler: 0.9,
    },
    advisorSampleMinutes: 5,
  }
}

export interface AirframeCargoProfile {
  mode: FlightCargoMode
  capacityTonnes: number
  supportedUnits: readonly HandlingUnitKind[]
  needsMainDeckLoader: boolean
}

/** IATA-style planning helper; caller may override the 18 kg game average. */
export function estimateBaggageTonnes(bagUnits: number, kgPerBag = 18): number {
  if (!Number.isFinite(bagUnits) || !Number.isFinite(kgPerBag) || bagUnits < 0 || kgPerBag < 0) {
    throw new Error('Bag count and mass must be finite and non-negative')
  }
  return (bagUnits * kgPerBag) / 1000
}

export function availableBellyCargoTonnes(
  holdCapacityTonnes: number,
  baggageTonnes: number,
  commercialCargoCapTonnes = holdCapacityTonnes,
): number {
  if (
    !Number.isFinite(holdCapacityTonnes) ||
    !Number.isFinite(baggageTonnes) ||
    !Number.isFinite(commercialCargoCapTonnes) ||
    holdCapacityTonnes < 0 ||
    baggageTonnes < 0 ||
    commercialCargoCapTonnes < 0
  ) {
    throw new Error('Belly capacity inputs must be finite and non-negative')
  }
  return Math.min(commercialCargoCapTonnes, Math.max(0, holdCapacityTonnes - baggageTonnes))
}

/** Cargo profiles used when the terminal owner does not supply a route-specific payload. */
export function airframeCargoProfile(airframeId: string): AirframeCargoProfile {
  switch (airframeId.toLowerCase()) {
    case 'b748f':
      return {
        mode: 'freighter',
        capacityTonnes: 133.9,
        supportedUnits: ['ake', 'pmc', 'loose'],
        needsMainDeckLoader: true,
      }
    case 'an124':
      return {
        mode: 'freighter',
        capacityTonnes: 120,
        supportedUnits: ['pmc', 'loose', 'oversize_piece'],
        needsMainDeckLoader: true,
      }
    case 'b763f':
      return {
        mode: 'freighter',
        capacityTonnes: 52.7,
        supportedUnits: ['ake', 'pmc', 'loose'],
        needsMainDeckLoader: true,
      }
    case 'b752f':
      return {
        mode: 'freighter',
        capacityTonnes: 32,
        supportedUnits: ['pmc', 'loose'],
        needsMainDeckLoader: true,
      }
    default:
      return {
        mode: 'belly',
        capacityTonnes: 12,
        supportedUnits: ['ake', 'loose'],
        needsMainDeckLoader: false,
      }
  }
}
