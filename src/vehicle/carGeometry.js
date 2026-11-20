// Costa del Gzowo: geometry helpers for the procedural car (transforms, sweeps, lathes, merged multi-finish part batches).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const FIN = {
  black: [0.02, 0.02, 0.022, 0.55, 0, 0],
  gloss: [0.012, 0.012, 0.014, 0.12, 0, 1],
  satin: [0.03, 0.03, 0.032, 0.38, 0, 0.3],
  rubber: [0.018, 0.018, 0.018, 0.85, 0, 0],
  chrome: [0.9, 0.91, 0.93, 0.07, 1, 0],
  alu: [0.62, 0.63, 0.65, 0.28, 1, 0],
  darkChrome: [0.18, 0.185, 0.19, 0.16, 1, 0],
  reflector: [0.75, 0.76, 0.78, 0.12, 1, 0],
  housing: [0.04, 0.042, 0.046, 0.3, 0.6, 0],
  carpet: [0.03, 0.028, 0.026, 0.98, 0, 0],
  liner: [0.025, 0.025, 0.025, 0.92, 0, 0],
  under: [0.035, 0.034, 0.033, 0.8, 0, 0],
  plastic: [0.035, 0.035, 0.037, 0.62, 0, 0],
  disc: [0.42, 0.42, 0.43, 0.42, 1, 0],
  hat: [0.12, 0.12, 0.13, 0.5, 0.7, 0],
  caliper: [0.62, 0.42, 0.06, 0.32, 0.1, 0.8],
  rim: [0.11, 0.115, 0.12, 0.26, 0.95, 0.6],
  rimFace: [0.55, 0.56, 0.58, 0.18, 1, 0.6],
  wood: [0.16, 0.08, 0.04, 0.3, 0, 1],
  stitch: [0.55, 0.38, 0.22, 0.7, 0, 0],
  mesh: [0.006, 0.006, 0.007, 0.62, 0, 0],
  tip: [0.7, 0.71, 0.73, 0.2, 1, 0],
  soot: [0.01, 0.01, 0.01, 0.9, 0, 0],
};

export const LAMP = { NONE: 0, DRL: 1, BEAM: 2, TAIL: 3, BRAKE: 4, REVERSE: 5, INDICATOR: 6, AMBIENT: 7, CLUSTER: 8 };

const m4 = new THREE.Matrix4();
const q4 = new THREE.Quaternion();
const e4 = new THREE.Euler();
const v4 = new THREE.Vector3();
const s4 = new THREE.Vector3();

export function at(geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  m4.compose(v4.set(x, y, z), q4.setFromEuler(e4.set(rx, ry, rz)), s4.set(sx, sy, sz));
  return geometry.applyMatrix4(m4);
}

export function box(w, h, d, r = 0, seg = 2) {
  return r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
}

export function cyl(r0, r1, h, seg = 24, open = false) {
  return new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
}

export function sphere(r, sx = 1, sy = 1, sz = 1, ws = 20, hs = 14) {
  return new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz);
}

export function clean(g) {
  let out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(name)) out.deleteAttribute(name);
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  if (!out.attributes.normal) out.computeVertexNormals();
  out.groups = [];
  return out;
}

export function merge(list) {
  const geos = list.filter(Boolean).map(clean);
  return geos.length ? mergeGeometries(geos, false) : new THREE.BufferGeometry();
}

export function tube(points, radius, radial = 10, closed = false, scaleFn = null) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const segs = Math.max(4, Math.round(curve.getLength() / 0.02));
  const g = new THREE.TubeGeometry(curve, segs, radius, radial, closed);
  if (scaleFn) {
    const pos = g.attributes.position;
    const c = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      curve.getPointAt(i / segs, c);
      const k = scaleFn(i / segs);
      for (let j = 0; j <= radial; j++) {
        const id = i * (radial + 1) + j;
        v4.fromBufferAttribute(pos, id).sub(c).multiplyScalar(k).add(c);
        pos.setXYZ(id, v4.x, v4.y, v4.z);
      }
    }
    g.computeVertexNormals();
  }
  return g;
}

export function sweep(path, profile, { closed = false, up = new THREE.Vector3(0, 1, 0), twist = null, scale = null } = {}) {
  const n = path.length;
  const m = profile.length;
  const pos = [];
  const idx = [];
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(n - 1, i + 1)];
    t.subVectors(b, a).normalize();
    const u = typeof up === 'function' ? up(i / (n - 1)) : up;
    side.crossVectors(t, u).normalize();
    nrm.crossVectors(side, t).normalize();
    const k = scale ? scale(i / (n - 1)) : 1;
    const tw = twist ? twist(i / (n - 1)) : 0;
    const c = Math.cos(tw);
    const s = Math.sin(tw);
    for (const [px, py] of profile) {
      const x = (px * c - py * s) * k;
      const y = (px * s + py * c) * k;
      pos.push(path[i].x + side.x * x + nrm.x * y, path[i].y + side.y * x + nrm.y * y, path[i].z + side.z * x + nrm.z * y);
    }
  }
  const ring = closed ? m : m - 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < ring; j++) {
      const j2 = (j + 1) % m;
      const a = i * m + j;
      const b = (i + 1) * m + j;
      const c = (i + 1) * m + j2;
      const d = i * m + j2;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function lathe(profile, segments = 32, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segments, phiStart, phiLength);
}

export function roundRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function extrude(shape, depth, bevel = 0, curveSegments = 8) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
}

export function grid(nu, nv, fn) {
  const pos = [];
  const uv = [];
  const idx = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      fn(i / nu, j / nv, p);
      pos.push(p.x, p.y, p.z);
      uv.push(i / nu, j / nv);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Batch {
  constructor() {
    this.parts = [];
  }

  add(geometry, finish, lamp = 0, tint = null) {
    const g = clean(geometry);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const fin = new Float32Array(n * 4);
    const c = tint || finish;
    for (let i = 0; i < n; i++) {
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
      fin[i * 4] = finish[3];
      fin[i * 4 + 1] = finish[4];
      fin[i * 4 + 2] = finish[5];
      fin[i * 4 + 3] = lamp;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aFinish', new THREE.BufferAttribute(fin, 4));
    this.parts.push(g);
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  build() {
    const g = mergeGeometries(this.parts, false);
    g.computeBoundingSphere();
    this.parts = [];
    return g;
  }
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function monotone(points) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
