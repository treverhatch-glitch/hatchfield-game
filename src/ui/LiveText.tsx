import { useLayoutEffect, useRef, useState } from 'react'
import { addLiveSlot, type LiveSlot } from './liveHud'

/** A span whose text the live pump keeps current. React renders it once; later reads never re-render. */
export function LiveText({
  read,
  className,
  testId,
}: {
  read: () => string
  className?: string
  testId?: string
}) {
  const [first] = useState(read)
  const ref = useRef<HTMLSpanElement>(null)
  const slot = useRef<LiveSlot | null>(null)
  useLayoutEffect(() => {
    if (slot.current) slot.current.read = read
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const s: LiveSlot = { el, read, last: first }
    slot.current = s
    const off = addLiveSlot(s)
    return () => {
      off()
      slot.current = null
    }
    // Mount-only: later reads swap in through the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <span ref={ref} className={className ? `hud-live ${className}` : 'hud-live'} data-testid={testId}>
      {first}
    </span>
  )
}
