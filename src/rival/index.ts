export { RIVAL, RIVAL_CODE, RIVAL_NAME } from './config.ts'
export { RivalAirport, createRivalState } from './engine.ts'
export {
  airportScore,
  courtChance,
  courtCost,
  dailyIncome,
  dailyUpkeep,
  demandSplit,
  expandCost,
  feeBlend,
  poachChance,
} from './demand.ts'
export { createRivalRng } from './rng.ts'
export type {
  CourtOffer,
  CourtQuote,
  CourtResult,
  DayResult,
  DemandSplit,
  FeeLevels,
  PlayerSnapshot,
  RivalCarrier,
  RivalMove,
  RivalPanelModel,
  RivalState,
  Walkaway,
} from './types.ts'
export { PRICE_WAR, type PriceWarTune } from './pricewar.data.ts'
export {
  PriceWar,
  composeRivalWalkIn,
  createPriceWarRng,
  responseWalkInLoss,
  startChance,
  undercutFee,
  walkedCount,
  warIntensity,
} from './pricewar.ts'
export type {
  PriceWarCardModel,
  PriceWarEvent,
  PriceWarInput,
  SoftOffer,
  WarChoice,
  WarQuote,
} from './pricewar.ts'
