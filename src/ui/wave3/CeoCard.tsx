import type { CeoCard } from '../../wave3/types.ts'

/** Flat portrait drawn from the CEO card's portrait slot. Same seed, same face. */
export function CeoPortrait({ card }: { card: CeoCard }) {
  const face = card.portrait
  const bald = face.hairStyle === 'bald'
  const long = face.hairStyle === 'long'
  return (
    <svg width="64" height="80" viewBox="0 0 64 80" role="img" aria-label={`${card.name} portrait`}>
      <rect width="64" height="80" rx="8" fill="#14241c" stroke="#c9a227" strokeWidth="2" />
      <rect x="14" y="50" width="36" height="26" rx="6" fill={face.suit} />
      <rect x="28" y="50" width="8" height="8" fill={face.accent} />
      {long ? <path d="M16 34 C14 62 20 66 24 64 C20 48 22 38 26 32" fill={face.hair} /> : null}
      {long ? <path d="M48 34 C50 62 44 66 40 64 C44 48 42 38 38 32" fill={face.hair} /> : null}
      <ellipse cx="32" cy="36" rx="14" ry="16" fill={face.skin} />
      {bald ? null : (
        <path d="M16 34 Q18 14 32 12 Q48 14 48 34 Q40 22 32 20 Q24 22 16 34" fill={face.hair} />
      )}
      <ellipse cx="26" cy="36" rx="1.8" ry="2" fill="#1b1b1b" />
      <ellipse cx="38" cy="36" rx="1.8" ry="2" fill="#1b1b1b" />
      <path d="M26 44 Q32 48 38 44" stroke="#6b3a2a" strokeWidth="1.2" fill="none" />
      {face.glasses ? (
        <g fill="none" stroke="#222" strokeWidth="1.1">
          <circle cx="26" cy="36" r="4.5" />
          <circle cx="38" cy="36" r="4.5" />
          <path d="M30.5 36 H33.5" />
        </g>
      ) : null}
    </svg>
  )
}

export function CeoCardView({
  card,
  score,
  band,
  tierLabel,
  fleet,
  line,
}: {
  card: CeoCard
  score: number
  band: string
  tierLabel: string
  fleet: string
  line: string
}) {
  return (
    <div className="wave3-ceo" data-testid="wave3-ceo">
      <CeoPortrait card={card} />
      <div>
        <strong>{card.name}</strong>
        <p className="muted">
          {card.title} · {card.traits.join(' · ')}
        </p>
        <p className="muted">
          Relationship {Math.round(score)} · {band} · contract {tierLabel}
        </p>
        <p data-testid="wave3-fleet">{fleet}</p>
        <p className="muted">{line}</p>
      </div>
    </div>
  )
}
