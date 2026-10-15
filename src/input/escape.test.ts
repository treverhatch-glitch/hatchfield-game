import { describe, expect, it } from 'vitest'
import { nextEscape, numbersToClose } from './escape.ts'

describe('escape order', () => {
  const idle = { menuOpen: false, cameraCaptured: false, toolActive: false }

  it('closes the menu before anything else', () => {
    expect(nextEscape({ ...idle, menuOpen: true, toolActive: true, cameraCaptured: true })).toBe('close-menu')
  })

  it('releases photo or follow before a tool', () => {
    expect(nextEscape({ ...idle, cameraCaptured: true, toolActive: true })).toBe('release-camera')
  })

  it('cancels a build tool, then opens the menu', () => {
    expect(nextEscape({ ...idle, toolActive: true })).toBe('cancel-tool')
    expect(nextEscape(idle)).toBe('open-menu')
  })

  it('closes an info view before the menu, and its numbers first', () => {
    expect(nextEscape({ ...idle, infoDetailOpen: true, infoViewOpen: true })).toBe('close-info-detail')
    expect(nextEscape({ ...idle, infoViewOpen: true })).toBe('close-info')
    expect(nextEscape({ ...idle, toolActive: true, infoViewOpen: true })).toBe('cancel-tool')
  })

  it('closes hotspot lines, then the More menu, then a map numbers panel', () => {
    expect(numbersToClose({ infoLinesOpen: true, infoMenuOpen: true, infoDetailOpen: true })).toBe('lines')
    expect(numbersToClose({ infoLinesOpen: false, infoMenuOpen: true, infoDetailOpen: true })).toBe('menu')
    expect(numbersToClose({ infoLinesOpen: false, infoMenuOpen: false, infoDetailOpen: true })).toBe('detail')
    expect(numbersToClose({ infoLinesOpen: false, infoMenuOpen: false, infoDetailOpen: false })).toBeNull()
  })

  it('closes the flight card after info views and before the menu', () => {
    expect(nextEscape({ ...idle, flightCardOpen: true })).toBe('close-flight-card')
    expect(nextEscape({ ...idle, infoViewOpen: true, flightCardOpen: true })).toBe('close-info')
    expect(nextEscape({ ...idle, toolActive: true, flightCardOpen: true })).toBe('cancel-tool')
  })

  it('closes the hub profile after the flight card and before the menu', () => {
    expect(nextEscape({ ...idle, hubProfileOpen: true })).toBe('close-hub-profile')
    expect(nextEscape({ ...idle, flightCardOpen: true, hubProfileOpen: true })).toBe('close-flight-card')
    expect(nextEscape({ ...idle, infoViewOpen: true, hubProfileOpen: true })).toBe('close-info')
  })

  it('closes the assign panel after the flight card and before the hub profile', () => {
    expect(nextEscape({ ...idle, assignOpen: true })).toBe('close-assign')
    expect(nextEscape({ ...idle, flightCardOpen: true, assignOpen: true })).toBe('close-flight-card')
    expect(nextEscape({ ...idle, assignOpen: true, hubProfileOpen: true })).toBe('close-assign')
  })
})
