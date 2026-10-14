/**
 * Colour grade inside the existing material shader (no extra pass).
 * Medium and High opt in. Low leaves materials alone so SwiftShader stays
 * on the heavy-airport frame budget.
 */
import * as THREE from 'three'
import { GRADE_LOOK } from './look'

const GRADE_GLSL = /* glsl */ `
vec3 hatchGrade(vec3 c) {
  c = max(c, vec3(0.0));
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, ${GRADE_LOOK.saturation.toFixed(4)});
  c = (c - 0.5) * ${GRADE_LOOK.contrast.toFixed(4)} + 0.5;
  c += ${GRADE_LOOK.lift.toFixed(4)} * exp(-max(c, vec3(0.0)) * 5.0);
  c *= vec3(${GRADE_LOOK.warmR.toFixed(4)}, 1.0, ${GRADE_LOOK.warmB.toFixed(4)});
  return clamp(c, vec3(0.0), vec3(1.0));
}
`

/** Insert the grade between tone mapping and the sRGB encode. Idempotent. */
export function gradeMaterial(mat: THREE.Material): void {
  if (mat.userData.graded || mat.userData.noGrade) return
  const kind = mat as THREE.MeshLambertMaterial
  if (!kind.isMeshLambertMaterial && !(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return
  mat.userData.graded = true
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer)
    const needle = '#include <tonemapping_fragment>'
    if (!shader.fragmentShader.includes(needle) || shader.fragmentShader.includes('hatchGrade')) return
    // The helper has to sit outside main(). The include itself is inside main().
    shader.fragmentShader =
      `${GRADE_GLSL}\n` +
      shader.fragmentShader.replace(needle, `${needle}\ngl_FragColor.rgb = hatchGrade(gl_FragColor.rgb);`)
  }
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => `${prevKey()}|hatch-grade`
}

export function gradeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (!mat) return
    if (Array.isArray(mat)) for (const m of mat) gradeMaterial(m)
    else gradeMaterial(mat)
  })
}
