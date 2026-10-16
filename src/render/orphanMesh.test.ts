import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { roofHeightM } from '../terminalbuild/scale.ts'
import { split1f } from '../terminalbuild/starter/split1f.ts'
import { buildFittingMeshes } from './interior/fittings.ts'
import { buildLayoutShell } from './interior/shell.ts'

const HALL_SRC = readFileSync(new URL('./interior/InteriorView.ts', import.meta.url), 'utf8')
const INTERIOR_SRC = ['shell.ts', 'fittings.ts', 'people.ts', 'picking.ts']
  .map((name) => {
    try {
      return readFileSync(new URL(`./interior/${name}`, import.meta.url), 'utf8')
    } catch {
      return ''
    }
  })
  .join('\n')

describe('hall orphan meshes v2', () => {
  it('does not parent the apron picture, a bridge, or a vehicle into the hall', () => {
    const src = HALL_SRC + INTERIOR_SRC
    expect(src).not.toContain('new TerminalBuilding')
    expect(src).not.toContain('planTerminal')
    expect(src).not.toContain('buildInteriorDressing')
    expect(src).not.toContain('SupplyCartLayer')
    expect(src).not.toContain('HallFigureBatch')
    expect(src).not.toContain('jet_bridge')
    expect(src).not.toContain('placeJetBridge')
    expect(src).not.toContain('dockAirsideBridge')
    expect(src).not.toContain('performance.now')
    expect(src).not.toContain('Date.now')
    expect(HALL_SRC).toContain("hallRoot.name = 'hall-root'")
    expect(HALL_SRC).not.toContain('BEFORE SECURITY')
    expect(HALL_SRC).not.toContain('AFTER SECURITY')
    expect(HALL_SRC).not.toContain('0.42, h, 0.42')
  })

  it('maps every shell and fitting mesh to a layout piece under the roof', () => {
    const layout = split1f()
    const shell = buildLayoutShell(layout)
    const fittings = buildFittingMeshes(layout)
    const root = new THREE.Group()
    root.name = 'hall-root'
    root.add(shell, fittings)
    const allowed = new Set(['floor', 'wall', 'door', 'fitting', 'belt', 'person'])
    const beltTiles = new Set<string>()
    for (const run of layout.belts ?? []) for (const t of run.tiles) beltTiles.add(`${t.x},${t.y}`)
    root.traverse((obj) => {
      expect(obj.scale.x, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.y, obj.name).toBeCloseTo(1, 5)
      expect(obj.scale.z, obj.name).toBeCloseTo(1, 5)
      if (!(obj as THREE.Mesh).isMesh) return
      let piece = obj.userData.piece as string | undefined
      for (let up = obj.parent; !piece && up; up = up.parent) piece = up.userData.piece as string | undefined
      expect(allowed.has(piece), `${obj.name} piece ${piece}`).toBe(true)
      if (piece === 'belt' && obj.userData.beltTile) expect(beltTiles.has(obj.userData.beltTile)).toBe(true)
      obj.updateWorldMatrix(true, false)
      const box = new THREE.Box3().setFromObject(obj)
      expect(box.max.y, obj.name).toBeLessThanOrEqual(roofHeightM(1) + 0.05)
    })
    expect(shell.getObjectByName('hall-floor')).toBeTruthy()
    const kinds = new Set<string>()
    root.traverse((obj) => {
      if (typeof obj.userData.fittingKind === 'string') kinds.add(obj.userData.fittingKind)
    })
    expect(kinds.has('jet_bridge')).toBe(false)
  })
})
