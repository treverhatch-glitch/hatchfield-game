/**
 * Airport belt loader. Open cab at the front, conveyor rising toward the rear.
 * Real metres, front +X, wheels on y = 0.
 */
import { Group, Mesh, BoxGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Rig, MAT, C } from './lib/kit.js';

export function createBeltLoader() {
  const rig = new Rig('belt_loader');
  const wheelR = 0.4;
  const frontAxle = 2.45;
  const rearAxle = -1.05;
  const track = 0.92;

  rig.axle(frontAxle, track, wheelR, 0.26, { fancy: true });
  rig.axle(rearAxle, track, wheelR, 0.28, { fancy: true });

  // Low chassis and the white side body the belt sits on.
  rig.rbox(6.4, 0.22, 1.55, 0.15, 0.58, 0, MAT.chassis, 0.04, 2);
  rig.stripe(5.8, 0.1, 1.58, 0.1, 0.46, 0, 12);
  rig.rbox(2.15, 0.85, 1.72, 1.15, 1.05, 0, MAT.white, 0.06, 3);
  rig.rbox(0.9, 0.35, 1.74, 2.35, 0.78, 0, MAT.white, 0.05, 2);

  rig.text(1.55, 0.28, 1.15, 1.15, -0.9, [
    { t: 'AIRPORT', size: 54, weight: 800, color: '#8b939b', tracking: 3 },
    { t: 'GROUND SERVICES', size: 48, weight: 700, color: '#8b939b', tracking: 1 },
  ]);
  rig.text(0.7, 0.16, 1.7, 0.78, -0.9, [
    { t: 'MAX LOAD 500KG', size: 40, weight: 700, color: C.muted, font: 'Arial, sans-serif' },
  ]);
  rig.cyl(0.05, 0.03, 0.35, 1.05, -0.9, MAT.tail, 'z', 12, { shadow: false });

  // Open operator station.
  const roofY = 2.12;
  rig.rbox(1.7, 0.06, 1.45, 2.85, roofY, -0.05, MAT.white, 0.03, 2);
  for (const [px, pz] of [[3.55, -0.62], [3.55, 0.52], [2.15, -0.62], [2.15, 0.52]]) {
    rig.box(0.05, roofY - 0.85, 0.05, px, (roofY + 0.7) / 2, pz, MAT.white);
  }
  const wind = new Mesh(new BoxGeometry(0.03, 0.85, 1.15), MAT.glass);
  wind.position.set(3.62, 1.55, -0.05);
  wind.rotation.z = -0.12;
  rig.add(wind, { shadow: false });
  rig.rbox(0.42, 0.1, 0.42, 2.55, 1.05, -0.15, MAT.seat, 0.04, 2);
  rig.rbox(0.1, 0.48, 0.4, 2.32, 1.32, -0.15, MAT.seat, 0.03, 2);
  const wheel = new Mesh(new TorusGeometry(0.16, 0.016, 8, 16), MAT.black);
  wheel.rotation.y = 0.7;
  wheel.position.set(3.15, 1.28, -0.28);
  rig.add(wheel);
  rig.cyl(0.02, 0.28, 3.28, 1.12, -0.22, MAT.black, 'y', 8);
  rig.rbox(0.35, 0.08, 0.7, 3.35, 1.05, -0.05, MAT.grayDark, 0.02, 2);
  rig.lamp(0.06, 0.1, 0.16, 3.72, 0.85, -0.45, MAT.head);
  rig.lamp(0.06, 0.1, 0.16, 3.72, 0.85, 0.35, MAT.head);
  rig.mirror(3.4, 1.85, -0.7, -1);
  rig.stripe(0.12, 0.16, 1.5, 3.78, 0.55, 0, 3);

  // Conveyor boom, pivoted at the front (low) end and rising toward -X.
  const boom = new Group();
  const len = 5.55;
  const beltW = 0.72;
  const frame = new Mesh(new RoundedBoxGeometry(len, 0.16, 0.98, 2, 0.04), MAT.white);
  frame.position.set(-len / 2, 0, 0);
  boom.add(frame);
  frame.castShadow = true;
  frame.receiveShadow = true;

  const belt = new Mesh(new BoxGeometry(len * 0.96, 0.05, beltW), MAT.black);
  belt.position.set(-len / 2, 0.09, 0);
  belt.castShadow = true;
  boom.add(belt);

  for (const s of [-1, 1]) {
    const rail = new Mesh(new BoxGeometry(len * 0.98, 0.22, 0.06), MAT.white);
    rail.position.set(-len / 2, 0.2, s * 0.48);
    rail.castShadow = true;
    boom.add(rail);
    const tape = new Mesh(new BoxGeometry(len * 0.96, 0.045, 0.02), MAT.yellow);
    tape.position.set(-len / 2, 0.32, s * 0.5);
    boom.add(tape);
  }

  // Head and tail rollers, plus a few idlers. Caps face ±Z.
  for (const fx of [0.08, 0.92]) {
    const roller = new Mesh(new CylinderGeometry(0.07, 0.07, beltW + 0.04, 14), MAT.steel);
    roller.rotateX(Math.PI / 2);
    roller.position.set(-len * fx, 0.08, 0);
    roller.castShadow = true;
    boom.add(roller);
  }
  for (let i = 1; i <= 4; i += 1) {
    const idler = new Mesh(new CylinderGeometry(0.04, 0.04, beltW, 10), MAT.steelDark);
    idler.rotateX(Math.PI / 2);
    idler.position.set(-len * (i / 5), -0.02, 0);
    boom.add(idler);
  }

  const rise = 0.82;
  const angle = Math.atan2(rise, len);
  boom.position.set(1.45, 1.12, 0);
  boom.rotation.z = -angle;
  rig.group.add(boom);

  // Labels sit in boom space so they follow the incline. Hero side is -Z.
  const keep = new Mesh(new BoxGeometry(0.7, 0.1, 0.012), MAT.yellow);
  keep.position.set(-len * 0.72, 0.2, -0.52);
  boom.add(keep);
  rig.text(0.95, 0.12, 0, 0, 0, [
    { t: 'KEEP CLEAR', size: 48, weight: 800, color: '#1a1a1a' },
  ]);
  // The text() call above landed on the root group at the origin. Move it onto the rail.
  const keepLabel = rig.group.children[rig.group.children.length - 1];
  rig.group.remove(keepLabel);
  keepLabel.position.set(-len * 0.72, 0.34, -0.53);
  boom.add(keepLabel);

  const warn = rig.text(1.5, 0.12, 0, 0, 0, [
    { t: 'WARNING  MOVING BELT', size: 42, weight: 800, color: '#1a1a1a' },
  ]);
  rig.group.remove(warn);
  warn.position.set(-len * 0.38, 0.34, -0.53);
  boom.add(warn);

  // Lift ram from the chassis up to the boom.
  const ramLen = 1.15;
  const ram = new Mesh(new CylinderGeometry(0.05, 0.05, ramLen, 12), MAT.steel);
  ram.position.set(-0.4, 0.95, 0.15);
  ram.rotation.z = -0.55;
  rig.add(ram);
  rig.cyl(0.07, 0.08, -0.15, 0.72, 0.15, MAT.steelDark, 'z', 10);

  rig.lamp(0.05, 0.1, 0.16, -3.85, 0.7, -0.55, MAT.tail);
  rig.lamp(0.05, 0.1, 0.16, -3.85, 0.7, 0.55, MAT.tail);
  rig.stripe(0.1, 0.22, 1.4, -3.95, 0.85, 0, 3);

  return rig.group;
}
