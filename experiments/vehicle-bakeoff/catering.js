/**
 * Sky Chefs high-lift catering truck, body raised on the scissor.
 * Real metres, front +X, wheels on y = 0.
 */
import { Mesh, BoxGeometry } from 'three';
import { Rig, MAT, C, cabProfile, drawSkyChefs } from './lib/kit.js';

export function createCatering() {
  const rig = new Rig('catering');
  const half = 5.05;
  const wheelR = 0.46;
  const frontAxle = 3.55;
  const rearAxle = -2.7;
  const track = 1.16;

  rig.axle(frontAxle, track, wheelR, 0.3, { fancy: true });
  rig.axle(rearAxle, track, wheelR, 0.32, { fancy: true });

  const railY = 0.68;
  rig.rbox(8.8, 0.18, 0.14, -0.35, railY, 0.78, MAT.chassis, 0.03, 2);
  rig.rbox(8.8, 0.18, 0.14, -0.35, railY, -0.78, MAT.chassis, 0.03, 2);
  rig.rbox(8.4, 0.12, 1.15, -0.35, railY + 0.02, 0, MAT.chassis, 0.04, 2);
  rig.stripe(8.2, 0.14, 0.04, -0.3, 0.5, -1.12, 16);
  rig.stripe(8.2, 0.14, 0.04, -0.3, 0.5, 1.12, 16);

  const cabL = 2.05;
  const cabH = 1.85;
  const cabW = 2.12;
  const cabBase = 0.88;
  const cabX = half - 0.16 - cabL / 2;
  rig.profile(cabProfile(cabL, cabH), cabW, cabX, cabBase, 0, MAT.cab, 0.042);

  const dx = -cabL * 0.26;
  const dy = cabH * 0.56;
  const slope = Math.hypot(dx, dy);
  const glass = new Mesh(new BoxGeometry(0.02, slope * 0.76, cabW * 0.76), MAT.glass);
  glass.rotation.z = Math.atan2(-dx, dy);
  const nx = dy / slope;
  const ny = -dx / slope;
  glass.position.set(
    cabX + cabL / 2 - cabL * 0.13 + nx * 0.05,
    cabBase + cabH * 0.7 + ny * 0.05,
    0,
  );
  rig.add(glass, { shadow: false });
  rig.face(0.7, 0.46, cabX + 0.08, cabBase + cabH * 0.68, -cabW / 2 - 0.02, MAT.glass, '-z');
  rig.face(0.7, 0.46, cabX + 0.08, cabBase + cabH * 0.68, cabW / 2 + 0.02, MAT.glass, '+z');
  rig.rbox(0.14, 0.2, cabW * 0.9, cabX + cabL / 2 + 0.04, cabBase + 0.14, 0, MAT.chassis, 0.04, 2);
  rig.headPair(cabX + cabL / 2 + 0.05, cabBase + 0.4, 0.58);
  rig.mirror(cabX + cabL / 2 - 0.28, cabBase + cabH * 0.76, cabW / 2 - 0.04, 1);
  rig.mirror(cabX + cabL / 2 - 0.28, cabBase + cabH * 0.76, -cabW / 2 + 0.04, -1);
  rig.text(0.85, 0.16, cabX + 0.05, cabBase + 1.15, -cabW / 2 - 0.03, [
    { t: 'AIRPORT SERVICES', size: 52, weight: 700, color: C.blue, font: 'Arial, sans-serif', tracking: 1 },
  ]);

  // Raised van body.
  const boxL = 6.75;
  const boxW = 2.4;
  const boxH = 2.18;
  const boxFloor = 1.5;
  const boxX = -1.15;
  const boxY = boxFloor + boxH / 2;
  rig.rbox(boxL, boxH, boxW, boxX, boxY, 0, MAT.white, 0.07, 3);
  rig.rbox(boxL + 0.02, 0.58, boxW + 0.03, boxX, boxFloor + 0.3, 0, MAT.skirt, 0.05, 2);
  rig.rbox(boxL * 0.55, 0.08, boxW * 0.55, boxX, boxFloor + boxH + 0.05, 0, MAT.gray, 0.03, 2);

  // Personnel door on the hero side, window, handle, e-stop.
  const doorX = boxX + 0.15;
  const doorZ = -boxW / 2 - 0.02;
  rig.rbox(0.92, 1.85, 0.06, doorX, boxFloor + 1.05, doorZ, MAT.cab, 0.04, 2);
  rig.face(0.46, 0.42, doorX, boxFloor + 1.45, doorZ - 0.04, MAT.glass, '-z');
  rig.box(0.04, 0.12, 0.03, doorX + 0.32, boxFloor + 1.1, doorZ - 0.02, MAT.steel, { shadow: false });
  rig.cyl(0.055, 0.03, doorX + 0.55, boxFloor + 0.55, doorZ - 0.02, MAT.tail, 'z', 14, { shadow: false });

  rig.decal(1.7, 0.78, boxX - 1.7, boxFloor + 1.35, doorZ - 0.01, drawSkyChefs, 680, 320, '-z');
  rig.decal(1.7, 0.78, boxX - 1.7, boxFloor + 1.35, boxW / 2 + 0.03, drawSkyChefs, 680, 320, '+z');

  rig.text(0.7, 0.22, doorX - 0.7, boxFloor + 0.48, doorZ - 0.01, [
    { t: 'MAX LOAD', size: 36, weight: 700, color: C.muted, font: 'Arial, sans-serif' },
    { t: '3000KG', size: 40, weight: 800, color: C.text },
  ]);
  rig.text(0.85, 0.16, doorX + 0.85, boxFloor + 1.85, doorZ - 0.01, [
    { t: 'HI-LIFT OPERATING AREA', size: 32, weight: 700, color: C.red, font: 'Arial, sans-serif' },
  ]);
  rig.text(0.4, 0.1, boxX + 1.3, boxFloor + 0.35, doorZ - 0.01, [
    { t: 'NO STEP', size: 40, weight: 800, color: C.red },
  ]);

  // Vent and a small lower access hatch.
  rig.rbox(0.55, 0.28, 0.04, boxX + 2.3, boxFloor + boxH - 0.4, doorZ, MAT.grayMid, 0.03, 2);
  for (let i = 0; i < 4; i += 1) {
    rig.box(0.4, 0.015, 0.02, boxX + 2.3, boxFloor + boxH - 0.5 + i * 0.06, doorZ - 0.02, MAT.grayDark, { shadow: false });
  }
  rig.rbox(0.7, 0.32, 0.05, boxX - 2.6, boxFloor + 0.28, doorZ, MAT.gray, 0.03, 2);

  // Scissor: one shallow X each side, plus the lift ram.
  const span = 5.4;
  const rise = boxFloor - (railY + 0.18);
  const len = Math.hypot(span, rise);
  const ang = Math.atan2(rise, span);
  const yMid = railY + 0.18 + rise / 2;
  for (const s of [-1, 1]) {
    for (const a of [ang, -ang]) {
      const beam = new Mesh(new BoxGeometry(len, 0.07, 0.1), MAT.steelDark);
      beam.position.set(boxX, yMid, s * 0.95);
      beam.rotation.z = a;
      rig.add(beam);
    }
    rig.cyl(0.06, 0.08, boxX, yMid, s * 0.95, MAT.yellow, 'z', 10);
  }
  const ramLen = Math.hypot(span * 0.45, rise);
  const ram = new Mesh(new BoxGeometry(0.08, 0.08, ramLen), MAT.steel);
  ram.position.set(boxX + 0.4, yMid, 0);
  ram.rotation.y = Math.PI / 2;
  ram.rotation.z = Math.atan2(rise, span * 0.45);
  rig.add(ram);

  // Aircraft-end platform and rails, toward the cab (+X end of the box).
  const deckX = boxX + boxL / 2 + 0.15;
  const deckY = boxFloor + 0.04;
  rig.rbox(1.35, 0.08, 2.15, deckX, deckY, 0, MAT.steel, 0.03, 2);
  rig.stripe(1.3, 0.05, 2.16, deckX, deckY + 0.02, 0, 4);
  const railH = 1.35;
  for (const s of [-1, 1]) {
    const z = s * 1.02;
    rig.box(1.25, 0.04, 0.04, deckX, deckY + railH, z, MAT.gray);
    rig.box(1.25, 0.025, 0.025, deckX, deckY + railH * 0.5, z, MAT.gray);
    for (const dxp of [-0.55, 0, 0.55]) {
      rig.box(0.04, railH, 0.04, deckX + dxp, deckY + railH / 2, z, MAT.gray);
    }
  }
  rig.box(0.04, 0.04, 1.9, deckX + 0.62, deckY + railH, 0, MAT.gray);
  for (const z of [-0.9, 0.9]) {
    rig.box(0.04, railH, 0.04, deckX + 0.62, deckY + railH / 2, z, MAT.gray);
  }

  rig.tailPair(-half + 0.06, 0.55, 0.85);
  rig.rbox(0.1, 0.22, 2.2, -half + 0.02, 0.48, 0, MAT.chassis, 0.03, 2);
  for (const s of [-1, 1]) {
    rig.box(0.04, 0.32, 0.36, rearAxle - 0.5, 0.24, s * track, MAT.black);
  }

  return rig.group;
}
