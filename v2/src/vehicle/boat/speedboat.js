// Costa del Gzowo boats: the Sawgrass 25 sport boat (deep-V planing hull, centre helm, wrap-around screen, steering outboard) with its tuning, sound mix and spray layout.
import * as THREE from 'three';
import { Batch, F, at, box, cyl, sphere, tube, grid, hullShape, hullSurfaces, hullPoints, buoyancySamples, propeller, mergeAll } from './boatGeometry.js';
import { createBoatModel } from './boatModel.js';
import { CH, PAT } from './boatMaterials.js';

const L = 7.6;
const X0 = -L / 2;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const beam = (t) => 1.25 * (t < 0.45 ? 0.95 + 0.05 * (t / 0.45) : Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2)));
const keel = (t) => -0.36 + 0.5 * smooth(0.5, 1, t) ** 1.4 + 0.55 * smooth(0.86, 1, t);
const sheer = (t) => 0.86 + 0.3 * smooth(0.3, 1, t) ** 1.3;
const SPEC = {
  length: L,
  beam,
  chine: (t) => beam(t) * 0.86,
  keel,
  chineY: (t) => Math.max(keel(t) + 0.04, -0.1 + 0.5 * smooth(0.55, 1, t)),
  sheer,
};
const tOf = (x) => (x - X0) / L;
const SEAT = V(-0.95, 0.66, 0.48);
const HELM = V(-0.42, 0.98, 0.48);
const set = (c, f) => {
  c[0] = f[0];
  c[1] = f[1];
  c[2] = f[2];
};

function hullPaint(x, y, z, c) {
  const sh = sheer(tOf(x));
  if (y < 0.03) set(c, F.anti);
  else if (y > sh - 0.36 && y < sh - 0.17) set(c, F.navy);
  else if (y > sh - 0.13 && y < sh - 0.1) set(c, F.gold);
}

function windscreen() {
  return grid(24, 4, (u, v, p) => {
    const z = (u * 2 - 1) * 1.02;
    const k = (z / 1.02) ** 2;
    const x = 0.5 - 0.45 * k - v * 0.28;
    p.set(x, sheer(tOf(x)) + 0.03 + v * 0.36, z * (1 - 0.06 * v));
  });
}

function wheel() {
  const g = [new THREE.TorusGeometry(0.17, 0.016, 8, 30)];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    g.push(at(cyl(0.008, 0.008, 0.17, 6), Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0, 0, 0, a + Math.PI / 2));
  }
  g.push(at(cyl(0.035, 0.035, 0.05, 14), 0, 0, 0, Math.PI / 2, 0, 0));
  return mergeAll(g).rotateY(Math.PI / 2);
}

export async function build(ctx) {
  const shape = hullShape(SPEC);
  const surf = hullSurfaces(shape, { nu: 44, nb: 12, ns: 16, deckFrom: 0.57, floorY: 0.14, wall: 0.08, camber: 0.06, flare: 0.7 });
  const model = createBoatModel(ctx, { id: 'speedboat', damageBox: [-4.4, 8.8, -0.6, 2.0] });
  model.cullRadius = 6;
  const b = new Batch();
  b.add(surf.bottom, F.anti);
  for (const s of surf.sides) b.add(s, F.gel, 0, hullPaint);
  b.add(surf.transom, F.gel, 0, hullPaint);
  b.add(surf.deck, F.gel);
  b.add(surf.floor, F.teak, PAT.TEAK);
  for (const w of surf.walls) b.add(w, F.cream);
  for (const c of surf.caps) b.add(c, F.teak, PAT.TEAK);
  b.add(surf.bulkhead, F.cream);

  const rail = (sign) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = 0.02 + (i / 30) * 0.96;
      pts.push(V(X0 + t * L, sheer(t) - 0.03, sign * (beam(t) + 0.015)));
    }
    return tube(pts, 0.03, 6);
  };
  b.add(rail(1), F.steel, PAT.BRUSHED);
  b.add(rail(-1), F.steel, PAT.BRUSHED);
  for (const sign of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = 0.62 + (i / 14) * 0.36;
      pts.push(V(X0 + t * L, sheer(t) + 0.36, sign * Math.max(0.05, beam(t) - 0.12)));
    }
    b.add(tube(pts, 0.016, 6), F.chrome);
    for (let i = 0; i < 4; i++) {
      const t = 0.66 + i * 0.09;
      b.add(at(cyl(0.012, 0.012, 0.36, 6), X0 + t * L, sheer(t) + 0.18, sign * (beam(t) - 0.12)), F.chrome);
    }
  }
  b.add(at(box(1.5, 0.16, 1.5, 0.07), 1.45, sheer(tOf(1.45)) + 0.1, 0, 0, 0, 0, 1, 1, 0.92), F.cream);
  b.add(at(box(0.62, 0.42, 2.3, 0.08), -3.42, 0.35, 0), F.cream);
  b.add(at(box(0.55, 0.12, 2.3, 0.05), -3.4, 0.6, 0), F.cream);
  b.add(at(box(0.16, 0.5, 2.3, 0.06), -3.68, 0.86, 0), F.cream);
  for (const z of [0.48, -0.48]) {
    b.add(at(box(0.56, 0.12, 0.56, 0.05), -0.98, 0.56, z), F.cream);
    b.add(at(box(0.14, 0.6, 0.54, 0.06), -1.26, 0.86, z, 0, 0, 0.12), F.cream);
    b.add(at(cyl(0.05, 0.07, 0.42, 10), -0.98, 0.3, z), F.steel, PAT.BRUSHED);
  }
  b.add(at(box(0.6, 0.86, 1.6, 0.08), -0.08, 0.56, 0), F.gel);
  b.add(at(box(0.42, 0.05, 1.5, 0.02), -0.25, 1.0, 0, 0, 0, -0.5), F.gloss);
  b.add(at(box(0.24, 0.005, 0.32, 0.004), -0.27, 1.03, 0.5, 0, 0, -0.5), F.screen, CH.SCREEN);
  b.add(at(box(0.22, 0.005, 0.3, 0.004), -0.27, 1.03, -0.1, 0, 0, -0.5), F.screen, CH.SCREEN);
  b.add(at(cyl(0.03, 0.03, 0.2, 10), -0.34, 0.98, 0.48, 0, 0, 1.0), F.black);
  b.add(at(box(0.12, 0.1, 0.06, 0.02), -0.3, 1.02, 0.08, 0, 0, -0.4), F.black);
  const ws = windscreen();
  const top = [];
  for (let i = 0; i <= 20; i++) {
    const z = (i / 20 * 2 - 1) * 0.96;
    const x = 0.5 - 0.45 * (z / 1.02) ** 2 - 0.28;
    top.push(V(x, sheer(tOf(x)) + 0.4, z));
  }
  b.add(tube(top, 0.014, 6), F.chrome);
  const tz = (t) => beam(t) * 0.82;
  for (const [t, ch] of [[0.8, CH.RED], [0.8, CH.GREEN]]) {
    const z = ch === CH.RED ? -tz(t) : tz(t);
    b.add(at(box(0.1, 0.05, 0.05, 0.015), X0 + t * L, sheer(t) + 0.04, z), F.lamp, ch);
  }
  b.add(at(cyl(0.015, 0.015, 0.9, 8), -3.55, 1.25, -0.95), F.chrome);
  b.add(at(sphere(0.035), -3.55, 1.72, -0.95), F.lamp, CH.WHITE);
  for (const sign of [1, -1]) {
    b.add(at(cyl(0.02, 0.02, 0.2, 8), -3.2, 0.95, sign * 1.05, 0, 0, Math.PI / 2), F.chrome);
    b.add(at(cyl(0.02, 0.02, 0.2, 8), 2.2, sheer(tOf(2.2)) + 0.02, sign * (beam(tOf(2.2)) - 0.05), 0, 0, Math.PI / 2), F.chrome);
  }
  b.add(at(box(0.1, 0.5, 2.0, 0.03), X0 - 0.05, 0.28, 0), F.gel);
  b.add(at(box(0.42, 0.05, 1.9, 0.02), X0 - 0.24, 0.16, 0), F.grip, PAT.GRIP);
  model.setHull(model.mesh(b.build()));
  model.glassMesh(ws);
  model.lampAt(CH.RED, X0 + 0.8 * L, sheer(0.8), -tz(0.8));
  model.lampAt(CH.GREEN, X0 + 0.8 * L, sheer(0.8), tz(0.8));
  model.lampAt(CH.WHITE, -3.55, 1.72, -0.95);

  const motor = model.pivot(X0 - 0.35, 0.72, 0);
  const mb = new Batch();
  mb.add(at(box(0.62, 0.52, 0.46, 0.14), -0.12, 0.26, 0), F.gloss);
  mb.add(at(box(0.5, 0.04, 0.47, 0.02), -0.1, 0.06, 0), F.alu);
  mb.add(at(box(0.3, 0.75, 0.16, 0.05), -0.08, -0.38, 0), F.gloss);
  mb.add(at(box(0.42, 0.42, 0.1, 0.04), -0.05, -0.88, 0, 0, 0, 0.12), F.gloss);
  mb.add(at(cyl(0.075, 0.06, 0.5, 14), -0.08, -1.1, 0, 0, 0, Math.PI / 2), F.gloss);
  mb.add(at(box(0.36, 0.02, 0.32, 0.01), -0.05, -0.92, 0), F.black);
  mb.add(at(box(0.3, 0.06, 0.04, 0.02), -0.22, 0.36, 0.235), F.white);
  mb.add(at(box(0.3, 0.06, 0.04, 0.02), -0.22, 0.36, -0.235), F.white);
  model.mesh(mb.build(), motor);
  model.part('motor', motor, {
    label: 'Outboard', half: [0.3, 0.7, 0.25], mass: 180, float: false, limit: 1.2, tearAt: 5, bend: [0, 0.9],
    zone: (lp, below) => (lp.x < X0 + 0.7 ? 1 : below && lp.x < X0 + 2 ? 0.6 : 0),
    onBend: (car, d) => (car.state.thrustScale = Math.max(0.1, 1 - d * 0.55)),
    onLose: (car) => (car.state.thrustScale = 0),
    onRepair: (car) => (car.state.thrustScale = 1),
  });
  const prop = model.pivot(-0.36, -1.1, 0, motor);
  const pb = new Batch();
  pb.add(propeller(0.17, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), F.steel);
  model.mesh(pb.build(), prop, false);

  const helm = model.helm;
  helm.position.copy(HELM);
  helm.rotation.z = -0.55;
  model.group.add(helm);
  const wb = new Batch();
  wb.add(wheel(), F.black);
  const wheelMesh = model.mesh(wb.build(), helm, false);
  model.setGrips(V(0, 0.08, -0.15), V(0, 0.08, 0.15));

  model.setEntry({
    seat: SEAT.clone(),
    spot: V(-0.9, 0, 1.95),
    prompt: V(-0.9, 0.5, 1.7),
    exitSpot: V(-0.9, 0, 2.2),
    extraExits: [V(X0 - 1.2, 0, 0), V(X0 - 2.0, 0, 0), V(4.4, 0, 0)],
    pedalL: V(-0.42, 0.18, 0.38),
    pedalR: V(-0.42, 0.18, 0.6),
    brace: V(-0.6, 0.95, 0.9),
    sillY: 0.9,
    length: L,
    halfWidth: 1.25,
  });

  let time = 0;
  let spin = 0;
  model.update = (dt, s) => {
    time += dt;
    const steer = (s.steer / 0.6) * 0.55;
    const out = model.parts.motor;
    if (!out.detached) {
      motor.rotation.y = -steer * (1 - (out.k || 0));
      motor.rotation.z = -0.05 * s.planing + 0.9 * (out.k || 0);
    }
    spin += dt * (s.occupied ? 8 + s.engineLoad * 160 : 0);
    prop.rotation.x = spin % (Math.PI * 2);
    wheelMesh.rotation.x = -steer * 2.6;
    model.navLights(s.occupied, time);
    model.mats.setLamp(CH.WHITE, model.visual.beam || s.occupied ? 5 : 0);
  };

  const samples = buoyancySamples(shape, { along: 5, across: 3, from: 0.04, to: 0.82 }).map((p) => [p[0], p[1], p[2] * 0.4]);
  const hullPts = hullPoints(shape, 12);
  const design = {
    mass: 1500, inertia: [900, 8000, 7500], com: [-0.4, 0.2, 0], samples, column: 1.4, topY: 1.0,
    accel: 4.4, top: 19.5, lin: 0.02, boost: 1.3, reverse: 0.45, spool: 2.6,
    plane: { v0: 4, v1: 11, lift: 0.62, x: -0.5, hump: 6, width: 3, trim: 1.1, hold: 0.45, drag: 0.7, slick: 0.3 },
    latLin: 0.6, latQuad: 0.7, latX: -0.7, steerMax: 0.5, steerRate: 2.0, vector: 0.7, rudder: 0.0026,
    yawDamp: 2.0, rollDamp: 3.2, pitchDamp: 2.4, bank: 0.11, righting: 1.6, capsize: 0.35,
    prop: [X0 - 0.45, -0.42, 0],
    dentAt: 0.8, crushAt: 7, dentScale: 0.06, dentLimit: 0.35, holeAt: 2.4, breachScale: 0.9, engineHit: 0.12, shatterAt: 4, metal: false, chips: [0.85, 0.85, 0.82],
    engine: [X0 - 0.35, 1.0, 0], burnTime: 10, blastBreach: 1.6, maxBreach: 2, floodTime: 22,
    colliders: [{ points: hullPts }, { half: [0.3, 0.45, 0.25], at: [X0 - 0.45, 0.6, 0] }],
    camera: { distance: 8.5, height: 1.7, ahead: 3, pitch: 0.17 },
    keys: { handbrake: 'KeyX', camera: 'KeyV' },
    hint: 'Exit   ·   W S throttle and reverse   ·   A D steer   ·   Shift full power   ·   V camera',
    label: 'Board the speedboat',
  };
  const on = (s) => (s.occupied && !s.stalled ? 1 : 0);
  const layers = [
    { file: 'outboard_idle', gain: (s, inside) => on(s) * (1 - smooth(0.25, 0.8, s.engineLoad)) * 0.55 * (inside ? 0.8 : 1), rate: (s) => 0.92 + 0.4 * s.engineLoad },
    { file: 'outboard_run', gain: (s, inside) => on(s) * smooth(0.08, 0.6, s.engineLoad) * (0.55 + 0.35 * s.engineLoad) * (inside ? 0.85 : 1), rate: (s) => 0.72 + 0.38 * Math.min(1.3, s.engineLoad) + s.speed / 70 },
    { file: 'hull_lap', gain: (s) => 0.22 * (1 - smooth(1, 5, s.speed)) },
    { file: 'hull_rush', gain: (s) => smooth(2, 18, s.speed) * 0.6 * Math.max(0.2, s.wet), rate: (s) => 0.85 + s.speed / 60 },
  ];
  const fx = { halfLength: L / 2, halfBeam: 1.25, halfHeight: 0.6, spray: 1.6, sprayFrom: -0.2, sprayTo: 1.6, rooster: 1 };
  return { model, design, layers, fx };
}
