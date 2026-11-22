// Costa del Gzowo: procedural grand-touring convertible body, a perimeter loft with sculpted sections, haunches, real panel gaps, openings and lamp lenses.
import * as THREE from 'three';
import { monotone, smoothstep } from './carGeometry.js';

export const CAR = {
  length: 4.72,
  wheelbase: 2.82,
  axleFront: 1.41,
  axleRear: -1.41,
  track: 1.6,
  halfWidth: 0.95,
  wheelRadius: 0.335,
  tireWidth: 0.255,
  archRadius: 0.392,
  nose: 2.27,
  tail: -2.45,
  doorFront: 0.8,
  doorRear: -0.45,
  cowl: 0.88,
  cockpitFront: 0.8,
  cockpitRear: -1.02,
  hinge: { x: 0.765, z: 0.885 },
};

export const MAT = { PAINT: 0, TRIM: 1, LENS: 2 };

const XF0 = 1.8;
const XR0 = -2.0;
const DF = CAR.nose - XF0;
const DR = XR0 - CAR.tail;
const MF = 2.35;
const MR = 2.9;
const T_SEAM = 0.13;
const SEGS = [1, 2, 1, 1, 4, 5, 4, 1, 3, 2];
const STRAIGHT = new Set([0]);
const RINGS = [0, 0.012, 0.03, 0.055, 0.085, 0.11, T_SEAM, 0.16, 0.2, 0.25, 0.31, 0.38, 0.46, 0.55, 0.64, 0.73, 0.82, 0.9, 0.96, 1];

const W = monotone([[-2.1, 0.905], [-1.7, 0.912], [-1.41, 0.915], [-1.0, 0.905], [-0.45, 0.888], [0.4, 0.885], [1.0, 0.898], [1.41, 0.905], [1.85, 0.9]]);
const EDGE = monotone([[-2.42, 0.948], [-2.1, 0.955], [-1.6, 0.945], [-1.05, 0.925], [-0.45, 0.91], [0.5, 0.902], [0.85, 0.892], [1.2, 0.85], [1.55, 0.805], [1.85, 0.765], [2.0, 0.742]]);
const HOOD = monotone([[0.8, 0.892], [1.0, 0.884], [1.3, 0.85], [1.6, 0.8], [1.9, 0.732], [2.1, 0.688], [2.3, 0.655]]);
const DECK = monotone([[-2.45, 0.955], [-2.3, 0.966], [-1.9, 0.958], [-1.4, 0.942], [-1.0, 0.93]]);

function archY(x) {
  let y = 0;
  for (const ax of [CAR.axleFront, CAR.axleRear]) {
    const d = x - ax;
    if (Math.abs(d) < CAR.archRadius) y = Math.max(y, CAR.wheelRadius + Math.sqrt(CAR.archRadius * CAR.archRadius - d * d));
  }
  return y;
}

function sideKeys(x) {
  const e = EDGE(x);
  const sh = Math.min(0.742, e - 0.062);
  return [
    [-0.08, 0.172], [-0.052, 0.188], [-0.042, 0.232], [-0.036, 0.288], [-0.014, 0.33], [0.0, 0.5],
    [-0.003, sh - 0.075], [0.012, sh], [-0.026, sh + (e - sh) * 0.55], [-0.062, e - 0.012], [-0.082, e],
  ];
}

function frontKeys(z) {
  const v = Math.min(1, Math.abs(z) / 0.9);
  const e = 0.645 + 0.085 * v * v;
  return [
    [-0.1, 0.108], [-0.028, 0.118], [-0.045, 0.142], [-0.062, 0.172], [-0.032, 0.29], [0.0, 0.375],
    [-0.03, 0.445], [-0.08, 0.505], [-0.15, 0.56 + 0.05 * v], [-0.22, e - 0.018], [-0.262, e],
  ];
}

function rearKeys(z) {
  const v = Math.min(1, Math.abs(z) / 0.9);
  return [
    [-0.21, 0.215], [-0.165, 0.245], [-0.12, 0.29], [-0.068, 0.36], [-0.024, 0.45], [0.0, 0.6],
    [-0.004, 0.7], [-0.012, 0.77], [-0.032, 0.85], [-0.085, 0.916 - 0.01 * v], [-0.135, 0.936 - 0.01 * v],
  ];
}

function haunch(x, y) {
  let out = 0;
  for (const [ax, amp] of [[CAR.axleFront, 0.02], [CAR.axleRear, 0.044]]) {
    const d = Math.hypot(x - ax, (y - CAR.wheelRadius) * 1.05) - CAR.archRadius;
    out += amp * smoothstep(-0.01, 0.07, d) * (1 - smoothstep(0.12, 0.62, d));
  }
  return out * (1 - smoothstep(0.74, 0.86, y));
}

function topHeight(x, z, zEdge, edgeY) {
  const u = Math.min(1, Math.abs(z) / Math.max(zEdge, 0.2));
  const hood = HOOD(x) + 0.016 * (1 - smoothstep(0.2, 0.42, u)) - 0.004 * smoothstep(0.42, 0.5, u) + (edgeY + 0.008 - HOOD(x)) * smoothstep(0.56, 0.92, u);
  const zz = Math.abs(z);
  const hump = 0.075 * Math.exp(-(((zz - 0.37) / 0.13) ** 2)) * smoothstep(-1.02, -1.12, x) * smoothstep(-2.05, -1.35, x);
  const deck = hump + DECK(x) + 0.012 * (1 - u * u) + (edgeY + 0.004 - DECK(x) - 0.012 * (1 - u * u)) * smoothstep(0.75, 1, u);
  const mid = edgeY - 0.004 * u;
  const kh = smoothstep(0.78, 0.9, x);
  const kd = 1 - smoothstep(-1.08, -0.96, x);
  return mid * (1 - kh - kd) + hood * kh + deck * kd;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

function capPoint(front, th) {
  const s = Math.pow(Math.max(0, Math.sin(th)), 2 / (front ? MF : MR));
  const c = Math.pow(Math.max(0, Math.cos(th)), 2 / (front ? MF : MR));
  return front ? [XF0 + DF * s, -W(XF0) * c] : [XR0 - DR * s, -W(XR0) * c];
}

function perimeter() {
  const dense = [];
  for (let i = 0; i <= 600; i++) {
    const [x, z] = capPoint(false, (Math.PI / 2) * (1 - i / 600));
    dense.push({ x, z, kind: 'rear' });
  }
  for (let i = 1; i < 3000; i++) {
    const x = XR0 + ((XF0 - XR0) * i) / 3000;
    dense.push({ x, z: -W(x), kind: 'side' });
  }
  for (let i = 0; i <= 600; i++) {
    const [x, z] = capPoint(true, (Math.PI / 2) * (i / 600));
    dense.push({ x, z, kind: 'front' });
  }
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z));
  const total = len[len.length - 1];
  const required = [];
  const need = { side: [1.72, 1.55, CAR.cowl, CAR.doorFront, CAR.doorRear, CAR.cockpitRear, -1.86, -2.0, -0.25], front: [0.4, 0.42, 0.47, 0.78], rear: [0.27, 0.42, 0.62, 0.75, 0.85] };
  for (const [kind, list] of Object.entries(need)) {
    for (const val of list) {
      for (let i = 1; i < dense.length; i++) {
        const a = dense[i - 1];
        const b = dense[i];
        if (a.kind !== kind || b.kind !== kind) continue;
        const va = kind === 'side' ? a.x : Math.abs(a.z);
        const vb = kind === 'side' ? b.x : Math.abs(b.z);
        if ((va - val) * (vb - val) <= 0 && va !== vb) {
          const f = (val - va) / (vb - va);
          required.push(len[i - 1] + (len[i] - len[i - 1]) * f);
          break;
        }
      }
    }
  }
  const step = 0.024;
  const marks = [...required];
  for (let s = 0; s <= total + 1e-6; s += step) marks.push(Math.min(s, total));
  marks.push(0, total);
  marks.sort((a, b) => a - b);
  const keep = [];
  const req = new Set(required.map((r) => r.toFixed(6)));
  for (const m of marks) {
    const isReq = req.has(m.toFixed(6)) || m === 0 || m === total;
    if (keep.length && m - keep[keep.length - 1].s < 0.008) {
      if (isReq && !keep[keep.length - 1].req) keep[keep.length - 1] = { s: m, req: true };
      continue;
    }
    keep.push({ s: m, req: isReq });
  }
  let j = 1;
  const half = keep.map(({ s }) => {
    while (j < len.length - 1 && len[j] < s) j++;
    const a = dense[j - 1];
    const b = dense[j];
    const f = len[j] > len[j - 1] ? (s - len[j - 1]) / (len[j] - len[j - 1]) : 0;
    return { x: a.x + (b.x - a.x) * f, z: Math.min(0, a.z + (b.z - a.z) * f), kind: f < 0.5 ? a.kind : b.kind };
  });
  half[0].z = 0;
  half[half.length - 1].z = 0;
  const cols = [...half];
  for (let i = half.length - 2; i >= 1; i--) cols.push({ ...half[i], z: -half[i].z });
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    const a = cols[(i - 1 + n) % n];
    const b = cols[(i + 1) % n];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    const c = cols[i];
    c.nx = tz / l;
    c.nz = -tx / l;
    c.wf = smoothstep(0.3, 0.92, c.nx);
    c.wr = smoothstep(0.3, 0.92, -c.nx);
    c.ws = 1 - c.wf - c.wr;
    c.mx = Math.min(XF0, Math.max(XR0, c.x));
  }
  return cols;
}

function columnKeys(c) {
  const xs = Math.min(XF0, Math.max(XR0, c.x));
  const s = sideKeys(xs);
  const f = frontKeys(c.z);
  const r = rearKeys(c.z);
  const keys = s.map((k, i) => [k[0] * c.ws + f[i][0] * c.wf + r[i][0] * c.wr, k[1] * c.ws + f[i][1] * c.wf + r[i][1] * c.wr]);
  if (c.ws > 0.5) {
    const ab = archY(c.x);
    const y0 = keys[0][1];
    const lift = 0.86;
    if (ab > y0) {
      const a = smoothstep(0, 0.06, ab - y0);
      const lip = [-0.038, -0.012, 0.0, 0.002, 0.0];
      for (let i = 0; i < keys.length; i++) {
        if (keys[i][1] < lift) keys[i][1] = ab + ((keys[i][1] - y0) * (lift - ab)) / (lift - y0);
        if (i < 5) keys[i][0] += (lip[i] - keys[i][0]) * a;
      }
    }
    for (let i = 2; i < 10; i++) keys[i][0] += haunch(c.x, keys[i][1]) * c.ws;
  }
  return keys;
}

function sideRows(keys) {
  const pts = [];
  const seg = [];
  for (let k = 0; k < SEGS.length; k++) {
    const p0 = keys[Math.max(k - 1, 0)];
    const p1 = keys[k];
    const p2 = keys[k + 1];
    const p3 = keys[Math.min(k + 2, keys.length - 1)];
    for (let i = 0; i < SEGS[k]; i++) {
      const t = i / SEGS[k];
      pts.push(STRAIGHT.has(k) ? [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t] : catmull(p0, p1, p2, p3, t));
      seg.push(k);
    }
  }
  pts.push(keys[keys.length - 1]);
  seg.push(SEGS.length);
  return { pts, seg };
}

export function buildBody() {
  const cols = perimeter();
  const nc = cols.length;
  const firstRows = sideRows(columnKeys(cols[0]));
  const rs = firstRows.pts.length;
  const nr = rs + RINGS.length - 1;
  const P = new Float32Array(nc * nr * 3);
  const rowSeg = firstRows.seg;
  const ringT = new Float32Array(nr).fill(-1);
  for (let k = 1; k < RINGS.length; k++) ringT[rs - 1 + k] = RINGS[k];
  ringT[rs - 1] = 0;
  const edgeOff = new Float32Array(nc);
  for (let c = 0; c < nc; c++) {
    const col = cols[c];
    const { pts } = sideRows(columnKeys(col));
    for (let r = 0; r < rs; r++) {
      const o = (r * nc + c) * 3;
      P[o] = col.x + col.nx * pts[r][0];
      P[o + 1] = pts[r][1];
      P[o + 2] = col.z + col.nz * pts[r][0];
    }
    const ex = P[((rs - 1) * nc + c) * 3];
    const ey = P[((rs - 1) * nc + c) * 3 + 1];
    const ez = P[((rs - 1) * nc + c) * 3 + 2];
    edgeOff[c] = pts[rs - 1][0];
    const zEdge = W(Math.min(XF0, Math.max(XR0, ex))) + sideKeys(Math.min(XF0, Math.max(XR0, ex)))[10][0];
    for (let k = 1; k < RINGS.length; k++) {
      const t = RINGS[k];
      const px = ex + (col.mx - ex) * t;
      const pz = ez * (1 - t);
      const h = topHeight(px, pz, zEdge, ey);
      const b = smoothstep(0, 0.07, t);
      const o = ((rs - 1 + k) * nc + c) * 3;
      P[o] = px;
      P[o + 1] = ey + (h - ey) * b;
      P[o + 2] = pz;
    }
  }

  const N = new Float32Array(nc * nr * 3);
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const vd = new THREE.Vector3();
  const fn = new THREE.Vector3();
  const get = (c, r, out) => {
    const o = (r * nc + ((c + nc) % nc)) * 3;
    return out.set(P[o], P[o + 1], P[o + 2]);
  };
  for (let r = 0; r < nr - 1; r++) {
    for (let c = 0; c < nc; c++) {
      get(c, r, va);
      get(c + 1, r, vb);
      get(c + 1, r + 1, vc);
      get(c, r + 1, vd);
      fn.subVectors(vc, va).cross(vb.clone().sub(vd));
      for (const [cc, rr] of [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]]) {
        const o = (rr * nc + ((cc + nc) % nc)) * 3;
        N[o] += fn.x;
        N[o + 1] += fn.y;
        N[o + 2] += fn.z;
      }
    }
  }
  const sign = (() => {
    const o = (5 * nc + Math.floor(nc / 4)) * 3;
    const c = cols[Math.floor(nc / 4)];
    return N[o] * c.nx + N[o + 2] * c.nz > 0 ? 1 : -1;
  })();
  for (let i = 0; i < nc * nr; i++) {
    const r = Math.floor(i / nc);
    let x = N[i * 3] * sign;
    let y = N[i * 3 + 1] * sign;
    let z = N[i * 3 + 2] * sign;
    const t = ringT[r];
    if (t > 0.18) {
      const px = P[i * 3];
      const pz = P[i * 3 + 2];
      const c = i % nc;
      const ex = P[((rs - 1) * nc + c) * 3];
      const ey = P[((rs - 1) * nc + c) * 3 + 1];
      const zEdge = W(Math.min(XF0, Math.max(XR0, ex))) + sideKeys(Math.min(XF0, Math.max(XR0, ex)))[10][0];
      const e = 0.01;
      const hx = (topHeight(px + e, pz, zEdge, ey) - topHeight(px - e, pz, zEdge, ey)) / (2 * e);
      const hz = (topHeight(px, pz + e, zEdge, ey) - topHeight(px, pz - e, zEdge, ey)) / (2 * e);
      const l0 = Math.hypot(x, y, z) || 1;
      const l1 = Math.hypot(hx, 1, hz);
      const k = smoothstep(0.18, 0.3, t);
      x = (x / l0) * (1 - k) + (-hx / l1) * k;
      y = (y / l0) * (1 - k) + (1 / l1) * k;
      z = (z / l0) * (1 - k) + (-hz / l1) * k;
    }
    const l = Math.hypot(x, y, z) || 1;
    N[i * 3] = x / l;
    N[i * 3 + 1] = y / l;
    N[i * 3 + 2] = z / l;
  }

  const kindOf = (c) => {
    const a = cols[c];
    const b = cols[(c + 1) % nc];
    return a.kind === b.kind ? a.kind : a.kind === 'side' || b.kind === 'side' ? 'side' : a.kind;
  };
  const head = (cx, cz, kind) => (kind === 'front' && Math.abs(cz) > 0.42) || (kind === 'side' && cx > 1.72);
  const NONE = null;
  function classify(c, r) {
    const a = cols[c];
    const b = cols[(c + 1) % nc];
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    const az = Math.abs(cz);
    const kind = kindOf(c);
    const side = cz < 0 ? 'L' : 'R';
    const t0 = ringT[r];
    if (r >= rs - 1) {
      if (t0 >= T_SEAM - 1e-4) {
        if (cx > CAR.cowl) return ['hood', MAT.PAINT];
        if (cx > CAR.cockpitFront) return ['shell', MAT.TRIM, 'gloss'];
        if (cx > CAR.cockpitRear) return NONE;
        return ['trunk', MAT.PAINT];
      }
      if (head(cx, cz, kind)) return ['shell', MAT.LENS, 'head'];
      if (kind === 'front' || cx > 1.83) return ['frontBumper', MAT.PAINT];
      if (cx > CAR.doorRear && cx < CAR.doorFront && kind === 'side') return ['door' + side, MAT.PAINT];
      return ['shell', MAT.PAINT];
    }
    const s = rowSeg[r];
    if (kind === 'front' || (kind === 'side' && cx > 1.83)) {
      if (head(cx, cz, kind) && s >= 7) return ['shell', MAT.LENS, 'head'];
      if (kind === 'front' && az < 0.4 && s >= 4 && s < 6) return NONE;
      if (kind === 'front' && az > 0.47 && az < 0.78 && s === 3) return NONE;
      if (s <= 2) return ['frontBumper', MAT.TRIM, 'black'];
      return ['frontBumper', MAT.PAINT];
    }
    if (kind === 'rear' || cx < -1.86) {
      const rearFace = kind === 'rear' || cx < -2.0;
      if (rearFace && s === 7) return ['shell', MAT.LENS, 'tail'];
      if (kind === 'rear' && az > 0.42 && az < 0.62 && (s === 2 || s === 3)) return NONE;
      if (s <= 2) return ['rearBumper', MAT.TRIM, 'black'];
      if (s < 7) return ['rearBumper', MAT.PAINT];
      return ['shell', MAT.PAINT];
    }
    if (cx > CAR.doorRear && cx < CAR.doorFront && s >= 3) return ['door' + side, MAT.PAINT];
    if (s <= 1) return ['shell', MAT.TRIM, 'black'];
    return ['shell', MAT.PAINT];
  }

  const cells = new Array(nc * (nr - 1));
  for (let r = 0; r < nr - 1; r++) for (let c = 0; c < nc; c++) cells[r * nc + c] = classify(c, r);
  const cellAt = (c, r) => (r < 0 || r >= nr - 1 ? undefined : cells[r * nc + ((c + nc) % nc)]);
  const regionKey = (cl) => (cl ? cl[0] + ':' + cl[1] + ':' + (cl[2] || '') : 'none');

  const HOLE_DEPTH = { grille: 0.11, intake: 0.08, exhaust: 0.07, cockpit: 0.07 };
  const holeKind = (c, r) => {
    const a = cols[c];
    const kind = kindOf(c);
    if (r >= rs - 1) return 'cockpit';
    if (kind === 'front') return Math.abs(a.z) < 0.45 ? 'grille' : 'intake';
    return 'exhaust';
  };

  const panels = {};
  const lenses = { head: { L: [], R: [] }, tail: { L: [], R: [] } };
  const builders = new Map();
  const builder = (panel) => {
    if (!builders.has(panel)) builders.set(panel, { pos: [], nor: [], rest: [], edge: [], uv: [], proj: [], col: [], fin: [], groups: [[], [], []], map: new Map() });
    return builders.get(panel);
  };
  const TRIM_FIN = { black: [0.02, 0.02, 0.022, 0.6, 0, 0.0], gloss: [0.012, 0.012, 0.013, 0.14, 0, 1], head: [0.02, 0.022, 0.026, 0.04, 0, 1], tail: [0.32, 0.008, 0.006, 0.04, 0, 1] };
  const projOf = (c, r) => {
    if (r >= rs - 1 && ringT[r] > 0.02) return 2;
    const k = cols[c].kind;
    if (k === 'side') return cols[c].z < 0 ? 0 : 1;
    return 3;
  };
  const vert = (B, key, c, r, edge = 0, offset = null, finKey = null) => {
    const id = key + ':' + (((c % nc) + nc) % nc) + ':' + r + (offset ? ':' + offset.tag : '');
    if (B.map.has(id)) return B.map.get(id);
    const cc = ((c % nc) + nc) % nc;
    const o = (r * nc + cc) * 3;
    let x = P[o];
    let y = P[o + 1];
    let z = P[o + 2];
    if (offset) {
      x += offset.x;
      y += offset.y;
      z += offset.z;
    }
    const i = B.pos.length / 3;
    B.pos.push(x, y, z);
    B.rest.push(x, y, z);
    B.nor.push(offset && offset.n ? offset.n[0] : N[o], offset && offset.n ? offset.n[1] : N[o + 1], offset && offset.n ? offset.n[2] : N[o + 2]);
    B.edge.push(edge);
    B.uv.push(x, y);
    B.proj.push(projOf(cc, Math.min(r, nr - 2)));
    const f = TRIM_FIN[finKey] || TRIM_FIN.black;
    B.col.push(f[0], f[1], f[2]);
    B.fin.push(f[3], f[4], f[5], 0);
    B.map.set(id, i);
    return i;
  };

  const boundaryPull = (c, r, key) => {
    let dx = 0;
    let dy = 0;
    let dz = 0;
    for (const [cc, rr] of [[c - 1, r - 1], [c, r - 1], [c - 1, r], [c, r]]) {
      const cl = cellAt(cc, rr);
      if (!cl || regionKey(cl) !== key) continue;
      for (const [u, w] of [[cc, rr], [cc + 1, rr], [cc, rr + 1], [cc + 1, rr + 1]]) {
        const o = (w * nc + ((u + nc) % nc)) * 3;
        const p = (r * nc + ((c + nc) % nc)) * 3;
        dx += P[o] - P[p];
        dy += P[o + 1] - P[p + 1];
        dz += P[o + 2] - P[p + 2];
      }
    }
    const l = Math.hypot(dx, dy, dz) || 1;
    return [dx / l, dy / l, dz / l];
  };
  const isBoundaryVertex = (c, r, key) => {
    for (const [cc, rr] of [[c - 1, r - 1], [c, r - 1], [c - 1, r], [c, r]]) {
      if (rr < 0 || rr >= nr - 1) continue;
      if (regionKey(cellAt(cc, rr)) !== key) return true;
    }
    return false;
  };

  for (let r = 0; r < nr - 1; r++) {
    for (let c = 0; c < nc; c++) {
      const cl = cells[r * nc + c];
      if (!cl) continue;
      const [panel, mat, finKey] = cl;
      const key = regionKey(cl);
      const B = builder(panel);
      const corner = (cc, rr) => {
        if (!isBoundaryVertex(cc, rr, key) || rr === 0 || rr === nr - 1) return vert(B, key, cc, rr, 0, null, finKey);
        const [px, py, pz] = boundaryPull(cc, rr, key);
        const o = (rr * nc + ((cc + nc) % nc)) * 3;
        const g = mat === MAT.LENS ? 0.003 : 0.0022;
        return vert(B, key, cc, rr, 0, { tag: 'p', x: px * g - N[o] * 0.0015, y: py * g - N[o + 1] * 0.0015, z: pz * g - N[o + 2] * 0.0015 }, finKey);
      };
      const v0 = corner(c, r);
      const v1 = corner(c + 1, r);
      const v2 = corner(c + 1, r + 1);
      const v3 = corner(c, r + 1);
      if (sign > 0) B.groups[mat].push(v0, v3, v1, v1, v3, v2);
      else B.groups[mat].push(v0, v1, v3, v1, v2, v3);
      if (mat === MAT.LENS) {
        const list = lenses[finKey][cols[c].z < 0 ? 'L' : 'R'];
        const q = [];
        for (const [cc, rr] of [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]]) {
          const o = (rr * nc + ((cc + nc) % nc)) * 3;
          q.push([P[o], P[o + 1], P[o + 2], N[o], N[o + 1], N[o + 2]]);
        }
        list.push({ c, r, q });
      }
      const edges = [
        [c, r, c + 1, r, cellAt(c, r - 1), r - 1 < 0],
        [c + 1, r, c + 1, r + 1, cellAt(c + 1, r), false],
        [c + 1, r + 1, c, r + 1, cellAt(c, r + 1), r + 1 >= nr - 1],
        [c, r + 1, c, r, cellAt(c - 1, r), false],
      ];
      for (const [c0, r0, c1, r1, other, outside] of edges) {
        if (outside || regionKey(other) === key) continue;
        const otherPanel = other ? other[0] : null;
        const hole = !other;
        const samePanelMat = other && otherPanel === panel && mat !== MAT.LENS && other[1] !== MAT.LENS;
        if (samePanelMat) continue;
        const depth = hole ? HOLE_DEPTH[holeKind(c, r)] : mat === MAT.LENS || (other && other[1] === MAT.LENS) ? 0.012 : 0.016;
        const flangeMat = hole && holeKind(c, r) !== 'cockpit' ? MAT.TRIM : mat === MAT.LENS ? MAT.TRIM : mat;
        const fk = hole && holeKind(c, r) !== 'cockpit' ? 'black' : mat === MAT.LENS ? 'gloss' : finKey;
        const a = corner(c0, r0);
        const b = corner(c1, r1);
        const mk = (cc, rr, base) => {
          const o = (rr * nc + ((cc + nc) % nc)) * 3;
          const nx = N[o];
          const ny = N[o + 1];
          const nz = N[o + 2];
          const bi = base * 3;
          const i = B.pos.length / 3;
          const bx = B.pos[bi] - nx * depth;
          const by = B.pos[bi + 1] - ny * depth;
          const bz = B.pos[bi + 2] - nz * depth;
          B.pos.push(bx, by, bz);
          B.rest.push(bx, by, bz);
          B.nor.push(nx, ny, nz);
          B.edge.push(1);
          B.uv.push(bx, by);
          B.proj.push(B.proj[base]);
          const f = TRIM_FIN[fk] || TRIM_FIN.black;
          B.col.push(f[0], f[1], f[2]);
          B.fin.push(f[3], f[4], f[5], 0);
          return i;
        };
        const a2 = mk(c0, r0, a);
        const b2 = mk(c1, r1, b);
        const top = (i) => {
          const j = B.pos.length / 3;
          for (let k = 0; k < 3; k++) {
            B.pos.push(B.pos[i * 3 + k]);
            B.rest.push(B.rest[i * 3 + k]);
            B.nor.push(B.nor[i * 3 + k]);
            B.col.push((TRIM_FIN[fk] || TRIM_FIN.black)[k]);
          }
          B.edge.push(0.55);
          B.uv.push(B.uv[i * 2], B.uv[i * 2 + 1]);
          B.proj.push(B.proj[i]);
          const f = TRIM_FIN[fk] || TRIM_FIN.black;
          B.fin.push(f[3], f[4], f[5], 0);
          return j;
        };
        const a1 = top(a);
        const b1 = top(b);
        const ex = B.pos[b1 * 3] - B.pos[a1 * 3];
        const ey = B.pos[b1 * 3 + 1] - B.pos[a1 * 3 + 1];
        const ez = B.pos[b1 * 3 + 2] - B.pos[a1 * 3 + 2];
        const dxv = B.pos[a2 * 3] - B.pos[a1 * 3];
        const dyv = B.pos[a2 * 3 + 1] - B.pos[a1 * 3 + 1];
        const dzv = B.pos[a2 * 3 + 2] - B.pos[a1 * 3 + 2];
        let fx = ey * dzv - ez * dyv;
        let fy = ez * dxv - ex * dzv;
        let fz = ex * dyv - ey * dxv;
        const fl = Math.hypot(fx, fy, fz) || 1;
        fx /= fl;
        fy /= fl;
        fz /= fl;
        let cxp = 0;
        let cyp = 0;
        let czp = 0;
        for (const [cc, rr] of [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]]) {
          const o = (rr * nc + ((cc + nc) % nc)) * 3;
          cxp += P[o] / 4;
          cyp += P[o + 1] / 4;
          czp += P[o + 2] / 4;
        }
        const mx = B.pos[a1 * 3] + ex / 2;
        const my = B.pos[a1 * 3 + 1] + ey / 2;
        const mz = B.pos[a1 * 3 + 2] + ez / 2;
        const inx = cxp - mx;
        const iny = cyp - my;
        const inz = czp - mz;
        const flip = fx * inx + fy * iny + fz * inz > 0 ? -1 : 1;
        for (const i of [a1, b1, a2, b2]) {
          B.nor[i * 3] = fx * flip;
          B.nor[i * 3 + 1] = fy * flip;
          B.nor[i * 3 + 2] = fz * flip;
        }
        if (flip > 0) B.groups[flangeMat].push(a1, b1, a2, b1, b2, a2);
        else B.groups[flangeMat].push(a1, a2, b1, b1, a2, b2);
      }
    }
  }

  for (const [name, B] of builders) {
    const index = [];
    const geo = new THREE.BufferGeometry();
    for (let m = 0; m < B.groups.length; m++) {
      if (!B.groups[m].length) continue;
      geo.addGroup(index.length, B.groups[m].length, m);
      index.push(...B.groups[m]);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
    geo.setAttribute('aRest', new THREE.Float32BufferAttribute(B.rest, 3));
    geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(B.edge, 1));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    geo.setAttribute('aProj', new THREE.Float32BufferAttribute(B.proj, 1));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    geo.setAttribute('aFinish', new THREE.Float32BufferAttribute(B.fin, 4));
    geo.setIndex(index);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    panels[name] = geo;
  }

  const probeSide = (x, y, side = -1, out = new THREE.Vector3(), normal = null) => {
    let best = -1;
    let bd = Infinity;
    for (let c = 0; c < nc; c++) {
      const col = cols[c];
      if (col.kind !== 'side' || Math.sign(col.z) !== Math.sign(side)) continue;
      const d = Math.abs(col.x - x);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    for (let r = 0; r < rs - 1; r++) {
      const a = (r * nc + best) * 3;
      const b = ((r + 1) * nc + best) * 3;
      if ((P[a + 1] - y) * (P[b + 1] - y) <= 0) {
        const f = (y - P[a + 1]) / (P[b + 1] - P[a + 1] || 1);
        out.set(P[a] + (P[b] - P[a]) * f, y, P[a + 2] + (P[b + 2] - P[a + 2]) * f);
        if (normal) normal.set(N[a] + (N[b] - N[a]) * f, N[a + 1] + (N[b + 1] - N[a + 1]) * f, N[a + 2] + (N[b + 2] - N[a + 2]) * f).normalize();
        return out;
      }
    }
    const a = ((rs - 1) * nc + best) * 3;
    return out.set(P[a], P[a + 1], P[a + 2]);
  };
  const probeTop = (x, z, out = new THREE.Vector3()) => {
    let best = 0;
    let bd = Infinity;
    for (let r = rs - 1; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const o = (r * nc + c) * 3;
        const d = (P[o] - x) ** 2 + (P[o + 2] - z) ** 2;
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
    }
    return out.set(x, P[best + 1], z);
  };
  const probeEnd = (front, z, y, out = new THREE.Vector3(), normal = null) => {
    let best = -1;
    let bd = Infinity;
    for (let c = 0; c < nc; c++) {
      const col = cols[c];
      if (col.kind !== (front ? 'front' : 'rear')) continue;
      const d = Math.abs(col.z - z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    for (let r = 0; r < rs - 1; r++) {
      const a = (r * nc + best) * 3;
      const b = ((r + 1) * nc + best) * 3;
      if ((P[a + 1] - y) * (P[b + 1] - y) <= 0) {
        const f = (y - P[a + 1]) / (P[b + 1] - P[a + 1] || 1);
        out.set(P[a] + (P[b] - P[a]) * f, y, P[a + 2] + (P[b + 2] - P[a + 2]) * f);
        if (normal) normal.set(N[a] + (N[b] - N[a]) * f, N[a + 1] + (N[b + 1] - N[a + 1]) * f, N[a + 2] + (N[b + 2] - N[a + 2]) * f).normalize();
        return out;
      }
    }
    return out.set(P[best * 3], y, P[best * 3 + 2]);
  };

  const holes = { grille: [], intake: [], exhaust: [] };
  for (let r = 0; r < rs - 1; r++) {
    for (let c = 0; c < nc; c++) {
      if (cells[r * nc + c]) continue;
      const kind = holeKind(c, r);
      if (!holes[kind]) continue;
      const q = [];
      for (const [cc, rr] of [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]]) {
        const o = (rr * nc + ((cc + nc) % nc)) * 3;
        q.push([P[o], P[o + 1], P[o + 2], N[o], N[o + 1], N[o + 2]]);
      }
      holes[kind].push({ c, r, q, side: cols[c].z < 0 ? 'L' : 'R' });
    }
  }

  return {
    panels,
    lenses,
    holes,
    sign,
    edgeY: EDGE,
    width: W,
    hoodY: HOOD,
    deckY: DECK,
    archY,
    probeSide,
    probeTop,
    probeEnd,
    stats: { columns: nc, rows: nr },
  };
}
