import { Game } from '../src/game/sim.ts'
import { spawnHallGuest } from '../src/game/guests.ts'

const issues: string[] = []
const g = new Game()
g.beginNew('easy')
g.buyLand('city')
g.buildStarterKit()
g.cash += 50_000

// Starter kit ships one desk agent so the first bank isn't empty-counter pain.
if (g.deskStaff < 1) issues.push('starter should include a desk agent')
// Isolate the staffing unit test from the starter body.
g.deskStaff = 0
g.hallStaff = []
if (g.staffedPost('security')) issues.push('security staffed without hire')

const secBefore = g.securityLevel()
g.hireDeskStaff()
g.hireDeskStaff()
g.hireDeskStaff()
if (g.deskStaff !== 3) issues.push(`deskStaff ${g.deskStaff}`)
g.assignHallStaff()
if (g.hallStaff.length !== 3) issues.push(`hallStaff ${g.hallStaff.length}`)

const posts = new Set(g.hallStaff.map((s) => s.node))
if (!posts.has('checkin') && !posts.has('security') && !posts.has('gate')) {
  issues.push('no posts assigned')
}

// Force coverage on all three
g.hallStaff[0].node = 'checkin'
g.hallStaff[0].stage = 0
g.hallStaff[1].node = 'security'
g.hallStaff[1].stage = 0
g.hallStaff[2].node = 'gate'
g.hallStaff[2].stage = 0
if (!g.staffedPost('checkin')) issues.push('checkin not staffed')
if (!g.staffedPost('security')) issues.push('security not staffed')
if (!g.staffedPost('gate')) issues.push('gate not staffed')

const secAfter = g.securityLevel()
if (secAfter < secBefore) issues.push(`staff should not lower sec (${secBefore}→${secAfter})`)

// Empty check-in hurts happiness
const dep = spawnHallGuest('f1', 'depart', 'budget', { airlineId: 'northline' })
dep.node = 'checkin'
g.hallStaff.forEach((s) => {
  if (s.node === 'checkin') s.stage = 1
})
const happy = dep.happiness
g.serveNode(dep, g.hallOpen())
if (dep.happiness >= happy) issues.push('empty check-in should hurt happiness')

const pay = g.lineCost('security')
g.deskStaff = 0
const payNo = g.lineCost('security')
g.deskStaff = 3
if (!(pay > payNo)) issues.push(`desk wages missing (${pay} vs ${payNo})`)

const out = {
  ok: issues.length === 0,
  issues,
  deskStaff: g.deskStaff,
  hallStaff: g.hallStaff.map((s) => `${s.label}@${s.node}`),
  secBefore,
  secAfter,
}
console.log(JSON.stringify(out, null, 2))
process.exit(issues.length ? 1 : 0)
