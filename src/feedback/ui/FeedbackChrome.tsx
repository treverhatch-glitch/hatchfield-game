import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Celebration } from '../celebrations.ts'
import { burstConfetti, stepConfetti, type ConfettiPiece } from '../confetti.ts'
import { liveFeedback } from '../live.ts'
import type { FeedbackView } from '../session.ts'
import { formatPanelNumber } from '../../core/formatNumber.ts'
import type { GoalView } from '../milestones.ts'
import './feedback.css'

export function MilestoneStack({
  goals,
  paid,
}: {
  goals: readonly GoalView[]
  paid: FeedbackView['paid']
}) {
  return (
    <section className="feedback-stack" data-testid="milestone-stack" aria-label="Field goals">
      <h2>Goals</h2>
      {paid.map((line) => (
        <div key={line.id} className="feedback-paid" data-testid={`milestone-paid-${line.id}`}>
          {line.title} · {line.rewardText}
        </div>
      ))}
      {goals.length === 0 ? <p className="feedback-clear">Field goals are clear.</p> : null}
      {goals.map((goal) => (
        <article key={goal.id} className="feedback-goal" data-testid={`milestone-${goal.id}`} title={goal.detail}>
          <header>
            <strong>{goal.title}</strong>
            <span>
              {formatPanelNumber(Math.min(goal.value, goal.target))}/{formatPanelNumber(goal.target)}
            </span>
          </header>
          <div className="feedback-bar" data-testid={`milestone-bar-${goal.id}`}>
            <span style={{ width: `${Math.round(goal.ratio * 100)}%` }} />
          </div>
          <p className="feedback-reward">Reward {goal.rewardText}</p>
        </article>
      ))}
    </section>
  )
}

export function EffectToasts({ toasts }: { toasts: FeedbackView['toasts'] }) {
  if (toasts.length === 0) return null
  return (
    <div className="feedback-toasts" data-testid="effect-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="feedback-toast" data-testid="effect-toast">
          {toast.text}
        </div>
      ))}
    </div>
  )
}

export function CelebrationLayer({ celebration }: { celebration: Celebration | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pieces = useRef<ConfettiPiece[]>([])
  const seen = useRef('')

  useEffect(() => {
    if (!celebration || celebration.id === seen.current) return
    seen.current = celebration.id
    pieces.current = burstConfetti(undefined, celebration.seed)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = Math.max(1, width)
        canvas.height = Math.max(1, height)
      }
      pieces.current = stepConfetti(pieces.current, dt)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const piece of pieces.current) {
        ctx.save()
        ctx.translate(piece.x * canvas.width, piece.y * canvas.height)
        ctx.rotate(piece.rot)
        ctx.globalAlpha = Math.max(0, piece.life / piece.max)
        ctx.fillStyle = piece.color
        ctx.fillRect((-piece.w * canvas.width) / 2, (-piece.h * canvas.height) / 2, piece.w * canvas.width, piece.h * canvas.height)
        ctx.restore()
      }
      if (pieces.current.length > 0) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [celebration])

  if (!celebration) return null
  return (
    <>
      <canvas ref={canvasRef} className="feedback-confetti" data-testid="celebration-confetti" />
      <div className="feedback-banner" data-testid="celebration-banner" role="status">
        <strong>{celebration.title}</strong>
        <p>{celebration.detail}</p>
      </div>
    </>
  )
}

export function FeedbackChrome() {
  const view = useFeedbackView()
  return (
    <div className="feedback-layer" data-testid="feedback-layer">
      <MilestoneStack goals={view.goals} paid={view.paid} />
      <EffectToasts toasts={view.toasts} />
      <CelebrationLayer celebration={view.celebration} />
    </div>
  )
}

function useFeedbackView(): FeedbackView {
  return useSyncExternalStore(liveFeedback.subscribe, liveFeedback.getSnapshot, liveFeedback.getSnapshot)
}
