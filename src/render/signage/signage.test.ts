import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { deskHeaderTexture, fittedSize, fidsBoardTexture, signageUrl, signPanelMaterial, wayfindingSheetTexture, wayfindingSource } from './load'
import {
  cropInside,
  DEDICATED_WAYFINDING,
  DESK_HEADER_CROPS,
  DESK_HEADER_SHEET,
  FIDS_CROP,
  FIDS_SHEET,
  fullBleed,
  SIGNAGE_DIR,
  WAYFINDING_CROPS,
  WAYFINDING_SHEET,
} from './sheets'

describe('gemini signage sheets', () => {
  it('keeps every crop inside its file and ships the JPEG', () => {
    expect(DESK_HEADER_CROPS).toHaveLength(6)
    for (const crop of DESK_HEADER_CROPS) expect(cropInside(DESK_HEADER_SHEET, crop)).toBe(true)
    for (const crop of Object.values(WAYFINDING_CROPS)) expect(cropInside(WAYFINDING_SHEET, crop)).toBe(true)
    expect(cropInside(FIDS_SHEET, FIDS_CROP)).toBe(true)
    for (const file of [DESK_HEADER_SHEET.file, WAYFINDING_SHEET.file, FIDS_SHEET.file]) {
      expect(existsSync(`public/${SIGNAGE_DIR}/${file}`)).toBe(true)
      expect(signageUrl(file)).toBe(`${SIGNAGE_DIR}/${file}`)
    }
    for (const sheet of Object.values(DEDICATED_WAYFINDING)) {
      expect(cropInside(sheet, fullBleed(sheet))).toBe(true)
      expect(existsSync(`public/${SIGNAGE_DIR}/${sheet.file}`)).toBe(true)
    }
    expect(wayfindingSource('gates').sheet.file).toBe('wayfinding_gates.jpg')
    expect(wayfindingSource('checkin').sheet.file).toBe('wayfinding_checkin.jpg')
    expect(wayfindingSource('security').sheet.file).toBe('wayfinding_security.jpg')
    expect(wayfindingSource('baggage').sheet.file).toBe('wayfinding_baggage.jpg')
    expect(wayfindingSource('toilets').sheet.file).toBe('wayfinding_restrooms.jpg')
    expect(wayfindingSource('exit').sheet.file).toBe(WAYFINDING_SHEET.file)
    expect(wayfindingSource('arrivals').sheet.file).toBe(WAYFINDING_SHEET.file)
    expect(wayfindingSource('departures').sheet.file).toBe(WAYFINDING_SHEET.file)
  })

  it('downscales the long side and stays a flat colour without a browser', () => {
    expect(fittedSize(2624, 1380, 'high')).toEqual({ w: 2048, h: 1077 })
    expect(fittedSize(640, 944, 'high')).toEqual({ w: 640, h: 944 })
    expect(fittedSize(897, 416, 'low').w).toBeLessThanOrEqual(768)
    expect(deskHeaderTexture(1)).toBeNull()
    expect(deskHeaderTexture(6)).toBeNull()
    expect(wayfindingSheetTexture('gates')).toBeNull()
    expect(fidsBoardTexture()).toBeNull()
  })

  it('faces the panel forward so the words are not mirrored', () => {
    const mat = signPanelMaterial(null, 0x0e2230)
    expect(mat.side).toBe(THREE.FrontSide)
    mat.dispose()
  })
})
