import { finiteAmount } from '../disruptions/engine.ts'
import { GroundControl, RIGHT_OF_WAY, type AtcRole, type RouteCell } from '../atc/groundControl.ts'
import {
  ARRIVAL_LOCK_LEAD_SEC,
  DEPARTURE_OCCUPANCY_SEC,
  RUNWAY_GENTLE_SLIP_SEC,
  RUNWAY_SLOT_SLACK_SEC,
  RUNWAY_LATE_SLACK_SEC,
  runwayArrivalGapSec,
  runwayMovementCapacity,
  runwayOverbooked,
} from '../atc/capacity.ts'
import { auditWorld, placementReason, type WorldViolation } from './worldRules.ts'
import type { DisruptionHost, DisruptionId, DisruptionWorld, FlightBank } from '../disruptions/types.ts'
import { DisruptionBridge } from './disruptionBridge.ts'
import { OPS_ALERT_PREFIX, OpsEventRunner, opsAlertText, type ActiveOpsEvent } from '../content/events_ops.ts'
import {
  GameDiplomacyAdapter,
  StandingAdvisor,
  type StandingCauseCategory,
} from './standingAdvisor.ts'
import {
  AIRLINES,
  airlineList,
  BAG_DROP_PAY,
  BELT_COST,
  BUDGET_BASE,
  BULLDOZE_REFUND,
  CASH_DEBT_FLOOR,
  DELAY_HEAT_REF_SEC,
  PAYROLL_SHORT_SLIDER_FLOOR,
  PAYROLL_SHORT_SLIDER_STEP,
  SECURITY_INCIDENT_SLIDER_FLOOR,
  SECURITY_HARD_FINE,
  SECURITY_SOFT_FINE,
  SECURITY_PUBLIC_HARD_FINE,
  SECURITY_PUBLIC_SOFT_FINE,
  CRASH_FINE_CAP,
  BUILDINGS,
  CATER,
  CLEANING_FEE,
  CARGO_INTAKE_FEE,
  CARGO_WAREHOUSE_CAP,
  CARGO_VOLUME_COOL,
  CARGO_VOLUME_FAIL_FINE,
  CARGO_VOLUME_FEE_MAX,
  CARGO_VOLUME_FEE_MIN,
  createProcAirline,
  DEFAULT_BUDGETS,
  DEICE_FEE,
  DEICE_PAD_COST,
  FUEL,
  AIR_AMBULANCE_FEE,
  HALL_SCRUB_COST,
  ABANDON_ACC_SECONDS,
  ABANDON_FINE,
  HEAT_ABANDON_THRESHOLD,
  HEAT_BAN_THRESHOLD,
  HEAT_REWARD_THRESHOLD,
  HEAT_WARN_THRESHOLD,
  HELO_LANDING,
  DIVERT_FEE_MAX,
  DIVERT_FEE_MIN,
  EMERGENCY_REFUSE_FINE,
  EMERGENCY_TIMEOUT_FINE,
  EMERGENCY_UNABLE_HEAT,
  EMERGENCY_UNABLE_REP,
  CONTRACT_LETTER_DEADLINE,
  FIELD_TASK_COOL,
  FIELD_TASK_DEADLINE,
  FIRST_CONTRACT_LETTER_DEADLINE,
  FIELD_TASK_DEFS,
  FIELD_TASK_DECLINE_HEAT,
  FIELD_TASK_DECLINE_KIND_SEC,
  FIELD_TASK_EARLY_DAYS,
  FIELD_TASK_EARLY_QUIET,
  FIELD_TASK_FAIL_FINE,
  FIELD_TASK_HEAT_FAIL,
  FIELD_TASK_HEAT_OK,
  GA_LEAVE_WINDOW,
  GA_OVERSTAY_FINE,
  GA_PARK_DAY_RATE,
  GA_PARK_FEE_MAX,
  GA_PARK_FEE_MIN,
  GA_PARK_RATE_COOL,
  GA_PARK_STAY_MAX,
  GA_PARK_STAY_MIN,
  HUB_BAN_THRESHOLD,
  HUB_HEAT_NEED,
  HUB_LAYOVER_WINS,
  RESEARCH_NODES,
  rewardForPersona,
  REWARD_DETAIL,
  REWARD_LABEL,
  TANKER_FEE,
  TANKER_MX_FEE,
  EMERGENCY_FAIL_FINE,
  LAND,
  LAYOVER_BAN_FINE,
  LAYOVER_BAN_SECONDS,
  LAYOVER_FEE_MAX,
  LAYOVER_FEE_MIN,
  LOADS_PER_BUY,
  MIL_AGREE_COST,
  MIL_LANDING,
  THREAT_SCRAMBLE_COST,
  IPO_FOUNDER_SHARES,
  IPO_LISTING_FEE,
  IPO_MIN_CASH,
  IPO_MIN_FLIGHTS,
  IPO_MIN_REP,
  IPO_SHARES,
  LOAN_FEE,
  LOAN_PRINCIPAL,
  LOAN_PRODUCTS,
  fieldLevelOf,
  fieldProgress,
  prestigeStarsOf,
  LATE_FIELD_XP,
  lateFieldLevelFromXp,
  type FieldLevel,
  normalizeAirline,
  AIRLINE_TIER_META,
  MECHANIC_HIRE,
  MIN_RUNWAY,
  LAND_PLOT,
  TILE_UTILITY,
  JETWAY_RANGE,
  MIL_RAMP_RANGE,
  PREMADE_TERMINAL_COST,
  RAIL_CITY_COST,
  HOTEL_COST,
  HOTEL_COST_L2,
  HOTEL_META_EXPENSE,
  HOTEL_CLASS_EXPENSE,
  HOTEL_CLASS_FEE,
  BUS_EXPENSE,
  CURB_LANE_EXPENSE,
  TAXI_RANK_EXPENSE,
  BUS_FARE,
  CARPARK_SHORT_COST,
  CARPARK_LONG_COST,
  CARPARK_META_EXPENSE_SHORT,
  CARPARK_META_EXPENSE_LONG,
  HALL_AMENITY_EXPENSE,
  HOTEL_NIGHT_FEE,
  PARK_EXPENSE,
  PARK_USE_FEE,
  PARK_LONG_FEE,
  PARK_SHORT_FEE,
  RAIL_EXPENSE,
  RAIL_FARE,
  RAIL_STATION_COST,
  JANITOR_HIRE,
  RESEARCHER_HIRE,
  DESK_STAFF_HIRE,
  CONTRACT_FLEET,
  ROOMS,
  HEAVY_RUNWAY_COST,
  HEAVY_RUNWAY_LEN,
  HEAVY_RUNWAY_WID,
  SHORT_RUNWAY_COST,
  SHORT_RUNWAY_LEN,
  SHORT_RUNWAY_WID,
  RUNWAY_PREFAB_COST,
  RUNWAY_PREFAB_LEN,
  RUNWAY_PREFAB_WID,
  STAND_JETWAY_MULT,
  standClassLabel,
  standClassRank,
  STARTER_KIT_COST,
  START_CASH,
  TERMBUS_COST,
  TERMINAL_COST,
} from './catalog'
import { footprintCells, footprintCellsForLetter, standGrowBlock } from './standFoot'
import { stampStarterKit } from './starterLayout'
import { getAircraftSpec } from '../render/aircraft/specs'
import { bridgeMirror, standAccepts, standLetter, wingDiscsClash } from '../render/aircraft/stands'
import { legRoute, pointAlong, polylineLength } from './hallRoute.ts'
import { planTerminal, terminalPlanSeed } from '../render/world/plan.ts'
import { terminals } from '../render/world/layout.ts'
import type { RoomPlan } from '../render/world/rooms.ts'
import {
  hallPath,
  isAirside,
  NODE_POS,
  openForGuest,
  openForTransfer,
  reachableNeed,
  openNodesFromRooms,
  bagUnitsForTag,
  estimateFlightBagUnits,
  rollPaxTag,
  HALL_POST,
  onPostNow,
  spawnHallGuest,
  strongestNeed,
  tagPrice,
  tagSpendsUp,
  type ArriveMode,
  type HallGuest,
  type HallNode,
  type HallStaff,
  type PaxTag,
  type SpendKind,
  type StaffPost,
} from './guests'
import { adviseHall, type Advice } from './advisor.ts'
import { liveHallAdvice } from '../terminaladvisor/adapter.ts'
import { buildAdvice, buildAlerts } from './terminalBuildBridge.ts'
import { HallNav, hallClaimHall, hallNavLayout, hallSignage, openCheckinCount, openSecurityCount, staffPoints, waitMoodDelta } from './hallNav.ts'
import { buildUpkeepPerDay, type EditResult } from '../terminalbuild/index.ts'
import {
  hintKind,
  mergeHints,
  muteHintKind,
  newGameHintPrefs,
  readHintSettings,
  sanitizeHintPrefs,
  setAllHintsEnabled,
  severityOf,
  visibleHints,
  writeHintSettings,
  type HintPrefs,
} from './hints.ts'
import { HINT_REFRESH_SEC } from './hintsData.ts'
import {
  claimHoldUnits,
  CURB_REACH,
  FIRST_LETTER_COOL,
  FIRST_SLOT_GAP,
  FIRST_SLOT_JITTER,
  OPENING_ARRIVAL_GAP_SEC,
  OPENING_FIRST_SLOTS,
  OPENING_SEC,
  openingSlotCap,
  openingSpacingBonus,
  STARTER_CAPACITY,
} from './openingData.ts'
import {
  dismissTip as dismissTipId,
  evaluateTips,
  newTipBook,
  runwayExitCells,
  sanitizeTipBook,
  setTipsEnabled,
  stepTips,
  type TipBook,
  type TipOffer,
  type TipWorld,
} from './tips.ts'
import { TIP_PHASES, TIP_STUCK_SEC } from './tipsData.ts'
import { nextSessionHint } from './sessionHints.ts'
import { coolAfterSign, lettersSettled } from './contractPacing.ts'
import { LETTER_PACING } from './contractPacingData.ts'
import { AlertStack, type AlertFocus, type AlertInput } from './alerts.ts'
import { ALERT_TUNING, STUCK_PHASES } from './alertsData.ts'
import { StuckWatchdog, type RecoveryAction, type RecoveryLogEntry, type WatchSample } from './stuckWatchdog.ts'
import { STUCK_MOVING_PHASES, STUCK_WATCH } from './stuckWatchdogData.ts'
import { DISRUPTION_ALERT_PREFIX, disruptionToAlert } from '../disruptions/alertFeed.ts'
import {
  scenarioById,
  scenarioRuleLines,
  scoreScenario,
  type ScenarioRun,
} from '../scenarios/schedule.ts'
import type { Scenario } from '../scenarios/types.ts'
import { disruptionLocus, type DisruptionLocusField } from '../disruptions/locus.ts'
import {
  CT_TECH_ID,
  PREMIUM_RULES,
  buyFacility,
  cabinFromGuest,
  cabinFromTag,
  createPremiumState,
  dailyUpkeep,
  expectsHigherService,
  hireOfficer,
  premiumStaffBuildings,
  restorePremium,
  screenPassengers,
  setFeeEnabled,
  staffedFacilities,
  type PremiumItemId,
  type PremiumState,
} from '../premium/index.ts'
import { buildSeconds } from './construction.ts'
import { buildLogisticsConfig, delayFix, FUEL_OUTAGE_SLOT_SEC, groundCauseLine } from './logisticsBridge.ts'
import { CateringBridge, cateringCue } from './cateringBridge.ts'
import { cogsFor, stockoutChip, type HallCounterKind } from '../catering/hallShelf.ts'
import { CargoBridge } from './cargoBridge.ts'
import { POWER_PLANT_CAPACITY, calculatePower } from '../economy/power.ts'
import { canUpgradePower, powerPlantOffer } from '../economy/powerPlant.ts'
import { MRO_BAYS, MRO_POWER_DEMAND, MRO_TECHS_REQUIRED, NIGHT_BANK_SLOTS, NIGHT_HUB_POWER_DEMAND } from '../tier3/config.ts'
import {
  GROUND_CREW_PER_DEPOT,
  mroInfoLines,
  mroRoute,
  mroUnlock,
  nightHubInfoLines,
  nightHubUnlock,
  poseForPhase,
  Tier3Session,
  type Tier3Building,
  type Tier3TickContext,
} from '../tier3/index.ts'
import type { TaxiPoint } from '../tier3/taxi.ts'
import { getAudio, soundForEvent } from '../audio/index.ts'
import {
  createDiplomacyBridge,
  diplomacyFieldLevel,
  GAME_MINUTES_PER_SIM_SECOND,
  type DiplomacyBridge,
} from './diplomacyBridge.ts'
import { NegotiationBridge } from './negotiationBridge.ts'
import { NEGOTIATION, SERVICE_IDS, ULCC_IDS, negotiatedBagTurnFee } from '../negotiation/index.ts'
import { TERM_DAYS, commercialDepositTier } from '../negotiation/liveFees.ts'
import { PriceWar, composeRivalWalkIn } from '../rival/index.ts'
import type { WarChoice } from '../rival/index.ts'
import { StaffHousingBridge, type StaffField } from './staffHousingBridge.ts'
import type { HousingTierId, StaffSeat } from '../staffhousing/types.ts'
import { AIRLINES as NEGOTIATION_AIRLINES } from '../negotiation/data.ts'
import type { DepositTier, ServiceId } from '../negotiation/types.ts'
import { INBOUND_AIRFRAMES, InboundBridge, inboundCallsign } from './inboundBridge.ts'
import type { InboundContractRow, InboundOfferView } from './inboundBridge.ts'
import {
  CLEARANCE_LICENCE_COST,
  REP_FAIL,
  SIM_DAY_SEC,
  UPLIFT_LITRES,
  type InboundEvent,
  type InboundWorld,
  type RequestKind,
} from '../inbound/index.ts'
import { RIVAL, RivalAirport, type PlayerSnapshot, type Walkaway } from '../rival/index.ts'
import { createLogisticsAdapter, needsFor } from '../logistics/index.ts'
import type { LogisticsAdapter, LogisticsSim, TurnaroundResult } from '../logistics/index.ts'
import { shownPhase } from '../logistics/serviceFlow.ts'
import type { VehicleType } from '../logistics/types.ts'
import {
  BAG_SYSTEMS,
  FUEL_CONTRACTS,
  HANGAR_OFFERS,
  LITRES_PER_LEGACY_LOAD,
  PAX_UNITS,
  STAND_OFFERS,
  VEHICLE_OFFERS,
} from '../scale/data.ts'
import {
  canBuyPax,
  canBuyVehicle,
  canSignContract,
  canUpgradeBags,
  canUpgradeTank,
  gameMinutes,
  hangarScaleForTool,
  operatingFleet,
  loadsFromLitres,
  personSpeedMult,
  pillarReport,
  pillarUpkeep,
  pipeLink,
  placementBlock,
  railLink,
  scaleAdvice,
  contractById,
  seedLitresFromLoads,
  sizeTierOf,
  standClassForTool,
  standScaleForTool,
  tankDef,
  tickFuel,
} from '../scale/logic.ts'
import { aliasSize, FITTINGS, fittingDef, fittingRefusal, footprintLetter, hostKey, jetBridgeCost, jetBridgeUpkeep, legacyFitting, migrateStand, parseHostKey, readFittings, readStandRungs, readStandSizes, RUNG_LABEL, rungRefusal, rungStepCost, rungUpkeep, standAllows, upgradeLabel } from '../stands/index.ts'
import type { Fitting, FittingHost, FittingId, StandRung, StandSize } from '../stands/types.ts'
import type { BagSystemId, FuelSupply, PaxUnit, PillarReport, PillarState, SizeTier } from '../scale/types.ts'
import {
  CLOSED_NO_STAFF_LINE,
  SERVICE_POINT_TUNING,
  WALK_PAUSED_LINE,
  openPointIds,
  serviceInfoLines,
  throughputOf,
  type PointLoad,
} from '../servicepoints/index.ts'
import {
  CHECKIN_ALLOC,
  NEUTRAL_DESK_BRAND,
  allocate,
  carrierPeakPaxPerMin,
  checkinSignGate,
  type Allocation,
  type CheckinDesk,
  type CheckinFlight,
  type CheckinSignGate,
} from '../checkin/index.ts'
import { buildingCard, isBuildingTile, type BayInput, type BuildingCard, type CardSection, type Reading } from '../buildinginfo/index.ts'
import { HALL_NAV_TUNING, HALL_QUEUE_TUNING } from './hallNavData.ts'
import { bagWorkDuration, describeBagStage } from './bags'
import {
  BAG_RECORD_SEC,
  advanceBagTags,
  advanceScreen,
  checkedPieceCount,
  freshBook,
  keepPrefabBags,
  makeBagTag,
  markClaimLate,
  ownerClaimReady,
  type BagBook,
  type BagTag,
  type LuggageMotion,
} from './luggage'
import {
  blankZones,
  ceilingsFor,
  itemDef,
  laneStats,
  GRID_C,
  GRID_R,
  HALL_D,
  HALL_W,
  lookaheadDepth,
  needsMaintenance,
  overCapMultiplier,
  prefabZones,
  schemeItems,
  schemeLabel,
  schemeSigns,
  schemeZones,
  slowedService,
  zoneCellBlocked,
  type ItemId,
  type PlacedItem,
  type ZoneId,
} from './terminal.ts'
import { createPaxShowUpAdapter, stampDeparture } from '../pax/adapter.ts'
import type { PaxShowUpAdapter } from '../pax/adapter.ts'
import {
  LOUNGE_QUALITY_PER_ROOM,
  SHOWUP_WINDOWS,
  businessMixForPersona,
} from '../pax/config.ts'
import {
  PLANNED_TURN_SEC,
  SHOWUP_LEAD_GAME_MIN,
  checkInCloseAt,
  isIntlKind,
  planShowUp,
  type ShowTag,
  type ShowUpPlan,
  type ShowUpSeat,
} from '../pax/showup.ts'
import type { ShowUpFacts } from '../pax/types.ts'
import {
  NODE_ZONE,
  nodeComfort,
  outletExtraStock,
  outletSpec,
  pickOutlet,
  placementCheck,
  refundFor,
  seatsByZone,
  type PlacementCheck,
} from './terminalKit.ts'
import { KIT_TUNING, SEAT_NODES } from './terminalKitData.ts'
import { facilitiesFromItems } from '../terminalplay/facilities.ts'
import { findFootprint, footprintReason, footprintSpec, stampFrom } from '../terminalplay/footprints.ts'
import { footprintOf } from '../terminalplay/place.ts'
import { hallQueues, queueAtNode } from '../terminalplay/queues.ts'
import { hallFitFor, matchTerminal } from '../render/hallRooms.ts'
import {
  binFull,
  cellAt,
  dropLitter,
  dropLitterAt,
  foodCells,
  isBin,
  snackKind,
  snackMinutes,
  litterAdvice,
  litterComfortHit,
  litterInZone,
  litterJoyDrain,
  restroomDirtFor,
  restroomJoyHit,
  stepJanitor,
  type HallJanitor,
  type LitterHall,
} from './litter.ts'
import { LITTER_TUNING } from './litterData.ts'
import {
  claimSeat,
  consumeSec,
  hasTimeToSit,
  releaseSeat,
  seatingAdvice,
  seatsNear,
  sweepSeats,
  walkSecTo,
  type SeatBook,
} from './dining.ts'
import { DINING_TUNING } from './diningData.ts'
import { AmbienceMixer } from '../audio/ambience.ts'
import { PRESETS } from '../branding/presets.ts'
import type { BrandingSave } from '../branding/types.ts'
import { deserializeBranding, serializeBranding, suggestCode } from '../branding/validate.ts'
import { Bank, DAILY_PAYROLL_SHARE, moneyDirection, payrollForGameDay, type BankPostMeta, type MoneyCategory } from '../core/bank.ts'
import {
  type AirlineLead,
  type DepositTier as CommercialDepositTier,
  type FeeSchedule,
  type HeldDeposit,
  DEFAULT_FEE_SCHEDULE,
  demandInterval,
  depositCashPost,
  editFee,
  firstFlightClock,
  forfeitHeld,
  landingCharge,
  openLead,
  restoreDeposits,
  restoreFees,
  restoreLeads,
  restoreTier,
  scaleListed,
  cateringTurnFee,
  serviceCharge,
  settleHeld,
  signDeposit,
  standingForFees,
  walkInDemandOf,
  walkInOfferChance,
} from '../commercial/index.ts'
import { progressionBuildable, unlockLevel } from '../progression/unlocks.ts'
import {
  bankSlotCount,
  bankSpacing,
  capstoneCost,
  foldSpecMods,
  isSpecNode,
  isSpecPath,
  retailPrice,
  screenMultiplier,
  siteUpkeepMultiplier,
  specCashCost,
  specNode,
  specPath,
  specPointsForLevel,
  treePointsForProgress,
  turnMinutes,
  warehouseCapacity,
  type SpecMods,
  type SpecPath,
} from '../progression/specializations.ts'
import {
  REAL_SECONDS_PER_GAME_DAY,
  SIM_MINUTES_PER_GAME_DAY,
  SIM_MINUTES_PER_REAL_SECOND,
  SimClock,
} from '../core/clock.ts'
import {
  TycoonEngine,
  type CampaignKind,
  type TenantUnit,
  type TycoonBooks,
  type TycoonNote,
  type TycoonPulse,
  type TycoonView,
} from '../tycoon/index.ts'
import { PLAYTEST_YEAR_DAYS } from '../reports/config.ts'
import { MAX_CATCHUP_DAYS } from '../tycoon/config.ts'
import { YearPlaytestBook } from '../reports/book.ts'
import type { YearAwardInput } from '../reports/sources.ts'
import { mergePlaytestAndTycoon, type PlaytestYearReport, type TycoonYearLike } from '../reports/yearEnd.ts'
import {
  createEconomyAdapter,
  type EconomyAdapter,
} from '../economy/adapter.ts'
import type { EconomySnapshot, EconomyState, PowerLoad, PowerPlantTier } from '../economy/types.ts'
import {
  arrivalSpacingScale,
  bankTarget,
  dayIndex,
  defaultHolidayPeak,
  groundOpsPace,
  rollSeasonWeather,
  seasonAtDay,
  type HolidayPeakHook,
} from '../environment/index.ts'
import {
  accrueChallenges,
  challengeCards,
  climateAlert,
  climateCaption,
  climateWear,
  demandCalendar,
  engineDerate,
  environmentBinding,
  feedWinterOps,
  fieldDraw,
  holidaysOn,
  mapById,
  parseMapId,
  passengerFactor,
  rollMapWeather,
  seasonOn,
  weatherTitle,
  winterForecast,
  type ChallengeCard,
  type MapDraw,
  type MapId,
  type WinterOpsReading,
} from '../maps/index.ts'
import { audit, FlowGraph, registerTerminal, type TerminalZone } from '../flow/index.ts'
import {
  TECH_RFID_BAG_LINE,
  TECH_TRANSFER_CENTRE,
  bankDemand,
  buildBanks,
  connectingIndexes,
  connectionCauseSentence,
  connectionHint,
  connectionMap,
  connectionReportLines,
  emptyConnectionTally,
  hubUpgrade,
  recordConnection,
  hubUpkeep,
  minimumConnectionTime,
  missPenalty,
  resolveConnection,
  scaledShare,
  transferShare,
  type CarrierProfile,
  type ConnectionFail,
  type ConnectionMissDetail,
  type ConnectionMissReason,
  type ConnectionTally,
  type GatePoint,
  type Movement,
} from '../hub/index.ts'
import { OPS_RP_PER_SEC, CATEGORIES, FLIGHT_RP, FLIGHT_RP_PER_50_PAX, NIGHT_FREIGHT_RP } from '../research/config.ts'
import { ResearchEngine } from '../research/engine.ts'
import { researchMods } from '../research/effects.ts'
import { DESK_TO_NODE, deskIdsForNode, foldResearchSave, WAVE3_TO_NODE } from '../research/legacy.ts'
import { categoryUnlocked, nodeCost, nodeState } from '../research/logic.ts'
import { nodeById } from '../research/nodes.ts'
import { Wave3Engine } from '../wave3/engine.ts'
import { classifyTurn, relationshipLandingFactor } from '../wave3/honesty.ts'
import { largestInFleet, metalAllowed } from '../wave3/fleet.ts'
import {
  CONNECTIVITY_CATALOG,
  LINK_MAINT_SAFE,
  LINK_WEAR_BREAK,
  LINK_WEAR_PER_DAY,
  dailyUpkeep as linkDailyUpkeep,
} from '../connectivity/catalog.ts'
import {
  breakdown,
  choosePassengerLink,
  linkTerminals,
  type ConnectivityBuildingId,
  type LinkMode,
  type PassengerLink,
} from '../connectivity/index.ts'
import { METERS_PER_CELL } from '../render/aircraft/specs.ts'
import { assembleCrew, pathHeading, placeLocal, type AircraftAim, type CrewClock, type CrewScene } from '../ramp/present.ts'
import { SERVICE_POINTS, STAND_TIMELINE } from '../ramp/crewConfig.ts'
import { rosterAirline } from '../airlines/roster.ts'
import { RIVAL_NAME } from '../rival/config.ts'
import { isAirlineUnlocked, unlockGate } from '../airlines/rosterOffers.ts'
import { ROSTER_LIVE, ROSTER_SIZE_CAP } from '../airlines/rosterConfig.ts'
import { CATALOG_AIRLINE_IDS, rosterFleet, rosterGameAirline, rosterGameAirlines, rosterType } from './rosterAirlines.ts'
import {
  checklistFromFacts,
  readHubDedicated,
  readHubLeaseWarnings,
  readHubDayMap,
  readHubLeases,
  readHubOffered,
  readHubTiers,
  readHubVehicleLeases,
  type HubDedicatedCounts,
} from './hubProgress.ts'
import { FERRY_GAP_DAYS, HUB_OFFER_FEE, HUB_TIER_LABEL, LOUNGE_COFUND_SHARE, NUDGE_DESK_ASK, NUDGE_FIELD_CAP, NUDGE_GAP_DAYS, RIVAL_REFUSE_DAYS, RIVAL_TRIM_DAYS, TIER_DROP_WARNING_DAYS, VEHICLE_ROLES, type HubOfferTier, type HubTier, type VehicleRole } from '../hubprogress/config.ts'
import { backlashRoll, planBacklash, type BacklashPlan } from '../hubprogress/backlash.ts'
import { VEHICLE_ROLE_LABEL } from '../hubprogress/vehicles.ts'
import {
  dedicateBlock,
  dedicateLabel,
  facilityAskMet,
  gateLeaseId,
  hangarLeaseId,
  leaseCredit,
  loungeLeaseId,
  releaseBreaksTier,
  releaseLabel,
  tierBelow,
  type FacilityLease,
  type FacilityLeaseKind,
} from '../hubprogress/leases.ts'
import {
  dedicateVehicleLabel,
  firstSpare,
  groundVehicleId,
  liveVehicleLeases,
  releaseVehicleLabel,
  vehicleAskMet,
  vehicleBlock,
  vehicleCounts,
  vehicleLeaseId,
  vehicleReleaseBreaks,
  type VehicleLease,
} from '../hubprogress/vehicles.ts'
import { capacityWarning, carrierTurnsWanted } from './letterCapacity.ts'
import {
  airframeGap,
  airframeStandClass,
  easiestGap,
  fleetCardLine,
  isHeloAirframe,
  resolvedAirframes,
  type FieldFit,
} from './rosterMetal.ts'
import { standCrewPeople, standProps, type StandArrival } from '../ramp/standCrew.ts'
import { bridgeHold, samplePax, type PaxClock, type PaxDoor, type PaxMode } from '../ramp/paxFlow.ts'
import {
  commitPlot,
  dailySinks,
  nextPlotOffer,
  restoreOwned,
  starterHolding,
  type OwnedPlot,
  type PlotOffer,
} from '../land/index.ts'
import {
  budgetLineCost,
  cityLevy,
  fieldOpsMultiplier,
  loanFeeForAmount,
  loansAvailable,
  payrollAmount,
  payrollChargeWhy,
  settleLoanTick,
  settlePayroll,
} from './economy'
import { SMALL_FIELD_FEE_FACTOR, SMALL_FIELD_MAX_CARRIERS, SMALL_FIELD_UPKEEP_FACTOR } from './economyTuning.ts'
import {
  AIRFRAMES,
  type Airframe,
  craftRoleLabel,
  jetAirframesBlocked,
  jetAirframesFitting,
  bagUnitsForAirframe,
  contractedAirframes,
  fuelDwellSeconds,
  paxForAirframe,
  pickAirframe,
  pickAirframeWithFallback,
  standClassFor,
  stripTier,
  turnaroundScale,
} from './airframes'
import { hasLeftMap, inboundApproach } from './flightpath'
import {
  advancePaxItinerary,
  spawnArrivalPax,
  spawnDeparturePax,
} from './pax'
import { clampReputation, smoothReputation, takeReputationDrift } from './reputation'
import { LANDSIDE, LandsideTraffic, type LandsideView } from '../landside/index.ts'
import { CART_TUNING, CartYard, resolveSocket, type CartPose, type CartSite, type CartSocket } from '../carts/index.ts'
import { aircraftSocketTable, apronCartSockets, CAROUSEL_SOCKETS, checkinRowSockets } from '../render/socketLayout.ts'
import { FUEL as FUEL_CHAIN, FuelChain, type DeliveryRead, type FuelView } from '../fuel/index.ts'
import { SPOT_OFFER, brandForContract, termBandLitres, type SpotInbound, type SpotOffer } from '../fuel/offerData.ts'
import { HYDRANT_CARD, liveHydrantStands, standDrawsHydrant } from '../fuel/hydrant.ts'
import {
  clampStanding,
  leadSupplier,
  nextFuelIndex,
  rackSpotPerLitre,
  SUPPLIER_STANDING,
  termPerLitre,
} from '../fuel/standing.ts'
import { PIPELINE, pipelineIntervalMinutes, qualityHoldMinutes, supplyCut } from '../fuel/pipeline.ts'
import { BARGE, bargeLeadMinutes, bargeParcelLitres, cellOnWater, cellPlotId, siteHasWater } from '../fuel/barge.ts'
import {
  astar,
  farmBesidePavement,
  hasBeltNetwork,
  inBounds,
  neighbors,
  jetRouteOnGraph,
  nearestPath,
  pathToNearest,
  runwayStrips,
  standBeltLinked,
  tilesOf,
  walkableFor,
} from './path'
import {
  advanceLateDay,
  lateCatalogLines,
  lateIdForTool,
  lateSiteLines,
  railDemandScale,
  restoreLateSites,
  safFuelCost,
  tileForLate,
  wholeNights,
  type LatePlacement,
} from './lateBuildings.ts'
import { buildingById, fuelMultiplier, isOpen, placeBuilding } from '../tier3plus/index.ts'
import type { HotelNight } from '../tier3plus/index.ts'
import { SANDBOX_CASH, SAVE_KEY, SIZE, type AirlineId, type AirlineTier } from './types'
import {
  readStoredSave,
  SAVE_MIGRATIONS,
  SAVE_SCHEMA_VERSION,
  serialize,
  validateAirportSave,
  type SaveIssue,
} from '../features/save/index.ts'
import { AchievementTracker } from '../achievements/achievements.ts'
import type { AchievementState } from '../achievements/types.ts'
import type {
  AircraftKind,
  Airline,
  AirlineRewardId,
  BagFlowStage,
  BudgetKey,
  Budgets,
  CargoVolumeJob,
  CaterBrand,
  ContractOffer,
  Difficulty,
  EmergencyKind,
  FieldTask,
  BuildSite,
  FieldTaskKind,
  Flight,
  FuelBrand,
  GameSnapshot,
  HotelClass,
  HubOffer,
  LayoverContract,
  LayoverOffer,
  LoanProduct,
  MarketMission,
  ParkingOffer,
  ParkTerm,
  MxOffer,
  News,
  PendingEmergency,
  PendingThreat,
  Person,
  Phase,
  ResearchId,
  RoomId,
  RunwayClass,
  ScheduleSlot,
  ScheduleStatus,
  SiteKind,
  Speed,
  StartFocus,
  StandAccess,
  StandClass,
  StandPaxMode,
  TerminalFit,
  Tile,
  Tool,
  Truck,
  TruckMission,
  Vec,
  Weather,
} from './types'

function emptyTiles(): Tile[][] {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => 'grass' as Tile),
  )
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** The hall's items are the same objects; the stored type is just looser. */
const asLitterHall = (fit: TerminalFit): LitterHall => fit as unknown as LitterHall

/** Per-tick seat pool and comfort cache for one hall. */
interface HallKitState {
  items: PlacedItem[]
  zones: (string | null)[][]
  seatsLeft: Map<ZoneId, number>
  comfort: Map<HallNode, number>
  /** Floor litter in the zone around each node. */
  litter: Map<HallNode, number>
}

const emptyRooms = (): Record<RoomId, number> => ({
  checkin: 0,
  security: 0,
  gate: 0,
  bagclaim: 0,
  food: 0,
  souvenir: 0,
  bagdrop: 0,
  lounge: 0,
  bathroom: 0,
  golf: 0,
  waterfall: 0,
  gaming: 0,
  dayhotel: 0,
  spa: 0,
  pool: 0,
  rdesk: 0,
  rboard: 0,
  rmachine: 0,
})

function emptyFit(origin: Vec, premade: boolean, rooms?: Partial<Record<RoomId, number>>): TerminalFit {
  const r = { ...emptyRooms(), ...(rooms ?? {}) }
  const claimRooms = Math.max(1, r.bagclaim || (premade ? 1 : 0))
  return decorateFit({
    origin,
    premade,
    rooms: r,
    wearBath: 0,
    wearSec: 0,
    claimRate: premade ? 0.72 + claimRooms * 0.08 : 0.9 + claimRooms * 0.12,
  })
}

/** Prefab bundle, painted floors, and the ceilings those imply. */
function decorateFit(fit: TerminalFit): TerminalFit {
  if (fit.premade) {
    if (fit.tier == null) fit.tier = 1
    const tier = (fit.tier ?? 1) as 1 | 2 | 3
    if (fit.signs == null) fit.signs = schemeSigns(tier)
    if (!fit.zones?.length) fit.zones = schemeZones(tier)
    if (!fit.items?.length) fit.items = schemeItems(tier)
    if (fit.redesigned == null) fit.redesigned = false
  } else {
    if (fit.tier == null) fit.tier = 1
    if (fit.signs == null) fit.signs = 0
    if (!fit.zones?.length) fit.zones = blankZones()
    if (!fit.items) fit.items = []
    if (fit.redesigned == null) fit.redesigned = false
  }
  return applyCeilings(fit)
}

function applyCeilings(fit: TerminalFit): TerminalFit {
  const c = ceilingsFor({
    premade: fit.premade,
    redesigned: fit.redesigned,
    tier: fit.tier,
    items: (fit.items ?? []) as PlacedItem[],
    roomsSecurity: fit.rooms.security,
  })
  fit.capGuests = c.paxCap
  fit.bagAllowance = c.bagAllowance
  fit.secPerMin = c.secPerMin
  return fit
}

function emptyPosted(): Flight['posted'] {
  return {
    landing: false,
    bags: false,
    bagsLoad: false,
    fuel: false,
    catering: false,
    bagDrop: false,
    mx: false,
    deiced: false,
  }
}

function emptyWaiting(partial?: Partial<Flight['waitingOn']>): Flight['waitingOn'] {
  return {
    bags: false,
    bagsLoad: false,
    fuel: false,
    catering: false,
    mx: false,
    deice: false,
    paxOut: 0,
    paxIn: 0,
    ...partial,
  }
}

const ROUTE_CITIES = [
  'Boise',
  'Seattle',
  'Denver',
  'Phoenix',
  'Salt Lake',
  'Portland',
  'Las Vegas',
  'Chicago',
  'Dallas',
  'Oakland',
  'Spokane',
  'Reno',
]

export type ApronInspect =
  | {
      kind: 'flight'
      flightId: string
      callsign: string
      airline: string
      model: string
      destination: string
      activity: string
      next: string
      fuel: number
      catering: number
      gate: string
      mx?: string
    }
  | {
      kind: 'hangar'
      title: string
      occupant: string
      model: string
      remaining: number
      total: number
      blurb: string
    }
  | {
      kind: 'curb'
      title: string
      /** Vehicles at the curb against the stalls that can serve them. */
      loadLabel: string
      pressure: number
      blurb: string
    }

function defaultBranding(): BrandingSave {
  const preset = PRESETS[0]
  const code = suggestCode('Hatchfield')
  return {
    airportName: 'Hatchfield',
    code,
    logo: { ...preset.spec, airportName: 'Hatchfield', code },
    presetId: preset.id,
  }
}

const FINANCING_CATEGORIES = new Set([
  'loan_proceeds',
  'ipo_proceeds',
  'share_sales',
  'share_purchases',
  'refunds',
  'deposits',
  'level_reward',
  'diplomacy_income',
])

const ATC_MAX_GO_AROUNDS = 3
const ATC_DEPARTURE_STARVE_SEC = 30

/** Letter and contract card when a helicopter carrier has no pad. */
export const HELIPAD_NEED = 'Needs a helipad (Build > Airfield)'

/** Relations row while a signed helicopter carrier still has no pad. */
export const HELIPAD_WAIT = 'Waiting on a helipad'

export class Game {
  standingAdvisor: StandingAdvisor = new StandingAdvisor(
    new GameDiplomacyAdapter(
      (id) => this.standingOf(id),
      () => this.signed,
      (id) => this.banThreshold(id),
    ),
  )
  tiles: Tile[][] = emptyTiles()
  fits: TerminalFit[] = []
  cash: number = START_CASH.easy
  difficulty: Difficulty = 'easy'
  site: SiteKind | null = null
  clock = 0
  speed: Speed = 1
  tool: Tool = 'pan'
  facing: 'h' | 'v' = 'h'
  runwayStart: Vec | null = null
  hover: Vec | null = null
  /** Apron hover target for inspect card (flight id or hangar key). */
  hoverInspect: ApronInspect | null = null
  /** Bumps when apron tiles / stamp metadata change — World skips mesh rebuilds otherwise. */
  mapRev = 0
  fuelBrand: FuelBrand | null = null
  fuelLoads = 0
  /** Burger servings on the counter. The catering engine is the shelf. */
  foodShelf = 0
  /** Souvenirs on the counter. The catering engine is the shelf. */
  shopShelf = 0
  /** Last shelf counts pushed into the catering engine. NaN until the first push. */
  private pushedFood = Number.NaN
  private pushedShop = Number.NaN
  /** Food sales through placed outlets (café, fast food, sit-down). */
  foodCourtRevenue = 0
  /** Unique suffix for placed hall item ids. */
  hallItemSeq = 0
  /** Unpaid counter sales, kept for the audit. */
  lostSpend = 0
  /** Checked bags that disappeared. Prefab halls keep this at zero. */
  bagsLost = 0
  /** Late bags and missed connections. Prefab halls stay at zero under normal load. */
  bagsMishandled = 0
  /** Connecting passengers who missed MCT. Not counted as lost. */
  missedConnections = 0
  /** Wear toward a breakdown. Maintenance at or above the safe line holds it. */
  linkWear = { mover: 0, bus: 0 }
  /** A breakdown closes the link until it is repaired. */
  linkDown = { mover: false, bus: false }
  /** Gates the last people-mover breakdown named. */
  strandedGates: string[] = []
  /** Why the link is stopped, for the info submenu. */
  linkExplanation = ''
  /** Cells stamped as the hub-priced links, so pier movers keep their own upkeep. */
  hubLinksBuilt: Record<string, 'people_mover' | 'xferbus' | 'skywalk'> = {}
  private hubLinks: {
    guestId: string
    airlineId: string
    resolveAt: number
    made: boolean
    reason: ConnectionFail
    delayMin: number
    available: number
    needed: number
    mct: number
    bagMin: number
  }[] = []
  /** Why connections made or missed. The info panel and the missed-connection alert read this. */
  connectionTally: ConnectionTally = emptyConnectionTally()
  private lastConnectionMiss: ConnectionMissDetail | null = null
  /** 0–1 parade clock for belts and carousels. */
  bagPhase = 0
  /** Screenshot latch so the hall can show the whole chain at once. */
  private bagShow: LuggageMotion | null = null
  private bagBooks = new Map<string, BagBook>()
  private bagTags: BagTag[] = []
  /** Clock time after which an orphaned tag can be dropped. */
  private bagReleaseAt = new Map<string, number>()
  shelfCool = 0
  /** Open info-view submenu. Hotspots stay drawn either way. */
  infoOpen: string | null = null
  private fuelHoldNoted = new Set<string>()
  caterBrand: CaterBrand | null = null
  mealSold = false
  signed: AirlineId[] = []
  offer: ContractOffer | null = null
  offerCool = 12
  /** Clock at the last signature. Not saved; a restored field counts as settled. */
  lastSignAt = -Infinity
  /** Letter ids open or hovered in the HUD; their countdowns pause. UI state, not saved. */
  private heldLetters = new Set<string>()
  mxOffer: MxOffer | null = null
  mxOfferCool = 30
  mxSigned: AirlineId[] = []
  threatCool = 40
  pendingThreat: PendingThreat | null = null
  pendingEmergency: PendingEmergency | null = null
  emergencyCool = 70
  /** Late-game disruptions. Quiet until Field Level 3. Cards go on `alerts`. */
  disruptions = new DisruptionBridge(1)
  /** Live ops events (strikes, outages, bird strikes, VIPs). Quiet for the first days. */
  opsEvents = new OpsEventRunner()
  securityIncidents = 0
  /** Incident count at the last payroll close, so a rising week holds the security slider. */
  private securityIncidentsAtPayroll = 0
  reputation = 40
  /** Smoothed 0–100 figure the reputation HUD reads. */
  reputationShown = 40
  /** Passenger reputation waiting to be applied a little at a time. */
  private reputationDrift = 0
  loanBalance = 0
  /** Game day of the last loan-short reputation dip (one per day). */
  private loanShortDay = -1
  loanProductId: string | null = null
  /** Slider draw that is not a catalog product. Interest uses this row. */
  private drawnLoan: LoanProduct | null = null
  loanPrincipal = 0
  loanOpened = 0
  /** Airport XP — field levels 1–10, then prestige stars. */
  fieldXp = 0
  /** Paths chosen at FL6, FL8, and FL10. Order is the order they were picked. */
  specPaths: SpecPath[] = []
  /** Bought specialization-tree nodes. Order is purchase order. */
  specNodes: string[] = []
  /** Commissioned progression stamps (check-in hall, hydrant, landmark, …). */
  progressionBuilt: string[] = []
  parcels = 1
  /** Owned expansion plots. Empty until the city or factory site is bought. */
  ownedPlots: OwnedPlot[] = []
  /** On-site dorms, apartments, and the staff village. */
  staffHousing = new StaffHousingBridge()
  /** Tracker for achievements and milestones */
  achievements = new AchievementTracker()
  /** Optional outsourced pavement crew. Daily fee, faster repair. */
  maintenanceContract = false
  railLinked = false
  hotelLevel = 0
  carParkShort = false
  carParkLong = false
  /** Stamped park tiles: "c,r" → short/long. */
  parkTerms: Record<string, ParkTerm> = {}
  /** Term used when stamping the next park tile. */
  parkTerm: ParkTerm = 'short'
  /** Stamped hotel tiles: "c,r" → inn / business / resort. */
  hotelClass: Record<string, HotelClass> = {}
  /** Placed hotel, rail link, and SAF blending sites. */
  lateSites: LatePlacement[] = []
  /**
   * Missed-connection guests waiting on a hotel bed.
   * `applyMissedConnections` calls `noteMissedConnectionNights` when the hotel bill posts.
   */
  missedHotelNights = 0
  /** Crew members waiting on a hotel bed. Nothing in the live sim fills this yet. */
  crewHotelNights = 0
  /** Stand tile "c,r" → S/M/L. Missing defaults to M. */
  standClass: Record<string, StandClass> = {}
  /** Stand key → remote bay vs jetway-attached gate. */
  standAccess: Record<string, StandAccess> = {}
  /** Build toggle — next stand stamp is jetway (expensive) or remote. */
  standAccessMode: StandAccess = 'remote'
  /** Stand key "c,r" that has a hydrant pit. Research alone does not set this. */
  standPits: Record<string, true> = {}
  /** Tray arm: the next stand click sinks a pit. */
  hydrantArm = false
  janitors = 0
  janitorCool = 0
  /** Janitors walking the halls — sweep litter, empty cans, service WCs. One per hire. */
  hallJanitors: HallJanitor[] = []
  /** Unique suffix for litter pieces. */
  litterSeq = 0
  /** Seconds until the litter / restroom advisor notes refresh. */
  litterAdviceCool = 0
  /** Seat bookings per hall: seat id → guest id. Not saved; diners re-take them after a load. */
  seatBooks = new Map<string, SeatBook>()
  /** Clock times diners ate standing, per hall, for the seating hint. */
  diningStood = new Map<string, number[]>()
  researchers = 0
  researcherCool = 0
  deskStaff = 0
  deskStaffCool = 0
  /** Premium desks, fast-track lanes, VIP room, and the shared officer roster. */
  premium: PremiumState = createPremiumState()
  hallStaff: HallStaff[] = []
  /** Recent landside touchpoints (exits / day rooms / park cues) for usage meters. */
  landsideUses = 0
  /** Capacity model for the public curb. Rendering reads the snapshot. */
  private landsideTraffic = new LandsideTraffic()
  landsideOpen = false
  landsideFocus: string | null = null
  private landsideNewsCool = 0
  /** Passengers who missed check-in because the curb was late. */
  missedCheckIns = 0
  /** Whole misses not yet taken off a departure's passenger fee. */
  curbFeeMisses = 0
  private curbMissedFrac = 0
  /** Road tankers and the pipeline. Rendering and the farm panel read the snapshot. */
  private fuelChain = new FuelChain()
  /** Bag carts and catering trucks between named sockets. Rendering reads the snapshot. */
  private cartYard = new CartYard()
  private cartPosted = new Set<string>()
  fuelOpen = false
  private fuelRoadLoad = 0
  private fuelJustDelivered = false
  /** Passenger landside fees collected since last payroll window (HUD). */
  landsideFeeWindow = 0
  /** Planner filter: null = all banks; 0..n-1 = that strip; -1 = tower-auto only. */
  plannerRwFilter: number | null = null
  /** Accumulated sim-seconds lost to apron congestion (news when > threshold). */
  congWasteAcc = 0
  congNewsCool = 0
  /** Peak live congestion count near moving traffic (HUD jam line). */
  congPeak = 0
  /** Freight units staged at the cargo shed (city truck intake). */
  cargoWarehouse = 0
  /** Cooldown between city cargo truck spawns. */
  cityCargoCool = 8
  /** New Game focus — biases starter kit + early letters. */
  startFocus: StartFocus = 'pax'
  /** Dev sandbox — unlimited money. Off on the title; that choice is standard cash. */
  sandbox = false
  /** Active cargo volume window letter. */
  cargoVolume: CargoVolumeJob | null = null
  cargoVolumeCool = 40
  interestCool = 60
  /** Throttle loan interest news so the ticker doesn't flood. */
  loanNewsCool = 0
  public = false
  sharePrice = 0
  sharesOwned = 0
  sharesFloat = 0
  ipoPrice = 0
  marketCool = 8
  analystCool = 55
  mission: MarketMission | null = null
  revenueWindow = 0
  budgets: Budgets = { ...DEFAULT_BUDGETS }
  mechanics = 0
  /** Heavy-check hangar and cargo night hub. Tiles are the source of what is built. */
  tier3: Tier3Session = new Tier3Session()
  /** Site power capacity. Tier I is the city feed; II and III are bought upgrades. */
  powerPlantTier: PowerPlantTier = 1
  /** One-shot camera target. The world pans here once, then clears it. */
  cameraCue: { c: number; r: number } | null = null
  /** Cached stand → bay polylines so a check does not recompute or jump paths. */
  private mroRoutes = new Map<string, TaxiPoint[]>()
  private mroBound = new Set<string>()
  runwayCondition = 100
  weather: Weather = 'clear'
  weatherCool = 45
  /**
   * Extra holiday demand on top of the season calendar.
   * The calendar already peaks Summer Getaway and Winter Holidays; this hook
   * multiplies those (or any active holiday id) again.
   */
  holidayPeakHook: HolidayPeakHook = defaultHolidayPeak
  /** New-game climate. Temperate keeps today's calendar, weather roll, and ramp. */
  mapId: MapId = 'temperate'
  mapChallenges: Record<string, number> = {}
  /** Snow sample pushed into winter ops, when that module is installed. */
  winterOps: WinterOpsReading | null = null
  private mapClimateKey = ''
  payrollCool = 30
  /** Completed game days already billed. Payroll and the city levy close once per day. */
  payrollDay = 0
  /** Year-end card: finance plus disruption, hub, and award counters. */
  playtestYear = new YearPlaytestBook()
  /** Sim-clock of the last city levy. Kept so older saves do not bill a backlog. */
  levyMark = 0
  /** Categorized journal. Opening balance is the starting cash. Every later cash move posts here. */
  bank = new Bank(0)
  /** Player fee card. Defaults match the live catalog, so an untouched field bills the same. */
  fees: FeeSchedule = { ...DEFAULT_FEE_SCHEDULE }
  /** Deposit tier applied to the next signature. */
  depositTier: CommercialDepositTier = 'standard'
  deposits: Record<string, HeldDeposit> = {}
  commercialLead: Record<string, AirlineLead> = {}
  /** Standing points already applied for the current fee level. */
  feeStandingApplied = 0
  /** Tenant leases, ad campaigns, year report, and awards. */
  tycoon = new TycoonEngine()
  simClock = new SimClock()
  private economy: EconomyAdapter | null = null
  private economyState: EconomyState | null = null
  private economyView: EconomySnapshot | null = null
  branding: BrandingSave = defaultBranding()
  private ambience: AmbienceMixer | null = null
  crashCool = 8
  /** Ground traffic control: taxi reservations and runway locks. */
  atc = new GroundControl()
  /**
   * Slots the seeder pushed later than the airline asked for today, because
   * the strip's arrival gap was already taken. Resets each sim day.
   */
  runwayDeferred = 0
  /** Same count, never reset, so a playtest can report the whole run. */
  runwayDeferredTotal = 0
  /** Slots the seeder tried to book today. */
  runwayRequested = 0
  /** Slots that kept the time the airline asked for today. */
  runwayBooked = 0
  private runwayDeferDay = 0
  /** Valid only while `runwayLoadOpen` is set, for the current tick. */
  private runwayLoadOpen = false
  private runwayLoadCache: {
    strips: number
    lanes: number
    capacity: number
    scheduled: number
    gapSec: number
    overbooked: boolean
    deferred: number
    requested: number
    booked: number
  } | null = null
  private operableStripCache: { rev: number; indexes: number[] } | null = null
  /** Path each aircraft was last cleared along (by identity). */
  private atcPaths = new Map<string, Vec[]>()
  private atcYields = new Map<string, number>()
  /** Stall ladder. Timing is pure; this class only applies each step. */
  private stuckWatch = new StuckWatchdog()
  /** Recoveries logged by the ladder. The debug HUD reads the count. */
  recoveryCount = 0
  recoveryLog: RecoveryLogEntry[] = []
  /** Watchdog steps that wrote a coordinate. Hold-short rolls or waits, so this stays 0. */
  recoveryJumps = 0
  /** Corner debug readout. The shell turns it on in dev builds. */
  debugHud = false
  /** Headless soaks turn this off so the periodic save does not run. */
  autosave = true
  /** Real crash write-offs; the only source of crashFlight charges. */
  crashes = 0
  fireIncidentCool = 60
  milAgreement = false
  milCool = 55
  ambuCool = 70
  extraAirlines: Airline[] = []
  airlineHeat: Record<string, number> = {}
  airlineBanUntil: Record<string, number> = {}
  /** One-time persona perk unlocked at high heat. */
  airlineReward: Record<string, AirlineRewardId> = {}
  /** Warned once before abandon clock starts biting. */
  airlineWarned: Record<string, boolean> = {}
  /** Accrued sim-seconds under abandon heat threshold. */
  airlineLowAcc: Record<string, number> = {}
  researchUnlocked: ResearchId[] = []
  /** Relationship scores and CEO cards. Research points live on the Growth tree. */
  wave3 = new Wave3Engine()
  /** Flight and slot ids already scored, so a divert cannot also count as a departure. */
  private wave3Noted = new Set<string>()
  /** The only research wallet. Desk projects and Wave 3 nodes are grants on this tree. */
  researchTree = new ResearchEngine()

  get researchPoints(): number {
    return this.researchTree.state.points
  }

  set researchPoints(value: number) {
    if (!Number.isFinite(value)) return
    this.researchTree.state.points = value
  }
  /** Signed volume contract. Empty means spot tankers, not a silent Apex term. */
  contractId: string | null = null
  /** Phone card for one Apex spot tanker. */
  spotOffer: SpotOffer | null = null
  /** Litres on the road at the spot price. They join tankLitres on arrival. */
  spotInbound: SpotInbound | null = null
  /** Litres drawn onto wings today, against the term band. */
  termUpliftLitres = 0
  /** Sim seconds before another spot card. */
  spotCool = 0
  /** Standing points per fuel supplier. Not the airline diplomacy track. */
  supplierStanding: Record<string, number> = {}
  /** Spot index as a fraction of the rack price. Terms do not use it. */
  fuelIndex = 0
  /** Game minutes left on a pipeline quality hold. */
  pipelineHoldMinutes = 0
  /** Game minutes of open flow before the next hold. */
  pipelineCoolMinutes = pipelineIntervalMinutes()
  /** Game minutes already waited on the barge parcel. */
  bargeMinutes = 0
  private lastPipelineFlowing = false
  private lastBargeEmpty = false
  tankTier: 1 | 2 | 3 = 1
  tankLitres = 0
  fuelSupply: FuelSupply = 'road'
  roadMinutes = 0
  scaleFleet: Partial<Record<VehicleType, number>> = {}
  bagSystem: BagSystemId = 'carts'
  paxDesks = 2
  paxKiosks = 0
  paxBagDrops = 0
  scannerLanes = 1
  eGates = 0
  standScale: Record<string, SizeTier> = {}
  /** Stand key → light / narrow / heavy. Written beside class so old saves still park. */
  standSize: Record<string, StandSize> = {}
  /** Stand key → surface rung. Absent keys are filled once on load. */
  standRung: Record<string, StandRung> = {}
  /** Fittings by host key. A hydrant pit is not stored here. */
  fittings: Record<string, Fitting[]> = {}
  hangarScale: Record<string, SizeTier> = {}
  private lastRailFlowing = false
  layoverOffer: LayoverOffer | null = null
  layoverOfferCool = 50
  layover: LayoverContract | null = null
  layoverSpawnAcc = 0
  /** Successful layover clears per airline — gates Hub tier. */
  layoverWins: Record<string, number> = {}
  hubOffer: HubOffer | null = null
  hubOfferCool = 80
  hubAirlines: AirlineId[] = []
  /** Accepted hub tier per carrier. Unsigned and untouched carriers stay at Station. */
  hubTiers: Record<string, HubTier> = {}
  /** Lounge, gate, hangar, fuel, pad, and ramp counts dedicated to a carrier. Not desks. */
  hubDedicated: Record<string, HubDedicatedCounts> = {}
  /** Lounge rooms, stands, and hangar bays named to one carrier. Not desks. */
  hubLeases: FacilityLease[] = []
  /** Stored tier, and the game day it falls if the released lease is still a gate. */
  hubLeaseWarnings: Record<string, { tier: HubTier; untilDay: number }> = {}
  /** Tiers a letter has already been sent for. A decline does not clear the leases. */
  hubOffered: Record<string, HubOfferTier[]> = {}
  /** Game day the stored tier started. Missing means today, so an old save still waits. */
  hubTierSince: Record<string, number> = {}
  /** Tugs, belt loaders, catering trucks, and fuel trucks named to one carrier. */
  hubVehicleLeases: VehicleLease[] = []
  /** Game day a rival will next consider a new contract. */
  hubRivalRefuse: Record<string, number> = {}
  /** Game day a rival may be seeded onto the board again. */
  hubRivalQuiet: Record<string, number> = {}
  /** Phone notes for a carrier who left for Bellwater. */
  hubRivalPhone: { id: string; name: string; text: string }[] = []
  /** Warmth texts. Decline records the step. Later only drops the card. */
  hubNudges: { airlineId: string; step: string; text: string }[] = []
  hubNudgeSilenced: { airlineId: string; step: string }[] = []
  hubNudgeLast: Record<string, number> = {}
  hubNudgeSentDay = -1
  hubNudgesSent = 0
  hubFerryDay: Record<string, number> = {}
  hubDeepLinkTick = 0
  hubDeepLinkAirline = ''
  /** Bumps when a warmth text opens the desk assign panel. Not saved. */
  hubAssignTick = 0
  /** Bumps when a phone button should fold the handset. Not saved. */
  phoneFold = 0
  /** Test override for the one Accept roll. Null uses the holder, tier, and day. */
  hubRivalRoll: number | null = null
  parkingOffer: ParkingOffer | null = null
  parkingCool = 65
  /** Day-rate cool for independent parked GA. */
  parkRateCool = 0
  schedule: ScheduleSlot[] = []
  /** Per-slot departure show-up. Passengers release before the aircraft exists. */
  showUps: ShowUpPlan[] = []
  /** Common desks the player locked to one airline. They stay branded and are never shared. */
  dedicatedDesks: { deskId: string; airlineId: AirlineId; mode?: 'preferred' | 'dedicated' }[] = []
  /** Last under-desk refusal, so a held letter does not reprint the news every tick. */
  private checkinBlockNote = ''
  /** Seeded mix and leads. The hall stamps these onto the entrance cap. */
  private paxAdapter: PaxShowUpAdapter = createPaxShowUpAdapter(0x5382)
  /** Flights that have left the field. The boarding call stays up until those passengers are aboard or miss. */
  private departedFlights = new Set<string>()
  scheduleAuto = true
  schedulePlanCool = 8
  /** Rate-limit hall miss headlines: key → clock ready. */
  hallMissCool: Record<string, number> = {}
  flights: Flight[] = []
  trucks: Truck[] = []
  people: Person[] = []
  hallGuests: HallGuest[] = []
  /** Room plans for the current map, shared with the terminal renderer (same seed). */
  private terminalPlans: {
    rev: number
    entries: { key: string; cells: { c: number; r: number }[]; plan: RoomPlan }[]
  } | null = null
  news: News[] = []
  /** Repairs and flags from the last load. A flagged field means that load was refused. */
  lastSaveIssues: SaveIssue[] = []
  selectedFlight: string | null = null
  selectedTile: Vec | null = null
  selectedGuest: string | null = null
  /** Clicked desk, lane, shop, or queue marker inside the terminal. */
  selectedFacility: string | null = null
  /** Cell key of the building open in the left info panel. Not saved. */
  selectedBuilding: string | null = null
  /** Bumps when the hall layout changes so the HUD repaints. */
  hallRev = 0
  /** Curb-to-boarding walkers for the active hall (src/paxnav), drawn by the Terminal view. */
  readonly hallNav = new HallNav()
  private secSeq = 1
  view: 'apron' | 'hall' = 'apron'
  spawnCool = 8
  heloCool = 22
  /** Gap between signed helicopter spawns. Does not hold the runway. */
  contractHeloCool = 0
  flightSeq = 100
  flightsDone = 0
  paxServed = 0
  revenue = 0
  /** Positive payment lines kept after a turn leaves the field. */
  settledPayments: { flightNo: string; label: string; amount: number }[] = []
  /** Layout notes. Empty on a healthy prefab until the hall is over capacity. */
  advice: Advice[] = []
  advisorCells: { c: number; r: number }[] = []
  /** Apron tiles highlighted by a ground-services note (fuel farm, kitchen, depot). */
  apronFocus: { c: number; r: number }[] = []
  /** Hint switches for this game. Saved, and mirrored to settings. */
  hintPrefs: HintPrefs = newGameHintPrefs()
  /** Stuck-state tip chips. Separate from hints, letters, and alerts. */
  tipBook: TipBook = newTipBook()
  tipVisible: TipOffer[] = []
  /** Pregame "Start with hints off" box, inverted. Read once by beginNew. */
  enableHintsAtStart = true
  /** Live operational problems (stuck aircraft, fuel out, full hall, disruptions, ...). */
  alerts = new AlertStack()
  private alertScanCool = 0
  /** One side panel at a time: the HUD rollout or the hint list. */
  sidePanel: 'hud' | 'hints' | null = null
  /** Where "Show me" / "Pan to problem" last asked the camera to go. Renderers ease toward it. */
  camGoal: { view: 'apron' | 'hall'; c: number; r: number; seq: number } | null = null
  /** Terminal-plan hints, recomputed only when the hall layout changes. */
  private planAdvice: { key: string; list: Advice[] } = { key: '', list: [] }
  /** An apron build or bulldoze happened; refresh the advisor on the next frame. */
  private adviceDirty = false
  /** Ground-logistics ledger. Posted into cash as it happens. */
  groundBooks = {
    fuelSales: 0,
    cateringFees: 0,
    fuelPurchase: 0,
    mealProduction: 0,
    vehicleUpkeep: 0,
    shopSales: 0,
    shopLost: 0,
    cargoRevenue: 0,
    cargoPenalties: 0,
  }
  private ground: (LogisticsAdapter & { sim: LogisticsSim; completed: TurnaroundResult[] }) | null = null
  private groundRev = -1
  private groundPowerKey = ''
  private groundAnnounced = false
  private groundNotes: Advice[] = []
  private groundNoteKey = ''
  private cargoNotes: Advice[] = []
  /** Recent sound names, for the apron audio cues. */
  soundCues: string[] = []
  private cashChimeAt = -99
  private alertChimeAt = -99
  private catering: CateringBridge | null = null
  private cargo: CargoBridge | null = null
  /** Airline letters, standing, and turnaround grades. Null until the clock runs. */
  private diplomacy: DiplomacyBridge | null = null
  diplomacySeed = 1
  /** Published landing-fee index. 1 is the schedule. Diplomacy reads rises and cuts. */
  publishedFeeIndex = 1
  /** Seconds left on a first-meet terminal walk. The field pans while this is above zero. */
  diplomacyTourSeconds = 0

  beginDiplomacyTour(seconds = 6) {
    this.diplomacyTourSeconds = seconds
  }
  private missedByAirline: Record<string, number> = {}
  /** Contract counter-offers. Null until the first letter. */
  private negotiationBridge: NegotiationBridge | null = null
  /** Bellwater price war. Null until the first day on an owned field. */
  private priceWar: PriceWar | null = null
  /** Inbound offers and Guard contracts. Null until the clock or a card needs it. */
  private inbound: InboundBridge | null = null
  /** Set for the duration of a clearance purchase so a second click cannot post another charge. */
  private clearanceBusy = false
  /** Bellwater Intl. Headless; null until the field exists. */
  private rival: RivalAirport | null = null
  private rivalWalkaways: Walkaway[] = []
  /** Passenger-flow overlay. Hidden until the player opts in. */
  showFlows = false
  /** True once a wave exceeds this hall's queue or passenger cap. */
  hallOverloaded = false
  /** Sim clock before which the over-capacity hint stays dismissed. */
  capacityHintUntil = 0
  /** Guest cap recorded when the hall last went over, so an expansion can clear it. */
  private overloadCap = 0
  missedFlights = 0
  private queueDelayFlight = new Set<string>()
  sites: BuildSite[] = []
  /** Session tally of craft roles that landed — for the fleet strip. */
  craftSeen: Partial<Record<AircraftKind, number>> = {}
  listeners = new Set<() => void>()
  saveTimer = 0
  uiAcc = 0
  patrolCool = 0
  mechanicCool = 0
  /** First-session coach card dismissed (or auto-cleared after first takeoff). */
  coachDismissed = false
  /** The player opened the build tray (picked a tool other than pan). */
  buildTrayOpened = false
  private firstTakeoffNoted = false
  /** Active airline field ask (CEO-style task clock). */
  fieldTask: FieldTask | null = null
  fieldTaskCool = 28
  /** Extra quiet after an ask closes on the opening days. Ticks down with the cooldown. */
  private fieldAskQuiet = 0
  /** Clock time before a declined kind may be asked again. */
  private fieldAskPassed = new Map<FieldTaskKind, number>()
  /** Field asks already paid for. A second Build click does not spend again. */
  private fieldAskSpent = new Set<string>()
  /**
   * Letters the player put away with Later. Keyed so a new ask (new id) can appear,
   * while Later on the same field letter does not bring it straight back.
   */
  ackedLetters: string[] = []
  /** Player chose to build the first field by hand, releasing the kit budget. */
  starterFreehand = false
  /** The starter kit has been paid for. The button stays hidden after that. */
  starterKitStamped = false
  /** Night curfew news / slip rate-limit. */
  nightCurfewCool = 0
  /** Rate-limit cascade headlines so the ticker stays readable. */
  cascadeNewsCool = 0
  /** While storming, pulse a bank slip so weather stays legible. */
  stormPulseCool = 0
  /** One point per in-game hour (7.5s). Charts read this; not saved. */
  econHist: {
    t: number
    cash: number
    income: number
    expense: number
    pax: number
    cargo: number
  }[] = []
  econHour = 0
  hourIncome = 0
  hourExpense = 0
  dayPax = 0
  dayCargo = 0
  /** Income and expense since the last day close. Scenario profit days read the difference. */
  dayIncome = 0
  dayExpense = 0
  dayMark = 0
  /** Opt-in scenario. Null until the player starts one from the Field Levels sheet. */
  scenarioRun: ScenarioRun | null = null
  scenarioNoPlots = false
  scenarioCurfew = false
  scenarioMaxRunwayM: number | null = null
  /** Night-hub revenue already scored, so a later day only counts the new takings. */
  scenarioNightMark = 0
  /** Cash earned in the latest finished hour. */
  incomePerHour = 0
  /** Pax / cargo cleared on the last finished day (180s). */
  paxPerDay = 0
  cargoPerDay = 0

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Mid-tick emits collapse into one HUD pass so React does not render per guest. */
  private suppressEmit = 0
  private emitWaiting = false

  emit() {
    if (this.suppressEmit > 0) {
      this.emitWaiting = true
      return
    }
    this.flushEmit()
  }

  private flushEmit() {
    this.emitWaiting = false
    for (const fn of this.listeners) fn()
  }

  private endEmitHold() {
    this.suppressEmit = Math.max(0, this.suppressEmit - 1)
    if (this.suppressEmit === 0 && this.emitWaiting) this.flushEmit()
  }

  beginNew(difficulty: Difficulty) {
    this.difficulty = difficulty
    this.cash = this.sandbox ? SANDBOX_CASH : START_CASH[difficulty]
    this.site = null
    this.tiles = emptyTiles()
    this.fits = []
    this.clock = 0
    this.speed = 0
    this.tool = 'pan'
    this.facing = 'h'
    this.fuelBrand = null
    this.fuelLoads = 0
    this.foodShelf = 0
    this.shopShelf = 0
    this.foodCourtRevenue = 0
    this.lostSpend = 0
    this.bagsLost = 0
    this.bagsMishandled = 0
    this.missedConnections = 0
    this.linkWear = { mover: 0, bus: 0 }
    this.linkDown = { mover: false, bus: false }
    this.strandedGates = []
    this.linkExplanation = ''
    this.hubLinksBuilt = {}
    this.hubLinks = []
    this.connectionTally = emptyConnectionTally()
    this.lastConnectionMiss = null
    this.bagPhase = 0
    this.bagShow = null
    this.bagBooks.clear()
    this.bagTags = []
    this.bagReleaseAt.clear()
    this.shelfCool = 0
    this.infoOpen = null
    this.fuelHoldNoted.clear()
    this.caterBrand = null
    this.mealSold = false
    this.signed = []
    this.offer = null
    this.offerCool = 8
    this.lastSignAt = -Infinity
    this.mxOffer = null
    this.mxOfferCool = 30
    this.mxSigned = []
    this.threatCool = 45
    this.pendingThreat = null
    this.pendingEmergency = null
    this.emergencyCool = 70
    this.congWasteAcc = 0
    this.congNewsCool = 0
    this.congPeak = 0
    this.cargoWarehouse = 0
    this.cityCargoCool = 8
    this.startFocus = 'pax'
    this.cargoVolume = null
    this.cargoVolumeCool = 40
    this.loanNewsCool = 0
    this.securityIncidents = 0
    this.securityIncidentsAtPayroll = 0
    this.reputation = 40
    this.reputationShown = 40
    this.reputationDrift = 0
    this.landsideTraffic.reset()
    this.landsideOpen = false
    this.landsideFocus = null
    this.landsideNewsCool = 0
    this.missedCheckIns = 0
    this.curbFeeMisses = 0
    this.curbMissedFrac = 0
    this.fuelChain.reset()
    this.fuelOpen = false
    this.fuelRoadLoad = 0
    this.fuelJustDelivered = false
    this.loanBalance = 0
    this.loanProductId = null
    this.drawnLoan = null
    this.fieldAskSpent.clear()
    this.loanPrincipal = 0
    this.loanOpened = 0
    this.fieldXp = 0
    this.specPaths = []
    this.specNodes = []
    this.progressionBuilt = []
    this.parcels = 1
    this.ownedPlots = []
    this.staffHousing.reset()
    this.maintenanceContract = false
    this.railLinked = false
    this.hotelLevel = 0
    this.carParkShort = false
    this.carParkLong = false
    this.parkTerms = {}
    this.parkTerm = 'short'
    this.hotelClass = {}
    this.lateSites = []
    this.missedHotelNights = 0
    this.crewHotelNights = 0
    this.standClass = {}
    this.standAccess = {}
    this.standAccessMode = 'remote'
    this.standPits = {}
    this.standSize = {}
    this.standRung = {}
    this.fittings = {}
    this.hydrantArm = false
    this.janitors = 0
    this.janitorCool = 0
    this.hallJanitors = []
    this.litterSeq = 0
    this.litterAdviceCool = 0
    this.seatBooks.clear()
    this.diningStood.clear()
    this.researchers = 0
    this.researcherCool = 0
    this.deskStaff = 0
    this.deskStaffCool = 0
    this.hallStaff = []
    this.dedicatedDesks = []
    this.premium = createPremiumState()
    this.landsideUses = 0
    this.landsideFeeWindow = 0
    this.interestCool = 60
    this.public = false
    this.sharePrice = 0
    this.sharesOwned = 0
    this.sharesFloat = 0
    this.ipoPrice = 0
    this.marketCool = 8
    this.analystCool = 55
    this.mission = null
    this.revenueWindow = 0
    this.budgets = { ...DEFAULT_BUDGETS }
    this.mechanics = 0
    this.runwayCondition = 100
    this.weather = 'clear'
    this.weatherCool = 45
    this.holidayPeakHook = defaultHolidayPeak
    this.mapId = 'temperate'
    this.mapChallenges = {}
    this.winterOps = null
    this.mapClimateKey = ''
    this.payrollCool = 30
    this.payrollDay = 0
    this.playtestYear.reset(0)
    this.levyMark = 0
    this.bank = new Bank(this.sandbox ? 0 : this.cash)
    this.fees = { ...DEFAULT_FEE_SCHEDULE }
    this.depositTier = 'standard'
    this.deposits = {}
    this.commercialLead = {}
    this.feeStandingApplied = 0
    this.tycoon.reset(1)
    this.simClock = new SimClock()
    this.economy = null
    this.economyState = null
    this.economyView = null
    this.branding = defaultBranding()
    this.ambience?.stopAll(0)
    this.ambience = null
    this.crashCool = 8
    this.crashes = 0
    this.fireIncidentCool = 60
    this.milAgreement = false
    this.milCool = 55
    this.ambuCool = 70
    this.extraAirlines = []
    this.airlineHeat = {}
    this.airlineBanUntil = {}
    this.airlineReward = {}
    this.airlineWarned = {}
    this.airlineLowAcc = {}
    this.researchUnlocked = []
    this.wave3 = new Wave3Engine()
    this.wave3Noted.clear()
    this.researchTree = new ResearchEngine()
    this.researchPoints = 0
    this.resetPillar()
    this.layoverOffer = null
    this.layoverOfferCool = 50
    this.layover = null
    this.layoverSpawnAcc = 0
    this.layoverWins = {}
    this.hubOffer = null
    this.hubOfferCool = 80
    this.hubAirlines = []
    this.hubTiers = {}
    this.hubDedicated = {}
    this.hubLeases = []
    this.hubLeaseWarnings = {}
    this.hubOffered = {}
    this.hubTierSince = {}
    this.hubVehicleLeases = []
    this.hubRivalRefuse = {}
    this.hubRivalQuiet = {}
    this.hubRivalPhone = []
    this.hubNudges = []
    this.hubNudgeSilenced = []
    this.hubNudgeLast = {}
    this.hubNudgeSentDay = -1
    this.hubNudgesSent = 0
    this.hubFerryDay = {}
    this.hubDeepLinkTick = 0
    this.hubDeepLinkAirline = ''
    this.hubAssignTick = 0
    this.phoneFold = 0
    this.hubRivalRoll = null
    this.parkingOffer = null
    this.parkingCool = 65
    this.parkRateCool = 0
    this.schedule = []
    this.runwayDeferred = 0
    this.runwayDeferredTotal = 0
    this.runwayRequested = 0
    this.runwayBooked = 0
    this.runwayDeferDay = 0
    this.runwayLoadCache = null
    this.showUps = []
    this.paxAdapter = createPaxShowUpAdapter(0x5382)
    this.scheduleAuto = true
    this.schedulePlanCool = 8
    this.hallMissCool = {}
    this.flights = []
    this.trucks = []
    this.people = []
    this.hallGuests = []
    this.news = []
    this.selectedFlight = null
    this.selectedTile = null
    this.selectedGuest = null
    this.selectedBuilding = null
    this.view = 'apron'
    this.spawnCool = 10
    this.heloCool = 22
    this.contractHeloCool = 0
    this.flightSeq = 100
    this.flightsDone = 0
    this.paxServed = 0
    this.revenue = 0
    this.settledPayments = []
    this.advice = []
    this.advisorCells = []
    this.apronFocus = []
    this.groundBooks = {
      fuelSales: 0,
      cateringFees: 0,
      fuelPurchase: 0,
      mealProduction: 0,
      vehicleUpkeep: 0,
      shopSales: 0,
      shopLost: 0,
      cargoRevenue: 0,
      cargoPenalties: 0,
    }
    this.ground = null
    this.groundRev = -1
    this.groundPowerKey = ''
    this.groundAnnounced = false
    this.groundNotes = []
    this.groundNoteKey = ''
    this.cargoNotes = []
    this.soundCues = []
    this.catering = null
    this.pushedFood = Number.NaN
    this.pushedShop = Number.NaN
    this.cargo = null
    this.diplomacy = null
    this.diplomacySeed = 1
    this.publishedFeeIndex = 1
    this.missedByAirline = {}
    this.negotiationBridge = null
    this.priceWar = null
    this.inbound = null
    this.rival = null
    this.rivalWalkaways = []
    this.disruptions = new DisruptionBridge(this.diplomacySeed)
    this.opsEvents.reset()
    this.hallOverloaded = false
    this.missedFlights = 0
    this.queueDelayFlight = new Set()
    this.sites = []
    this.tier3 = new Tier3Session()
    this.powerPlantTier = 1
    this.cameraCue = null
    this.mroRoutes = new Map()
    this.mroBound = new Set()
    this.craftSeen = {}
    this.mechanicCool = 0
    this.coachDismissed = false
    this.buildTrayOpened = false
    // New games start with All hints enabled unless the pregame box was unchecked.
    this.hintPrefs = newGameHintPrefs(this.enableHintsAtStart)
    writeHintSettings(this.hintPrefs)
    this.tipBook = newTipBook()
    this.tipVisible = []
    this.alerts.reset()
    this.alertScanCool = 0
    this.sidePanel = null
    this.camGoal = null
    this.planAdvice = { key: '', list: [] }
    this.firstTakeoffNoted = false
    this.fieldTask = null
    this.fieldTaskCool = 28
    this.fieldAskQuiet = 0
    this.fieldAskPassed.clear()
    this.ackedLetters = []
    this.starterFreehand = false
    this.starterKitStamped = false
    this.nightCurfewCool = 0
    this.cascadeNewsCool = 0
    this.stormPulseCool = 0
    this.econHist = []
    this.econHour = 0
    this.hourIncome = 0
    this.hourExpense = 0
    this.dayPax = 0
    this.dayCargo = 0
    this.dayIncome = 0
    this.dayExpense = 0
    this.dayMark = 0
    this.scenarioRun = null
    this.scenarioNoPlots = false
    this.scenarioCurfew = false
    this.scenarioMaxRunwayM = null
    this.scenarioNightMark = 0
    this.incomePerHour = 0
    this.paxPerDay = 0
    this.cargoPerDay = 0
    // Drop the previous field so a refresh on the route screen cannot resume it.
    this.lastSaveIssues = []
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* node / private mode */
    }
    try {
      sessionStorage.setItem(
        'hatchfield-pending',
        JSON.stringify({
          sandbox: this.sandbox,
          difficulty: this.difficulty,
          enableHints: this.enableHintsAtStart,
          mapId: this.mapId,
        }),
      )
    } catch {
      /* node / private mode */
    }
  }

  /** Climate for a new field. Safe before the plot is bought. */
  setMap(id: MapId) {
    const next = parseMapId(id)
    if (next !== this.mapId) {
      this.mapId = next
      if (!this.site) this.mapChallenges = {}
      this.mapClimateKey = ''
      this.economy?.engine.setCalendar(demandCalendar(this.mapId))
      this.refreshWinter()
    }
    this.rememberPending()
    this.emit()
  }

  private rememberPending() {
    if (this.site) return
    try {
      sessionStorage.setItem(
        'hatchfield-pending',
        JSON.stringify({
          sandbox: this.sandbox,
          difficulty: this.difficulty,
          enableHints: this.enableHintsAtStart,
          mapId: this.mapId,
        }),
      )
    } catch {
      /* node / private mode */
    }
  }

  gameDay(): number {
    return Math.floor(Math.max(0, this.clock) / 180)
  }

  /** Sky and farmland tint. Null on the temperate map. */
  get mapDraw(): MapDraw | null {
    return fieldDraw(this.mapId, this.gameDay())
  }

  mapEngineDerate(): number {
    return engineDerate(this.mapId, this.gameDay())
  }

  mapGoalCards(): ChallengeCard[] {
    return challengeCards(this.mapId, this.mapChallenges)
  }

  mapSummary(): { name: string; region: string; season: string; blurb: string } {
    const map = mapById(this.mapId)
    const season = seasonOn(map, this.gameDay())
    return { name: map.name, region: map.region, season: season?.name ?? map.name, blurb: map.blurb }
  }

  climateCaption(): string {
    const line = climateCaption(this.mapId, this.gameDay(), this.weather)
    if (this.winterOps?.needsDeicing) return `${line} · De-ice`
    return line
  }

  private refreshWinter() {
    this.winterOps = feedWinterOps(winterForecast(this.mapId, this.gameDay(), this.weather))
  }

  private noteMapClimate() {
    this.refreshWinter()
    if (this.mapId === 'temperate' || !this.site) return
    const binding = environmentBinding(this.mapId, this.gameDay())
    const key = `${binding.season.id}|${binding.activeHolidays.map((holiday) => holiday.id).join(',')}`
    if (key === this.mapClimateKey) return
    const first = this.mapClimateKey === ''
    this.mapClimateKey = key
    if (first) return
    const holiday = binding.activeHolidays.map((item) => item.name).join(' and ')
    this.pushNews(
      holiday
        ? `${binding.season.name} · ${holiday} peak on the board.`
        : `${binding.season.name} has started.`,
      'ok',
    )
  }

  private noteMapGoals(pax: number) {
    const map = mapById(this.mapId)
    const season = seasonOn(map, this.gameDay())
    const next = accrueChallenges(this.mapId, this.mapChallenges, {
      pax,
      seasonId: season?.id ?? null,
      holidayIds: holidaysOn(map, this.gameDay()).map((holiday) => holiday.id),
      heat: engineDerate(this.mapId, this.gameDay()) > 1,
    })
    this.mapChallenges = next
  }

  /** Morning checklist — hides once dismissed or after the first takeoff. */
  coachSteps(): { id: string; label: string; done: boolean }[] {
    const hasStrip = runwayStrips(this.tiles, MIN_RUNWAY).length > 0
    const hasStand = tilesOf(this.tiles, 'stand').length > 0
    const fieldUp = hasStrip && hasStand
    const signed = this.signed.length > 0
    const inbound = this.flights.some(
      (f) =>
        (f.craft ?? 'jet') === 'jet' &&
        !['gone', 'takeoff'].includes(f.phase),
    )
    const turned = this.flightsDone >= 1
    const cargoFocus = this.startFocus === 'cargo'
    const hasGuard = tilesOf(this.tiles, 'guard').length > 0
    const hasShed = tilesOf(this.tiles, 'cargo').length > 0
    return [
      {
        id: 'field',
        label: fieldUp
          ? cargoFocus
            ? 'Cargo field stamped (strip + stand)'
            : 'Field stamped (strip + stand)'
          : cargoFocus
            ? 'Stamp Cargo starter kit (shed + guard + stand)'
            : 'Stamp Starter kit (or your own strip + stand)',
        done: fieldUp,
      },
      ...(cargoFocus
        ? [
            {
              id: 'pipeline',
              label:
                hasGuard && hasShed
                  ? 'Guard → shed pipeline live'
                  : 'Need guard post + cargo shed on the road',
              done: hasGuard && hasShed,
            },
          ]
        : []),
      {
        id: 'sign',
        label: signed
          ? `Signed ${this.signed.length} airline(s)`
          : cargoFocus
            ? 'Sign UPPS / cargo when they call'
            : 'Sign an airline when they call',
        done: signed,
      },
      {
        id: 'inbound',
        label: inbound || turned
          ? cargoFocus
            ? 'Freighter on the field'
            : 'Jet on the field'
          : cargoFocus
            ? 'Wait for the first freighter (try 3x)'
            : 'Wait for the first inbound (try 3x)',
        done: inbound || turned,
      },
      {
        id: 'turn',
        label: turned
          ? 'First takeoff in the book'
          : cargoFocus
            ? 'Uplift freight — warehouse → freighter → airborne'
            : 'Turn a flight — trucks + pax, then airborne',
        done: turned,
      },
    ]
  }

  showCoach(): boolean {
    if (this.coachDismissed || !this.site) return false
    if (this.flightsDone >= 1) return false
    return true
  }

  dismissCoach() {
    this.coachDismissed = true
    this.emit()
  }

  fieldTaskMet(kind: FieldTaskKind): boolean {
    const fit = this.activeHall()
    const rooms = fit?.rooms
    switch (kind) {
      case 'bathroom':
        return (rooms?.bathroom ?? 0) > 0
      case 'food':
        return (rooms?.food ?? 0) > 0 || tilesOf(this.tiles, 'snack').length > 0
      case 'fire':
        return tilesOf(this.tiles, 'fire').length > 0
      case 'desk':
        return this.deskStaff >= 1
      case 'police':
        return tilesOf(this.tiles, 'police').length > 0
      case 'hangar':
        return tilesOf(this.tiles, 'hangar').length > 0
      case 'janitor':
        return this.janitors >= 1
      case 'cargo':
        return tilesOf(this.tiles, 'cargo').length > 0
      case 'helipad':
        return tilesOf(this.tiles, 'helipad').length > 0
      case 'hotel':
        return this.hotelLevel > 0 || tilesOf(this.tiles, 'hotel').length > 0
      case 'park':
        return (
          this.carParkShort ||
          this.carParkLong ||
          tilesOf(this.tiles, 'park_s').length > 0 ||
          tilesOf(this.tiles, 'park_l').length > 0 ||
          tilesOf(this.tiles, 'park_g').length > 0 ||
          tilesOf(this.tiles, 'park_u').length > 0
        )
      case 'desk_extra':
        return this.deskStaff >= 2
      default:
        return false
    }
  }

  considerFieldTasks() {
    if (this.fieldTask || this.fieldTaskCool > 0 || this.fieldAskQuiet > 0) return
    if (this.signed.length < 1 || this.flightsDone < 1) return
    const pool = this.signed.filter((id) => !this.isBanned(id))
    if (!pool.length) return
    const airlineId = pick(pool)
    const a = this.airline(airlineId)
    const open = FIELD_TASK_DEFS.filter((d) => {
      if (this.fieldTaskMet(d.kind)) return false
      if ((this.fieldAskPassed.get(d.kind) ?? 0) > this.clock) return false
      return this.fieldAskFeasible(d.kind)
    })
    if (!open.length) return
    const preferred = open.filter((d) => d.personas?.includes(a.persona))
    const pickDef = preferred.length && Math.random() < 0.7 ? pick(preferred) : pick(open)
    this.fieldTask = {
      id: uid('task'),
      airline: airlineId,
      kind: pickDef.kind,
      title: pickDef.title,
      blurb: pickDef.blurb,
      bonus: pickDef.bonus,
      deadline: this.clock + FIELD_TASK_DEADLINE,
      age: 0,
    }
    this.pushNews(
      `${a.name} field ask: ${pickDef.title} — ${Math.round(FIELD_TASK_DEADLINE)}s on the clock.`,
      'ok',
    )
    this.emit()
  }

  tickFieldTask(dt: number) {
    this.fieldTaskCool = Math.max(0, this.fieldTaskCool - dt)
    this.fieldAskQuiet = Math.max(0, this.fieldAskQuiet - dt)
    if (!this.fieldTask) {
      this.considerFieldTasks()
      return
    }
    const t = this.fieldTask
    t.age += dt
    // Clock-based deadline: push it out while the player is reading the letter.
    if (this.letterHeld('field')) t.deadline += dt
    if (this.fieldTaskMet(t.kind)) {
      const a = this.airline(t.airline)
      this.cash += t.bonus
      this.revenue += t.bonus
      this.noteIncome(t.bonus, 'task_rewards')
      this.adjustHeat(t.airline, FIELD_TASK_HEAT_OK)
      this.reputation = Math.min(100, this.reputation + 2)
      this.pushNews(
        `${a.name} ask done — ${t.title}. Bonus ${moneyLeft(t.bonus)}.`,
        'good',
      )
      this.fieldTask = null
      this.fieldTaskCool = FIELD_TASK_COOL
      this.noteFieldAskClosed()
      this.emit()
      return
    }
    if (this.clock >= t.deadline) {
      const a = this.airline(t.airline)
      this.charge(FIELD_TASK_FAIL_FINE, 'task_miss')
      this.noteRelationMiss(t.airline)
      this.adjustHeat(t.airline, FIELD_TASK_HEAT_FAIL)
      this.reputation = Math.max(0, this.reputation - 1.5)
      this.pushNews(
        `${a.name} ask failed — ${t.title}. Fine ${moneyLeft(FIELD_TASK_FAIL_FINE)}.`,
        'bad',
      )
      this.fieldTask = null
      this.fieldTaskCool = FIELD_TASK_COOL + 12
      this.noteFieldAskClosed()
      this.emit()
    }
  }

  /** Opening days wait longer between letters. The fine cooldown itself stays put. */
  private noteFieldAskClosed() {
    if (this.gameDay() >= FIELD_TASK_EARLY_DAYS) return
    this.fieldAskQuiet = Math.max(this.fieldAskQuiet, FIELD_TASK_EARLY_QUIET)
  }

  /**
   * Retire the open field ask now. A small Standing nick, no fine, and the
   * usual cooldown — not the longer one a missed deadline uses.
   */
  declineFieldTask() {
    const task = this.fieldTask
    if (!task) return
    const airline = this.airline(task.airline)
    this.adjustHeat(task.airline, FIELD_TASK_DECLINE_HEAT)
    this.fieldAskPassed.set(task.kind, this.clock + FIELD_TASK_DECLINE_KIND_SEC)
    this.fieldTask = null
    this.fieldTaskCool = FIELD_TASK_COOL
    this.noteFieldAskClosed()
    this.pushNews(`Declined ${airline.name} — ${task.title}. A small Standing nick, no fine.`, 'ok')
    this.emit()
  }

  /** Deadline and the fine the letter charges if the player leaves the ask to expire. */
  fieldAskClockLine(): string {
    if (!this.fieldTask) return ''
    return `${Math.ceil(this.fieldTaskLeft())}s left · fine ${moneyLeft(FIELD_TASK_FAIL_FINE)} if left to expire`
  }

  /** Set the letters the player is reading (open or hovered); their countdowns hold. */
  holdLetters(ids: Iterable<string>) {
    this.heldLetters = new Set(ids)
  }

  letterHeld(id: string): boolean {
    return this.heldLetters.has(id)
  }

  /** Seconds left on the active field ask, if any. */
  fieldTaskLeft(): number {
    if (!this.fieldTask) return 0
    return Math.max(0, this.fieldTask.deadline - this.clock)
  }

  /** Cost of the building or hire a field ask is pointing at. Numbers stay in the catalogs. */
  private quoteFieldTask(kind: FieldTaskKind): {
    cost: number
    label: string
    tool?: Tool
    hire?: 'desk' | 'janitor'
    hallItem?: ItemId
  } {
    const building = (tool: Tool) => {
      const row = BUILDINGS.find((b) => b.tool === tool)
      return { cost: row?.cost ?? 0, label: row?.name ?? tool, tool }
    }
    switch (kind) {
      case 'police':
        return building('police')
      case 'fire':
        return building('fire')
      case 'hangar':
        return building('hangar')
      case 'cargo':
        return building('cargo')
      case 'helipad':
        return building('helipad')
      case 'hotel':
        return building('hotel_inn')
      case 'park':
        return building('park_s')
      case 'food': {
        const cafe = itemDef('cafe')
        return { cost: cafe?.cost ?? 0, label: cafe?.name ?? 'Café', hallItem: 'cafe' }
      }
      case 'bathroom': {
        const toilet = itemDef('toilet')
        return { cost: toilet?.cost ?? 0, label: toilet?.name ?? 'Toilet', hallItem: 'toilet' }
      }
      case 'desk':
      case 'desk_extra':
        return { cost: this.staffHireCost(DESK_STAFF_HIRE), label: 'Desk agent', hire: 'desk' }
      case 'janitor':
        return { cost: this.staffHireCost(JANITOR_HIRE), label: 'Janitor', hire: 'janitor' }
      default:
        return { cost: 0, label: kind }
    }
  }

  /**
   * True when one Build click can finish this ask right now: the till covers
   * the quote, the stamp is unlocked, and the plot (or the hall, or the hire
   * roll) has room. A kind already under construction is left off the list —
   * it will count as done when the crew finishes.
   */
  private fieldAskFeasible(kind: FieldTaskKind): boolean {
    const offer = this.quoteFieldTask(kind)
    if (offer.cost > 0 && !this.sandbox && this.cash < offer.cost) return false
    if (offer.hire === 'desk') {
      if (!this.fits.length || this.deskStaff >= 8) return false
      return kind === 'desk_extra' ? this.deskStaff === 1 : this.deskStaff < 1
    }
    if (offer.hire === 'janitor') return this.janitors < 6
    if (offer.hallItem) return this.hallSpot(offer.hallItem) != null
    if (!offer.tool) return false
    if (this.sites.some((site) => site.tool === offer.tool)) return false
    const building = BUILDINGS.find((row) => row.tool === offer.tool)
    if (!building) return false
    const needLevel = Math.max(building.minFieldLevel ?? 1, unlockLevel(building.tool))
    if (this.fieldLevel() < needLevel) return false
    if (this.researchTree.blockReason(building.tool)) return false
    if (placementBlock(offer.tool, this.fieldLevel(), this.researchUnlocked)) return false
    return this.cellForStamp(offer.tool) != null
  }

  /** Build line for the open field letter: cost against the bonus, off when the cash is short. */
  fieldAskOffer(): { cost: number; bonus: number; text: string; enabled: boolean } | null {
    const task = this.fieldTask
    if (!task) return null
    const offer = this.quoteFieldTask(task.kind)
    const busy = offer.tool ? this.sites.some((s) => s.tool === offer.tool) : false
    const enabled = (this.sandbox || this.cash >= offer.cost) && !busy
    return {
      cost: offer.cost,
      bonus: task.bonus,
      text: `Build · ${moneyLeft(offer.cost)} cost / ${moneyLeft(task.bonus)} bonus`,
      enabled,
    }
  }

  /** Stamp or hire the open field ask. A second click does not spend again. */
  buildFieldTask() {
    const task = this.fieldTask
    if (!task) return
    if (this.fieldAskSpent.has(task.id)) {
      this.pushNews('That field ask is already paid.', 'ok')
      this.emit()
      return
    }
    const offer = this.quoteFieldTask(task.kind)
    if (!this.sandbox && this.cash < offer.cost) {
      this.pushNews(
        `Need ${moneyLeft(offer.cost)} for ${offer.label}. The bonus is ${moneyLeft(task.bonus)}.`,
        'bad',
      )
      this.emit()
      return
    }
    const cashBefore = this.cash
    const sitesBefore = this.sites.length
    if (offer.hire === 'desk') {
      this.hireDeskStaff()
      this.noteFieldAskPaid(task.id, task.kind, cashBefore, sitesBefore)
      return
    }
    if (offer.hire === 'janitor') {
      this.hireJanitor()
      this.noteFieldAskPaid(task.id, task.kind, cashBefore, sitesBefore)
      return
    }
    if (offer.hallItem) {
      this.placeHallItem(offer.hallItem)
      this.noteFieldAskPaid(task.id, task.kind, cashBefore, sitesBefore)
      return
    }
    if (!offer.tool) return
    if (this.sites.some((s) => s.tool === offer.tool)) {
      this.pushNews(
        `${offer.label} is already a construction site — a contractor is driving in.`,
        'bad',
      )
      this.emit()
      return
    }
    const cell = this.cellForStamp(offer.tool)
    if (!cell) {
      this.pushNews(`No open grass for ${offer.label}.`, 'bad')
      this.emit()
      return
    }
    const prev = this.tool
    this.tool = offer.tool
    this.placeSingle(cell)
    this.tool = prev
    this.noteFieldAskPaid(task.id, task.kind, cashBefore, sitesBefore)
  }

  /** Remember a field ask once cash left or the stamp landed, so a second click is free. */
  private noteFieldAskPaid(id: string, kind: FieldTaskKind, cashBefore: number, sitesBefore: number) {
    if (this.cash < cashBefore || this.sites.length > sitesBefore || this.fieldTaskMet(kind)) {
      this.fieldAskSpent.add(id)
    }
  }

  /** First legal grass cell for a tool, including a road edge when the stamp needs one. */
  private cellForStamp(tool: Tool): Vec | null {
    const building = BUILDINGS.find((b) => b.tool === tool)
    if (!building) return null
    const landside =
      building.tile === 'hotel' ||
      building.tile === 'park_s' ||
      building.tile === 'park_l' ||
      building.tile === 'park_g' ||
      building.tile === 'park_u' ||
      building.tile === 'bus' ||
      building.tile === 'curb_lane' ||
      building.tile === 'taxi_rank' ||
      building.tile === 'rail' ||
      building.tile === 'guard'
    const besidePavement =
      building.tile === 'fuel' ||
      building.tile === 'kitchen' ||
      building.tile === 'depot' ||
      building.tile === 'deice'
    for (let r = 1; r < this.tiles.length - 1; r++) {
      for (let c = 1; c < this.tiles[r].length - 1; c++) {
        const v = { c, r }
        if (this.tile(v) !== 'grass' || this.siteAt(v)) continue
        if (landside) {
          const nearRoad = [
            { c: c + 1, r },
            { c: c - 1, r },
            { c, r: r + 1 },
            { c, r: r - 1 },
          ].some((p) => this.tile(p) === 'road')
          if (!nearRoad) continue
        }
        if (besidePavement && !farmBesidePavement(this.tiles, v)) continue
        return v
      }
    }
    return null
  }

  /** Hide one letter. Later leaves a field ask running; Decline is what retires it. */
  ackLetter(key: string) {
    if (!key || this.ackedLetters.includes(key)) return
    this.ackedLetters.push(key)
    if (this.ackedLetters.length > 40) this.ackedLetters.splice(0, this.ackedLetters.length - 40)
    this.emit()
  }

  letterAcked(key: string): boolean {
    return this.ackedLetters.includes(key)
  }

  /** Strip plus a stand — the starter kit, or a freehand field, is on the plot. */
  starterFieldUp(): boolean {
    return runwayStrips(this.tiles, MIN_RUNWAY).length > 0 && tilesOf(this.tiles, 'stand').length > 0
  }

  /** The opening kit button. Hidden once the kit is stamped or the field is already up. */
  showStarterKit(): boolean {
    return !this.starterKitStamped && !this.starterFieldUp()
  }

  /**
   * Opening cash held for the starter kit. Lifts once the field is up, a hall
   * is already on the plot, or the player chooses Build freehand.
   */
  starterKitProtected(): boolean {
    if (this.sandbox || this.starterFreehand || !this.site) return false
    if (this.starterFieldUp()) return false
    if (this.fits.length > 0) return false
    return true
  }

  /** Release the kit budget so a hand-built strip is a choice, not a trap. */
  chooseFreehand() {
    if (this.starterFreehand) return
    this.starterFreehand = true
    this.pushNews(
      'Building freehand. The starter kit budget is released — the kit still stamps an empty field.',
      'ok',
    )
    this.emit()
  }

  /** Runway, stand, or hall stamps on a fresh plot are what make the kit refuse. */
  private openingStampBlocked(what: string): boolean {
    if (!this.starterKitProtected()) return false
    this.pushNews(
      `${what} would block the starter kit. Stamp the kit ($${STARTER_KIT_COST.toLocaleString('en-US')}) or choose Build freehand.`,
      'bad',
    )
    this.emit()
    return true
  }

  cargoVolumeLeft(): number {
    if (!this.cargoVolume) return 0
    return Math.max(0, this.cargoVolume.deadline - this.clock)
  }

  creditCargoVolume(units: number) {
    if (!this.cargoVolume || units <= 0) return
    this.cargoVolume.delivered += units
    if (this.cargoVolume.delivered >= this.cargoVolume.targetUnits) {
      const j = this.cargoVolume
      const a = this.airline(j.airline)
      this.earn(j.fee, `${a.name} volume window`)
      this.adjustHeat(j.airline, 6)
      this.grantFieldXp(10 + Math.round(j.targetUnits / 12), 'cargo volume')
      this.pushNews(
        `${a.name} volume clear — ${j.delivered}/${j.targetUnits}u. +${moneyLeft(j.fee)} · On-time up.`,
        'good',
      )
      this.cargoVolume = null
      this.cargoVolumeCool = CARGO_VOLUME_COOL
      this.emit()
    }
  }

  considerCargoVolume() {
    if (this.cargoVolume || this.cargoVolumeCool > 0) return
    if (!tilesOf(this.tiles, 'cargo').length || !tilesOf(this.tiles, 'guard').length) return
    const pool = this.signed.filter(
      (id) => this.airline(id).kind === 'cargo' && !this.isBanned(id),
    )
    if (!pool.length) return
    // Cargo / hybrid starts get volume asks earlier.
    if (this.startFocus === 'pax' && this.flightsDone < 2 && Math.random() > 0.35) return
    const airline = pick(pool)
    const a = this.airline(airline)
    const mods = this.specMods()
    const target = Math.round(
      (this.startFocus === 'cargo'
        ? 48 + Math.floor(Math.random() * 36)
        : 36 + Math.floor(Math.random() * 28)) * mods.cargoTonnage,
    )
    const fee = Math.round(
      (CARGO_VOLUME_FEE_MIN +
        Math.random() * (CARGO_VOLUME_FEE_MAX - CARGO_VOLUME_FEE_MIN)) *
        mods.cargoVolumeFee,
    )
    const window = 55 + Math.random() * 35
    this.cargoVolume = {
      id: uid('vol'),
      airline,
      targetUnits: target,
      delivered: 0,
      fee,
      deadline: this.clock + window,
      age: 0,
    }
    this.pushNews(
      `${a.name} volume window — stage ${target}u through the shed in ~${Math.round(window)}s for ${moneyLeft(fee)}.`,
      'ok',
    )
    this.emit()
  }

  tickCargoVolume(dt: number) {
    this.cargoVolumeCool = Math.max(0, this.cargoVolumeCool - dt)
    if (!this.cargoVolume) {
      this.considerCargoVolume()
      return
    }
    this.cargoVolume.age += dt
    if (this.clock >= this.cargoVolume.deadline) {
      const j = this.cargoVolume
      const a = this.airline(j.airline)
      this.charge(CARGO_VOLUME_FAIL_FINE, 'cargo_miss')
      this.noteRelationMiss(j.airline)
      this.adjustHeat(j.airline, -5)
      this.pushNews(
        `${a.name} volume missed — ${j.delivered}/${j.targetUnits}u. Fine ${moneyLeft(CARGO_VOLUME_FAIL_FINE)} · On-time dips.`,
        'bad',
      )
      this.cargoVolume = null
      this.cargoVolumeCool = CARGO_VOLUME_COOL + 20
      this.emit()
    }
  }

  noteCraft(kind: AircraftKind) {
    this.craftSeen[kind] = (this.craftSeen[kind] ?? 0) + 1
  }

  fleetMixLine(): string {
    const roles: { label: string; kinds: AircraftKind[] }[] = [
      { label: 'Pax', kinds: ['regional', 'narrowbody', 'widebody'] },
      { label: 'Cargo', kinds: ['freighter'] },
      { label: 'Emergency', kinds: ['helo_med', 'air_ambulance'] },
      { label: 'Exec', kinds: ['helo_exec'] },
      { label: 'Military', kinds: ['military'] },
    ]
    const parts = roles
      .map((r) => {
        const n = r.kinds.reduce((s, k) => s + (this.craftSeen[k] ?? 0), 0)
        return n > 0 ? `${r.label} ${n}` : null
      })
      .filter(Boolean)
    return parts.length ? parts.join(' · ') : 'No metal yet'
  }

  roleLabel(kind: AircraftKind): string {
    return craftRoleLabel(kind)
  }

  /** Premade catalog, the 45-airline roster, live procedural regionals and negotiation carriers. */
  allAirlines(): Airline[] {
    const roster = rosterGameAirlines().map((a) => normalizeAirline(a))
    // Negotiation-only carriers (Zoomjet etc.) resolve through airline(); list them so they can be signed.
    const known = new Set([...airlineList(), ...roster, ...this.extraAirlines].map((a) => a.id))
    const negotiated = NEGOTIATION_AIRLINES.filter((a) => !known.has(a.id)).map((a) => this.airline(a.id))
    return [...airlineList(), ...roster, ...this.extraAirlines, ...negotiated]
  }

  /**
   * One sign per check-in desk, in the same order the hall paints them.
   * A desk with no airline is the neutral sign. The renderer does not choose.
   */
  deskBrands(): { id: string; name: string; code: string; primary: string; secondary: string }[] {
    const alloc = this.checkinAllocation()
    const key = alloc.desks.map((row) => `${row.deskId}:${row.airlineId ?? 'neutral'}`).join('|')
    if (this.deskBrandCache?.key === key) return this.deskBrandCache.list
    const list = alloc.desks.map((row) => (row.airlineId ? this.airlineBrand(row.airlineId) : { ...NEUTRAL_DESK_BRAND }))
    this.deskBrandCache = { key, list }
    return list
  }

  private airlineBrand(id: AirlineId): { id: string; name: string; code: string; primary: string; secondary: string } {
    const a = this.airline(id)
    const r = rosterAirline(id)
    return {
      id,
      name: a.name,
      code: r?.code ?? a.name.slice(0, 3).toUpperCase(),
      primary: r?.primary ?? a.color,
      secondary: r?.secondary ?? a.stripe,
    }
  }

  private deskBrandCache: { key: string; list: { id: string; name: string; code: string; primary: string; secondary: string }[] } | null = null
  private checkinCache: { key: string; alloc: Allocation } | null = null

  /** Desks in paint order, and whether each one can serve. */
  private checkinDesks(): CheckinDesk[] {
    const nav = this.hallNav.nav
    const fit = this.activeHall()
    if (!nav || !fit) return []
    const points = staffPoints(nav.facilities.list, fit.items ?? [])
    const open = openPointIds(points, {
      checkin: this.onPostCount('checkin'),
      security: this.onPostCount('security'),
    })
    const byId = new Map(points.map((point) => [point.id, point]))
    const out: CheckinDesk[] = []
    for (const facility of nav.facilities.list) {
      if (facility.kind !== 'checkin_desk') continue
      const point = byId.get(facility.id)
      out.push({
        id: facility.id,
        staffed: open.has(facility.id),
        kiosk: Boolean(point?.automatic),
      })
    }
    return out
  }

  /** Passenger flights that can take a desk. Cargo, GA and emergency do not. */
  private checkinFlights(): CheckinFlight[] {
    const seen = new Set<string>()
    const out: CheckinFlight[] = []
    for (const plan of this.showUps) {
      if (plan.closed || !plan.airlineId || !Number.isFinite(plan.std)) continue
      const flight = plan.flightId ? this.flights.find((row) => row.id === plan.flightId) : undefined
      if (flight && !this.flightTakesDesk(flight)) continue
      const id = plan.flightId ?? `slot:${plan.slotId}`
      if (seen.has(id)) continue
      seen.add(id)
      if (plan.flightId) seen.add(plan.flightId)
      seen.add(`slot:${plan.slotId}`)
      out.push({
        id,
        airlineId: plan.airlineId,
        std: plan.std,
        pax: Math.max(plan.tags?.length ?? 0, flight?.pax ?? 0),
        longHaul: Boolean(plan.intl) || (flight ? isIntlKind(flight.kind) : false),
      })
    }
    for (const flight of this.flights) {
      if (seen.has(flight.id) || !this.flightTakesDesk(flight)) continue
      if (flight.scheduleId && seen.has(`slot:${flight.scheduleId}`)) continue
      const gone =
        flight.phase === 'pushback' ||
        flight.phase === 'taxi_out' ||
        flight.phase === 'takeoff' ||
        flight.phase === 'gone'
      if (gone) continue
      out.push({
        id: flight.id,
        airlineId: flight.airline,
        std: flight.std ?? this.clock + 60,
        pax: flight.pax,
        longHaul: isIntlKind(flight.kind),
      })
    }
    return out
  }

  private flightTakesDesk(flight: Flight): boolean {
    if (flight.cargo || flight.ga) return false
    return flight.kind === 'regional' || flight.kind === 'narrowbody' || flight.kind === 'widebody'
  }

  /** Common-use assignment for this clock. Cached until the windows, desks or locks move. */
  checkinAllocation(): Allocation {
    const desks = this.checkinDesks()
    const flights = this.checkinFlights()
    const locks = this.dedicatedDesks.map((lock) => ({
      deskId: lock.deskId,
      airlineId: lock.airlineId,
      serviceShare:
        this.wave3.relation(lock.airlineId).tier >= CHECKIN_ALLOC.trustedTier ? CHECKIN_ALLOC.trustedServiceShare : 1,
    }))
    let key = this.clock.toFixed(3)
    for (const desk of desks) key += `|${desk.id}:${desk.staffed ? 1 : 0}:${desk.kiosk ? 1 : 0}`
    for (const flight of flights) {
      key += `|${flight.id}:${flight.airlineId}:${flight.std}:${flight.pax}:${flight.longHaul ? 1 : 0}`
    }
    for (const lock of locks) key += `|${lock.deskId}=${lock.airlineId}:${lock.serviceShare}`
    if (this.checkinCache?.key === key) return this.checkinCache.alloc
    const alloc = allocate({ now: this.clock, flights, desks, locks })
    this.checkinCache = { key, alloc }
    return alloc
  }

  private checkinRows(alloc: Allocation): { id: string; airlineId: string | null; general: boolean; serviceShare: number }[] {
    return alloc.desks.map((row) => ({
      id: row.deskId,
      airlineId: row.airlineId,
      general: row.mode === 'general' || row.mode === 'kiosk',
      serviceShare: row.serviceShare,
    }))
  }

  /** Bay label for one desk, numbered in paint order. */
  private checkinBayLabel(alloc: Allocation, deskId: string): string | undefined {
    const index = alloc.desks.findIndex((row) => row.deskId === deskId)
    if (index < 0) return undefined
    const row = alloc.desks[index]
    if (!row) return undefined
    if (row.mode === 'kiosk') return 'Kiosk · any airline'
    const who = row.airlineId ? this.airline(row.airlineId).name : 'general'
    return `Desk ${index + 1} · ${who}`
  }

  /**
   * Flight-card line. Null for cargo, GA and emergency. An open window names
   * the desks, or says the hall is short.
   */
  checkinLine(flight: Flight): string | null {
    if (!this.flightTakesDesk(flight)) return null
    const alloc = this.checkinAllocation()
    const share = alloc.flights.find(
      (row) => row.flightId === flight.id || (flight.scheduleId != null && row.flightId === `slot:${flight.scheduleId}`),
    )
    if (!share) return null
    if (!share.open) return 'Check-in closed'
    const nums = share.desks
      .map((id) => alloc.desks.findIndex((row) => row.deskId === id) + 1)
      .filter((n) => n > 0)
    const desks = nums.length ? `desks ${nums.join(', ')}` : ''
    if (share.short > 0 && desks) return `Check-in open · ${desks} · short of desks`
    if (share.short > 0) return 'Check-in open · short of desks'
    if (desks) return `Check-in open · ${desks}`
    return 'Check-in open · general desks'
  }

  /** Common, dedicated, and kiosk desks, and whose sign is live. */
  checkinModeLine(): string {
    const alloc = this.checkinAllocation()
    if (!alloc.desks.length) return 'No check-in desks'
    const body = alloc.desks
      .map((row) => {
        if (row.mode === 'kiosk') return 'Kiosk · any airline'
        const who = row.airlineId ? this.airline(row.airlineId).name : 'free'
        if (row.mode === 'dedicated') return `Dedicated · ${who}`
        return `Common · ${who}`
      })
      .join('; ')
    return alloc.reason ? `${body}; ${alloc.reason}` : body
  }

  /**
   * Passenger contract versus open desks and kiosks.
   * Staffed common desks, and a dedicated desk already given to this carrier,
   * are what the walk can serve. Scale-desk purchases count only for the desks
   * the hall has not already opened.
   */
  checkinSignReport(id: AirlineId): CheckinSignGate {
    const airline = this.airline(id)
    if (airline.kind !== 'pax') {
      return checkinSignGate({ kind: airline.kind, peakPaxPerMin: 0, openDesks: 0, kiosks: 0, label: airline.name })
    }
    let peak = 0
    for (const sid of this.signed) {
      if (sid === id) continue
      peak += this.carrierCheckinPeak(sid)
    }
    peak += this.carrierCheckinPeak(id)
    const cap = this.checkinCapacityFor(id)
    return checkinSignGate({
      kind: 'pax',
      peakPaxPerMin: peak,
      openDesks: cap.desks,
      kiosks: cap.kiosks,
      label: airline.name,
    })
  }

  private carrierCheckinPeak(id: AirlineId): number {
    return carrierPeakPaxPerMin(
      this.airline(id).kind,
      this.namedAirframes(id).map((frame) => frame.id),
    )
  }

  private checkinCapacityFor(airlineId: AirlineId): { desks: number; kiosks: number } {
    const desks = this.checkinDesks()
    if (!desks.length) return { desks: Math.max(0, this.paxDesks), kiosks: Math.max(0, this.paxKiosks) }
    const alloc = this.checkinAllocation()
    const byId = new Map(alloc.desks.map((row) => [row.deskId, row]))
    let openCommon = 0
    let openDedicatedHere = 0
    let openHallDesks = 0
    let kiosks = 0
    for (const desk of desks) {
      if (!desk.staffed) continue
      if (desk.kiosk) {
        kiosks += 1
        continue
      }
      openHallDesks += 1
      const row = byId.get(desk.id)
      if (row?.mode === 'dedicated' && row.airlineId === airlineId) openDedicatedHere += 1
      else if (row?.mode !== 'dedicated') openCommon += 1
    }
    const extra = Math.max(0, Math.floor(this.paxDesks) - openHallDesks)
    return {
      desks: openCommon + openDedicatedHere + extra,
      kiosks: Math.max(kiosks, Math.max(0, Math.floor(this.paxKiosks))),
    }
  }

  /** Lock and release buttons for the check-in building card. */
  private checkinActions(alloc: Allocation): { id: string; label: string }[] {
    const ids = new Set<string>()
    for (const id of this.signed) if (this.airline(id).kind === 'pax') ids.add(id)
    for (const flight of alloc.flights) if (flight.open) ids.add(flight.airlineId)
    for (const lock of this.dedicatedDesks) ids.add(lock.airlineId)
    const actions: { id: string; label: string }[] = []
    for (const id of [...ids].sort()) {
      const tier = this.wave3.relation(id).tier
      const perk =
        tier >= CHECKIN_ALLOC.trustedTier
          ? 'Trusted — faster, no fee'
          : tier >= CHECKIN_ALLOC.preferredTier
            ? 'Preferred — no fee'
            : `$${CHECKIN_ALLOC.dedicatedFee.toLocaleString('en-US')}`
      actions.push({ id: `dedicate:${id}`, label: `Lock a desk to ${this.airline(id).name} · ${perk}` })
    }
    for (const lock of this.dedicatedDesks) {
      const label = this.checkinBayLabel(alloc, lock.deskId) ?? 'Desk'
      actions.push({ id: `release:${lock.deskId}`, label: `Release ${label}` })
    }
    return actions
  }

  /** Building-panel and flight-card action. `dedicate:<airline>` or `release:<desk>`. */
  checkinAction(id: string): void {
    if (id.startsWith('dedicate:')) this.dedicateDesk(id.slice('dedicate:'.length))
    else if (id.startsWith('release:')) this.releaseDesk(id.slice('release:'.length))
  }

  /**
   * Lock the next free common desk to this airline. Below Preferred it costs
   * the dedicated fee. Preferred and Trusted waive it. A kiosk cannot be locked.
   */
  dedicateDesk(airlineId: string): boolean {
    const name = this.airline(airlineId).name
    const alloc = this.checkinAllocation()
    const desks = this.checkinDesks()
    const staffed = new Map(desks.map((desk) => [desk.id, desk.staffed]))
    const free = alloc.desks.filter((row) => row.mode !== 'kiosk' && row.mode !== 'dedicated')
    free.sort((a, b) => {
      const as = staffed.get(a.deskId) ? 0 : 2
      const bs = staffed.get(b.deskId) ? 0 : 2
      const ag = a.mode === 'general' ? 0 : 1
      const bg = b.mode === 'general' ? 0 : 1
      return as + ag - (bs + bg)
    })
    const pick = free[0]
    if (!pick) {
      this.pushNews(`No desk free to lock for ${name}.`, 'bad')
      this.emit()
      return false
    }
    const tier = this.wave3.relation(airlineId).tier
    if (tier < CHECKIN_ALLOC.preferredTier) {
      if (!this.spend(CHECKIN_ALLOC.dedicatedFee, `Dedicated desk · ${name}`)) return false
    }
    this.dedicatedDesks.push({ deskId: pick.deskId, airlineId, mode: 'dedicated' })
    this.checkinCache = null
    this.deskBrandCache = null
    const perk =
      tier >= CHECKIN_ALLOC.trustedTier
        ? `${name} keeps a faster desk — Trusted, no fee.`
        : tier >= CHECKIN_ALLOC.preferredTier
          ? `${name} keeps this desk — Preferred, no fee.`
          : `${name} keeps this desk.`
    this.pushNews(perk, 'ok')
    this.emit()
    return true
  }

  /** The desk goes back to common use on the next assignment. */
  releaseDesk(deskId: string): boolean {
    const next = this.dedicatedDesks.filter((row) => row.deskId !== deskId)
    if (next.length === this.dedicatedDesks.length) return false
    this.dedicatedDesks = next
    this.checkinCache = null
    this.deskBrandCache = null
    this.pushNews('Desk released. It returns to common use.', 'ok')
    this.emit()
    return true
  }

  /** Assign screen. Common clears the lock. Preferred and dedicated stay on the one desk list the allocator reads. */
  leaseDesk(airlineId: string, deskId: string, mode: 'common' | 'preferred' | 'dedicated'): boolean {
    const desk = this.checkinDesks().find((row) => row.id === deskId)
    if (!desk || desk.kiosk) {
      this.pushNews('That desk cannot take a name.', 'bad')
      this.emit()
      return false
    }
    const held = this.dedicatedDesks.find((row) => row.deskId === deskId)
    if (mode === 'common') {
      if (!held || held.airlineId !== airlineId) return false
      return this.releaseDesk(deskId)
    }
    if (held && held.airlineId !== airlineId) {
      this.pushNews('That desk is dedicated to someone else.', 'bad')
      this.emit()
      return false
    }
    if (!held) {
      const tier = this.wave3.relation(airlineId).tier
      if (tier < CHECKIN_ALLOC.preferredTier && !this.spend(CHECKIN_ALLOC.dedicatedFee, `Dedicated desk · ${this.airline(airlineId).name}`)) {
        return false
      }
      this.dedicatedDesks.push({ deskId, airlineId, mode })
    } else {
      held.mode = mode
    }
    this.checkinCache = null
    this.deskBrandCache = null
    this.pushNews(`${this.airline(airlineId).name} set the desk to ${mode}.`, 'ok')
    this.emit()
    return true
  }

  hubDeskRows(airlineId: string): { deskId: string; label: string; mode: 'common' | 'preferred' | 'dedicated'; staffed: boolean }[] {
    const locks = new Map(this.dedicatedDesks.map((row) => [row.deskId, row]))
    return this.checkinDesks()
      .filter((desk) => !desk.kiosk)
      .map((desk) => {
        const lock = locks.get(desk.id)
        const mode = lock?.airlineId === airlineId ? (lock.mode === 'preferred' ? 'preferred' : 'dedicated') : 'common'
        return { deskId: desk.id, label: desk.id, mode, staffed: desk.staffed }
      })
  }

  /** Airlines panel: everything except catalog carriers we never signed while the roster is live. */
  panelAirlines(): Airline[] {
    return this.allAirlines().filter((a) => !(ROSTER_LIVE && CATALOG_AIRLINE_IDS.has(a.id) && !this.signed.includes(a.id)))
  }

  /** Airport size (1 to 5) and reputation, as the roster unlock table reads them. */
  rosterAirport(): { size: number; reputation: number } {
    return { size: Math.min(ROSTER_SIZE_CAP, this.hostedFieldLevel()), reputation: this.reputation }
  }

  /**
   * Will this carrier write to us? Roster carriers need their size and
   * reputation gate. A helicopter letter can arrive before the pad; signing
   * stays blocked until one exists. Catalog carriers no longer send new letters.
   */
  rosterOpen(id: AirlineId): boolean {
    const r = rosterAirline(id)
    if (!r) return !(ROSTER_LIVE && CATALOG_AIRLINE_IDS.has(id))
    if (!ROSTER_LIVE) return false
    return isAirlineUnlocked(r, this.rosterAirport())
  }

  airline(id: AirlineId): Airline {
    if (id === 'ga') {
      return normalizeAirline({
        id: 'ga',
        name: 'General Aviation',
        color: '#9aa7b0',
        stripe: '#c5d0d8',
        kind: 'pax',
        persona: 'business',
        tier: 1,
        bizModel: 'charter',
        fleetBlurb: 'Light singles / twins',
        landing: 2200,
        catering: 0,
        bags: 0,
        paxMin: 2,
        paxMax: 8,
        minRep: 0,
        req: {
          stands: 1,
          fuelContract: false,
          fuelFarm: false,
          fire: false,
          police: false,
          terminal: false,
          security: 0,
          bags: false,
          snack: false,
          catering: false,
          cargo: false,
          road: false,
          tower: false,
          heavyRunway: false,
        },
        blurb: 'Independent transient parking — not a signed carrier.',
        likesLayovers: false,
        heatSensitivity: 1,
      })
    }
    const negotiated = NEGOTIATION_AIRLINES.find((a) => a.id === id)
    if (negotiated && !AIRLINES[id]) {
      const template = AIRLINES.northline
      return normalizeAirline({
        ...template,
        id: negotiated.id,
        name: negotiated.name,
        persona: 'budget',
        bizModel: 'lcc',
        tier: 2,
        landing: negotiated.posted.landing,
        bags: negotiatedBagTurnFee(
          negotiated.posted.bags,
          negotiated.seats,
          NEGOTIATION.economics.loadFactor,
        ),
        catering: negotiated.posted.catering,
        paxMin: Math.round(negotiated.seats * 0.75),
        paxMax: negotiated.seats,
        blurb: negotiated.pitch ?? template.blurb,
        procedural: false,
        likesLayovers: false,
        heatSensitivity: 0.8,
      })
    }
    const raw =
      AIRLINES[id] ??
      rosterGameAirline(id) ??
      this.extraAirlines.find((a) => a.id === id) ??
      AIRLINES.northline
    return normalizeAirline(raw)
  }

  /**
   * Airframe ids a contract sells. Catalog fleet, or the roster carrier's own,
   * including helicopters. Undefined only when the carrier has no named fleet.
   * An empty or unusable named fleet does not fall through to a generic jet.
   */
  private contractFleet(id: AirlineId): readonly string[] | undefined {
    return CONTRACT_FLEET[id] ?? rosterFleet(id)
  }

  fieldLevel(): FieldLevel {
    return fieldLevelOf(this.fieldXp)
  }

  prestigeStars(): number {
    return prestigeStarsOf(this.fieldXp)
  }

  specPointsEarned(): number {
    return specPointsForLevel(this.fieldLevel())
  }

  specPointsLeft(): number {
    return Math.max(0, this.specPointsEarned() - this.specPaths.length)
  }

  /** Mix is allowed. Each path after the first raises capstone cost and site upkeep. */
  chooseSpec(path: SpecPath): boolean {
    if (this.specPaths.includes(path)) {
      this.pushNews(`${specPath(path)?.label ?? path} is already chosen. Pick a different path — they mix.`, 'ok')
      this.emit()
      return false
    }
    if (this.specPointsLeft() <= 0) {
      this.pushNews('No specialization point. Points arrive at Field Levels 6, 8, and 10.', 'bad')
      this.emit()
      return false
    }
    this.specPaths.push(path)
    const extra = this.specPaths.length > 1
    this.pushNews(
      `${specPath(path)?.label ?? path} path chosen.${
        extra ? ' Capstone costs +50% and site upkeep +10% for each path after the first.' : ''
      }`,
      'good',
    )
    this.emit()
    return true
  }

  specMods(): SpecMods {
    return foldSpecMods(this.specNodes)
  }

  treePointsEarned(): number {
    return treePointsForProgress(this.fieldLevel(), this.prestigeStars())
  }

  treePointsSpent(): number {
    return this.specNodes.reduce((sum, id) => sum + (specNode(id)?.cost ?? 0), 0)
  }

  treePointsLeft(): number {
    return Math.max(0, this.treePointsEarned() - this.treePointsSpent())
  }

  /** Satellite hall is tier 3, or the satellite stamp is already commissioned. */
  satelliteLive(): boolean {
    return (
      this.progressionBuilt.includes('satellite') || this.fits.some((f) => (f.tier ?? 1) >= 3)
    )
  }

  /** Extra simultaneous approaches from the hub tree. The satellite feed waits for the building. */
  specInboundBonus(): number {
    const mods = this.specMods()
    let n = mods.inboundBonus
    if (mods.satelliteFeed && this.satelliteLive()) n += mods.satelliteInbound
    return n
  }

  hubHeatNeed(): number {
    return Math.max(40, HUB_HEAT_NEED + this.specMods().hubHeatNeedDelta)
  }

  scaledTurnMinutes(base: number): number {
    return turnMinutes(base, this.specMods(), this.isNight()) * researchMods(this.researchTree.state.unlocked).turn
  }

  screenPace(premium: boolean): number {
    return screenMultiplier(this.specMods(), premium) * researchMods(this.researchTree.state.unlocked).security
  }

  cargoWarehouseCap(): number {
    return warehouseCapacity(CARGO_WAREHOUSE_CAP, this.specMods(), this.railLinked) + researchMods(this.researchTree.state.unlocked).cargo
  }

  canBuySpecNode(id: string): { ok: boolean; why: string } {
    const node = specNode(id)
    if (!node) return { ok: false, why: 'Unknown specialization.' }
    if (this.specNodes.includes(id)) return { ok: false, why: 'Already unlocked.' }
    if (!this.specPaths.includes(node.path)) {
      return { ok: false, why: `Commit the ${specPath(node.path)?.label ?? node.path} path first.` }
    }
    for (const req of node.requires) {
      if (!this.specNodes.includes(req)) {
        return { ok: false, why: `Need ${specNode(req)?.name ?? req} first.` }
      }
    }
    if (this.treePointsLeft() < node.cost) {
      return {
        ok: false,
        why: `Need ${node.cost} tree point${node.cost === 1 ? '' : 's'} (have ${this.treePointsLeft()}).`,
      }
    }
    const price = node.capstone ? specCashCost(node.cash, this.specPaths, node.path) : node.cash
    if (price > 0 && this.cash < price && !this.sandbox) {
      return { ok: false, why: `Need $${price.toLocaleString('en-US')}.` }
    }
    return { ok: true, why: '' }
  }

  /** Buy one tree node. The path must already be committed. Nothing on the tree is free. */
  buySpecNode(id: string): boolean {
    const gate = this.canBuySpecNode(id)
    const node = specNode(id)
    if (!node) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return false
    }
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return false
    }
    const price = node.capstone ? specCashCost(node.cash, this.specPaths, node.path) : node.cash
    if (price > 0 && !this.spend(price, node.name)) return false
    this.specNodes.push(id)
    const bill = node.upkeepPerDay > 0 ? ` Upkeep $${node.upkeepPerDay.toLocaleString('en-US')}/day.` : ''
    this.pushNews(`${node.name} — ${node.perk} ${node.tradeoff}${bill}`, 'good')
    this.emit()
    return true
  }

  private dressRetail(tag: string, pay: number, kind: 'tenant' | 'lounge'): number {
    return retailPrice(pay, this.specMods(), kind, tag === 'budget') * researchMods(this.researchTree.state.unlocked).retail
  }

  /**
   * Buy a progression stamp that is not an apron tile.
   * Refuses when the field level is short of the unlock table.
   */
  commission(id: string): boolean {
    const row = progressionBuildable(id)
    const need = unlockLevel(id)
    const name = row?.name ?? id
    if (this.fieldLevel() < need) {
      this.pushNews(`${name} needs Field level ${need}.`, 'bad')
      this.emit()
      return false
    }
    const researchNeed = this.researchTree.blockReason(id)
    if (researchNeed) {
      this.pushNews(researchNeed, 'bad')
      this.emit()
      return false
    }
    if (id === 'prefab_ii') {
      if ((this.fits[0]?.tier ?? 1) !== 1) {
        this.pushNews('Prefab II is already in place.', 'ok')
        this.emit()
        return false
      }
      this.upgradeHall()
      return (this.fits[0]?.tier ?? 1) >= 2
    }
    if (id === 'satellite') {
      const tier = this.fits[0]?.tier ?? 1
      if (tier < 2) {
        this.pushNews('Satellite needs Prefab II first.', 'bad')
        this.emit()
        return false
      }
      if (tier >= 3) {
        this.pushNews('Satellite is already in place.', 'ok')
        this.emit()
        return false
      }
      this.upgradeHall()
      return (this.fits[0]?.tier ?? 1) >= 3
    }
    if (id === 'jet_bridge') {
      this.pushNews('Buy the jet bridge on the stand card.', 'ok')
      this.emit()
      return true
    }
    if (id === 'hydrant') {
      if (!this.hasResearch('hydrant_fuel')) {
        this.pushNews('Research the hydrant system. Then stamp the pit on a stand.', 'bad')
        this.emit()
        return false
      }
      this.hydrantArm = !this.hydrantArm
      const rowCost = progressionBuildable('hydrant')
      const price = (rowCost?.cost ?? 0).toLocaleString('en-US')
      const upkeep = (rowCost?.upkeepPerDay ?? 0).toLocaleString('en-US')
      this.pushNews(
        this.hydrantArm
          ? `Hydrant pit armed — click a stand. $${price}, upkeep $${upkeep}/day.`
          : 'Hydrant pit put away.',
        'ok',
      )
      this.emit()
      return this.hydrantArm
    }
    if (!row) {
      this.pushNews(`${name} is not a buildable.`, 'bad')
      this.emit()
      return false
    }
    if (this.progressionBuilt.includes(id)) {
      this.pushNews(`${row.name} is already on the field.`, 'ok')
      this.emit()
      return false
    }
    const cost = capstoneCost(row.cost, this.specPaths, id)
    if (!this.spend(cost, row.name)) return false
    this.progressionBuilt.push(id)
    const upkeep = row.upkeepPerDay > 0 ? ` Upkeep $${row.upkeepPerDay.toLocaleString('en-US')}/day.` : ''
    this.pushNews(`${row.name} open.${upkeep}`, 'good')
    this.emit()
    return true
  }

  /**
   * Airline ladder, diplomacy, and the operating licence stay on levels 1–5.
   * Levels 6 and 7 only open hub links.
   */
  private hostedFieldLevel(): number {
    return Math.min(5, this.fieldLevel())
  }

  /** Late-building rung. Matches field level through 5, then keeps climbing. */
  lateFieldLevel(): number {
    return lateFieldLevelFromXp(this.fieldXp)
  }

  lateXpToNext(): { level: number; xp: number; need: number; pct: number } {
    const level = this.lateFieldLevel()
    const xp = Number.isFinite(this.fieldXp) && this.fieldXp > 0 ? this.fieldXp : 0
    const cap = LATE_FIELD_XP.length - 1
    if (level >= cap) return { level, xp, need: LATE_FIELD_XP[level] ?? xp, pct: 1 }
    const floor = LATE_FIELD_XP[level] ?? 0
    const need = LATE_FIELD_XP[level + 1] ?? floor
    const pct = need <= floor ? 1 : Math.min(1, Math.max(0, (xp - floor) / (need - floor)))
    return { level, xp, need, pct }
  }

  /** Diplomacy day, 0 until the clock has run. */
  diplomacyDay(): number {
    return this.diplomacy?.day() ?? 0
  }

  private ensureDiplomacy(): DiplomacyBridge {
    if (!this.diplomacy) {
      this.diplomacy = createDiplomacyBridge(
        {
          addMoney: (amount, category) => this.postDiplomacyMoney(amount, category),
          getCash: () => this.cash,
          getContext: () => this.diplomacyContext(),
          notify: (message, severity) => {
            const tone = severity === 'bad' || severity === 'warn' ? 'bad' : severity === 'good' ? 'good' : 'ok'
            this.pushNews(message, tone)
          },
          applyReputation: (delta) => {
            this.reputation = Math.max(0, Math.min(100, this.reputation + delta))
          },
          onHostileAction: (action) => {
            this.pushNews(action.text, 'bad')
          },
        },
        this.diplomacySeed,
      )
    }
    return this.diplomacy
  }

  private postDiplomacyMoney(amount: number, category: string) {
    if (!Number.isFinite(amount) || amount === 0) return
    if (amount > 0) {
      this.cash += amount
      this.revenue += amount
      this.noteIncome(amount, category === 'legal' ? 'refunds' : 'diplomacy_income')
      return
    }
    const cost = -amount
    this.noteExpense(cost)
    if (this.sandbox) return
    this.cash -= cost
    this.postJournal(category === 'legal' ? 'legal' : 'diplomacy', cost, this.simMinutes(), category)
  }

  private diplomacyContext() {
    const stands = tilesOf(this.tiles, 'stand')
    const classes = stands.map((s) => this.standClassAt(s))
    const occupied = this.flights.filter((f) => f.phase !== 'gone' && f.stand).length
    let food = 0
    let lounge = 0
    let family = 0
    let prestige = 0
    for (const fit of this.fits) {
      food += fit.rooms.food ?? 0
      lounge += fit.rooms.lounge ?? 0
      family += (fit.rooms.bathroom ?? 0) + (fit.rooms.dayhotel ?? 0) + (fit.rooms.gaming ?? 0)
      prestige += (fit.rooms.lounge ?? 0) + (fit.rooms.spa ?? 0) + (fit.rooms.golf ?? 0)
    }
    const onTime = this.diplomacy?.onTimePct() ?? 88
    const feeIndex = this.diplomacy?.adapter.engine.state.feeIndex ?? 1
    return {
      fieldLevel: diplomacyFieldLevel(this.hostedFieldLevel()),
      reputation: this.reputation,
      metrics: {
        onTimePct: onTime,
        feeIndex,
        cafes: food,
        loungeSeats: lounge * 24,
        standCount: stands.length,
        standUtilization: stands.length ? occupied / stands.length : 0,
        heavyStands: classes.filter((c) => c === 'L').length,
        electricTugs: 0,
        solarCoveragePct: 0,
        familyAmenities: family,
        prestigeItems: prestige,
        exclusivePier: 0,
        nightSlots: (this.hasResearch('night_bank') ? 1 : 0) + this.specMods().nightSlots,
        coldChainRooms: 0,
        cargoFacilities: tilesOf(this.tiles, 'cargo').length,
        incentiveDealActive: 0,
        hubDepartures: this.hubAirlines.length,
        maintenanceLevel: tilesOf(this.tiles, 'hangar').length + (this.mechanics > 0 ? 1 : 0),
      },
      airport: {
        runwayLengthMeters: this.longestRunway() * 150,
        hasSmallStands: classes.some((c) => c === 'S' || c === 'M'),
        hasMediumStands: classes.some((c) => c === 'M' || c === 'L'),
        hasHeavyStands: classes.some((c) => c === 'L'),
        terminalRating: this.hostedFieldLevel(),
        hasFuelService: tilesOf(this.tiles, 'fuel').length > 0,
        hasCateringService: Boolean(this.caterBrand) || tilesOf(this.tiles, 'kitchen').length > 0,
        hasMaintenanceService: tilesOf(this.tiles, 'hangar').length > 0,
        hasHeavyVehicles: tilesOf(this.tiles, 'depot').length > 0,
        onTimePercentage: onTime,
        totalFlightsHandled: this.flightsDone,
      },
    }
  }

  private tickDiplomacy(step: number) {
    const d = this.ensureDiplomacy()
    for (const id of this.signed) d.mirrorSigned(id)
    const before = d.day()
    d.tick(step * GAME_MINUTES_PER_SIM_SECOND)
    if (Math.floor(d.day()) > Math.floor(before)) {
      d.adapter.engine.notePremiumScreening({ clearRate: this.premiumScreenRate() })
      this.flushMissedConnections()
    }
  }

  /** Share of premium departures already through screening. 1 when nobody premium is in the hall. */
  private premiumScreenRate(): number {
    const premium = this.hallGuests.filter(
      (g) => !g.preview && !g.dead && g.tag === 'premium' && g.job === 'depart',
    )
    if (!premium.length) return 1
    const waiting = premium.filter((g) => g.node === 'security' && !g.clearedSec).length
    return 1 - waiting / premium.length
  }

  private flushMissedConnections() {
    const pending = this.missedByAirline
    this.missedByAirline = {}
    const engine = this.diplomacy?.adapter.engine
    if (!engine) return
    for (const [airlineId, missed] of Object.entries(pending)) {
      engine.noteMissedConnections({ airlineId, missed, showMe: 'connectivity' })
    }
  }

  private diplomacyCapacity(airlineId: string): number {
    return this.diplomacy?.capacityFactor(airlineId) ?? 1
  }

  private rampPace(airframeId: string, cargo: boolean, airlineId: string): number {
    const slow = this.diplomacy?.slowFactor(airlineId) ?? 1
    const climate = seasonAtDay(dayIndex(this.clock)).climate
    const pace =
      this.mapId === 'temperate'
        ? groundOpsPace(this.weather, climate)
        : this.mapEngineDerate()
    return turnaroundScale(AIRFRAMES[airframeId], cargo) * slow * pace
  }

  private gradeDiplomacyTurn(f: Flight) {
    if (f.kind === 'military' || f.kind === 'air_ambulance') return
    const slot = f.scheduleId ? this.schedule.find((s) => s.id === f.scheduleId) : undefined
    const guests = this.hallGuests.filter((g) => g.flightId === f.id && !g.dead)
    const mood = guests.length
      ? guests.reduce((sum, g) => sum + g.happiness, 0) / guests.length / 100
      : 0.75
    const bagFault = this.bagTags.some((t) => t.flightId === f.id && t.fault)
    const result = this.ensureDiplomacy().gradeFlight({
      flightId: f.id,
      airlineId: f.airline,
      delayMinutes: (slot?.delaySec ?? 0) * GAME_MINUTES_PER_SIM_SECOND,
      bagFault,
      paxMood: mood,
      standFit: Boolean(f.stand),
    })
    if (result.ended) {
      this.pushNews(`${this.airline(f.airline).name} walked on the contract — satisfaction hit the floor.`, 'bad')
    }
  }

  private noteDiplomacyCancel(airlineId: string, excused: boolean) {
    this.diplomacy?.cancelFlight(airlineId, excused)
  }

  /** One relationship score. An excused weather cancel does not move it. */
  private noteWave3(key: string, airlineId: string, kind: 'success' | 'delay' | 'cancel' | null) {
    if (!kind || !airlineId || this.wave3Noted.has(key)) return
    if (kind !== 'success' && this.waitingOnHelipad(airlineId)) return
    this.wave3Noted.add(key)
    this.wave3.noteTurnaround(airlineId, kind)
  }

  /** Relation nick from a fine. A helicopter waiting on a pad does not move. */
  private noteRelationFine(airlineId: string) {
    if (!airlineId || this.waitingOnHelipad(airlineId)) return
    this.wave3.noteFine(airlineId)
  }

  private noteRelationFines(airlineIds: readonly string[]) {
    for (const id of airlineIds) this.noteRelationFine(id)
  }

  /** Relation nick from a missed ask. A helicopter waiting on a pad does not move. */
  private noteRelationMiss(airlineId: string) {
    if (this.waitingOnHelipad(airlineId)) return
    this.wave3.noteMissedAsk(airlineId)
  }

  /**
   * Score a departure. Late means pushback after STD, or a turnaround grade
   * of C or worse. Landing delaySec is not read here.
   */
  scoreWave3Turn(f: Flight): void {
    if (f.kind === 'military' || f.kind === 'air_ambulance') return
    const lateMin = f.std != null ? (this.clock - f.std) * GAME_MINUTES_PER_SIM_SECOND : 0
    const grade = f.turnGrade ?? this.liveTurnGrade(f)?.grade ?? null
    this.noteWave3(f.id, f.airline, classifyTurn({ grade, departureLateMin: lateMin }))
  }

  diplomacyRoster(): { id: string; name: string; band: string; standing: number }[] {
    if (!this.diplomacy) return []
    const cards = this.diplomacy.cards()
    const signed = cards.filter((c) => c.status === 'signed')
    const rest = cards.filter((c) => c.status !== 'signed')
    return [...signed, ...rest].slice(0, 4).map((c) => ({
      id: c.id,
      name: c.name,
      band: c.band.word,
      standing: c.standing,
    }))
  }

  diplomacyLetters(): {
    id: string
    airline: string
    airlineId: string
    text: string
    kind: string
    chance: number
    cost: number
  }[] {
    if (!this.diplomacy) return []
    return this.diplomacy
      .proposals()
      .slice(0, 3)
      .map((p) => {
        const rel = this.diplomacy?.relation(p.airlineId)
        const quote = this.diplomacy?.adapter.engine.counterQuote(p.id)
        return {
          id: p.id,
          airline: rel?.name ?? p.airlineId,
          airlineId: p.airlineId,
          text: p.text,
          kind: p.kind,
          chance: quote?.chance ?? 0,
          cost: quote?.cost ?? 0,
        }
      })
  }

  diplomacyCards() {
    return this.diplomacy?.cards() ?? []
  }

  /** Checklist for one carrier. Desk locks are the rows the check-in allocator already keeps. */
  hubCarrierView(id: string) {
    const airline = this.airline(id)
    const rel = this.wave3.relation(id)
    const card = this.diplomacyCards().find((row) => row.id === id)
    const engine = this.diplomacy?.adapter.engine
    const recorded = Boolean(engine?.relation(id))
    const storedPrimary = Object.entries(this.hubTiers).find(([, tier]) => tier === 'primary')?.[0] ?? null
    const holder = engine?.state.hubAirlineId ?? storedPrimary
    const dedicated = this.hubDedicated[id] ?? {}
    const leased = this.liveHubLeases(id)
    const view = checklistFromFacts({
      id,
      name: airline.name,
      signed: this.signed.includes(id),
      rosterType: rosterType(id) ?? null,
      kind: airline.kind,
      bizModel: airline.bizModel,
      storedTier: this.hubTiers[id],
      contractTier: rel.tier,
      onTime: rel.counts.onTime,
      delay: rel.counts.delay,
      cancel: rel.counts.cancel,
      keptDays: rel.counts.kept,
      diplomacyBand: card?.band.band,
      hubBlockers: recorded && engine ? engine.hubBlockers(id) : undefined,
      stands: tilesOf(this.tiles, 'stand').length,
      pads: tilesOf(this.tiles, 'helipad').length,
      overnight: dedicated.overnight ?? 0,
      lounges: (dedicated.lounges ?? 0) + leased.filter((lease) => lease.kind === 'lounge').length,
      hangars: (dedicated.hangars ?? 0) + leased.filter((lease) => lease.kind === 'hangar').length,
      fuel: dedicated.fuel ?? 0,
      pier: (dedicated.pier ?? 0) + leased.filter((lease) => lease.kind === 'gate').length,
      ramp: dedicated.ramp ?? 0,
      dedicatedPads: dedicated.pads ?? null,
      connectionMin: minimumConnectionTime(this.hubFacilities()),
      primaryHolderId: holder,
      primaryHolderName: holder ? (engine?.relation(holder)?.name ?? this.airline(holder).name) : null,
      daysAtTier: Math.max(0, this.gameDay() - (this.hubTierSince[id] ?? this.gameDay())),
      vehicles: vehicleCounts(this.liveHubVehicles(id)),
      preferredDesks: this.dedicatedDesks.filter((row) => row.airlineId === id && row.mode === 'preferred').length,
      dedicatedDesks: this.dedicatedDesks.filter((row) => row.airlineId === id && row.mode !== 'preferred').length,
    })
    return { id, name: airline.name, type: view.type, checklist: view.checklist }
  }

  hubChecklistFor(id: string) {
    return this.hubCarrierView(id).checklist
  }

  hubCarrierViews() {
    return this.signed.map((id) => this.hubCarrierView(id))
  }

  /** Lounge rooms, stands, and hangar or heavy-check bays that can take a name. */
  private hubLeaseTargets(): Record<FacilityLeaseKind, string[]> {
    const lounge: string[] = []
    for (const fit of this.fits) {
      const count = fit.rooms.lounge ?? 0
      for (let index = 0; index < count; index++) lounge.push(loungeLeaseId(fit.origin.c, fit.origin.r, index))
    }
    return {
      lounge,
      gate: tilesOf(this.tiles, 'stand').map((cell) => gateLeaseId(cell.c, cell.r)),
      hangar: tilesOf(this.tiles, ['hangar', 'mro']).map((cell) => hangarLeaseId(cell.c, cell.r)),
    }
  }

  /** Leases whose building is still on the field. A missing building does not count. */
  private liveHubLeases(airlineId?: string): FacilityLease[] {
    const targets = this.hubLeaseTargets()
    const live = new Set<string>([...targets.lounge, ...targets.gate, ...targets.hangar])
    return this.hubLeases.filter((lease) => live.has(lease.id) && (airlineId == null || lease.airlineId === airlineId))
  }

  private facilityCount(airlineId: string, kind: FacilityLeaseKind): number {
    const stored = this.hubDedicated[airlineId]
    const extra =
      kind === 'lounge' ? (stored?.lounges ?? 0) : kind === 'hangar' ? (stored?.hangars ?? 0) : (stored?.pier ?? 0)
    return extra + this.liveHubLeases(airlineId).filter((lease) => lease.kind === kind).length
  }

  /**
   * Name the next free lounge, gate, or hangar bay to this carrier.
   * The building stays the player's. An unasked lease still pays the daily credit.
   */
  dedicateHubFacility(airlineId: string, kind: FacilityLeaseKind): boolean {
    if (!this.signed.includes(airlineId)) return false
    this.dropMissingHubLeases()
    const taken = new Set(this.hubLeases.map((lease) => lease.id))
    const id = this.hubLeaseTargets()[kind].find((row) => !taken.has(row))
    if (!id) return false
    this.hubLeases.push({ id, kind, airlineId })
    this.clearHubLeaseWarning(airlineId, false)
    this.pushNews(`${this.airline(airlineId).name} dedicated ${dedicateLabel(kind).replace('Dedicate ', '')}.`, 'good')
    this.emit()
    return true
  }

  /**
   * Take the name off one building. Does not clear the selected flight or a walker.
   * A lease that gates the stored tier opens the 30-day warning.
   */
  releaseHubLease(airlineId: string, leaseId: string): boolean {
    const lease = this.hubLeases.find((row) => row.id === leaseId && row.airlineId === airlineId)
    if (!lease) return false
    this.hubLeases = this.hubLeases.filter((row) => row.id !== leaseId)
    const haveAfter = this.facilityCount(airlineId, lease.kind)
    this.noteHubLeaseGap(airlineId, lease.kind, haveAfter)
    const noun = lease.kind === 'lounge' ? 'lounge' : lease.kind === 'gate' ? 'gate' : 'hangar bay'
    this.pushNews(`${this.airline(airlineId).name} released the ${noun}.`, 'ok')
    this.emit()
    return true
  }

  hubFacilityChoices(airlineId: string): {
    kind: FacilityLeaseKind
    label: string
    blocked: string | null
    held: { id: string; label: string }[]
  }[] {
    const targets = this.hubLeaseTargets()
    const live = this.liveHubLeases()
    const taken = new Set(live.map((lease) => lease.id))
    return (['lounge', 'gate', 'hangar'] as const).map((kind) => {
      const built = targets[kind]
      const held = live.filter((lease) => lease.airlineId === airlineId && lease.kind === kind)
      return {
        kind,
        label: dedicateLabel(kind),
        blocked: dedicateBlock(kind, built.length, built.filter((id) => !taken.has(id)).length),
        held: held.map((lease) => ({ id: lease.id, label: releaseLabel(kind, lease.id, held.length) })),
      }
    })
  }

  hubLeaseWarningText(airlineId: string): string | null {
    const warning = this.hubLeaseWarnings[airlineId]
    if (!warning) return null
    const left = Math.max(0, warning.untilDay - this.gameDay())
    return `${HUB_TIER_LABEL[warning.tier]} falls in ${left} days`
  }

  /** Spare tugs, belt loaders, catering trucks, and fuel trucks, and the ones this carrier holds. */
  hubVehicleChoices(airlineId: string): {
    role: VehicleRole
    label: string
    blocked: string | null
    held: { id: string; label: string }[]
  }[] {
    const fleet = this.fleetNow()
    const live = this.liveHubVehicles()
    return VEHICLE_ROLES.map((role) => {
      const held = live.filter((lease) => lease.airlineId === airlineId && lease.role === role)
      return {
        role,
        label: dedicateVehicleLabel(role),
        blocked: vehicleBlock(role, firstSpare(role, fleet, live) != null),
        held: held.map((lease) => ({ id: lease.id, label: releaseVehicleLabel(role) })),
      }
    })
  }

  /** Assign one spare unit to this carrier. It leaves the common pool. */
  dedicateHubVehicle(airlineId: string, role: VehicleRole): boolean {
    if (!this.signed.includes(airlineId)) return false
    this.dropMissingHubVehicles()
    const spare = firstSpare(role, this.fleetNow(), this.liveHubVehicles())
    if (!spare) return false
    const paint = rosterAirline(airlineId)
    this.hubVehicleLeases.push({
      id: vehicleLeaseId(spare.type, spare.index),
      role,
      type: spare.type,
      airlineId,
      primary: paint?.primary ?? '#888888',
      secondary: paint?.secondary ?? '#f0f0f0',
    })
    this.stampHubVehicleLeases()
    this.clearHubLeaseWarning(airlineId, true)
    this.pushNews(`${this.airline(airlineId).name} dedicated a ${dedicateVehicleLabel(role).replace('Dedicate a ', '')}.`, 'good')
    this.emit()
    return true
  }

  releaseHubVehicle(airlineId: string, leaseId: string): boolean {
    const lease = this.hubVehicleLeases.find((row) => row.id === leaseId && row.airlineId === airlineId)
    if (!lease) return false
    this.hubVehicleLeases = this.hubVehicleLeases.filter((row) => row.id !== leaseId)
    this.stampHubVehicleLeases()
    const haveAfter = this.liveHubVehicles(airlineId).filter((row) => row.role === lease.role).length
    const tier = this.hubTiers[airlineId] ?? 'station'
    const type = this.hubCarrierView(airlineId).type
    if (vehicleReleaseBreaks(type, tier, lease.role, haveAfter) && this.hubLeaseWarnings[airlineId]?.tier !== tier) {
      this.hubLeaseWarnings[airlineId] = { tier, untilDay: this.gameDay() + TIER_DROP_WARNING_DAYS }
      this.pushNews(
        `${this.airline(airlineId).name} has ${TIER_DROP_WARNING_DAYS} days before ${HUB_TIER_LABEL[tier]} falls.`,
        'bad',
      )
    }
    this.pushNews(`${this.airline(airlineId).name} released the ${releaseVehicleLabel(lease.role).replace('Release the ', '')}.`, 'ok')
    this.emit()
    return true
  }

  /** Expected Accept impact. The roll is the one Accept will use, so the card matches the hit. */
  hubAngerPreview(airlineId: string): BacklashPlan {
    const next = this.hubChecklistFor(airlineId).next
    if (!next) return { anger: '', spared: '', hit: [] }
    const roll = this.hubRivalRoll ?? backlashRoll(airlineId, next, this.gameDay())
    return planBacklash({
      holderId: airlineId,
      tier: next,
      signed: this.signed
        .filter((id) => id !== airlineId)
        .map((id) => ({ id, name: this.airline(id).name, standing: this.wave3.relation(id).score })),
      roll,
      poachStandingMax: RIVAL.poachStandingMax,
    })
  }

  /** Livery on a dedicated unit. The id is the logistics truck id (`type-index`). */
  hubVehicleColor(groundId: string): string | null {
    const lease = this.liveHubVehicles().find(
      (row) => groundVehicleId(row.type, Number(row.id.split(':')[2])) === groundId,
    )
    return lease?.primary ?? null
  }

  private liveHubVehicles(airlineId?: string): VehicleLease[] {
    return liveVehicleLeases(this.hubVehicleLeases, this.fleetNow()).filter(
      (lease) => airlineId == null || lease.airlineId === airlineId,
    )
  }

  private dropMissingHubVehicles() {
    const fleet = this.fleetNow()
    const live = new Set(liveVehicleLeases(this.hubVehicleLeases, fleet).map((lease) => lease.id))
    const gone = this.hubVehicleLeases.filter((lease) => !live.has(lease.id))
    if (!gone.length) return
    this.hubVehicleLeases = this.hubVehicleLeases.filter((lease) => live.has(lease.id))
    this.stampHubVehicleLeases()
    for (const lease of gone) {
      const haveAfter = this.liveHubVehicles(lease.airlineId).filter((row) => row.role === lease.role).length
      const tier = this.hubTiers[lease.airlineId] ?? 'station'
      const type = this.hubCarrierView(lease.airlineId).type
      if (vehicleReleaseBreaks(type, tier, lease.role, haveAfter) && this.hubLeaseWarnings[lease.airlineId]?.tier !== tier) {
        this.hubLeaseWarnings[lease.airlineId] = { tier, untilDay: this.gameDay() + TIER_DROP_WARNING_DAYS }
      }
    }
  }

  private stampHubVehicleLeases() {
    const sim = this.ground?.sim
    if (!sim) return
    const live = this.liveHubVehicles()
    for (const vehicle of sim.vehicles) {
      const lease = live.find((row) => groundVehicleId(row.type, Number(row.id.split(':')[2])) === vehicle.id)
      vehicle.leaseAirline = lease?.airlineId ?? null
    }
  }

  private rivalRefuses(airlineId: string): boolean {
    return (this.hubRivalRefuse[airlineId] ?? 0) > this.gameDay()
  }

  private applyHubBacklash(holderId: string, tier: HubOfferTier) {
    if (tier === 'focus') return
    const roll = this.hubRivalRoll ?? backlashRoll(holderId, tier, this.gameDay())
    const plan = planBacklash({
      holderId,
      tier,
      signed: this.signed
        .filter((id) => id !== holderId)
        .map((id) => ({ id, name: this.airline(id).name, standing: this.wave3.relation(id).score })),
      roll,
      poachStandingMax: RIVAL.poachStandingMax,
    })
    const diplomacyPrimary = tier === 'primary' && Boolean(this.diplomacy?.adapter.engine.relation(holderId))
    for (const row of plan.hit) {
      if (!diplomacyPrimary) this.wave3.shiftRelation(row.airlineId, row.score)
      if (row.effect === 'relocate') {
        this.moveRivalToBellwater(row.airlineId, row.name)
        continue
      }
      if (row.effect === 'trim') {
        this.trimRivalRoutes(row.airlineId, tier === 'primary' ? 2 : 1)
        this.pushNews(`${row.name} cut a rotation.`, 'bad')
      } else if (row.effect === 'refuse') {
        this.hubRivalRefuse[row.airlineId] = this.gameDay() + RIVAL_REFUSE_DAYS
        this.pushNews(`${row.name} will not take a new deal for ${RIVAL_REFUSE_DAYS} days.`, 'bad')
      } else {
        this.pushNews(`${row.name} is angry about the hub. Relationship ${row.score}.`, 'bad')
      }
    }
  }

  private trimRivalRoutes(airlineId: string, count: number) {
    let left = count
    for (const slot of this.schedule) {
      if (left <= 0) break
      if (slot.airline !== airlineId) continue
      if (slot.status !== 'scheduled' && slot.status !== 'delayed') continue
      slot.status = 'cancelled'
      slot.delayReason = 'rival'
      left -= 1
    }
    this.hubRivalQuiet[airlineId] = this.gameDay() + RIVAL_TRIM_DAYS
  }

  private moveRivalToBellwater(airlineId: string, name: string) {
    const carrier = this.airline(airlineId)
    this.ensureRival()
    this.noteRivalWalkaway(carrier, 'hub rivalry')
    this.loseAirlineToRival(airlineId)
    const text = `${name} moved to ${RIVAL_NAME}.`
    this.pushNews(text, 'bad')
    this.hubRivalPhone.push({ id: `${airlineId}:${this.gameDay()}`, name, text })
  }

  /** Half of each dedicated lounge room's daily upkeep. The full room bill still posts. */
  hubLoungeShare(): number {
    const rate = HALL_AMENITY_EXPENSE.lounge ?? 0
    const share = Math.round(rate * LOUNGE_COFUND_SHARE)
    if (share <= 0) return 0
    let rooms = 0
    const live = this.liveHubLeases()
    for (const fit of this.fits) {
      const billed = Math.min(3, fit.rooms.lounge ?? 0)
      const prefix = `lounge:${fit.origin.c},${fit.origin.r}:`
      const held = live.filter((lease) => lease.kind === 'lounge' && lease.id.startsWith(prefix)).length
      rooms += Math.min(billed, held)
    }
    return rooms * share
  }

  private noteHubLeaseGap(airlineId: string, kind: FacilityLeaseKind, haveAfter: number) {
    const tier = this.hubTiers[airlineId] ?? 'station'
    const type = this.hubCarrierView(airlineId).type
    if (!releaseBreaksTier(type, tier, kind, haveAfter)) return
    if (this.hubLeaseWarnings[airlineId]?.tier === tier) return
    this.hubLeaseWarnings[airlineId] = { tier, untilDay: this.gameDay() + TIER_DROP_WARNING_DAYS }
    this.pushNews(
      `${this.airline(airlineId).name} has ${TIER_DROP_WARNING_DAYS} days before ${HUB_TIER_LABEL[tier]} falls.`,
      'bad',
    )
  }

  private clearHubLeaseWarning(airlineId: string, includeVehicles: boolean) {
    const warning = this.hubLeaseWarnings[airlineId]
    if (!warning) return
    const type = this.hubCarrierView(airlineId).type
    const met = facilityAskMet(type, warning.tier, {
      lounge: this.facilityCount(airlineId, 'lounge'),
      pier: this.facilityCount(airlineId, 'gate'),
      hangar: this.facilityCount(airlineId, 'hangar'),
    })
    const trucks = !includeVehicles || vehicleAskMet(type, warning.tier, vehicleCounts(this.liveHubVehicles(airlineId)))
    if (met && trucks) delete this.hubLeaseWarnings[airlineId]
  }

  /** A demolished building drops its lease and can open the same warning. Weather does not. */
  private dropMissingHubLeases() {
    const live = new Set<string>(Object.values(this.hubLeaseTargets()).flat())
    const gone = this.hubLeases.filter((lease) => !live.has(lease.id))
    if (!gone.length) return
    this.hubLeases = this.hubLeases.filter((lease) => live.has(lease.id))
    for (const lease of gone) {
      this.noteHubLeaseGap(lease.airlineId, lease.kind, this.facilityCount(lease.airlineId, lease.kind))
    }
  }

  private settleHubLeaseWarnings(completedDay: number) {
    this.dropMissingHubLeases()
    this.dropMissingHubVehicles()
    for (const [id, warning] of Object.entries(this.hubLeaseWarnings)) {
      if (completedDay < warning.untilDay) continue
      if ((this.hubTiers[id] ?? 'station') === warning.tier) {
        const next = tierBelow(this.hubCarrierView(id).type, warning.tier)
        if (next === 'station') delete this.hubTiers[id]
        else this.hubTiers[id] = next
        this.hubTierSince[id] = this.gameDay()
        this.pushNews(`${this.airline(id).name} lost ${HUB_TIER_LABEL[warning.tier]}.`, 'bad')
      }
      delete this.hubLeaseWarnings[id]
    }
  }

  diplomacyQuote(proposalId: string, ticks: import('../diplomacy/types.ts').CounterLineKey[]) {
    return this.diplomacy?.adapter.engine.counterQuote(proposalId, ticks) ?? null
  }

  diplomacyPreview(airlineId: string) {
    return this.diplomacy?.adapter.engine.previewSign(airlineId) ?? null
  }

  answerDiplomacy(
    proposalId: string,
    response: 'accept' | 'decline' | 'counter' | 'support',
    ticks?: import('../diplomacy/types.ts').CounterLineKey[],
  ) {
    const d = this.ensureDiplomacy()
    const before = new Set(d.signedIds())
    const result = d.respond(proposalId, response, ticks)
    if (result.ok && (response === 'accept' || response === 'support')) {
      for (const id of d.signedIds()) {
        if (!before.has(id)) this.adoptDiplomacyCarrier(id)
      }
    }
    if (!result.ok && response !== 'counter') this.pushNews(result.message, 'bad')
    if (response === 'counter') this.pushNews(result.message, result.ok ? 'good' : 'bad')
    this.emit()
    return result
  }

  answerDiplomacyDemand(demandId: string, response: 'accept' | 'decline') {
    const result = this.ensureDiplomacy().adapter.engine.respondToDemand(demandId, response)
    this.pushNews(result.message, result.ok ? 'good' : 'bad')
    this.emit()
    return result
  }

  counterDiplomacyDemand(demandId: string, mode: 'lighter' | 'longer') {
    const result = this.ensureDiplomacy().adapter.engine.counterDemand(demandId, mode)
    this.pushNews(result.message, result.ok ? 'good' : 'bad')
    this.emit()
    return result
  }

  diplomacyApologize(airlineId: string) {
    const result = this.ensureDiplomacy().adapter.engine.apologize(airlineId)
    this.pushNews(result.message, result.ok ? 'good' : 'bad')
    this.emit()
    return result
  }

  diplomacyEndeavor(airlineId: string) {
    const result = this.ensureDiplomacy().adapter.engine.startEndeavor(airlineId)
    this.pushNews(result.message, result.ok ? 'good' : 'bad')
    this.emit()
    return result
  }

  /** Intro card for a T3+ exec the player has not met. Null for logo-only airlines. */
  diplomacyMeet(airlineId: string) {
    const engine = this.diplomacy?.adapter.engine
    if (!engine) return null
    const scene = engine.firstMeetScene(airlineId)
    if (!scene) return null
    const card = engine.getCard(airlineId)
    if (!card?.figure) return null
    return {
      airlineId: scene.airlineId,
      greeting: scene.greeting,
      heard: scene.heard,
      choices: scene.choices,
      airline: card.name,
      name: card.figure.name,
      title: card.figure.title,
      portrait: card.portrait,
      traits: card.figure.traits,
      agenda: card.figure.agenda,
    }
  }

  resolveDiplomacyMeet(airlineId: string, choice: 'formal' | 'warm' | 'bold' | 'tour') {
    const result = this.ensureDiplomacy().adapter.engine.resolveFirstMeet(airlineId, choice)
    const tone = Number(result.data?.tone ?? 0)
    this.pushNews(result.message, result.ok ? (tone >= 0 ? 'good' : 'bad') : 'bad')
    this.emit()
    return result
  }

  diplomacyReaction(airlineId: string, kind: 'sign' | 'perk' | 'hub' | 'slots' = 'sign') {
    return this.diplomacy?.adapter.engine.previewReaction(airlineId, kind) ?? null
  }

  diplomacySpats() {
    return this.diplomacy?.adapter.engine.openSpats() ?? []
  }

  answerDiplomacySpat(spatId: string, response: 'concede' | 'hold' | 'court', rivalId?: string) {
    const result = this.ensureDiplomacy().adapter.engine.respondToSpat(spatId, response, rivalId)
    this.pushNews(result.message, result.ok ? 'good' : 'bad')
    this.emit()
    return result
  }

  requestDiplomacyHub(airlineId: string) {
    const result = this.ensureDiplomacy().adapter.engine.requestHub(airlineId)
    this.pushNews(result.message, result.ok ? 'good' : 'bad')
    this.emit()
    return result
  }

  private adoptDiplomacyCarrier(id: string) {
    const rel = this.ensureDiplomacy().relation(id)
    if (!rel) return
    if (!AIRLINES[id] && !this.extraAirlines.some((a) => a.id === id)) {
      const template = rel.kind === 'cargo' ? AIRLINES.upps : rel.tier <= 2 ? AIRLINES.northline : AIRLINES.harbor
      this.extraAirlines.push(
        normalizeAirline({
          ...template,
          id: rel.id,
          name: rel.name,
          color: rel.livery[0],
          stripe: rel.livery[1],
          tier: rel.tier,
          kind: rel.kind === 'cargo' ? 'cargo' : 'pax',
          procedural: true,
        }),
      )
    }
    if (this.signed.includes(id)) return
    this.signed.push(id)
    if (this.airlineHeat[id] == null) this.airlineHeat[id] = 70
    this.pullCarrierFromRival(id, rel.name)
    this.seedScheduleForAirline(id, 3)
    this.pushNews(`${rel.name} signed. Flights hit the timetable.`, 'good')
  }

  /** Mean Standing across signed carriers. Null when nobody has signed. */
  avgStanding(): number | null {
    if (!this.signed.length) return null
    let sum = 0
    for (const id of this.signed) sum += this.standingOf(id)
    return sum / this.signed.length
  }

  fieldXpToNext() {
    return fieldProgress(this.fieldXp)
  }

  grantFieldXp(amount: number, why?: string) {
    if (amount <= 0) return
    const before = this.fieldLevel()
    const starsBefore = prestigeStarsOf(this.fieldXp)
    const beforeLate = this.lateFieldLevel()
    this.fieldXp += amount
    const after = this.fieldLevel()
    const starsAfter = prestigeStarsOf(this.fieldXp)
    const afterLate = this.lateFieldLevel()
    if (after > before) {
      const meta = after <= 5 ? AIRLINE_TIER_META[after as AirlineTier] : undefined
      const payouts = this.researchTree.claimNewLevels(after)
      const paid = payouts.reduce((sum, row) => sum + row.cash, 0)
      if (paid > 0) this.credit(paid, 'level_reward', `Field Level ${after}`)
      const lump = payouts.length
        ? ` +$${paid.toLocaleString('en-US')} and ${payouts.reduce((sum, row) => sum + row.rp, 0)} RP.`
        : ''
      this.pushNews(
        meta
          ? `Field Level ${after} — ${meta.label} carriers will start calling.${lump}`
          : `Field Level ${after} — hub links open.${lump}`,
        'good',
      )
    }
    if (starsAfter > starsBefore) {
      this.pushNews(`Prestige star P${starsAfter}.`, 'good')
    } else if (afterLate > beforeLate && afterLate > 5 && after === before) {
      this.pushNews(`Field Level ${afterLate}.`, 'good')
    } else if (why && amount >= 12 && after === before) {
      /* quiet drip — big chunks can mention */
      void why
    }
  }

  /**
   * Can this field host an offer from this carrier's tier?
   * Lv1 opens T1+T2 (commuter + regional starter lane). Higher levels open +1 each.
   */
  tierUnlocked(tier: AirlineTier): boolean {
    const lv = this.fieldLevel()
    const openThrough = Math.min(5, (lv + 1) as AirlineTier) as AirlineTier
    if (tier <= openThrough) return true
    // Peek one more tier when reputation is strong.
    return tier === openThrough + 1 && this.reputation >= 55 + tier * 4
  }

  loanProduct(id: string | null | undefined) {
    if (id && this.drawnLoan?.id === id) return this.drawnLoan
    return LOAN_PRODUCTS.find((p) => p.id === id) ?? null
  }

  /**
   * Slider draw. An exact catalog principal uses that product.
   * Any other amount books principal plus the micro fee rate, and the button owes both.
   */
  drawLoan(amount: number) {
    const principal = Math.round(Number.isFinite(amount) ? amount : 0)
    if (principal <= 0) {
      this.pushNews('Pick a loan amount first.', 'bad')
      this.emit()
      return
    }
    const catalog = LOAN_PRODUCTS.find((p) => p.principal === principal)
    if (catalog) {
      this.drawnLoan = null
      this.takeLoanProduct(catalog.id)
      return
    }
    const bridge = LOAN_PRODUCTS.find((p) => p.id === 'bridge') ?? LOAN_PRODUCTS[0]
    if (!bridge) return
    const fee = loanFeeForAmount(principal)
    this.drawnLoan = {
      id: 'drawn',
      label: 'Drawn loan',
      blurb: 'Slider draw at the bridge rate.',
      principal,
      fee,
      rate: bridge.rate,
      interestFloor: bridge.interestFloor,
      every: bridge.every,
      termDays: bridge.termDays,
      minFieldLevel: 1,
      minRep: 0,
    }
    this.takeLoanProduct('drawn')
  }

  availableLoans() {
    return loansAvailable(LOAN_PRODUCTS, this.fieldLevel(), this.reputation, this.sandbox)
  }

  takeLoanProduct(productId: string) {
    if (this.loanBalance > 0) {
      this.pushNews('Pay off the open loan first.', 'bad')
      this.emit()
      return
    }
    const p = this.loanProduct(productId)
    if (!p) {
      this.pushNews('Unknown loan product.', 'bad')
      this.emit()
      return
    }
    if (!this.sandbox && (this.fieldLevel() < p.minFieldLevel || this.reputation < p.minRep)) {
      this.pushNews(
        `${p.label} locked — need Field Lv${p.minFieldLevel}+ and rep ${p.minRep}+.`,
        'bad',
      )
      this.emit()
      return
    }
    this.loanProductId = p.id
    this.loanPrincipal = p.principal
    this.loanOpened = p.principal + p.fee
    this.loanBalance = this.loanOpened
    this.cash += p.principal
    this.postJournal('loan_proceeds', p.principal, this.simMinutes())
    this.interestCool = p.every
    this.loanNewsCool = 0
    this.pushNews(
      `${p.label}: bank wired ${moneyLeft(p.principal)} (fee ${moneyLeft(p.fee)}). Owe ${moneyLeft(this.loanBalance)}.`,
      'ok',
    )
    this.emit()
  }

  heatOf(id: AirlineId): number {
    return this.airlineHeat[id] ?? 70
  }

  /** Player-facing alias — airline Standing (same 0–100 meter as heatOf). */
  standingOf(id: AirlineId): number {
    return this.heatOf(id)
  }

  isBanned(id: AirlineId): boolean {
    const until = this.airlineBanUntil[id]
    // A missing ban is stored as nothing, or as 0. Time zero is not a ban,
    // even while the clock is still a fraction below the start.
    if (until == null || until <= 0) return false
    return until > this.clock
  }

  banRemaining(id: AirlineId): number {
    const until = this.airlineBanUntil[id]
    if (until == null || until <= 0) return 0
    return Math.max(0, until - this.clock)
  }

  adjustHeat(id: AirlineId, delta: number, cause?: StandingCauseCategory) {
    if (delta < 0) {
      this.standingAdvisor.recordCauseImpact(id, cause ?? 'hall_amenities', delta)
    }
    const a = this.airline(id)
    let h = this.heatOf(id)
    if (delta < 0) h += delta * a.heatSensitivity
    else h += delta
    // Soft floor outside an active layover — schedule cascades shouldn't zero a carrier overnight.
    const floor = this.layover?.airline === id ? 0 : 15
    this.airlineHeat[id] = clamp(h, floor, 100)
    if (
      this.airlineHeat[id] <= this.banThreshold(id) &&
      this.layover?.airline === id &&
      !this.isBanned(id)
    ) {
      this.banAirline(id, 'layover Standing crashed')
    }
  }

  /** One hall-miss headline per flight / destination window. */
  hallMissNews(key: string, text: string) {
    if ((this.hallMissCool[key] ?? 0) > this.clock) return
    this.hallMissCool[key] = this.clock + 14
    this.pushNews(text, 'bad')
  }

  isHub(id: AirlineId): boolean {
    return this.hubAirlines.includes(id)
  }

  banThreshold(id: AirlineId): number {
    if (!this.isHub(id)) return HEAT_BAN_THRESHOLD
    return HUB_BAN_THRESHOLD + this.specMods().hubBanDelta
  }

  banAirline(id: AirlineId, reason: string) {
    if (this.isBanned(id)) return
    const a = this.airline(id)
    const wasHub = this.isHub(id)
    const banSecs = wasHub ? LAYOVER_BAN_SECONDS + 40 : LAYOVER_BAN_SECONDS
    const fine = wasHub ? LAYOVER_BAN_FINE + 4000 : LAYOVER_BAN_FINE
    this.airlineBanUntil[id] = this.clock + banSecs
    this.airlineHeat[id] = Math.min(this.heatOf(id), this.banThreshold(id) - 2)
    this.charge(fine, 'penalties', this.simMinutes(), 'Carrier ban')
    this.noteRelationFine(id)
    if (this.layover?.airline === id) this.layover = null
    if (this.layoverOffer?.airline === id) this.layoverOffer = null
    if (this.hubOffer?.airline === id) this.hubOffer = null
    if (wasHub) {
      this.hubAirlines = this.hubAirlines.filter((x) => x !== id)
      this.pushNews(`${a.name} pulled the Hub plaque after the ban.`, 'bad')
    }
    this.pushNews(
      `${a.name} banned you for ${banSecs}s (${reason}). Fine ${moneyLeft(fine)}. Raise their Standing before the ban ends.`,
      'bad',
    )
    this.reputation = Math.max(0, this.reputation - (wasHub ? 10 : 6))
  }

  /**
   * AT3-readable Field Rating 0–100.
   * Blend of reputation, avg airline heat, hall wear inverse, security budget.
   */
  fieldRating(): number {
    const rep = clampReputation(this.reputation)
    const heats = this.signed.map((id) => this.heatOf(id))
    const avgHeat = clamp(
      heats.length ? heats.reduce((s, h) => s + h, 0) / heats.length : 55,
      0,
      100,
    )
    const wear = this.avgWear()
    const wearScore = clamp(100 - (wear.bath * 0.55 + wear.sec * 0.45), 0, 100)
    const secScore = clamp(this.budgetOf('security'), 0, 100)
    const incidents = Math.min(20, Math.max(0, this.securityIncidents))
    const raw =
      rep * 0.34 +
      avgHeat * 0.32 +
      wearScore * 0.2 +
      secScore * 0.14 -
      incidents * 1.2
    return clamp(Math.round(raw), 0, 100)
  }

  /** Whole-number reputation the HUD shows. Eased, never outside 0–100. */
  reputationDisplay(): number {
    return Math.round(clampReputation(this.reputationShown))
  }

  /** Passenger mood. Applied a little per second so a full bank cannot slam the meter. */
  private queueReputation(delta: number) {
    if (!Number.isFinite(delta) || delta === 0) return
    this.reputationDrift += delta
  }

  private flushReputation(dt: number) {
    const step = takeReputationDrift(this.reputationDrift, dt)
    this.reputationDrift = step.left
    if (step.apply !== 0) this.reputation = clampReputation(this.reputation + step.apply)
    else this.reputation = clampReputation(this.reputation)
    this.reputationShown = smoothReputation(this.reputationShown, this.reputation, dt)
  }

  fieldRatingLabel(): string {
    const r = this.fieldRating()
    if (r >= 85) return 'Hub grade'
    if (r >= 70) return 'Solid'
    if (r >= 55) return 'Serviceable'
    if (r >= 40) return 'Thin'
    return 'At risk'
  }

  rewardOf(id: AirlineId): AirlineRewardId | null {
    return this.airlineReward[id] ?? null
  }

  hasReward(id: AirlineId, kind: AirlineRewardId): boolean {
    return this.airlineReward[id] === kind
  }

  /** Any signed carrier holding this perk. */
  anyReward(kind: AirlineRewardId): boolean {
    return this.signed.some((id) => this.airlineReward[id] === kind)
  }

  grantReward(id: AirlineId) {
    if (this.airlineReward[id]) return
    const a = this.airline(id)
    const reward = rewardForPersona(a.persona)
    this.airlineReward[id] = reward
    // Persona-flavored unlocks — physical hall / bank payoffs.
    if (reward === 'brand_lounge') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit) fit.rooms.lounge = Math.max(fit.rooms.lounge ?? 0, 1) + 1
      this.pushNews(
        `${a.name} First-class lounge open — their premium pax get the branded calm.`,
        'good',
      )
    } else if (reward === 'budget_perk') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit && (fit.rooms.food ?? 0) < 1) fit.rooms.food = 1
      this.pushNews(
        `${a.name} snack franchise live — budget pax overpay for fries in their colors.`,
        'good',
      )
    } else if (reward === 'biz_priority') {
      this.seedScheduleForAirline(id, 2)
      this.pushNews(
        `${a.name} priority slots — denser bank + richer landing fees.`,
        'good',
      )
    } else if (reward === 'cargo_night') {
      this.pushNews(
        `${a.name} night waiver — freighter handling pays up after dark.`,
        'good',
      )
    }
    this.pushNews(
      `${a.name} unlocked ${REWARD_LABEL[reward]} (Standing ${HEAT_REWARD_THRESHOLD}+). ${REWARD_DETAIL[reward]}`,
      'good',
    )
    this.reputation = Math.min(100, this.reputation + 2)
  }

  /** Airlines currently under a warn flag. */
  warnedAirlines(): AirlineId[] {
    return this.signed.filter((id) => this.airlineWarned[id] && !this.isBanned(id))
  }

  /** Carrier walks after sustained dead heat — fine + drop contract + strip perk. */
  abandonAirline(id: AirlineId, reason: string) {
    if (!this.signed.includes(id)) return
    const a = this.airline(id)
    this.noteRivalWalkaway(a, reason)
    const lost = this.airlineReward[id] ?? null
    this.signed = this.signed.filter((x) => x !== id)
    this.diplomacy?.noteLeft(id)
    this.mxSigned = this.mxSigned.filter((x) => x !== id)
    this.hubAirlines = this.hubAirlines.filter((x) => x !== id)
    delete this.airlineReward[id]
    delete this.airlineWarned[id]
    delete this.airlineLowAcc[id]
    this.airlineHeat[id] = Math.min(this.heatOf(id), HEAT_ABANDON_THRESHOLD)
    this.forfeitAirlineDeposit(id)
    this.charge(ABANDON_FINE, 'penalties', this.simMinutes(), 'Carrier walked away')
    this.wave3.noteTurnaround(id, 'cancel')
    this.noteRelationFine(id)
    // Reverse persona unlocks — empty lounge / franchise leaves a scar.
    if (lost === 'brand_lounge') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit && (fit.rooms.lounge ?? 0) > 0) {
        fit.rooms.lounge = Math.max(0, (fit.rooms.lounge ?? 0) - 1)
      }
      this.pushNews(
        `${a.name} pulled their first-class lounge — premium tips dry up.`,
        'bad',
      )
    } else if (lost === 'budget_perk') {
      this.pushNews(
        `${a.name} franchise signs come down — snack spend cools.`,
        'bad',
      )
    } else if (lost === 'biz_priority') {
      this.pushNews(
        `${a.name} priority slots voided — bank thins.`,
        'bad',
      )
    } else if (lost === 'cargo_night') {
      this.pushNews(
        `${a.name} night waiver revoked — freighter premiums gone.`,
        'bad',
      )
    }
    if (this.layover?.airline === id) this.layover = null
    if (this.layoverOffer?.airline === id) this.layoverOffer = null
    if (this.hubOffer?.airline === id) this.hubOffer = null
    if (this.offer?.airline === id) this.offer = null
    if (this.mxOffer?.airline === id) this.mxOffer = null
    for (const s of this.schedule) {
      if (
        s.airline === id &&
        (s.status === 'scheduled' || s.status === 'delayed')
      ) {
        s.status = 'cancelled'
        s.delayReason = 'carrier abandoned'
      }
    }
    // Contagion — other signed carriers cool a notch.
    for (const other of this.signed) {
      this.adjustHeat(other, -4)
    }
    const perkBit = lost ? ` Lost ${REWARD_LABEL[lost]}.` : ''
    this.pushNews(
      `${a.name} abandoned the field (${reason}). Fine ${moneyLeft(ABANDON_FINE)}.${perkBit} Win Standing back, then sign them again.`,
      'bad',
    )
    this.reputation = Math.max(0, this.reputation - (lost ? 11 : 8))
  }

  landingFeeMult(airlineId: AirlineId): number {
    const mods = this.specMods()
    const r = this.rewardOf(airlineId)
    // Negotiated percents land on each line in contractBill, not as a blanket.
    // Spec trees scale the same published index: low-cost cuts, luxury and pax landing stack.
    const base = r === 'biz_priority' ? 1.14 : r === 'cargo_night' ? 1.2 : 1
    let mult = base * this.publishedFeeIndex * this.disruptions.feeMultiplier()
    const a = this.airline(airlineId)
    if (a.bizModel === 'lcc' || a.persona === 'budget') mult *= mods.lowCostFee
    if (a.bizModel === 'full_service' || a.persona === 'luxury' || a.persona === 'business') {
      mult *= mods.premiumFee
    }
    if (a.kind === 'pax') mult *= mods.paxLanding
    if (!Number.isFinite(mult) || mult <= 0) return 1
    return Math.min(2, Math.max(0.5, mult))
  }

  private ensureRival(): RivalAirport {
    if (!this.rival) this.rival = RivalAirport.create(this.diplomacySeed || 1)
    return this.rival
  }

  private noteRivalWalkaway(a: Airline, reason: string) {
    this.rivalWalkaways.push({
      id: a.id,
      name: a.name,
      tier: a.tier,
      kind: a.kind,
      reason,
    })
  }

  private playerRivalSnapshot(): PlayerSnapshot {
    const stands = tilesOf(this.tiles, 'stand').length
    const standing = this.signed.length
      ? this.signed.reduce((sum, id) => sum + this.standingOf(id), 0) / this.signed.length
      : this.reputation
    const service = clamp(this.reputation * 0.55 + standing * 0.45, 0, 100)
    return {
      name: this.branding.airportName,
      feeIndex: this.diplomacy?.adapter.engine.state.feeIndex ?? 1,
      service,
      capacity: stands,
      reputation: this.reputation,
      airlines: this.signed.map((id) => {
        const carrier = this.airline(id)
        return {
          id,
          name: carrier.name,
          tier: carrier.tier,
          kind: carrier.kind,
          standing: this.standingOf(id),
        }
      }),
    }
  }

  private advanceRivalDay() {
    if (!this.site) return
    const walked = this.rivalWalkaways.splice(0, this.rivalWalkaways.length)
    const result = this.ensureRival().advanceDay(this.playerRivalSnapshot(), walked)
    for (const move of result.moves) {
      if (move.announce) this.pushNews(move.text, move.tone)
    }
    for (const carrier of result.poached) this.loseAirlineToRival(carrier.id)
  }

  /** Catchment load factor. 1 when Bellwater and the player split demand evenly. */
  rivalDemandFactor(): number {
    if (!this.site) return 1
    return this.ensureRival().demand(this.playerRivalSnapshot()).playerFactor * researchMods(this.researchTree.state.unlocked).demand
  }

  rivalPanel() {
    if (!this.rival) return null
    return this.rival.panel(this.playerRivalSnapshot())
  }

  private pullCarrierFromRival(id: string, name: string) {
    if (!this.site && !this.rival) return
    const move = this.ensureRival().releaseToPlayer(id, name)
    if (move?.announce) this.pushNews(move.text, move.tone)
  }

  /** Spend a real incentive to pull a Bellwater carrier onto this field. */
  courtRivalCarrier(id: string) {
    const carrier = this.allAirlines().find((a) => a.id === id)
    if (!carrier) {
      this.pushNews('That carrier is not in the book.', 'bad')
      this.emit()
      return
    }
    if (this.signed.includes(id)) {
      this.pushNews(`${carrier.name} already flies here.`, 'ok')
      this.emit()
      return
    }
    if (!this.meetsReq(id)) {
      const miss = this.missingReq(id).slice(0, 3).join(', ')
      this.pushNews(
        miss ? `${carrier.name} wants ${miss} before basing here.` : `${carrier.name} won't base here yet.`,
        'bad',
      )
      this.emit()
      return
    }
    const offer = this.playerRivalSnapshot()
    const quote = this.ensureRival().quoteCourt(id, offer)
    if (!quote.ok) {
      this.pushNews(quote.reason, 'bad')
      this.emit()
      return
    }
    if (!this.spend(quote.cost, `Court ${carrier.name}`)) return
    const result = this.ensureRival().commitCourt(id, offer)
    this.pushNews(result.text, result.won ? 'good' : 'bad')
    if (result.won && !this.signed.includes(id)) {
      this.signed.push(id)
      if (this.airlineHeat[id] == null) this.airlineHeat[id] = 64
      this.seedScheduleForAirline(id, 2)
    }
    this.emit()
  }

  /** Bellwater took a signed carrier. No abandon fine — the loss is the base. */
  private loseAirlineToRival(id: AirlineId) {
    if (!this.signed.includes(id)) return
    const a = this.airline(id)
    const lost = this.airlineReward[id] ?? null
    this.signed = this.signed.filter((x) => x !== id)
    this.diplomacy?.noteLeft(id)
    this.mxSigned = this.mxSigned.filter((x) => x !== id)
    this.hubAirlines = this.hubAirlines.filter((x) => x !== id)
    delete this.airlineReward[id]
    delete this.airlineWarned[id]
    delete this.airlineLowAcc[id]
    if (lost === 'brand_lounge') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit && (fit.rooms.lounge ?? 0) > 0) {
        fit.rooms.lounge = Math.max(0, (fit.rooms.lounge ?? 0) - 1)
      }
      this.pushNews(`${a.name} pulled their lounge on the way to Bellwater.`, 'bad')
    } else if (lost) {
      this.pushNews(`${a.name} took ${REWARD_LABEL[lost]} with them to Bellwater.`, 'bad')
    }
    if (this.layover?.airline === id) this.layover = null
    if (this.layoverOffer?.airline === id) this.layoverOffer = null
    if (this.hubOffer?.airline === id) this.hubOffer = null
    if (this.offer?.airline === id) this.offer = null
    if (this.mxOffer?.airline === id) this.mxOffer = null
    for (const s of this.schedule) {
      if (s.airline === id && (s.status === 'scheduled' || s.status === 'delayed')) {
        s.status = 'cancelled'
        s.delayReason = 'poached'
      }
    }
    for (const other of this.signed) this.adjustHeat(other, -3)
    this.reputation = Math.max(0, this.reputation - RIVAL.poachReputationHit)
  }

  private rivalCargoUnits(units: number): number {
    return Math.max(6, Math.round(units * this.rivalDemandFactor()))
  }

  private applyRivalLoad<T extends { pax: number; bagUnits: number }>(load: T, cargo: boolean, paxMax = 0): T {
    if (cargo || load.pax <= 0) return load
    const factor = this.rivalDemandFactor()
    const scaled = Math.max(1, Math.round(load.pax * factor))
    return {
      ...load,
      pax: paxMax > 0 ? Math.min(paxMax, scaled) : scaled,
      bagUnits: load.bagUnits > 0 ? Math.max(1, Math.round(load.bagUnits * factor)) : 0,
    }
  }

  /** Move the published fee index by a fraction (0.01 = 1%). Feeds Standing and landing fees. */
  setPublishedFeeIndex(index: number) {
    const next = Math.round(Math.max(0.8, Math.min(1.4, index)) * 100) / 100
    if (next === this.publishedFeeIndex) return
    this.publishedFeeIndex = next
    this.ensureDiplomacy().adapter.engine.notePublishedFees(next)
    this.emit()
  }

  hasResearch(id: ResearchId): boolean {
    if (this.researchUnlocked.includes(id)) return true
    if (hubUpgrade(id)) return false
    const nodeId = DESK_TO_NODE[id]
    return nodeId ? this.researchTree.owns(nodeId) : false
  }

  /** Desk projects the tree grants, plus anything already stored. Hub upgrades stay explicit. */
  researchGrants(): ResearchId[] {
    return this.grantedResearch()
  }

  /** Desk projects implied by the tree, plus ids already stored. Hub upgrades stay explicit. */
  private grantedResearch(): ResearchId[] {
    const ids = new Set(this.researchUnlocked)
    for (const id of deskIdsForNode(this.researchTree.state.unlocked)) {
      if (!hubUpgrade(id)) ids.add(id)
    }
    return [...ids]
  }

  /** Desk projects the owned tree nodes grant, plus anything already on the save. Hub cash stays explicit. */
  private noteTreeGrants() {
    for (const id of deskIdsForNode(this.researchTree.state.unlocked)) {
      if (hubUpgrade(id)) continue
      if (!this.researchUnlocked.includes(id)) this.researchUnlocked.push(id)
    }
  }

  /** Owned tree nodes whose hub build cost has not been paid. */
  unpaidResearchNodes(): string[] {
    const pending: string[] = []
    for (const nodeId of this.researchTree.state.unlocked) {
      for (const deskId of deskIdsForNode([nodeId])) {
        const upgrade = hubUpgrade(deskId)
        if (upgrade && !this.researchUnlocked.includes(deskId)) pending.push(nodeId)
      }
    }
    return pending
  }

  private chargeHubBills(nodeId: string): { ok: boolean; paid: boolean; why: string } {
    let paid = false
    for (const deskId of deskIdsForNode([nodeId])) {
      const upgrade = hubUpgrade(deskId)
      if (!upgrade || this.researchUnlocked.includes(deskId)) continue
      if (upgrade.requires && !this.hasResearch(upgrade.requires)) {
        const need = hubUpgrade(upgrade.requires)
        return { ok: false, paid, why: `Need ${need?.name ?? upgrade.requires} first.` }
      }
      if (this.fieldLevel() < upgrade.minFieldLevel) {
        return { ok: false, paid, why: `Need Field Level ${upgrade.minFieldLevel}.` }
      }
      if (!this.sandbox && this.cash < upgrade.buildCost) {
        return { ok: false, paid, why: `Need ${moneyLeft(upgrade.buildCost)} cash.` }
      }
      if (upgrade.buildCost > 0 && !this.spend(upgrade.buildCost, upgrade.name)) {
        return { ok: false, paid, why: `Need ${moneyLeft(upgrade.buildCost)} cash.` }
      }
      this.researchUnlocked.push(deskId)
      paid = true
    }
    return { ok: true, paid, why: '' }
  }

  /** Sim day cycle ~180s; night is the last third. */
  isNight(): boolean {
    return this.clock % 180 >= 120
  }

  canBuyResearch(id: ResearchId): { ok: boolean; why: string } {
    const nodeId = DESK_TO_NODE[id]
    const treeNode = nodeId ? nodeById(nodeId) : undefined
    if (!treeNode) return { ok: false, why: 'Unknown project.' }
    if (this.hasResearch(id)) return { ok: false, why: 'Already unlocked.' }
    const upgrade = hubUpgrade(id)
    if (upgrade?.requires && !this.hasResearch(upgrade.requires)) {
      const need = hubUpgrade(upgrade.requires)
      return { ok: false, why: `Need ${need?.name ?? upgrade.requires} first.` }
    }
    if (upgrade && this.fieldLevel() < upgrade.minFieldLevel) {
      return { ok: false, why: `Need Field Level ${upgrade.minFieldLevel}.` }
    }
    if (upgrade && !this.sandbox && this.cash < upgrade.buildCost) {
      return { ok: false, why: `Need ${moneyLeft(upgrade.buildCost)} cash.` }
    }
    if (!this.researchTree.owns(treeNode.id)) {
      const status = nodeState(this.researchTree.state, treeNode, this.fieldLevel())
      if (status === 'locked') {
        if (!categoryUnlocked(treeNode.category, this.fieldLevel())) {
          const row = CATEGORIES.find((item) => item.id === treeNode.category)
          return { ok: false, why: `Needs Field Level ${row?.unlockLevel ?? 1}.` }
        }
        return { ok: false, why: 'Research the previous step first.' }
      }
      const cost = nodeCost(this.researchTree.state, treeNode)
      if (this.researchPoints < cost) {
        return { ok: false, why: `Need ${cost} RP (have ${Math.floor(this.researchPoints)}).` }
      }
    }
    return { ok: true, why: '' }
  }

  buyResearch(id: ResearchId) {
    const gate = this.canBuyResearch(id)
    const node = RESEARCH_NODES.find((n) => n.id === id)
    if (!node) return
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    const upgrade = hubUpgrade(id)
    if (upgrade && upgrade.buildCost > 0) {
      if (!this.spend(upgrade.buildCost, upgrade.name)) return
    }
    const nodeId = DESK_TO_NODE[id]
    if (nodeId && !this.researchTree.owns(nodeId)) {
      const bought = this.researchTree.buy(nodeId, this.fieldLevel())
      if (!bought.ok) {
        this.pushNews(bought.why, 'bad')
        this.emit()
        return
      }
    }
    if (!this.researchUnlocked.includes(id)) this.researchUnlocked.push(id)
    this.noteTreeGrants()
    this.pushNews(`R&D unlocked: ${node.name} — ${node.blurb}`, 'good')
    this.reputation = Math.min(100, this.reputation + 1)
    this.emit()
  }

  /** Metal this carrier is allowed to fly. A named fleet never grows with contract tier. */
  previewMetal(airlineId: string): string | null {
    return this.pickForAirline(airlineId, this.airline(airlineId).kind === 'cargo').af?.id ?? null
  }

  wave3BuyPreview(id: string): { ok: boolean; why: string } {
    const nodeId = WAVE3_TO_NODE[id]
    const node = nodeId ? nodeById(nodeId) : undefined
    if (!node) return { ok: false, why: 'Unknown research.' }
    if (this.researchTree.owns(node.id)) return { ok: false, why: 'Already researched.' }
    const status = nodeState(this.researchTree.state, node, this.fieldLevel())
    if (status === 'locked') return { ok: false, why: 'Research the previous step first.' }
    const cost = nodeCost(this.researchTree.state, node)
    if (this.researchPoints < cost) return { ok: false, why: `Need ${cost} research points.` }
    return { ok: true, why: node.name }
  }

  buyResearchNode(id: string) {
    if (this.researchTree.owns(id)) {
      const bill = this.chargeHubBills(id)
      this.noteTreeGrants()
      if (!bill.ok) this.pushNews(bill.why, 'bad')
      else this.pushNews(bill.paid ? 'Research: paid the build cost.' : 'Already researched.', bill.paid ? 'good' : 'bad')
      this.emit()
      return bill.ok && bill.paid
    }
    const result = this.researchTree.buy(id, this.fieldLevel())
    if (!result.ok) {
      this.pushNews(result.why, 'bad')
      this.emit()
      return false
    }
    const bill = this.chargeHubBills(id)
    this.noteTreeGrants()
    this.pushNews(bill.ok ? `Research: ${result.why}` : bill.why, bill.ok ? 'good' : 'bad')
    this.emit()
    return bill.ok
  }

  /** Wave 3 ids are aliases onto the Growth tree. */
  buyWave3(id: string) {
    const nodeId = WAVE3_TO_NODE[id]
    if (!nodeId) {
      this.pushNews('Unknown research.', 'bad')
      this.emit()
      return false
    }
    return this.buyResearchNode(nodeId)
  }

  /** Award a small operations trickle when a jet/helo finishes takeoff. It lands on the Growth tree. */
  grantResearchForFlight(f: Flight) {
    let rp = FLIGHT_RP
    if (f.pax > 0) rp += Math.floor(f.pax / 50) * FLIGHT_RP_PER_50_PAX
    if (f.kind === 'freighter' && this.hasResearch('night_bank') && this.isNight()) {
      rp += NIGHT_FREIGHT_RP
    }
    this.researchTree.credit(rp, this.fieldLevel())
  }

  pickAircraftKind(airlineId: AirlineId): AircraftKind {
    const a = this.airline(airlineId)
    if (a.kind === 'cargo') return 'freighter'
    const contracted = contractedAirframes(this.contractFleet(a.id), a.paxMin, a.paxMax)
    if (contracted.length) {
      const counts = new Map<AircraftKind, number>()
      for (const af of contracted) counts.set(af.kind, (counts.get(af.kind) ?? 0) + 1)
      let best = contracted[0].kind
      let n = 0
      for (const [kind, count] of counts) {
        if (count > n) {
          best = kind
          n = count
        }
      }
      return best
    }
    // Opening: the first small carrier flies regional metal, which the prefab can turn.
    // A second signature, or the clock leaving the opening, brings the normal mix back.
    if (this.clock < OPENING_SEC && this.signed.length <= 1 && a.kind === 'pax' && a.tier <= 2) {
      return 'regional'
    }
    // Summit / EXFED-class — heavy strip + heavy_pack opens widebody (A380 in the pool).
    if (a.req.heavyRunway && this.hasHeavyRunway()) return 'widebody'
    if (a.persona === 'budget' || a.id === 'northline' || a.procedural) {
      return Math.random() < 0.6 ? 'regional' : 'narrowbody'
    }
    if (a.persona === 'business' || a.id === 'harbor') {
      return Math.random() < 0.45 ? 'regional' : 'narrowbody'
    }
    return 'narrowbody'
  }

  /**
   * Stands on the Guard / cargo side — near a hangar, not glued to a pax jetway.
   * Military metal should not steal T1·G2 from Northline.
   */
  milCapableStands(): Vec[] {
    const hangars = tilesOf(this.tiles, 'hangar')
    if (!hangars.length) return []
    return tilesOf(this.tiles, 'stand').filter((s) => {
      const nearHangar = hangars.some(
        (h) => Math.abs(h.c - s.c) + Math.abs(h.r - s.r) <= MIL_RAMP_RANGE,
      )
      if (!nearHangar) return false
      const hall = this.jetwayHall(s)
      if (hall) {
        const dHall =
          Math.abs(hall.origin.c - s.c) + Math.abs(hall.origin.r - s.r)
        // Keep mil hardstands off the close-in pax gate ring.
        if (dHall <= Math.min(5, JETWAY_RANGE - 2)) return false
      }
      return Boolean(this.pathStandToRunway(s))
    })
  }

  milRampLine(): string {
    const n = this.milCapableStands().length
    const cargo = tilesOf(this.tiles, 'cargo').length > 0
    const heavy = this.hasHeavyRunway()
    const pack = this.hasResearch('mil_ramp')
    if (!n) return 'No mil ramp — hangar-side hardstand + taxi to strip'
    return `Mil ramp ${n} pad${n === 1 ? '' : 's'}${cargo ? ' · cargo' : ' · need cargo'}${
      heavy ? ' · heavy strip' : ''
    }${pack ? ' · C-5 unlocked' : ''}`
  }

  assignMilStand(): Vec | null {
    const freeKeys = new Set(this.freeStands().map((s) => `${s.c},${s.r}`))
    const pool = this.milCapableStands().filter((s) => freeKeys.has(`${s.c},${s.r}`))
    if (!pool.length) return null
    // Prefer stands closest to hangar.
    const hangars = tilesOf(this.tiles, 'hangar')
    pool.sort((a, b) => {
      const da = Math.min(
        ...hangars.map((h) => Math.abs(h.c - a.c) + Math.abs(h.r - a.r)),
      )
      const db = Math.min(
        ...hangars.map((h) => Math.abs(h.c - b.c) + Math.abs(h.r - b.r)),
      )
      return da - db
    })
    return pool[0]
  }

  aircraftLabel(kind: AircraftKind): string {
    const map: Record<AircraftKind, string> = {
      regional: 'Regional',
      narrowbody: 'Narrowbody',
      widebody: 'Widebody',
      freighter: 'Freighter',
      helo_med: 'Medevac helo',
      helo_exec: 'Exec helo',
      military: 'Military',
      air_ambulance: 'Air ambulance',
    }
    return map[kind]
  }

  canHostMilitary(): { ok: boolean; why: string } {
    if (this.milAgreement) return { ok: false, why: 'Guard agreement already active.' }
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return { ok: false, why: 'Need a runway.' }
    if (!tilesOf(this.tiles, 'hangar').length) return { ok: false, why: 'Need a hangar.' }
    if (!tilesOf(this.tiles, 'tower').length) return { ok: false, why: 'Need a control tower.' }
    if (!tilesOf(this.tiles, 'police').length) return { ok: false, why: 'Need police on field.' }
    if (!tilesOf(this.tiles, 'cargo').length) {
      return { ok: false, why: 'Need a cargo shed for Guard logistics.' }
    }
    if (!this.milCapableStands().length) {
      return {
        ok: false,
        why: `Need a hangar-side hardstand (≤${MIL_RAMP_RANGE}c, not a close pax jetway) with taxi to the strip.`,
      }
    }
    if (this.reputation < 48) return { ok: false, why: 'Need reputation 48+.' }
    if (this.cash < MIL_AGREE_COST) return { ok: false, why: `Need ${moneyLeft(MIL_AGREE_COST)}.` }
    return {
      ok: true,
      why: this.hasResearch('mil_ramp')
        ? 'Ready — Guard host + C-5M when the heavy strip is live.'
        : 'Ready for Guard transit (C-130 / C-17 / KC-135 / F-15). Research Military ramp for C-5M.',
    }
  }

  signMilitaryAgreement() {
    const gate = this.canHostMilitary()
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    if (!this.spend(MIL_AGREE_COST, 'military host agreement')) return
    this.milAgreement = true
    this.milCool = 20
    this.reputation = Math.min(100, this.reputation + 5)
    this.pushNews(
      this.hasResearch('mil_ramp')
        ? 'Guard host signed — mil ramp live. C-130 through C-5M can use hangar-side pads.'
        : 'Guard host signed — mil ramp live. C-130 / C-17 / KC-135 / F-15 for now; research Military ramp for C-5M.',
      'good',
    )
    this.emit()
  }

  buyLand(kind: SiteKind, focus?: StartFocus): boolean {
    if (focus) this.startFocus = focus
    const land = LAND[kind]
    if (this.cash < land.cost) {
      this.pushNews(`Cannot afford ${land.name}.`, 'bad')
      this.emit()
      return false
    }
    this.cash -= land.cost
    if (!this.sandbox) {
      this.noteExpense(land.cost)
      this.postJournal('construction', land.cost, this.simMinutes(), land.name)
    }
    this.site = kind
    this.tiles = emptyTiles()
    this.seedAccessStub()
    this.speed = 1
    this.ownedPlots = [starterHolding(LAND_PLOT)]
    this.parcels = 1
    this.staffHousing.reset()
    this.maintenanceContract = false
    this.railLinked = false
    this.hotelLevel = 0
    this.carParkShort = false
    this.carParkLong = false
    this.parkTerms = {}
    this.hotelClass = {}
    this.lateSites = []
    this.missedHotelNights = 0
    this.crewHotelNights = 0
    this.standClass = {}
    this.standAccess = {}
    this.standAccessMode = 'remote'
    this.standPits = {}
    this.standSize = {}
    this.standRung = {}
    this.fittings = {}
    this.hydrantArm = false
    this.resetPillar()
    this.dedicatedDesks = []
    this.janitors = 0
    this.hallJanitors = []
    this.seatBooks.clear()
    this.diningStood.clear()
    this.researchers = 0
    this.researcherCool = 0
    this.deskStaff = 0
    this.deskStaffCool = 0
    this.hallStaff = []
    this.premium = createPremiumState()
    const focusBit =
      this.startFocus === 'cargo'
        ? 'Cargo focus — Starter kit builds shed + guard, no hall.'
        : this.startFocus === 'hybrid'
          ? 'Hybrid focus — hall + freight road.'
          : 'Passenger focus — Northline-ready hall kit.'
    this.ensureRival()
    this.pushNews(
      `${land.name} purchased. ${focusBit} ${moneyLeft(this.cash)} left. Stamp Starter kit ($${STARTER_KIT_COST.toLocaleString()}) or build freehand.`,
      'ok',
    )
    this.bumpMap()
    this.persist()
    this.emit()
    return true
  }

  seedAccessStub() {
    // City edge hint — short road stub from north edge so players see the connection idea.
    const c = Math.floor(SIZE / 2)
    for (let r = 0; r < 3; r++) {
      const v = { c, r }
      if (this.tile(v) !== 'grass') continue
      if (this.placementBlockReason('road', [v], v, 'Access road')) continue
      this.tiles[r]![c] = 'road'
    }
  }

  /**
   * New-game card. Buys the plot for this focus and stamps its kit, so the
   * clock starts on a field that can take the first contract.
   */
  startChosenKit(kind: SiteKind, focus: StartFocus): boolean {
    this.startFocus = focus
    if (!this.buyLand(kind)) return false
    this.buildStarterKit()
    return this.starterKitStamped
  }

  /** One-click AT3 field — flavor follows startFocus (pax / cargo / hybrid). */
  buildStarterKit() {
    if (!this.site) {
      this.pushNews('Buy land first.', 'bad')
      return
    }
    if (this.fits.length > 0 || tilesOf(this.tiles, 'terminal').length > 0) {
      this.pushNews('The plot already has a hall — the starter kit is for an empty field.', 'bad')
      this.emit()
      return
    }
    if (this.starterFieldUp()) {
      this.pushNews('Field already has a strip and a stand — the starter kit is for an empty plot.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(STARTER_KIT_COST, 'starter kit')) return
    this.starterKitStamped = true

    // Drop the city-edge stub and any stray paint. The stamp is the whole field.
    for (const row of this.tiles) row.fill('grass')
    const kit = stampStarterKit(this.tiles, this.startFocus)
    this.facing = 'h'
    for (const stand of kit.stands) {
      const key = `${stand.c},${stand.r}`
      this.standClass[key] = stand.cls
      this.standAccess[key] = stand.access
      this.recordStand(key, { cls: stand.cls, access: stand.access })
    }

    if (!kit.terminal) {
      this.fits = []
      this.fuelBrand = 'apex'
      this.fuelLoads = 1
      this.contractId = null
      this.tankLitres = seedLitresFromLoads(1)
      this.spotOffer = null
      this.spotInbound = null
      this.termUpliftLitres = 0
      this.spotCool = 0
      this.caterBrand = null
      this.mechanics = 1
      this.spawnMechanicPawn()
      this.deskStaff = 0
      this.hallStaff = []
      this.offerCool = FIRST_LETTER_COOL
      this.spawnCool = 5
      this.cargoVolumeCool = 18
      this.pushNews(`${kit.label} down — ${kit.summary}`, 'good')
      this.bumpMap()
      this.persist()
      this.emit()
      return
    }

    this.fits = [
      emptyFit(kit.terminal, true, {
        checkin: 2,
        security: 2,
        gate: 2,
        bagclaim: 1,
        food: 1,
        souvenir: 1,
        bagdrop: 1,
        lounge: 1,
        bathroom: 2,
      }),
    ]
    this.fuelBrand = 'apex'
    this.fuelLoads = 1
    this.contractId = null
    this.tankLitres = seedLitresFromLoads(1)
    this.spotOffer = null
    this.spotInbound = null
    this.termUpliftLitres = 0
    this.spotCool = 0
    this.primeHallShelves()
    this.caterBrand = 'skybite'
    this.mechanics = 1
    this.spawnMechanicPawn()
    // One desk body so the first bank doesn't miss gates on an empty counter.
    this.deskStaff = 1
    this.assignHallStaff()
    this.seedDayOneCrowd()
    // Airport is live — first airline call comes quick; later ones stay slow.
    // Threats and emergency asks are not held back. A thin lane or an empty farm shows up on its own.
    this.offerCool = FIRST_LETTER_COOL
    this.spawnCool = 6
    this.pushNews(`${kit.label} down — ${kit.summary}`, 'good')
    this.bumpMap()
    this.persist()
    this.emit()
  }

  /** Legacy single-button loan → bridge product. */
  takeLoan() {
    this.takeLoanProduct('bridge')
  }

  repayLoan() {
    if (this.loanBalance <= 0) return
    if (!this.spend(this.loanBalance, 'loan payoff', 'loan_repayment')) return
    this.loanBalance = 0
    this.loanProductId = null
    this.loanPrincipal = 0
    this.loanOpened = 0
    this.reputation = Math.min(100, this.reputation + 3)
    this.grantFieldXp(8, 'loan clear')
    this.pushNews('Loan cleared.', 'good')
    this.emit()
  }

  /** Next expansion the parcel button would buy. Null when the grid is full, land is unsold, or the scenario forbids parcels. */
  nextParcelOffer(): PlotOffer | null {
    if (!this.site || !this.ownedPlots.length || this.scenarioNoPlots) return null
    return nextPlotOffer(this.ownedPlots, this.fieldLevel(), LAND_PLOT)
  }

  /**
   * Starts one scenario from the Field Levels sheet.
   * A new game does not call this. Starting again while one is open is refused.
   */
  startScenario(id: string): boolean {
    const scenario = scenarioById(id)
    if (!scenario) {
      this.pushNews('Unknown scenario.', 'bad')
      this.emit()
      return false
    }
    if (this.scenarioRun?.status === 'running') {
      const current = scenarioById(this.scenarioRun.id)
      this.pushNews(`${current?.name ?? 'A scenario'} is already running.`, 'bad')
      this.emit()
      return false
    }
    this.scenarioRun = {
      id: scenario.id,
      startedDay: this.gameDay(),
      status: 'running',
      progress: 0,
      profitDays: 0,
    }
    this.applyScenarioRules(scenario, true)
    this.pushNews(`${scenario.name} started. ${scenarioRuleLines(scenario).join(' ')}`, 'ok')
    this.emit()
    return true
  }

  private applyScenarioRules(scenario: Scenario, fresh: boolean) {
    this.scenarioNoPlots = scenario.constraints.noLandPlots === true
    this.scenarioCurfew = scenario.constraints.curfew === true
    const cap = scenario.constraints.maxRunwayM
    this.scenarioMaxRunwayM = cap != null && Number.isFinite(cap) ? cap : null
    this.scenarioNightMark = this.tier3.snapshot().nightHub.revenue
    const debt = scenario.constraints.startDebt
    if (!fresh || this.sandbox || debt == null || !(debt > 0)) return
    this.loanBalance += debt
    this.loanPrincipal += debt
    this.loanOpened += debt
    if (!this.loanProductId) this.loanProductId = 'bridge'
  }

  private closeScenarioDay(day: number, pax: number, profit: number) {
    const run = this.scenarioRun
    if (!run || run.status !== 'running') return
    const scenario = scenarioById(run.id)
    if (!scenario) return
    const nightTotal = this.tier3.snapshot().nightHub.revenue
    const nightRevenue = Math.max(0, nightTotal - this.scenarioNightMark)
    this.scenarioNightMark = nightTotal
    const carriers = this.signed.filter((id) => this.airline(id).kind === 'pax')
    const transferShare = carriers.length
      ? carriers.reduce((sum, id) => sum + this.connectingShare(id), 0) / carriers.length
      : 0
    const scored = scoreScenario(run, scenario, { day, pax, profit, nightRevenue, transferShare })
    this.scenarioRun = scored.run
    if (scored.run.status !== 'running') this.clearScenarioRules()
    if (scored.news) this.pushNews(scored.news, scored.run.status === 'met' ? 'good' : 'bad')
  }

  private clearScenarioRules() {
    this.scenarioNoPlots = false
    this.scenarioCurfew = false
    this.scenarioMaxRunwayM = null
  }

  private restoreScenario(saved: GameSnapshot['scenario']) {
    this.scenarioRun = null
    this.clearScenarioRules()
    this.scenarioNightMark = this.tier3.snapshot().nightHub.revenue
    if (!saved) return
    const scenario = scenarioById(saved.id)
    const status = saved.status
    if (!scenario || (status !== 'running' && status !== 'met' && status !== 'missed')) return
    this.scenarioRun = {
      id: scenario.id,
      startedDay: Number.isFinite(saved.startedDay) ? saved.startedDay : 0,
      status,
      progress: Number.isFinite(saved.progress) ? saved.progress : 0,
      profitDays: Number.isFinite(saved.profitDays) ? saved.profitDays : 0,
    }
    if (status === 'running') this.applyScenarioRules(scenario, false)
  }

  /**
   * Buys the cheapest adjacent plot that field level allows.
   * Returns false when the buy does not happen.
   */
  buyParcel(): boolean {
    const offer = this.nextParcelOffer()
    if (!offer) {
      const why = !this.site
        ? 'Buy land first.'
        : this.scenarioNoPlots
          ? 'This scenario has no further parcels.'
          : 'No more parcels on this map.'
      this.pushNews(why, 'bad')
      this.emit()
      return false
    }
    if (offer.locked) {
      this.pushNews(offer.reason, 'bad')
      this.emit()
      return false
    }
    return this.buyPlot(offer.id)
  }

  buyPlot(id: string): boolean {
    if (!this.site) {
      this.pushNews('Buy land first.', 'bad')
      this.emit()
      return false
    }
    if (this.scenarioNoPlots) {
      this.pushNews('This scenario has no further parcels.', 'bad')
      this.emit()
      return false
    }
    const quote = commitPlot(this.ownedPlots, id, this.fieldLevel(), LAND_PLOT)
    if (!quote.ok) {
      this.pushNews(quote.reason, 'bad')
      this.emit()
      return false
    }
    if (!this.spend(quote.price, quote.name)) return false
    this.ownedPlots = quote.owned
    this.parcels = this.ownedPlots.length
    this.grantFieldXp(10, 'parcel')
    this.reputation = Math.min(100, this.reputation + 2)
    this.pushNews(`${quote.name} bought. Room to grow the apron.`, 'good')
    this.emit()
    return true
  }

  toggleMaintenanceContract() {
    if (!this.site) {
      this.pushNews('Buy land first.', 'bad')
      this.emit()
      return
    }
    this.maintenanceContract = !this.maintenanceContract
    this.pushNews(
      this.maintenanceContract
        ? `Maintenance contract signed — ${moneyLeft(LAND_PLOT.maintenanceContract)} a day, pavement repairs faster.`
        : 'Maintenance contract cancelled.',
      this.maintenanceContract ? 'ok' : 'bad',
    )
    this.emit()
  }

  /** Land tax, insurance, utilities, and licences due at the next day close. Sandbox is zero. */
  dailyHoldingQuote(): number {
    return this.landSinkReport().chargedTotal
  }

  private landSinkReport() {
    const loads = this.utilityLoads()
    const product =
      this.loanProduct(this.loanProductId) ??
      (this.loanBalance > 0 ? LOAN_PRODUCTS.find((row) => row.id === 'bridge') : undefined)
    return dailySinks(
      {
        plots: this.site ? this.ownedPlots : [],
        assetValue: this.builtAssetValue(),
        incidents: this.securityIncidents,
        fieldLevel: this.hostedFieldLevel(),
        operational: this.fieldIsOperating(),
        powerLoad: loads.power,
        waterLoad: loads.water,
        fireStations: tilesOf(this.tiles, 'fire').length,
        intl: this.hasHeavyRunway() || this.fieldLevel() >= 4,
        maintenanceContract: this.maintenanceContract,
        loanBalance: this.loanBalance,
        loanRate: product?.rate ?? 0,
        loanFloor: product?.interestFloor ?? 0,
        loanEverySeconds: product?.every ?? 0,
        sandbox: this.sandbox,
      },
      LAND_PLOT,
    )
  }

  private fieldIsOperating(): boolean {
    return Boolean(this.site) && (this.runwayStripCount() > 0 || this.signed.length > 0 || this.fits.length > 0)
  }

  private utilityLoads(): { power: number; water: number } {
    let power = 0
    let water = 0
    for (const row of this.tiles) {
      for (const tile of row) {
        const load = TILE_UTILITY[tile]
        if (!load) continue
        power += load.power ?? 0
        water += load.water ?? 0
      }
    }
    return { power, water }
  }

  /** Replacement cost of stamped tiles, used as the insurance asset base. */
  private builtAssetValue(): number {
    let total = 0
    for (const row of this.tiles) {
      for (const tile of row) {
        if (tile === 'grass') continue
        const building = BUILDINGS.find((item) => item.tile === tile)
        if (building) total += building.cost
      }
    }
    return total
  }

  investRail() {
    if (!this.site) return
    if (this.railLinked) {
      this.pushNews('City rail already reaches the fence.', 'ok')
      return
    }
    if (!this.spend(RAIL_CITY_COST, 'city rail investment')) return
    this.railLinked = true
    // City builds to the west edge; player sees a stub. Skip cells that are already built
    // or that would cut a taxiway, a building, or a runway shoulder.
    const row = Math.floor(SIZE / 2)
    for (let c = 0; c < 4; c++) {
      const v = { c, r: row }
      if (this.tile(v) !== 'grass') continue
      if (this.placementBlockReason('road', [v], v, 'Access road')) continue
      this.tiles[row]![c] = 'road'
    }
    this.reputation = Math.min(100, this.reputation + 5)
    this.bumpMap()
    this.pushNews(
      'City laid rail to the west fence. Connect roads from there — passengers arrive easier.',
      'good',
    )
    this.emit()
  }

  buyHotel() {
    if (!this.site) return
    if (this.hotelLevel >= 2) {
      this.pushNews('Hotel already at two wings.', 'ok')
      this.emit()
      return
    }
    const cost = this.hotelLevel === 0 ? HOTEL_COST : HOTEL_COST_L2
    if (!this.spend(cost, this.hotelLevel === 0 ? 'airport hotel' : 'hotel wing 2')) return
    this.hotelLevel += 1
    this.reputation = Math.min(100, this.reputation + 3)
    this.pushNews(
      this.hotelLevel === 1
        ? 'Airport hotel open — overnight pax + landside income.'
        : 'Second hotel wing — more beds, more walk-up traffic.',
      'good',
    )
    this.emit()
  }

  buyCarPark(kind: 'short' | 'long') {
    if (!this.site) return
    if (kind === 'short') {
      if (this.carParkShort) {
        this.pushNews('Short-term car park already open.', 'ok')
        this.emit()
        return
      }
      if (!this.spend(CARPARK_SHORT_COST, 'short-term car park')) return
      this.carParkShort = true
      this.pushNews('Short-term car park open — kiss-and-fly money.', 'good')
    } else {
      if (this.carParkLong) {
        this.pushNews('Long-term car park already open.', 'ok')
        this.emit()
        return
      }
      if (!this.spend(CARPARK_LONG_COST, 'long-term car park')) return
      this.carParkLong = true
      this.reputation = Math.min(100, this.reputation + 1)
      this.pushNews('Long-stay car park open — weekenders leave cars for days.', 'good')
    }
    this.emit()
  }

  setParkTerm(term: ParkTerm) {
    this.parkTerm = term
    this.emit()
  }

  setStandAccessMode(mode: StandAccess) {
    this.standAccessMode = mode
    this.emit()
  }

  standAccessAt(stand: Vec | null): StandAccess {
    if (!stand) return 'remote'
    const k = `${stand.c},${stand.r}`
    if (this.standAccess[k]) return this.standAccess[k]
    // Grandfather older saves: proximity used to mean jetway.
    if (!this.fits.length) return 'remote'
    let bestD = JETWAY_RANGE + 1
    for (const f of this.fits) {
      const d = Math.abs(f.origin.c - stand.c) + Math.abs(f.origin.r - stand.r)
      if (d < bestD) bestD = d
    }
    return bestD <= JETWAY_RANGE ? 'jetway' : 'remote'
  }

  /** How this stand moves pax this turn — jetway / terminal bus / walk. */
  standPaxMode(stand: Vec | null): StandPaxMode {
    if (!stand) return 'walk'
    if (this.jetwayHall(stand)) return 'jetway'
    const depots = tilesOf(this.tiles, 'termbus')
    if (depots.length) {
      const path = nearestPath(this.tiles, depots[0], [stand], 'truck')
      if (path && path.length >= 2) return 'bus'
    }
    return 'walk'
  }

  /** True when short-term parking exists (meta buy or stamped short lots). */
  hasShortParking(): boolean {
    if (this.carParkShort) return true
    return (['park_s', 'park_l', 'park_g', 'park_u'] as const).some((k) =>
      tilesOf(this.tiles, k).some((p) => (this.parkTerms[`${p.c},${p.r}`] ?? 'short') === 'short'),
    )
  }

  /** True when long-term parking exists (meta buy or stamped long lots). */
  hasLongParking(): boolean {
    if (this.carParkLong) return true
    return (['park_s', 'park_l', 'park_g', 'park_u'] as const).some((k) =>
      tilesOf(this.tiles, k).some((p) => this.parkTerms[`${p.c},${p.r}`] === 'long'),
    )
  }

  hasHotelBeds(): boolean {
    return this.hotelLevel > 0 || tilesOf(this.tiles, 'hotel').length > 0
  }

  hasBusCurb(): boolean {
    return tilesOf(this.tiles, 'bus').length > 0
  }

  hasRailStation(): boolean {
    return this.railLinked && tilesOf(this.tiles, 'rail').length > 0
  }

  /** Mode available on the field right now. */
  modeAvailable(mode: ArriveMode): boolean {
    switch (mode) {
      case 'dropoff':
        return tilesOf(this.tiles, 'road').length > 0
      case 'car_short':
        return this.hasShortParking()
      case 'car_long':
        return this.hasLongParking()
      case 'bus':
        return this.hasBusCurb()
      case 'rail':
        return this.hasRailStation()
      case 'hotel':
        return this.hasHotelBeds()
    }
  }

  /**
   * Persona-weighted preferred landside mode, then fallback if infra missing.
   * Luxury → hotel/long park; business → rail/short; budget → bus/long.
   */
  pickGuestMode(
    tag: PaxTag,
    persona: Airline['persona'],
    _job: 'depart' | 'arrive',
  ): { prefer: ArriveMode; actual: ArriveMode } {
    const pool: ArriveMode[] =
      persona === 'luxury' || tag === 'premium'
        ? ['hotel', 'car_long', 'rail', 'dropoff', 'car_short']
        : persona === 'business' || tag === 'business'
          ? ['rail', 'car_short', 'dropoff', 'hotel', 'bus']
          : persona === 'cargo_night' || persona === 'military_gov'
            ? ['dropoff', 'car_short', 'bus']
            : tag === 'family'
              ? ['car_long', 'bus', 'dropoff', 'car_short', 'rail']
              : ['bus', 'car_long', 'dropoff', 'rail', 'car_short']
    const prefer = pool[Math.floor(Math.random() * Math.min(3, pool.length))]
    if (this.modeAvailable(prefer)) return { prefer, actual: prefer }
    for (const m of pool) {
      if (this.modeAvailable(m)) return { prefer, actual: m }
    }
    return { prefer, actual: 'dropoff' }
  }

  applyGuestLandside(g: HallGuest, job: 'depart' | 'arrive') {
    const mode = g.arriveMode ?? 'dropoff'
    const missed = g.preferMode && g.preferMode !== mode
    if (missed) {
      g.happiness -= g.tag === 'premium' ? 10 : 6
      g.patience -= 8
      const leave = job === 'arrive'
      g.thought =
        g.preferMode === 'bus'
          ? leave
            ? 'No bus home — expensive taxi'
            : 'No bus curb — paid for a drop-off'
          : g.preferMode === 'rail'
            ? leave
              ? 'No rail out — scrambled exit'
              : 'No rail station — scrambled landside'
            : g.preferMode === 'hotel'
              ? leave
                ? 'No hotel overnight — wiped'
                : 'No hotel beds — exhausted already'
              : g.preferMode === 'car_short'
                ? leave
                  ? 'No short-term pickup lot'
                  : 'No short-term lot — circling'
                : g.preferMode === 'car_long'
                  ? leave
                    ? 'No long-term lot for the car'
                    : 'No long-term lot — awkward drop-off'
                  : 'Landside scramble'
    }
    let fee = 0
    let spendKind: SpendKind | null = null
    if (mode === 'car_short' && this.modeAvailable('car_short')) {
      fee = this.parkUseFee('short')
      spendKind = 'landside'
    } else if (mode === 'car_long' && this.modeAvailable('car_long')) {
      fee = this.parkUseFee('long')
      spendKind = 'landside'
    } else if (mode === 'hotel' && this.modeAvailable('hotel')) {
      fee = this.hotelUseFee(g.tag)
      spendKind = 'nap'
    } else if (mode === 'bus' && this.modeAvailable('bus')) {
      fee = BUS_FARE
      spendKind = 'landside'
    } else if (mode === 'rail' && this.modeAvailable('rail')) {
      fee = RAIL_FARE
      spendKind = 'landside'
    }
    // Drop-off / missing infra — no fee. Prefs + wallet gate the rest (RCT).
    const traffic = this.rivalWalkInFactor()
    if (fee > 0 && traffic !== 1) fee = Math.round(fee * traffic)
    if (fee > 0 && spendKind) {
      const buy = this.tryGuestPay(g, fee, spendKind, false)
      if (!buy.ok) {
        if (buy.why === 'broke' || buy.why === 'too expensive') {
          g.happiness -= 2
          g.thought =
            mode === 'hotel'
              ? buy.why === 'broke'
                ? 'Hotel too rich for my wallet'
                : 'Skipped hotel — saving cash'
              : buy.why === 'broke'
                ? 'Landside fee — broke'
                : 'Skipped landside fee — not worth it'
        } else if (!missed) {
          g.thought = 'Skipped landside spend'
        }
      } else {
        this.noteLandsideUse(mode === 'hotel' || mode === 'car_long' ? 2 : 1)
        if (mode === 'hotel') g.needs.energy = Math.max(0, g.needs.energy - 25)
        if (!missed) {
          g.happiness += 3
          g.thought =
            mode === 'hotel'
              ? `Hotel stay (−$${fee})`
              : mode === 'bus'
                ? `Bus in (−$${fee})`
                : mode === 'rail'
                  ? `Rail in (−$${fee})`
                  : mode === 'car_long'
                    ? `Long park (−$${fee})`
                    : mode === 'car_short'
                      ? `Short park (−$${fee})`
                      : g.thought
        }
      }
    }
  }

  /** Best matching park fee for term — stamped lots first, else meta flat. */
  parkUseFee(term: ParkTerm): number {
    let best = 0
    for (const kind of ['park_g', 'park_u', 'park_l', 'park_s'] as const) {
      for (const p of tilesOf(this.tiles, kind)) {
        if ((this.parkTerms[`${p.c},${p.r}`] ?? 'short') !== term) continue
        best = Math.max(best, PARK_USE_FEE[kind][term])
      }
    }
    let raw = term === 'short' ? PARK_SHORT_FEE : PARK_LONG_FEE
    if (best > 0) raw = best
    else if (term === 'short' && this.carParkShort) raw = PARK_SHORT_FEE
    else if (term === 'long' && this.carParkLong) raw = PARK_LONG_FEE
    return this.listed(raw, term === 'short' ? 'carParkShort' : 'carParkLong')
  }

  /** Hotel night fee — premium/business prefer resort beds when present. */
  hotelUseFee(tag: PaxTag): number {
    const classes = tilesOf(this.tiles, 'hotel').map(
      (p) => this.hotelClass[`${p.c},${p.r}`] ?? 'business',
    )
    let raw = HOTEL_CLASS_FEE.business
    if (classes.length) {
      if (tagSpendsUp(tag) && classes.includes('resort')) raw = HOTEL_CLASS_FEE.resort
      else if (tag === 'family' && classes.includes('inn')) raw = HOTEL_CLASS_FEE.inn
      else if (classes.includes('business')) raw = HOTEL_CLASS_FEE.business
      else if (classes.includes('inn')) raw = HOTEL_CLASS_FEE.inn
      else if (classes.includes('resort')) raw = HOTEL_CLASS_FEE.resort
    } else if (this.hotelLevel > 0) raw = HOTEL_NIGHT_FEE
    return this.listed(raw, 'hotelNight')
  }

  /** Site pax mult with hotel / rail / car park / bus landside boosts. */
  landsidePaxMult(): number {
    const base = this.site ? LAND[this.site].paxMult : 1
    let m = base
    if (this.railLinked) m *= 1.06
    if (this.hasRailStation()) m *= 1.1
    if (this.hasBusCurb()) m *= 1.05
    if (this.hotelLevel >= 1) m *= 1.06
    if (this.hotelLevel >= 2) m *= 1.05
    if (this.carParkShort || this.hasShortParking()) m *= 1.03
    if (this.carParkLong || this.hasLongParking()) m *= 1.04
    const hotels = tilesOf(this.tiles, 'hotel').length
    if (hotels) m *= 1 + Math.min(0.18, hotels * 0.05)
    const parks =
      tilesOf(this.tiles, 'park_s').length +
      tilesOf(this.tiles, 'park_l').length +
      tilesOf(this.tiles, 'park_g').length +
      tilesOf(this.tiles, 'park_u').length
    if (parks) m *= 1 + Math.min(0.16, parks * 0.03)
    // Thin landside — city pax stay home.
    if (!this.hasBusCurb() && !this.hasRailStation() && !this.hasShortParking() && !this.hasHotelBeds()) {
      m *= 0.92
    }
    const rail = railDemandScale(this.lateSites)
    return m * this.rivalWalkInFactor() * this.tycoonDemand() * rail
  }

  /** Nights the airport hotel can still book. The hub hook fills `transfers`. */
  hotelNightDemand(): HotelNight {
    return { transfers: this.missedHotelNights, crew: this.crewHotelNights }
  }

  /**
   * Connecting guests who need a bed. The open airport hotel books the rooms at day close,
   * and the year card counts the same nights.
   */
  noteMissedConnectionNights(nights: number): void {
    const count = wholeNights(nights)
    this.missedHotelNights += count
    this.playtestYear.noteNights(count)
  }

  /** Crew beds for the airport hotel. No live system fills this yet. */
  noteCrewHotelNights(crew: number): void {
    this.crewHotelNights += wholeNights(crew)
  }

  lateOpenAt(c: number, r: number): boolean {
    const site = this.lateSites.find((row) => row.c === c && row.r === r)
    if (!site) return true
    return isOpen(site)
  }

  lateMeshSig(): string {
    return this.lateSites.map((site) => `${site.c},${site.r},${site.elapsedDays}`).join('|')
  }

  /**
   * Fixed landside + hall-amenity operating expense per game day.
   * Catalog rates are already the old per-tick figure × 6. Billed once
   * whether the rooms are full or idle.
   */
  landsideUpkeep(): number {
    let n = HOTEL_META_EXPENSE[clamp(this.hotelLevel, 0, 2)] ?? 0
    if (this.carParkShort) n += CARPARK_META_EXPENSE_SHORT
    if (this.carParkLong) n += CARPARK_META_EXPENSE_LONG
    for (const p of tilesOf(this.tiles, 'hotel')) {
      const cls = this.hotelClass[`${p.c},${p.r}`] ?? 'business'
      n += HOTEL_CLASS_EXPENSE[cls]
    }
    for (const kind of ['park_s', 'park_l', 'park_g', 'park_u'] as const) {
      for (const p of tilesOf(this.tiles, kind)) {
        const term = this.parkTerms[`${p.c},${p.r}`] ?? 'short'
        n += PARK_EXPENSE[kind][term]
      }
    }
    n += tilesOf(this.tiles, 'bus').length * BUS_EXPENSE
    n += tilesOf(this.tiles, 'curb_lane').length * CURB_LANE_EXPENSE
    n += tilesOf(this.tiles, 'taxi_rank').length * TAXI_RANK_EXPENSE
    if (this.hasRailStation()) n += tilesOf(this.tiles, 'rail').length * RAIL_EXPENSE
    // Hall amenities — furnished but empty still costs lights/staff.
    for (const fit of this.fits) {
      for (const [room, rate] of Object.entries(HALL_AMENITY_EXPENSE) as Array<
        [keyof typeof HALL_AMENITY_EXPENSE, number]
      >) {
        const count = fit.rooms[room] ?? 0
        if (count > 0) n += rate * Math.min(3, count)
      }
      n += ceilingsFor({
        premade: fit.premade,
        redesigned: fit.redesigned,
        tier: fit.tier,
        items: (fit.items ?? []) as PlacedItem[],
        roomsSecurity: fit.rooms.security,
      }).upkeepDay
    }
    for (const id of this.progressionBuilt) {
      if (id === 'hydrant') continue
      n += progressionBuildable(id)?.upkeepPerDay ?? 0
    }
    const pit = progressionBuildable('hydrant')
    if (pit) n += Object.keys(this.standPits).length * pit.upkeepPerDay
    n += this.specMods().upkeepPerDay
    return Math.round(n * siteUpkeepMultiplier(this.specPaths.length))
  }

  /**
   * One curb beside a hall is a handful of drop-off stalls.
   * Bus, rail, and lots still carry the mid-game; a single road does not.
   */
  curbDropoffStalls(): number {
    if (!this.fits.length) return 0
    const near = tilesOf(this.tiles, 'road').some((road) =>
      this.fits.some(
        (fit) => Math.abs(fit.origin.c - road.c) + Math.abs(fit.origin.r - road.r) <= CURB_REACH,
      ),
    )
    return near ? STARTER_CAPACITY.curbStalls : 0
  }

  /** @deprecated alias — expense is the only "potential" now. */
  landsidePotential(): number {
    return this.landsideUpkeep()
  }

  /** Beds / stalls capacity for usage meters (HUD). */
  landsideCapacity(): number {
    let beds = this.hotelLevel > 0 ? 6 : 0
    for (const p of tilesOf(this.tiles, 'hotel')) {
      const cls = this.hotelClass[`${p.c},${p.r}`] ?? 'business'
      beds += cls === 'inn' ? 5 : cls === 'resort' ? 12 : 8
    }
    const curb = this.curbDropoffStalls()
    return Math.max(
      1,
      beds +
        curb +
        tilesOf(this.tiles, 'park_s').length * 3 +
        tilesOf(this.tiles, 'park_l').length * 5 +
        tilesOf(this.tiles, 'park_g').length * 7 +
        tilesOf(this.tiles, 'park_u').length * 6 +
        tilesOf(this.tiles, 'bus').length * 4 +
        (this.hasRailStation() ? tilesOf(this.tiles, 'rail').length * 6 : 0) +
        (this.carParkShort || this.carParkLong ? 4 : 0),
    )
  }

  /**
   * Passenger fees collected this payroll window — not sticker income.
   * Place alone pays $0; pax using hotels/lots/bus/rail fill this.
   */
  landsideIncome(): number {
    return Math.round(this.landsideFeeWindow)
  }

  /** 0–1+ fill rate for HUD (uses / capacity). */
  landsideUsageRate(): number {
    return clamp(this.landsideUses / this.landsideCapacity(), 0, 1.5)
  }

  noteLandsideUse(n = 1) {
    this.landsideUses += n
  }

  /** Last curb snapshot. The renderer and the side panel both read this. */
  landsideView(): LandsideView {
    return this.landsideTraffic.snapshot()
  }

  /**
   * Click-open the capacity panel.
   * A null cell toggles it. The same road cell again closes it.
   */
  openLandside(cell: { c: number; r: number } | null) {
    if (!cell) {
      this.landsideOpen = !this.landsideOpen
      this.emit()
      return
    }
    const id = `${cell.c},${cell.r}`
    if (this.landsideOpen && this.landsideFocus === id) {
      this.landsideOpen = false
      this.landsideFocus = null
    } else {
      this.landsideOpen = true
      this.landsideFocus = id
    }
    this.emit()
  }

  closeLandside() {
    if (!this.landsideOpen) return
    this.landsideOpen = false
    this.landsideFocus = null
    this.emit()
  }

  /** Fuel-farm snapshot. Litres are the sim tank, refreshed when a write landed outside the tick. */
  fuelView(): FuelView {
    const cap = tankDef(this.tankTier).capacityLitres
    const litres = Math.min(cap, Math.max(0, this.tankLitres))
    const view = this.fuelChain.snapshot()
    if (view.litres !== litres || view.capacityLitres !== cap) this.noteFuelChain(0)
    return this.withSpotQueue(this.fuelChain.snapshot())
  }

  /** Spot tanker is a row on the same queue. It does not keep a second stock. */
  private withSpotQueue(snap: FuelView): FuelView {
    const inbound = this.spotInbound
    if (!inbound) return snap
    const lead = SPOT_OFFER.leadMinutes
    const progress = lead > 0 ? Math.min(1, Math.max(0, 1 - inbound.minutesLeft / lead)) : 1
    const bill = inbound.litres * inbound.perLitre
    const waiting = inbound.minutesLeft <= 1e-6 && bill > this.cash + 1e-6
    const row: DeliveryRead = {
      id: 'spot-tanker',
      mode: 'tanker',
      litres: inbound.litres,
      progress,
      state: waiting ? 'wait_cash' : 'road',
      docked: false,
    }
    return {
      ...snap,
      queue: [...snap.queue.filter((item) => item.id !== 'spot-tanker'), row],
      wholesalePerLitre: inbound.perLitre,
    }
  }

  /** Click-open the fuel farm panel. The same control toggles it shut. */
  openFuelFarm() {
    this.noteFuelChain(0)
    this.fuelOpen = !this.fuelOpen
    this.emit()
  }

  closeFuelFarm() {
    if (!this.fuelOpen) return
    this.fuelOpen = false
    this.emit()
  }

  /** Open the fuel rack. Does not toggle it shut. */
  showFuelRack() {
    this.noteFuelChain(0)
    this.fuelOpen = true
    this.emit()
  }

  /**
   * Stand occupancy and the turnaround bay queue.
   * Reads flights and, when logistics is already up, its dock report. Does not start it.
   */
  bayView(): {
    stands: {
      id: string
      c: number
      r: number
      occupied: boolean
      flightNo: string | null
      phase: string | null
      grade: string | null
      gradeNote: string | null
      inUse: number
      queued: number
      bays: number
    }[]
  } {
    const docks = this.ground?.sim.dockReport() ?? []
    const byStand = new Map<string, { inUse: number; queued: number; bays: number }>()
    for (const row of docks) {
      const cur = byStand.get(row.ownerId) ?? { inUse: 0, queued: 0, bays: 0 }
      cur.inUse += row.inUse
      cur.queued += row.queued
      cur.bays += row.bays
      byStand.set(row.ownerId, cur)
    }
    const stands = tilesOf(this.tiles, 'stand').map((cell) => {
      const id = `${cell.c},${cell.r}`
      const flight = this.flights.find(
        (f) =>
          f.stand?.c === cell.c &&
          f.stand?.r === cell.r &&
          f.phase !== 'gone' &&
          f.phase !== 'approach' &&
          f.phase !== 'landing' &&
          f.phase !== 'hold' &&
          f.phase !== 'takeoff',
      )
      const live = flight?.groundTurn ? (this.ground?.sim.turnGrade(flight.groundTurn) ?? null) : null
      const dock = byStand.get(id) ?? { inUse: 0, queued: 0, bays: 0 }
      return {
        id,
        c: cell.c,
        r: cell.r,
        occupied: Boolean(flight),
        flightNo: flight?.flightNo ?? null,
        phase: flight?.phase ?? null,
        grade: flight?.turnGrade ?? live?.grade ?? null,
        gradeNote: flight?.turnGradeNote || live?.note || null,
        inUse: dock.inUse,
        queued: dock.queued,
        bays: dock.bays,
      }
    })
    return { stands }
  }

  /**
   * Tankers and the pipeline occupy the public road. Stock and the bill stay
   * with the fuel contract; this only records the queue, the draw, and who is grounded.
   */
  private noteFuelChain(step: number) {
    const minutes = gameMinutes(step)
    const contract = contractById(this.contractId)
    const cap = tankDef(this.tankTier).capacityLitres
    const flights: { id: string; litres: number; departAt: number }[] = []
    const windowMin = FUEL_CHAIN.upliftWindowMin
    const dispensers = this.scaleFleet.hydrant_dispenser ?? 0
    let truckLitres = 0
    let hydrantLitres = 0
    for (const f of this.flights) {
      if (f.phase === 'gone' || f.posted.fuel || !this.departureNeedsFuel(f)) continue
      const need = this.fuelNeedLitres(f)
      const key = f.stand ? `${f.stand.c},${f.stand.r}` : null
      if (standDrawsHydrant(key, this.standPits, dispensers)) hydrantLitres += need
      else truckLitres += need
      flights.push({ id: f.id, litres: need, departAt: f.fuelHeldSince ?? this.clock })
    }
    const onBarge = this.fuelSupply === 'barge'
    const bargeOpen = onBarge && this.berthIsOpen()
    this.fuelChain.observe({
      capacityLitres: cap,
      litres: this.tankLitres,
      mode: this.fuelSupply === 'road' || onBarge ? 'tanker' : 'pipeline',
      tankerLitres: onBarge
        ? bargeOpen
          ? bargeParcelLitres(contract?.railLitresPerHour ?? 0)
          : 0
        : (contract?.tankerLitres ?? 0),
      leadMinutes: onBarge ? (bargeOpen ? bargeLeadMinutes() : 0) : (contract?.leadMinutes ?? 0),
      wholesalePerLitre: contract ? this.termUnitPrice(contract.id) : 0,
      cash: this.cash,
      truckDrawPerMin: truckLitres / windowMin,
      hydrantDrawPerMin: hydrantLitres / windowMin,
      pipelinePerMin: onBarge ? 0 : contract ? contract.railLitresPerHour / 60 : 0,
      roads: tilesOf(this.tiles, 'road'),
      connectors: tilesOf(this.tiles, 'guard'),
      farms: tilesOf(this.tiles, 'fuel'),
      flights,
      roadMinutes: onBarge ? this.bargeMinutes : this.roadMinutes,
      justDelivered: this.fuelJustDelivered,
      pipelineFlowing:
        this.fuelSupply === 'rail'
          ? this.lastRailFlowing
          : this.fuelSupply === 'pipeline' && this.pipelineManifoldOpen(),
      minutes,
    })
    this.fuelJustDelivered = false
    this.fuelRoadLoad = this.fuelChain.snapshot().roadVehPerMin
  }

  /**
   * Roads and the curb have a capacity. Over it, cars queue and passengers
   * step out late. That nudges reputation, and the late ones miss check-in
   * so the next departure does not collect their passenger fee.
   */
  private tickLandside(dt: number) {
    this.noteFuelChain(dt)
    const view = this.landsideTraffic.tick(dt, {
      roads: tilesOf(this.tiles, 'road'),
      connectors: tilesOf(this.tiles, 'guard'),
      terminals: tilesOf(this.tiles, 'terminal'),
      busBays: tilesOf(this.tiles, 'bus'),
      curbLanes: tilesOf(this.tiles, 'curb_lane'),
      taxiRanks: tilesOf(this.tiles, 'taxi_rank'),
      parks: (['park_s', 'park_l', 'park_g', 'park_u'] as const).flatMap((kind) =>
        tilesOf(this.tiles, kind).map((cell) => ({ c: cell.c, r: cell.r, kind })),
      ),
      rail: this.hasRailStation(),
      paxPerDay: Math.max(0, this.paxPerDay, this.dayPax),
      extraVehPerMin: this.fuelRoadLoad,
      turns: this.flightsDone,
      departures: this.flights.reduce(
        (n, f) => n + (f.phase === 'gone' || f.cargo || f.kind === 'freighter' ? 0 : 1),
        0,
      ),
    })
    if (view.satisfactionDelta !== 0) this.queueReputation(view.satisfactionDelta)
    this.landsideNewsCool = Math.max(0, this.landsideNewsCool - dt)
    let missedNews = false
    if (view.missedCheckIns > 0) {
      this.curbMissedFrac += view.missedCheckIns
      const ripe = Math.floor(this.curbMissedFrac)
      if (ripe > 0) {
        this.curbMissedFrac -= ripe
        this.missedCheckIns += ripe
        this.curbFeeMisses += ripe
        missedNews = true
      }
    }
    if (missedNews && this.landsideNewsCool <= 0) {
      this.pushNews(
        'Curb delay — passengers missed check-in, so their passenger fees are not collected.',
        'bad',
      )
      this.landsideNewsCool = 90
    } else if (view.news && this.landsideNewsCool <= 0) {
      this.pushNews(view.news, 'bad')
      this.landsideNewsCool = 90
    }
  }

  runwayStripCount(): number {
    return runwayStrips(this.tiles, MIN_RUNWAY).length
  }

  /**
   * Movements on the open timetable against what the linked strips can start
   * in a day. One slot is an arrival and, when it falls in the day, its departure.
   * Computed once per tick until the bank or the pavement changes.
   */
  runwayLoad(): {
    strips: number
    lanes: number
    capacity: number
    scheduled: number
    gapSec: number
    overbooked: boolean
    deferred: number
    requested: number
    booked: number
  } {
    if (this.runwayLoadOpen && this.runwayLoadCache) return this.runwayLoadCache
    const value = this.computeRunwayLoad()
    if (this.runwayLoadOpen) this.runwayLoadCache = value
    return value
  }

  private invalidateRunwayLoad() {
    this.runwayLoadCache = null
  }

  private rollRunwayDeferDay() {
    const day = this.gameDay()
    if (day === this.runwayDeferDay) return
    this.runwayDeferDay = day
    this.runwayDeferred = 0
    this.runwayRequested = 0
    this.runwayBooked = 0
    this.invalidateRunwayLoad()
  }

  /** The seeder asked for `requested` and had to book `booked`. A later time counts. */
  private noteRunwayDeferral(requested: number, booked: number) {
    this.rollRunwayDeferDay()
    this.runwayRequested += 1
    if (booked > requested + 0.5) {
      this.runwayDeferred += 1
      this.runwayDeferredTotal += 1
    } else {
      this.runwayBooked += 1
    }
    this.invalidateRunwayLoad()
  }

  private computeRunwayLoad(): {
    strips: number
    lanes: number
    capacity: number
    scheduled: number
    gapSec: number
    overbooked: boolean
    deferred: number
    requested: number
    booked: number
  } {
    this.rollRunwayDeferDay()
    const strips = Math.max(0, this.runwayStripCount())
    const operable = this.operableStripIndexes()
    const lanes = operable.length > 0 ? operable.length : Math.max(1, strips || 1)
    const gapSec = runwayArrivalGapSec(lanes)
    const capacity = runwayMovementCapacity(lanes)
    const start = this.clock
    const end = this.clock + REAL_SECONDS_PER_GAME_DAY
    let scheduled = 0
    for (const slot of this.schedule) {
      if (slot.status !== 'scheduled' && slot.status !== 'delayed' && slot.status !== 'inbound') continue
      // One turn is the arrival and the departure that must clear before the next ETA.
      if (slot.eta >= start - RUNWAY_LATE_SLACK_SEC && slot.eta < end) scheduled += 2
    }
    return {
      strips: Math.max(strips, lanes),
      lanes,
      capacity,
      scheduled,
      gapSec,
      overbooked: runwayOverbooked(scheduled, capacity),
      deferred: this.runwayDeferred,
      requested: this.runwayRequested,
      booked: this.runwayBooked,
    }
  }

  private runwayOverbooked(): boolean {
    return this.runwayLoad().overbooked
  }

  /** Book the seconds a flight actually waited. No cascade and no six-second floor. */
  private noteSpawnLateness(slot: ScheduleSlot) {
    const late = this.clock - slot.eta
    if (!(late > 0.05)) return
    const booked = Math.min(120, late)
    if (!(booked > slot.delaySec)) return
    slot.delaySec = booked
    if (slot.status === 'scheduled') slot.status = 'delayed'
    if (!slot.delayReason) slot.delayReason = 'Runway sequence'
  }

  /** Warn while the bank is over the strips, or the seeder had to push demand later. */
  private noteRunwayContractAlert() {
    const load = this.runwayLoad()
    if (load.deferred > 0) {
      const deferred = Math.max(1, Math.round(load.deferred))
      this.raiseAlert({
        key: 'runway-capacity',
        severity: 'warning',
        title: 'Runway overbooked',
        detail: `Airlines wanted ${deferred} more movements today. Add a strip.`,
      })
      return
    }
    if (!load.overbooked) {
      this.alerts.clear('runway-capacity')
      return
    }
    const scheduled = Math.round(load.scheduled)
    const capacity = Math.max(1, Math.round(load.capacity))
    this.raiseAlert({
      key: 'runway-capacity',
      severity: 'warning',
      title: 'Runway overbooked',
      detail: `Signed contracts have ${scheduled} movements booked. This runway turns ${capacity} a day. Add a strip or spread the bank.`,
    })
  }

  canIpo(): { ok: boolean; why: string } {
    if (this.public) return { ok: false, why: 'Already listed.' }
    if (this.flightsDone < IPO_MIN_FLIGHTS) {
      return { ok: false, why: `Need ${IPO_MIN_FLIGHTS} completed turns first.` }
    }
    if (this.reputation < IPO_MIN_REP) {
      return { ok: false, why: `Need reputation ${IPO_MIN_REP}+.` }
    }
    if (this.cash < IPO_MIN_CASH + IPO_LISTING_FEE) {
      return { ok: false, why: `Need ~${moneyLeft(IPO_MIN_CASH + IPO_LISTING_FEE)} on hand.` }
    }
    if (this.signed.length < 1) return { ok: false, why: 'Sign at least one airline.' }
    return { ok: true, why: 'Ready to list.' }
  }

  fairSharePrice(): number {
    const heavy = this.hasHeavyRunway() ? 5 : 0
    const pad = tilesOf(this.tiles, 'helipad').length ? 1.5 : 0
    const wearHit = this.maxWear() * 0.04
    const pavement = (this.runwayCondition - 50) * 0.04
    const mxDesk = this.mxSigned.length * 2 + this.mechanics * 0.8
    const base =
      8 +
      this.reputation * 0.35 +
      this.signed.length * 4 +
      this.flightsDone * 0.4 +
      (this.railLinked ? 3 : 0) +
      this.parcels * 1.5 +
      heavy +
      pad +
      pavement +
      mxDesk -
      wearHit -
      this.securityIncidents * 2.5 -
      (this.loanBalance > 0 ? 4 : 0)
    return Math.max(2, Math.round(base * 100) / 100)
  }

  hasHeavyRunway(): boolean {
    return runwayStrips(this.tiles, HEAVY_RUNWAY_LEN).length > 0
  }

  /** Longest continuous runway strip in cells — gates real airframes. */
  longestRunway(): number {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (!strips.length) return 0
    return Math.max(...strips.map((s) => s.length))
  }

  stripTierLabel(): string {
    const t = stripTier(this.longestRunway())
    if (t === 'none') return 'No strip'
    if (t === 'short') return 'Short'
    if (t === 'regional') return 'Regional'
    return 'Heavy'
  }

  /** What real named metal this strip can / can't take. */
  stripCapabilityLine(): string {
    const n = this.longestRunway()
    if (n <= 0) return 'Stamp a strip — short / regional / heavy'
    const ok = jetAirframesFitting(n, this.researchGrants())
    const no = jetAirframesBlocked(n, this.researchGrants())
    const okNames = ok
      .slice()
      .sort((a, b) => a.minRunway - b.minRunway)
      .slice(0, 4)
      .map((a) => a.name)
    const noNames = no
      .slice()
      .sort((a, b) => a.minRunway - b.minRunway)
      .slice(0, 3)
      .map((a) => a.name)
    if (!no.length) {
      return `${this.stripTierLabel()} ${n}c · takes everything (incl. 747-8F / A350)`
    }
    return `${this.stripTierLabel()} ${n}c · OK: ${okNames.join(', ')}${
      ok.length > 4 ? '…' : ''
    } · blocked: ${noNames.join(', ')}${no.length > 3 ? '…' : ''}`
  }

  maxWear(): number {
    let m = 0
    for (const f of this.fits) {
      m = Math.max(m, f.wearBath ?? 0, f.wearSec ?? 0)
    }
    return m
  }

  avgWear(): { bath: number; sec: number } {
    if (!this.fits.length) return { bath: 0, sec: 0 }
    let bath = 0
    let sec = 0
    for (const f of this.fits) {
      bath += f.wearBath ?? 0
      sec += f.wearSec ?? 0
    }
    return { bath: bath / this.fits.length, sec: sec / this.fits.length }
  }

  goPublic() {
    const gate = this.canIpo()
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    if (!this.spend(IPO_LISTING_FEE, 'IPO listing', 'contract_signing')) return
    const price = this.fairSharePrice()
    const float = IPO_SHARES - IPO_FOUNDER_SHARES
    const raise = Math.round(float * price)
    this.public = true
    this.sharePrice = price
    this.ipoPrice = price
    this.sharesOwned = IPO_FOUNDER_SHARES
    this.sharesFloat = float
    this.credit(raise, 'ipo_proceeds', 'IPO')
    this.reputation = Math.min(100, this.reputation + 6)
    this.pushNews(
      `HATCH lists at $${price.toFixed(2)}. Raised ${moneyLeft(raise)}. You keep ${IPO_FOUNDER_SHARES} shares — the street owns the rest. Protect security or the ticker dies.`,
      'good',
    )
    this.startMission('earnings_beat')
    this.emit()
  }

  buyShares(n = 10) {
    if (!this.public) {
      this.pushNews('IPO first.', 'bad')
      return
    }
    const qty = Math.min(n, this.sharesFloat)
    if (qty <= 0) {
      this.pushNews('No float left to buy.', 'bad')
      return
    }
    const cost = Math.round(qty * this.sharePrice)
    if (!this.spend(cost, 'share buyback', 'share_purchases')) return
    this.sharesOwned += qty
    this.sharesFloat -= qty
    this.sharePrice = Math.round((this.sharePrice * 1.02) * 100) / 100
    this.pushNews(`Bought ${qty} shares @ $${this.sharePrice.toFixed(2)}.`, 'ok')
    this.emit()
  }

  sellShares(n = 10) {
    if (!this.public) return
    const qty = Math.min(n, this.sharesOwned)
    if (qty <= 0) {
      this.pushNews('No shares to sell.', 'bad')
      return
    }
    const gain = Math.round(qty * this.sharePrice)
    this.sharesOwned -= qty
    this.sharesFloat += qty
    this.credit(gain, 'share_sales', 'share sale')
    this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.97) * 100) / 100)
    this.pushNews(`Sold ${qty} shares for ${moneyLeft(gain)}.`, 'ok')
    this.emit()
  }

  startMission(id: MarketMission['id']) {
    const table: Record<MarketMission['id'], Omit<MarketMission, 'id' | 'progress'>> = {
      secure_the_line: {
        title: 'Secure the line',
        blurb: 'Board wants security level 3 before the next earnings call.',
        deadline: 120,
        goal: 'security3',
        target: 3,
        rewardCash: 8000,
        rewardRep: 5,
      },
      earnings_beat: {
        title: 'Beat the street',
        blurb: 'Post $25,000 more revenue while listed — or the stock drifts.',
        deadline: 150,
        goal: 'revenueBurst',
        target: 25000,
        rewardCash: 5000,
        rewardRep: 4,
      },
      calm_the_board: {
        title: 'Calm the board',
        blurb: 'Push reputation back to 60 after the scare.',
        deadline: 100,
        goal: 'rep60',
        target: 60,
        rewardCash: 6000,
        rewardRep: 6,
      },
      restore_trust: {
        title: 'Restore trust',
        blurb: 'Zero new security incidents for a stretch. Prove the hall is clean.',
        deadline: 90,
        goal: 'noIncident',
        target: 90,
        rewardCash: 10000,
        rewardRep: 8,
      },
      heavy_ready: {
        title: 'Widebody ready',
        blurb: 'Stamp a heavy strip (20×3) so Summit / EXFED can land — street wants scale.',
        deadline: 160,
        goal: 'heavyRunway',
        target: 1,
        rewardCash: 12000,
        rewardRep: 6,
      },
      scrub_the_hall: {
        title: 'Scrub the hall',
        blurb: 'Budget crowds trashed WC and lanes. Scrub wear so cleanliness hits 80+.',
        deadline: 100,
        goal: 'lowWear',
        target: 80,
        rewardCash: 7000,
        rewardRep: 5,
      },
    }
    const m = table[id]
    this.mission = { id, progress: 0, ...m }
    this.revenueWindow = this.revenue
    this.pushNews(`Market mission: ${m.title}. ${m.blurb}`, 'ok')
  }

  shockStock(reason: string, mult: number, fine: number) {
    if (!this.public) {
      this.charge(fine, 'security_shock', this.simMinutes(), reason)
      this.noteRelationFines(this.signed)
      this.pushNews(reason, 'bad')
      return
    }
    const before = this.sharePrice
    this.sharePrice = Math.max(1.5, Math.round(this.sharePrice * mult * 100) / 100)
    this.charge(fine, 'security_shock', this.simMinutes(), reason)
    this.noteRelationFines(this.signed)
    this.reputation = Math.max(0, this.reputation - 10)
    const paper = Math.round((this.sharePrice - before) * this.sharesOwned)
    const fineBit = fine > 0 ? ` Fine ${moneyLeft(fine)}.` : ''
    this.pushNews(
      `${reason} HATCH $${before.toFixed(2)} → $${this.sharePrice.toFixed(2)} (${paper < 0 ? '' : '+'}${moneyLeft(paper)} on your stake).${fineBit}`,
      'bad',
    )
    this.startMission(mult < 0.7 ? 'restore_trust' : 'secure_the_line')
  }

  tickMarket(dt: number) {
    if (!this.public) return
    this.marketCool -= dt
    // Gentle drift toward fair value
    if (this.marketCool <= 0) {
      this.marketCool = 6 + Math.random() * 4
      const fair = this.fairSharePrice()
      this.sharePrice = Math.round((this.sharePrice * 0.85 + fair * 0.15) * 100) / 100
      // Random retail flow
      if (Math.random() < 0.35 && this.sharesFloat > 5) {
        const n = 3 + Math.floor(Math.random() * 8)
        const buy = Math.random() < 0.55
        if (buy) {
          const qty = Math.min(n, this.sharesFloat)
          this.sharesFloat -= qty
          // street buys from float — price up, founder stake unchanged
          this.sharePrice = Math.round((this.sharePrice * 1.015) * 100) / 100
        } else if (this.sharesOwned > IPO_FOUNDER_SHARES * 0.3) {
          /* ignore — only founder sells manually */
          this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.99) * 100) / 100)
        }
      }
    }

    this.tickAnalyst(dt)

    if (!this.mission) return
    const m = this.mission
    m.deadline -= dt
    if (m.goal === 'security3') m.progress = this.securityLevel()
    if (m.goal === 'revenueBurst') m.progress = Math.max(0, this.revenue - this.revenueWindow)
    if (m.goal === 'rep60') m.progress = this.reputation
    if (m.goal === 'noIncident') m.progress += dt
    if (m.goal === 'heavyRunway') m.progress = this.hasHeavyRunway() ? 1 : 0
    if (m.goal === 'lowWear') m.progress = Math.max(0, 100 - this.maxWear())

    if (m.progress >= m.target) {
      this.cash += m.rewardCash
      this.noteIncome(m.rewardCash, 'task_rewards')
      this.reputation = Math.min(100, this.reputation + m.rewardRep)
      this.sharePrice = Math.round((this.sharePrice * 1.08) * 100) / 100
      this.pushNews(
        `Mission cleared: ${m.title}. +${moneyLeft(m.rewardCash)}, stock pops to $${this.sharePrice.toFixed(2)}.`,
        'good',
      )
      this.mission = null
      return
    }
    if (m.deadline <= 0) {
      this.sharePrice = Math.max(1.5, Math.round((this.sharePrice * 0.88) * 100) / 100)
      this.reputation = Math.max(0, this.reputation - 4)
      this.pushNews(`Mission failed: ${m.title}. Stock slips to $${this.sharePrice.toFixed(2)}.`, 'bad')
      this.mission = null
    }
  }

  /** Public-market flavor crises beyond security bombs. */
  tickAnalyst(dt: number) {
    if (!this.public) return
    this.analystCool -= dt
    if (this.analystCool > 0) return
    this.analystCool = 45 + Math.random() * 50
    if (this.mission) return

    const wear = this.maxWear()
    const roll = Math.random()

    if (wear >= 55 && roll < 0.35) {
      this.shockStock(
        'TRAVEL BLOG EXPOSÉ — filthy restrooms and sticky security lanes go viral.',
        0.72,
        6500,
      )
      this.startMission('scrub_the_hall')
      return
    }
    if (!this.hasHeavyRunway() && this.signed.some((id) => this.airline(id).kind === 'pax') && roll < 0.28) {
      this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.93) * 100) / 100)
      this.pushNews(
        `Analyst note: “Regional strip caps growth.” HATCH $${this.sharePrice.toFixed(2)}. Stamp a heavy runway.`,
        'bad',
      )
      this.startMission('heavy_ready')
      return
    }
    if (this.reputation < 45 && roll < 0.3) {
      this.shockStock('Downgrade — soft reputation, soft ticket.', 0.88, 4000)
      this.startMission('calm_the_board')
      return
    }
    if (roll < 0.18) {
      // Short rumor — paper cut, no mission
      this.sharePrice = Math.max(2, Math.round((this.sharePrice * 0.96) * 100) / 100)
      this.pushNews(
        `Short seller rumor on the wire. HATCH dips to $${this.sharePrice.toFixed(2)}.`,
        'bad',
      )
      return
    }
    if (roll < 0.3 && this.railLinked && this.reputation >= 60) {
      this.sharePrice = Math.round((this.sharePrice * 1.04) * 100) / 100
      this.pushNews(
        `Upgrade: “Rail + clean ops.” HATCH $${this.sharePrice.toFixed(2)}.`,
        'good',
      )
    }
  }

  persist() {
    if (!this.autosave || !this.site) return
    const snap: GameSnapshot = {
      tiles: this.tiles,
      terminalFits: this.fits,
      cash: this.cash,
      branding: serializeBranding(this.branding),
      difficulty: this.difficulty,
      site: this.site,
      clock: this.clock,
      speed: this.speed,
      fuelBrand: this.fuelBrand,
      fuelLoads: this.fuelLoads,
      foodShelf: this.foodShelf,
      shopShelf: this.shopShelf,
      lostSpend: this.lostSpend,
      bagsLost: this.bagsLost,
      bagsMishandled: this.bagsMishandled,
      caterBrand: this.caterBrand,
      mealSold: this.mealSold,
      signed: this.signed,
      flightsDone: this.flightsDone,
      paxServed: this.paxServed,
      revenue: this.revenue,
      securityIncidents: this.securityIncidents,
      reputation: this.reputation,
      loanBalance: this.loanBalance,
      loanProductId: this.loanProductId,
      loanPrincipal: this.loanPrincipal,
      loanOpened: this.loanOpened,
      fieldXp: this.fieldXp,
      specPaths: this.specPaths,
      specNodes: this.specNodes,
      progressionBuilt: this.progressionBuilt,
      parcels: this.parcels,
      ownedPlots: this.ownedPlots,
      staffHousing: this.staffHousing.save(),
      maintenanceContract: this.maintenanceContract,
      railLinked: this.railLinked,
      hotelLevel: this.hotelLevel,
      carParkShort: this.carParkShort,
      carParkLong: this.carParkLong,
      parkTerms: this.parkTerms,
      hotelClass: this.hotelClass,
      standClass: this.standClass,
      standAccess: this.standAccess,
      standPits: this.standPits,
      standScale: this.standScale,
      standSize: this.standSize,
      standRung: this.standRung,
      fittings: this.fittings,
      hangarScale: this.hangarScale,
      pillar: {
        contractId: this.contractId,
        tankTier: this.tankTier,
        litres: this.tankLitres,
        supply: this.fuelSupply,
        roadMinutes: this.roadMinutes,
        spotOffer: this.spotOffer,
        spotInbound: this.spotInbound,
        termUpliftLitres: this.termUpliftLitres,
        spotCool: this.spotCool,
        supplierStanding: this.supplierStanding,
        fuelIndex: this.fuelIndex,
        pipelineHoldMinutes: this.pipelineHoldMinutes,
        pipelineCoolMinutes: this.pipelineCoolMinutes,
        bargeMinutes: this.bargeMinutes,
        fleet: this.scaleFleet,
        bagSystem: this.bagSystem,
        desks: this.paxDesks,
        kiosks: this.paxKiosks,
        bagDrops: this.paxBagDrops,
        scannerLanes: this.scannerLanes,
        eGates: this.eGates,
      },
      janitors: this.janitors,
      researchers: this.researchers,
      deskStaff: this.deskStaff,
      dedicatedDesks: this.dedicatedDesks.map((row) => ({ deskId: row.deskId, airlineId: row.airlineId })),
      public: this.public,
      sharePrice: this.sharePrice,
      sharesOwned: this.sharesOwned,
      sharesFloat: this.sharesFloat,
      budgets: this.budgets,
      mechanics: this.mechanics,
      mxSigned: this.mxSigned,
      runwayCondition: this.runwayCondition,
      weather: this.weather,
      milAgreement: this.milAgreement,
      extraAirlines: this.extraAirlines,
      airlineHeat: this.airlineHeat,
      airlineBanUntil: this.airlineBanUntil,
      layover: this.layover,
      schedule: this.schedule.filter((s) => s.status === 'scheduled' || s.status === 'delayed'),
      scheduleAuto: this.scheduleAuto,
      airlineReward: this.airlineReward,
      airlineWarned: this.airlineWarned,
      researchPoints: this.researchPoints,
      researchUnlocked: this.researchUnlocked,
      researchUnified: true,
      wave3: this.wave3.save(),
      researchTree: this.researchTree.save(),
      missedConnections: this.missedConnections,
      linkWear: this.linkWear,
      linkDown: this.linkDown,
      strandedGates: this.strandedGates,
      linkExplanation: this.linkExplanation,
      hubLinksBuilt: this.hubLinksBuilt,
      hubAirlines: this.hubAirlines,
      hubTiers: this.hubTiers,
      hubDedicated: this.hubDedicated,
      hubLeases: this.hubLeases,
      hubLeaseWarnings: this.hubLeaseWarnings,
      hubOffered: this.hubOffered,
      hubTierSince: this.hubTierSince,
      hubVehicleLeases: this.hubVehicleLeases,
      hubRivalRefuse: this.hubRivalRefuse,
      hubRivalQuiet: this.hubRivalQuiet,
      hubRivalPhone: this.hubRivalPhone,
      hubNudges: this.hubNudges,
      hubNudgeSilenced: this.hubNudgeSilenced,
      hubNudgeLast: this.hubNudgeLast,
      hubFerryDay: this.hubFerryDay,
      layoverWins: this.layoverWins,
      coachDismissed: this.coachDismissed,
      hintPrefs: this.hintPrefs,
      tipChips: this.tipBook,
      buildTrayOpened: this.buildTrayOpened,
      fieldTask: this.fieldTask,
      ackedLetters: this.ackedLetters,
      starterFreehand: this.starterFreehand,
      starterKitStamped: this.starterKitStamped,
      cargoWarehouse: this.cargoWarehouse,
      cargoVolume: this.cargoVolume,
      startFocus: this.startFocus,
      mapId: this.mapId,
      mapChallenges: this.mapChallenges,
      sandbox: this.sandbox,
      sites: this.sites,
      tier3: this.tier3.save(),
      powerPlantTier: this.powerPlantTier,
      diplomacy: this.diplomacy?.save(),
      diplomacySeed: this.diplomacySeed,
      publishedFeeIndex: this.publishedFeeIndex,
      negotiation: this.negotiationBridge?.save(),
      priceWar: this.priceWar?.serialize(),
      inbound: this.inbound?.state,
      fees: { ...this.fees },
      depositTier: this.depositTier,
      deposits: this.deposits,
      commercialLead: this.commercialLead,
      feeStandingApplied: this.feeStandingApplied,
      premium: this.premium,
      tycoon: this.tycoon.snapshot(),
      rival: this.rival?.serialize(),
      disruptions: this.disruptions.save(),
      playtestYear: this.playtestYear.save(),
      tier3Sites: this.lateSites.map((site) => ({ ...site })),
      missedHotelNights: this.missedHotelNights,
      crewHotelNights: this.crewHotelNights,
      achievements: this.achievements.save(),
      scenario: this.scenarioRun ? { ...this.scenarioRun } : undefined,
    }
    try {
      localStorage.setItem(
        SAVE_KEY,
        serialize({ version: SAVE_SCHEMA_VERSION, snapshot: () => snap, restore() {} }, Date.now()),
      )
    } catch {
      /* ignore */
    }
  }

  static hasSave(): boolean {
    return Boolean(localStorage.getItem(SAVE_KEY))
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    this.lastSaveIssues = []
    try {
      const opened = readStoredSave<GameSnapshot>(raw, SAVE_SCHEMA_VERSION, SAVE_MIGRATIONS, validateAirportSave)
      this.lastSaveIssues = opened.issues
      if (opened.issues.some((issue) => issue.kind === 'flagged')) return false
      const s = opened.envelope.data
      this.tiles = s.tiles
      this.fits = (s.terminalFits ?? []).map((f) => {
        const rooms = { ...emptyRooms(), ...(f.rooms ?? {}) }
        const claimRooms = Math.max(1, rooms.bagclaim || (f.premade ? 1 : 0))
        return decorateFit({
          ...f,
          rooms,
          wearBath: f.wearBath ?? 0,
          wearSec: f.wearSec ?? 0,
          claimRate:
            f.claimRate ?? (f.premade ? 0.72 + claimRooms * 0.08 : 0.9 + claimRooms * 0.12),
        })
      })
      this.cash = s.cash
      this.branding = (typeof s.branding === 'string' && deserializeBranding(s.branding)) || defaultBranding()
      this.difficulty = s.difficulty
      this.site = s.site
      this.clock = s.clock
      this.payrollDay = Math.floor(Math.max(0, s.clock) / 180)
      this.levyMark = s.clock
      this.bank = new Bank(s.sandbox ? 0 : this.cash)
      this.fees = restoreFees(s.fees)
      this.depositTier = restoreTier(s.depositTier)
      this.deposits = restoreDeposits(s.deposits)
      this.commercialLead = restoreLeads(s.commercialLead)
      this.feeStandingApplied = s.feeStandingApplied ?? 0
      this.simClock = new SimClock({ simMinutes: Math.max(0, s.clock) * SIM_MINUTES_PER_REAL_SECOND })
      this.tycoon.restore(s.tycoon, Math.floor(Math.max(0, s.clock) / REAL_SECONDS_PER_GAME_DAY))
      this.economy = null
      this.economyState = null
      this.economyView = null
      this.speed = 0
      this.fuelBrand = s.fuelBrand
      this.fuelLoads = s.fuelLoads
      this.foodShelf = s.foodShelf ?? this.shelfCap('food')
      this.shopShelf = s.shopShelf ?? this.shelfCap('shop')
      this.lostSpend = s.lostSpend ?? 0
      this.bagsLost = s.bagsLost ?? 0
      this.bagsMishandled = s.bagsMishandled ?? 0
      this.bagBooks.clear()
      this.bagTags = []
      this.bagReleaseAt.clear()
      this.bagShow = null
      this.caterBrand = s.caterBrand ?? null
      this.mealSold = s.mealSold
      this.signed = s.signed ?? []
      this.flightsDone = s.flightsDone
      this.paxServed = s.paxServed
      this.playtestYear.restore(s.playtestYear, this.paxServed)
      this.revenue = s.revenue
      this.securityIncidents = s.securityIncidents ?? 0
      this.securityIncidentsAtPayroll = this.securityIncidents
      this.reputation = clampReputation(s.reputation ?? 40)
      this.reputationShown = this.reputation
      this.reputationDrift = 0
      this.loanBalance = s.loanBalance ?? 0
      this.loanProductId = s.loanProductId ?? (this.loanBalance > 0 ? 'bridge' : null)
      this.loanPrincipal = s.loanPrincipal ?? (this.loanBalance > 0 ? LOAN_PRINCIPAL : 0)
      this.loanOpened =
        s.loanOpened ??
        (this.loanBalance > 0 ? LOAN_PRINCIPAL + LOAN_FEE : 0)
      this.fieldXp = s.fieldXp ?? Math.min(700, this.flightsDone * 8 + this.signed.length * 20)
      this.specPaths = (s.specPaths ?? []).filter((id): id is SpecPath => isSpecPath(id))
      this.specNodes = (s.specNodes ?? []).filter((id) => isSpecNode(id))
      this.progressionBuilt = (s.progressionBuilt ?? []).filter(
        (id) => id !== 'hydrant' && Boolean(progressionBuildable(id)),
      )
      const legacyPits = s.standPits == null
      this.standPits = { ...(s.standPits ?? {}) }
      this.hydrantArm = false
      this.extraAirlines = (s.extraAirlines ?? []).map((a) => normalizeAirline(a as Airline))
      this.parcels = s.parcels ?? 1
      this.ownedPlots = this.site ? restoreOwned(s.ownedPlots, this.parcels, LAND_PLOT) : []
      if (this.ownedPlots.length) this.parcels = this.ownedPlots.length
      this.staffHousing.load(s.staffHousing)
      this.maintenanceContract = s.maintenanceContract ?? false
      this.railLinked = s.railLinked ?? false
      this.hotelLevel = s.hotelLevel ?? 0
      this.carParkShort = s.carParkShort ?? false
      this.carParkLong = s.carParkLong ?? false
      this.parkTerms = s.parkTerms ?? {}
      this.hotelClass = s.hotelClass ?? {}
      this.lateSites = restoreLateSites(s.tier3Sites, this.tiles)
      this.missedHotelNights = wholeNights(s.missedHotelNights ?? 0)
      this.crewHotelNights = wholeNights(s.crewHotelNights ?? 0)
      if (s.achievements) this.achievements.load(s.achievements as AchievementState)
      // Migrate bare hotel tiles from older saves → business grade.
      for (const p of tilesOf(this.tiles, 'hotel')) {
        const k = `${p.c},${p.r}`
        if (!this.hotelClass[k]) this.hotelClass[k] = 'business'
      }
      this.standClass = s.standClass ?? {}
      this.standAccess = s.standAccess ?? {}
      this.standScale = s.standScale ?? {}
      this.standSize = readStandSizes(s.standSize)
      this.standRung = readStandRungs(s.standRung)
      this.fittings = readFittings(s.fittings)
      this.hangarScale = s.hangarScale ?? {}
      this.migrateMissingStands()
      this.contractId = s.pillar?.contractId ?? null
      this.tankTier = s.pillar?.tankTier ?? 1
      this.tankLitres = s.pillar?.litres ?? seedLitresFromLoads(s.fuelLoads)
      this.fuelSupply = s.pillar?.supply ?? 'road'
      this.roadMinutes = s.pillar?.roadMinutes ?? 0
      this.spotOffer = s.pillar?.spotOffer ?? null
      this.spotInbound = s.pillar?.spotInbound ?? null
      this.termUpliftLitres = s.pillar?.termUpliftLitres ?? 0
      this.spotCool = s.pillar?.spotCool ?? 0
      this.supplierStanding = { ...(s.pillar?.supplierStanding ?? {}) }
      this.fuelIndex = s.pillar?.fuelIndex ?? 0
      this.pipelineHoldMinutes = s.pillar?.pipelineHoldMinutes ?? 0
      this.pipelineCoolMinutes = s.pillar?.pipelineCoolMinutes ?? pipelineIntervalMinutes()
      this.bargeMinutes = s.pillar?.bargeMinutes ?? 0
      this.scaleFleet = (s.pillar?.fleet ?? {}) as Partial<Record<VehicleType, number>>
      this.bagSystem = s.pillar?.bagSystem ?? 'carts'
      this.paxDesks = s.pillar?.desks ?? 2
      this.paxKiosks = s.pillar?.kiosks ?? 0
      this.paxBagDrops = s.pillar?.bagDrops ?? 0
      this.scannerLanes = s.pillar?.scannerLanes ?? 1
      this.eGates = s.pillar?.eGates ?? 0
      this.standAccessMode = 'remote'
      this.janitors = s.janitors ?? 0
      this.researchers = s.researchers ?? 0
      this.deskStaff = s.deskStaff ?? 0
      this.dedicatedDesks = (s.dedicatedDesks ?? []).map((row) => ({ deskId: row.deskId, airlineId: row.airlineId }))
      this.premium = restorePremium(s.premium)
      this.hallStaff = []
      this.public = s.public ?? false
      this.sharePrice = s.sharePrice ?? 0
      this.sharesOwned = s.sharesOwned ?? 0
      this.sharesFloat = s.sharesFloat ?? 0
      this.ipoPrice = this.sharePrice
      this.budgets = { ...DEFAULT_BUDGETS, ...(s.budgets ?? {}) }
      this.mechanics = s.mechanics ?? 0
      this.mxSigned = s.mxSigned ?? []
      this.runwayCondition = s.runwayCondition ?? 100
      this.weather = s.weather ?? 'clear'
      this.milAgreement = s.milAgreement ?? false
      this.airlineHeat = s.airlineHeat ?? {}
      this.airlineBanUntil = s.airlineBanUntil ?? {}
      this.airlineReward = s.airlineReward ?? {}
      this.airlineWarned = s.airlineWarned ?? {}
      this.airlineLowAcc = {}
      const folded = foldResearchSave(
        {
          researchPoints: s.researchPoints,
          researchUnlocked: s.researchUnlocked,
          researchTree: s.researchTree,
          researchUnified: s.researchUnified,
          wave3: s.wave3,
        },
        this.fieldLevel(),
      )
      const foldedTree = folded.researchTree as GameSnapshot['researchTree']
      const foldedWave = folded.wave3 as GameSnapshot['wave3']
      this.researchUnlocked = (folded.researchUnlocked as ResearchId[] | undefined) ?? []
      this.wave3.load(foldedWave)
      this.researchTree.load(foldedTree, this.fieldLevel())
      this.noteTreeGrants()
      if (legacyPits && this.hasResearch('hydrant_fuel')) this.grantLegacyPits()
      this.missedConnections = s.missedConnections ?? 0
      this.linkWear = {
        mover: Number.isFinite(s.linkWear?.mover) ? s.linkWear!.mover : 0,
        bus: Number.isFinite(s.linkWear?.bus) ? s.linkWear!.bus : 0,
      }
      this.linkDown = {
        mover: s.linkDown?.mover === true,
        bus: s.linkDown?.bus === true,
      }
      this.strandedGates = (s.strandedGates ?? []).filter((id) => typeof id === 'string' && id.length > 0)
      this.linkExplanation = typeof s.linkExplanation === 'string' ? s.linkExplanation : ''
      this.hubLinksBuilt = {}
      for (const [key, kind] of Object.entries(s.hubLinksBuilt ?? {})) {
        if (kind === 'people_mover' || kind === 'xferbus' || kind === 'skywalk') this.hubLinksBuilt[key] = kind
      }
      this.hubLinks = []
      this.tier3 = Tier3Session.restore(s.tier3)
      this.restoreScenario(s.scenario)
      this.powerPlantTier = s.powerPlantTier === 2 || s.powerPlantTier === 3 ? s.powerPlantTier : 1
      this.hubAirlines = s.hubAirlines ?? []
      this.hubTiers = readHubTiers(s.hubTiers)
      this.hubDedicated = readHubDedicated(s.hubDedicated)
      this.hubLeases = readHubLeases(s.hubLeases)
      this.hubLeaseWarnings = readHubLeaseWarnings(s.hubLeaseWarnings)
      this.hubOffered = readHubOffered(s.hubOffered) as Record<string, HubOfferTier[]>
      this.hubTierSince = readHubDayMap(s.hubTierSince)
      this.hubVehicleLeases = readHubVehicleLeases(s.hubVehicleLeases)
      this.hubRivalRefuse = readHubDayMap(s.hubRivalRefuse)
      this.hubRivalQuiet = readHubDayMap(s.hubRivalQuiet)
      this.hubRivalPhone = Array.isArray(s.hubRivalPhone)
        ? s.hubRivalPhone.flatMap((row) => {
            if (!row || typeof row !== 'object') return []
            const src = row as { id?: unknown; name?: unknown; text?: unknown }
            if (typeof src.id !== 'string' || typeof src.name !== 'string' || typeof src.text !== 'string') return []
            return [{ id: src.id, name: src.name, text: src.text }]
          })
        : []
      this.hubNudges = Array.isArray(s.hubNudges)
        ? s.hubNudges.flatMap((row) => {
            if (!row || typeof row !== 'object') return []
            const src = row as { airlineId?: unknown; step?: unknown; text?: unknown }
            if (typeof src.airlineId !== 'string' || typeof src.step !== 'string' || typeof src.text !== 'string') return []
            return [{ airlineId: src.airlineId, step: src.step, text: src.text }]
          })
        : []
      this.hubNudgeSilenced = Array.isArray(s.hubNudgeSilenced)
        ? s.hubNudgeSilenced.flatMap((row) => {
            if (!row || typeof row !== 'object') return []
            const src = row as { airlineId?: unknown; step?: unknown }
            if (typeof src.airlineId !== 'string' || typeof src.step !== 'string') return []
            return [{ airlineId: src.airlineId, step: src.step }]
          })
        : []
      this.hubNudgeLast = readHubDayMap(s.hubNudgeLast)
      this.hubFerryDay = readHubDayMap(s.hubFerryDay)
      this.layoverWins = s.layoverWins ?? {}
      this.coachDismissed = s.coachDismissed ?? this.flightsDone >= 1
      // The save wins; older saves fall back to the settings mirror, then to defaults.
      this.hintPrefs = sanitizeHintPrefs(s.hintPrefs ?? readHintSettings())
      writeHintSettings(this.hintPrefs)
      this.tipBook = sanitizeTipBook(s.tipChips)
      this.tipVisible = []
      this.buildTrayOpened = s.buildTrayOpened ?? false
      this.alerts.reset()
      this.planAdvice = { key: '', list: [] }
      this.firstTakeoffNoted = this.flightsDone >= 1
      this.fieldTask = s.fieldTask ?? null
      this.fieldTaskCool = this.fieldTask ? 0 : 18
      this.ackedLetters = s.ackedLetters ?? []
      this.starterFreehand = s.starterFreehand ?? false
      this.starterKitStamped = s.starterKitStamped ?? false
      this.nightCurfewCool = 0
      this.hubOffer = null
      this.hubOfferCool = 40
      this.layover = s.layover ?? null
      this.layoverOffer = null
      this.layoverOfferCool = 20
      this.layoverSpawnAcc = 0
      this.schedule = (s.schedule ?? []).map((slot) => ({
        ...slot,
        status: slot.status === 'inbound' ? 'scheduled' : slot.status,
        flightId: null,
      }))
      this.scheduleAuto = s.scheduleAuto ?? true
      this.schedulePlanCool = 6
      this.cargoWarehouse = s.cargoWarehouse ?? 0
      this.cityCargoCool = 6
      this.startFocus = s.startFocus ?? (s.site === 'factory' ? 'cargo' : 'pax')
      this.mapId = parseMapId(s.mapId)
      this.mapChallenges = s.mapChallenges ?? {}
      this.winterOps = null
      this.mapClimateKey = ''
      this.sandbox = s.sandbox ?? false
      this.sites = s.sites ?? []
      this.diplomacy = null
      this.diplomacySeed = s.diplomacySeed ?? 1
      this.disruptions = DisruptionBridge.restore(this.diplomacySeed, s.disruptions)
      this.opsEvents.reset()
      this.publishedFeeIndex = s.publishedFeeIndex ?? 1
      this.missedByAirline = {}
      if (s.diplomacy) this.ensureDiplomacy().load(s.diplomacy)
      this.negotiationBridge = null
      if (s.negotiation) this.negotiationDesk().load(s.negotiation)
      this.priceWar = PriceWar.restore(s.priceWar)
      if (s.inbound) {
        this.inbound = InboundBridge.restore(s.inbound, this.diplomacySeed)
      } else {
        this.inbound = new InboundBridge(this.diplomacySeed)
        this.inbound.state.clock = this.clock
        this.inbound.state.rolledDay = Math.floor(this.clock / SIM_DAY_SEC)
      }
      this.rival = RivalAirport.restore(s.rival)
      this.rivalWalkaways = []
      if (this.site && !this.rival) this.ensureRival()
      this.cargoVolume = s.cargoVolume ?? null
      this.cargoVolumeCool = this.cargoVolume ? 0 : 25
      this.loanNewsCool = 0
      this.mission = null
      this.mxOffer = null
      this.pendingThreat = null
      this.pendingEmergency = null
      this.emergencyCool = 45
      this.analystCool = 40
      this.flights = []
      this.landsideTraffic.reset()
      this.landsideOpen = false
      this.landsideFocus = null
      this.landsideNewsCool = 0
      this.missedCheckIns = 0
      this.curbFeeMisses = 0
      this.curbMissedFrac = 0
      this.fuelChain.reset()
      this.fuelOpen = false
      this.fuelRoadLoad = 0
      this.fuelJustDelivered = false
      this.trucks = []
      this.people = []
      this.hallGuests = []
      this.offer = null
      this.view = 'apron'
      this.bumpMap()
      this.pushNews('Field restored. Clock paused.', 'ok')
      this.syncDisruptionAlert()
      this.emit()
      return Boolean(this.site)
    } catch {
      return false
    }
  }

  pushNews(text: string, tone: News['tone']) {
    this.news.unshift({ id: uid('n'), text, tone, age: 0 })
    this.news = this.news.slice(0, 10)
  }

  tile(v: Vec): Tile | null {
    if (!inBounds(v.c, v.r)) return null
    return this.tiles[v.r][v.c]
  }

  /** Call after any apron tile or stand/park/hotel class stamp changes. */
  bumpMap() {
    this.mapRev += 1
    this.adviceDirty = true
    this.operableStripCache = null
    this.invalidateRunwayLoad()
  }

  spend(amount: number, label: string, category: MoneyCategory = 'construction', source = 'sim'): boolean {
    if (this.sandbox) {
      if (this.cash < SANDBOX_CASH * 0.5) this.cash = SANDBOX_CASH
      return true
    }
    if (
      label !== 'starter kit' &&
      this.starterKitProtected() &&
      this.cash - amount < STARTER_KIT_COST
    ) {
      this.pushNews(
        `Hold $${STARTER_KIT_COST.toLocaleString('en-US')} for the starter kit. ${label} would spend it — stamp the kit or choose Build freehand.`,
        'bad',
      )
      this.emit()
      return false
    }
    if (this.cash < amount) {
      this.pushNews(`Need ${label} — short ${Math.round(amount - this.cash)}.`, 'bad')
      this.emit()
      return false
    }
    this.noteExpense(amount)
    this.cash -= amount
    if (amount > 0) this.postJournal(category, amount, this.simMinutes(), label, source)
    return true
  }

  /**
   * Fines / bills — may go into debt, but floors so the tape can't spiral forever.
   * Cash taken is a normal ledger line. The remainder that does not fit above the
   * debt floor is an unpaid line and does not move cash or the bank balance.
   * Returns the amount taken. Sandbox bills are not journaled.
   */
  charge(amount: number, category: MoneyCategory = 'penalties', stamp = this.simMinutes(), label?: string): number {
    if (this.sandbox || !(amount > 0) || !Number.isFinite(amount)) return 0
    const taken = this.takeCash(amount)
    if (taken > 0) this.postJournal(category, taken, stamp, label)
    const skipped = amount - taken
    if (skipped > 0) this.postUnpaid(category, skipped, stamp, label)
    return taken
  }

  /** Cash side of `charge()` without the journal line, for callers that post richer bank meta. */
  private takeCash(amount: number): number {
    if (this.sandbox || !(amount > 0) || !Number.isFinite(amount)) return 0
    const room = Number.isFinite(this.cash) ? Math.max(0, this.cash - CASH_DEBT_FLOOR) : 0
    const taken = Math.min(amount, room)
    if (!(taken > 0)) return 0
    this.noteExpense(taken)
    this.cash -= taken
    return taken
  }

  noteIncome(amount: number, category: MoneyCategory = 'landing_fees') {
    if (!(amount > 0)) return
    this.hourIncome += amount
    this.dayIncome += amount
    const stamp = this.simMinutes()
    // A stocked counter sells all day. One retail line per game day keeps
    // the cash and the category total, without a journal row per serving.
    if (category === 'retail_sales' && this.bank.addToLatest(category, amount, stamp)) return
    this.postJournal(category, amount, stamp)
  }

  /** Sim minutes on the shared clock. One field second is eight game minutes. */
  simMinutes(): number {
    return Math.max(0, this.clock) * SIM_MINUTES_PER_REAL_SECOND
  }

  /**
   * Measures the open hall as a flow graph. Passengers stay on the hall graph;
   * this audit does not mark anyone lost or any bag mishandled.
   */
  flowAudit() {
    const graph = new FlowGraph()
    const rooms = this.fits[0]?.rooms
    const zones: TerminalZone[] = [
      { id: 'curb', kind: 'curb', servers: 2, ratePerServer: 30, queueCapacity: 40 },
      { id: 'checkin', kind: 'checkin', servers: Math.max(1, rooms?.checkin ?? 1), ratePerServer: 1.5, queueCapacity: 30 },
      { id: 'security', kind: 'security', servers: Math.max(1, rooms?.security ?? 1), ratePerServer: 20, queueCapacity: 40 },
      { id: 'gate', kind: 'gate', servers: Math.max(1, rooms?.gate ?? 1), ratePerServer: 12, queueCapacity: 80 },
      { id: 'claim', kind: 'claim', servers: Math.max(1, rooms?.bagclaim ?? 1), ratePerServer: 10, queueCapacity: 40 },
      { id: 'exit', kind: 'exit', servers: 2, ratePerServer: 30, queueCapacity: 20 },
    ]
    registerTerminal(graph, zones)
    graph.tick(1)
    return audit(graph)
  }

  private tickAmbience(dt: number) {
    if (typeof window === 'undefined' || !(dt > 0)) return
    const parked = this.flights.filter((f) => f.phase === 'parked' || f.phase === 'board' || f.phase === 'deboard').length
    this.ensureAmbience().update(
      {
        checkinOccupancy: Math.min(1, this.hallGuests.filter((g) => !g.preview).length / 40),
        walkingWithBagsOccupancy: Math.min(1, this.people.length / 40),
        securityLanesOpen: Math.max(1, this.fits[0]?.rooms.security ?? 0),
        securityThroughputPerMin: this.securityQueueCount(),
        apusRunning: parked,
        gpusConnected: this.flights.filter((f) => f.phase === 'parked').length,
        beltLoadersRunning: this.trucks.filter((t) => t.kind === 'bags').length,
        fuelPumpsRunning: this.trucks.filter((t) => t.kind === 'fuel').length,
        outdoorMix: this.view === 'hall' ? 0.1 : 0.85,
      },
      dt,
    )
  }

  private ensureAmbience(): AmbienceMixer {
    if (!this.ambience) {
      const audio = getAudio()
      this.ambience = new AmbienceMixer({
        playSfx: (id, options) => audio.playSfx(id, options),
      })
    }
    return this.ambience
  }

  /** Latest economy snapshot for the HUD. Null until the first tick. */
  economySnapshot(): EconomySnapshot | null {
    return this.economyView
  }

  private groundIncomeCategory(category: string): MoneyCategory {
    if (category === 'fuel_sales') return 'fuel_sales'
    if (category === 'catering_fees') return 'catering_fees'
    if (category === 'shop_sales') return 'retail_sales'
    if (category === 'cargo_airport_revenue') return 'cargo_fees'
    if (category === 'baggage_fees') return 'baggage_fees'
    return 'landing_fees'
  }

  private postJournal(
    category: MoneyCategory,
    magnitude: number,
    simMinutes: number,
    label?: string,
    source = 'sim',
  ) {
    if (!(magnitude > 0) || !Number.isFinite(magnitude)) return
    const signed = moneyDirection(category) === 'income' ? magnitude : -magnitude
    this.bank.post(category, signed, {
      simMinutes: Math.max(0, simMinutes),
      source,
      label,
    })
  }

  /** A bill cash did not take. The line is visible and does not move the balance. */
  private postUnpaid(
    category: MoneyCategory,
    magnitude: number,
    simMinutes: number,
    label?: string,
    source = 'unpaid',
  ) {
    if (this.sandbox || !(magnitude > 0) || !Number.isFinite(magnitude)) return
    const signed = moneyDirection(category) === 'income' ? magnitude : -magnitude
    this.bank.post(category, signed, {
      simMinutes: Math.max(0, simMinutes),
      source,
      label,
      unpaid: true,
    })
  }

  /** Cash in that is not an operating earn. Refunds, the IPO, and share sales. */
  private credit(amount: number, category: MoneyCategory, label?: string, source = 'sim') {
    if (!(amount > 0) || !Number.isFinite(amount)) return
    this.cash += amount
    if (!this.sandbox) this.postJournal(category, amount, this.simMinutes(), label, source)
  }

  noteExpense(amount: number) {
    if (amount > 0) {
      this.hourExpense += amount
      this.dayExpense += amount
    }
  }

  /** Pax and freight cleared when a turnaround finishes — feeds the day charts. */
  noteTurn(f: Flight) {
    if (!(f.cargo || f.kind === 'freighter')) this.dayPax += Math.max(0, f.pax)
    if (f.cargo || f.kind === 'freighter') {
      const hold = AIRFRAMES[f.airframeId]?.cargoHold
      this.dayCargo += hold && hold > 0 ? hold : Math.max(8, f.pax || 16)
    }
    const pax = f.cargo || f.kind === 'freighter' ? 0 : Math.max(0, f.pax)
    this.noteMapGoals(pax)
  }

  /** Hourly book for the economy charts. One in-game hour is 7.5 sim-seconds. */
  sampleEconomy(step: number) {
    const hour = 7.5
    const day = 180
    this.econHour += step
    let paxSnap = this.dayPax
    let cargoSnap = this.dayCargo
    if (this.clock - this.dayMark >= day) {
      const closedDay = Math.floor(this.dayMark / day)
      const closedPax = this.dayPax
      const profit = this.dayIncome - this.dayExpense
      this.paxPerDay = closedPax
      this.cargoPerDay = this.dayCargo
      paxSnap = this.paxPerDay
      cargoSnap = this.cargoPerDay
      this.dayPax = 0
      this.dayCargo = 0
      this.dayIncome = 0
      this.dayExpense = 0
      this.dayMark = this.clock
      const retail = this.negotiationBridge?.rollDay() ?? 0
      if (retail > 0) this.earn(retail, 'ULCC retail')
      this.advanceRivalDay()
      this.advancePriceWarDay()
      this.closeScenarioDay(closedDay, closedPax, profit)
    }
    if (this.econHour < hour) return
    this.incomePerHour = Math.round(this.hourIncome)
    this.econHist.push({
      t: this.clock,
      cash: Math.round(this.cash),
      income: Math.round(this.hourIncome),
      expense: Math.round(this.hourExpense),
      pax: paxSnap,
      cargo: cargoSnap,
    })
    if (this.econHist.length > 96) this.econHist.shift()
    this.hourIncome = 0
    this.hourExpense = 0
    // Keep the leftover so one long tick does not invent an empty hour that reads $0/hr.
    this.econHour -= hour
    if (this.econHour >= hour) this.econHour = hour - 0.001
  }

  /**
   * Hourly figure for the HUD. A single quiet hour must not hide earnings
   * already in the book, and an open hour shows as soon as cash is earned.
   */
  incomeRate(): number {
    const recent = this.econHist.slice(-6).map((row) => row.income)
    if (this.econHour > 0 || this.hourIncome > 0) recent.push(Math.round(this.hourIncome))
    if (!recent.length) return this.incomePerHour
    const earned = recent.filter((n) => n > 0)
    const pool = earned.length ? earned : recent
    return Math.round(pool.reduce((sum, n) => sum + n, 0) / pool.length)
  }

  earn(
    amount: number,
    label: string,
    flight?: Flight,
    category: MoneyCategory = 'landing_fees',
    announce = true,
  ) {
    if (!(amount > 0) || !Number.isFinite(amount)) return
    const turnFee =
      category === 'landing_fees' ||
      category === 'passenger_fees' ||
      category === 'baggage_fees' ||
      category === 'fuel_sales' ||
      category === 'catering_fees' ||
      category === 'retail_sales' ||
      category === 'contract_fees'
    const booked = turnFee && this.smallField() ? Math.round(amount * SMALL_FIELD_FEE_FACTOR) : amount
    if (!(booked > 0)) return
    this.cash += booked
    this.revenue += booked
    this.noteIncome(booked, category)
    if (flight) flight.ledger.push({ label, amount: booked })
    if (announce) this.pushNews(`${label}  +$${booked.toLocaleString('en-US')}`, 'good')
    if (announce && this.clock - this.cashChimeAt >= 1.25) {
      this.cashChimeAt = this.clock
      this.noteSound('cash_in')
    }
  }

  /** Walk-in traffic multiplier from the fee card. 1 at the published prices. */
  walkInDemand(): number {
    return walkInDemandOf(this.fees)
  }

  setFee(key: keyof FeeSchedule, value: number) {
    this.fees = editFee(this.fees, key, value)
    this.syncFeeStanding()
    this.emit()
  }

  setDepositTier(tier: CommercialDepositTier) {
    this.depositTier = tier
    this.emit()
  }

  /** List price times the player's slider. Default schedule leaves the amount alone. */
  private listed(amount: number, key: keyof FeeSchedule): number {
    return this.afterRivalMargin(scaleListed(amount, this.fees[key], DEFAULT_FEE_SCHEDULE[key]))
  }

  private feeTier(airlineId: string): CommercialDepositTier {
    return this.deposits[airlineId]?.tier ?? 'standard'
  }

  /**
   * List amount after the deposit tier, then the signed line (percent and freebies).
   * Walk-ins stay on the list price.
   */
  private contractBill(
    flight: Flight,
    amount: number,
    group: 'landing' | 'service',
    service: ServiceId,
  ): number {
    const walkIn = this.walkInFlight(flight)
    const tier = this.feeTier(flight.airline)
    const priced =
      group === 'landing' ? landingCharge(amount, tier, walkIn) : serviceCharge(amount, tier, walkIn)
    if (walkIn || !(priced > 0)) return priced
    const factor = this.negotiationBridge?.lineFactor(flight.airline, service) ?? 1
    if (!Number.isFinite(factor) || factor === 1) return priced
    return Math.round(priced * Math.max(0, factor))
  }

  /** Live fee card for the offer sheet. Sliders move these numbers; the ask percent does not. */
  liveQuote(id: string) {
    const catalog = AIRLINES[id] ?? this.extraAirlines.find((airline) => airline.id === id)
    const profile = this.negotiationBridge?.desk.profile(id)
    const landingBase = catalog?.landing ?? profile?.posted.landing ?? 0
    const bagsBase = catalog?.bags ?? profile?.posted.bags ?? 0
    const cateringBase = catalog?.catering ?? profile?.posted.catering ?? 0
    const pax = catalog
      ? Math.max(1, Math.round(((catalog.paxMin ?? 0) + (catalog.paxMax ?? 0)) / 2) || 1)
      : Math.max(1, profile?.seats ?? 1)
    const turns = (catalog?.tier ?? 0) >= 4 ? 3 : (profile?.flightsPerDay ?? 4)
    const fuelBase = this.fuelBrand ? FUEL[this.fuelBrand].pump : (profile?.posted.fuel ?? 0)
    const cateringPay = this.caterBrand ? CATER[this.caterBrand].payoutMult : 1
    return {
      landing: this.listed(landingBase, 'landingPerTonne'),
      paxFee: this.fees.paxFee,
      bags: this.listed(bagsBase, 'bagsPerBag'),
      fuel: this.listed(fuelBase, 'fuelMarkupPerLitre'),
      catering: this.listed(Math.round(cateringBase * cateringPay), 'cateringPerCart'),
      parking: this.listed(GA_PARK_DAY_RATE, 'aircraftParkingPerDay'),
      pax,
      turnsPerDay: turns,
      handlingPerDay: catalog ? Math.round(landingBase * 0.35) : (profile?.handlingPerDay ?? Math.round(landingBase * 0.35)),
    }
  }

  private walkInFlight(f: Flight): boolean {
    return Boolean(f.ga) || f.airline === 'ga'
  }

  /** Sim-clock before which this airline's first flight stays on the ground. 0 once it has flown. */
  leadGateClock(airlineId: string): number {
    const lead = this.commercialLead[airlineId]
    if (!lead || lead.opened) return 0
    return firstFlightClock(lead)
  }

  /** Push an early slot out to the lead gate. Returns true when it is not yet allowed to launch. */
  private holdLead(slot: ScheduleSlot): boolean {
    const gate = this.leadGateClock(slot.airline)
    if (!(gate > 0) || slot.eta >= gate - 0.05) return false
    slot.eta = gate
    slot.delayReason = 'Lead time'
    return true
  }

  private syncFeeStanding() {
    const next = standingForFees(this.fees)
    const diff = next - this.feeStandingApplied
    this.feeStandingApplied = next
    if (diff === 0) return
    for (const id of this.signed) this.adjustHeat(id, diff)
  }

  private postDepositEntry(entry: Parameters<typeof depositCashPost>[0]) {
    const post = depositCashPost(entry)
    if (!post) return
    this.cash += post.amount
    if (post.amount > 0) this.noteIncome(post.amount, post.category)
    else {
      this.noteExpense(-post.amount)
      this.postJournal(post.category, -post.amount, this.simMinutes())
    }
  }

  private noteCommercialSign(id: AirlineId, airline: Airline) {
    const terms = this.negotiationBridge?.signedTerms(id) ?? null
    const starter = this.signed.length === 1
    const lead = openLead({
      clock: this.clock,
      starter,
      tier: airline.tier,
      hub: this.isHub(id),
    })
    if (terms?.freebies.waivedLeadTime) lead.leadDays = 0
    this.commercialLead[id] = lead
    if (this.feeStandingApplied !== 0) this.adjustHeat(id, this.feeStandingApplied)
    const day = Math.floor(Math.max(0, this.clock) / 180)
    const taken = signDeposit({
      airlineId: id,
      tier: terms ? commercialDepositTier(terms.deposit) : this.depositTier,
      landingFee: airline.landing,
      day,
    })
    if (terms) taken.account.termEndDay = day + terms.termMonths * TERM_DAYS
    this.deposits[id] = taken.account
    this.postDepositEntry(taken.entry)
  }

  /** Term-end refunds. Called when a game day closes. */
  settleDeposits(completedDay: number) {
    for (const id of Object.keys(this.deposits)) {
      const account = this.deposits[id]
      const settled = settleHeld(account, completedDay)
      if (!settled) continue
      this.deposits[id] = settled.account
      this.postDepositEntry(settled.entry)
      if (settled.entry.amount < 0) {
        const name = this.airline(id as AirlineId).name
        this.pushNews(
          `${name} deposit refunded $${(-settled.entry.amount).toLocaleString('en-US')}.`,
          'ok',
        )
      }
    }
  }

  private forfeitAirlineDeposit(id: AirlineId) {
    const account = this.deposits[id]
    if (!account) return
    const kept = forfeitHeld(account, Math.floor(Math.max(0, this.clock) / 180))
    this.deposits[id] = kept.account
    if (kept.entry.retained > 0) {
      this.pushNews(
        `${this.airline(id).name} cancelled early — deposit $${kept.entry.retained.toLocaleString('en-US')} forfeited.`,
        'ok',
      )
    }
  }

  setTool(tool: Tool) {
    this.hydrantArm = false
    // Outdoor stamps only work on the apron — kick you outside smoothly.
    if (
      this.view === 'hall' &&
      tool !== 'pan' &&
      tool !== 'premade' &&
      tool !== 'terminal'
    ) {
      this.view = 'apron'
    }
    this.tool = tool
    this.runwayStart = null
    if (tool !== 'pan') this.buildTrayOpened = true
    this.refreshAdvice()
    this.emit()
  }

  rotatePiece() {
    this.facing = this.facing === 'h' ? 'v' : 'h'
    this.emit()
  }

  setSpeed(speed: Speed) {
    this.speed = speed
    // Fast-forward: drop hover inspect so the detail card never pops up at 5x.
    if (speed >= 5) {
      this.hoverInspect = null
    }
    this.emit()
  }

  /** Detail cards / hover inspect stay off during 5x fast-forward. */
  inspectEnabled(): boolean {
    return this.speed < 5
  }

  setView(view: 'apron' | 'hall') {
    if (view === 'hall' && !this.fits.length) {
      this.pushNews('Stamp a Premade hall or empty Shell outside first.', 'bad')
      this.emit()
      return
    }
    const prev = this.view
    this.view = view
    if (view === 'hall') {
      this.focusHallForDesk()
      this.tool = 'pan'
      if (prev !== 'hall') {
        this.pushNews(
          'Inside the terminal — prefab ceilings are on the card. Paint a zone or upgrade the shell. H or Apron to leave.',
          'ok',
        )
      }
    } else if (prev !== 'apron') {
      this.pushNews('Back on the apron — build runways, stands, and outside kit here.', 'ok')
    }
    this.emit()
  }

  /** Pan-click a terminal tile to walk inside. */
  enterHallAt(tile: Vec) {
    this.selectedTile = tile
    if (!this.fits.length) {
      this.pushNews('No furnished hall yet — stamp Premade or a Shell.', 'bad')
      this.emit()
      return
    }
    this.setView('hall')
  }

  exitHall() {
    if (this.view === 'hall') this.setView('apron')
  }

  /**
   * Leave the field for the title screen without touching the save.
   * The play screen bounces back while a site is still owned.
   */
  shelveForTitle() {
    this.speed = 0
    this.site = null
    this.tool = 'pan'
    this.emit()
  }

  selectGuest(id: string | null) {
    this.selectedGuest = id
    this.selectedFacility = null
    this.emit()
  }

  /** Open the facility card. A passenger click clears it. */
  selectFacility(id: string | null) {
    this.selectedFacility = id
    if (id) this.selectedGuest = null
    this.emit()
  }

  /** Close the left building panel. */
  closeBuilding() {
    this.selectedBuilding = null
    this.selectedFacility = null
    this.emit()
  }

  /**
   * Card for the building under the cursor, or the hall piece that was clicked.
   * Info-view overlays stay on their own chips; this is the per-building dock.
   */
  buildingCard(): BuildingCard | null {
    if (this.view === 'hall' && this.selectedFacility) {
      const facility = this.facilityReading(this.selectedFacility)
      if (facility) return buildingCard(facility)
    }
    if (!this.selectedBuilding) return null
    const [c, r] = this.selectedBuilding.split(',').map(Number)
    if (!Number.isFinite(c) || !Number.isFinite(r)) return null
    const reading = this.readingAt({ c, r })
    return reading ? buildingCard(reading) : null
  }

  /** Lines for the facility card. `item:…` is a placed piece; a bare id is a queue node. */
  facilityInfo(id: string): { title: string; lines: string[] } | null {
    const fit = this.activeHall()
    if (!fit) return null
    const cols = fit.zones?.[0]?.length ?? 8
    const rows = fit.zones?.length ?? 5
    const catalog = facilitiesFromItems((fit.items ?? []) as PlacedItem[], cols, rows)
    if (id.startsWith('item:')) {
      const item = (fit.items ?? []).find((it) => it.id === id.slice(5))
      if (!item) return null
      const def = itemDef(item.def)
      const facility = catalog.find((row) => row.id === item.id)
      const lines = [
        def?.blurb ?? '',
        facility ? `${facility.type} · capacity ${facility.capacity}` : 'Fixture',
        `At ${item.c}, ${item.r}`,
        `Wear ${Math.round(item.wear)}`,
        `Upkeep $${def?.upkeep ?? 0}/day`,
      ]
      if (footprintOf(def) === 'wall') lines.push('Solid wall — passengers walk around it')
      if (footprintOf(def) === 'belt') lines.push('Belt — nothing else can sit on this cell')
      if (facility?.type === 'checkin' || facility?.type === 'security') {
        lines.push(...this.servicePointLines(facility.type))
      }
      return { title: def?.name ?? 'Facility', lines }
    }
    if (id === 'checkin' || id === 'security') {
      return {
        title: id === 'checkin' ? 'Check-in' : 'Security',
        lines: this.servicePointLines(id),
      }
    }
    if (this.hallNav.live) {
      // The walk's real lines: count, worst wait, and whether the kit keeps up.
      const live = this.hallNav.queues().find((q) => q.node === id)
      const loads = this.hallNav.loads().filter((l) => l.node === id)
      if (live || loads.length) {
        const mins = Math.round((live?.waitSec ?? 0) / 60)
        return {
          title: live?.label ?? id,
          lines: [
            `${live?.count ?? 0} waiting at ${loads.length} ${loads.length === 1 ? 'point' : 'points'}`,
            `Wait ~${mins} min`,
            live?.bottleneck ? 'Bottleneck — add a lane, a desk, or a wider queue' : 'Line is moving',
          ],
        }
      }
    }
    const row = hallQueues(this.hallGuests).find((q) => q.node === id)
    if (!row) {
      const count = queueAtNode(this.hallGuests, id as HallNode)
      return { title: id, lines: [`Queue ${count}`] }
    }
    return {
      title: row.label,
      lines: [
        `${row.count} waiting`,
        row.bottleneck ? 'Bottleneck — add a lane, a desk, or a wider queue' : 'Line is moving',
      ],
    }
  }

  /** The selected tile is one of the halls on the field. */
  private terminalHallSelected(): boolean {
    const origin = this.selectedTerminalOrigin()
    if (!origin) return false
    return this.fits.some((fit) => fit.origin.c === origin.c && fit.origin.r === origin.r)
  }

  /**
   * Services and the terminal view call this so a lone hall is selected.
   * Several halls with nothing selected stay unselected.
   */
  focusHallForDesk(): 'ready' | 'none' | 'choose' {
    if (!this.fits.length) return 'none'
    if (this.terminalHallSelected()) return 'ready'
    if (this.fits.length === 1) {
      const only = this.fits[0]
      if (!only) return 'none'
      this.selectedTile = { c: only.origin.c, r: only.origin.r }
      this.emit()
      return 'ready'
    }
    return 'choose'
  }

  /** Copy for the furnish list when no hall is selected. */
  hallFurnishNote(): string {
    if (this.fits.length > 1 && !this.terminalHallSelected()) {
      return 'Several halls are on the field. Select one before buying rooms.'
    }
    return 'Stamp a Premade hall or an empty Shell, then select it. Operations rooms are listed here. Shops are under Commercial. Lab rooms are under R&D. Weak security invites threats. Budget crowds wear restrooms and lanes — scrub or the street writes exposés.'
  }

  activeHall(): TerminalFit | null {
    if (this.fits.length === 0) return null
    const origin = this.selectedTerminalOrigin()
    if (origin) {
      const fit = this.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
      if (fit) return fit
    }
    return this.fits[0]
  }

  hallKey(fit: TerminalFit): string {
    return `${fit.origin.c},${fit.origin.r}`
  }

  /** T1 / T2 labels in stamp order. */
  hallLabel(fit: TerminalFit): string {
    const i = this.fits.findIndex(
      (f) => f.origin.c === fit.origin.c && f.origin.r === fit.origin.r,
    )
    return `T${i >= 0 ? i + 1 : 1}`
  }

  fitByKey(key: string | undefined | null): TerminalFit | null {
    if (!key) return null
    return this.fits.find((f) => this.hallKey(f) === key) ?? null
  }

  hallOpenFor(fit: TerminalFit | null): Set<HallNode> {
    if (!fit) return new Set()
    return openNodesFromRooms(fit.rooms)
  }

  /** Claim belt clear speed — premade ceilings + overcrowding slow bags. */
  claimClearRate(fit: TerminalFit | null): number {
    const base = fit?.claimRate ?? 1
    const cap = fit?.capGuests ?? 40
    const key = fit ? this.hallKey(fit) : null
    const pop = key
      ? this.hallGuests.filter((g) => !g.preview && !g.dead && g.hallId === key).length
      : this.hallGuests.filter((g) => !g.preview).length
    const crowd = pop > cap ? 1 / (1 + (pop - cap) * 0.08) : 1
    const allow = fit?.bagAllowance ?? 9999
    let bagMul = 1
    if (allow > 0) {
      for (const f of this.flights) {
        if (f.cargo || !f.bagUnits || f.bagUnits <= allow) continue
        bagMul = Math.min(bagMul, allow / f.bagUnits)
      }
    }
    return 12 * base * crowd * bagMul
  }

  /** How many claim carousels a hall offers (inbound scheduling pool). */
  claimLaneCount(fit: TerminalFit | null): number {
    if (!fit) return 1
    return Math.max(1, fit.rooms.bagclaim || (fit.premade ? 1 : 0))
  }

  /**
   * Pick the least-loaded claim carousel, counting live arrivals + banked slots.
   * Only inbound pax need claim planning — cargo / GA skip.
   */
  pickClaimLane(
    excludeFlightId?: string | null,
    excludeSlotId?: string | null,
    fitParam?: TerminalFit | null,
  ): number {
    const fl = excludeFlightId ? this.flights.find((x) => x.id === excludeFlightId) : null
    const fit =
      fitParam ?? (fl?.stand ? this.roomsAt(fl.stand) : null) ?? this.activeHall() ?? this.fits[0] ?? null
    const n = this.claimLaneCount(fit)
    const loads = Array.from({ length: n }, () => 0)
    const sameHall = (other: TerminalFit | null) =>
      !fit || !other || this.hallKey(other) === this.hallKey(fit)
    for (const other of this.flights) {
      if (other.id === excludeFlightId || other.cargo || other.ga || !other.claimLane) continue
      if (other.phase === 'gone' || other.phase === 'takeoff') continue
      const otherFit = other.stand ? this.roomsAt(other.stand) : null
      if (!sameHall(otherFit)) continue
      const i = other.claimLane - 1
      if (i >= 0 && i < n) loads[i] += other.bagUnits ?? other.pax
    }
    for (const s of this.schedule) {
      if (s.id === excludeSlotId || !s.claimLane) continue
      if (s.status !== 'scheduled' && s.status !== 'delayed' && s.status !== 'inbound') continue
      if (this.airline(s.airline).kind === 'cargo') continue
      const sFit = s.standPref ? this.roomsAt(s.standPref) : null
      if (!sameHall(sFit)) continue
      const i = s.claimLane - 1
      if (i >= 0 && i < n) loads[i] += 40
    }
    let best = 0
    for (let i = 1; i < n; i++) if (loads[i] < loads[best]) best = i
    return best + 1
  }

  /**
   * Assign a banked timetable slot its claim lane when the plane is scheduled.
   * Inbound-only — cargo slots stay null.
   */
  assignSlotClaimLane(slot: ScheduleSlot) {
    if (this.airline(slot.airline).kind === 'cargo') {
      slot.claimLane = null
      return
    }
    if (slot.claimLane != null && slot.claimLane > 0) return
    const hall = slot.standPref ? this.roomsAt(slot.standPref) : null
    slot.claimLane = this.pickClaimLane(slot.flightId, slot.id, hall)
  }

  /**
   * Assign an inbound flight to a baggage claim (uses slot plan if already banked).
   * Only arrivals need claim planning — load-balance across carousels.
   */
  assignClaimLane(f: Flight) {
    if (f.cargo || f.ga || (f.craft ?? 'jet') !== 'jet') return
    if (f.claimLane != null && f.claimLane > 0) {
      if (f.bagStage === 'idle' || !f.bagStage) f.bagStage = 'inflight'
      return
    }
    const slot = f.scheduleId
      ? this.schedule.find((s) => s.id === f.scheduleId)
      : null
    if (slot?.claimLane != null && slot.claimLane > 0) {
      f.claimLane = slot.claimLane
    } else {
      f.claimLane = this.pickClaimLane(f.id, slot?.id ?? null)
      if (slot) slot.claimLane = f.claimLane
    }
    if (f.bagStage === 'idle' || !f.bagStage) f.bagStage = 'inflight'
    if (Math.random() < 0.55) {
      this.pushNews(
        `${f.flightNo} → baggage claim ${f.claimLane} (${f.bagUnits ?? 0} bag units).`,
        'ok',
      )
    }
  }

  setBagStage(f: Flight, stage: BagFlowStage) {
    f.bagStage = stage
  }

  /** Deposited bags cover the flight's checked-bag count. */
  private outboundBagsFull(f: Flight): boolean {
    if (f.cargo) return true
    const need = f.bagUnits ?? 0
    if (need <= 0) return true
    return (f.bagsDeposited ?? 0) + 0.51 >= need
  }

  /**
   * A full cart is loaded. A short cart holds the departure until the board
   * window ends, then the missing bags are offloaded instead of counted as loaded.
   * Bag-loaded waits until the bag cart has finished at the belt socket.
   */
  private settleOutboundBags(f: Flight, releasing: boolean): boolean {
    if (f.cargo) return true
    const need = f.bagUnits ?? 0
    if (need <= 0) return true
    if (!this.outboundCartClear(f.id)) {
      f.waitingOn.bagsLoad = true
      f.posted.bagsLoad = false
      return false
    }
    const have = f.bagsDeposited ?? 0
    const book = this.ensureBagBook(f)
    if (this.outboundBagsFull(f)) {
      f.bagsLoaded = have
      f.bagsOffloaded = 0
      book.offloaded = 0
      book.loaded = Math.max(book.loaded, have)
      f.posted.bagsLoad = true
      f.waitingOn.bagsLoad = false
      this.setBagStage(f, 'inflight')
      this.noteOutboundBagFee(f)
      this.markOutboundTags(f)
      return true
    }
    if (!releasing) {
      f.waitingOn.bagsLoad = true
      f.posted.bagsLoad = false
      f.bagsLoaded = have
      book.loaded = have
      if (f.bagStage === 'inflight' || f.bagStage === 'complete') this.setBagStage(f, 'load_aircraft')
      return false
    }
    const short = Math.max(0, need - have)
    const already = f.bagsOffloaded ?? 0
    f.bagsLoaded = have
    f.bagsOffloaded = short
    book.offloaded = short
    book.loaded = have
    f.posted.bagsLoad = false
    f.waitingOn.bagsLoad = false
    if (
      !f.bagStage ||
      f.bagStage === 'idle' ||
      f.bagStage === 'pax_deposit' ||
      f.bagStage === 'hold_screen' ||
      f.bagStage === 'inflight' ||
      f.bagStage === 'complete'
    ) {
      this.setBagStage(f, 'load_aircraft')
    }
    this.noteOutboundBagFee(f)
    this.markOutboundTags(f)
    if (already + 0.51 < short) {
      this.adjustHeat(f.airline, -1.6)
      this.pushNews(
        `${f.flightNo} left ${Math.round(short)} bags behind — offloaded, not loaded.`,
        'bad',
      )
    }
    return true
  }

  /** Bag handling for an unloaded passenger flight. */
  private postInboundBagFee(f: Flight, airline: Airline) {
    // GA owners carry their own bags: no handling service is sold, so skip the $0 earn on purpose.
    if (f.airline === 'ga') return
    const units = f.bagUnits ?? estimateFlightBagUnits(airline.persona, f.pax)
    const mult = clamp(0.75 + units / 180, 0.75, 1.55)
    this.earn(
      this.contractBill(f, this.listed(Math.round(airline.bags * mult), 'bagsPerBag'), 'service', 'bags'),
      `${f.flightNo} bag handling`,
      f,
      'baggage_fees',
    )
  }

  private noteOutboundBagFee(f: Flight) {
    if (f.cargo) return
    // GA owners carry their own bags: no handling service is sold, so there is no bag fee to book.
    if (f.airline === 'ga') return
    if (f.ledger.some((line) => line.label.includes('outbound bags'))) return
    const airline = this.airline(f.airline)
    const need = f.bagUnits ?? 0
    const have = f.bagsDeposited ?? 0
    const frac = need > 0 ? Math.min(1, have / need) : 1
    const amount = Math.round(airline.bags * 0.55 * frac)
    if (amount > 0) this.earn(amount, `${f.flightNo} outbound bags`, f)
  }

  /** Tags exist only for bags a passenger actually dropped. */
  private markOutboundTags(f: Flight) {
    for (const tag of this.bagTags) {
      if (tag.kind === 'out' && tag.flightId === f.id && !tag.fault) tag.loaded = true
    }
  }

  bagBook(id: string): BagBook | undefined {
    return this.bagBooks.get(id)
  }

  private ensureBagBook(f: Flight): BagBook {
    let book = this.bagBooks.get(f.id)
    if (!book) {
      book = freshBook(f.id, f.bagUnits ?? 0)
      this.bagBooks.set(f.id, book)
    }
    if ((f.bagUnits ?? 0) > book.units) book.units = f.bagUnits ?? 0
    return book
  }

  private noteBagDrop(f: Flight, units: number, ownerId?: string, paxTag?: PaxTag) {
    const book = this.ensureBagBook(f)
    book.dropped += units
    book.units = Math.max(book.units, f.bagUnits ?? 0, book.dropped)
    f.bagsDeposited = book.dropped
    if ((f.bagUnits ?? 0) < book.units) f.bagUnits = book.units
    if (ownerId && paxTag) this.issueBagTags(ownerId, f.id, paxTag, null, 'out')
  }

  /** Checked-bag records for one passenger. */
  bagTagsFor(ownerId: string): BagTag[] {
    return this.bagTags.filter((t) => t.ownerPassengerId === ownerId)
  }

  /** Bags sitting on the lost-bag desk. Capped so the picture stays a handful of meshes. */
  bagDeskPile(): number {
    return Math.min(
      4,
      this.bagTags.filter((t) => t.fault && !t.picked).length,
    )
  }

  private issueBagTags(
    ownerId: string,
    flightId: string,
    paxTag: PaxTag,
    connectFlightId: string | null,
    kind: BagTag['kind'],
  ) {
    if (this.bagTags.some((t) => t.ownerPassengerId === ownerId && t.kind === kind)) return
    const pieces = checkedPieceCount(paxTag)
    for (let i = 0; i < pieces; i++) {
      this.bagTags.push(makeBagTag(ownerId, flightId, i, connectFlightId, kind))
    }
  }

  /** Onward flight still on the ground, or an open connection id. */
  private pickConnectFlight(airlineId: AirlineId): string {
    const airlines = new Set<string>([airlineId])
    if (this.specMods().interline) {
      for (const id of this.signed) {
        if (this.airline(id).kind === 'pax') airlines.add(id)
      }
    }
    const onward = this.flights.find(
      (f) => airlines.has(f.airline) && !f.cargo && !this.connectionClosed(f),
    )
    return onward?.id ?? `connect:${airlineId}`
  }

  /**
   * A departure has left the connection window.
   * Slack from the hub tree keeps pushback, then taxi, inside the window.
   */
  private connectionClosed(f: Flight): boolean {
    if (f.phase === 'gone' || f.phase === 'takeoff') return true
    const slack = this.specMods().connectSlackSec
    if (f.phase === 'taxi_out') return slack < 16
    if (f.phase === 'pushback') return slack < 8
    return false
  }

  private flightDeparted(id: string): boolean {
    if (id.startsWith('connect:')) return false
    const f = this.flights.find((x) => x.id === id)
    if (!f) return true
    return this.connectionClosed(f)
  }

  private bagClock() {
    const prefab = this.fits.some((f) => f.premade && !f.redesigned)
    return {
      prefab,
      normal: !this.hallOverloaded,
      departed: (id: string) => this.flightDeparted(id),
      stage: (id: string) => this.flights.find((f) => f.id === id)?.bagStage,
    }
  }

  private pickUpOwnBags(g: HallGuest, fl: Flight) {
    let pieces = 0
    for (const tag of this.bagTags) {
      if (tag.ownerPassengerId !== g.id || tag.kind !== 'in') continue
      tag.onClaim = true
      tag.picked = true
      pieces += 1
    }
    const book = this.ensureBagBook(fl)
    const cap = Math.max(book.units, book.dropped, pieces, 1)
    book.claimed = Math.min(cap, book.claimed + Math.max(1, pieces))
  }

  private mishandleGuest(ownerId: string, fault: 'late' | 'missed_connection') {
    const g = this.hallGuests.find((x) => x.id === ownerId && !x.dead)
    if (!g || g.bagFault) return
    g.bagFault = fault
    g.atBagDesk = true
    g.deskTime = 0
    g.happiness = Math.max(0, g.happiness - 8)
    if (fault === 'missed_connection' && g.airlineId) {
      const extra = this.specMods().missHeat - 1
      if (extra > 0) this.adjustHeat(g.airlineId, -2.2 * extra)
    }
    g.node = 'claim'
    g.path = []
    g.seg = 0
    g.t = 0
    g.thought =
      fault === 'missed_connection'
        ? 'Lost-bag desk — my bag missed the connection'
        : 'Lost-bag desk — my bag is late'
    if (fault === 'missed_connection') {
      const airlineId = this.flights.find((f) => f.id === g.flightId)?.airline
      if (airlineId) this.missedByAirline[airlineId] = (this.missedByAirline[airlineId] ?? 0) + 1
    }
  }

  /** Teaching halls never lose a bag. A redesigned hall can. */
  prefabFlight(f: Flight): boolean {
    const fit = (f.stand && this.roomsAt(f.stand)) || this.activeHall() || this.fits[0]
    return Boolean(fit?.premade && !fit.redesigned)
  }

  /** A bag building or any belt tile can screen hold bags. */
  bagHallReady(): boolean {
    return tilesOf(this.tiles, 'bags').length > 0 || hasBeltNetwork(this.tiles)
  }

  luggageMotion(): LuggageMotion {
    if (this.bagShow) return { ...this.bagShow, phase: this.bagPhase }
    let belt = false
    let screen = false
    let carousel = false
    let sort = false
    for (const f of this.flights) {
      if (f.cargo || f.phase === 'gone') continue
      const stage = f.bagStage
      if (
        stage === 'pax_deposit' ||
        stage === 'hold_screen' ||
        stage === 'outbound_sort' ||
        stage === 'inbound_sort' ||
        stage === 'deliver_claim'
      ) {
        belt = true
      }
      if (stage === 'pax_deposit' || stage === 'hold_screen') screen = true
      if (
        stage === 'outbound_sort' ||
        stage === 'inbound_sort' ||
        stage === 'load_aircraft' ||
        stage === 'unload_aircraft'
      ) {
        sort = true
      }
      if (stage === 'deliver_claim' || stage === 'on_claim' || stage === 'complete') {
        carousel = true
      }
    }
    return { belt, screen, carousel, sort, phase: this.bagPhase }
  }

  private tickLuggage(dt: number) {
    this.bagPhase = (this.bagPhase + dt * 0.35) % 1
    for (const f of this.flights) {
      if (f.cargo || f.phase === 'gone' || f.craft === 'helo') continue
      if (!f.bagStage && !(f.bagUnits && f.bagUnits > 0) && !(f.bagsDeposited && f.bagsDeposited > 0)) {
        continue
      }
      const book = this.ensureBagBook(f)
      if ((f.bagsDeposited ?? 0) > book.dropped) {
        book.dropped = f.bagsDeposited ?? 0
        book.units = Math.max(book.units, book.dropped)
      }
      const prefab = this.prefabFlight(f)
      if (f.bagStage === 'hold_screen') {
        const before = book.lost
        const result = advanceScreen(book, dt, { prefab, hallReady: this.bagHallReady() })
        if (result === 'pass') this.setBagStage(f, 'outbound_sort')
        else if (result === 'lose') {
          if (!prefab) this.bagsLost += book.lost - before
          this.setBagStage(f, 'outbound_sort')
        }
      }
      if (prefab) keepPrefabBags(book, f.bagStage)
    }
    const clock = this.bagClock()
    const fresh = advanceBagTags(this.bagTags, dt, clock)
    if (fresh > 0) {
      this.bagsMishandled += fresh
      for (const tag of this.bagTags) {
        if (tag.fault) this.mishandleGuest(tag.ownerPassengerId, tag.fault)
      }
    }
    this.bagTags = this.bagTags.filter((tag) => {
      const owner = this.hallGuests.find((g) => g.id === tag.ownerPassengerId)
      if (owner?.dead) {
        this.bagReleaseAt.delete(tag.id)
        return false
      }
      const flight = this.flights.find((item) => item.id === tag.flightId)
      const connect = tag.connectFlightId
        ? this.flights.find((item) => item.id === tag.connectFlightId)
        : undefined
      const live =
        owner != null ||
        (flight != null && flight.phase !== 'gone') ||
        (connect != null && connect.phase !== 'gone')
      if (live) {
        this.bagReleaseAt.delete(tag.id)
        return true
      }
      let until = this.bagReleaseAt.get(tag.id)
      if (until == null) {
        until = this.clock + BAG_RECORD_SEC
        this.bagReleaseAt.set(tag.id, until)
      }
      if (this.clock < until) return true
      this.bagReleaseAt.delete(tag.id)
      return false
    })
  }

  /** Seconds of visible load/unload/process work from bag units. */
  /** Pax, bags, and arrival fuel from the airframe's published-ish figures. */
  flightLoad(
    af: (typeof AIRFRAMES)[string],
    persona: 'budget' | 'business' | 'luxury' | 'cargo_night' | 'military_gov',
    cargo: boolean,
  ): { pax: number; bagUnits: number; fuelLevel: number } {
    const freighter = cargo || af.kind === 'freighter'
    const basePax = freighter ? 0 : paxForAirframe(af)
    const factor = passengerFactor(this.mapId, this.gameDay())
    const pax = freighter
      ? 0
      : Math.max(af.paxMin, Math.min(af.paxMax, Math.round(basePax * this.tycoonDemand() * factor)))
    const bagUnits = freighter
      ? 0
      : bagUnitsForAirframe(af, estimateFlightBagUnits(persona, pax))
    return { pax, bagUnits, fuelLevel: 0.28 + Math.random() * 0.18 }
  }

  /** Off-map start so the jet flies the approach instead of popping onto the strip. */
  armApproach(route: Vec[]): { x: number; y: number; z: number; path: Vec[] } {
    const path = inboundApproach(route)
    const start = path[0] ?? route[0]
    return { x: start.c, y: start.r, z: 16, path }
  }

  bagWorkSeconds(f: Flight, kind: 'ramp' | 'sort' | 'deposit'): number {
    const u = f.bagUnits ?? estimateFlightBagUnits(this.airline(f.airline).persona, f.pax)
    return bagWorkDuration(u, kind)
  }

  bagStageLabel(f: Flight): string {
    return describeBagStage(f.bagStage, f.claimLane, f.bagsDeposited, f.bagUnits)
  }

  /** Warehouse fill 0–1 for HUD. */
  cargoWarehouseFill(): number {
    return clamp(this.cargoWarehouse / this.cargoWarehouseCap(), 0, 1.2)
  }

  /** Road cells on the map edge — city truck spawn points. */
  cityEdgeRoads(): Vec[] {
    const out: Vec[] = []
    for (let c = 0; c < SIZE; c++) {
      if (this.tiles[0][c] === 'road') out.push({ c, r: 0 })
      if (this.tiles[SIZE - 1][c] === 'road') out.push({ c, r: SIZE - 1 })
    }
    for (let r = 1; r < SIZE - 1; r++) {
      if (this.tiles[r][0] === 'road') out.push({ c: 0, r })
      if (this.tiles[r][SIZE - 1] === 'road') out.push({ c: SIZE - 1, r })
    }
    return out
  }

  /**
   * Living logistics: city cargo trucks spawn off-map → guard → shed.
   * Missing / thin guard = queue, deny, or On-time nick.
   */
  tickCityCargo(dt: number) {
    this.cityCargoCool = Math.max(0, this.cityCargoCool - dt)
    const sheds = tilesOf(this.tiles, 'cargo')
    if (!sheds.length) return
    const edges = this.cityEdgeRoads()
    if (!edges.length) return

    const live = this.trucks.filter((t) => t.kind === 'citycargo').length
    const guards = tilesOf(this.tiles, 'guard')
    const maxLive = Math.max(1, 1 + guards.length)
    if (live >= maxLive) return
    if (this.cityCargoCool > 0) return
    // Demand: cargo signed, warehouse room, or a freighter inbound/on stand.
    const cargoSigned = this.signed.some((id) => this.airline(id).kind === 'cargo')
    const freighterBusy = this.flights.some(
      (f) =>
        f.cargo &&
        f.phase !== 'gone' &&
        f.phase !== 'takeoff' &&
        f.phase !== 'hold',
    )
    const wantStock = this.cargoWarehouse < this.cargoWarehouseCap() * 0.85
    if (!cargoSigned && !freighterBusy && !wantStock) return
    if (!wantStock && !freighterBusy) return

    // No guard — rare sneak-through with incident, else deny at the edge.
    if (!guards.length) {
      this.cityCargoCool = 14 + Math.random() * 10
      if (Math.random() < 0.45) {
        this.securityIncidents += 1
        for (const id of this.signed) {
          if (this.airline(id).kind === 'cargo') this.adjustHeat(id, -2.2)
        }
        this.pushNews(
          'City cargo truck denied — no guard post on the road. On-time dips; stamp a Guard.',
          'bad',
        )
      } else if (Math.random() < 0.35) {
        // Sneak in without screen — short path straight to shed, incident risk.
        const edge = pick(edges)
        const path = nearestPath(this.tiles, edge, sheds, 'truck')
        if (path && path.length > 1) {
          this.trucks.push({
            id: uid('city'),
            kind: 'citycargo',
            flightId: null,
            x: edge.c,
            y: edge.r,
            path,
            seg: 0,
            t: 0,
            returning: false,
            dwell: 0,
            preDwell: 0,
            patrol: false,
            mission: 'city_shed',
            home: sheds[0],
            cargoUnits: this.rivalCargoUnits(10 + Math.floor(Math.random() * 14)),
          })
          this.securityIncidents += 1
          this.pushNews(
            'Unscreened city truck rolled to the shed — security nick. Build a Guard post.',
            'bad',
          )
        }
      }
      return
    }

    const edge = pick(edges)
    const guard = guards[0]
    const toGuard = nearestPath(this.tiles, edge, [guard], 'truck')
    if (!toGuard || toGuard.length < 2) {
      this.cityCargoCool = 8
      return
    }
    // Queue pressure when many trucks + one post.
    const queue = this.trucks.filter(
      (t) => t.kind === 'citycargo' && t.mission === 'city_guard',
    ).length
    const units = this.rivalCargoUnits(12 + Math.floor(Math.random() * 16))
    this.trucks.push({
      id: uid('city'),
      kind: 'citycargo',
      flightId: null,
      x: edge.c,
      y: edge.r,
      path: toGuard,
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: queue > 0 ? 0.8 + queue * 0.7 : 0,
      patrol: false,
      mission: 'city_guard',
      home: sheds[0],
      cargoUnits: units,
    })
    this.cityCargoCool = 9 + Math.random() * 8 + queue * 3
    if (Math.random() < 0.4) {
      this.pushNews(
        `City cargo truck inbound — ${units} units via guard → shed.`,
        'ok',
      )
    }
  }

  finishCityCargo(t: Truck) {
    if (t.kind !== 'citycargo') return
    if (t.mission === 'city_guard') {
      // Screened — roll to shed.
      const sheds = tilesOf(this.tiles, 'cargo')
      const from = { c: Math.round(t.x), r: Math.round(t.y) }
      const path = sheds.length
        ? nearestPath(this.tiles, from, sheds, 'truck')
        : null
      if (path && path.length > 1) {
        t.mission = 'city_shed'
        t.path = path
        t.seg = 0
        t.t = 0
        t.returning = false
        t.dwell = 0
        t.home = sheds[0]
      } else {
        t.dwell = -99
      }
      return
    }
    if (t.mission === 'city_shed') {
      const units = t.cargoUnits ?? 12
      const room = Math.max(0, this.cargoWarehouseCap() - this.cargoWarehouse)
      const accepted = Math.min(units, room)
      this.cargoWarehouse += accepted
      if (accepted > 0) {
        this.earn(
          Math.round(CARGO_INTAKE_FEE * (0.7 + accepted / 28)),
          `City cargo intake (${accepted}u)`,
        )
        this.creditCargoVolume(accepted)
      }
      if (accepted < units) {
        this.pushNews(
          `Warehouse full — ${units - accepted}u turned away. Expand capacity or uplift sooner.`,
          'bad',
        )
        for (const id of this.signed) {
          if (this.airline(id).kind === 'cargo') this.adjustHeat(id, -1.2)
        }
      } else if (Math.random() < 0.5) {
        this.pushNews(
          `Warehouse ${Math.round(this.cargoWarehouseFill() * 100)}% — ${accepted}u staged for freighters.`,
          'ok',
        )
      }
      t.cargoUnits = 0
      // Depart back to city edge.
      const edges = this.cityEdgeRoads()
      const from = { c: Math.round(t.x), r: Math.round(t.y) }
      const leave = edges.length
        ? nearestPath(this.tiles, from, edges, 'truck')
        : null
      if (leave && leave.length > 1) {
        t.mission = 'city_depart'
        t.path = leave
        t.seg = 0
        t.t = 0
        t.returning = true
        t.dwell = 0
      } else {
        t.dwell = -99
      }
      return
    }
    if (t.mission === 'city_depart') {
      t.dwell = -99
    }
  }

  hallOpen(): Set<HallNode> {
    return this.hallOpenFor(this.activeHall())
  }

  /** Open graph for a guest's home hall (falls back to active / first). */
  openForGuest(g: HallGuest): Set<HallNode> {
    const fit = this.fitByKey(g.hallId) ?? this.activeHall() ?? this.fits[0] ?? null
    const open = this.hallOpenFor(fit)
    return g.transfer ? openForTransfer(open) : open
  }

  /**
   * Nearest hall within jetway range of a jetway-equipped stand.
   * Remote bays never auto-link — they need terminal buses or walking pax.
   */
  jetwayHall(stand: Vec | null): TerminalFit | null {
    if (!stand || !this.fits.length) return null
    if (this.standAccessAt(stand) !== 'jetway') return null
    let best: TerminalFit | null = null
    let bestD = JETWAY_RANGE + 1
    for (const f of this.fits) {
      const d = Math.abs(f.origin.c - stand.c) + Math.abs(f.origin.r - stand.r)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
    return bestD <= JETWAY_RANGE ? best : null
  }

  standsForHall(fit: TerminalFit): Vec[] {
    return tilesOf(this.tiles, 'stand').filter((s) => {
      const h = this.jetwayHall(s)
      return h != null && h.origin.c === fit.origin.c && h.origin.r === fit.origin.r
    })
  }

  jetwayCount(): number {
    return tilesOf(this.tiles, 'stand').filter((s) => this.jetwayHall(s)).length
  }

  occupiedAtHall(fit: TerminalFit): number {
    const keys = new Set(this.standsForHall(fit).map((s) => `${s.c},${s.r}`))
    return this.flights.filter(
      (f) =>
        (f.craft ?? 'jet') === 'jet' &&
        f.stand &&
        keys.has(`${f.stand.c},${f.stand.r}`) &&
        f.phase !== 'gone' &&
        f.phase !== 'takeoff',
    ).length
  }

  campusLine(): string {
    if (!this.fits.length) return 'No terminal'
    const halls = this.fits.map((f) => this.hallLabel(f)).join(' · ')
    const jw = this.jetwayCount()
    const remote = tilesOf(this.tiles, 'stand').length - jw
    return `${this.fits.length} hall${this.fits.length > 1 ? 's' : ''} (${halls}) · ${jw} jetway${jw === 1 ? '' : 's'}${remote > 0 ? ` · ${remote} remote` : ''}`
  }

  /** A departing passenger has reached the doors and can walk to check-in. */
  private openDepartingGuest(g: HallGuest, open: Set<HallNode>) {
    g.node = 'entrance'
    g.clearedSec = false
    if (open.has('checkin')) this.routeGuest(g, 'checkin', open)
    else if (open.has('security')) this.routeGuest(g, 'security', open)
    else g.thought = 'No security lane — stuck before security'
    if (g.thought !== 'No security lane — stuck before security') {
      g.thought = g.usedPremiumCheckin ? 'Premium check-in' : 'Rolling a bag to check-in'
    }
    this.notePremiumDesk(g)
  }

  /** Focus a campus hall (from HUD chips or pan-click). */
  selectHall(fit: TerminalFit) {
    this.selectedTile = { ...fit.origin }
    this.setView('hall')
  }

  /** Hall bodies one flight seeds. Jetway turns are quick — more bodies linger and spend. Walkers are rushed. */
  private hallBodyCount(f: Flight): number {
    const mode = this.standPaxMode(f.stand)
    return Math.max(
      6,
      Math.min(18, Math.round(f.pax / (mode === 'jetway' ? 5.5 : mode === 'bus' ? 6.5 : 7.5))),
    )
  }

  seedHallForFlight(f: Flight, job: 'depart' | 'arrive') {
    if (f.cargo || !this.fits.length) return
    const fit = this.roomsAt(f.stand) ?? this.activeHall() ?? this.fits[0]
    if (!fit) return
    const open = this.hallOpenFor(fit)
    if (!open.size) return
    const hallId = this.hallKey(fit)
    const mode = this.standPaxMode(f.stand)
    const count = this.hallBodyCount(f)
    const a = this.airline(f.airline)
    const departWave: HallGuest[] = []
    const arrivals: HallGuest[] = []
    for (let i = 0; i < count; i++) {
      const tag: PaxTag = rollPaxTag(a.persona)
      const g = spawnHallGuest(f.id, job, tag, { airlineId: f.airline, hallId })
      g.serviceCabin = cabinFromGuest(tag, a.persona, g.id)
      const modes = this.pickGuestMode(tag, a.persona, job)
      g.preferMode = modes.prefer
      g.arriveMode = modes.actual
      // Heavy bags = more claim work (premium/family); budgets travel light.
      if (job === 'arrive') {
        g.needs.bags = Math.min(99, 40 + bagUnitsForTag(tag) * 22)
      }
      if (mode === 'jetway') {
        g.needs.boarding = Math.min(99, g.needs.boarding + 18)
        g.needs.shop = Math.min(99, g.needs.shop + 14)
        g.needs.play = Math.min(99, g.needs.play + 10)
        g.needs.hunger = Math.min(99, g.needs.hunger + 8)
      } else if (mode === 'walk') {
        g.needs.boarding = Math.max(6, g.needs.boarding - 14)
      } else if (mode === 'bus') {
        g.needs.boarding = Math.min(99, g.needs.boarding + 6)
        g.needs.shop = Math.min(99, g.needs.shop + 6)
      }
      // Kick them onto a clear first leg so you see the flow immediately.
      if (job === 'arrive') {
        g.node = 'gate'
        g.thought =
          mode === 'jetway'
            ? 'Jetway in — time to spend before bags'
            : mode === 'bus'
              ? 'Bus from the remote stand — into the hall'
              : 'Long walk from the stand — need bags'
        if (open.has('claim')) this.routeGuest(g, 'claim', open)
        else if (open.has('exit')) this.routeGuest(g, 'exit', open)
        g.hasChecked = false
        g.carryOn = true
        arrivals.push(g)
      } else {
        g.node = 'entrance'
        g.clearedSec = false
        g.hasChecked = true
        g.carryOn = true
        this.applyGuestLandside(g, 'depart')
        departWave.push(g)
      }
      this.hallGuests.push(g)
    }
    if (arrivals.length) this.noteHubArrivals(f, arrivals)
    if (departWave.length) this.releaseDepartureWave(departWave, f, open)
  }

  /** Fallback wave (boarding with no banked plan, or a direct seed). Drips — never a single dump. */
  private releaseDepartureWave(wave: HallGuest[], f: Flight, open: Set<HallNode>) {
    const std = f.std ?? this.clock + PLANNED_TURN_SEC
    const intl = isIntlKind(f.kind)
    const fit = (f.stand ? this.roomsAt(f.stand) : null) ?? this.activeHall() ?? this.fits[0] ?? null
    const persona = this.airline(f.airline).persona
    const hallId = fit ? this.hallKey(fit) : ''
    const drawn = this.composeDeparture(wave.length, std, intl, persona, fit, hallId)
    wave.forEach((g, i) => {
      const tag = drawn.tags[i]
      const seat = drawn.seats[i]
      if (tag) g.tag = tag
      if (seat) this.paintShowUp(g, seat)
      const at = drawn.releases[i] ?? this.clock
      if (at <= this.clock + 0.001) this.openDepartingGuest(g, open)
      else {
        g.releaseAt = at
        g.path = []
        g.seg = 0
        g.t = 0
        g.thought = 'On the way to the doors'
      }
    })
  }

  /** Lounge quality, an open fast-track, and how business-heavy this carrier is. */
  private showUpFactsFor(fit: TerminalFit | null, intl: boolean, persona: string): ShowUpFacts {
    const rooms = Math.max(0, fit?.rooms.lounge ?? 0)
    return {
      loungeQuality: Math.min(1, rooms * LOUNGE_QUALITY_PER_ROOM),
      fastTrackAvailable: this.fastTrackOpen(fit),
      intl,
      businessMix: businessMixForPersona(persona),
    }
  }

  /**
   * Premium fast-track when that module is on the sim and a lane is built.
   * Otherwise any open security lane is the fast-track.
   */
  private fastTrackOpen(fit: TerminalFit | null): boolean {
    const built = this.premium?.built
    if (Array.isArray(built) && built.some((b) => String(b.itemId ?? '').startsWith('fast_track'))) {
      return true
    }
    if (!fit) return false
    const lane = laneStats({
      premade: fit.premade ?? false,
      redesigned: fit.redesigned,
      tier: fit.tier,
      items: (fit.items ?? []) as PlacedItem[],
      roomsSecurity: fit.rooms.security ?? 0,
    })
    return lane.servers > 0
  }

  /** Draw a wave from the show-up adapter and snap the leads onto the entrance cap. */
  private composeDeparture(
    count: number,
    std: number,
    intl: boolean,
    persona: string,
    fit: TerminalFit | null,
    hallId: string,
    exceptSlot?: string,
  ): { tags: ShowTag[]; releases: number[]; seats: ShowUpSeat[] } {
    this.paxAdapter.setFacts(this.showUpFactsFor(fit, intl, persona))
    const profiles = this.paxAdapter.sample(count)
    const stamps = profiles.map((p) => stampDeparture(p, std))
    const tags = stamps.map((s) => s.walletTag)
    const seats: ShowUpSeat[] = stamps.map((s, i) => ({
      segment: s.segment,
      preferFastTrack: s.preferFastTrack,
      amenity: s.amenity,
      leadSimSec: profiles[i]?.leadSimSec ?? 0,
      spendLounge: s.spend.lounge,
      spendAmenity: s.spend.amenity,
      willLounge: s.willingness.lounge,
      willAmenity: s.willingness.amenity,
      moodArrive: s.mood.onArrival,
      moodFast: s.mood.onFastTrack,
      moodStandard: s.mood.onStandardQueue,
      moodLounge: s.mood.onLoungeVisit,
      moodMiss: s.mood.onLoungeMiss,
      intlApplied: intl,
    }))
    const releases = planShowUp({
      std,
      now: this.clock,
      tags,
      intl,
      taken: this.entranceReleaseTimes(hallId, exceptSlot),
      desired: stamps.map((s) => s.releaseAt),
    })
    return this.orderDeparture(tags, releases, seats)
  }

  /** Keep tag, release, and seat aligned, earliest release first. */
  private orderDeparture(
    tags: ShowTag[],
    releases: number[],
    seats: ShowUpSeat[],
  ): { tags: ShowTag[]; releases: number[]; seats: ShowUpSeat[] } {
    const order = releases.map((_, i) => i).sort((a, b) => releases[a] - releases[b] || a - b)
    return {
      tags: order.map((i) => tags[i]),
      releases: order.map((i) => releases[i]),
      seats: order.map((i) => seats[i]),
    }
  }

  /** Move unreleased bodies when STD shifts, using the lead they were stamped with. */
  private restampRemaining(plan: ShowUpPlan) {
    if (!plan.seats || plan.seats.length !== plan.tags.length) return
    if (plan.spawned >= plan.tags.length) return
    const seats = plan.seats.slice(plan.spawned)
    const tags = plan.tags.slice(plan.spawned)
    const desired = seats.map((s) => plan.std - s.leadSimSec)
    const fresh = planShowUp({
      std: plan.std,
      now: this.clock,
      tags,
      intl: plan.intl,
      taken: this.entranceReleaseTimes(plan.hallId, plan.slotId),
      desired,
    })
    const ordered = this.orderDeparture(tags, fresh, seats)
    plan.tags = [...plan.tags.slice(0, plan.spawned), ...ordered.tags]
    plan.releases = [...plan.releases.slice(0, plan.spawned), ...ordered.releases]
    plan.seats = [...plan.seats.slice(0, plan.spawned), ...ordered.seats]
  }

  /** Wide-body banks show a little earlier. Applied once per unreleased seat. */
  private applyIntlLead(plan: ShowUpPlan) {
    if (!plan.intl || !plan.seats) return
    const cap = SHOWUP_LEAD_GAME_MIN / GAME_MINUTES_PER_SIM_SECOND
    let changed = false
    for (let i = plan.spawned; i < plan.seats.length; i++) {
      const seat = plan.seats[i]
      if (!seat || seat.intlApplied) continue
      const extraMin = SHOWUP_WINDOWS[seat.segment].intlExtra
      seat.leadSimSec = Math.min(cap, seat.leadSimSec + extraMin / GAME_MINUTES_PER_SIM_SECOND)
      seat.intlApplied = true
      changed = true
    }
    if (changed) this.restampRemaining(plan)
  }

  private paintShowUp(g: HallGuest, seat: ShowUpSeat) {
    g.showUp = seat
    g.happiness = Math.max(0, Math.min(100, g.happiness + seat.moodArrive))
    if (seat.segment === 'lounge_lover') {
      g.needs.energy = Math.max(g.needs.energy, 72)
      g.needs.shop = Math.max(g.needs.shop, 74)
      g.needs.boarding = Math.max(g.needs.boarding, 58)
      g.prefs.lounge = Math.max(g.prefs.lounge, 0.92)
      g.prefs.shop = Math.max(g.prefs.shop, 0.88)
      const bill = Math.max(0, seat.spendLounge) + Math.max(0, seat.spendAmenity)
      const floor = Math.ceil(bill / 0.75) + 12
      if (g.wallet < floor) g.wallet = floor
    } else if (seat.segment === 'road_warrior') {
      g.needs.hunger = Math.min(g.needs.hunger, 28)
      g.prefs.lounge = Math.min(g.prefs.lounge, 0.15)
    }
  }

  /** The jet has pushed. A body that has not reached the gate is a miss, not a lost passenger. */
  private planFlightGone(plan: ShowUpPlan): boolean {
    if (!plan.flightId) return false
    const f = this.flights.find((x) => x.id === plan.flightId)
    if (!f) return this.departedFlights.has(plan.flightId)
    return f.phase === 'pushback' || f.phase === 'taxi_out' || f.phase === 'takeoff' || f.phase === 'gone'
  }

  private noteCleanMiss(plan: ShowUpPlan) {
    this.missedFlights += 1
    this.hallMissNews(
      `late-${plan.slotId}`,
      `Late passenger on ${plan.slotId.slice(0, 12)} — the flight had left.`,
    )
  }

  private visualDepartureCount(f: Flight): number {
    const mode = this.standPaxMode(f.stand)
    return Math.max(
      6,
      Math.min(18, Math.round(f.pax / (mode === 'jetway' ? 5.5 : mode === 'bus' ? 6.5 : 7.5))),
    )
  }

  private entranceReleaseTimes(hallId: string, exceptSlot?: string): number[] {
    const out: number[] = []
    for (const plan of this.showUps) {
      if (plan.closed || plan.hallId !== hallId || plan.slotId === exceptSlot) continue
      for (let i = plan.spawned; i < plan.releases.length; i++) out.push(plan.releases[i])
    }
    return out
  }

  /** Bank a show-up when the slot is written, so the hall fills before approach. */
  private noteSlotBanked(slot: ScheduleSlot) {
    const a = this.airline(slot.airline)
    if (a.kind === 'cargo') return
    const fit = this.activeHall() ?? this.fits[0]
    if (!fit) return
    const std = slot.eta + PLANNED_TURN_SEC
    const hallId = this.hallKey(fit)
    const drawn = this.composeDeparture(12, std, false, a.persona, fit, hallId)
    this.showUps.push({
      slotId: slot.id,
      std,
      hallId,
      airlineId: slot.airline,
      intl: false,
      tags: drawn.tags,
      releases: drawn.releases,
      seats: drawn.seats,
      spawned: 0,
      flightId: null,
      closed: false,
    })
  }

  private planForGuest(g: HallGuest): ShowUpPlan | undefined {
    if (g.flightId.startsWith('slot:')) {
      const id = g.flightId.slice('slot:'.length)
      return this.showUps.find((p) => p.slotId === id)
    }
    return this.showUps.find((p) => p.flightId != null && p.flightId === g.flightId)
  }

  private linkedFlight(g: HallGuest): Flight | undefined {
    if (g.flightId.startsWith('slot:')) {
      const id = g.flightId.slice('slot:'.length)
      const slot = this.schedule.find((s) => s.id === id)
      if (slot?.flightId) return this.flights.find((f) => f.id === slot.flightId)
      return undefined
    }
    return this.flights.find((f) => f.id === g.flightId)
  }

  private phaseIsBoarding(phase: Phase): boolean {
    return (
      phase === 'board' ||
      phase === 'pushback' ||
      phase === 'taxi_out' ||
      phase === 'takeoff' ||
      phase === 'gone'
    )
  }

  /** Patience runs once the aircraft is boarding. A slot that has not spawned yet does not burn it. */
  private departureClockRunning(g: HallGuest): boolean {
    if (g.flightId.startsWith('slot:')) {
      const f = this.linkedFlight(g)
      return Boolean(f && this.phaseIsBoarding(f.phase))
    }
    const f = this.linkedFlight(g)
    if (!f) return true
    return this.phaseIsBoarding(f.phase)
  }

  private flightBoardingCall(g: HallGuest): boolean {
    const f = this.linkedFlight(g)
    if (f) return this.phaseIsBoarding(f.phase)
    return this.departedFlights.has(g.flightId)
  }

  private checkInOpen(g: HallGuest): boolean {
    const plan = this.planForGuest(g)
    if (!plan) return true
    return this.clock < checkInCloseAt(plan.std, plan.intl)
  }

  private tuneDepartureGuest(g: HallGuest, f: Flight) {
    const mode = this.standPaxMode(f.stand)
    if (mode === 'jetway') {
      g.needs.boarding = Math.min(99, g.needs.boarding + 18)
      g.needs.shop = Math.min(99, g.needs.shop + 14)
      g.needs.play = Math.min(99, g.needs.play + 10)
      g.needs.hunger = Math.min(99, g.needs.hunger + 8)
    } else if (mode === 'walk') {
      g.needs.boarding = Math.max(6, g.needs.boarding - 14)
    } else if (mode === 'bus') {
      g.needs.boarding = Math.min(99, g.needs.boarding + 6)
      g.needs.shop = Math.min(99, g.needs.shop + 6)
    }
  }

  private spawnShowUpGuest(plan: ShowUpPlan, open: Set<HallNode>) {
    if (this.planFlightGone(plan)) {
      this.noteCleanMiss(plan)
      return
    }
    const tag = plan.tags[plan.spawned] ?? 'budget'
    const flightId = plan.flightId ?? `slot:${plan.slotId}`
    const g = spawnHallGuest(flightId, 'depart', tag, {
      airlineId: plan.airlineId,
      hallId: plan.hallId,
    })
    const seat = plan.seats?.[plan.spawned]
    if (seat) this.paintShowUp(g, seat)
    const persona = this.airline(plan.airlineId as AirlineId).persona
    g.serviceCabin = cabinFromGuest(tag, persona, g.id)
    const modes = this.pickGuestMode(tag, persona, 'depart')
    g.preferMode = modes.prefer
    g.arriveMode = modes.actual
    g.node = 'entrance'
    g.clearedSec = false
    g.hasChecked = true
    g.carryOn = true
    if (plan.flightId) {
      const flight = this.flights.find((f) => f.id === plan.flightId)
      if (flight) this.tuneDepartureGuest(g, flight)
    }
    this.applyGuestLandside(g, 'depart')
    if (open.size) this.openDepartingGuest(g, open)
    else g.thought = 'On the way to the doors'
    this.hallGuests.push(g)
  }

  private retargetShowUp(plan: ShowUpPlan, std: number) {
    if (Math.abs(std - plan.std) < 0.05) return
    plan.std = std
    const flight = plan.flightId ? this.flights.find((f) => f.id === plan.flightId) : undefined
    if (flight) flight.std = std
    if (plan.spawned >= plan.tags.length) return
    if (plan.seats && plan.seats.length === plan.tags.length) {
      this.restampRemaining(plan)
      return
    }
    const remain = plan.tags.slice(plan.spawned)
    const fresh = planShowUp({
      std,
      now: this.clock,
      tags: remain,
      intl: plan.intl,
      taken: this.entranceReleaseTimes(plan.hallId, plan.slotId),
    })
    plan.releases = [...plan.releases.slice(0, plan.spawned), ...fresh]
  }

  private abandonShowUp(slotId: string) {
    const plan = this.showUps.find((p) => p.slotId === slotId)
    if (!plan || plan.closed) return
    plan.closed = true
    const pending = `slot:${slotId}`
    const bound = plan.flightId
    for (const g of this.hallGuests) {
      if (g.dead || g.job !== 'depart') continue
      if (g.flightId === pending || (bound != null && g.flightId === bound)) {
        g.dead = true
        g.thought = 'Flight cancelled'
      }
    }
  }

  /** Attach the aircraft once it exists, and match the visual headcount to the airframe. */
  private bindShowUp(slot: ScheduleSlot, f: Flight) {
    const plan = this.showUps.find((p) => p.slotId === slot.id)
    if (!plan || f.cargo) return
    const fit = (f.stand ? this.roomsAt(f.stand) : null) ?? this.fitByKey(plan.hallId) ?? this.fits[0]
    plan.flightId = f.id
    plan.intl = isIntlKind(f.kind)
    if (fit) plan.hallId = this.hallKey(fit)
    f.std = plan.std
    for (const g of this.hallGuests) {
      if (g.flightId !== `slot:${slot.id}`) continue
      g.flightId = f.id
      g.hallId = plan.hallId
      this.tuneDepartureGuest(g, f)
    }
    const want = this.visualDepartureCount(f)
    const persona = this.airline(f.airline).persona
    if (want > plan.tags.length) {
      const extra = this.composeDeparture(
        want - plan.tags.length,
        plan.std,
        plan.intl,
        persona,
        fit ?? null,
        plan.hallId,
        plan.slotId,
      )
      plan.tags.push(...extra.tags)
      plan.releases.push(...extra.releases)
      plan.seats = [...(plan.seats ?? []), ...extra.seats]
    } else if (want < plan.tags.length) {
      const cut = Math.min(plan.tags.length - want, plan.tags.length - plan.spawned)
      if (cut > 0) {
        plan.tags.splice(plan.tags.length - cut, cut)
        plan.releases.splice(plan.releases.length - cut, cut)
        plan.seats?.splice(plan.seats.length - cut, cut)
      }
    }
    if (plan.seats && plan.seats.length === plan.tags.length) {
      this.applyIntlLead(plan)
      this.restampRemaining(plan)
    } else if (plan.intl && plan.spawned < plan.tags.length) {
      const remain = plan.tags.slice(plan.spawned)
      const fresh = planShowUp({
        std: plan.std,
        now: this.clock,
        tags: remain,
        intl: true,
        taken: this.entranceReleaseTimes(plan.hallId, plan.slotId),
      })
      plan.releases = [...plan.releases.slice(0, plan.spawned), ...fresh]
    }
  }

  private tickShowUp() {
    for (const plan of this.showUps) {
      if (plan.closed) continue
      const slot = this.schedule.find((s) => s.id === plan.slotId)
      if (!slot || slot.status === 'cancelled') {
        this.abandonShowUp(plan.slotId)
        continue
      }
      if (slot.status === 'done') {
        plan.closed = true
        continue
      }
      this.retargetShowUp(plan, slot.eta + PLANNED_TURN_SEC)
      if (plan.spawned >= plan.releases.length) continue
      const fit = this.fitByKey(plan.hallId) ?? this.activeHall() ?? this.fits[0]
      if (!fit) continue
      const open = this.hallOpenFor(fit)
      while (plan.spawned < plan.releases.length && plan.releases[plan.spawned] <= this.clock) {
        this.spawnShowUpGuest(plan, open)
        plan.spawned += 1
      }
    }
    if (this.showUps.length > 64) {
      this.showUps = this.showUps.filter((p) => !p.closed)
    }
  }

  /**
   * Benches and decorations. A waiting guest takes a free seat and rests;
   * decorations near the guest's zone lift the mood a little each second.
   */
  applyHallKit(g: HallGuest, dt: number, cache: Map<string, HallKitState>) {
    const fit = this.fitByKey(g.hallId) ?? this.activeHall()
    if (!fit) return
    const key = this.hallKey(fit)
    let state = cache.get(key)
    if (!state) {
      const items = (fit.items ?? []) as PlacedItem[]
      const zones = fit.zones ?? []
      state = {
        items,
        zones,
        seatsLeft: seatsByZone(zones, items),
        comfort: new Map(),
        litter: new Map(),
      }
      cache.set(key, state)
    }
    const walking = g.path.length > 0 && g.seg < g.path.length - 1
    const zone = NODE_ZONE[g.node]
    const free = zone ? (state.seatsLeft.get(zone) ?? 0) : 0
    g.seated = false
    if (g.meal) {
      // A diner holds their own booked seat; tickMeal rests them. Take it out of the waiting pool.
      if (zone && free > 0 && g.meal.walk <= 0) state.seatsLeft.set(zone, free - 1)
    } else if (!walking && zone && free > 0 && (SEAT_NODES as readonly HallNode[]).includes(g.node)) {
      state.seatsLeft.set(zone, free - 1)
      g.seated = true
      g.needs.energy = Math.max(0, g.needs.energy - dt * KIT_TUNING.seatRestPerSec)
      if (g.happiness < 100) {
        g.happiness = Math.min(100, g.happiness + dt * KIT_TUNING.seatJoyPerSec)
      }
    }
    let comfort = state.comfort.get(g.node)
    let litter = state.litter.get(g.node)
    if (comfort == null || litter == null) {
      litter = zone ? litterInZone(asLitterHall(fit), zone) : 0
      // Rubbish on the floor eats into what the decorations give.
      comfort = nodeComfort(state.zones, state.items, g.node) - litterComfortHit(litter)
      state.comfort.set(g.node, comfort)
      state.litter.set(g.node, litter)
    }
    if (comfort > 0 && g.happiness < 100) {
      g.happiness = Math.min(100, g.happiness + dt * comfort * KIT_TUNING.comfortJoyPerSec)
    }
    if (litter > 0) {
      g.happiness = Math.max(0, g.happiness - dt * litterJoyDrain(litter))
    }
  }

  /** Where the guest stands in the hall, normalized like NODE_POS. Matches the hall renderer. */
  guestSpot(g: HallGuest): { x: number; y: number } {
    const node = g.path.length ? g.path[Math.min(g.seg, g.path.length - 1)] : g.node
    const next = g.path.length && g.seg < g.path.length - 1 ? g.path[g.seg + 1] : null
    const a = NODE_POS[node]
    const b = next ? NODE_POS[next] : a
    const t = next ? Math.min(1, Math.max(0, g.t)) : 0
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  /** A meal or coffee goes into the guest's hand. They finish it over a few game minutes. */
  giveSnack(g: HallGuest, outlet: PlacedItem | null) {
    if (g.snack) this.finishSnack(g)
    const kind = snackKind(outlet?.def)
    this.litterSeq += 1
    // Spread by sequence, not Math.random, so litter never shifts a seeded run.
    const u = ((this.litterSeq * 7919) % 1000) / 1000
    g.snack = { kind, left: snackMinutes(kind, u) / GAME_MINUTES_PER_SIM_SECOND }
  }

  /**
   * A sit-down meal leaves its wrapper at the seat. A meal with no seat still
   * uses the counter cell only when the caller passes one; walk-away food uses
   * the snack in hand instead, so the rubbish is not dropped at the counter.
   */
  litterFromMeal(
    fit: TerminalFit,
    outlet: PlacedItem | null,
    seat?: { c: number; r: number },
  ): 'bin' | 'floor' | null {
    const hall = asLitterHall(fit)
    if (!hall.zones?.length) hall.zones = fit.premade ? prefabZones() : blankZones()
    const cells = seat
      ? [{ c: seat.c, r: seat.r }]
      : outlet
        ? [{ c: outlet.c, r: outlet.r }]
        : foodCells(hall)
    if (!cells.length) return null
    this.litterSeq += 1
    const n = this.litterSeq
    const at = cells[n % cells.length]
    let k = 0
    const jitter = () => ((n * 7919 + ++k * 104729) % 1000) / 1000
    return dropLitter(hall, at.c, at.r, `lit-${n}`, jitter)
  }

  /** Track the guest's spot and count down the snack in hand. */
  tickSnack(g: HallGuest, dt: number) {
    g.spot = this.guestSpot(g)
    if (!g.snack) return
    g.snack.left -= dt
    if (g.snack.left <= 0) this.finishSnack(g)
  }

  /**
   * The cup or wrapper is empty. A can with room near where the guest is now
   * takes it; otherwise it lands right there. Guests who board or leave first
   * drop it at their last spot in the hall.
   */
  finishSnack(g: HallGuest): 'bin' | 'floor' | null {
    if (!g.snack) return null
    g.snack = undefined
    const fit = this.fitByKey(g.hallId) ?? this.activeHall()
    if (!fit) return null
    const hall = asLitterHall(fit)
    if (!hall.zones?.length) hall.zones = fit.premade ? prefabZones() : blankZones()
    const spot = g.spot ?? this.guestSpot(g)
    const rows = hall.zones.length || GRID_R
    const cols = hall.zones[0]?.length || GRID_C
    this.litterSeq += 1
    return dropLitterAt(hall, cellAt(spot.x, spot.y, cols, rows), `lit-${this.litterSeq}`)
  }

  /** Seat bookings for one hall. */
  seatBook(fit: TerminalFit): SeatBook {
    const key = this.hallKey(fit)
    let book = this.seatBooks.get(key)
    if (!book) {
      book = new Map()
      this.seatBooks.set(key, book)
    }
    return book
  }

  /** Diners who ate standing in this hall inside the advisor window. */
  diningStoodRecently(fit: TerminalFit): number {
    const key = this.hallKey(fit)
    const since = this.clock - DINING_TUNING.standWindowSec
    const list = (this.diningStood.get(key) ?? []).filter((t) => t >= since)
    this.diningStood.set(key, list)
    return list.length
  }

  /**
   * After a meal at a placed outlet, a diner with time claims a free seat near
   * the counter and walks to it. No seat means eating on their feet, a little
   * less happy. Coffee, a passer-by, or a diner short on time eats on the walk.
   * After 'sat' the litter waits for the end of the meal.
   */
  seatDiner(g: HallGuest, fit: TerminalFit, outlet: PlacedItem): 'sat' | 'stood' | 'walk' {
    if (DINING_TUNING.walkAway.includes(outlet.def)) return 'walk'
    // Passing through the court on the way somewhere else — eat on the move.
    if (g.path.length && g.seg < g.path.length - 1) return 'walk'
    const mealSec = consumeSec(outlet.def)
    const depart = g.job === 'depart'
    const time = hasTimeToSit({
      job: g.job,
      boardingCall: depart && this.flightBoardingCall(g),
      clockRunning: depart && this.departureClockRunning(g),
      boarding: g.needs.boarding,
      mealSec,
    })
    if (!time) return 'walk'
    const seats = seatsNear((fit.items ?? []) as PlacedItem[], outlet.c, outlet.r)
    // No seat furniture nearby: they leave with the food. A full bench is the
    // standing case, and that wrapper drops at the counter.
    if (!seats.length) return 'walk'
    const seat = claimSeat(this.seatBook(fit), seats, g.id)
    if (!seat) {
      g.happiness -= DINING_TUNING.standJoyHit
      const key = this.hallKey(fit)
      const list = this.diningStood.get(key) ?? []
      list.push(this.clock)
      this.diningStood.set(key, list)
      return 'stood'
    }
    const cols = fit.zones?.[0]?.length || GRID_C
    const walkSec = walkSecTo(outlet.c, outlet.r, seat, HALL_W / cols)
    g.meal = {
      seatId: seat.id,
      itemId: seat.itemId,
      c: seat.c,
      r: seat.r,
      slot: seat.slot,
      table: seat.table,
      walk: walkSec,
      walkSec,
      left: mealSec,
    }
    return 'sat'
  }

  /**
   * A diner walks to their seat, sits, and eats. True while the meal holds
   * them. A boarding call or a clock running short ends it early, so a seat
   * never holds anyone past their flight.
   */
  tickMeal(g: HallGuest, dt: number): boolean {
    const meal = g.meal
    if (!meal) return false
    const fit = this.fitByKey(g.hallId) ?? this.activeHall()
    if (!fit || !(fit.items ?? []).some((it) => it.id === meal.itemId)) return this.endMeal(g, fit)
    const book = this.seatBook(fit)
    if (book.get(meal.seatId) !== g.id) {
      // Claims are not saved. After a load, take the seat back if it is free.
      if (book.has(meal.seatId)) return this.endMeal(g, fit)
      book.set(meal.seatId, g.id)
    }
    const moving = g.path.length > 0 && g.seg < g.path.length - 1
    const depart = g.job === 'depart'
    const late = !hasTimeToSit({
      job: g.job,
      boardingCall: depart && this.flightBoardingCall(g),
      clockRunning: depart && this.departureClockRunning(g),
      boarding: g.needs.boarding,
      mealSec: 0,
    })
    if (moving || late || g.node !== 'food') return this.endMeal(g, fit)
    if (meal.walk > 0) {
      meal.walk = Math.max(0, meal.walk - dt)
      g.thought = 'Taking my tray to a seat'
      return true
    }
    g.seated = true
    g.needs.energy = Math.max(0, g.needs.energy - dt * KIT_TUNING.seatRestPerSec)
    g.happiness = Math.min(100, g.happiness + dt * DINING_TUNING.seatedJoyPerSec)
    g.needs.shop = Math.min(100, g.needs.shop + dt * DINING_TUNING.seatedShopPerSec)
    meal.left -= dt
    g.thought = meal.table ? 'Eating at a table' : 'Eating on a bench'
    if (meal.left > 0) return true
    this.endMeal(g, fit)
    g.thought = 'Good meal — off again'
    return false
  }

  /** Stand up: free the seat and leave the wrapper at it. */
  private endMeal(g: HallGuest, fit: TerminalFit | null): false {
    const meal = g.meal
    g.meal = undefined
    g.seated = false
    if (meal && fit) {
      releaseSeat(this.seatBook(fit), g.id)
      this.litterFromMeal(fit, null, meal)
    }
    return false
  }

  /** Keep one hall janitor per hire, shared round-robin across halls. */
  private syncHallJanitors() {
    const keys = this.fits.map((f) => this.hallKey(f))
    if (!keys.length) {
      this.hallJanitors = []
      return
    }
    this.hallJanitors = this.hallJanitors.filter((j) => keys.includes(j.hallId))
    while (this.hallJanitors.length > this.janitors) this.hallJanitors.pop()
    while (this.hallJanitors.length < this.janitors) {
      const hallId = keys[this.hallJanitors.length % keys.length]
      const fit = this.fitByKey(hallId)
      const zones = fit?.zones?.length ? fit.zones : prefabZones()
      this.hallJanitors.push({
        id: uid('hjan'),
        hallId,
        x: (zones[0]?.length ?? GRID_C) / 2,
        z: zones.length / 2,
        task: null,
        work: 0,
      })
    }
  }

  /** Hall janitors walk to litter, full cans, and the WC. Wages ride the cleaning payroll line. */
  tickHallJanitors(dt: number) {
    this.syncHallJanitors()
    const clean = this.budgetOf('cleaning') / 100
    if (clean >= LITTER_TUNING.minCleaningBudget) {
      const claimed = new Map<string, Set<string>>()
      for (const j of this.hallJanitors) {
        const fit = this.fitByKey(j.hallId)
        if (!fit) continue
        const hall = asLitterHall(fit)
        const cols = hall.zones?.[0]?.length || GRID_C
        let taken = claimed.get(j.hallId)
        if (!taken) {
          taken = new Set()
          claimed.set(j.hallId, taken)
        }
        // A thin cleaning budget means a slower, part-time crew.
        stepJanitor(j, hall, dt * clean, HALL_W / cols, taken)
      }
    }
    this.litterAdviceCool -= dt
    if (this.litterAdviceCool <= 0) {
      this.litterAdviceCool = HINT_REFRESH_SEC
      this.refreshAdvice()
    }
  }

  guestAirlineId(g: HallGuest): AirlineId | null {
    if (g.airlineId) return g.airlineId
    if (g.flightId.startsWith('slot:')) {
      const plan = this.planForGuest(g)
      if (plan) return plan.airlineId as AirlineId
    }
    if (g.flightId.startsWith('layover:')) return g.flightId.slice('layover:'.length)
    const f = this.flights.find((x) => x.id === g.flightId)
    return f?.airline ?? null
  }

  /**
   * Walkers so the hall reads as open on day 1, before a flight releases.
   * They only pace the curb-to-gate path. Cargo kits have no hall to fill.
   * Shirts stay in a natural clothing range: neon orange and amber read as
   * flying dots from the airport camera on a phone.
   */
  private seedDayOneCrowd() {
    const fit = this.fits[0]
    if (!fit) return
    const hallId = this.hallKey(fit)
    const path: HallNode[] = ['entrance', 'checkin', 'security', 'shop', 'gate']
    const shirts = [
      '#2c3e50',
      '#5c4636',
      '#3d5c4a',
      '#7a3e3e',
      '#cfc6b8',
      '#4e5b38',
      '#6b5a48',
      '#3e5160',
      '#8a6a52',
      '#243044',
      '#5e5648',
      '#6d7d72',
    ]
    const tags: PaxTag[] = [
      'family',
      'budget',
      'business',
      'family',
      'budget',
      'business',
      'family',
      'budget',
      'business',
      'family',
      'budget',
      'business',
    ]
    // Already cleared, so they walk the whole route without joining the lane.
    // Spread them from the doors through security to the shops.
    const spots = [
      { seg: 0, t: 0.4, lane: -1.2 },
      { seg: 0, t: 0.72, lane: 0.4 },
      { seg: 1, t: 0.22, lane: -1.4 },
      { seg: 1, t: 0.48, lane: 0.2 },
      { seg: 1, t: 0.7, lane: 1.3 },
      { seg: 2, t: 0.28, lane: -0.8 },
      { seg: 2, t: 0.58, lane: 0.55 },
      { seg: 3, t: 0.2, lane: -1.1 },
      { seg: 3, t: 0.48, lane: 0.25 },
      { seg: 3, t: 0.74, lane: 1.15 },
      { seg: 2, t: 0.82, lane: -0.15 },
      { seg: 1, t: 0.34, lane: 0.9 },
    ]
    const names = ['Ada', 'Ben', 'Cara', 'Dev', 'Eve', 'Finn', 'Gia', 'Hank', 'Ivy', 'Jon', 'Kim', 'Leo']
    for (let i = 0; i < spots.length; i++) {
      // Built by hand so the crowd does not consume the sim's random stream.
      const g: HallGuest = {
        id: `day1-preview-${i}`,
        flightId: `day1-preview-${i}`,
        name: names[i],
        tag: tags[i],
        job: 'depart',
        node: path[spots[i].seg],
        path: [...path],
        seg: spots[i].seg,
        t: spots[i].t,
        lane: spots[i].lane,
        preview: true,
        previewDir: 1,
        needs: { hunger: 4, bladder: 4, energy: 4, boarding: 80, bags: 0, shop: 4, play: 4 },
        wallet: 0,
        prefs: { food: 0, shop: 0, play: 0, lounge: 0, nap: 0, landside: 0 },
        happiness: 70,
        patience: 70,
        spent: 0,
        thought: 'Walking to the gate',
        color: shirts[i],
        dead: false,
        clearedSec: true,
        carryOn: i % 2 === 0,
        hasChecked: i % 5 === 0,
        hallId,
        lost: false,
      }
      this.hallGuests.push(g)
    }
  }

  /** Real released passengers replace the day-one pacing crowd. */
  private retireDayOneCrowd() {
    if (!this.hallGuests.some((g) => g.preview)) return
    const real = this.hallGuests.filter(
      (g) => !g.preview && !g.dead && (g.releaseAt == null || g.releaseAt <= this.clock),
    ).length
    if (real >= 8) this.hallGuests = this.hallGuests.filter((g) => !g.preview)
  }

  /**
   * Pace the full curb → check-in → security → shop → gate walk, then loop.
   * They are already cleared, so the security desk does not take them as a queue.
   */
  private tickPreviewGuest(g: HallGuest, dt: number) {
    const path = g.path
    if (path.length < 2) return
    if (g.route == null) this.armGuestRoute(g)
    g.t += dt * 0.22
    while (g.t >= 1 && g.seg < path.length - 1) {
      const finished = g.route
      g.t -= 1
      g.seg += 1
      g.node = path[g.seg] ?? g.node
      if (finished && finished.length) {
        const end = finished[finished.length - 1]
        g.wx = end.x
        g.wz = end.z
      }
      if (g.seg >= path.length - 1) {
        g.seg = 0
        g.t = 0
        g.node = path[0] ?? 'entrance'
        g.wx = undefined
        g.wz = undefined
        g.route = undefined
      }
      this.armGuestRoute(g)
    }
    g.node = path[g.seg] ?? g.node
    this.sampleGuestRoute(g)
  }

  /** Feed the active hall's walkers: re-read the layout on edits, admit released departures and arrivals, step. */
  tickHallNav(step: number) {
    const fit = this.activeHall()
    if (!fit) return
    this.hallNav.setHall(
      this.hallKey(fit),
      String(this.hallRev),
      () => hallNavLayout(fit),
      () => hallClaimHall(fit),
      () => hallSignage(fit),
    )
    this.hallNav.setStaffPlan(
      {
        checkin: this.onPostCount('checkin'),
        security: this.onPostCount('security'),
      },
      fit.items ?? [],
    )
    this.hallNav.setDeskPlan(this.checkinRows(this.checkinAllocation()))
    this.hallNav.setShopStock(this.foodShelf, this.shopShelf)
    this.hallNav.admit(this.hallGuests, this.clock, (flightId) => {
      const f = this.flights.find((x) => x.id === flightId)
      if (f?.std != null) return f.std
      const slot = flightId.startsWith('slot:') ? flightId.slice(5) : null
      return this.showUps.find((p) => p.flightId === flightId || p.slotId === slot)?.std
    })
    this.hallNav.tick(step)
    this.applyHallWaits()
    // Walk guests' thoughts, complaints and missed flights move reputation (eased in, like the hall's).
    this.queueReputation(this.hallNav.takeReputation())
  }

  /** Waits in the walk's real queues move the waiting guest's mood: quick service pleases, a long line stings. */
  applyHallWaits() {
    const waits = this.hallNav.drainWaits()
    if (!waits.length) return
    const byId = new Map<string, HallGuest>()
    for (const g of this.hallGuests) if (!g.dead && !g.preview) byId.set(g.id, g)
    for (const w of waits) {
      const g = byId.get(w.id)
      if (!g) continue
      const delta = waitMoodDelta(w.kind, w.waitSec)
      if (delta) g.happiness = Math.max(0, Math.min(100, g.happiness + delta))
    }
  }

  tickHall(dt: number) {
    if (!this.fits.length) {
      this.hallGuests = []
      this.seatBooks.clear()
      return
    }
    const anyOpen = this.fits.some((f) => this.hallOpenFor(f).size > 0)
    if (!anyOpen) {
      this.hallGuests = []
      this.seatBooks.clear()
      return
    }
    const kit = new Map<string, HallKitState>()
    this.retireDayOneCrowd()
    for (const g of this.hallGuests) {
      if (g.dead) continue
      if (g.preview) {
        this.tickPreviewGuest(g, dt)
        continue
      }
      if (g.releaseAt != null && this.clock < g.releaseAt) continue
      const open = this.openForGuest(g)
      if (!open.size) continue
      if (g.releaseAt != null) {
        g.releaseAt = undefined
        this.openDepartingGuest(g, open)
      }
      if (g.job === 'depart' && g.node === 'gate' && this.flightBoardingCall(g)) {
        g.needs.boarding = 0
        g.dead = true
        g.thought = 'Boarded'
        this.paxServed += 1
        this.queueReputation(0.4)
        continue
      }
      if (
        g.job === 'depart' &&
        g.clearedSec &&
        g.node !== 'security' &&
        g.node !== 'gate' &&
        this.flightBoardingCall(g) &&
        open.has('gate') &&
        g.path[g.path.length - 1] !== 'gate'
      ) {
        this.routeGuest(g, 'gate', open)
      }
      if (
        g.job === 'depart' &&
        g.node === 'checkin' &&
        !g.bagsDropped &&
        (g.bagDepositLeft == null || g.bagDepositLeft <= 0) &&
        !this.checkInOpen(g)
      ) {
        g.bagsDropped = true
        g.bagDepositLeft = 0
        g.thought = 'Check-in closed — carry-on to security'
        if (open.has('security')) this.routeGuest(g, 'security', open)
      }
      // Needs drift — budget/family fill hunger faster; wear makes WC less satisfying.
      const drain =
        g.tag === 'budget' ? 1.25 : g.tag === 'family' ? 1.1 : g.tag === 'business' ? 0.9 : 0.85
      const wearBoost = 1 + this.maxWear() / 200
      g.needs.hunger = Math.min(100, g.needs.hunger + dt * 1.8 * drain)
      g.needs.bladder = Math.min(100, g.needs.bladder + dt * 1.4 * drain * wearBoost)
      g.needs.energy = Math.min(100, g.needs.energy + dt * 1.1)
      g.needs.shop = Math.min(100, g.needs.shop + dt * 0.6)
      g.needs.play = Math.min(
        100,
        g.needs.play + dt * (g.tag === 'family' ? 1.25 : tagSpendsUp(g.tag) ? 1.05 : 0.7),
      )
      if (g.job === 'depart' && this.departureClockRunning(g)) {
        g.needs.boarding = Math.max(0, g.needs.boarding - dt * DINING_TUNING.boardingDrainPerSec)
      }
      this.applyHallKit(g, dt, kit)
      this.tickSnack(g, dt)
      // A diner at a booked seat stays put until the meal ends or the flight calls.
      if (this.tickMeal(g, dt)) continue
      // Finish check-in bag deposit dwell (outbound picture).
      if (
        g.job === 'depart' &&
        g.node === 'checkin' &&
        !g.bagsDropped &&
        g.bagDepositLeft != null &&
        g.bagDepositLeft > 0
      ) {
        g.bagDepositLeft -= dt
        if (g.bagDepositLeft <= 0) {
          g.bagsDropped = true
          g.bagDepositLeft = 0
          g.hasChecked = false
          const fl = this.flights.find((x) => x.id === g.flightId)
          if (fl && !fl.cargo) {
            this.noteBagDrop(fl, bagUnitsForTag(g.tag), g.id, g.tag)
            const need = fl.bagUnits ?? 1
            const early =
              !fl.bagStage ||
              fl.bagStage === 'idle' ||
              fl.bagStage === 'pax_deposit' ||
              fl.bagStage === 'hold_screen'
            if ((fl.bagsDeposited ?? 0) >= need * 0.55 && early) {
              fl.bagStage = 'hold_screen'
            }
          }
          const openDesk = this.openForGuest(g)
          if (openDesk.has('security')) this.routeGuest(g, 'security', openDesk)
          g.thought = 'Bags accepted — walking to security'
        } else {
          continue
        }
      }
      if (g.job === 'arrive' && g.node === 'claim' && !g.transfer) {
        const fl = this.flights.find((x) => x.id === g.flightId)
        if (!fl) {
          const fit = this.fitByKey(g.hallId) ?? this.activeHall() ?? this.fits[0] ?? null
          const rate = this.claimClearRate(fit)
          g.needs.bags = Math.max(0, g.needs.bags - dt * rate)
          if (g.needs.bags > 0) {
            g.thought = 'Waiting at the carousel'
            continue
          }
          if (!g.hasChecked) {
            g.hasChecked = true
            g.thought = 'Got my bag'
          }
        } else if (g.atBagDesk) {
          g.deskTime = (g.deskTime ?? 0) + dt
          g.thought =
            g.bagFault === 'missed_connection'
              ? 'Lost-bag desk — my bag missed the connection'
              : 'Lost-bag desk — my bag is late'
          if ((g.deskTime ?? 0) < 4) continue
          this.pickUpOwnBags(g, fl)
          g.atBagDesk = false
          g.hasChecked = true
          g.needs.bags = 0
          g.thought = 'Got my bag'
          fl.bagStage = 'complete'
        } else if (fl.bagStage !== 'on_claim' && fl.bagStage !== 'complete') {
          this.issueBagTags(g.id, fl.id, g.tag, null, 'in')
          g.claimWait = (g.claimWait ?? 0) + dt
          g.thought =
            fl.bagStage === 'unload_aircraft' || fl.bagStage === 'inbound_sort'
              ? `Waiting — bags processing for claim ${fl.claimLane ?? '?'}`
              : fl.bagStage === 'deliver_claim'
                ? `Waiting — bags rolling to claim ${fl.claimLane ?? '?'}`
                : 'Waiting for my bag off the aircraft…'
          const late = markClaimLate(this.bagTags, g.id, g.claimWait, {
            prefab: this.prefabFlight(fl),
            normal: !this.hallOverloaded,
          })
          if (late.length) {
            this.bagsMishandled += late.length
            this.mishandleGuest(g.id, 'late')
          }
          continue
        } else {
          this.issueBagTags(g.id, fl.id, g.tag, null, 'in')
          if (!ownerClaimReady(this.bagTags, g.id)) {
            g.claimWait = (g.claimWait ?? 0) + dt
            g.thought = 'Waiting for my bag'
            const late = markClaimLate(this.bagTags, g.id, g.claimWait, {
              prefab: this.prefabFlight(fl),
              normal: !this.hallOverloaded,
            })
            if (late.length) {
              this.bagsMishandled += late.length
              this.mishandleGuest(g.id, 'late')
            }
            continue
          }
          if (!g.hasChecked) {
            this.pickUpOwnBags(g, fl)
            g.hasChecked = true
            g.needs.bags = 0
            g.thought = 'Got my bag'
          }
          fl.bagStage = 'complete'
        }
      }

      if (g.job === 'depart' && g.node === 'security' && !g.clearedSec) {
        g.path = []
        g.seg = 0
        g.t = 0
        g.route = undefined
        this.tickSecurityLane(g, dt, open)
        continue
      }

      if (g.path.length && g.seg < g.path.length - 1) {
        if (g.route == null) this.armGuestRoute(g)
        g.t += dt * 1.35 * this.walkBoost(g)
        let held = false
        while (g.t >= 1 && g.seg < g.path.length - 1) {
          const finished = g.route
          g.t -= 1
          g.seg += 1
          g.node = g.path[g.seg]
          if (finished && finished.length) {
            const end = finished[finished.length - 1]
            g.wx = end.x
            g.wz = end.z
          }
          if (g.node === 'security' && g.job === 'depart' && !g.clearedSec) {
            g.path = []
            g.seg = 0
            g.t = 0
            g.route = undefined
            g.routeDist = 0
            held = true
            break
          }
          const screened = g.clearedSec
          if (g.node === 'security') g.clearedSec = true
          this.secureBreach(g)
          // A cleared departure walking back across the checkpoint keeps their path.
          // serveNode used to start a new route here, so the line never left the node.
          if (!(g.node === 'security' && screened && g.job === 'depart')) this.serveNode(g, open)
          if (g.seg < g.path.length - 1) this.armGuestRoute(g)
          else {
            g.route = undefined
            g.routeDist = 0
          }
        }
        if (held) {
          this.tickSecurityLane(g, 0, open)
          continue
        }
        this.sampleGuestRoute(g)
        continue
      }

      // Decision point — pick strongest need and search a short path (RCT-capped).
      const need = strongestNeed(g)
      if (!need) {
        if (g.transfer) {
          // Transfers use boarding as connection clock — linger until it runs down.
          g.needs.boarding = Math.max(0, g.needs.boarding - dt * 0.35)
          if (g.needs.boarding > 8) {
            const linger = (
              [
                'food',
                'shop',
                'lounge',
                'dayhotel',
                'spa',
                'pool',
                'bathroom',
                'gaming',
                'waterfall',
                'golf',
              ] as const
            ).find((n) => open.has(n))
            if (linger && g.node !== linger) this.routeGuest(g, linger, open)
            else g.thought = 'Killing time until the connection'
          } else if (open.has('gate')) {
            this.routeGuest(g, 'gate', open)
            if (g.node === 'gate' && g.needs.boarding <= 0) {
              g.dead = true
              const aid = this.guestAirlineId(g)
              if (aid) this.adjustHeat(aid, g.happiness >= 55 ? 2.5 : -2)
            }
          }
        } else if (g.job === 'depart' && open.has('gate')) {
          this.routeGuest(g, 'gate', open)
        } else if (g.job === 'arrive' && g.needs.bags < 15) {
          this.routeGuest(g, 'exit', open)
        } else {
          g.thought = 'Wandering…'
        }
        continue
      }
      const dest = reachableNeed(need, g.job, open)
      if (!dest) {
        g.happiness -= dt * 0.4
        g.thought = 'Waiting for a way through'
        if (g.job === 'depart' && open.has('gate')) this.routeGuest(g, 'gate', open)
        else if (g.job === 'arrive' && open.has('exit')) this.routeGuest(g, 'exit', open)
        continue
      }
      if (g.node === dest) this.serveNode(g, open)
      else this.routeGuest(g, dest, open)

      if (g.job === 'depart' && g.needs.boarding <= 0 && g.node !== 'gate') {
        g.happiness -= 30
        g.dead = true
        g.lost = false
        this.queueReputation(-0.8)
        const aid = this.guestAirlineId(g)
        if (aid) this.adjustHeat(aid, g.transfer ? -2.5 : -1.3)
        this.hallMissNews(
          `gate-${g.flightId}`,
          `Missed gate on ${g.flightId.slice(0, 10)} — pax boiling, Standing dips.`,
        )
        this.missedFlights += 1
      }
    }
    for (const g of this.hallGuests) {
      if (g.happiness < 0 || g.happiness > 100) g.happiness = Math.max(0, Math.min(100, g.happiness))
    }
    // Sample layover happiness into the active contract.
    if (this.layover) {
      const transfers = this.hallGuests.filter(
        (g) => g.transfer && g.airlineId === this.layover!.airline && !g.dead,
      )
      if (transfers.length) {
        let sum = 0
        for (const g of transfers) sum += g.happiness
        this.layover.happySum += sum / transfers.length
        this.layover.samples += 1
      }
    }
    // Boarded or left with a snack still in hand: the rubbish stays at their last spot.
    for (const g of this.hallGuests) if (g.dead && g.snack) this.finishSnack(g)
    this.hallGuests = this.hallGuests.filter((g) => !g.dead)
    if (this.seatBooks.size) {
      const live = new Set(this.hallGuests.map((g) => g.id))
      for (const book of this.seatBooks.values()) sweepSeats(book, (id) => live.has(id))
    }
    if (this.departedFlights.size > 24) {
      const live = new Set(this.hallGuests.map((g) => g.flightId))
      for (const id of this.departedFlights) if (!live.has(id)) this.departedFlights.delete(id)
    }
    const fit = this.activeHall() ?? this.fits[0]
    const present = this.hallHeadcount()
    const cap = fit?.capGuests ?? 40
    if (fit && present > cap) this.markHallOverloaded()
    else if (this.hallOverloaded && cap > this.overloadCap) this.releaseHallIfFits()
  }

  /** Headcount against the live ceiling. Preview and not-yet-released guests do not count. */
  private hallHeadcount(): number {
    return this.hallGuests.filter(
      (g) => !g.preview && (g.releaseAt == null || g.releaseAt <= this.clock),
    ).length
  }

  /**
   * The corner card stays while the crowd or the security line still exceeds
   * the live ceiling. An upgrade or a new lane recalculates that ceiling.
   */
  private securityLineOver(fit: TerminalFit): boolean {
    const key = this.hallKey(fit)
    const waiting = this.hallGuests.filter(
      (g) =>
        !g.dead &&
        !g.preview &&
        g.hallId === key &&
        g.job === 'depart' &&
        g.node === 'security' &&
        !g.clearedSec,
    ).length
    if (waiting <= 0) return false
    const lane = laneStats({
      premade: fit.premade,
      redesigned: fit.redesigned,
      tier: fit.tier,
      items: (fit.items ?? []) as PlacedItem[],
      roomsSecurity: fit.rooms.security,
    })
    const cap = fit.capGuests ?? 40
    return waiting > cap || waiting > lane.queueCap + Math.max(0, lane.servers)
  }

  private releaseHallIfFits() {
    const fit = this.activeHall() ?? this.fits[0]
    if (!fit || !this.hallOverloaded) return
    const cap = fit.capGuests ?? 40
    if (this.hallHeadcount() <= cap && !this.securityLineOver(fit)) this.clearHallOverload()
  }

  routeGuest(g: HallGuest, dest: HallNode, open: Set<HallNode>) {
    // Uncleared departures only see the curb side plus the security lane.
    const view = openForGuest(open, g.clearedSec)
    const fit = this.fitByKey(g.hallId) ?? this.activeHall()
    const prefab = Boolean(fit?.premade && !fit?.redesigned)
    let target = dest
    if (!g.clearedSec && isAirside(dest)) {
      if (view.has('security')) {
        target = 'security'
        g.thought = 'Need to clear security first'
      } else if (prefab) {
        g.lost = false
        g.thought = 'No security lane — waiting'
        g.happiness -= 0.4
        return
      } else {
        g.lost = true
        g.thought = 'Lost — no security lane, gate is locked'
        g.happiness -= 1.2
        g.patience -= 2
        return
      }
    }
    const signs = (fit?.signs ?? 0) + (g.node === 'info' ? 1 : 0)
    const depth = lookaheadDepth(signs)
    // Once screened, stay airside. The checkpoint is not a shortcut between the gate and the food.
    const avoidLane =
      g.clearedSec &&
      g.node !== 'security' &&
      target !== 'security' &&
      isAirside(g.node) &&
      isAirside(target)
    const walkView = avoidLane ? new Set([...view].filter((n) => n !== 'security')) : view
    let path = hallPath(g.node, target, walkView, depth)
    if ((!path || path.length < 2) && avoidLane) path = hallPath(g.node, target, view, depth)
    if ((!path || path.length < 2) && prefab) path = hallPath(g.node, target, view, 12)
    if (!path || path.length < 2) {
      if (prefab) {
        g.lost = false
        g.thought = 'Waiting for a clear path'
        g.happiness -= 0.15
        return
      }
      g.lost = true
      if (!g.clearedSec && isAirside(dest)) {
        g.thought = 'Blocked at the secure line'
        g.happiness -= 0.8
      } else {
        g.thought = 'Lost in the hall'
        g.happiness -= 0.5
      }
      return
    }
    g.lost = false
    g.path = path
    g.seg = 0
    g.t = 0
    g.route = undefined
    this.armGuestRoute(g)
    if (!g.thought.startsWith('Need to clear')) {
      g.thought = `Heading to ${target}`
    }
  }

  /**
   * Room plan for a hall, matching `world.wr.roomPlans()` (same layout seed, no decorative crowd).
   * Rebuilt when the map changes. Headless tests use this; the client draws the same plan.
   */
  roomPlanForHall(hallId?: string | null): RoomPlan | null {
    if (this.terminalPlans?.rev !== this.mapRev) {
      const entries = terminals(this).map((t, index) => ({
        key: `${t.cluster.minC},${t.cluster.minR}`,
        cells: t.cluster.cells,
        plan: planTerminal(t, { density: 1, walkersPerCell: 0, seed: terminalPlanSeed(index) }).rooms,
      }))
      this.terminalPlans = { rev: this.mapRev, entries }
    }
    const entries = this.terminalPlans?.entries ?? []
    const fit = this.fitByKey(hallId)
    if (fit) {
      const key = this.hallKey(fit)
      const hit = entries.find(
        (e) => e.key === key || e.cells.some((p) => p.c === fit.origin.c && p.r === fit.origin.r),
      )
      if (hit) return hit.plan
    }
    if (hallId) {
      const hit = entries.find((e) => e.key === hallId)
      if (hit) return hit.plan
    }
    return entries[0]?.plan ?? null
  }

  /** Strict doorway path for the edge the guest is about to walk. A null path does not mark them lost. */
  armGuestRoute(g: HallGuest) {
    const next = g.path[g.seg + 1]
    if (!next) {
      g.route = undefined
      g.routeDist = 0
      return
    }
    const plan = this.roomPlanForHall(g.hallId)
    if (!plan) {
      g.route = []
      g.routeDist = 0
      return
    }
    const route = legRoute(plan, g, next)
    g.route = route ?? []
    g.routeDist = 0
    if (route && route.length && (g.wx == null || g.wz == null)) {
      g.wx = route[0].x
      g.wz = route[0].z
    }
  }

  /** A moving walkway speeds only the metres of this leg that the belt covers. */
  private walkBoost(g: HallGuest): number {
    const route = g.route
    if (!route || route.length < 2) return 1
    const span = polylineLength(route)
    if (!(span > 0)) return 1
    const covered = Math.min(span, this.walkwayCoverMetres(g.hallId))
    const mult = CONNECTIVITY_CATALOG.moving_walkway.speedMult
    if (!(covered > 0) || !(mult > 1)) return 1
    const time = covered / mult + (span - covered)
    if (!(time > 0)) return 1
    const boost = span / time
    return Number.isFinite(boost) && boost > 0 ? boost : 1
  }

  /** `g.t` stays 0..1 for queues. World position is that fraction along the doorway polyline. */
  private sampleGuestRoute(g: HallGuest) {
    const route = g.route
    if (!route || route.length < 2) return
    const at = pointAlong(route, g.t)
    g.wx = at.x
    g.wz = at.z
    g.wyaw = at.yaw
    g.routeDist = Math.min(1, Math.max(0, g.t)) * polylineLength(route)
  }

  /**
   * After the scanner. Lounge lovers sit and shop while the flight is still
   * on the ground. A boarding call sends everyone to the gate.
   */
  private routeAfterSecurity(g: HallGuest, open: Set<HallNode>) {
    const seat = g.showUp
    if (seat && this.flightBoardingCall(g) && open.has('gate')) {
      this.routeGuest(g, 'gate', open)
      return
    }
    if (seat?.amenity === 'lounge' && !g.loungeDone) {
      if (open.has('lounge')) {
        this.routeGuest(g, 'lounge', open)
        return
      }
      g.happiness = Math.max(0, Math.min(100, g.happiness + seat.moodMiss))
      g.thought = 'Wanted a lounge — the hall has none'
      g.loungeDone = true
    }
    if (
      seat?.amenity === 'lounge' &&
      g.loungeDone &&
      !g.shopDone &&
      seat.spendAmenity > 0 &&
      open.has('shop')
    ) {
      this.routeGuest(g, 'shop', open)
      return
    }
    if (g.needs.bladder > 62 && open.has('bathroom')) this.routeGuest(g, 'bathroom', open)
    else if (g.needs.hunger > 58 && open.has('food')) this.routeGuest(g, 'food', open)
    else if (g.needs.shop > 70 && open.has('shop') && !g.shopDone) this.routeGuest(g, 'shop', open)
    else if (open.has('gate')) this.routeGuest(g, 'gate', open)
  }

  /** Lounge lovers pay the stamped lounge price, then walk to the shops. */
  private chargeStampedLounge(g: HallGuest, open: Set<HallNode>) {
    const seat = g.showUp
    if (!seat) return
    g.loungeDone = true
    const price = Math.max(0, Math.round(seat.spendLounge))
    g.needs.energy = Math.max(0, g.needs.energy - 40)
    let receipt = 'Sat in the lounge'
    if (price > 0 && seat.willLounge >= 0.5) {
      g.prefs.lounge = Math.max(g.prefs.lounge, 0.95)
      const buy = this.tryGuestPay(g, price, 'lounge', true)
      if (buy.ok) {
        g.happiness = Math.min(100, g.happiness + seat.moodLounge)
        receipt = `Lounge (−$${price})`
      } else {
        g.happiness = Math.min(100, g.happiness + Math.max(1, Math.round(seat.moodLounge * 0.25)))
        receipt = 'Lounge fee too rich'
      }
    } else {
      g.happiness = Math.min(100, g.happiness + Math.max(1, Math.round(seat.moodLounge * 0.4)))
    }
    if (!g.shopDone && seat.spendAmenity > 0 && open.has('shop') && !this.flightBoardingCall(g)) {
      this.routeGuest(g, 'shop', open)
    } else if (open.has('gate')) {
      this.routeGuest(g, 'gate', open)
    }
    g.thought = receipt
  }

  /** Lounge lovers pay the stamped shop price once, then head for the gate. */
  private chargeStampedShop(g: HallGuest, open: Set<HallNode>) {
    const seat = g.showUp
    if (!seat) return
    g.shopDone = true
    const price = Math.max(0, Math.round(seat.spendAmenity))
    if (this.shopShelf < 1) {
      this.walkOffEmptyShelf(g, price, 'wish they had a souvenir', open)
      if (open.has('gate')) this.routeGuest(g, 'gate', open)
      return
    }
    g.prefs.shop = Math.max(g.prefs.shop, 0.95)
    let receipt = 'Browsed the shop'
    if (seat.willAmenity >= 0.5) {
      if (!this.drawShelf('shop')) {
        this.walkOffEmptyShelf(g, price, 'wish they had a souvenir', open)
        if (open.has('gate')) this.routeGuest(g, 'gate', open)
        return
      }
      const buy = this.tryGuestPay(g, price, 'shop', true)
      if (buy.ok) {
        g.needs.shop = Math.max(0, g.needs.shop - 60)
        g.happiness = Math.min(100, g.happiness + 5)
        receipt = `Shop (−$${price})`
      } else {
        this.returnShelf('shop')
        g.needs.shop = Math.max(0, g.needs.shop - 20)
      }
    } else {
      g.needs.shop = Math.max(0, g.needs.shop - 20)
    }
    if (open.has('gate')) this.routeGuest(g, 'gate', open)
    g.thought = receipt
  }

  /**
   * One prefab lane serves `servers` people at a time. Everyone else waits.
   * Past the comfort cap the line gets slower and angrier, flights slip,
   * and the advisor asks for an upgrade. Nobody is marked lost.
   */
  tickSecurityLane(g: HallGuest, dt: number, open: Set<HallNode>) {
    if (g.job === 'depart' && !g.clearedSec) this.rulePremiumScreen(g)
    if (g.premiumScreen === 'fast_track' || g.premiumScreen === 'vip_room') {
      this.tickDedicatedLane(g, dt, open)
      return
    }
    const fit = this.fitByKey(g.hallId) ?? this.activeHall() ?? this.fits[0]
    const lane = laneStats({
      premade: fit?.premade ?? false,
      redesigned: fit?.redesigned,
      tier: fit?.tier,
      items: (fit?.items ?? []) as PlacedItem[],
      roomsSecurity: fit?.rooms.security ?? 0,
    })
    if (g.queueSeq == null) g.queueSeq = this.secSeq++
    const peers = this.hallGuests.filter(
      (o) =>
        !o.dead &&
        o.hallId === g.hallId &&
        o.job === 'depart' &&
        o.node === 'security' &&
        !o.clearedSec,
    )
    const wantsFast = (o: HallGuest) => (o.showUp ? o.showUp.preferFastTrack : o.tag === 'premium')
    const fast = wantsFast(g)
    const pool = peers.filter((o) => wantsFast(o) === fast)
    const fastHere = peers.some((o) => wantsFast(o))
    const wear = Math.max(
      fit?.wearSec ?? 0,
      ...(fit?.items ?? [])
        .filter((i) => String(i.def).startsWith('security'))
        .map((i) => i.wear),
    )
    // The walk's open lanes are the only server count. A lane the walk has
    // open is not also slowed for being unstaffed, and a lane the walk has
    // closed is not a server here.
    const openServers = this.securityServers(fit)
    let servers = openServers
    if (fast) servers = Math.min(servers, 1)
    else if (fastHere && servers > 1) servers = servers - 1
    let svc = slowedService(lane.serviceSec, wear)
    svc *= this.disruptions.screeningMultiplier() * this.opsEvents.screeningMultiplier()
    if (this.disruptions.secureZone()) svc += 0.8
    if (!Number.isFinite(svc) || svc <= 0) svc = slowedService(lane.serviceSec, wear)
    svc = Math.min(12, svc)
    const cap = fit?.capGuests ?? 40
    if (peers.length > cap) svc *= overCapMultiplier(peers.length, cap)
    if (fast) svc *= 0.5 * this.screenPace(true)
    else svc *= this.screenPace(false)

    if ((g.serviceLeft ?? 0) > 0) {
      g.serviceLeft = (g.serviceLeft ?? 0) - dt
      g.lost = false
      g.thought = needsMaintenance(wear) ? 'Worn lane — needs a scrub' : 'At the scanner'
      if ((g.serviceLeft ?? 0) <= 0) {
        g.serviceLeft = 0
        g.clearedSec = true
        if (fit) {
          this.bumpWear('sec', lane.wearPerUse, fit)
          const laneItem = fit.items?.find((i) => String(i.def).startsWith('security'))
          if (laneItem) laneItem.wear = Math.min(100, laneItem.wear + lane.wearPerUse)
        }
        g.thought = 'Cleared security — the gates are open'
        const seat = g.showUp
        if (seat) {
          const delta = seat.preferFastTrack ? seat.moodFast : seat.moodStandard
          g.happiness = Math.max(0, Math.min(100, g.happiness + delta))
        }
        this.routeAfterSecurity(g, open)
      }
      return
    }

    if (openServers <= 0) {
      const prefab = Boolean(fit?.premade && !fit?.redesigned)
      if (prefab) {
        g.lost = false
        g.thought = 'Lane closed — waiting'
        g.happiness -= dt * 1.2
        return
      }
      g.lost = true
      g.thought = 'Lost — no security lane'
      g.happiness -= dt * 2
      return
    }

    const serving = pool.filter((o) => (o.serviceLeft ?? 0) > 0).length
    const idle = pool
      .filter((o) => (o.serviceLeft ?? 0) <= 0)
      .sort((a, b) => (a.queueSeq ?? 0) - (b.queueSeq ?? 0))
    const idx = idle.findIndex((o) => o.id === g.id)
    const slots = Math.max(0, servers - serving)
    if (idx >= 0 && idx < slots) {
      g.serviceLeft = svc
      g.lost = false
      g.thought = fast ? 'Fast-track lane' : 'Stepping into the lane'
      return
    }
    const overComfort = idx >= lane.queueCap + slots || peers.length > cap
    if (overComfort) this.markHallOverloaded()
    if (idx >= lane.queueCap + slots) {
      g.lost = false
      g.thought = 'Long security line — the hall is over capacity'
      g.happiness -= dt * 2.4
      g.patience -= dt * 1.1
      this.delayGuestFlight(g)
      return
    }
    g.lost = false
    g.thought = `Security queue — ${Math.max(1, idx - slots + 1)} ahead`
    g.happiness -= dt * (peers.length > cap ? 1.4 : 0.7)
  }

  /** Once per flight: slip the slot and nick Standing when the line is too long. */
  delayGuestFlight(g: HallGuest) {
    if (!g.flightId || this.queueDelayFlight.has(g.flightId)) return
    this.queueDelayFlight.add(g.flightId)
    const slot = this.schedule.find(
      (s) => s.flightId === g.flightId && s.status !== 'done' && s.status !== 'cancelled',
    )
    if (slot) this.nudgeSlot(slot, 10, 'Security queue')
    else if (g.airlineId) this.adjustHeat(g.airlineId as AirlineId, -0.45)
  }

  markHallOverloaded() {
    const fit = this.activeHall() ?? this.fits[0]
    this.overloadCap = fit?.capGuests ?? this.overloadCap
    if (this.hallOverloaded) return
    this.hallOverloaded = true
    this.reputation = Math.max(0, this.reputation - 1)
    for (const id of this.signed) this.adjustHeat(id, -1.2)
    this.pushNews(
      'Hall over capacity — long queues, delays, and missed flights. Upgrade the prefab, expand the lanes, or design your own terminal.',
      'bad',
    )
    this.refreshAdvice()
  }

  /** Headcount is back inside the cap, including after an expansion. */
  clearHallOverload() {
    if (!this.hallOverloaded) return
    this.hallOverloaded = false
    for (const row of [...this.alerts.active]) {
      if (row.key.startsWith('cond:hall-full')) this.alerts.clear(row.key)
    }
    this.refreshAdvice()
  }

  /** Hide the corner card and the alert. They can return after the cooldown if the hall is still full. */
  dismissCapacityHint() {
    this.capacityHintUntil = this.clock + ALERT_TUNING.capacityCoolSec
    for (const row of [...this.alerts.active]) {
      if (row.key.startsWith('cond:hall-full')) this.alerts.dismiss(row.id, this.clock)
    }
    if (this.sidePanel === 'hints') this.setSidePanel(null)
    this.emit()
  }

  private sessionSnapshot() {
    const fieldUp = this.starterFieldUp()
    return {
      fieldUp,
      signed: this.signed.length,
      offerWaiting: this.offer != null,
      buildTrayOpened: this.buildTrayOpened,
      deskStaff: this.deskStaff,
      needsDesk: this.startFocus !== 'cargo' && this.fits.length > 0,
      flightsDone: this.flightsDone,
      offerMissing: this.offer ? this.letterVerdict(this.offer.airline).missing : [],
    }
  }

  private withSessionHint(list: Advice[]): Advice[] {
    const session = nextSessionHint(this.sessionSnapshot())
    return session ? mergeHints(list, [session]) : list
  }

  refreshAdvice() {
    const fit = this.activeHall() ?? this.fits[0]
    const powerNotes = this.powerAdviceItems()
    if (!fit) {
      this.advice = this.withSessionHint([
        ...this.groundNotes,
        ...this.cargoNotes,
        ...this.scaleAdviceItems(),
        ...powerNotes,
      ])
      this.keepApronFocus(powerNotes)
      this.appendNegotiationAdvice()
      return
    }
    const hall = adviseHall(
      {
        premade: fit.premade,
        redesigned: fit.redesigned,
        tier: fit.tier,
        signs: fit.signs,
        capGuests: fit.capGuests,
        secPerMin: fit.secPerMin,
        zones: fit.zones as ZoneId[][],
        rooms: {
          checkin: fit.rooms.checkin,
          security: fit.rooms.security,
          gate: fit.rooms.gate,
          bagclaim: fit.rooms.bagclaim,
          food: fit.rooms.food,
          souvenir: fit.rooms.souvenir,
          bathroom: fit.rooms.bathroom,
        },
      },
      this.hallOpenFor(fit),
      this.schedule,
      this.hallOverloaded,
    )
    const standingNotes: Advice[] = []
    for (const id of this.signed) {
      const standing = this.standingOf(id)
      if (standing > HEAT_WARN_THRESHOLD) continue
      const name = this.airline(id).name
      standingNotes.push({
        id: `standing-${id}`,
        title: `${name} Standing is slipping`,
        detail: `Standing ${Math.round(standing)}. They leave the airport if it reaches ${HEAT_ABANDON_THRESHOLD}.`,
        fix: 'Clear the queues and keep the ramp on time before they walk.',
        cells: [],
        scope: 'apron',
      })
    }
    hall.push(...this.planHints(fit))
    hall.push(...litterAdvice(asLitterHall(fit), this.janitors, this.budgetOf('cleaning') / 100))
    const outletCells = ((fit.items ?? []) as PlacedItem[])
      .filter((it) => !it.bundle && outletSpec(it.def))
      .map((it) => ({ c: it.c, r: it.r }))
    hall.push(...seatingAdvice(this.diningStoodRecently(fit), outletCells))
    const session = nextSessionHint(this.sessionSnapshot())
    this.advice = mergeHints(
      hall,
      standingNotes,
      this.groundNotes,
      this.cargoNotes,
      this.scaleAdviceItems(),
      powerNotes,
      session ? [session] : [],
    )
    if (this.advisorCells.length) {
      const still = hall.find((a) =>
        a.cells.some((c) => this.advisorCells.some((h) => h.c === c.c && h.r === c.r)),
      )
      if (!still) this.advisorCells = []
    }
    this.keepApronFocus(powerNotes)
    this.appendNegotiationAdvice()
  }

  private keepApronFocus(powerNotes: Advice[]) {
    if (!this.apronFocus.length) return
    const still = [...this.groundNotes, ...this.cargoNotes, ...powerNotes].find((note) =>
      note.cells.some((cell) => this.apronFocus.some((mark) => mark.c === cell.c && mark.r === cell.r)),
    )
    if (!still) this.apronFocus = []
  }

  private appendNegotiationAdvice() {
    const line = this.negotiationBridge?.advisorLine()
    if (!line) return
    this.advice = [
      ...this.advice,
      {
        id: 'ulcc-breakeven',
        title: 'ULCC break-even',
        detail: line,
        fix: 'Open the offer sheet and compare it with the spend band.',
        cells: [],
      },
    ]
  }

  /** Terminal-plan hints for a hall. Cached by layout so the periodic refresh stays cheap. */
  private planHints(fit: TerminalFit): Advice[] {
    const key = `${this.hallKey(fit)}:${this.hallRev}:${fit.items?.length ?? 0}:${fit.zones?.length ?? 0}`
    if (this.planAdvice.key !== key) {
      this.planAdvice = {
        key,
        list: [
          ...liveHallAdvice({ zones: fit.zones, items: fit.items }),
          ...(fit.build ? buildAdvice(fit.build) : []),
        ],
      }
    }
    return this.planAdvice.list
  }

  /**
   * Hints the panel and its badge show, after the player's mutes. Worst first.
   * While a first-session hint is active, it is the only note — plus any hard
   * fail, which is never hidden behind the next-step tip.
   */
  visibleHints(): Advice[] {
    const raw = visibleHints(this.advice, this.hintPrefs)
    const shown =
      this.clock < this.capacityHintUntil ? raw.filter((a) => a.id !== 'over-capacity') : raw
    const session = shown.find((a) => hintKind(a.id) === 'session')
    if (!session) return shown
    const hard = shown.filter((a) => a !== session && severityOf(a) === 'blocker')
    return [...hard, session]
  }

  /** "Don't show hints of this type." Turns All hints enabled off. */
  muteHint(id: string) {
    this.hintPrefs = muteHintKind(this.hintPrefs, hintKind(id))
    writeHintSettings(this.hintPrefs)
    if (!this.visibleHints().length) this.setSidePanel(null)
    this.focusAdvice(null)
  }

  /** Chips the overlay should draw. Empty when the toggle is off. */
  visibleTips(): TipOffer[] {
    return this.tipVisible
  }

  /** Settings → Tip chips. Does not bring back an id that was already shown. */
  setTipChips(on: boolean) {
    this.tipBook = setTipsEnabled(this.tipBook, on)
    this.refreshTips()
    this.emit()
  }

  /** The player closed one chip. That id does not return. */
  dismissTip(id: string) {
    this.tipBook = dismissTipId(this.tipBook, id)
    this.tipVisible = this.tipVisible.filter((t) => t.id !== id)
    this.emit()
  }

  /** Recompute stuck-state chips from the field. Emits only when the set changes. */
  refreshTips() {
    const next = stepTips(this.tipBook, evaluateTips(this.tipWorld()))
    const prev = this.tipVisible.map((t) => t.id).join('|')
    const now = next.visible.map((t) => t.id).join('|')
    this.tipBook = next.book
    this.tipVisible = next.visible
    if (prev !== now) this.emit()
  }

  private tipWorld(): TipWorld {
    if (!this.site) {
      return {
        site: false,
        sandbox: this.sandbox,
        cash: this.cash,
        hasRunway: false,
        stands: 0,
        exits: 0,
        orphans: 0,
        queueWait: 0,
        queueCount: 0,
        hallQueue: 0,
        fuelEmpty: false,
        stuck: false,
        runwayCell: null,
        queueCell: null,
        hallCell: null,
        fuelCell: null,
        stuckCell: null,
      }
    }
    const stands = tilesOf(this.tiles, 'stand')
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    const exits = runwayExitCells(this.tiles)
    const orphans = stands.filter((s) => !this.pathStandToRunway(s)).length
    const queues = this.atcQueues()
    let queueWait = 0
    let queueCell: { c: number; r: number } | null = null
    let queueCount = 0
    for (const q of queues) {
      queueCount += q.count
      if (q.longest >= queueWait) {
        queueWait = q.longest
        queueCell = q.cell
      }
    }
    const stuck = this.flights.find(
      (f) =>
        !f.ga &&
        (f.craft ?? 'jet') === 'jet' &&
        (TIP_PHASES as readonly string[]).includes(f.phase) &&
        f.phaseTime >= TIP_STUCK_SEC,
    )
    const fuelCell = tilesOf(this.tiles, 'fuel')[0] ?? null
    const litres = this.groundSnapshot() ? this.tankLitres : undefined
    const hall = this.fits[0]
    const runwayCell = strips[0]?.[0] ?? exits[0] ?? null
    return {
      site: true,
      sandbox: this.sandbox,
      cash: this.cash,
      hasRunway: strips.length > 0,
      stands: stands.length,
      exits: exits.length,
      orphans,
      queueWait,
      queueCount,
      hallQueue: this.securityQueueCount(),
      fuelEmpty: Boolean(fuelCell) && typeof litres === 'number' && litres <= 0 && this.signed.length > 0,
      stuck: Boolean(stuck),
      runwayCell,
      queueCell,
      hallCell: hall ? { c: hall.origin.c, r: hall.origin.r } : null,
      fuelCell,
      stuckCell: stuck ? { c: Math.round(stuck.x), r: Math.round(stuck.y) } : null,
    }
  }

  /** Settings → All hints enabled. The only way muted kinds come back. */
  setAllHints(on: boolean) {
    this.hintPrefs = setAllHintsEnabled(on)
    writeHintSettings(this.hintPrefs)
    if (!on && this.sidePanel === 'hints') this.sidePanel = null
    this.emit()
  }

  setSidePanel(panel: 'hud' | 'hints' | null) {
    if (this.sidePanel === panel) return
    this.sidePanel = panel
    this.emit()
  }

  /** Move the camera to a spot and mark it. Hall cells use the hall grid, apron cells the field grid. */
  focusAt(at: AlertFocus) {
    const cell = at.cells[0]
    if (at.view === 'hall') {
      if (!this.fits.length) return
      if (at.hall) {
        const fit = this.fitByKey(at.hall)
        if (fit) this.selectedTile = { ...fit.origin }
      }
      this.advisorCells = at.cells
      this.apronFocus = []
    } else {
      this.apronFocus = at.cells
      this.advisorCells = []
    }
    if (this.view !== at.view) this.setView(at.view)
    if (cell) this.camGoal = { view: at.view, c: cell.c, r: cell.r, seq: (this.camGoal?.seq ?? 0) + 1 }
    this.emit()
  }

  /** Hint panel "Show me": pan to the note and highlight it. */
  showHint(id: string) {
    const hit = this.advice.find((a) => a.id === id)
    if (!hit) return
    const view = hit.scope === 'apron' ? 'apron' : 'hall'
    const fit = this.activeHall() ?? this.fits[0]
    if (view === 'hall' && !hit.cells.length && fit) {
      // No cell to point at: still walk inside so the player sees the hall in question.
      this.focusAt({ view, cells: [], hall: this.hallKey(fit) })
      return
    }
    this.focusAt({ view, cells: hit.cells, hall: fit ? this.hallKey(fit) : undefined })
  }

  /** Alert "Pan to problem". */
  panToAlert(id: string) {
    const a = this.alerts.active.find((x) => x.id === id)
    if (a?.at) this.focusAt(a.at)
  }

  dismissAlert(id: string) {
    this.alerts.dismiss(id, this.clock)
    this.emit()
  }

  ignoreAlert(id: string) {
    this.alerts.ignore(id)
    this.emit()
  }

  minimiseAlerts(on: boolean) {
    this.alerts.setMinimised(on)
    this.emit()
  }

  /** Raise an operational alert. Debounced by key inside the stack. */
  raiseAlert(input: AlertInput) {
    const fresh = !this.alerts.active.some((a) => a.key === input.key)
    const before = this.alerts.rev
    const row = this.alerts.raise(input, this.clock)
    if (
      fresh &&
      row &&
      (input.severity === 'critical' || input.severity === 'warning') &&
      this.clock - this.alertChimeAt >= 2.5
    ) {
      this.alertChimeAt = this.clock
      this.noteSound('disruption')
    }
    if (this.alerts.rev !== before) this.emit()
  }

  /** Tests and recovery use this. Refuses anything before mid-game. */
  triggerDisruption(kind: DisruptionId) {
    const started = this.disruptions.trigger(kind, this.disruptionWorld(), this.disruptionHost())
    if (started) this.noteStartedDisruption(started)
    this.syncDisruptionAlert()
    if (started) this.emit()
    return started
  }

  /** One line in the open year. Recovery cost is the estimated loss, noted once at the start. */
  private noteStartedDisruption(started: { kind: string; recoveryCost: number; day: number }) {
    const impact = Number.isFinite(started.recoveryCost) ? Math.max(0, started.recoveryCost) : 0
    this.noteDisruption(started.kind, impact, started.day)
  }

  recoverDisruption(id: string) {
    const result = this.disruptions.recover(id, this.disruptionHost())
    this.syncDisruptionAlert()
    this.emit()
    return result
  }

  /** Beds stamped on the field. Ash diversions need these, eight per aircraft. */
  hotelRoomCount(): number {
    let beds = this.hotelLevel > 0 ? 6 : 0
    for (const p of tilesOf(this.tiles, 'hotel')) {
      const cls = this.hotelClass[`${p.c},${p.r}`] ?? 'business'
      beds += cls === 'inn' ? 5 : cls === 'resort' ? 12 : 8
    }
    return beds
  }

  /** One timetable wave: same strip, same 40-second bucket. */
  private flightBanks(): FlightBank[] {
    const groups = new Map<string, FlightBank>()
    for (const slot of this.openSchedule()) {
      if (slot.status === 'inbound') continue
      const bucket = Math.floor(slot.eta / 40)
      const rw = slot.runwayPref ?? -1
      const id = `rw${rw}-b${bucket}`
      const label = rw < 0 ? `bank ${bucket + 1}` : `runway ${rw + 1} bank ${bucket + 1}`
      const group = groups.get(id) ?? { id, label, flightIds: [] }
      group.flightIds.push(slot.id)
      groups.set(id, group)
    }
    return [...groups.values()]
  }

  private disruptionWorld(): DisruptionWorld {
    const level = this.fieldLevel()
    const mastery = level >= 5
    return {
      fieldLevel: level,
      goalsComplete: mastery,
      endless: mastery,
      standsFree: this.freeStands().length,
      hotelRooms: this.hotelRoomCount(),
      banks: this.flightBanks(),
      staffPools: ['maintenance', 'security', 'cleaning', 'fire', 'ambulance', 'desk'],
      clock: this.clock,
    }
  }

  /** Publish the live crisis onto the alert stack. One key, so the card cannot duplicate. */
  private syncDisruptionAlert() {
    const event = this.disruptions.active()
    const before = this.alerts.rev
    const live = new Set<string>()
    if (event) {
      const input = disruptionToAlert(event, disruptionLocus(event, this.disruptionField(event)))
      live.add(input.key)
      this.alerts.raise(input, this.clock)
    }
    this.alerts.sync(DISRUPTION_ALERT_PREFIX, live)
    if (this.alerts.rev !== before) this.emit()
  }

  private disruptionField(event: { kind: DisruptionId }): DisruptionLocusField {
    const fit = this.activeHall() ?? this.fits[0]
    const hosted = this.flights
      .filter((f) => f.hostKind === 'divert' && f.stand && f.phase !== 'gone')
      .map((f) => ({ c: f.stand!.c, r: f.stand!.r }))
    const stands = tilesOf(this.tiles, 'stand')
    return {
      stands: event.kind === 'volcanic-ash' && hosted.length ? hosted : stands,
      runways: tilesOf(this.tiles, 'runway'),
      fuel: tilesOf(this.tiles, 'fuel'),
      terminal: tilesOf(this.tiles, 'terminal'),
      fire: tilesOf(this.tiles, 'fire'),
      hangar: tilesOf(this.tiles, 'hangar'),
      tower: tilesOf(this.tiles, 'tower'),
      police: tilesOf(this.tiles, 'police'),
      guard: tilesOf(this.tiles, 'guard'),
      checkin: fit ? this.zoneCellsOf(fit, 'checkin') : [],
      security: fit ? this.zoneCellsOf(fit, 'security') : [],
      hallKey: fit ? this.hallKey(fit) : undefined,
    }
  }

  private tickDisruptions() {
    const started = this.disruptions.advance(this.disruptionWorld(), this.disruptionHost())
    if (started) this.noteStartedDisruption(started)
    this.syncDisruptionAlert()
  }

  /** Tests and debug use this. Still quiet for the first in-game days. */
  triggerOpsEvent(id: string) {
    const started = this.opsEvents.start(id, this.opsWorld())
    if (started) this.onOpsEventStarted(started)
    this.syncOpsAlerts()
    return started
  }

  private opsWorld() {
    const freeStands = () => this.freeStands().map((s) => `${s.c},${s.r}`)
    return { clock: this.clock, level: this.fieldLevel(), freeStands }
  }

  private tickOpsEvents() {
    const started = this.opsEvents.tick(this.opsWorld())
    if (started) this.onOpsEventStarted(started)
    this.syncOpsAlerts()
  }

  /** Delay events push the departures inside the window once, through the normal delay path. */
  private onOpsEventStarted(run: ActiveOpsEvent) {
    this.pushNews(`${run.event.name} — ${run.event.blurb}`, 'bad')
    if (run.event.effect.kind !== 'delay') return
    for (const slot of this.schedule) {
      if (slot.status !== 'scheduled' && slot.status !== 'delayed') continue
      if (slot.eta < run.startedAt || slot.eta >= run.endsAt) continue
      this.delaySlot(slot, run.event.effect.delaySec ?? 0, run.event.name)
    }
  }

  /** One alert row per live ops event. Pan lands on the desks, the lanes, the closed stand, or the runway. */
  private syncOpsAlerts() {
    const before = this.alerts.rev
    const live = new Set<string>()
    for (const run of this.opsEvents.active) {
      const input = { ...opsAlertText(run), at: this.opsFocus(run) }
      live.add(input.key)
      this.alerts.raise(input, this.clock)
    }
    this.alerts.sync(OPS_ALERT_PREFIX, live)
    if (this.alerts.rev !== before) this.emit()
  }

  private opsFocus(run: ActiveOpsEvent): AlertFocus {
    const focus = run.event.focus
    if (focus === 'checkin' || focus === 'security') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit) return { view: 'hall', hall: this.hallKey(fit), cells: this.zoneCellsOf(fit, focus).slice(0, 1) }
    }
    if (focus === 'gate' && run.gateKeys.length) {
      const [c, r] = run.gateKeys[0].split(',').map(Number)
      return { view: 'apron', cells: [{ c, r }] }
    }
    const spot = tilesOf(this.tiles, 'runway')[0] ?? tilesOf(this.tiles, 'terminal')[0]
    return { view: 'apron', cells: spot ? [{ c: spot.c, r: spot.r }] : [] }
  }

  private disruptionHost(): DisruptionHost {
    return {
      acceptWeatherDivert: (ask) => this.acceptWeatherDivert(ask),
      postCash: (amount, reason) => this.postDisruptionCash(amount, reason),
      delayBank: (ids, sec, reason) => this.delayDisruptionBank(ids, sec, reason),
      rebookBank: (ids) => this.rebookDisruptionBank(ids),
      news: (text, tone) => this.pushNews(text, tone),
    }
  }

  /**
   * Land one ash divert on the existing divert path.
   * The ask matches a weather divert; the aircraft still comes from spawnEmergencyDivert.
   */
  private acceptWeatherDivert(ask: { hotelRooms: number }): { hosted: boolean } {
    if (!(ask.hotelRooms > 0)) return { hosted: false }
    const airline = this.signed.find((id) => !this.isBanned(id))
    if (!airline || this.freeStands().length < 1) return { hosted: false }
    if (!this.spawnEmergencyDivert(airline)) return { hosted: false }
    this.postDisruptionCash(DIVERT_FEE_MIN, 'Ash divert landing')
    return { hosted: true }
  }

  private postDisruptionCash(amount: number, reason: string) {
    const n = finiteAmount(amount)
    if (n === 0) return
    if (!Number.isFinite(this.cash)) this.cash = 0
    if (n > 0) this.earn(n, reason)
    else this.charge(-n)
    if (!Number.isFinite(this.cash)) this.cash = 0
  }

  private delayDisruptionBank(ids: string[], sec: number, reason: string) {
    for (const id of ids) {
      const slot = this.schedule.find((s) => s.id === id)
      if (!slot || (slot.status !== 'scheduled' && slot.status !== 'delayed')) continue
      this.delaySlot(slot, sec, reason)
    }
  }

  private rebookDisruptionBank(ids: string[]) {
    for (const id of ids) {
      const slot = this.schedule.find((s) => s.id === id)
      if (!slot || slot.status !== 'delayed') continue
      slot.status = 'scheduled'
      slot.delayReason = 'Rebanked after the storm'
    }
  }

  /** Live condition scan. Throttled; cheap reads only. */
  private scanAlerts(dt: number) {
    this.alerts.tick(this.clock)
    this.alertScanCool -= dt
    if (this.alertScanCool > 0) return
    this.alertScanCool = ALERT_TUNING.scanSec
    const T = ALERT_TUNING
    const live = new Set<string>()
    const raise = (input: AlertInput) => {
      live.add(input.key)
      this.raiseAlert(input)
    }

    for (const f of this.flights) {
      if ((f.craft ?? 'jet') !== 'jet') continue
      const onGround = (STUCK_PHASES as readonly string[]).includes(f.phase)
      const stuck = (onGround && f.phaseTime > T.stuckSec) || (f.phase === 'hold' && f.phaseTime > T.holdStuckSec)
      if (!stuck) continue
      const spot = f.path[f.seg] ?? f.path[f.path.length - 1] ?? f.stand
      raise({
        key: `cond:stuck:${f.id}`,
        severity: 'warning',
        title: f.phase === 'hold' ? `${f.flightNo} stuck in the hold` : `${f.flightNo} stuck on the ground`,
        detail:
          f.phase === 'hold'
            ? 'No free stand or runway slot to land into.'
            : `No progress for ${Math.round(f.phaseTime)}s. Check the taxi route and stand.`,
        at: spot ? { view: 'apron', cells: [{ c: spot.c, r: spot.r }] } : undefined,
      })
    }

    for (const q of this.atcQueues()) {
      if (q.longest < this.atc.tune.longWaitSec) continue
      raise({
        key: q.runway ? `cond:atc-holdshort:${q.cell.c},${q.cell.r}` : `cond:atc-queue:${q.cell.c},${q.cell.r}`,
        severity: q.count >= 3 || q.longest > 60 ? 'critical' : 'warning',
        title: q.runway
          ? `${q.count} departure${q.count === 1 ? '' : 's'} holding short`
          : `Taxi queue: ${q.count} aircraft`,
        detail: q.runway
          ? `Waiting ${Math.round(q.longest)}s for the runway. Arrivals have right of way; a second runway or more exits clears it.`
          : `Waiting ${Math.round(q.longest)}s behind traffic on a single lane. Add a parallel taxiway or a bypass.`,
        at: { view: 'apron', cells: [q.cell] },
      })
    }

    const ground = this.ground?.snapshot()
    const farm = tilesOf(this.tiles, 'fuel')[0]
    if (ground && farm && this.tankLitres <= 0) {
      raise({
        key: 'cond:fuel-out',
        severity: 'critical',
        title: 'Fuel farm is empty',
        detail: 'Departures needing fuel will wait until the next tanker arrives.',
        at: { view: 'apron', cells: [farm] },
      })
    }

    const fit = this.activeHall()
    if (fit && this.hallOverloaded) {
      const key = this.hallKey(fit)
      raise({
        key: `cond:hall-full:${key}`,
        severity: 'warning',
        title: `${this.hallLabel(fit)} over capacity`,
        detail: 'Queues are longer than this hall can clear.',
        at: { view: 'hall', hall: key, cells: this.zoneCellsOf(fit, 'security').slice(0, 1) },
      })
    }
    for (const f of this.fits) {
      if (f.build) for (const a of buildAlerts(f.build, this.hallKey(f), this.hallLabel(f))) raise(a)
    }
    for (const f of this.fits) {
      const full = ((f.items ?? []) as PlacedItem[]).filter((it) => isBin(it) && binFull(it))
      const pieces = f.litter?.length ?? 0
      if (!full.length || pieces < LITTER_TUNING.adviseLitterAt) continue
      const key = this.hallKey(f)
      raise({
        key: `cond:bins:${key}`,
        severity: 'warning',
        title: `${this.hallLabel(f)}: bins full, litter piling up`,
        detail: `${full.length} full can${full.length === 1 ? '' : 's'}, ${pieces} pieces on the floor.`,
        at: { view: 'hall', hall: key, cells: full.map((b) => ({ c: b.c, r: b.r })) },
      })
    }

    if (!this.sandbox && this.cash < T.lowCash) {
      raise({
        key: 'cond:cash',
        severity: this.cash < 0 ? 'critical' : 'warning',
        title: this.cash < 0 ? 'Cash is negative' : 'Cash is low',
        detail: `${moneyLeft(this.cash)} in the bank. Upkeep and payroll keep drawing.`,
      })
    }
    this.alerts.sync('cond:', live)
    this.refreshTips()
  }

  private zoneCellsOf(fit: TerminalFit, zone: ZoneId): { c: number; r: number }[] {
    const out: { c: number; r: number }[] = []
    fit.zones?.forEach((row, r) =>
      row.forEach((z, c) => {
        if (z === zone) out.push({ c, r })
      }),
    )
    return out
  }

  focusAdvice(id: string | null) {
    if (!id) {
      this.advisorCells = []
      this.apronFocus = []
      this.emit()
      return
    }
    const hit = this.advice.find((a) => a.id === id)
    if (hit?.scope === 'apron') {
      const same =
        hit.cells.length === this.apronFocus.length &&
        hit.cells.every((c, i) => c.c === this.apronFocus[i]?.c && c.r === this.apronFocus[i]?.r)
      this.apronFocus = same ? [] : hit.cells
      this.advisorCells = []
      if (!same && hit.cells[0]) this.cameraCue = { c: hit.cells[0].c, r: hit.cells[0].r }
      this.emit()
      return
    }
    this.apronFocus = []
    const same =
      hit &&
      hit.cells.length === this.advisorCells.length &&
      hit.cells.every((c, i) => c.c === this.advisorCells[i]?.c && c.r === this.advisorCells[i]?.r)
    this.advisorCells = hit && !same ? hit.cells : []
    this.emit()
  }

  toggleFlows() {
    this.showFlows = !this.showFlows
    this.emit()
  }

  /** Service vehicles on the apron. Empty until a vehicle depot and a fuel farm exist. */
  servicePoses() {
    const poses = this.ensureGround()?.sim.poses() ?? []
    return poses.map((pose) => this.placeServicePose(pose))
  }

  /**
   * Slide a docking vehicle off the road node onto its hose, door, hold or bay.
   * The logistics pose stays in cells; the offset is real metres.
   */
  private placeServicePose<T extends { x: number; y: number; heading: number; phase: string; u: number; dock?: { phase: 'idle' | 'route' | 'approach' | 'align' | 'service' | 'depart'; u: number; localX: number; localY: number; heading: number; owner: 'stand' | 'building'; standId: string | null } }>(
    pose: T,
  ): T & { drawX?: number; drawY?: number; drawHeading?: number } {
    const dock = pose.dock
    if (!dock) return pose
    const h = dock.owner === 'stand' ? this.headingForStand(dock.standId) : 0
    const c = Math.cos(h)
    const s = Math.sin(h)
    const dx = (dock.localX * c - dock.localY * s) / METERS_PER_CELL
    const dy = (dock.localX * s + dock.localY * c) / METERS_PER_CELL
    const shown = shownPhase(dock.phase, dock.u)
    // x/y stay on the service road. drawX/drawY are the bay the mesh and the camera use.
    return {
      ...pose,
      ...(shown ? { phase: shown.phase, u: shown.u } : {}),
      drawX: pose.x + dx,
      drawY: pose.y + dy,
      drawHeading: h + dock.heading,
    }
  }

  private headingForStand(standId: string | null): number {
    if (!standId) return 0
    const flight = this.flights.find((f) => f.groundTurn === standId && f.phase !== 'gone')
    if (flight) return flight.heading
    const [c, r] = standId.split(',').map(Number)
    if (!Number.isFinite(c) || !Number.isFinite(r)) return 0
    const parked = this.flights.find((f) => f.stand && f.stand.c === c && f.stand.r === r && f.phase !== 'gone')
    return parked?.heading ?? 0
  }

  /** Live or finished A–F grade for a flight the ground module is turning. */
  liveTurnGrade(f: Flight): { grade: string; note: string } | null {
    if (f.turnGrade) return { grade: f.turnGrade, note: f.turnGradeNote ?? '' }
    if (!f.groundTurn) return null
    return this.ensureGround()?.sim.turnGrade(f.groundTurn) ?? null
  }

  /** Metres the pushback tug has shoved this nose. The flight's own pushback path takes over after that. */
  pushbackRollMetres(f: Flight): number {
    if (!f.groundTurn || f.phase === 'pushback' || f.phase === 'taxi_out' || f.phase === 'takeoff') return 0
    return this.ground?.sim.pushbackRoll(f.groundTurn) ?? 0
  }

  /**
   * Driver and helper for a fuel, bag, or catering stop.
   * Steps fill the sim's service window. Parked crew stay in the cab and are omitted.
   */
  crewScene(): CrewScene {
    const services = this.serviceClocks()
    for (const clock of this.turnaroundClocks(services)) services.push(clock)
    const scene = assembleCrew({
      services,
      catering: this.cateringPoses().map((pose) => ({
        id: pose.id,
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        phase: pose.phase,
        phaseU: pose.phaseU,
      })),
      metersPerUnit: METERS_PER_CELL,
      aircraftFor: (x, y) => this.aircraftAim(x, y),
    })
    for (const clock of this.paxClocks()) {
      const sample = samplePax(clock)
      scene.people.push(...sample.people)
      scene.props.push(...sample.props)
    }
    for (const arrival of this.standArrivals()) {
      standCrewPeople(arrival, METERS_PER_CELL, scene.people)
      standProps(arrival, METERS_PER_CELL, scene.props)
    }
    return scene
  }

  /**
   * Aircraft arriving on or sitting at a stand, timed for the marshaller,
   * chocks and cones. Guiding starts a few cells out on the taxi-in; chocks
   * and cones stay until pushback.
   */
  standArrivals(): StandArrival[] {
    const out: StandArrival[] = []
    for (const f of this.flights) {
      if (!f.stand || f.craft === 'helo') continue
      let t: number
      if (f.phase === 'taxi_in') {
        const d = Math.hypot(f.x - f.stand.c, f.y - f.stand.r)
        if (d > STAND_TIMELINE.guideCells) continue
        t = STAND_TIMELINE.taxi * (1 - d / STAND_TIMELINE.guideCells)
      } else if (f.phase === 'deboard') t = STAND_TIMELINE.taxi + f.phaseTime
      else if (f.phase === 'servicing' || f.phase === 'board' || f.phase === 'parked') t = STAND_TIMELINE.settled
      else continue
      const spec = getAircraftSpec(f.airframeId || 'b738')
      out.push({ id: f.id, x: f.x, y: f.y, heading: f.heading, lengthM: spec.lengthM, spanM: spec.spanM, t })
    }
    return out
  }

  /**
   * The GPU cart, cleaning van and pushback tug behind the crew of a
   * turnaround the logistics module is not already drawing. Same clocks as
   * crewScene, so the crew always have their equipment under them.
   */
  turnaroundEquipment(): { id: string; kind: string; x: number; y: number; heading: number }[] {
    const kinds: Partial<Record<CrewClock['service'], string>> = { cleaning: 'van', gpu: 'gpu', pushback: 'pushback_tug' }
    const out: { id: string; kind: string; x: number; y: number; heading: number }[] = []
    for (const clock of this.turnaroundClocks(this.serviceClocks())) {
      const kind = kinds[clock.service]
      if (kind) out.push({ id: clock.id, kind, x: clock.x, y: clock.y, heading: clock.heading })
    }
    return out
  }

  /** Logistics vehicles and legacy trucks currently on a service stop. */
  private serviceClocks(): CrewClock[] {
    const services: CrewClock[] = []
    const ground = this.ground?.sim
    if (ground) {
      const drawn = new Map(this.servicePoses().map((pose) => [pose.id, pose]))
      for (const job of ground.activeCrew()) {
        // Lav / water trucks run their hose from the cab: no walking crew yet.
        if (job.service === 'lav' || job.service === 'water') continue
        const at = drawn.get(job.id)
        services.push({
          id: job.id,
          service: job.service,
          x: at?.drawX ?? job.x,
          y: at?.drawY ?? job.y,
          heading: at?.drawHeading ?? job.heading,
          start: job.start,
          end: job.end,
          now: ground.now,
        })
      }
    }
    for (const truck of this.trucks) {
      const clock = this.legacyCrewClock(truck)
      if (clock) services.push(clock)
    }
    return services
  }

  /** Jet bridge reach, 0 retracted and 1 docked. Other phases keep the bridge shut. */
  bridgeExtend(flightId: string): number {
    const flight = this.flights.find((item) => item.id === flightId)
    if (!flight?.stand || flight.cargo || this.standPaxMode(flight.stand) !== 'jetway') return 0
    if (flight.phase === 'servicing' || flight.phase === 'parked') return bridgeHold()
    if (flight.phase !== 'deboard' && flight.phase !== 'board') return 0
    return samplePax(this.paxClock(flight)).extend
  }

  /** Apron capsules stand down while the boarding picture draws these passengers. */
  paxPicture(flightId: string): boolean {
    const flight = this.flights.find((item) => item.id === flightId)
    return !!flight && !flight.cargo && (flight.phase === 'deboard' || flight.phase === 'board')
  }

  private aircraftAim(x: number, y: number): AircraftAim | undefined {
    let best: Flight | undefined
    let bestD = 1.4
    for (const flight of this.flights) {
      if (!flight.stand || flight.phase === 'gone' || flight.phase === 'hold') continue
      const d = Math.hypot(flight.x - x, flight.y - y)
      if (d < bestD) {
        bestD = d
        best = flight
      }
    }
    if (!best) return undefined
    const spec = getAircraftSpec(best.airframeId || 'b738')
    return {
      x: best.x,
      y: best.y,
      heading: best.heading,
      lengthM: spec.lengthM,
      spanM: spec.spanM,
      wingAt: spec.wingAt,
    }
  }

  /** Legacy bowser / cart / galley truck. The dwell it was given is the whole service. */
  private legacyCrewClock(t: Truck): CrewClock | null {
    if (t.returning || !(t.dwell > 0) || !(t.serviceFor && t.serviceFor > 0)) return null
    let service: CrewClock['service'] | null = null
    if (t.kind === 'fuel' && t.mission === 'fuel') service = 'fuel'
    else if (t.kind === 'bags' && (t.mission === 'load' || t.mission === 'unload')) service = 'bags'
    else if (t.kind === 'catering') service = 'catering'
    if (!service) return null
    const total = t.serviceFor
    return {
      id: t.id,
      service,
      x: t.x,
      y: t.y,
      heading: pathHeading(t.path),
      start: 0,
      end: total,
      now: Math.min(total, Math.max(0, total - t.dwell)),
    }
  }

  /**
   * Cleaning, ground power, and the pushback tug when the logistics module
   * has not already parked a vehicle on that job. The window is the flight
   * phase the sim already uses.
   */
  private turnaroundClocks(existing: CrewClock[]): CrewClock[] {
    const clocks: CrewClock[] = []
    const has = (service: CrewClock['service'], x: number, y: number) =>
      existing.some((job) => job.service === service && Math.hypot(job.x - x, job.y - y) < 2.5)
    for (const flight of this.flights) {
      if (!flight.stand || flight.cargo || flight.kind === 'military') continue
      const pace = this.rampPace(flight.airframeId, false, flight.airline)
      const door = this.paxDoor(flight)
      const origin = { x: flight.x, y: flight.y, heading: flight.heading }
      if (flight.phase === 'servicing') {
        const end = 4 * pace
        const now = Math.min(end, Math.max(0, flight.phaseTime))
        if (!has('cleaning', flight.x, flight.y)) {
          const at = placeLocal(origin, { x: door.x - 1.4, y: 0, z: door.z + Math.sign(door.z || 1) * 3.2 }, METERS_PER_CELL)
          clocks.push({
            id: `${flight.id}:clean`,
            service: 'cleaning',
            x: at.c,
            y: at.r,
            heading: flight.heading + Math.PI / 2,
            start: 0,
            end,
            now,
            aim: { x: 2.2, z: Math.sign(door.z || 1) * 2.4 },
          })
        }
        if (!has('gpu', flight.x, flight.y) && !this.cableLive(flight.stand)) {
          const spec = getAircraftSpec(flight.airframeId || 'b738')
          const at = placeLocal(origin, { x: spec.lengthM * 0.22, y: 0, z: door.z + Math.sign(door.z || 1) * 2.4 }, METERS_PER_CELL)
          clocks.push({
            id: `${flight.id}:gpu`,
            service: 'gpu',
            x: at.c,
            y: at.r,
            heading: flight.heading,
            start: 0,
            end,
            now,
            aim: { x: 1.6, z: -Math.sign(door.z || 1) * 2.2 },
          })
        }
      }
      if (flight.phase === 'pushback' && !has('pushback', flight.x, flight.y)) {
        const spec = getAircraftSpec(flight.airframeId || 'b738')
        const end = 2.8
        const at = placeLocal(origin, { x: spec.lengthM * 0.5 + 4, y: 0, z: 0.4 }, METERS_PER_CELL)
        clocks.push({
          id: `${flight.id}:tug`,
          service: 'pushback',
          x: at.c,
          y: at.r,
          heading: flight.heading + Math.PI,
          start: 0,
          end,
          now: Math.min(end, Math.max(0, flight.phaseTime)),
          // Wing walker: tug-local metres to just outside the wingtip (the tug faces the aircraft).
          aim: { x: 4 + spec.lengthM * spec.wingAt + spec.spanM * 0.15, z: spec.spanM / 2 + SERVICE_POINTS.wingWalkOut },
        })
      }
    }
    return clocks
  }

  private paxDoor(flight: Flight): PaxDoor {
    const spec = getAircraftSpec(flight.airframeId || 'b738')
    const side = this.paxSide(flight)
    const door = spec.doors.find((item) => item.kind === 'pax' && item.side === side) ?? spec.doors.find((item) => item.kind === 'pax')
    const t = door?.t ?? 0.16
    const signed = door && door.side !== 0 ? door.side : side
    return {
      x: spec.lengthM * (0.5 - t),
      z: signed * (spec.rx + 0.55),
      sill: Math.max(2.5, spec.gear * 0.45 + 2.1),
    }
  }

  private paxSide(flight: Flight): 1 | -1 {
    if (!flight.stand) return 1
    const hall = this.jetwayHall(flight.stand)
    const gate = hall?.origin ?? this.nearestFit(flight.stand)
    if (!gate) return 1
    return bridgeMirror(flight.heading, flight.stand, gate)
  }

  private nearestFit(stand: { c: number; r: number }): { c: number; r: number } | null {
    let best: { c: number; r: number } | null = null
    let bestD = Infinity
    for (const fit of this.fits) {
      const d = Math.abs(fit.origin.c - stand.c) + Math.abs(fit.origin.r - stand.r)
      if (d < bestD) {
        bestD = d
        best = fit.origin
      }
    }
    return best
  }

  private paxMode(flight: Flight): PaxMode {
    const mode = flight.stand ? this.standPaxMode(flight.stand) : 'walk'
    if (mode === 'jetway') return 'bridge'
    if (mode === 'bus') return 'bus'
    return 'stairs'
  }

  private paxClocks(): PaxClock[] {
    const clocks: PaxClock[] = []
    for (const flight of this.flights) {
      if (!flight.stand || flight.cargo) continue
      if (flight.phase !== 'deboard' && flight.phase !== 'board') continue
      clocks.push(this.paxClock(flight))
    }
    return clocks
  }

  private paxClock(flight: Flight): PaxClock {
    const leg = flight.phase === 'board' ? 'board' : 'deplane'
    const mode = this.paxMode(flight)
    const pace = this.rampPace(flight.airframeId, false, flight.airline)
    const end =
      leg === 'deplane'
        ? (mode === 'bridge' ? 3.2 : mode === 'bus' ? 4.5 : 6) * pace
        : (mode === 'bridge' ? (flight.boardingSlow ? 5 : 3.2) : flight.boardingSlow ? 9 : 5) * pace
    const gate = this.paxGate(flight)
    const bus = this.trucks.find((truck) => truck.kind === 'termbus' && truck.flightId === flight.id && !truck.returning)
    const riding = mode === 'bus' && !!bus && !(bus.dwell > 0) && !(bus.preDwell > 0)
    return {
      id: flight.id,
      mode,
      leg,
      start: 0,
      end: Math.max(0.4, end),
      now: Math.max(0, flight.phaseTime),
      aircraft: { x: flight.x, y: flight.y, heading: flight.heading },
      door: this.paxDoor(flight),
      gate,
      riding,
      metersPerUnit: METERS_PER_CELL,
    }
  }

  private paxGate(flight: Flight): { x: number; y: number } {
    const depot = tilesOf(this.tiles, 'termbus')[0]
    if (flight.stand && this.standPaxMode(flight.stand) === 'bus' && depot) return { x: depot.c, y: depot.r }
    const hall = flight.stand ? this.jetwayHall(flight.stand) : null
    const fit = hall?.origin ?? (flight.stand ? this.nearestFit(flight.stand) : null)
    return fit ? { x: fit.c, y: fit.r } : { x: flight.x, y: flight.y }
  }

  /** Fuel, meals, and how many trucks are out. Null before the depot is built. */
  groundSnapshot() {
    return this.ensureGround()?.snapshot() ?? null
  }

  /** True once the module has released this stand. Flights without a ground turn are clear. */
  groundClear(f: Flight): boolean {
    if (!f.groundTurn) return true
    return this.ground?.isReadyToDepart(f.groundTurn) ?? true
  }

  /** Servings a full shelf holds. Empty rooms hold nothing. */
  shelfCap(kind: 'food' | 'shop'): number {
    let rooms = 0
    let extra = 0
    for (const fit of this.fits) {
      rooms += kind === 'food' ? (fit.rooms.food ?? 0) : (fit.rooms.souvenir ?? 0)
      if (kind === 'food') extra += outletExtraStock((fit.items ?? []) as PlacedItem[])
    }
    return rooms * (kind === 'food' ? 8 : 6) + extra
  }

  /** This airframe uplifts fuel. A zero-fuel type is free to leave. */
  departureNeedsFuel(f: Flight): boolean {
    try {
      return needsFor(f.airframeId).fuelLitres > 0
    } catch {
      const load = AIRFRAMES[f.airframeId]?.fuelLoad
      return load == null ? true : load > 0
    }
  }

  /** Farm, contract, or bowser loads can still put fuel on a wing. */
  fuelOnHand(): boolean {
    const snap = this.groundSnapshot()
    if (snap) return this.tankLitres >= 1
    return (
      tilesOf(this.tiles, 'fuel').length > 0 && this.fuelBrand != null && this.fuelLoads >= 1
    )
  }

  /** Empty farm or no contract. Low stock is a delay, not a ground. */
  fuelOutage(f: Flight): boolean {
    if (!this.departureNeedsFuel(f) || f.posted.fuel) return false
    if (!this.fuelOnHand()) return true
    return this.catering?.fuel.isGrounded(f.id) ?? false
  }

  /**
   * Pushback gate. An empty farm holds the aircraft.
   * Any other ramp gap may release once the safety timer runs out, with a Standing hit.
   */
  rampCall(f: Flight, timedOut: boolean): 'hold' | 'ready' | 'short' {
    if (this.departureNeedsFuel(f) && !f.posted.fuel) {
      if (!this.fuelOnHand()) {
        f.fuelHeld = true
        if (f.fuelHeldSince == null) f.fuelHeldSince = this.clock
        this.noteFuelGround(f)
        if (this.clock - f.fuelHeldSince >= FUEL_OUTAGE_SLOT_SEC) this.cancelForFuel(f)
        return 'hold'
      }
      if (f.fuelHeld) {
        f.fuelHeld = false
        f.fuelHeldSince = undefined
        f.phaseTime = 0
        this.fuelHoldNoted.delete(f.id)
        this.ensureLegacyFuel(f)
        this.pushNews(`${f.flightNo} has fuel again. Pushback waits on the bowser.`, 'ok')
        return 'hold'
      }
      this.ensureLegacyFuel(f)
      if (!timedOut) return 'hold'
      return 'short'
    }
    if (f.fuelHeld) {
      f.fuelHeld = false
      f.fuelHeldSince = undefined
      this.fuelHoldNoted.delete(f.id)
    }
    if (this.groundClear(f)) return 'ready'
    if (!timedOut) return 'hold'
    return 'short'
  }

  private noteFuelGround(f: Flight) {
    if (this.fuelHoldNoted.has(f.id)) return
    this.fuelHoldNoted.add(f.id)
    this.adjustHeat(f.airline, -1.6)
    if (f.scheduleId) {
      const slot = this.schedule.find((s) => s.id === f.scheduleId)
      if (slot && slot.status !== 'done' && slot.status !== 'cancelled') {
        this.delaySlot(slot, 12, 'Fuel farm empty')
      }
    }
    this.pushNews(
      `${f.flightNo} grounded — no fuel on the farm. It stays until a load arrives.`,
      'bad',
    )
  }

  /** The empty-farm hold outlasted the departure slot. The flight does not leave. */
  private cancelForFuel(f: Flight) {
    if (f.phase === 'gone') return
    f.phase = 'gone'
    f.fuelHeld = false
    this.fuelHoldNoted.delete(f.id)
    const slot = f.scheduleId ? this.schedule.find((s) => s.id === f.scheduleId) : undefined
    if (slot && slot.status !== 'done' && slot.status !== 'cancelled' && slot.status !== 'inbound') {
      slot.status = 'cancelled'
      this.adjustHeat(slot.airline, slot.manual ? -2.2 : -4.2)
      this.schedule = this.schedule.filter((x) => x.status !== 'cancelled' && x.status !== 'done')
    } else {
      this.adjustHeat(f.airline, -4.2)
    }
    this.pushNews(
      `${f.flightNo} cancelled — no fuel before the departure slot. Standing ${Math.round(this.standingOf(f.airline))}.`,
      'bad',
    )
    this.noteDiplomacyCancel(f.airline, false)
    this.noteCargoCancel(f)
    this.noteWave3(f.id, f.airline, classifyTurn({ cancelled: true }))
  }

  /** Legacy bowser, once the farm has a load again. The depot module fuels its own turns. */
  private ensureLegacyFuel(f: Flight) {
    if (f.groundTurn || f.posted.fuel || !f.stand || !this.fuelOnHand()) return
    if (this.trucks.some((t) => t.flightId === f.id && t.kind === 'fuel')) return
    const farms = tilesOf(this.tiles, 'fuel').filter((p) => farmBesidePavement(this.tiles, p))
    if (!farms.length) return
    const path = nearestPath(this.tiles, farms[0], [f.stand], 'truck')
    if (!path) return
    f.waitingOn.fuel = true
    this.spawnTruck('fuel', f, path, 'fuel', farms[0])
  }

  /** Carrier shape the hub share formula reads. Cargo stays at zero. */
  private hubProfile(id: string): CarrierProfile {
    const a = this.airline(id)
    return {
      kind: a.kind,
      bizModel: a.bizModel,
      tier: a.tier,
      hub: this.isHub(id),
      likesLayovers: a.likesLayovers,
    }
  }

  /** Transfer share for one carrier, including the current bank. Zero before mid-game. */
  connectingShare(airlineId: string): number {
    const base = transferShare(this.fieldLevel(), this.hubProfile(airlineId))
    return scaledShare(base, this.hubDemand())
  }

  private hubFacilities(): { transferCentre: boolean; rfid: boolean } {
    let transferCentre = this.hasResearch('transfer_centre')
    let rfid = this.hasResearch('rfid_bag_line')
    const engine = this.economy?.engine
    if (engine) {
      if (engine.getModifier(TECH_TRANSFER_CENTRE, 0) > 0) transferCentre = true
      if (engine.getModifier(TECH_RFID_BAG_LINE, 0) > 0) rfid = true
    }
    return { transferCentre, rfid }
  }

  private hubRide(): boolean {
    const link = this.connectionLink()
    return link !== 'walk' && link !== 'walkway'
  }

  linkStopped(mode: LinkMode): boolean {
    return mode === 'people_mover' ? this.linkDown.mover : this.linkDown.bus
  }

  /** Metres of moving walkway in one hall, or across the field when no hall is named. */
  walkwayCoverMetres(hallId?: string | null): number {
    const length = CONNECTIVITY_CATALOG.moving_walkway.lengthMetres
    let count = 0
    for (const fit of this.fits) {
      if (hallId && this.hallKey(fit) !== hallId) continue
      for (const item of fit.items ?? []) {
        if (item.def === 'walkway') count += 1
      }
    }
    return count * length
  }

  private hallFootprint(fit: TerminalFit): Vec[] {
    const span = fit.premade ? 3 : 2
    const cells: Vec[] = []
    for (let r = 0; r < span; r++) {
      for (let c = 0; c < span; c++) cells.push({ c: fit.origin.c + c, r: fit.origin.r + r })
    }
    return cells
  }

  private skywalkTouches(fit: TerminalFit, cell: Vec): boolean {
    return this.hallFootprint(fit).some(
      (hall) => Math.abs(hall.c - cell.c) + Math.abs(hall.r - cell.r) <= 1,
    )
  }

  /** True when one connected run of skywalk tiles touches both halls. */
  skywalkBetween(fromKey: string, toKey: string): boolean {
    if (fromKey === toKey) return false
    const walks = tilesOf(this.tiles, 'skywalk')
    if (!walks.length) return false
    const from = this.fitByKey(fromKey)
    const to = this.fitByKey(toKey)
    if (!from || !to) return false
    const open = new Set(walks.map((cell) => `${cell.c},${cell.r}`))
    const seen = new Set<string>()
    for (const start of walks) {
      const startKey = `${start.c},${start.r}`
      if (seen.has(startKey)) continue
      const queue = [start]
      seen.add(startKey)
      let hitsFrom = false
      let hitsTo = false
      while (queue.length) {
        const cell = queue.pop()!
        if (this.skywalkTouches(from, cell)) hitsFrom = true
        if (this.skywalkTouches(to, cell)) hitsTo = true
        for (const next of [
          { c: cell.c + 1, r: cell.r },
          { c: cell.c - 1, r: cell.r },
          { c: cell.c, r: cell.r + 1 },
          { c: cell.c, r: cell.r - 1 },
        ]) {
          const key = `${next.c},${next.r}`
          if (!open.has(key) || seen.has(key)) continue
          seen.add(key)
          queue.push(next)
        }
      }
      if (hitsFrom && hitsTo) return true
    }
    return false
  }

  private hallKeyForGate(gateId: string): string | null {
    const [c, r] = gateId.split(',').map((part) => Number(part))
    if (!Number.isFinite(c) || !Number.isFinite(r)) return this.fits[0] ? this.hallKey(this.fits[0]) : null
    const fit = this.roomsAt({ c, r })
    return fit ? this.hallKey(fit) : null
  }

  /** People mover, then the airside bus, then the terminal bus, then a skywalk, then a belt. */
  connectionLink(fromId?: string, toId?: string): PassengerLink {
    const fromHall = fromId ? this.hallKeyForGate(fromId) : null
    const toHall = toId ? this.hallKeyForGate(toId) : null
    const skywalk =
      fromHall != null && toHall != null && fromHall !== toHall && this.skywalkBetween(fromHall, toHall)
    return choosePassengerLink({
      peopleMoverOpen: tilesOf(this.tiles, 'mover').length > 0 && !this.linkDown.mover,
      transferBusOpen: tilesOf(this.tiles, 'xferbus').length > 0 && !this.linkDown.bus,
      terminalBusOpen: tilesOf(this.tiles, 'termbus').length > 0,
      skywalkOpen: skywalk,
      walkwayMetres: this.walkwayCoverMetres(),
    })
  }

  private connectivityTerminals() {
    return this.fits.map((fit) => ({
      id: this.hallKey(fit),
      gateIds: tilesOf(this.tiles, 'stand')
        .filter((stand) => {
          const hall = this.roomsAt(stand)
          return hall != null && this.hallKey(hall) === this.hallKey(fit)
        })
        .map((stand) => `${stand.c},${stand.r}`),
    }))
  }

  /**
   * Close one ride. The people mover names the gates it strands.
   * The transfer bus stops that link and drops its apron traffic.
   */
  breakLink(mode: LinkMode) {
    const terminals = this.connectivityTerminals()
    const ends = terminals.map((terminal) => terminal.id)
    const fromId = ends[0] ?? 'hall'
    const toId = ends[1] ?? 'apron'
    const attempt = linkTerminals(fromId, toId, mode, mode)
    if (!attempt.ok) return
    const stopped = breakdown(attempt.link, terminals)
    if (mode === 'people_mover') this.linkDown.mover = true
    else this.linkDown.bus = true
    if (stopped.event.strandsGates) this.strandedGates = [...stopped.event.strandedGateIds]
    else if (!this.linkDown.mover) this.strandedGates = []
    this.linkExplanation = stopped.event.explanation
    this.pushNews(stopped.event.explanation, 'bad')
    this.emit()
  }

  linkRepairOffer(): { mode: LinkMode; label: string; cost: number } | null {
    if (this.linkDown.mover && tilesOf(this.tiles, 'mover').length > 0) {
      const spec = CONNECTIVITY_CATALOG.people_mover
      return {
        mode: 'people_mover',
        label: `Repair the people mover · $${spec.repairCost.toLocaleString('en-US')}`,
        cost: spec.repairCost,
      }
    }
    if (this.linkDown.bus && tilesOf(this.tiles, 'xferbus').length > 0) {
      const spec = CONNECTIVITY_CATALOG.airside_transfer_bus_depot
      return {
        mode: 'airside_transfer_bus',
        label: `Repair the transfer bus · $${spec.repairCost.toLocaleString('en-US')}`,
        cost: spec.repairCost,
      }
    }
    return null
  }

  repairLink(mode: LinkMode) {
    const down = this.linkStopped(mode)
    if (!down) return
    const spec = CONNECTIVITY_CATALOG[mode === 'people_mover' ? 'people_mover' : 'airside_transfer_bus_depot']
    if (!this.spend(spec.repairCost, spec.name)) return
    if (mode === 'people_mover') {
      this.linkDown.mover = false
      this.linkWear.mover = 0
    } else {
      this.linkDown.bus = false
      this.linkWear.bus = 0
    }
    this.strandedGates = []
    this.linkExplanation = ''
    this.pushNews(`${spec.name} running again.`, 'good')
    this.emit()
  }

  private connectivityUpkeep(): number {
    const ids: ConnectivityBuildingId[] = []
    for (const [key, kind] of Object.entries(this.hubLinksBuilt)) {
      const [c, r] = key.split(',').map((part) => Number(part))
      const tile = this.tile({ c, r })
      if (kind === 'people_mover' && tile === 'mover') ids.push('people_mover')
      else if (kind === 'xferbus' && tile === 'xferbus') ids.push('airside_transfer_bus_depot')
      else if (kind === 'skywalk' && tile === 'skywalk') ids.push('skywalk')
    }
    return linkDailyUpkeep(ids)
  }

  private hubStampCount(kind: 'people_mover' | 'xferbus' | 'skywalk', tile: Tile): number {
    let n = 0
    for (const [key, built] of Object.entries(this.hubLinksBuilt)) {
      if (built !== kind) continue
      const [c, r] = key.split(',').map((part) => Number(part))
      if (this.tile({ c, r }) === tile) n += 1
    }
    return n
  }

  private ageLinks() {
    if (this.budgets.maintenance >= LINK_MAINT_SAFE) return
    const wear = (built: boolean, current: number, mode: LinkMode) => {
      if (!built || this.linkStopped(mode)) return current
      const next = current + LINK_WEAR_PER_DAY
      if (next >= LINK_WEAR_BREAK) this.breakLink(mode)
      return next
    }
    this.linkWear.mover = wear(tilesOf(this.tiles, 'mover').length > 0, this.linkWear.mover, 'people_mover')
    this.linkWear.bus = wear(tilesOf(this.tiles, 'xferbus').length > 0, this.linkWear.bus, 'airside_transfer_bus')
  }

  private linkWord(link: PassengerLink): string {
    if (link === 'people_mover') return 'people mover'
    if (link === 'airside_transfer_bus') return 'transfer bus'
    if (link === 'terminal_bus') return 'terminal bus'
    if (link === 'skywalk') return 'skywalk'
    if (link === 'walkway') return 'moving walkway'
    return 'walk'
  }

  linkLines(): string[] {
    const mover = tilesOf(this.tiles, 'mover').length
    const bus = tilesOf(this.tiles, 'xferbus').length
    const sky = tilesOf(this.tiles, 'skywalk').length
    const belts = this.walkwayCoverMetres()
    const moverSpec = CONNECTIVITY_CATALOG.people_mover
    const busSpec = CONNECTIVITY_CATALOG.airside_transfer_bus_depot
    const lines = [
      mover
        ? this.linkDown.mover
          ? `People mover stopped — ${this.strandedGates.length} gates stranded`
          : `People mover open · ${moverSpec.rideMinutes} min · ${moverSpec.paxPerHour.toLocaleString('en-US')}/h · $${moverSpec.upkeepPerDay.toLocaleString('en-US')}/day`
        : `People mover not built · Field ${moverSpec.fieldLevel}`,
      bus
        ? this.linkDown.bus
          ? 'Airside transfer bus stopped — that link is closed'
          : `Transfer bus open · ${busSpec.rideMinutes} min · apron +${busSpec.apronTrafficPerHour}/h · $${busSpec.upkeepPerDay.toLocaleString('en-US')}/day`
        : `Transfer bus not built · Field ${busSpec.fieldLevel}`,
      tilesOf(this.tiles, 'termbus').length
        ? 'Terminal bus fallback open'
        : 'No terminal bus — remote stands still walk',
      sky ? `${sky} skywalk${sky === 1 ? '' : 's'} · $${(sky * CONNECTIVITY_CATALOG.skywalk.upkeepPerDay).toLocaleString('en-US')}/day` : 'No skywalk',
      belts > 0
        ? `Moving walkways cover ${belts} m at ×${CONNECTIVITY_CATALOG.moving_walkway.speedMult}`
        : 'No moving walkway',
    ]
    if (this.linkExplanation) lines.push(this.linkExplanation)
    return lines
  }

  private hubGates(): GatePoint[] {
    return tilesOf(this.tiles, 'stand').map((stand) => ({
      id: `${stand.c},${stand.r}`,
      x: stand.c * METERS_PER_CELL,
      y: stand.r * METERS_PER_CELL,
    }))
  }

  private hubMovements(): Movement[] {
    const moves: Movement[] = []
    for (const slot of this.schedule) {
      if (slot.status === 'cancelled' || slot.status === 'done') continue
      const airline = this.airline(slot.airline)
      if (airline.kind === 'cargo') continue
      const gateId = slot.standPref ? `${slot.standPref.c},${slot.standPref.r}` : 'stand'
      const arrival = slot.eta * SIM_MINUTES_PER_REAL_SECOND
      moves.push({
        id: `${slot.id}:arr`,
        airlineId: slot.airline,
        gateId,
        direction: 'arr',
        at: arrival,
      })
      moves.push({
        id: `${slot.id}:dep`,
        airlineId: slot.airline,
        gateId,
        direction: 'dep',
        at: (slot.eta + PLANNED_TURN_SEC) * SIM_MINUTES_PER_REAL_SECOND,
      })
    }
    return moves
  }

  private hubDemand(): number {
    return bankDemand(buildBanks(this.hubMovements()))
  }

  /** Game-minutes this inbound runs behind its timetable slot. Zero for unscheduled arrivals. */
  private hubInboundDelayMinutes(f: Flight): number {
    if (!f.scheduleId) return 0
    const slot = this.schedule.find((s) => s.id === f.scheduleId)
    const sec = slot?.delaySec ?? 0
    if (!Number.isFinite(sec) || sec <= 0) return 0
    return sec * SIM_MINUTES_PER_REAL_SECOND
  }

  /**
   * Mark a share of this arrival as connecting. They stay airside and skip
   * check-in. Share is zero before mid-game, so this is a no-op then.
   * The onward flight is the one sold from the planned arrival, so a late inbound eats the slack.
   */
  private noteHubArrivals(f: Flight, born: HallGuest[]) {
    // Hosted diverts are not passengers ticketed through this hub.
    if (f.hostKind) return
    const share = this.connectingShare(f.airline)
    if (!(share > 0)) return
    const indexes = connectingIndexes(born.length, share, f.id)
    if (!indexes.length) return
    const gates = this.hubGates()
    const fromId = f.stand ? `${f.stand.c},${f.stand.r}` : gates[0]?.id
    const from = gates.find((gate) => gate.id === fromId) ?? gates[0]
    const facilities = this.hubFacilities()
    const arrivalAt = this.simMinutes()
    if (!from) return
    const delayMin = this.hubInboundDelayMinutes(f)
    const moves = this.hubMovements()
    // Block-in is later than the timetable ETA, so the sold departure can already
    // be gone while this aircraft is still on stand. Offer its own turn from now.
    const slot = f.scheduleId ? this.schedule.find((s) => s.id === f.scheduleId) : undefined
    if (slot && slot.status !== 'done' && slot.status !== 'cancelled') {
      moves.push({
        id: `${slot.id}:block-turn`,
        airlineId: f.airline,
        gateId: from.id,
        direction: 'dep',
        at: arrivalAt + PLANNED_TURN_SEC * SIM_MINUTES_PER_REAL_SECOND,
      })
    }
    const resolved = resolveConnection({
      moves,
      arrivalAt,
      plannedArrival: arrivalAt - delayMin,
      from,
      gates,
      facilities,
      ride: false,
      walkwayMetres: this.walkwayCoverMetres(),
      linkFor: (fromId, toId) => this.connectionLink(fromId, toId),
    })
    if (!resolved) return
    const { verdict, to, departureAt, recovered } = resolved
    for (const index of indexes) {
      const g = born[index]
      if (!g) continue
      g.transfer = true
      g.clearedSec = true
      g.needs.bags = 0
      g.needs.hunger = 0
      g.needs.bladder = 0
      g.needs.energy = 0
      g.needs.shop = 0
      g.needs.play = 0
      g.needs.boarding = Math.max(6, (departureAt - arrivalAt) / SIM_MINUTES_PER_REAL_SECOND)
      g.node = 'gate'
      g.path = []
      g.seg = 0
      g.t = 0
      g.route = undefined
      g.connectFlightId = `connect:${f.id}:${to.id}`
      const rideWord = this.linkWord(verdict.link)
      g.thought = recovered
        ? `Connecting — caught the next wave, ${rideWord} to gate ${to.id}`
        : `Connecting — ${rideWord} to gate ${to.id}`
      this.issueBagTags(g.id, g.flightId, g.tag, g.connectFlightId, 'transfer')
      const windowSec = Math.max(0.5, (departureAt - arrivalAt) / SIM_MINUTES_PER_REAL_SECOND)
      const needed =
        verdict.reason === 'bag_late'
          ? verdict.bagMinutes
          : verdict.reason === 'pax_late'
            ? verdict.paxMinutes
            : verdict.mct
      this.hubLinks.push({
        guestId: g.id,
        airlineId: f.airline,
        resolveAt: this.clock + windowSec,
        made: verdict.made,
        reason: verdict.reason,
        delayMin,
        available: verdict.available,
        needed,
        mct: verdict.mct,
        bagMin: verdict.bagMinutes,
      })
    }
  }

  /**
   * One missed connection: hotel night or rebooking fee on the ledger, and a Standing hit.
   * Returns the cash amount posted (0 when the bill is not finite).
   */
  applyMissedConnection(airlineId: string): number {
    return this.applyMissedConnections(airlineId, 1)
  }

  /**
   * Missed connections for one carrier, billed as one ledger line and one Standing hit.
   * Returns the cash amount posted (0 when the bill is not finite).
   */
  applyMissedConnections(airlineId: string, passengers: number): number {
    const hotel = this.hasHotelBeds()
    const bill = missPenalty({ hasHotel: hotel, passengers })
    if (!(bill.amount > 0) || !Number.isFinite(bill.amount) || !Number.isFinite(this.cash)) return 0
    if (!this.sandbox) this.charge(bill.amount, 'missed_connection')
    if (bill.standing < 0 && Number.isFinite(bill.standing)) {
      this.adjustHeat(airlineId, bill.standing, 'transfers')
    }
    this.missedConnections += bill.passengers
    if (hotel) this.feedYearHub(0, 0, bill.passengers)
    return bill.amount
  }

  /**
   * Year-end hub seams. Nights are recorded only when a hotel bill posts.
   * Connection counts are recorded once, when a window closes or a divert misses.
   */
  private feedYearHub(completed: number, missed: number, nights: number) {
    const year = this as {
      noteHubConnections?: (completed: number, missed: number) => void
      noteMissedConnectionNights?: (nights: number) => void
    }
    if (completed + missed > 0 && typeof year.noteHubConnections === 'function') {
      year.noteHubConnections(completed, missed)
    }
    if (nights > 0 && typeof year.noteMissedConnectionNights === 'function') {
      year.noteMissedConnectionNights(nights)
    }
  }

  /**
   * An inbound that diverts away never lands its connecting passengers.
   * They miss their onward flights here, billed once for the whole load.
   */
  private missDivertedConnections(f: Flight) {
    if (f.cargo || f.hostKind) return
    const share = this.connectingShare(f.airline)
    // Same bodies a landing would have seeded, so a divert never bills more than a landed miss.
    const count = connectingIndexes(this.hallBodyCount(f), share, f.id).length
    if (count <= 0) return
    this.applyMissedConnections(f.airline, count)
    this.noteRelationFine(f.airline)
    for (let i = 0; i < count; i++) recordConnection(this.connectionTally, 'divert')
    this.lastConnectionMiss = {
      reason: 'divert',
      delayMin: 0,
      available: 0,
      needed: 0,
      mct: minimumConnectionTime(this.hubFacilities()),
    }
    this.noteConnectionMiss(count, 'divert')
    this.feedYearHub(0, count, 0)
  }

  /** Close connection windows. A miss bills the hotel or a rebooking fee and cuts Standing. */
  private tickHubConnections() {
    if (!this.hubLinks.length) return
    const due = this.hubLinks.filter((link) => this.clock >= link.resolveAt)
    if (!due.length) return
    this.hubLinks = this.hubLinks.filter((link) => this.clock < link.resolveAt)
    let made = 0
    let missed = 0
    const fined = new Set<string>()
    const batch: Record<ConnectionMissReason, number> = { below_mct: 0, pax_late: 0, bag_late: 0, divert: 0 }
    for (const link of due) {
      const guest = this.hallGuests.find((g) => g.id === link.guestId)
      recordConnection(this.connectionTally, link.made ? 'ok' : link.reason, {
        delayMin: link.delayMin,
        available: link.available,
        bagMin: link.bagMin,
      })
      if (link.made) {
        made += 1
        if (guest && !guest.dead) {
          guest.dead = true
          guest.thought = 'Made the connection'
          guest.needs.bags = 0
        }
        for (const tag of this.bagTags) {
          if (tag.ownerPassengerId !== link.guestId || tag.kind !== 'transfer' || tag.fault) continue
          tag.loaded = true
          tag.picked = true
        }
        continue
      }
      const reason: ConnectionMissReason = link.reason === 'ok' ? 'below_mct' : link.reason
      batch[reason] += 1
      this.lastConnectionMiss = {
        reason,
        delayMin: link.delayMin,
        available: link.available,
        needed: link.needed,
        mct: link.mct,
      }
      this.applyMissedConnection(link.airlineId)
      if (!fined.has(link.airlineId)) {
        this.noteRelationFine(link.airlineId)
        fined.add(link.airlineId)
      }
      missed += 1
      // Left behind once and rebooked with the passenger. Never counted as loaded on the outbound.
      let bags = 0
      for (const tag of this.bagTags) {
        if (tag.ownerPassengerId !== link.guestId || tag.kind !== 'transfer' || tag.fault) continue
        tag.fault = 'missed_connection'
        tag.loaded = false
        tag.connectFlightId = `rebook:${link.airlineId}`
        bags += 1
      }
      if (bags > 0) this.bagsMishandled += bags
      if (guest && !guest.dead) {
        guest.dead = true
        guest.bagFault = 'missed_connection'
        guest.needs.bags = 0
        const why = reason === 'bag_late' ? 'bags late' : reason === 'pax_late' ? 'walk too long' : 'inbound late'
        guest.thought = this.hasHotelBeds()
          ? `Missed connection — ${why}, hotel night`
          : `Missed connection — ${why}, rebooked`
      }
    }
    // Nights already posted inside applyMissedConnection when a hotel bill lands.
    this.feedYearHub(made, missed, 0)
    if (missed > 0) {
      const lead = (Object.entries(batch) as [ConnectionMissReason, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'below_mct'
      this.noteConnectionMiss(missed, lead)
    }
  }

  /** News plus an alert that names why the connection failed. */
  private noteConnectionMiss(missed: number, reason: ConnectionMissReason) {
    const sentence = this.lastConnectionMiss ? connectionCauseSentence(this.lastConnectionMiss) : connectionHint(reason)
    const noun = `${missed} missed connection${missed === 1 ? '' : 's'}`
    this.pushNews(`${noun} — ${sentence}`, 'bad')
    this.raiseAlert({
      key: 'event:missed-connection',
      severity: 'warning',
      title: 'Missed connections',
      detail: `${noun}. ${sentence} ${connectionHint(reason)}`,
      event: true,
    })
  }

  /** Click-open connection map: walk/ride minutes and the missed-connection count. */
  connectionMapLines(): string[] {
    return connectionMap({
      gates: this.hubGates(),
      ride: this.hubRide(),
      missed: this.missedConnections,
      facilities: this.hubFacilities(),
      banks: buildBanks(this.hubMovements()),
      linkFor: (from, to) => this.connectionLink(from, to),
      walkwayMetres: this.walkwayCoverMetres(),
    }).lines
  }

  /** Hotspot markers. Counts stay in infoLines until the player opens one. */
  infoHotspots(): { id: string; label: string }[] {
    const spots: { id: string; label: string }[] = []
    if (this.fits.length) {
      spots.push({ id: 'checkin', label: 'Check-in' })
      spots.push({ id: 'queue', label: 'Security' })
      spots.push({ id: 'lost', label: 'Lost passengers' })
      spots.push({ id: 'bags', label: 'Bags' })
      spots.push({ id: 'retail', label: 'Shops' })
      if (this.fieldLevel() >= 3) {
        spots.push({ id: 'connections', label: 'Connections' })
        spots.push({ id: 'links', label: 'Links' })
      }
    }
    if (tilesOf(this.tiles, 'fuel').length) spots.push({ id: 'fuel', label: 'Fuel farm' })
    spots.push({ id: 'power', label: 'Power' })
    if (tilesOf(this.tiles, 'mro').length) spots.push({ id: 'mro', label: 'Maintenance' })
    if (tilesOf(this.tiles, 'nighthub').length) spots.push({ id: 'nighthub', label: 'Night hub' })
    else if (!this.fits.length && tilesOf(this.tiles, 'bags').length) {
      spots.push({ id: 'bags', label: 'Bags' })
    }
    return spots
  }

  infoLines(id: string): string[] {
    if (id === 'queue' || id === 'security') return this.servicePointLines('security')
    if (id === 'checkin') return this.servicePointLines('checkin')
    if (id === 'lost') return [`${this.lostPaxCount()} lost in the hall`]
    if (id === 'bags') {
      const moving = this.flights.filter(
        (f) =>
          !f.cargo &&
          f.phase !== 'gone' &&
          (f.waitingOn.bags || f.waitingOn.bagsLoad || f.boardingSlow),
      ).length
      const reasons = this.schedule.filter((s) => /bag|belt|claim/i.test(s.delayReason ?? '')).length
      return [
        `${moving} turns still waiting on bags`,
        `${reasons} bag delays on the board`,
        `${this.bagsLost} bags lost`,
        `${this.bagsMishandled} mishandled`,
      ]
    }
    if (id === 'fuel') {
      const live = this.fuelView()
      const cover = Number.isFinite(live.daysCover)
        ? `${live.daysCover >= 1 ? live.daysCover.toFixed(1) : (live.daysCover * 24).toFixed(1)} ${live.daysCover >= 1 ? 'days' : 'hours'} of cover`
        : 'no uplift on the clock'
      return [
        `${Math.round(this.tankLitres).toLocaleString('en-US')} L of ${Math.round(tankDef(this.tankTier).capacityLitres).toLocaleString('en-US')} L`,
        cover,
        `${live.queue.length} in the delivery queue`,
        `${live.groundedIds.length} departures grounded for fuel`,
      ]
    }
    if (id === 'power') {
      const power = this.powerReport()
      const offer = powerPlantOffer(this.powerPlantTier)
      const lines = [
        `${offer.name} · capacity ${Math.round(power.capacity).toLocaleString('en-US')}`,
        `Demand ${Math.round(power.demand).toLocaleString('en-US')}`,
        power.brownout ? 'Brown-out — powered services slowed' : 'Supply covers demand',
      ]
      if (offer.upkeepPerDay > 0) lines.push(`Upkeep $${offer.upkeepPerDay.toLocaleString('en-US')} / day`)
      return lines
    }
    if (id === 'mro') return mroInfoLines(this.tier3.snapshot())
    if (id === 'nighthub') return nightHubInfoLines(this.tier3.snapshot())
    if (id === 'retail') {
      return [
        this.foodShelf < 1 ? this.shelfChip('food') : `${this.foodShelf} burger servings on the shelf`,
        this.shopShelf < 1 ? this.shelfChip('shop') : `${this.shopShelf} souvenirs on the shelf`,
        this.retailTillLine(),
        `${this.ensureCatering().engine.runners.length} supply runner${this.ensureCatering().engine.runners.length === 1 ? '' : 's'}`,
        ...this.hallShopLines(),
        `$${Math.round(this.lostSpend).toLocaleString('en-US')} lost spend`,
      ]
    }
    if (id === 'connections') {
      return [...this.connectionMapLines(), ...connectionReportLines(this.connectionTally, this.lastConnectionMiss)]
    }
    if (id === 'links') return this.linkLines()
    if (id.startsWith('late-site:')) {
      const [c, r] = id.slice('late-site:'.length).split(',').map(Number)
      const index = this.lateSites.findIndex((site) => site.c === c && site.r === r)
      return lateSiteLines(this.lateSites, index, this.hotelNightDemand())
    }
    if (id.startsWith('late:')) {
      const lateId = lateIdForTool(id.slice('late:'.length))
      if (!lateId) return []
      return lateCatalogLines(
        lateId,
        this.lateFieldLevel(),
        this.lateSites.filter((site) => site.id === lateId).length,
      )
    }
    return []
  }

  toggleInfo(id: string) {
    this.infoOpen = this.infoOpen === id ? null : id
    this.emit()
  }

  /** Staffed shop tills. Throughput is how many of them are serving. */
  private retailTillLine(): string {
    if (this.hallNav.live) {
      const tills = this.hallNav.metrics().filter((m) => m.kind === 'shop_counter')
      if (tills.length > 0) {
        const staffed = tills.filter((m) => m.staffed).length
        const inUse = tills.filter((m) => m.inUse).length
        return `${inUse} of ${staffed} tills in use`
      }
    }
    const n = this.fits.reduce((sum, fit) => sum + (fit.rooms.food ?? 0) + (fit.rooms.souvenir ?? 0), 0)
    return `${n} staffed till${n === 1 ? '' : 's'}`
  }

  /**
   * Mirror the catering shelves. Nothing is added here: a supply runner is
   * the only way a serving gets back on the counter.
   */
  private tickShelves(_dt: number) {
    this.pullShelves()
  }

  /** Write a shelf edit into the engine before the runner or a sale moves it. */
  private pushShelfEdits() {
    if (!this.catering && Number.isNaN(this.pushedFood) && this.foodShelf === 0 && this.shopShelf === 0) return
    const cat = this.ensureCatering()
    if (this.foodShelf !== this.pushedFood) {
      cat.setHallUnits('food', this.foodShelf)
      this.pushedFood = this.foodShelf
    }
    if (this.shopShelf !== this.pushedShop) {
      cat.setHallUnits('shop', this.shopShelf)
      this.pushedShop = this.shopShelf
    }
  }

  /** Read the engine back. The field is a view of that shelf. */
  private pullShelves() {
    if (!this.catering) return
    this.foodShelf = this.catering.hallUnits('food')
    this.shopShelf = this.catering.hallUnits('shop')
    this.pushedFood = this.foodShelf
    this.pushedShop = this.shopShelf
  }

  /** Opening stock for the prefab counters. One runner, two shelves. */
  private primeHallShelves() {
    const cat = this.ensureCatering()
    this.foodShelf = cat.openHallShelf('food')
    this.shopShelf = cat.openHallShelf('shop')
    this.pushedFood = this.foodShelf
    this.pushedShop = this.shopShelf
  }

  /** One serving leaves with the guest. False when the shelf was already empty. */
  private drawShelf(kind: HallCounterKind): boolean {
    this.pushShelfEdits()
    const ok = this.ensureCatering().takeHallUnit(kind)
    this.pullShelves()
    return ok
  }

  /** Put the serving back when the guest could not pay. */
  private returnShelf(kind: HallCounterKind) {
    this.pushShelfEdits()
    this.ensureCatering().returnHallUnit(kind)
    this.pullShelves()
  }

  /** A new counter adds room on the shelf, still capped by the engine. */
  private grantShelf(kind: HallCounterKind, units: number) {
    this.pushShelfEdits()
    const cat = this.ensureCatering()
    cat.setHallUnits(kind, cat.hallUnits(kind) + units)
    this.pullShelves()
  }

  /** Seconds until the runner unloads this counter. */
  shelfEtaSec(kind: HallCounterKind): number {
    return this.ensureCatering().restockEtaSec(kind, GAME_MINUTES_PER_SIM_SECOND)
  }

  /** Info chip for an empty food or shop shelf. */
  shelfChip(kind: HallCounterKind): string {
    return stockoutChip(this.shelfEtaSec(kind))
  }

  /** Player fix when one cart cannot keep both counters stocked. */
  buySupplyRunner(): boolean {
    const cost = 4500
    if (!this.spend(cost, 'supply runner', 'construction')) return false
    this.ensureCatering().engine.addRunner()
    this.pushNews('Second supply runner. The cart starts from the back-of-house dock.', 'good')
    this.emit()
    return true
  }

  setHallReorder(kind: HallCounterKind, level: number) {
    this.ensureCatering().setHallReorder(kind, level)
  }

  requestHallRestock(kind: HallCounterKind): boolean {
    return this.ensureCatering().requestHallRestock(kind)
  }

  /** Carts the renderer draws. Idle carts wait on the dock. */
  supplyCartPoses() {
    return this.ensureCatering().supplyPoses()
  }

  /** Empty counter: mild mood hit, no cash, a wish, then they leave the queue. */
  private walkOffEmptyShelf(g: HallGuest, pay: number, thought: string, open: Set<HallNode>) {
    if (g.node === 'food') g.needs.hunger = Math.min(g.needs.hunger, 18)
    else g.needs.shop = Math.min(g.needs.shop, 18)
    const bought = this.ensureCatering().stockout(g.id, g.node === 'food' ? 'food' : 'shop')
    const delta = bought.ok ? -1 : bought.happinessDelta
    const wish = bought.ok ? thought : bought.thought
    const lost = bought.ok ? pay : bought.lostSale
    g.happiness += delta
    this.lostSpend += lost
    thought = wish
    const dest: HallNode =
      g.job === 'depart' && open.has('gate')
        ? 'gate'
        : g.job === 'arrive' && open.has('exit')
          ? 'exit'
          : open.has('info')
            ? 'info'
            : g.node
    if (dest !== g.node) this.routeGuest(g, dest, open)
    g.thought = thought
  }

  private ensureGround() {
    const rev = this.mapRev
    const powerKey = this.liveCableKey()
    if (this.ground && this.groundRev === rev && this.groundPowerKey === powerKey) return this.ground
    if (!this.ground && this.groundRev === rev && this.groundPowerKey === powerKey) return null
    if (this.ground && this.ground.sim.openTurnarounds > 0 && (this.groundRev !== rev || this.groundPowerKey !== powerKey))
      return this.ground
    const prev = this.ground?.snapshot()
    const cap = tankDef(this.tankTier).capacityLitres
    if (this.tankLitres <= 0 && this.fuelLoads > 0) {
      this.tankLitres = Math.min(cap, seedLitresFromLoads(this.fuelLoads))
    }
    const config = buildLogisticsConfig(
      this.tiles,
      this.standAccess,
      tilesOf(this.tiles, 'termbus').length > 0,
      {
        fleet: this.scaleFleet,
        capacityLitres: cap,
        initialLitres: Math.min(cap, Math.max(0, this.tankLitres)),
        hydrantStands: liveHydrantStands(this.standPits, this.scaleFleet.hydrant_dispenser ?? 0),
        fixedPowerStands: powerKey ? powerKey.split('|') : [],
        strict: true,
      },
    )
    if (!config) {
      this.ground = null
      this.groundRev = rev
      this.groundPowerKey = powerKey
      if (this.groundNotes.length) {
        this.groundNotes = []
        this.groundNoteKey = ''
        this.refreshAdvice()
      }
      return null
    }
    if (prev) {
      config.kitchen.initialMeals = Math.min(config.kitchen.capacityMeals, Math.max(0, prev.meals))
    }
    const first = !this.groundAnnounced
    this.ground = createLogisticsAdapter(
      {
        addMoney: (amount, category) => this.postGroundMoney(amount, category),
        playSound: (cue, standId) => {
          let position: { x: number; y: number; z: number } | undefined = undefined;
          if (standId) {
            const parts = standId.split(',');
            if (parts.length === 2) {
              const c = Number(parts[0]);
              const r = Number(parts[1]);
              if (Number.isFinite(c) && Number.isFinite(r)) {
                position = { x: c, y: r, z: 0 };
              }
            }
          }
          this.noteSound(soundForEvent({ type: cue, standId }, 'logistics'), position);
        },
        notify: (message, severity) => {
          this.pushNews(message, severity === 'warn' ? 'bad' : 'ok')
        },
        onCargoToArea: (standId, kg) => {
          const inbound = this.ground?.sim.turnaroundAt(standId)?.cargoIn ?? kg
          this.ensureCargo().inbound(standId, kg, inbound)
        },
      },
      config,
    )
    this.ground.sim.bindFuelStock({
      get: () => this.tankLitres,
      set: (litres) => {
        const next = Math.min(tankDef(this.tankTier).capacityLitres, Math.max(0, litres))
        this.tankLitres = Number.isFinite(next) ? next : 0
      },
    })
    this.groundRev = rev
    this.groundPowerKey = powerKey
    this.stampHubVehicleLeases()
    if (first) {
      this.groundAnnounced = true
      this.pushNews('Vehicle depot online. Service trucks run the turnarounds from here.', 'good')
    }
    return this.ground
  }

  private postGroundMoney(amount: number, category: string) {
    const book = this.groundBooks
    if (category === 'fuel_sales') book.fuelSales += amount
    else if (category === 'catering_fees') book.cateringFees += amount
    else if (category === 'fuel_purchase') book.fuelPurchase += amount
    else if (category === 'meal_production') book.mealProduction += amount
    else if (category === 'vehicle_upkeep') book.vehicleUpkeep += amount
    else if (category === 'shop_sales') book.shopSales += amount
    else if (category === 'cargo_airport_revenue') book.cargoRevenue += amount
    else if (category === 'cargo_penalty') book.cargoPenalties += amount
    if (amount > 0) {
      this.cash += amount
      this.revenue += amount
      this.noteIncome(amount, this.groundIncomeCategory(category))
      return
    }
    if (amount < 0) {
      this.noteExpense(-amount)
      this.postJournal(this.groundExpenseCategory(category), -amount, this.simMinutes())
      if (!this.sandbox) this.cash += amount
    }
  }

  private groundExpenseCategory(category: string): MoneyCategory {
    if (category === 'fuel_purchase') return 'fuel_purchase'
    if (category === 'meal_production') return 'meal_production'
    if (category === 'vehicle_upkeep') return 'vehicle_upkeep'
    if (category === 'cargo_penalty') return 'penalties'
    return 'building_upkeep'
  }

  private ensureCatering(): CateringBridge {
    if (this.catering) return this.catering
    this.catering = new CateringBridge()
    this.catering.adoptHallCaps()
    return this.catering
  }

  private ensureCargo(): CargoBridge {
    return (this.cargo ??= new CargoBridge({
      postMoney: (amount, category) => this.postGroundMoney(amount, category),
      loaders: () => {
        const sim = this.ground?.sim
        if (!sim) return null
        return {
          reserve: (request) => sim.reserveLoader(request.flightId, request.preferred, request.allowUldFallback),
          release: (id) => sim.releaseLoader(id),
        }
      },
      cue: (name) => this.noteSound(name),
      notify: (message, severity) => this.pushNews(message, severity === 'warn' ? 'bad' : 'ok'),
      onNotes: () => {
        this.cargoNotes = this.cargo?.notes ?? []
        this.refreshAdvice()
      },
      standCell: (standId) => {
        const [c, r] = standId.split(',').map(Number)
        return Number.isFinite(c) && Number.isFinite(r) ? { c, r } : null
      },
    }))
  }

  /** Galley for a parked departure. Null until the truck is booked. */
  galleyFor(flightId: string) {
    return this.catering?.engine.galley(flightId) ?? null
  }

  /** Cargo books. Null until the first parked flight asks for a load. */
  cargoSnapshot() {
    return this.cargo?.adapter.snapshot() ?? null
  }

  /** Loader type held for this flight, if the cargo module reserved one. */
  loaderHold(flightId: string): string | null {
    return this.ground?.sim.vehicles.find((v) => v.heldFor === flightId)?.type ?? null
  }

  /** True once the ramp has a cargo-load service on this stand. */
  cargoLoadArmed(standId: string): boolean {
    const services = this.ground?.sim.turnaroundAt(standId)?.services
    return services?.cargo_load !== undefined
  }

  /**
   * Bag carts and catering trucks on a socket leg.
   * Coordinates are metres. The renderer places the mesh; it does not choose the path.
   */
  cartPoses(): CartPose[] {
    return this.cartYard.snapshot()
  }

  /** Crew and scissor-lift poses for the catering trucks. */
  cateringPoses() {
    const kitchen = tilesOf(this.tiles, 'kitchen')[0] ?? tilesOf(this.tiles, 'depot')[0] ?? null
    return this.catering?.poses(kitchen) ?? []
  }

  private noteSound(name: string | null, position?: { x: number; y: number; z: number }) {
    if (!name) return
    this.soundCues.push(name)
    if (this.soundCues.length > 24) this.soundCues.shift()
    if (typeof window === 'undefined') return
    try {
      getAudio().playEvent(name, { position })
    } catch {
      // Headless tests have no audio device.
    }
  }

  private noteCargoDepart(f: Flight) {
    this.cargo?.departed(f.id)
  }

  private noteCargoCancel(f: Flight) {
    this.cargo?.cancel(f.id)
  }

  /**
   * Check-in drop to the sort, sort to the belt loader, loader back to claim,
   * and the kitchen to the aircraft door. Cart count and bay use limit the rate.
   * A flight that has left drops any shipment that is still undone.
   */
  private tickCarts(step: number) {
    if (!(step > 0) || !this.site) return
    const live = new Set<string>()
    for (const f of this.flights) {
      if (f.phase === 'gone' || f.cargo) continue
      if (f.stand || f.groundTurn) live.add(f.id)
    }
    this.cartYard.cancelGone(live)
    for (const key of [...this.cartPosted]) {
      const id = key.slice(key.indexOf(':') + 1)
      if (!live.has(id)) this.cartPosted.delete(key)
    }
    const sites = this.cartSites()
    if (!sites.some((site) => site.role === 'stand')) return
    this.cartYard.setSites(sites)
    const depots = tilesOf(this.tiles, 'depot').length
    this.cartYard.setFleet(
      CART_TUNING.bagCarts + depots * CART_TUNING.bagCartsPerDepot,
      CART_TUNING.cateringTrucks + depots * CART_TUNING.cateringTrucksPerDepot,
    )
    for (const f of this.flights) {
      if (!live.has(f.id)) continue
      const stand = f.stand ? `${f.stand.c},${f.stand.r}` : f.groundTurn
      if (!stand) continue
      const units = Math.max(0, Math.round(f.bagUnits ?? 0), Math.round(f.bagsDeposited ?? 0))
      // Bags are checked while the aircraft is still inbound. Start the cart then,
      // and also whenever the sort or the loader is the live stage.
      const turning =
        f.phase === 'approach' ||
        f.phase === 'landing' ||
        f.phase === 'taxi_in' ||
        f.phase === 'hold' ||
        f.phase === 'deboard' ||
        f.phase === 'servicing' ||
        f.phase === 'board' ||
        f.phase === 'parked'
      const outboundOpen =
        f.bagStage === 'outbound_sort' || f.bagStage === 'load_aircraft' || (turning && !f.posted.bagsLoad)
      if (units > 0 && outboundOpen && this.cartYard.canAccept('outbound', stand)) {
        const key = `out:${f.id}`
        if (!this.cartPosted.has(key)) {
          this.cartPosted.add(key)
          this.cartYard.postOutbound(f.id, units, stand)
        }
      }
      if (
        units > 0 &&
        (f.bagStage === 'unload_aircraft' || f.bagStage === 'inbound_sort' || f.bagStage === 'deliver_claim') &&
        this.cartYard.canAccept('inbound', stand)
      ) {
        const key = `in:${f.id}`
        if (!this.cartPosted.has(key)) {
          this.cartPosted.add(key)
          this.cartYard.postInbound(`in:${f.id}`, units, stand)
        }
      }
      const galley = this.catering?.engine.galley(f.id)
      if (galley && galley.cartsRequired > 0 && this.cartYard.canAccept('catering', stand)) {
        const key = `cat:${f.id}`
        if (!this.cartPosted.has(key)) {
          this.cartPosted.add(key)
          this.cartYard.postCatering(`cat:${f.id}`, galley.cartsRequired, stand)
        }
      }
    }
    this.cartYard.tick(step)
  }

  /** Bag-loaded: the outbound cart has finished its dock at belt_low. */
  private outboundCartClear(flightId: string): boolean {
    if (!this.cartPosted.has(`out:${flightId}`)) return true
    return this.cartYard.finishedAt(flightId, 'belt_low')
  }

  /** Bag-delivered: the inbound cart has finished its dock at claim_stop. */
  private inboundCartClear(flightId: string): boolean {
    if (!this.cartPosted.has(`in:${flightId}`)) return true
    return this.cartYard.finishedAt(`in:${flightId}`, 'claim_stop')
  }

  /** Catering-done: the hi-lift has finished its dock at catering_door. */
  private cateringCartClear(flightId: string): boolean {
    if (this.cartPosted.has(`cat:${flightId}`)) return this.cartYard.finishedAt(`cat:${flightId}`, 'catering_door')
    const galley = this.catering?.engine.galley(flightId)
    if (!galley || galley.cartsRequired <= 0) return true
    const flight = this.flights.find((f) => f.id === flightId)
    const stand = flight?.stand ? `${flight.stand.c},${flight.stand.r}` : flight?.groundTurn
    if (!stand || !this.cartYard.canAccept('catering', stand)) return true
    return false
  }

  /** True while this truck's step is waiting for the cart to finish at its socket. */
  private truckWaitsForCart(t: Truck): boolean {
    if (!t.flightId) return false
    if (t.kind === 'bags' && t.mission === 'load') return !this.outboundCartClear(t.flightId)
    if (t.kind === 'bags' && t.mission === 'to_claim') return !this.inboundCartClear(t.flightId)
    if (t.kind === 'catering' && !t.returning) return !this.cateringCartClear(t.flightId)
    return false
  }

  private cartSites(): CartSite[] {
    const sites: CartSite[] = []
    const metre = METERS_PER_CELL
    const terminal = tilesOf(this.tiles, 'terminal')[0]
    const bags = tilesOf(this.tiles, 'bags')[0]
    const kitchen = tilesOf(this.tiles, 'kitchen')[0] ?? tilesOf(this.tiles, 'snack')[0] ?? tilesOf(this.tiles, 'depot')[0]
    const checkin = checkinRowSockets()
    if (terminal) {
      const origin = { x: terminal.c * metre, y: terminal.r * metre, heading: 0 }
      sites.push({
        id: 'checkin',
        role: 'checkin',
        x: origin.x,
        y: origin.y,
        sockets: this.meshSockets(checkin, ['desk_drop'], origin),
      })
    }
    const sortAt = bags ?? terminal
    if (sortAt) {
      const origin = { x: sortAt.c * metre, y: sortAt.r * metre, heading: 0 }
      sites.push({
        id: 'sort',
        role: 'sort',
        x: origin.x,
        y: origin.y,
        sockets: this.meshSockets(checkin, ['makeup_stop'], origin),
      })
      sites.push({
        id: 'claim',
        role: 'claim',
        x: origin.x,
        y: origin.y,
        sockets: this.meshSockets(CAROUSEL_SOCKETS, ['claim_stop'], origin),
      })
    }
    if (kitchen) {
      const origin = { x: kitchen.c * metre, y: kitchen.r * metre, heading: 0 }
      sites.push({
        id: 'kitchen',
        role: 'kitchen',
        x: origin.x,
        y: origin.y,
        sockets: this.meshSockets(apronCartSockets('catering_hilift'), ['cart_slot'], origin),
      })
    }
    const belt = apronCartSockets('belt_loader')
    for (const stand of tilesOf(this.tiles, 'stand')) {
      const parked = this.flights.find((f) => f.stand && f.stand.c === stand.c && f.stand.r === stand.r && f.phase !== 'gone')
      const spec = getAircraftSpec(parked?.airframeId || 'b738')
      const onStand =
        parked != null && Math.hypot(parked.x - stand.c, parked.y - stand.r) < 0.8
      const origin = onStand
        ? { x: parked.x * metre, y: parked.y * metre, heading: parked.heading ?? 0 }
        : { x: stand.c * metre, y: stand.r * metre, heading: 0 }
      const aircraft = aircraftSocketTable(spec)
      const sockets = [
        resolveSocket(aircraft, 'catering_door', origin),
        this.beltLowSocket(origin, aircraft, belt),
      ].filter((socket): socket is CartSocket => socket != null)
      sites.push({
        id: `${stand.c},${stand.r}`,
        role: 'stand',
        x: stand.c * metre,
        y: stand.r * metre,
        sockets,
      })
    }
    return sites
  }

  private meshSockets(
    table: Readonly<Record<string, readonly [number, number, number]>>,
    names: readonly string[],
    origin: { x: number; y: number; heading?: number },
  ): CartSocket[] {
    const out: CartSocket[] = []
    for (const name of names) {
      const hit = resolveSocket(table, name, origin)
      if (hit) out.push(hit)
    }
    return out
  }

  /** Belt loader parked so belt_tip meets the aircraft cargo door. The cart docks at belt_low. */
  private beltLowSocket(
    origin: { x: number; y: number; heading?: number },
    aircraft: Readonly<Record<string, readonly [number, number, number]>>,
    belt: Readonly<Record<string, readonly [number, number, number]>>,
  ): CartSocket | null {
    const door = resolveSocket(aircraft, 'plane_cargo_door_fwd', origin) ?? resolveSocket(aircraft, 'plane_hold', origin)
    const tip = belt.belt_tip
    if (!door || !tip) return resolveSocket(belt, 'belt_low', origin)
    const heading = origin.heading ?? 0
    const fx = Math.cos(heading)
    const fy = Math.sin(heading)
    const rx = -Math.sin(heading)
    const ry = Math.cos(heading)
    return resolveSocket(belt, 'belt_low', {
      x: door.x - (tip[0] * fx + tip[2] * rx),
      y: door.y - (tip[0] * fy + tip[2] * ry),
      heading,
    })
  }

  /** Book galleys, feed the fuel check, and post shop money into the one ledger. */
  private tickCatering(step: number) {
    if (!(step > 0)) return
    const cat = this.ensureCatering()
    const now = this.clock * GAME_MINUTES_PER_SIM_SECOND
    const litres = this.groundSnapshot() ? this.tankLitres : this.fuelOnHand() ? 1_000_000 : 0
    const demands = this.flights
      .filter((f) => f.phase !== 'gone' && this.departureNeedsFuel(f) && !f.posted.fuel)
      .map((f) => ({
        flightId: f.id,
        litres: this.fuelNeedLitres(f),
        departAt: f.fuelHeldSince ?? this.clock,
      }))
    cat.fuel.evaluate(now, litres, demands)
    cat.fuel.events.splice(0)
    const ground = this.ground
    if (ground) {
      for (const f of this.flights) {
        if (!f.groundTurn || f.phase === 'gone') continue
        ground.sim.setFuelHold(f.groundTurn, cat.fuel.isGrounded(f.id))
      }
    }
    cat.engine.tick(now)
    for (const event of cat.engine.drainEvents()) {
      this.noteSound(cateringCue(event))
      if (event.type === 'shop_restocked') {
        const cost = cogsFor(event.added)
        if (cost > 0) this.charge(cost, 'retail_cogs')
      }
      if (event.type === 'catering_done') {
        const flight = this.flights.find((f) => f.id === event.flightId)
        if (flight?.groundTurn && this.cateringCartClear(flight.id)) {
          flight.caterLevel = 1
          flight.waitingOn.catering = false
          this.ground?.sim.releaseExternalCatering(flight.groundTurn)
        }
      }
    }
    for (const f of this.flights) {
      if (!f.groundTurn || f.phase === 'gone' || f.posted.catering) continue
      if (!cat.engine.isCateringDone(f.id)) continue
      if (!this.cateringCartClear(f.id)) continue
      f.caterLevel = 1
      f.waitingOn.catering = false
      this.ground?.sim.releaseExternalCatering(f.groundTurn)
    }
    const gained = cat.engine.revenue - cat.postedRevenue
    if (gained > 0) {
      cat.postedRevenue = cat.engine.revenue
      this.postGroundMoney(gained, 'shop_sales')
    }
    const lost = cat.engine.lostRevenue - cat.postedLost
    if (lost > 0) {
      cat.postedLost = cat.engine.lostRevenue
      this.groundBooks.shopLost += lost
    }
  }

  private fuelNeedLitres(f: Flight): number {
    try {
      return needsFor(f.airframeId).fuelLitres
    } catch {
      return 8_000
    }
  }

  /** Cargo terminal clock matches the ramp: one sim-second is eight game minutes. */
  tier3Snapshot() {
    return this.tier3.snapshot()
  }

  private tier3Unlock() {
    return {
      fieldLevel: this.fieldLevel(),
      unlockedTech: new Set(this.economyState?.unlockedTech ?? []),
      research: this.grantedResearch(),
    }
  }

  private tier3Buildings(): Tier3Building[] {
    return [
      ...tilesOf(this.tiles, 'mro').map((cell) => ({ id: `${cell.c},${cell.r}`, kind: 'mro' as const })),
      ...tilesOf(this.tiles, 'nighthub').map((cell) => ({ id: `${cell.c},${cell.r}`, kind: 'night_hub' as const })),
    ]
  }

  /**
   * Heavy checks and the freighter night wave. `step` is sim seconds.
   * Cash postings are finite; a non-finite total is dropped rather than poisoning the books.
   */
  tickTier3(step: number) {
    if (!(step > 0)) return
    this.tier3.sync(this.tier3Buildings())
    const mods = this.economyView?.modifiers ?? {}
    const context: Tier3TickContext = {
      ...this.tier3Unlock(),
      staffPools: {
        maintenance_tech: { hired: this.mechanics, wagePerDay: 0 },
        ground_crew: {
          hired: tilesOf(this.tiles, 'depot').length * GROUND_CREW_PER_DEPOT,
          wagePerDay: 0,
        },
      },
      powerTier: this.powerPlantTier,
      powerCapacityMultiplier: mods['power.capacity'] ?? 1,
      powerDemandMultiplier: mods['power.demand'] ?? 1,
      batteryCapacity: mods['power.batteryCapacity'] ?? 0,
      otherPowerDemand: this.utilityLoads().power + (this.researchers > 0 ? 35 : 0),
      isNight: this.isNight(),
      nightIndex: Math.floor(this.clock / 180),
      curfewRelaxed: this.hasResearch('night_bank'),
      candidates: this.mroCandidateFlights().map((flight) => ({
        id: flight.id,
        airframeId: flight.airframeId || 'b738',
        standKey: `${flight.stand!.c},${flight.stand!.r}`,
      })),
    }
    const result = this.tier3.tick(step * GAME_MINUTES_PER_SIM_SECOND, context)
    for (const posting of result.postings) {
      if (!Number.isFinite(posting.amount) || posting.amount === 0) continue
      if (posting.amount > 0) this.earn(posting.amount, posting.label)
      else this.charge(-posting.amount)
    }
    if (result.paxHeat !== 0 && Number.isFinite(result.paxHeat)) {
      for (const id of this.signed) {
        if (this.airline(id).kind === 'pax') this.adjustHeat(id, result.paxHeat)
      }
    }
    if (!Number.isFinite(this.cash)) this.cash = 0
  }

  /**
   * Only aircraft already on a stand, with a taxiway to a hangar.
   * A missing path never becomes a teleport into the bay.
   */
  private mroCandidateFlights(): Flight[] {
    const hangars = tilesOf(this.tiles, 'mro')
    if (!hangars.length) return []
    return this.flights.filter((flight) => {
      if (!flight.stand || (flight.craft ?? 'jet') !== 'jet') return false
      if (
        flight.phase !== 'parked' &&
        flight.phase !== 'servicing' &&
        flight.phase !== 'deboard' &&
        flight.phase !== 'board'
      ) {
        return false
      }
      return hangars.some((hangar) => nearestPath(this.tiles, flight.stand!, [hangar], 'jet'))
    })
  }

  private routeForMroJob(flight: Flight, buildingId: string, bayId: string, size: 'narrow' | 'wide' | 'jumbo'): TaxiPoint[] | null {
    if (!flight.stand) return null
    const cached = this.mroRoutes.get(flight.id)
    if (cached) return cached
    const [c, r] = buildingId.split(',').map(Number)
    if (!Number.isFinite(c) || !Number.isFinite(r)) return null
    const hangar = { c, r }
    const via = nearestPath(this.tiles, flight.stand, [hangar], 'jet')
    if (!via) return null
    const route = mroRoute(flight.stand, via, hangar, bayId, size)
    this.mroRoutes.set(flight.id, route)
    return route
  }

  /** Put a finished check back on its stand. The exit leg already ended there. */
  private releaseFinishedMro() {
    const live = new Set(this.tier3.activeJobs().map((job) => job.aircraftId))
    for (const id of this.mroBound) {
      if (live.has(id)) continue
      const flight = this.flights.find((item) => item.id === id)
      const route = this.mroRoutes.get(id)
      const stand = flight?.stand ?? route?.[0]
      if (flight && stand) {
        flight.x = stand.c
        flight.y = stand.r
        flight.z = 0.12
      }
      this.mroRoutes.delete(id)
    }
    this.mroBound = live
  }

  /** Hold the turnaround and roll the aircraft along the cached taxiway. */
  private applyMroHold(flight: Flight): boolean {
    const job = this.tier3.activeJobs().find((item) => item.aircraftId === flight.id)
    if (!job) return false
    const path = this.routeForMroJob(flight, job.buildingId, job.bayId, job.size)
    if (!path) return false
    const pose = poseForPhase({ phase: job.phase, remaining: job.remaining, path })
    flight.x = pose.x
    flight.y = pose.y
    flight.z = 0.12
    flight.heading = pose.heading
    return true
  }

  /** Door slide for one hangar. 0 is shut. The renderer ignores this when the camera is far. */
  mroDoorOpen(cellKey: string): number {
    let open = 0
    for (const job of this.tier3.activeJobs()) {
      if (job.buildingId !== cellKey) continue
      const flight = this.flights.find((item) => item.id === job.aircraftId)
      const path = flight ? this.routeForMroJob(flight, job.buildingId, job.bayId, job.size) : null
      if (!path) {
        open = Math.max(open, job.phase === 'in_bay' ? 1 : 0)
        continue
      }
      open = Math.max(open, poseForPhase({ phase: job.phase, remaining: job.remaining, path }).door)
    }
    return open
  }

  /** Same loads the hangar session uses, so the info line and the brown-out agree. */
  powerLoads(): PowerLoad[] {
    const loads: PowerLoad[] = []
    const site = this.utilityLoads().power
    if (site > 0) loads.push({ id: 'site', demand: site })
    if (this.researchers > 0) loads.push({ id: 'lab', demand: 35 })
    for (const cell of tilesOf(this.tiles, 'mro')) {
      loads.push({ id: `${cell.c},${cell.r}`, demand: MRO_POWER_DEMAND })
    }
    for (const cell of tilesOf(this.tiles, 'nighthub')) {
      loads.push({ id: `hub:${cell.c},${cell.r}`, demand: NIGHT_HUB_POWER_DEMAND })
    }
    return loads
  }

  powerReport() {
    const mods = this.economyView?.modifiers ?? {}
    return calculatePower(
      this.powerPlantTier,
      this.powerLoads(),
      mods['power.capacity'] ?? 1,
      mods['power.demand'] ?? 1,
      mods['power.batteryCapacity'] ?? 0,
    )
  }

  private powerProblemCell(): { c: number; r: number } | null {
    const mro = tilesOf(this.tiles, 'mro')
    if (mro.length) return mro[mro.length - 1]
    const hub = tilesOf(this.tiles, 'nighthub')
    if (hub.length) return hub[hub.length - 1]
    const terminal = tilesOf(this.tiles, 'terminal')
    if (terminal.length) return terminal[0]
    const tower = tilesOf(this.tiles, 'tower')
    return tower[0] ?? null
  }

  private powerAdviceItems(): Advice[] {
    const power = this.powerReport()
    if (!power.brownout) return []
    const cell = this.powerProblemCell()
    const gate = canUpgradePower(this.powerPlantTier, 5)
    const offer = gate.next ? powerPlantOffer(gate.next) : null
    return [
      {
        id: 'power-brownout',
        title: 'Power brown-out',
        detail: `Demand ${Math.round(power.demand)} exceeds capacity ${Math.round(power.capacity)}.`,
        fix: offer
          ? `Build ${offer.name} (Field level ${offer.minFieldLevel}).`
          : 'Shed a hangar or the night hub until demand fits.',
        cells: cell ? [cell] : [],
        scope: 'apron',
      },
    ]
  }

  private syncPowerAdvice() {
    const brown = this.powerReport().brownout
    const shown = this.advice.some((note) => note.id === 'power-brownout')
    if (brown !== shown) this.refreshAdvice()
  }

  upgradePowerPlant() {
    const gate = canUpgradePower(this.powerPlantTier, this.fieldLevel())
    if (!gate.ok || gate.next == null) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    const offer = powerPlantOffer(gate.next)
    if (!this.spend(gate.cost, offer.name)) return
    this.powerPlantTier = gate.next
    this.bumpMap()
    this.pushNews(
      `${offer.name} online. Capacity ${POWER_PLANT_CAPACITY[gate.next].toLocaleString('en-US')}. Upkeep $${offer.upkeepPerDay.toLocaleString('en-US')}/day.`,
      'good',
    )
    this.refreshAdvice()
    this.emit()
  }

  consumeCameraCue(): { c: number; r: number } | null {
    const cue = this.cameraCue
    this.cameraCue = null
    return cue
  }

  private tickCargo(step: number) {
    if (!(step > 0)) return
    const cargo = this.ensureCargo()
    cargo.adapter.tick(step * GAME_MINUTES_PER_SIM_SECOND)
    this.cargoNotes = cargo.notes
  }

  /** One game hour is 7.5 sim-seconds, so a sim-second is eight game minutes. */
  private tickGround(step: number) {
    const g = this.ensureGround()
    if (!g) return
    const before = g.completed.length
    g.tick(step * (60 / 7.5))
    if (g.completed.length > before) this.consumeGround(g, before)
    this.syncGroundNotes()
  }

  private consumeGround(
    g: LogisticsAdapter & { sim: LogisticsSim; completed: TurnaroundResult[] },
    before: number,
  ) {
    for (const result of g.completed.slice(before)) {
      const flight = this.flights.find((f) => f.groundTurn === result.standId && f.phase !== 'gone')
      if (flight) {
        flight.posted.fuel = true
        flight.fuelLevel = 1
        flight.waitingOn.fuel = false
        flight.posted.catering = true
        flight.caterLevel = 1
        flight.waitingOn.catering = false
        if (result.grade) {
          flight.turnGrade = result.grade
          flight.turnGradeNote = result.gradeNote
        }
        this.ensureDiplomacy().noteRamp(flight.id, result.delayMinutes, result.causes.includes('late_bags'))
      }
      if (result.delayMinutes <= 1) continue
      const mins = Math.round(result.delayMinutes)
      const why = result.causes[0] ? groundCauseLine(result.causes[0]) : 'The ramp ran past the planned pushback.'
      const id = `delay-${result.standId.replace(',', '-')}`
      const [c, r] = result.standId.split(',').map(Number)
      const delays = this.groundNotes.filter((n) => n.id.startsWith('delay-') && n.id !== id).slice(-3)
      this.groundNotes = [...this.groundNotes.filter((n) => !n.id.startsWith('delay-')), ...delays]
      this.groundNotes.push({
        id,
        title: `Turnaround late, ${mins} min`,
        detail: result.causes.map((cause) => groundCauseLine(cause)).join('. ') || why,
        fix: delayFix(result.causes),
        cells: Number.isFinite(c) && Number.isFinite(r) ? [{ c, r }] : [],
        scope: 'apron',
      })
      if (flight) {
        this.adjustHeat(flight.airline, -1.2)
        if (flight.scheduleId) {
          const slot = this.schedule.find((s) => s.id === flight.scheduleId)
          if (slot && slot.status !== 'done' && slot.status !== 'cancelled') {
            this.delaySlot(slot, Math.min(18, Math.max(6, result.delayMinutes / 8)), why)
          }
        }
      }
    }
  }

  private syncGroundNotes() {
    const g = this.ground
    if (!g) return
    const snap = g.snapshot()
    const cfg = g.sim.config
    const farm = tilesOf(this.tiles, 'fuel')[0]
    const kitchen = tilesOf(this.tiles, 'kitchen')[0]
    const depot = tilesOf(this.tiles, 'depot')[0]
    const stock: Advice[] = []
    if (this.tankLitres < cfg.fuelFarm.lowStockLitres && farm) {
      stock.push({
        id: 'low-fuel',
        title: 'Fuel farm running low',
        detail: `${Math.round(this.tankLitres).toLocaleString('en-US')} L left in the farm.`,
        fix: 'A tanker rolls when the farm drops under the line. The purchase posts to the books.',
        cells: [farm],
        scope: 'apron',
      })
    }
    if (snap.meals < cfg.kitchen.lowStockMeals) {
      stock.push({
        id: 'low-meals',
        title: 'Catering kitchen running low',
        detail: kitchen
          ? `${snap.meals} meals left in the kitchen.`
          : 'No catering kitchen is on the field, so the galley trucks have nothing to load.',
        fix: kitchen
          ? 'The kitchen keeps cooking. Give it time before the next full bank.'
          : 'Place a catering kitchen beside the service road.',
        cells: kitchen ? [kitchen] : depot ? [depot] : [],
        scope: 'apron',
      })
    }
    const delays = this.groundNotes.filter((n) => n.id.startsWith('delay-')).slice(-4)
    const next = [...stock, ...delays]
    const key = next.map((n) => n.id).join('|')
    this.groundNotes = next
    if (key !== this.groundNoteKey) {
      this.groundNoteKey = key
      this.refreshAdvice()
      return
    }
    for (const note of next) {
      const i = this.advice.findIndex((a) => a.id === note.id)
      if (i >= 0) this.advice[i] = note
    }
  }

  /**
   * Hand a blocked-in aircraft to the ground module.
   * Hall passengers stay on the terminal graph, so a prefab still loses nobody.
   */
  private armGroundTurn(f: Flight): boolean {
    if (!f.stand || f.groundTurn) return Boolean(f.groundTurn)
    const g = this.ensureGround()
    if (!g) return false
    const standId = `${f.stand.c},${f.stand.r}`
    if (!g.sim.config.stands.some((s) => s.id === standId)) return false
    let needs: ReturnType<typeof needsFor>
    try {
      needs = needsFor(f.airframeId)
    } catch {
      return false
    }
    const scheduled = this.scaledTurnMinutes(needs.sizeClass === 'L' ? 90 : needs.sizeClass === 'M' ? 55 : 40)
    const pax = f.cargo || f.kind === 'freighter' || f.kind === 'military' ? 0 : f.pax
    if (pax > 0) {
      const longHaul = needs.sizeClass === 'L' || f.kind === 'widebody'
      this.ensureCatering().orderFor(
        f.id,
        standId,
        needs.seats,
        pax,
        longHaul,
        this.clock * GAME_MINUTES_PER_SIM_SECOND + Math.max(scheduled, 40),
      )
    }
    const bagUnits = this.bagTags.filter((t) => t.flightId === f.id).length || Math.round(pax * needs.bagsPerPax)
    const hold = AIRFRAMES[f.airframeId]?.cargoHold ?? 0
    const plan = this.ensureCargo().prepare(f.id, f.airframeId, standId, hold, bagUnits)
    try {
      g.onAircraftParked(standId, f.airframeId, scheduled, {
        kind: 'turn',
        departingPax: pax,
        arrivingPax: pax,
        deferCatering: pax > 0,
        flightId: f.id,
        callsign: f.flightNo,
        airlineId: f.airline,
        outboundCargoKg: Math.round(plan.tonnes * 1000),
      })
    } catch {
      this.noteCargoCancel(f)
      return false
    }
    f.groundTurn = standId
    return true
  }

  /**
   * Desks and lanes the walk is staffing for this hall. The live walk's
   * facilities when it is pointed here, otherwise the layout it will read.
   */
  private hallServiceFacilities(fit: TerminalFit | null): { id: string; kind: string }[] {
    if (!fit) return []
    const nav = this.hallNav.nav
    const source =
      nav && this.hallNav.hallId === this.hallKey(fit) ? nav.facilities.list : (hallNavLayout(fit)?.equipment ?? [])
    const out: { id: string; kind: string }[] = []
    for (const f of source) {
      if (f.kind === 'checkin_desk' || f.kind === 'security_lane') out.push({ id: f.id, kind: f.kind })
    }
    return out
  }

  /**
   * Security lanes that can serve. Same count the walk has open: bundle
   * lanes stay open, and every other lane needs a screener on the post.
   */
  securityServers(fit: TerminalFit | null = this.activeHall()): number {
    if (!fit) return 0
    return openSecurityCount(this.hallServiceFacilities(fit), fit.items ?? [], this.onPostCount('security'))
  }

  /**
   * Check-in desks that can serve. Same count the walk has open: bundle
   * desks and self-serve kiosks stay open, and every other desk needs a
   * clerk on the post.
   */
  checkinServers(fit: TerminalFit | null = this.activeHall()): number {
    if (!fit) return 0
    return openCheckinCount(this.hallServiceFacilities(fit), fit.items ?? [], this.onPostCount('checkin'))
  }

  /**
   * Queue length and wait for each check-in desk or security lane.
   * The walk's points when the walk is running. A paused walk says so
   * instead of swapping in a hall head-count with no label.
   */
  servicePointLines(node: 'checkin' | 'security'): string[] {
    const kind = node === 'checkin' ? 'checkin_desk' : 'security_lane'
    const label = node === 'checkin' ? 'Check-in' : 'Security'
    if (!this.hallNav.live) {
      const count = node === 'security' ? this.securityQueueCount() : queueAtNode(this.hallGuests, node)
      return [WALK_PAUSED_LINE, `${count} waiting at ${label.toLowerCase()}`]
    }
    const metrics = this.hallNav.metrics().filter((m) => m.kind === kind)
    const scale = HALL_NAV_TUNING.navSecPerClockSec
    const limit = (HALL_QUEUE_TUNING.bottleneckSec[kind] ?? 600) / scale
    const loads: PointLoad[] = metrics.map((m) => ({
      id: m.id,
      kind: m.kind,
      staffed: m.staffed,
      queueLength: m.queueLength,
      serving: m.serving,
      serviceSec: m.serviceSec / scale,
      estWaitSec: m.estWaitSec / scale,
    }))
    const info = loads.map((p) => ({
      id: p.id,
      kind: p.kind,
      staffed: p.staffed,
      queueLength: p.queueLength,
      serving: p.serving,
      waitSec: p.estWaitSec,
    }))
    const closedForStaff = info.some((p) => !p.staffed)
    return serviceInfoLines(label, info, throughputOf(loads, limit), closedForStaff)
  }

  securityQueueCount(): number {
    return this.hallGuests.filter(
      (g) =>
        !g.dead &&
        g.job === 'depart' &&
        g.node === 'security' &&
        !g.clearedSec &&
        (g.serviceLeft ?? 0) <= 0,
    ).length
  }

  lostPaxCount(): number {
    return this.hallGuests.filter((g) => !g.dead && g.lost).length
  }

  /** Drop a departure wave at the doors so the lane can be watched. */
  demoHallCrowd(n = 8) {
    const fit = this.activeHall() ?? this.fits[0]
    if (!fit) return 0
    const open = this.hallOpenFor(fit)
    const hallId = this.hallKey(fit)
    for (let i = 0; i < n; i++) {
      const g = spawnHallGuest(`demo-${this.secSeq}-${i}`, 'depart', i % 2 ? 'family' : 'budget', {
        hallId,
      })
      g.node = 'entrance'
      g.clearedSec = false
      g.needs.hunger = 12
      g.needs.bladder = 10
      g.needs.shop = 8
      g.needs.play = 8
      g.needs.energy = 15
      g.needs.boarding = 70
      this.routeGuest(g, 'checkin', open)
      this.hallGuests.push(g)
    }
    this.emit()
    return this.hallGuests.length
  }

  /**
   * Line the hall up for a still: check-in with bags, the scanner and belt,
   * a sort pile, and a claim carousel with people waiting and one pickup.
   * Pairs with a loaded bag cart on the apron.
   */
  demoBagParade() {
    const fit = this.activeHall() ?? this.fits[0]
    if (!fit) return 0
    const hallId = this.hallKey(fit)
    this.hallGuests = this.hallGuests.filter((g) => !g.id.startsWith('parade-'))
    const tags: Array<'premium' | 'family' | 'business' | 'budget'> = [
      'premium',
      'family',
      'business',
      'budget',
    ]
    for (let i = 0; i < 7; i++) {
      const g = spawnHallGuest(`parade-d-${i}`, 'depart', tags[i % 4], {
        hallId,
        airlineId: 'northline',
      })
      g.node = 'checkin'
      g.path = []
      g.seg = 0
      g.t = 0
      g.clearedSec = false
      g.hasChecked = true
      g.carryOn = true
      g.bagsDropped = false
      g.bagDepositLeft = 8
      g.needs.hunger = 4
      g.needs.boarding = 80
      g.thought = i % 2 === 0 ? 'Dropping bags at check-in…' : 'Rolling a bag to check-in'
      this.hallGuests.push(g)
    }
    for (let i = 0; i < 3; i++) {
      const g = spawnHallGuest(`parade-s-${i}`, 'depart', 'budget', {
        hallId,
        airlineId: 'northline',
      })
      g.node = 'security'
      g.path = []
      g.clearedSec = false
      g.hasChecked = false
      g.carryOn = true
      g.bagsDropped = true
      g.thought = 'Bags accepted — walking to security'
      this.hallGuests.push(g)
    }
    for (let i = 0; i < 6; i++) {
      const g = spawnHallGuest(`parade-a-${i}`, 'arrive', i % 2 ? 'family' : 'premium', {
        hallId,
        airlineId: 'northline',
      })
      g.node = 'claim'
      g.path = []
      g.clearedSec = true
      g.hasChecked = i === 0
      g.carryOn = true
      g.needs.bags = i === 0 ? 0 : 60
      g.needs.hunger = 4
      g.thought = i === 0 ? 'Got my bag' : 'Waiting for bags off the aircraft…'
      this.hallGuests.push(g)
    }
    this.bagShow = { belt: true, screen: true, carousel: true, sort: true, phase: 0.35 }
    this.bagPhase = 0.35
    const bags = tilesOf(this.tiles, 'bags')[0]
    this.trucks = this.trucks.filter((t) => t.id !== 'parade-cart')
    if (bags) {
      const cart: Truck = {
        id: 'parade-cart',
        kind: 'bags',
        flightId: null,
        x: bags.c + 0.35,
        y: bags.r + 0.15,
        path: [
          { c: bags.c, r: bags.r },
          { c: bags.c + 1, r: bags.r },
        ],
        seg: 0,
        t: 0.15,
        returning: false,
        dwell: 30,
        preDwell: 30,
        patrol: false,
        mission: 'load',
        home: bags,
        cargoUnits: 22,
      }
      this.trucks.push(cart)
    }
    this.emit()
    return this.hallGuests.filter((g) => g.id.startsWith('parade-')).length
  }

  upgradeHall() {
    const fit = this.activeHall()
    if (!fit) {
      this.pushNews('Stamp a terminal first.', 'bad')
      this.emit()
      return
    }
    if (!fit.premade || fit.redesigned) {
      this.pushNews('Custom hall — raise the ceilings by placing bigger items.', 'bad')
      this.emit()
      return
    }
    const tier = (fit.tier ?? 1) as 1 | 2 | 3
    if (tier >= 3) {
      this.pushNews('Prefab is already the top tier.', 'ok')
      this.emit()
      return
    }
    const next = (tier + 1) as 2 | 3
    const need = unlockLevel(next === 2 ? 'prefab_ii' : 'satellite')
    if (this.fieldLevel() < need) {
      this.pushNews(
        `${next === 2 ? 'Prefab II' : 'Satellite'} needs Field level ${need}.`,
        'bad',
      )
      this.emit()
      return
    }
    const base = next === 2 ? 22000 : 48000
    const cost = next === 2 ? base : capstoneCost(base, this.specPaths, 'satellite')
    if (!this.spend(cost, `prefab tier ${next}`)) return
    fit.tier = next
    fit.zones = schemeZones(next)
    fit.items = schemeItems(next)
    fit.signs = schemeSigns(next)
    if (next === 2) {
      fit.rooms.security = Math.max(fit.rooms.security, 3)
      fit.rooms.gate = Math.max(fit.rooms.gate, 3)
      fit.rooms.bathroom = Math.max(fit.rooms.bathroom, 3)
      fit.rooms.food = Math.max(fit.rooms.food, 2)
    } else {
      fit.rooms.security = Math.max(fit.rooms.security, 4)
      fit.rooms.gate = Math.max(fit.rooms.gate, 4)
      fit.rooms.bathroom = Math.max(fit.rooms.bathroom, 4)
      fit.rooms.food = Math.max(fit.rooms.food, 2)
      fit.rooms.souvenir = Math.max(fit.rooms.souvenir, 2)
    }
    applyCeilings(fit)
    this.grantShelf('food', 8)
    this.grantShelf('shop', 6)
    this.releaseHallIfFits()
    this.hallRev++
    this.refreshAdvice()
    this.pushNews(
      `${schemeLabel(next)} — ${fit.capGuests} passengers, security ${Math.round(fit.secPerMin ?? 0)}/min, bags ${fit.bagAllowance}. Upkeep is higher.`,
      'good',
    )
    this.emit()
  }

  /**
   * Commit a build-from-scratch edit (src/terminalbuild) to the active hall.
   * Pays the edit's cost, or banks the refund for removals. Prefab halls are
   * untouched until the player makes their first build edit.
   */
  applyHallBuild(edit: EditResult): boolean {
    const fit = this.activeHall()
    if (!fit || edit.error) return false
    if (edit.cost > 0 && !this.spend(edit.cost, 'Terminal build')) return false
    if (edit.cost < 0 && !this.sandbox) this.credit(-edit.cost, 'refunds', 'Terminal build')
    fit.build = edit.layout
    this.hallRev++
    this.refreshAdvice()
    this.emit()
    return true
  }

  paintHallCell(c: number, r: number, zone: ZoneId): boolean {
    const fit = this.activeHall()
    if (!fit) return false
    if (!fit.zones?.length) fit.zones = fit.premade ? prefabZones() : blankZones()
    const row = fit.zones[r]
    if (!row || c < 0 || c >= row.length) return false
    if (zoneCellBlocked((fit.items ?? []) as PlacedItem[], c, r)) return false
    if (row[c] === zone) return true
    const wasPrefab = fit.premade && !fit.redesigned
    row[c] = zone
    if (wasPrefab) {
      fit.redesigned = true
      applyCeilings(fit)
      this.releaseHallIfFits()
      this.pushNews(
        `Custom layout — the prefab discount is gone. Upkeep is now $${Math.round(
          ceilingsFor({
            premade: fit.premade,
            redesigned: true,
            tier: fit.tier,
            items: (fit.items ?? []) as PlacedItem[],
            roomsSecurity: fit.rooms.security,
          }).upkeepDay,
        )}/day.`,
        'ok',
      )
    }
    this.hallRev++
    this.refreshAdvice()
    this.emit()
    return true
  }

  placeHallItem(id: ItemId) {
    const fit = this.activeHall()
    if (!fit) {
      this.pushNews('Open a hall first.', 'bad')
      this.emit()
      return
    }
    const def = itemDef(id)
    if (!def) return
    const itemLevel = Math.max(def.minFieldLevel, unlockLevel(def.id))
    if (this.fieldLevel() < itemLevel) {
      this.pushNews(`${def.name} needs Field level ${itemLevel}.`, 'bad')
      this.emit()
      return
    }
    if (!fit.zones?.length) fit.zones = fit.premade ? prefabZones() : blankZones()
    const cell = this.hallSpot(id)
    if (!cell) {
      this.pushNews(`Paint a ${def.zones.join(' / ')} cell before placing ${def.name}.`, 'bad')
      this.emit()
      return
    }
    this.commitHallItem(id, cell.c, cell.r, 0)
  }

  /** First hall cell that would accept this item. Does not spend cash or write zones. */
  private hallSpot(id: ItemId): { c: number; r: number } | null {
    const fit = this.activeHall()
    const def = itemDef(id)
    if (!fit || !def) return null
    const itemLevel = Math.max(def.minFieldLevel, unlockLevel(def.id))
    if (this.fieldLevel() < itemLevel) return null
    const zones = fit.zones?.length ? fit.zones : fit.premade ? prefabZones() : blankZones()
    const items = (fit.items ?? []) as PlacedItem[]
    const room = { fieldLevel: this.fieldLevel(), cash: Infinity }
    for (let r = 0; r < zones.length; r++) {
      const row = zones[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        if (placementCheck(zones, items, def, c, r, room).ok) return { c, r }
      }
    }
    return null
  }

  /**
   * Ghost check for a move. The item being carried does not block its own cell,
   * and the move itself is free.
   */
  hallMoveCheck(itemId: string, c: number, r: number): PlacementCheck {
    const fit = this.activeHall()
    const items = (fit?.items ?? []) as PlacedItem[]
    const it = items.find((row) => row.id === itemId)
    const def = it ? itemDef(it.def) : undefined
    if (!fit || !it || !def) return { ok: false, reason: 'Nothing to move', cost: 0 }
    if (it.bundle) return { ok: false, reason: 'Part of the prefab bundle', cost: 0 }
    const zones = fit.zones?.length ? fit.zones : fit.premade ? prefabZones() : blankZones()
    return placementCheck(
      zones,
      items.filter((row) => row.id !== itemId),
      def,
      c,
      r,
      { fieldLevel: this.fieldLevel(), cash: 0, sandbox: true },
    )
  }

  /**
   * Slide a placed item onto another cell. Walls and belts still refuse the drop.
   * Prefab bundle pieces stay where the kit put them.
   */
  moveHallItem(itemId: string, c: number, r: number, rot = 0): boolean {
    const check = this.hallMoveCheck(itemId, c, r)
    const fit = this.activeHall()
    const it = fit?.items?.find((row) => row.id === itemId)
    if (!fit || !it || !check.ok) {
      this.pushNews(`${itemDef(it?.def ?? '')?.name ?? 'Item'}: ${check.reason}.`, 'bad')
      this.emit()
      return false
    }
    it.c = c
    it.r = r
    it.rot = ((Math.round(rot) % 4) + 4) % 4
    this.hallRev++
    this.pushNews(`${itemDef(it.def)?.name ?? 'Item'} moved.`, 'ok')
    this.refreshAdvice()
    this.emit()
    return true
  }

  /** Nine-room frame for the active hall, in the same metres the view uses. */
  private hallFrame(): { plan: RoomPlan; fit: ReturnType<typeof hallFitFor> } | null {
    const hall = this.activeHall()
    if (!hall) return null
    const plan = this.roomPlanForHall(this.hallKey(hall))
    if (!plan) return null
    const hit = matchTerminal(terminals(this), hall.origin ?? null)
    if (!hit) return null
    return { plan, fit: hallFitFor(hit.info) }
  }

  /**
   * Ghost check for a true footprint. Walls, doors, and the nine rooms decide.
   * A red ghost and a refused click share this result.
   */
  hallFootprintCheck(id: ItemId, hx: number, hz: number, rot = 0, ignoreId?: string): PlacementCheck {
    const hall = this.activeHall()
    const def = itemDef(id)
    const spec = footprintSpec(id)
    if (!hall || !def || !spec) return { ok: false, reason: 'Open a hall first', cost: def?.cost ?? 0 }
    const frame = this.hallFrame()
    if (!frame) return { ok: false, reason: 'Hall has no rooms yet', cost: def.cost }
    const spatial = footprintReason(
      frame.plan,
      frame.fit,
      (hall.items ?? []) as PlacedItem[],
      id,
      hx,
      hz,
      rot,
      ignoreId,
    )
    if (spatial) return { ok: false, reason: spatial, cost: def.cost }
    const needLevel = Math.max(def.minFieldLevel, unlockLevel(id))
    if (this.fieldLevel() < needLevel) return { ok: false, reason: `Needs Field level ${needLevel}`, cost: def.cost }
    if (!this.sandbox && this.cash < def.cost) return { ok: false, reason: 'Not enough cash', cost: def.cost }
    return { ok: true, reason: 'Click to place', cost: def.cost }
  }

  /** Place one piece on its true footprint inside the nine rooms. */
  placeHallFootprint(id: ItemId, hx: number, hz: number, rot = 0): boolean {
    const check = this.hallFootprintCheck(id, hx, hz, rot)
    if (!check.ok) {
      this.pushNews(`${itemDef(id)?.name ?? 'Item'}: ${check.reason}.`, 'bad')
      this.emit()
      return false
    }
    const stamp = stampFrom(id, hx, hz, rot)
    const spec = footprintSpec(id)
    if (!stamp || !spec) return false
    const cell = this.hallCellAt(stamp.hx, stamp.hz)
    return this.commitHallItem(id, cell.c, cell.r, stamp.rot, {
      hx: stamp.hx,
      hz: stamp.hz,
      fw: spec.w,
      fd: spec.d,
    })
  }

  /** Slide a footprint piece to a new spot. The same room rules apply. */
  moveHallFootprint(itemId: string, hx: number, hz: number, rot = 0): boolean {
    const hall = this.activeHall()
    const it = hall?.items?.find((row) => row.id === itemId)
    const def = itemDef(it?.def ?? '')
    if (!hall || !it || !def || it.bundle || !footprintSpec(it.def)) {
      this.pushNews(`${def?.name ?? 'Item'} stays where it is.`, 'bad')
      this.emit()
      return false
    }
    const check = this.hallFootprintCheck(it.def as ItemId, hx, hz, rot, itemId)
    if (!check.ok) {
      this.pushNews(`${def.name}: ${check.reason}.`, 'bad')
      this.emit()
      return false
    }
    const stamp = stampFrom(it.def, hx, hz, rot)
    const spec = footprintSpec(it.def)
    if (!stamp || !spec) return false
    const cell = this.hallCellAt(stamp.hx, stamp.hz)
    it.c = cell.c
    it.r = cell.r
    it.rot = stamp.rot
    it.hx = stamp.hx
    it.hz = stamp.hz
    it.fw = spec.w
    it.fd = spec.d
    this.hallRev++
    this.pushNews(`${def.name} moved.`, 'ok')
    this.refreshAdvice()
    this.emit()
    return true
  }

  /** Zone cell under a hall-metre point, so older reads still find the piece. */
  private hallCellAt(hx: number, hz: number): { c: number; r: number } {
    const hall = this.activeHall()
    const zones = hall?.zones?.length ? hall.zones : hall?.premade ? prefabZones() : blankZones()
    const cols = zones[0]?.length || GRID_C
    const rows = zones.length || GRID_R
    const c = Math.max(0, Math.min(cols - 1, Math.floor(((hx + HALL_W / 2) / HALL_W) * cols)))
    const r = Math.max(0, Math.min(rows - 1, Math.floor(((hz + HALL_D / 2) / HALL_D) * rows)))
    return { c, r }
  }

  /** A free spot for this piece, used by tests and the first-fit helpers. */
  findHallFootprint(id: ItemId, rot = 0): { hx: number; hz: number; rot: number } | null {
    const hall = this.activeHall()
    const frame = this.hallFrame()
    if (!hall || !frame || !footprintSpec(id)) return null
    const stamp = findFootprint(frame.plan, frame.fit, (hall.items ?? []) as PlacedItem[], id, rot)
    return stamp ? { hx: stamp.hx, hz: stamp.hz, rot: stamp.rot } : null
  }

  /** Ghost check for the hall build bar. Same rules as the click. */
  hallPlacement(id: ItemId, c: number, r: number): PlacementCheck {
    const fit = this.activeHall()
    const def = itemDef(id)
    if (!fit || !def) return { ok: false, reason: 'Open a hall first', cost: def?.cost ?? 0 }
    const zones = fit.zones?.length ? fit.zones : fit.premade ? prefabZones() : blankZones()
    return placementCheck(zones, (fit.items ?? []) as PlacedItem[], def, c, r, {
      fieldLevel: this.fieldLevel(),
      cash: this.cash,
      sandbox: this.sandbox,
    })
  }

  /** Place one item on a chosen cell, snapped, with a quarter-turn rotation. */
  placeHallItemAt(id: ItemId, c: number, r: number, rot = 0): boolean {
    const check = this.hallPlacement(id, c, r)
    if (!check.ok) {
      this.pushNews(`${itemDef(id)?.name ?? 'Item'}: ${check.reason}.`, 'bad')
      this.emit()
      return false
    }
    return this.commitHallItem(id, c, r, rot)
  }

  private commitHallItem(
    id: ItemId,
    c: number,
    r: number,
    rot: number,
    pose?: { hx: number; hz: number; fw: number; fd: number },
  ): boolean {
    const fit = this.activeHall()
    const def = itemDef(id)
    if (!fit || !def) return false
    if (!fit.zones?.length) fit.zones = fit.premade ? prefabZones() : blankZones()
    if (!this.spend(def.cost, def.name)) return false
    fit.items = fit.items ?? []
    this.hallItemSeq += 1
    fit.items.push({
      id: `it-${id}-${c}-${r}-${this.hallItemSeq}`,
      def: id,
      c,
      r,
      wear: 0,
      rot: ((Math.round(rot) % 4) + 4) % 4,
      hx: pose?.hx,
      hz: pose?.hz,
      fw: pose?.fw,
      fd: pose?.fd,
    })
    if (def.room) fit.rooms[def.room] += 1
    if (def.room === 'food') this.grantShelf('food', 8)
    if (def.room === 'souvenir') this.grantShelf('shop', 6)
    if (def.signs) fit.signs = (fit.signs ?? 0) + def.signs
    applyCeilings(fit)
    this.releaseHallIfFits()
    this.hallRev++
    this.pushNews(
      `${def.name} placed — $${def.upkeep}/day upkeep${def.perk ? `. ${def.perk}.` : '.'}`,
      'ok',
    )
    this.refreshAdvice()
    this.emit()
    return true
  }

  /** Bulldoze a placed hall item for a partial refund. Prefab bundle pieces stay. */
  removeHallItem(itemId: string): boolean {
    const fit = this.activeHall()
    const list = fit?.items ?? []
    const i = list.findIndex((it) => it.id === itemId)
    if (!fit || i < 0) return false
    const it = list[i]
    const def = itemDef(it.def)
    if (it.bundle || !def) {
      this.pushNews('Part of the prefab bundle — it stays with the hall.', 'bad')
      this.emit()
      return false
    }
    list.splice(i, 1)
    if (def.room) fit.rooms[def.room] = Math.max(0, fit.rooms[def.room] - 1)
    if (def.signs) fit.signs = Math.max(0, (fit.signs ?? 0) - def.signs)
    const refund = refundFor(def)
    this.credit(refund, 'refunds', def.name)
    applyCeilings(fit)
    this.releaseHallIfFits()
    this.hallRev++
    this.pushNews(`${def.name} removed — refunded $${refund.toLocaleString('en-US')}.`, 'ok')
    this.refreshAdvice()
    this.emit()
    return true
  }

  /**
   * RCT-style purchase — prefs + wallet + price sensitivity gate the spend.
   * Desperate needs (hunger/energy) can override weak prefs, not empty wallets.
   */
  tryGuestPay(
    g: HallGuest,
    pay: number,
    kind: SpendKind,
    desperate = false,
  ): { ok: boolean; why?: string } {
    if (pay <= 0) return { ok: true }
    const pref = g.prefs[kind] ?? 0
    const floor = 0.28 + this.specMods().tenantPref
    if (!desperate && pref < floor) {
      return { ok: false, why: 'not interested' }
    }
    if (g.wallet < pay) {
      return { ok: false, why: 'broke' }
    }
    // Won't blow most of the wallet on a weak preference (RCT "too expensive").
    const maxShare = desperate ? 0.55 + pref * 0.4 : 0.22 + pref * 0.55
    if (pay > g.wallet * maxShare + 0.01) {
      return { ok: false, why: 'too expensive' }
    }
    g.wallet -= pay
    g.spent += pay
    this.cash += pay
    this.revenue += pay
    this.noteIncome(pay, 'retail_sales')
    // Passenger spend covers amenity / landside expense in the payroll window.
    this.landsideFeeWindow += pay
    return { ok: true }
  }

  /** Uncleared body on airside — eject + fine + heat. */
  secureBreach(g: HallGuest) {
    if (g.clearedSec || !isAirside(g.node)) return
    const open = this.hallOpen()
    g.path = []
    g.seg = 0
    g.t = 0
    g.node = open.has('security') ? 'security' : 'entrance'
    g.happiness -= 12
    g.thought = 'Security pulled me — breach'
    this.securityIncidents += 1
    this.charge(1800, 'penalties', this.simMinutes(), 'Security breach')
    this.reputation = Math.max(0, this.reputation - 2)
    const aid = this.guestAirlineId(g)
    if (aid) this.adjustHeat(aid, -3)
    this.pushNews(
      `Secure-zone breach — fine $1,800. Staff the security lane before passengers walk airside.`,
      'bad',
    )
  }

  serveNode(g: HallGuest, open: Set<HallNode>) {
    const n = g.node
    try {
    if (n === 'info') {
      g.patience = Math.min(100, g.patience + 8)
      g.happiness += 2
      g.lost = false
      g.thought = 'Got directions'
      // Info desk extends lookahead once — like an RCT park map.
      const need = strongestNeed(g)
      if (need) {
        const dest = reachableNeed(need, g.job, open)
        if (dest) this.routeGuest(g, dest, open)
      }
    }
    // A cleared guest walking back through the desk is not checking in again.
    if (n === 'checkin' && g.job === 'depart' && !g.clearedSec) {
      if (this.checkinServers(this.fitByKey(g.hallId) ?? this.activeHall()) <= 0) {
        g.thought = 'Empty check-in — waiting on a clerk'
        g.happiness -= 1.5
        g.needs.boarding = Math.max(0, g.needs.boarding - 1.5)
        return
      }
      // Manor Lords deposit: hold at desk while bags go on the belt.
      if (!g.bagsDropped) {
        if (g.bagDepositLeft == null && !this.checkInOpen(g)) {
          g.bagsDropped = true
          g.thought = 'Check-in closed — carry-on to security'
          if (open.has('security')) this.routeGuest(g, 'security', open)
          return
        }
        if (g.bagDepositLeft == null) {
          const units = bagUnitsForTag(g.tag)
          const manual = this.disruptions.checkInMultiplier() * this.opsEvents.checkInMultiplier()
          g.bagDepositLeft = clamp((0.55 + units * 0.55) * manual, 0.55, 8)
          const fl = this.flights.find((x) => x.id === g.flightId)
          if (fl) {
            fl.bagStage = 'pax_deposit'
            fl.bagsDeposited = fl.bagsDeposited ?? 0
          }
        }
        g.thought =
          bagUnitsForTag(g.tag) >= 2
            ? 'Depositing heavy bags — wait for the belt…'
            : 'Dropping bags at check-in…'
        return
      }
      g.thought = 'Checked in — bags on the belt · next security'
      g.happiness += 1
      if (open.has('security')) this.routeGuest(g, 'security', open)
      else {
        g.thought = 'No security lane — cannot reach the gate'
        g.happiness -= 2
      }
    }
    if (n === 'security' && g.job !== 'depart') {
      g.clearedSec = true
    }
    if (n === 'gate' && g.job === 'depart') {
      if (!this.staffedPost('gate')) {
        g.thought = 'Boarding desk empty — holding'
        g.happiness -= 1
        g.needs.boarding = Math.max(0, g.needs.boarding - 1)
      } else if (!g.thought.includes('Cleared')) {
        g.thought = 'Gate agent ready — boarding'
        g.happiness += 1
      }
    }
    if (n === 'bathroom') {
      const gFit = this.fitByKey(g.hallId) ?? this.activeHall() ?? this.fits[0]
      const wear = this.bumpWear(
        'bath',
        g.tag === 'budget' ? 2.8 : g.tag === 'family' ? 1.8 : 0.7,
        gFit,
      )
      const relief = wear >= 60 ? 30 : wear >= 35 ? 42 : 55
      g.needs.bladder = Math.max(0, g.needs.bladder - relief)
      g.happiness += wear >= 60 ? -2 : 4
      g.thought = wear >= 60 ? 'WC was rough' : 'Relief'
      const wcFit = this.fitByKey(g.hallId) ?? this.activeHall()
      if (wcFit) {
        const dirt = Math.min(100, (wcFit.restroomDirt ?? 0) + restroomDirtFor(g.tag))
        wcFit.restroomDirt = dirt
        const hit = restroomJoyHit(dirt)
        if (hit > 0) {
          g.happiness -= hit
          g.thought = 'Restroom was filthy'
        }
      }
    }
    if (n === 'food') {
      let pay = tagPrice(g.tag, 12, 18, 24, 32)
      let happy = 6
      let brand = false
      const homeFit = this.fitByKey(g.hallId) ?? this.activeHall()
      const outlet = pickOutlet((homeFit?.items ?? []) as PlacedItem[], g.tag)
      if (outlet) {
        pay = Math.round(pay * outlet.spec.priceMult)
        happy = outlet.spec.joy
      }
      if (g.airlineId && this.hasReward(g.airlineId, 'budget_perk')) {
        pay = Math.round(pay * 1.55)
        happy += 2
        brand = true
      }
      pay = this.dressRetail(g.tag, pay, 'tenant')
      if (this.foodShelf < 1) {
        this.walkOffEmptyShelf(g, pay, 'wish they had burgers', open)
      } else if (!this.drawShelf('food')) {
        this.walkOffEmptyShelf(g, pay, 'wish they had burgers', open)
      } else {
        const buy = this.tryGuestPay(g, pay, 'food', g.needs.hunger >= 70)
        if (!buy.ok) {
          this.returnShelf('food')
          g.needs.hunger = Math.max(0, g.needs.hunger - 12)
          g.happiness -= buy.why === 'broke' ? 3 : 1
          g.thought =
            buy.why === 'broke'
              ? 'Hungry but broke'
              : buy.why === 'too expensive'
                ? 'Meal too pricey for my wallet'
                : 'Skipped the counter — not hungry for that'
        } else {
          g.needs.hunger = Math.max(0, g.needs.hunger - (outlet?.spec.hunger ?? 50))
          if (outlet) {
            g.needs.energy = Math.max(0, g.needs.energy - outlet.spec.energy)
            outlet.item.revenue = (outlet.item.revenue ?? 0) + pay
          }
          this.foodCourtRevenue += pay
          this.mealSold = true
          const dine = homeFit && outlet ? this.seatDiner(g, homeFit, outlet.item) : 'walk'
          if (dine === 'stood' && homeFit) this.litterFromMeal(homeFit, outlet?.item ?? null)
          else if (dine !== 'sat') this.giveSnack(g, outlet?.item ?? null)
          g.happiness += happy
          g.thought = brand
            ? `${this.airline(g.airlineId!).name} franchise meal (−$${pay})`
            : outlet
              ? `${itemDef(outlet.item.def)?.name ?? 'Ate'} (−$${pay})`
              : `Ate (−$${pay})`
        }
      }
    }
    if (n === 'shop' && g.showUp?.amenity === 'lounge' && !g.shopDone && g.showUp.spendAmenity > 0) {
      this.chargeStampedShop(g, open)
    } else if (n === 'shop') {
      const pay = this.dressRetail(g.tag, tagPrice(g.tag, 14, 24, 36, 48), 'tenant')
      if (this.shopShelf < 1) {
        this.walkOffEmptyShelf(g, pay, 'wish they had a souvenir', open)
      } else if (!this.drawShelf('shop')) {
        this.walkOffEmptyShelf(g, pay, 'wish they had a souvenir', open)
      } else {
        const buy = this.tryGuestPay(g, pay, 'shop', g.needs.shop >= 75)
        if (!buy.ok) {
          this.returnShelf('shop')
          g.needs.shop = Math.max(0, g.needs.shop - 20)
          g.happiness -= buy.why === 'broke' ? 2 : 0
          g.thought =
            buy.why === 'broke'
              ? 'Wanted a gift — wallet empty'
              : buy.why === 'too expensive'
                ? 'Souvenir — not blowing the trip fund'
                : 'Browsed, did not buy'
        } else {
          g.needs.shop = Math.max(0, g.needs.shop - 60)
          g.happiness += 5
          g.thought = `Bought a souvenir (−$${pay})`
        }
      }
    }
    if (n === 'lounge' && g.showUp?.amenity === 'lounge' && !g.loungeDone) {
      this.chargeStampedLounge(g, open)
    } else if (n === 'lounge' && tagSpendsUp(g.tag)) {
      g.needs.energy = Math.max(0, g.needs.energy - 45)
      let happy = 8
      let pay = 0
      if (g.airlineId && this.hasReward(g.airlineId, 'brand_lounge')) {
        pay = this.dressRetail(g.tag, tagPrice(g.tag, 40, 45, 55, 65), 'lounge')
        const buy = this.tryGuestPay(g, pay, 'lounge', g.needs.energy >= 60)
        if (buy.ok) {
          happy += 10
          g.thought = `${this.airline(g.airlineId).name} first-class lounge (−$${pay})`
          this.adjustHeat(g.airlineId, 0.2)
        } else {
          g.thought =
            buy.why === 'broke' || buy.why === 'too expensive'
              ? 'Lounge fee too rich'
              : 'Skipped the branded lounge'
          happy = 3
        }
      } else {
        g.thought = 'Lounge calm'
      }
      g.happiness += happy
    }
    if (n === 'dayhotel') {
      const pay = g.transfer
        ? tagPrice(g.tag, 40, 52, 65, 78)
        : tagPrice(g.tag, 22, 32, 44, 55)
      const buy = this.tryGuestPay(g, pay, 'nap', g.transfer || g.needs.energy >= 70)
      if (!buy.ok) {
        g.needs.energy = Math.max(0, g.needs.energy - 10)
        g.happiness -= buy.why === 'broke' ? 2 : 0
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Day room too expensive'
            : 'Skipped the day room'
      } else {
        g.needs.energy = Math.max(0, g.needs.energy - 55)
        g.needs.boarding = Math.min(99, g.needs.boarding + 8)
        g.happiness += g.transfer ? 12 : 7
        g.thought = g.transfer
          ? `Day room nap (−$${pay}) — layover gold`
          : `Rented a day room (−$${pay})`
        this.noteLandsideUse(2)
        if (g.transfer && g.airlineId) this.adjustHeat(g.airlineId, 0.15)
      }
    }
    if (n === 'golf') {
      const pay = tagPrice(g.tag, 22, 32, 45, 58)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 70)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 15)
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Golf bay — no cash'
            : 'Skipped golf'
      } else {
        g.needs.play = Math.max(0, g.needs.play - 70)
        g.needs.energy = Math.max(0, g.needs.energy - 20)
        g.happiness += 10
        g.thought = `Indoor golf (−$${pay})`
      }
    }
    if (n === 'waterfall') {
      const pay = tagPrice(g.tag, 10, 16, 28, 38)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 65)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 12)
        g.needs.energy = Math.max(0, g.needs.energy - 8)
        g.thought = 'Looked at the falls for free'
        g.happiness += 2
      } else {
        g.needs.play = Math.max(0, g.needs.play - 55)
        g.needs.energy = Math.max(0, g.needs.energy - 25)
        g.happiness += 9
        g.thought = `Falls tip (−$${pay})`
      }
    }
    if (n === 'gaming') {
      const pay = tagPrice(g.tag, 16, 24, 34, 44)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 70)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 15)
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Games — wallet dry'
            : 'Skipped the den'
      } else {
        g.needs.play = Math.max(0, g.needs.play - 65)
        g.happiness += 7
        g.thought = `Gaming den (−$${pay})`
      }
    }
    if (n === 'spa') {
      const pay = this.dressRetail(
        g.tag,
        g.transfer ? tagPrice(g.tag, 48, 58, 72, 85) : tagPrice(g.tag, 28, 40, 52, 62),
        'lounge',
      )
      const buy = this.tryGuestPay(g, pay, 'lounge', g.needs.energy >= 65 || g.transfer)
      if (!buy.ok) {
        g.needs.energy = Math.max(0, g.needs.energy - 12)
        g.thought =
          buy.why === 'broke' || buy.why === 'too expensive'
            ? 'Massage chairs — too rich'
            : 'Skipped the spa'
        g.happiness -= buy.why === 'broke' ? 1 : 0
      } else {
        g.needs.energy = Math.max(0, g.needs.energy - 50)
        g.needs.boarding = Math.min(99, g.needs.boarding + 5)
        g.happiness += tagSpendsUp(g.tag) ? 12 : 8
        g.thought = `Massage spa (−$${pay})`
        if (g.airlineId && tagSpendsUp(g.tag)) this.adjustHeat(g.airlineId, 0.12)
      }
    }
    if (n === 'pool') {
      const pay = g.transfer
        ? tagPrice(g.tag, 28, 38, 48, 58)
        : tagPrice(g.tag, 16, 24, 34, 44)
      const buy = this.tryGuestPay(g, pay, 'play', g.needs.play >= 60 || g.transfer)
      if (!buy.ok) {
        g.needs.play = Math.max(0, g.needs.play - 12)
        g.needs.energy = Math.max(0, g.needs.energy - 6)
        g.thought = buy.why === 'broke' ? 'Pool — no cash' : 'Skipped the pool'
      } else {
        g.needs.play = Math.max(0, g.needs.play - 55)
        g.needs.energy = Math.max(0, g.needs.energy - 30)
        g.happiness += 9
        g.thought = `Airside pool (−$${pay})`
      }
    }
    if (n === 'gate' && g.job === 'depart') {
      g.thought = 'At the gate'
      const called = this.flightBoardingCall(g)
      const early = !g.showUp && g.needs.hunger < 40 && g.needs.bladder < 40
      if (called || early) {
        g.needs.boarding = 0
        g.dead = true
        g.lost = false
        g.thought = 'Boarded'
        this.paxServed += 1
        this.reputation = Math.min(100, this.reputation + 0.4)
      } else {
        g.needs.boarding = Math.max(g.needs.boarding, 8)
        if (g.showUp) g.thought = 'Waiting for boarding'
      }
    }
    if (n === 'claim' && g.job === 'arrive') {
      if (g.needs.bags > 0) {
        g.path = []
        g.seg = 0
        g.t = 0
        g.thought = 'Waiting at the carousel'
        return
      }
      g.hasChecked = true
      g.thought = 'Got my bag'
      if (g.needs.hunger > 50 && open.has('food')) this.routeGuest(g, 'food', open)
      else if (g.needs.shop > 45 && open.has('shop')) this.routeGuest(g, 'shop', open)
      else if (open.has('exit')) this.routeGuest(g, 'exit', open)
    }
    if (n === 'food' && g.job === 'arrive') {
      if (open.has('exit')) this.routeGuest(g, 'exit', open)
    }
    if (n === 'shop' && g.job === 'arrive') {
      if (open.has('exit')) this.routeGuest(g, 'exit', open)
    }
    if (n === 'exit' && g.job === 'arrive') {
      // Pick leave mode (hotel overnight / long park / bus / rail) as they exit.
      const aid = this.guestAirlineId(g)
      const persona = aid ? this.airline(aid).persona : 'budget'
      const modes = this.pickGuestMode(g.tag, persona, 'arrive')
      g.preferMode = modes.prefer
      g.arriveMode = modes.actual
      this.applyGuestLandside(g, 'arrive')
      if (!g.thought.startsWith('No ') && !g.thought.includes('Hotel') && !g.thought.includes('park')) {
        g.thought = 'Left the airport'
      }
      g.dead = true
      this.paxServed += 1
      this.queueReputation(g.happiness >= 55 ? 0.35 : 0.1)
    }
    } finally {
      // Hall mood adds (lounge, spa, pool, and the rest) have no per-visit ceiling.
      g.happiness = Math.max(0, Math.min(100, g.happiness))
    }
  }

  private resetPillar() {
    this.contractId = null
    this.spotOffer = null
    this.spotInbound = null
    this.termUpliftLitres = 0
    this.spotCool = 0
    this.supplierStanding = {}
    this.fuelIndex = 0
    this.pipelineHoldMinutes = 0
    this.pipelineCoolMinutes = pipelineIntervalMinutes()
    this.bargeMinutes = 0
    this.lastPipelineFlowing = false
    this.lastBargeEmpty = false
    this.tankTier = 1
    this.powerPlantTier = 1
    this.tankLitres = 0
    this.fuelSupply = 'road'
    this.roadMinutes = 0
    this.scaleFleet = {}
    this.bagSystem = 'carts'
    this.paxDesks = 2
    this.paxKiosks = 0
    this.paxBagDrops = 0
    this.scannerLanes = 1
    this.eGates = 0
    this.standScale = {}
    this.hangarScale = {}
    this.lastRailFlowing = false
  }

  private pillarState(): PillarState {
    return {
      contractId: this.contractId,
      tankTier: this.tankTier,
      litres: this.tankLitres,
      supply: this.fuelSupply,
      roadMinutes: this.roadMinutes,
      lineHeld: this.fuelSupply === 'pipeline' && this.pipelineHoldMinutes > 0,
      bargeMinutes: this.bargeMinutes,
      berthOpen: this.berthIsOpen(),
      fleet: { ...this.scaleFleet },
      bagSystem: this.bagSystem,
      desks: this.paxDesks,
      kiosks: this.paxKiosks,
      bagDrops: this.paxBagDrops,
      scannerLanes: this.scannerLanes,
      eGates: this.eGates,
    }
  }

  private pillarField() {
    return {
      size: SIZE,
      fieldLevel: this.fieldLevel(),
      research: this.researchGrants(),
      tiles: this.tiles,
      standPits: this.standPits,
      standScale: this.standScale,
      standClass: this.standClass,
      standAccess: this.standAccess,
      hangarScale: this.hangarScale,
      legacyFuel: this.fuelBrand != null,
    }
  }

  /** Passenger processing is skipped for freighters and other non-pax metal. */
  scaleReport(id: string): PillarReport {
    const report = pillarReport(this.pillarField(), this.pillarState(), id)
    const af = AIRFRAMES[id]
    if (!af || af.paxMax > 0) return report
    const skip = new Set(['early-bags', 'travelator', 'skywalk', 'mover'])
    const hints = report.hints.filter(
      (h) => !skip.has(h.id) && !/^(stand-|bags-|checkin-|security-)/.test(h.id),
    )
    return { ...report, hints, ok: hints.length === 0 }
  }

  private pickOperable(preferred: AircraftKind, cargo: boolean): { af: Airframe | null; blocked: PillarReport | null } {
    const level = this.fieldLevel()
    const research = this.researchGrants()
    const runway = this.longestRunway()
    const accepts = (id: string) => this.scaleReport(id).ok
    const af = pickAirframe(preferred, runway, research, level, accepts)
    if (af) return { af, blocked: null }
    // The strip can take this kind, but the pillar cannot. Hold the slot instead of sending a smaller jet.
    const raw = pickAirframe(preferred, runway, research, level)
    if (raw) return { af: null, blocked: this.scaleReport(raw.id) }
    const smaller = pickAirframeWithFallback(preferred, runway, cargo, research, level, accepts)
    return { af: smaller, blocked: null }
  }

  private fieldFit(): FieldFit {
    return {
      runway: this.longestRunway(),
      helipad: tilesOf(this.tiles, 'helipad').length > 0,
      fieldLevel: this.fieldLevel(),
      research: this.researchGrants(),
      standClasses: tilesOf(this.tiles, 'stand').map((s) => this.standClassAt(s)),
    }
  }

  /** Named metal for a catalog or roster carrier. Empty when the carrier has no fleet list. */
  namedAirframes(id: AirlineId): Airframe[] {
    return resolvedAirframes(this.contractFleet(id))
  }

  /** True when the carrier has no named fleet, or at least one listed type can operate. */
  fleetHasOperable(id: AirlineId): boolean {
    const fleet = this.contractFleet(id)
    if (!fleet) return true
    const frames = resolvedAirframes(fleet)
    if (!frames.length) return false
    const field = this.fieldFit()
    return frames.some((af) => !airframeGap(af, field))
  }

  /** What the field is missing before any listed type can operate. Null when one can. */
  fleetOperateGap(id: AirlineId): string | null {
    const fleet = this.contractFleet(id)
    if (!fleet) return null
    return easiestGap(resolvedAirframes(fleet), this.fieldFit())
  }

  /**
   * Spawn the airplane the contract sold. A named fleet never falls through
   * to a generic jet. A short pillar or a short strip holds the slot.
   */
  private pickForAirline(airlineId: AirlineId, cargo: boolean): { af: Airframe | null; blocked: PillarReport | null } {
    const a = this.airline(airlineId)
    const fleet = this.contractFleet(a.id)
    if (!fleet) {
      if (cargo || a.kind === 'cargo') return this.pickOperable('freighter', true)
      return this.pickOperable(this.pickAircraftKind(airlineId), false)
    }
    const pool = resolvedAirframes(fleet).filter((af) => metalAllowed(fleet, af.id))
    if (!pool.length) return { af: null, blocked: null }
    const field = this.fieldFit()
    const fit = pool.filter((af) => !airframeGap(af, field) && (isHeloAirframe(af) || this.scaleReport(af.id).ok))
    if (fit.length) {
      const chosen = this.wave3.prefersLargerMetal(airlineId) ? largestInFleet(fit) : fit[Math.floor(Math.random() * fit.length)]!
      return { af: chosen, blocked: null }
    }
    const raw = pool.find((af) => !airframeGap(af, field)) ?? pool[0]
    return { af: null, blocked: raw ? this.scaleReport(raw.id) : null }
  }

  /** Keep the aircraft the planner already named when the field can still take it. */
  private airframeForSlot(
    slot: ScheduleSlot,
    airlineId: AirlineId,
    cargo: boolean,
  ): { af: Airframe | null; blocked: PillarReport | null } {
    const fleet = this.contractFleet(airlineId)
    const pinned = slot.airframeId ? AIRFRAMES[slot.airframeId] : undefined
    if (
      fleet &&
      pinned &&
      fleet.includes(pinned.id) &&
      !airframeGap(pinned, this.fieldFit()) &&
      (isHeloAirframe(pinned) || this.scaleReport(pinned.id).ok)
    ) {
      return { af: pinned, blocked: null }
    }
    const picked = this.pickForAirline(airlineId, cargo)
    if (picked.af && fleet) slot.airframeId = picked.af.id
    return picked
  }

  private scaleAdviceItems(): Advice[] {
    return scaleAdvice(this.pillarField(), this.pillarState()).map((h) => ({
      id: h.id,
      title: h.title,
      detail: h.detail,
      fix: h.fix,
      cells: [],
      scope: 'apron' as const,
    }))
  }

  private pillarUpkeepBill(): number {
    if (!this.site) return 0
    const hangars: Record<SizeTier, number> = { small: 0, wide: 0, jumbo: 0 }
    for (const h of tilesOf(this.tiles, 'hangar')) {
      hangars[this.hangarScale[`${h.c},${h.r}`] ?? 'small'] += 1
    }
    let wideStands = 0
    let jumboStands = 0
    let rungBill = 0
    for (const s of tilesOf(this.tiles, 'stand')) {
      const key = `${s.c},${s.r}`
      const size = this.standSize[key]
      const rung = this.standRung[key]
      if (size && rung != null) {
        rungBill += rungUpkeep(size, rung)
        continue
      }
      const scale = this.standScale[key]
      if (scale === 'wide') wideStands += 1
      else if (scale === 'jumbo' || (!scale && this.standClass[key] === 'L')) jumboStands += 1
    }
    return rungBill + this.fittingUpkeepBill() + pillarUpkeep(this.pillarState(), {
      fuelFarms: tilesOf(this.tiles, 'fuel').length,
      hangars,
      fuelRail: tilesOf(this.tiles, 'fuel_rail').length,
      oil: tilesOf(this.tiles, 'oil').length,
      fuelPipe: tilesOf(this.tiles, 'fuel_pipe').length,
      manifold: tilesOf(this.tiles, 'manifold').length,
      berth: tilesOf(this.tiles, 'berth').length,
      travelator: tilesOf(this.tiles, 'travelator').length,
      skywalk: Math.max(0, tilesOf(this.tiles, 'skywalk').length - this.hubStampCount('skywalk', 'skywalk')),
      mover: Math.max(0, tilesOf(this.tiles, 'mover').length - this.hubStampCount('people_mover', 'mover')),
      wideStands,
      jumboStands,
      hydrant: this.hasResearch('hydrant_fuel'),
    })
  }

  /** Bowser loads leave the sim tank. The ramp reads that same number. */
  private drawTankLitres(litres: number) {
    if (litres <= 0) return
    this.tankLitres = Math.max(0, this.tankLitres - litres)
    if (this.contractId) this.termUpliftLitres += litres
  }

  private addTankLitres(litres: number) {
    if (litres <= 0) return
    const cap = tankDef(this.tankTier).capacityLitres
    this.tankLitres = Math.min(cap, this.tankLitres + litres)
  }

  private tickScaleFuel(step: number) {
    const minutes = gameMinutes(step)
    if (minutes <= 0 || !this.site) return
    this.tickSpotClock(step)
    this.tickPipelineClock(minutes)
    const state = this.pillarState()
    const result = tickFuel(this.pillarField(), state, minutes, this.cash)
    this.roadMinutes = state.roadMinutes
    this.bargeMinutes = state.bargeMinutes ?? this.bargeMinutes
    this.tankLitres = state.litres
    let paid = result.paid
    if (result.delivered > 0 && result.paid > 0 && this.contractId) {
      const base = contractById(this.contractId)?.wholesalePerLitre ?? 0
      const unit = this.termUnitPrice(this.contractId)
      if (base > 0) paid = result.paid * (unit / base)
    }
    if (paid > 0) this.charge(paid, 'fuel_purchase')
    if (result.delivered > 0) {
      this.fuelLoads += loadsFromLitres(result.delivered)
      this.fuelJustDelivered = true
    }
    if (result.railFlowing && !this.lastRailFlowing) {
      this.pushNews('Fuel rail is flowing into the tank farm.', 'good')
    }
    const pipeFlowing = result.method === 'pipeline' && result.delivered > 0
    if (pipeFlowing && !this.lastPipelineFlowing) {
      this.pushNews('Pipeline is flowing into the tank farm.', 'good')
    }
    if (result.waitingOnCash && Math.random() < 0.02) {
      this.pushNews('Fuel delivery is waiting on cash.', 'bad')
    }
    this.lastRailFlowing = result.railFlowing
    this.lastPipelineFlowing = pipeFlowing
    const bargeEmpty = this.bargeEmpty()
    if (bargeEmpty && !this.lastBargeEmpty) this.pushNews(BARGE.card, 'bad')
    this.lastBargeEmpty = bargeEmpty
    this.tickSpotDelivery(minutes)
  }

  private clearSpot() {
    this.spotOffer = null
    if (!this.spotInbound?.outage) this.spotInbound = null
  }

  /** Spot card clock. A signed term takes the road, so the card goes away. */
  private tickSpotClock(step: number) {
    if (this.spotCool > 0) this.spotCool = Math.max(0, this.spotCool - step)
    if (this.contractId) {
      this.clearSpot()
      return
    }
    if (this.spotOffer && this.clock >= this.spotOffer.expiresAt) {
      const name = this.spotOffer.flightNo
      const supplier = this.spotOffer.supplier ?? SPOT_OFFER.supplier
      this.noteFuelStanding(this.spotOffer.supplierId ?? 'apex_local', SUPPLIER_STANDING.ignoredShortage)
      this.spotOffer = null
      this.spotCool = SPOT_OFFER.coolSeconds
      this.pushNews(`${name} stays grounded once the tank is empty. The ${supplier} offer expired.`, 'bad')
      return
    }
    if (!this.spotOffer && !this.spotInbound && this.spotCool <= 0) this.maybeRefreshSpot()
  }

  private maybeRefreshSpot() {
    if (tilesOf(this.tiles, 'fuel').length === 0) return
    const needy = this.flights.find((f) => f.phase !== 'gone' && !f.posted.fuel && this.departureNeedsFuel(f))
    const short = this.tankLitres < LITRES_PER_LEGACY_LOAD || (this.fuelLoads < 1 && Boolean(needy))
    if (!short) return
    const quote = this.quoteSpot()
    this.spotOffer = {
      flightNo: needy?.flightNo ?? 'the next departure',
      flightId: needy?.id ?? '',
      expiresAt: this.clock + SPOT_OFFER.deadlineSeconds,
      supplierId: quote.supplierId,
      supplier: quote.supplier,
      perLitre: quote.perLitre,
    }
  }

  /** Highest standing calls. Ties stay with the first supplier, Apex. */
  quoteSpot(): { supplierId: string; supplier: string; perLitre: number } {
    const lead = leadSupplier(this.supplierStanding, FUEL_CONTRACTS)
    const supplier = lead.id === 'apex_local' ? SPOT_OFFER.supplier : lead.name
    return {
      supplierId: lead.id,
      supplier,
      perLitre: rackSpotPerLitre(this.fuelIndex, this.supplierStanding[lead.id] ?? 0),
    }
  }

  termUnitPrice(id: string): number {
    const def = contractById(id)
    if (!def) return 0
    const base = termPerLitre(def.wholesalePerLitre, this.supplierStanding[id] ?? 0)
    const cut = supplyCut(this.fuelSupply, this.supplyLineOpen())
    if (cut === 0) return base
    return Math.round(Math.max(0.001, base + cut) * 1000) / 1000
  }

  /** Rail differential while the spur is connected. Pipeline differential while the manifold is open. Barge uses the rail cut. */
  private supplyLineOpen(): boolean {
    if (this.fuelSupply === 'rail') return railLink(this.pillarField(), this.hasResearch('rail_fuel')).flowing
    if (this.fuelSupply === 'pipeline') return this.pipelineManifoldOpen()
    if (this.fuelSupply === 'barge') return this.berthIsOpen()
    return false
  }

  /** A berth on an owned river-edge cell. Inland cells and inland fields do not count. */
  berthIsOpen(): boolean {
    if (!siteHasWater(this.site)) return false
    return tilesOf(this.tiles, 'berth').some(
      (p) => cellOnWater(p.c, p.r, this.site) && this.ownedPlots.some((plot) => plot.id === cellPlotId(p.c, p.r)),
    )
  }

  /** The lead has passed and no berth is open, so the parcel cannot land. */
  bargeEmpty(): boolean {
    return this.fuelSupply === 'barge' && !this.berthIsOpen() && this.bargeMinutes + 1e-6 >= bargeLeadMinutes()
  }

  /** Connected pipe, and the batch is not in a quality hold. */
  private pipelineManifoldOpen(): boolean {
    if (this.pipelineHoldMinutes > 0) return false
    return pipeLink(this.pillarField(), this.hasResearch('pipeline_fuel')).flowing
  }

  /** Count open flow, then hold the batch. A held batch moves no litres. */
  private tickPipelineClock(minutes: number) {
    if (minutes <= 0 || this.fuelSupply !== 'pipeline') return
    if (this.pipelineHoldMinutes > 0) {
      this.pipelineHoldMinutes = Math.max(0, this.pipelineHoldMinutes - minutes)
      if (this.pipelineHoldMinutes === 0) {
        this.pipelineCoolMinutes = pipelineIntervalMinutes()
        this.pushNews('Pipeline flow resumed.', 'good')
      }
      return
    }
    if (!pipeLink(this.pillarField(), this.hasResearch('pipeline_fuel')).flowing) return
    this.pipelineCoolMinutes = Math.max(0, this.pipelineCoolMinutes - minutes)
    if (this.pipelineCoolMinutes <= 0) {
      this.pipelineHoldMinutes = qualityHoldMinutes()
      this.pushNews(PIPELINE.card, 'bad')
    }
  }

  private noteFuelStanding(id: string, delta: number) {
    if (!id || delta === 0) return
    this.supplierStanding[id] = clampStanding((this.supplierStanding[id] ?? 0) + delta)
  }

  /** Accept puts one road tanker on the clock. Litres land in tankLitres, nowhere else. */
  acceptSpot() {
    if (this.contractId) {
      this.pushNews('A term is signed. Tankers are already on order.', 'ok')
      this.emit()
      return
    }
    if (this.spotInbound) return
    if (tilesOf(this.tiles, 'fuel').length === 0) {
      this.pushNews('Build a fuel farm first.', 'bad')
      this.emit()
      return
    }
    if (!this.fuelBrand) this.fuelBrand = 'apex'
    const quote = this.spotOffer
      ? {
          supplier: this.spotOffer.supplier ?? SPOT_OFFER.supplier,
          perLitre: this.spotOffer.perLitre ?? this.quoteSpot().perLitre,
        }
      : this.quoteSpot()
    this.spotInbound = {
      litres: SPOT_OFFER.tankerLitres,
      perLitre: quote.perLitre,
      minutesLeft: SPOT_OFFER.leadMinutes,
      waitNoted: false,
      supplier: quote.supplier,
    }
    this.spotOffer = null
    const bill = Math.round(SPOT_OFFER.tankerLitres * quote.perLitre)
    this.pushNews(
      `${quote.supplier} tanker on the road. ${SPOT_OFFER.tankerLitres.toLocaleString('en-US')} L at $${quote.perLitre.toFixed(3)}/L ($${bill.toLocaleString('en-US')}).`,
      'ok',
    )
    this.emit()
  }

  declineSpot() {
    if (!this.spotOffer) return
    const name = this.spotOffer.flightNo
    const supplier = this.spotOffer.supplier ?? SPOT_OFFER.supplier
    this.noteFuelStanding(this.spotOffer.supplierId ?? 'apex_local', SUPPLIER_STANDING.ignoredShortage)
    this.spotOffer = null
    this.spotCool = SPOT_OFFER.coolSeconds
    this.pushNews(`${name} stays grounded once the tank is empty. The ${supplier} offer is closed.`, 'bad')
    this.emit()
  }

  /** Leave the term. The tank and the brand stay. Spot is the next order. */
  dropFuelTerm() {
    const def = contractById(this.contractId)
    if (!def) return
    this.noteFuelStanding(def.id, SUPPLIER_STANDING.brokeTerm)
    this.contractId = null
    this.termUpliftLitres = 0
    const standing = this.supplierStanding[def.id] ?? 0
    this.pushNews(`Dropped ${def.name}. Standing is ${standing}. Spot tankers are on the phone.`, 'ok')
    this.emit()
  }

  private tickSpotDelivery(minutes: number) {
    const inbound = this.spotInbound
    if (!inbound || minutes <= 0) return
    if (this.contractId && !inbound.outage) return
    inbound.minutesLeft -= minutes
    if (inbound.minutesLeft > 1e-6) return
    inbound.minutesLeft = 0
    const cap = tankDef(this.tankTier).capacityLitres
    const room = Math.max(0, cap - this.tankLitres)
    if (room <= 0) {
      this.spotInbound = null
      this.pushNews('Tank is full. The spot tanker turned around.', 'ok')
      return
    }
    const litres = Math.min(room, inbound.litres)
    const paid = litres * inbound.perLitre
    if (paid > this.cash + 1e-6) {
      if (!inbound.waitNoted) {
        inbound.waitNoted = true
        this.pushNews('Fuel delivery is waiting on cash.', 'bad')
      }
      return
    }
    this.charge(paid, 'fuel_purchase', this.simMinutes(), 'Spot tanker')
    this.addTankLitres(litres)
    this.fuelLoads += loadsFromLitres(litres)
    this.fuelJustDelivered = true
    this.spotInbound = null
  }

  /** Midnight gap on a signed band. Overage above the band is billed up to the spot price. */
  private settleTermShortfall(completedDay: number) {
    const uplift = this.termUpliftLitres
    this.termUpliftLitres = 0
    const def = contractById(this.contractId)
    if (!def) return
    const band = termBandLitres(def.id)
    if (band <= 0) return
    const stamp = (completedDay + 1) * SIM_MINUTES_PER_GAME_DAY - 1
    const unit = this.termUnitPrice(def.id)
    if (uplift + 1e-6 < band) {
      const bill = (band - uplift) * unit * SPOT_OFFER.shortfallFraction
      if (!(bill > 0)) return
      const taken = this.charge(bill, 'fuel_purchase', stamp, 'Term shortfall')
      this.noteFuelStanding(
        def.id,
        taken + 1e-6 >= bill ? SUPPLIER_STANDING.paidShortfall : SUPPLIER_STANDING.ignoredShortage,
      )
      this.pushNews(`Term shortfall — ${def.name}. Fly more, or drop back to spot.`, 'bad')
      return
    }
    this.noteFuelStanding(def.id, SUPPLIER_STANDING.tookBand)
    const extra = uplift - band
    const premium = Math.max(0, rackSpotPerLitre(this.fuelIndex, 0) - unit)
    const bill = extra * premium
    if (!(bill > 0)) return
    this.charge(bill, 'fuel_purchase', stamp, 'Term overage')
    this.pushNews(`Term overage — ${def.name}. Litres above the band billed at the spot price.`, 'ok')
  }

  signFuel(brand: FuelBrand) {
    if (this.fuelBrand === brand) return
    const c = FUEL[brand]
    if (!this.spend(c.sign, `${c.name} contract`)) return
    this.fuelBrand = brand
    if (!this.contractId || this.contractId === 'apex_local' || this.contractId === 'kiln_regional') {
      this.contractId = brand === 'kiln' ? 'kiln_regional' : 'apex_local'
    }
    this.clearSpot()
    this.pushNews(`Signed ${c.name}. Road tankers follow the term.`, 'ok')
    this.emit()
  }

  signScaleContract(id: string) {
    if (this.contractId === id) return
    const gate = canSignContract(id, this.fieldLevel(), this.researchGrants())
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    const def = FUEL_CONTRACTS.find((c) => c.id === id)
    if (!def || !this.spend(gate.cost, `${def.name} contract`)) return
    this.contractId = id
    const brand = brandForContract(id)
    if (brand) this.fuelBrand = brand
    this.clearSpot()
    this.termUpliftLitres = 0
    const band = termBandLitres(id)
    const unit = this.termUnitPrice(id)
    this.pushNews(
      `Signed ${def.name}. ${def.tankerLitres.toLocaleString('en-US')} L road tankers at $${unit.toFixed(3)}/L. Band ${band.toLocaleString('en-US')} L a day.`,
      'ok',
    )
    this.emit()
  }

  upgradeTank() {
    const gate = canUpgradeTank(this.tankTier, this.fieldLevel(), this.researchGrants())
    if (!gate.ok || gate.next == null) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    if (!this.spend(gate.cost, 'tank farm')) return
    this.tankTier = gate.next
    this.bumpMap()
    this.pushNews(`Tank farm holds ${tankDef(this.tankTier).capacityLitres.toLocaleString('en-US')} L.`, 'good')
    this.emit()
  }

  setFuelSupply(supply: FuelSupply) {
    if (supply === 'barge' && !siteHasWater(this.site)) {
      this.pushNews('This field has no river. Barges do not call here.', 'bad')
      this.emit()
      return
    }
    if (supply === 'rail' && !this.hasResearch('rail_fuel')) {
      this.pushNews('Research Fuel rail first. The trains still need a line and a station.', 'bad')
      this.emit()
      return
    }
    if (supply === 'barge' && !this.hasResearch('rail_fuel')) {
      this.pushNews('Research Fuel rail first. The berth still has to sit on the river.', 'bad')
      this.emit()
      return
    }
    if (supply === 'pipeline' && !this.hasResearch('pipeline_fuel')) {
      this.pushNews('Research the fuel pipeline first. The pipe still needs a line and a manifold.', 'bad')
      this.emit()
      return
    }
    this.fuelSupply = supply
    this.roadMinutes = 0
    this.bargeMinutes = 0
    this.lastBargeEmpty = false
    const label =
      supply === 'rail'
        ? 'Fuel supply set to rail.'
        : supply === 'pipeline'
          ? 'Fuel supply set to pipeline.'
          : supply === 'barge'
            ? 'Fuel supply set to barge.'
            : 'Fuel supply set to road tankers.'
    this.pushNews(label, 'ok')
    this.emit()
  }

  /** One spot truck during a pipeline hold. A signed term stays signed. */
  orderPipelineSpot() {
    if (this.pipelineHoldMinutes <= 0) {
      this.pushNews('The pipeline is flowing. A spot truck is not on the card.', 'ok')
      this.emit()
      return
    }
    if (this.spotInbound) return
    if (tilesOf(this.tiles, 'fuel').length === 0) {
      this.pushNews('Build a fuel farm first.', 'bad')
      this.emit()
      return
    }
    if (!this.fuelBrand) this.fuelBrand = 'apex'
    const quote = this.quoteSpot()
    this.spotOffer = null
    this.spotInbound = {
      litres: SPOT_OFFER.tankerLitres,
      perLitre: quote.perLitre,
      minutesLeft: SPOT_OFFER.leadMinutes,
      waitNoted: false,
      supplier: quote.supplier,
      outage: true,
    }
    const bill = Math.round(SPOT_OFFER.tankerLitres * quote.perLitre)
    this.pushNews(
      `Spot truck ordered. ${SPOT_OFFER.tankerLitres.toLocaleString('en-US')} L at $${quote.perLitre.toFixed(3)}/L ($${bill.toLocaleString('en-US')}).`,
      'ok',
    )
    this.emit()
  }

  /** One spot truck while the berth is empty. A signed term stays signed. */
  orderBargeSpot() {
    if (!this.bargeEmpty()) {
      this.pushNews('A barge parcel is still on the way.', 'ok')
      this.emit()
      return
    }
    if (this.spotInbound) return
    if (tilesOf(this.tiles, 'fuel').length === 0) {
      this.pushNews('Build a fuel farm first.', 'bad')
      this.emit()
      return
    }
    if (!this.fuelBrand) this.fuelBrand = 'apex'
    const quote = this.quoteSpot()
    this.spotOffer = null
    this.spotInbound = {
      litres: SPOT_OFFER.tankerLitres,
      perLitre: quote.perLitre,
      minutesLeft: SPOT_OFFER.leadMinutes,
      waitNoted: false,
      supplier: quote.supplier,
      outage: true,
    }
    const bill = Math.round(SPOT_OFFER.tankerLitres * quote.perLitre)
    this.pushNews(
      `Spot truck ordered. ${SPOT_OFFER.tankerLitres.toLocaleString('en-US')} L at $${quote.perLitre.toFixed(3)}/L ($${bill.toLocaleString('en-US')}).`,
      'ok',
    )
    this.emit()
  }

  buyScaleVehicle(type: VehicleType) {
    const gate = canBuyVehicle(type, this.fieldLevel(), this.researchGrants())
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    const label = VEHICLE_OFFERS.find((o) => o.type === type)?.role ?? type
    if (!this.spend(gate.cost, label)) return
    this.scaleFleet[type] = (this.scaleFleet[type] ?? 0) + 1
    this.bumpMap()
    this.pushNews(`${label} added to the ramp fleet.`, 'ok')
    this.emit()
  }

  upgradeBagSystem() {
    const gate = canUpgradeBags(this.bagSystem, this.fieldLevel(), this.researchGrants())
    if (!gate.ok || !gate.next) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    const def = BAG_SYSTEMS[gate.next]
    if (!this.spend(gate.cost, def.name)) return
    this.bagSystem = gate.next
    this.pushNews(`${def.name} online. ${def.bagsPerMin} bags a minute.`, 'good')
    this.emit()
  }

  buyPaxUnit(unit: PaxUnit) {
    const gate = canBuyPax(unit, this.fieldLevel(), this.researchGrants())
    if (!gate.ok) {
      this.pushNews(gate.why, 'bad')
      this.emit()
      return
    }
    if (!this.spend(gate.cost, PAX_UNITS[unit].name)) return
    if (unit === 'desk') this.paxDesks += 1
    else if (unit === 'kiosk') this.paxKiosks += 1
    else if (unit === 'bagdrop') this.paxBagDrops += 1
    else if (unit === 'scanner') this.scannerLanes += 1
    else this.eGates += 1
    this.pushNews(`${PAX_UNITS[unit].name} added.`, 'ok')
    this.emit()
  }

  buyLoads() {
    if (!this.fuelBrand) {
      this.pushNews('Sign a fuel carrier first.', 'bad')
      return
    }
    const c = FUEL[this.fuelBrand]
    const cost = safFuelCost(c.wholesale, LOADS_PER_BUY, this.lateSites)
    const saf = fuelMultiplier(this.lateSites) !== 1
    if (!this.spend(cost, 'fuel loads', 'fuel_purchase', saf ? 'tier3plus' : 'sim')) return
    this.fuelLoads += LOADS_PER_BUY
    this.addTankLitres(LITRES_PER_LEGACY_LOAD * LOADS_PER_BUY)
    this.pushNews(`Four loads on the farm. ${this.fuelLoads} ready.`, 'ok')
    this.emit()
  }

  signCater(brand: CaterBrand) {
    if (this.caterBrand === brand) return
    const c = CATER[brand]
    if (!this.spend(c.sign, `${c.name} contract`)) return
    this.caterBrand = brand
    this.pushNews(`Signed ${c.name}. Snack bar trucks can bill airlines now.`, 'ok')
    this.emit()
  }

  /**
   * Bodies standing this post now. On break, walking to the post, and any
   * other stage (there is no off-shift on this roster) do not count.
   */
  onPostCount(post: StaffPost): number {
    let n = 0
    for (const s of this.hallStaff) if (s.node === post && onPostNow(s.stage)) n += 1
    return n
  }

  /** True when a body is on that post now. */
  staffedPost(post: StaffPost): boolean {
    return this.onPostCount(post) > 0
  }

  securityLevel(): number {
    let n = 0
    for (const f of this.fits) {
      n += f.rooms.security
      // Worn lanes soft-cap effective screening.
      if ((f.wearSec ?? 0) >= 70) n -= 1
      else if ((f.wearSec ?? 0) >= 40) n -= 0.5
    }
    if (tilesOf(this.tiles, 'police').length) n += 1
    // Bodies at the lane beat empty desks.
    if (this.staffedPost('security')) n += 0.75
    else if (this.deskStaff < 1 && n > 0) n -= 0.5
    // Underfunded security staff can't staff the lanes they built.
    const staff = this.budgetOf('security') / 100
    if (staff < 0.35) n -= 1
    else if (staff < 0.6) n -= 0.5
    return Math.max(0, Math.floor(n))
  }

  readiness() {
    return {
      stands: tilesOf(this.tiles, 'stand').length,
      fuelContract: Boolean(this.fuelBrand),
      fuelFarm: tilesOf(this.tiles, 'fuel').length > 0,
      fire: tilesOf(this.tiles, 'fire').length > 0,
      police: tilesOf(this.tiles, 'police').length > 0,
      terminal: tilesOf(this.tiles, 'terminal').length > 0,
      security: this.securityLevel(),
      bags: tilesOf(this.tiles, 'bags').length > 0,
      snack: tilesOf(this.tiles, 'snack').length > 0,
      catering: Boolean(this.caterBrand) && tilesOf(this.tiles, 'snack').length > 0,
      cargo: tilesOf(this.tiles, 'cargo').length > 0,
      road: tilesOf(this.tiles, 'road').length >= 3,
      runway: runwayStrips(this.tiles, MIN_RUNWAY).length > 0,
      heavyRunway: this.hasHeavyRunway(),
      helipad: tilesOf(this.tiles, 'helipad').length > 0,
      tower: tilesOf(this.tiles, 'tower').length > 0,
      hangar: tilesOf(this.tiles, 'hangar').length > 0,
      wearBath: this.avgWear().bath,
      wearSec: this.avgWear().sec,
    }
  }

  meetsReq(id: AirlineId): boolean {
    const a = this.airline(id)
    const r = this.readiness()
    if (!r.runway) return false
    if (a.req.heavyRunway && !r.heavyRunway) return false
    if (this.reputation < a.minRep) return false
    const q = a.req
    return (
      r.stands >= q.stands &&
      (!q.fuelContract || r.fuelContract) &&
      (!q.fuelFarm || r.fuelFarm) &&
      (!q.fire || r.fire) &&
      (!q.police || r.police) &&
      (!q.terminal || r.terminal) &&
      r.security >= q.security &&
      (!q.bags || r.bags) &&
      (!q.snack || r.snack) &&
      (!q.catering || r.catering) &&
      (!q.cargo || r.cargo) &&
      (!q.road || r.road) &&
      (!q.tower || r.tower)
    )
  }

  missingReq(id: AirlineId): string[] {
    const a = this.airline(id)
    const r = this.readiness()
    const miss: string[] = []
    const roster = rosterAirline(id)
    if (roster && this.rosterAirport().size < unlockGate(roster).size) miss.push(`Field Lv${unlockGate(roster).size}+`)
    if (this.carrierNeedsPad(id) && !r.helipad) miss.push(HELIPAD_NEED)
    if (this.reputation < a.minRep) miss.push(`rep ${a.minRep}+`)
    if (!r.runway) miss.push('runway')
    if (a.req.heavyRunway && !r.heavyRunway) miss.push('heavy runway')
    if (r.stands < a.req.stands) miss.push(`${a.req.stands} stands`)
    if (a.req.fuelContract && !r.fuelContract) miss.push('fuel contract')
    if (a.req.fuelFarm && !r.fuelFarm) miss.push('fuel farm')
    if (a.req.fire && !r.fire) miss.push('fire station')
    if (a.req.police && !r.police) miss.push('police')
    if (a.req.terminal && !r.terminal) miss.push('terminal')
    if (r.security < a.req.security) miss.push(`security ×${a.req.security}`)
    if (a.req.bags && !r.bags) miss.push('bag sort')
    if (a.req.snack && !r.snack) miss.push('snack bar')
    if (a.req.catering && !r.catering) miss.push('catering contract')
    if (a.req.cargo && !r.cargo) miss.push('cargo shed')
    if (a.req.road && !r.road) miss.push('access road')
    if (a.req.tower && !r.tower) miss.push('control tower')
    const gap = this.fleetOperateGap(id)
    if (gap && !(this.carrierNeedsPad(id) && gap === 'Helipad')) miss.push(gap)
    return miss
  }

  /** Contract checklist — met and missing, player-facing labels. */
  reqReport(id: AirlineId): { label: string; met: boolean }[] {
    const a = this.airline(id)
    const r = this.readiness()
    const rows: { label: string; met: boolean }[] = [
      { label: `Reputation ${a.minRep}+`, met: this.reputation >= a.minRep },
      { label: 'Runway', met: r.runway },
    ]
    if (a.req.heavyRunway) rows.push({ label: 'Heavy runway', met: r.heavyRunway })
    rows.push({
      label: a.req.stands === 1 ? '1 stand' : `${a.req.stands} stands`,
      met: r.stands >= a.req.stands,
    })
    const craft = this.contractCraftNeed(id)
    if (craft) rows.push(craft)
    if (this.carrierNeedsPad(id) && !r.helipad) rows.push({ label: HELIPAD_NEED, met: false })
    if (a.req.fuelContract) rows.push({ label: 'Fuel contract', met: r.fuelContract })
    if (a.req.fuelFarm) rows.push({ label: 'Fuel farm', met: r.fuelFarm })
    if (a.req.fire) rows.push({ label: 'Fire station', met: r.fire })
    if (a.req.police) rows.push({ label: 'Police post', met: r.police })
    if (a.req.terminal) rows.push({ label: 'Terminal', met: r.terminal })
    if (a.req.security > 0) {
      rows.push({
        label: a.req.security === 1 ? 'Security lane' : `Security ×${a.req.security}`,
        met: r.security >= a.req.security,
      })
    } else if (a.kind === 'pax') {
      rows.push({ label: 'No security lane needed', met: true })
    }
    if (a.req.bags) rows.push({ label: 'Bag sort', met: r.bags })
    if (a.req.snack) rows.push({ label: 'Snack bar', met: r.snack })
    if (a.req.catering) rows.push({ label: 'Catering contract', met: r.catering })
    if (a.req.cargo) rows.push({ label: 'Cargo shed', met: r.cargo })
    if (a.req.road) rows.push({ label: 'Access road', met: r.road })
    if (a.req.tower) rows.push({ label: 'Control tower', met: r.tower })
    return rows
  }

  /** Top line of the letter: does the field qualify right now, and what is missing. */
  letterVerdict(id: AirlineId): { met: boolean; label: string; missing: string[] } {
    const missing = this.reqReport(id)
      .filter((row) => !row.met)
      .map((row) => row.label)
    if (!missing.length) return { met: true, label: 'Qualifies now — every row is met', missing }
    const head = missing.slice(0, 2).join(', ')
    const more = missing.length > 2 ? ` +${missing.length - 2}` : ''
    return { met: false, label: `Not ready — missing ${head}${more}`, missing }
  }

  /**
   * Aircraft row for the letter. Same names, seats, stand class, and runway
   * as the Airlines card. Met only when every listed type can operate.
   * Null when the carrier has no named fleet.
   */
  contractCraftNeed(id: AirlineId): { label: string; met: boolean } | null {
    const fleet = this.contractFleet(id)
    if (!fleet) return null
    const pool = resolvedAirframes(fleet)
    if (!pool.length) return { label: 'Fleet not listed', met: false }
    const field = this.fieldFit()
    return { label: fleetCardLine(pool), met: pool.every((af) => !airframeGap(af, field)) }
  }

  /**
   * Capacity warning for the open letter. Warns only — signing stays a player choice.
   * Helicopter fleets count pads. Everyone else counts stands.
   */
  letterCapacity(id: AirlineId): string {
    const frames = this.namedAirframes(id)
    const heli = frames.length > 0 && frames.every((af) => isHeloAirframe(af))
    const usesPad = (airlineId: AirlineId) => {
      const theirs = this.namedAirframes(airlineId)
      return theirs.length > 0 && theirs.every((af) => isHeloAirframe(af))
    }
    const places = heli ? tilesOf(this.tiles, 'helipad').length : tilesOf(this.tiles, 'stand').length
    const signedWant = this.signed.reduce((sum, sid) => {
      if (usesPad(sid) !== heli) return sum
      return sum + carrierTurnsWanted(this.airline(sid).tier)
    }, 0)
    return capacityWarning(places, signedWant, carrierTurnsWanted(this.airline(id).tier), heli ? 'pad' : 'stand')
  }

  /**
   * At least one of the carrier's types can use this field.
   * An empty apron still banks slots — the tower holds them until a stand exists.
   * A helicopter needs a pad. A fleet the stands cannot take must not fill the passenger bank.
   */
  private airlineParkable(id: AirlineId): boolean {
    if (this.carrierNeedsPad(id)) return tilesOf(this.tiles, 'helipad').length > 0 && this.fleetHasOperable(id)
    if (!tilesOf(this.tiles, 'stand').length && !tilesOf(this.tiles, 'helipad').length) return true
    return this.fleetHasOperable(id)
  }

  /** Helicopter roster, or a fleet that is only rotary. */
  carrierNeedsPad(id: AirlineId): boolean {
    const roster = rosterAirline(id)
    if (roster?.type === 'heli') return true
    const frames = this.namedAirframes(id)
    return frames.length > 0 && frames.every((af) => isHeloAirframe(af))
  }

  /** Signed rotary carrier with nowhere to land. The score stays put until a pad exists. */
  waitingOnHelipad(id: string): boolean {
    return this.signed.includes(id) && this.carrierNeedsPad(id) && !this.readiness().helipad
  }

  /** Relations row copy while `waitingOnHelipad` is true. */
  relationWaitLine(id: string): string | null {
    return this.waitingOnHelipad(id) ? HELIPAD_WAIT : null
  }

  /**
   * Why a signed carrier has not turned a flight, when that reason is on the
   * letter, the relations row, or the slot. Null when nothing is holding them.
   */
  carrierBlockLine(id: string): string | null {
    const wait = this.relationWaitLine(id)
    if (wait) return wait
    if (!this.signed.includes(id)) return null
    if (!this.airlineParkable(id)) return this.fleetOperateGap(id) ?? 'No stand their aircraft can use'
    const lead = this.commercialLead[id]
    if (lead && !lead.opened && this.leadGateClock(id) > this.clock) return `First flight in ${lead.leadDays} days`
    const slot = this.openSchedule().find((s) => s.airline === id && s.delayReason)
    if (slot?.delayReason) return slot.delayReason
    const upcoming = this.openSchedule().find((s) => s.airline === id && s.eta > this.clock)
    if (upcoming) return `Next turn in ${Math.max(1, Math.round(upcoming.eta - this.clock))}s`
    return null
  }

  /** The only thing keeping this fleet on the ground is a missing pad. */
  padOnlyGap(id: AirlineId): boolean {
    if (!this.carrierNeedsPad(id) || this.readiness().helipad) return false
    const fleet = this.contractFleet(id)
    if (!fleet) return false
    const frames = resolvedAirframes(fleet)
    if (!frames.length) return false
    const field = { ...this.fieldFit(), helipad: true }
    return frames.some((af) => !airframeGap(af, field))
  }

  /** This slot lands on a pad, so it must not take a runway gap or cascade the jet bank. */
  private slotUsesPad(slot: ScheduleSlot): boolean {
    if (this.carrierNeedsPad(slot.airline)) return true
    const af = slot.airframeId ? AIRFRAMES[slot.airframeId] : undefined
    return Boolean(af && isHeloAirframe(af))
  }

  considerOffers() {
    if (this.offer || this.offerCool > 0) return
    // A small book waits until its carriers are turning flights before the next one writes.
    const settled = lettersSettled({
      signed: this.signed.length,
      flightsDone: this.flightsDone,
      sinceSign: this.clock - this.lastSignAt,
    })
    if (!settled) return
    const site = this.site ? LAND[this.site] : null
    // Light procedural regionals — keep the phone from always being the same six faces.
    if (
      !ROSTER_LIVE &&
      this.signed.length >= 1 &&
      this.extraAirlines.filter((a) => a.procedural).length < 5 &&
      Math.random() < 0.4
    ) {
      const used = this.allAirlines().map((a) => a.name)
      const proc = createProcAirline(used)
      if (!this.extraAirlines.some((a) => a.id === proc.id)) this.extraAirlines.push(proc)
    }
    const procSigned = this.signed.filter((id) => this.airline(id).procedural).length
    const candidates = this.allAirlines().filter((a) => {
      if (ULCC_IDS.includes(a.id)) return false
      if (this.negotiationBridge?.barred(a.id)) return false
      if (this.signed.includes(a.id)) return false
      if (this.isBanned(a.id)) return false
      if (a.procedural && procSigned >= 3) return false
      if (!this.rosterOpen(a.id)) return false
      if (!this.tierUnlocked(a.tier)) return false
      if (!this.meetsReq(a.id)) return false
      if (!this.fleetHasOperable(a.id) && !this.padOnlyGap(a.id)) return false
      // Start focus biases early letters (never hard-locks the other path).
      if (this.startFocus === 'cargo' && a.kind !== 'cargo' && this.signed.length < 1) {
        return false
      }
      if (this.startFocus === 'pax' && a.kind === 'cargo' && this.signed.length < 1) {
        return Math.random() < 0.12
      }
      if (a.kind === 'cargo' && site && site.cargoMult < 0.9 && Math.random() > 0.35) {
        if (this.startFocus !== 'cargo' && this.startFocus !== 'hybrid') return false
      }
      const airlinePull = this.tycoonAirlineInterest()
      if (a.kind === 'pax' && this.landsidePaxMult() < 0.9 && Math.random() > 0.35 + airlinePull) {
        if (this.startFocus === 'cargo') return false
      }
      return true
    })
    if (!candidates.length) return
    // Prefer lower tier first, then cheaper landing; sprinkle procs after one major.
    const padReady = this.readiness().helipad
    candidates.sort((a, b) => {
      // A pad-less helicopter may still write, but it must not crowd out a carrier that can fly.
      const aGrounded = this.carrierNeedsPad(a.id) && !padReady ? 1 : 0
      const bGrounded = this.carrierNeedsPad(b.id) && !padReady ? 1 : 0
      if (aGrounded !== bGrounded) return aGrounded - bGrounded
      if (this.startFocus === 'cargo' || this.startFocus === 'hybrid') {
        if (a.kind === 'cargo' && b.kind !== 'cargo') return -1
        if (b.kind === 'cargo' && a.kind !== 'cargo') return 1
      }
      if (a.tier !== b.tier) return a.tier - b.tier
      if (Boolean(a.procedural) !== Boolean(b.procedural)) return a.procedural ? 1 : -1
      return a.landing - b.landing
    })
    const procs = candidates.filter((c) => c.procedural)
    const cargoFirst = candidates.filter((c) => c.kind === 'cargo')
    const pickA =
      this.startFocus === 'cargo' && cargoFirst.length && this.signed.length < 2
        ? cargoFirst[0]
        : this.signed.length >= 1 && procs.length && Math.random() < 0.4
          ? pick(procs)
          : candidates[0]
    const negotiated = this.negotiationDesk().present(pickA)
    const deadline = this.signed.length
      ? CONTRACT_LETTER_DEADLINE
      : FIRST_CONTRACT_LETTER_DEADLINE
    this.offer = { airline: negotiated, age: 0, deadline }
    this.noteSound('contract_offer')
    const shown = this.airline(negotiated)
    const tag = shown.procedural && !ULCC_IDS.includes(shown.id) ? ' (regional)' : ''
    this.pushNews(
      `${shown.name}${tag} sent a contract letter — open it on the left before it expires.`,
      'good',
    )
  }

  negotiationPanel() {
    return this.negotiationBridge?.panel() ?? null
  }

  rivalCard() {
    return this.negotiationBridge?.rivalCard() ?? null
  }

  /** Game-days the Bellwater price war has run. 0 before the first day close. */
  priceWarDay(): number {
    return this.priceWar?.day ?? 0
  }

  priceWarCard() {
    return this.priceWar?.card() ?? null
  }

  /**
   * Walk-in kept after Bellwater and walked-airline cuts.
   * Losses add, then stop at the cap in the price-war table.
   */
  rivalWalkInFactor(): number {
    const negotiation = this.negotiationBridge?.trafficFactor() ?? 1
    return composeRivalWalkIn(negotiation, this.warWalkInFactor())
  }

  /** One game day of the price war. The economy day-close calls this. */
  advancePriceWarDay() {
    if (!this.site) return
    const war = this.ensurePriceWar()
    const event = war.advanceDay({
      walkedAirlineIds: this.negotiationBridge?.rivalCard()?.airlines ?? [],
      postedFeeIndex: this.postedFeeIndex(),
      softOffer: this.softContractOffer(),
    })
    if (event.started) {
      this.raiseAlert({
        key: `event:price-war:${event.warId}`,
        severity: 'warning',
        title: 'Bellwater price war',
        detail: event.note,
        event: true,
      })
    }
    if (event.note) this.pushNews(event.note, event.tone)
    if (event.resolved && event.warId) this.alerts.clear(`event:price-war:${event.warId}`)
    if (event.poachedOfferId && this.offer?.airline === event.poachedOfferId) {
      this.offer = null
      if (this.negotiationBridge?.desk.session?.airlineId === event.poachedOfferId) {
        this.negotiationBridge.closePanel()
      }
    }
  }

  respondToPriceWar(choice: WarChoice) {
    const war = this.ensurePriceWar()
    const quote = war.quote(choice)
    if (!quote.ok) {
      this.pushNews(quote.reason, 'bad')
      this.emit()
      return
    }
    if (quote.cost > 0 && !this.spend(quote.cost, 'Bellwater counter-promotion', 'advertising')) return
    const warId = war.pendingId()
    const result = war.commit(choice)
    if (!result.ok) {
      this.pushNews(result.note, 'bad')
      this.emit()
      return
    }
    if (warId) this.alerts.clear(`event:price-war:${warId}`)
    this.pushNews(result.note, choice === 'hold' ? 'bad' : 'good')
    this.emit()
  }

  private warWalkInFactor(): number {
    return this.priceWar?.walkInFactor() ?? 1
  }

  private ensurePriceWar(): PriceWar {
    if (!this.priceWar) this.priceWar = PriceWar.create(this.diplomacySeed || 1)
    return this.priceWar
  }

  /** Blend of the posted landing, passenger, and cargo tariffs. 1 is list price. */
  private postedFeeIndex(): number {
    const keys = ['landingPerTonne', 'paxFee', 'cargoPerUnit'] as const
    let sum = 0
    for (const key of keys) {
      const base = DEFAULT_FEE_SCHEDULE[key]
      sum += base > 0 ? this.fees[key] / base : 1
    }
    return sum / keys.length
  }

  private softContractOffer(): { id: string; name: string } | null {
    const offer = this.offer
    if (!offer || this.signed.includes(offer.airline)) return null
    const known = this.allAirlines().find((airline) => airline.id === offer.airline)
    return { id: offer.airline, name: known?.name ?? offer.airline }
  }

  /** Match-rates trims what the airport collects. Quiet days leave the amount alone. */
  private afterRivalMargin(amount: number): number {
    const margin = this.priceWar?.marginFactor() ?? 1
    if (margin === 1 || !(amount > 0)) return amount
    return Math.max(0, Math.round(amount * margin))
  }

  /** Standing rows the diplomacy adapter is holding for this carrier. */
  negotiationStanding(id: string): { source: string; value: number; durationDays: number }[] {
    const rel = this.ensureDiplomacy().relation(id)
    if (!rel) return []
    return rel.modifiers
      .filter((m) => m.source === 'over_ask' || m.source === 'hard_bargain' || m.source === 'walk' || m.source === 'freebie')
      .map((m) => ({ source: m.source, value: m.value, durationDays: m.durationDays }))
  }

  openNegotiationPanel() {
    if (this.offer && this.negotiationBridge?.desk.session?.airlineId !== this.offer.airline) {
      this.negotiationDesk().openNamed(this.offer.airline)
    } else if (!this.negotiationBridge?.desk.session && this.offer) {
      this.negotiationDesk().openNamed(this.offer.airline)
    }
    this.negotiationDesk().openPanel()
    this.emit()
  }

  closeNegotiationPanel() {
    this.negotiationBridge?.closePanel()
    this.emit()
  }

  presentNegotiation(id: string) {
    this.negotiationDesk().openNamed(id)
    this.offer = { airline: id, age: 0, deadline: 120 }
    this.noteSound('contract_offer')
    this.emit()
  }

  setNegotiationFee(service: ServiceId, pct: number) {
    const desk = this.negotiationDesk()
    desk.setFee(service, pct)
    const id = desk.desk.session?.airlineId
    if (id) this.ensureDiplomacy().adapter.engine.noteAirlineFee(id, desk.feeFactor(id))
    this.emit()
  }

  /** Put the open ask on this carrier's target price and a standard deposit. */
  matchNegotiationTarget() {
    const desk = this.negotiationBridge?.desk
    const session = desk?.session
    if (!desk || !session || session.status !== 'open') return
    const pct = (desk.personality(session.airlineId).targetCost - 1) * 100
    for (const service of SERVICE_IDS) desk.setFee(service, pct)
    desk.setDeposit('standard')
    this.emit()
  }

  toggleNegotiationFreebie(id: string) {
    this.negotiationDesk().toggleFreebie(id)
    this.emit()
  }

  setNegotiationDeposit(tier: DepositTier) {
    this.negotiationDesk().setDeposit(tier)
    this.emit()
  }

  setNegotiationTerm(months: number) {
    this.negotiationDesk().setTerm(months)
    this.emit()
  }

  buyNegotiationResearch(cost: number) {
    this.negotiationDesk().buyResearch(cost)
    this.refreshAdvice()
    this.emit()
  }

  acceptNegotiation() {
    if (!this.offer) {
      this.pushNews('No contract letter is open.', 'bad')
      this.emit()
      return
    }
    if (this.rivalRefuses(this.offer.airline)) {
      this.pushNews(`${this.airline(this.offer.airline).name} refused. The last hub angered them.`, 'bad')
      this.emit()
      return
    }
    const id = this.offer.airline
    const name = this.airline(id).name
    const miss = this.missingReq(id)
    if (miss.length) {
      this.pushNews(`${name} will not sign yet — still need ${miss.join(', ')}.`, 'bad')
      this.emit()
      return
    }
    const bridge = this.negotiationDesk()
    const session = bridge.desk.session
    if (!session || session.status !== 'open' || session.airlineId !== id) {
      bridge.openNamed(id)
    }
    const open = bridge.desk.session
    if (!open || open.status !== 'open' || open.airlineId !== id) {
      this.acceptOffer()
      return
    }
    const result = bridge.accept()
    if (result.outcome === 'signed') this.acceptOffer()
    else if (result.outcome === 'walked') this.clearWalkedOffer()
    else if (!result.note) {
      this.pushNews(`${name} did not sign.`, 'bad')
      this.emit()
    } else this.emit()
  }

  counterNegotiation() {
    const session = this.negotiationBridge?.desk.session
    if (!session || session.status !== 'open') return
    const result = this.negotiationDesk().counter()
    if (result.outcome === 'signed') this.acceptOffer()
    else if (result.outcome === 'walked') this.clearWalkedOffer()
    else this.emit()
  }

  walkNegotiation() {
    if (this.negotiationBridge?.desk.session?.status === 'open') this.negotiationDesk().walk()
    if (this.offer) this.declineOffer()
    else this.emit()
  }

  private clearWalkedOffer() {
    this.offer = null
    this.offerCool = LETTER_PACING.afterWalk
    this.emit()
  }

  private negotiationDesk(): NegotiationBridge {
    if (!this.negotiationBridge) {
      this.negotiationBridge = new NegotiationBridge(
        {
          day: () => Math.floor(this.clock / 180),
          standing: (id) => this.standingOf(id),
          rating: () => this.fieldRating(),
          capacity: () => (this.hallOverloaded || this.congPeak >= 3 ? 'red' : this.congPeak >= 1.4 ? 'amber' : 'green'),
          applyStanding: (deltas) => this.applyNegotiationStanding(deltas),
          addMoney: (amount, reason) => {
            if (amount > 0) this.earn(amount, reason)
            else if (amount < 0) this.charge(-amount)
          },
          notify: (message, tone) => this.pushNews(message, tone),
          ensureCarrier: (profile) => this.ensureNegotiationCarrier(profile),
          liveQuote: (id) => this.liveQuote(id),
        },
        this.diplomacySeed,
      )
    }
    return this.negotiationBridge
  }

  private applyNegotiationStanding(
    deltas: { id: string; airlineId: string; modifier: string; label: string; value: number; durationDays: number }[],
  ) {
    const engine = this.ensureDiplomacy().adapter.engine
    for (const delta of deltas) {
      engine.noteNegotiation({
        airlineId: delta.airlineId,
        value: delta.value,
        label: delta.label,
        durationDays: delta.durationDays,
        source: delta.modifier,
      })
    }
    const rivalName = this.negotiationBridge?.rivalCard()?.name ?? 'A rival airport'
    for (const delta of deltas) {
      if (delta.modifier !== 'walk') continue
      engine.noteRivalAirport({ rivalName, airlineId: delta.airlineId, taken: true })
    }
  }

  private ensureNegotiationCarrier(profile: { id: string }): void {
    // Resolved by airline() so ULCC ids stay out of the offer candidate list.
    if (!profile.id) return
  }

  acceptOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    if (this.rivalRefuses(id)) {
      this.pushNews(`${this.airline(id).name} refused. The last hub angered them.`, 'bad')
      this.emit()
      return
    }
    const gate = this.checkinSignReport(id)
    if (!gate.ok) {
      const note = `${id}|${gate.line}`
      if (this.checkinBlockNote !== note) {
        this.checkinBlockNote = note
        this.pushNews(gate.line, 'bad')
      }
      this.emit()
      return
    }
    this.checkinBlockNote = ''
    // Soft asks (police, a snack bar) still sign — the tower holds the slot.
    // A helicopter with no pad can never leave the ground, so the letter stays open.
    if (this.carrierNeedsPad(id) && !this.readiness().helipad) {
      this.pushNews(`${this.airline(id).name} will not sign yet — still need ${HELIPAD_NEED}.`, 'bad')
      this.emit()
      return
    }
    if (this.signed.includes(id)) {
      this.offer = null
      this.offerCool = coolAfterSign(this.signed.length)
      this.pushNews(`${this.airline(id).name} is already on the books.`, 'ok')
      this.emit()
      return
    }
    const a = this.airline(id)
    this.signed.push(id)
    this.hubTierSince[id] = this.gameDay()
    this.wave3.noteLetter(id, 'accept')
    if (this.airlineHeat[id] == null) this.airlineHeat[id] = 70
    this.offer = null
    // Each carrier on the books stretches the gap to the next letter.
    this.offerCool = coolAfterSign(this.signed.length)
    this.lastSignAt = this.clock
    this.spawnCool = Math.min(this.spawnCool, 4)
    this.reputation = Math.min(100, this.reputation + (a.procedural ? 5 : 8))
    this.grantFieldXp(12 + a.tier * 4, 'contract')
    this.noteCommercialSign(id, a)
    this.pullCarrierFromRival(id, a.name)
    const opening = this.signed.length <= 1 && this.clock < OPENING_SEC
    this.seedScheduleForAirline(id, opening ? OPENING_FIRST_SLOTS : 3)
    const leadDays = this.commercialLead[id]?.leadDays ?? 0
    const held = this.deposits[id]?.held ?? 0
    const depositBit =
      held > 0 ? ` ${this.deposits[id].tier} deposit $${held.toLocaleString('en-US')} held.` : ''
    const leadBit = leadDays > 0 ? ` First flight in ${leadDays} days.` : ''
    this.pushNews(
      `${a.name} (T${a.tier}) signed${a.procedural ? ' · filler' : ''}. Flights hit the timetable.${leadBit}${depositBit}`,
      'good',
    )
    this.noteSound('contract_offer')
    this.refreshAdvice()
    this.emit()
  }

  setScheduleAuto(on: boolean) {
    this.scheduleAuto = on
    this.pushNews(
      on ? 'Tower auto-banking slots again.' : 'Auto schedule off — you own the bank.',
      'ok',
    )
    this.emit()
  }

  openSchedule(): ScheduleSlot[] {
    // Prune orphan inbound slots whose flight already left.
    for (const s of this.schedule) {
      if (s.status === 'inbound' && s.flightId && !this.flights.some((f) => f.id === s.flightId)) {
        s.status = 'done'
      }
    }
    return this.schedule
      .filter((s) => s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound')
      .slice()
      .sort((a, b) => a.eta - b.eta)
  }

  seedScheduleForAirline(airlineId: AirlineId, count: number) {
    if (this.isBanned(airlineId)) return
    if ((this.hubRivalQuiet[airlineId] ?? 0) > this.gameDay()) return
    // A freighter (or any metal the stands cannot take) must not occupy the bank.
    // One unfit slot at the head cascades every passenger flight behind it.
    if (!this.airlineParkable(airlineId)) return
    const a = this.airline(airlineId)
    const firstBank =
      this.signed.length <= 1 &&
      this.clock < OPENING_SEC &&
      !this.schedule.some(
        (s) =>
          s.airline === airlineId &&
          (s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound'),
      )
    let t = firstBank
      ? this.clock + FIRST_SLOT_GAP + Math.random() * FIRST_SLOT_JITTER
      : this.clock + 12 + Math.random() * 10
    // Lead-gated flights sit past the opening. A new slot keeps the runway
    // gap from every open ETA, including ones already past the opening, so a
    // later batch cannot land on top of them.
    const planned = this.pickForAirline(airlineId, a.kind === 'cargo').af
    const helo = planned ? isHeloAirframe(planned) : this.carrierNeedsPad(airlineId)
    const openingLimit = a.kind === 'cargo' || helo ? null : openingSlotCap(this.clock)
    // Each strip keeps its own measured gap. A second strip does not shrink it.
    // The opening ten minutes stay on the wider headway so the prefab sees one
    // turn at a time. After that, the gap is arrival occupancy plus a departure slot.
    const stripGap = runwayArrivalGapSec(1)
    const physicalGap =
      this.clock < OPENING_SEC ? Math.max(stripGap, OPENING_ARRIVAL_GAP_SEC) : stripGap
    const gate = this.leadGateClock(airlineId)
    if (gate > t) t = gate
    const inOpeningBank = t < OPENING_SEC
    const hub = this.isHub(airlineId)
    const mods = this.specMods()
    const lcc = a.bizModel === 'lcc' || a.persona === 'budget'
    // The airline's cadence. The physical gap is enforced per strip in etaClearOfRunway,
    // so a second strip can take the next flight without waiting out a full turn.
    // A helicopter does not use the strip.
    const spacing = helo
      ? 22
      : bankSpacing(a.kind === 'cargo' ? 'cargo' : 'pax', hub, mods, Math.random()) +
        (inOpeningBank ? openingSpacingBonus(this.clock) : 0)
    let n = bankSlotCount(count, {
      hub,
      lcc,
      capacity: this.diplomacyCapacity(airlineId),
      mods,
    })
    const limit = inOpeningBank ? openingLimit : null
    if (limit != null) {
      const openish = (s: { status: string }) =>
        s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound'
      const openPax = this.schedule.filter(
        (s) =>
          openish(s) &&
          this.airline(s.airline).kind !== 'cargo' &&
          s.eta < OPENING_SEC &&
          !this.slotUsesPad(s),
      ).length
      const mine = this.schedule.filter((s) => s.airline === airlineId && openish(s)).length
      // A brand-new signature still writes one slot. The cap holds every slot after that.
      const room = Math.max(limit - openPax, mine === 0 ? 1 : 0)
      n = Math.max(0, Math.min(n, room))
    }
    if (n <= 0) return
    let eta = t
    const plannedId = planned?.id ?? resolvedAirframes(this.contractFleet(airlineId))[0]?.id ?? null
    const prior = new Set(this.schedule.map((row) => row.id))
    for (let i = 0; i < n; i++) {
      const strip = helo ? null : this.pickBalancedRunway()
      if (helo) {
        eta = this.etaClearOfPad(eta)
      } else {
        const requested = eta
        // Night stretches the step off a slot. The clear gap stays the strip
        // headway, so a morning slot is not pushed out just because the next
        // request lands after dark.
        eta = this.etaClearOfRunway(eta, physicalGap, strip)
        const mine = strip == null ? this.slotStripIndex(null) : strip
        const forcedByPrior = this.schedule.some(
          (row) =>
            prior.has(row.id) &&
            (row.status === 'scheduled' || row.status === 'delayed' || row.status === 'inbound') &&
            this.stripsConflict(this.slotStripIndex(row.runwayPref), mine) &&
            Math.abs(row.eta - requested) < physicalGap - 1e-6,
        )
        // A slot this call spaced out to the physical gap is the bank's own cadence.
        // Deferred demand is a time an airline asked for that an existing slot already held.
        this.noteRunwayDeferral(forcedByPrior ? requested : eta, eta)
      }
      this.flightSeq += 1
      const slot: ScheduleSlot = {
        id: uid('slot'),
        airline: airlineId,
        flightNo: `${rosterAirline(airlineId)?.code ?? a.name.slice(0, 2).toUpperCase()}${this.flightSeq}`,
        eta,
        status: 'scheduled',
        delaySec: 0,
        delayReason: null,
        manual: false,
        flightId: null,
        standPref: null,
        // Spread auto bank across every linked strip. Pads do not take a strip.
        // One strip stays unassigned.
        runwayPref: helo ? null : strip,
        claimLane: null,
        airframeId: plannedId,
      }
      this.assignSlotClaimLane(slot)
      this.schedule.push(slot)
      if (!helo) this.noteSlotBanked(slot)
      if (helo) {
        eta += 22
      } else {
        const scale = arrivalSpacingScale(eta, {
          nightBank: this.hasResearch('night_bank'),
          holidayPeak: this.holidayPeakHook,
        })
        // One strip steps by the strip gap, stretched overnight. Two strips keep
        // the commercial step so the next flight can use the other strip.
        const lanes = Math.max(1, this.operableStripIndexes().length || this.runwayStripCount() || 1)
        eta += (lanes > 1 ? spacing : Math.max(spacing, physicalGap)) * scale
      }
    }
    this.invalidateRunwayLoad()
  }

  /** Soonest time at or after `eta` that keeps `gap` from open slots on the same strip. */
  private etaClearOfRunway(eta: number, gap: number, strip: number | null): number {
    let t = eta
    const mine = strip == null ? this.slotStripIndex(null) : strip
    const open = this.schedule.filter(
      (s) =>
        (s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound') &&
        !this.slotUsesPad(s),
    )
    for (let guard = 0; guard < 48; guard++) {
      const blocker = open
        .filter((s) => this.stripsConflict(this.slotStripIndex(s.runwayPref), mine))
        .map((s) => s.eta)
        .filter((at) => Math.abs(at - t) < gap - 1e-6)
        .sort((a, b) => b - a)[0]
      if (blocker == null) return t
      t = blocker + gap
    }
    return t
  }

  /** Soonest time at or after `eta` that keeps a short gap from other pad slots. */
  private etaClearOfPad(eta: number): number {
    let t = eta
    const gap = 18
    const open = this.schedule.filter(
      (s) =>
        (s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound') &&
        this.slotUsesPad(s),
    )
    for (let guard = 0; guard < 32; guard++) {
      const blocker = open
        .map((s) => s.eta)
        .filter((at) => Math.abs(at - t) < gap - 1e-6)
        .sort((a, b) => b - a)[0]
      if (blocker == null) return t
      t = blocker + gap
    }
    return t
  }

  /** Player places a slot ~N seconds out for a signed airline. */
  addManualSlot(airlineId: AirlineId, inSeconds = 20) {
    if (!this.signed.includes(airlineId)) {
      this.pushNews('Sign that airline first.', 'bad')
      this.emit()
      return
    }
    if (this.isBanned(airlineId)) {
      this.pushNews(`${this.airline(airlineId).name} is banned — no slots.`, 'bad')
      this.emit()
      return
    }
    const open = this.openSchedule().length
    const cap = this.scheduleCap()
    if (open >= cap) {
      this.pushNews(`Timetable full (${cap}). Cancel or wait.`, 'bad')
      this.emit()
      return
    }
    const a = this.airline(airlineId)
    this.flightSeq += 1
    const eta = Math.max(this.clock + Math.max(8, inSeconds), this.leadGateClock(airlineId))
    const rw = this.pickBalancedRunway()
    const planned = this.pickForAirline(airlineId, a.kind === 'cargo').af
    const slot: ScheduleSlot = {
      id: uid('slot'),
      airline: airlineId,
      flightNo: `${a.name.slice(0, 2).toUpperCase()}${this.flightSeq}`,
      eta,
      status: 'scheduled',
      delaySec: 0,
      delayReason: null,
      manual: true,
      flightId: null,
      standPref: null,
      runwayPref: rw,
      claimLane: null,
      airframeId: planned?.id ?? resolvedAirframes(this.contractFleet(airlineId))[0]?.id ?? null,
    }
    this.assignSlotClaimLane(slot)
    this.schedule.push(slot)
    this.invalidateRunwayLoad()
    if (!planned || !isHeloAirframe(planned)) this.noteSlotBanked(slot)
    this.pushNews(
      `Manual slot ${a.name} ${this.flightSeq} in ${Math.round(eta - this.clock)}s${
        rw != null ? ` · ${this.runwayLabel(rw)}` : ''
      }${slot.claimLane ? ` · claim ${slot.claimLane}` : ''}.`,
      'good',
    )
    this.emit()
  }

  cancelSlot(slotId: string) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || s.status === 'inbound' || s.status === 'done') return
    s.status = 'cancelled'
    this.invalidateRunwayLoad()
    this.abandonShowUp(s.id)
    // Scrubbing a slot to clear backlog hurts — more if it was an airline-banked flight.
    this.adjustHeat(s.airline, s.manual ? -2.2 : -4.2, 'schedule')
    this.pushNews(
      `Cancelled ${s.flightNo} — ${this.airline(s.airline).name} Standing ${Math.round(this.standingOf(s.airline))}. Bank clears, relations don't.`,
      'bad',
    )
    this.schedule = this.schedule.filter((x) => x.status !== 'cancelled' && x.status !== 'done')
    const excused = /weather|storm|fog/i.test(s.delayReason ?? '')
    this.noteDiplomacyCancel(s.airline, excused)
    this.noteWave3(`slot:${s.id}`, s.airline, classifyTurn({ cancelled: true, excused }))
    this.emit()
  }

  /** Push a slot later; ripples the bank behind it — costs heat on bumped carriers. */
  bumpSlot(slotId: string, bySec = 18) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const cascaded = this.delaySlot(s, bySec, 'Tower rearrange', true)
    this.adjustHeat(s.airline, -1.2)
    this.pushNews(
      cascaded > 0
        ? `Bumped ${s.flightNo} — ${cascaded} later slot${cascaded > 1 ? 's' : ''} slid. Airlines notice.`
        : `Bumped ${s.flightNo} +${bySec}s. Standing dips.`,
      'bad',
    )
    this.emit()
  }

  /** Pull a slot earlier (planner craft) — can heat the airline you jump ahead of. */
  pullSlot(slotId: string, bySec = 12) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const floor = Math.max(this.clock + 6, this.leadGateClock(s.airline))
    const next = Math.max(floor, s.eta - bySec)
    if (next >= s.eta - 0.5) {
      this.pushNews(`${s.flightNo} already as early as the tower allows.`, 'ok')
      this.emit()
      return
    }
    const jumped = this.openSchedule().filter(
      (x) => x.id !== s.id && x.eta >= next && x.eta < s.eta,
    )
    s.eta = next
    s.delayReason = 'Tower pull-forward'
    if (s.status === 'delayed' && s.delaySec > 0) {
      s.delaySec = Math.max(0, s.delaySec - bySec)
      if (s.delaySec <= 0) s.status = 'scheduled'
    }
    for (const x of jumped.slice(0, 3)) {
      this.adjustHeat(x.airline, -0.8)
    }
    this.pushNews(
      jumped.length
        ? `Pulled ${s.flightNo} ahead of ${jumped.length} — queue Standing dips.`
        : `Pulled ${s.flightNo} — ETA ${Math.round(s.eta - this.clock)}s.`,
      jumped.length ? 'bad' : 'ok',
    )
    this.emit()
  }

  /** Cycle preferred stand: auto → G1 → G2… → auto. */
  cycleSlotStand(slotId: string) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const stands = tilesOf(this.tiles, 'stand')
    if (!stands.length) {
      this.pushNews('No stands stamped.', 'bad')
      this.emit()
      return
    }
    const key = (v: Vec) => `${v.c},${v.r}`
    const cur = s.standPref ? key(s.standPref) : null
    const idx = cur ? stands.findIndex((st) => key(st) === cur) : -1
    const nextIdx = idx + 1
    if (nextIdx >= stands.length) {
      s.standPref = null
      this.pushNews(`${s.flightNo} stand → tower auto.`, 'ok')
    } else {
      s.standPref = { ...stands[nextIdx] }
      this.pushNews(
        `${s.flightNo} stand → ${this.gateLabel(s.standPref)}.`,
        'ok',
      )
    }
    this.emit()
  }

  /** Pin a slot to a specific stand (or null = tower auto). Planner drag target. */
  setSlotStandPref(slotId: string, stand: Vec | null) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    if (stand) {
      const hit = tilesOf(this.tiles, 'stand').find(
        (st) => st.c === stand.c && st.r === stand.r,
      )
      if (!hit) {
        this.pushNews('That stand is gone.', 'bad')
        this.emit()
        return
      }
      s.standPref = { ...hit }
      this.pushNews(`${s.flightNo} stand → ${this.gateLabel(s.standPref)}.`, 'ok')
    } else {
      s.standPref = null
      this.pushNews(`${s.flightNo} stand → tower auto.`, 'ok')
    }
    this.emit()
  }

  /** Nudge ETA by delta seconds (floor 6s ahead). Planner drag polish. */
  nudgeSlotEta(slotId: string, deltaSec: number) {
    if (deltaSec < 0) this.pullSlot(slotId, Math.abs(deltaSec))
    else if (deltaSec > 0) this.bumpSlot(slotId, deltaSec)
  }

  /** Cycle preferred runway strip across every stamped strip. */
  cycleSlotRunway(slotId: string) {
    const s = this.schedule.find((x) => x.id === slotId)
    if (!s || (s.status !== 'scheduled' && s.status !== 'delayed')) return
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (strips.length < 1) {
      this.pushNews('Stamp a strip before assigning runways.', 'ok')
      this.emit()
      return
    }
    const cur = s.runwayPref ?? -1
    const next = cur + 1
    if (next >= strips.length) {
      s.runwayPref = null
      this.pushNews(`${s.flightNo} runway → tower auto.`, 'ok')
    } else {
      s.runwayPref = next
      this.pushNews(
        `${s.flightNo} runway → RW${next + 1} (${strips[next].length}c).`,
        'ok',
      )
    }
    this.emit()
  }

  runwayLabel(pref: number | null | undefined): string {
    if (pref == null) return 'auto'
    return `RW${pref + 1}`
  }

  /** Aircraft name the planner, the card, and the letter share for this slot. */
  slotAircraftName(slot: { airframeId?: string | null }): string {
    if (!slot.airframeId) return ''
    return AIRFRAMES[slot.airframeId]?.name ?? ''
  }

  /** Day-strip window: slots in the next `horizon` sim-seconds. */
  plannerStrip(horizon = 120): {
    horizon: number
    slots: {
      id: string
      flightNo: string
      airline: AirlineId
      t: number
      status: ScheduleStatus
      stand: string
      runway: string
      model: string
      stolen: boolean
    }[]
    /** Live emergency hosts painted as stolen capacity on the strip. */
    hosts: {
      id: string
      flightNo: string
      kind: EmergencyKind
      stand: string
    }[]
  } {
    const open = this.openSchedule()
    const hosts = this.flights
      .filter(
        (f) =>
          f.emergencyHost &&
          f.phase !== 'gone' &&
          f.phase !== 'takeoff' &&
          f.stand,
      )
      .map((f) => ({
        id: f.id,
        flightNo: f.flightNo,
        kind: (f.hostKind ?? 'divert') as EmergencyKind,
        stand: this.gateLabel(f.stand),
      }))
    return {
      horizon,
      slots: open
        .filter((s) => s.eta <= this.clock + horizon)
        .map((s) => ({
          id: s.id,
          flightNo: s.flightNo,
          airline: s.airline,
          t: Math.max(0, s.eta - this.clock),
          status: s.status,
          stand: s.standPref ? this.gateLabel(s.standPref) : 'auto',
          runway: this.runwayLabel(s.runwayPref),
          model: this.slotAircraftName(s),
          stolen:
            /gate|stand|backlog|pavement/i.test(s.delayReason ?? '') &&
            hosts.length > 0 &&
            s.delaySec > 0,
        })),
      hosts,
    }
  }

  /** Active emergency hosts occupying stands (Planner + letters). */
  stolenHosts(): Flight[] {
    return this.flights.filter(
      (f) =>
        f.emergencyHost &&
        f.phase !== 'gone' &&
        f.phase !== 'takeoff' &&
        Boolean(f.stand),
    )
  }

  /** HUD one-liner when apron jam is biting. */
  apronJamLine(): string | null {
    if (this.congPeak < 2 && this.congWasteAcc < 3) return null
    if (this.congPeak >= 3) return `Apron jam ×${this.congPeak} — walks and taxi crawling`
    if (this.congWasteAcc >= 3) return `Traffic neck costing ~${Math.round(this.congWasteAcc)}s`
    return null
  }

  /**
   * First contiguous night band inside the planner horizon (sim day = 180s, night ≥120).
   * Used to paint the night column on the day strip.
   */
  plannerNightBand(horizon = 120): { from: number; to: number } | null {
    let from: number | null = null
    let to = 0
    for (let t = 0; t <= horizon; t++) {
      const night = (this.clock + t) % 180 >= 120
      if (night) {
        if (from == null) from = t
        to = t
      } else if (from != null) {
        break
      }
    }
    if (from == null) return null
    return { from, to }
  }

  /**
   * Push one slot later without moving the flights behind it.
   * Used when this metal cannot use the stands that are free — those flights should still launch.
   */
  private slipSlot(slot: ScheduleSlot, sec: number, reason: string) {
    const add = Math.min(180, Math.max(6, sec))
    slot.eta += add
    const before = slot.delaySec
    slot.delaySec = Math.min(120, slot.delaySec + add)
    slot.status = 'delayed'
    slot.delayReason = reason
    const share = Math.min(1, Math.max(0, slot.delaySec - before) / DELAY_HEAT_REF_SEC)
    this.adjustHeat(slot.airline, -0.45 * share)
    this.invalidateRunwayLoad()
  }

  /**
   * Delay a slot and cascade later ETAs that would collide.
   * Returns how many downstream slots were pushed (airline heat already applied).
   */
  delaySlot(
    slot: ScheduleSlot,
    sec: number,
    reason: string,
    playerRearrange = false,
  ): number {
    const add = Math.min(22, Math.max(6, sec))
    slot.eta += add
    const slotBefore = slot.delaySec
    slot.delaySec = Math.min(120, slot.delaySec + add)
    // Standing follows the delay actually booked, not how often a held slot is retried.
    const share = (added: number) => Math.min(1, Math.max(0, added) / DELAY_HEAT_REF_SEC)
    slot.status = 'delayed'
    slot.delayReason = reason
    // Ripple later slots that would collide — capped so the bank doesn't explode.
    const later = this.schedule
      .filter(
        (x) =>
          x.id !== slot.id &&
          (x.status === 'scheduled' || x.status === 'delayed') &&
          x.eta >= slot.eta - add &&
          x.eta < slot.eta + 40,
      )
      .sort((a, b) => a.eta - b.eta)
      .slice(0, 5)
    let cursor = slot.eta + 14
    let cascaded = 0
    for (const x of later) {
      if (x.eta < cursor) {
        const push = Math.min(18, cursor - x.eta)
        x.eta += push
        const xBefore = x.delaySec
        x.delaySec = Math.min(120, x.delaySec + push)
        x.status = 'delayed'
        x.delayReason = 'Cascade from earlier delay'
        // Player rearrange hurts relations more than weather acts of god.
        this.adjustHeat(x.airline, (playerRearrange ? -1.1 : -0.35) * share(x.delaySec - xBefore))
        cascaded += 1
        cursor = x.eta + 14
      } else {
        cursor = Math.max(cursor, x.eta + 14)
      }
    }
    // Runway backlog is ops pressure, not an airline insult — lighter heat nick.
    const backlog = reason === 'Runway backlog' || reason === 'Pavement busy'
    this.adjustHeat(
      slot.airline,
      (playerRearrange ? -0.6 : backlog ? -0.25 : -0.45) * share(slot.delaySec - slotBefore),
    )
    if (cascaded >= 2 && !playerRearrange && this.cascadeNewsCool <= 0) {
      this.pushNews(
        `Schedule cascade — ${cascaded} flights slid after ${slot.flightNo}.`,
        'bad',
      )
      this.cascadeNewsCool = 22
    }
    this.invalidateRunwayLoad()
    return cascaded
  }

  /**
   * Slip one flight by a few seconds when the runway still has room.
   * An overbooked bank keeps the full delay and its cascade.
   */
  private nudgeSlot(slot: ScheduleSlot, sec: number, reason: string) {
    if (this.runwayOverbooked()) {
      this.delaySlot(slot, sec, reason)
      return
    }
    const add = Math.max(0, Math.min(RUNWAY_GENTLE_SLIP_SEC, Number.isFinite(sec) ? sec : 0))
    if (!(add > 0)) return
    slot.eta += add
    slot.delaySec = Math.min(120, slot.delaySec + add)
    slot.status = 'delayed'
    slot.delayReason = reason
    this.invalidateRunwayLoad()
  }

  tickSchedule(dt: number) {
    this.schedulePlanCool = Math.max(0, this.schedulePlanCool - dt)
    this.nightCurfewCool = Math.max(0, this.nightCurfewCool - dt)
    this.cascadeNewsCool = Math.max(0, this.cascadeNewsCool - dt)
    this.stormPulseCool = Math.max(0, this.stormPulseCool - dt)
    // Storm pulse — even with de-ice, the bank should feel the weather once a beat.
    if (this.weather === 'storm' && this.stormPulseCool <= 0) {
      const soon = this.openSchedule().find(
        (s) =>
          (s.status === 'scheduled' || s.status === 'delayed') &&
          s.eta - this.clock < 45 &&
          s.delayReason !== 'Storm / dest weather' &&
          !this.slotUsesPad(s),
      )
      if (soon) {
        const slip = this.hasResearch('deice') ? 7 + Math.random() * 6 : 12 + Math.random() * 14
        this.nudgeSlot(soon, slip, 'Storm / dest weather')
        this.stormPulseCool = this.hasResearch('deice') ? 38 : 24
        this.pushNews(
          this.hasResearch('deice')
            ? `${soon.flightNo} storm slip ${Math.round(soon.delaySec)}s — de-ice pads holding the worst of it.`
            : `${soon.flightNo} delayed ${Math.round(soon.delaySec)}s — storm bank. Research De-ice ops.`,
          'bad',
        )
      } else {
        this.stormPulseCool = 12
      }
    }
    // Soft night curfew — pax slip after dark until Night bank is researched.
    // A scenario curfew stays on after that research.
    if (
      this.isNight() &&
      (this.scenarioCurfew || !this.hasResearch('night_bank')) &&
      this.nightCurfewCool <= 0 &&
      Math.random() < dt * 0.055
    ) {
      const soon = this.openSchedule().find((s) => {
        if (s.eta - this.clock > 40) return false
        if (s.status !== 'scheduled' && s.status !== 'delayed') return false
        if (s.delayReason === 'Night curfew') return false
        return this.airline(s.airline).kind === 'pax' && !this.slotUsesPad(s)
      })
      if (soon) {
        this.nudgeSlot(soon, 14 + Math.random() * 12, 'Night curfew')
        this.nightCurfewCool = 28
        this.adjustHeat(soon.airline, -0.35)
        this.pushNews(
          this.scenarioCurfew
            ? `${soon.flightNo} held for the scenario curfew.`
            : `${soon.flightNo} held for night curfew — research Night bank to open the bank after dark.`,
          'bad',
        )
      }
    }
    // Fog slips (storms use the pulse above so the ticker stays readable).
    const fogOdds = dt * 0.02
    if (this.weather === 'fog' && Math.random() < fogOdds) {
      const soon = this.openSchedule().find(
        (s) =>
          s.eta - this.clock < 40 &&
          s.status === 'scheduled' &&
          s.delayReason !== 'Fog / dest weather' &&
          !this.slotUsesPad(s),
      )
      if (soon && soon.status === 'scheduled') {
        this.nudgeSlot(soon, 8 + Math.random() * 10, 'Fog / dest weather')
        this.pushNews(
          `${soon.flightNo} slipped in fog — bank may need a bump.`,
          'bad',
        )
      }
    }
    // Auto-fill timetable — deeper banks when more strips are stamped.
    if (this.scheduleAuto && this.schedulePlanCool <= 0 && this.signed.length) {
      this.schedulePlanCool = 18
      const open = this.openSchedule()
      const opening = openingSlotCap(this.clock)
      const want =
        opening ??
        bankTarget(
          4 + this.runwayStripCount() * 2,
          this.scheduleCap() - 2,
          this.clock,
          this.hasResearch('night_bank'),
          this.holidayPeakHook,
        )
      const fitsField = (s: ScheduleSlot) => this.airlineParkable(s.airline) && !this.slotUsesPad(s)
      const banked =
        opening == null
          ? open.filter(fitsField).length
          : open.filter((s) => s.eta < OPENING_SEC && fitsField(s)).length
      if (banked < want) {
        const pool = this.signed.filter(
          (id) => !this.isBanned(id) && this.airlineParkable(id) && !this.carrierNeedsPad(id),
        )
        if (pool.length) {
          // Bias toward cargo if freighters are starving vs pax bank.
          const cargo = pool.filter((id) => this.airline(id).kind === 'cargo')
          const paxSeen = (this.craftSeen.regional ?? 0) + (this.craftSeen.narrowbody ?? 0)
          const freightSeen = this.craftSeen.freighter ?? 0
          const mods = this.specMods()
          const nightCargo =
            this.isNight() && cargo.length && (this.hasResearch('night_bank') || mods.nightHub)
          const nightChance = Math.min(
            0.92,
            (this.hasResearch('night_bank') ? 0.7 : mods.nightHub ? 0.35 : 0) + mods.nightHubBias,
          )
          const pickId =
            nightCargo && Math.random() < nightChance
              ? pick(cargo)
              : cargo.length && freightSeen * 3 < paxSeen && Math.random() < 0.55
                ? pick(cargo)
                : pick(pool)
          const batch = this.runwayStripCount() >= 3 ? 3 : 2
          this.seedScheduleForAirline(pickId, batch)
        }
      }
    }
    if (this.scheduleAuto) {
      this.ensureHeloBank()
      this.ensureQuietBank()
    }
    // Drop finished noise.
    if (this.schedule.length > 40) {
      this.schedule = this.schedule.filter(
        (s) => s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound',
      )
      this.invalidateRunwayLoad()
    }
    this.noteRunwayContractAlert()
  }

  nextDueSlot(): ScheduleSlot | null {
    const due = this.openSchedule().filter(
      (s) =>
        (s.status === 'scheduled' || s.status === 'delayed') &&
        s.eta <= this.clock + 1.5 &&
        !this.slotUsesPad(s),
    )
    return due[0] ?? null
  }

  /** Pad slots due now. They never sit at the head of the runway queue. */
  private nextPadSlot(): ScheduleSlot | null {
    const due = this.openSchedule().filter(
      (s) =>
        (s.status === 'scheduled' || s.status === 'delayed') &&
        s.eta <= this.clock + 1.5 &&
        this.slotUsesPad(s),
    )
    return due[0] ?? null
  }

  /**
   * Slip a pad slot without `delaySlot`. That cascade moves later jets and
   * nicks heat. A busy or missing pad only moves this helicopter.
   */
  private holdPadSlot(slot: ScheduleSlot, reason: string) {
    const add = 12
    slot.eta = Math.max(slot.eta, this.clock + add)
    slot.delaySec = Math.min(120, slot.delaySec + add)
    slot.status = 'delayed'
    slot.delayReason = reason
  }

  /**
   * A signed jet that has never turned a flight still gets one slot.
   * The runway gap still spaces it. The bank target must not hide them.
   */
  private ensureQuietBank() {
    for (const id of this.signed) {
      if (this.isBanned(id) || this.carrierNeedsPad(id) || !this.airlineParkable(id)) continue
      const counts = this.wave3.relation(id).counts
      if (counts.onTime + counts.delay > 0) continue
      const open = this.schedule.some(
        (slot) =>
          slot.airline === id &&
          (slot.status === 'scheduled' || slot.status === 'delayed' || slot.status === 'inbound'),
      )
      if (!open) this.seedScheduleForAirline(id, 1)
    }
  }

  /** A signed helicopter with a pad and an empty bank gets turns of its own. */
  private ensureHeloBank() {
    if (!this.readiness().helipad) return
    for (const id of this.signed) {
      if (this.isBanned(id) || !this.carrierNeedsPad(id) || !this.airlineParkable(id)) continue
      const open = this.schedule.some(
        (s) =>
          s.airline === id &&
          (s.status === 'scheduled' || s.status === 'delayed' || s.status === 'inbound'),
      )
      if (!open) this.seedScheduleForAirline(id, 2)
    }
  }

  /** Set the contract aside — no Standing hit, they write again soon. */
  snoozeOffer() {
    if (!this.offer) return
    const a = this.airline(this.offer.airline)
    this.negotiationBridge?.closePanel()
    this.offer = null
    this.offerCool = LETTER_PACING.afterSnooze
    this.pushNews(`${a.name} letter set aside. They'll write again shortly.`, 'ok')
    this.emit()
  }

  declineOffer() {
    if (!this.offer) return
    const id = this.offer.airline
    const a = this.airline(id)
    this.offer = null
    this.offerCool = LETTER_PACING.afterDecline
    this.wave3.noteLetter(id, 'decline')
    this.adjustHeat(id, -2)
    this.pushNews(`${a.name} hung up. They may call again later.`, 'ok')
    this.emit()
  }

  /** Letter timed out without a decision — soft cool, no heat hit. */
  expireOffer() {
    if (!this.offer) return
    const a = this.airline(this.offer.airline)
    this.negotiationBridge?.closePanel()
    this.offer = null
    this.offerCool = LETTER_PACING.afterExpire
    this.pushNews(`${a.name} contract letter expired unread.`, 'ok')
    this.emit()
  }

  hallReadyForLayover(): boolean {
    const fit = this.activeHall()
    if (!fit) return false
    const food = fit.rooms.food > 0 || tilesOf(this.tiles, 'snack').length > 0
    const shop = fit.rooms.souvenir > 0
    const amenity =
      (fit.rooms.lounge ?? 0) +
        (fit.rooms.golf ?? 0) +
        (fit.rooms.waterfall ?? 0) +
        (fit.rooms.gaming ?? 0) +
        (fit.rooms.spa ?? 0) +
        (fit.rooms.pool ?? 0) >
      0
    return food && (shop || amenity)
  }

  considerLayoverOffers() {
    if (this.layover || this.layoverOffer || this.layoverOfferCool > 0) return
    if (!this.hallReadyForLayover()) return
    const pool = this.signed.filter((id) => {
      const a = this.airline(id)
      return a.kind === 'pax' && a.likesLayovers && !this.isBanned(id) && this.heatOf(id) >= 40
    })
    if (!pool.length) return
    const id = pick(pool)
    const a = this.airline(id)
    const fee = Math.round(
      LAYOVER_FEE_MIN + Math.random() * (LAYOVER_FEE_MAX - LAYOVER_FEE_MIN),
    )
    const duration = 55 + Math.floor(Math.random() * 40)
    const transferPax = 18 + Math.floor(Math.random() * 22) + (a.persona === 'business' ? 8 : 0)
    this.layoverOffer = { airline: id, age: 0, fee, duration, transferPax, deadline: 40 }
    this.pushNews(
      `${a.name} sent a layover letter — $${fee.toLocaleString()} up front, ${transferPax} transfers for ~${duration}s.`,
      'good',
    )
  }

  acceptLayover() {
    if (!this.layoverOffer) return
    const o = this.layoverOffer
    const a = this.airline(o.airline)
    this.earn(o.fee, `${a.name} layover fee`)
    this.layover = {
      airline: o.airline,
      endsAt: this.clock + o.duration,
      remaining: o.duration,
      spawned: 0,
      transferPax: o.transferPax,
      happySum: 0,
      samples: 0,
      fee: o.fee,
    }
    this.layoverOffer = null
    this.layoverOfferCool = 70
    this.layoverSpawnAcc = 0
    this.pushNews(
      `${a.name} layover live — transfers dumping into the hall. Standing ${Math.round(this.standingOf(o.airline))}.`,
      'good',
    )
    this.emit()
  }

  declineLayover() {
    if (!this.layoverOffer) return
    const id = this.layoverOffer.airline
    const a = this.airline(id)
    this.layoverOffer = null
    this.layoverOfferCool = 55
    this.adjustHeat(id, -1.5)
    this.pushNews(`${a.name} layover talk died.`, 'ok')
    this.emit()
  }

  expireLayover() {
    if (!this.layoverOffer) return
    const a = this.airline(this.layoverOffer.airline)
    this.layoverOffer = null
    this.layoverOfferCool = 45
    this.pushNews(`${a.name} layover letter expired.`, 'ok')
    this.emit()
  }

  tickLayover(dt: number) {
    this.layoverOfferCool = Math.max(0, this.layoverOfferCool - dt)
    if (this.layoverOffer) {
      this.layoverOffer.age += dt
      if (!this.letterHeld('layover')) this.layoverOffer.deadline -= dt
      if (this.layoverOffer.deadline <= 0) {
        this.expireLayover()
        return
      }
    }
    this.considerLayoverOffers()
    if (!this.layover) return
    const L = this.layover
    L.remaining = Math.max(0, L.endsAt - this.clock)
    const a = this.airline(L.airline)

    // Soft heat recovery / decay from hall load during the bank.
    const transfers = this.hallGuests.filter((g) => g.transfer && g.airlineId === L.airline)
    if (transfers.length >= 10) this.adjustHeat(L.airline, -0.15 * dt)
    else if (transfers.length && L.samples > 0) {
      const avg = L.happySum / L.samples
      if (avg >= 62) this.adjustHeat(L.airline, 0.12 * dt)
      else if (avg < 45) this.adjustHeat(L.airline, -0.25 * dt)
    }

    // Drip transfer pax into the hall.
    if (L.spawned < L.transferPax && this.fits.length) {
      this.layoverSpawnAcc += dt
      const every = 2.2
      while (this.layoverSpawnAcc >= every && L.spawned < L.transferPax) {
        this.layoverSpawnAcc -= every
        this.spawnTransferGuest(L.airline)
        L.spawned += 1
      }
    }

    if (this.clock >= L.endsAt) {
      const avg = L.samples > 0 ? L.happySum / L.samples : 55
      const heat = this.heatOf(L.airline)
      this.layover = null
      if (avg < 48 || heat < this.banThreshold(L.airline) + 5) {
        this.banAirline(L.airline, avg < 48 ? 'miserable transfers' : 'thin Standing')
      } else {
        this.adjustHeat(L.airline, 8)
        this.reputation = Math.min(100, this.reputation + 3)
        this.layoverWins[L.airline] = (this.layoverWins[L.airline] ?? 0) + 1
        this.pushNews(
          `${a.name} layover cleared — avg happiness ${Math.round(avg)}. They'll be back.`,
          'good',
        )
        this.considerHubOffer(L.airline)
      }
    }
  }

  considerHubOffer(airlineId: AirlineId) {
    if (this.hubOffer || this.isHub(airlineId) || this.isBanned(airlineId)) return
    if (this.hubOfferCool > 0) return
    if ((this.layoverWins[airlineId] ?? 0) < HUB_LAYOVER_WINS) return
    if (this.heatOf(airlineId) < this.hubHeatNeed()) return
    if (!this.signed.includes(airlineId)) return
    if (this.hubChecklistFor(airlineId).next !== 'hub') return
    this.offerNextHubTier(airlineId, false)
  }

  acceptHub() {
    if (!this.hubOffer) return
    const o = this.hubOffer
    const tier = o.tier ?? 'hub'
    const a = this.airline(o.airline)
    const list = this.hubChecklistFor(o.airline)
    if (list.next !== tier || !list.eligible) {
      const blocked = list.lines.find((line) => line.status !== 'ok')
      this.pushNews(blocked?.detail || blocked?.label || `${a.name} is not ready.`, 'bad')
      this.emit()
      return
    }
    if (tier === 'primary') {
      const engine = this.diplomacy?.adapter.engine
      const blockers = engine?.relation(o.airline) ? engine.hubBlockers(o.airline) : []
      if (blockers.length > 0) {
        this.pushNews(blockers[0], 'bad')
        this.emit()
        return
      }
    }
    const label = HUB_TIER_LABEL[tier]
    if (!this.spend(o.fee, `${a.name} ${label} offer`)) {
      this.emit()
      return
    }
    this.hubTiers[o.airline] = tier
    this.hubTierSince[o.airline] = this.gameDay()
    this.applyHubBacklash(o.airline, tier)
    this.hubOffer = null
    this.hubOfferCool = 90
    if ((tier === 'hub' || tier === 'primary') && !this.hubAirlines.includes(o.airline)) {
      this.hubAirlines.push(o.airline)
    }
    if (tier === 'hub') {
      const fit = this.activeHall() ?? this.fits[0]
      if (fit) fit.rooms.lounge = (fit.rooms.lounge ?? 0) + 1
      this.seedScheduleForAirline(o.airline, 4)
      this.grantReward(o.airline)
      this.reputation = Math.min(100, this.reputation + 5)
    }
    if (tier === 'primary') {
      const engine = this.diplomacy?.adapter.engine
      if (engine?.relation(o.airline)) {
        const result = engine.requestHub(o.airline)
        if (!result.ok) this.pushNews(result.message, 'bad')
      }
    }
    this.pushNews(`${a.name} accepted ${label}.`, 'good')
    this.emit()
  }

  declineHub() {
    if (!this.hubOffer) return
    const id = this.hubOffer.airline
    const a = this.airline(id)
    this.hubOffer = null
    this.hubOfferCool = 70
    this.adjustHeat(id, -2)
    this.pushNews(`${a.name} declined the offer. Their leases stay.`, 'ok')
    this.emit()
  }

  expireHub() {
    if (!this.hubOffer) return
    const a = this.airline(this.hubOffer.airline)
    this.hubOffer = null
    this.hubOfferCool = 55
    this.pushNews(`${a.name} Hub letter expired.`, 'ok')
    this.emit()
  }

  tickHub(dt: number) {
    this.hubOfferCool = Math.max(0, this.hubOfferCool - dt)
    if (this.hubOffer) {
      this.hubOffer.age += dt
      this.hubOffer.deadline -= dt
      if (this.hubOffer.deadline <= 0) this.expireHub()
    }
  }

  tickParking(dt: number) {
    // Independent GA parking — day-rate, leave request, auto/manual release, overstay.
    this.parkRateCool = Math.max(0, this.parkRateCool - dt)
    let dayCharged = false
    for (const f of this.flights) {
      if (f.phase !== 'parked' || !f.ga) continue

      // Soft day-rate while occupying a stand.
      if (!dayCharged && this.parkRateCool <= 0) {
        this.earn(
          this.listed(GA_PARK_DAY_RATE, 'aircraftParkingPerDay'),
          `${f.flightNo} parking day-rate`,
          f,
          'parking_fees',
        )
        this.parkRateCool = GA_PARK_RATE_COOL
        dayCharged = true
      }

      // After planned stay, pilot requests departure → 20h ops leave window.
      const stayNeed = f.parkStaySec ?? GA_PARK_STAY_MIN
      if (f.parkLeaveRequestedAt == null && f.phaseTime >= stayNeed) {
        f.parkLeaveRequestedAt = this.clock
        f.parkLeaveBy = this.clock + GA_LEAVE_WINDOW
        this.pushNews(
          `${f.flightNo} requests departure — ${Math.round(GA_LEAVE_WINDOW)}s (~20h) to leave or overstay fine. Auto tower ${
            this.scheduleAuto ? 'ON' : 'OFF'
          }.`,
          'ok',
        )
        this.emit()
      }

      if (f.parkLeaveRequestedAt == null || !f.parkLeaveBy) continue
      const left = f.parkLeaveBy - this.clock
      // Auto-schedule: release when leave requested and pavement free.
      if (this.scheduleAuto && f.phaseTime > 4) {
        if (this.releaseGa(f.id, true)) continue
      }
      // Manual players get a nudge near the deadline.
      if (!this.scheduleAuto && left <= 18 && left > 0 && Math.random() < dt * 0.08) {
        this.pushNews(
          `${f.flightNo} leave window closing (${Math.ceil(left)}s) — Release parking or enable auto schedule.`,
          'bad',
        )
      }
      if (this.clock >= f.parkLeaveBy) {
        if (!this.releaseGa(f.id, true)) {
          this.charge(GA_OVERSTAY_FINE, 'penalties', this.simMinutes(), 'Parking overstay')
          this.reputation = Math.max(0, this.reputation - 3)
          this.pushNews(
            `${f.flightNo} overstayed parking — fine ${moneyLeft(GA_OVERSTAY_FINE)}. Release parking or turn auto schedule on.`,
            'bad',
          )
          f.parkLeaveBy = this.clock + 28
        }
      }
    }

    if (this.parkingOffer) {
      this.parkingOffer.age += dt
      if (!this.letterHeld('parking')) this.parkingOffer.deadline -= dt
      if (this.parkingOffer.deadline <= 0) {
        this.pushNews(`${this.parkingOffer.callsign} took parking elsewhere.`, 'ok')
        this.parkingOffer = null
        this.parkingCool = 40
      }
      return
    }
    if (
      this.pendingThreat ||
      this.pendingEmergency ||
      this.hubOffer ||
      this.layoverOffer
    ) {
      return
    }
    this.parkingCool -= dt
    if (this.parkingCool > 0 || !this.site) return
    const walkIn = Math.max(0.5, this.warWalkInFactor())
    this.parkingCool = demandInterval(50 + Math.random() * 40, this.fees) / walkIn
    if (!this.freeStands().length) return
    if (Math.random() > walkInOfferChance(this.fees) * this.warWalkInFactor()) return

    const frames = ['citation', 'pc12', 'crj700', 'atr72'].filter((id) => AIRFRAMES[id])
    const afId = pick(frames)
    const af = AIRFRAMES[afId]
    if (this.longestRunway() < af.minRunway) return
    this.flightSeq += 1
    const fee = this.listed(
      GA_PARK_FEE_MIN + Math.floor(Math.random() * (GA_PARK_FEE_MAX - GA_PARK_FEE_MIN)),
      'aircraftParkingPerDay',
    )
    const stay =
      GA_PARK_STAY_MIN +
      Math.floor(Math.random() * (GA_PARK_STAY_MAX - GA_PARK_STAY_MIN))
    this.parkingOffer = {
      id: uid('park'),
      callsign: `N${100 + (this.flightSeq % 800)}${String.fromCharCode(65 + (this.flightSeq % 26))}`,
      airframeId: afId,
      fee,
      staySec: stay,
      age: 0,
      deadline: 24,
    }
    this.pushNews(
      `Independent parking ask — ${this.parkingOffer.callsign} (${af.name}) · fee ${moneyLeft(fee)} · ~${stay}s then leave request.`,
      'good',
    )
    this.emit()
  }

  acceptParking() {
    const o = this.parkingOffer
    if (!o) return
    const af = AIRFRAMES[o.airframeId]
    if (!af) return
    const stand = this.assignStand(null, undefined, undefined, af.id)
    const route = stand ? this.landingRoute(stand) : null
    if (!stand || !route) {
      this.pushNews('No free stand for GA parking.', 'bad')
      this.emit()
      return
    }
    this.earn(o.fee, `${o.callsign} parking fee`, undefined, 'parking_fees')
    const inbound = this.armApproach(route)
    const load = this.flightLoad(af, 'business', false)
    const f: Flight = {
      id: uid('ga'),
      airline: 'ga',
      flightNo: o.callsign,
      airframeId: af.id,
      airframeName: af.name,
      pax: load.pax,
      cargo: false,
      craft: 'jet',
      kind: af.kind,
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting({
        fuel: Boolean(this.fuelBrand && this.fuelLoads > 0),
      }),
      phaseTime: 0,
      ledger: [],
      scheduleId: null,
      ga: true,
      parkFee: o.fee,
      parkStaySec: o.staySec,
      parkLeaveRequestedAt: null,
      parkLeaveBy: null,
      bagUnits: estimateFlightBagUnits('budget', Math.max(1, af.paxMin)),
    }
    this.flights.push(f)
    this.noteCraft(af.kind)
    this.parkingOffer = null
    this.parkingCool = 55
    this.pushNews(
      `${o.callsign} inbound — independent parking (not a carrier). Fee posted; they'll request leave after ~${o.staySec}s.`,
      'good',
    )
    this.emit()
  }

  declineParking() {
    if (!this.parkingOffer) return
    this.pushNews(`${this.parkingOffer.callsign} waved off.`, 'ok')
    this.parkingOffer = null
    this.parkingCool = 35
    this.emit()
  }

  /** Push a parked GA to taxi out. Returns false if pavement busy. */
  releaseGa(flightId: string, quiet = false): boolean {
    const f = this.flights.find((x) => x.id === flightId)
    if (!f || f.phase !== 'parked' || !f.ga) return false
    if (this.groundBusy()) {
      if (!quiet) {
        this.pushNews(`${f.flightNo} waiting for pavement to leave.`, 'ok')
        this.emit()
      }
      return false
    }
    const out = this.departurePath(f)
    if (!out) {
      if (!quiet) {
        this.pushNews(`${f.flightNo} can't find a push path.`, 'bad')
        this.emit()
      }
      return false
    }
    if (!f.cargo && !this.outboundCartClear(f.id)) return false
    f.path = out
    f.seg = 0
    f.t = 0
    if (!f.cargo) this.settleOutboundBags(f, true)
    f.phase = 'taxi_out'
    f.phaseTime = 0
    f.parkLeaveBy = null
    f.parkLeaveRequestedAt = null
    if (!quiet) {
      this.pushNews(`${f.flightNo} released from parking.`, 'ok')
      this.emit()
    }
    return true
  }

  spawnTransferGuest(airlineId: AirlineId) {
    const fit = this.activeHall() ?? this.fits[0]
    const open = this.hallOpenFor(fit)
    if (!open.size || !fit) return
    const a = this.airline(airlineId)
    const tag: PaxTag = rollPaxTag(a.persona)
    const g = spawnHallGuest(`layover:${airlineId}`, 'arrive', tag, {
      transfer: true,
      airlineId,
      hallId: this.hallKey(fit),
    })
    g.node = 'gate'
    // Through-checked bags — pax stay airside; bags transfer off claim.
    g.needs.bags = 0
    g.connectFlightId = this.pickConnectFlight(airlineId)
    this.issueBagTags(g.id, g.flightId, tag, g.connectFlightId, 'transfer')
    g.thought = `${a.name} transfer — bags through-checked, kill time in the hall`
    g.needs.boarding = 35 + Math.random() * 40
    if (open.has('food')) this.routeGuest(g, 'food', open)
    else if (open.has('shop')) this.routeGuest(g, 'shop', open)
    else if (open.has('dayhotel')) this.routeGuest(g, 'dayhotel', open)
    else if (open.has('lounge')) this.routeGuest(g, 'lounge', open)
    else if (open.has('claim')) {
      // Fallback only — claim as transfer path means thin transfer infra.
      this.routeGuest(g, 'claim', open)
      g.thought = `${a.name} transfer — recheck bags (no through path)`
      g.needs.bags = Math.min(99, 55 + bagUnitsForTag(tag) * 18)
      this.adjustHeat(airlineId, -1.4)
      if (Math.random() < 0.4) {
        this.pushNews(
          `${a.name} transfer bags forced to claim — Standing dips. Build transfer capacity.`,
          'bad',
        )
      }
    }
    this.hallGuests.push(g)
    // Transfers scuff the hall faster.
    if (Math.random() < 0.35) this.bumpWear('bath', 0.4, fit)
    if (Math.random() < 0.2) this.bumpWear('sec', 0.25, fit)
  }

  /** Soft heat drift, rewards, warnings, abandon, ban expiry. */
  tickAirlineRelations(dt: number) {
    this.standingAdvisor.tick(this.clock, dt, (id) => this.airline(id).kind === 'cargo')
    for (const id of [...this.signed]) {
      if (this.isBanned(id)) continue
      // Slow recovery toward 70 when not in crisis.
      const h = this.heatOf(id)
      if (h < 70) this.airlineHeat[id] = Math.min(70, h + dt * 0.14)
      else if (h > 78) this.airlineHeat[id] = Math.max(70, h - dt * 0.04)

      const heat = this.heatOf(id)
      if (heat >= HEAT_REWARD_THRESHOLD && !this.airlineReward[id]) {
        this.grantReward(id)
      }

      // Outside layover bans: warn → accumulate → abandon.
      if (this.layover?.airline === id) {
        this.airlineLowAcc[id] = 0
        continue
      }
      if (heat <= HEAT_WARN_THRESHOLD && !this.airlineWarned[id]) {
        this.airlineWarned[id] = true
        const a = this.airline(id)
        const perk = this.airlineReward[id]
        const atRisk = perk
          ? ` ${REWARD_LABEL[perk]} at risk.`
          : ` Keep Standing above ${HEAT_REWARD_THRESHOLD} to unlock ${REWARD_LABEL[rewardForPersona(a.persona)]}.`
        this.pushNews(
          `${a.name} warning — Standing ${Math.round(heat)}. Fix the hall before ${HEAT_ABANDON_THRESHOLD}.${atRisk}`,
          'bad',
        )
      }
      if (heat <= HEAT_ABANDON_THRESHOLD) {
        this.airlineLowAcc[id] = (this.airlineLowAcc[id] ?? 0) + dt
        if ((this.airlineLowAcc[id] ?? 0) >= ABANDON_ACC_SECONDS) {
          this.abandonAirline(id, 'dead Standing')
        }
      } else if (heat > HEAT_WARN_THRESHOLD + 8) {
        this.airlineLowAcc[id] = Math.max(0, (this.airlineLowAcc[id] ?? 0) - dt * 0.6)
        if (heat >= 55) this.airlineWarned[id] = false
      }
    }
    for (const id of Object.keys(this.airlineBanUntil)) {
      const until = this.airlineBanUntil[id]
      if (until > 0 && until <= this.clock && until > this.clock - dt) {
        this.airlineHeat[id] = 45
        this.pushNews(`${this.airline(id).name} ban lifted — they're watching the hall.`, 'ok')
      }
    }
  }

  buyRoom(id: RoomId) {
    if (!this.terminalHallSelected()) this.focusHallForDesk()
    const origin = this.selectedTerminalOrigin()
    if (!origin) {
      this.pushNews(this.hallFurnishNote(), 'bad')
      this.emit()
      return
    }
    const def = ROOMS.find((r) => r.id === id)
    if (!def) return
    if (!this.spend(def.cost, def.name)) return
    let fit = this.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
    if (!fit) {
      fit = emptyFit(origin, false)
      this.fits.push(fit)
    }
    fit.rooms[id] += 1
    this.pushNews(`Furnished ${def.name}.`, 'ok')
    this.refreshAdvice()
    this.emit()
  }

  /** Budget traffic scuffs WC / security on that hall. Returns that hall's wear. */
  bumpWear(kind: 'bath' | 'sec', amount: number, fitParam?: TerminalFit | null): number {
    if (!this.fits.length) return 0
    const fit = fitParam ?? this.activeHall() ?? this.fits[0]
    if (!fit) return 0
    if (kind === 'bath') fit.wearBath = Math.min(100, (fit.wearBath ?? 0) + amount)
    else fit.wearSec = Math.min(100, (fit.wearSec ?? 0) + amount)
    return kind === 'bath' ? fit.wearBath : fit.wearSec
  }

  scrubHall(fitParam?: TerminalFit | null) {
    if (!this.fits.length) {
      this.pushNews('No hall to scrub.', 'bad')
      return
    }
    const fit = fitParam ?? this.activeHall() ?? this.fits[0]
    if (!fit) return
    const wear = Math.max(fit.wearBath ?? 0, fit.wearSec ?? 0)
    if (wear < 5) {
      this.pushNews(`${this.hallLabel(fit)} is already clean enough.`, 'ok')
      this.emit()
      return
    }
    // Cleaning budget softens the sticker — full crew does more per dollar.
    const cleanPct = this.budgetOf('cleaning') / 100
    const cost = Math.round(HALL_SCRUB_COST * (1.35 - cleanPct * 0.35))
    if (!this.spend(cost, 'hall scrub')) return
    const cut = 30 + cleanPct * 25
    fit.wearBath = Math.max(0, (fit.wearBath ?? 0) - cut)
    fit.wearSec = Math.max(0, (fit.wearSec ?? 0) - cut * 0.9)
    for (const it of fit.items ?? []) it.wear = Math.max(0, it.wear - cut * 0.9)
    this.reputation = Math.min(100, this.reputation + 2)
    this.pushNews(
      cleanPct < 0.4
        ? `${this.hallLabel(fit)}: thin cleaning crew scrubbed — still sticky in places.`
        : `${this.hallLabel(fit)}: crew scrubbed WC and security lanes.`,
      cleanPct < 0.4 ? 'ok' : 'good',
    )
    this.emit()
  }

  setBudget(key: BudgetKey, pct: number) {
    this.budgets[key] = clamp(Math.round(pct), 0, 100)
    this.emit()
  }

  /**
   * Busy fields cost more to run — signed carriers, extra stands, and turn volume
   * scale ops payroll so mid/late game stays a money puzzle (capped).
   */
  fieldOpsMult(): number {
    return fieldOpsMultiplier(
      this.signed.length,
      tilesOf(this.tiles, 'stand').length,
      this.flightsDone,
      this.fieldLevel(),
    )
  }

  payrollPreview(): number {
    const lines = (Object.keys(BUDGET_BASE) as BudgetKey[]).map((key) => this.lineCost(key))
    return payrollAmount(lines, this.fieldOpsMult())
  }

  /** Operating income already posted for one game day. Financing and the level grant are excluded. */
  private dayOperatingIncome(day: number): number {
    const ledger = this.bank.ledgerForGameDay(day)
    let income = 0
    for (const [category, amount] of Object.entries(ledger.byCategory)) {
      if (FINANCING_CATEGORIES.has(category) || !(amount && amount > 0)) continue
      income += amount
    }
    return income
  }

  /**
   * The payroll bill the day close will charge: staffing floor, or the income
   * share when that is higher. The HUD line uses this, not the floor alone.
   */
  payrollCharged(): number {
    const day = Math.floor(Math.max(0, this.clock) / REAL_SECONDS_PER_GAME_DAY)
    const phase = this.clock <= 600 ? 'early' : 'midgame'
    return payrollForGameDay(this.dayOperatingIncome(day), phase, this.payrollPreview())
  }

  payrollChargeTitle(): string {
    const phase = this.clock <= 600 ? 'early' : 'midgame'
    return payrollChargeWhy(
      this.payrollCharged(),
      this.payrollPreview(),
      DAILY_PAYROLL_SHARE[phase],
      REAL_SECONDS_PER_GAME_DAY,
    )
  }

  /**
   * Catering the turn will actually bill. A $0 airline rate still sells a share of a cart.
   * The contract letter and the earn path both use this.
   */
  quotedCatering(airlineId: string, pax: number): number {
    const airline = this.airline(airlineId)
    const mult = this.caterBrand ? CATER[this.caterBrand].payoutMult : 1
    const pay = cateringTurnFee(
      airline.catering,
      mult,
      Math.max(0, pax),
      DEFAULT_FEE_SCHEDULE.cateringPerCart,
    )
    const stub = { airline: airlineId, ga: false } as Flight
    return this.contractBill(stub, this.listed(pay, 'cateringPerCart'), 'service', 'catering')
  }

  /** Hall counters and the airside shop SKUs, so the retail panel is not an empty shelf. */
  hallShopLines(): string[] {
    const lines: string[] = []
    for (const fit of this.fits) {
      for (const item of fit.items ?? []) {
        const def = itemDef(item.def)
        if (!def) continue
        if (def.room === 'food' || def.room === 'souvenir') lines.push(def.name)
      }
    }
    const engine = this.ensureCatering().engine
    for (const shop of engine.shops.values()) {
      const bits = shop.skus.map((sku) => `${sku} ×${shop.stock[sku]} @ $${engine.config.prices[sku]}`)
      lines.push(`${shop.name}: ${bits.join(', ')}`)
    }
    return lines
  }

  /**
   * What the next operating day will bill: staff floor, landside (already a
   * daily total) plus pillar and premium upkeep, plot holding, and the city
   * levy on today's cash. The HUD forecast uses this; it does not post.
   */
  dailyOperatingCharges(): { payroll: number; upkeep: number; holding: number; levy: number } {
    const relief = this.upkeepRelief()
    return {
      payroll: this.payrollCharged(),
      upkeep: Math.round((this.landsideUpkeep() + this.pillarUpkeepBill()) * relief) + dailyUpkeep(this.premium),
      holding: this.site ? Math.round(this.dailyHoldingQuote() * relief) : 0,
      levy: cityLevy(this.cash, this.sandbox),
    }
  }

  staffPanel() {
    return this.staffHousing.panel(this.staffField())
  }

  staffSites() {
    return this.staffHousing.sites()
  }

  staffWalkers() {
    return this.staffHousing.walkers(this.staffField())
  }

  staffHireCost(base: number): number {
    return this.staffHousing.hirePrice(base, this.staffField())
  }

  buildStaffHousing(tier: HousingTierId): boolean {
    const quote = this.staffHousing.quote(tier, this.staffField())
    if (!quote.ok) {
      this.pushNews(quote.reason, 'bad')
      this.emit()
      return false
    }
    if (!this.sandbox) {
      if (!this.spend(quote.cost, quote.name)) return false
    }
    this.staffHousing.commit(quote)
    const plots = quote.plotIds.length === 1 ? '1 plot' : `${quote.plotIds.length} plots`
    this.pushNews(`${quote.name} is open on ${plots}. Crew can live on the field.`, 'good')
    this.emit()
    return true
  }

  private staffField(): StaffField {
    const origin = this.fits[0]?.origin
    return {
      tiles: this.tiles,
      railLinked: this.railLinked,
      fieldLevel: this.fieldLevel(),
      ownedPlots: this.ownedPlots,
      counts: {
        desk: this.deskStaff,
        janitor: this.janitors,
        mechanic: this.mechanics,
        researcher: this.researchers,
      },
      clock: Math.max(0, this.clock),
      work: origin ? { c: origin.c + 1, r: origin.r + 1 } : { c: 16, r: 16 },
    }
  }

  private payHire(base: number, label: string): boolean {
    const cost = this.staffHireCost(base)
    if (!this.spend(cost, label, 'staff_hiring')) return false
    return true
  }

  private settleStaffHousing(completedDay: number) {
    const roll = this.staffHousing.closeDay(this.staffField(), completedDay)
    if (roll.upkeep > 0 && !this.sandbox) {
      this.charge(roll.upkeep, 'building_upkeep', (completedDay + 1) * SIM_MINUTES_PER_GAME_DAY - 1)
    }
    if (roll.reputationHit > 0) this.reputation = Math.max(0, this.reputation - roll.reputationHit)
    if (roll.quit) this.releaseStaff(roll.quit)
    if (roll.news) this.pushNews(roll.news, roll.late || roll.quit ? 'bad' : 'ok')
  }

  private releaseStaff(role: StaffSeat) {
    if (role === 'desk' && this.deskStaff > 0) {
      this.deskStaff -= 1
      this.assignHallStaff()
      return
    }
    if (role === 'janitor' && this.janitors > 0) {
      this.janitors -= 1
      const pawn = this.people.findIndex((person) => person.job === 'janitor')
      if (pawn >= 0) this.people.splice(pawn, 1)
      return
    }
    if (role === 'mechanic' && this.mechanics > 0) {
      this.mechanics -= 1
      const pawn = this.people.findIndex((person) => person.job === 'mechanic')
      if (pawn >= 0) this.people.splice(pawn, 1)
      return
    }
    if (role === 'researcher' && this.researchers > 0) {
      this.researchers -= 1
      const pawn = this.people.findIndex((person) => person.job === 'researcher')
      if (pawn >= 0) this.people.splice(pawn, 1)
    }
  }


  hireJanitor() {
    if (this.janitors >= 6) {
      this.pushNews('Janitor crew maxed (6).', 'bad')
      this.emit()
      return
    }
    if (!this.payHire(JANITOR_HIRE, 'hire janitor')) return
    this.janitors += 1
    this.spawnJanitorPawn()
    this.pushNews(
      `Hired janitor #${this.janitors}. They sweep litter, empty trash cans, and service restrooms when cleaning budget is funded.`,
      'good',
    )
    this.emit()
  }

  spawnJanitorPawn() {
    const origin = this.fits[0]?.origin
    if (!origin) return
    this.people.push({
      id: uid('jan'),
      flightId: '',
      x: origin.c + 0.5,
      y: origin.r + 0.5,
      path: [],
      seg: 0,
      t: 0,
      color: '#5a8a6a',
      job: 'janitor',
      itinerary: [],
      label: 'Janitor',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }

  tickJanitors(dt: number) {
    this.janitorCool -= dt
    const clean = this.budgetOf('cleaning') / 100
    if (this.janitors < 1 || clean < 0.2 || !this.fits.length) return
    if (this.janitorCool > 0) return
    this.janitorCool = 8
    const live = this.people.filter((p) => p.job === 'janitor').length
    if (live < this.janitors) this.spawnJanitorPawn()
    const cut = (1.8 + this.janitors * 0.9) * clean
    for (const f of this.fits) {
      f.wearBath = Math.max(0, (f.wearBath ?? 0) - cut)
      f.wearSec = Math.max(0, (f.wearSec ?? 0) - cut * 0.75)
    }
    // Wander janitors toward hall origin.
    for (const p of this.people) {
      if (p.job !== 'janitor') continue
      const fit = this.fits[0]
      if (!fit) continue
      const tx = fit.origin.c + Math.random() * 2
      const ty = fit.origin.r + Math.random() * 2
      p.x = lerp(p.x, tx, 1 - Math.pow(0.15, dt))
      p.y = lerp(p.y, ty, 1 - Math.pow(0.15, dt))
    }
  }

  /** Lab gear counts across all halls. */
  labGear(): { desks: number; boards: number; machines: number } {
    let desks = 0
    let boards = 0
    let machines = 0
    for (const f of this.fits) {
      desks += f.rooms.rdesk ?? 0
      boards += f.rooms.rboard ?? 0
      machines += f.rooms.rmachine ?? 0
    }
    return { desks, boards, machines }
  }

  /** RP/sec from operations. Rooms add the larger share via labResearchRate. */
  opsResearchRate(): number {
    if (!this.site) return 0
    return OPS_RP_PER_SEC
  }

  /** RP/sec from animated R&D rooms. Hired researchers raise this; they are not required. */
  labResearchRate(): number {
    if (!this.site) return 0
    const gear = this.labGear()
    const rooms = { desk: gear.desks, board: gear.boards, machine: gear.machines }
    return Math.max(0, this.researchTree.rate(rooms, true, this.researchers) - OPS_RP_PER_SEC)
  }

  /** RP/sec of the one research pool: operations trickle plus the lab rooms. */
  researchRate(): number {
    return this.opsResearchRate() + this.labResearchRate()
  }

  hireResearcher() {
    if (this.researchers >= 6) {
      this.pushNews('Research crew maxed (6).', 'bad')
      this.emit()
      return
    }
    if (!this.fits.length) {
      this.pushNews('Stamp a hall before hiring researchers.', 'bad')
      this.emit()
      return
    }
    if (!this.payHire(RESEARCHER_HIRE, 'hire researcher')) return
    this.researchers += 1
    this.spawnResearcherPawn()
    const { desks } = this.labGear()
    this.pushNews(
      desks < 1
        ? `Hired researcher #${this.researchers}. Furnish a Research desk or they barely bank RP.`
        : `Hired researcher #${this.researchers}. They walk desk → board → lab bench.`,
      'good',
    )
    this.emit()
  }

  spawnResearcherPawn() {
    const origin = this.fits[0]?.origin
    if (!origin) return
    const { desks } = this.labGear()
    this.people.push({
      id: uid('rnd'),
      flightId: '',
      x: origin.c + 0.35,
      y: origin.r + 0.25,
      path: [],
      seg: 0,
      t: 0,
      color: '#7a9ec8',
      job: 'researcher',
      itinerary: [],
      label: desks > 0 ? 'Researcher · desk' : 'Researcher · idle',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      // 0 desk · 1 board · 2 machine · 3 break · 4 home (off-shift)
      stage: 0,
      paidFood: false,
      paidGift: false,
      dutySec: 10 + Math.random() * 8,
    })
  }

  /** Live researcher roster — working vs break vs off-shift. */
  labCrewStatus(): { working: number; break: number; home: number; total: number } {
    const staff = this.people.filter((p) => p.job === 'researcher')
    let working = 0
    let onBreak = 0
    let home = 0
    for (const p of staff) {
      if (p.stage === 3) onBreak += 1
      else if (p.stage === 4) home += 1
      else working += 1
    }
    return { working, break: onBreak, home, total: staff.length }
  }

  /** Pick next researcher duty. Soft home = off-shift exit, not CEO bus commute. */
  private assignResearcherDuty(p: Person, desks: number, boards: number, machines: number) {
    const night = this.isNight()
    // Coming back from break/home → always work first.
    if (p.stage === 3 || p.stage === 4) {
      const opts: number[] = []
      if (desks > 0) opts.push(0)
      if (boards > 0) opts.push(1)
      if (machines > 0) opts.push(2)
      if (!opts.length) {
        p.stage = 0
        p.label = 'Researcher · idle'
        p.dutySec = 12 + Math.random() * 6
        return
      }
      p.stage = opts[Math.floor(Math.random() * opts.length)]
      p.label =
        p.stage === 0
          ? 'Researcher · desk'
          : p.stage === 1
            ? 'Researcher · board'
            : 'Researcher · lab'
      p.dutySec = 14 + Math.random() * 10
      return
    }
    // Chance to leave the lab — higher at night; home lasts longer than break.
    const leaveRoll = Math.random()
    const homeOdds = night ? 0.22 : 0.1
    const breakOdds = night ? 0.16 : 0.2
    if (leaveRoll < homeOdds) {
      p.stage = 4
      p.label = 'Researcher · home'
      p.dutySec = (night ? 36 : 26) + Math.random() * 14
      return
    }
    if (leaveRoll < homeOdds + breakOdds) {
      p.stage = 3
      p.label = 'Researcher · break'
      p.dutySec = 8 + Math.random() * 8
      return
    }
    const opts: number[] = []
    if (desks > 0) opts.push(0)
    if (boards > 0) opts.push(1)
    if (machines > 0) opts.push(2)
    if (!opts.length) {
      p.stage = 0
      p.label = 'Researcher · idle'
      p.dutySec = 10 + Math.random() * 6
      return
    }
    p.stage = opts[Math.floor(Math.random() * opts.length)]
    p.label =
      p.stage === 0
        ? 'Researcher · desk'
        : p.stage === 1
          ? 'Researcher · board'
          : 'Researcher · lab'
    p.dutySec = 12 + Math.random() * 10
  }

  tickResearchers(dt: number) {
    if (this.researchers < 1) return
    const live = this.people.filter((p) => p.job === 'researcher').length
    if (live < this.researchers && this.fits.length) this.spawnResearcherPawn()

    const { desks, boards, machines } = this.labGear()
    const fit = this.activeHall() ?? this.fits[0]
    const open = fit ? openNodesFromRooms(fit.rooms) : new Set<HallNode>()
    let working = 0
    for (const p of this.people) {
      if (p.job !== 'researcher') continue
      p.dutySec = (p.dutySec ?? 0) - dt
      if (p.dutySec <= 0) {
        this.assignResearcherDuty(p, desks, boards, machines)
      }
      if (p.stage <= 2) working += 1

      if (!fit) continue
      // Walk targets: lab stations on the hall footprint; break → food/WC; home → road exit.
      let ox = fit.origin.c
      let oy = fit.origin.r
      if (p.stage === 0) {
        ox += 0.25
        oy += 0.2
      } else if (p.stage === 1) {
        ox += 0.9
        oy += 0.15
      } else if (p.stage === 2) {
        ox += 1.55
        oy += 0.35
      } else if (p.stage === 3) {
        if (open.has('food')) {
          ox += 1.4
          oy += 1.5
        } else if (open.has('bathroom')) {
          ox += 0.6
          oy += 1.8
        } else {
          ox += 2.0
          oy += 1.4
        }
      } else {
        // Off-shift — leave via landside road, not a bus-stop sim.
        ox = Math.max(0, fit.origin.c - 2.5)
        oy = Math.max(0, fit.origin.r - 1.5)
      }
      const jitter = p.id.charCodeAt(4) % 5
      const tx = ox + (jitter * 0.08)
      const ty = oy + ((jitter % 3) * 0.08)
      p.x = lerp(p.x, tx, 1 - Math.pow(0.1, dt))
      p.y = lerp(p.y, ty, 1 - Math.pow(0.1, dt))
    }

    const staff = this.people.filter((p) => p.job === 'researcher')
    const workFrac = staff.length ? working / staff.length : 0

    if (
      staff.length >= 2 &&
      workFrac < 0.35 &&
      Math.random() < dt * 0.04
    ) {
      this.pushNews('Lab quiet — researchers on break or off-shift.', 'ok')
    }
  }

  hasCtScanners(): boolean {
    // Growth node safety-4 grants ct_lanes. The economy tech id is a second wallet the sheet never spends.
    if (this.hasResearch('ct_lanes')) return true
    const unlocked = this.economyState?.unlockedTech ?? this.economyView?.state.unlockedTech ?? []
    return unlocked.includes(CT_TECH_ID)
  }

  premiumGate() {
    return {
      fieldLevel: this.fieldLevel(),
      hasCt: this.hasCtScanners(),
      day: Math.floor(Math.max(0, this.clock) / 180),
      hourIndex: Math.floor(this.simMinutes() / 60),
      hours: 1,
    }
  }

  buyPremium(itemId: PremiumItemId): boolean {
    const attempt = buyFacility(this.premium, itemId, this.premiumGate())
    if (!attempt.ok) {
      this.pushNews(attempt.reason, 'bad')
      this.emit()
      return false
    }
    if (!this.spend(attempt.cost, attempt.name)) return false
    this.premium = attempt.state
    this.pushNews(
      `${attempt.name} open. Upkeep ${moneyLeft(attempt.upkeep)}/day, staffed or idle.`,
      'ok',
    )
    this.emit()
    return true
  }

  hirePremiumOfficer(): boolean {
    const attempt = hireOfficer(this.premium)
    if (!attempt.ok) {
      this.pushNews(attempt.reason, 'bad')
      this.emit()
      return false
    }
    if (!this.spend(attempt.cost, 'security officer')) return false
    this.premium = attempt.state
    this.pushNews(
      `Security officer #${this.premium.securityOfficers} joined the shared roster.`,
      'ok',
    )
    this.emit()
    return true
  }

  setPremiumFee(on: boolean) {
    this.premium = setFeeEnabled(this.premium, on)
    this.pushNews(
      on ? `Fast-track fee on (${moneyLeft(PREMIUM_RULES.fastTrackFee)} per passenger).` : 'Fast-track fee off.',
      'ok',
    )
    this.emit()
  }

  /** Daily building upkeep. Idle lanes pay the same as busy ones. */
  billPremiumUpkeep(): number {
    const bill = dailyUpkeep(this.premium)
    if (!(bill > 0)) return 0
    this.charge(bill, 'building_upkeep')
    return bill
  }

  private notePremiumDesk(g: HallGuest) {
    if (g.usedPremiumCheckin || g.job !== 'depart') return
    const cabin = g.serviceCabin ?? cabinFromTag(g.tag)
    if (!expectsHigherService(cabin)) return
    const open = staffedFacilities(
      this.premium,
      { security_officer: this.premium.securityOfficers, terminal_staff: this.deskStaff },
      this.hasCtScanners(),
    )
    if (!open.some((row) => row.kind === 'checkin')) return
    g.usedPremiumCheckin = true
    g.thought = 'Premium check-in'
  }

  private rulePremiumScreen(g: HallGuest) {
    if (g.premiumScreen || g.job !== 'depart') return
    // Show-up stamps the lane on preferFastTrack. Lounge lovers carry a premium
    // wallet and still walk the standard scanners.
    if (g.showUp && !g.showUp.preferFastTrack) return
    let cabin = g.serviceCabin ?? cabinFromTag(g.tag)
    if (g.showUp?.preferFastTrack && !expectsHigherService(cabin)) cabin = 'business'
    const screened = screenPassengers(
      this.premium,
      [{ id: g.id, cabin, airlineId: g.airlineId ?? 'field' }],
      { security_officer: this.premium.securityOfficers, terminal_staff: this.deskStaff },
      this.premiumGate(),
    )
    this.premium = screened.state
    const row = screened.rows[0]
    if (!row) return
    g.premiumScreen = row.path
    g.premiumEscort = row.escorted
    if (row.checkinId) g.usedPremiumCheckin = true
    if (row.happinessDelta) g.happiness = Math.max(0, Math.min(100, g.happiness + row.happinessDelta))
    if (row.standingDelta && g.airlineId) {
      const sens = this.airline(g.airlineId).heatSensitivity || 1
      this.adjustHeat(g.airlineId as AirlineId, row.standingDelta / sens)
    }
    if (row.fee > 0) {
      this.cash += row.fee
      this.revenue += row.fee
      this.noteIncome(row.fee, 'passenger_fees')
    }
  }

  private tickDedicatedLane(g: HallGuest, dt: number, open: Set<HallNode>) {
    const label =
      g.premiumScreen === 'vip_room' ? 'Private screening' : g.premiumEscort ? 'Escorted fast-track' : 'Fast-track lane'
    if ((g.serviceLeft ?? 0) > 0) {
      g.serviceLeft = (g.serviceLeft ?? 0) - dt
      g.lost = false
      g.thought = label
      if ((g.serviceLeft ?? 0) <= 0) {
        g.serviceLeft = 0
        g.clearedSec = true
        g.thought = g.premiumScreen === 'vip_room' ? 'Cleared the private room' : 'Cleared fast-track'
        if (g.needs.bladder > 62 && open.has('bathroom')) this.routeGuest(g, 'bathroom', open)
        else if (g.needs.hunger > 58 && open.has('food')) this.routeGuest(g, 'food', open)
        else if (open.has('gate')) this.routeGuest(g, 'gate', open)
      }
      return
    }
    g.serviceLeft = PREMIUM_RULES.dedicatedServiceSec
    g.lost = false
    g.thought = label
  }

  hireDeskStaff() {
    if (this.deskStaff >= 8) {
      this.pushNews('Desk crew maxed (8).', 'bad')
      this.emit()
      return
    }
    if (!this.fits.length) {
      this.pushNews('Stamp a hall before hiring desk staff.', 'bad')
      this.emit()
      return
    }
    if (!this.payHire(DESK_STAFF_HIRE, 'hire desk staff')) return
    this.deskStaff += 1
    this.assignHallStaff()
    this.pushNews(
      `Hired desk agent #${this.deskStaff}. Bodies cover check-in, security, and gate.`,
      'good',
    )
    this.refreshAdvice()
    this.emit()
  }

  assignHallStaff() {
    const open = this.hallOpen()
    const posts: StaffPost[] = []
    if (open.has('checkin')) posts.push('checkin')
    if (open.has('security')) posts.push('security')
    if (open.has('gate')) posts.push('gate')
    if (!posts.length) {
      this.hallStaff = []
      return
    }
    // Keep existing bodies; resize to deskStaff.
    while (this.hallStaff.length < this.deskStaff) {
      const node = posts[this.hallStaff.length % posts.length]
      this.hallStaff.push({
        id: uid('desk'),
        node,
        label:
          node === 'checkin'
            ? 'Clerk'
            : node === 'security'
              ? 'Screener'
              : 'Gate agent',
        color: node === 'security' ? '#c9a227' : node === 'gate' ? '#6a9ec8' : '#8aaf7a',
        stage: HALL_POST.onPost,
      })
    }
    if (this.hallStaff.length > this.deskStaff) {
      this.hallStaff.length = this.deskStaff
    }
    // Rebalance coverage — only bodies on the post can cover or be moved.
    const covered = new Set(this.hallStaff.filter((s) => onPostNow(s.stage)).map((s) => s.node))
    for (const s of this.hallStaff) {
      if (!onPostNow(s.stage)) continue
      if (!posts.includes(s.node)) {
        s.node = posts[0]
        s.label =
          s.node === 'checkin' ? 'Clerk' : s.node === 'security' ? 'Screener' : 'Gate agent'
      }
    }
    for (const post of posts) {
      if (covered.has(post)) continue
      const free = this.hallStaff.find((s) => onPostNow(s.stage) && covered.has(s.node) &&
        this.hallStaff.filter((x) => x.node === s.node && onPostNow(x.stage)).length > 1)
      if (free) {
        free.node = post
        free.label =
          post === 'checkin' ? 'Clerk' : post === 'security' ? 'Screener' : 'Gate agent'
        covered.add(post)
      }
    }
  }

  tickDeskStaff(dt: number) {
    if (this.deskStaff < 1) {
      this.hallStaff = []
      return
    }
    this.assignHallStaff()
    for (const s of this.hallStaff) {
      if (s.stage !== HALL_POST.commuting) continue
      s.walkLeft = (s.walkLeft ?? 0) - dt
      if (s.walkLeft <= 0) {
        s.walkLeft = 0
        s.stage = HALL_POST.onPost
      }
    }
    this.deskStaffCool -= dt
    if (this.deskStaffCool > 0) return
    this.deskStaffCool = 14
    for (const s of this.hallStaff) {
      if (s.stage === HALL_POST.onBreak) {
        // Back from break: they walk to the post before they count.
        s.stage = HALL_POST.commuting
        s.walkLeft = SERVICE_POINT_TUNING.postWalkSec
        s.label = s.label.split(' ·')[0]
        continue
      }
      if (s.stage !== HALL_POST.onPost) continue
      if (Math.random() < 0.16) {
        s.stage = HALL_POST.onBreak
        s.label = `${s.label.split(' ·')[0]} · break`
      }
    }
    // Rotate working staff across posts so one hire still covers over time.
    const open = this.hallOpen()
    const posts: StaffPost[] = []
    if (open.has('checkin')) posts.push('checkin')
    if (open.has('security')) posts.push('security')
    if (open.has('gate')) posts.push('gate')
    if (posts.length < 2) return
    for (const s of this.hallStaff) {
      if (!onPostNow(s.stage)) continue
      if (Math.random() < 0.35) {
        const next = posts[Math.floor(Math.random() * posts.length)]
        if (next === s.node) continue
        s.node = next
        s.stage = HALL_POST.commuting
        s.walkLeft = SERVICE_POINT_TUNING.postWalkSec
        s.label =
          next === 'checkin' ? 'Clerk' : next === 'security' ? 'Screener' : 'Gate agent'
        s.color = next === 'security' ? '#c9a227' : next === 'gate' ? '#6a9ec8' : '#8aaf7a'
      }
    }
  }

  lineCost(key: BudgetKey): number {
    const gear = key === 'maintenance' ? this.labGear() : { desks: 0, boards: 0, machines: 0 }
    return budgetLineCost({
      key,
      budgetPct: this.budgets[key],
      mechanics: this.mechanics,
      hangars: tilesOf(this.tiles, 'hangar').length,
      researchers: this.researchers,
      desks: gear.desks,
      boards: gear.boards,
      machines: gear.machines,
      securityPosts:
        tilesOf(this.tiles, 'police').length + this.fits.reduce((n, f) => n + f.rooms.security, 0),
      deskStaff: this.deskStaff,
      cleanRooms: this.fits.reduce((n, f) => n + f.rooms.bathroom + f.rooms.food, 0),
      janitors: this.janitors,
      fireStations: tilesOf(this.tiles, 'fire').length,
      signed: this.signed.length,
      helipads: tilesOf(this.tiles, 'helipad').length,
    })
  }

  hireMechanic() {
    if (this.mechanics >= 8) {
      this.pushNews('Shop is full — 8 mechanics max for this field.', 'bad')
      this.emit()
      return
    }
    if (!this.payHire(MECHANIC_HIRE, 'hire mechanic')) return
    this.mechanics += 1
    this.spawnMechanicPawn()
    this.pushNews(
      `Hired mechanic #${this.mechanics}. They walk the strip and hangar when maintenance budget is funded.`,
      'good',
    )
    this.emit()
  }

  fireMechanic() {
    if (this.mechanics <= 0) return
    this.mechanics -= 1
    const mech = this.people.find((p) => p.job === 'mechanic')
    if (mech) mech.stage = 99
    this.pushNews(`Laid off a mechanic. ${this.mechanics} left on payroll.`, 'ok')
    this.emit()
  }

  spawnMechanicPawn() {
    const hangars = tilesOf(this.tiles, 'hangar')
    const strips = runwayStrips(this.tiles, MIN_RUNWAY).flat()
    const start = hangars[0] ?? strips[0] ?? tilesOf(this.tiles, 'stand')[0]
    if (!start) return
    const goal = strips.length ? pick(strips) : hangars[0] ?? start
    const path = astar(this.tiles, start, goal, 'mechanic') ?? [start]
    this.people.push({
      id: uid('mx'),
      flightId: '',
      x: start.c,
      y: start.r,
      path,
      seg: 0,
      t: 0,
      color: '#6b5b3a',
      job: 'mechanic',
      itinerary: [],
      label: 'Mechanic',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }

  considerMxOffers() {
    if (this.mxOffer || this.mxOfferCool > 0) return
    if (!tilesOf(this.tiles, 'hangar').length || this.mechanics < 1) return
    if (this.budgetOf('maintenance') < 35) return
    const candidates = this.signed.filter((id) => !this.mxSigned.includes(id))
    if (!candidates.length) return
    const id = pick(candidates)
    const a = this.airline(id)
    const payout = Math.round(a.landing * (a.kind === 'cargo' ? 0.22 : 0.18) + this.mechanics * 120)
    this.mxOffer = { airline: id, age: 0, payout, deadline: 32 }
    this.pushNews(
      `${a.name} sent an MX letter — $${payout.toLocaleString()} per hangar turnaround.`,
      'good',
    )
  }

  acceptMxOffer() {
    if (!this.mxOffer) return
    const id = this.mxOffer.airline
    this.mxSigned.push(id)
    this.mxOffer = null
    this.mxOfferCool = 40
    this.pushNews(`${this.airline(id).name} MX signed. Their jets will pay shop fees on stand.`, 'good')
    this.emit()
  }

  declineMxOffer() {
    if (!this.mxOffer) return
    const id = this.mxOffer.airline
    this.mxOffer = null
    this.mxOfferCool = 55
    this.pushNews(`${this.airline(id).name} MX talk died. They may call again.`, 'ok')
    this.emit()
  }

  expireMxOffer() {
    if (!this.mxOffer) return
    const a = this.airline(this.mxOffer.airline)
    this.mxOffer = null
    this.mxOfferCool = 45
    this.pushNews(`${a.name} MX letter expired.`, 'ok')
    this.emit()
  }

  weatherLabel(): string {
    return weatherTitle(this.mapId, this.gameDay(), this.weather)
  }

  weatherCrashMult(): number {
    const deice = this.hasResearch('deice') ? 0.72 : 1
    if (this.weather === 'storm') return 2.4 * deice
    if (this.weather === 'fog') return 1.7 * (this.hasResearch('deice') ? 0.85 : 1)
    if (this.weather === 'rain') return 1.35 * deice
    return 1
  }

  /** Chance (0–1) a jet has a serious pavement incident this check. */
  crashChance(): number {
    const cond = this.runwayCondition / 100
    const mx = this.budgetOf('maintenance') / 100
    const staff = clamp(this.mechanics / 3, 0, 1)
    const neglect = (1 - cond) * (1.15 - mx * 0.55) * (1.1 - staff * 0.35)
    return clamp(neglect * 0.045 * this.weatherCrashMult(), 0, 0.35)
  }

  tickWeather(dt: number) {
    this.weatherCool -= dt
    if (this.weatherCool > 0) return
    this.weatherCool = 35 + Math.random() * 40
    const roll = Math.random()
    const next =
      this.mapId === 'temperate'
        ? rollSeasonWeather(dayIndex(this.clock), roll)
        : rollMapWeather(this.mapId, this.gameDay(), roll)
    if (next !== this.weather) {
      this.weather = next
      if (this.mapId === 'temperate') {
        if (next === 'storm') {
          this.stormPulseCool = 0
          this.pushNews(
            this.hasResearch('deice')
              ? 'Storm cell over the field — de-ice pads online; expect soft slips, not a washout.'
              : 'Storm cell over the field — wet strip, high crash risk if pavement is soft. Research De-ice ops.',
            'bad',
          )
        } else if (next === 'clear' && this.runwayCondition < 50) {
          this.pushNews('Skies clear, but the runway still needs work.', 'ok')
        } else if (next !== 'clear') {
          this.pushNews(`Weather: ${this.weatherLabel()}.`, 'ok')
        }
      } else {
        if (next === 'storm') this.stormPulseCool = 0
        const alert = climateAlert(this.mapId, this.gameDay(), next)
        if (alert) this.pushNews(alert.text, alert.tone)
      }
    }
    this.refreshWinter()
  }

  /** Connecting passengers who completed or missed, for the open year. */
  noteHubConnections(completed: number, missed: number): void {
    this.playtestYear.noteConnections(completed, missed)
  }

  /** One disruption. `revenueImpact` is estimated dollars lost, never a credit. */
  noteDisruption(kind: string, revenueImpact: number, day = Math.floor(Math.max(0, this.clock) / 180)): void {
    this.playtestYear.noteDisruption(kind, revenueImpact, day)
  }

  /** An award earned this year. PR #63 ids pick up a one-line reason on the card. */
  noteYearAward(award: YearAwardInput): void {
    this.playtestYear.noteAward(award)
  }

  dismissPlaytestYear(): void {
    this.playtestYear.dismiss()
    const dismissTycoon = (this as { dismissYearReport?: () => void }).dismissYearReport
    if (typeof dismissTycoon === 'function') dismissTycoon.call(this)
    this.emit()
  }

  /**
   * Open year card. When PR #63's `pendingYearReport` is present for the same
   * year, its finance and awards replace the bank estimate and the disruption
   * and hub sections stay.
   */
  playtestYearCard(): PlaytestYearReport | null {
    const readTycoon = (this as { pendingYearReport?: () => TycoonYearLike | null }).pendingYearReport
    const tycoon = typeof readTycoon === 'function' ? readTycoon.call(this) : null
    return mergePlaytestAndTycoon(this.playtestYear.pending, tycoon)
  }

  tickPayroll(_dt: number) {
    const day = Math.floor(Math.max(0, this.clock) / 180)
    if (day <= this.payrollDay) return
    const from = this.payrollDay
    this.payrollDay = day
    for (let completed = from; completed < day; completed++) {
      this.closeOperatingDay(completed)
      this.rollPlaytestYear(completed)
    }
    // Year close and tycoon catch-up only reread this window. Older lines stay
    // in the category totals, so a long airport does not keep every fee forever.
    this.bank.retainFrom(Math.max(0, day - MAX_CATCHUP_DAYS) * SIM_MINUTES_PER_GAME_DAY)
  }

  private rollPlaytestYear(completedDay: number) {
    const wear = this.avgWear()
    const cleanliness = Math.max(0, Math.min(100, 100 - Math.max(wear.bath, wear.sec)))
    const closing = (completedDay + 1) % PLAYTEST_YEAR_DAYS === 0
    const fromDay = closing ? completedDay + 1 - PLAYTEST_YEAR_DAYS : 0
    const entries = closing
      ? this.bank
          .entriesBetween(fromDay * SIM_MINUTES_PER_GAME_DAY, (completedDay + 1) * SIM_MINUTES_PER_GAME_DAY)
          .map((entry) => ({ category: entry.category, amount: entry.amount }))
      : []
    const report = this.playtestYear.observeDay(
      {
        completedDay,
        passengers: this.paxServed,
        satisfaction: this.reputation,
        cleanliness,
        entries,
      },
      this,
    )
    if (!report) return
    this.pushNews(`Year ${report.year} report is ready.`, 'ok')
    this.emit()
  }

  private smallField(): boolean {
    const carriers = this.signed.length
    return (
      carriers >= 1 &&
      carriers <= SMALL_FIELD_MAX_CARRIERS &&
      this.hotelLevel === 0 &&
      !this.carParkShort &&
      !this.carParkLong &&
      !this.railLinked
    )
  }

  /**
   * A one- or two-carrier field with no hotel, parking, or rail pays a share of
   * building upkeep. Growth (another carrier or a landside building) drops it.
   */
  private upkeepRelief(): number {
    return this.smallField() ? SMALL_FIELD_UPKEEP_FACTOR : 1
  }

  /** Stands, gate rooms and lounges the daily relation review reads. */
  private relationDayFacts(day: number) {
    let gates = 0
    let lounges = 0
    for (const fit of this.fits) {
      gates += fit.rooms.gate ?? 0
      lounges += fit.rooms.lounge ?? 0
    }
    const dedicated: Record<string, number> = {}
    for (const id of this.signed) {
      const credit = leaseCredit(this.liveHubLeases(id).length + this.liveHubVehicles(id).length)
      if (credit > 0) dedicated[id] = credit
    }
    return {
      day,
      signed: this.signed,
      stands: tilesOf(this.tiles, 'stand').length,
      gates,
      lounges,
      dedicated,
    }
  }

  /**
   * Score the day that just closed, then hand out whatever the new tier
   * unlocked. Route rows and the hub letter do not change fee or fine amounts.
   */
  private reviewAirlineRelations(completedDay: number) {
    const paused = new Set(this.signed.filter((id) => this.waitingOnHelipad(id)))
    this.wave3.reviewDay(this.relationDayFacts(completedDay), paused)
    for (const id of this.signed) {
      const due = this.wave3.routesDue(id)
      if (due > 0) {
        const before = this.schedule.length
        this.seedScheduleForAirline(id, due)
        if (this.schedule.length > before) {
          this.wave3.noteRoutesGranted(id, due)
          this.pushNews(
            `${this.airline(id).name} opened ${due} more route${due === 1 ? '' : 's'} — ${this.wave3.relation(id).label}.`,
            'good',
          )
        }
      }
      this.offerNextHubTier(id, false)
      this.launchHubFerry(id, completedDay + 1)
      const rel = this.wave3.relation(id)
      if (rel.tier >= 5 && !rel.exclusiveNoted) {
        this.wave3.noteExclusive(id)
        this.pushNews(`${this.airline(id).name} asked for exclusivity on the pier.`, 'good')
      }
    }
    this.refreshHubNudges(completedDay + 1)
  }

  /** Send the next hub-tier letter once the relationship gate is met. */
  openRelationHub(airlineId: string) {
    this.offerNextHubTier(airlineId, true)
  }

  private offerNextHubTier(airlineId: string, announce: boolean) {
    if (!this.signed.includes(airlineId) || this.hubOffer || this.isBanned(airlineId)) return
    const a = this.airline(airlineId)
    if (a.persona === 'military_gov') return
    const list = this.hubChecklistFor(airlineId)
    const tier = list.next
    if (!tier) return
    const relation = list.lines.find((line) => line.id === 'relation')
    const band = list.lines.find((line) => line.id === 'band')
    if (relation?.status !== 'ok') return
    if (band && band.status !== 'ok') return
    if (list.lines.find((line) => line.id === 'tenure')?.status !== 'ok') return
    if (list.lines.find((line) => line.id === 'onTime')?.status !== 'ok') return
    if (this.rivalRefuses(airlineId)) return
    const offered = this.hubOffered[airlineId] ?? []
    if (!announce && offered.includes(tier)) return
    const fee = HUB_OFFER_FEE[tier]
    this.hubOffer = { airline: airlineId, age: 0, fee, deadline: 45, tier }
    this.hubOffered[airlineId] = [...offered.filter((row) => row !== tier), tier]
    if (tier === 'hub') this.wave3.noteHubAsked(airlineId)
    this.pushNews(`${a.name} sent a ${HUB_TIER_LABEL[tier]} offer — ${moneyLeft(fee)}.`, 'good')
    if (announce) this.emit()
  }

  /** One warmth text per airline per gap, and a field cap of new texts per day. */
  private refreshHubNudges(day: number) {
    if (this.hubNudgeSentDay !== day) {
      this.hubNudgeSentDay = day
      this.hubNudgesSent = 0
    }
    const skip = new Set(['relation', 'band', 'onTime', 'tenure', 'signed'])
    for (const id of this.signed) {
      if (this.hubNudgesSent >= NUDGE_FIELD_CAP) break
      if (this.hubNudges.some((row) => row.airlineId === id)) continue
      const last = this.hubNudgeLast[id]
      if (last != null && day - last < NUDGE_GAP_DAYS) continue
      const list = this.hubChecklistFor(id)
      if (!list.next) continue
      const step = list.lines.find((line) => line.status !== 'ok' && !skip.has(line.id) && !line.id.startsWith('primary'))
      if (!step) continue
      if (this.hubNudgeSilenced.some((row) => row.airlineId === id && row.step === step.id)) continue
      const tier = HUB_TIER_LABEL[list.next]
      const text =
        step.id === 'desk'
          ? `${NUDGE_DESK_ASK} Toward ${tier}.`
          : `${this.airline(id).name}: ${step.label} would move you toward ${tier}.`
      this.hubNudges.push({
        airlineId: id,
        step: step.id,
        text,
      })
      this.hubNudgeLast[id] = day
      this.hubNudgesSent += 1
    }
  }

  /** Decline silences that warmth step. Later only drops the card. */
  declineHubNudge(airlineId: string) {
    const card = this.hubNudges.find((row) => row.airlineId === airlineId)
    if (!card) return
    this.hubNudgeSilenced.push({ airlineId, step: card.step })
    this.hubNudges = this.hubNudges.filter((row) => row.airlineId !== airlineId)
    this.emit()
  }

  laterHubNudge(airlineId: string) {
    if (!this.hubNudges.some((row) => row.airlineId === airlineId)) return
    this.hubNudges = this.hubNudges.filter((row) => row.airlineId !== airlineId)
    this.emit()
  }

  /** Phone text opens the Airlines hub on this carrier and folds the handset. */
  openAirlinesFromPhone(airlineId: string) {
    this.hubDeepLinkAirline = airlineId
    this.hubDeepLinkTick += 1
    this.phoneFold += 1
    this.setSidePanel('hud')
    this.emit()
  }

  /** Phone text opens the desk assign panel for this carrier and folds the handset. */
  openAssignFromPhone(airlineId: string) {
    this.hubDeepLinkAirline = airlineId
    this.hubAssignTick += 1
    this.phoneFold += 1
    this.setSidePanel('hud')
    this.emit()
  }

  /** Desks, building leases, and trucks already named to this carrier. */
  dedicatedAssetLabels(airlineId: string): string[] {
    const kindName = { lounge: 'Lounge', gate: 'Gate', hangar: 'Hangar' } as const
    const desks = this.dedicatedDesks
      .filter((row) => row.airlineId === airlineId)
      .map((row) => `Desk ${row.deskId}`)
    const leases = this.hubLeases
      .filter((row) => row.airlineId === airlineId)
      .map((row) => `${kindName[row.kind]} ${row.id}`)
    const vehicles = this.hubVehicleLeases
      .filter((row) => row.airlineId === airlineId)
      .map((row) => VEHICLE_ROLE_LABEL[row.role])
    return [...desks, ...leases, ...vehicles]
  }

  /** Hub and Primary carriers with a named MRO bay ferry an aircraft in for a check. */
  private launchHubFerry(airlineId: string, day: number) {
    const tier = this.hubTiers[airlineId]
    if (tier !== 'hub' && tier !== 'primary') return
    const last = this.hubFerryDay[airlineId]
    if (last != null && day - last < FERRY_GAP_DAYS) return
    const hangar = this.liveHubLeases(airlineId).find((lease) => lease.kind === 'hangar')
    if (!hangar) return
    const match = /^hangar:(-?\d+),(-?\d+)$/.exec(hangar.id)
    if (!match) return
    const c = Number(match[1])
    const r = Number(match[2])
    if (this.tiles[r]?.[c] !== 'mro') return
    const airframeId = rosterAirline(airlineId)?.fleet[0]
    if (!airframeId) return
    this.tier3.sync(this.tier3Buildings())
    const started = this.tier3.enqueueFerry({
      aircraftId: `ferry:${airlineId}:${day}`,
      airframeId,
      buildingId: `${c},${r}`,
    })
    if (!started) return
    this.hubFerryDay[airlineId] = day
    this.pushNews(`${this.airline(airlineId).name} ferried an aircraft in for a heavy check.`, 'good')
  }

  /**
   * One game day: staffing floor or the income share, then the 0.5% city levy.
   * Landside upkeep is already a daily total (legacy tick × 6).
   */
  private closeOperatingDay(completedDay: number) {
    this.settleHubLeaseWarnings(completedDay)
    this.settleTermShortfall(completedDay)
    this.fuelIndex = nextFuelIndex(this.fuelIndex)
    this.reviewAirlineRelations(completedDay)
    this.settleDeposits(completedDay)
    const premiumBill = this.billPremiumUpkeep()
    if (premiumBill > 0 && !this.sandbox) {
      this.pushNews(`Premium upkeep ${moneyLeft(premiumBill)} — idle lanes still bill.`, 'ok')
    }
    this.settleLateBuildings(completedDay)
    this.settleStaffHousing(completedDay)
    const income = this.dayOperatingIncome(completedDay)
    const phase = this.clock <= 600 ? 'early' : 'midgame'
    const minimum = this.payrollPreview()
    const rawBill = payrollForGameDay(income, phase, minimum)
    const bill = Number.isFinite(rawBill) && rawBill > 0 ? rawBill : 0
    const fees = this.landsideIncome()
    const relief = this.upkeepRelief()
    const scaled = (amount: number) => (amount > 0 ? Math.round(amount * relief) : 0)
    const upkeep = scaled(this.landsideUpkeep() + this.pillarUpkeepBill() + powerPlantOffer(this.powerPlantTier).upkeepPerDay)
    const stamp = (completedDay + 1) * SIM_MINUTES_PER_GAME_DAY - 1
    if (upkeep > 0) this.charge(upkeep, 'building_upkeep', stamp)
    const holding = this.site ? scaled(this.dailyHoldingQuote()) : 0
    if (holding > 0) this.charge(holding, 'land_holding', stamp)
    const hubBill = scaled(hubUpkeep(new Set(this.researchUnlocked)))
    if (hubBill > 0) this.charge(hubBill, 'building_upkeep', stamp)
    const builtBill = scaled(this.fits.reduce((s, f) => s + (f.build ? buildUpkeepPerDay(f.build) : 0), 0))
    if (builtBill > 0) this.charge(builtBill, 'building_upkeep', stamp)
    const linkBill = scaled(this.connectivityUpkeep())
    if (linkBill > 0) this.charge(linkBill, 'building_upkeep', stamp)
    // Walkway belts were booked in the ledger but never left cash; they now bill like every other link.
    const beltBill = this.walkwayCoverMetres() > 0
      ? scaled(
          (this.walkwayCoverMetres() / CONNECTIVITY_CATALOG.moving_walkway.lengthMetres) *
            CONNECTIVITY_CATALOG.moving_walkway.upkeepPerDay,
        )
      : 0
    if (beltBill > 0) this.charge(beltBill, 'building_upkeep', stamp)
    const loungeShare = this.hubLoungeShare()
    if (loungeShare > 0) this.earn(loungeShare, 'Airline lounge share', undefined, 'host_fees', false)
    this.ageLinks()
    const netLand = fees - upkeep
    const useRate = this.landsideUsageRate()
    this.landsideUses = Math.max(0, Math.floor(this.landsideUses * 0.45 ** 6))
    this.landsideFeeWindow = 0
    if (bill <= 0) {
      if (upkeep > 0 || fees > 0 || holding > 0) {
        this.pushNews(
          `Landside ${netLand >= 0 ? '+' : ''}${moneyLeft(netLand)} (pax fees ${moneyLeft(fees)} − expense ${moneyLeft(upkeep)} · fill ${Math.round(useRate * 100)}%)${
            holding ? ` · land holding ${moneyLeft(holding)}` : ''
          }.`,
          netLand >= 0 && holding === 0 ? 'ok' : 'bad',
        )
      }
      return
    }
    const settlement = settlePayroll(bill, this.cash)
    this.levyMark = this.clock
    if (!(settlement.shortfall > 0)) {
      if (settlement.paid > 0) {
        this.noteExpense(settlement.paid)
        this.cash -= settlement.paid
        this.postJournal('payroll', settlement.paid, stamp)
      }
      const levy = cityLevy(this.cash, this.sandbox)
      if (levy > 0) {
        this.noteExpense(levy)
        this.cash -= levy
        this.postJournal('city_levy', levy, stamp)
      }
      this.pushNews(
        `Ops payroll ${moneyLeft(bill)}${
          fees || upkeep
            ? ` · landside ${netLand >= 0 ? '+' : ''}${moneyLeft(netLand)} (fees − expense)`
            : ''
        }${holding ? ` · land holding ${moneyLeft(holding)}` : ''}${
          levy ? ` · city levy ${moneyLeft(levy)}` : ''
        } (day's income × staff floor).`,
        netLand < 0 && upkeep > 0 ? 'bad' : 'ok',
      )
      return
    }
    const paid = settlement.paid
    const shown = Math.round(paid)
    // Pay what cash covers. Debt stays debt: a short day never lifts negative cash back to $0.
    this.cash -= paid
    if (shown > 0) {
      this.noteExpense(paid)
      this.postJournal('payroll', paid, stamp)
    }
    this.postUnpaid('payroll', settlement.shortfall, stamp)
    this.reputation = Math.max(0, this.reputation - 4)
    const incidentsRising = this.securityIncidents > this.securityIncidentsAtPayroll
    const securityFloor = incidentsRising ? SECURITY_INCIDENT_SLIDER_FLOOR : PAYROLL_SHORT_SLIDER_FLOOR
    for (const key of ['maintenance', 'security'] as const) {
      const floor = key === 'security' ? securityFloor : PAYROLL_SHORT_SLIDER_FLOOR
      if (this.budgets[key] > floor) {
        this.budgets[key] = Math.max(floor, this.budgets[key] - PAYROLL_SHORT_SLIDER_STEP)
      }
    }
    if (incidentsRising && this.budgets.security <= securityFloor) {
      this.pushNews(
        `Security held at ${this.budgets.security}%. Incidents are still rising, so payroll will not cut the lane further.`,
        'bad',
      )
    }
    this.securityIncidentsAtPayroll = this.securityIncidents
    this.pushNews(
      shown > 0
        ? `Payroll short ${moneyLeft(settlement.shortfall)} — paid ${moneyLeft(shown)} of ${moneyLeft(bill)}. Sliders cut, reputation dips.`
        : `Payroll missed entirely (${moneyLeft(settlement.shortfall)} due). Crews walking. Reputation dips.`,
      'bad',
    )
  }

  private ensureEconomy(): EconomyAdapter {
    if (!this.economy) {
      this.economy = createEconomyAdapter(
        {
          getFieldLevel: () => this.hostedFieldLevel(),
          isAirportOperational: () => this.flightsDone > 0 || this.signed.length > 0,
          getAbsoluteDay: () => Math.floor(this.clock / 180),
          getStaffPools: () => ({
            maintenance_tech: { hired: this.mechanics, wagePerDay: 0 },
            researcher: { hired: this.researchers, wagePerDay: 0 },
            terminal_staff: { hired: this.deskStaff, wagePerDay: 0 },
            security_officer: { hired: this.premium.securityOfficers, wagePerDay: 0 },
          }),
          getStaffBuildings: () => premiumStaffBuildings(this.premium),
          getResearchRooms: () =>
            this.researchers > 0
              ? [{ id: 'field-lab', desks: this.researchers, powerDemand: 35, active: true }]
              : [],
          getPowerLoads: () => [],
          getChains: () => [],
          getTransitTier: () => (this.hasRailStation() ? 'rail' : this.hasBusCurb() ? 'bus' : 'road'),
          getHousingTier: () => this.staffHousing.economyTier(),
          getPowerPlantTier: () => this.powerPlantTier,
          saveEconomyState: (state) => {
            this.economyState = state
          },
          onEconomySnapshot: (snapshot) => {
            this.economyView = snapshot
          },
        },
        { initialState: this.economyState ?? undefined },
      )
      this.economy.engine.setCalendar(demandCalendar(this.mapId))
    }
    return this.economy
  }

  tickMaintenance(dt: number) {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (!strips.length) return
    const mx = this.budgetOf('maintenance') / 100
    const staff = this.mechanics
    // Traffic wears pavement; storms chew it faster.
    const liveJets = this.flights.filter(
      (f) => (f.craft ?? 'jet') === 'jet' && f.phase !== 'gone' && f.phase !== 'hold',
    ).length
    const wet = this.weather === 'storm' ? 0.55 : this.weather === 'rain' ? 0.25 : 0
    const wear = this.mapId === 'temperate' ? wet : wet * climateWear(this.mapId, this.gameDay())
    const decay = dt * (0.35 + liveJets * 0.25 + wear) * (1.4 - mx * 0.6)
    this.runwayCondition = clamp(this.runwayCondition - decay, 0, 100)

    // Funded mechanics repair.
    if (staff > 0 && mx > 0.05) {
      const repair =
        dt *
        (0.55 + staff * 0.45) *
        mx *
        (tilesOf(this.tiles, 'hangar').length ? 1.25 : 1) *
        (this.maintenanceContract ? LAND_PLOT.contractRepair : 1)
      this.runwayCondition = clamp(this.runwayCondition + repair, 0, 100)
    } else if (this.maintenanceContract && this.site) {
      this.runwayCondition = clamp(this.runwayCondition + dt * LAND_PLOT.contractRepairRate, 0, 100)
    } else if (mx < 0.2 && Math.random() < dt * 0.04) {
      this.pushNews('Pavement soft — rubber and cracks. Hire mechanics or fund maintenance.', 'bad')
    }

    // Cleaning budget slowly fights hall wear; starved cleaning grows it.
    const clean = this.budgetOf('cleaning') / 100
    for (const f of this.fits) {
      if (clean >= 0.7) {
        f.wearBath = Math.max(0, (f.wearBath ?? 0) - dt * 0.8)
        f.wearSec = Math.max(0, (f.wearSec ?? 0) - dt * 0.6)
      } else if (clean < 0.35) {
        f.wearBath = Math.min(100, (f.wearBath ?? 0) + dt * (0.9 - clean))
        f.wearSec = Math.min(100, (f.wearSec ?? 0) + dt * (0.7 - clean * 0.5))
      }
    }

    // Mechanic pawns wander when funded
    this.mechanicCool -= dt
    if (this.mechanicCool <= 0 && staff > 0 && mx >= 0.25) {
      this.mechanicCool = 14
      const live = this.people.filter((p) => p.job === 'mechanic').length
      if (live < staff) this.spawnMechanicPawn()
      for (const p of this.people) {
        if (p.job !== 'mechanic' || p.path.length > 1) continue
        const goals = [
          ...runwayStrips(this.tiles, MIN_RUNWAY).flat(),
          ...tilesOf(this.tiles, 'hangar'),
          ...tilesOf(this.tiles, 'stand'),
        ]
        if (!goals.length) continue
        const g = pick(goals)
        const path = astar(
          this.tiles,
          { c: Math.round(p.x), r: Math.round(p.y) },
          g,
          'mechanic',
        )
        if (path) {
          p.path = path
          p.seg = 0
          p.t = 0
        }
      }
    }
  }

  tickFireRisk(dt: number) {
    this.fireIncidentCool -= dt
    if (this.fireIncidentCool > 0) return
    this.fireIncidentCool = 50 + Math.random() * 40
    if (!tilesOf(this.tiles, 'fuel').length && !this.flights.length) return
    const firePct = this.budgetOf('fire') / 100
    const stations = tilesOf(this.tiles, 'fire').length
    const risk = clamp(0.22 - stations * 0.08 - firePct * 0.15, 0.02, 0.28)
    if (Math.random() > risk) return
    if (firePct >= 0.65 && stations > 0) {
      this.pushNews(`ARFF drilled a hot brake — scramble ${this.scrambleSec()}s, no damage.`, 'ok')
      return
    }
    const fine = Math.round(5000 + (1 - firePct) * 12000)
    this.charge(fine, 'penalties', this.simMinutes(), 'Apron fire')
    this.reputation = Math.max(0, this.reputation - (firePct < 0.3 ? 8 : 4))
    if (this.public) {
      this.sharePrice = Math.max(1.5, Math.round((this.sharePrice * (0.9 + firePct * 0.05)) * 100) / 100)
    }
    const scramble = this.scrambleSec()
    this.pushNews(
      firePct < 0.25
        ? `APRON FIRE — skeleton ARFF. Scramble ${scramble}s. Fine ${moneyLeft(fine)}. Fund fire crews.`
        : `Hot brake incident. Scramble ${scramble}s. Thin fire budget cost ${moneyLeft(fine)}.`,
      'bad',
    )
  }

  checkCrash(f: Flight, moment: 'landing' | 'takeoff') {
    if ((f.craft ?? 'jet') !== 'jet') return false
    if (f.phase === 'gone' || this.crashCool > 0) return false
    // One roll per flight per moment, not one per frame, so a stuck jet cannot crash by repetition.
    const rolled = (f.crashRolls ??= {})
    if (rolled[moment]) return false
    rolled[moment] = true
    const chance = this.crashChance() * (moment === 'landing' ? 1 : 0.85)
    if (Math.random() > chance) return false
    this.crashCool = 25
    this.crashFlight(f, moment)
    return true
  }

  crashFlight(f: Flight, moment: 'landing' | 'takeoff') {
    const amb = this.budgetOf('ambulance') / 100
    const fire = this.budgetOf('fire') / 100
    const baseFine = 18000 + Math.round((100 - this.runwayCondition) * 220)
    const mitigate = 0.45 + amb * 0.3 + fire * 0.25
    const fine = Math.min(CRASH_FINE_CAP, Math.round(baseFine * (1.4 - mitigate * 0.5)))
    this.charge(fine, 'crash_fine', this.simMinutes(), 'Crash write-off')
    this.noteRelationFine(f.airline)
    this.crashes += 1
    f.ledger.push({ label: `${f.flightNo} crash write-off`, amount: -fine })
    this.reputation = Math.max(0, this.reputation - (amb < 0.3 ? 14 : 8))
    this.runwayCondition = clamp(this.runwayCondition - 12, 0, 100)
    this.securityIncidents += 1
    if (this.mission?.goal === 'noIncident') this.mission.progress = 0
    f.phase = 'gone'
    this.noteCargoCancel(f)
    f.waitingOn.paxOut = 0
    f.waitingOn.paxIn = 0
    this.people = this.people.filter((p) => p.flightId !== f.id)
    this.hallGuests = this.hallGuests.filter((g) => g.flightId !== f.id)
    const weatherBit =
      this.weather === 'clear' ? '' : ` ${this.weatherLabel()} + soft pavement.`
    if (this.public) {
      this.shockStock(
        `CRASH on ${moment}${weatherBit} Runway ${Math.round(this.runwayCondition)}%. Fund maintenance and resurface the runway. The write-off is already on the crash line.`,
        amb < 0.35 ? 0.5 : 0.62,
        0,
      )
    } else {
      this.pushNews(
        `CRASH on ${moment}.${weatherBit} Fine ${moneyLeft(fine)}. Ambulances ${Math.round(amb * 100)}% · fire ${Math.round(fire * 100)}%. Fund maintenance and resurface the runway.`,
        'bad',
      )
    }
    if (amb < 0.2) {
      this.pushNews('No medics on call — city hospital bill piles on. Fund ambulances.', 'bad')
      this.charge(4000, 'penalties', this.simMinutes(), 'No medics')
    } else if (amb >= 0.8) {
      this.reputation = Math.min(100, this.reputation + 2)
      this.pushNews('Ambulance crews pulled survivors fast — softens the headline.', 'ok')
    }
  }

  selectedTerminalOrigin(): Vec | null {
    const t = this.selectedTile
    if (!t || this.tile(t) !== 'terminal') return null
    for (const d of [
      { c: 0, r: 0 },
      { c: -1, r: 0 },
      { c: 0, r: -1 },
      { c: -1, r: -1 },
      { c: -2, r: 0 },
      { c: 0, r: -2 },
      { c: -2, r: -1 },
      { c: -1, r: -2 },
    ]) {
      const o = { c: t.c + d.c, r: t.r + d.r }
      if (this.tile(o) === 'terminal') {
        const fit = this.fits.find((f) => f.origin.c === o.c && f.origin.r === o.r)
        if (fit) return o
      }
    }
    for (const f of this.fits) {
      if (Math.abs(f.origin.c - t.c) <= 2 && Math.abs(f.origin.r - t.r) <= 2) return f.origin
    }
    return t
  }

  /** Guard against StrictMode / double pointer listeners placing twice. */
  private lastPlaceAt = 0
  private lastPlaceKey = ''

  private fleetNow(): Record<string, number> {
    const fleet = operatingFleet(this.pillarField(), this.pillarState())
    const out: Record<string, number> = {}
    for (const [type, count] of Object.entries(fleet)) {
      if (typeof count === 'number' && count > 0) out[type] = count
    }
    return out
  }

  private crewOn(fleet: Record<string, number>, types: readonly string[]): number {
    return types.some((type) => (fleet[type] ?? 0) > 0) ? 1 : 0
  }

  private standOccupied(v: Vec): boolean {
    return this.flights.some((f) => f.phase !== 'gone' && f.stand?.c === v.c && f.stand?.r === v.r)
  }

  /** Name, upkeep, and which service-point plan a placed tile uses. */
  private buildingSpec(v: Vec): { name: string; upkeep: number; tier: SizeTier; plan: string } | null {
    const tile = this.tile(v)
    if (!tile || !isBuildingTile(tile)) return null
    const key = `${v.c},${v.r}`
    if (tile === 'stand') {
      const scale = this.standScale[key]
      const cls = this.standClass[key]
      const size = this.standSize[key]
      const rung = this.standRung[key]
      const tier: SizeTier = scale === 'wide' || scale === 'jumbo' ? scale : cls === 'L' ? 'jumbo' : 'small'
      const name =
        size === 'light' && rung === 0
          ? 'Light stand'
          : size === 'narrow' && rung === 0
            ? 'Narrow stand'
            : size === 'heavy' && rung === 0
              ? 'Heavy stand'
              : tier === 'jumbo'
                ? 'Jumbo stand'
                : tier === 'wide'
                  ? 'Widebody stand'
                  : cls === 'S'
                    ? 'Small stand'
                    : 'Medium stand'
      const pitBill = this.standPits[key] ? (progressionBuildable('hydrant')?.upkeepPerDay ?? 0) : 0
      const upkeep =
        (size && rung != null ? rungUpkeep(size, rung) : 0) + this.fittingUpkeepAt(hostKey('stand', v.c, v.r)) + pitBill
      return { name, upkeep, tier, plan: 'stand' }
    }
    if (tile === 'hangar') {
      const scale = this.hangarScale[key] ?? 'small'
      const tier: SizeTier = scale === 'jumbo' || scale === 'wide' ? scale : 'small'
      const tool = tier === 'jumbo' ? 'hangar_j' : tier === 'wide' ? 'hangar_w' : 'hangar'
      const row = BUILDINGS.find((b) => b.tool === tool)
      const upkeep = (row?.upkeepPerDay ?? 0) + this.fittingUpkeepAt(hostKey('hangar', v.c, v.r))
      return { name: row?.name ?? 'Hangar', upkeep, tier, plan: 'hangar' }
    }
    if (tile === 'hotel') {
      const cls = this.hotelClass[key] ?? 'business'
      const tool = cls === 'inn' ? 'hotel_inn' : cls === 'resort' ? 'hotel_resort' : 'hotel_biz'
      const row = BUILDINGS.find((b) => b.tool === tool)
      return { name: row?.name ?? 'Hotel', upkeep: row?.upkeepPerDay ?? 0, tier: 'small', plan: tile }
    }
    if (tile === 'park_s' || tile === 'park_l' || tile === 'park_g' || tile === 'park_u') {
      const term = this.parkTerms[key] ?? 'short'
      const row = BUILDINGS.find((b) => b.tile === tile)
      return { name: row?.name ?? 'Car park', upkeep: PARK_EXPENSE[tile][term], tier: 'small', plan: tile }
    }
    const late = this.lateSites.find((site) => site.c === v.c && site.r === v.r)
    if (late) {
      const spec = buildingById(late.id)
      return {
        name: spec?.name ?? late.id,
        upkeep: isOpen(late) ? (spec?.dailyUpkeep ?? 0) : 0,
        tier: 'small',
        plan: tile,
      }
    }
    if (tile === 'terminal') {
      const fit =
        this.fits.find((f) => Math.abs(f.origin.c - v.c) <= 2 && Math.abs(f.origin.r - v.r) <= 2) ?? null
      const upkeep = fit
        ? ceilingsFor({
            premade: fit.premade,
            redesigned: fit.redesigned,
            tier: fit.tier,
            items: (fit.items ?? []) as PlacedItem[],
            roomsSecurity: fit.rooms.security,
          }).upkeepDay
        : 0
      return { name: fit ? `${this.hallLabel(fit)} hall` : 'Terminal', upkeep, tier: 'small', plan: 'terminal' }
    }
    const row = BUILDINGS.find((b) => b.tile === tile)
    const link =
      tile === 'mover'
        ? CONNECTIVITY_CATALOG.people_mover
        : tile === 'xferbus'
          ? CONNECTIVITY_CATALOG.airside_transfer_bus_depot
          : tile === 'skywalk'
            ? CONNECTIVITY_CATALOG.skywalk
            : tile === 'travelator'
              ? CONNECTIVITY_CATALOG.moving_walkway
              : null
    const fittingBill = tile === 'fire' ? this.fittingUpkeepAt(hostKey('fire', v.c, v.r)) : 0
    return {
      name: row?.name ?? link?.name ?? tile,
      upkeep: (row?.upkeepPerDay || link?.upkeepPerDay || 0) + fittingBill,
      tier: 'small',
      plan: tile,
    }
  }

  private readingAt(v: Vec): Reading | null {
    const spec = this.buildingSpec(v)
    if (!spec) return null
    const tile = this.tile(v)
    const id = `${v.c},${v.r}`
    const fleet = this.fleetNow()
    const late = this.lateSites.find((site) => site.c === v.c && site.r === v.r)
    const base: Reading = {
      id,
      name: spec.name,
      plan: spec.plan,
      tier: spec.tier,
      fleet,
      upkeepPerDay: spec.upkeep,
      closed: Boolean(late && !isOpen(late)),
    }
    if (base.closed) return this.withQueue(base, 'none', 0)
    if (tile === 'mro') return this.attachVehicleQueue(this.mroReading(base))
    if (tile === 'nighthub') return this.attachVehicleQueue(this.nightHubReading(base))
    if (tile === 'stand') {
      const sections = [this.standUpgradeSection(v), this.standFittingSection(v)].filter(
        (section): section is CardSection => section != null,
      )
      return this.withQueue(
        {
          ...base,
          demand: this.standOccupied(v) ? 1 : 0,
          note: this.standFuelNote(v),
          sections: sections.length ? sections : undefined,
          staffAssigned: this.crewOn(fleet, [
            'pushback_tug',
            'heavy_tug',
            'fuel_truck',
            'heavy_fuel_truck',
            'baggage_tug',
            'belt_loader',
            'catering_truck',
          ]),
        },
        'vehicles',
        this.standQueue(id),
      )
    }
    if (tile === 'fuel') {
      const demand = this.flights.some((f) => f.phase !== 'gone' && f.waitingOn.fuel) ? 1 : 0
      return this.attachVehicleQueue({
        ...base,
        demand,
        note: this.fuelFarmNote(),
        staffAssigned: this.crewOn(fleet, ['fuel_truck', 'heavy_fuel_truck', 'hydrant_dispenser']),
      })
    }
    if (tile === 'kitchen') {
      const demand = this.flights.some((f) => f.phase !== 'gone' && f.waitingOn.catering) ? 1 : 0
      return this.attachVehicleQueue({
        ...base,
        demand,
        staffAssigned: this.crewOn(fleet, ['catering_truck', 'highlift_catering']),
      })
    }
    if (tile === 'bags' || tile === 'depot' || tile === 'cargo') {
      const demand = this.flights.some((f) => f.phase !== 'gone' && (f.waitingOn.bags || f.waitingOn.bagsLoad)) ? 1 : 0
      const types =
        tile === 'cargo'
          ? ['belt_loader', 'uld_loader', 'main_deck_loader']
          : tile === 'bags'
            ? ['baggage_tug', 'heavy_baggage_tug']
            : ['pushback_tug', 'heavy_tug', 'fuel_truck', 'belt_loader']
      return this.attachVehicleQueue({ ...base, demand, staffAssigned: this.crewOn(fleet, types) })
    }
    if (tile === 'hangar') {
      const section = this.hostFittingSection('hangar', v)
      return this.attachVehicleQueue({
        ...base,
        demand: this.hangarOccupant(v) ? 1 : 0,
        staffAssigned: this.mechanics,
        note: `Line MX ${this.hangarMxFor(v).toFixed(1)}s on this bay.`,
        sections: section ? [section] : undefined,
      })
    }
    if (tile === 'fire') {
      const section = this.hostFittingSection('fire', v)
      return this.attachVehicleQueue({
        ...base,
        note: `Scramble ${this.scrambleSec()}s. Drive time unchanged.`,
        sections: section ? [section] : undefined,
      })
    }
    if (tile === 'terminal') {
      const demand = this.hallGuests.some((g) => !g.dead) ? 1 : 0
      return this.attachVehicleQueue({ ...base, demand, staffAssigned: this.deskStaff })
    }
    return this.attachVehicleQueue(base)
  }

  /** Stand card: hydrant only when this stand has a pit and a dispenser exists. */
  private standFuelNote(v: Vec): string {
    const key = `${v.c},${v.r}`
    const fuel = !this.standPits[key]
      ? HYDRANT_CARD.bowser
      : (this.scaleFleet.hydrant_dispenser ?? 0) > 0
        ? HYDRANT_CARD.hydrant
        : HYDRANT_CARD.short
    const extra: string[] = []
    if (this.isNight() && !this.hasFitting(v, 'apron_light')) extra.push('Unlit')
    if (this.weather !== 'clear' && !this.hasFitting(v, 'gpu_pca')) extra.push('Weather dwell')
    if (this.hasFitting(v, 'gpu_pca') && !this.cableLive(v)) extra.push('Plant is short. A GPU truck is coming.')
    return extra.length ? `${fuel} · ${extra.join(' · ')}` : fuel
  }

  /** One line on the farm card: litres, who supplies them, and the band. */
  private fuelFarmNote(): string {
    const litres = Math.round(this.tankLitres).toLocaleString('en-US')
    const contract = contractById(this.contractId)
    if (contract) {
      const band = termBandLitres(contract.id)
      const drawn = Math.round(this.termUpliftLitres).toLocaleString('en-US')
      return `${litres} L · ${contract.name} · $${this.termUnitPrice(contract.id).toFixed(3)}/L · band ${drawn}/${band.toLocaleString('en-US')}`
    }
    if (this.spotInbound) return `${litres} L · Spot · Apex rack tanker on the road`
    return `${litres} L · Spot · ${SPOT_OFFER.supplier} $${SPOT_OFFER.perLitre.toFixed(3)}/L`
  }

  /** People or vehicles waiting on this building. A missing line stays at zero. */
  private withQueue(reading: Reading, queueKind: 'passengers' | 'vehicles' | 'none', queueLength: number): Reading {
    return { ...reading, queueKind, queueLength: Math.max(0, Math.floor(queueLength)) }
  }

  private standQueue(id: string): number {
    return this.bayView().stands.find((stand) => stand.id === id)?.queued ?? 0
  }

  private dockQueue(ownerId: string): number {
    const docks = this.ground?.sim.dockReport() ?? []
    let queued = 0
    for (const row of docks) {
      if (row.ownerId === ownerId) queued += Math.max(0, row.queued)
    }
    return queued
  }

  /** Vehicle bay-queue when logistics has a dock for this tile. Otherwise there is no line. */
  private attachVehicleQueue(reading: Reading): Reading {
    if (reading.queueKind) return reading
    const docks = this.ground?.sim.dockReport() ?? []
    const listed = docks.some((row) => row.ownerId === reading.id)
    if (!listed) return this.withQueue(reading, 'none', 0)
    return this.withQueue(reading, 'vehicles', this.dockQueue(reading.id))
  }

  private mroReading(base: Reading): Reading {
    const snap = this.tier3.snapshot()
    const blocked =
      snap.mro.techsAssigned <= 0 ? 'no techs' : snap.mro.powerCapacity < snap.mro.powerDemand ? 'no power' : ''
    const icon = blocked === 'no techs' ? 'techs' : blocked === 'no power' ? 'power' : undefined
    const bays: BayInput[] = MRO_BAYS.map((bay) => {
      const job = snap.mro.jobs.find((row) => row.bayId === bay.id)
      const inBay = job?.phase === 'in_bay'
      return {
        label: bay.id,
        inUse: Boolean(inBay) && !blocked,
        limit: blocked || undefined,
        icon,
        badge: icon,
      }
    })
    return {
      ...base,
      staffAssigned: snap.mro.techsAssigned,
      staffNeeded: Math.max(MRO_TECHS_REQUIRED, snap.mro.techsRequired),
      bays,
      demand: snap.mro.occupied > 0 ? 1 : 0,
    }
  }

  private nightHubReading(base: Reading): Reading {
    const hub = this.tier3.snapshot().nightHub
    const short = hub.groundCrewAssigned < hub.groundCrewRequired
    const bays: BayInput[] = NIGHT_BANK_SLOTS.map((slot, i) => ({
      label: slot.id,
      inUse: !short && i < hub.flights,
      limit: short ? 'short of ground crew' : undefined,
      icon: short ? 'staff' : undefined,
      badge: short ? 'crew' : undefined,
    }))
    return {
      ...base,
      staffAssigned: hub.groundCrewAssigned,
      staffNeeded: hub.groundCrewRequired,
      bays,
      demand: hub.flights > 0 ? 1 : 0,
    }
  }

  private facilityReading(id: string): Reading | null {
    if (id === 'checkin' || id === 'security') return this.queueReading(id, id === 'checkin' ? 'Check-in' : 'Security')
    if (id.startsWith('item:')) {
      const fit = this.activeHall()
      const item = (fit?.items ?? []).find((it) => it.id === id.slice(5))
      if (!item) return null
      const def = itemDef(item.def)
      if (def?.room === 'checkin' || def?.room === 'bagdrop' || def?.room === 'security') {
        const node = def.room === 'security' ? 'security' : 'checkin'
        return this.queueReading(node, def.name)
      }
      return {
        id,
        name: def?.name ?? 'Facility',
        plan: 'checkin',
        upkeepPerDay: def?.upkeep ?? 0,
        staffNeeded: def?.staff ?? 0,
        staffAssigned: def?.staff ? this.hallStaff.filter((s) => s.node === def.room && onPostNow(s.stage)).length : null,
        demand: 0,
        bays: [{ inUse: false }],
        unit: '/ min',
      }
    }
    const info = this.facilityInfo(id)
    if (!info) return null
    return {
      id,
      name: info.title,
      upkeepPerDay: 0,
      demand: 0,
      bays: [{ inUse: false }],
    }
  }

  private queueReading(node: 'checkin' | 'security', name: string): Reading {
    const kind = node === 'checkin' ? 'checkin_desk' : 'security_lane'
    const metrics = this.hallNav.live ? this.hallNav.metrics().filter((m) => m.kind === kind) : []
    const hired = this.hallStaff.filter((s) => s.node === node && onPostNow(s.stage)).length
    if (!metrics.length) {
      const waiting = node === 'security' ? this.securityQueueCount() : queueAtNode(this.hallGuests, node)
      const alloc = node === 'checkin' && this.hallNav.live ? this.checkinAllocation() : null
      return {
        id: node,
        name,
        plan: node,
        upkeepPerDay: 0,
        staffAssigned: hired,
        staffNeeded: Math.max(1, hired),
        demand: waiting > 0 ? 1 : 0,
        queueLength: waiting,
        queueKind: 'passengers',
        bays: [
          {
            inUse: false,
            limit: waiting > 0 && hired <= 0 ? 'unstaffed' : undefined,
            icon: waiting > 0 && hired <= 0 ? 'staff' : undefined,
            badge: 'staff',
          },
        ],
        note: this.hallNav.live ? undefined : WALK_PAUSED_LINE,
        alert: alloc?.reason ?? undefined,
        actions: alloc ? this.checkinActions(alloc) : undefined,
      }
    }
    const scale = HALL_NAV_TUNING.navSecPerClockSec
    const limit = (HALL_QUEUE_TUNING.bottleneckSec[kind] ?? 600) / scale
    const loads: PointLoad[] = metrics.map((m) => ({
      id: m.id,
      kind: m.kind,
      staffed: m.staffed,
      queueLength: m.queueLength,
      serving: m.serving,
      serviceSec: m.serviceSec / scale,
      estWaitSec: m.estWaitSec / scale,
    }))
    const throughput = throughputOf(loads, limit)
    const alloc = node === 'checkin' ? this.checkinAllocation() : null
    const bays: BayInput[] = loads.map((point) => {
      const busy = point.staffed && (point.serving || point.queueLength > 0)
      const label = alloc ? this.checkinBayLabel(alloc, point.id) : undefined
      return {
        label,
        inUse: busy,
        limit: point.staffed ? undefined : CLOSED_NO_STAFF_LINE,
        icon: point.staffed ? undefined : 'staff',
        badge: 'staff',
      }
    })
    return {
      id: node,
      name,
      plan: node,
      upkeepPerDay: 0,
      staffAssigned: throughput.staffed,
      staffNeeded: throughput.points,
      demand: throughput.inUse > 0 || throughput.queueLength > 0 ? 1 : 0,
      throughputPerMin: throughput.perMin,
      unit: 'pax/min',
      queueLength: throughput.queueLength,
      queueKind: 'passengers',
      bays,
      alert: alloc?.reason ?? undefined,
      actions: alloc ? this.checkinActions(alloc) : undefined,
    }
  }

  /** Sink one pit on the stand under the cursor. Research and field level still gate it. */
  stampHydrantPit(v: Vec) {
    const row = progressionBuildable('hydrant')
    const name = row?.name ?? 'Hydrant pit'
    if (this.tile(v) !== 'stand') {
      this.pushNews('A hydrant pit goes on a stand.', 'bad')
      this.emit()
      return
    }
    const key = `${v.c},${v.r}`
    if (this.standPits[key]) {
      this.pushNews('This stand already has a pit.', 'ok')
      this.emit()
      return
    }
    const need = unlockLevel('hydrant')
    if (this.fieldLevel() < need) {
      this.pushNews(`${name} needs Field level ${need}.`, 'bad')
      this.emit()
      return
    }
    if (!this.hasResearch('hydrant_fuel')) {
      this.hydrantArm = false
      this.pushNews('Research the hydrant system. Then stamp the pit on a stand.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(row?.cost ?? 0, name)) return
    this.standPits[key] = true
    this.bumpMap()
    this.ensureGround()
    const upkeep = (row?.upkeepPerDay ?? 0).toLocaleString('en-US')
    this.pushNews(`${name} open. Upkeep $${upkeep}/day.`, 'good')
    this.emit()
  }

  clickTile(v: Vec) {
    if (!inBounds(v.c, v.r)) return
    if (this.hydrantArm) {
      this.stampHydrantPit(v)
      return
    }
    this.selectedTile = v
    this.selectedFlight = this.nearestFlight(v)?.id ?? this.selectedFlight

    if (this.tool === 'pan') {
      const tile = this.tile(v)
      this.selectedBuilding = tile && isBuildingTile(tile) ? `${v.c},${v.r}` : null
      const late = this.lateSites.find((site) => site.c === v.c && site.r === v.r)
      if (late) {
        this.toggleInfo(`late-site:${v.c},${v.r}`)
        return
      }
      if (tile === 'fuel') this.openFuelFarm()
      else if (tile === 'bags') this.toggleInfo('bags')
      if (
        tile === 'road' ||
        tile === 'bus' ||
        tile === 'curb_lane' ||
        tile === 'taxi_rank' ||
        tile === 'rail' ||
        tile === 'park_s' ||
        tile === 'park_l' ||
        tile === 'park_g' ||
        tile === 'park_u'
      ) {
        this.openLandside(v)
      }
      if (tile === 'terminal') {
        this.enterHallAt(v)
        return
      }
      const f = this.nearestFlight(v)
      if (f) this.selectedFlight = f.id
      this.emit()
      return
    }
    // One click → one stamp (dedupe duplicate pointer listeners / StrictMode).
    const placeKey = `${this.tool}:${v.c},${v.r}`
    const now = performance.now()
    if (placeKey === this.lastPlaceKey && now - this.lastPlaceAt < 120) return
    this.lastPlaceKey = placeKey
    this.lastPlaceAt = now

    if (this.tool === 'clear') {
      this.clearTile(v)
      return
    }
    if (this.tool === 'runway_short') {
      this.placeRunway(v, 'short')
      return
    }
    if (this.tool === 'runway') {
      this.placeRunway(v, 'regional')
      return
    }
    if (this.tool === 'runway_heavy') {
      this.placeRunway(v, 'heavy')
      return
    }
    if (this.tool === 'terminal') {
      this.placeTerminal(v)
      return
    }
    if (this.tool === 'premade') {
      this.placePremade(v)
      return
    }
    if (lateIdForTool(this.tool)) {
      this.placeLate(v)
      return
    }
    this.placeSingle(v)
  }

  setHover(v: Vec | null) {
    this.hover = v
    if (!v || !this.inspectEnabled()) {
      this.hoverInspect = null
      return
    }
    this.hoverInspect = this.inspectAt(v)
  }

  inspectAt(v: Vec): ApronInspect | null {
    const flight = this.nearestFlight(v, 2.2)
    if (flight) return this.inspectFlight(flight)
    const tile = this.tile(v)
    if (tile === 'road' || tile === 'bus' || tile === 'curb_lane' || tile === 'taxi_rank') return this.inspectCurb(tile)
    if (tile === 'hangar') return this.inspectHangar(v)
    // Nearby hangar tile (footprint feel).
    for (const d of [
      { c: 0, r: 0 },
      { c: 1, r: 0 },
      { c: 0, r: 1 },
      { c: -1, r: 0 },
      { c: 0, r: -1 },
    ]) {
      const p = { c: v.c + d.c, r: v.r + d.r }
      if (inBounds(p.c, p.r) && this.tile(p) === 'hangar') return this.inspectHangar(p)
    }
    return null
  }

  inspectCurb(tile: Tile): ApronInspect {
    const view = this.landsideView()
    const title =
      tile === 'bus' ? 'Bus bay' : tile === 'curb_lane' ? 'Curb lane' : tile === 'taxi_rank' ? 'Taxi rank' : 'Curb'
    const added =
      tile === 'bus'
        ? LANDSIDE.stallsPerBusBay
        : tile === 'curb_lane'
          ? LANDSIDE.stallsPerCurbLane
          : tile === 'taxi_rank'
            ? LANDSIDE.stallsPerTaxiRank
            : 0
    const busy = Number.isFinite(view.curbBusy) ? view.curbBusy : 0
    return {
      kind: 'curb',
      title,
      loadLabel: `${busy.toFixed(1)} / ${view.curbStalls}`,
      pressure: view.pressure,
      blurb:
        added > 0
          ? `Adds ${added} curb stalls. Load is vehicles at the curb against the stalls.`
          : `Load is vehicles at the curb against ${view.curbStalls} stalls.`,
    }
  }

  inspectFlight(f: Flight): ApronInspect {
    const a = this.airline(f.airline)
    const { fuel, catering } = this.serviceBars(f)
    return {
      kind: 'flight',
      flightId: f.id,
      callsign: f.flightNo,
      airline: f.ga ? 'Independent GA' : a.name,
      model: f.airframeName || this.aircraftLabel(f.kind),
      destination: f.destination || '—',
      activity: this.flightActivity(f),
      next: this.flightNext(f),
      fuel,
      catering,
      gate: f.stand ? this.gateLabel(f.stand) : '—',
      mx: f.mxPending
        ? 'Hangar MX booked'
        : f.phase === 'mx_bay' || f.phase === 'mx_taxi' || f.phase === 'mx_return'
          ? 'In hangar MX loop'
          : f.posted.mx
            ? 'Line maintenance done'
            : undefined,
    }
  }

  inspectHangar(h: Vec): ApronInspect {
    const occ = this.hangarOccupant(h)
    if (!occ) {
      return {
        kind: 'hangar',
        title: 'Hangar bay',
        occupant: 'Empty',
        model: '—',
        remaining: 0,
        total: 0,
        blurb: this.mechanics
          ? `${this.mechanics} mechanic${this.mechanics === 1 ? '' : 's'} on staff · waiting for MX traffic`
          : 'No mechanics hired — MX contracts will skip.',
      }
    }
    const left = Math.max(0, (occ.mxEndsAt ?? this.clock) - this.clock)
    const total = Math.max(1, occ.mxDuration ?? this.hangarMxFor(occ.hangarBay))
    return {
      kind: 'hangar',
      title: 'Hangar bay',
      occupant: occ.flightNo,
      model: occ.airframeName || this.aircraftLabel(occ.kind),
      remaining: left,
      total,
      blurb:
        occ.phase === 'mx_bay'
          ? `Line maintenance in progress · ${Math.ceil(left)}s left`
          : occ.phase === 'mx_taxi'
            ? 'Taxiing in for maintenance'
            : occ.phase === 'mx_return'
              ? 'Wrapping up — returning to stand'
              : this.flightActivity(occ),
    }
  }

  hangarOccupant(h: Vec): Flight | null {
    for (const f of this.flights) {
      if (!f.hangarBay) continue
      if (f.hangarBay.c !== h.c || f.hangarBay.r !== h.r) continue
      if (f.phase === 'mx_taxi' || f.phase === 'mx_bay' || f.phase === 'mx_return') return f
    }
    return null
  }

  freeHangarBay(need: SizeTier = 'small'): Vec | null {
    const hangars = tilesOf(this.tiles, 'hangar')
    for (const h of hangars) {
      const rating = this.hangarScale[`${h.c},${h.r}`] ?? 'small'
      if (rating === 'small' && need !== 'small') continue
      if (rating === 'wide' && need === 'jumbo') continue
      if (!this.hangarOccupant(h)) return h
    }
    return null
  }

  serviceBars(f: Flight): { fuel: number; catering: number } {
    let fuel = f.fuelLevel ?? 0.4
    if (f.posted.fuel) fuel = 1
    else if (f.waitingOn.fuel) fuel = Math.max(fuel, Math.min(0.92, 0.35 + f.phaseTime * 0.04))

    let catering = f.caterLevel ?? 0.25
    if (f.cargo || f.kind === 'military' || f.craft === 'helo') catering = 1
    else if (f.posted.catering) catering = 1
    else if (f.waitingOn.catering) catering = Math.max(catering, Math.min(0.92, 0.2 + f.phaseTime * 0.05))

    return {
      fuel: Math.round(clamp(fuel, 0, 1) * 100),
      catering: Math.round(clamp(catering, 0, 1) * 100),
    }
  }

  flightActivity(f: Flight): string {
    const gate = f.stand ? this.gateLabel(f.stand) : 'gate'
    const hangar = f.hangarBay ? `hangar ${f.hangarBay.c},${f.hangarBay.r}` : 'hangar'
    const mroJob = this.tier3.activeJobs().find((job) => job.aircraftId === f.id)
    if (mroJob) {
      if (mroJob.phase === 'taxi_in') return `Taxiing to MRO bay ${mroJob.bayId}`
      if (mroJob.phase === 'in_bay') return `In MRO bay ${mroJob.bayId}`
      return `Taxiing back from MRO bay ${mroJob.bayId}`
    }
    const atcHold = this.atcHoldLabel(f)
    if (atcHold) return atcHold
    switch (f.phase) {
      case 'hold':
        return f.goArounds ? `Holding after go-around ${f.goArounds}/${ATC_MAX_GO_AROUNDS}` : 'Holding for a gate'
      case 'approach':
        return `On approach → ${gate}${f.claimLane ? ` · claim ${f.claimLane}` : ''}`
      case 'landing':
        return `Landing → taxi to ${gate}`
      case 'taxi_in':
        return `Taxiing in to ${gate}`
      case 'deboard': {
        if (f.cargo) return 'Unloading freight'
        const bag = this.bagStageLabel(f)
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const base =
          mode === 'jetway'
            ? 'Deplaning via jetway (no apron walk)'
            : mode === 'bus'
              ? 'Deplaning — terminal bus ferry'
              : 'Deplaning — walking the apron'
        return bag ? `${base} · ${bag}` : base
      }
      case 'servicing': {
        const bag = this.bagStageLabel(f)
        return bag
          ? `Turnaround · ${bag}`
          : 'Turnaround on stand (fuel / bags / catering)'
      }
      case 'mx_taxi':
        return `Taxiing to ${hangar} for maintenance`
      case 'mx_bay':
        return `In hangar — MX · ${Math.ceil(Math.max(0, (f.mxEndsAt ?? this.clock) - this.clock))}s left`
      case 'mx_return':
        return `Leaving hangar → back to ${gate}`
      case 'board': {
        if (f.cargo) return 'Loading freight'
        const bag = this.bagStageLabel(f)
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const base =
          mode === 'jetway'
            ? 'Boarding via jetway'
            : mode === 'bus'
              ? 'Boarding — waiting on terminal bus'
              : 'Boarding — pax walking from hall'
        return bag ? `${base} · ${bag}` : base
      }
      case 'pushback':
        return 'Pushback from stand'
      case 'parked':
        return f.parkLeaveRequestedAt ? 'Parked — leave window open' : 'Parked at stand'
      case 'taxi_out':
        return 'Taxiing out to the strip'
      case 'takeoff':
        return f.destination ? `Departing to ${f.destination}` : 'Departing'
      default:
        return f.phase
    }
  }

  flightNext(f: Flight): string {
    switch (f.phase) {
      case 'hold':
        return 'Next: approach when a stand opens'
      case 'approach':
        return 'Next: landing · taxi to stand'
      case 'landing':
      case 'taxi_in':
        return 'Next: deplane · turnaround'
      case 'deboard':
        return 'Next: fuel / bags / catering on stand'
      case 'servicing':
        if (f.mxPending && !f.posted.mx) return 'Next: taxi to hangar for line MX'
        if (f.ga) return 'Next: park / leave window'
        if (f.cargo || f.kind === 'military' || f.kind === 'air_ambulance')
          return 'Next: pushback · departure'
        return 'Next: board · pushback'
      case 'mx_taxi':
        return 'Next: hangar bay maintenance'
      case 'mx_bay':
        return `Next: return to ${f.stand ? this.gateLabel(f.stand) : 'stand'} · board`
      case 'mx_return':
        return 'Next: board passengers'
      case 'board':
        return f.destination ? `Next: pushback · depart to ${f.destination}` : 'Next: pushback · depart'
      case 'pushback':
        return 'Next: taxi to runway'
      case 'parked':
        return 'Next: release / taxi out'
      case 'taxi_out':
        return f.destination ? `Next: takeoff to ${f.destination}` : 'Next: takeoff'
      case 'takeoff':
        return f.destination ? `En route to ${f.destination}` : 'Airborne'
      default:
        return '—'
    }
  }

  /** Duration of hangar bay MX — more mechanics = faster. */
  hangarMxDuration(): number {
    return Math.max(8, 20 - this.mechanics * 2.2)
  }

  startHangarMx(f: Flight): boolean {
    if (!f.stand || f.posted.mx || f.phase === 'mx_taxi' || f.phase === 'mx_bay') return false
    const bay = this.freeHangarBay(sizeTierOf(f.airframeId))
    if (!bay) return false
    const path = nearestPath(this.tiles, f.stand, [bay], 'jet')
    if (!path || path.length < 2) {
      // Pavement gap — fall back to mechanic walk to the stand.
      if (f.mxPay) this.dispatchLineMx(f, f.mxPay)
      f.mxPending = false
      return false
    }
    f.hangarBay = bay
    f.path = path
    f.seg = 0
    f.t = 0
    f.phase = 'mx_taxi'
    f.phaseTime = 0
    f.waitingOn.mx = true
    f.mxPending = false
    this.pushNews(`${f.flightNo} taxiing to hangar for line MX.`, 'ok')
    return true
  }

  nearestFlight(v: Vec, maxDist = 1.8): Flight | undefined {
    let best: Flight | undefined
    let dist = maxDist
    for (const f of this.flights) {
      if (f.phase === 'gone') continue
      const d = Math.hypot(f.x - v.c, f.y - v.r)
      if (d < dist) {
        dist = d
        best = f
      }
    }
    return best
  }

  refundFor(tile: Tile, at?: Vec): number {
    if (tile === 'grass') return 0
    if (tile === 'runway') {
      // Blend regional + heavy unit cost so bulldozing either class is fair-ish.
      const unit =
        (RUNWAY_PREFAB_COST / (RUNWAY_PREFAB_LEN * RUNWAY_PREFAB_WID) +
          HEAVY_RUNWAY_COST / (HEAVY_RUNWAY_LEN * HEAVY_RUNWAY_WID)) /
        2
      return Math.round(unit * BULLDOZE_REFUND)
    }
    if (tile === 'terminal') return Math.round(TERMINAL_COST * BULLDOZE_REFUND * 0.25)
    if (tile === 'hangar' && at) {
      const scale = this.hangarScale[`${at.c},${at.r}`] ?? 'small'
      return Math.round(HANGAR_OFFERS[scale].cost * BULLDOZE_REFUND)
    }
    if (tile === 'stand' && at) {
      const scale = this.standScale[`${at.c},${at.r}`]
      const pit = this.standPits[`${at.c},${at.r}`] ? (progressionBuildable('hydrant')?.cost ?? 0) : 0
      const base =
        scale === 'wide'
          ? STAND_OFFERS.wide.cost
          : scale === 'jumbo'
            ? STAND_OFFERS.jumbo.cost
            : (BUILDINGS.find((x) => x.tile === tile)?.cost ?? 0)
      if (scale === 'wide' || scale === 'jumbo' || pit > 0) return Math.round((base + pit) * BULLDOZE_REFUND)
    }
    if (tile === 'hotel' && at) {
      const cls = this.hotelClass[`${at.c},${at.r}`] ?? 'business'
      const tool =
        cls === 'inn' ? 'hotel_inn' : cls === 'resort' ? 'hotel_resort' : 'hotel_biz'
      const b = BUILDINGS.find((x) => x.tool === tool)
      return b ? Math.round(b.cost * BULLDOZE_REFUND) : 0
    }
    const b = BUILDINGS.find((x) => x.tile === tile)
    return b ? Math.round(b.cost * BULLDOZE_REFUND) : 0
  }

  occupiedByOps(v: Vec): boolean {
    return this.flights.some(
      (f) =>
        f.stand &&
        f.stand.c === v.c &&
        f.stand.r === v.r &&
        f.phase !== 'gone' &&
        f.phase !== 'hold' &&
        f.phase !== 'approach',
    )
  }

  siteAt(v: Vec): BuildSite | undefined {
    return this.sites.find((s) => s.cells.some((c) => c.c === v.c && c.r === v.r))
  }

  cellsBlocked(cells: Vec[]): boolean {
    return cells.some((p) => this.siteAt(p))
  }

  enqueueBuild(site: Omit<BuildSite, 'id' | 'elapsed' | 'duration' | 'warned' | 'vanArrived' | 'delivered' | 'crewSpawned'> & Partial<BuildSite>) {
    const full: BuildSite = {
      id: uid('site'),
      elapsed: 0,
      duration: buildSeconds(site.cells.length),
      warned: false,
      vanArrived: false,
      delivered: false,
      crewSpawned: false,
      ...site,
      cells: site.cells.map((c) => ({ ...c })),
    }
    this.sites.push(full)
    this.pushNews(
      `${full.name} is a construction site — a contractor is driving in. About ${Math.round(full.duration)}s.`,
      'ok',
    )
    this.emit()
  }

  cancelSite(id: string) {
    const site = this.sites.find((s) => s.id === id)
    if (!site) return
    const refund = Math.round(site.cost * BULLDOZE_REFUND)
    this.credit(refund, 'refunds', site.name)
    this.sites = this.sites.filter((s) => s.id !== id)
    this.trucks = this.trucks.filter((t) => t.flightId !== id)
    this.pushNews(`Construction cancelled — refunded $${refund.toLocaleString('en-US')}.`, 'ok')
    this.emit()
  }

  buildApproach(site: BuildSite): Vec | null {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    for (const cell of site.cells) {
      for (const [dc, dr] of dirs) {
        const p = { c: cell.c + dc, r: cell.r + dr }
        if (!inBounds(p.c, p.r)) continue
        if (site.cells.some((c) => c.c === p.c && c.r === p.r)) continue
        const tile = this.tile(p)
        if (tile && walkableFor('truck', tile)) return p
      }
    }
    return null
  }

  ensureBuildCrew(site: BuildSite) {
    if (site.crewSpawned) return
    site.crewSpawned = true
    const edges = this.cityEdgeRoads()
    const approach = this.buildApproach(site)
    if (!edges.length || !approach) return
    const edge = edges[0]
    const guard = tilesOf(this.tiles, 'guard')[0]
    const off = {
      c: edge.c === 0 ? -2 : edge.c === SIZE - 1 ? SIZE + 1 : edge.c,
      r: edge.r === 0 ? -2 : edge.r === SIZE - 1 ? SIZE + 1 : edge.r,
    }
    let path: Vec[] | null = null
    if (guard) {
      const toGuard = nearestPath(this.tiles, edge, [guard], 'truck')
      const toSite = nearestPath(this.tiles, guard, [approach], 'truck')
      if (toGuard && toSite && toGuard.length > 1 && toSite.length > 1) {
        path = [off, ...toGuard, ...toSite.slice(1)]
      }
    }
    if (!path) {
      const direct = nearestPath(this.tiles, edge, [approach], 'truck')
      if (direct && direct.length > 1) path = [off, ...direct]
    }
    if (!path) return
    const roll = (kind: 'contractor' | 'delivery', wait: number) => {
      this.trucks.push({
        id: uid(kind),
        kind,
        flightId: site.id,
        x: off.c,
        y: off.r,
        path: path!.map((p) => ({ ...p })),
        seg: 0,
        t: 0,
        returning: false,
        dwell: 0,
        preDwell: wait,
        patrol: false,
        mission: guard ? 'build_guard' : 'build_site',
        home: approach,
        cargoUnits: kind === 'delivery' ? 8 : 0,
      })
    }
    roll('contractor', 0)
    roll('delivery', 1.4)
  }

  tickBuildTruck(t: Truck, step: number) {
    if (t.preDwell > 0) {
      t.preDwell -= step
      return
    }
    if (t.dwell > 0) {
      t.dwell -= step
      if (t.dwell > 0) return
      const site = this.sites.find((s) => s.id === t.flightId)
      if (t.mission === 'build_guard') {
        t.mission = 'build_site'
        if (t.home) {
          const from = { c: Math.round(t.x), r: Math.round(t.y) }
          const next = nearestPath(this.tiles, from, [t.home], 'truck')
          if (next && next.length > 1) {
            t.path = next
            t.seg = 0
            t.t = 0
            return
          }
        }
      }
      if (t.mission === 'build_site') {
        if (site) {
          if (t.kind === 'contractor') site.vanArrived = true
          if (t.kind === 'delivery') site.delivered = true
        }
        t.mission = 'build_out'
        t.returning = true
        t.path = [...t.path].reverse()
        t.seg = 0
        t.t = 0
        return
      }
      t.dwell = -99
      return
    }
    const arrived = this.followPath(t, t.kind === 'contractor' ? 2.4 : 2, step)
    if (!arrived) return
    if (t.mission === 'build_out') {
      t.dwell = -99
      return
    }
    t.dwell = t.mission === 'build_guard' ? 0.7 : t.kind === 'delivery' ? 1.5 : 1.1
  }

  tickConstruction(step: number) {
    for (const site of this.sites) {
      site.elapsed += step
      this.ensureBuildCrew(site)
      if (site.elapsed > site.duration * 0.25 && !site.vanArrived && !site.warned) {
        site.warned = true
        site.duration += 1.5
        this.pushNews(
          `${site.name} — contractor still on the road. The build slips a moment and keeps going.`,
          'ok',
        )
      }
      if (site.elapsed >= site.duration) this.finishSite(site)
    }
    this.sites = this.sites.filter((s) => s.elapsed < s.duration)
  }

  finishSite(site: BuildSite) {
    if (site.kind === 'single') {
      const v = site.cells[0]
      if (!v) return
      this.tiles[v.r][v.c] = site.tile
      const key = `${v.c},${v.r}`
      if (site.parkTerm) this.parkTerms[key] = site.parkTerm
      if (site.hotelClass) this.hotelClass[key] = site.hotelClass
      if (site.standClass) this.standClass[key] = site.standClass
      if (site.standAccess) this.standAccess[key] = site.standAccess
      if (site.standScale) this.standScale[key] = site.standScale
      if (site.tile === 'stand') {
        this.recordStand(key, {
          cls: site.standClass,
          scale: site.standScale,
          access: site.standAccess,
          tool: site.tool,
          size: site.standSize,
          rung: site.standRung,
        })
      }
      if (site.hangarScale) this.hangarScale[key] = site.hangarScale
      if (site.tool === 'people_mover') this.hubLinksBuilt[key] = 'people_mover'
      else if (site.tool === 'xfer_bus') this.hubLinksBuilt[key] = 'xferbus'
      else if (site.tool === 'hub_skywalk') this.hubLinksBuilt[key] = 'skywalk'
      this.pushNews(site.news ?? `${site.name} open.`, 'good')
    } else if (site.kind === 'runway') {
      for (const p of site.cells) this.tiles[p.r][p.c] = 'runway'
      this.pushNews(site.news ?? `${site.name} open.`, 'good')
    } else if (site.kind === 'terminal' || site.kind === 'premade') {
      const origin = site.origin ?? site.cells[0]
      for (const p of site.cells) this.tiles[p.r][p.c] = 'terminal'
      if (site.kind === 'premade') {
        this.fits.push(
          emptyFit(origin, true, {
            checkin: 2,
            security: 2,
            gate: 2,
            bagclaim: 1,
            food: 1,
            souvenir: 1,
            bagdrop: 1,
            lounge: 1,
            bathroom: 2,
          }),
        )
      } else {
        this.fits.push(emptyFit(origin, false))
      }
      this.selectedTile = origin
      const n = this.fits.length
      const label = this.hallLabel(this.fits[n - 1])
      this.pushNews(
        site.kind === 'premade'
          ? n >= 2
            ? `${label} premade online — multi-terminal campus.`
            : 'Premade terminal online — check-in, security, gates, claim, food.'
          : n >= 2
            ? `${label} shell up — campus now ${n} halls.`
            : 'Empty shell up. Furnish security or airlines will stay away.',
        'good',
      )
    }
    if (site.kind === 'single' && site.tile === 'helipad') this.ensureHeloBank()
    this.bumpMap()
    this.ensureGround()
    this.emit()
  }

  private removeLate(site: LatePlacement) {
    const spec = buildingById(site.id)
    const refund = spec ? Math.round(spec.cost * BULLDOZE_REFUND) : 0
    this.lateSites = this.lateSites.filter((row) => row !== site)
    if (this.tile(site) === tileForLate(site.id)) this.tiles[site.r]![site.c] = 'grass'
    if (refund > 0) {
      this.cash += refund
      this.bank.post('refunds', refund, {
        simMinutes: this.simMinutes(),
        source: 'tier3plus',
        sourceId: site.id,
        label: spec?.name ?? site.id,
      })
    }
    this.bumpMap()
    this.ensureGround()
    this.emit()
  }

  clearTile(v: Vec) {
    const building = this.siteAt(v)
    if (building) {
      this.cancelSite(building.id)
      return
    }
    const late = this.lateSites.find((site) => site.c === v.c && site.r === v.r)
    if (late) {
      this.removeLate(late)
      return
    }
    const cur = this.tile(v)
    if (!cur || cur === 'grass') return
    if (this.occupiedByOps(v)) {
      this.pushNews('Cannot clear a live stand.', 'bad')
      this.emit()
      return
    }
    if (cur === 'mro' && this.tier3.isBusy(`${v.c},${v.r}`)) {
      this.pushNews('A heavy check is in that hangar — wait until the bay clears.', 'bad')
      this.emit()
      return
    }
    if (cur === 'terminal') {
      const origin = this.selectedTerminalOrigin()
      if (origin) {
        const fit = this.fits.find((f) => f.origin.c === origin.c && f.origin.r === origin.r)
        const w = fit?.premade ? 3 : 2
        const h = fit?.premade ? 3 : 2
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            const p = { c: origin.c + c, r: origin.r + r }
            if (this.tile(p) === 'terminal') this.tiles[p.r][p.c] = 'grass'
          }
        }
        this.fits = this.fits.filter(
          (f) => !(f.origin.c === origin.c && f.origin.r === origin.r),
        )
        this.credit(
          Math.round((fit?.premade ? PREMADE_TERMINAL_COST : TERMINAL_COST) * BULLDOZE_REFUND),
          'refunds',
          'terminal',
        )
      }
    } else {
      this.credit(this.refundFor(cur, v), 'refunds', cur)
      this.tiles[v.r][v.c] = 'grass'
      delete this.parkTerms[`${v.c},${v.r}`]
      delete this.hotelClass[`${v.c},${v.r}`]
      delete this.standClass[`${v.c},${v.r}`]
      delete this.standAccess[`${v.c},${v.r}`]
      delete this.standPits[`${v.c},${v.r}`]
      delete this.standScale[`${v.c},${v.r}`]
      delete this.standSize[`${v.c},${v.r}`]
      delete this.standRung[`${v.c},${v.r}`]
      delete this.fittings[hostKey('stand', v.c, v.r)]
      delete this.fittings[hostKey('fire', v.c, v.r)]
      delete this.fittings[hostKey('hangar', v.c, v.r)]
      delete this.hubLinksBuilt[`${v.c},${v.r}`]
      delete this.hangarScale[`${v.c},${v.r}`]
    }
    this.bumpMap()
    this.ensureGround()
    this.emit()
  }

  prefabRunway(origin: Vec, klass: RunwayClass = 'regional'): Vec[] {
    const len =
      klass === 'heavy'
        ? HEAVY_RUNWAY_LEN
        : klass === 'short'
          ? SHORT_RUNWAY_LEN
          : RUNWAY_PREFAB_LEN
    const wid =
      klass === 'heavy'
        ? HEAVY_RUNWAY_WID
        : klass === 'short'
          ? SHORT_RUNWAY_WID
          : RUNWAY_PREFAB_WID
    const cells: Vec[] = []
    if (this.facing === 'h') {
      for (let r = 0; r < wid; r++) {
        for (let c = 0; c < len; c++) {
          cells.push({ c: origin.c + c, r: origin.r + r })
        }
      }
    } else {
      for (let c = 0; c < wid; c++) {
        for (let r = 0; r < len; r++) {
          cells.push({ c: origin.c + c, r: origin.r + r })
        }
      }
    }
    return cells
  }

  placeRunway(v: Vec, klass: RunwayClass = 'regional') {
    if (this.openingStampBlocked('A runway')) return
    if (klass === 'heavy') {
      const need = unlockLevel('runway_heavy')
      if (this.fieldLevel() < need) {
        this.pushNews(`Heavy strip needs Field level ${need}.`, 'bad')
        this.emit()
        return
      }
      const researchNeed = this.researchTree.blockReason('runway_heavy')
      if (researchNeed) {
        this.pushNews(researchNeed, 'bad')
        this.emit()
        return
      }
    }
    const cells = this.prefabRunway(v, klass)
    if (this.scenarioMaxRunwayM != null) {
      let minC = cells[0]?.c ?? 0
      let maxC = minC
      let minR = cells[0]?.r ?? 0
      let maxR = minR
      for (const cell of cells) {
        if (cell.c < minC) minC = cell.c
        if (cell.c > maxC) maxC = cell.c
        if (cell.r < minR) minR = cell.r
        if (cell.r > maxR) maxR = cell.r
      }
      const lengthM = (Math.max(maxC - minC, maxR - minR) + 1) * METERS_PER_CELL
      if (lengthM > this.scenarioMaxRunwayM) {
        this.pushNews(
          `This scenario caps the strip at ${this.scenarioMaxRunwayM} m. This stamp is ${lengthM} m.`,
          'bad',
        )
        this.emit()
        return
      }
    }
    const blocked = this.placementBlockReason('runway', cells, v, 'runway')
    if (
      cells.some((p) => !inBounds(p.c, p.r) || this.tile(p) !== 'grass') ||
      this.cellsBlocked(cells)
    ) {
      const tip =
        klass === 'heavy'
          ? 'Need a clear plot for the heavy strip (20×3). Rotate if it hangs off.'
          : klass === 'short'
            ? 'Need a clear plot for the short strip (10×2). Regionals only.'
            : 'Need a clear plot for the runway. Hit Rotate if it hangs off.'
      this.pushNews(blocked ?? tip, 'bad')
      this.emit()
      return
    }
    if (blocked) {
      this.pushNews(blocked, 'bad')
      this.emit()
      return
    }
    const cost =
      klass === 'heavy'
        ? HEAVY_RUNWAY_COST
        : klass === 'short'
          ? SHORT_RUNWAY_COST
          : RUNWAY_PREFAB_COST
    const label =
      klass === 'heavy' ? 'heavy runway' : klass === 'short' ? 'short runway' : 'runway'
    if (this.sites.some((s) => s.kind === 'runway')) {
      this.pushNews('A runway is already a construction site — a contractor is driving in.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(cost, label)) {
      this.emit()
      return
    }
    const news =
      klass === 'heavy'
        ? 'Heavy strip open — widebodies and 747Fs can land.'
        : klass === 'short'
          ? 'Short strip open — CRJ / E-Jets / Citations only. Long metal will refuse.'
          : 'Regional runway open — A320 / 737 class OK.'
    this.enqueueBuild({
      kind: 'runway',
      cells,
      tile: 'runway',
      cost,
      name: label,
      news,
      tool: klass === 'heavy' ? 'runway_heavy' : klass === 'short' ? 'runway_short' : 'runway',
      runwayClass: klass,
      origin: v,
    })
  }

  placeTerminal(v: Vec) {
    if (this.openingStampBlocked('A terminal shell')) return
    const cells = [
      v,
      { c: v.c + 1, r: v.r },
      { c: v.c, r: v.r + 1 },
      { c: v.c + 1, r: v.r + 1 },
    ]
    const blocked = this.placementBlockReason('terminal', cells, v, 'terminal shell')
    if (cells.some((p) => this.tile(p) !== 'grass') || this.cellsBlocked(cells)) {
      this.pushNews(blocked ?? 'Need a clear 2×2 for the shell.', 'bad')
      this.emit()
      return
    }
    if (blocked) {
      this.pushNews(blocked, 'bad')
      this.emit()
      return
    }
    if (this.sites.some((s) => s.tool === 'terminal')) {
      this.pushNews('A terminal shell is already a construction site — a contractor is driving in.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(TERMINAL_COST, 'terminal shell')) {
      this.emit()
      return
    }
    this.enqueueBuild({
      kind: 'terminal',
      cells,
      tile: 'terminal',
      cost: TERMINAL_COST,
      name: 'terminal shell',
      tool: 'terminal',
      origin: v,
    })
  }

  placePremade(v: Vec) {
    if (this.openingStampBlocked('A premade hall')) return
    const cells: Vec[] = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) cells.push({ c: v.c + c, r: v.r + r })
    }
    const blocked = this.placementBlockReason('terminal', cells, v, 'premade hall')
    if (cells.some((p) => !inBounds(p.c, p.r) || this.tile(p) !== 'grass') || this.cellsBlocked(cells)) {
      this.pushNews(blocked ?? 'Need a clear 3×3 for the premade hall.', 'bad')
      this.emit()
      return
    }
    if (blocked) {
      this.pushNews(blocked, 'bad')
      this.emit()
      return
    }
    if (this.sites.some((s) => s.tool === 'premade')) {
      this.pushNews('A premade hall is already a construction site — a contractor is driving in.', 'bad')
      this.emit()
      return
    }
    if (!this.spend(PREMADE_TERMINAL_COST, 'premade terminal')) {
      this.emit()
      return
    }
    this.enqueueBuild({
      kind: 'premade',
      cells,
      tile: 'terminal',
      cost: PREMADE_TERMINAL_COST,
      name: 'premade terminal',
      tool: 'premade',
      origin: v,
    })
  }

  /**
   * Book the day's late-building income and upkeep, then advance construction.
   * Posted before the payroll read so hotel nights count in that day's income.
   */
  private settleLateBuildings(completedDay: number) {
    if (!this.lateSites.length && this.missedHotelNights <= 0 && this.crewHotelNights <= 0) return
    const night = this.hotelNightDemand()
    const settled = advanceLateDay(this.lateSites, night, 1)
    this.lateSites = settled.sites
    const stamp = (completedDay + 1) * SIM_MINUTES_PER_GAME_DAY - 1
    let bookedTransfers = 0
    let bookedCrew = 0
    for (const line of settled.pnl.lines) {
      bookedTransfers += line.transferRooms
      bookedCrew += line.crewRooms
      if (line.income > 0) {
        this.cash += line.income
        this.revenue += line.income
        this.hourIncome += line.income
        this.bank.post('landside_fees', line.income, {
          simMinutes: stamp,
          source: 'tier3plus',
          sourceId: line.id,
          label: line.name,
        })
      }
      if (line.upkeep > 0 && !this.sandbox) {
        const paid = this.takeCash(line.upkeep)
        if (paid > 0) {
          this.bank.post('building_upkeep', -paid, {
            simMinutes: stamp,
            source: 'tier3plus',
            sourceId: line.id,
            label: line.name,
          })
        }
        const skipped = line.upkeep - paid
        if (skipped > 0) {
          this.bank.post('building_upkeep', -skipped, {
            simMinutes: stamp,
            source: 'tier3plus',
            sourceId: line.id,
            label: line.name,
            unpaid: true,
          })
        }
      }
    }
    this.missedHotelNights = Math.max(0, this.missedHotelNights - bookedTransfers)
    this.crewHotelNights = Math.max(0, this.crewHotelNights - bookedCrew)
  }

  placeLate(v: Vec) {
    const id = lateIdForTool(this.tool)
    if (!id) return
    const spec = buildingById(id)
    if (!spec) return
    if (this.siteAt(v)) {
      this.pushNews('Already a construction site.', 'bad')
      this.emit()
      return
    }
    const blocked = this.placementBlockReason(tileForLate(id), [v], v, spec.name)
    if (blocked) {
      this.pushNews(blocked, 'bad')
      this.emit()
      return
    }
    if (this.tile(v) !== 'grass') {
      this.pushNews('Needs grass.', 'bad')
      this.emit()
      return
    }
    const gated = placeBuilding(id, this.lateFieldLevel())
    if (!gated.ok) {
      this.pushNews(gated.reason, 'bad')
      this.emit()
      return
    }
    if (id === 'saf_blending') {
      if (!farmBesidePavement(this.tiles, v)) {
        this.pushNews('SAF blending needs taxi, stand, runway, or road beside it.', 'bad')
        this.emit()
        return
      }
    } else if (!neighbors(v.c, v.r).some((p) => this.tile(p) === 'road')) {
      this.pushNews(`${spec.name} needs a road edge.`, 'bad')
      this.emit()
      return
    }
    const researchNeed = this.researchTree.blockReason(id)
    if (researchNeed) {
      this.pushNews(researchNeed, 'bad')
      this.emit()
      return
    }
    if (!this.spend(gated.cost, spec.name, 'construction', 'tier3plus')) return
    this.tiles[v.r]![v.c] = tileForLate(id)
    this.lateSites.push({ id, c: v.c, r: v.r, elapsedDays: 0 })
    const opened = isOpen({ id, elapsedDays: 0 })
    this.pushNews(
      opened ? `${spec.name} open.` : `${spec.name} under construction — ${spec.buildDays} days.`,
      'good',
    )
    this.bumpMap()
    this.emit()
  }

  placeSingle(v: Vec) {
    const building = BUILDINGS.find((b) => b.tool === this.tool)
    if (!building) return
    if (building.tile === 'stand' && this.openingStampBlocked('A stand')) return
    const needLevel = Math.max(building.minFieldLevel ?? 1, unlockLevel(building.tool))
    if (this.fieldLevel() < needLevel) {
      this.pushNews(`${building.name} needs Field level ${needLevel}.`, 'bad')
      this.emit()
      return
    }
    const treeNeed = this.researchTree.blockReason(building.tool)
    if (treeNeed) {
      this.pushNews(treeNeed, 'bad')
      this.emit()
      return
    }
    const locked = placementBlock(this.tool, this.fieldLevel(), this.researchGrants())
    if (locked) {
      this.pushNews(locked, 'bad')
      this.emit()
      return
    }
    if (building.tile === 'stand' && this.standAccessMode === 'jetway') {
      const bridge = unlockLevel('jet_bridge')
      if (this.fieldLevel() < bridge) {
        this.pushNews(`Jet bridge needs Field level ${bridge}.`, 'bad')
        this.emit()
        return
      }
    }
    if (this.siteAt(v)) {
      this.pushNews('Already a construction site.', 'bad')
      this.emit()
      return
    }
    const blocked = this.placementBlockReason(building.tile, [v], v, building.name)
    if (blocked) {
      this.pushNews(blocked, 'bad')
      this.emit()
      return
    }
    if (this.tile(v) !== 'grass') {
      this.pushNews('Needs grass.', 'bad')
      this.emit()
      return
    }
    if (building.tile === 'fuel' && !farmBesidePavement(this.tiles, v)) {
      this.pushNews('Park the farm beside taxi, stand, runway, or road.', 'bad')
      this.emit()
      return
    }
    if ((building.tile === 'kitchen' || building.tile === 'depot') && !farmBesidePavement(this.tiles, v)) {
      this.pushNews(`${building.name} needs a road, taxiway, or stand beside it.`, 'bad')
      this.emit()
      return
    }
    if (building.tile === 'guard') {
      const nearRoad = [
        { c: v.c + 1, r: v.r },
        { c: v.c - 1, r: v.r },
        { c: v.c, r: v.r + 1 },
        { c: v.c, r: v.r - 1 },
      ].some((p) => inBounds(p.c, p.r) && this.tile(p) === 'road')
      if (!nearRoad) {
        this.pushNews('Guard post needs a road edge (city approach).', 'bad')
        this.emit()
        return
      }
    }
    if (building.tile === 'deice' && !farmBesidePavement(this.tiles, v)) {
      this.pushNews('De-ice pad needs taxi / stand / runway edge.', 'bad')
      this.emit()
      return
    }
    if (building.tile === 'mro' || building.tile === 'nighthub') {
      const gate = building.tile === 'mro' ? mroUnlock(this.tier3Unlock()) : nightHubUnlock(this.tier3Unlock())
      if (!gate.ok) {
        this.pushNews(gate.why, 'bad')
        this.emit()
        return
      }
    }
    if (this.tool === 'oil') {
      const beside = [
        { c: v.c + 1, r: v.r },
        { c: v.c - 1, r: v.r },
        { c: v.c, r: v.r + 1 },
        { c: v.c, r: v.r - 1 },
      ].some((p) => {
        const t = this.tile(p)
        return t === 'fuel' || t === 'fuel_rail'
      })
      if (!beside) {
        this.pushNews('Oil station needs the fuel farm or the fuel rail beside it.', 'bad')
        this.emit()
        return
      }
    }
    if (this.tool === 'berth') {
      if (!siteHasWater(this.site)) {
        this.pushNews('This field has no river.', 'bad')
        this.emit()
        return
      }
      const owned = this.ownedPlots.some((plot) => plot.id === cellPlotId(v.c, v.r))
      if (!cellOnWater(v.c, v.r, this.site) || !owned) {
        this.pushNews('The berth has to sit on a plot that touches the river.', 'bad')
        this.emit()
        return
      }
    }
    if (this.tool === 'manifold') {
      const beside = [
        { c: v.c + 1, r: v.r },
        { c: v.c - 1, r: v.r },
        { c: v.c, r: v.r + 1 },
        { c: v.c, r: v.r - 1 },
      ].some((p) => {
        const t = this.tile(p)
        return t === 'fuel' || t === 'fuel_pipe'
      })
      if (!beside) {
        this.pushNews('Receipt manifold needs the fuel farm or the pipeline beside it.', 'bad')
        this.emit()
        return
      }
    }
    const isLandside =
      building.tile === 'hotel' ||
      building.tile === 'park_s' ||
      building.tile === 'park_l' ||
      building.tile === 'park_g' ||
      building.tile === 'park_u' ||
      building.tile === 'bus' ||
      building.tile === 'curb_lane' ||
      building.tile === 'taxi_rank' ||
      building.tile === 'rail'
    if (isLandside) {
      const nearRoad = [
        { c: v.c + 1, r: v.r },
        { c: v.c - 1, r: v.r },
        { c: v.c, r: v.r + 1 },
        { c: v.c, r: v.r - 1 },
      ].some((p) => inBounds(p.c, p.r) && this.tile(p) === 'road')
      if (!nearRoad) {
        this.pushNews('Landside stamps need a road edge.', 'bad')
        this.emit()
        return
      }
    }
    if (building.tile === 'rail' && !this.railLinked) {
      this.pushNews('Rail station locked — invest in City rail first.', 'bad')
      this.emit()
      return
    }
    const freshStand =
      this.tool === 'stand_light' || this.tool === 'stand_narrow' || this.tool === 'stand_heavy'
    const jetwayStand =
      building.tile === 'stand' && this.standAccessMode === 'jetway' && !freshStand
    const stampCost = jetwayStand
      ? Math.round(building.cost * STAND_JETWAY_MULT)
      : building.cost
    if (this.sites.some((s) => s.tool === building.tool)) {
      this.pushNews(
        `${building.name} is already a construction site — a contractor is driving in.`,
        'bad',
      )
      this.emit()
      return
    }
    if (!this.spend(stampCost, jetwayStand ? `${building.name} + jetway` : building.name)) {
      this.emit()
      return
    }
    const standCls: StandClass = standClassForTool(this.tool) ?? 'M'
    const jumboOpen = this.hasResearch('heavy_pack') && this.fieldLevel() >= 5
    const standScale = standScaleForTool(this.tool, jumboOpen)
    const standAlias = building.tile === 'stand' ? aliasSize(this.tool, jumboOpen) : null
    const hangarScale = hangarScaleForTool(this.tool)
    const hotelCls: HotelClass =
      this.tool === 'hotel_inn' ? 'inn' : this.tool === 'hotel_resort' ? 'resort' : 'business'
    let news = `${building.name} open.`
    if (
      building.tile === 'park_s' ||
      building.tile === 'park_l' ||
      building.tile === 'park_g' ||
      building.tile === 'park_u'
    ) {
      news = `${building.name} (${this.parkTerm}-term) open.`
    } else if (building.tile === 'stand' && this.standAccessMode === 'jetway') {
      news = `${building.name} + jetway open.`
    } else if (building.tile === 'stand') {
      news = `${building.name} remote bay open.`
    } else if (building.tile === 'guard') {
      news = 'Guard post online — city cargo trucks will screen here before the shed.'
    } else if (building.tile === 'cargo') {
      news = 'Cargo shed online — city trucks need a guard post on the road to deliver cleanly.'
    } else if (building.tile === 'termbus') {
      news = `Terminal bus depot online ($${TERMBUS_COST.toLocaleString()}). Remote stands can ferry instead of walking.`
    } else if (this.tool === 'people_mover') {
      news = `People mover online ($${CONNECTIVITY_CATALOG.people_mover.cost.toLocaleString('en-US')}). Connecting passengers ride it. A breakdown strands the link.`
    } else if (building.tile === 'mover') {
      news = `Pier mover online ($${stampCost.toLocaleString('en-US')}). Jumbo piers ride this guideway.`
    } else if (building.tile === 'xferbus') {
      news = `Airside transfer bus online ($${CONNECTIVITY_CATALOG.airside_transfer_bus_depot.cost.toLocaleString('en-US')}). Slow, and it adds apron traffic.`
    } else if (this.tool === 'hub_skywalk') {
      news = `Skywalk open ($${CONNECTIVITY_CATALOG.skywalk.cost.toLocaleString('en-US')}). It links the terminals it touches.`
    } else if (building.tile === 'skywalk') {
      news = `Pier skywalk open ($${stampCost.toLocaleString('en-US')}). Widebody gates can use this bridge.`
    } else if (building.tile === 'deice') {
      news = `De-ice pad online ($${DEICE_PAD_COST.toLocaleString()}). Glycol trucks roll in storm/fog.`
    } else if (building.tile === 'bus') {
      news = `Bus bay open ($${stampCost.toLocaleString('en-US')}). It adds curb stalls and takes coaches off the lane.`
    } else if (building.tile === 'curb_lane') {
      news = `Curb lane open ($${stampCost.toLocaleString('en-US')}). Another lane of drop-off.`
    } else if (building.tile === 'taxi_rank') {
      news = `Taxi rank open ($${stampCost.toLocaleString('en-US')}). It adds curb stalls for the taxi queue.`
    } else if (building.tile === 'rail') {
      news = `Rail station open ($${RAIL_STATION_COST.toLocaleString()}). Business pax prefer the train.`
    } else if (building.tile === 'hangar') {
      news = 'Hangar up.'
    } else if (building.tile === 'mro') {
      news = 'MRO hangar open — airlines can buy heavy checks. A bay ties up that stand.'
    } else if (building.tile === 'nighthub') {
      news = 'Cargo night hub open — freighters bank after dark. The city will bill the noise.'
    } else if (building.tile === 'belt') {
      news = `Bag belt open ($${BELT_COST.toLocaleString()}). Link hall, sort, and stand.`
    } else if (building.tile === 'kitchen') {
      news = 'Catering kitchen open. Meals cook here for the galley trucks.'
    } else if (building.tile === 'depot') {
      news = 'Vehicle depot open. Fuel, galley, bag, and bus trucks stage here.'
    }
    this.enqueueBuild({
      kind: 'single',
      cells: [v],
      tile: building.tile,
      cost: stampCost,
      name: building.name,
      news,
      tool: this.tool,
      standClass: building.tile === 'stand' ? standCls : undefined,
      standAccess: building.tile === 'stand' ? (freshStand ? 'remote' : this.standAccessMode) : undefined,
      standScale: building.tile === 'stand' ? (standScale ?? undefined) : undefined,
      standSize: standAlias?.size,
      standRung: standAlias?.rung,
      standLetter: standAlias ? footprintLetter(standAlias.size, standAlias.rung) : undefined,
      hangarScale: building.tile === 'hangar' ? (hangarScale ?? undefined) : undefined,
      hotelClass: building.tile === 'hotel' ? hotelCls : undefined,
      parkTerm:
        building.tile === 'park_s' ||
        building.tile === 'park_l' ||
        building.tile === 'park_g' ||
        building.tile === 'park_u'
          ? this.parkTerm
          : undefined,
      origin: v,
    })
  }

  /**
   * Write size and rung beside the old keys. An existing size is left alone,
   * so a rung the player already bought is not pushed back up on reload.
   */
  private recordStand(
    key: string,
    rec: {
      cls?: StandClass
      scale?: 'small' | 'wide' | 'jumbo'
      access?: StandAccess
      tool?: string
      size?: StandSize
      rung?: StandRung
    },
  ) {
    if (this.standSize[key]) return
    if (rec.size && rec.rung != null) {
      this.standSize[key] = rec.size
      this.standRung[key] = rec.rung
    } else {
      const jumbo = this.hasResearch('heavy_pack') && this.fieldLevel() >= 5
      const alias = rec.tool ? aliasSize(rec.tool, jumbo) : null
      if (alias) {
        this.standSize[key] = alias.size
        this.standRung[key] = alias.rung
      } else if (rec.cls) {
        const migrated = migrateStand({ cls: rec.cls, scale: rec.scale, access: rec.access })
        this.standSize[key] = migrated.size
        this.standRung[key] = migrated.rung
      }
    }
    if (!this.standSize[key]) return
    const bridge =
      rec.access === 'jetway' ||
      (rec.access == null &&
        rec.cls != null &&
        migrateStand({
          cls: rec.cls,
          scale: rec.scale,
          hallNear: this.hallNearStand(key),
        }).jetBridge)
    if (bridge) this.grantLegacyBridge(key)
  }

  private hallNearStand(key: string): boolean {
    const [c, r] = key.split(',').map(Number)
    if (!Number.isFinite(c) || !Number.isFinite(r) || !this.fits.length) return false
    let best = JETWAY_RANGE + 1
    for (const fit of this.fits) {
      const d = Math.abs(fit.origin.c - c) + Math.abs(fit.origin.r - r)
      if (d < best) best = d
    }
    return best <= JETWAY_RANGE
  }

  private grantLegacyBridge(key: string) {
    const [c, r] = key.split(',').map(Number)
    if (!Number.isFinite(c) || !Number.isFinite(r)) return
    const host = hostKey('stand', c, r)
    const list = this.fittings[host] ?? []
    if (list.some((item) => item.id === 'jet_bridge')) return
    this.fittings[host] = [...list, { id: 'jet_bridge', granted: 'legacy' }]
  }

  /**
   * Old saves have class and scale only. Fill size and rung once.
   * A stand that already has a size is not migrated again.
   */
  migrateMissingStands() {
    for (const stand of tilesOf(this.tiles, 'stand')) {
      const key = `${stand.c},${stand.r}`
      if (this.standSize[key]) continue
      const access = this.standAccess[key]
      const migrated = migrateStand({
        cls: this.standClass[key],
        scale: this.standScale[key],
        access,
        hallNear: access == null && this.hallNearStand(key),
      })
      this.standSize[key] = migrated.size
      this.standRung[key] = migrated.rung
      const fit = legacyFitting(migrated)
      if (fit) this.grantLegacyBridge(key)
    }
  }

  /** Painted box. A stored size uses the rung footprint. Only the heavy pad grows. */
  standIcao(stand: Vec): ReturnType<typeof standLetter> {
    const key = `${stand.c},${stand.r}`
    const size = this.standSize[key]
    const rung = this.standRung[key]
    if (size && rung != null) return footprintLetter(size, rung)
    const scale = this.standScale[key]
    if (scale === 'wide') return 'E'
    if (scale === 'jumbo') return 'F'
    const cls = this.standClassAt(stand)
    if (cls === 'L') return 'F'
    return standLetter(cls)
  }

  /** Letters the collision rules should paint. Missing keys stay on class and scale. */
  private standLetters(): Record<string, ReturnType<typeof footprintLetter>> {
    const out: Record<string, ReturnType<typeof footprintLetter>> = {}
    for (const [key, size] of Object.entries(this.standSize)) {
      const rung = this.standRung[key]
      if (rung == null) continue
      out[key] = footprintLetter(size, rung)
    }
    return out
  }

  /** Buy the next surface on a stand. The first failure is the news line. */
  buyStandRung(key: string): boolean {
    const size = this.standSize[key]
    const rung = this.standRung[key]
    if (!size || rung == null) return false
    const refusal = rungRefusal(size, rung, this.fieldLevel(), new Set(this.researchUnlocked))
    if (refusal) {
      this.pushNews(refusal, 'bad')
      this.emit()
      return false
    }
    const next = (rung + 1) as StandRung
    if (size === 'heavy') {
      const [c, r] = key.split(',').map(Number)
      const why = standGrowBlock(
        this.tiles,
        { c, r },
        footprintLetter(size, rung),
        footprintLetter(size, next),
        this.standClass,
        this.standScale,
        this.standLetters(),
      )
      if (why) {
        this.pushNews(why, 'bad')
        this.emit()
        return false
      }
    }
    const cost = rungStepCost(size, next)
    if (!this.spend(cost, `${size} ${next === 1 ? 'pave' : 'slab'}`)) return false
    this.standRung[key] = next
    if (size === 'heavy' && next === 1) this.standScale[key] = 'wide'
    if (size === 'heavy' && next === 2) this.standScale[key] = 'jumbo'
    this.apronFocus = []
    this.bumpMap()
    this.pushNews(`${RUNG_LABEL[size][next]} poured.`, 'good')
    this.emit()
    return true
  }

  /** Hover on the upgrade row paints the next heavy box. */
  previewStandRow(id: string | null) {
    if (!id?.startsWith('rung:')) {
      this.apronFocus = []
      this.emit()
      return
    }
    const key = id.slice('rung:'.length)
    const size = this.standSize[key]
    const rung = this.standRung[key]
    if (size !== 'heavy' || rung == null || rung >= 2) {
      this.apronFocus = []
      this.emit()
      return
    }
    const [c, r] = key.split(',').map(Number)
    const next = (rung + 1) as StandRung
    this.apronFocus = footprintCellsForLetter(this.tiles, { c, r }, footprintLetter(size, next))
    this.emit()
  }

  standCardAction(id: string) {
    if (id.startsWith('rung:')) {
      this.buyStandRung(id.slice('rung:'.length))
      return
    }
    if (id.startsWith('pit:')) {
      const [c, r] = id.slice('pit:'.length).split(',').map(Number)
      if (Number.isFinite(c) && Number.isFinite(r)) this.stampHydrantPit({ c, r })
      return
    }
    const fit = /^(fitbuy|fitdrop):((?:stand|fire|hangar|fuel):\d+,\d+):([a-z0-9_]+)$/.exec(id)
    if (!fit) return
    const fitting = this.asFittingId(fit[3] ?? '')
    if (!fitting) return
    if (fit[1] === 'fitbuy') this.buyFitting(fit[2] ?? '', fitting)
    else this.removeFitting(fit[2] ?? '', fitting)
  }

  /** Fittings the card offers. Later tickets append rows here. */
  private shownFittingIds(host: FittingHost): FittingId[] {
    if (host === 'stand') return ['jet_bridge', 'gpu_pca', 'apron_light', 'deice_outlet', 'flag']
    if (host === 'fire') return ['alarm_bell']
    if (host === 'hangar') return ['line_office']
    return []
  }

  /** Scramble at the station. A bell shortens it. The drive is unchanged. */
  scrambleSec(): number {
    for (const [key, list] of Object.entries(this.fittings)) {
      const parsed = parseHostKey(key)
      if (parsed?.host === 'fire' && list.some((item) => item.id === 'alarm_bell')) return Math.round(45 * 0.8)
    }
    return 45
  }

  /** Line MX for one bay. An office on that bay shortens the work. */
  private hangarMxFor(bay: Vec | null | undefined): number {
    const base = this.hangarMxDuration()
    if (!bay) return base
    const office = (this.fittings[hostKey('hangar', bay.c, bay.r)] ?? []).some((item) => item.id === 'line_office')
    return office ? base * 0.9 : base
  }

  private hasFitting(stand: Vec | null, id: FittingId): boolean {
    if (!stand) return false
    return (this.fittings[hostKey('stand', stand.c, stand.r)] ?? []).some((item) => item.id === id)
  }

  /** The cable is live when the plant covers the field, or a substation is already built. */
  private cableLive(stand: Vec | null): boolean {
    if (!this.hasFitting(stand, 'gpu_pca')) return false
    if (this.progressionBuilt.includes('substation')) return true
    return !this.powerReport().brownout
  }

  /** Stand ids whose cable is live, stable for the logistics cache. */
  private liveCableKey(): string {
    if (this.powerReport().brownout && !this.progressionBuilt.includes('substation')) return ''
    const ids: string[] = []
    for (const [key, list] of Object.entries(this.fittings)) {
      if (!list.some((item) => item.id === 'gpu_pca')) continue
      const parsed = parseHostKey(key)
      if (parsed?.host === 'stand') ids.push(`${parsed.c},${parsed.r}`)
    }
    ids.sort()
    return ids.join('|')
  }

  /** Boarding cap. Night and weather stretch it until the stand has the fitting. */
  private boardCap(f: Flight): number {
    const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
    const pace = this.rampPace(f.airframeId, Boolean(f.cargo || f.kind === 'freighter'), f.airline)
    const base =
      (mode === 'jetway' ? (f.boardingSlow ? 11 : 7.5) : mode === 'bus' ? (f.boardingSlow ? 18 : 13) : f.boardingSlow ? 24 : 17) *
        pace +
      (this.diplomacy?.extraDelaySec(f.airline) ?? 0)
    let mult = 1
    if (f.stand && this.isNight() && !this.hasFitting(f.stand, 'apron_light')) mult *= 1.2
    if (f.stand && this.weather !== 'clear' && !this.hasFitting(f.stand, 'gpu_pca')) mult *= 1.15
    return base * mult
  }

  private asFittingId(id: string): FittingId | null {
    return FITTINGS.some((row) => row.id === id) ? (id as FittingId) : null
  }

  private hostPresent(host: FittingHost, c: number, r: number): boolean {
    const tile = this.tile({ c, r })
    if (host === 'stand') return tile === 'stand'
    if (host === 'fire') return tile === 'fire'
    if (host === 'hangar') return tile === 'hangar'
    if (host === 'fuel') return tile === 'fuel'
    return false
  }

  private fittingAsk(host: FittingHost, c: number, r: number, id: FittingId) {
    const key = `${c},${r}`
    const size = host === 'stand' ? (this.standSize[key] ?? null) : null
    const rung = host === 'stand' ? (this.standRung[key] ?? 0) : 0
    const list = this.fittings[hostKey(host, c, r)] ?? []
    return {
      id,
      host,
      size,
      rung,
      fieldLevel: this.fieldLevel(),
      research: new Set(this.researchUnlocked),
      hasDeice: tilesOf(this.tiles, 'deice').length > 0,
      hallNear: this.hallNearStand(key),
      count: list.filter((item) => item.id === id).length,
      cash: this.cash,
    }
  }

  /** Daily bill for every bought and legacy fitting. */
  private fittingUpkeepBill(): number {
    let bill = 0
    for (const key of Object.keys(this.fittings)) bill += this.fittingUpkeepAt(key)
    return bill
  }

  private fittingUpkeepAt(key: string): number {
    const list = this.fittings[key]
    if (!list?.length) return 0
    const parsed = parseHostKey(key)
    const size = parsed?.host === 'stand' ? this.standSize[`${parsed.c},${parsed.r}`] : undefined
    let bill = 0
    for (const item of list) {
      if (item.id === 'jet_bridge') bill += size ? jetBridgeUpkeep(size) : fittingDef('jet_bridge').upkeepPerDay
      else bill += fittingDef(item.id).upkeepPerDay
    }
    return bill
  }

  /** Buy one fitting. The first refusal is the news line. */
  buyFitting(key: string, id: FittingId): boolean {
    const parsed = parseHostKey(key)
    if (!parsed || !this.hostPresent(parsed.host, parsed.c, parsed.r)) return false
    const ask = this.fittingAsk(parsed.host, parsed.c, parsed.r, id)
    const refusal = fittingRefusal(ask)
    if (refusal) {
      this.pushNews(refusal, 'bad')
      this.emit()
      return false
    }
    const cost = id === 'jet_bridge' && ask.size ? jetBridgeCost(ask.size) : fittingDef(id).cost
    const name = fittingDef(id).name
    if (!this.spend(cost, name)) return false
    const list = this.fittings[key] ?? []
    this.fittings[key] = [...list, { id }]
    if (id === 'jet_bridge') this.standAccess[`${parsed.c},${parsed.r}`] = 'jetway'
    this.bumpMap()
    this.pushNews(`${name} fitted.`, 'good')
    this.emit()
    return true
  }

  /**
   * Take off the last copy. A legacy grant was not bought, so it refunds nothing.
   * The last jet bridge puts the stand back on remote boarding.
   */
  removeFitting(key: string, id: FittingId): boolean {
    const parsed = parseHostKey(key)
    if (!parsed) return false
    const list = [...(this.fittings[key] ?? [])]
    let index = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.id === id) {
        index = i
        break
      }
    }
    if (index < 0) return false
    const removed = list[index]
    list.splice(index, 1)
    if (list.length) this.fittings[key] = list
    else delete this.fittings[key]
    if (removed && removed.granted !== 'legacy') {
      const size = this.standSize[`${parsed.c},${parsed.r}`]
      const cost = id === 'jet_bridge' && size ? jetBridgeCost(size) : fittingDef(id).cost
      this.credit(Math.round(cost * BULLDOZE_REFUND), 'refunds', fittingDef(id).name)
    }
    if (id === 'jet_bridge' && !list.some((item) => item.id === 'jet_bridge')) {
      this.standAccess[`${parsed.c},${parsed.r}`] = 'remote'
    }
    this.bumpMap()
    this.pushNews(`${fittingDef(id).name} removed.`, 'ok')
    this.emit()
    return true
  }

  private fittingRows(host: FittingHost, v: Vec): CardSection['rows'][number][] {
    const key = hostKey(host, v.c, v.r)
    const rows: CardSection['rows'][number][] = []
    for (const id of this.shownFittingIds(host)) {
      const ask = this.fittingAsk(host, v.c, v.r, id)
      const refusal = fittingRefusal(ask)
      const price = id === 'jet_bridge' && ask.size ? jetBridgeCost(ask.size) : fittingDef(id).cost
      const def = fittingDef(id)
      const priced = `$${price.toLocaleString('en-US')}`
      rows.push({
        id: `fitbuy:${key}:${id}`,
        label: refusal ?? `${def.name} · ${def.socket} · ${priced}`,
        disabled: refusal != null,
      })
      if (ask.count > 0) {
        rows.push({
          id: `fitdrop:${key}:${id}`,
          label: `Remove ${def.name.toLowerCase()} · ${def.socket}`,
          disabled: false,
        })
      }
    }
    return rows
  }

  private hostFittingSection(host: FittingHost, v: Vec): CardSection | null {
    const rows = this.fittingRows(host, v)
    if (!rows.length) return null
    return { id: 'attachments', title: 'Attachments', rows }
  }

  private standFittingSection(v: Vec): CardSection | null {
    const key = `${v.c},${v.r}`
    if (!this.standSize[key] || this.standRung[key] == null) return null
    const rows = this.fittingRows('stand', v)
    const pit = progressionBuildable('hydrant')
    const pitRefusal = this.hydrantRefusal(v)
    const pitCost = pit?.cost ?? 0
    rows.push({
      id: `pit:${key}`,
      label: pitRefusal ?? `${pit?.name ?? 'Hydrant pit'} · $${pitCost.toLocaleString('en-US')}`,
      disabled: pitRefusal != null,
    })
    if (!rows.length) return null
    return { id: 'attachments', title: 'Attachments', rows }
  }

  /** Same gates as stampHydrantPit. The pit stays in standPits, not the fitting list. */
  private hydrantRefusal(v: Vec): string | null {
    const key = `${v.c},${v.r}`
    if (this.standPits[key]) return 'This stand already has a pit.'
    const row = progressionBuildable('hydrant')
    const name = row?.name ?? 'Hydrant pit'
    const need = unlockLevel('hydrant')
    if (this.fieldLevel() < need) return `${name} needs Field level ${need}.`
    if (!this.hasResearch('hydrant_fuel')) return 'Research the hydrant system. Then stamp the pit on a stand.'
    const cost = row?.cost ?? 0
    if (this.cash < cost) return `Need $${cost.toLocaleString('en-US')}.`
    return null
  }

  /** Old saves that predate standPits and already researched hydrants keep a pit on each stand. */
  private grantLegacyPits() {
    for (const stand of tilesOf(this.tiles, 'stand')) this.standPits[`${stand.c},${stand.r}`] = true
  }

  private standUpgradeSection(v: Vec): CardSection | null {
    const key = `${v.c},${v.r}`
    const size = this.standSize[key]
    const rung = this.standRung[key]
    if (!size || rung == null) return null
    let refusal = rungRefusal(size, rung, this.fieldLevel(), new Set(this.researchUnlocked))
    if (!refusal && size === 'heavy' && rung < 2) {
      const next = (rung + 1) as StandRung
      refusal = standGrowBlock(
        this.tiles,
        v,
        footprintLetter(size, rung),
        footprintLetter(size, next),
        this.standClass,
        this.standScale,
        this.standLetters(),
      )
    }
    const row = upgradeLabel(size, rung, this.cash, refusal)
    return { id: 'upgrade', title: 'Surface', rows: [{ id: `rung:${key}`, label: row.label, disabled: row.disabled }] }
  }

  standClassAt(stand: Vec | null): StandClass {
    if (!stand) return 'M'
    return this.standClass[`${stand.c},${stand.r}`] ?? 'M'
  }

  standFitsClass(stand: Vec, need: StandClass): boolean {
    return standClassRank(this.standClassAt(stand)) >= standClassRank(need)
  }

  /**
   * ICAO fit: S/M/L map to B/C/F. Helicopters are not sent through that map.
   * The wingspan disc must also miss other parked aircraft and the terminal.
   */
  standFitsAirframe(stand: Vec, airframeId: string): boolean {
    const spec = getAircraftSpec(airframeId)
    if (spec.icao === 'H') return false
    const key = `${stand.c},${stand.r}`
    const size = this.standSize[key]
    const rung = this.standRung[key]
    const allowed =
      size && rung != null
        ? standAllows(size, rung, airframeId, spec.icao)
        : standAccepts(this.standIcao(stand), spec.icao)
    if (!allowed) return false
    const others = this.flights
      .filter(
        (f) =>
          f.stand &&
          (f.craft ?? 'jet') === 'jet' &&
          f.phase !== 'gone' &&
          f.phase !== 'takeoff' &&
          !(f.stand.c === stand.c && f.stand.r === stand.r),
      )
      .map((f) => ({
        c: f.stand!.c,
        r: f.stand!.r,
        spanM: getAircraftSpec(f.airframeId || 'b738').spanM,
      }))
    const blocks: { c: number; r: number }[] = []
    for (let r = 0; r < this.tiles.length; r++) {
      const row = this.tiles[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        if (row[c] === 'terminal') blocks.push({ c, r })
      }
    }
    return !wingDiscsClash(stand, spec.spanM, others, blocks)
  }

  /** Class and scale of the stand tool, or null when the tool is not a stand. */
  standPreview(): { cls: StandClass; scale: SizeTier | null } | null {
    const cls = standClassForTool(this.tool)
    if (!cls) return null
    return {
      cls,
      scale: standScaleForTool(this.tool, this.hasResearch('heavy_pack') && this.fieldLevel() >= 5),
    }
  }

  /** Tile the current tool would stamp, or null for pan / inspect. */
  placementTile(): Tile | null {
    if (this.tool === 'runway' || this.tool === 'runway_short' || this.tool === 'runway_heavy') return 'runway'
    if (this.tool === 'terminal' || this.tool === 'premade') return 'terminal'
    const building = BUILDINGS.find((b) => b.tool === this.tool)
    if (building) return building.tile
    const late = lateIdForTool(this.tool)
    return late ? tileForLate(late) : null
  }

  /** Tiles, stand classes, and in-progress sites the collision rules can see. */
  private worldInput() {
    return {
      tiles: this.tiles,
      standClass: this.standClass,
      standScale: this.standScale,
      standLetter: this.standLetters(),
      pending: this.sites.map((s) => ({
        cells: s.cells,
        tile: s.tile,
        standClass: s.standClass,
        standScale: s.standScale,
        standLetter: s.standLetter,
      })),
    }
  }

  /**
   * Physical reason a stamp is illegal, or null when the geometry is clear.
   * Cash, research, and "needs grass" stay with the caller.
   */
  placementBlockReason(tile: Tile, cells: Vec[], origin: Vec, name: string): string | null {
    const jumbo = this.hasResearch('heavy_pack') && this.fieldLevel() >= 5
    const alias = tile === 'stand' ? aliasSize(this.tool, jumbo) : null
    return placementReason(this.worldInput(), {
      tile,
      cells,
      origin,
      name,
      standClass: tile === 'stand' ? (standClassForTool(this.tool) ?? 'M') : undefined,
      standScale: tile === 'stand' ? standScaleForTool(this.tool, jumbo) : undefined,
      standLetter: alias ? footprintLetter(alias.size, alias.rung) : undefined,
    })
  }

  /** Every physical violation on the current field. Construction sites count as built. */
  worldAudit(): WorldViolation[] {
    return auditWorld(this.worldInput())
  }

  /** Sentence for an illegal ghost. Null when the stamp is geometrically legal. */
  placementGhostReason(): string | null {
    if (this.tool === 'clear' || this.tool === 'pan') return null
    const tile = this.placementTile()
    if (!tile || !this.hover) return null
    const cells = this.ghostCells(this.hover)
    if (!cells.length) return null
    return this.placementBlockReason(tile, cells, this.hover, this.placementName(tile))
  }

  private placementName(tile: Tile): string {
    const building = BUILDINGS.find((b) => b.tool === this.tool)
    if (building) return building.name
    const lateId = lateIdForTool(this.tool)
    const lateName = lateId ? buildingById(lateId)?.name : undefined
    if (lateName) return lateName
    if (tile === 'runway') return 'runway'
    return tile
  }

  /** Red ghost when the stamp would break a physical rule. Taxiways may still cross a shoulder. */
  ghostBlocked(cells: Vec[]): boolean {
    if (this.tool === 'clear') return false
    const tile = this.placementTile()
    if (!tile) return false
    if (tile === 'stand' && !this.hover) return true
    if (!cells.length) return false
    const origin = this.hover ?? cells[0]!
    return this.placementBlockReason(tile, cells, origin, this.placementName(tile)) !== null
  }

  /** Geometry only — cash and unlocks do not tint the ghost. */
  ghostReady(cells: Vec[]): boolean {
    if (this.tool === 'clear') return true
    const tile = this.placementTile()
    if (!tile || !cells.length) return false
    if (tile === 'stand') {
      return (
        this.hover != null &&
        this.tile(this.hover) === 'grass' &&
        !this.siteAt(this.hover) &&
        !this.ghostBlocked(cells)
      )
    }
    const paved =
      cells.length > 0 &&
      cells.every((p) => inBounds(p.c, p.r) && this.tile(p) === 'grass') &&
      !this.cellsBlocked(cells)
    return paved && !this.ghostBlocked(cells)
  }

  ghostCells(hover: Vec | null): Vec[] {
    if (!hover) return []
    if (this.tool === 'runway_short') return this.prefabRunway(hover, 'short')
    if (this.tool === 'runway') return this.prefabRunway(hover, 'regional')
    if (this.tool === 'runway_heavy') return this.prefabRunway(hover, 'heavy')
    if (this.tool === 'terminal') {
      return [
        hover,
        { c: hover.c + 1, r: hover.r },
        { c: hover.c, r: hover.r + 1 },
        { c: hover.c + 1, r: hover.r + 1 },
      ]
    }
    if (this.tool === 'premade') {
      const cells: Vec[] = []
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) cells.push({ c: hover.c + c, r: hover.r + r })
      }
      return cells
    }
    const standCls = standClassForTool(this.tool)
    if (standCls) {
      return footprintCells(
        this.tiles,
        hover,
        standCls,
        standScaleForTool(this.tool, this.hasResearch('heavy_pack') && this.fieldLevel() >= 5),
      )
    }
    return [hover]
  }

  ghostRunway(hover: Vec): Vec[] {
    return this.ghostCells(hover)
  }

  groundBusy(): boolean {
    if (this.tier3.taxiwayTieCount() > 0) return true
    return this.flights.some(
      (f) =>
        (f.craft ?? 'jet') === 'jet' &&
        (['landing', 'taxi_in', 'pushback', 'taxi_out', 'takeoff'] as Phase[]).includes(
          f.phase,
        ),
    )
  }

  /**
   * Strips a stand can actually reach. An unlinked second strip is not a lane:
   * traffic would fall back onto the first and the banks would collide.
   */
  private operableStripIndexes(): number[] {
    if (this.operableStripCache && this.operableStripCache.rev === this.mapRev) {
      return this.operableStripCache.indexes
    }
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    const stands = tilesOf(this.tiles, 'stand')
    const indexes: number[] = []
    for (let i = 0; i < strips.length; i++) {
      if (stands.some((stand) => nearestPath(this.tiles, stand, strips[i], 'jet'))) indexes.push(i)
    }
    this.operableStripCache = { rev: this.mapRev, indexes }
    return indexes
  }

  /** Assigned strip, or the only strip when the slot has no preference. */
  private slotStripIndex(pref: number | null | undefined): number | null {
    const n = this.runwayStripCount()
    if (pref != null && pref >= 0 && pref < n) return pref
    if (n <= 1) return n === 1 ? 0 : null
    return null
  }

  /** An unassigned slot shares the field with every strip. Assigned strips only meet themselves. */
  private stripsConflict(a: number | null, b: number | null): boolean {
    if (a == null || b == null) return true
    return a === b
  }

  private runwayStripId(index: number): string | null {
    const st = runwayStrips(this.tiles, MIN_RUNWAY)[index]
    if (!st?.length) return null
    return `rw${index}:${st[0].c},${st[0].r}`
  }

  /** Strip indexes whose centerline cells sit on a path. */
  private stripsOnPath(path: readonly Vec[] | null | undefined): number[] {
    if (!path?.length) return []
    const map = this.atcRunwayMap()
    const hit = new Set<number>()
    for (const p of path) {
      const ids = map.get(`${Math.round(p.c)},${Math.round(p.r)}`)
      if (!ids) continue
      for (const id of ids) {
        const match = /^rw(\d+):/.exec(id)
        if (match) hit.add(Number(match[1]))
      }
    }
    return [...hit]
  }

  /** Schedule preference, else the strip on the path. Null blocks every strip. */
  private flightStrip(f: Flight): number | null {
    if (f.scheduleId) {
      const slot = this.schedule.find((row) => row.id === f.scheduleId)
      const pref = this.slotStripIndex(slot?.runwayPref)
      if (pref != null) return pref
    }
    const onPath = this.stripsOnPath(f.path)
    if (onPath.length >= 1) return onPath[0]
    const n = this.runwayStripCount()
    if (n === 1) return 0
    return null
  }

  /** Strips this departure must cross. Taxi-out uses the live path so a crossing yields. */
  private stripsForDeparture(f: Flight): number[] {
    if (f.phase === 'taxi_out' || f.phase === 'takeoff') {
      const on = this.stripsOnPath(f.path)
      if (on.length) return on
    }
    const assigned = this.flightStrip(f)
    if (assigned != null) return [assigned]
    const n = this.runwayStripCount()
    if (n === 1) return [0]
    const operable = this.operableStripIndexes()
    return operable.length ? operable : n > 0 ? [0] : []
  }

  /** First linked strip a special flight can use without cutting a scheduled bank. */
  private openSpecialStrip(): number | null {
    const operable = this.operableStripIndexes()
    const candidates = operable.length
      ? operable
      : Array.from({ length: this.runwayStripCount() }, (_, i) => i)
    for (const index of candidates) {
      if (!this.scheduleOwnsRunway(index)) return index
    }
    return null
  }

  /**
   * The strip is busy only while a jet holds that runway's lock or is still in
   * the takeoff roll. Taxi to the stand and taxi out to the hold line are not runway time.
   * An aircraft with no strip blocks every strip.
   */
  private runwayStripBusy(index?: number, exceptId?: string): boolean {
    const id = index == null ? null : this.runwayStripId(index)
    return this.flights.some((f) => {
      if (exceptId && f.id === exceptId) return false
      if ((f.craft ?? 'jet') !== 'jet') return false
      const strip = this.flightStrip(f)
      const onThis = index == null || strip == null || strip === index
      if (!onThis) return false
      if (id) {
        if (this.atc.holdsRunway(f.id, id)) return true
      } else if (this.atc.holdsRunway(f.id)) {
        return true
      }
      return f.phase === 'takeoff' && f.phaseTime < 4
    })
  }

  /**
   * A spawned arrival owns its strip from the approach through the landing roll.
   * The lead is airborne, but the departure roll is longer than that lead, so a
   * departure cannot finish once this arrival has spawned. Other strips stay open.
   * An arrival with no strip blocks every strip.
   */
  private arrivalOnApproach(index?: number): boolean {
    return this.flights.some((f) => {
      if ((f.craft ?? 'jet') !== 'jet') return false
      const onFinal = f.phase === 'approach' || (f.phase === 'landing' && this.atc.holdsRunway(f.id))
      if (!onFinal) return false
      if (index == null) return true
      const strip = this.flightStrip(f)
      return strip == null || strip === index
    })
  }

  /**
   * True when this strip already has an arrival on final, a roll holding the lock,
   * or a scheduled arrival inside 40s. Boarding and pushback at the stand do not own it.
   */
  private scheduleOwnsRunway(index: number): boolean {
    if (this.arrivalOnApproach(index) || this.runwayStripBusy(index)) return true
    const id = this.runwayStripId(index)
    const rolling = this.flights.some((f) => {
      if ((f.craft ?? 'jet') !== 'jet') return false
      if (f.phase !== 'takeoff' && f.phase !== 'taxi_out') return false
      return Boolean(id && this.atc.holdsRunway(f.id, id))
    })
    if (rolling) return true
    // A packed bank is one gap apart. The old 40s horizon was longer than that gap,
    // so a strip with room for a landing never looked free.
    return this.scheduledArrivalSoon(this.specialStripWindow(), index)
  }

  /**
   * Seconds a special flight keeps off the strip before a scheduled arrival.
   * The departure roll plus the slot slack. A longer horizon, one that covers
   * the whole arrival gap, never sees a hole in a full bank and parks the
   * ambulance on a stand for the rest of the day.
   */
  private specialStripWindow(): number {
    return DEPARTURE_OCCUPANCY_SEC + RUNWAY_SLOT_SLACK_SEC
  }

  /** A scheduled arrival is close enough that an ambulance or a Guard jet should stay off that strip. */
  private scheduledArrivalSoon(withinSec = 50, index?: number): boolean {
    return this.openSchedule().some((s) => {
      if (s.status !== 'scheduled' && s.status !== 'delayed') return false
      if (s.eta > this.clock + withinSec) return false
      if (index == null) return true
      const strip = this.slotStripIndex(s.runwayPref)
      return strip == null || strip === index
    })
  }

  /** Next step would roll onto a strip this departure still has to cross. */
  private aboutToEnterStrip(f: Flight): boolean {
    if (f.seg >= f.path.length - 1) return false
    const next = f.path[f.seg + 1]
    if (!next) return false
    const ahead = this.stripsOnPath([next])
    if (!ahead.length) return false
    const mine = this.stripsForDeparture(f)
    return ahead.some((index) => mine.includes(index))
  }

  /** Soonest open ETA that still owes this strip a landing. Null when the bank has none. */
  private nextArrivalEta(index: number): number | null {
    let best: number | null = null
    for (const slot of this.schedule) {
      if (slot.status !== 'scheduled' && slot.status !== 'delayed') continue
      const strip = this.slotStripIndex(slot.runwayPref)
      if (!this.stripsConflict(strip, index)) continue
      if (best == null || slot.eta < best) best = slot.eta
    }
    return best
  }

  /**
   * The roll fits before the next arrival locks. Taxi to the hold line is
   * separate: a departure that is still short of the pavement can keep moving.
   */
  private departureFitsHole(f: Flight): boolean {
    for (const index of this.stripsForDeparture(f)) {
      if (this.arrivalOnApproach(index) || this.runwayStripBusy(index, f.id)) return false
      const eta = this.nextArrivalEta(index)
      if (eta == null) continue
      // No stand means the arrival cannot spawn. Holding the departure here
      // keeps that stand full, so the overdue slot never moves.
      if (!this.assignStand()) continue
      const lockAt = eta + ARRIVAL_LOCK_LEAD_SEC
      if (lockAt < this.clock + DEPARTURE_OCCUPANCY_SEC) return false
    }
    return true
  }

  /**
   * True when `self` can take its own strip without cutting off an arrival or a
   * takeoff roll on that strip. A landing on the other strip does not count.
   * Pushback and taxi to the hold line are not strip time. Military and
   * ambulance still yield when their strip has an arrival inside the departure window.
   */
  private departureMayEnterStrip(self: Flight): boolean {
    const mine = this.stripsForDeparture(self)
    if (
      (self.kind === 'air_ambulance' || self.kind === 'military') &&
      mine.some((index) => this.scheduledArrivalSoon(this.specialStripWindow(), index))
    ) {
      return false
    }
    // The approach does not pin the stand. The roll waits at the hold line
    // (departureFitsHole). A lock or a takeoff on this strip still blocks.
    return !mine.some((index) => this.runwayStripBusy(index, self.id))
  }

  freeStands(): Vec[] {
    const stands = tilesOf(this.tiles, 'stand')
    const reserved = this.tier3.tiedStandKeys()
    const closed = this.opsEvents.closedGates()
    const used = new Set(
      this.flights
        .filter(
          (f) =>
            (f.craft ?? 'jet') === 'jet' &&
            f.stand &&
            f.phase !== 'gone' &&
            f.phase !== 'takeoff',
        )
        .map((f) => `${f.stand!.c},${f.stand!.r}`),
    )
    return stands.filter((s) => {
      const key = `${s.c},${s.r}`
      if (used.has(key) || reserved.has(key) || closed.has(key)) return false
      return Boolean(this.pathStandToRunway(s))
    })
  }

  /**
   * Prefer jetway-linked stands, load-balance across halls, then nearest hall.
   * Multi-terminal lite — second hall pulls its own bank of gates.
   * Optional `need` filters by stand S/M/L class.
   */
  assignStand(
    pref?: Vec | null,
    need?: StandClass,
    airlineId?: AirlineId,
    airframeId?: string,
  ): Vec | null {
    let free = this.freeStands()
    if (airframeId) free = free.filter((s) => this.standFitsAirframe(s, airframeId))
    else if (need) free = free.filter((s) => this.standFitsClass(s, need))
    if (airlineId) {
      const refuse = this.diplomacy?.refusedGates(airlineId) ?? 0
      if (refuse > 0) free = free.slice(refuse)
    }
    if (!free.length) return null
    if (pref) {
      const hit = free.find((s) => s.c === pref.c && s.r === pref.r)
      if (hit) return hit
    }
    if (!this.fits.length) {
      const terms = tilesOf(this.tiles, 'terminal')
      if (!terms.length) return free[0]
      free.sort((a, b) => {
        const da = Math.min(...terms.map((t) => Math.abs(t.c - a.c) + Math.abs(t.r - a.r)))
        const db = Math.min(...terms.map((t) => Math.abs(t.c - b.c) + Math.abs(t.r - b.r)))
        return da - db
      })
      return free[0]
    }
    const beltOn = hasBeltNetwork(this.tiles)
    const scored = free.map((s) => {
      const hall = this.jetwayHall(s)
      const load = hall ? this.occupiedAtHall(hall) : 99
      const d = hall
        ? Math.abs(hall.origin.c - s.c) + Math.abs(hall.origin.r - s.r)
        : 99
      const belt = !beltOn || standBeltLinked(this.tiles, s)
      return { s, jet: hall != null, belt, load, d }
    })
    scored.sort((a, b) => {
      if (a.jet !== b.jet) return a.jet ? -1 : 1
      if (a.load !== b.load) return a.load - b.load
      if (a.belt !== b.belt) return a.belt ? -1 : 1
      return a.d - b.d
    })
    return scored[0].s
  }

  /** Gate label — T1·G2·M·JW when jetway-linked, else G#·class·bus/walk. */
  gateLabel(stand: Vec | null): string {
    if (!stand) return '—'
    const cls = this.standClassAt(stand)
    const hall = this.jetwayHall(stand)
    if (hall) {
      const local = this.standsForHall(hall)
      const idx = local.findIndex((s) => s.c === stand.c && s.r === stand.r)
      return `${this.hallLabel(hall)}·G${idx >= 0 ? idx + 1 : '?'}·${cls}·JW`
    }
    const stands = tilesOf(this.tiles, 'stand')
    const idx = stands.findIndex((s) => s.c === stand.c && s.r === stand.r)
    const mode = this.standPaxMode(stand)
    const suffix = mode === 'bus' ? 'bus' : this.standAccessAt(stand) === 'jetway' ? 'JW?' : 'walk'
    return idx >= 0 ? `G${idx + 1}·${cls}·${suffix}` : `${stand.c},${stand.r}·${cls}`
  }

  holdingCount(): number {
    return this.flights.filter(
      (f) => (f.craft ?? 'jet') === 'jet' && f.phase === 'hold',
    ).length
  }

  /** Open timetable slots scale with stamped strips (not a hard 2-RW world). */
  scheduleCap(): number {
    const strips = Math.max(1, this.runwayStripCount())
    return Math.min(28, Math.max(6, 10 + strips * 4 + this.specMods().scheduleCap))
  }

  maxInbound(): number {
    // Tower unlocks parallel approaches; each stamped strip adds a bank.
    // No hard 2-strip ceiling — more asphalt = more simultaneous inbound.
    const tower = tilesOf(this.tiles, 'tower').length > 0
    if (!tower) return 1
    const strips = this.runwayStripCount()
    let n = 1 + Math.min(6, Math.max(1, strips))
    if (this.hasResearch('stand_class')) n += 1
    n += this.specInboundBonus()
    // Extra terminal campuses — one more simultaneous approach each (cap 2).
    if (this.fits.length >= 2) n += Math.min(2, this.fits.length - 1)
    return Math.min(10, n)
  }

  /** Least-busy linked strip. Null when fewer than two strips can be reached. */
  pickBalancedRunway(): number | null {
    const operable = this.operableStripIndexes()
    if (operable.length < 2) return null
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    const load = strips.map(() => 0)
    for (const s of this.openSchedule()) {
      const pref = s.runwayPref
      if (pref != null && pref >= 0 && pref < load.length && operable.includes(pref)) load[pref] += 1
      else {
        for (const i of operable) load[i] += 0.35
      }
    }
    for (const f of this.flights) {
      if (f.phase === 'gone' || f.craft === 'helo') continue
      const slot = f.scheduleId ? this.schedule.find((x) => x.id === f.scheduleId) : null
      const pref = slot?.runwayPref
      if (pref != null && pref >= 0 && pref < load.length && operable.includes(pref)) load[pref] += 1.2
    }
    let best = operable[0]
    for (const i of operable) {
      if (load[i] < load[best]) best = i
    }
    return best
  }

  /** Open slots filtered by runway bank (`null` = all; `-1` = auto-only). */
  scheduleForRunway(rw: number | null): ScheduleSlot[] {
    const open = this.openSchedule()
    if (rw == null) return open
    if (rw === -1) return open.filter((s) => s.runwayPref == null)
    return open.filter((s) => s.runwayPref === rw)
  }

  setPlannerRwFilter(rw: number | null) {
    this.plannerRwFilter = rw
    this.emit()
  }

  freePads(): Vec[] {
    const pads = tilesOf(this.tiles, 'helipad')
    const used = new Set(
      this.flights
        .filter(
          (f) =>
            f.craft === 'helo' && f.stand && f.phase !== 'gone' && f.phase !== 'takeoff',
        )
        .map((f) => `${f.stand!.c},${f.stand!.r}`),
    )
    return pads.filter((p) => !used.has(`${p.c},${p.r}`))
  }

  /**
   * Taxi path stand → a runway strip.
   * Multi-runway: honor pref when that strip is reachable; otherwise fall back to the
   * nearest reachable strip so a second terminal / far pad isn't soft-locked.
   */
  pathStandToRunway(stand: Vec, runwayPref?: number | null): Vec[] | null {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    if (!strips.length) return null
    const pathTo = (idx: number) => nearestPath(this.tiles, stand, strips[idx], 'jet')
    if (runwayPref != null && strips[runwayPref]) {
      const pref = pathTo(runwayPref)
      if (pref) return pref
    }
    let best: Vec[] | null = null
    for (let i = 0; i < strips.length; i++) {
      if (runwayPref != null && i === runwayPref) continue
      const p = pathTo(i)
      if (p && (!best || p.length < best.length)) best = p
    }
    // Last resort — any cell on any strip (same as legacy flatten).
    return best ?? nearestPath(this.tiles, stand, strips.flat(), 'jet')
  }

  landingRoute(stand: Vec, runwayPref?: number | null): Vec[] | null {
    const toRunway = this.pathStandToRunway(stand, runwayPref)
    if (!toRunway || toRunway.length < 2) return null
    const entry = toRunway[toRunway.length - 1]
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    const strip = strips.find((s) => s.some((p) => p.c === entry.c && p.r === entry.r))
    if (!strip) return null
    const idx = strip.findIndex((p) => p.c === entry.c && p.r === entry.r)
    const fromStart = strip.slice(0, idx + 1)
    const fromEnd = [...strip].reverse().slice(0, strip.length - idx)
    const approach = fromStart.length >= fromEnd.length ? fromStart : fromEnd
    const taxi = [...toRunway].reverse()
    const merged = [...approach]
    for (const p of taxi) {
      const last = merged[merged.length - 1]
      if (!last || last.c !== p.c || last.r !== p.r) merged.push(p)
    }
    return merged
  }

  /** How many stands can still reach at least one strip — campus health check. */
  connectedStandCount(): number {
    return tilesOf(this.tiles, 'stand').filter((s) => this.pathStandToRunway(s)).length
  }

  campusPathLine(): string {
    const strips = this.runwayStripCount()
    const stands = tilesOf(this.tiles, 'stand').length
    const linked = this.connectedStandCount()
    const halls = this.fits.length
    const orphan = stands - linked
    return `${halls}T · ${strips} RW · ${linked}/${stands} stands linked${
      orphan > 0 ? ` · ${orphan} orphan` : ''
    }`
  }

  trySpawn(depth = 0) {
    if (depth > 4) return
    if (!this.signed.length) return
    this.trySpawnContractHelo()
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    if (!tilesOf(this.tiles, 'stand').length) return

    const inbound = this.flights.filter((f) =>
      (['hold', 'approach', 'landing', 'taxi_in'] as Phase[]).includes(f.phase),
    )

    // Prefer the timetable. If nothing is due, only seed when auto and bank empty.
    const slot = this.nextDueSlot()
    // Spawn cool must not leave due slots rotting past ETA (bank soft-lock).
    // An overbooked bank books the wait. A bank that fits spawns as soon as the strip is free.
    if (this.spawnCool > 0) {
      const overdue = slot != null && slot.eta < this.clock - RUNWAY_LATE_SLACK_SEC
      if (slot && overdue && this.runwayOverbooked()) {
        this.delaySlot(slot, 6 + Math.random() * 5, 'Tower sequencing')
        return
      }
      // A bank that fits the runway does not sit out the tower cool once its own strip is free.
      if (slot && slot.runwayPref == null) {
        const picked = this.pickBalancedRunway()
        if (picked != null) slot.runwayPref = picked
      }
      const coolStrip = slot ? this.slotStripIndex(slot.runwayPref) : null
      const stripFree =
        coolStrip == null
          ? !this.runwayStripBusy() && !this.arrivalOnApproach()
          : !this.runwayStripBusy(coolStrip) && !this.arrivalOnApproach(coolStrip)
      if (!stripFree || !slot || slot.eta > this.clock + 1) return
    }
    if (!slot) {
      if (!this.scheduleAuto) return
      const open = this.openSchedule().filter((s) => s.status !== 'inbound' && !this.slotUsesPad(s))
      if (open.length > 0) return // wait for ETA
      const active = this.signed.filter((id) => !this.isBanned(id) && !this.carrierNeedsPad(id))
      if (active.length) this.seedScheduleForAirline(pick(active), 2)
      return
    }
    if (this.isBanned(slot.airline)) {
      slot.status = 'cancelled'
      this.pushNews(`${slot.flightNo} scrubbed — airline banned.`, 'bad')
      return
    }
    if (this.disruptions.runwayClosed(this.clock)) {
      this.delaySlot(slot, 8, 'Runway closed')
      this.spawnCool = 4
      return
    }
    if (this.holdLead(slot)) return

    // One approach per strip. A landing on the other strip does not hold this slot.
    if (slot.runwayPref == null) {
      const picked = this.pickBalancedRunway()
      if (picked != null) slot.runwayPref = picked
    }
    const approachStrip = this.slotStripIndex(slot.runwayPref)
    const onThis = inbound.filter((f) => {
      // Taxi to the stand is not strip time. The lock drops at the exit.
      const ownsStrip =
        f.phase === 'hold' ||
        f.phase === 'approach' ||
        (f.phase === 'landing' && this.atc.holdsRunway(f.id))
      if (!ownsStrip) return false
      const theirs = this.flightStrip(f)
      if (approachStrip == null) return true
      return theirs == null || theirs === approachStrip
    }).length
    // No gate, or a final already up on this strip — slip an overbooked bank, otherwise wait.
    if (onThis >= 1 || (this.groundBusy() && !this.assignStand())) {
      if (!this.runwayOverbooked()) {
        this.spawnCool = Math.max(this.spawnCool, 1.5)
        return
      }
      const hosts = this.stolenHosts()
      const reason = hosts.length ? 'Gate stolen (emergency)' : 'Runway backlog'
      this.delaySlot(slot, 10 + Math.random() * 8, reason)
      if (hosts.length) {
        this.pushNews(
          `${slot.flightNo} slipped — ${hosts[0].flightNo} still holds ${this.gateLabel(hosts[0].stand)} (emergency host).`,
          'bad',
        )
      } else if (Math.random() < 0.45) {
        this.pushNews(
          `${slot.flightNo} slipped — runway backlog. Cascade may hit later slots.`,
          'bad',
        )
      }
      this.spawnCool = 5
      return
    }

    const airlineId = slot.airline
    const def = this.airline(airlineId)
    const picked = this.airframeForSlot(slot, airlineId, def.kind === 'cargo')
    const af = picked.af
    if (!af) {
      const hint = picked.blocked?.hints[0]
      const structural = this.fleetOperateGap(airlineId)
      // Nothing this carrier flies can use the field. Hold this slot only —
      // cascading it parks every passenger turn behind metal that cannot land.
      if (structural) {
        const other = this.openSchedule().find(
          (s) =>
            s.id !== slot.id &&
            (s.status === 'scheduled' || s.status === 'delayed') &&
            this.airlineParkable(s.airline),
        )
        const gap = other ? Math.max(16, other.eta - slot.eta + 18) : 30
        this.slipSlot(slot, gap, 'Stand class short')
        if (other && other.eta <= this.clock + 1.5 && depth < 4) {
          this.spawnCool = 0
          this.trySpawn(depth + 1)
          return
        }
        this.pushNews(`${slot.flightNo} delayed — ${structural}.`, 'bad')
        return
      }
      const why = hint?.fix ?? structural ?? `strip ${this.longestRunway()}c can't take their metal`
      this.delaySlot(slot, 20, hint ? 'Pillar short' : why)
      this.pushNews(`${slot.flightNo} delayed — ${why}.`, 'bad')
      this.spawnCool = 8
      return
    }
    if (isHeloAirframe(af)) {
      this.spawnContractHelo(slot, def, af)
      return
    }
    if (slot.runwayPref == null) {
      const picked = this.pickBalancedRunway()
      if (picked != null) slot.runwayPref = picked
    }
    // This strip is rolling a landing or a departure. The other strip does not count.
    // Inside capacity the next arrival waits; an overbooked bank books the lateness.
    const busyStrip = this.slotStripIndex(slot.runwayPref)
    if (busyStrip == null ? this.runwayStripBusy() : this.runwayStripBusy(busyStrip)) {
      if (!this.runwayOverbooked()) {
        this.spawnCool = Math.max(this.spawnCool, 1.5)
        return
      }
      this.delaySlot(slot, 8 + Math.random() * 6, 'Pavement busy')
      this.spawnCool = 4
      return
    }
    const needCls = airframeStandClass(af) ?? standClassFor(af.kind)
    const stand = this.assignStand(slot.standPref ?? null, needCls, airlineId, af.id)
    const route = stand ? this.landingRoute(stand, slot.runwayPref) : null
    if (!stand || !route) {
      const anyFree = this.freeStands().length > 0
      const hosts = this.stolenHosts()
      const reason =
        !anyFree && hosts.length
          ? 'Gate stolen (emergency)'
          : anyFree
            ? 'Stand class short'
            : 'No gate / path'
      // Wrong stand size is this flight's problem. Cascading it holds every passenger turn behind an aircraft that can never park.
      if (reason === 'Stand class short') {
        const other = this.openSchedule().find(
          (s) =>
            s.id !== slot.id &&
            (s.status === 'scheduled' || s.status === 'delayed') &&
            this.airlineParkable(s.airline),
        )
        const gap = other ? Math.max(16, other.eta - slot.eta + 18) : 30
        this.slipSlot(slot, gap, reason)
        if (other && other.eta <= this.clock + 1.5) {
          this.spawnCool = 0
          this.trySpawn(depth + 1)
          return
        }
        this.pushNews(
          `${slot.flightNo} needs ${standClassLabel(needCls)}+ — class or path missing.`,
          'bad',
        )
        return
      }
      this.delaySlot(slot, 10 + Math.random() * 8, reason)
      if (!anyFree && hosts.length) {
        this.pushNews(
          `${slot.flightNo} holding — emergency ${hosts[0].flightNo} stole ${this.gateLabel(hosts[0].stand)}.`,
          'bad',
        )
      } else if (anyFree) {
        this.pushNews(
          `${slot.flightNo} needs ${standClassLabel(needCls)}+ — class or path missing.`,
          'bad',
        )
      }
      this.spawnCool = 5
      return
    }
    const approach = this.armApproach(route)
    const load = this.applyRivalLoad(this.flightLoad(af, def.persona, def.kind === 'cargo'), def.kind === 'cargo', af.paxMax)
    const gate = this.gateLabel(stand)
    const f: Flight = {
      id: uid('flt'),
      airline: airlineId,
      flightNo: slot.flightNo,
      airframeId: af.id,
      airframeName: af.name,
      pax: load.pax,
      cargo: def.kind === 'cargo',
      craft: 'jet',
      kind: af.kind,
      phase: 'approach',
      stand,
      x: approach.x,
      y: approach.y,
      z: approach.z,
      heading: 0,
      path: approach.path,
      seg: 0,
      t: 0,
      holdAngle: Math.random() * Math.PI * 2,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      scheduleId: slot.id,
      boardingSlow: Math.random() < 0.18,
      destination: pick(ROUTE_CITIES),
      fuelLevel: load.fuelLevel,
      caterLevel: def.kind === 'cargo' ? 1 : 0.18 + Math.random() * 0.2,
      hangarBay: null,
      mxEndsAt: null,
      mxPending: false,
      bagUnits: load.bagUnits,
      bagStage: def.kind === 'cargo' ? 'idle' : 'inflight',
      bagsDeposited: 0,
      claimLane: slot.claimLane ?? null,
    }
    this.flights.push(f)
    if (this.commercialLead[airlineId]) this.commercialLead[airlineId].opened = true
    if (!f.cargo) this.assignClaimLane(f)
    this.bindShowUp(slot, f)
    this.noteCraft(af.kind)
    this.noteSpawnLateness(slot)
    slot.status = 'inbound'
    slot.flightId = f.id
    this.spawnCool = tilesOf(this.tiles, 'tower').length ? 10 : 14
    this.selectedFlight = this.selectedFlight ?? f.id
    const role = craftRoleLabel(af.kind)
    const late = slot.delaySec > 0 ? ` (${Math.round(slot.delaySec)}s late)` : ''
    this.pushNews(
      `${def.name} ${f.flightNo}${late} · ${role} ${af.name} → ${gate}.`,
      slot.delaySec > 0 ? 'bad' : 'ok',
    )
  }

  /** Due pad slots. A busy runway or a full apron does not hold them. */
  private trySpawnContractHelo() {
    const padBusy = this.flights.some(
      (flight) => flight.craft === 'helo' && Boolean(flight.scheduleId) && flight.phase !== 'gone' && flight.phase !== 'takeoff',
    )
    if (this.contractHeloCool > 0 && padBusy) return
    const slot = this.nextPadSlot()
    if (!slot) return
    if (this.isBanned(slot.airline)) {
      slot.status = 'cancelled'
      this.pushNews(`${slot.flightNo} scrubbed — airline banned.`, 'bad')
      return
    }
    if (this.holdLead(slot)) return
    const def = this.airline(slot.airline)
    const picked = this.airframeForSlot(slot, slot.airline, false)
    const af = picked.af
    if (!af || !isHeloAirframe(af)) {
      this.holdPadSlot(slot, 'Helipad')
      return
    }
    this.spawnContractHelo(slot, def, af)
  }

  /** A signed helicopter operator uses a pad and its own metal, not a generic jet. */
  private spawnContractHelo(slot: ScheduleSlot, def: Airline, af: Airframe) {
    const pad = this.freePads()[0]
    if (!pad) {
      const reason = tilesOf(this.tiles, 'helipad').length ? 'Helipad busy' : 'Helipad'
      this.holdPadSlot(slot, reason)
      return
    }
    const load = this.flightLoad(af, def.persona, false)
    const f: Flight = {
      id: uid('helo'),
      airline: slot.airline,
      flightNo: slot.flightNo,
      airframeId: af.id,
      airframeName: af.name,
      pax: load.pax,
      cargo: false,
      craft: 'helo',
      kind: af.kind,
      phase: 'approach',
      stand: pad,
      x: pad.c + 5.5,
      y: pad.r - 4.5,
      z: 11,
      heading: Math.atan2(pad.r - (pad.r - 4.5), pad.c - (pad.c + 5.5)),
      path: [pad],
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      scheduleId: slot.id,
      fuelLevel: load.fuelLevel,
    }
    this.flights.push(f)
    this.noteCraft(af.kind)
    slot.status = 'inbound'
    slot.flightId = f.id
    slot.airframeId = af.id
    if (this.commercialLead[slot.airline]) this.commercialLead[slot.airline].opened = true
    this.contractHeloCool = 8
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(`${def.name} ${f.flightNo} · ${af.name} → pad ${pad.c},${pad.r}.`, 'ok')
  }

  trySpawnHelo() {
    this.heloCool = Math.max(0, this.heloCool)
    if (this.heloCool > 0) return
    const pads = this.freePads()
    if (!pads.length) return
    // Fire station is the AT3-style “you’re serious about rotary” gate.
    if (!tilesOf(this.tiles, 'fire').length) return
    if (this.flights.some((f) => f.craft === 'helo' && f.phase !== 'gone')) return
    // Starved ambulance budget — medevac and exec both cool their heels.
    if (this.budgetOf('ambulance') < 20) {
      if (Math.random() < 0.08) {
        this.pushNews('Choppers overflew — no medics on the pad budget.', 'bad')
      }
      this.heloCool = 20
      return
    }

    const pad = pads[0]
    const medevac = Math.random() < 0.45
    if (medevac && this.budgetOf('ambulance') < 45) {
      // Executives still come; medevac wants real ambulance cover.
      this.heloCool = 12
      return
    }
    const airlineId: AirlineId = this.signed[0] ?? 'harbor'
    this.flightSeq += 1
    const call = medevac ? `MED${this.flightSeq}` : `EXE${this.flightSeq}`
    const af = medevac ? AIRFRAMES.aw139 : AIRFRAMES.s76
    const f: Flight = {
      id: uid('helo'),
      airline: airlineId,
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: af.paxMin + Math.floor(Math.random() * (af.paxMax - af.paxMin + 1)),
      cargo: false,
      craft: 'helo',
      kind: af.kind,
      phase: 'approach',
      stand: pad,
      x: pad.c + 5.5,
      y: pad.r - 4.5,
      z: 11,
      heading: Math.atan2(pad.r - (pad.r - 4.5), pad.c - (pad.c + 5.5)),
      path: [pad],
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
    }
    this.flights.push(f)
    this.noteCraft(af.kind)
    this.heloCool = demandInterval(75 + Math.random() * 40, this.fees)
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(
      medevac
        ? `${call} · Emergency ${af.name} medevac → pad ${pad.c},${pad.r}.`
        : `${call} · Executive ${af.name} inbound.`,
      'ok',
    )
  }

  tickHelo(f: Flight, step: number) {
    if (!f.stand) {
      f.phase = 'gone'
      this.noteCargoCancel(f)
      return
    }
    const pad = f.stand
    if (f.phase === 'approach' || f.phase === 'landing' || f.phase === 'taxi_in') {
      // Straight-in hover to the pad.
      const dx = pad.c - f.x
      const dy = pad.r - f.y
      const dist = Math.hypot(dx, dy)
      f.heading = Math.atan2(dy, dx)
      const speed = 1.9
      if (dist > 0.12) {
        f.x += (dx / dist) * Math.min(dist, speed * step)
        f.y += (dy / dist) * Math.min(dist, speed * step)
      }
      f.z = lerp(f.z, dist < 0.8 ? 0.35 : 2.2, 1 - Math.pow(0.08, step))
      if (dist < 0.2 && f.z < 0.55) {
        f.phase = 'servicing'
        f.phaseTime = 0
        f.z = 0.28
        if (!f.posted.landing) {
          f.posted.landing = true
          this.earn(this.listed(HELO_LANDING, 'helicopterLanding'), `${f.flightNo} pad fee`, f, 'landside_fees')
          this.reputation = Math.min(100, this.reputation + 1)
        }
      } else if (f.phase === 'approach' && f.phaseTime > 1.2) {
        f.phase = 'landing'
      }
      return
    }
    if (f.phase === 'servicing' || f.phase === 'deboard' || f.phase === 'board') {
      f.phase = 'servicing'
      // A pad turn does not wait on a jet bowser. Fuel on the farm is enough to lift.
      if (!f.posted.fuel && this.departureNeedsFuel(f) && this.fuelOnHand()) f.posted.fuel = true
      if (this.fuelOutage(f)) {
        f.fuelHeld = true
        if (f.fuelHeldSince == null) f.fuelHeldSince = this.clock
        this.noteFuelGround(f)
        if (this.clock - f.fuelHeldSince >= FUEL_OUTAGE_SLOT_SEC) this.cancelForFuel(f)
        return
      }
      if (f.fuelHeld) {
        f.fuelHeld = false
        f.phaseTime = 0
        this.fuelHoldNoted.delete(f.id)
        return
      }
      if (f.phaseTime > 7) {
        f.phase = 'takeoff'
        f.phaseTime = 0
        f.heading = Math.random() * Math.PI * 2
      }
      return
    }
    if (f.phase === 'takeoff') {
      f.z += step * 2.8
      f.x += Math.cos(f.heading) * step * 2.1
      f.y += Math.sin(f.heading) * step * 2.1
      if (f.phaseTime > 5 || f.z > 12) {
        f.phase = 'gone'
        this.flightsDone += 1
        this.paxServed += f.pax
        this.noteTurn(f)
        this.grantResearchForFlight(f)
        if (f.kind !== 'military' && f.kind !== 'air_ambulance') {
          this.grantFieldXp(6 + Math.min(8, Math.floor(f.pax / 40)), 'turnaround')
        }
        this.gradeDiplomacyTurn(f)
        this.scoreWave3Turn(f)
        this.noteCargoDepart(f)
        this.pushNews(`${f.flightNo} lifted off the pad.`, 'good')
      }
    }
  }

  releaseHold() {
    const hasTower = tilesOf(this.tiles, 'tower').length > 0
    if (this.groundBusy() && !hasTower) return
    if (!hasTower && this.groundBusy()) return
    const held = this.flights.filter(
      (x) => x.phase === 'hold' && (x.craft ?? 'jet') === 'jet',
    )
    const ranked = [...held].sort((a, b) => (a.stand ? 0 : 1) - (b.stand ? 0 : 1))
    let f: Flight | null = null
    let slot: ScheduleSlot | null = null
    for (const cand of ranked) {
      const booked = cand.scheduleId
        ? (this.schedule.find((row) => row.id === cand.scheduleId) ?? null)
        : null
      if (booked && booked.runwayPref == null) {
        const picked = this.pickBalancedRunway()
        if (picked != null) booked.runwayPref = picked
      }
      const index = this.slotStripIndex(booked?.runwayPref)
      const blocked =
        index == null
          ? this.arrivalOnApproach() || this.runwayStripBusy()
          : this.arrivalOnApproach(index) || this.runwayStripBusy(index)
      if (blocked) continue
      if (
        hasTower &&
        this.flights.some((g) => {
          if (g.phase !== 'landing' && g.phase !== 'takeoff') return false
          if (index == null) return true
          const theirs = this.flightStrip(g)
          return theirs == null || theirs === index
        })
      ) {
        continue
      }
      if (this.atcDeparturesStarved(index)) continue
      f = cand
      slot = booked
      break
    }
    if (!f) return
    const stand = f.stand ?? this.assignStand(slot?.standPref ?? null, undefined, f.airline, f.airframeId)
    if (!stand) return
    const route =
      this.landingRoute(stand, slot?.runwayPref ?? null) ??
      this.landingRoute(stand, null)
    if (!route) {
      // Bad pref path — drop reservation so another hold can try.
      if (f.phaseTime > 40) {
        f.stand = null
        f.path = []
      }
      return
    }
    const inbound = this.armApproach(route)
    f.stand = stand
    f.path = inbound.path
    f.seg = 0
    f.t = 0
    f.phase = 'approach'
    f.phaseTime = 0
    f.z = inbound.z
    f.x = inbound.x
    f.y = inbound.y
    if (Math.random() < 0.4) {
      this.pushNews(
        `${f.flightNo} cleared to ${this.gateLabel(stand)}${hasTower ? ' (tower)' : ''}.`,
        'ok',
      )
    }
  }

  /** Abort ancient holds so reserved gates and inbound slots free up. */
  tickHoldWatchdog(dt: number) {
    for (const f of this.flights) {
      if (f.phase !== 'hold' || (f.craft ?? 'jet') !== 'jet') continue
      if (f.phaseTime < 95) continue
      this.divertFlight(f, `${f.flightNo} diverted after long hold — gate freed, Standing dips.`)
    }
    void dt
  }

  /** Entities the ladder could not clear. The headless soak fails on a non-empty list. */
  stuckOutstanding() {
    return this.stuckWatch.outstanding(this.simMinutes())
  }

  /** One watchdog pass. `tick` calls this after movement; tests can call it on a frozen truck. */
  watchStuck() {
    this.tickStuckWatchdog()
  }

  private tickStuckWatchdog() {
    const actions = this.stuckWatch.observe(this.stuckSamples(this.simMinutes()))
    if (!actions.length) return
    for (const action of actions) {
      const flight = action.kind === 'vehicle' ? undefined : this.flights.find((item) => item.id === action.id)
      const truck = action.kind === 'vehicle' ? this.trucks.find((item) => item.id === action.id) : undefined
      const x0 = flight?.x ?? truck?.x
      const y0 = flight?.y ?? truck?.y
      const outcome = this.applyStuckRecovery(action)
      const x1 = flight?.x ?? truck?.x
      const y1 = flight?.y ?? truck?.y
      if (x0 != null && y0 != null && x1 != null && y1 != null && (x0 !== x1 || y0 !== y1)) this.recoveryJumps += 1
      this.recoveryCount += 1
      this.recoveryLog.unshift({
        atMin: this.simMinutes(),
        id: action.id,
        label: action.label,
        kind: action.kind,
        state: action.state,
        step: action.step,
        reason: outcome.reason,
        detail: outcome.detail,
      })
      if (this.recoveryLog.length > STUCK_WATCH.logCap) this.recoveryLog.length = STUCK_WATCH.logCap
      const line = `${outcome.detail} reason:${outcome.reason}`
      this.pushNews(line, action.step === 'cancel' ? 'bad' : 'ok')
      this.raiseAlert({
        key: `event:recovery:${action.kind}:${action.id}`,
        severity: action.step === 'cancel' ? 'warning' : 'info',
        title: `${action.label} ${outcome.reason}`,
        detail: line,
        event: true,
      })
    }
    this.emit()
  }

  private stuckSamples(nowMin: number): WatchSample[] {
    const hard = new Set<string>()
    for (const flight of this.flights) {
      if (this.flightHardStuck(flight)) hard.add(flight.id)
    }
    const out: WatchSample[] = []
    for (const flight of this.flights) {
      if (flight.phase === 'gone') continue
      const moving = STUCK_MOVING_PHASES.has(flight.phase)
      const hardStuck = hard.has(flight.id)
      if (flight.phase === 'pushback' && flight.phaseTime < STUCK_WATCH.pushbackGraceSec) continue
      if (!hardStuck && !moving) continue
      if (moving && !hardStuck && this.holdIsAuthorized(flight, hard)) continue
      out.push({
        id: flight.id,
        kind: moving ? 'aircraft' : 'flight',
        state: flight.phase,
        token: this.flightStallToken(flight),
        nowMin,
        label: flight.flightNo,
      })
    }
    for (const truck of this.trucks) {
      if (truck.patrol || truck.dwell > 0 || truck.preDwell > 0) continue
      if (truck.kind === 'contractor' || truck.kind === 'delivery') continue
      out.push({
        id: truck.id,
        kind: 'vehicle',
        state: truck.mission,
        token: `${truck.mission}|${this.stuckPos(truck.x)}|${this.stuckPos(truck.y)}|${truck.seg}|${this.stuckPos(truck.t)}`,
        nowMin,
        label: `${truck.kind} ${truck.mission}`,
      })
    }
    return out
  }

  /** Dead boarding, or a taxi path that leaves the graph. These are stalls, not queues. */
  private flightHardStuck(flight: Flight): boolean {
    if (flight.phase === 'gone' || flight.phase === 'hold' || flight.phase === 'parked' || flight.phase === 'mx_bay') {
      return false
    }
    if (flight.fuelHeld) return false
    if ((flight.craft ?? 'jet') === 'helo' && (flight.phase === 'servicing' || flight.phase === 'board' || flight.phase === 'deboard')) {
      return false
    }
    if (flight.phase === 'board' || flight.phase === 'deboard') {
      const outbound = flight.phase === 'board'
      const waiting = outbound ? flight.waitingOn.paxIn : flight.waitingOn.paxOut
      if (waiting > 0) {
        const job = outbound ? 'board' : 'arrive'
        const walkers = this.people.some((person) => person.flightId === flight.id && person.job === job)
        const bus = this.trucks.some((truck) => truck.flightId === flight.id && truck.kind === 'termbus')
        if (!walkers && !bus) return true
      }
    }
    const rolling =
      flight.phase === 'taxi_in' ||
      flight.phase === 'taxi_out' ||
      flight.phase === 'pushback' ||
      flight.phase === 'mx_taxi' ||
      flight.phase === 'mx_return'
    return rolling && flight.path.length >= 2 && !this.taxiRouteReady(flight)
  }

  /**
   * Legal taxi or runway hold. The stuck alert counts phase time, so these
   * seconds must not accumulate or a queued departure looks frozen.
   */
  private taxiHoldPaused(flight: Flight): boolean {
    const wait = this.atc.waitFor(flight.id)
    if (!wait || (wait.reason !== 'taxi' && wait.reason !== 'runway')) return false
    const ageMin = Math.max(0, this.clock - wait.since) * SIM_MINUTES_PER_REAL_SECOND
    if (ageMin >= STUCK_WATCH.authorizedHoldMin) return false
    if (wait.blocker) {
      const blocker = this.flights.find((other) => other.id === wait.blocker && other.phase !== 'gone')
      if (!blocker || this.flightHardStuck(blocker)) return false
    }
    return true
  }

  /** A live ground-control hold inside the legal window is progress, not a stall. */
  private holdIsAuthorized(flight: Flight, hard: ReadonlySet<string>): boolean {
    const wait = this.atc.waitFor(flight.id)
    if (!wait) return false
    const ageMin = Math.max(0, this.clock - wait.since) * SIM_MINUTES_PER_REAL_SECOND
    if (ageMin >= STUCK_WATCH.authorizedHoldMin) return false
    if (wait.blocker && hard.has(wait.blocker)) return false
    if (wait.blocker && !this.flights.some((other) => other.id === wait.blocker && other.phase !== 'gone')) return false
    return wait.reason === 'runway' || wait.reason === 'taxi'
  }

  private flightStallToken(flight: Flight): string {
    return [
      flight.phase,
      this.stuckPos(flight.x),
      this.stuckPos(flight.y),
      flight.seg,
      this.stuckPos(flight.t),
      flight.waitingOn.paxIn,
      flight.waitingOn.paxOut,
    ].join('|')
  }

  private stuckPos(value: number): number {
    return Math.round(value * 20) / 20
  }

  private applyStuckRecovery(action: RecoveryAction): { detail: string; reason: string } {
    if (action.kind === 'vehicle') return this.applyStuckTruck(action)
    const flight = this.flights.find((item) => item.id === action.id)
    if (!flight || flight.phase === 'gone') return { detail: `${action.label} already gone.`, reason: 'gone' }
    if (action.step === 'repath') {
      this.repathStuckFlight(flight)
      return { detail: `${flight.flightNo} re-pathed while ${flight.phase.replace('_', ' ')}.`, reason: 'repath' }
    }
    if (action.step === 'release') {
      this.releaseStuckFlight(flight)
      return { detail: `${flight.flightNo} reservation released.`, reason: 'release-reservation' }
    }
    if (action.step === 'holdshort') {
      if (this.rollToOpenNode(flight)) {
        return {
          detail: `${flight.flightNo} rolling to the nearest open node.`,
          reason: 'drive',
        }
      }
      this.holdShortStuckFlight(flight)
      return {
        detail: `${flight.flightNo} holding short at ${Math.round(flight.x)},${Math.round(flight.y)}.`,
        reason: 'hold-short',
      }
    }
    const refund = this.cancelStuckFlight(flight)
    return {
      detail: `${flight.flightNo} cancelled — refunded $${refund.toLocaleString('en-US')} of the fees already taken. Clear the taxi or add a stand so the next arrival is not stuck.`,
      reason: 'cancel-refund',
    }
  }

  private repathStuckFlight(flight: Flight) {
    if (flight.phase === 'board' || flight.phase === 'deboard' || flight.phase === 'servicing') {
      if (!flight.stand) return
      const served = this.people.some((person) => person.flightId === flight.id)
      const truck = this.trucks.some((item) => item.flightId === flight.id)
      if (!served) {
        flight.waitingOn.paxIn = 0
        flight.waitingOn.paxOut = 0
      }
      if (!truck) {
        flight.waitingOn.bags = false
        flight.waitingOn.bagsLoad = false
        flight.waitingOn.fuel = false
        flight.waitingOn.catering = false
        flight.posted.bags = true
        flight.posted.bagsLoad = true
        flight.posted.fuel = true
        flight.posted.catering = true
      }
      if (flight.stand) {
        flight.path = this.pushbackPath(flight.stand, flight.heading)
        flight.seg = 0
        flight.t = 0
        flight.phase = 'pushback'
        flight.phaseTime = 0
        this.atcPaths.delete(flight.id)
      }
      return
    }
    if (flight.phase === 'landing' || flight.phase === 'taxi_in' || flight.phase === 'approach') {
      if (!flight.stand) return
      const route = this.landingRoute(flight.stand)
      if (!route || route.length < 2) return
      const here = { c: Math.round(flight.x), r: Math.round(flight.y) }
      let start = 0
      let best = Number.POSITIVE_INFINITY
      route.forEach((cell, index) => {
        const dist = Math.abs(cell.c - here.c) + Math.abs(cell.r - here.r)
        if (dist < best) {
          best = dist
          start = index
        }
      })
      const next = route.slice(start)
      flight.path = next.length >= 2 ? next : route.slice(-2)
      flight.seg = 0
      flight.t = 0
      this.atcPaths.delete(flight.id)
      return
    }
    if (flight.phase === 'taxi_out' || flight.phase === 'pushback' || flight.phase === 'mx_return' || flight.phase === 'mx_taxi') {
      if (!flight.stand) return
      const out = this.departurePath(flight)
      if (!out || out.length < 2 || !jetRouteOnGraph(this.tiles, out)) return
      flight.path = out
      flight.seg = 0
      flight.t = 0
      if (flight.phase !== 'taxi_out') {
        flight.phase = 'taxi_out'
        flight.phaseTime = 0
      }
      this.atcPaths.delete(flight.id)
    }
  }

  private releaseStuckFlight(flight: Flight) {
    const wait = this.atc.waitFor(flight.id)
    if (wait?.blocker) {
      const blocker = this.flights.find((other) => other.id === wait.blocker)
      if (blocker && this.flightHardStuck(blocker)) {
        this.atc.release(blocker.id)
        this.atcPaths.delete(blocker.id)
      }
    }
    this.atc.release(flight.id)
    this.atcPaths.delete(flight.id)
  }

  /**
   * Roll from the current cell onto the departure route, or to the runway.
   * The path starts at the live coordinates, so the next frame does not jump.
   */
  private rollToOpenNode(flight: Flight): boolean {
    this.atc.release(flight.id)
    this.atcPaths.delete(flight.id)
    const from = { c: Math.round(flight.x), r: Math.round(flight.y) }
    if (!inBounds(from.c, from.r) || !walkableFor('jet', this.tiles[from.r][from.c])) return false
    const out = flight.stand ? this.departurePath(flight) : null
    let path: Vec[] | null = null
    if (out && out.length >= 2) {
      const join = pathToNearest(this.tiles, from, out, 'jet')
      if (join && join.length >= 2) {
        const end = join[join.length - 1]
        const at = out.findIndex((cell) => cell.c === end.c && cell.r === end.r)
        path = [...join.slice(0, -1), ...out.slice(at < 0 ? 0 : at)]
      }
    }
    if (!path || path.length < 2) {
      const runway = tilesOf(this.tiles, 'runway')
      const goals = runway.length ? runway : [...tilesOf(this.tiles, 'taxi'), ...tilesOf(this.tiles, 'stand')]
      path = pathToNearest(this.tiles, from, goals, 'jet')
    }
    if (!path || path.length < 2 || !jetRouteOnGraph(this.tiles, path)) return false
    flight.path = this.anchorRoute(flight.x, flight.y, path, 'jet')
    flight.seg = 0
    flight.t = 0
    return true
  }

  /** Keep the first step on the entity. A route that starts on another cell is not used. */
  private anchorRoute(x: number, y: number, path: Vec[], kind: 'jet' | 'truck'): Vec[] {
    const first = path[0]
    if (!first) return path
    if (Math.abs(x - first.c) < 1e-4 && Math.abs(y - first.r) < 1e-4) return path
    if (Math.round(x) !== Math.round(first.c) || Math.round(y) !== Math.round(first.r)) return path
    const anchored = [{ c: x, r: y }, ...path.slice(1)]
    if (kind === 'jet' && !jetRouteOnGraph(this.tiles, anchored)) return path
    return anchored
  }

  /** Stay on the current coordinates and give the reservation back. */
  private holdShortStuckFlight(flight: Flight) {
    this.atc.release(flight.id)
    this.atcPaths.delete(flight.id)
  }

  private driveStuckTruck(truck: Truck): boolean {
    const from = { c: Math.round(truck.x), r: Math.round(truck.y) }
    if (!inBounds(from.c, from.r) || !walkableFor('truck', this.tiles[from.r][from.c])) return false
    const goal = truck.home ?? tilesOf(this.tiles, 'road')[0] ?? tilesOf(this.tiles, 'taxi')[0]
    if (!goal) return false
    const path = pathToNearest(this.tiles, from, [goal], 'truck')
    if (!path || path.length < 2) return false
    truck.path = this.anchorRoute(truck.x, truck.y, path, 'truck')
    truck.seg = 0
    truck.t = 0
    truck.dwell = 0
    truck.preDwell = 0
    truck.returning = true
    truck.flightId = null
    return true
  }

  private cancelStuckFlight(flight: Flight): number {
    const collected = flight.ledger.reduce((sum, line) => sum + (line.amount > 0 ? line.amount : 0), 0)
    const raw = collected > 0 ? Math.round(collected) : STUCK_WATCH.minRefund
    const refund = Math.min(STUCK_WATCH.maxRefund, raw)
    this.charge(refund, 'penalties', this.simMinutes(), 'Cancel refund')
    this.atc.release(flight.id)
    this.atcPaths.delete(flight.id)
    this.trucks = this.trucks.filter((truck) => truck.flightId !== flight.id)
    this.people = this.people.filter((person) => person.flightId !== flight.id)
    if (flight.scheduleId) {
      const slot = this.schedule.find((item) => item.id === flight.scheduleId)
      if (slot && slot.status !== 'done') slot.status = 'cancelled'
    }
    flight.phase = 'gone'
    flight.phaseTime = 0
    flight.path = []
    this.noteCargoCancel(flight)
    this.noteWave3(flight.id, flight.airline, classifyTurn({ cancelled: true }))
    return refund
  }

  private applyStuckTruck(action: RecoveryAction): { detail: string; reason: string } {
    const truck = this.trucks.find((item) => item.id === action.id)
    if (!truck) return { detail: `${action.label} already gone.`, reason: 'gone' }
    if (action.step === 'repath') {
      this.repathStuckTruck(truck)
      return { detail: `${action.label} re-pathed.`, reason: 'repath' }
    }
    if (action.step === 'release') {
      truck.flightId = null
      truck.returning = true
      return { detail: `${action.label} released from its stop.`, reason: 'release-reservation' }
    }
    if (action.step === 'holdshort') {
      if (this.driveStuckTruck(truck)) {
        return { detail: `${action.label} released and driving back.`, reason: 'drive' }
      }
      truck.flightId = null
      truck.returning = true
      return { detail: `${action.label} holding short — no road back.`, reason: 'hold-short' }
    }
    this.trucks = this.trucks.filter((item) => item.id !== truck.id)
    return { detail: `${action.label} removed — call cancelled.`, reason: 'cancel-refund' }
  }

  private repathStuckTruck(truck: Truck) {
    const from = { c: Math.round(truck.x), r: Math.round(truck.y) }
    const flight = truck.flightId ? this.flights.find((item) => item.id === truck.flightId) : null
    const goal = flight?.stand ?? truck.home
    if (!goal) return
    const path = nearestPath(this.tiles, from, [goal], 'truck')
    if (!path || path.length < 2) return
    truck.path = path
    truck.seg = 0
    truck.t = 0
    truck.dwell = 0
    truck.preDwell = 0
  }

  /**
   * Nearby jets and trucks slow everyone — bad layouts jam.
   * A departure taxiing out feels the apron crowd once, not once per passenger.
   * A belt full of walkers used to freeze the taxi (congestion 10+). Arrivals
   * still feel every nearby walker, so a turn does not finish early.
   */
  congestionAt(x: number, y: number, selfId?: string): number {
    let n = 0
    const R = 1.15
    const self = selfId ? this.flights.find((flight) => flight.id === selfId) : undefined
    const departing = self?.phase === 'taxi_out'
    for (const f of this.flights) {
      if (f.id === selfId || f.phase === 'gone' || f.phase === 'hold') continue
      if (
        (f.craft ?? 'jet') === 'jet' &&
        (f.phase === 'taxi_in' ||
          f.phase === 'taxi_out' ||
          f.phase === 'pushback' ||
          f.phase === 'mx_taxi' ||
          f.phase === 'mx_return' ||
          f.phase === 'landing')
      ) {
        if (Math.hypot(f.x - x, f.y - y) < R) n++
      }
    }
    for (const t of this.trucks) {
      if (t.id === selfId) continue
      if (Math.hypot(t.x - x, t.y - y) < R) n++
    }
    if (departing) {
      for (const p of this.people) {
        if (p.job !== 'arrive' && p.job !== 'board' && p.job !== 'mechanic') continue
        if (Math.hypot(p.x - x, p.y - y) < R) {
          n += 1
          break
        }
      }
    } else {
      for (const p of this.people) {
        if (p.id === selfId) continue
        if (p.job !== 'arrive' && p.job !== 'board' && p.job !== 'mechanic') continue
        if (Math.hypot(p.x - x, p.y - y) < R) n++
      }
    }
    return n
  }


  // ── Ground traffic control ────────────────────────────────────────────

  private atcRoleOf(f: Flight): AtcRole | null {
    if ((f.craft ?? 'jet') !== 'jet') return null
    switch (f.phase) {
      case 'approach':
      case 'landing':
      case 'taxi_in':
        return 'arrival'
      case 'pushback':
      case 'taxi_out':
      case 'takeoff':
        return 'departure'
      case 'mx_taxi':
      case 'mx_return':
        return 'taxi'
      default:
        return null
    }
  }

  /** Cell → runway strip ids, rebuilt when the layout changes. */
  private atcStripCache: { tiles: Tile[][]; sig: string; map: Map<string, string[]> } | null = null
  private atcRunwayMap(): Map<string, string[]> {
    const strips = runwayStrips(this.tiles, MIN_RUNWAY)
    const sig = strips.map((st) => `${st[0]?.c},${st[0]?.r}:${st.length}`).join('|')
    if (this.atcStripCache && this.atcStripCache.tiles === this.tiles && this.atcStripCache.sig === sig) {
      return this.atcStripCache.map
    }
    const map = new Map<string, string[]>()
    strips.forEach((st, i) => {
      const id = `rw${i}:${st[0]?.c},${st[0]?.r}`
      for (const p of st) {
        const k = `${p.c},${p.r}`
        map.set(k, [...(map.get(k) ?? []), id])
      }
    })
    this.atcStripCache = { tiles: this.tiles, sig, map }
    return map
  }

  private atcRoute(path: readonly Vec[]): RouteCell[] {
    const rmap = this.atcRunwayMap()
    return path.map((p) => {
      const c = Math.round(p.c)
      const r = Math.round(p.r)
      const key = `${c},${r}`
      if (!inBounds(c, r)) return { key: `air:${key}`, kind: 'air', runways: [] }
      const runways = this.tiles[r]?.[c] === 'runway' ? rmap.get(key) ?? [] : []
      return { key, kind: runways.length ? 'runway' : 'ground', runways }
    })
  }

  private atcRank(f: Flight): number {
    if (f.phase === 'landing' && this.atc.holdsRunway(f.id)) return RIGHT_OF_WAY.vacating
    if (f.phase === 'taxi_out' || f.phase === 'pushback') return RIGHT_OF_WAY.departure
    return RIGHT_OF_WAY.taxi
  }

  /** Keep the controller in step with every jet's phase and path. */
  tickAtc(step: number) {
    this.atc.now = this.clock
    this.atc.arbitrate()
    const live = new Set<string>()
    for (const f of this.flights) {
      const role = f.phase === 'gone' ? null : this.atcRoleOf(f)
      if (!role) continue
      live.add(f.id)
      if (f.phase === 'takeoff') continue
      if (this.atcPaths.get(f.id) !== f.path) {
        this.atcPaths.set(f.id, f.path)
        this.atc.register(f.id, role, this.atcRoute(f.path), Math.max(0, Math.min(f.seg, f.path.length - 1)))
      }
    }
    for (const id of this.atc.ids()) {
      if (live.has(id)) continue
      this.atc.release(id)
      this.atcPaths.delete(id)
      this.atcYields.delete(id)
    }
    // Safety net: break any wait cycle by making the weakest aircraft yield.
    for (const cycle of this.atc.deadlocks()) {
      const ranked = cycle
        .map((id) => this.flights.find((f) => f.id === id))
        .filter((f): f is Flight => !!f)
        .sort((a, b) => this.atcRank(b) - this.atcRank(a))
      const loser = ranked[0]
      if (!loser) continue
      const n = (this.atcYields.get(loser.id) ?? 0) + 1
      this.atcYields.set(loser.id, n)
      if (n <= 2) {
        this.atc.yieldTo(loser.id)
      } else if (loser.stand && (loser.phase === 'taxi_out' || loser.phase === 'pushback')) {
        // Still gridlocked: tug the departure back onto its stand to clear the lane.
        this.atc.release(loser.id)
        this.atcPaths.delete(loser.id)
        loser.x = loser.stand.c
        loser.y = loser.stand.r
        loser.path = [loser.stand]
        loser.seg = 0
        loser.t = 0
        loser.phase = 'pushback'
        loser.phaseTime = 0
        this.atcYields.delete(loser.id)
        this.pushNews(`${loser.flightNo} towed back to stand to clear a gridlock.`, 'bad')
      } else {
        this.atc.yieldTo(loser.id)
      }
      const spot = loser.path[loser.seg] ?? loser.stand
      this.raiseAlert({
        key: `event:atc-gridlock`,
        severity: 'critical',
        title: 'Taxiway gridlock',
        detail: `${cycle.length} aircraft blocked each other. ${loser.flightNo} gave way. Add a second lane or a bypass here.`,
        at: spot ? { view: 'apron', cells: [{ c: Math.round(spot.c), r: Math.round(spot.r) }] } : undefined,
        event: true,
      })
    }
    void step
  }

  /** followPath, capped at the furthest cell ground control has cleared. */
  private atcFollow(f: Flight, speed: number, dt: number): boolean {
    if (!this.atc.has(f.id) || this.atcPaths.get(f.id) !== f.path) return this.followPath(f, speed, dt)
    const lim = this.atc.limit(f.id, this.atcRank(f))
    let done: boolean
    if (lim >= f.path.length - 1) {
      done = this.followPath(f, speed, dt)
    } else if (f.seg >= lim) {
      // Holding position at the edge of the clearance.
      f.t = 0
      const here = f.path[Math.min(f.seg, f.path.length - 1)]
      if (here) {
        f.x = here.c
        f.y = here.r
      }
      done = false
    } else {
      const proxy = { id: f.id, x: f.x, y: f.y, heading: f.heading, path: f.path.slice(0, lim + 1), seg: f.seg, t: f.t }
      this.followPath(proxy, speed, dt)
      f.x = proxy.x
      f.y = proxy.y
      f.heading = proxy.heading
      f.seg = proxy.seg
      f.t = proxy.seg >= lim ? 0 : proxy.t
      done = false
    }
    this.atc.progress(f.id, Math.min(f.seg, f.path.length - 1), f.t > 0)
    return done
  }

  /** Runway ids on the arrival's remaining path (empty once past the runway). */
  private atcRunwaysAhead(f: Flight): string[] {
    const route = this.atcRoute(f.path.slice(Math.max(0, f.seg), Math.max(0, f.seg) + 6))
    const cell = route.find((c) => c.kind === 'runway')
    return cell ? [...cell.runways] : []
  }

  /** The arrival is over the threshold within the next step: clearance is due now. */
  private atcTouchdownDue(f: Flight, dist: number): boolean {
    const next = f.path[f.seg + 1]
    if (!next) return true
    const route = this.atcRoute([next])
    return route[0]?.kind === 'runway' || dist < 1.2
  }

  /** Runway not clear on short final: go around and come back, or divert at the cap. */
  goAround(f: Flight) {
    this.atc.offFinal(f.id)
    this.atc.release(f.id)
    this.atcPaths.delete(f.id)
    f.goArounds = (f.goArounds ?? 0) + 1
    const fuel = 260 + Math.round((AIRFRAMES[f.airframeId]?.seats ?? 150) * 1.2)
    this.charge(fuel, 'penalties', this.simMinutes(), 'Go-around delay')
    this.adjustHeat(f.airline, -0.6)
    this.reputation = Math.max(0, this.reputation - 0.25)
    if (f.scheduleId) {
      const slot = this.schedule.find((s) => s.id === f.scheduleId)
      if (slot) this.nudgeSlot(slot, 25, 'Go-around: runway not clear')
    }
    if (f.goArounds >= ATC_MAX_GO_AROUNDS) {
      this.divertFlight(f, `${f.flightNo} diverted after ${f.goArounds} go-arounds — runway kept blocked.`)
      return
    }
    f.phase = 'hold'
    f.phaseTime = 0
    f.path = []
    f.seg = 0
    f.t = 0
    f.z = 9
    this.pushNews(`${f.flightNo} go-around — runway not clear. Fuel ${moneyLeft(fuel)}.`, 'bad')
    const rw = this.flights.find((x) => x.id !== f.id && this.atc.holdsRunway(x.id))
    const spot = rw ? { c: Math.round(rw.x), r: Math.round(rw.y) } : null
    this.raiseAlert({
      key: 'event:atc-go-around',
      severity: 'warning',
      title: 'Go-around',
      detail: `${f.flightNo} could not land: the runway or its exit was blocked. More exits or a second runway help.`,
      at: spot ? { view: 'apron', cells: [spot] } : undefined,
      event: true,
    })
  }

  /** Send an inbound elsewhere: free the stand, scrub the slot, ding standing. */
  divertFlight(f: Flight, news: string) {
    this.atc.release(f.id)
    this.atcPaths.delete(f.id)
    this.missDivertedConnections(f)
    if (f.stand) f.stand = null
    f.path = []
    f.phase = 'gone'
    f.phaseTime = 0
    this.noteCargoCancel(f)
    if (f.scheduleId) {
      const slot = this.schedule.find((s) => s.id === f.scheduleId)
      if (slot) {
        slot.status = 'cancelled'
        slot.delayReason = 'diverted'
      }
    }
    this.adjustHeat(f.airline, -4)
    this.reputation = Math.max(0, this.reputation - 1)
    this.noteDiplomacyCancel(f.airline, false)
    this.noteWave3(f.id, f.airline, classifyTurn({ diverted: true }))
    this.pushNews(news, 'bad')
    this.raiseAlert({
      key: 'event:inbound-failed',
      severity: 'critical',
      title: 'Inbound flight diverted',
      detail: `${f.flightNo} went elsewhere. Free a stand or a runway slot.`,
      event: true,
    })
  }

  /** Departures stuck at a hold line long enough that arrivals should wait in the stack. */
  atcDeparturesStarved(index?: number | null): boolean {
    return this.atc.waiting().some((w) => {
      if (w.reason !== 'runway' || this.clock - w.since <= ATC_DEPARTURE_STARVE_SEC) return false
      if (index == null) return true
      const flight = this.flights.find((row) => row.id === w.id)
      if (!flight) return true
      const strips = this.stripsForDeparture(flight)
      return strips.length === 0 || strips.includes(index)
    })
  }

  /** Short label for an aircraft held by ground control, or null. */
  atcHoldLabel(f: Flight): string | null {
    const w = this.atc.waitFor(f.id)
    if (!w || this.clock - w.since < 1.5) return null
    if (w.reason === 'runway') return 'Holding short of the runway'
    const other = w.blocker ? this.flights.find((x) => x.id === w.blocker) : null
    return other ? `Holding for ${other.flightNo}` : 'Holding for traffic'
  }

  /** Long waits grouped by where they stand, for the alert stack. */
  atcQueues(): { cell: Vec; count: number; runway: boolean; longest: number }[] {
    const groups = new Map<string, { cell: Vec; count: number; runway: boolean; longest: number }>()
    for (const w of this.atc.waiting()) {
      const f = this.flights.find((x) => x.id === w.id)
      if (!f) continue
      const wait = this.clock - w.since
      const blocker = w.blocker ? this.flights.find((x) => x.id === w.blocker) : null
      const anchor = blocker && w.reason !== 'runway' ? blocker : f
      const cell = { c: Math.round(anchor.x), r: Math.round(anchor.y) }
      const k = w.reason === 'runway' ? `rw:${cell.c},${cell.r}` : `tx:${anchor.id}`
      const g = groups.get(k) ?? { cell, count: 0, runway: w.reason === 'runway', longest: 0 }
      g.count += 1
      g.longest = Math.max(g.longest, wait)
      groups.set(k, g)
    }
    return [...groups.values()]
  }

  followPath(
    ent: {
      id?: string
      x: number
      y: number
      heading?: number
      path: Vec[]
      seg: number
      t: number
    },
    speed: number,
    dt: number,
  ): boolean {
    if (!ent.path.length) return true
    if (ent.seg >= ent.path.length - 1) {
      const last = ent.path[ent.path.length - 1]
      ent.x = last.c
      ent.y = last.r
      return true
    }
    const cong = this.congestionAt(ent.x, ent.y, ent.id)
    if (cong > this.congPeak) this.congPeak = cong
    const factor = 1 / (1 + Math.max(0, cong) * 0.65)
    // Waste ≈ extra time vs clear pavement — feeds readable jam news (E2).
    if (cong >= 2) {
      this.congWasteAcc += dt * (1 / factor - 1)
    }
    const a = ent.path[ent.seg]
    const b = ent.path[ent.seg + 1]
    const dist = Math.abs(b.c - a.c) + Math.abs(b.r - a.r) || 1
    ent.t += (speed * factor * dt) / dist
    while (ent.t >= 1 && ent.seg < ent.path.length - 1) {
      ent.t -= 1
      ent.seg += 1
      if (ent.seg >= ent.path.length - 1) {
        const last = ent.path[ent.path.length - 1]
        ent.x = last.c
        ent.y = last.r
        return true
      }
    }
    const a2 = ent.path[Math.min(ent.seg, ent.path.length - 1)]
    const b2 = ent.path[Math.min(ent.seg + 1, ent.path.length - 1)]
    ent.x = lerp(a2.c, b2.c, clamp(ent.t, 0, 1))
    ent.y = lerp(a2.r, b2.r, clamp(ent.t, 0, 1))
    ent.heading = Math.atan2(b2.r - a2.r, b2.c - a2.c)
    return false
  }

  roomsAt(stand: Vec | null): TerminalFit | null {
    if (!this.fits.length) return null
    if (!stand) return this.fits[0]
    const jet = this.jetwayHall(stand)
    if (jet) return jet
    let best = this.fits[0]
    let bestD = 99
    for (const f of this.fits) {
      const d = Math.abs(f.origin.c - stand.c) + Math.abs(f.origin.r - stand.r)
      if (d < bestD) {
        best = f
        bestD = d
      }
    }
    return best
  }

  beginServicing(f: Flight) {
    if (!f.stand) return
    this.armGroundTurn(f)
    const airline = this.airline(f.airline)
    if (!f.posted.landing) {
      f.posted.landing = true
      if (f.kind === 'military') {
        const mult = AIRFRAMES[f.airframeId]?.landingMult ?? 1
        this.earn(Math.round(MIL_LANDING * mult), `${f.flightNo} ${f.airframeName} landing`, f)
      } else if (f.kind === 'air_ambulance') {
        this.earn(AIR_AMBULANCE_FEE, `${f.flightNo} ${f.airframeName}`, f)
      } else {
        const relFee = relationshipLandingFactor(this.wave3.feeFactor(f.airline))
        const mult = (AIRFRAMES[f.airframeId]?.landingMult ?? 1) * this.landingFeeMult(f.airline) * relFee
        const base = Math.round(airline.landing * mult)
        this.earn(
          this.contractBill(f, this.listed(base, 'landingPerTonne'), 'landing', 'landing'),
          `${f.flightNo} landing (${f.airframeName})`,
          f,
          'landing_fees',
        )
        const missed = Math.min(Math.max(0, Math.floor(f.pax)), this.curbFeeMisses)
        this.curbFeeMisses -= missed
        const paying = Math.max(0, f.pax - missed)
        this.earn(
          this.contractBill(f, this.afterRivalMargin(paying * this.fees.paxFee), 'landing', 'pax'),
          missed > 0 ? `${f.flightNo} passenger fees (${missed} missed check-in)` : `${f.flightNo} passenger fees`,
          f,
          'passenger_fees',
          false,
        )
        if (this.negotiationBridge?.signedTerms(f.airline)) {
          this.earn(
            this.contractBill(f, this.listed(GA_PARK_DAY_RATE, 'aircraftParkingPerDay'), 'service', 'parking'),
            `${f.flightNo} aircraft parking`,
            f,
            'parking_fees',
            false,
          )
        }
      }
      if (
        (f.craft ?? 'jet') === 'jet' &&
        f.kind !== 'military' &&
        f.kind !== 'air_ambulance' &&
        this.mxSigned.includes(f.airline) &&
        tilesOf(this.tiles, 'hangar').length &&
        this.mechanics > 0 &&
        this.budgetOf('maintenance') >= 40
      ) {
        const pay = Math.round(
          airline.landing * (airline.kind === 'cargo' ? 0.22 : 0.18) + this.mechanics * 120,
        )
        // Plane will taxi to hangar after stand services — not a sidewalk mechanic.
        f.mxPending = true
        f.mxPay = pay
      } else if (
        this.mxSigned.includes(f.airline) &&
        (this.mechanics < 1 || this.budgetOf('maintenance') < 40)
      ) {
        this.pushNews(
          `${airline.name} MX skipped — need funded mechanics in the hangar.`,
          'bad',
        )
      }
    }

    if (f.kind === 'military' || f.kind === 'air_ambulance') {
      // Quick turn — fuel only if farm exists; no hall / bags circus.
      const farmsQuick = tilesOf(this.tiles, 'fuel').filter((p) =>
        farmBesidePavement(this.tiles, p),
      )
      if (
        !f.groundTurn &&
        this.fuelBrand &&
        this.fuelLoads > 0 &&
        farmsQuick.length &&
        nearestPath(this.tiles, farmsQuick[0], [f.stand], 'truck')
      ) {
        const p = nearestPath(this.tiles, farmsQuick[0], [f.stand], 'truck')
        if (p) {
          f.waitingOn.fuel = true
          this.spawnTruck('fuel', f, p, 'fuel', farmsQuick[0])
        }
      }
      return
    }

    if (f.cargo) {
      const shed = tilesOf(this.tiles, 'cargo')
      if (shed.length && f.stand) {
        const cargoPath = nearestPath(this.tiles, shed[0], [f.stand], 'truck')
        if (cargoPath) {
          // Shed → freighter uplift needs staged warehouse stock (city trucks fill it).
          const need = clamp(18 + Math.floor(f.pax / 8), 18, 48)
          if (this.cargoWarehouse < need * 0.35) {
            f.waitingOn.bags = true
            this.adjustHeat(f.airline, -2.4)
            this.pushNews(
              `${f.flightNo} late uplift — warehouse thin (${this.cargoWarehouse}u). City trucks / guard pipeline.`,
              'bad',
            )
          }
          f.waitingOn.bags = true
          this.spawnTruck('bags', f, cargoPath, 'unload', shed[0])
          const tr = this.trucks[this.trucks.length - 1]
          if (tr?.kind === 'bags') {
            const take = Math.min(this.cargoWarehouse, need)
            this.cargoWarehouse = Math.max(0, this.cargoWarehouse - take)
            tr.cargoUnits = take > 0 ? take : 6
            tr.preDwell = take > 0 ? 1.2 + take * 0.04 : 2.8
          }
        }
      }
    }

    const bagBuild = tilesOf(this.tiles, 'bags')
    const snackBuild = tilesOf(this.tiles, 'snack')
    const farms = tilesOf(this.tiles, 'fuel').filter((p) =>
      farmBesidePavement(this.tiles, p),
    )
    const fit = this.roomsAt(f.stand)

    if (!f.cargo) {
      // Arrival unload: shed → plane → claim/sort at shed → continue or park.
      if (bagBuild.length > 0 && f.stand) {
        this.noteBagBeltIssue(f)
        const bagPath = nearestPath(this.tiles, bagBuild[0], [f.stand], 'truck')
        if (bagPath) {
          f.waitingOn.bags = true
          this.spawnTruck('bags', f, bagPath, 'unload', bagBuild[0])
        }
      }
      const snackPath =
        this.caterBrand && snackBuild.length > 0 && f.stand
          ? nearestPath(this.tiles, snackBuild[0], [f.stand], 'truck')
          : null
      if (!f.groundTurn && snackPath) {
        f.waitingOn.catering = true
        this.spawnTruck('catering', f, snackPath, 'cater', snackBuild[0])
      }
      // Cabin clean — AT/CEO turnaround service. Posts only after the jet is on stand.
      if (!f.posted.catering) {
        /* cleaning is timed during servicing, paid once below */
      }
    }

    if (
      !f.groundTurn &&
      this.fuelBrand &&
      this.fuelLoads > 0 &&
      farms.length &&
      nearestPath(this.tiles, farms[0], [f.stand], 'truck')
    ) {
      const p = nearestPath(this.tiles, farms[0], [f.stand], 'truck')
      if (p) {
        f.waitingOn.fuel = true
        this.spawnTruck('fuel', f, p, 'fuel', farms[0])
      }
    }

    if (f.cargo) return

    this.seedHallForFlight(f, 'arrive')
    const mode = this.standPaxMode(f.stand)
    if (mode === 'jetway') {
      // Jetway — no apron walkers; deboard timer only.
      f.waitingOn.paxOut = 0
    } else if (mode === 'bus' && this.dispatchTermBus(f, 'arrive')) {
      f.waitingOn.paxOut = 1
    } else {
      const visual = Math.max(8, Math.min(18, Math.round(f.pax / 6)))
      const walkers = spawnArrivalPax(this.tiles, f.id, f.stand, fit, visual)
      f.waitingOn.paxOut = walkers.length
      this.people.push(...walkers)
      if (mode !== 'walk') {
        this.pushNews(
          `${f.flightNo} walking remote stand — bus depot missing or blocked.`,
          'ok',
        )
      }
    }
  }

  trySpawnMilitary() {
    if (!this.milAgreement) return
    this.milCool = Math.max(0, this.milCool)
    if (this.milCool > 0) return
    const strip = this.openSpecialStrip()
    if (strip == null) return
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    // Prefer dedicated mil ramp; never steal a busy pax jetway if a hardstand exists.
    const stand = this.assignMilStand()
    if (!stand) {
      this.milCool = 18
      if (Math.random() < 0.35) {
        this.pushNews(
          'Guard holding — mil ramp busy or missing hangar-side hardstand.',
          'ok',
        )
      }
      return
    }
    const route = this.landingRoute(stand, strip)
    if (!route || !this.stripsOnPath(route).includes(strip)) {
      this.milCool = 15
      return
    }
    const level = this.fieldLevel()
    let af = pickAirframe(
      'military',
      this.longestRunway(),
      this.researchGrants(),
      level,
      (id) => sizeTierOf(id) === 'small' || this.scaleReport(id).ok,
    )
    if (!af) {
      this.milCool = 25
      return
    }
    // C-5 needs heavy strip even with mil_ramp research.
    if (af.id === 'c5' && !this.hasHeavyRunway()) {
      const lighter = pickAirframe(
        'military',
        this.longestRunway(),
        this.researchGrants().filter((id) => id !== 'mil_ramp'),
        level,
        (id) => sizeTierOf(id) === 'small' || this.scaleReport(id).ok,
      )
      if (!lighter) {
        this.milCool = 30
        return
      }
      af = lighter
    }
    let gate = stand
    let path = route
    if (!this.standFitsAirframe(gate, af.id)) {
      const alt = this.assignStand(null, undefined, undefined, af.id)
      const altRoute = alt ? this.landingRoute(alt, strip) : null
      if (!alt || !altRoute || !this.stripsOnPath(altRoute).includes(strip)) {
        this.milCool = 20
        return
      }
      gate = alt
      path = altRoute
    }
    this.spawnMilitaryFlight(af, gate, path)
  }

  private spawnMilitaryFlight(
    af: (typeof AIRFRAMES)[string],
    stand: Vec,
    route: Vec[],
  ) {
    this.flightSeq += 1
    const prefix =
      af.id === 'f15'
        ? 'VIPER'
        : af.id === 'kc135'
          ? 'ANG'
          : af.id === 'c17'
            ? 'REACH'
            : af.id === 'c5'
              ? 'REACH'
              : 'RDR'
    const call = `${prefix}${this.flightSeq}`
    const fighter = af.id === 'f15'
    const inbound = this.armApproach(route)
    const f: Flight = {
      id: uid('mil'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: 0,
      cargo: !fighter,
      craft: 'jet',
      kind: 'military',
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
    }
    this.flights.push(f)
    this.noteCraft('military')
    this.milCool = fighter ? 70 + Math.random() * 35 : 100 + Math.random() * 50
    this.selectedFlight = this.selectedFlight ?? f.id
    const gate = this.gateLabel(stand)
    this.pushNews(
      fighter
        ? `${call} · ${af.name} fighter drag inbound (Guard host).`
        : `${call} · ${af.name} military transit → ${gate} (mil ramp).`,
      'ok',
    )
  }

  trySpawnAirAmbulance() {
    this.ambuCool = Math.max(0, this.ambuCool)
    if (this.ambuCool > 0) return
    if (this.budgetOf('ambulance') < 50) return
    if (!tilesOf(this.tiles, 'fire').length) return
    const strip = this.openSpecialStrip()
    if (strip == null) return
    const af = pickAirframe(
      'air_ambulance',
      this.longestRunway(),
      this.researchGrants(),
    )
    if (!af) {
      this.ambuCool = 30
      return
    }
    if (!runwayStrips(this.tiles, MIN_RUNWAY).length) return
    const stand = this.assignStand(null, undefined, undefined, af.id)
    if (!stand) return
    const route = this.landingRoute(stand, strip)
    if (!route || !this.stripsOnPath(route).includes(strip)) return
    this.flightSeq += 1
    const call = `LIF${this.flightSeq}`
    const inbound = this.armApproach(route)
    const f: Flight = {
      id: uid('amb'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: this.flightLoad(af, 'business', false).pax,
      cargo: false,
      craft: 'jet',
      kind: 'air_ambulance',
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
    }
    this.flights.push(f)
    this.noteCraft('air_ambulance')
    this.ambuCool = 130 + Math.random() * 70
    this.pushNews(
      `${call} · Emergency ${af.name} air ambulance → ${this.gateLabel(stand)}.`,
      'ok',
    )
  }

  spawnTruck(
    kind: Truck['kind'],
    f: Flight | null,
    path: Vec[],
    mission?: TruckMission,
    home?: Vec | null,
  ) {
    const start = path[0]
    const resolved: TruckMission =
      mission ??
      (kind === 'bags'
        ? 'unload'
        : kind === 'fuel'
          ? 'fuel'
          : kind === 'catering'
            ? 'cater'
            : kind === 'deice'
              ? 'deice'
              : 'patrol')
    // Real ops: makeup load at shed / bottom-load at farm / glycol fill at pad before rolling.
    // Bag makeup/unload prep scales with bag units (visible work time).
    let pre =
      resolved === 'load'
        ? 1.7
        : resolved === 'fuel'
          ? 1.3
          : resolved === 'fuel_reload'
            ? 1.6
            : resolved === 'deice'
              ? 1.1 + (f?.stand && this.hasFitting(f.stand, 'deice_outlet') ? 0 : 8)
              : 0
    let cargoUnits = 0
    if (kind === 'bags' && f && !f.cargo) {
      if (resolved === 'load' || resolved === 'pickup') {
        pre = this.bagWorkSeconds(f, 'sort')
        cargoUnits = f.bagsDeposited ?? f.bagUnits ?? 0
        this.setBagStage(f, resolved === 'load' ? 'load_aircraft' : 'outbound_sort')
      } else if (resolved === 'unload') {
        this.assignClaimLane(f)
        this.setBagStage(f, 'unload_aircraft')
      }
    }
    this.trucks.push({
      id: uid('trk'),
      kind,
      flightId: f?.id ?? null,
      x: start.c,
      y: start.r,
      path,
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: pre,
      patrol: !f,
      mission: resolved === 'fuel_reload' ? 'fuel' : resolved,
      home: home ?? (path.length ? path[0] : null),
      cargoUnits,
    })
  }

  /** Storm/fog + De-ice ops research + stamped pad → glycol truck before pushback. */
  needsDeiceService(f: Flight): boolean {
    if ((f.craft ?? 'jet') !== 'jet') return false
    if (f.posted.deiced) return false
    if (!this.hasResearch('deice')) return false
    if (this.weather !== 'storm' && this.weather !== 'fog') return false
    if (!tilesOf(this.tiles, 'deice').length) return false
    return true
  }

  /**
   * Dispatch de-ice truck from pad → stand. Returns true when clear to push
   * (not needed, already sprayed, or force-timeout caller).
   */
  ensureDeice(f: Flight): boolean {
    if (!this.needsDeiceService(f)) {
      f.waitingOn.deice = false
      return true
    }
    if (f.posted.deiced) {
      f.waitingOn.deice = false
      return true
    }
    const enroute = this.trucks.some(
      (t) => t.kind === 'deice' && t.flightId === f.id && !t.returning,
    )
    if (enroute) {
      f.waitingOn.deice = true
      return false
    }
    const pads = tilesOf(this.tiles, 'deice')
    if (!f.stand || !pads.length) {
      f.waitingOn.deice = false
      return true
    }
    const path = nearestPath(this.tiles, pads[0], [f.stand], 'truck')
    if (!path || path.length < 2) {
      f.waitingOn.deice = true
      return false
    }
    f.waitingOn.deice = true
    this.spawnTruck('deice', f, path, 'deice', pads[0])
    if (Math.random() < 0.55) {
      this.pushNews(`${f.flightNo} holding for de-ice.`, 'ok')
    }
    return false
  }

  finishTruck(t: Truck) {
    if (!t.flightId) return
    const f = this.flights.find((x) => x.id === t.flightId)
    if (!f) return
    const airline = this.airline(f.airline)
    if (t.kind === 'bags') {
      if (t.mission === 'load') {
        if (!f.posted.bagsLoad) {
          t.cargoUnits = 0
          this.settleOutboundBags(f, false)
        }
      } else if (t.mission === 'unload' && !f.posted.bags) {
        // Aircraft unload complete — pay; then sort → assigned claim.
        f.posted.bags = true
        f.waitingOn.bags = false
        this.setBagStage(f, 'inbound_sort')
        this.assignClaimLane(f)
        t.cargoUnits = f.bagUnits ?? 0
        if (!f.cargo) {
          const units = f.bagUnits ?? estimateFlightBagUnits(airline.persona, f.pax)
          this.postInboundBagFee(f, airline)
          const fit = this.roomsAt(f.stand)
          if (fit) {
            const rooms = Math.max(fit.premade ? 1 : 0, fit.rooms.bagclaim ?? 0)
            const claimCap = claimHoldUnits(
              Boolean(fit.premade),
              fit.bagAllowance ?? rooms * (fit.premade ? 55 : 80),
              rooms,
            )
            const overflow = Math.max(0, units - claimCap)
            if (overflow > 0.5) {
              const book = this.ensureBagBook(f)
              book.claimLeft = overflow
              f.claimLeft = overflow
              this.adjustHeat(f.airline, -1.8)
              this.pushNews(
                `${f.flightNo} claim jammed — ${Math.round(overflow)} of ${Math.round(units)} bag units offloaded. The hall holds ${Math.round(claimCap)}.`,
                'bad',
              )
            }
          }
        } else {
          let cargoMult = this.hasReward(f.airline, 'cargo_night') ? 1.28 : 1
          if (this.hasResearch('night_bank') && this.isNight()) cargoMult *= 1.35
          cargoMult *= this.isNight() ? this.specMods().nightCargoFee : this.specMods().dayCargoFee
          this.earn(
            serviceCharge(
              this.listed(Math.round(airline.landing * 0.35 * cargoMult), 'cargoPerUnit'),
              this.feeTier(f.airline),
              this.walkInFlight(f),
            ),
            `${f.flightNo} cargo handling`,
            f,
            'cargo_fees',
          )
        }
        const fit = this.roomsAt(f.stand)
        if (
          !f.cargo &&
          fit &&
          fit.rooms.bagdrop > 0 &&
          tilesOf(this.tiles, 'bags').length &&
          !f.posted.bagDrop
        ) {
          f.posted.bagDrop = true
          this.earn(BAG_DROP_PAY, `${f.flightNo} bag drop`, f)
        }
      } else if (t.mission === 'sort_inbound' && !f.cargo) {
        this.setBagStage(f, 'deliver_claim')
        this.pushNews(
          `${f.flightNo} bags sorted → claim ${f.claimLane ?? 1}.`,
          'ok',
        )
      } else if (t.mission === 'to_claim' && !f.cargo) {
        if (!this.inboundCartClear(f.id)) return
        this.setBagStage(f, 'on_claim')
        t.cargoUnits = 0
        this.pushNews(
          `${f.flightNo} bags on claim ${f.claimLane ?? 1}.`,
          'ok',
        )
      } else if (t.mission === 'pickup' && !f.cargo) {
        this.setBagStage(f, 'outbound_sort')
        t.cargoUnits = f.bagsDeposited ?? f.bagUnits ?? 0
      }
    }
    if (t.kind === 'fuel' && t.mission === 'fuel' && !f.posted.fuel && this.fuelBrand && this.fuelLoads > 0) {
      f.posted.fuel = true
      f.fuelLevel = 1
      f.waitingOn.fuel = false
      this.fuelLoads -= 1
      this.drawTankLitres(LITRES_PER_LEGACY_LOAD)
      this.earn(
        this.contractBill(f, this.listed(FUEL[this.fuelBrand].pump, 'fuelMarkupPerLitre'), 'service', 'fuel'),
        `${f.flightNo} fuel`,
        f,
        'fuel_sales',
      )
    }
    if (t.kind === 'catering' && !f.posted.catering && this.caterBrand) {
      if (!this.cateringCartClear(f.id)) return
      f.posted.catering = true
      f.caterLevel = 1
      f.waitingOn.catering = false
      const pay = this.quotedCatering(f.airline, f.pax)
      this.earn(
        pay,
        `${f.flightNo} catering (${CATER[this.caterBrand].name})`,
        f,
        'catering_fees',
      )
      this.mealSold = true
      this.reputation = Math.min(100, this.reputation + 1)
    }
    if (t.kind === 'deice' && t.mission === 'deice' && !f.posted.deiced) {
      f.posted.deiced = true
      f.waitingOn.deice = false
      this.earn(
        serviceCharge(this.listed(DEICE_FEE, 'deice'), this.feeTier(f.airline), this.walkInFlight(f)),
        `${f.flightNo} de-ice`,
        f,
        'contract_fees',
      )
      this.pushNews(`${f.flightNo} de-iced — clear to push.`, 'good')
    }
  }

  /**
   * After claim delivery / home return — assign next bags job.
   * Outbound loads always pickup at the shed first (makeup); unloads can go direct.
   */
  retargetBagsTruck(t: Truck): boolean {
    if (t.kind !== 'bags' || !t.home) return false
    const busy = new Set(
      this.trucks
        .filter((x) => x.kind === 'bags' && x.id !== t.id && x.flightId)
        .map((x) => x.flightId!),
    )
    const next = this.flights.find((f) => {
      if (!f.stand || busy.has(f.id)) return false
      if (f.phase === 'servicing' && f.waitingOn.bags && !f.posted.bags) return true
      if (f.phase === 'board' && f.waitingOn.bagsLoad && !f.posted.bagsLoad) return true
      return false
    })
    if (!next?.stand) return false
    const from = { c: Math.round(t.x), r: Math.round(t.y) }
    const atHome =
      Math.abs(from.c - t.home.c) + Math.abs(from.r - t.home.r) <= 1

    if (next.phase === 'board') {
      // Makeup: must load carts at the shed before rolling to the stand.
      if (!atHome) {
        const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
        if (!homePath || homePath.length < 2) return false
        t.flightId = next.id
        t.mission = 'pickup'
        t.path = homePath
        t.seg = 0
        t.t = 0
        t.returning = true
        t.dwell = 0
        t.preDwell = 0
        return true
      }
      const path = nearestPath(this.tiles, t.home, [next.stand], 'truck')
      if (!path || path.length < 2) return false
      t.flightId = next.id
      t.mission = 'load'
      t.path = path
      t.seg = 0
      t.t = 0
      t.returning = false
      t.dwell = 0
      t.preDwell = 1.7
      return true
    }

    const path = nearestPath(this.tiles, from, [next.stand], 'truck')
    if (!path || path.length < 2) return false
    t.flightId = next.id
    t.mission = 'unload'
    t.path = path
    t.seg = 0
    t.t = 0
    t.returning = false
    t.dwell = 0
    t.preDwell = 0
    return true
  }

  /**
   * Fuel bowser: continue to next jet if farm stock remains (partial tank),
   * else deadhead to farm for bottom-load reload.
   */
  retargetFuelTruck(t: Truck): boolean {
    if (t.kind !== 'fuel' || !t.home || this.fuelLoads < 1) return false
    const busy = new Set(
      this.trucks
        .filter((x) => x.kind === 'fuel' && x.id !== t.id && x.flightId)
        .map((x) => x.flightId!),
    )
    const next = this.flights.find(
      (f) =>
        f.stand &&
        !busy.has(f.id) &&
        f.phase === 'servicing' &&
        f.waitingOn.fuel &&
        !f.posted.fuel,
    )
    if (!next?.stand) return false
    const from = { c: Math.round(t.x), r: Math.round(t.y) }
    const atFarm =
      Math.abs(from.c - t.home.c) + Math.abs(from.r - t.home.r) <= 1

    // After a delivery, prefer farm reload then roll (real bowser cycle).
    if (!atFarm && t.mission === 'fuel_reload') {
      const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
      if (!homePath || homePath.length < 2) return false
      t.flightId = next.id
      t.mission = 'fuel_reload'
      t.path = homePath
      t.seg = 0
      t.t = 0
      t.returning = true
      t.dwell = 0
      t.preDwell = 0
      return true
    }
    if (atFarm || t.mission === 'fuel_reload') {
      const path = nearestPath(this.tiles, t.home, [next.stand], 'truck')
      if (!path || path.length < 2) return false
      t.flightId = next.id
      t.mission = 'fuel'
      t.path = path
      t.seg = 0
      t.t = 0
      t.returning = false
      t.dwell = 0
      t.preDwell = 1.4
      return true
    }
    // Still have product — continue apron-to-apron (hydrant-style multi-stop).
    const path = nearestPath(this.tiles, from, [next.stand], 'truck')
    if (!path || path.length < 2) return false
    t.flightId = next.id
    t.mission = 'fuel'
    t.path = path
    t.seg = 0
    t.t = 0
    t.returning = false
    t.dwell = 0
    t.preDwell = 0
    return true
  }

  beginBoarding(f: Flight) {
    if (!f.stand || f.cargo) return
    const fit = this.roomsAt(f.stand)
    const planned = Boolean(
      f.scheduleId && this.showUps.some((p) => p.slotId === f.scheduleId && p.releases.length > 0),
    )
    if (!planned) this.seedHallForFlight(f, 'depart')
    const mode = this.standPaxMode(f.stand)
    if (mode === 'jetway') {
      f.waitingOn.paxIn = 0
    } else if (mode === 'bus' && this.dispatchTermBus(f, 'depart')) {
      f.waitingOn.paxIn = 1
    } else {
      const visual = Math.max(8, Math.min(18, Math.round(f.pax / 6)))
      const walkers = spawnDeparturePax(this.tiles, f.id, f.stand, fit, visual)
      f.waitingOn.paxIn = walkers.length
      this.people.push(...walkers)
    }
    // Outbound bags: shed makeup pickup → plane deposit.
    const bagBuild = tilesOf(this.tiles, 'bags')
    if (bagBuild.length && !f.posted.bagsLoad) {
      this.noteBagBeltIssue(f)
      const path = nearestPath(this.tiles, bagBuild[0], [f.stand], 'truck')
      if (path) {
        f.waitingOn.bagsLoad = true
        this.spawnTruck('bags', f, path, 'load', bagBuild[0])
      }
    }
  }

  /**
   * Belt lite — once any belt exists, stands need makeup↔stand↔hall connectivity.
   * Broken chain: slower board + heat nick + news (trucks still roll for picture).
   */
  noteBagBeltIssue(f: Flight) {
    if (!f.stand || f.cargo) return
    if (!hasBeltNetwork(this.tiles)) return
    if (standBeltLinked(this.tiles, f.stand)) return
    f.boardingSlow = true
    const belt = this.isHub(f.airline) ? this.specMods().hubBeltHeat : this.specMods().otherBeltHeat
    this.adjustHeat(f.airline, -2.2 * belt)
    if (Math.random() < 0.55) {
      this.pushNews(
        `${f.flightNo} bags late — belt broken between hall, sort, and stand.`,
        'bad',
      )
    }
  }

  /** Terminal bus ferry for remote stands — depot ↔ stand. */
  dispatchTermBus(f: Flight, leg: 'arrive' | 'depart'): boolean {
    if (!f.stand) return false
    const depots = tilesOf(this.tiles, 'termbus')
    if (!depots.length) return false
    const home = depots[0]
    const path = nearestPath(this.tiles, home, [f.stand], 'truck')
    if (!path || path.length < 2) return false
    this.trucks.push({
      id: uid('tbus'),
      kind: 'termbus',
      flightId: f.id,
      x: home.c,
      y: home.r,
      path,
      seg: 0,
      t: 0,
      returning: false,
      dwell: 0,
      preDwell: leg === 'depart' ? 1.2 : 0.4,
      patrol: false,
      mission: leg === 'arrive' ? 'ferry_arr' : 'ferry_dep',
      home,
    })
    return true
  }

  /** Line MX: mechanic walks hangar → stand → hangar (real GSE delivery). */
  dispatchLineMx(f: Flight, payout: number) {
    if (!f.stand || f.posted.mx || f.waitingOn.mx) return
    const hangars = tilesOf(this.tiles, 'hangar')
    if (!hangars.length || this.mechanics < 1) return
    const path =
      nearestPath(this.tiles, hangars[0], [f.stand], 'mechanic') ??
      nearestPath(this.tiles, hangars[0], [f.stand], 'truck')
    if (!path || path.length < 2) {
      // No path — pay at hangar (remote line check radio).
      this.earn(payout, `${f.flightNo} line MX`, f)
      f.posted.mx = true
      return
    }
    f.waitingOn.mx = true
    this.people.push({
      id: uid('mx'),
      flightId: f.id,
      x: hangars[0].c,
      y: hangars[0].r,
      path,
      seg: 0,
      t: 0,
      color: '#7a9bb8',
      job: 'mechanic',
      itinerary: [],
      label: 'Line maintenance',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
      mxPay: payout,
    })
  }

  departurePath(f: Flight): Vec[] | null {
    if (!f.stand) return null
    const inbound = this.landingRoute(f.stand, this.flightStrip(f))
    if (!inbound) return null
    const path = [...inbound].reverse()
    return jetRouteOnGraph(this.tiles, path) ? path : null
  }

  /** Pushback stays on the stand or a jet neighbour. A grass offset is not a taxi route. */
  private pushbackPath(stand: Vec, heading: number): Vec[] {
    const back = {
      c: stand.c - Math.cos(heading || 0) * 0.8,
      r: stand.r - Math.sin(heading || 0) * 0.8,
    }
    if (jetRouteOnGraph(this.tiles, [stand, back])) return [stand, back]
    const next = neighbors(stand.c, stand.r).find(
      (p) => inBounds(p.c, p.r) && walkableFor('jet', this.tiles[p.r][p.c]),
    )
    return next ? [stand, next] : [stand]
  }

  private holdForTaxi(f: Flight) {
    this.raiseAlert({
      key: `cond:taxi-blocked:${f.id}`,
      severity: 'warning',
      title: `${f.flightNo} holding — no taxiway`,
      detail: 'No path on the taxiway graph. The aircraft stays put instead of crossing the grass.',
      at: f.stand ? { view: 'apron', cells: [{ c: f.stand.c, r: f.stand.r }] } : undefined,
    })
  }

  /** Ground taxi may follow only the remaining steps that sit on the taxiway graph. */
  private taxiRouteReady(f: Flight): boolean {
    const rest = f.path.slice(Math.max(0, f.seg))
    // Already on the last node — nothing left to cross, including after the landing roll.
    if (rest.length < 2) return true
    return jetRouteOnGraph(this.tiles, rest)
  }

  tickPatrols(dt: number) {
    this.patrolCool -= dt
    const posts = tilesOf(this.tiles, 'police')
    if (!posts.length) return
    const live = this.people.filter((p) => p.job === 'patrol').length
    if (live >= 2 || this.patrolCool > 0) return
    this.patrolCool = 18
    const start = posts[0]
    const goals = [
      ...tilesOf(this.tiles, 'terminal'),
      ...tilesOf(this.tiles, 'stand'),
      ...tilesOf(this.tiles, 'road'),
    ]
    const goal = goals.length ? pick(goals) : start
    const path = astar(this.tiles, start, goal, 'person') ?? [start]
    this.people.push({
      id: uid('cop'),
      flightId: '',
      x: start.c,
      y: start.r,
      path,
      seg: 0,
      t: 0,
      color: '#1e3a5f',
      job: 'patrol',
      itinerary: [],
      label: 'Patrol',
      wantBag: false,
      wantFood: false,
      wantGift: false,
      stage: 0,
      paidFood: false,
      paidGift: false,
    })
  }

  tickThreats(dt: number) {
    if (this.pendingThreat) {
      this.pendingThreat.age += dt
      this.pendingThreat.deadline -= dt
      if (this.pendingThreat.deadline <= 0) this.resolveThreat('ignore')
      return
    }
    this.threatCool -= dt
    if (this.threatCool > 0) return
    if (!this.signed.length || !this.flights.some((f) => !f.cargo && f.phase !== 'gone')) {
      this.threatCool = 16
      return
    }
    const sec = this.securityLevel()
    const police = tilesOf(this.tiles, 'police').length
    const wearSec = this.avgWear().sec
    const staffGap = 1 - this.budgetOf('security') / 100
    const hasSecRoom = this.fits.some((f) => (f.rooms.security ?? 0) > 0)
    const airsideOpen = this.fits.some((f) => {
      const r = f.rooms
      return (r.food ?? 0) + (r.gate ?? 0) + (r.lounge ?? 0) + (r.souvenir ?? 0) > 0
    })
    const exposed = !hasSecRoom || this.budgetOf('security') < 35
    // A gap the player left is checked again soon. A staffed lane is not held for the first hour.
    this.threatCool = exposed ? 10 + Math.random() * 8 : 32 + Math.random() * 12
    // Player shell with airside rooms but no security choke = smuggling / weapons risk.
    const openAirGap = airsideOpen && !hasSecRoom ? 0.38 : 0
    const risk = clamp(
      0.42 -
        sec * 0.12 -
        police * 0.08 +
        wearSec * 0.002 +
        staffGap * 0.22 +
        openAirGap,
      0.04,
      0.78,
    )
    if (Math.random() > risk) return
    const hard = !hasSecRoom || sec < 2 || this.budgetOf('security') < 35
    this.pendingThreat = {
      id: uid('thr'),
      severity: hard ? 'hard' : 'soft',
      blurb: !hasSecRoom
        ? 'No security choke — weapons / smuggling path to airside. Scramble or own the headline.'
        : hard
          ? 'Hard alarm — possible threat past a weak lane. Scramble police or eat the headline.'
          : 'Suspicious bag on an outbound. Scramble screeners or hope the tape stays quiet.',
      age: 0,
      deadline: hard ? 18 : 24,
    }
    this.pushNews(`THREAT ALERT — decide now. ${this.pendingThreat.blurb}`, 'bad')
    if (this.budgetOf('security') < SECURITY_INCIDENT_SLIDER_FLOOR) {
      const preview = this.threatFine(hard)
      this.pushNews(
        `Security is ${Math.round(this.budgetOf('security'))}%. Ignoring this alert bills ${moneyLeft(preview)}. Raise the slider before it fires.`,
        'bad',
      )
    }
    this.emit()
  }

  /** What the field is missing for this emergency ask (null = can host). */
  emergencyHostGap(e: PendingEmergency): string | null {
    const n = e.needs
    if (n.minRunway > 0 && this.longestRunway() < n.minRunway) {
      return `strip only ${this.longestRunway()}c (need ${n.minRunway}c)`
    }
    if (!runwayStrips(this.tiles, Math.max(MIN_RUNWAY, n.minRunway || MIN_RUNWAY)).length) {
      return 'no usable runway'
    }
    if (n.stand && !this.freeStands().length) return 'no free stand'
    if (n.fire && !tilesOf(this.tiles, 'fire').length) return 'no ARFF / fire station'
    if (n.fuel) {
      if (!tilesOf(this.tiles, 'fuel').length) return 'no fuel farm'
      if (!this.fuelBrand && !this.groundSnapshot()) return 'no fuel contract'
      if (!this.fuelOnHand()) return 'fuel farm empty'
    }
    if (n.hangar && !tilesOf(this.tiles, 'hangar').length) return 'no hangar'
    if (n.hangar && this.mechanics < 1) return 'no mechanics for line MX'
    if (this.groundBusy() && !this.freeStands().length) return 'pavement jammed'
    return null
  }

  canHostEmergency(e: PendingEmergency): boolean {
    return this.emergencyHostGap(e) == null
  }

  emergencyNeedsLine(e: PendingEmergency): string {
    const bits: string[] = []
    if (e.needs.stand) bits.push('stand')
    if (e.needs.fire) bits.push('ARFF')
    if (e.needs.fuel) bits.push('fuel')
    if (e.needs.hangar) bits.push('hangar')
    if (e.needs.minRunway > 0) bits.push(`${e.needs.minRunway}c strip`)
    return bits.length ? bits.join(' · ') : 'clear pad'
  }

  private failEmergencyHost(e: PendingEmergency, why: string) {
    this.charge(EMERGENCY_FAIL_FINE, 'penalties', this.simMinutes(), 'Failed emergency host')
    this.reputation = Math.max(0, this.reputation - 7)
    this.runwayCondition = Math.max(20, this.runwayCondition - 3)
    // Chaos — next fire risk sooner; carriers lose trust across the board.
    this.fireIncidentCool = Math.min(this.fireIncidentCool, 12)
    for (const id of this.signed) this.adjustHeat(id, -2.8)
    if (e.kind === 'divert' && e.airline) this.adjustHeat(e.airline, -7)
    this.raiseAlert({
      key: 'event:inbound-failed',
      severity: 'critical',
      title: 'Emergency inbound failed',
      detail: `Could not host it: ${why}.`,
      event: true,
    })
    if (this.public) {
      this.shockStock(
        `Failed emergency host — ${why}.`,
        this.public ? 0.78 : 1,
        Math.round(EMERGENCY_FAIL_FINE * 0.4),
      )
    } else {
      this.pushNews(
        `FAILED HOST — ${why}. Fine ${moneyLeft(EMERGENCY_FAIL_FINE)}; carriers cool on us.`,
        'bad',
      )
    }
  }

  /** One-shot divert landing — not a banked timetable slot. */
  private spawnEmergencyDivert(airline: AirlineId): boolean {
    if (this.isBanned(airline)) return false
    if (this.groundBusy() && !this.assignStand()) return false
    const af = this.pickForAirline(airline, this.airline(airline).kind === 'cargo').af
    if (!af) return false
    const stand = this.assignStand(null, undefined, airline, af.id)
    const route = stand ? this.landingRoute(stand) : null
    if (!stand || !route) return false
    this.flightSeq += 1
    const a = this.airline(airline)
    const call = `${a.name.slice(0, 2).toUpperCase()}D${this.flightSeq}`
    const inbound = this.armApproach(route)
    const cargoLoad = a.kind === 'cargo' || af.kind === 'freighter'
    const load = this.applyRivalLoad(this.flightLoad(af, a.persona, cargoLoad), cargoLoad, af.paxMax)
    const f: Flight = {
      id: uid('div'),
      airline,
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: load.pax,
      cargo: a.kind === 'cargo' || af.kind === 'freighter',
      craft: 'jet',
      kind: af.kind,
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      bagUnits: load.bagUnits,
      bagStage: a.kind === 'cargo' ? 'idle' : 'inflight',
      bagsDeposited: 0,
      claimLane: null,
    }
    f.emergencyHost = true
    f.hostKind = 'divert'
    this.flights.push(f)
    if (!f.cargo) this.assignClaimLane(f)
    this.noteCraft(af.kind)
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(
      `DIVERT ${call} · ${af.name} inbound now → ${this.gateLabel(stand)}${
        f.claimLane ? ` · claim ${f.claimLane}` : ''
      } (stolen bank slot).`,
      'ok',
    )
    return true
  }

  /** Pick CL-415 / AT-802 when the strip fits; fall back to medevac metal. */
  private pickAirtankerFrame() {
    const rw = this.longestRunway()
    const pool = [AIRFRAMES.cl415, AIRFRAMES.at802, AIRFRAMES.c130].filter(
      (a) => a && rw >= a.minRunway,
    )
    if (pool.length) return pick(pool)
    return (
      pickAirframe('air_ambulance', rw, this.researchGrants()) ??
      AIRFRAMES.at802 ??
      AIRFRAMES.citation
    )
  }

  /** Firefighting plane — refuel-only or refuel + hangar MX. */
  private spawnEmergencyTanker(mx: boolean): boolean {
    if (this.groundBusy() && !this.assignStand()) return false
    const af = this.pickAirtankerFrame()
    if (!af) return false
    const stand = this.assignStand(null, undefined, undefined, af.id)
    const route = stand ? this.landingRoute(stand) : null
    if (!stand || !route) return false
    this.flightSeq += 1
    const call = mx ? `ATMX${this.flightSeq}` : `TANK${this.flightSeq}`
    const inbound = this.armApproach(route)
    const f: Flight = {
      id: uid('tnk'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: af.id,
      airframeName: af.name,
      pax: 0,
      cargo: false,
      craft: 'jet',
      kind: 'air_ambulance',
      phase: 'approach',
      stand,
      x: inbound.x,
      y: inbound.y,
      z: inbound.z,
      heading: 0,
      path: inbound.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted: emptyPosted(),
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      emergencyHost: true,
      hostKind: mx ? 'tanker_mx' : 'tanker',
    }
    this.flights.push(f)
    this.noteCraft('air_ambulance')
    this.selectedFlight = this.selectedFlight ?? f.id
    this.runwayCondition = Math.min(100, this.runwayCondition + (mx ? 5 : 3))
    this.fireIncidentCool = Math.max(this.fireIncidentCool, mx ? 60 : 45)
    // Hot-turn bonus on accept — bowser pay lands when the truck finishes.
    if (mx && this.mechanics > 0 && tilesOf(this.tiles, 'hangar').length) {
      const mxPay = 1200 + this.mechanics * 220
      this.earn(mxPay, `${call} airtanker line MX`)
    }
    this.pushNews(
      mx
        ? `${call} · ${af.name} inbound for refuel + MX → ${this.gateLabel(stand)} (stolen bank slot).`
        : `${call} · ${af.name} firefighting plane inbound for refuel only → ${this.gateLabel(stand)} (stolen bank slot).`,
      'ok',
    )
    return true
  }

  tickEmergencies(dt: number) {
    if (this.pendingEmergency) {
      this.pendingEmergency.age += dt
      this.pendingEmergency.deadline -= dt
      if (this.pendingEmergency.deadline <= 0) this.expireEmergency()
      return
    }
    if (this.pendingThreat) return
    this.emergencyCool -= dt
    if (this.emergencyCool > 0 || !this.site) return

    const stormy = this.weather === 'storm' || this.weather === 'fog'
    const storm = this.weather === 'storm'
    const dry = this.weather === 'clear' // wildfire-season feel — airtankers thirsty
    const fireThin = this.budgetOf('fire') < 45
    const hasFuel = this.fuelOnHand()
    const hasHangar = tilesOf(this.tiles, 'hangar').length > 0
    const exposed = !hasFuel || fireThin || tilesOf(this.tiles, 'fire').length === 0
    // Storms stack divert asks; dry clear days stack firefighting planes.
    // A missing farm or a thin fire crew is not hidden behind a first-hour timer.
    this.emergencyCool = exposed
      ? 12 + Math.random() * 8
      : stormy
        ? 22 + Math.random() * 10
        : 34 + Math.random() * 12

    const roll = Math.random()
    const pDivert =
      (storm ? 0.42 : this.weather === 'fog' ? 0.38 : 0.06) +
      (this.signed.length ? 0 : -1)
    // Firefighting planes: dry clear + storms (lightning starts) + thin ARFF.
    const pTanker =
      (dry ? 0.32 : storm ? 0.24 : fireThin ? 0.18 : 0.05) +
      (hasFuel ? 0.08 : -0.12) +
      (tilesOf(this.tiles, 'fire').length ? 0 : -0.1)
    const pTankerMx =
      (dry ? 0.2 : storm ? 0.14 : 0.04) +
      (hasHangar ? 0.1 : -0.12) +
      (hasFuel ? 0.06 : -0.1) +
      (fireThin ? 0.05 : 0)

    let kind: EmergencyKind | null = null
    // Weighted pick among kinds that rolled; weather can stack multiple hits.
    const hits: { k: EmergencyKind; w: number }[] = []
    if (this.signed.some((id) => !this.isBanned(id)) && roll < pDivert) {
      hits.push({ k: 'divert', w: pDivert })
    }
    if (roll < pTanker + 0.12 && pTanker > 0) hits.push({ k: 'tanker', w: Math.max(0.01, pTanker) })
    if (roll < pTankerMx + 0.08 && pTankerMx > 0) {
      hits.push({ k: 'tanker_mx', w: Math.max(0.01, pTankerMx) })
    }
    // Pure random spark — even calm days get occasional firefighting traffic.
    if (!hits.length && Math.random() < (stormy || dry ? 0.35 : 0.08)) {
      const pool: EmergencyKind[] = ['tanker']
      if (this.signed.some((id) => !this.isBanned(id))) pool.push('divert')
      if (hasHangar) pool.push('tanker_mx')
      kind = pick(pool)
    } else if (hits.length) {
      const sum = hits.reduce((s, h) => s + h.w, 0)
      let r = Math.random() * sum
      kind = hits[hits.length - 1].k
      for (const h of hits) {
        r -= h.w
        if (r <= 0) {
          kind = h.k
          break
        }
      }
    }
    if (!kind) return

    const deadline = storm ? 16 : stormy || dry ? 18 : 22
    if (kind === 'divert') {
      const pool = this.signed.filter((id) => !this.isBanned(id))
      const airline = pool.length ? pick(pool) : null
      if (!airline) return
      const fee =
        DIVERT_FEE_MIN + Math.floor(Math.random() * (DIVERT_FEE_MAX - DIVERT_FEE_MIN))
      const name = this.airline(airline).name
      const minRw = Math.max(MIN_RUNWAY, Math.min(14, this.longestRunway() || MIN_RUNWAY))
      const needs = {
        stand: true,
        fire: true,
        fuel: false,
        hangar: false,
        minRunway: minRw,
      }
      const weatherBit =
        this.weather === 'storm'
          ? 'Storm closed their dest'
          : this.weather === 'fog'
            ? 'Fog diverted them off the airway'
            : 'Weather / ATC divert'
      this.pendingEmergency = {
        id: uid('emg'),
        kind: 'divert',
        blurb: `${name} divert inbound — ${weatherBit.toLowerCase()}. One-time landing for ${moneyLeft(fee)}. Need stand + ARFF.`,
        fee,
        age: 0,
        deadline,
        airline,
        needs,
      }
    } else if (kind === 'tanker_mx') {
      this.pendingEmergency = {
        id: uid('emg'),
        kind: 'tanker_mx',
        blurb: dry
          ? 'Firefighting plane off the fire line — needs Jet-A top-off AND a hangar bay for line MX. Refuel + maintenance ask.'
          : 'Aerial tanker wants a quick turn: refuel at the farm, then hangar MX before the next drop. Host or the region talks.',
        fee: TANKER_MX_FEE,
        age: 0,
        deadline: deadline + 2,
        airline: null,
        needs: {
          stand: true,
          fire: true,
          fuel: true,
          hangar: true,
          minRunway: MIN_RUNWAY,
        },
      }
    } else {
      this.pendingEmergency = {
        id: uid('emg'),
        kind: 'tanker',
        blurb: dry
          ? 'Firefighting plane low on fuel — wants a one-time landing for a bowser top-off only, then back to the line.'
          : 'Aerial firefighter inbound for refuel only. Need stand, ARFF, and a live fuel farm — refuse and the drop gets delayed.',
        fee: TANKER_FEE,
        age: 0,
        deadline,
        airline: null,
        needs: {
          stand: true,
          fire: true,
          fuel: true,
          hangar: false,
          minRunway: MIN_RUNWAY,
        },
      }
    }

    const label =
      this.pendingEmergency.kind === 'divert'
        ? 'EMERGENCY ASK — weather divert wants a one-time landing.'
        : this.pendingEmergency.kind === 'tanker_mx'
          ? 'EMERGENCY ASK — firefighting plane wants refuel + MX.'
          : 'EMERGENCY ASK — firefighting plane wants refuel only.'
    this.pushNews(label, 'bad')
    this.emit()
  }

  resolveEmergency(choice: 'accept' | 'refuse') {
    const e = this.pendingEmergency
    if (!e) return
    this.pendingEmergency = null
    this.emergencyCool = 55 + Math.random() * 45

    if (choice === 'accept') {
      const gap = this.emergencyHostGap(e)
      if (gap) {
        this.failEmergencyHost(e, gap)
        this.emit()
        return
      }

      // Spawn the one-time landing first — fee only if metal actually arrives.
      let spawned = false
      if (e.kind === 'divert' && e.airline) {
        spawned = this.spawnEmergencyDivert(e.airline)
      } else if (e.kind === 'tanker_mx') {
        spawned = this.spawnEmergencyTanker(true)
      } else {
        spawned = this.spawnEmergencyTanker(false)
      }

      if (!spawned) {
        this.failEmergencyHost(e, 'could not clear a landing path')
        this.emit()
        return
      }

      const feeLabel =
        e.kind === 'divert'
          ? 'Divert host fee'
          : e.kind === 'tanker_mx'
            ? 'Airtanker refuel+MX fee'
            : 'Airtanker refuel fee'
      this.earn(e.fee, feeLabel)
      this.reputation = Math.min(100, this.reputation + (e.kind === 'tanker_mx' ? 3 : 2))
      if (e.kind === 'divert' && e.airline) {
        this.adjustHeat(e.airline, 7)
        for (const id of this.signed) {
          if (id !== e.airline) this.adjustHeat(id, 0.6)
        }
        this.pushNews(
          `Hosted ${this.airline(e.airline).name} divert — +${moneyLeft(e.fee)}. One-time landing inbound.`,
          'good',
        )
      } else {
        for (const id of this.signed) this.adjustHeat(id, 1.2)
        this.pushNews(
          e.kind === 'tanker_mx'
            ? `Firefighting plane hosted for refuel + MX — +${moneyLeft(e.fee)}. Region notices.`
            : `Firefighting plane hosted for refuel — +${moneyLeft(e.fee)}. Bowser rolling.`,
          'good',
        )
      }
      this.emit()
      return
    }

    this.penalizeEmergency(e, 'refuse')
    this.emit()
  }

  /** The ask ran out. Not a refuse: its own fine constant and its own news line. */
  expireEmergency() {
    const e = this.pendingEmergency
    if (!e) return
    this.pendingEmergency = null
    this.emergencyCool = 55 + Math.random() * 45
    this.penalizeEmergency(e, 'timeout')
    this.emit()
  }

  /**
   * Deliberate refuse and an unanswered timeout share the Standing math and the
   * "could not host" exemption. The fine constant and the news line do not.
   */
  private penalizeEmergency(e: PendingEmergency, how: 'refuse' | 'timeout') {
    const gap = this.emergencyHostGap(e)
    if (gap) {
      this.reputation = Math.max(0, this.reputation - EMERGENCY_UNABLE_REP)
      if (e.kind === 'divert' && e.airline) this.adjustHeat(e.airline, -EMERGENCY_UNABLE_HEAT)
      this.pushNews(
        how === 'timeout'
          ? `Missed — no answer. ${e.kind === 'divert' ? 'Divert' : 'Firefighting plane'} went elsewhere — we could not host it (${gap}). Missed ${moneyLeft(e.fee)}.`
          : `${e.kind === 'divert' ? 'Divert' : 'Firefighting plane'} went elsewhere — we could not host it (${gap}). Missed ${moneyLeft(e.fee)}.`,
        'bad',
      )
      return
    }

    // Refuse and timeout both journal here. The dollars and the news line differ.
    const fine = how === 'timeout' ? EMERGENCY_TIMEOUT_FINE : EMERGENCY_REFUSE_FINE
    this.charge(fine, 'emergency_refuse', this.simMinutes(), how === 'timeout' ? 'Emergency timed out' : 'Refused emergency')
    this.reputation = Math.max(0, this.reputation - 4)
    if (e.kind === 'divert' && e.airline) {
      this.adjustHeat(e.airline, -8)
      for (const id of this.signed) {
        if (id !== e.airline) this.adjustHeat(id, -1.4)
      }
    } else {
      for (const id of this.signed) this.adjustHeat(id, -1.8)
    }
    if (how === 'timeout') {
      this.pushNews(`Missed — no answer. Fine ${moneyLeft(fine)}. Answer the card when the field can host it.`, 'bad')
      return
    }
    if (e.kind === 'divert' && e.airline) {
      this.pushNews(
        `Refused divert — ${this.airline(e.airline).name} furious. Fine ${moneyLeft(fine)}. Accept the next one if a stand is free.`,
        'bad',
      )
      return
    }
    this.pushNews(
      e.kind === 'tanker_mx'
        ? `Refused firefighting plane (refuel+MX). Fine ${moneyLeft(fine)}. Keep a hangar and a mechanic if you want the fee instead.`
        : `Refused firefighting plane refuel. Fine ${moneyLeft(fine)}. A fuel farm with stock takes the fee instead.`,
      'bad',
    )
  }

  /** What ignoring this alarm will bill. A listed field pays more, and the preview uses the same number. */
  private threatFine(hard: boolean): number {
    if (this.public) return hard ? SECURITY_PUBLIC_HARD_FINE : SECURITY_PUBLIC_SOFT_FINE
    return hard ? SECURITY_HARD_FINE : SECURITY_SOFT_FINE
  }

  resolveThreat(choice: 'scramble' | 'ignore') {
    const t = this.pendingThreat
    if (!t) return
    this.pendingThreat = null
    this.threatCool = 55 + Math.random() * 30
    const sec = this.securityLevel()
    const police = tilesOf(this.tiles, 'police').length
    const staff = this.budgetOf('security') / 100

    if (choice === 'scramble') {
      if (!this.spend(THREAT_SCRAMBLE_COST, 'threat scramble')) {
        this.pushNews('Could not fund scramble — treated as ignore.', 'bad')
        choice = 'ignore'
      } else {
        const success =
          Math.random() < clamp(0.35 + sec * 0.12 + police * 0.15 + staff * 0.25, 0.2, 0.92)
        if (success) {
          this.reputation = Math.min(100, this.reputation + 3)
          if (this.public) {
            this.sharePrice = Math.round((this.sharePrice * 1.02) * 100) / 100
          }
          this.pushNews(
            'Scramble held — bag cleared, cameras love a clean intercept.',
            'good',
          )
          this.emit()
          return
        }
        this.pushNews('Scramble late — something still slipped. Damage control.', 'bad')
      }
    }

    this.securityIncidents += 1
    if (this.mission?.goal === 'noIncident') this.mission.progress = 0
    const fine = this.threatFine(t.severity === 'hard')
    if (t.severity === 'hard') {
      this.shockStock(
        'SECURITY FAILURE — threat reached a departure. Add a security lane and raise the security budget.',
        this.public ? 0.55 : 1,
        fine,
      )
    } else {
      this.shockStock(
        'Suspicious bag story hits the wire. Scramble the next alarm, or raise the security budget.',
        this.public ? 0.82 : 1,
        fine,
      )
    }
    this.emit()
  }

  private ensureInbound(): InboundBridge {
    if (!this.inbound) this.inbound = new InboundBridge(this.diplomacySeed)
    return this.inbound
  }

  /**
   * Gross capacity plus module holds, so a stand the sim already occupied
   * is not subtracted twice. Fuel, hotel rooms and hangar bays are gross
   * stocks; the module subtracts what it has reserved.
   */
  private inboundWorld(): InboundWorld {
    const bridge = this.ensureInbound()
    const held = bridge.state.held
    const free = this.freeStands()
    const guard = this.milCapableStands().filter((stand) =>
      free.some((other) => other.c === stand.c && other.r === stand.r),
    )
    const guardKey = new Set(guard.map((stand) => `${stand.c},${stand.r}`))
    let remote = 0
    let contact = 0
    for (const stand of free) {
      const key = `${stand.c},${stand.r}`
      if (guardKey.has(key)) continue
      if (this.standAccess[key] === 'remote') remote += 1
      else contact += 1
    }
    const snap = this.groundSnapshot()
    const simFuel =
      snap != null
        ? this.tankLitres
        : this.fuelBrand && this.fuelLoads > 0
          ? this.fuelLoads * UPLIFT_LITRES
          : 0
    const hotelTiles = tilesOf(this.tiles, 'hotel').length
    const hotelRooms =
      hotelTiles * 8 + (this.hotelLevel >= 2 ? 24 : this.hotelLevel === 1 ? 12 : 0)
    return {
      fieldLevel: this.fieldLevel(),
      feeMultiplier: this.diplomacy?.adapter.engine.state.feeIndex ?? 1,
      weather: this.weather,
      capabilities: {
        stands: contact + held.stands,
        remoteStands: remote + held.remoteStands,
        grassPads: held.grassPads,
        heliPads: this.freePads().length + held.heliPads,
        guardPads: guard.length + held.guardPads,
        arff: tilesOf(this.tiles, 'fire').length > 0,
        ambulance: this.budgetOf('ambulance') >= 40,
        fuelLitres: simFuel,
        hotelRooms,
        securityCorridor:
          tilesOf(this.tiles, 'guard').length > 0 || tilesOf(this.tiles, 'police').length > 0,
        hangarBays: tilesOf(this.tiles, 'hangar').length,
        gpu: free.length > 0,
        catering: Boolean(this.caterBrand),
        cleaning: this.fits.length > 0 || this.janitors > 0,
        customs:
          tilesOf(this.tiles, 'guard').length > 0 ||
          this.fits.some((fit) => (fit.rooms.security ?? 0) > 0),
        runwayMetres: this.longestRunway() * 150,
      },
    }
  }

  /** The open accept / refuse card, if the player still has time. */
  inboundOffer(): InboundOfferView | null {
    if (!this.site) return null
    return this.ensureInbound().offer(this.clock)
  }

  inboundContracts(): InboundContractRow[] {
    return this.inbound?.contracts() ?? []
  }

  inboundHasClearance(): boolean {
    return this.inbound?.clearance() ?? false
  }

  /** Force one card open. The live clock uses tick; tests use this to pick a kind. */
  injectInbound(kind: RequestKind): InboundOfferView | null {
    if (!this.site) return null
    this.ensureInbound().inject(kind)
    this.emit()
    return this.inboundOffer()
  }

  acceptInbound(requestId: string): boolean {
    return this.answerInbound(requestId, 'accept')
  }

  refuseInbound(requestId: string): boolean {
    return this.answerInbound(requestId, 'refuse')
  }

  private answerInbound(requestId: string, choice: 'accept' | 'refuse'): boolean {
    if (!this.site) return false
    const events = this.ensureInbound().respond(this.inboundWorld(), requestId, choice)
    this.applyInboundEvents(events)
    this.emit()
    return events.some((event) => event.type === 'accepted' || event.type === 'refused' || event.type === 'failed_host' || event.type === 'declined')
  }

  signInboundContract(contractId: string): boolean {
    const result = this.ensureInbound().sign(contractId)
    if (result.ok) this.pushNews('Guard contract signed.', 'good')
    else this.pushNews(result.reason, 'bad')
    this.postInboundLedger()
    this.emit()
    return result.ok
  }

  cancelInboundContract(contractId: string): boolean {
    const result = this.ensureInbound().cancel(contractId)
    if (result.ok) this.pushNews('Guard contract cancelled.', 'ok')
    else this.pushNews(result.reason, 'bad')
    this.postInboundLedger()
    this.emit()
    return result.ok
  }

  buyInboundClearance(): boolean {
    if (this.clearanceBusy) return false
    if (this.inboundHasClearance()) {
      this.pushNews('Security clearance already owned.', 'ok')
      this.emit()
      return false
    }
    if (!this.sandbox && this.cash < CLEARANCE_LICENCE_COST) {
      this.pushNews(`Need ${moneyLeft(CLEARANCE_LICENCE_COST)} for security clearance.`, 'bad')
      this.emit()
      return false
    }
    this.clearanceBusy = true
    try {
      const result = this.ensureInbound().buyClearance()
      if (!result.ok) {
        this.pushNews(result.reason, 'bad')
        this.emit()
        return false
      }
      this.postInboundLedger()
      this.pushNews('Security clearance licence on the books.', 'good')
      this.emit()
      return true
    } finally {
      this.clearanceBusy = false
    }
  }

  private tickInbound(step: number) {
    if (!this.site || !(step > 0)) return
    const bridge = this.ensureInbound()
    const dt = this.clock - bridge.state.clock
    const events = bridge.advance(this.inboundWorld(), Math.max(0, dt), this.milAgreement)
    this.applyInboundEvents(events)
    this.releaseDueInbound()
  }

  private applyInboundEvents(events: InboundEvent[]) {
    const bridge = this.ensureInbound()
    for (const event of events) {
      if (event.type === 'accepted') {
        const request = bridge.state.requests.find((item) => item.id === event.requestId)
        const visit = bridge.state.visits.find((item) => item.id === event.visitId)
        if (request && visit) {
          const spawned = this.spawnInboundArrival(request.kind, visit.id, visit.departDay, request.title)
          if (!spawned) {
            this.pushNews(
              `${request.title} accepted — no free pavement. The reservation holds until they leave the books.`,
              'bad',
            )
          }
          this.reputation = Math.max(0, Math.min(100, this.reputation + request.reputationOnAccept))
        }
        if (event.xp > 0) this.grantFieldXp(event.xp, 'inbound')
      } else if (event.type === 'refused') {
        this.reputation = Math.max(0, Math.min(100, this.reputation + event.reputation))
        if (event.fine > 0) {
          this.pushNews(`Refused an inbound request. Fine ${moneyLeft(event.fine)}.`, 'bad')
        }
      } else if (event.type === 'expired') {
        this.reputation = Math.max(0, Math.min(100, this.reputation + event.reputation))
        if (event.fine > 0) {
          this.pushNews(`Missed — no answer. Fine ${moneyLeft(event.fine)}.`, 'bad')
        } else if (event.reputation !== 0) {
          this.pushNews('Missed — no answer.', 'bad')
        }
      } else if (event.type === 'declined') {
        this.pushNews('Walk-in waved off — the field cannot host that ask.', 'ok')
      } else if (event.type === 'failed_host') {
        this.reputation = Math.max(0, Math.min(100, this.reputation + REP_FAIL))
        this.pushNews(`Could not host the inbound. Fine ${moneyLeft(event.fine)}.`, 'bad')
      } else if (event.type === 'departed') {
        this.releaseInboundVisit(event.visitId)
      } else if (event.type === 'military_offered') {
        this.pushNews('Guard sent a contract — Airlines, Contracts.', 'ok')
      } else if (event.type === 'week_audit' && event.breach) {
        this.pushNews('Night sorties breached the city noise line.', 'bad')
      }
    }
    this.postInboundLedger()
  }

  private postInboundLedger() {
    for (const row of this.ensureInbound().freshLedger()) {
      if (row.amount > 0) this.earn(row.amount, row.reason)
      else if (row.amount < 0) this.charge(-row.amount, 'inbound_fine')
    }
  }

  private spawnInboundArrival(kind: RequestKind, visitId: string, departDay: number, title: string): boolean {
    const ids = INBOUND_AIRFRAMES[kind]
    const helo = kind === 'medevac'
    let stand: Vec | null = null
    let route: Vec[] | null = null
    let airframeId = ids[0] ?? 'e175'
    if (helo) {
      stand = this.freePads()[0] ?? null
      if (stand) route = [stand]
      airframeId = 'aw139'
    } else {
      for (const id of ids) {
        const frame = AIRFRAMES[id]
        if (!frame || frame.minRunway > this.longestRunway()) continue
        const gate =
          kind === 'military'
            ? (this.assignMilStand() ?? this.assignStand(null, undefined, undefined, id))
            : this.assignStand(null, undefined, undefined, id)
        const path = gate ? this.landingRoute(gate) : null
        if (gate && path) {
          stand = gate
          route = path
          airframeId = id
          break
        }
      }
    }
    const frame = AIRFRAMES[airframeId]
    if (!frame || !stand || !route) return false
    this.flightSeq += 1
    const call = inboundCallsign(kind, this.flightSeq)
    const approach = helo
      ? { x: stand.c + 5.5, y: stand.r - 4.5, z: 11, path: route }
      : this.armApproach(route)
    const posted = emptyPosted()
    posted.landing = true
    const pax = frame.paxMax > 0 ? this.flightLoad(frame, 'business', frame.kind === 'freighter').pax : 0
    const f: Flight = {
      id: uid('in'),
      airline: this.signed[0] ?? 'harbor',
      flightNo: call,
      airframeId: frame.id,
      airframeName: frame.name,
      pax,
      cargo: frame.kind === 'freighter',
      craft: helo ? 'helo' : 'jet',
      kind: frame.kind,
      phase: 'approach',
      stand,
      x: approach.x,
      y: approach.y,
      z: approach.z,
      heading: helo ? Math.atan2(stand.r - approach.y, stand.c - approach.x) : 0,
      path: approach.path,
      seg: 0,
      t: 0,
      holdAngle: 0,
      posted,
      waitingOn: emptyWaiting(),
      phaseTime: 0,
      ledger: [],
      inboundVisitId: visitId,
      inboundReleaseAt: departDay * SIM_DAY_SEC,
      emergencyHost: true,
    }
    this.flights.push(f)
    this.noteCraft(frame.kind)
    this.selectedFlight = this.selectedFlight ?? f.id
    this.pushNews(`${call} · ${title} inbound → ${this.gateLabel(stand)}.`, 'ok')
    return true
  }

  private releaseInboundVisit(visitId: string) {
    const flight = this.flights.find((item) => item.inboundVisitId === visitId && item.phase !== 'gone')
    if (!flight) return
    flight.inboundReleaseAt = this.clock
    if (flight.phase === 'parked') this.releaseInboundFlight(flight)
  }

  private releaseDueInbound() {
    for (const flight of this.flights) {
      if (!flight.inboundVisitId || flight.phase !== 'parked') continue
      if (this.clock >= (flight.inboundReleaseAt ?? Number.POSITIVE_INFINITY)) {
        this.releaseInboundFlight(flight)
      }
    }
  }

  /** Taxi a parked inbound arrival off the stand. Retries while the pavement is busy. */
  private releaseInboundFlight(flight: Flight): boolean {
    if (flight.phase === 'gone' || flight.phase === 'takeoff' || flight.phase === 'taxi_out') return true
    if (flight.phase !== 'parked') return false
    if (flight.craft === 'helo') {
      flight.phase = 'gone'
      flight.phaseTime = 0
      return true
    }
    if (this.groundBusy()) return false
    const out = this.departurePath(flight)
    if (!out) return false
    flight.path = out
    flight.seg = 0
    flight.t = 0
    flight.phase = 'taxi_out'
    flight.phaseTime = 0
    this.pushNews(`${flight.flightNo} released from the inbound stand.`, 'ok')
    return true
  }

  /** Budget slider, thinned while a strike has that pool out. Never raises a pool. */
  budgetOf(key: BudgetKey): number {
    const raw = this.budgets[key]
    const scale = this.disruptions.staffScale(key)
    if (!Number.isFinite(raw) || !Number.isFinite(scale) || scale >= 0.999) return raw
    return raw * Math.min(1, Math.max(0.4, scale))
  }

  disruptionFeed() {
    return this.disruptions.visible()
  }

  disruptionStamp(): string {
    return this.disruptions.stamp()
  }

  ignoreDisruption(id: string) {
    const ok = this.disruptions.ignore(id)
    if (ok) this.emit()
    return ok
  }

  dismissDisruption(id: string) {
    const ok = this.disruptions.dismiss(id)
    if (ok) this.emit()
    return ok
  }

  minimiseDisruption(id: string) {
    const ok = this.disruptions.minimise(id)
    if (ok) this.emit()
    return ok
  }

  expandDisruption(id: string) {
    const ok = this.disruptions.expand(id)
    if (ok) this.emit()
    return ok
  }

  /** Point the player at the hall or the apron. The follow camera stays untouched. */
  panToDisruption(id: string) {
    const item = this.disruptions.visible().find((entry) => entry.id === id)
    if (!item) return
    const hall = item.focus === 'checkin' || item.focus === 'security'
    this.setView(hall ? 'hall' : 'apron')
    this.pushNews(`Pan — ${item.title}. ${item.suggestedFix}`, 'ok')
    this.emit()
  }

  tick(dt: number) {
    // Apron builds and bulldozes coalesce into one advisor pass per frame, paused or not.
    if (this.adviceDirty && this.site) {
      this.adviceDirty = false
      this.refreshAdvice()
      this.refreshTips()
      this.emit()
    }
    if (!this.site || this.speed === 0) return
    this.suppressEmit++
    try {
    this.runwayLoadOpen = true
    this.runwayLoadCache = null
    const step = dt * this.speed
    this.clock += step
    this.scanAlerts(step)
    this.simClock.advanceRealSeconds(dt, this.speed)
    this.ensureEconomy().tick(step * SIM_MINUTES_PER_REAL_SECOND)
    this.tickAmbience(dt)
    this.sampleEconomy(step)
    this.spawnCool = Math.max(0, this.spawnCool - step)
    this.offerCool = Math.max(0, this.offerCool - step * (1 + this.tycoonAirlineInterest()))
    this.congNewsCool = Math.max(0, this.congNewsCool - step)
    this.tickCityCargo(step)
    this.tickLandside(step)
    this.tickConstruction(step)
    this.pushShelfEdits()
    this.tickCatering(step)
    this.tickCarts(step)
    this.tickGround(step)
    this.tickCargo(step)
    this.tickTier3(step)
    this.syncPowerAdvice()
    this.tickDiplomacy(step)
    this.tickShelves(step)
    // Peak decays so the HUD jam line clears when traffic thins.
    this.congPeak = Math.max(0, this.congPeak - step * 0.35)
    if (this.congWasteAcc >= 8 && this.congNewsCool <= 0) {
      const lost = Math.round(this.congWasteAcc)
      this.pushNews(
        `Apron jam — traffic neck cost ~${lost}s. Widen taxi or move remote stands onto jetway/bus.`,
        'bad',
      )
      this.congWasteAcc = 0
      this.congNewsCool = 40
    } else if (this.congWasteAcc > 0 && this.congPeak < 1.2) {
      this.congWasteAcc = Math.max(0, this.congWasteAcc - step * 0.5)
    }
    this.saveTimer += step
    if (this.saveTimer > 8) {
      this.saveTimer = 0
      this.persist()
    }
    for (const n of this.news) n.age += step
    if (this.offer) {
      this.offer.age += step
      if (!this.letterHeld('contract')) this.offer.deadline -= step
      if (this.offer.deadline <= 0) this.expireOffer()
    }

    this.loanNewsCool = Math.max(0, this.loanNewsCool - step)
    if (this.loanBalance > 0 && !this.sandbox) {
      this.interestCool -= step
      if (this.interestCool <= 0) {
        const prod =
          this.loanProduct(this.loanProductId) ??
          LOAN_PRODUCTS.find((p) => p.id === 'bridge')!
        this.interestCool = Math.max(12, prod.every)
        const opened =
          this.loanOpened > 0 ? this.loanOpened : prod.principal + prod.fee
        // Interest plus a principal installment. Cash below zero pays nothing and is never reset upward.
        const tick = settleLoanTick(this.loanBalance, this.cash, opened, prod)
        const stamp = this.simMinutes()
        if (tick.interestPaid > 0) {
          this.noteExpense(tick.interestPaid)
          this.cash -= tick.interestPaid
          this.postJournal('loan_interest', tick.interestPaid, stamp)
        }
        if (tick.principalPaid > 0) {
          this.cash -= tick.principalPaid
          this.postJournal('loan_repayment', tick.principalPaid, stamp)
        }
        this.postUnpaid('loan_interest', tick.interest - tick.interestPaid, stamp)
        this.postUnpaid('loan_repayment', tick.installment - tick.principalPaid, stamp)
        this.loanBalance = tick.balance
        if (this.loanBalance <= 0) {
          this.loanBalance = 0
          this.loanProductId = null
          this.loanPrincipal = 0
          this.loanOpened = 0
          this.reputation = Math.min(100, this.reputation + 3)
          this.grantFieldXp(8, 'loan clear')
          this.pushNews(`${prod.label} repaid on schedule. Loan cleared.`, 'good')
        } else if (!(tick.short > 0)) {
          if (this.loanNewsCool <= 0) {
            this.pushNews(
              `${prod.label} payment ${moneyLeft(tick.interestPaid + tick.principalPaid)} (interest ${moneyLeft(tick.interestPaid)}). Owed ${moneyLeft(this.loanBalance)}.`,
              'ok',
            )
            this.loanNewsCool = Math.max(40, prod.every * 0.85)
          }
        } else {
          // One dip per game day like payroll, not one per ~55s tick (that stacked ~-5 rep a day).
          const day = this.gameDay()
          if (day !== this.loanShortDay) {
            this.loanShortDay = day
            this.reputation = Math.max(0, this.reputation - 1.5)
          }
          if (this.loanNewsCool <= 0) {
            this.pushNews(
              `${prod.label} payment short ${moneyLeft(tick.short)}, reputation dips. Owed ${moneyLeft(this.loanBalance)}.`,
              'bad',
            )
            this.loanNewsCool = 25
          }
        }
      }
    } else if (this.sandbox && this.loanBalance > 0) {
      // Sandbox: loan is bookkeeping only — no interest freak-out.
      this.interestCool = 9999
    }
    // City rail soft-boosts pax demand via reputation drip.
    if (this.railLinked && Math.random() < step * 0.02) {
      this.reputation = Math.min(100, this.reputation + 0.05)
    }

    this.considerOffers()
    this.mxOfferCool = Math.max(0, this.mxOfferCool - step)
    if (this.mxOffer) {
      this.mxOffer.age += step
      if (!this.letterHeld('mx')) this.mxOffer.deadline -= step
      if (this.mxOffer.deadline <= 0) this.expireMxOffer()
    }
    this.considerMxOffers()
    this.tickFieldTask(step)
    this.tickCargoVolume(step)
    this.tickLayover(step)
    this.tickHub(step)
    this.tickHubConnections()
    this.tickParking(step)
    this.tickJanitors(step)
    this.tickHallJanitors(step)
    this.tickResearchers(step)
    // Day 1 specialization points. No staff and no rooms required.
    const gear = this.labGear()
    this.wave3.tick(step, true, { desk: gear.desks, board: gear.boards, machine: gear.machines })
    this.researchTree.tick(
      step,
      true,
      { desk: gear.desks, board: gear.boards, machine: gear.machines },
      this.researchers,
      this.fieldLevel(),
    )
    this.tickDeskStaff(step)
    this.tickAirlineRelations(step)
    this.tickSchedule(step)
    this.tickShowUp()
    this.trySpawn()
    this.heloCool = Math.max(0, this.heloCool - step)
    this.contractHeloCool = Math.max(0, this.contractHeloCool - step)
    this.milCool = Math.max(0, this.milCool - step)
    this.ambuCool = Math.max(0, this.ambuCool - step)
    this.trySpawnHelo()
    this.trySpawnMilitary()
    this.trySpawnAirAmbulance()
    this.releaseHold()
    this.tickHoldWatchdog(step)
    this.tickPatrols(step)
    this.tickThreats(step)
    this.tickEmergencies(step)
    this.tickInbound(step)
    this.tickDisruptions()
    this.tickOpsEvents()
    this.tickMarket(step)
    this.tickHall(step)
    this.tickHallNav(step)
    this.tickLuggage(step)
    this.tickWeather(step)
    this.noteMapClimate()
    this.tickPayroll(step)
    this.tickScaleFuel(step)
    this.noteFuelChain(0)
    this.pokeTycoon()
    this.tickMaintenance(step)
    this.tickFireRisk(step)
    this.crashCool = Math.max(0, this.crashCool - step)

    this.releaseFinishedMro()
    this.tickAtc(step)
    for (const f of this.flights) {
      if (f.phase === 'gone') continue
      // A legal ground hold is progress. Counting it made a clear taxi look stuck.
      const groundPhase = (STUCK_PHASES as readonly string[]).includes(f.phase)
      if (!(groundPhase && this.taxiHoldPaused(f))) f.phaseTime += step
      if (f.craft === 'helo') {
        this.tickHelo(f, step)
        continue
      }
      if (this.applyMroHold(f)) continue
      if (f.phase === 'hold') {
        f.holdAngle += step * 0.35
        f.x = SIZE / 2 + Math.cos(f.holdAngle) * 9
        f.y = -2.5 + Math.sin(f.holdAngle) * 1.6
        f.z = 9
        f.heading = f.holdAngle + Math.PI / 2
      } else if (f.phase === 'approach') {
        const threshold =
          f.path.find((p) => inBounds(Math.round(p.c), Math.round(p.r))) ??
          f.path[f.path.length - 1]
        const dist = threshold ? Math.hypot(f.x - threshold.c, f.y - threshold.r) : 0
        const glide = clamp(0.35 + dist * 0.7, 0.35, 22)
        f.z = lerp(f.z, glide, 1 - Math.pow(0.18, step))
        const runwaysAhead = this.atcRunwaysAhead(f)
        if (runwaysAhead.length) {
          this.atc.onFinal(f.id, runwaysAhead, dist / 1.85)
          if (this.atcTouchdownDue(f, dist) && !this.atc.requestLanding(f.id, runwaysAhead)) {
            this.goAround(f)
            continue
          }
        }
        const arrived = this.followPath(f, 1.85, step)
        const onField = inBounds(Math.round(f.x), Math.round(f.y))
        if (
          (arrived || (onField && f.phaseTime > 10) || f.phaseTime > 36) &&
          (!runwaysAhead.length || this.atc.requestLanding(f.id, runwaysAhead))
        ) {
          f.phase = 'landing'
          f.phaseTime = 0
          f.z = Math.min(f.z, 1.4)
        }
      } else if (f.phase === 'landing') {
        f.z = lerp(f.z, 0.15, 1 - Math.pow(0.05, step))
        if (this.checkCrash(f, 'landing')) continue
        const arrived = this.atcFollow(f, 1.35, step)
        const onStand = f.stand && Math.hypot(f.x - f.stand.c, f.y - f.stand.r) < 0.35
        if (onStand || arrived) {
          f.phase = 'taxi_in'
          f.phaseTime = 0
        }
      } else if (f.phase === 'taxi_in') {
        f.z = 0.12
        if (!this.taxiRouteReady(f)) {
          this.holdForTaxi(f)
        } else if (this.atcFollow(f, 1.1, step)) {
          f.phase = 'deboard'
          f.phaseTime = 0
          this.beginServicing(f)
        }
      } else if (f.phase === 'deboard') {
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const pace = this.rampPace(f.airframeId, Boolean(f.cargo || f.kind === 'freighter'), f.airline)
        const deboardReady =
          f.cargo ||
          (mode === 'jetway' && f.phaseTime > 3.2 * pace) ||
          (mode === 'bus' &&
            ((f.waitingOn.paxOut <= 0 && f.phaseTime > 4.5 * pace) || f.phaseTime > 18 * pace)) ||
          (mode === 'walk' &&
            ((f.phaseTime > 6 * pace && f.waitingOn.paxOut <= 2) || f.phaseTime > 16 * pace))
        if (deboardReady) {
          f.phase = 'servicing'
          f.phaseTime = 0
        }
      } else if (f.phase === 'servicing') {
        const special =
          f.kind === 'military' || f.kind === 'air_ambulance' || f.kind === 'freighter'
        if (
          !special &&
          f.phaseTime > 2.5 &&
          !f.ledger.some((r) => r.label.includes('cleaning'))
        ) {
          this.earn(
            serviceCharge(this.listed(CLEANING_FEE, 'cleaning'), this.feeTier(f.airline), this.walkInFlight(f)),
            `${f.flightNo} cabin cleaning`,
            f,
            'contract_fees',
          )
        }
        const waiting =
          (f.waitingOn.bags && !f.posted.bags) ||
          (f.waitingOn.fuel && !f.posted.fuel) ||
          (f.waitingOn.catering && !f.posted.catering)
        const pace = this.rampPace(f.airframeId, Boolean(f.cargo || f.kind === 'freighter'), f.airline)
        if (
          this.cateringCartClear(f.id) &&
          ((!waiting && f.phaseTime > 4 * pace) || f.phaseTime > Math.min(36, 22 * pace))
        ) {
          f.waitingOn.bags = false
          f.waitingOn.fuel = false
          f.waitingOn.catering = false
          if (f.mxPending && !f.posted.mx && this.startHangarMx(f)) {
            // Handled — plane rolling to hangar bay.
          } else if (f.inboundVisitId) {
            f.phase = 'parked'
            f.phaseTime = 0
            if (this.clock < (f.inboundReleaseAt ?? 0)) {
              this.pushNews(
                `${f.flightNo} on stand until the inbound stay ends.`,
                'ok',
              )
            } else {
              this.releaseInboundFlight(f)
            }
          } else if (f.ga) {
            f.phase = 'parked'
            f.phaseTime = 0
            this.pushNews(
              `${f.flightNo} parked at ${this.gateLabel(f.stand)} — leave by ${Math.max(0, Math.round((f.parkLeaveBy ?? this.clock) - this.clock))}s.`,
              'ok',
            )
          } else if (f.cargo || f.kind === 'military' || f.kind === 'air_ambulance') {
            const deiceOk =
              (f.phaseTime > 3 ? this.ensureDeice(f) : !this.needsDeiceService(f)) ||
              f.phaseTime > 28
            const ramp = this.rampCall(f, f.phaseTime > 80)
            const stripClear = !this.stripsForDeparture(f).some((index) => this.arrivalOnApproach(index))
            if (
              deiceOk &&
              ramp !== 'hold' &&
              (this.departureMayEnterStrip(f) ||
                (f.phaseTime > this.specialStripWindow() && stripClear) ||
                (this.runwayOverbooked() && f.phaseTime > 24)) &&
              (!this.groundBusy() || f.phaseTime > 24)
            ) {
              if (ramp === 'short') {
                this.adjustHeat(f.airline, -1.2)
                this.pushNews(
                  `${f.flightNo} pushed with the ramp unfinished. Standing dips.`,
                  'bad',
                )
              }
              if (!f.posted.deiced && this.needsDeiceService(f)) {
                f.waitingOn.deice = false
                this.adjustHeat(f.airline, -1.2)
                this.pushNews(
                  `${f.flightNo} pushed without glycol — Standing dips.`,
                  'bad',
                )
              }
              f.phase = 'pushback'
              f.phaseTime = 0
              if (f.stand) {
                f.path = this.pushbackPath(f.stand, f.heading)
                f.seg = 0
                f.t = 0
              }
            }
          } else {
            f.phase = 'board'
            f.phaseTime = 0
            this.beginBoarding(f)
          }
        }
      } else if (f.phase === 'mx_taxi') {
        f.z = 0.12
        if (!this.taxiRouteReady(f)) {
          this.holdForTaxi(f)
        } else if (this.atcFollow(f, 1.05, step)) {
          const bay = f.hangarBay
          if (bay) {
            f.x = bay.c
            f.y = bay.r
          }
          f.phase = 'mx_bay'
          f.phaseTime = 0
          f.mxDuration = this.hangarMxFor(bay)
          f.mxEndsAt = this.clock + f.mxDuration
          this.pushNews(
            `${f.flightNo} in hangar bay — MX ~${Math.ceil(f.mxDuration)}s.`,
            'ok',
          )
        }
      } else if (f.phase === 'mx_bay') {
        f.z = 0.1
        if (this.clock >= (f.mxEndsAt ?? this.clock) || f.phaseTime > 36) {
          const pay = f.mxPay ?? 0
          if (pay > 0) this.earn(pay, `${f.flightNo} hangar line MX`, f)
          f.posted.mx = true
          f.waitingOn.mx = false
          f.mxPay = 0
          f.mxEndsAt = null
          if (f.stand) {
            const back =
              nearestPath(this.tiles, f.hangarBay ?? { c: f.x, r: f.y }, [f.stand], 'jet') ?? [
                f.stand,
              ]
            f.path = jetRouteOnGraph(this.tiles, back) ? back : []
            f.seg = 0
            f.t = 0
            f.phase = 'mx_return'
            f.phaseTime = 0
          } else {
            f.phase = 'board'
            f.phaseTime = 0
            this.beginBoarding(f)
          }
        }
      } else if (f.phase === 'mx_return') {
        f.z = 0.12
        if (!this.taxiRouteReady(f)) {
          this.holdForTaxi(f)
        } else if (this.atcFollow(f, 1.05, step)) {
          if (f.stand) {
            f.x = f.stand.c
            f.y = f.stand.r
          }
          f.hangarBay = null
          if (f.cargo || f.kind === 'military' || f.kind === 'air_ambulance') {
            const ramp = this.rampCall(f, f.phaseTime >= 90)
            if (ramp === 'hold' || !this.departureMayEnterStrip(f)) {
              /* Fuel outage, the ramp is still inside its window, or an arrival owns the strip. */
            } else {
              if (ramp === 'short') {
                this.adjustHeat(f.airline, -1.2)
                this.pushNews(
                  `${f.flightNo} pushed with the ramp unfinished. Standing dips.`,
                  'bad',
                )
              }
              f.phase = 'pushback'
              f.phaseTime = 0
              if (f.stand) {
                f.path = this.pushbackPath(f.stand, f.heading)
                f.seg = 0
                f.t = 0
              }
            }
          } else {
            f.phase = 'board'
            f.phaseTime = 0
            this.beginBoarding(f)
          }
        }
      } else if (f.phase === 'parked') {
        // Occupies stand until releaseGa / auto leave in tickParking.
      } else if (f.phase === 'board') {
        const mode = f.stand ? this.standPaxMode(f.stand) : 'walk'
        const pace = this.rampPace(f.airframeId, Boolean(f.cargo || f.kind === 'freighter'), f.airline)
        const boardLimit = this.boardCap(f)
        const bagsReady = !f.waitingOn.bagsLoad || f.posted.bagsLoad
        const minBoard =
          (mode === 'jetway' ? (f.boardingSlow ? 5 : 3.2) : f.boardingSlow ? 9 : 5) * pace
        const boardReady =
          f.waitingOn.paxIn <= 0 && bagsReady && f.phaseTime > minBoard
        if (f.boardingSlow && f.phaseTime > 8 && f.phaseTime < 8.4) {
          const next = this.openSchedule().find(
            (s) => s.id !== f.scheduleId && (s.status === 'scheduled' || s.status === 'delayed'),
          )
          if (next) {
            this.nudgeSlot(next, 12 + Math.random() * 10, 'Slow boarding upstream')
            this.pushNews(
              `${f.flightNo} slow boarding — ${next.flightNo} and the bank slide.`,
              'bad',
            )
          } else {
            this.adjustHeat(f.airline, -2)
            this.pushNews(`${f.flightNo} slow boarding — Standing dips.`, 'bad')
          }
          f.boardingSlow = false
        }
        if (f.phaseTime > 3) this.ensureDeice(f)
        if (this.outboundCartClear(f.id) && (boardReady || f.phaseTime > boardLimit)) {
          const deiceOk =
            this.ensureDeice(f) || f.phaseTime > boardLimit + 14
          // Pushback beat — tug-out before the taxi bank clears.
          const ramp = this.rampCall(f, f.phaseTime > boardLimit + 80)
          if (
            deiceOk &&
            ramp !== 'hold' &&
            (this.departureMayEnterStrip(f) ||
              (this.runwayOverbooked() && f.phaseTime > boardLimit + 4)) &&
            (!this.groundBusy() || f.phaseTime > boardLimit + 4)
          ) {
            if (ramp === 'short') {
              this.adjustHeat(f.airline, -1.2)
              this.pushNews(
                `${f.flightNo} pushed with the ramp unfinished. Standing dips.`,
                'bad',
              )
            }
            if (!f.posted.deiced && this.needsDeiceService(f)) {
              f.waitingOn.deice = false
              this.adjustHeat(f.airline, -1.5)
              this.pushNews(
                `${f.flightNo} pushed without glycol — Standing dips.`,
                'bad',
              )
            }
            this.settleOutboundBags(f, true)
            f.phase = 'pushback'
            f.phaseTime = 0
            if (f.stand) {
              f.path = this.pushbackPath(f.stand, f.heading)
              f.seg = 0
              f.t = 0
            }
            if (Math.random() < 0.35) {
              this.pushNews(`${f.flightNo} pushback — clear the alley.`, 'ok')
            }
          } else if (f.phaseTime > boardLimit + 6 && deiceOk && this.runwayOverbooked()) {
            const next = this.openSchedule()[0]
            if (next && Math.random() < step * 0.35) {
              this.delaySlot(next, 8, 'Departure blocked')
            }
          }
        }
      } else if (f.phase === 'pushback') {
        // Short shove off the stand, then join the outbound taxi.
        // The strip stays open for this shove: the roll waits at the hold line.
        if (this.taxiRouteReady(f)) this.atcFollow(f, 0.55, step)
        if (f.phaseTime > 2.8) {
          const out = this.departurePath(f)
          const clear = out != null && this.departureMayEnterStrip(f)
          const departStrips = this.stripsForDeparture(f)
          const yieldToSchedule =
            (f.kind === 'air_ambulance' || f.kind === 'military') &&
            departStrips.some((index) => this.scheduledArrivalSoon(this.specialStripWindow(), index))
          const force =
            out != null &&
            f.phaseTime > 45 &&
            !departStrips.some((index) => this.arrivalOnApproach(index)) &&
            !yieldToSchedule
          if (out && (clear || force)) {
            f.path = out
            f.seg = 0
            f.t = 0
            if (!f.cargo) this.settleOutboundBags(f, true)
            f.phase = 'taxi_out'
            f.phaseTime = 0
          } else if (f.phaseTime > 8 && !out) {
            this.holdForTaxi(f)
          }
        }
      } else if (f.phase === 'taxi_out') {
        if (!this.taxiRouteReady(f)) {
          this.holdForTaxi(f)
        } else {
          // Hold short of the pavement. Taxi up to that line is still allowed.
          // One roll has to finish before the next arrival locks.
          if (
            !this.atc.holdsRunway(f.id) &&
            !this.runwayOverbooked() &&
            this.aboutToEnterStrip(f) &&
            !this.departureFitsHole(f)
          ) {
            /* stay on the taxi side */
          } else if (this.atcFollow(f, 1.2, step)) {
            f.phase = 'takeoff'
            f.phaseTime = 0
          }
        }
      } else if (f.phase === 'takeoff') {
        if (f.phaseTime < 1.2 && this.checkCrash(f, 'takeoff')) continue
        if (f.z > 1 || f.phaseTime > 3) this.atc.airborne(f.id)
        f.z += step * 0.9
        f.x += Math.cos(f.heading) * step * 2.6
        f.y += Math.sin(f.heading) * step * 2.6
        if ((hasLeftMap(f.x, f.y, SIZE) && f.z > 6) || f.phaseTime > 26) {
          f.phase = 'gone'
          this.flightsDone += 1
          this.paxServed += f.pax
          this.noteTurn(f)
          this.grantResearchForFlight(f)
          if (f.kind !== 'military' && f.kind !== 'air_ambulance') {
            this.grantFieldXp(6 + Math.min(8, Math.floor(f.pax / 40)), 'turnaround')
          }
          if (!this.firstTakeoffNoted && f.kind !== 'military' && f.kind !== 'air_ambulance') {
            this.firstTakeoffNoted = true
            this.coachDismissed = true
            this.refreshAdvice()
            this.reputation = Math.min(100, this.reputation + 2)
            this.pushNews(
              `First turn in the book — ${f.flightNo} airborne. Field Rating ${this.fieldRating()}. Airlines will start asking for upgrades; hangar-side pads unlock Guard.`,
              'good',
            )
          }
          if (f.kind !== 'military' && f.kind !== 'air_ambulance') {
            this.adjustHeat(f.airline, 1.8)
          }
          // Night bank: freighter money vs city noise on pax carriers.
          if (
            f.kind === 'freighter' &&
            this.hasResearch('night_bank') &&
            this.isNight()
          ) {
            for (const id of this.signed) {
              const a = this.airline(id)
              if (a.persona === 'luxury' || a.persona === 'business') {
                this.adjustHeat(id, -0.35)
              }
            }
          }
          if (f.scheduleId) {
            const slot = this.schedule.find((s) => s.id === f.scheduleId)
            if (slot) slot.status = 'done'
          }
          this.gradeDiplomacyTurn(f)
          this.scoreWave3Turn(f)
          this.noteCargoDepart(f)
          this.pushNews(`${f.flightNo} airborne.`, 'ok')
          this.spawnCool = Math.min(this.spawnCool, 8)
        }
      }
    }
    this.flights = this.flights.filter((f) => {
      if (f.phase !== 'gone') return true
      this.departedFlights.add(f.id)
      for (const line of f.ledger) {
        if (line.amount > 0) {
          this.settledPayments.push({
            flightNo: f.flightNo,
            label: line.label,
            amount: line.amount,
          })
        }
      }
      if (this.settledPayments.length > 64) {
        this.settledPayments.splice(0, this.settledPayments.length - 64)
      }
      return false
    })

    for (const t of this.trucks) {
      if (t.kind === 'contractor' || t.kind === 'delivery') {
        this.tickBuildTruck(t, step)
        continue
      }
      // Makeup / farm bottom-load before rolling.
      if (t.preDwell > 0) {
        t.preDwell -= step
        continue
      }
      if (t.dwell > 0) {
        t.dwell -= step
        if (t.dwell <= 0 && t.kind === 'bags' && t.mission === 'to_claim' && t.returning) {
          if (this.truckWaitsForCart(t)) {
            t.dwell = 0.25
            continue
          }
          // Finished inbound sort dwell — inject onto assigned claim.
          this.finishTruck(t)
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.dwell <= 0 && t.kind === 'citycargo') {
          this.finishCityCargo(t)
          continue
        }
        if (t.dwell <= 0 && !t.returning) {
          if (this.truckWaitsForCart(t)) {
            t.dwell = 0.25
            continue
          }
          this.finishTruck(t)
          const from = { c: Math.round(t.x), r: Math.round(t.y) }
          if (t.kind === 'termbus') {
            t.returning = true
            if (t.home) {
              const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
              t.path = homePath && homePath.length > 1 ? homePath : [...t.path].reverse()
            } else {
              t.path = [...t.path].reverse()
            }
            t.seg = 0
            t.t = 0
            continue
          }
          // Arrival bags: plane → shed sort (process dwell) → claim inject.
          if (t.kind === 'bags' && t.mission === 'unload' && t.home) {
            const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
            const claimPath = nearestPath(this.tiles, from, [t.home], 'truck')
            t.mission = 'sort_inbound'
            t.returning = true
            t.path = claimPath && claimPath.length > 1 ? claimPath : [...t.path].reverse()
            t.seg = 0
            t.t = 0
            if (fl) this.setBagStage(fl, 'inbound_sort')
            continue
          }
          // Fuel: mark reload needed, deadhead to farm (or continue if stock left).
          if (t.kind === 'fuel') {
            if (this.fuelLoads >= 1 && Math.random() < 0.45 && this.retargetFuelTruck(t)) {
              continue
            }
            t.mission = 'fuel_reload'
            t.returning = true
            if (t.home) {
              const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
              t.path = homePath && homePath.length > 1 ? homePath : [...t.path].reverse()
            } else {
              t.path = [...t.path].reverse()
            }
            t.seg = 0
            t.t = 0
            continue
          }
          // Load / cater — continue or return home.
          if (t.kind === 'bags' && t.mission === 'load' && this.retargetBagsTruck(t)) {
            continue
          }
          t.returning = true
          if (t.home) {
            const homePath = nearestPath(this.tiles, from, [t.home], 'truck')
            t.path = homePath && homePath.length > 1 ? homePath : [...t.path].reverse()
          } else {
            t.path = [...t.path].reverse()
          }
          t.seg = 0
          t.t = 0
        }
        continue
      }
      const done = this.followPath(
        t,
        t.kind === 'termbus' ? 1.55 : t.kind === 'citycargo' ? 1.35 : 1.8,
        step,
      )
      if (done && !t.returning) {
        // Service dwell at the aircraft (fuel = bond + pump; deice = spray).
        if (t.kind === 'citycargo') {
          if (t.mission === 'city_guard') {
            // Visible screen time at the post (Manor Lords handoff).
            t.dwell = 1.4 + Math.min(2.2, (t.cargoUnits ?? 12) * 0.04)
          } else if (t.mission === 'city_shed') {
            t.dwell = 1.6 + Math.min(2.5, (t.cargoUnits ?? 12) * 0.05)
          } else {
            t.dwell = 1.2
          }
        } else if (t.kind === 'termbus') {
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          if (fl) {
            if (t.mission === 'ferry_arr') fl.waitingOn.paxOut = 0
            if (t.mission === 'ferry_dep') fl.waitingOn.paxIn = 0
          }
          t.dwell = 1.8
          t.serviceFor = t.dwell
        } else if (t.kind === 'bags') {
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          if (t.mission === 'unload') {
            if (fl && !fl.cargo) this.setBagStage(fl, 'unload_aircraft')
            t.dwell = fl
              ? fl.cargo
                ? clamp(1.6 + (t.cargoUnits ?? 12) * 0.05, 1.6, 5)
                : this.bagWorkSeconds(fl, 'ramp')
              : 2.4
            if (fl && !fl.cargo) t.cargoUnits = fl.bagUnits ?? 8
          } else if (t.mission === 'load') {
            if (fl) this.setBagStage(fl, 'load_aircraft')
            t.dwell = fl ? this.bagWorkSeconds(fl, 'ramp') : 2.6
            t.cargoUnits = fl?.bagsDeposited ?? fl?.bagUnits ?? 8
          } else {
            t.dwell = 2.2
          }
          if (t.dwell > 0) t.serviceFor = t.dwell
        } else {
          t.dwell =
            t.kind === 'fuel'
              ? fuelDwellSeconds(
                  AIRFRAMES[
                    this.flights.find((x) => x.id === t.flightId)?.airframeId ?? ''
                  ],
                )
              : t.kind === 'deice'
                ? 3.2
                : 2.2
          if ((t.kind === 'fuel' || t.kind === 'catering') && t.dwell > 0) t.serviceFor = t.dwell
        }
      } else if (done && t.returning) {
        if (t.kind === 'citycargo') {
          this.finishCityCargo(t)
          continue
        }
        // Arrived home / claim / farm.
        if (t.kind === 'bags' && t.mission === 'sort_inbound') {
          // Visible process time at makeup before claim belt inject.
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          this.finishTruck(t) // stage → deliver_claim news
          t.dwell = fl ? this.bagWorkSeconds(fl, 'sort') : 1.6
          t.mission = 'to_claim'
          t.returning = true
          continue
        }
        if (t.kind === 'bags' && t.mission === 'to_claim') {
          if (this.truckWaitsForCart(t)) {
            t.dwell = 0.25
            continue
          }
          this.finishTruck(t) // inject onto assigned claim
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.kind === 'bags' && t.mission === 'pickup') {
          const fl = t.flightId ? this.flights.find((x) => x.id === t.flightId) : null
          if (fl) this.setBagStage(fl, 'load_aircraft')
          // Makeup carts staged — roll to the outbound stand.
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.kind === 'bags') {
          if (this.retargetBagsTruck(t)) continue
          t.dwell = -99
          continue
        }
        if (t.kind === 'fuel') {
          // Bottom-load at farm, then continue if work remains.
          t.preDwell = 1.5
          t.mission = 'fuel_reload'
          if (this.fuelLoads >= 1 && this.retargetFuelTruck(t)) continue
          t.dwell = -99
          continue
        }
        t.dwell = -99
      }
    }
    this.trucks = this.trucks.filter((t) => t.dwell !== -99)

    for (const p of this.people) {
      if (p.t < 0) {
        p.t += step
        continue
      }
      const here = this.tile({ c: Math.round(p.x), r: Math.round(p.y) })
      const done = this.followPath(
        p,
        (p.job === 'patrol' || p.job === 'mechanic' ? 1.0 : 1.15) * personSpeedMult(here),
        step,
      )
      if (!done) continue
      if (p.job === 'patrol') {
        p.stage = 99
        continue
      }
      if (p.job === 'mechanic') {
        // Line MX visit: pay at stand, then walk home to hangar.
        if (p.mxPay != null && p.flightId) {
          const f = this.flights.find((x) => x.id === p.flightId)
          if (f && !f.posted.mx) {
            this.earn(p.mxPay, `${f.flightNo} line MX`, f)
            f.posted.mx = true
            f.waitingOn.mx = false
          }
          p.mxPay = undefined
          const hangars = tilesOf(this.tiles, 'hangar')
          if (hangars.length) {
            const home = nearestPath(
              this.tiles,
              { c: Math.round(p.x), r: Math.round(p.y) },
              hangars,
              'mechanic',
            )
            if (home && home.length > 1) {
              p.path = home
              p.seg = 0
              p.t = 0
              p.flightId = ''
              p.label = 'mx-home'
              continue
            }
          }
          p.stage = 99
          continue
        }
        // Finished MX return — despawn at hangar. Idle pavement walkers linger.
        if (p.label === 'mx-home') {
          p.stage = 99
          continue
        }
        p.path = [{ c: Math.round(p.x), r: Math.round(p.y) }]
        p.seg = 0
        p.t = 0
        continue
      }
      const f = this.flights.find((x) => x.id === p.flightId)
      const fit = this.roomsAt(f?.stand ?? null)
      const result = advancePaxItinerary(p, this.tiles, f?.stand ?? null, fit, (amount, kind) => {
        this.cash += amount
        this.revenue += amount
        this.noteIncome(amount, 'retail_sales')
        if (kind === 'food') this.mealSold = true
      })
      if (result === 'done') {
        p.stage = 99
        if (f) {
          if (p.job === 'arrive') f.waitingOn.paxOut = Math.max(0, f.waitingOn.paxOut - 1)
          if (p.job === 'board') f.waitingOn.paxIn = Math.max(0, f.waitingOn.paxIn - 1)
        }
      }
    }
    this.people = this.people.filter((p) => p.stage < 99)

    this.tickStuckWatchdog()

    // UI refresh — keep React off the hot path (was 0.12s sim ≈ 25 Hud renders/s at 3x).
    // At 5× the canvases keep drawing, but the HUD string updates about once a second.
    this.flushReputation(step)
    this.achievements.check(this)
    this.uiAcc += step
    const uiEvery = this.speed >= 5 ? 2.8 : this.speed >= 3 ? 0.7 : 0.4
    if (this.uiAcc > uiEvery) {
      this.uiAcc = 0
      this.emit()
    }
    } finally {
      this.runwayLoadOpen = false
      this.runwayLoadCache = null
      this.endEmitHold()
    }
  }

  /** True when any hall has a security room (choke present). */
  hasSecurityChoke(): boolean {
    return this.fits.some((f) => (f.rooms.security ?? 0) > 0)
  }

  /** Food rooms, souvenir rooms, and snack bars that can take a brand. */
  private retailUnits(): TenantUnit[] {
    const units: TenantUnit[] = []
    for (const fit of this.fits) {
      const hall = this.hallLabel(fit)
      const food = fit.rooms.food ?? 0
      const shops = fit.rooms.souvenir ?? 0
      for (let i = 0; i < food; i++) {
        units.push({ id: `${hall}:food:${i}`, kind: 'food', label: `${hall} food ${i + 1}` })
      }
      for (let i = 0; i < shops; i++) {
        units.push({ id: `${hall}:shop:${i}`, kind: 'retail', label: `${hall} shop ${i + 1}` })
      }
    }
    const snacks = tilesOf(this.tiles, 'snack').length
    for (let i = 0; i < snacks; i++) {
      units.push({ id: `snack:${i}`, kind: 'food', label: `Snack bar ${i + 1}` })
    }
    return units
  }

  private gameDayIndex(): number {
    return Math.floor(Math.max(0, this.clock) / REAL_SECONDS_PER_GAME_DAY)
  }

  private tycoonBooks(): TycoonBooks {
    return {
      balance: () => this.cash,
      post: (category, amount, meta) => this.postTycoon(category, amount, meta),
      entriesBetween: (start, end) => this.bank.entriesBetween(start, end),
    }
  }

  /** Tenant rent and ad spend share the bank with the rest of the airport. */
  private postTycoon(category: MoneyCategory, amount: number, meta: BankPostMeta): boolean {
    const rounded = Math.round(amount)
    if (!Number.isFinite(rounded) || rounded === 0) return false
    if (rounded > 0) {
      this.cash += rounded
      this.hourIncome += rounded
      this.revenue += rounded
      this.bank.post(category, rounded, { ...meta, source: 'tycoon' })
      return true
    }
    const cost = -rounded
    if (this.cash < cost) return false
    this.cash -= cost
    this.noteExpense(cost)
    this.bank.post(category, rounded, { ...meta, source: 'tycoon' })
    return true
  }

  private tycoonPulse(day: number): TycoonPulse {
    const latest = this.gameDayIndex() - 1
    const passengers = day === latest ? Math.max(0, Math.round(this.paxPerDay || this.dayPax)) : 0
    const guests = this.hallGuests.filter((g) => !g.preview)
    const satisfaction = guests.length
      ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guests.length
      : this.fieldRating()
    const wear = this.avgWear()
    const cleanliness = 100 - (wear.bath * 0.6 + wear.sec * 0.4)
    return { passengers, satisfaction, cleanliness }
  }

  private drainTycoon(): TycoonNote[] {
    if (!this.site) return []
    return [
      ...this.tycoon.syncUnits(this.retailUnits()),
      ...this.tycoon.catchUp(this.tycoonBooks(), this.gameDayIndex(), (day) => this.tycoonPulse(day)),
    ]
  }

  private applyTycoon(notes: TycoonNote[], forceEmit: boolean) {
    for (const note of notes) {
      this.pushNews(note.text, note.tone)
      if (note.reputation) {
        this.reputation = Math.max(0, Math.min(100, this.reputation + note.reputation))
      }
    }
    if (notes.length || forceEmit) this.emit()
  }

  /** Open bids and close finished days. Safe while the clock is paused. */
  pokeTycoon() {
    this.applyTycoon(this.drainTycoon(), false)
  }

  tycoonView(): TycoonView {
    return this.tycoon.view(this.gameDayIndex())
  }

  pendingYearReport() {
    return this.tycoon.pendingReport()
  }

  /** Passenger load-factor multiplier from live ad campaigns. */
  tycoonDemand(): number {
    return this.tycoon.demandMultiplier(this.gameDayIndex())
  }

  /** Extra airline-letter interest from a live campaign. */
  tycoonAirlineInterest(): number {
    return this.tycoon.airlineInterest(this.gameDayIndex())
  }

  acceptTenantBid(unitId: string, bidId: string) {
    this.pokeTycoon()
    this.applyTycoon(this.tycoon.acceptBid(unitId, bidId, this.gameDayIndex()), true)
  }

  rerollTenantBids(unitId: string) {
    this.pokeTycoon()
    this.applyTycoon(this.tycoon.rerollBids(unitId, this.gameDayIndex()), true)
  }

  startAdCampaign(kind: CampaignKind) {
    this.applyTycoon(
      this.tycoon.startCampaign(this.tycoonBooks(), kind, this.gameDayIndex(), this.simMinutes()),
      true,
    )
  }

  dismissYearReport() {
    this.tycoon.dismissReport()
    this.emit()
  }
}

function moneyLeft(n: number): string {
  return `$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Day length is the 180s cycle. Clock reads as a 24h face inside that day. */
export function formatSimDate(seconds: number): string {
  const day = Math.floor(seconds / 180) + 1
  const tod = ((seconds % 180) + 180) % 180
  const mins = Math.floor((tod / 180) * 24 * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `Day ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
