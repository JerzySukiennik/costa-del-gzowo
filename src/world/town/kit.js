// Costa del Gzowo: town geometry kit (batched surfaces, window glass and decals with per-vertex material data and frame transforms).
import * as THREE from 'three';

export const CHANNELS = { ON: 0, FLICKER: 1, BLINK: 2, MAIN_G: 3, MAIN_Y: 4, MAIN_R: 5, CROSS_G: 6, CROSS_Y: 7, CROSS_R: 8, WALK: 9, DONT: 10, CHASE_A: 11, CHASE_B: 12, FLICKER_B: 13, LAMP: 14, BROKEN: 15 };

export const L = { PLASTER: 0, PBRICK: 1, BRICK: 2, TILE: 3, PLANK: 4, IRON: 5, SHUTTER: 6, CONCRETE: 7, PAVER: 8, ASPHALT: 9, FLAT: 10, GRAVEL: 11, STRIPES: 12, BARBER: 13 };

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

export function hex(h, k = 1) {
  const c = new THREE.Color(h);
  return [c.r * k, c.g * k, c.b * k];
}

class Base {
  constructor() {
    this.stack = [];
    this.m = new THREE.Matrix4();
    this.nm = new THREE.Matrix3();
    this.pos = [];
    this.nor = [];
  }

  push(matrix) {
    this.stack.push(this.m.clone());
    this.m.multiply(matrix);
    this.nm.getNormalMatrix(this.m);
    return this;
  }

  frame(x, y, z, yaw = 0, pitch = 0, roll = 0) {
    return this.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  }

  pop() {
    this.m.copy(this.stack.pop());
    this.nm.getNormalMatrix(this.m);
    return this;
  }

  vert(x, y, z, nx, ny, nz) {
    _v.set(x, y, z).applyMatrix4(this.m);
    _n.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
    this.pos.push(_v.x, _v.y, _v.z);
    this.nor.push(_n.x, _n.y, _n.z);
  }

  get count() {
    return this.pos.length / 3;
  }
}

export class Surface extends Base {
  constructor() {
    super();
    this.uv = [];
    this.col = [];
    this.mat = [];
    this.ext = [];
    this.p = { layer: L.FLAT, color: [0.8, 0.8, 0.8], wear: 0.5, glow: 0, channel: 0, metal: 0, rough: -1, sway: 0, phase: 0 };
  }

  paint(opts) {
    const prev = { ...this.p };
    Object.assign(this.p, opts);
    if (typeof this.p.color === 'string' || typeof this.p.color === 'number') this.p.color = hex(this.p.color);
    return prev;
  }

  with(opts, fn) {
    const prev = this.paint(opts);
    fn();
    this.p = prev;
    return this;
  }

  emit(x, y, z, nx, ny, nz, u, v, sway = this.p.sway) {
    this.vert(x, y, z, nx, ny, nz);
    const p = this.p;
    this.uv.push(u, v);
    this.col.push(p.color[0], p.color[1], p.color[2]);
    this.mat.push(p.layer, p.wear, p.glow, p.channel);
    this.ext.push(p.metal, p.rough, sway, p.phase);
  }

  tri(a, b, c, uvs = null, sways = null) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _c.crossVectors(_a, _b).normalize();
    const nx = _c.x;
    const ny = _c.y;
    const nz = _c.z;
    const pts = [a, b, c];
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    pts.forEach((q, i) => {
      let u;
      let v;
      if (uvs) {
        u = uvs[i][0];
        v = uvs[i][1];
      } else if (ay >= ax && ay >= az) {
        u = q[0];
        v = q[2];
      } else if (ax >= az) {
        u = q[2];
        v = q[1];
      } else {
        u = q[0];
        v = q[1];
      }
      this.emit(q[0], q[1], q[2], nx, ny, nz, u, v, sways ? sways[i] : this.p.sway);
    });
  }

  quad(a, b, c, d, uvs = null, sways = null) {
    this.tri(a, b, c, uvs && [uvs[0], uvs[1], uvs[2]], sways && [sways[0], sways[1], sways[2]]);
    this.tri(a, c, d, uvs && [uvs[0], uvs[2], uvs[3]], sways && [sways[0], sways[2], sways[3]]);
  }

  box(x0, y0, z0, x1, y1, z1, skip = '') {
    if (!skip.includes('pz')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    if (!skip.includes('nz')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    if (!skip.includes('px')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    if (!skip.includes('nx')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    if (!skip.includes('py')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (!skip.includes('ny')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    return this;
  }

  cyl(x, y0, z, y1, r, seg = 10, { r1 = r, caps = true, top = true } = {}) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      const u0 = (i / seg) * Math.PI * 2 * r;
      const u1 = ((i + 1) / seg) * Math.PI * 2 * r;
      const p = this.p;
      const verts = [
        [x + c0 * r, y0, z + s0 * r, c0, s0, u0, y0],
        [x + c1 * r, y0, z + s1 * r, c1, s1, u1, y0],
        [x + c1 * r1, y1, z + s1 * r1, c1, s1, u1, y1],
        [x + c0 * r1, y1, z + s0 * r1, c0, s0, u0, y1],
      ];
      for (const idx of [0, 2, 1, 0, 3, 2]) {
        const q = verts[idx];
        this.emit(q[0], q[1], q[2], q[3], 0, q[4], q[5], q[6], p.sway);
      }
      if (caps) {
        if (top) this.tri([x, y1, z], [x + c1 * r1, y1, z + s1 * r1], [x + c0 * r1, y1, z + s0 * r1]);
        this.tri([x, y0, z], [x + c0 * r, y0, z + s0 * r], [x + c1 * r, y0, z + s1 * r]);
      }
    }
    return this;
  }

  tube(points, r, seg = 6) {
    for (let k = 0; k < points.length - 1; k++) {
      const a = new THREE.Vector3(...points[k]);
      const b = new THREE.Vector3(...points[k + 1]);
      const len = a.distanceTo(b);
      if (len < 1e-4) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      this.push(new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1)));
      this.cyl(0, 0, 0, len, r, seg, { caps: false });
      this.pop();
    }
    return this;
  }

  extrudeX(profile, x0, x1, caps = true) {
    const n = profile.length;
    for (let i = 0; i < n - 1; i++) {
      const [z0, y0] = profile[i];
      const [z1, y1] = profile[i + 1];
      this.quad([x0, y0, z0], [x0, y1, z1], [x1, y1, z1], [x1, y0, z0]);
    }
    if (caps) {
      const contour = profile.map((p) => new THREE.Vector2(p[0], p[1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const t of tris) {
        let [a, b, c] = t.map((k) => profile[k]);
        if ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) > 0) [b, c] = [c, b];
        this.tri([x1, a[1], a[0]], [x1, b[1], b[0]], [x1, c[1], c[0]]);
        this.tri([x0, a[1], a[0]], [x0, c[1], c[0]], [x0, b[1], b[0]]);
      }
    }
    return this;
  }

  wall(u0, u1, v0, v1, holes = [], z = 0) {
    const shape = [new THREE.Vector2(u0, v0), new THREE.Vector2(u1, v0), new THREE.Vector2(u1, v1), new THREE.Vector2(u0, v1)];
    const hs = holes.map((h) => [new THREE.Vector2(h[0], h[1]), new THREE.Vector2(h[0], h[3]), new THREE.Vector2(h[2], h[3]), new THREE.Vector2(h[2], h[1])]);
    const all = [...shape, ...hs.flat()];
    const tris = THREE.ShapeUtils.triangulateShape(shape, hs);
    for (const t of tris) {
      const [a, b, c] = t.map((k) => all[k]);
      const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
      if (area > 0) this.tri([a.x, a.y, z], [b.x, b.y, z], [c.x, c.y, z]);
      else this.tri([a.x, a.y, z], [c.x, c.y, z], [b.x, b.y, z]);
    }
    return this;
  }

  poly(points, z = 0, holes = []) {
    const shape = points.map((p) => new THREE.Vector2(p[0], p[1]));
    const hs = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
    const all = [...shape, ...hs.flat()];
    for (const t of THREE.ShapeUtils.triangulateShape(shape, hs)) {
      const [a, b, c] = t.map((k) => all[k]);
      const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
      if (area > 0) this.tri([a.x, a.y, z], [b.x, b.y, z], [c.x, c.y, z]);
      else this.tri([a.x, a.y, z], [c.x, c.y, z], [b.x, b.y, z]);
    }
    return this;
  }

  reveal(u0, v0, u1, v1, depth, z = 0) {
    this.quad([u0, v0, z], [u0, v0, z - depth], [u0, v1, z - depth], [u0, v1, z]);
    this.quad([u1, v0, z - depth], [u1, v0, z], [u1, v1, z], [u1, v1, z - depth]);
    this.quad([u0, v1, z], [u0, v1, z - depth], [u1, v1, z - depth], [u1, v1, z]);
    this.quad([u0, v0, z - depth], [u0, v0, z], [u1, v0, z], [u1, v0, z - depth]);
    return this;
  }

  geometry() {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 4));
    g.setAttribute('aExt', new THREE.Float32BufferAttribute(this.ext, 4));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export class Glass extends Base {
  constructor() {
    super();
    this.win = [];
    this.room = [];
  }

  pane(u0, v0, u1, v1, z, room, region = null) {
    const W = u1 - u0;
    const H = v1 - v0;
    const r = region || [0, 0, W, H];
    const corners = [[u0, v0, r[0], r[1]], [u1, v0, r[0] + W, r[1]], [u1, v1, r[0] + W, r[1] + H], [u0, v1, r[0], r[1] + H]];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const c = corners[idx];
      this.vert(c[0], c[1], z, 0, 0, 1);
      this.win.push(c[2], c[3], r[2], r[3]);
      this.room.push(room.depth ?? 4, room.seed ?? 0, room.kind ?? 0, room.lit ?? 0);
    }
    return this;
  }

  geometry() {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aWin', new THREE.Float32BufferAttribute(this.win, 4));
    g.setAttribute('aRoom', new THREE.Float32BufferAttribute(this.room, 4));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export class Decals extends Base {
  constructor() {
    super();
    this.uv = [];
    this.glow = [];
  }

  put(item, u0, v0, u1, v1, z = 0.012, { glow = 0, channel = 0, flip = false, fade = 1, sway = 0 } = {}) {
    if (!item) return this;
    const [a, b, c, d] = item.uv;
    const ua = flip ? c : a;
    const ub = flip ? a : c;
    const corners = [[u0, v0, ua, b, 1], [u1, v0, ub, b, 1], [u1, v1, ub, d, 0], [u0, v1, ua, d, 0]];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const k = corners[idx];
      this.vert(k[0], k[1], z, 0, 0, 1);
      this.uv.push(k[2], k[3]);
      this.glow.push(glow, channel, fade, sway * k[4]);
    }
    return this;
  }

  quad(item, pts, { glow = 0, channel = 0, fade = 1, uv = null, sway = null } = {}) {
    if (!item) return this;
    const [a, b, c, d] = item.uv;
    const r = uv || [0, 0, 1, 1];
    const map = (k) => [a + (c - a) * k[0], b + (d - b) * k[1]];
    const uvs = [map([r[0], r[1]]), map([r[2], r[1]]), map([r[2], r[3]]), map([r[0], r[3]])];
    const e1 = new THREE.Vector3().subVectors(new THREE.Vector3(...pts[1]), new THREE.Vector3(...pts[0]));
    const e2 = new THREE.Vector3().subVectors(new THREE.Vector3(...pts[2]), new THREE.Vector3(...pts[0]));
    const n = e1.cross(e2).normalize();
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const q = pts[idx];
      this.vert(q[0], q[1], q[2], n.x, n.y, n.z);
      this.uv.push(uvs[idx][0], uvs[idx][1]);
      this.glow.push(glow, channel, fade, sway ? sway[idx] : 0);
    }
    return this;
  }

  fit(item, cu, cv, width, z = 0.012, opts = {}) {
    if (!item) return this;
    const h = width / item.aspect;
    return this.put(item, cu - width / 2, cv - h / 2, cu + width / 2, cv + h / 2, z, opts);
  }

  geometry() {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 4));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
