/** A small JPEG of the apron, for a named save. Null when the canvas cannot be read. */

const MAX_CHARS = 80_000

export function captureFieldThumb(): string | undefined {
  if (typeof document === 'undefined') return
  const canvas = document.querySelector('canvas.field')
  if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 2 || canvas.height < 2) return
  const shot = document.createElement('canvas')
  shot.width = 280
  shot.height = 158
  const ctx = shot.getContext('2d')
  if (!ctx) return
  try {
    ctx.drawImage(canvas, 0, 0, shot.width, shot.height)
    const url = shot.toDataURL('image/jpeg', 0.62)
    if (!url.startsWith('data:image/jpeg') || url.length > MAX_CHARS) return
    return url
  } catch {
    return
  }
}
