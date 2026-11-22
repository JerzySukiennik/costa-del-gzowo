// Costa del Gzowo boats: the Halcyon electric foiler (slender lacquered hull with gold strakes and bow scoop, two-seat cockpit, carbon struts with fly-by-wire T-foils and a steering pod motor) with its tuning, sound mix and spray layout.
import * as THREE from 'three';
import { Batch, F, at, box, cyl, sphere, tube, sweep, grid, hullShape, hullSurfaces, hullPoints, buoyancySamples, propeller, foilSection, mergeAll } from './boatGeometry.js';
import { createBoatModel } from './boatModel.js';
import { CH, PAT } from './boatMaterials.js';

const L = 6.4;
const X0 = -L / 2;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const beam = (t) => 0.98 * (t < 0.4 ? 0.9 + 0.1 * Math.sin((t / 0.4) * Math.PI * 0.5) : Math.pow(Math.max(0, 1 - ((t - 0.4) / 0.6) ** 2), 0.8));
const keel = (t) => -0.3 + 0.42 * smooth(0.45, 1, t) ** 1.5 + 0.28 * smooth(0.9, 1, t);
const sheer = (t) => 0.5 + 0.07 * Math.sin(t * Math.PI) - 0.08 * smooth(0.85, 1, t);
const SPEC = {
  length: L,
  beam,
  chine: (t) => beam(t) * 0.78,
  keel,
  chineY: (t) => Math.max(keel(t) + 0.03, -0.12 + 0.36 * smooth(0.5, 1, t)),
  sheer,
};
const tOf = (x) => (x - X0) / L;
const STRUT_Y = -1.55;
const FRONT_X = 1.05;
const REAR_X = -2.75;
const set = (c, f) => {
  c[0] = f[0];
  c[1] = f[1];
  c[2] = f[2];
};

function hullPaint(x, y, z, c) {
  const sh = sheer(tOf(x));
  if (y < -0.02) set(c, [0.012, 0.03, 0.025]);
  else if (Math.abs(y - (sh - 0.09)) < 0.012 && x > -2.6 && x < 2.2) set(c, F.gold);
  else if (Math.abs(y - (sh - 0.33)) < 0.012 && x > -1.6 && x < 1.6) set(c, F.gold);
}

function deckPaint(x, y, z, c) {
  const t = tOf(x);
  const w = Math.abs(z) / Math.max(0.05, beam(t));
  if (x > 0.9 && x < 1.9 && Math.abs(z) < 0.22) set(c, [0.82, 0.8, 0.76]);
  if (w > 0.93) set(c, F.gold);
}

function strut(x, z, top, bottom, chord) {
  const g = sweep([V(0, top, 0), V(0, bottom, 0)], foilSection(chord, 0.12).map(([a, b]) => [b, a]), { up: V(1, 0, 0) });
  return g.translate(x, 0, z);
}

function wing(x, y, span, chord, dihedral = 0.08) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const z = (i / 12 * 2 - 1) * span;
    pts.push(V(x, y + Math.abs(z) * dihedral, z));
  }
  return sweep(pts, foilSection(chord, 0.1), { up: V(0, 1, 0), scale: (u) => 1 - 0.45 * Math.abs(u * 2 - 1) ** 2 });
}

export async function build(ctx) {
  const shape = hullShape(SPEC);
  const surf = hullSurfaces(shape, { nu: 48, nb: 12, ns: 16, deckFrom: 0, camber: 0.12, flare: 0.65, bottomPow: 0.85 });
  const model = createBoatModel(ctx, { id: 'foilboat', glassBase: 0.12, damageBox: [-3.6, 7.2, -0.5, 1.4] });
  model.cullRadius = 5.5;
  const b = new Batch();
  b.add(surf.bottom, [0.012, 0.03, 0.025, 0.3, 0.1, 0.6]);
  for (const s of surf.sides) b.add(s, F.green, 0, hullPaint);
  b.add(surf.transom, F.green);
  b.add(surf.deck, F.green, 0, deckPaint);
  const cx = -0.35;
  b.add(at(box(1.9, 0.08, 1.22, 0.04), cx, sheer(tOf(cx)) + 0.03, 0), F.black);
  b.add(at(box(1.95, 0.05, 0.035, 0.015), cx, sheer(tOf(cx)) + 0.08, 0.62), F.gold);
  b.add(at(box(1.95, 0.05, 0.035, 0.015), cx, sheer(tOf(cx)) + 0.08, -0.62), F.gold);
  for (const z of [0.3, -0.3]) {
    b.add(at(box(0.5, 0.1, 0.48, 0.05), -0.62, 0.52, z), [0.04, 0.035, 0.03, 0.55, 0, 0.3]);
    b.add(at(box(0.12, 0.55, 0.46, 0.05), -0.9, 0.78, z, 0, 0, 0.18), [0.04, 0.035, 0.03, 0.55, 0, 0.3]);
    b.add(at(box(0.1, 0.16, 0.26, 0.04), -0.98, 1.1, z, 0, 0, 0.2), [0.04, 0.035, 0.03, 0.55, 0, 0.3]);
  }
  b.add(at(box(0.36, 0.22, 1.1, 0.07), 0.38, 0.72, 0, 0, 0, -0.35), F.carbon, PAT.CARBON);
  b.add(at(box(0.18, 0.005, 0.5, 0.004), 0.31, 0.82, 0, 0, 0, -0.6), F.screen, CH.SCREEN);
  b.add(at(cyl(0.022, 0.022, 0.14, 10), 0.24, 0.84, 0.3, 0, 0, 1.1), F.black);
  const scoop = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    scoop.push(V(3.0, 0.4 + Math.sin(a) * 0.05, Math.cos(a) * 0.1));
  }
  b.add(tube(scoop, 0.025, 6, true), F.gold);
  b.add(at(sphere(0.1, 0.6, 0.5, 1), 3.02, 0.4, 0), [0.005, 0.005, 0.006, 0.5, 0, 0]);
  for (const sign of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 26; i++) {
      const t = 0.03 + (i / 26) * 0.92;
      pts.push(V(X0 + t * L, sheer(t) - 0.012, sign * (beam(t) + 0.006)));
    }
    b.add(tube(pts, 0.016, 5), F.gold);
  }
  b.add(at(box(0.06, 0.04, 0.1, 0.015), 2.2, sheer(tOf(2.2)) + 0.02, -beam(tOf(2.2)) + 0.08), F.lamp, CH.RED);
  b.add(at(box(0.06, 0.04, 0.1, 0.015), 2.2, sheer(tOf(2.2)) + 0.02, beam(tOf(2.2)) - 0.08), F.lamp, CH.GREEN);
  b.add(at(box(0.04, 0.03, 0.5, 0.01), X0 + 0.05, 0.5, 0), F.lamp, CH.WHITE);
  b.add(at(box(0.5, 0.02, 0.012, 0.005), 2.6, 0.46, 0.0), F.lamp, CH.ACCENT);
  const st = [F.carbon[0], F.carbon[1], F.carbon[2], 0.28, 0.3, 1];
  const fb = new Batch();
  for (const z of [0.72, -0.72]) {
    fb.add(strut(FRONT_X, z, 0.0, STRUT_Y, 0.2), st, PAT.CARBON);
    fb.add(at(box(0.3, 0.06, 0.16, 0.03), FRONT_X, -0.12, z), F.gold);
  }
  fb.add(wing(FRONT_X - 0.02, STRUT_Y, 0.98, 0.26), st);
  const rb = new Batch();
  for (const z of [0.55, -0.55]) {
    rb.add(strut(REAR_X, z, 0.0, STRUT_Y, 0.22), st, PAT.CARBON);
    rb.add(at(box(0.32, 0.06, 0.16, 0.03), REAR_X, -0.1, z), F.gold);
  }
  rb.add(wing(REAR_X - 0.04, STRUT_Y + 0.02, 0.95, 0.26, 0.05), st);
  rb.add(at(cyl(0.1, 0.07, 0.7, 16), REAR_X - 0.08, STRUT_Y - 0.06, 0, 0, 0, Math.PI / 2), F.gold);
  rb.add(at(sphere(0.1, 1.4, 1, 1), REAR_X + 0.27, STRUT_Y - 0.06, 0), F.gold);
  rb.add(at(box(0.3, 0.08, 0.05, 0.02), REAR_X - 0.04, STRUT_Y - 0.01, 0), st);
  model.setHull(model.mesh(b.build()));
  const frontFoil = model.pivot(FRONT_X, 0, 0);
  model.mesh(fb.build().translate(-FRONT_X, 0, 0), frontFoil);
  const rearFoil = model.pivot(REAR_X, 0, 0);
  model.mesh(rb.build().translate(-REAR_X, 0, 0), rearFoil);
  const foilPart = (label, index, zone, extra = {}) => ({
    label, half: [0.15, 0.8, 0.9], mass: 30, float: false, limit: 1.0, tearAt: 3.2, bend: [0.35, 0.55], zone,
    onBend: (car, d) => (car.state.foilBend = Math.max(car.state.foilBend || 0, d)),
    onLose: (car) => {
      car.state.foilsOff = true;
      car.colliders[index].setEnabled(false);
      if (extra.pod) car.state.thrustScale = 0;
    },
    onRepair: (car) => {
      car.state.foilBend = 0;
      car.colliders[index].setEnabled(true);
    },
  });
  model.part('frontFoil', frontFoil, foilPart('Front foil', 1, (lp, below) => (below && lp.x > -0.8 ? 1 : 0)));
  model.part('rearFoil', rearFoil, foilPart('Rear foil and motor pod', 2, (lp, below) => (below && lp.x < -1.6 ? 1 : 0), { pod: true }));
  model.lampAt(CH.RED, 2.2, 0.55, -0.6);
  model.lampAt(CH.GREEN, 2.2, 0.55, 0.6);
  model.lampAt(CH.WHITE, X0, 0.5, 0);
  const ws = grid(20, 3, (u, v, p) => {
    const z = (u * 2 - 1) * 0.6;
    p.set(0.55 - 0.3 * (z / 0.6) ** 2 - v * 0.16, sheer(tOf(0.5)) + 0.05 + v * 0.2, z * (1 - 0.1 * v));
  });
  model.glassMesh(ws);
  const prop = model.pivot(-0.46, STRUT_Y - 0.06, 0, rearFoil);
  const pb = new Batch();
  pb.add(propeller(0.15, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), F.gold);
  model.mesh(pb.build(), prop, false);

  const helm = model.helm;
  helm.position.set(0.18, 0.88, 0.3);
  helm.rotation.z = -0.7;
  model.group.add(helm);
  const wb = new Batch();
  const wheel = [new THREE.TorusGeometry(0.13, 0.016, 8, 28), at(box(0.2, 0.04, 0.03, 0.01), 0, 0, 0)];
  wb.add(mergeAll(wheel).rotateY(Math.PI / 2), F.carbon, PAT.CARBON);
  const wheelMesh = model.mesh(wb.build(), helm, false);
  model.setGrips(V(0, 0.04, -0.12), V(0, 0.04, 0.12));
  model.setEntry({
    seat: V(-0.64, 0.66, 0.3),
    spot: V(-0.6, 0, 1.6),
    prompt: V(-0.6, 0.45, 1.35),
    exitSpot: V(-0.6, 0, 1.9),
    extraExits: [V(X0 - 1.2, 0, 0), V(X0 - 2.0, 0, 0), V(3.8, 0, 0)],
    pedalL: V(0.05, 0.12, 0.2),
    pedalR: V(0.05, 0.12, 0.4),
    brace: V(-0.3, 0.75, 0.75),
    sillY: 0.7,
    length: L,
    halfWidth: 1.0,
  });

  let time = 0;
  let spin = 0;
  model.update = (dt, s) => {
    time += dt;
    const steer = (s.steer / 0.6) * 0.45;
    spin += dt * (s.occupied ? 6 + s.engineLoad * 120 : 0);
    prop.rotation.x = spin % (Math.PI * 2);
    prop.rotation.y = -steer * 0.6;
    wheelMesh.rotation.x = -steer * 2.4;
    model.navLights(s.occupied, time);
    model.mats.setLamp(CH.ACCENT, s.occupied ? 3 + 5 * s.foiling : 0.2);
    model.mats.setLamp(CH.GOLD, 0);
  };

  const samples = buoyancySamples(shape, { along: 5, across: 3, from: 0.05, to: 0.84 }).map((p) => [p[0], p[1], p[2] * 0.45]);
  const hullPts = hullPoints(shape, 12);
  const design = {
    mass: 1100, inertia: [520, 3600, 3400], com: [-0.55, 0.1, 0], samples, column: 1.0, topY: 0.8,
    accel: 3.6, top: 11, lin: 0.02, boost: 1.25, reverse: 0.4, spool: 3.5,
    plane: { v0: 4, v1: 9, lift: 0.35, x: -0.3, hump: 5, width: 2.5, trim: 0.5, hold: 0.3, drag: 0.4, slick: 0.15 },
    foil: {
      foils: [
        { x: FRONT_X, y: STRUT_Y, z: -0.55, area: 0.15, front: true },
        { x: FRONT_X, y: STRUT_Y, z: 0.55, area: 0.15, front: true },
        { x: REAR_X, y: STRUT_Y, z: -0.5, area: 0.13, front: false },
        { x: REAR_X, y: STRUT_Y, z: 0.5, area: 0.13, front: false },
      ],
      clMax: 1.1, ride: 0.9, kp: 7, kd: 3.5, pitch: 0.025, kPitch: 5, kPitchD: 1.2, kRoll: 1.6, kRollD: 0.45, bank: 0.034, cd: 0.03,
    },
    latLin: 0.7, latQuad: 1.0, latX: -0.4, steerMax: 0.45, steerRate: 2, vector: 0.45, rudder: 0.0035,
    yawDamp: 1.8, rollDamp: 2.2, pitchDamp: 2.6, bank: 0, righting: 1.6, capsize: 0.35,
    prop: [REAR_X - 0.45, STRUT_Y - 0.06, 0], thrustAtCom: true,
    dentAt: 0.8, crushAt: 6.5, dentScale: 0.06, dentLimit: 0.3, holeAt: 2.2, breachScale: 1.4, engineHit: 0.13, shatterAt: 3.5, metal: false, chips: [0.05, 0.12, 0.1],
    engine: [-1.6, 0.35, 0], burnTime: 9, blastBreach: 1.6, maxBreach: 2, floodTime: 18,
    colliders: [{ points: hullPts }, { half: [0.13, 0.62, 0.8], at: [FRONT_X, -0.68, 0] }, { half: [0.14, 0.62, 0.6], at: [REAR_X, -0.68, 0] }],
    camera: { distance: 8, height: 1.6, ahead: 3, pitch: 0.16 },
    keys: { handbrake: 'KeyX', camera: 'KeyV' },
    hint: 'Exit   ·   W S throttle and reverse   ·   A D steer   ·   faster than 25 km/h to fly on the foils   ·   V camera',
    label: 'Board the foiling boat',
  };
  const on = (s) => (s.occupied && !s.stalled ? 1 : 0);
  const layers = [
    { file: 'electric_whine', gain: (s, inside) => on(s) * (0.12 + 0.45 * Math.min(1, s.engineLoad)) * (inside ? 0.8 : 1), rate: (s) => 0.6 + s.speed / 22 + 0.15 * s.engineLoad },
    { file: 'electric_motor', gain: (s) => on(s) * smooth(0.05, 0.7, s.engineLoad) * 0.3, rate: (s) => 0.75 + s.speed / 30 },
    { file: 'hull_lap', gain: (s) => 0.2 * (1 - smooth(1, 5, s.speed)) },
    { file: 'hull_rush', gain: (s) => smooth(2, 10, s.speed) * (0.55 * (1 - s.foiling) * Math.max(0.2, s.wet) + 0.1 * s.foiling), rate: (s) => 0.9 + s.speed / 50 + 0.25 * s.foiling },
  ];
  const fx = { halfLength: L / 2, halfBeam: 1.0, halfHeight: 0.5, spray: 1.0, sprayFrom: -0.6, sprayTo: 1.4, struts: [[FRONT_X, -0.72], [FRONT_X, 0.72], [REAR_X, -0.55], [REAR_X, 0.55]] };
  return { model, design, layers, fx };
}
