/**
 * Neutral studio framing for the bakeoff renders. 1024×768.
 */
import {
  Scene,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  ShadowMaterial,
  PlaneGeometry,
  Box3,
  Vector3,
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
} from 'three';

const BG = '#efefed';

export function frameOf(root) {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  return { box, size, center };
}

export function makeStudio(canvas) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(1024, 768, false);
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.background = new Color(BG);

  const ground = new Mesh(
    new PlaneGeometry(80, 80),
    new ShadowMaterial({ color: '#5c6166', opacity: 0.38 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  ground.castShadow = false;
  scene.add(ground);

  const camera = new PerspectiveCamera(26, 1024 / 768, 0.05, 200);
  return { renderer, scene, camera, ground };
}

export function lightStudio(scene, center, size) {
  const amb = new AmbientLight(0xffffff, 0.42);
  const hemi = new HemisphereLight(0xffffff, 0xd5d8d4, 0.55);
  const ext = Math.max(size.x, size.y, size.z, 4);
  const key = new DirectionalLight(0xfff8f0, 2.55);
  key.position.set(center.x + ext * 0.85, center.y + ext * 2.1, center.z - ext * 1.35);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00018;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  const d = ext * 1.3;
  key.shadow.camera.left = -d;
  key.shadow.camera.right = d;
  key.shadow.camera.top = d;
  key.shadow.camera.bottom = -d;
  key.shadow.camera.near = 0.2;
  key.shadow.camera.far = ext * 8;
  key.target.position.copy(center);
  const fill = new DirectionalLight(0xe7eef8, 0.75);
  fill.position.set(center.x - ext, center.y + ext * 0.6, center.z + ext);
  const rim = new DirectionalLight(0xffffff, 0.35);
  rim.position.set(center.x - ext * 0.4, center.y + ext, center.z - ext * 0.2);
  scene.add(amb, hemi, key, key.target, fill, rim);
}

function cornersOf(center, size) {
  const pts = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        pts.push(new Vector3(
          center.x + x * size.x / 2,
          center.y + y * size.y / 2,
          center.z + z * size.z / 2,
        ));
      }
    }
  }
  return pts;
}

/** Distance along `dir` that fits every point inside the frame with `pad` NDC margin. */
function fitDist(camera, target, dir, points, pad) {
  let lo = 0.4;
  let hi = 80;
  const ndc = new Vector3();
  for (let i = 0; i < 18; i += 1) {
    const dist = (lo + hi) / 2;
    camera.position.copy(target).add(dir.clone().multiplyScalar(dist));
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    let fits = true;
    for (const p of points) {
      ndc.copy(p).project(camera);
      if (Math.abs(ndc.x) > 1 - pad || Math.abs(ndc.y) > 1 - pad || ndc.z < -1 || ndc.z > 1) {
        fits = false;
        break;
      }
    }
    if (fits) hi = dist;
    else lo = dist;
  }
  return hi;
}

export function frameCamera(camera, center, size, mode) {
  const fov = 26;
  camera.fov = fov;
  camera.updateProjectionMatrix();
  const target = new Vector3(center.x, center.y * 0.92, center.z);
  const points = cornersOf(center, size);
  // A point just under the vehicle keeps a little floor in frame for the contact shadow.
  points.push(new Vector3(center.x, -0.02, center.z));

  if (mode === 'side') {
    const dir = new Vector3(0, 0.04, -1).normalize();
    const dist = fitDist(camera, target, dir, points, 0.14);
    camera.position.copy(target).add(dir.clone().multiplyScalar(dist));
    camera.lookAt(target);
  } else {
    const dir = new Vector3(0.92, 0.4, -1.08).normalize();
    const dist = fitDist(camera, target, dir, points, 0.1);
    camera.position.copy(target).add(dir.clone().multiplyScalar(dist));
    camera.lookAt(target);
  }
  camera.updateProjectionMatrix();
}
