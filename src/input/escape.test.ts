import { describe, expect, it } from 'vitest'
import { nextEscape } from './escape.ts'

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
})
