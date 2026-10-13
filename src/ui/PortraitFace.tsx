import type { PortraitCard } from '../diplomacy/types.ts'

const FRAME = { bronze: '#b08d57', silver: '#d5dde6', gold: '#e6c35c' }

/** Flat illustrated card from portrait tokens. Same seed, same face. */
export function PortraitFace({ card, name }: { card: PortraitCard; name: string }) {
  const frame = FRAME[card.frame]
  if (card.logoOnly) {
    return (
      <svg width="72" height="88" viewBox="0 0 72 88" role="img" aria-label={`${name} logo`}>
        <rect width="72" height="88" rx="8" fill={card.background} stroke={frame} strokeWidth="3" />
        <circle cx="36" cy="40" r="18" fill={card.clothing.color} />
        <circle cx="36" cy="40" r="8" fill={card.clothing.accent} />
      </svg>
    )
  }
  const long = card.hair.style === 'long' || card.hair.style === 'braids'
  const bald = card.hair.style === 'bald'
  const bun = card.hair.style === 'bun'
  return (
    <svg width="72" height="88" viewBox="0 0 72 88" role="img" aria-label={name}>
      <rect width="72" height="88" rx="8" fill={card.background} stroke={frame} strokeWidth="3" />
      <rect x="16" y="58" width="40" height="26" rx="6" fill={card.clothing.color} />
      <rect x="30" y="58" width="12" height="8" fill={card.clothing.accent} />
      {long ? <path d="M18 36 C16 70 22 74 26 72 C22 50 24 40 28 34" fill={card.hair.color} /> : null}
      {long ? <path d="M54 36 C56 70 50 74 46 72 C50 50 48 40 44 34" fill={card.hair.color} /> : null}
      <ellipse cx="36" cy="40" rx="16" ry="18" fill={card.skin} />
      {bald ? null : (
        <path
          d={bun ? 'M20 36 Q36 8 52 36 Q44 22 36 20 Q28 22 20 36' : 'M18 38 Q20 16 36 14 Q54 16 54 38 Q46 24 36 22 Q26 24 18 38'}
          fill={card.hair.color}
        />
      )}
      {bun ? <circle cx="36" cy="16" r="6" fill={card.hair.color} /> : null}
      <ellipse cx="30" cy="40" rx="2" ry={card.face.eyes === 'sleepy' ? 1 : 2.2} fill="#1b1b1b" />
      <ellipse cx="42" cy="40" rx="2" ry={card.face.eyes === 'sleepy' ? 1 : 2.2} fill="#1b1b1b" />
      <path
        d={card.face.mouth === 'neutral' ? 'M30 50 H42' : 'M30 49 Q36 55 42 49'}
        stroke="#6b3a2a"
        strokeWidth="1.4"
        fill="none"
      />
      {card.accessory?.includes('glasses') ? (
        <g fill="none" stroke="#222" strokeWidth="1.2">
          <circle cx="30" cy="40" r="5" />
          <circle cx="42" cy="40" r="5" />
          <path d="M35 40 H37" />
        </g>
      ) : null}
      {card.facialHair ? <path d="M28 52 Q36 60 44 52" fill={card.hair.color} opacity="0.85" /> : null}
    </svg>
  )
}
