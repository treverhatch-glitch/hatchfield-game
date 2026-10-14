import { describe, expect, it } from 'vitest'
import { GuestMotion } from './guestMotion'

describe('visual crowd motion', () => {
  it('spaces a queue into a line', () => {
    const motion = new GuestMotion()
    const poses = [0, 1, 2, 3].map((i) => ({
      id: `q${i}`,
      x: 10 + (i % 2) * 0.15,
      z: 4 + Math.floor(i / 2) * 0.15,
      yaw: 0,
      queued: true,
    }))
    let out = poses
    for (let n = 0; n < 80; n++) out = motion.apply(out.map((_, i) => ({ ...poses[i], x: out[i].x, z: out[i].z })), [], 0.05)
    const zs = out.map((p) => p.z).sort((a, b) => a - b)
    const gaps = zs.slice(1).map((z, i) => z - zs[i])
    expect(Math.min(...gaps)).toBeGreaterThan(0.35)
    expect(Math.max(...gaps)).toBeLessThan(1.2)
  })

  it('meters a narrow doorway so the whole crowd cannot cross at once', () => {
    const motion = new GuestMotion()
    const door = { id: 'narrow', ax: -0.3, az: 0, bx: 0.3, bz: 0 }
    const start = [0, 1, 2, 3, 4, 5].map((i) => ({
      id: `w${i}`,
      x: (i - 2.5) * 0.35,
      z: -2,
      yaw: 0,
      queued: false,
    }))
    motion.apply(start, [door], 0.05)
    const far = start.map((p) => ({ ...p, z: 2 }))
    let drawn = far
    for (let n = 0; n < 10; n++) drawn = motion.apply(far, [door], 0.05)
    expect(drawn.filter((p) => p.z > 1).length).toBeLessThan(start.length)
  })
})
