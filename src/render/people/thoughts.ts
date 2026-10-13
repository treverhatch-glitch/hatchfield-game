// Thought-bubble sprites: icon (emoji or short glyph) + text, e.g. 🍔 "wish they had burgers".
import * as THREE from 'three'

export interface Thought { icon: string; text?: string; duration?: number }
const cache = new Map<string, THREE.Texture | null>()

function texture(t: Thought): { map: THREE.Texture | null; aspect: number } {
  const key = t.icon + '|' + (t.text ?? '')
  const W = 512, H = 160, aspect = t.text ? W / H : 1
  if (!cache.has(key)) {
    if (typeof document === 'undefined') cache.set(key, null)
    else {
      const c = document.createElement('canvas'); c.width = t.text ? W : H; c.height = H
      const g = c.getContext('2d')!
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = 'rgba(30,41,59,0.9)'; g.lineWidth = 6
      g.beginPath(); g.roundRect(6, 6, c.width - 12, H - 40, 50); g.fill(); g.stroke()
      g.beginPath(); g.arc(c.width / 2 - 20, H - 22, 12, 0, 7); g.fill(); g.stroke()
      g.beginPath(); g.arc(c.width / 2 - 34, H - 8, 6, 0, 7); g.fill(); g.stroke()
      g.font = '72px "Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textBaseline = 'middle'
      g.fillStyle = '#000'; g.fillText(t.icon, 22, (H - 34) / 2 + 4)
      if (t.text) { g.font = '600 34px system-ui,sans-serif'; g.fillStyle = '#1e293b'; g.fillText(t.text, 110, (H - 34) / 2 + 2, W - 130) }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; cache.set(key, tex)
    }
  }
  return { map: cache.get(key)!, aspect }
}

export class ThoughtLayer {
  readonly group = new THREE.Group()
  private live = new Map<string, { sprite: THREE.Sprite; until: number }>()
  constructor() { this.group.name = 'people-thoughts' }
  show(id: string, t: Thought, now: number): THREE.Sprite {
    this.hide(id)
    const { map, aspect } = texture(t)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }))
    sprite.scale.set(0.6 * aspect, 0.6, 1); sprite.renderOrder = 10
    sprite.userData = { agentId: id, thought: t }
    this.group.add(sprite)
    this.live.set(id, { sprite, until: now + (t.duration ?? 4) })
    return sprite
  }
  hide(id: string) { const e = this.live.get(id); if (e) { this.group.remove(e.sprite); e.sprite.material.dispose(); this.live.delete(id) } }
  /** place bubbles over agents; expire old ones */
  sync(now: number, posOf: (id: string) => THREE.Vector3 | undefined) {
    for (const [id, e] of this.live) {
      const p = posOf(id)
      if (!p || now > e.until) { this.hide(id); continue }
      e.sprite.position.set(p.x, p.y + 2.3, p.z)
    }
  }
  get count() { return this.live.size }
  dispose() { for (const id of [...this.live.keys()]) this.hide(id) }
}
