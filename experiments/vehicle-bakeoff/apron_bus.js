/**
 * Apron shuttle, about 100 seats. Real metres, front +X, wheels on y = 0.
 */
import { Mesh, BoxGeometry } from 'three';
import { Rig, MAT, C, drawGroundSupport } from './lib/kit.js';

export function createApronBus() {
  const rig = new Rig('apron_bus');
  const half = 6.85;
  const W = 2.84;
  const wheelR = 0.5;
  const frontAxle = 4.45;
  const rearAxle = -3.65;
  // Wheels tuck under the skirt; the skirt bottom is high enough that the tyre still reads.
  const track = 1.12;

  rig.axle(frontAxle, track, wheelR, 0.34, { fancy: true });
  rig.axle(rearAxle, track, wheelR, 0.36, { fancy: true });

  const floor = 0.78;
  const roof = 2.98;
  const bodyH = roof - floor;
  const bodyY = (floor + roof) / 2;
  rig.rbox(half * 2 - 0.15, bodyH, W, 0, bodyY, 0, MAT.white, 0.16, 3);
  rig.rbox(half * 2, 0.72, W + 0.04, 0, 0.78, 0, MAT.skirt, 0.1, 3);
  // Gray nose and tail caps.
  rig.rbox(0.7, 1.55, W * 0.98, half - 0.28, 1.35, 0, MAT.skirt, 0.12, 2);
  rig.rbox(0.55, 1.7, W * 0.98, -half + 0.22, 1.45, 0, MAT.skirt, 0.1, 2);
  rig.rbox(2.3, 0.28, 1.7, -0.2, roof + 0.12, 0, MAT.white, 0.06, 2);

  // Window band, then individual panes and taller doors. Pillars are the white body
  // showing between panes, with a black reveal behind the glass.
  const bays = [
    { x: 5.15, w: 0.7, h: 0.7, y: 2.15 },
    { x: 4.15, w: 0.95, h: 1.35, y: 1.75, door: true },
    { x: 2.95, w: 1.15, h: 1.45, y: 1.7, door: true },
    { x: 1.55, w: 1.15, h: 1.45, y: 1.7, door: true },
    { x: 0.15, w: 1.05, h: 0.72, y: 2.15, solid: true },
    { x: -1.15, w: 1.1, h: 1.45, y: 1.7, door: true },
    { x: -2.45, w: 1.05, h: 0.72, y: 2.15 },
    { x: -3.7, w: 1.0, h: 1.35, y: 1.75, door: true },
    { x: -5.0, w: 0.85, h: 0.7, y: 2.15 },
  ];

  for (const s of [-1, 1]) {
    const zBand = s * (W / 2 + 0.008);
    rig.box(11.2, 0.85, 0.04, 0.1, 2.15, zBand, MAT.black, { shadow: false });
    for (const bay of bays) {
      if (bay.solid) continue;
      const z = s * (W / 2 + 0.03);
      const facing = s < 0 ? '-z' : '+z';
      rig.face(bay.w, bay.h, bay.x, bay.y, z, MAT.glass, facing);
    }
  }

  // White pillars on the hero side so the glazing reads as separate windows.
  const pillars = [4.65, 3.55, 2.25, 0.85, -0.5, -1.8, -3.1, -4.35, -5.55];
  for (const x of pillars) {
    rig.box(0.08, 0.85, 0.03, x, 2.15, -W / 2 - 0.02, MAT.white, { shadow: false });
  }

  // Front glass and lamps.
  const wind = new Mesh(new BoxGeometry(0.05, 1.15, W * 0.72), MAT.glass);
  wind.position.set(half - 0.12, 2.15, 0);
  wind.rotation.z = -0.06;
  rig.add(wind, { shadow: false });
  rig.headPair(half + 0.02, 1.05, 0.85, 0.28, 0.14);
  rig.tailPair(-half - 0.02, 1.05, 0.9);
  rig.mirror(half - 0.45, 2.35, W / 2 - 0.05, 1);
  rig.mirror(half - 0.45, 2.35, -W / 2 + 0.05, -1);
  rig.box(0.55, 0.03, 0.04, half - 0.2, 2.55, -0.35, MAT.black, { shadow: false });

  const hz = -W / 2 - 0.04;
  rig.text(2.6, 0.22, 0.2, 2.62, hz, [
    { t: 'GATE 1A - 4C', size: 72, weight: 700, color: '#3e4650', tracking: 4, font: 'Arial, sans-serif' },
  ]);
  rig.text(2.4, 0.32, -0.9, 1.35, hz, [
    { t: 'AIRPORT SHUTTLE', size: 70, weight: 700, color: C.shuttle, tracking: 6 },
  ]);
  rig.text(1.15, 0.22, 3.55, 1.22, hz, [
    { t: 'CAPACITY: 100 PAX', size: 32, weight: 700, color: C.muted, font: 'Arial, sans-serif' },
    { t: 'MAX SPEED: 30 KM/H', size: 30, weight: 700, color: C.muted, font: 'Arial, sans-serif' },
  ]);
  rig.decal(0.7, 0.32, 5.35, 1.28, hz, drawGroundSupport, 360, 160);

  for (const x of [4.15, 2.95, -1.15, -3.7]) {
    rig.text(0.42, 0.08, x, 2.55, hz, [
      { t: 'EMERGENCY EXIT', size: 28, weight: 700, color: '#fff', font: 'Arial, sans-serif' },
    ], '-z', '#c41616');
  }

  rig.stripe(half * 2 - 0.4, 0.08, 0.03, 0, 0.4, -W / 2 - 0.03, 26);
  rig.stripe(half * 2 - 0.4, 0.08, 0.03, 0, 0.4, W / 2 + 0.03, 26);
  rig.beacon(4.2, roof + 0.28, 0);

  return rig.group;
}
