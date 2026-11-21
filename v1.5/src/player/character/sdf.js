// Costa del Gzowo: signed distance sculpting kit (frames, primitives, smooth booleans with bounding-sphere culling, value noise).
export const BIG = 1e3;

function eulerXYZ(a, b, c) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cc = Math.cos(c);
  const sc = Math.sin(c);
  return [
    [cb * cc, ca * sc + sa * sb * cc, sa * sc - ca * sb * cc],
    [-cb * sc, ca * cc - sa * sb * sc, sa * cc + ca * sb * sc],
    [sb, -sa * cb, ca * cb],
  ];
}

export class Frame {
  constructor(o = [0, 0, 0], x = [1, 0, 0], y = [0, 1, 0], z = [0, 0, 1]) {
    this.o = o;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static fromMatrix(m) {
    const e = m.elements || m;
    const n = (a, b, c) => {
      const l = Math.hypot(a, b, c);
      return [a / l, b / l, c / l];
    };
    return new Frame([e[12], e[13], e[14]], n(e[0], e[1], e[2]), n(e[4], e[5], e[6]), n(e[8], e[9], e[10]));
  }

  point(a, b, c) {
    const { o, x, y, z } = this;
    return [o[0] + a * x[0] + b * y[0] + c * z[0], o[1] + a * x[1] + b * y[1] + c * z[1], o[2] + a * x[2] + b * y[2] + c * z[2]];
  }

  dir(a, b, c) {
    const { x, y, z } = this;
    return [a * x[0] + b * y[0] + c * z[0], a * x[1] + b * y[1] + c * z[1], a * x[2] + b * y[2] + c * z[2]];
  }

  local(px, py, pz) {
    const dx = px - this.o[0];
    const dy = py - this.o[1];
    const dz = pz - this.o[2];
    const { x, y, z } = this;
    return [dx * x[0] + dy * x[1] + dz * x[2], dx * y[0] + dy * y[1] + dz * y[2], dx * z[0] + dy * z[1] + dz * z[2]];
  }

  sub(a = 0, b = 0, c = 0, rx = 0, ry = 0, rz = 0) {
    const [cx, cy, cz] = eulerXYZ(rx, ry, rz);
    return new Frame(this.point(a, b, c), this.dir(...cx), this.dir(...cy), this.dir(...cz));
  }

  aim(a, b, c, dir, up = [0, 1, 0]) {
    const zl = Math.hypot(...dir);
    const zz = dir.map((v) => v / zl);
    let xx = [up[1] * zz[2] - up[2] * zz[1], up[2] * zz[0] - up[0] * zz[2], up[0] * zz[1] - up[1] * zz[0]];
    const xl = Math.hypot(...xx) || 1;
    xx = xx.map((v) => v / xl);
    const yy = [zz[1] * xx[2] - zz[2] * xx[1], zz[2] * xx[0] - zz[0] * xx[2], zz[0] * xx[1] - zz[1] * xx[0]];
    return new Frame(this.point(a, b, c), this.dir(...xx), this.dir(...yy), this.dir(...zz));
  }
}

export const WORLD = new Frame();

export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}

export function smax(a, b, k) {
  return -smin(-a, -b, k);
}

class Node {
  setBound(c, r) {
    this.cx = c[0];
    this.cy = c[1];
    this.cz = c[2];
    this.r = r;
  }

  bound(x, y, z) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const dz = z - this.cz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - this.r;
  }

  tag(bones) {
    this.bones = bones;
    return this;
  }
}

class Leaf extends Node {
  constructor(frame, r) {
    super();
    this.f = frame;
    this.setBound(frame.o, r);
    this.bones = null;
  }

  d(px, py, pz) {
    const f = this.f;
    const dx = px - f.o[0];
    const dy = py - f.o[1];
    const dz = pz - f.o[2];
    return this.l(dx * f.x[0] + dy * f.x[1] + dz * f.x[2], dx * f.y[0] + dy * f.y[1] + dz * f.y[2], dx * f.z[0] + dy * f.z[1] + dz * f.z[2]);
  }
}

class Ellipsoid extends Leaf {
  constructor(frame, rx, ry, rz) {
    super(frame, Math.max(rx, ry, rz));
    this.ix = 1 / rx;
    this.iy = 1 / ry;
    this.iz = 1 / rz;
  }

  l(x, y, z) {
    const ax = x * this.ix;
    const ay = y * this.iy;
    const az = z * this.iz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax * this.ix;
    const by = ay * this.iy;
    const bz = az * this.iz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -1 / Math.max(this.ix, this.iy, this.iz) : (k0 * (k0 - 1)) / k1;
  }
}

class RoundBox extends Leaf {
  constructor(frame, hx, hy, hz, round) {
    super(frame, Math.hypot(hx, hy, hz));
    this.h = [hx - round, hy - round, hz - round];
    this.round = round;
  }

  l(x, y, z) {
    const qx = Math.abs(x) - this.h[0];
    const qy = Math.abs(y) - this.h[1];
    const qz = Math.abs(z) - this.h[2];
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - this.round;
  }
}

class Torus extends Leaf {
  constructor(frame, R, r, sx = 1, sz = 1) {
    super(frame, R * Math.max(sx, sz) + r);
    this.R = R;
    this.rr = r;
    this.sx = sx;
    this.sz = sz;
  }

  l(x, y, z) {
    const q = Math.sqrt((x * x) / (this.sx * this.sx) + (z * z) / (this.sz * this.sz)) - this.R;
    return Math.sqrt(q * q + y * y) - this.rr;
  }
}

class Custom extends Leaf {
  constructor(frame, r, fn) {
    super(frame, r);
    this.fn = fn;
  }

  l(x, y, z) {
    return this.fn(x, y, z);
  }
}

class RoundCone extends Node {
  constructor(a, b, r1, r2) {
    super();
    this.a = a;
    this.ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    this.l2 = this.ba[0] ** 2 + this.ba[1] ** 2 + this.ba[2] ** 2;
    this.r1 = r1;
    this.r2 = r2;
    this.rr = r1 - r2;
    this.a2 = this.l2 - this.rr * this.rr;
    this.il2 = 1 / this.l2;
    this.setBound([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], Math.sqrt(this.l2) / 2 + Math.max(r1, r2));
    this.bones = null;
  }

  d(px, py, pz) {
    const ba = this.ba;
    const l2 = this.l2;
    const pax = px - this.a[0];
    const pay = py - this.a[1];
    const paz = pz - this.a[2];
    const y = pax * ba[0] + pay * ba[1] + paz * ba[2];
    const z = y - l2;
    const xx = pax * l2 - ba[0] * y;
    const xy = pay * l2 - ba[1] * y;
    const xz = paz * l2 - ba[2] * y;
    const x2 = xx * xx + xy * xy + xz * xz;
    const y2 = y * y * l2;
    const z2 = z * z * l2;
    const rr = this.rr;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * this.a2 * z2 > k) return Math.sqrt(x2 + z2) * this.il2 - this.r2;
    if (Math.sign(y) * this.a2 * y2 < k) return Math.sqrt(x2 + y2) * this.il2 - this.r1;
    return (Math.sqrt(x2 * this.a2 * this.il2) + y * rr) * this.il2 - this.r1;
  }
}

class Union extends Node {
  constructor(children, k) {
    super();
    this.children = children.filter(Boolean);
    this.k = k;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const c of this.children) {
      cx += c.cx;
      cy += c.cy;
      cz += c.cz;
    }
    const n = this.children.length;
    const c = [cx / n, cy / n, cz / n];
    let r = 0;
    for (const ch of this.children) r = Math.max(r, Math.hypot(ch.cx - c[0], ch.cy - c[1], ch.cz - c[2]) + ch.r);
    this.setBound(c, r + k * 0.25);
    this.bs = new Float64Array(n);
  }

  d(x, y, z) {
    const ch = this.children;
    const n = ch.length;
    const bs = this.bs;
    let first = 0;
    let low = BIG;
    for (let i = 0; i < n; i++) {
      const b = ch[i].bound(x, y, z);
      bs[i] = b;
      if (b < low) {
        low = b;
        first = i;
      }
    }
    const k = this.k;
    let best = ch[first].d(x, y, z);
    for (let i = 0; i < n; i++) {
      if (i === first || bs[i] > best + k) continue;
      best = smin(best, ch[i].d(x, y, z), k);
    }
    return best;
  }
}

class Subtract extends Node {
  constructor(a, b, k) {
    super();
    this.a = a;
    this.b = b;
    this.k = k;
    this.setBound([a.cx, a.cy, a.cz], a.r);
  }

  d(x, y, z) {
    const v = this.a.d(x, y, z);
    if (v + this.b.bound(x, y, z) >= this.k) return v;
    return smax(v, -this.b.d(x, y, z), this.k);
  }
}

class Intersect extends Node {
  constructor(a, b, k) {
    super();
    this.a = a;
    this.b = b;
    this.k = k;
    this.setBound([a.cx, a.cy, a.cz], a.r);
  }

  d(x, y, z) {
    return smax(this.a.d(x, y, z), this.b.d(x, y, z), this.k);
  }
}

class Shift extends Node {
  constructor(child, fn, amp) {
    super();
    this.child = child;
    this.fn = fn;
    this.amp = amp;
    this.setBound([child.cx, child.cy, child.cz], child.r + amp);
  }

  d(x, y, z) {
    const v = this.child.d(x, y, z);
    if (v > this.amp * 3 + 0.02) return v - this.amp;
    return v + this.fn(x, y, z, v);
  }
}

export const ell = (f, rx, ry, rz) => new Ellipsoid(f, rx, ry, rz);
export const sph = (f, r) => new Ellipsoid(f, r, r, r);
export const box = (f, hx, hy, hz, round = 0) => new RoundBox(f, hx, hy, hz, round);
export const torus = (f, R, r, sx, sz) => new Torus(f, R, r, sx, sz);
export const custom = (f, r, fn) => new Custom(f, r, fn);
export const cone = (a, b, r1, r2) => new RoundCone(a, b, r1, r2);
function cluster(list, k) {
  if (list.length <= 5) return new Union(list, k);
  const ext = [0, 1, 2].map((a) => {
    const v = list.map((c) => [c.cx, c.cy, c.cz][a]);
    return Math.max(...v) - Math.min(...v);
  });
  const axis = ext.indexOf(Math.max(...ext));
  const key = (c) => [c.cx, c.cy, c.cz][axis];
  const sorted = [...list].sort((a, b) => key(a) - key(b));
  const mid = sorted.length >> 1;
  return new Union([cluster(sorted.slice(0, mid), k), cluster(sorted.slice(mid), k)], k);
}

export const union = (k, ...children) => cluster(children.flat().filter(Boolean), k);
export const subtract = (a, b, k = 0) => new Subtract(a, b, k);
export const intersect = (a, b, k = 0) => new Intersect(a, b, k);
export const shift = (child, fn, amp) => new Shift(child, fn, amp);
export const offset = (child, r) => new Shift(child, () => -r, Math.abs(r));

export function leaves(node, out = []) {
  if (!node) return out;
  if (node.children) node.children.forEach((c) => leaves(c, out));
  else if (node instanceof Subtract || node instanceof Intersect) leaves(node.a, out);
  else if (node.child) leaves(node.child, out);
  else if (node.bones) out.push(node);
  return out;
}

export function tagAll(node, bones) {
  if (node.children) node.children.forEach((c) => tagAll(c, bones));
  else if (node.a && node.b && !(node instanceof RoundCone)) tagAll(node.a, bones);
  else if (node.child) tagAll(node.child, bones);
  else if (!node.bones) node.bones = bones;
  return node;
}

function hash(i, j, k) {
  let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function noise(x, y, z) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const k = Math.floor(z);
  const fx = x - i;
  const fy = y - j;
  const fz = z - k;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const a = hash(i, j, k) + (hash(i + 1, j, k) - hash(i, j, k)) * u;
  const b = hash(i, j + 1, k) + (hash(i + 1, j + 1, k) - hash(i, j + 1, k)) * u;
  const c = hash(i, j, k + 1) + (hash(i + 1, j, k + 1) - hash(i, j, k + 1)) * u;
  const d = hash(i, j + 1, k + 1) + (hash(i + 1, j + 1, k + 1) - hash(i, j + 1, k + 1)) * u;
  return (a + (b - a) * v + (c + (d - c) * v - (a + (b - a) * v)) * w) * 2 - 1;
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
