// Costa del Gzowo boats: the Gzowo Star trimaran yacht (wave-piercing main hull, two outrigger floats on sweeping arches, three-deck superstructure with flybridge helm, radar arch, teak decks and swim platform) with its heavy tuning and sound mix.
import * as THREE from 'three';
import { Batch, F, at, box, cyl, sphere, tube, grid, hullShape, hullSurfaces, hullPoints, buoyancySamples, propeller } from './boatGeometry.js';
import { createBoatModel } from './boatModel.js';
import { CH, PAT } from './boatMaterials.js';

const L = 26;
const X0 = -L / 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const beam = (t) => 2.45 * (t < 0.55 ? 0.88 + 0.12 * Math.sin((t / 0.55) * Math.PI * 0.5) : Math.pow(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2), 0.75));
const keel = (t) => -1.55 + 0.5 * smooth(0.0, 0.12, 0.12 - t) + 0.9 * smooth(0.75, 1, t) ** 1.6;
const sheer = (t) => 1.95 + 0.7 * smooth(0.2, 1, t) ** 1.4;
const SPEC = { length: L, beam, chine: (t) => beam(t) * 0.62, keel, chineY: (t) => Math.max(keel(t) + 0.1, -0.7 + 0.8 * smooth(0.6, 1, t)), sheer };
const AL = 13;
const amaBeam = (t) => 0.62 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.02))), 0.45) * (t > 0.8 ? 1 - 0.9 * smooth(0.8, 1, t) : 1);
const AMA = { length: AL, beam: amaBeam, chine: (t) => amaBeam(t) * 0.7, keel: (t) => -0.45 + 0.6 * smooth(0.75, 1, t), chineY: (t) => -0.15 + 0.5 * smooth(0.7, 1, t), sheer: (t) => 1.25 + 0.3 * smooth(0.5, 1, t) };
const AMA_X = -3.4;
const AMA_Z = 5.0;
const tOf = (x) => (x - X0) / L;
const DECK = (x) => sheer(tOf(x));
const ROOF = 4.75;
const set = (c, f) => {
  c[0] = f[0];
  c[1] = f[1];
  c[2] = f[2];
};
const WIN = [0.015, 0.02, 0.026, 0.08, 0.2, 1];

function hullPaint(x, y, z, c) {
  const sh = DECK(x);
  if (y < 0.05) set(c, [0.06, 0.065, 0.07]);
  else if (y < 0.22) set(c, [0.75, 0.6, 0.35]);
  else if (y > 0.95 && y < 1.32 && x > -7.5 && x < 6.5) set(c, WIN);
  else if (y > sh - 0.12) set(c, [0.7, 0.71, 0.72]);
}

function cabin(x0, x1, y0, y1, w, nose, tumble = 0.12) {
  const half = (x) => w * Math.sqrt(Math.max(0, 1 - Math.max(0, (x - (x1 - nose)) / nose) ** 2));
  const top = (x) => y1 - (y1 - y0) * 0.75 * smooth(x1 - nose * 1.6, x1, x) ** 1.3;
  const sides = [1, -1].map((sign) => grid(36, 6, (u, v, p) => {
    const x = x0 + (x1 - x0) * u;
    const q = sign > 0 ? v : 1 - v;
    const hy = top(x);
    p.set(x, y0 + (hy - y0) * q, sign * Math.max(0.02, half(x) * (1 - tumble * q)));
  }));
  const roof = grid(36, 8, (u, v, p) => {
    const x = x0 + (x1 - x0) * u;
    const s = v * 2 - 1;
    p.set(x, top(x) + 0.06 * (1 - s * s), s * Math.max(0.02, half(x) * (1 - tumble)));
  });
  const back = new THREE.PlaneGeometry(2 * w * (1 - tumble * 0.5), y1 - y0).rotateY(-Math.PI / 2).translate(x0, (y0 + y1) / 2, 0);
  return { sides, roof, back, half, top };
}

function arch(sign) {
  const path = (u, out) => {
    const a = u * Math.PI * 0.5;
    return out.set(-1.2 - 2.0 * u, 4.55 - Math.sin(a) * 0.2 - 3.25 * u ** 1.6, sign * (1.9 + (AMA_Z - 1.9) * Math.sin(a)));
  };
  const p = new THREE.Vector3();
  return grid(28, 12, (u, v, out) => {
    path(u, p);
    const ang = v * Math.PI * 2;
    const chord = 1.9 - 0.7 * u;
    const thick = 0.42 - 0.12 * u;
    out.set(p.x + Math.cos(ang) * chord * 0.5, p.y + Math.sin(ang) * thick, p.z);
  });
}

export async function build(ctx) {
  const shape = hullShape(SPEC);
  const surf = hullSurfaces(shape, { nu: 60, nb: 14, ns: 18, deckFrom: 0, camber: 0.08, flare: 0.8, bottomPow: 0.7 });
  const model = createBoatModel(ctx, { id: 'yacht', glassTint: 0x04070a, glassBase: 0.5, damageBox: [-14.5, 29, -1.7, 7] });
  model.cullRadius = 17;
  const b = new Batch();
  b.add(surf.bottom, [0.06, 0.065, 0.07, 0.45, 0, 0.3]);
  for (const s of surf.sides) b.add(s, [0.92, 0.92, 0.9, 0.14, 0, 1], 0, hullPaint);
  b.add(surf.transom, [0.92, 0.92, 0.9, 0.14, 0, 1], 0, hullPaint);
  b.add(surf.deck, F.teak, PAT.TEAK);
  const ama = hullShape(AMA);
  for (const sign of [1, -1]) {
    const as = hullSurfaces(ama, { nu: 36, nb: 8, ns: 8, deckFrom: 0, camber: 0.05, flare: 0.8, bottomPow: 0.8 });
    for (const g of [as.bottom, ...as.sides, as.deck]) {
      g.translate(AMA_X, 0, sign * AMA_Z);
      b.add(g, g === as.bottom ? [0.06, 0.065, 0.07, 0.45, 0, 0.3] : [0.92, 0.92, 0.9, 0.14, 0, 1], 0, g === as.bottom ? null : (x, y, z, c) => {
        if (y < 0.05) set(c, [0.06, 0.065, 0.07]);
        else if (y < 0.2) set(c, [0.75, 0.6, 0.35]);
      });
    }
    b.add(arch(sign), [0.9, 0.9, 0.88, 0.14, 0, 1]);
    b.add(at(box(0.3, 0.05, 0.12, 0.02), AMA_X + 4, 1.42, sign * (AMA_Z + 0.4)), F.lamp, sign > 0 ? CH.GREEN : CH.RED);
  }
  const main = cabin(-7.2, 7.5, 1.9, ROOF, 2.15, 3.2);
  for (const s of main.sides) b.add(s, [0.92, 0.92, 0.9, 0.14, 0, 1], 0, (x, y, z, c) => {
    const h = main.top(x);
    if (y > 2.75 && y < h - 0.35) set(c, WIN);
  });
  b.add(main.roof, [0.92, 0.92, 0.9, 0.14, 0, 1], 0, (x, y, z, c) => {
    if (x > 4.1) set(c, WIN);
  });
  b.add(main.back, WIN);
  const fly = cabin(-3.4, 3.4, ROOF, ROOF + 1.05, 1.55, 1.6, 0.18);
  for (const s of fly.sides) b.add(s, [0.9, 0.9, 0.88, 0.14, 0, 1]);
  b.add(at(box(9.4, 0.06, 3.9, 0.03), -2.2, ROOF + 0.05, 0), F.teak, PAT.TEAK);
  const hardtop = grid(16, 6, (u, v, p) => {
    const x = -2.6 + u * 5.2;
    const s = v * 2 - 1;
    p.set(x, ROOF + 2.35 + 0.08 * (1 - s * s) - 0.12 * u, s * 1.9 * (1 - 0.25 * u * u));
  });
  b.add(hardtop, [0.9, 0.9, 0.88, 0.14, 0, 1]);
  for (const [x, z] of [[-2.3, 1.7], [-2.3, -1.7], [2.2, 1.35], [2.2, -1.35]]) b.add(at(cyl(0.06, 0.07, 2.3, 10), x, ROOF + 1.2, z, z > 0 ? -0.06 : 0.06, 0, x < 0 ? -0.05 : 0.08), F.steel);
  b.add(at(cyl(0.05, 0.05, 1.6, 8), -1.2, ROOF + 3.15, 0), F.steel);
  b.add(at(box(1.8, 0.08, 0.12, 0.03), -1.2, ROOF + 3.3, 0), F.white);
  const rd = new Batch();
  rd.add(at(sphere(0.32, 1, 0.7, 1), 0, 0.05, 0.8), F.white);
  rd.add(at(sphere(0.25, 1, 0.7, 1), 0, 0, -0.8), F.white);
  rd.add(at(cyl(0.05, 0.05, 0.3, 8), 0, -0.15, 0.8), F.steel);
  b.add(at(sphere(0.06), -1.2, ROOF + 3.95, 0), F.lamp, CH.WHITE);
  b.add(at(box(1.1, 0.9, 1.7, 0.12), 2.6, ROOF + 0.45, 0.2), [0.9, 0.9, 0.88, 0.14, 0, 1]);
  b.add(at(box(0.55, 0.02, 1.4, 0.01), 2.32, ROOF + 0.95, 0.2, 0, 0, -0.5), F.screen, CH.SCREEN);
  for (const z of [0.5, -0.35]) {
    b.add(at(box(0.6, 0.45, 0.62, 0.08), 1.72, ROOF + 0.25, z), F.cream);
    b.add(at(box(0.14, 0.7, 0.6, 0.06), 1.36, ROOF + 0.7, z, 0, 0, 0.12), F.cream);
  }
  b.add(at(box(2.6, 0.5, 2.8, 0.15), -2.0, ROOF + 0.28, 0), F.cream);
  b.add(at(box(2.8, 0.45, 0.5, 0.12), -9.6, 2.55, 0), F.cream);
  b.add(at(box(0.5, 0.45, 3.6, 0.12), -10.9, 2.55, 0), F.cream);
  b.add(at(box(1.6, 0.72, 1.0, 0.04), -9.6, 2.33, 0), F.teak, PAT.TEAK);
  const pb0 = new Batch();
  pb0.add(at(box(2.2, 0.12, 4.0, 0.04), -0.9, 0, 0), F.teak, PAT.TEAK);
  pb0.add(at(box(2.0, 0.22, 3.8, 0.05), -0.85, -0.16, 0), [0.92, 0.92, 0.9, 0.14, 0, 1]);
  for (let i = 0; i < 4; i++) b.add(at(box(0.4, 0.1, 2.4, 0.03), X0 - 0.2 + i * 0.36, 0.7 + i * 0.36, 0), F.teak, PAT.TEAK);
  for (const sign of [1, -1]) {
    const top = [];
    const posts = [];
    for (let i = 0; i <= 40; i++) {
      const t = 0.02 + (i / 40) * 0.95;
      const p = V(X0 + t * L, sheer(t) + 0.95, sign * Math.max(0.05, beam(t) - 0.1));
      top.push(p);
      if (i % 4 === 0) posts.push(p);
    }
    b.add(tube(top, 0.025, 6), F.chrome);
    for (const p of posts) b.add(at(cyl(0.018, 0.018, 0.95, 6), p.x, p.y - 0.47, p.z), F.chrome);
    b.add(at(box(0.25, 0.08, 0.1, 0.02), 7.8, DECK(7.8) + 0.1, sign * (beam(tOf(7.8)) - 0.05)), F.lamp, sign > 0 ? CH.GREEN : CH.RED);
    for (let i = 0; i < 6; i++) b.add(at(box(0.7, 0.18, 0.02, 0.01), -6 + i * 2.2, 3.4, sign * (main.half(-6 + i * 2.2) * 0.94 + 0.01)), F.lamp, CH.CABIN);
  }
  b.add(at(box(0.1, 0.1, 0.3, 0.02), X0 + 0.02, 1.5, 0), F.lamp, CH.WHITE);
  b.add(at(box(0.5, 0.02, 3.2, 0.01), X0 - 0.4, 0.36, 0), F.lamp, CH.FLOOD);
  model.setHull(model.mesh(b.build()));
  const platform = model.pivot(X0, 0.42, 0);
  model.mesh(pb0.build(), platform);
  model.part('platform', platform, {
    label: 'Swim platform', half: [1.1, 0.15, 2.0], mass: 90, float: true, limit: 1.4, tearAt: 2.5, bend: [0.15, 0.3],
    zone: (lp) => (lp.x < X0 + 0.6 && lp.y < 1.4 ? 1 : 0),
  });
  const radar = model.pivot(-0.4, ROOF + 2.55, 0);
  model.mesh(rd.build(), radar);
  model.part('radar', radar, {
    label: 'Radar dome', half: [0.35, 0.25, 0.8], mass: 25, float: true, limit: 0.8, tearAt: 1.5, bend: [0.4, 0.3],
    zone: (lp) => (lp.y > ROOF + 1.6 ? 1 : 0),
  });
  model.lampAt(CH.RED, 7.8, DECK(7.8) + 0.1, -beam(tOf(7.8)));
  model.lampAt(CH.GREEN, 7.8, DECK(7.8) + 0.1, beam(tOf(7.8)));
  model.lampAt(CH.WHITE, X0, 1.5, 0);
  const ws = grid(16, 4, (u, v, p) => {
    const x = 2.6 + v * 0.55;
    const s = u * 2 - 1;
    p.set(x, ROOF + 1.05 + v * 0.5, s * (1.45 - 0.2 * v));
  });
  model.glassMesh(ws);

  const props = [];
  for (const z of [0.9, -0.9]) {
    const pr = model.pivot(X0 + 1.6, -1.3, z);
    const pb = new Batch();
    pb.add(propeller(0.55, 5, 0.12).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), F.gold);
    pb.add(at(box(0.9, 0.9, 0.08, 0.03), -0.8, -0.05, 0), F.anti);
    model.mesh(pb.build(), pr, false);
    props.push(pr);
  }
  const helm = model.helm;
  helm.position.set(2.15, ROOF + 1.05, 0.5);
  helm.rotation.z = -0.6;
  model.group.add(helm);
  const wb = new Batch();
  const ring = new THREE.TorusGeometry(0.2, 0.02, 8, 30).rotateY(Math.PI / 2);
  wb.add(ring, F.chrome);
  wb.add(at(cyl(0.04, 0.04, 0.08, 12), 0, 0, 0, 0, 0, Math.PI / 2), F.black);
  const wheelMesh = model.mesh(wb.build(), helm, false);
  model.setGrips(V(0, 0.1, -0.17), V(0, 0.1, 0.17));
  model.setEntry({
    seat: V(1.74, ROOF + 0.62, 0.5),
    spot: V(X0 - 2.2, 0, 0),
    prompt: V(X0 - 1.0, 1.6, 0),
    exitSpot: V(X0 - 2.2, 0, 0.0),
    extraExits: [V(X0 - 2.0, 0, 0), V(X0 - 2.8, 0, 0), V(X0 - 2.0, 0, 1.2), V(X0 - 2.0, 0, -1.2)],
    pedalL: V(2.25, ROOF + 0.12, 0.38),
    pedalR: V(2.25, ROOF + 0.12, 0.62),
    brace: V(2.0, ROOF + 0.9, 1.0),
    sillY: 1.2,
    length: L,
    halfWidth: 2.5,
  });

  let time = 0;
  let spin = 0;
  model.update = (dt, s) => {
    time += dt;
    const steer = (s.steer / 0.6) * 0.6;
    spin += dt * (s.occupied ? 3 + s.engineLoad * 40 : 0);
    props[0].rotation.x = spin % (Math.PI * 2);
    props[1].rotation.x = -spin % (Math.PI * 2);
    props[0].rotation.y = props[1].rotation.y = 0;
    wheelMesh.rotation.x = -steer * 3;
    model.navLights(s.occupied, time);
    model.mats.setLamp(CH.CABIN, 1.4);
    model.mats.setLamp(CH.FLOOD, model.visual.beam ? 18 : 0);
  };

  const hullSamples = buoyancySamples(shape, { along: 6, across: 3, from: 0.06, to: 0.82 }).map((p) => [p[0], p[1], p[2] * 0.45]);
  const amaSamples = [];
  for (const sign of [1, -1]) for (const x of [-8.5, -5.5, -2.5, 0.5]) amaSamples.push([x, sign * AMA_Z, 3.2, 1.25]);
  const pts = Array.from(hullPoints(shape, 14));
  const amaPts = (sign) => Array.from(hullPoints(ama, 8)).map((v, i) => (i % 3 === 0 ? v + AMA_X : i % 3 === 2 ? v + sign * AMA_Z : v));
  const design = {
    mass: 42000, inertia: [480000, 2700000, 2400000], com: [-1, 0.9, 0], samples: [...hullSamples, ...amaSamples], column: 2.4, topY: 7, restY: 0,
    accel: 1.25, top: 11.5, lin: 0.03, boost: 1.15, reverse: 0.4, spool: 0.7,
    plane: { v0: 7, v1: 13, lift: 0.12, x: -1.5, hump: 8, width: 3, trim: 0.12, hold: 0.3, drag: 0.4, slick: 0.08 },
    latLin: 0.5, latQuad: 1.2, latX: -2.0, steerMax: 0.6, steerRate: 0.7, vector: 0.35, rudder: 0.03,
    yawDamp: 0.9, rollDamp: 1.8, pitchDamp: 2.2, bank: 0.05, righting: 2.5, capsize: 0.3, mooring: 14,
    prop: [X0 + 1.6, -1.3, 0],
    dentAt: 0.35, crushAt: 3.5, dentScale: 0.14, dentLimit: 0.6, holeAt: 1.0, breachScale: 0.3, engineHit: 0.06, shatterAt: 2.5, metal: false, chips: [0.9, 0.9, 0.88],
    engine: [-9.5, 1.2, 0], burnTime: 20, blastBreach: 0.7, maxBreach: 0.9, floodTime: 300,
    colliders: [
      { points: new Float32Array(pts) },
      { points: new Float32Array(amaPts(1)) },
      { points: new Float32Array(amaPts(-1)) },
      { half: [7.1, 1.15, 2.0], at: [0.3, 3.5, 0] },
      { half: [2.5, 0.5, 1.4], at: [0, ROOF + 0.5, 0] },
    ],
    camera: { distance: 24, height: 6.5, ahead: 9, pitch: 0.2 },
    keys: { handbrake: 'KeyX', camera: 'KeyV' },
    hint: 'Exit at the stern   ·   W S throttle and astern   ·   A D helm   ·   H deck lights   ·   V camera',
    label: 'Board the yacht',
  };
  const on = (s) => (s.occupied && !s.stalled ? 1 : 0);
  const layers = [
    { file: 'yacht_diesel', gain: (s, inside) => on(s) * (0.5 + 0.2 * Math.min(1, s.engineLoad)) * (inside ? 0.7 : 1), rate: (s) => 0.85 + 0.3 * Math.min(1.2, s.engineLoad) },
    { file: 'yacht_engine', gain: (s) => on(s) * smooth(0.1, 0.8, s.engineLoad) * 0.6, rate: (s) => 0.8 + 0.3 * Math.min(1.2, s.engineLoad) + s.speed / 80 },
    { file: 'hull_lap', gain: (s) => 0.35 * (1 - smooth(1, 4, s.speed)), rate: () => 0.8 },
    { file: 'hull_rush', gain: (s) => smooth(1.5, 10, s.speed) * 0.85, rate: (s) => 0.7 + s.speed / 40 },
  ];
  const fx = { halfLength: L / 2, halfBeam: 2.5, halfHeight: 1.6, spray: 0.9, sprayFrom: 3, sprayTo: 9 };
  return { model, design, layers, fx };
}
