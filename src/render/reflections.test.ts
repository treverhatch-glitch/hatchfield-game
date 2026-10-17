import * as THREE from 'three'
import { describe, expect, it, afterEach } from 'vitest'
import {
  aircraftReflectionsFor,
  attachBuildingMaterial,
  buildingReflectionsActive,
  buildingReflectionsFor,
  prepareBuildingReflections,
  resetBuildingReflectionsForTests,
} from './reflections'

afterEach(() => {
  resetBuildingReflectionsForTests()
})

describe('lazy reflection maps', () => {
  it('builds the studio map only for the High and Ultra building setting', () => {
    expect(buildingReflectionsFor('low')).toBe(false)
    expect(buildingReflectionsFor('med')).toBe(false)
    expect(buildingReflectionsFor('high')).toBe(true)
    expect(buildingReflectionsFor('ultra')).toBe(true)
    // Max graphics: airframes are full-detail PBR on every preset, so the probe is always built.
    expect(aircraftReflectionsFor('low')).toBe(true)
    expect(aircraftReflectionsFor('med')).toBe(true)
    expect(aircraftReflectionsFor('high')).toBe(true)
    expect(aircraftReflectionsFor('ultra')).toBe(true)
  })

  it('does not run PMREM while the building setting is off, and builds once when it turns on', () => {
    const renderer = {} as THREE.WebGLRenderer
    const tex = new THREE.Texture()
    let builds = 0
    const build = () => {
      builds += 1
      return tex
    }
    prepareBuildingReflections(renderer, 'low', build)
    prepareBuildingReflections(renderer, 'med', build)
    expect(builds).toBe(0)
    expect(buildingReflectionsActive()).toBe(false)

    prepareBuildingReflections(renderer, 'high', build)
    expect(builds).toBe(1)
    expect(buildingReflectionsActive()).toBe(true)

    prepareBuildingReflections(renderer, 'ultra', build)
    expect(builds).toBe(1)
  })

  it('assigns the map to terminal materials only while reflections are on', () => {
    const renderer = {} as THREE.WebGLRenderer
    const tex = new THREE.Texture()
    const mat = new THREE.MeshStandardMaterial()
    attachBuildingMaterial(mat)
    expect(mat.envMap).toBeNull()

    prepareBuildingReflections(renderer, 'high', () => tex)
    expect(mat.envMap).toBe(tex)

    const later = new THREE.MeshPhysicalMaterial()
    attachBuildingMaterial(later)
    expect(later.envMap).toBe(tex)

    prepareBuildingReflections(renderer, 'low', () => tex)
    expect(mat.envMap).toBeNull()
    expect(later.envMap).toBeNull()
    expect(buildingReflectionsActive()).toBe(false)
  })

  it('survives a headless renderer that cannot filter the room', () => {
    const renderer = {} as THREE.WebGLRenderer
    prepareBuildingReflections(renderer, 'ultra', () => {
      throw new Error('no WebGL2')
    })
    expect(buildingReflectionsActive()).toBe(false)
    const mat = new THREE.MeshStandardMaterial()
    attachBuildingMaterial(mat)
    expect(mat.envMap).toBeNull()
  })
})
