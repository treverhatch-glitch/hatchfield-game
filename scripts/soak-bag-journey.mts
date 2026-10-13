/**
 * Slice 1b — outbound deposit → load; inbound unload → sort → assigned claim.
 * Claim lanes must be planned when slots are banked (inbound only).
 */
import { Game } from '../src/game/sim.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.takeLoan()
g.cash += 40_000
g.speed = 5

// Accept carriers so the bank fills.
for (let i = 0; i < 80; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
}

const open = g.openSchedule().filter((s) => g.airline(s.airline).kind !== 'cargo')
if (!open.length) {
  // Force a manual pax slot if auto bank is empty.
  const pax = g.signed.find((id) => g.airline(id).kind !== 'cargo')
  if (pax) g.addManualSlot(pax, 12)
}

const banked = g.openSchedule().filter((s) => g.airline(s.airline).kind !== 'cargo')
const withClaim = banked.filter((s) => s.claimLane != null && s.claimLane > 0)
if (banked.length && withClaim.length < banked.length) {
  issues.push(
    `pax slots missing claimLane at schedule time (${withClaim.length}/${banked.length})`,
  )
}

let sawDeposit = false
let sawOutboundSort = false
let sawLoad = false
let sawUnload = false
let sawInboundSort = false
let sawDeliver = false
let sawOnClaim = false
let sawSortMission = false
let sawToClaim = false
let sawCrateUnits = false
let claimOnFlight = false
let divertClaim = false

for (let i = 0; i < 2400; i++) {
  g.tick(0.25)
  if (g.offer) g.acceptOffer()
  for (const guest of g.hallGuests) {
    if (guest.bagDepositLeft != null && guest.bagDepositLeft > 0) sawDeposit = true
  }
  for (const f of g.flights) {
    if (f.cargo || f.ga) continue
    if (f.claimLane != null && f.claimLane > 0) claimOnFlight = true
    if (f.hostKind === 'divert' && f.claimLane) divertClaim = true
    switch (f.bagStage) {
      case 'pax_deposit':
        sawDeposit = true
        break
      case 'outbound_sort':
        sawOutboundSort = true
        break
      case 'load_aircraft':
        sawLoad = true
        break
      case 'unload_aircraft':
        sawUnload = true
        break
      case 'inbound_sort':
        sawInboundSort = true
        break
      case 'deliver_claim':
        sawDeliver = true
        break
      case 'on_claim':
        sawOnClaim = true
        break
    }
  }
  for (const t of g.trucks) {
    if (t.kind !== 'bags') continue
    if (t.mission === 'sort_inbound') sawSortMission = true
    if (t.mission === 'to_claim') sawToClaim = true
    if ((t.cargoUnits ?? 0) > 0) sawCrateUnits = true
  }
}

// One-shot divert should also get a claim when accepted.
if (g.signed.length) {
  const aid = g.signed.find((id) => g.airline(id).kind !== 'cargo') ?? g.signed[0]
  g.pendingEmergency = {
    id: 'soak-div',
    kind: 'divert',
    blurb: 'soak divert',
    fee: 4000,
    airline: aid,
    age: 0,
    deadline: 30,
    needs: {
      stand: true,
      fire: true,
      fuel: false,
      hangar: false,
      minRunway: 8,
    },
  }
  g.resolveEmergency('accept')
  const div = g.flights.find((f) => f.hostKind === 'divert')
  if (div && !div.cargo && !(div.claimLane != null && div.claimLane > 0)) {
    issues.push('divert pax flight missing claimLane')
  }
  if (div?.claimLane) divertClaim = true
}

if (!claimOnFlight && !withClaim.length) issues.push('never saw claim lane on flight or slot')
if (!sawUnload) issues.push('never saw unload_aircraft bag stage')
if (!sawInboundSort && !sawSortMission) issues.push('never saw inbound sort stage/mission')
if (!sawToClaim && !sawOnClaim && !sawDeliver) {
  issues.push('never saw deliver/on_claim / to_claim leg')
}
if (!sawCrateUnits) issues.push('bag trucks never carried cargoUnits (crate picture)')
// Outbound deposit/load can be rarer in short soaks — soft fail only if we also lack unload.
if (!sawDeposit && !sawOutboundSort && !sawLoad && !sawUnload) {
  issues.push('no bag journey stages observed at all')
}

const out = {
  ok: issues.length === 0,
  issues,
  bankedClaims: withClaim.length,
  bankedPax: banked.length,
  sawDeposit,
  sawOutboundSort,
  sawLoad,
  sawUnload,
  sawInboundSort,
  sawDeliver,
  sawOnClaim,
  sawSortMission,
  sawToClaim,
  sawCrateUnits,
  claimOnFlight,
  divertClaim,
}
console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
