// Costa del Gzowo helicopter: everything bolted to the fuselage (engine cowl, tail surfaces, skids, rotor head and blades, tail rotor, cabin, controls, lamps).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FIN, Batch, at, box, cyl, sphere, tube, sweep, grid, extrude } from '../carGeometry.js';
import { section, skinPoint } from './heliBody.js';
import { TINT, tintGeometry } from './heliMaterials.js';

export const DIM = {
  mast: new THREE.Vector3(-0.05, 2.86, 0),
  rotorRadius: 4.7,
  chord: 0.26,
  blades: 3,
  tailRotor: new THREE.Vector3(-6.08, 1.96, -0.33),
  tailRadius: 0.56,
  skidZ: 1.02,
  skidFront: 1.5,
  skidRear: -1.55,
  seat: new THREE.Vector3(0.72, 1.0, -0.36),
  floor: 0.615,
  cyclic: new THREE.Vector3(1.06, 0.63, -0.36),
  collective: new THREE.Vector3(0.48, 0.72, -0.63),
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GREY = [0.045, 0.047, 0.05];
const YELLOW = [0.86, 0.58, 0.04];
const SEAT_DARK = [0.035, 0.04, 0.045];
const SEAT_TEAL = [0.02, 0.17, 0.19];

function cowl() {
  const hw = (u) => 0.43 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.25) * 0.5), 0.7) * (1 - 0.55 * Math.pow(Math.max(0, (u - 0.45) / 0.55), 1.6));
  const hh = (u) => 0.27 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 2.4) * 0.5), 0.8) * (1 - 0.8 * Math.pow(Math.max(0, (u - 0.4) / 0.6), 1.5));
  return grid(46, 22, (u, v, p) => {
    const x = 0.66 - u * 3.0;
    const phi = (v * 2 - 1) * Math.PI * 0.5;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    p.set(x, section(x).top - 0.07 + hh(u) * Math.pow(c, 0.75) - 0.05 * (1 - c), hw(u) * Math.sign(s) * Math.pow(Math.abs(s), 0.8));
  });
}

function airfoil(chord, thick = 0.12) {
  const pts = [];
  const n = 9;
  const yt = (x) => 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  for (let i = 0; i <= n; i++) {
    const x = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    pts.push([(x - 0.27) * chord, yt(x) * chord]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const x = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    pts.push([(x - 0.27) * chord, -yt(x) * chord * 0.72]);
  }
  return pts;
}

function bladeSpan(r0, r1, radius, chord, steps) {
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const r = r0 + ((r1 - r0) * i) / steps;
    path.push(V(r, -0.055 * (r / radius) ** 2, 0));
  }
  const at01 = (k) => (r0 + (r1 - r0) * k) / radius;
  return sweep(path, airfoil(chord), {
    closed: true,
    twist: (k) => 0.15 - 0.19 * at01(k),
    scale: (k) => {
      const q = at01(k);
      return q > 0.965 ? Math.max(0.04, Math.sqrt(Math.max(0, 1 - ((q - 0.965) / 0.035) ** 2)) * 0.92 + 0.04) : q < 0.19 ? 0.55 + 0.45 * ((q - 0.12) / 0.07) : 1;
    },
  });
}

function mainBlade() {
  const R = DIM.rotorRadius;
  const b = new Batch();
  b.add(bladeSpan(0.58, 4.22, R, DIM.chord, 22), FIN.satin, 0, GREY);
  b.add(bladeSpan(4.22, 4.4, R, DIM.chord, 2), FIN.satin, 0, YELLOW);
  b.add(bladeSpan(4.4, 4.52, R, DIM.chord, 2), FIN.satin, 0, GREY);
  b.add(bladeSpan(4.52, R, R, DIM.chord, 8), FIN.satin, 0, YELLOW);
  b.add(at(box(0.5, 0.075, 0.13, 0.025), 0.4, 0, 0), FIN.alu);
  b.add(at(box(0.16, 0.05, 0.3, 0.02), 0.62, 0, 0.02), FIN.darkChrome);
  for (const dz of [-0.04, 0.04]) b.add(at(cyl(0.016, 0.016, 0.1, 10), 0.6, 0, dz), FIN.chrome);
  b.add(at(box(0.05, 0.03, 0.14, 0.01), 0.3, 0.02, -0.13), FIN.alu);
  return b.build();
}

function tailBlades() {
  const b = new Batch();
  for (const s of [1, -1]) {
    b.add(at(box(0.095, 0.4, 0.014, 0.006), 0, s * 0.3, 0), FIN.satin, 0, GREY);
    b.add(at(box(0.095, 0.07, 0.015, 0.006), 0, s * 0.515, 0), FIN.satin, 0, [0.8, 0.8, 0.78]);
    b.add(at(box(0.095, 0.05, 0.016, 0.006), 0, s * 0.455, 0), FIN.satin, 0, [0.72, 0.1, 0.05]);
    b.add(at(box(0.05, 0.12, 0.03, 0.01), 0, s * 0.08, 0), FIN.alu);
  }
  b.add(at(cyl(0.045, 0.045, 0.07, 14), 0, 0, 0, Math.PI / 2), FIN.darkChrome);
  b.add(at(sphere(0.04, 1, 1, 0.6, 12, 8), 0, 0, -0.04), FIN.alu);
  return b.build();
}

function seat(leather, solid, x, z, tint) {
  const y = DIM.seat.y - 0.1;
  leather.add(at(box(0.46, 0.1, 0.44, 0.04), x + 0.03, y - 0.05, z, 0, 0, 0.07), FIN.black, 0, tint);
  leather.add(at(box(0.1, 0.6, 0.44, 0.04), x - 0.27, y + 0.3, z, 0, 0, 0.2), FIN.black, 0, tint);
  leather.add(at(box(0.09, 0.17, 0.24, 0.04), x - 0.37, y + 0.71, z, 0, 0, 0.16), FIN.black, 0, SEAT_DARK);
  for (const s of [-1, 1]) leather.add(at(box(0.44, 0.07, 0.07, 0.03), x + 0.03, y - 0.02, z + s * 0.2, 0, 0, 0.07), FIN.black, 0, SEAT_DARK);
  for (let i = 0; i < 4; i++) leather.add(at(box(0.014, 0.012, 0.36, 0.004), x - 0.12 + i * 0.1, y + 0.006 + i * 0.007, z, 0, 0, 0.07), FIN.black, 0, SEAT_DARK);
  solid.add(at(box(0.36, DIM.seat.y - 0.2 - DIM.floor, 0.36, 0.02), x, (DIM.seat.y - 0.2 + DIM.floor) / 2, z), FIN.plastic);
  for (const s of [-1, 1]) {
    solid.add(tube([V(x - 0.31, y + 0.62, z + s * 0.13), V(x - 0.2, y + 0.36, z + s * 0.12), V(x - 0.05, y + 0.08, z + s * 0.03)], 0.012, 4), FIN.rubber, 0, [0.02, 0.02, 0.022]);
  }
  solid.add(at(box(0.05, 0.03, 0.06, 0.008), x - 0.03, y + 0.09, z), FIN.chrome);
}

function screenTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#05080a';
  g.fillRect(0, 0, 512, 384);
  if (kind === 'flight') {
    g.save();
    g.translate(256, 180);
    g.rotate(-0.06);
    g.fillStyle = '#2f79c9';
    g.fillRect(-400, -400, 800, 400);
    g.fillStyle = '#8a5a2b';
    g.fillRect(-400, 0, 800, 400);
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-400, 0);
    g.lineTo(400, 0);
    for (let i = 1; i <= 3; i++) {
      for (const s of [-1, 1]) {
        g.moveTo(-28 - (i % 2) * 22, s * i * 34);
        g.lineTo(28 + (i % 2) * 22, s * i * 34);
      }
    }
    g.stroke();
    g.restore();
    g.strokeStyle = '#ffd21f';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(150, 180);
    g.lineTo(220, 180);
    g.lineTo(256, 204);
    g.lineTo(292, 180);
    g.lineTo(362, 180);
    g.stroke();
    g.fillStyle = 'rgba(4,8,10,0.72)';
    g.fillRect(0, 0, 86, 384);
    g.fillRect(426, 0, 86, 384);
    g.fillRect(0, 318, 512, 66);
    g.fillStyle = '#e8f1f4';
    g.font = '600 26px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      g.fillText(String(120 - i * 20), 43, 60 + i * 62);
      g.fillText(String(900 - i * 100), 469, 60 + i * 62);
    }
    g.fillStyle = '#3fe07a';
    g.fillText('HDG 084', 256, 360);
  } else {
    g.strokeStyle = '#123a44';
    g.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.moveTo(i * 46, 0);
      g.lineTo(i * 46, 384);
      g.moveTo(0, i * 46);
      g.lineTo(512, i * 46);
      g.stroke();
    }
    g.strokeStyle = '#1f9bb5';
    g.lineWidth = 26;
    g.beginPath();
    g.moveTo(232, -10);
    g.bezierCurveTo(300, 120, 190, 240, 268, 400);
    g.stroke();
    g.strokeStyle = '#d9a441';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-10, 200);
    g.lineTo(522, 188);
    g.stroke();
    g.fillStyle = '#ff5fa2';
    g.beginPath();
    g.moveTo(256, 172);
    g.lineTo(272, 214);
    g.lineTo(256, 204);
    g.lineTo(240, 214);
    g.fill();
    g.fillStyle = '#e8f1f4';
    g.font = '600 24px "Helvetica Neue", Arial, sans-serif';
    g.fillText('GZOWO SPRINGS', 300, 170);
    g.fillStyle = '#3fe07a';
    g.fillText('TQ 62%   N2 100%   FUEL 184 kg', 20, 364);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildParts() {
  const paint = [];
  const solid = new Batch();
  const rotorSolid = new Batch();
  const doorSolid = new Batch();
  const leather = new Batch();

  paint.push(tintGeometry(cowl(), TINT.white));
  const finShape = new THREE.Shape([[-5.52, 1.7], [-6.0, 2.98], [-6.4, 2.98], [-6.3, 1.62], [-6.42, 1.04], [-6.22, 1.0], [-5.8, 1.5]].map(([x, y]) => new THREE.Vector2(x, y)));
  paint.push(tintGeometry(at(extrude(finShape, 0.05, 0.014, 4), 0, 0, -0.025), TINT.teal));
  paint.push(tintGeometry(at(box(0.46, 0.036, 1.92, 0.016), -4.72, 1.6, 0), TINT.teal));
  for (const s of [-1, 1]) paint.push(tintGeometry(at(box(0.44, 0.38, 0.03, 0.013), -4.75, 1.63, s * 0.96, 0, 0, -0.12), TINT.coral));
  paint.push(tintGeometry(at(cyl(0.1, 0.17, 0.3, 28), DIM.mast.x, 2.42, 0), TINT.white));
  paint.push(tintGeometry(at(sphere(0.13, 1.5, 0.75, 0.9, 16, 10), -6.08, 1.96, -0.12), TINT.teal));

  solid.add(at(cyl(0.042, 0.042, 0.62, 16), DIM.mast.x, 2.56, 0), FIN.alu);
  solid.add(at(cyl(0.17, 0.17, 0.03, 28), DIM.mast.x, 2.6, 0), FIN.darkChrome);
  for (const a of [0.6, 2.7, 4.8]) solid.add(tube([V(DIM.mast.x + Math.cos(a) * 0.15, 2.6, Math.sin(a) * 0.15), V(DIM.mast.x + Math.cos(a) * 0.13, 2.38, Math.sin(a) * 0.13)], 0.011, 6), FIN.alu);

  rotorSolid.add(at(cyl(0.15, 0.15, 0.026, 28), 0, -0.225, 0), FIN.alu);
  rotorSolid.add(at(cyl(0.21, 0.24, 0.07, 6), 0, 0, 0), FIN.alu);
  rotorSolid.add(at(sphere(0.15, 1, 0.5, 1, 20, 10), 0, 0.045, 0), FIN.darkChrome);
  rotorSolid.add(at(cyl(0.06, 0.06, 0.2, 14), 0, -0.12, 0), FIN.darkChrome);
  for (let i = 0; i < DIM.blades; i++) {
    const a = (i * Math.PI * 2) / DIM.blades + 0.5;
    rotorSolid.add(tube([V(Math.cos(a) * 0.14, -0.215, -Math.sin(a) * 0.14), V(Math.cos(a - 0.5) * 0.3, 0.0, -Math.sin(a - 0.5) * 0.3)], 0.009, 6), FIN.chrome);
  }

  for (const s of [-1, 1]) {
    const z = s * DIM.skidZ;
    solid.add(tube([V(DIM.skidRear, 0.07, z), V(DIM.skidRear + 0.12, 0.044, z), V(-0.5, 0.042, z), V(0.9, 0.042, z), V(DIM.skidFront, 0.046, z), V(1.72, 0.11, z), V(1.86, 0.24, z)], 0.042, 12), FIN.satin, 0, [0.06, 0.062, 0.066]);
    solid.add(at(sphere(0.043, 1, 1, 1, 10, 8), 1.86, 0.24, z), FIN.satin, 0, [0.06, 0.062, 0.066]);
    for (const x of [-0.9, 0.2, 1.2]) solid.add(at(box(0.26, 0.012, 0.07, 0.004), x, 0.004, z), FIN.alu);
    solid.add(at(box(0.34, 0.022, 0.13, 0.008), 1.02, 0.34, s * 0.9, s * 0.1), FIN.alu);
    for (let i = 0; i < 5; i++) solid.add(at(box(0.3, 0.006, 0.012), 1.02, 0.353, s * (0.85 + i * 0.025)), FIN.rubber);
  }
  for (const [x, top] of [[1.02, 0.56], [-0.8, 0.6]]) {
    solid.add(tube([V(x, 0.05, -1.02), V(x, 0.2, -0.95), V(x, top - 0.08, -0.62), V(x, top, -0.3), V(x, top, 0.3), V(x, top - 0.08, 0.62), V(x, 0.2, 0.95), V(x, 0.05, 1.02)], 0.034, 10), FIN.satin, 0, [0.06, 0.062, 0.066]);
    for (const s of [-1, 1]) solid.add(at(cyl(0.05, 0.05, 0.1, 12), x, 0.052, s * 1.02, 0, 0, Math.PI / 2), FIN.darkChrome);
  }

  solid.add(tube([V(-1.45, 2.12, 0.16), V(-1.85, 2.2, 0.19), V(-2.2, 2.31, 0.2)], 0.075, 14), FIN.darkChrome);
  solid.add(at(cyl(0.068, 0.068, 0.02, 14), -2.19, 2.307, 0.2, 0, 0, Math.PI / 2 - 0.3), FIN.soot);
  for (const s of [-1, 1]) {
    solid.add(at(box(0.62, 0.15, 0.012), -0.28, 2.17, s * 0.378, s * -0.32), FIN.mesh);
    for (let i = 0; i < 7; i++) solid.add(at(box(0.6, 0.008, 0.02), -0.28, 2.115 + i * 0.019, s * (0.392 - i * 0.006), s * -0.32), FIN.satin);
    solid.add(at(box(0.3, 0.1, 0.012), -1.1, 2.12, s * 0.33, s * -0.4), FIN.mesh);
  }
  solid.add(at(box(0.24, 0.3, 0.012, 0.004), -0.9, 0.42, 0, 0, 0, -0.35), FIN.plastic, 0, [0.78, 0.78, 0.76]);
  solid.add(at(box(0.16, 0.2, 0.012, 0.004), 0.3, 0.44, 0, 0, 0, -0.3), FIN.plastic, 0, [0.78, 0.78, 0.76]);
  solid.add(tube([V(-3.2, 1.78, 0), V(-3.26, 2.1, 0), V(-3.5, 2.3, 0)], 0.007, 5), FIN.satin);
  solid.add(tube([V(2.19, 0.88, 0.22), V(2.36, 0.87, 0.22)], 0.011, 8), FIN.alu);
  solid.add(tube([V(-6.3, 1.06, 0), V(-6.5, 0.94, 0), V(-6.62, 0.9, 0)], 0.016, 8), FIN.darkChrome);
  solid.add(at(cyl(0.085, 0.085, 0.26, 16), -6.08, 1.96, -0.16, Math.PI / 2), FIN.alu);
  solid.add(tube([V(-2.6, 1.82, 0), V(-4.3, 1.775, 0), V(-5.9, 1.76, 0)], 0.035, 8), FIN.satin, 0, [0.7, 0.69, 0.66]);
  const handle = skinPoint(0.24, 0.6);
  solid.add(at(box(0.14, 0.03, 0.02, 0.006), handle.x, handle.y, handle.z + 0.012), FIN.darkChrome);
  doorSolid.add(at(box(0.14, 0.03, 0.02, 0.006), handle.x, handle.y, -handle.z - 0.012), FIN.darkChrome);
  doorSolid.add(tube([V(0.3, 1.02, -0.69), V(0.42, 1.06, -0.66), V(0.56, 1.02, -0.69)], 0.012, 6), FIN.plastic);

  solid.add(at(box(2.75, 0.03, 1.2, 0.01), 0.4, DIM.floor - 0.015, 0), FIN.carpet, 0, [0.06, 0.062, 0.066]);
  solid.add(at(box(0.04, 1.25, 1.34, 0.01), -1.0, 1.3, 0), FIN.plastic, 0, [0.3, 0.29, 0.27]);
  solid.add(at(box(0.3, 0.52, 0.36, 0.03), 1.56, 0.87, 0), FIN.plastic);
  solid.add(at(box(0.36, 0.26, 0.98, 0.05), 1.6, 1.22, 0), FIN.black);
  solid.add(at(box(0.3, 0.03, 1.04, 0.012), 1.5, 1.36, 0, 0, 0, 0.08), FIN.black);
  solid.add(at(box(0.5, 0.24, 0.2, 0.03), 1.22, 0.74, 0), FIN.plastic);
  for (let i = 0; i < 6; i++) solid.add(at(cyl(0.012, 0.012, 0.012, 10), 1.1 + (i % 3) * 0.07, 0.865, -0.04 + Math.floor(i / 3) * 0.08), i === 4 ? FIN.caliper : FIN.chrome);
  for (const s of [-1, 1]) {
    for (const dz of [-0.1, 0.1]) {
      solid.add(at(box(0.02, 0.1, 0.09, 0.006), 1.5, 0.74, s * 0.36 + dz, 0, 0, -0.5), FIN.alu);
      solid.add(tube([V(1.5, 0.7, s * 0.36 + dz), V(1.62, 0.63, s * 0.36 + dz)], 0.01, 5), FIN.satin);
    }
  }
  seat(leather, solid, DIM.seat.x, -0.36, SEAT_TEAL);
  seat(leather, solid, DIM.seat.x, 0.36, SEAT_TEAL);
  leather.add(at(box(0.46, 0.1, 1.24, 0.04), -0.42, DIM.seat.y - 0.15, 0, 0, 0, 0.07), FIN.black, 0, SEAT_TEAL);
  leather.add(at(box(0.1, 0.6, 1.24, 0.04), -0.72, DIM.seat.y + 0.2, 0, 0, 0, 0.2), FIN.black, 0, SEAT_TEAL);
  solid.add(at(box(0.36, DIM.seat.y - 0.2 - DIM.floor, 1.2, 0.02), -0.45, (DIM.seat.y - 0.2 + DIM.floor) / 2, 0), FIN.plastic);

  const stick = (grip) => {
    const b = new Batch();
    b.add(tube([V(0, 0, 0), V(-0.02, 0.2, 0), V(-0.1, 0.36, 0), V(-0.1, 0.44, 0)], 0.013, 8), FIN.satin);
    b.add(at(cyl(0.021, 0.019, 0.11, 12), -0.1, 0.49, 0), FIN.rubber);
    b.add(at(box(0.04, 0.03, 0.05, 0.01), -0.11, 0.55, 0), FIN.plastic);
    b.add(at(sphere(0.006, 1, 1, 1, 6, 5), -0.125, 0.565, 0.012), grip);
    b.add(at(cyl(0.04, 0.03, 0.05, 12), 0, 0.01, 0), FIN.rubber);
    return b.build();
  };
  const lever = () => {
    const b = new Batch();
    b.add(tube([V(0, 0, 0), V(0.34, 0.16, 0)], 0.015, 8), FIN.satin);
    b.add(at(cyl(0.024, 0.024, 0.13, 12), 0.4, 0.19, 0, 0, 0, Math.PI / 2 - 0.44), FIN.rubber);
    b.add(at(box(0.05, 0.035, 0.05, 0.01), 0.48, 0.225, 0), FIN.plastic);
    return b.build();
  };

  return {
    paint: mergeGeometries(paint, false),
    solid: solid.build(),
    rotorSolid: rotorSolid.build(),
    doorSolid: doorSolid.build(),
    leather: leather.build(),
    blade: mainBlade(),
    tailBlades: tailBlades(),
    cyclic: stick(FIN.caliper),
    collective: lever(),
    screens: { flight: screenTexture('flight'), map: screenTexture('map') },
    doorHandle: new THREE.Vector3(handle.x, handle.y, -handle.z - 0.03),
  };
}
