// Costa del Gzowo: procedural traffic vehicles (sedan, hatchback, pickup, van) lofted from side, plan and section curves into paint, glass and trim shells with lamp regions, plus one shared wheel.
import * as THREE from 'three';

const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

export const LAMP = { NONE: 0, HEAD: 1, TAIL: 2, LEFT: 3, RIGHT: 4, REVERSE: 5 };

export const CAR_TYPES = {
  sedan: {
    len: 4.72, half: 0.91, wheelbase: 2.76, radius: 0.33, track: 1.56, clear: 0.19, belt: 0.93, crown: 0.035, tumble: 0.17,
    top: [[2.36, 0.6], [2.25, 0.73], [1.9, 0.8], [0.95, 0.94], [0.2, 1.4], [-0.95, 1.42], [-1.72, 1.02], [-2.2, 0.98], [-2.36, 0.74]],
    cab: [0.95, 0.2, -0.95, -1.72], pillar: -0.32, sideGlass: [0.82, -1.5], rearGlass: true, seat: [-0.02, 0.4, -0.37], mass: 1450,
  },
  hatch: {
    len: 4.08, half: 0.88, wheelbase: 2.56, radius: 0.315, track: 1.52, clear: 0.18, belt: 0.92, crown: 0.035, tumble: 0.16,
    top: [[2.04, 0.6], [1.94, 0.74], [1.6, 0.82], [0.8, 0.95], [0.1, 1.45], [-1.25, 1.44], [-1.86, 1.0], [-2.04, 0.72]],
    cab: [0.8, 0.1, -1.25, -1.86], pillar: -0.38, sideGlass: [0.68, -1.55], rearGlass: true, seat: [-0.1, 0.41, -0.36], mass: 1250,
  },
  pickup: {
    len: 5.3, half: 0.95, wheelbase: 3.3, radius: 0.385, track: 1.64, clear: 0.27, belt: 1.12, crown: 0.03, tumble: 0.15,
    top: [[2.65, 0.74], [2.55, 0.9], [2.2, 1.0], [1.25, 1.12], [0.62, 1.74], [-0.42, 1.76], [-0.58, 1.14], [-2.55, 1.14], [-2.65, 0.9]],
    cab: [1.25, 0.62, -0.42, -0.58], pillar: 0.1, sideGlass: [1.12, -0.4], rearGlass: true, bed: [-0.7, -2.5], seat: [0.3, 0.6, -0.4], mass: 2000,
  },
  van: {
    len: 5.0, half: 0.97, wheelbase: 3.1, radius: 0.35, track: 1.66, clear: 0.2, belt: 1.08, crown: 0.045, tumble: 0.1,
    top: [[2.5, 0.66], [2.42, 0.86], [2.1, 0.98], [1.62, 1.1], [1.05, 1.92], [-2.32, 1.95], [-2.46, 1.5], [-2.5, 0.8]],
    cab: [1.62, 1.05, -2.32, -2.46], pillar: 0.52, sideGlass: [1.5, 0.5], rearGlass: false, seat: [0.82, 0.62, -0.42], mass: 1850,
  },
};

function topAt(spec, x) {
  const t = spec.top;
  if (x >= t[0][0]) return t[0][1];
  for (let i = 0; i < t.length - 1; i++) {
    if (x <= t[i][0] && x >= t[i + 1][0]) {
      const k = (t[i][0] - x) / (t[i][0] - t[i + 1][0]);
      return mix(t[i][1], t[i + 1][1], k * k * (3 - 2 * k) * 0.35 + k * 0.65);
    }
  }
  return t[t.length - 1][1];
}

function section(spec, x) {
  const hl = spec.len / 2;
  const dn = hl - x;
  const dt = x + hl;
  const round = (d, e) => 1 - Math.pow(1 - Math.min(1, d / e), 2.4);
  const w = spec.half * (0.66 + 0.34 * round(dn, 0.6)) * (0.7 + 0.3 * round(dt, 0.5));
  const top = topAt(spec, x);
  const belt = Math.min(spec.belt, top - 0.045);
  const cabin = sm(belt + 0.05, belt + 0.26, top) * (x < spec.cab[0] + 0.05 && x > spec.cab[3] - 0.05 ? 1 : 0);
  let sill = spec.clear + 0.1 * (1 - round(dn, 0.45)) + 0.12 * (1 - round(dt, 0.4));
  const arch = spec.radius * 1.17;
  for (const ax of [spec.wheelbase / 2, -spec.wheelbase / 2]) {
    const d = Math.abs(x - ax);
    if (d < arch) sill = Math.max(sill, Math.sqrt(arch * arch - d * d) + spec.radius * 0.98 - 0.0);
  }
  sill = Math.min(sill, belt - 0.12);
  const mid = mix(sill, belt, 0.52);
  const wr = w - spec.tumble;
  const under = [[spec.clear + 0.02, 0], [spec.clear, w * 0.5], [Math.min(sill, spec.clear + 0.12), w - 0.1], [sill, w - 0.03]];
  const side = [[sill, w - 0.03], [sill + 0.05, w - 0.008], [mid, w], [belt - 0.07, w - 0.006], [belt, w - 0.024]];
  const bed = spec.bed && x < spec.bed[0] && x > spec.bed[1];
  const deck = bed
    ? [[belt, w - 0.024], [belt + 0.012, w - 0.05], [belt + 0.008, w - 0.1], [belt - 0.42, w - 0.13], [belt - 0.44, w * 0.4], [belt - 0.44, 0]]
    : [[belt, w - 0.024], [mix(belt, top, 0.62), w - 0.055], [top - 0.012, w - 0.14], [top, w * 0.52], [top + spec.crown * 0.4, w * 0.26], [top + spec.crown * 0.5, 0]];
  const cab = [[belt, w - 0.024], [belt + 0.022, w - 0.045], [top - 0.075, wr + 0.012], [top - 0.018, wr - 0.04], [top + spec.crown * 0.75, wr * 0.55], [top + spec.crown, 0]];
  const upper = deck.map((p, i) => [mix(p[0], cab[i][0], cabin), mix(p[1], cab[i][1], cabin)]);
  return { under, side, upper, w, top, belt, cabin, sill };
}

function stations(spec) {
  const hl = spec.len / 2;
  const xs = new Set();
  const add = (x) => xs.add(Math.round(Math.min(hl, Math.max(-hl, x)) * 1000) / 1000);
  for (const e of [0, 0.012, 0.035, 0.07, 0.12, 0.19, 0.28, 0.4, 0.55]) {
    add(hl - e);
    add(-hl + e);
  }
  for (let x = -hl + 0.7; x < hl - 0.6; x += 0.2) add(x);
  for (const ax of [spec.wheelbase / 2, -spec.wheelbase / 2]) {
    const arch = spec.radius * 1.17;
    for (let k = -6; k <= 6; k++) add(ax + Math.sin((k / 6) * Math.PI * 0.5) * arch);
  }
  for (const p of spec.top) add(p[0]);
  for (const c of spec.cab) for (const e of [-0.04, 0, 0.04]) add(c + e);
  for (const e of [-0.055, 0.055]) add(spec.pillar + e);
  for (const g of spec.sideGlass) add(g);
  if (spec.bed) for (const b of spec.bed) for (const e of [-0.03, 0.03]) add(b + e);
  return [...xs].sort((a, b) => b - a);
}

class Shell {
  constructor(extra) {
    this.pos = [];
    this.idx = [];
    this.color = extra ? [] : null;
    this.lamp = extra ? [] : null;
  }

  quad(a, b, c, d, out, color, lamp = 0) {
    const ux = c[0] - a[0];
    const uy = c[1] - a[1];
    const uz = c[2] - a[2];
    const vx = d[0] - b[0];
    const vy = d[1] - b[1];
    const vz = d[2] - b[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const flip = nx * out[0] + ny * out[1] + nz * out[2] < 0;
    const k = this.pos.length / 3;
    for (const p of flip ? [a, d, c, b] : [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      if (this.color) {
        this.color.push(color[0], color[1], color[2], color[3] ?? 0.5);
        this.lamp.push(lamp);
      }
    }
    this.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }

  box(cx, cy, cz, hx, hy, hz, color, lamp = 0) {
    const p = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
    const faces = [[[1, 0, 0], [1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, 0, 0], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]], [[0, 1, 0], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[0, 0, -1], [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]]];
    for (const [n, a, b, c, d] of faces) this.quad(p(...a), p(...b), p(...c), p(...d), n, color, lamp);
  }

  geometry(smooth) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setIndex(this.idx);
    if (this.color) {
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 4));
      g.setAttribute('aLamp', new THREE.Float32BufferAttribute(this.lamp, 1));
    }
    if (!smooth) {
      g.computeVertexNormals();
      return g;
    }
    const map = new Map();
    const n = this.pos.length / 3;
    const acc = new Float32Array(n * 3);
    const flat = g.clone();
    flat.computeVertexNormals();
    const fn = flat.attributes.normal.array;
    const key = (i) => `${Math.round(this.pos[i * 3] * 2000)},${Math.round(this.pos[i * 3 + 1] * 2000)},${Math.round(this.pos[i * 3 + 2] * 2000)}`;
    const groups = [];
    for (let i = 0; i < n; i++) {
      const k = key(i);
      let list = map.get(k);
      if (!list) map.set(k, (list = []));
      list.push(i);
      groups.push(list);
    }
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (const j of groups[i]) {
        const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2];
        if (d < smooth) continue;
        x += fn[j * 3];
        y += fn[j * 3 + 1];
        z += fn[j * 3 + 2];
      }
      const l = Math.hypot(x, y, z) || 1;
      acc[i * 3] = x / l;
      acc[i * 3 + 1] = y / l;
      acc[i * 3 + 2] = z / l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(acc, 3));
    return g;
  }
}

const BLACK = [0.02, 0.02, 0.022, 0.75];
const DARK = [0.045, 0.045, 0.05, 0.55];
const CHROME = [0.62, 0.63, 0.65, 0.2];
const SEAT = [0.09, 0.08, 0.075, 0.85];

export function buildCar(type) {
  const spec = CAR_TYPES[type];
  const hl = spec.len / 2;
  const paint = new Shell(false);
  const glass = new Shell(false);
  const trim = new Shell(true);
  const xs = stations(spec);
  const rings = xs.map((x) => ({ x, ...section(spec, x) }));
  const [a0, a1, c1, c0] = spec.cab;
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const xm = (A.x + B.x) / 2;
    const front = hl - xm;
    const rear = xm + hl;
    for (const s of [1, -1]) {
      const P = (ring, list, k) => [ring.x, list[k][0], list[k][1] * s];
      for (let k = 0; k < 3; k++) trim.quad(P(A, A.under, k), P(A, A.under, k + 1), P(B, B.under, k + 1), P(B, B.under, k), [0, -1, s * 0.4], BLACK);
      for (let k = 0; k < 4; k++) {
        const a = P(A, A.side, k);
        const b = P(A, A.side, k + 1);
        const c = P(B, B.side, k + 1);
        const d = P(B, B.side, k);
        const ym = (a[1] + b[1] + c[1] + d[1]) / 4;
        const zm = Math.abs(a[2] + b[2] + c[2] + d[2]) / 4;
        const out = [front < 0.5 ? 1.2 : rear < 0.45 ? -1.2 : 0, 0.1, s];
        const lampBand = ym > A.belt - (A.belt - A.sill) * 0.52 && ym < A.belt - 0.02;
        if (front < 0.36 && lampBand && zm > spec.half * 0.45) trim.quad(a, b, c, d, out, front < 0.3 && zm > spec.half * 0.62 && ym > A.belt - 0.1 ? [1, 0.55, 0.1, 0.25] : [0.95, 0.93, 0.85, 0.2], front < 0.3 && zm > spec.half * 0.62 && ym > A.belt - 0.1 ? (s > 0 ? LAMP.RIGHT : LAMP.LEFT) : LAMP.HEAD);
        else if (rear < 0.3 && lampBand && zm > spec.half * 0.42) trim.quad(a, b, c, d, out, ym < A.belt - 0.26 ? [1, 0.5, 0.08, 0.25] : [0.75, 0.03, 0.02, 0.25], ym < A.belt - 0.26 ? (s > 0 ? LAMP.RIGHT : LAMP.LEFT) : LAMP.TAIL);
        else if ((front < 0.55 || rear < 0.5) && ym < spec.clear + 0.2) trim.quad(a, b, c, d, out, DARK);
        else if (k === 0 && front > 0.55 && rear > 0.5) trim.quad(a, b, c, d, out, DARK);
        else paint.quad(a, b, c, d, out);
      }
    }
    const U = (ring, k) => (k <= 5 ? [ring.x, ring.upper[k][0], ring.upper[k][1]] : [ring.x, ring.upper[10 - k][0], -ring.upper[10 - k][1]]);
    for (let k = 0; k < 10; k++) {
      const q = k < 5 ? k : 9 - k;
      const a = U(A, k);
      const b = U(A, k + 1);
      const c = U(B, k + 1);
      const d = U(B, k);
      const zs = Math.sign(a[2] + b[2] + c[2] + d[2]) || 1;
      const out = [front < 0.4 ? 0.8 : rear < 0.4 ? -0.8 : 0, 1, q < 2 ? zs * 2 : zs * 0.2];
      const inCab = A.cabin > 0.5 && B.cabin > 0.5;
      const screen = xm < a0 && xm > a1;
      const back = xm < c1 && xm > c0;
      const roof = xm <= a1 && xm >= c1;
      let target = paint;
      if (inCab || screen || back) {
        if (q >= 2 && screen && Math.min(A.cabin, B.cabin) > 0.02) target = glass;
        else if (q >= 2 && back && spec.rearGlass && Math.min(A.cabin, B.cabin) > 0.02) target = glass;
        else if (q === 1 && roof && xm < spec.sideGlass[0] && xm > spec.sideGlass[1] && Math.abs(xm - spec.pillar) > 0.055) target = glass;
      }
      if (target === paint && spec.bed && xm < spec.bed[0] && xm > spec.bed[1] && q >= 3) trim.quad(a, b, c, d, out, DARK);
      else target.quad(a, b, c, d, out);
    }
  }
  for (const [ring, dir] of [[rings[0], 1], [rings[rings.length - 1], -1]]) {
    const loop = [];
    for (let k = 0; k <= 3; k++) loop.push([ring.x, ring.under[k][0], ring.under[k][1]]);
    for (let k = 1; k <= 4; k++) loop.push([ring.x, ring.side[k][0], ring.side[k][1]]);
    for (let k = 1; k <= 5; k++) loop.push([ring.x, ring.upper[k][0], ring.upper[k][1]]);
    const cy = (ring.top + spec.clear) / 2;
    for (const s of [1, -1]) {
      for (let k = 0; k < loop.length - 1; k++) {
        const a = [ring.x, cy, 0];
        const b = [loop[k][0], loop[k][1], loop[k][2] * s];
        const c = [loop[k + 1][0], loop[k + 1][1], loop[k + 1][2] * s];
        (loop[k][1] < spec.clear + 0.22 ? trim : paint).quad(a, b, c, a, [dir, 0, 0], DARK);
      }
    }
    const y0 = spec.clear + 0.3;
    const zw = ring.w * 0.62;
    const x = ring.x + dir * 0.006;
    if (dir > 0) {
      trim.quad([x, y0 - 0.14, -zw], [x, y0 - 0.14, zw], [x, y0 + 0.02, zw], [x, y0 + 0.02, -zw], [1, 0, 0], BLACK);
      trim.quad([x + 0.002, ring.top - 0.13, -zw * 0.72], [x + 0.002, ring.top - 0.13, zw * 0.72], [x + 0.002, ring.top - 0.03, zw * 0.72], [x + 0.002, ring.top - 0.03, -zw * 0.72], [1, 0, 0], DARK);
      trim.quad([x + 0.004, y0 + 0.03, -0.24], [x + 0.004, y0 + 0.03, 0.24], [x + 0.004, y0 + 0.14, 0.24], [x + 0.004, y0 + 0.14, -0.24], [1, 0, 0], [0.82, 0.8, 0.72, 0.5]);
    } else {
      trim.quad([x, y0 + 0.02, -0.25], [x, y0 + 0.02, 0.25], [x, y0 + 0.13, 0.25], [x, y0 + 0.13, -0.25], [-1, 0, 0], [0.82, 0.8, 0.72, 0.5]);
      trim.quad([x, y0 - 0.16, -zw], [x, y0 - 0.16, zw], [x, y0 - 0.04, zw], [x, y0 - 0.04, -zw], [-1, 0, 0], BLACK);
      for (const s of [1, -1]) trim.quad([x, y0 + 0.18, s * 0.3], [x, y0 + 0.18, s * 0.42], [x, y0 + 0.24, s * 0.42], [x, y0 + 0.24, s * 0.3], [-1, 0, 0], [0.9, 0.9, 0.85, 0.25], LAMP.REVERSE);
    }
  }
  const seat = spec.seat;
  const floor = seat[1] - 0.16;
  const cabFront = a0 - 0.12;
  const cabRear = Math.max(c0 + 0.1, spec.bed ? spec.bed[0] + 0.08 : -hl);
  const inner = spec.half - 0.14;
  trim.box((cabFront + cabRear) / 2, floor - 0.02, 0, (cabFront - cabRear) / 2, 0.02, inner, BLACK);
  trim.box(cabFront - 0.1, (floor + spec.belt) / 2 + 0.02, 0, 0.12, (spec.belt - floor) / 2 + 0.02, inner, DARK);
  for (const s of [1, -1]) {
    trim.box(seat[0] - 0.05, seat[1] - 0.06, s * Math.abs(seat[2]), 0.26, 0.07, 0.24, SEAT);
    trim.box(seat[0] - 0.36, seat[1] + 0.3, s * Math.abs(seat[2]), 0.06, 0.33, 0.23, SEAT);
    trim.box(seat[0] - 0.35, seat[1] + 0.72, s * Math.abs(seat[2]), 0.045, 0.1, 0.12, SEAT);
    const mx = a0 - 0.2;
    trim.box(mx, spec.belt + 0.06, s * (spec.half + 0.07), 0.035, 0.05, 0.085, BLACK);
    trim.box(mx - 0.037, spec.belt + 0.06, s * (spec.half + 0.07), 0.002, 0.04, 0.07, CHROME);
  }
  if (type === 'sedan' || type === 'hatch') trim.box(seat[0] - 1.02, seat[1] + 0.12, 0, 0.07, 0.34, inner - 0.06, SEAT);
  const wheelX = 0.32;
  trim.box(seat[0] + wheelX, seat[1] + 0.34, seat[2], 0.02, 0.17, 0.17, BLACK);
  return {
    paint: paint.geometry(0.5), glass: glass.geometry(0.5), trim: trim.geometry(0), spec,
    dims: { halfL: hl, halfW: spec.half, height: Math.max(...spec.top.map((p) => p[1])), wheelbase: spec.wheelbase, track: spec.track, radius: spec.radius, seat, mass: spec.mass },
  };
}

export function buildWheel() {
  const shell = new Shell(true);
  const seg = 20;
  const prof = [[0.56, -0.5], [0.93, -0.5], [1.0, -0.36], [1.0, 0.36], [0.93, 0.5], [0.6, 0.5]];
  const rubber = [0.025, 0.025, 0.027, 0.9];
  const alloy = [0.52, 0.53, 0.55, 0.3];
  const darkAlloy = [0.08, 0.08, 0.09, 0.5];
  const at = (r, z, a) => [Math.cos(a) * r, Math.sin(a) * r, z];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const b = ((i + 1) / seg) * Math.PI * 2;
    const m = (a + b) / 2;
    for (let k = 0; k < prof.length - 1; k++) {
      const [r0, z0] = prof[k];
      const [r1, z1] = prof[k + 1];
      shell.quad(at(r0, z0, a), at(r1, z1, a), at(r1, z1, b), at(r0, z0, b), [Math.cos(m) * (k === 2 ? 1 : 0.2), Math.sin(m) * (k === 2 ? 1 : 0.2), k < 2 ? -1 : k > 2 ? 1 : 0], rubber);
    }
    const spoke = i % 4 < 2;
    shell.quad(at(0.14, 0.4, a), at(0.6, 0.36, a), at(0.6, 0.36, b), at(0.14, 0.4, b), [0, 0, 1], spoke ? alloy : darkAlloy);
    shell.quad(at(0, 0.42, a), at(0.14, 0.4, a), at(0.14, 0.4, b), at(0, 0.42, b), [0, 0, 1], alloy);
    shell.quad(at(0, -0.3, a), at(0.58, -0.3, a), at(0.58, -0.3, b), at(0, -0.3, b), [0, 0, -1], darkAlloy);
    shell.quad(at(0.6, 0.36, a), at(0.6, 0.5, a), at(0.6, 0.5, b), at(0.6, 0.36, b), [-Math.cos(m), -Math.sin(m), 0.3], alloy);
  }
  const g = shell.geometry(0);
  g.deleteAttribute('aLamp');
  return g;
}
