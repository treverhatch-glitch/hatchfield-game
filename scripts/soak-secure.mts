import { Game } from '../src/game/sim.ts'
import {
  isAirside,
  openForGuest,
  openNodesFromRooms,
  spawnHallGuest,
} from '../src/game/guests.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.cash += 40_000

const rooms = g.fits[0].rooms
const open = openNodesFromRooms(rooms)
if (!open.has('security')) issues.push('starter missing security')

// Uncleared view hides airside
const landOnly = openForGuest(open, false)
for (const n of landOnly) {
  if (isAirside(n)) issues.push(`uncleared view leaked ${n}`)
}
if (!landOnly.has('security')) issues.push('security should stay visible landside')
if (!landOnly.has('checkin')) issues.push('checkin should stay visible')
if (landOnly.has('gate')) issues.push('gate should be hidden until cleared')

const cleared = openForGuest(open, true)
if (!cleared.has('gate')) issues.push('cleared should see gate')

// Soft corridor gone — shell without security
const shellOpen = openNodesFromRooms({
  checkin: 1,
  security: 0,
  gate: 2,
  bagclaim: 0,
  food: 1,
  souvenir: 0,
  bagdrop: 0,
  lounge: 0,
  bathroom: 1,
})
if (shellOpen.has('security')) issues.push('soft security corridor still present')

// Route uncleared depart toward gate → forced to security
const dep = spawnHallGuest('f1', 'depart', 'budget', { airlineId: 'northline' })
dep.node = 'entrance'
dep.clearedSec = false
g.hallGuests.push(dep)
g.routeGuest(dep, 'gate', open)
if (dep.path.length && dep.path[dep.path.length - 1] !== 'security') {
  issues.push(`uncleared gate route ended at ${dep.path[dep.path.length - 1]}`)
}
if (dep.clearedSec) issues.push('should not clear before security')

// Walk them onto security via serve
dep.node = 'security'
g.serveNode(dep, open)
if (!dep.clearedSec) issues.push('security serve did not clear')

// Breach: teleport uncleared onto gate
const breach = spawnHallGuest('f2', 'depart', 'budget', { airlineId: 'northline' })
breach.node = 'gate'
breach.clearedSec = false
g.hallGuests.push(breach)
const cashBefore = g.cash
const incidents = g.securityIncidents
g.secureBreach(breach)
if (g.securityIncidents <= incidents) issues.push('breach did not count incident')
if (g.cash >= cashBefore) issues.push('breach did not fine')
if (isAirside(breach.node) && !breach.clearedSec) {
  issues.push('breach left uncleared body airside')
}
if (breach.node === 'gate') issues.push('breach did not eject from gate')

// Arrivals start cleared and can reach claim
const arr = spawnHallGuest('f3', 'arrive', 'premium', { airlineId: 'northline' })
if (!arr.clearedSec) issues.push('arrival should start cleared')

const out = {
  ok: issues.length === 0,
  issues,
  landSize: landOnly.size,
  clearedSize: cleared.size,
  breachNode: breach.node,
  incidents: g.securityIncidents,
  news: g.news.slice(0, 4).map((n) => n.text),
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
