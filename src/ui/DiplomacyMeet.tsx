import { useEffect, useRef, useState } from 'react'
import type { Game } from '../game/sim.ts'
import { PortraitFace } from './PortraitFace.tsx'

const LABEL = {
  formal: 'Formal',
  warm: 'Warm',
  bold: 'Bold',
  tour: 'Show them around',
} as const

/** Short intro the first time a named exec engages. Pauses the clock until a choice. */
export function DiplomacyMeet({ game, airlineId }: { game: Game; airlineId: string }) {
  const scene = game.diplomacyMeet(airlineId)
  const [touring, setTouring] = useState(false)
  const timer = useRef(0)

  useEffect(() => {
    const prev = game.speed
    // Fast-forward is the opt-out: a 5x clock keeps running. Normal speeds pause for the intro.
    if (prev > 0 && prev < 5) game.setSpeed(0)
    return () => {
      window.clearTimeout(timer.current)
      if (prev > 0 && prev < 5 && game.speed === 0) game.setSpeed(prev)
    }
  }, [airlineId, game])

  if (!scene) return null

  const choose = (choice: 'formal' | 'warm' | 'bold' | 'tour') => {
    if (touring) return
    if (choice === 'tour') {
      setTouring(true)
      game.beginDiplomacyTour(6)
      timer.current = window.setTimeout(() => {
        game.resolveDiplomacyMeet(airlineId, 'tour')
      }, 6000)
      return
    }
    game.resolveDiplomacyMeet(airlineId, choice)
  }

  return (
    <div data-testid="diplomacy-meet">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <PortraitFace card={scene.portrait} name={scene.name} />
        <div>
          <strong>{scene.name}</strong>
          <p className="muted">
            {scene.title}, {scene.airline}
          </p>
          <p className="muted">{scene.traits.join(' · ')}</p>
        </div>
      </div>
      {scene.greeting.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p>{scene.heard}</p>
      {touring ? (
        <p>Walking the terminal.</p>
      ) : (
        <div className="row letter-actions">
          {scene.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className={choice === 'formal' ? 'on' : ''}
              data-testid={`meet-${choice}`}
              onClick={() => choose(choice)}
            >
              {LABEL[choice]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
