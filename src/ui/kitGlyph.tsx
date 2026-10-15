import { StampIcon } from './nav/stampIcons.tsx'

/** Build-menu marks. Service props that wear a concept plate get a drawn mark; the rest get a stamp icon. */
export function KitGlyph({ id }: { id: string }) {
  if (id === 'bag_drop') {
    return (
      <svg className="kit-glyph" viewBox="0 0 32 24" aria-hidden>
        <rect x="4" y="2" width="10" height="14" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="5.5" y="3.4" width="7" height="6" fill="currentColor" />
        <rect x="14" y="14" width="14" height="4" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 16 H26" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }
  if (id === 'claim_carousel') {
    return (
      <svg className="kit-glyph" viewBox="0 0 32 24" aria-hidden>
        <rect x="6" y="4" width="20" height="14" rx="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="10" y="8" width="12" height="6" rx="3" fill="currentColor" opacity="0.35" />
        <path d="M8 2 H24" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  if (id === 'passport_booth') {
    return (
      <svg className="kit-glyph" viewBox="0 0 32 24" aria-hidden>
        <rect x="3" y="6" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="12" y="6" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="21" y="6" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 4 H29" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="7" cy="11" r="1.2" fill="currentColor" />
        <circle cx="16" cy="11" r="1.2" fill="currentColor" />
        <circle cx="25" cy="11" r="1.2" fill="currentColor" />
      </svg>
    )
  }
  return <StampIcon id={id} className="kit-glyph" />
}
