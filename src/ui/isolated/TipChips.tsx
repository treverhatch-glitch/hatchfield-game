import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { Game } from '../../game/sim.ts'
import type { TipOffer } from '../../game/tips.ts'
import { subscribeTipPoints, tipPoint } from '../tipScreen.ts'

/**
 * Small dismissible chips for stuck states. The sim decides which exist.
 * This file only places them near the cash readout, the build tray, or the
 * apron cell the note is about. They are not the phone and not the alert stack.
 */
interface AnchorBoxes {
  root: DOMRect | null
  cash: DOMRect | null
  build: DOMRect | null
}

export function TipChips({ game }: { game: Game }) {
  useSyncExternalStore(subscribeTipPoints, tipRev, () => 0)
  const tips = game.visibleTips()
  const root = useRef<HTMLDivElement>(null)
  const [boxes, setBoxes] = useState<AnchorBoxes>({ root: null, cash: null, build: null })
  const open = tips.map((t) => t.id).join('|')
  useLayoutEffect(() => {
    if (!open) return
    const read = () => {
      const host = root.current
      setBoxes({
        root: host ? host.getBoundingClientRect() : null,
        cash: document.querySelector('[data-testid="cash-hero"]')?.getBoundingClientRect() ?? null,
        build: document.querySelector('[data-testid="build-tray"]')?.getBoundingClientRect() ?? null,
      })
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [open])
  if (!tips.length) return null
  return (
    <div ref={root} data-testid="tip-chips" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {tips.map((tip) => (
        <Chip key={tip.id} game={game} tip={tip} boxes={boxes} />
      ))}
    </div>
  )
}

function tipRev(): number {
  return pointsRev
}

let pointsRev = 0
subscribeTipPoints(() => {
  pointsRev += 1
})

function Chip({ game, tip, boxes }: { game: Game; tip: TipOffer; boxes: AnchorBoxes }) {
  const style = place(tip, boxes)
  return (
    <div data-testid={`tip-chip-${tip.id}`} style={style}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <strong style={{ font: '700 12px sans-serif' }}>{tip.title}</strong>
        <button
          type="button"
          data-testid={`tip-dismiss-${tip.id}`}
          title="Dismiss"
          onClick={() => game.dismissTip(tip.id)}
          style={dismissBtn}
        >
          ×
        </button>
      </span>
      <span style={{ display: 'block', marginTop: 2, opacity: 0.9 }}>{tip.text}</span>
    </div>
  )
}

const chipBase: CSSProperties = {
  pointerEvents: 'auto',
  position: 'absolute',
  width: 220,
  background: 'rgba(18, 32, 28, 0.94)',
  color: '#e7eee9',
  border: '1px solid #d7b56a',
  borderRadius: 999,
  padding: '6px 10px 7px',
  font: '12px sans-serif',
  boxShadow: '0 6px 16px rgba(0,0,0,0.28)',
  zIndex: 5,
}

const dismissBtn: CSSProperties = {
  background: 'transparent',
  color: '#e7eee9',
  border: 0,
  padding: 0,
  font: '700 14px sans-serif',
  lineHeight: 1,
  cursor: 'pointer',
}

function place(tip: TipOffer, boxes: AnchorBoxes): CSSProperties {
  if (tip.anchor.kind === 'hud' && tip.anchor.slot === 'cash') {
    return hudPlace(boxes, 'cash')
  }
  if (tip.anchor.kind === 'hud') {
    return hudPlace(boxes, 'build')
  }
  const pt = tipPoint(tip.id)
  if (!pt || !pt.on) {
    return { ...chipBase, top: 96, left: 276, borderRadius: 10 }
  }
  const left = Math.min(86, Math.max(14, pt.x * 100))
  const top = Math.min(78, Math.max(16, pt.y * 100))
  return {
    ...chipBase,
    left: `${left}%`,
    top: `${top}%`,
    transform: 'translate(-50%, calc(-100% - 10px))',
    borderRadius: 10,
  }
}

/** Sit under the cash readout, or just above the build tray. */
function hudPlace(boxes: AnchorBoxes, slot: 'cash' | 'build'): CSSProperties {
  const host = boxes.root
  const target = slot === 'cash' ? boxes.cash : boxes.build
  if (!host || !target || host.width < 1) {
    return slot === 'cash'
      ? { ...chipBase, top: 52, right: 12, borderRadius: 10 }
      : { ...chipBase, bottom: 108, left: '50%', transform: 'translateX(-50%)', borderRadius: 10 }
  }
  const width = 220
  if (slot === 'cash') {
    const left = clamp(target.right - host.left - width, 8, host.width - width - 8)
    const top = target.bottom - host.top + 8
    return { ...chipBase, left, top, borderRadius: 10 }
  }
  const left = clamp(target.left - host.left + target.width / 2 - width / 2, 8, host.width - width - 8)
  const top = Math.max(8, target.top - host.top - 78)
  return { ...chipBase, left, top, borderRadius: 10 }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
