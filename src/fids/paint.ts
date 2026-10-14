import { BOARD_H, BOARD_W, COLUMNS, SIGN_H, SIGN_W } from './config'
import { nextGlyphs, type FlapRowState } from './flap'
import type { WayfindingSign } from './signs'

/** The canvas calls the board and the signs actually use. Tests pass a recorder. */
export interface FlapCanvas {
  fillStyle: string
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  save(): void
  restore(): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
  rect(x: number, y: number, w: number, h: number): void
  clip(): void
}

export interface BoardPaint {
  title: string
  clock: string
  rows: FlapRowState[]
}

const INK = '#f6e7a8'
const LEAF = '#121814'
const HEADER = '#f2c14a'

function statusInk(target: string): string {
  const word = target.trim()
  if (word === 'DELAYED') return '#ffb000'
  if (word === 'DEPARTED') return '#8fd3ff'
  if (word === 'BOARDING') return '#7dcea0'
  return INK
}

function leaf(ctx: FlapCanvas, ch: string, x: number, y: number, w: number, h: number, ink: string, dy: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = ink
  ctx.font = `700 ${Math.max(12, Math.floor(h * 1.15))}px ui-monospace, "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch === ' ' ? '' : ch, x + w / 2, y + h / 2 + dy)
  ctx.restore()
}

function flapChar(ctx: FlapCanvas, shown: string, next: string, anim: number, x: number, y: number, w: number, h: number, ink: string) {
  const gap = Math.max(2, Math.floor(w * 0.08))
  const bw = w - gap
  const bh = h
  ctx.fillStyle = LEAF
  ctx.fillRect(x, y, bw, bh)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(x, y, bw, bh / 2)
  if (anim <= 0 || shown === next) {
    leaf(ctx, shown, x, y, bw, bh, ink, 0)
  } else {
    const shift = anim * (bh / 2)
    leaf(ctx, shown, x, y, bw, bh / 2, ink, -shift)
    leaf(ctx, next, x, y + bh / 2, bw, bh / 2, ink, bh / 2 - shift)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(x, y + bh / 2 - 1, bw, 2)
}

/** Draw one split-flap board into a canvas context at `BOARD_W` × `BOARD_H`. */
export function paintBoard(ctx: FlapCanvas, paint: BoardPaint, width = BOARD_W, height = BOARD_H) {
  ctx.fillStyle = '#07140f'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = HEADER
  ctx.fillRect(0, 0, width, 118)
  ctx.fillStyle = '#14241c'
  ctx.font = '700 64px ui-sans-serif, Helvetica, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(paint.title, 40, 60)
  ctx.textAlign = 'right'
  ctx.fillText(paint.clock || '--:--', width - 40, 60)

  const margin = 28
  const gap = 18
  const units = COLUMNS.reduce((sum, col) => sum + col.width, 0)
  const unit = (width - margin * 2 - gap * (COLUMNS.length - 1)) / units
  const headerY = 168
  ctx.font = '700 28px ui-sans-serif, Helvetica, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#8fb4a4'
  let cursor = margin
  for (const col of COLUMNS) {
    ctx.fillText(col.label, cursor, headerY)
    cursor += unit * col.width + gap
  }

  const rowTop = 210
  const rowH = Math.floor((height - rowTop - 24) / Math.max(1, paint.rows.length || 8))
  const glyphH = Math.min(78, rowH - 10)
  paint.rows.forEach((row, r) => {
    const y = rowTop + r * rowH
    ctx.fillStyle = r % 2 === 0 ? '#0c1c16' : '#10261d'
    ctx.fillRect(16, y, width - 32, rowH - 6)
    let x = margin
    for (const col of COLUMNS) {
      const cell = row.cells[col.key]
      const ink = col.key === 'status' ? statusInk(cell.target) : INK
      const next = cell.anim > 0 ? nextGlyphs(cell.shown, cell.target) : cell.shown
      const gw = unit
      for (let i = 0; i < cell.shown.length; i++) {
        flapChar(ctx, cell.shown[i] ?? ' ', next[i] ?? ' ', cell.anim, x + i * gw, y + 6, gw, glyphH, ink)
      }
      x += unit * col.width + gap
    }
  })
}

function arrow(ctx: FlapCanvas, x: number, y: number, dir: WayfindingSign['arrow'], size: number) {
  ctx.beginPath()
  if (dir === 'up') {
    ctx.moveTo(x, y - size)
    ctx.lineTo(x + size * 0.85, y + size * 0.15)
    ctx.lineTo(x + size * 0.32, y + size * 0.15)
    ctx.lineTo(x + size * 0.32, y + size)
    ctx.lineTo(x - size * 0.32, y + size)
    ctx.lineTo(x - size * 0.32, y + size * 0.15)
    ctx.lineTo(x - size * 0.85, y + size * 0.15)
  } else if (dir === 'right') {
    ctx.moveTo(x + size, y)
    ctx.lineTo(x - size * 0.15, y - size * 0.85)
    ctx.lineTo(x - size * 0.15, y - size * 0.32)
    ctx.lineTo(x - size, y - size * 0.32)
    ctx.lineTo(x - size, y + size * 0.32)
    ctx.lineTo(x - size * 0.15, y + size * 0.32)
    ctx.lineTo(x - size * 0.15, y + size * 0.85)
  } else {
    ctx.moveTo(x - size, y)
    ctx.lineTo(x + size * 0.15, y - size * 0.85)
    ctx.lineTo(x + size * 0.15, y - size * 0.32)
    ctx.lineTo(x + size, y - size * 0.32)
    ctx.lineTo(x + size, y + size * 0.32)
    ctx.lineTo(x + size * 0.15, y + size * 0.32)
    ctx.lineTo(x + size * 0.15, y + size * 0.85)
  }
  ctx.closePath()
  ctx.fill()
}

/** Draw one wayfinding sign. Entirely procedural: panels, type, and an arrow. */
export function paintWayfinding(ctx: FlapCanvas, sign: WayfindingSign, airportName: string, width = SIGN_W, height = SIGN_H) {
  ctx.fillStyle = '#0e2230'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = sign.accent
  ctx.fillRect(0, 0, width, 28)
  ctx.fillRect(0, height - 28, width, 28)
  ctx.fillRect(0, 0, 28, height)
  ctx.fillStyle = '#f4f7fb'
  arrow(ctx, 220, height * 0.58, sign.arrow, 150)
  ctx.fillStyle = '#f4f7fb'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = '800 168px ui-sans-serif, Helvetica, Arial, sans-serif'
  ctx.fillText(sign.title, 420, height * 0.42)
  ctx.fillStyle = sign.accent
  ctx.font = '700 84px ui-sans-serif, Helvetica, Arial, sans-serif'
  ctx.fillText(sign.hint, 420, height * 0.68)
  ctx.fillStyle = '#c5d4e0'
  ctx.font = '600 42px ui-sans-serif, Helvetica, Arial, sans-serif'
  ctx.fillText(airportName.toUpperCase(), 420, height * 0.86)
}

export const BOARD_TEXTURE = { w: BOARD_W, h: BOARD_H }
export const SIGN_TEXTURE = { w: SIGN_W, h: SIGN_H }
