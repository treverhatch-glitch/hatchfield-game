import { useEffect, useState } from 'react'
import type { Game } from '../../game/sim.ts'
import { dispatchPhoneAction, phoneHost } from '../../phone/commands.ts'
import {
  arrivalKeys,
  flashPreview,
  flashTab,
  lettersToHold,
  phoneClose,
  phoneDismissFlash,
  phoneOpen,
  phoneSetTab,
  phoneSwipe,
  phoneSync,
  createPhoneShell,
} from '../../phone/logic.ts'
import { readPhoneCards } from '../../phone/readGame.ts'
import type { PhoneAction, PhoneCard, PhoneShell, PhoneTab } from '../../phone/types.ts'
import { LiveText } from '../LiveText.tsx'
import { useDesktop } from './useDesktop.ts'
import './phone.css'

const SWIPE_PX = 48
const FLASH_MS = 4500

export function Phone({ game, desktop }: { game: Game; desktop?: boolean }) {
  const detected = useDesktop()
  const show = desktop ?? detected
  const cards = show ? readPhoneCards(game) : []
  const keyJoin = arrivalKeys(cards).join('\n')
  const [shell, setShell] = useState(createPhoneShell)
  const [synced, setSynced] = useState('')
  if (show && synced !== keyJoin) {
    setSynced(keyJoin)
    setShell((cur) => phoneSync(cur, keyJoin ? keyJoin.split('\n') : []))
  }

  useEffect(() => {
    if (!show || !shell.flashKey) return
    const timer = window.setTimeout(() => setShell((cur) => phoneDismissFlash(cur)), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [show, shell.flashKey])

  const holdKey = lettersToHold(shell, cards).join(',')
  useEffect(() => {
    if (!show) return
    game.holdLetters(holdKey ? holdKey.split(',') : [])
    return () => game.holdLetters([])
  }, [game, show, holdKey])

  if (!show) return null

  return (
    <PhoneView
      cards={cards}
      shell={shell}
      belowCoach={game.showCoach()}
      onOpen={() => setShell((cur) => phoneOpen(cur, flashTab(cards, cur.flashKey) ?? cur.tab))}
      onClose={() => setShell((cur) => phoneClose(cur))}
      onTab={(tab) => setShell((cur) => phoneSetTab(cur, tab))}
      onSwipe={(direction) => setShell((cur) => phoneSwipe(cur, direction))}
      onAction={(action) => dispatchPhoneAction(phoneHost(game), action)}
    />
  )
}

export function PhoneView({
  cards,
  shell,
  belowCoach = false,
  onOpen,
  onClose,
  onTab,
  onSwipe,
  onAction,
}: {
  cards: PhoneCard[]
  shell: PhoneShell
  belowCoach?: boolean
  onOpen: () => void
  onClose: () => void
  onTab: (tab: PhoneTab) => void
  onSwipe: (direction: 'next' | 'prev') => void
  onAction: (action: PhoneAction) => void
}) {
  const preview = !shell.open ? flashPreview(cards, shell.flashKey) : null
  const page = cards.filter((card) => card.tab === shell.tab)
  const state = shell.open ? 'open' : shell.flashKey ? 'flash' : 'peek'

  return (
    <div className={`phone-dock${belowCoach ? ' below-coach' : ''}`} data-testid="phone" data-state={state}>
      <div className={`phone-device is-${state}`}>
        {shell.open ? (
          <div className="phone-bezel">
            <div className="phone-speaker" aria-hidden="true" />
            <div className="phone-screen">
              <div className="phone-top">
                <div className="phone-tabs" role="tablist" aria-label="Phone">
                  <TabButton
                    tab="contracts"
                    label="Contracts"
                    count={cards.filter((card) => card.tab === 'contracts').length}
                    shell={shell}
                    onTab={onTab}
                  />
                  <TabButton
                    tab="messages"
                    label="Messages"
                    count={cards.filter((card) => card.tab === 'messages').length}
                    shell={shell}
                    onTab={onTab}
                  />
                </div>
                <button type="button" className="phone-close" data-testid="phone-close" onClick={onClose}>
                  Close
                </button>
              </div>
              {shell.tabOpen ? (
                <PhonePage
                  cards={page}
                  tab={shell.tab}
                  flashKey={shell.flashKey}
                  onSwipe={onSwipe}
                  onAction={onAction}
                />
              ) : (
                <p className="phone-shut" data-testid="phone-tab-shut">
                  {shell.tab === 'contracts' ? 'Contracts' : 'Messages'} closed
                </p>
              )}
            </div>
          </div>
        ) : (
          <button type="button" className="phone-peek" data-testid="phone-peek" onClick={onOpen} aria-label="Open phone">
            <span className="phone-peek-copy">
              {preview ? (
                <span className="phone-preview" data-testid="phone-preview">
                  {preview}
                </span>
              ) : (
                <span className="phone-glyph" aria-hidden="true" />
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

function TabButton({
  tab,
  label,
  count,
  shell,
  onTab,
}: {
  tab: PhoneTab
  label: string
  count: number
  shell: PhoneShell
  onTab: (tab: PhoneTab) => void
}) {
  const selected = shell.tab === tab
  return (
    <button
      type="button"
      role="tab"
      data-testid={`phone-tab-${tab}`}
      aria-selected={selected}
      aria-expanded={selected ? shell.tabOpen : false}
      className={selected ? 'on' : ''}
      onClick={() => onTab(tab)}
    >
      {label}
      <span className="phone-count">{count}</span>
    </button>
  )
}

function PhonePage({
  cards,
  tab,
  flashKey,
  onSwipe,
  onAction,
}: {
  cards: PhoneCard[]
  tab: PhoneTab
  flashKey: string | null
  onSwipe: (direction: 'next' | 'prev') => void
  onAction: (action: PhoneAction) => void
}) {
  const [drag, setDrag] = useState<{ id: number; x: number } | null>(null)
  return (
    <div
      className="phone-page"
      data-testid="phone-swipe"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button, a, input')) return
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ id: event.pointerId, x: event.clientX })
      }}
      onPointerUp={(event) => {
        if (!drag || drag.id !== event.pointerId) return
        const dx = event.clientX - drag.x
        setDrag(null)
        if (dx <= -SWIPE_PX) onSwipe('next')
        else if (dx >= SWIPE_PX) onSwipe('prev')
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {cards.length === 0 ? (
        <p className="phone-empty" data-testid="phone-empty">
          {tab === 'contracts' ? 'No signed contracts yet.' : 'No messages.'}
        </p>
      ) : (
        cards.map((card) => (
          <PhoneCardView key={card.id} card={card} fresh={card.key === flashKey} onAction={onAction} />
        ))
      )}
    </div>
  )
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'contract':
    case 'offer':
      return 'Contract'
    case 'layover-live':
      return 'Layover live'
    case 'mx-signed':
      return 'Line maintenance'
    case 'hub-signed':
      return 'Hub'
    case 'signed':
      return 'Signed'
    case 'cargo':
      return 'Volume'
    case 'warn':
      return 'Relations'
    case 'advisor':
      return 'Advisor'
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1)
  }
}

function PhoneCardView({
  card,
  fresh,
  onAction,
}: {
  card: PhoneCard
  fresh: boolean
  onAction: (action: PhoneAction) => void
}) {
  return (
    <article
      className={`phone-card tone-${card.tone}${fresh ? ' is-fresh' : ''}`}
      data-testid={`phone-card-${card.id}`}
    >
      <header>
        <span className="phone-kind">{kindLabel(card.kind)}</span>
        <span className="phone-from">{card.from}</span>
        {card.left ? (
          <LiveText className="phone-timer" read={() => `${Math.ceil(card.left?.() ?? 0)}s`} />
        ) : card.secondsLeft != null ? (
          <span className="phone-timer">{Math.ceil(card.secondsLeft)}s</span>
        ) : (
          <span className="phone-timer">Note</span>
        )}
      </header>
      <h3>{card.title}</h3>
      {card.body.split('\n').map((line) => (
        <p key={line}>{line}</p>
      ))}
      {card.lines?.length ? (
        <ul className="phone-lines">
          {card.lines.map((line) => (
            <li key={line.label} data-met={line.met == null ? undefined : line.met ? '1' : '0'}>
              {line.label}
            </li>
          ))}
        </ul>
      ) : null}
      {card.actions.length ? (
        <div className="phone-actions">
          {card.actions.map((button) => (
            <button
              key={button.id}
              type="button"
              className={button.primary ? 'primary' : ''}
              disabled={button.disabled}
              data-testid={`phone-action-${card.id}-${button.id}`}
              onClick={() => onAction(button.action)}
            >
              {button.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}
