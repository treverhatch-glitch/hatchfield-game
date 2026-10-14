import type { LabFrame } from '../../wave3/types.ts'

/** Placeholder lab. An empty bay until a research room is placed. */
export function LabAnimation({ frame }: { frame: LabFrame }) {
  const y = 46 - frame.bob * 6
  return (
    <svg
      className="wave3-lab"
      data-testid="wave3-lab"
      data-phase={frame.phase}
      viewBox="0 0 220 96"
      role="img"
      aria-label={frame.phase === 'empty' ? 'Research bay empty' : 'Research bay working'}
    >
      <rect width="220" height="96" rx="8" fill="#101a16" />
      <rect x="16" y="58" width="188" height="22" rx="3" fill="#24362c" />
      <rect x="28" y="40" width="36" height="18" rx="2" fill="#0e2a22" stroke="#7dcea0" strokeOpacity={frame.glow} />
      <rect x="78" y="36" width="48" height="22" rx="2" fill="#1a2430" stroke="#f0d78c" strokeOpacity={frame.phase === 'spark' ? frame.spark : 0.25} />
      {frame.phase === 'empty' ? (
        <text x="110" y="28" textAnchor="middle" fill="#9eb0a0" fontSize="11">
          Place a research desk
        </text>
      ) : (
        <g>
          <circle cx="150" cy={y} r="8" fill="#e0b08a" />
          <rect x="142" y={y + 8} width="16" height="18" rx="3" fill="#f4f7fb" />
          <text x="110" y="18" textAnchor="middle" fill="#d5e6da" fontSize="11">
            {frame.rooms} room{frame.rooms === 1 ? '' : 's'} · {frame.phase}
          </text>
        </g>
      )}
    </svg>
  )
}
