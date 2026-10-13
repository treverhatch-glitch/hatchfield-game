/** `hatchfield-20261013-130000.png` from a local clock. */
export function pngName(when: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `hatchfield-${when.getFullYear()}${p(when.getMonth() + 1)}${p(when.getDate())}-${p(when.getHours())}${p(when.getMinutes())}${p(when.getSeconds())}.png`
}

/** Read a PNG data URL off a canvas. Null when the buffer cannot be read. */
export function canvasToPng(canvas: HTMLCanvasElement): string | null {
  try {
    const url = canvas.toDataURL('image/png')
    if (!url.startsWith('data:image/png')) return null
    return url
  } catch {
    return null
  }
}

/** Trigger a browser download. Tests pass a stand-in document. */
export function savePng(dataUrl: string, filename: string, doc: Document = document): void {
  const a = doc.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.rel = 'noopener'
  doc.body.appendChild(a)
  a.click()
  a.remove()
}
