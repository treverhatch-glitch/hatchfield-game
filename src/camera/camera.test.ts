import { describe, expect, it } from 'vitest'
import { planeAltitude, tracksFrom, vehicleLabel, type FieldSnapshot } from './actors.ts'
import { pngName, savePng } from './capture.ts'
import { followPose, orbitFromLook } from './orbit.ts'
import { pickTrackable } from './pick.ts'
import { CameraSession } from './session.ts'
import { cellToWorld, clampHour, formatHour, simHeadingToChase, travelHeading } from './space.ts'
import type { CameraPose, Trackable } from './types.ts'

const layout = { cell: 10, size: 32 }

function emptyField(): FieldSnapshot {
  return { flights: [], trucks: [], people: [], service: [], catering: [] }
}

function plane(over: Partial<Trackable> = {}): Trackable {
  return {
    id: 'plane:1',
    kind: 'plane',
    label: 'HF100',
    c: 16,
    r: 16,
    altitude: 0,
    heading: 0,
    ...over,
  }
}

describe('camera space', () => {
  it('maps a cell through the apron origin', () => {
    expect(cellToWorld(16, 10, 4, layout)).toEqual({ x: 5, y: 4, z: -55 })
  })

  it('turns a +X sim heading into a chase that sits behind the nose', () => {
    expect(simHeadingToChase(0)).toBeCloseTo(Math.PI / 2)
    const start: CameraPose = { position: { x: 0, y: 1, z: 0 }, aim: { x: 0, y: 0, z: 0 } }
    let cam = start
    const target = plane()
    for (let i = 0; i < 240; i++) cam = followPose(cam, target, layout, 1, 1 / 60)
    const world = cellToWorld(target.c, target.r, target.altitude, layout)
    expect(cam.position.x).toBeLessThan(world.x - 40)
    expect(cam.position.z).toBeCloseTo(world.z, 0)
    expect(cam.position.y).toBeGreaterThan(10)
  })

  it('reads a path heading the way the truck mesh does', () => {
    expect(travelHeading(2, 4, [{ c: 2, r: 4 }, { c: 3, r: 4 }], 0)).toBeCloseTo(0)
    expect(travelHeading(2, 4, [{ c: 2, r: 4 }, { c: 2, r: 6 }], 0)).toBeCloseTo(Math.PI / 2)
  })

  it('formats the time-of-day slider', () => {
    expect(formatHour(14.5)).toBe('14:30')
    expect(formatHour(0)).toBe('00:00')
    expect(formatHour(24)).toBe('24:00')
    expect(clampHour(30)).toBe(24)
    expect(clampHour(Number.NaN)).toBe(12)
  })
})

describe('camera pick', () => {
  it('keeps planes, vehicles, and passengers, and drops the rest', () => {
    const tracks = tracksFrom({
      ...emptyField(),
      flights: [
        { id: 'a', flightNo: 'HF1', phase: 'parked', x: 4, y: 5, z: 2, heading: 0 },
        { id: 'b', flightNo: 'HF2', phase: 'gone', x: 1, y: 1, z: 0, heading: 0 },
      ],
      trucks: [{ id: 't', kind: 'fuel', x: 8, y: 8, path: [{ c: 8, r: 8 }, { c: 9, r: 8 }], seg: 0 }],
      service: [{ id: 's', type: 'pushback_tug', x: 3, y: 3, heading: 1 }],
      catering: [{ id: 'c', x: 6, y: 6, heading: 0.2 }],
      people: [
        { id: 'p', job: 'board', label: '→ gate', x: 9, y: 2, path: [], seg: 0 },
        { id: 'j', job: 'janitor', label: 'Janitor', x: 1, y: 2, path: [], seg: 0 },
      ],
    })
    expect(tracks.map((t) => t.id)).toEqual(['plane:a', 'truck:t', 'service:s', 'cater:c', 'pax:p'])
    expect(tracks[0]?.altitude).toBeCloseTo(planeAltitude(2))
    expect(vehicleLabel('bags')).toBe('Bag tug')
    expect(tracks.find((t) => t.id === 'truck:t')?.heading).toBeCloseTo(0)
  })

  it('picks the closest actor inside its reach and prefers a plane on a tie', () => {
    const jet = plane({ c: 10, r: 10 })
    const pax: Trackable = { ...plane({ id: 'pax:1', kind: 'passenger', label: 'Passenger', c: 10, r: 10 }) }
    const truck: Trackable = { ...plane({ id: 'truck:1', kind: 'vehicle', label: 'Fuel truck', c: 12, r: 10 }) }
    expect(pickTrackable({ c: 10, r: 10 }, [pax, jet])?.id).toBe('plane:1')
    expect(pickTrackable({ c: 11.2, r: 10 }, [jet, truck])?.id).toBe('truck:1')
    expect(pickTrackable({ c: 0, r: 0 }, [jet])).toBeNull()
  })
})

describe('camera session', () => {
  const target = plane()

  function following(): CameraSession {
    const session = new CameraSession()
    session.bindPose(() => ({ position: { x: 0, y: 20, z: 0 }, aim: { x: 0, y: 0, z: 0 } }))
    session.select(target)
    session.startFollow()
    return session
  }

  it('eases toward the subject and leaves on Esc or a drag', () => {
    const session = following()
    const pose = session.step(1 / 30, [target], layout)
    expect(pose).not.toBeNull()
    expect(session.noteDrag()).toBe(true)
    expect(session.following).toBe(false)
    expect(session.step(1 / 30, [target], layout)).toBeNull()

    const again = following()
    expect(again.noteEscape()).toBe('follow')
    expect(again.following).toBe(false)
    expect(again.noteEscape()).toBe('none')
  })

  it('drops follow when the subject disappears', () => {
    const session = following()
    expect(session.step(1 / 30, [], layout)).toBeNull()
    expect(session.getSnapshot().selection).toBeNull()
  })

  it('scrolls the chase distance without notifying when nothing else changed', () => {
    const session = following()
    const rev = session.getSnapshot().rev
    session.noteWheel(0)
    expect(session.getSnapshot().rev).toBe(rev)
    const world = cellToWorld(target.c, target.r, target.altitude, layout)
    const gap = (wheel: number) => {
      const cam = following()
      cam.noteWheel(wheel)
      let pose = cam.step(1 / 60, [target], layout)
      for (let i = 0; i < 180; i++) pose = cam.step(1 / 60, [target], layout)
      return pose ? Math.hypot(pose.position.x - world.x, pose.position.z - world.z) : 0
    }
    expect(gap(500)).toBeGreaterThan(gap(-500) + 5)
  })

  it('photo mode freezes the flag, hides behind Esc, and frees the chase', () => {
    const session = following()
    session.togglePhoto(18.5)
    expect(session.frozen).toBe(true)
    expect(session.following).toBe(false)
    expect(session.getSnapshot().photo).toBe(true)
    expect(session.timeOfDay).toBeCloseTo(18.5)
    session.setHour(6)
    expect(session.timeOfDay).toBe(6)
    expect(session.noteEscape()).toBe('photo')
    expect(session.frozen).toBe(false)
    expect(session.timeOfDay).toBeNull()
    session.setHour(9)
    expect(session.timeOfDay).toBeNull()
  })

  it('hands a capture request to one frame', () => {
    const session = new CameraSession()
    expect(session.consumeCapture()).toBe(false)
    session.requestCapture()
    expect(session.consumeCapture()).toBe(true)
    expect(session.consumeCapture()).toBe(false)
  })
})

describe('camera capture', () => {
  it('names a png and clicks a download link', () => {
    expect(pngName(new Date(2026, 9, 13, 13, 5, 9))).toBe('hatchfield-20261013-130509.png')
    let clicked = 0
    let removed = 0
    const anchor = {
      href: '',
      download: '',
      rel: '',
      click() {
        clicked += 1
      },
      remove() {
        removed += 1
      },
    }
    const doc = {
      createElement: () => anchor,
      body: { appendChild() {} },
    } as unknown as Document
    savePng('data:image/png;base64,aaa', 'shot.png', doc)
    expect(anchor.href).toBe('data:image/png;base64,aaa')
    expect(anchor.download).toBe('shot.png')
    expect(clicked).toBe(1)
    expect(removed).toBe(1)
  })
})

describe('orbit handoff', () => {
  it('recovers yaw, pitch, and distance for the apron orbit', () => {
    const yaw = 0.72
    const pitch = 0.68
    const dist = 88
    const position = {
      x: Math.sin(yaw) * Math.cos(pitch) * dist,
      y: Math.sin(pitch) * dist,
      z: Math.cos(yaw) * Math.cos(pitch) * dist,
    }
    const rig = orbitFromLook(position, { x: 0, y: 0, z: 0 }, {
      minDist: 12,
      maxDist: 280,
      minPitch: 0.28,
      maxPitch: 1.35,
    })
    expect(rig.yaw).toBeCloseTo(yaw)
    expect(rig.pitch).toBeCloseTo(pitch)
    expect(rig.dist).toBeCloseTo(dist)
  })
})
