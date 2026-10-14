/**
 * Debug overlay for renderer.info. Hidden by default; F3 or `?perf` in the URL shows it.
 * A small corner readout: it never blocks the view and ignores pointer input.
 */
import type * as THREE from 'three'
import { FrameMeter, formatStats, readRenderStats } from './rendererStats'
import { formatLodAdvice, loadLodScale, saveLodScale, type LodTuneInput } from './lodTune'

declare global {
  interface Window {
    __lodTuneInput?: boolean
    __lodScale?: number
  }
}

/** Texture memory walks the scene, so refresh it at this interval, not per frame. */
const REFRESH_MS = 500

export class PerfOverlay {
  private el: HTMLPreElement | null = null
  private visible = false
  private readonly meter = new FrameMeter()
  private last = 0
  private lastText = 0
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'F3') {
      e.preventDefault()
      this.setVisible(!this.visible)
    } else if (e.key === '[' || e.key === ']') {
      if (typeof window !== 'undefined') {
        const storage = window.sessionStorage || window.localStorage
        let scale = loadLodScale(storage)
        scale += e.key === '[' ? -0.05 : 0.05
        scale = Math.max(0.6, Math.min(1.8, Math.round(scale * 100) / 100))
        saveLodScale(storage, scale)
        window.__lodScale = scale
      }
    }
  }

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('keydown', this.onKey)
    if (new URLSearchParams(window.location.search).has('perf')) this.setVisible(true)
  }

  setVisible(on: boolean) {
    this.visible = on
    if (on && !this.el && typeof document !== 'undefined') {
      const el = document.createElement('pre')
      el.setAttribute('data-testid', 'perf-overlay')
      el.style.cssText =
        'position:fixed;left:8px;bottom:8px;margin:0;padding:6px 8px;z-index:50;pointer-events:none;' +
        'font:11px/1.35 ui-monospace,monospace;color:#cfe;background:rgba(0,0,0,.55);border-radius:4px'
      document.body.appendChild(el)
      this.el = el
    }
    if (this.el) this.el.style.display = on ? 'block' : 'none'
  }

  /** Call right after `renderer.render`, so `renderer.info` holds this frame's counts. */
  update(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, now = performance.now()) {
    if (this.last) this.meter.push(now - this.last)
    this.last = now
    if (!this.visible || !this.el || now - this.lastText < REFRESH_MS) return
    this.lastText = now

    const stats = readRenderStats(renderer, scene)
    let text = formatStats(this.meter.fps, this.meter.percentileMs(0.99), stats)

    if (typeof window !== 'undefined' && window.__lodTuneInput) {
      const storage = window.sessionStorage || window.localStorage
      const currentScale = window.__lodScale ?? loadLodScale(storage)
      const input: LodTuneInput = {
        fps: this.meter.fps,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        currentScale
      }
      text += '\n' + formatLodAdvice(input)
    }

    this.el.textContent = text
  }

  dispose() {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKey)
    this.el?.remove()
    this.el = null
  }
}
