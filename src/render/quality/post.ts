import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { QualityPreset } from '../world/quality'

/** Post stack knobs per level. Low/Med render straight to the canvas like before. */
export interface PostConfig {
  smaa: boolean
  /** MSAA samples on the offscreen target. SMAA already cleans edges, so only Ultra pays for both. */
  samples: number
}

export function postConfig(q: Pick<QualityPreset, 'level'>): PostConfig {
  if (q.level === 'ultra') return { smaa: true, samples: 4 }
  if (q.level === 'high') return { smaa: true, samples: 0 }
  return { smaa: false, samples: 0 }
}

/**
 * Render > SMAA > Output. The scene is drawn linear into a half-float target (no tone mapping),
 * SMAA runs on that, then OutputPass applies the renderer's ACES tone mapping + sRGB once.
 * The material colour grade injects before `tonemapping_fragment`, which three skips for
 * offscreen targets, so it still runs exactly once, before tone mapping, as on the direct path.
 */
export class PostStack {
  private composer: EffectComposer
  private smaa: SMAAPass
  private renderer: THREE.WebGLRenderer

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, cfg: PostConfig) {
    this.renderer = renderer
    // Several passes render per frame; count the whole frame, not just the last pass.
    renderer.info.autoReset = false
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: cfg.samples,
    })
    this.composer = new EffectComposer(renderer, target)
    this.composer.setPixelRatio(1)
    this.composer.setSize(size.x, size.y)
    this.composer.addPass(new RenderPass(scene, camera))
    this.smaa = new SMAAPass()
    this.smaa.enabled = cfg.smaa
    this.composer.addPass(this.smaa)
    this.composer.addPass(new OutputPass())
  }

  /** Call after renderer.setSize / pixel ratio changes. Sizes are drawing-buffer pixels. */
  resize(renderer: THREE.WebGLRenderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    this.composer.setSize(size.x, size.y)
  }

  render() {
    this.renderer.info.reset()
    this.composer.render()
  }

  dispose() {
    this.renderer.info.autoReset = true
    this.composer.dispose()
    this.smaa.dispose()
  }
}
