import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as THREE from 'three'
import { BOARD_H, BOARD_ROW_COUNT, BOARD_W, COLUMNS, SIGN_H, SIGN_W } from './config'
import { boardClock, SIM_DAY_SEC } from './clock'
import { CITIES } from './cities'
import { fitFlap, settleFlaps, stepFlaps, stepGlyph } from './flap'
import { paintBoard, paintWayfinding, type FlapCanvas } from './paint'
import { boardSnapshot, boardStatus } from './project'
import { WAYFINDING, WAYFINDING_KINDS } from './signs'
import { FidsStage, mountFids } from './stage'
import { BoardPanel } from './BoardPanel'
import type { BoardSnapshot, FidsSource } from './types'

const BANNED = ['american', 'delta air', 'united air', 'lufthansa', 'emirates', 'british airways', 'qantas', 'air france', 'ryanair', 'easyjet']

function source(extra: Partial<FidsSource> = {}): FidsSource {
  return {
    clock: 90,
    schedule: [
      {
        id: 's1',
        airline: 'northline',
        flightNo: 'NL214',
        eta: 80,
        status: 'delayed',
        delaySec: 12,
        flightId: 'f1',
        stand: { c: 2, r: 3 },
      },
      {
        id: 's2',
        airline: 'harbor',
        flightNo: 'HA880',
        eta: 100,
        status: 'scheduled',
        delaySec: 0,
        flightId: null,
        stand: { c: 4, r: 1 },
      },
    ],
    flights: [
      {
        id: 'f1',
        airline: 'northline',
        flightNo: 'NL214',
        destination: 'Kite Harbor',
        phase: 'board',
        stand: { c: 2, r: 3 },
        std: 110,
        scheduleId: 's1',
      },
      {
        id: 'f2',
        airline: 'summit',
        flightNo: 'SP042',
        destination: 'Glassmere',
        phase: 'taxi_out',
        stand: { c: 1, r: 1 },
        std: 70,
        scheduleId: null,
      },
    ],
    airline(id: string) {
      const names: Record<string, string> = {
        northline: 'Northline',
        harbor: 'Harbor Air',
        summit: 'Summit Premier',
      }
      return names[id] ? { name: names[id] } : undefined
    },
    gateLabel(stand) {
      return stand ? `G${stand.c}-${stand.r}` : '—'
    },
    branding: { airportName: 'Hatchfield' },
    ...extra,
  }
}

function recorder() {
  const texts: string[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    fillRect() {},
    fillText(text: string) {
      texts.push(text)
    },
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    rect() {},
    clip() {},
  }
  return { ctx: ctx as FlapCanvas, texts }
}

describe('flight board clock', () => {
  it('reads the 180-second day as a 24-hour face', () => {
    expect(SIM_DAY_SEC).toBe(180)
    expect(boardClock(0)).toBe('00:00')
    expect(boardClock(90)).toBe('12:00')
    expect(boardClock(7.5)).toBe('01:00')
  })
})

describe('live schedule projection', () => {
  it('lists flight, airline, destination, time, gate and a flap status', () => {
    const board = boardSnapshot(source())
    const dep = board.departures.find((row) => row.flight === 'NL214')
    expect(dep).toMatchObject({
      airline: 'Northline',
      destination: 'Kite Harbor',
      gate: 'G2-3',
      status: 'Delayed',
    })
    expect(dep?.time).toMatch(/^\d{2}:\d{2}$/)
    const left = board.departures.find((row) => row.flight === 'SP042')
    expect(left?.status).toBe('Departed')
    expect(left?.airline).toBe('Summit Premier')
    const inbound = board.arrivals.find((row) => row.flight === 'HA880')
    expect(inbound?.status).toBe('Boarding')
    expect(inbound?.airline).toBe('Harbor Air')
    expect(board.departures.length).toBeLessThanOrEqual(BOARD_ROW_COUNT)
  })

  it('maps the three status words and skips cancelled slots', () => {
    expect(boardStatus('board', false)).toBe('Boarding')
    expect(boardStatus('parked', true)).toBe('Delayed')
    expect(boardStatus('taxi_out', true)).toBe('Departed')
    expect(boardStatus(null, false)).toBe('Boarding')
    const board = boardSnapshot(
      source({
        schedule: [
          {
            id: 'gone',
            airline: 'harbor',
            flightNo: 'HA1',
            eta: 10,
            status: 'cancelled',
            delaySec: 0,
            flightId: null,
          },
        ],
        flights: [],
      }),
    )
    expect(board.arrivals).toEqual([])
  })

  it('uses a fictional city when the schedule has no destination', () => {
    const board = boardSnapshot(source())
    const inbound = board.arrivals.find((row) => row.flight === 'HA880')
    expect(CITIES).toContain(inbound?.destination)
  })

  it('does not read economy or service-point modules', () => {
    const files = ['project.ts', 'flap.ts', 'stage.ts', 'paint.ts', 'BoardPanel.tsx']
    for (const file of files) {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      expect(src).not.toContain('economy')
      expect(src).not.toContain('hallService')
      expect(src).not.toContain('servicePoint')
    }
  })
})

describe('split-flap animation', () => {
  it('flips one leaf at a time and settles on the new word', () => {
    const first = boardSnapshot(source())
    let state = settleFlaps(first)
    const before = state.departures.find((row) => row.id === 'dep:f1')
    expect(before?.cells.status.shown.trim()).toBe('DELAYED')
    const next: BoardSnapshot = {
      ...first,
      departures: first.departures.map((row) => (row.id === 'dep:f1' ? { ...row, status: 'Departed' } : row)),
    }
    const mid = stepFlaps(state, next, 0.01)
    const flipping = mid.state.departures.find((row) => row.id === 'dep:f1')
    expect(flipping?.cells.status.shown.trim()).not.toBe('DEPARTED')
    expect(flipping?.cells.status.anim).toBeGreaterThan(0)
    state = stepFlaps(mid.state, next, 10_000).state
    expect(state.departures.find((row) => row.id === 'dep:f1')?.cells.status.shown.trim()).toBe('DEPARTED')
  })

  it('holds still when the row does not change', () => {
    const snap = boardSnapshot(source())
    const settled = settleFlaps(snap)
    const again = stepFlaps(settled, snap, 0.5)
    expect(again.dirty).toBe(false)
    expect(again.state.departures[0]?.cells.flight.shown).toBe(settled.departures[0]?.cells.flight.shown)
  })

  it('advances glyphs in one direction', () => {
    expect(stepGlyph('A', 'C')).toBe('B')
    expect(stepGlyph('C', 'C')).toBe('C')
    expect(fitFlap('nl214', 8)).toBe('NL214   ')
  })
})

describe('canvas textures', () => {
  it('paints a 2K departures board with every column', () => {
    expect(BOARD_W).toBeGreaterThanOrEqual(2048)
    expect(BOARD_H).toBeGreaterThanOrEqual(1024)
    expect(SIGN_W).toBeGreaterThanOrEqual(2048)
    expect(SIGN_H).toBeGreaterThanOrEqual(1024)
    const snap = boardSnapshot(source())
    const flaps = settleFlaps(snap)
    const { ctx, texts } = recorder()
    paintBoard(ctx, { title: 'DEPARTURES', clock: snap.clock, rows: flaps.departures })
    expect(texts).toContain('DEPARTURES')
    expect(texts).toContain(snap.clock)
    for (const col of COLUMNS) expect(texts).toContain(col.label)
    expect(texts.some((text) => text.includes('N'))).toBe(true)
  })

  it('paints procedural wayfinding for check-in, security, gates and baggage', () => {
    expect(WAYFINDING_KINDS).toEqual(['checkin', 'security', 'gates', 'baggage'])
    for (const kind of WAYFINDING_KINDS) {
      const { ctx, texts } = recorder()
      paintWayfinding(ctx, WAYFINDING[kind], 'Hatchfield')
      expect(texts).toContain(WAYFINDING[kind].title)
      expect(texts).toContain(WAYFINDING[kind].hint)
      expect(texts).toContain('HATCHFIELD')
    }
    const copy = [...CITIES, ...WAYFINDING_KINDS.flatMap((kind) => [WAYFINDING[kind].title, WAYFINDING[kind].hint]), 'HATCHFIELD']
      .join(' ')
      .toLowerCase()
    for (const brand of BANNED) expect(copy).not.toContain(brand)
  })
})

describe('terminal mounts', () => {
  it('hangs both boards and the four signs', () => {
    const stage = new FidsStage()
    const parent = new THREE.Group()
    const mounted = mountFids(
      parent,
      [
        { kind: 'checkin', x: 0, z: 0 },
        { kind: 'security', x: 4, z: 0 },
        { kind: 'gate', x: 8, z: 1 },
      ],
      0,
      (n) => n,
      stage.textures,
    )
    const names = parent.children.map((child) => child.name).sort()
    expect(names).toContain('fids-departures')
    expect(names).toContain('fids-arrivals')
    for (const kind of WAYFINDING_KINDS) {
      expect(names).toContain(`fids-sign-${kind}`)
      expect(names).toContain(`fids-post-${kind}`)
    }
    const board = parent.getObjectByName('fids-departures')
    expect(board?.userData.fids).toBe('board')
    expect(mounted.geos.length).toBeGreaterThan(0)
    stage.tick(1, boardSnapshot(source()))
    stage.dispose()
    for (const geo of mounted.geos) geo.dispose()
    for (const mat of mounted.mats) mat.dispose()
  })
})

describe('click-open board panel', () => {
  it('renders both tabs and the live columns', () => {
    const html = renderToStaticMarkup(createElement(BoardPanel, { source: source(), onClose: () => {} }))
    expect(html).toContain('data-testid="fids-panel"')
    expect(html).toContain('data-testid="fids-tab-departures"')
    expect(html).toContain('data-testid="fids-tab-arrivals"')
    expect(html).toContain('FLIGHT')
    expect(html).toContain('AIRLINE')
    expect(html).toContain('DESTINATION')
    expect(html).toContain('TIME')
    expect(html).toContain('GATE')
    expect(html).toContain('STATUS')
    expect(html).toContain('data-value="NL214"')
    expect(html).toContain('data-value="NORTHLINE"')
    expect(html).toContain('data-value="DELAYED"')
  })

  it('says when the timetable is empty', () => {
    const html = renderToStaticMarkup(
      createElement(BoardPanel, { source: source({ schedule: [], flights: [] }), onClose: () => {} }),
    )
    expect(html).toContain('data-testid="fids-empty"')
    expect(html).toContain('No movements')
  })
})
