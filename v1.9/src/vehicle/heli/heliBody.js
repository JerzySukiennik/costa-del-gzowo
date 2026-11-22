// Costa del Gzowo helicopter: fuselage skin lofted from analytic cross sections, with the windows and the pilot door cut out along smooth contours.
import * as THREE from 'three';
import { monotone, smoothstep } from '../carGeometry.js';

export const K = 1.9;
export const NOSE = 2.34;
export const TAIL = -6.2;
const JOIN = 0.3;
const NV = 128;

const aftTop = monotone([[-6.2, 1.7], [-6.0, 1.72], [-4.0, 1.75], [-2.7, 1.8], [-2.0, 1.93], [-1.2, 2.04], [-0.5, 2.07], [0.3, 2.07], [0.6, 2.07]]);
const aftBot = monotone([[-6.2, 1.52], [-6.0, 1.5], [-4.0, 1.38], [-2.7, 1.16], [-2.0, 0.86], [-1.2, 0.62], [-0.5, 0.54], [0.3, 0.52], [0.6, 0.52]]);
const aftWid = monotone([[-6.2, 0.1], [-6.0, 0.115], [-4.0, 0.18], [-2.7, 0.26], [-2.0, 0.46], [-1.2, 0.67], [-0.5, 0.76], [0.3, 0.78], [0.6, 0.78]]);

export function section(x) {
  if (x >= JOIN) {
    const s = Math.min(0.9995, (x - JOIN) / (NOSE - JOIN));
    return { top: 1.0 + 1.07 * Math.pow(1 - s * s, 0.75), bot: 1.0 - 0.48 * Math.pow(1 - s * s * s, 0.6), w: 0.78 * Math.pow(1 - Math.pow(s, 2.4), 0.62), n: 2.0 + 0.6 * (1 - s * s) };
  }
  return { top: aftTop(x), bot: aftBot(x), w: aftWid(x), n: 2.0 + 0.6 * smoothstep(-2.6, -0.8, x) };
}

export function skinPoint(x, t, out = new THREE.Vector3()) {
  const s = section(x);
  const th = t * Math.PI;
  const sn = Math.sin(th);
  const cs = Math.cos(th);
  const e = 2 / s.n;
  const mid = s.bot + (s.top - s.bot) * 0.46;
  const z = s.w * Math.sign(sn) * Math.pow(Math.abs(sn), e);
  const y = cs >= 0 ? mid + (s.top - mid) * Math.pow(cs, e) : mid - (mid - s.bot) * Math.pow(-cs, e);
  return out.set(x, y, z);
}

function inset(poly, r) {
  const n = poly.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    lines.push({ px: a[0] - (dy / len) * r, py: a[1] + (dx / len) * r, dx, dy });
  }
  return lines.map((l, i) => {
    const m = lines[(i + n - 1) % n];
    const det = m.dx * l.dy - m.dy * l.dx;
    const k = ((l.px - m.px) * l.dy - (l.py - m.py) * l.dx) / det;
    return [m.px + m.dx * k, m.py + m.dy * k];
  });
}

function sdPolygon(v, px, py) {
  let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2;
  let s = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
    const ex = v[j][0] - v[i][0];
    const ey = v[j][1] - v[i][1];
    const wx = px - v[i][0];
    const wy = py - v[i][1];
    const k = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    const bx = wx - ex * k;
    const by = wy - ey * k;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= v[i][1];
    const c2 = py < v[j][1];
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

function shape(points, r) {
  const poly = inset(points.map(([x, t]) => [x, t * K]), r);
  const f = (x, T) => sdPolygon(poly, x, T) - r;
  f.poly = poly;
  f.r = r;
  return f;
}

export const SHAPES = {
  windshield: shape([[1.0, 0.013], [2.14, 0.013], [2.14, 0.56], [1.64, 0.56], [1.02, 0.22]], 0.07),
  chin: shape([[1.78, 0.64], [2.1, 0.64], [2.1, 0.9], [1.86, 0.9]], 0.05),
  doorWindow: shape([[0.14, 0.22], [0.94, 0.22], [1.54, 0.56], [0.14, 0.56]], 0.07),
  rearWindow: shape([[-0.86, 0.26], [0.02, 0.22], [0.02, 0.56], [-0.74, 0.56]], 0.07),
  door: shape([[0.07, 0.17], [0.89, 0.17], [1.7, 0.62], [1.7, 0.86], [0.07, 0.86]], 0.05),
  rearDoor: shape([[-0.95, 0.19], [0.055, 0.19], [0.055, 0.86], [-0.8, 0.86]], 0.05),
};

function glassName(x, t) {
  const T = Math.abs(t) * K;
  if (SHAPES.windshield(x, T) < 0) return 'windshield';
  if (SHAPES.chin(x, T) < 0) return t < 0 ? 'chinL' : 'chinR';
  if (SHAPES.doorWindow(x, T) < 0) return t < 0 ? 'winFL' : 'winFR';
  if (SHAPES.rearWindow(x, T) < 0) return t < 0 ? 'winRL' : 'winRR';
  return null;
}

export function buildFuselage() {
  const xs = [];
  for (let x = TAIL; x < -2.7 - 1e-6; x += 0.25) xs.push(x);
  for (let x = -2.7; x < -1.1 - 1e-6; x += 0.08) xs.push(x);
  for (let x = -1.1; x < 2.2 - 1e-6; x += 0.03) xs.push(x);
  for (let i = 0; i <= 6; i++) xs.push(2.2 + (NOSE - 0.004 - 2.2) * (1 - (1 - i / 6) ** 2));
  const NU = xs.length;
  const id = (i, j) => i * NV + (j % NV);
  const px = new Float32Array(NU * NV);
  const pt = new Float32Array(NU * NV);
  const flag = new Uint8Array(NU * NV);
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    px[id(i, j)] = xs[i];
    pt[id(i, j)] = -1 + (2 * j) / NV;
  }
  const contours = [
    { f: SHAPES.windshield, side: 0, kind: 1 }, { f: SHAPES.chin, side: 0, kind: 1 }, { f: SHAPES.doorWindow, side: 0, kind: 1 }, { f: SHAPES.rearWindow, side: 0, kind: 1 },
    { f: SHAPES.door, side: -1, kind: 2 },
  ];
  const hT = (2 / NV) * K;
  const e = 0.002;
  for (const c of contours) {
    for (let i = 1; i < NU - 1; i++) {
      const hx = (xs[i + 1] - xs[i - 1]) / 2;
      const reach = 0.5 * Math.min(hx, hT);
      for (let j = 0; j < NV; j++) {
        const k = id(i, j);
        if (flag[k]) continue;
        const sgn = pt[k] < 0 ? -1 : 1;
        if (c.side && sgn !== c.side) continue;
        let x = px[k];
        let T = Math.abs(pt[k]) * K;
        let d = c.f(x, T);
        if (Math.abs(d) > reach) continue;
        for (let n = 0; n < 3; n++) {
          const gx = (c.f(x + e, T) - c.f(x - e, T)) / (2 * e);
          const gT = (c.f(x, T + e) - c.f(x, T - e)) / (2 * e);
          const g2 = gx * gx + gT * gT || 1;
          x -= (d * gx) / g2;
          T -= (d * gT) / g2;
          d = c.f(x, T);
        }
        px[k] = x;
        pt[k] = (sgn * T) / K;
        flag[k] = c.kind;
      }
    }
  }
  const count = NU * NV + 2;
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let k = 0; k < NU * NV; k++) {
    skinPoint(px[k], pt[k], v);
    pos.set([v.x, v.y, v.z], k * 3);
  }
  const tailCap = NU * NV;
  const noseCap = NU * NV + 1;
  const st = section(TAIL);
  pos.set([TAIL - 0.04, (st.top + st.bot) / 2, 0], tailCap * 3);
  pos.set([NOSE, 1.0, 0], noseCap * 3);

  const tris = { shell: [], door: [], doorGlass: [] };
  const glass = {};
  const centroid = (a, b, c, j) => {
    const tOf = (k, jj) => (jj === NV ? pt[k] + (pt[k] < 0 ? 2 : 0) : pt[k]);
    return [(px[a[0]] + px[b[0]] + px[c[0]]) / 3, (tOf(a[0], a[1]) + tOf(b[0], b[1]) + tOf(c[0], c[1])) / 3];
  };
  const put = (a, b, c) => {
    const [x, t] = centroid(a, b, c);
    const g = glassName(x, t);
    const inDoor = t < 0 && SHAPES.door(x, Math.abs(t) * K) < 0;
    let list;
    if (inDoor) list = g ? tris.doorGlass : tris.door;
    else if (g) list = glass[g] || (glass[g] = []);
    else list = tris.shell;
    list.push(a[0], b[0], c[0]);
  };
  for (let i = 0; i < NU - 1; i++) {
    for (let j = 0; j < NV; j++) {
      const a = [id(i, j), j];
      const b = [id(i + 1, j), j];
      const c = [id(i + 1, j + 1), j + 1];
      const d = [id(i, j + 1), j + 1];
      if (flag[a[0]] && flag[c[0]] && !(flag[b[0]] && flag[d[0]])) {
        put(a, d, c);
        put(a, c, b);
      } else {
        put(a, d, b);
        put(b, d, c);
      }
    }
  }
  for (let j = 0; j < NV; j++) {
    tris.shell.push(tailCap, id(0, j + 1), id(0, j));
    tris.shell.push(noseCap, id(NU - 1, j), id(NU - 1, j + 1));
  }

  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  all.setIndex([...tris.shell, ...tris.door, ...tris.doorGlass, ...Object.values(glass).flat()]);
  all.computeVertexNormals();
  const nrm = all.attributes.normal.array;

  const extract = (index, paint) => {
    const map = new Map();
    const P = [];
    const N = [];
    const skin = [];
    const edge = [];
    const out = [];
    for (const k of index) {
      let m = map.get(k);
      if (m === undefined) {
        m = P.length / 3;
        map.set(k, m);
        P.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
        N.push(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]);
        const cap = k >= NU * NV;
        skin.push(cap ? pos[k * 3] : px[k], cap ? (k === noseCap ? 0.55 : 0) : pt[k]);
        edge.push(!cap && flag[k] === 1 ? 1 : 0);
      }
      out.push(m);
    }
    const g = new THREE.BufferGeometry();
    const n = P.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('aRest', new THREE.Float32BufferAttribute(P.slice(), 3));
    g.setAttribute('aEdge', new THREE.Float32BufferAttribute(paint ? edge : new Float32Array(n), 1));
    if (paint) {
      g.setAttribute('aSkin', new THREE.Float32BufferAttribute(skin, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    } else g.setAttribute('aProj', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
    g.setIndex(out);
    g.computeBoundingSphere();
    return g;
  };

  const hinge = skinPoint(1.7, -0.74);
  const windows = {};
  for (const [name, index] of Object.entries(glass)) windows[name] = extract(index, false);
  return {
    shell: extract(tris.shell, true),
    door: extract(tris.door, true),
    doorGlass: extract(tris.doorGlass, false),
    windows,
    hinge: new THREE.Vector3(1.7, hinge.y, hinge.z + 0.01),
  };
}
