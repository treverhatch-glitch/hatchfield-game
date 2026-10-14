import { useState } from 'react'
import { airlineLogoUrl } from '../render/aircraft/airlineLogo'

/** Logo on an Airlines card. A missing file keeps the carrier colour. */
export function AirlineMark({ id, color }: { id: string; color: string }) {
  const url = airlineLogoUrl(id)
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return <span className="airline-logo fallback" style={{ background: color }} aria-hidden />
  }
  return <img className="airline-logo" src={url} alt="" onError={() => setFailed(true)} />
}
