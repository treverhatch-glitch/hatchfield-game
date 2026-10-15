import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { syncLeaseMarks } from './leaseBadge.ts'

describe('lease badges', () => {
  it('keeps a plate and a badge, and drops a released mark', () => {
    const root = new THREE.Group()
    syncLeaseMarks(root, [
      {
        key: 'stand:3,8',
        x: 4,
        y: 0.1,
        z: 2,
        primary: '#123456',
        code: 'GP',
        lay: 'flat',
        span: 3,
        kind: 'gate',
        id: 'stand:3,8',
      },
    ])
    const mark = root.getObjectByName('lease-mark:stand:3,8')
    expect(mark?.userData.assignKind).toBe('gate')
    expect(mark?.getObjectByName('lease-plate')).toBeTruthy()
    expect(mark?.getObjectByName('lease-badge')).toBeTruthy()
    syncLeaseMarks(root, [])
    expect(root.children).toHaveLength(0)
  })
})