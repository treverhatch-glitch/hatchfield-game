import { useEffect, type RefObject } from 'react'
import { SHEET_MOTION } from './scheduleConfig'

/** Extra pixels from a flick. Slow drags add almost nothing. */
export function dragMomentumPx(dx: number, dtMs: number, momentumMs = SHEET_MOTION.momentumMs, capPx = SHEET_MOTION.momentumCapPx): number {
  if (!(dtMs > 0) || !Number.isFinite(dx)) return 0
  const extra = (dx / dtMs) * momentumMs
  return Math.max(-capPx, Math.min(capPx, extra))
}

/**
 * Wheel inertia inside the sheet. Native trackpad flings are replaced with the
 * same decay so a mouse wheel keeps sliding. A deeper spring can come later.
 */
export function useSheetMomentum(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const el = ref.current
    if (!active || !el) return
    let vx = 0
    let vy = 0
    let raf = 0
    const step = () => {
      if (Math.abs(vx) < 0.25 && Math.abs(vy) < 0.25) return
      el.scrollLeft += vx
      el.scrollTop += vy
      vx *= 0.9
      vy *= 0.9
      raf = requestAnimationFrame(step)
    }
    const onWheel = (e: WheelEvent) => {
      if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) return
      e.preventDefault()
      vx = Math.max(-56, Math.min(56, vx + e.deltaX * 0.35))
      vy = Math.max(-56, Math.min(56, vy + e.deltaY * 0.35))
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(step)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(raf)
    }
  }, [ref, active])
}
