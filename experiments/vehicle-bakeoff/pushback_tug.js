/**
 * Conventional pushback tug, hitch at the front. Real metres, wheels on y = 0.
 */
import { Mesh, TorusGeometry, BoxGeometry } from 'three';
import { Rig, MAT, C, drawJetTug } from './lib/kit.js';

export function createPushbackTug() {
  const rig = new Rig('pushback_tug');
  const wheelR = 0.72;
  const frontAxle = 1.45;
  const rearAxle = -1.85;
  const track = 1.05;
  const tyreW = 0.42;

  rig.axle(frontAxle, track, wheelR, tyreW, { fancy: true });
  rig.axle(rearAxle, track, wheelR, tyreW, { fancy: true });

  // Lower hull is narrower than the tyres so the wheels stay fully visible.
  const hullW = 1.85;
  rig.rbox(3.15, 0.72, hullW, -0.15, 1.22, 0, MAT.white, 0.08, 3);
  rig.rbox(1.55, 0.55, hullW * 0.92, 2.15, 1.05, 0, MAT.white, 0.06, 2);
  rig.rbox(1.35, 0.62, hullW * 0.95, -2.85, 1.18, 0, MAT.white, 0.06, 2);

  // Gray cab greenhouse over the front wheel, clear of the tyre crown.
  const cabX = 1.15;
  const cabY = 1.95;
  rig.rbox(2.05, 1.05, 1.7, cabX, cabY, 0, MAT.grayMid, 0.08, 3);
  rig.face(0.08, 0.72, cabX + 0.95, cabY + 0.02, 0, MAT.glass, '+x');
  rig.face(1.15, 0.62, cabX + 0.1, cabY + 0.05, -0.88, MAT.glass, '-z');
  rig.face(1.15, 0.62, cabX + 0.1, cabY + 0.05, 0.88, MAT.glass, '+z');
  rig.box(0.04, 0.7, 0.04, cabX + 0.55, cabY + 0.02, -0.9, MAT.grayDark, { shadow: false });

  // Rear cowl.
  rig.rbox(2.4, 0.38, 1.72, -1.35, 1.62, 0, MAT.grayMid, 0.06, 2);
  rig.rbox(0.7, 0.22, 0.9, -2.7, 1.58, 0, MAT.grayDark, 0.04, 2);

  // Front hitch and bumper. Capacity plate is on the hero side, as in the reference.
  rig.rbox(0.7, 0.42, 1.45, 3.05, 0.78, 0, MAT.white, 0.05, 2);
  rig.rbox(0.28, 0.16, 0.55, 3.4, 0.72, 0, MAT.steel, 0.03, 2);
  const pin = new Mesh(new TorusGeometry(0.1, 0.02, 8, 14), MAT.steelDark);
  pin.rotation.y = Math.PI / 2;
  pin.position.set(3.52, 0.72, 0);
  rig.add(pin);
  rig.cyl(0.035, 0.22, 3.52, 0.72, 0, MAT.steel, 'z', 8);
  rig.text(0.55, 0.22, 2.85, 0.72, -0.76, [
    { t: 'MAX', size: 36, weight: 800, color: C.red },
    { t: 'CAPACITY 120T', size: 32, weight: 800, color: C.red },
  ]);
  rig.text(0.4, 0.08, 3.15, 1.05, -0.7, [
    { t: 'TOW POINT', size: 32, weight: 700, color: C.muted, font: 'Arial, sans-serif' },
  ]);

  // Hero-side identity.
  const z = -hullW / 2 - 0.02;
  rig.text(1.7, 0.22, -1.2, 1.48, z, [
    { t: 'PUSHBACK TUG 04', size: 64, weight: 800, color: '#2c333a', tracking: 1 },
  ]);
  rig.decal(1.15, 0.32, -1.15, 1.18, z - 0.005, drawJetTug, 520, 160);
  rig.text(0.7, 0.12, cabX - 0.15, 1.45, -0.9, [
    { t: 'AIRPORT SERVICES', size: 36, weight: 700, color: '#2a3138', font: 'Arial, sans-serif' },
  ]);
  rig.text(0.32, 0.08, 0.15, 1.05, z, [
    { t: 'NO STEP', size: 36, weight: 800, color: C.red },
  ]);
  rig.text(0.32, 0.08, -2.55, 1.02, z, [
    { t: 'NO STEP', size: 36, weight: 800, color: C.red },
  ]);

  // Steps into the cab, between the axles.
  rig.rbox(0.45, 0.1, 0.32, 0.35, 0.78, -0.95, MAT.gray, 0.02, 2);
  rig.rbox(0.38, 0.1, 0.28, 0.42, 1.0, -0.95, MAT.gray, 0.02, 2);
  rig.stripe(0.4, 0.04, 0.3, 0.35, 0.84, -0.95, 2);
  rig.box(0.04, 0.55, 0.04, 0.15, 1.15, -1.02, MAT.steel);

  // Hazard strips along the sills and the nose corners.
  rig.stripe(2.4, 0.1, 0.03, -0.2, 0.9, z + 0.01, 6);
  rig.stripe(1.1, 0.1, 0.03, 2.2, 0.82, -0.78, 3);
  rig.stripe(1.0, 0.1, 0.03, -2.8, 0.9, z + 0.01, 3);
  const chev = new Mesh(new BoxGeometry(0.5, 0.12, 0.03), MAT.yellow);
  chev.position.set(2.55, 0.95, -0.8);
  chev.rotation.y = 0.7;
  rig.add(chev);

  // Louvres, door handle, marker lamps, beacon.
  for (let i = 0; i < 5; i += 1) {
    rig.box(0.55, 0.018, 0.02, -1.7, 1.22 + i * 0.05, z - 0.005, MAT.grayDark, { shadow: false });
  }
  rig.box(0.1, 0.03, 0.02, cabX + 0.15, 1.35, -0.92, MAT.black, { shadow: false });
  rig.lamp(0.08, 0.06, 0.1, 3.2, 1.22, -0.7, MAT.amber);
  rig.lamp(0.08, 0.06, 0.1, -3.25, 1.4, -0.7, MAT.tail);
  rig.lamp(0.08, 0.06, 0.1, -3.25, 1.4, 0.7, MAT.tail);
  rig.beacon(cabX, cabY + 0.58, 0.15);
  rig.headPair(3.35, 0.95, 0.4, 0.16, 0.1);
  rig.tailPair(-3.4, 0.85, 0.55);

  // Far-side fleet name.
  rig.text(1.7, 0.22, -1.2, 1.48, hullW / 2 + 0.02, [
    { t: 'PUSHBACK TUG 04', size: 64, weight: 800, color: '#2c333a', tracking: 1 },
  ], '+z');

  return rig.group;
}
