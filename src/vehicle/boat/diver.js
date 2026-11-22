// Costa del Gzowo boats: the Manta dive boat (faceted brushed-steel wedge hull, sealed black-glass canopy, twin thruster pods, dive planes, light bars and floodlights) that runs on the surface or flies submerged with depth control.
import * as THREE from 'three';
import { Batch, F, at, box, cyl, tube, hullShape, hullSurfaces, hullPoints, buoyancySamples, propeller, flat, mergeAll } from './boatGeometry.js';
import { createBoatModel } from './boatModel.js';
import { CH, PAT } from './boatMaterials.js';

const L = 7.2;
const X0 = -L / 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const beam = (t) => 1.2 * (t < 0.5 ? 1 : 1 - 0.78 * ((t - 0.5) / 0.5) ** 1.25);
const keel = (t) => lerp(-0.5, 0.05, Math.max(0, (t - 0.45) / 0.55) ** 1.3);
const sheer = (t) => 0.9 - 0.25 * Math.max(0, (t - 0.55) / 0.45);
const SPEC = {
  length: L,
  beam,
  chine: (t) => beam(t) * 0.82,
  keel,
  chineY: (t) => Math.max(keel(t) + 0.05, lerp(-0.12, 0.25, Math.max(0, (t - 0.5) / 0.5))),
  sheer,
};
const tOf = (x) => (x - X0) / L;
const STEEL = [0.56, 0.57, 0.58, 0.3, 1, 0];
const DARK = [0.03, 0.032, 0.035, 0.35, 0.6, 0.4];
const CANOPY = { back: -1.75, ridge0: -0.95, ridge1: 0.35, front: 2.35, top: 1.62, ridgeW: 0.62, inset: 0.12 };

function canopy() {
  const c = CANOPY;
  const yb = (x) => sheer(tOf(x)) + 0.01;
  const wb = (x) => beam(tOf(x)) - c.inset;
  const P = {
    bl: V(c.back, yb(c.back), -wb(c.back)), br: V(c.back, yb(c.back), wb(c.back)),
    fl: V(c.front, yb(c.front), -wb(c.front)), fr: V(c.front, yb(c.front), wb(c.front)),
    rl0: V(c.ridge0, c.top, -c.ridgeW), rr0: V(c.ridge0, c.top, c.ridgeW),
    rl1: V(c.ridge1, c.top - 0.02, -c.ridgeW * 0.92), rr1: V(c.ridge1, c.top - 0.02, c.ridgeW * 0.92),
  };
  const tri = [];
  const quad = (a, b, cc, d) => tri.push(a, b, cc, a, cc, d);
  quad(P.bl, P.br, P.rr0, P.rl0);
  quad(P.rl0, P.rr0, P.rr1, P.rl1);
  quad(P.rl1, P.rr1, P.fr, P.fl);
  quad(P.bl, P.rl0, P.rl1, P.fl);
  quad(P.br, P.fr, P.rr1, P.rr0);
  const g = new THREE.BufferGeometry().setFromPoints(tri);
  g.computeVertexNormals();
  return { geometry: g, P };
}

export async function build(ctx) {
  const shape = hullShape(SPEC);
  const surf = hullSurfaces(shape, { nu: 12, nb: 2, ns: 2, deckFrom: 0, camber: 0, flare: 1, bottomPow: 1 });
  const model = createBoatModel(ctx, { id: 'diver', glassTint: 0x05080a, glassBase: 0.42 });
  model.cullRadius = 6;
  const b = new Batch();
  b.add(flat(surf.bottom), DARK);
  for (const s of surf.sides) b.add(flat(s), STEEL, PAT.BRUSHED);
  b.add(surf.transom, STEEL, PAT.BRUSHED);
  b.add(surf.bow, STEEL, PAT.BRUSHED);
  b.add(flat(surf.deck), STEEL, PAT.BRUSHED);
  const cp = canopy();
  const frame = (a, c) => b.add(tube([a, c], 0.025, 6), DARK);
  const P = cp.P;
  for (const [a, c] of [[P.bl, P.rl0], [P.br, P.rr0], [P.rl0, P.rr0], [P.rl0, P.rl1], [P.rr0, P.rr1], [P.rl1, P.rr1], [P.rl1, P.fl], [P.rr1, P.fr], [P.fl, P.fr], [P.bl, P.br], [P.bl, P.fl], [P.br, P.fr]]) frame(a, c);
  for (const sign of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(V(X0 + t * L, sheer(t) - 0.02, sign * (beam(t) + 0.004)));
    }
    b.add(tube(pts, 0.018, 4), DARK);
    const strip = [];
    for (let i = 0; i <= 10; i++) {
      const t = 0.08 + i * 0.075;
      strip.push(V(X0 + t * L, lerp(0.12, 0.38, Math.max(0, (t - 0.5) / 0.5)), sign * (SPEC.chine(t) + (beam(t) - SPEC.chine(t)) * 0.35 + 0.012)));
    }
    b.add(tube(strip, 0.014, 4), F.lamp, CH.ACCENT);
    b.add(at(box(0.5, 0.04, 0.5, 0.01), 2.1, 0.08, sign * 0.98, 0.25 * sign, 0, 0), STEEL, PAT.BRUSHED);
    b.add(at(box(0.18, 0.06, 0.03, 0.01), 0.6, -0.08, sign * 1.12), F.lamp, CH.FLOOD);
    b.add(at(box(0.18, 0.06, 0.03, 0.01), -2.0, -0.08, sign * 1.12), F.lamp, CH.FLOOD);
    const pod = V(X0 + 0.25, -0.32, sign * 0.78);
    b.add(at(cyl(0.2, 0.17, 1.2, 8), pod.x + 0.35, pod.y, pod.z, 0, 0, Math.PI / 2), DARK);
    b.add(at(cyl(0.21, 0.21, 0.06, 16, true), pod.x - 0.22, pod.y, pod.z, 0, 0, Math.PI / 2), F.lamp, CH.ACCENT);
    b.add(at(box(0.6, 0.32, 0.06, 0.02), pod.x + 0.4, pod.y + 0.2, pod.z), DARK);
  }
  const front = sheer(1);
  b.add(at(box(0.03, 0.04, 2 * beam(1) - 0.1, 0.01), L / 2 + 0.01, front - 0.1, 0), F.lamp, CH.WHITE);
  b.add(at(box(0.03, 0.08, 0.5, 0.02), L / 2 + 0.01, 0.15, 0), F.lamp, CH.FLOOD);
  b.add(at(box(0.08, 0.03, 0.12, 0.01), 2.6, sheer(tOf(2.6)) + 0.02, -beam(tOf(2.6)) + 0.1), F.lamp, CH.RED);
  b.add(at(box(0.08, 0.03, 0.12, 0.01), 2.6, sheer(tOf(2.6)) + 0.02, beam(tOf(2.6)) - 0.1), F.lamp, CH.GREEN);
  b.add(at(box(0.04, 0.05, 1.6, 0.01), X0 - 0.01, 0.7, 0), F.lamp, CH.WHITE);
  b.add(at(cyl(0.02, 0.02, 0.4, 6), -1.95, 1.1, 0), DARK);
  b.add(at(box(0.05, 0.05, 0.05, 0.01), -1.95, 1.32, 0), F.lamp, CH.WHITE);
  b.add(at(box(1.8, 0.06, 2.0, 0.02), -2.6, 0.9, 0), [0.1, 0.1, 0.11, 0.7, 0.2, 0], PAT.GRIP);
  const seat = (x, z) => {
    b.add(at(box(0.48, 0.1, 0.5, 0.05), x, 0.42, z), [0.03, 0.03, 0.032, 0.6, 0, 0.2]);
    b.add(at(box(0.1, 0.6, 0.48, 0.05), x - 0.26, 0.72, z, 0, 0, 0.15), [0.03, 0.03, 0.032, 0.6, 0, 0.2]);
  };
  for (const z of [0.42, -0.42]) {
    seat(0.0, z);
    seat(-1.05, z);
  }
  b.add(at(box(2.6, 0.04, 2.1, 0.02), -0.5, 0.12, 0), [0.04, 0.04, 0.045, 0.8, 0, 0]);
  b.add(at(box(0.4, 0.3, 1.8, 0.04), 0.85, 0.78, 0, 0, 0, -0.5), DARK);
  b.add(at(box(0.22, 0.005, 0.8, 0.004), 0.75, 0.94, 0, 0, 0, -0.85), F.screen, CH.SCREEN);
  model.mesh(b.build());
  model.glassMesh(cp.geometry);

  const props = [];
  for (const sign of [1, -1]) {
    const pr = model.pivot(X0 - 0.02, -0.32, sign * 0.78);
    const pb = new Batch();
    pb.add(propeller(0.15, 5).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), DARK);
    model.mesh(pb.build(), pr, false);
    props.push(pr);
  }
  const helm = model.helm;
  helm.position.set(0.62, 0.86, 0.42);
  helm.rotation.z = -0.6;
  model.group.add(helm);
  const wb = new Batch();
  wb.add(mergeAll([at(box(0.05, 0.1, 0.34, 0.02), 0, 0, 0), at(box(0.06, 0.18, 0.05, 0.02), 0, 0.02, -0.16), at(box(0.06, 0.18, 0.05, 0.02), 0, 0.02, 0.16)]), DARK);
  const yoke = model.mesh(wb.build(), helm, false);
  model.setGrips(V(0, 0.06, -0.16), V(0, 0.06, 0.16));
  model.setEntry({
    seat: V(-0.02, 0.56, 0.42),
    spot: V(0, 0, 1.95),
    prompt: V(0, 0.45, 1.65),
    exitSpot: V(0, 0, 2.1),
    extraExits: [V(X0 - 1.2, 0, 0), V(X0 - 2.0, 0, 0), V(4.4, 0, 0)],
    pedalL: V(0.5, 0.16, 0.32),
    pedalR: V(0.5, 0.16, 0.52),
    brace: V(0.3, 0.9, 0.9),
    sillY: 0.95,
    length: L,
    halfWidth: 1.2,
  });

  let time = 0;
  let spin = 0;
  model.update = (dt, s) => {
    time += dt;
    const steer = (s.steer / 0.6) * 0.5;
    spin += dt * (s.occupied ? 10 + s.engineLoad * 140 : 0);
    props[0].rotation.x = spin % (Math.PI * 2);
    props[1].rotation.x = -spin % (Math.PI * 2);
    yoke.rotation.x = -steer * 1.6;
    model.navLights(s.occupied && s.ballast < 0.5, time);
    const dive = s.ballast;
    const pulse = 0.75 + 0.25 * Math.sin(time * 3);
    model.mats.setLamp(CH.ACCENT, s.occupied ? (3 + 22 * dive * pulse) * (0.6 + 0.4 * Math.min(1, s.engineLoad + 0.3)) : 0.3);
    model.mats.setLamp(CH.FLOOD, s.occupied && (dive > 0.3 || model.visual.beam) ? 80 : 0);
    model.mats.setLamp(CH.WHITE, s.occupied ? 7 : 0.3);
  };

  const samples = buoyancySamples(shape, { along: 5, across: 3, from: 0.04, to: 0.86 }).map((p) => [p[0], p[1], p[2] * 0.4]);
  const hullPts = hullPoints(shape, 8);
  const design = {
    mass: 2600, inertia: [1700, 11000, 10500], com: [-0.3, 0.25, 0], samples, column: 1.3, topY: CANOPY.top, keelClear: 0.9,
    accel: 4.0, top: 16.5, lin: 0.03, boost: 1.25, reverse: 0.5, spool: 3,
    plane: { v0: 4.5, v1: 11, lift: 0.5, x: -0.6, hump: 6.5, width: 3, trim: 0.9, hold: 0.4, drag: 0.6, slick: 0.25 },
    dive: { flood: 3.2, blow: 2.6, rate: 1.5, minDepth: 0.5, maxDepth: 12, kp: 1.8, kd: 2.4, climb: 2.6, accel: 1.8, drag: 6 },
    latLin: 0.7, latQuad: 1.0, latX: -0.7, steerMax: 0.5, steerRate: 2.0, vector: 0.5, rudder: 0.0022,
    yawDamp: 2.0, rollDamp: 3.2, pitchDamp: 2.6, bank: 0.1, righting: 2, capsize: 0.35,
    prop: [X0 - 0.05, -0.32, 0],
    colliders: [{ points: hullPts }, { half: [1.9, 0.36, 0.7], at: [0.2, 1.26, 0] }],
    camera: { distance: 9, height: 1.9, ahead: 3, pitch: 0.17 },
    keys: { handbrake: 'KeyX', camera: 'KeyV' },
    hint: 'Exit   ·   G dive or surface   ·   Space up   ·   C down   ·   W S A D drive   ·   H floodlights',
    label: 'Board the dive boat',
  };
  const on = (s) => (s.occupied && !s.stalled ? 1 : 0);
  const smooth = (a, c, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (c - a)));
    return t * t * (3 - 2 * t);
  };
  const layers = [
    { file: 'electric_whine', gain: (s) => on(s) * (1 - s.ballast) * (0.12 + 0.4 * Math.min(1, s.engineLoad)), rate: (s) => 0.5 + s.speed / 30 + 0.12 * s.engineLoad },
    { file: 'sub_hum', gain: (s) => on(s) * s.ballast * (0.45 + 0.4 * Math.min(1, s.engineLoad)), rate: (s) => 0.85 + 0.25 * Math.min(1, s.engineLoad) },
    { file: 'bubbles', gain: (s) => s.ballast * (0.15 + 0.55 * Math.min(1, s.engineLoad + Math.abs(s.yawRate) * 0.3)), rate: (s) => 0.9 + s.speed / 25 },
    { file: 'hull_lap', gain: (s) => 0.22 * (1 - smooth(1, 5, s.speed)) * (1 - s.ballast) },
    { file: 'hull_rush', gain: (s) => smooth(2, 16, s.speed) * 0.6 * Math.max(0.2, s.wet) * (1 - s.ballast), rate: (s) => 0.85 + s.speed / 60 },
  ];
  const fx = { halfLength: L / 2, halfBeam: 1.2, halfHeight: 0.8, spray: 1.4, sprayFrom: 0, sprayTo: 2.0, thrusters: [[X0 - 0.1, -0.32, 0.78], [X0 - 0.1, -0.32, -0.78]] };
  const toggle = {
    key: 'KeyG',
    run(s) {
      s.diving = !s.diving;
      if (s.diving) s.targetDepth = 1.2;
    },
  };
  return { model, design, layers, fx, toggle };
}
