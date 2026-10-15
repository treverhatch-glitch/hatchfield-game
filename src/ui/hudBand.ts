import { useEffect, type RefObject } from 'react'

/** CSS variables on <html> that describe the top band (see :root in index.css). */
export type HudBandVar = '--hud-bar-bottom' | '--hud-strip-h'

/**
 * Keep a top-band CSS variable in step with an element. `edge` 'bottom' writes the
 * element's bottom edge in viewport px; 'height' writes its outer height plus `gap`.
 * The variable is cleared on unmount so the :root default takes over again.
 */
export function useHudBandVar(
  ref: RefObject<HTMLElement | null>,
  name: HudBandVar,
  edge: 'bottom' | 'height',
  gap = 0,
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const write = () => {
      const rect = el.getBoundingClientRect()
      const px = (edge === 'bottom' ? rect.bottom : rect.height) + gap
      root.style.setProperty(name, `${Math.ceil(px)}px`)
    }
    write()
    let live = true
    const cleanups: (() => void)[] = []
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', write)
      cleanups.push(() => window.removeEventListener('resize', write))
    } else {
      const observer = new ResizeObserver(write)
      observer.observe(el)
      for (const child of el.children) observer.observe(child)
      cleanups.push(() => observer.disconnect())
    }
    void document.fonts?.ready.then(() => {
      if (live) write()
    })
    return () => {
      live = false
      for (const cleanup of cleanups) cleanup()
      root.style.removeProperty(name)
    }
  }, [ref, name, edge, gap])
}
