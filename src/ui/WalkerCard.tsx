/**
 * Guest card section for a terminal walker (src/paxnav guests): traits, the
 * needs that drive their stops, satisfaction and their latest thoughts. A
 * side-panel block, never a modal; reads the sim, writes nothing.
 */
import type { Game } from '../game/sim'
import { moodWord, type GuestCard } from '../paxnav/index.ts'

const TRAIT_LABEL: Record<string, string> = {
  business: 'Business',
  leisure: 'Leisure',
  family: 'Family trip',
  budget: 'Budget',
  first_timer: 'First-timer',
  frequent_flyer: 'Frequent flyer',
  reduced_mobility: 'Reduced mobility',
  with_kids: 'With kids',
}

const NEED_LABEL: [keyof GuestCard['needs'], string][] = [
  ['hunger', 'Hunger'],
  ['thirst', 'Thirst'],
  ['bladder', 'Restroom'],
  ['boredom', 'Boredom'],
  ['tired', 'Tired'],
  ['comfort', 'Discomfort'],
  ['anxiety', 'Flight worry'],
]

const STOP_LABEL: Record<string, string> = {
  checkin: 'check-in',
  security: 'security',
  toilet: 'the restroom',
  food: 'food',
  shop: 'the shops',
  gate: 'their gate',
  rebook: 'the rebooking desk',
}

function WalkerBody({ card }: { card: GuestCard }) {
  const latest = card.thoughts[card.thoughts.length - 1]
  return (
    <div className="walker-card" data-testid="walker-card">
      <p data-testid="walker-name">
        <strong>{card.name}</strong> · {moodWord(card.satisfaction)}
      </p>
      <p className="muted" data-testid="walker-traits">
        {card.traits.map((t) => TRAIT_LABEL[t] ?? t).join(' · ')}
        {card.group.length ? ` · party of ${card.group.length}` : ''}
      </p>
      <p className="mood" data-testid="walker-thought">
        {latest ? `${latest.icon} “${latest.text}”` : 'No complaints yet'}
        {card.lost ? ' · lost' : ''}
        {card.rebooking ? ' · missed flight' : ''}
      </p>
      <ul>
        <li>
          Satisfaction {Math.round(card.satisfaction)} <i style={{ width: `${Math.round(card.satisfaction)}%` }} />
        </li>
        {NEED_LABEL.map(([k, label]) => (
          <li key={k}>
            {label} <i style={{ width: `${Math.round(card.needs[k] * 100)}%` }} />
          </li>
        ))}
        <li>
          {card.stop ? `Heading for ${STOP_LABEL[card.stop] ?? card.stop}` : 'Boarding'}
          {card.waitedSec > 0 ? ` · in line ${Math.round(card.waitedSec / 60)} min` : ''}
        </li>
        {card.spent > 0 ? <li>Spent ${card.spent}</li> : null}
      </ul>
      {card.thoughts.length > 1 ? (
        <ul className="muted" data-testid="walker-thoughts">
          {card.thoughts
            .slice(0, -1)
            .reverse()
            .map((t) => (
              <li key={`${t.key}-${t.at}`}>
                {t.icon} {t.text}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  )
}

/** The walker section inside the guest card. Renders nothing for guests not walking the terminal. */
export function WalkerCard({ game, id }: { game: Game; id: string }) {
  const card = game.hallNav.guestCard(id)
  return card ? <WalkerBody card={card} /> : null
}

/** A guest card for a walker the hall model no longer lists (e.g. rebooking after a missed flight). */
export function WalkerOnlyCard({
  game,
  id,
  onFollow,
}: {
  game: Game
  id: string | null
  onFollow?: (id: string) => void
}) {
  if (!id) return null
  const card = game.hallNav.guestCard(id)
  const walking = card ? null : game.hallNav.locate(id)
  if (!card && !walking) return null
  return (
    <aside className="guest-card" data-testid="guest-card">
      <h2>Passenger</h2>
      {card ? <WalkerBody card={card} /> : <p className="muted">Walking the terminal</p>}
      {onFollow ? (
        <button type="button" data-testid="guest-follow" onClick={() => onFollow(id)}>
          Follow
        </button>
      ) : null}
    </aside>
  )
}
