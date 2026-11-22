// Costa del Gzowo Cyber Truck: geometry helpers (flat polygons, ribbons, beams and the subdivided stainless panel batch with damage-atlas coordinates).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const STEP = 0.17;
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function newell(points, out = new THREE.Vector3()) {
  out.set(0, 0, 0);
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.x += (a.y - b.y) * (a.z + b.z);
    out.y += (a.z - b.z) * (a.x + b.x);
    out.z += (a.x - b.x) * (a.y + b.y);
  }
  return out.normalize();
}

function basis(n) {
  const t = (Math.abs(n.x) > 0.8 ? Z : X).clone();
  t.addScaledVector(n, -t.dot(n)).normalize();
  const b = new THREE.Vector3().crossVectors(n, t);
  return { t, b };
}

function triangulate(contour, holes = []) {
  const c = contour.map((p) => new THREE.Vector2(p[0], p[1]));
  const h = holes.map((hole) => hole.map((p) => new THREE.Vector2(p[0], p[1])));
  if (THREE.ShapeUtils.isClockWise(c)) c.reverse();
  for (const hole of h) if (!THREE.ShapeUtils.isClockWise(hole)) hole.reverse();
  const faces = THREE.ShapeUtils.triangulateShape(c, h);
  const all = c.concat(...h);
  return faces.map((f) => [all[f[0]], all[f[1]], all[f[2]]]);
}

export function polyGeo(points) {
  const n = newell(points);
  const { t, b } = basis(n);
  const o = points[0];
  const flat = points.map((p) => [p.clone().sub(o).dot(t), p.clone().sub(o).dot(b)]);
  const tris = triangulate(flat);
  const pos = [];
  for (const tri of tris) for (const q of tri) {
    const p = o.clone().addScaledVector(t, q.x).addScaledVector(b, q.y);
    pos.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function ribbon(a, b) {
  const pos = [];
  for (let i = 0; i < a.length - 1; i++) {
    const q = [a[i], a[i + 1], b[i + 1], a[i], b[i + 1], b[i]];
    for (const p of q) pos.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function beam(a, b, w, h, up = new THREE.Vector3(0, 1, 0)) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const y = up.clone().addScaledVector(dir, -up.dot(dir)).normalize();
  const z = new THREE.Vector3().crossVectors(dir, y);
  const m = new THREE.Matrix4().makeBasis(dir, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5));
  return new THREE.BoxGeometry(len, h, w).applyMatrix4(m);
}

export function slab(points, depth, n) {
  const off = n.clone().multiplyScalar(depth);
  const top = points.map((p) => p.clone());
  const bot = points.map((p) => p.clone().sub(off));
  const parts = [polyGeo(top), polyGeo(bot)];
  const ring = top.concat([top[0]]);
  const ringB = bot.concat([bot[0]]);
  parts.push(ribbon(ring, ringB));
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
}

export function dmgUV(p, n, out) {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  if (ay >= ax && ay >= az * 0.95) out.set(((p.x + 2.95) / 5.9) * 0.5, 0.5 + ((p.z + 1.05) / 2.1) * 0.5);
  else if (az >= ax) out.set(((p.x + 2.95) / 5.9) * 0.5 + (p.z > 0 ? 0.5 : 0), (p.y / 2) * 0.5);
  else out.set(0.5 + ((p.z + 1.05) / 2.1) * 0.25 + (p.x < 0 ? 0.25 : 0), 0.5 + (p.y / 2) * 0.5);
  return out;
}

export function mapGeo(contour, fn, step = 0.35) {
  const b = new SteelBatch(1, step);
  b.map(contour, fn);
  return b.parts[0];
}

export class SteelBatch {
  constructor(seed = 1, step = STEP) {
    this.parts = [];
    this.seed = seed;
    this.step = step;
  }

  rnd() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  emit(tris2, map, nHint) {
    const pos = [];
    const idx = [];
    const p = new THREE.Vector3();
    for (const [A, B, C] of tris2) {
      const L = Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A));
      const n = Math.max(1, Math.ceil(L / this.step));
      const row = [];
      for (let i = 0; i <= n; i++) {
        row.push(pos.length / 3);
        for (let j = 0; j <= n - i; j++) {
          const u = i / n;
          const v = j / n;
          map(A.x + (B.x - A.x) * u + (C.x - A.x) * v, A.y + (B.y - A.y) * u + (C.y - A.y) * v, p);
          pos.push(p.x, p.y, p.z);
        }
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - i; j++) {
          const a = row[i] + j;
          const b = row[i + 1] + j;
          const c = row[i] + j + 1;
          idx.push(a, b, c);
          if (j < n - i - 1) idx.push(b, row[i + 1] + j + 1, c);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const count = pos.length / 3;
    const nrm = nHint || new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
    const uv = new Float32Array(count * 2);
    const dmg = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const tone = 1 + (this.rnd() - 0.5) * 0.07;
    const warm = (this.rnd() - 0.5) * 0.016 - 0.01;
    const ou = this.rnd() * 3;
    const ov = this.rnd() * 3;
    const rot = (this.rnd() - 0.5) * 0.05;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const panel = this.rnd();
    const d = new THREE.Vector2();
    const ax = Math.abs(nrm.x);
    const ay = Math.abs(nrm.y);
    const az = Math.abs(nrm.z);
    for (let i = 0; i < count; i++) {
      p.fromBufferAttribute(g.attributes.position, i);
      let u;
      let v;
      if (az >= ax && az >= ay * 0.7) [u, v] = [p.x, p.y];
      else if (ay >= ax) [u, v] = [p.x, p.z];
      else [u, v] = [p.z, p.y];
      uv[i * 2] = u * cr - v * sr + ou;
      uv[i * 2 + 1] = u * sr + v * cr + ov;
      dmgUV(p, nrm, d);
      dmg[i * 3] = d.x;
      dmg[i * 3 + 1] = d.y;
      dmg[i * 3 + 2] = panel;
      col[i * 3] = tone + warm;
      col[i * 3 + 1] = tone;
      col[i * 3 + 2] = tone - warm;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aDmg', new THREE.BufferAttribute(dmg, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }

  poly(points, holes = []) {
    const n = newell(points);
    const { t, b } = basis(n);
    const o = points[0];
    const flat = (q) => [q.clone().sub(o).dot(t), q.clone().sub(o).dot(b)];
    const tris = triangulate(points.map(flat), holes.map((h) => h.map(flat)));
    return this.emit(tris, (a, c, out) => out.copy(o).addScaledVector(t, a).addScaledVector(b, c), n);
  }

  map(contour, fn, holes = []) {
    return this.emit(triangulate(contour, holes), fn, null);
  }

  build() {
    const g = mergeGeometries(this.parts, false);
    g.setAttribute('aRest', new THREE.Float32BufferAttribute(g.attributes.position.array.slice(), 3));
    g.computeBoundingSphere();
    this.parts = [];
    return g;
  }
}
