import { describe, expect, it } from 'vitest'
import { HUD_VIEWPORTS, apronPanels, assignRegions, hallPanels, overlaps } from './regions.ts'

function expectClear(boxes: { id: string; x: number; y: number; w: number; h: number }[], label: string) {
  for (const box of boxes) {
    expect(box.w, `${box.id} width at ${label}`).toBeGreaterThan(40)
    expect(box.h, `${box.id} height at ${label}`).toBeGreaterThan(20)
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(overlaps(boxes[i], boxes[j]), `${boxes[i].id} overlaps ${boxes[j].id} at ${label}`).toBe(false)
    }
  }
}

describe('HUD regions', () => {
  it('places one panel in each region and queues the rest', () => {
    const { placed, queued } = assignRegions([
      { id: 'flight', region: 'inspector', priority: 1 },
      { id: 'assign', region: 'inspector', priority: 2 },
      { id: 'manage', region: 'inspector', priority: 3 },
      { id: 'phone', region: 'dock', priority: 2 },
      { id: 'relations', region: 'dock', priority: 1 },
    ])
    expect(placed.map((item) => item.id).sort()).toEqual(['manage', 'phone'])
    expect(queued.map((item) => item.id).sort()).toEqual(['assign', 'flight', 'relations'])
  })

  it('keeps the apron panels from overlapping at 1280×720, 1280×800, and 1920×1080', () => {
    for (const viewport of HUD_VIEWPORTS) {
      const label = `${viewport.width}x${viewport.height}`
      expectClear(apronPanels(viewport.width, viewport.height), label)
      // The status strip wraps on the short screen. The same regions still clear it.
      expectClear(apronPanels(viewport.width, viewport.height, 140), `${label} wrapped top`)
    }
  })

  it('keeps the terminal panels from overlapping at 1280×720, 1280×800, and 1920×1080', () => {
    for (const viewport of HUD_VIEWPORTS) {
      const label = `${viewport.width}x${viewport.height}`
      const boxes = hallPanels(viewport.width, viewport.height)
      expectClear(boxes, label)
      const menu = boxes.find((item) => item.id === 'interior')!
      const center = menu.x + menu.w / 2
      expect(Math.abs(center - viewport.width / 2)).toBeLessThan(viewport.width * 0.08)
    }
  })
})
