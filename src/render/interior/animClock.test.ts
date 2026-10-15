import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Game } from '../../game/sim.ts'
import { buildTerminalProps } from '../terminalProps/index.ts'
import { advanceAnimSec, readAnimSec, resetAnimSec } from './animClock.ts'

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sources(path))
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) out.push(path)
  }
  return out
}

function trayMatrices(): Float32Array {
  resetAnimSec(0)
  const group = buildTerminalProps([{ type: 'security_lane', x: 0, z: 0, scale: 1 }])
  const trays = group.getObjectByName('movingTrays|tray') as THREE.InstancedMesh
  trays.onBeforeRender?.(
    null as unknown as THREE.WebGLRenderer,
    null as unknown as THREE.Scene,
    null as unknown as THREE.Camera,
    null as unknown as THREE.BufferGeometry,
    null as unknown as THREE.Material,
    null as unknown as THREE.Group,
  )
  return Float32Array.from(trays.instanceMatrix.array as Float32Array)
}

describe('interior anim clock', () => {
  it('advances by dt × speed and stays put while paused', () => {
    resetAnimSec(0)
    advanceAnimSec(0.5, 2)
    expect(readAnimSec()).toBeCloseTo(1)
    advanceAnimSec(0.5, 0)
    advanceAnimSec(0, 4)
    expect(readAnimSec()).toBeCloseTo(1)
    resetAnimSec(0)
    expect(readAnimSec()).toBe(0)
  })

  it('holds x-ray trays until animSec moves', () => {
    const first = trayMatrices()
    const second = trayMatrices()
    expect(Array.from(second)).toEqual(Array.from(first))
    resetAnimSec(0)
    const group = buildTerminalProps([{ type: 'security_lane', x: 0, z: 0, scale: 1 }])
    const trays = group.getObjectByName('movingTrays|tray') as THREE.InstancedMesh
    const before = Float32Array.from(trays.instanceMatrix.array as Float32Array)
    advanceAnimSec(1.5, 1)
    trays.onBeforeRender?.(
      null as unknown as THREE.WebGLRenderer,
      null as unknown as THREE.Scene,
      null as unknown as THREE.Camera,
      null as unknown as THREE.BufferGeometry,
      null as unknown as THREE.Material,
      null as unknown as THREE.Group,
    )
    const after = trays.instanceMatrix.array as Float32Array
    expect(Array.from(after)).not.toEqual(Array.from(before))
  })

  it('rejects wall-clock reads in the hall animation sources', () => {
    const files = [
      ...sources(new URL('.', import.meta.url).pathname),
      ...sources(new URL('../terminalProps', import.meta.url).pathname),
      new URL('../hallWorld.ts', import.meta.url).pathname,
    ]
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/performance\.now\(/)
      expect(text, file).not.toMatch(/Date\.now\(/)
    }
  })

  it('does not move the sim clock or the hall while speed is 0', () => {
    const game = new Game()
    game.beginNew('easy')
    game.buyLand('city')
    game.speed = 0
    resetAnimSec(0)
    const clock = game.clock
    for (let i = 0; i < 60; i++) game.tick(1 / 60)
    expect(game.clock).toBe(clock)
    expect(readAnimSec()).toBe(0)
    game.speed = 1
    game.tick(1)
    expect(readAnimSec()).toBeCloseTo(1)
    expect(game.clock).toBeCloseTo(clock + 1)
  })
})
