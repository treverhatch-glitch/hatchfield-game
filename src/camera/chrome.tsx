import { useEffect, useSyncExternalStore } from 'react'
import { simClockToHour } from '../lighting/daylight.ts'
import { cameraSession } from './session.ts'
import { formatHour } from './space.ts'

const clusterStyle = {
  position: 'absolute' as const,
  left: 16,
  // First row under the HUD's top band; the coach and letters start 44px lower.
  top: 'calc(var(--hud-top) + 8px)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'none' as const,
}

const buttonStyle = {
  pointerEvents: 'auto' as const,
  background: 'rgba(10, 20, 16, 0.9)',
  color: '#e8eef4',
  border: '1px solid rgba(201, 162, 39, 0.5)',
  borderRadius: 8,
  padding: '6px 10px',
  font: '600 12px/1.2 "IBM Plex Sans", system-ui, sans-serif',
  boxShadow: '0 6px 16px rgba(0,0,0,0.28)',
  maxWidth: 220,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}

/**
 * Edge controls only: a Follow chip when something is selected, and a photo bar
 * while the rest of the HUD is hidden. Neither sits over the middle of the field.
 */
export function CameraChrome({
  view,
  clockOf,
}: {
  view: 'apron' | 'hall'
  clockOf: () => number
}) {
  const snap = useSyncExternalStore(cameraSession.subscribe, cameraSession.getSnapshot)

  useEffect(() => {
    const shell = document.querySelector('.shell')
    if (!shell) return
    shell.classList.toggle('photo-mode', snap.photo)
    return () => shell.classList.remove('photo-mode')
  }, [snap.photo])

  return (
    <div data-camera-ui style={{ position: 'absolute', inset: 0, zIndex: 36, pointerEvents: 'none' }}>
      {snap.photo ? (
        <PhotoBar showTime={view === 'apron'} hour={snap.hour} />
      ) : (
        <div style={clusterStyle}>
          {view === 'apron' && snap.selection ? (
            <button
              type="button"
              data-testid="follow-cam"
              aria-pressed={snap.following}
              title={snap.following ? 'Esc or drag to exit' : 'Track the selection'}
              style={{
                ...buttonStyle,
                background: snap.following ? '#c9a227' : buttonStyle.background,
                color: snap.following ? '#1a1406' : buttonStyle.color,
              }}
              onClick={() => (snap.following ? cameraSession.stopFollow() : cameraSession.startFollow())}
            >
              {snap.following ? 'Following' : 'Follow'} {snap.selection.label}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="photo-mode"
            title="Photo mode (P)"
            style={buttonStyle}
            onClick={() => cameraSession.togglePhoto(simClockToHour(clockOf()))}
          >
            P
          </button>
        </div>
      )}
    </div>
  )
}

function PhotoBar({ showTime, hour }: { showTime: boolean; hour: number | null }) {
  return (
    <div
      data-testid="photo-bar"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'rgba(10, 20, 16, 0.9)',
        color: '#e8eef4',
        border: '1px solid rgba(201, 162, 39, 0.5)',
        borderRadius: 10,
        pointerEvents: 'auto',
        font: '600 12px/1.2 "IBM Plex Sans", system-ui, sans-serif',
        boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
      }}
    >
      {showTime && hour != null ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Time</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.05}
            value={hour}
            aria-label="Time of day"
            style={{ width: 140 }}
            onChange={(e) => cameraSession.setHour(Number(e.target.value))}
          />
          <span style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace', minWidth: 44 }}>
            {formatHour(hour)}
          </span>
        </label>
      ) : null}
      <button type="button" data-testid="photo-capture" style={buttonStyle} onClick={() => cameraSession.requestCapture()}>
        Save PNG
      </button>
      <button type="button" style={buttonStyle} onClick={() => cameraSession.noteEscape()}>
        Close
      </button>
    </div>
  )
}
