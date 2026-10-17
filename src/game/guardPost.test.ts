import { describe, expect, it } from 'vitest'
import { astar, nearestPath, tilesOf } from './path'
import { SIZE, type Tile, type Vec } from './types'
import { Game } from './sim'

function blank(): Tile[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 'grass' as Tile))
}

function field(focus: 'pax' | 'cargo' | 'hybrid'): Game {
  const game = new Game()
  game.sandbox = false
  game.beginNew('easy')
  game.startFocus = focus
  game.buyLand(focus === 'cargo' ? 'factory' : 'city')
  game.buildStarterKit()
  return game
}

describe('guard post routing invariants', () => {
  describe('pure path tests', () => {
    it('airside service path from service building to stand never includes a guard tile', () => {
      const tiles = blank()
      
      // Stand at (10, 10), Bag room at (5, 10).
      tiles[10][10] = 'stand'
      tiles[10][5] = 'bags'
      
      // Airside road connecting them, length 5
      for (let c = 6; c <= 9; c++) {
        tiles[10][c] = 'road'
      }

      // Shortcut road with a guard post, length 3
      tiles[11][5] = 'road'
      tiles[11][10] = 'road'
      for (let c = 6; c <= 9; c++) {
        tiles[11][c] = 'guard' // Blocked by guard post
      }
      
      const start: Vec = { c: 5, r: 10 }
      const goal: Vec = { c: 10, r: 10 }
      
      const path = astar(tiles, start, goal, 'truck', undefined, 'airside')
      
      expect(path).not.toBeNull()
      // Path should not go through the guard post
      for (const p of path!) {
        expect(tiles[p.r][p.c]).not.toBe('guard')
      }
    })

    it('landside->airside outside vehicle path includes exactly one guard tile', () => {
      const tiles = blank()
      
      tiles[2][2] = 'road' // City edge
      tiles[2][3] = 'road'
      tiles[2][4] = 'guard' // Guard post
      tiles[2][5] = 'road'
      tiles[2][6] = 'stand' // Stand
      
      const start: Vec = { c: 2, r: 2 }
      const goal: Vec = { c: 6, r: 2 }
      
      const path = astar(tiles, start, goal, 'truck', undefined, 'outside')
      
      expect(path).not.toBeNull()
      let guardCount = 0
      for (const p of path!) {
        if (tiles[p.r][p.c] === 'guard') {
          guardCount++
        }
      }
      expect(guardCount).toBe(1)
    })

    it('outside vehicles cannot reach airside with the guard post removed', () => {
      const tiles = blank()
      
      tiles[2][2] = 'road' // City edge
      tiles[2][3] = 'road'
      tiles[2][4] = 'grass' // Guard post removed
      tiles[2][5] = 'road'
      tiles[2][6] = 'stand' // Stand
      
      const start: Vec = { c: 2, r: 2 }
      const goal: Vec = { c: 6, r: 2 }
      
      const path = astar(tiles, start, goal, 'truck', undefined, 'outside')
      
      expect(path).toBeNull()
    })
  })

  describe('seeded starter kit test', () => {
    it('starter kit + guard + city cargo trucks sample', { timeout: 30_000 }, () => {
      // Use the seed trick to be deterministic and force spawning
      const orig = Math.random
      let s = 12345 >>> 0
      Math.random = () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0
        return s / 4294967296
      }
      try {
        const game = field('cargo')
        game.speed = 1
        
        // Let it run for 2 days
        const SECONDS = 2 * 180 // 180 real seconds per game day
        for (let t = 0; t < SECONDS; t += 0.5) {
          if (game.offer && game.signed.length === 0) game.acceptNegotiation()
          game.tick(0.5)
        }

        const outsideKinds = new Set(['delivery', 'contractor', 'citycargo'])
        let sampled = 0

        for (const truck of game.trucks) {
          if (!truck.path || truck.path.length === 0) continue
          
          sampled++
          let guardCount = 0
          for (const p of truck.path) {
            if (game.tiles[p.r][p.c] === 'guard') {
              guardCount++
            }
          }

          if (outsideKinds.has(truck.kind)) {
            // outside trucks all enter through it
            expect(guardCount, `Outside truck ${truck.kind} must cross exactly 1 guard`).toBe(1)
          } else {
            // sample every service truck path and assert none crosses a guard tile
            expect(guardCount, `Service truck ${truck.kind} must never cross guard`).toBe(0)
          }
        }
        
        expect(sampled).toBeGreaterThan(0)
      } finally {
        Math.random = orig
      }
    })
  })

  describe('starter layout test', () => {
    it('never places the guard between service buildings and stands', () => {
      const game = field('pax')
      const guards = tilesOf(game.tiles, 'guard')
      expect(guards).toHaveLength(1)
      const guard = guards[0]
      const onGuard = (cell: Vec) => cell.c === guard.c && cell.r === guard.r

      const stands = tilesOf(game.tiles, 'stand')
      const serviceBuildings = [
        ...tilesOf(game.tiles, 'cargo'),
        ...tilesOf(game.tiles, 'fuel'),
        ...tilesOf(game.tiles, 'bags'),
        ...tilesOf(game.tiles, 'fire'),
        ...tilesOf(game.tiles, 'snack'),
      ]

      for (const service of serviceBuildings) {
        for (const stand of stands) {
          const path = nearestPath(game.tiles, service, [stand], 'truck', undefined, 'airside')
          if (path) {
            expect(path.some(onGuard), `Service ${service.c},${service.r} to stand ${stand.c},${stand.r} should not cross guard`).toBe(false)
          }
        }
      }
    })
  })
})
