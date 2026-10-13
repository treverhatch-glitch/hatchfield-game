// Lambert material patched for per-instance colours + procedural walk/sit/work poses on the GPU.
import * as THREE from 'three'
import { HIP_Y, SHOULDER_Y } from './geometry'

export function createPeopleMaterial(time: { value: number }): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
attribute float aPart;
attribute vec4 iAnim;   // phase, cycles/sec, pose, armsUp
attribute vec3 iColA;   // top
attribute vec3 iColB;   // bottom
attribute vec3 iShape;  // width, height, skin tone 0..1
varying vec3 vPartCol;
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
void pose(inout vec3 p, inout vec3 n){
  float t = uTime * iAnim.y + iAnim.x;
  float s = sin(t * 6.2831853);
  float pz = iAnim.z;
  float leg = 0., arm = 0., lift = 0., bob = 0., legBase = 0., armBase = 0.;
  if (pz < 0.5) { leg = s * 0.55; arm = -s * 0.45; bob = abs(cos(t * 6.2831853)) * 0.04; }
  else if (pz < 1.5) { arm = s * 0.03; }
  else if (pz < 2.5) { leg = s * 0.07; arm = s * 0.04; }
  else if (pz < 3.5) { legBase = -1.5708; lift = -0.42; armBase = -0.5; }
  else { legBase = -1.5708; lift = -0.42; armBase = -1.0; arm = s * 0.18; }
  if (iAnim.w > 0.5) armBase = -0.35; // pulling a case / holding a bag
  float side = 1.0;
  if (aPart > 1.5 && aPart < 3.5) { // legs
    side = aPart < 2.5 ? 1. : -1.;
    mat3 r = rotX(legBase + leg * side);
    p = r * (p - vec3(0., ${HIP_Y.toFixed(2)}, 0.)) + vec3(0., ${HIP_Y.toFixed(2)}, 0.);
    n = r * n;
  } else if (aPart > 3.5 && aPart < 5.5) { // arms
    side = aPart < 4.5 ? 1. : -1.;
    float a = armBase + arm * side;
    if (pz > 3.5) a = armBase + arm * side; // typing alternates
    mat3 r = rotX(a);
    p = r * (p - vec3(0., ${SHOULDER_Y.toFixed(2)}, 0.)) + vec3(0., ${SHOULDER_Y.toFixed(2)}, 0.);
    n = r * n;
  }
  p.y += lift + bob;
  p.x *= iShape.x; p.z *= mix(1.0, iShape.x, 0.6); p.y *= iShape.y;
  vec3 skin = mix(vec3(0.96,0.80,0.66), vec3(0.36,0.23,0.15), iShape.z);
  vPartCol = (aPart < 0.5 || (aPart > 3.5 && aPart < 5.5)) ? iColA : (aPart > 1.5 && aPart < 3.5) ? iColB : skin;
}`)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif
vec3 posePos = position; pose(posePos, objectNormal);`)
      .replace('#include <begin_vertex>', 'vec3 transformed = posePos;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPartCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vPartCol;')
  }
  m.customProgramCacheKey = () => 'hatchfield-people-v1'
  return m
}
