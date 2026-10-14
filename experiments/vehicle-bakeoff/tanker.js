/**
 * Jet A-1 aircraft refueller. Real metres, front +X, wheels on y = 0.
 * export function createTanker(): THREE.Group
 */
import { Mesh, BoxGeometry, TorusGeometry } from 'three';
import { Rig, MAT, C, cabProfile, drawDiamond } from './lib/kit.js';

export function createTanker() {
  const rig = new Rig('tanker');
  const half = 5.55;
  const wheelR = 0.49;
  const frontAxle = 4.05;
  const rearAxle = -3.35;
  const track = 1.18;
  const tyreW = 0.3;

  rig.axle(frontAxle, track, wheelR, tyreW, { fancy: true });
  rig.axle(rearAxle, track + 0.04, wheelR + 0.02, 0.28, { dual: true, fancy: true });

  // Chassis rails sit above the tyre crowns.
  const railY = 0.72;
  rig.rbox(9.6, 0.16, 0.12, -0.4, railY, 0.72, MAT.chassis, 0.03, 2);
  rig.rbox(9.6, 0.16, 0.12, -0.4, railY, -0.72, MAT.chassis, 0.03, 2);
  rig.rbox(9.2, 0.1, 0.7, -0.5, railY - 0.02, 0, MAT.chassis, 0.03, 2);

  // Hazard sill along the lower body, both sides.
  rig.stripe(8.4, 0.16, 0.03, -0.7, 0.62, -1.16, 18);
  rig.stripe(8.4, 0.16, 0.03, -0.7, 0.62, 1.16, 18);

  // Forward-control cab. Profile origin is mid-length, floor at y = 0.
  const cabL = 2.2;
  const cabH = 1.95;
  const cabW = 2.16;
  const cabBase = 0.9;
  const cabX = half - 0.18 - cabL / 2;
  rig.profile(cabProfile(cabL, cabH), cabW, cabX, cabBase, 0, MAT.cab, 0.045);

  // Windshield follows the sloped face of the profile.
  const dx = -cabL * 0.26;
  const dy = cabH * 0.56;
  const slope = Math.hypot(dx, dy);
  const theta = Math.atan2(-dx, dy);
  const glass = new Mesh(new BoxGeometry(0.02, slope * 0.78, cabW * 0.78), MAT.glass);
  glass.rotation.z = theta;
  const midLx = cabL / 2 - cabL * 0.13;
  const midLy = cabH * 0.7;
  const nx = dy / slope;
  const ny = -dx / slope;
  glass.position.set(cabX + midLx + nx * 0.05, cabBase + midLy + ny * 0.05, 0);
  rig.add(glass, { shadow: false });

  const winY = cabBase + cabH * 0.7;
  const winX = cabX + 0.12;
  rig.face(0.78, 0.48, winX, winY, -cabW / 2 - 0.02, MAT.glass, '-z');
  rig.face(0.78, 0.48, winX, winY, cabW / 2 + 0.02, MAT.glass, '+z');

  // Door seams and handles.
  for (const s of [-1, 1]) {
    const z = s * (cabW / 2 + 0.012);
    rig.box(0.015, cabH * 0.78, 0.012, cabX - 0.15, cabBase + cabH * 0.42, z, MAT.grayDark, { shadow: false });
    rig.box(0.08, 0.03, 0.02, cabX + 0.15, cabBase + 1.05, z, MAT.black, { shadow: false });
  }

  rig.rbox(0.16, 0.22, cabW * 0.92, cabX + cabL / 2 + 0.04, cabBase + 0.16, 0, MAT.chassis, 0.04, 2);
  rig.rbox(0.04, 0.36, 0.62, cabX + cabL / 2 + 0.03, cabBase + 0.72, 0, MAT.black, 0.02, 2);
  rig.headPair(cabX + cabL / 2 + 0.05, cabBase + 0.42, 0.62);
  rig.mirror(cabX + cabL / 2 - 0.35, cabBase + cabH * 0.78, cabW / 2 - 0.05, 1);
  rig.mirror(cabX + cabL / 2 - 0.35, cabBase + cabH * 0.78, -cabW / 2 + 0.05, -1);
  rig.cyl(0.012, 0.55, cabX - 0.15, cabBase + cabH + 0.22, -0.35, MAT.black, 'y', 6);

  // Door identity: fuel services, UN placard, flammable diamond.
  const doorZ = -cabW / 2 - 0.03;
  rig.text(0.7, 0.16, cabX + 0.05, cabBase + 1.35, doorZ, [
    { t: 'FUEL SERVICES', size: 64, weight: 800, color: C.text, tracking: 1 },
  ]);
  rig.text(0.32, 0.36, cabX - 0.35, cabBase + 0.55, doorZ, [
    { t: 'JET A-1', size: 48, weight: 800, color: '#1a1a1a' },
    { t: 'UN 1863', size: 40, weight: 700, color: '#1a1a1a', font: 'Arial, sans-serif' },
  ], '-z', '#f0a030');
  rig.decal(0.28, 0.28, cabX + 0.42, cabBase + 1.15, doorZ, drawDiamond, 256, 256);

  // Tank. Caps are the bevelled ends of the extrusion, facing ±X.
  const tankR = 1.02;
  const tankL = 6.85;
  const tankX = -1.05;
  const tankY = 0.78 + tankR;
  rig.barrel(tankR, tankL, tankX, tankY, 0, MAT.tank);

  // Circumferential bands and top fittings.
  for (const f of [-0.32, 0.32]) {
    const band = new Mesh(new TorusGeometry(tankR + 0.01, 0.025, 8, 28), MAT.steelDark);
    band.rotation.y = Math.PI / 2;
    band.position.set(tankX + f * tankL, tankY, 0);
    rig.add(band);
  }
  rig.cyl(0.045, tankL * 0.78, tankX, tankY + tankR + 0.05, 0, MAT.steel, 'x', 10);
  for (const f of [-0.28, 0.02, 0.3]) {
    const hx = tankX + f * tankL;
    rig.cyl(0.2, 0.05, hx, tankY + tankR + 0.03, 0, MAT.steel, 'y', 16);
    rig.cyl(0.14, 0.03, hx, tankY + tankR + 0.065, 0, MAT.grayDark, 'y', 14);
  }
  rig.text(1.15, 0.16, tankX + 0.15, tankY + tankR * 0.78, -tankR * 0.62, [
    { t: 'NO SMOKING', size: 72, weight: 800, color: C.red, tracking: 2 },
  ]);

  const sideZ = -tankR - 0.025;
  rig.text(2.15, 0.48, tankX + 0.85, tankY + 0.08, sideZ, [
    { t: 'JET A-1', size: 210, weight: 800, color: '#16181c', tracking: 6 },
  ]);
  rig.text(1.35, 0.22, tankX - 1.55, tankY + 0.22, sideZ, [
    { t: 'FLAMMABLE', size: 90, weight: 800, color: C.red, tracking: 2 },
  ]);
  rig.decal(0.38, 0.38, tankX - 2.35, tankY + 0.18, sideZ, drawDiamond, 256, 256);
  rig.text(1.5, 0.12, tankX + 0.15, tankY - 0.38, sideZ, [
    { t: 'CAPACITY: 6500 L (1717 US GAL)', size: 42, weight: 600, color: C.muted, font: 'Arial, sans-serif' },
  ]);
  rig.text(1.15, 0.14, tankX - 1.15, tankY - 0.28, sideZ, [
    { t: 'EMERGENCY SHUT-OFF', size: 46, weight: 800, color: '#fff' },
  ], '-z', '#c41616');
  rig.text(1.35, 0.16, tankX - 2.55, tankY - 0.22, sideZ, [
    { t: 'AIRCRAFT REFUELING', size: 40, weight: 700, color: C.blue, font: 'Arial, sans-serif' },
  ]);

  // Side locker, meter panel, hose reel in the gap behind the cab.
  rig.rbox(1.15, 0.85, 0.08, tankX - 0.4, tankY - 0.15, sideZ + 0.02, MAT.white, 0.04, 2);
  rig.box(0.02, 0.7, 0.012, tankX - 0.4, tankY - 0.15, sideZ - 0.03, MAT.grayDark, { shadow: false });

  const reelX = 2.55;
  rig.cyl(0.32, 0.16, reelX, 1.45, -0.78, MAT.hose, 'z', 18);
  rig.cyl(0.4, 0.03, reelX, 1.45, -0.66, MAT.yellow, 'z', 18);
  rig.cyl(0.4, 0.03, reelX, 1.45, -0.9, MAT.yellow, 'z', 18);
  const hang = new Mesh(new TorusGeometry(0.16, 0.032, 8, 14, Math.PI * 1.2), MAT.hose);
  hang.rotation.y = Math.PI / 2;
  hang.position.set(reelX - 0.05, 1.12, -1.0);
  rig.add(hang);

  rig.rbox(0.55, 0.7, 0.16, reelX, 0.95, -0.95, MAT.steelDark, 0.03, 2);
  for (const i of [-1, 0, 1]) {
    rig.cyl(0.045, 0.02, reelX, 1.05 + i * 0.16, -1.04, MAT.black, 'z', 10, { shadow: false });
  }

  // Under-tank pipework and a couple of valve wheels.
  rig.cyl(0.05, tankL * 0.7, tankX, 0.85, -0.35, MAT.steel, 'x', 8);
  rig.cyl(0.04, tankL * 0.45, tankX - 0.3, 0.78, 0.2, MAT.steelDark, 'x', 8);
  for (const vx of [tankX - 1.4, tankX + 0.6]) {
    const valve = new Mesh(new TorusGeometry(0.09, 0.016, 6, 12), MAT.steel);
    valve.position.set(vx, 0.95, -0.55);
    rig.add(valve);
  }
  rig.rbox(0.9, 0.45, 1.3, tankX + 0.2, 0.95, 0, MAT.chassis, 0.04, 2);

  // Rear ladder, bumper, lights. Ladder is on the hero side of the tank end.
  const rear = -half + 0.08;
  rig.ladder(-4.55, -0.72, 0.55, tankY + tankR - 0.05, 8, 0.32);
  rig.box(0.04, 0.04, 0.7, tankX - tankL / 2 + 0.15, tankY + tankR + 0.12, -0.15, MAT.steel);
  rig.rbox(0.12, 0.28, 2.2, rear, 0.7, 0, MAT.chassis, 0.04, 2);
  rig.tailPair(rear - 0.02, 0.62, 0.85);
  rig.stripe(0.08, 0.55, 2.05, rear - 0.05, 1.15, 0, 6);

  // Mudflaps behind the rear duals.
  for (const s of [-1, 1]) {
    rig.box(0.04, 0.38, 0.55, rearAxle - 0.55, 0.28, s * track, MAT.black);
  }

  // Same identity on the far side so a walk-around is not blank.
  const farZ = tankR + 0.025;
  rig.text(2.15, 0.48, tankX + 0.85, tankY + 0.08, farZ, [
    { t: 'JET A-1', size: 210, weight: 800, color: '#16181c', tracking: 6 },
  ], '+z');
  rig.text(1.35, 0.22, tankX - 1.55, tankY + 0.22, farZ, [
    { t: 'FLAMMABLE', size: 90, weight: 800, color: C.red, tracking: 2 },
  ], '+z');

  return rig.group;
}
