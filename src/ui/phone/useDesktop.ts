import { useEffect, useState } from 'react'

/** Desktop is the wide layout. The phone does not mount on the narrow one. */
export const PHONE_DESKTOP_MIN = 801

function desktopNow(minWidth: number): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(`(min-width: ${minWidth}px)`).matches
    : false
}

export function useDesktop(minWidth = PHONE_DESKTOP_MIN): boolean {
  const [on, setOn] = useState(() => desktopNow(minWidth))
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidth}px)`)
    const apply = () => setOn(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [minWidth])
  return on
}
