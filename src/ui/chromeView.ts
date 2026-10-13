import type { Game } from '../game/sim.ts'

/** Read-only chrome for one paint. Commands stay on `Game`. */
export interface ChromeView {
  showFlows: boolean
  infoOpen: string | null
  hotspots: { id: string; label: string }[]
  infoLines: string[]
  ground: {
    fuelLitres: number
    meals: number
    busyVehicles: number
    totalVehicles: number
  } | null
  advice: { id: string; title: string; detail: string; fix: string }[]
  roster: { id: string; name: string; band: string; standing: number }[]
  letters: { id: string; airline: string; text: string }[]
  site: { name: string; elapsed: number; duration: number } | null
}

export function readChrome(game: Game): ChromeView {
  const site = game.hover ? game.siteAt(game.hover) : undefined
  const ground = game.groundSnapshot()
  return {
    showFlows: game.showFlows,
    infoOpen: game.infoOpen,
    hotspots: game.infoHotspots(),
    infoLines: game.infoOpen ? game.infoLines(game.infoOpen) : [],
    ground: ground
      ? {
          fuelLitres: ground.fuelLitres,
          meals: ground.meals,
          busyVehicles: ground.busyVehicles,
          totalVehicles: ground.totalVehicles,
        }
      : null,
    advice: game.advice.map((note) => ({
      id: note.id,
      title: note.title,
      detail: note.detail,
      fix: note.fix,
    })),
    roster: game.diplomacyRoster().map((row) => ({
      id: row.id,
      name: row.name,
      band: row.band,
      standing: row.standing,
    })),
    letters: game.diplomacyLetters().map((letter) => ({
      id: letter.id,
      airline: letter.airline,
      text: letter.text,
    })),
    site: site
      ? { name: site.name, elapsed: site.elapsed, duration: site.duration }
      : null,
  }
}
