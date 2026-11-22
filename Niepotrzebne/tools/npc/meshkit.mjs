// Costa del Gzowo: mesh tools for the pedestrian bake (border-aware quadric decimation, open-edge search, region meshing, small analytic solids).
import { surfaceNets, clipMesh, compact, hemWall, fieldGradient } from '../../../src/player/character/mesher.js';

const KEY = 4194304;

export function decimateOpen(mesh, target) {
  const { pos, idx } = mesh;
  const nV = pos.length / 3;
  const nF = idx.length / 3;
  if (nF <= target) return idx.slice();
  const F = Int32Array.from(idx);
  const alive = new Uint8Array(nF).fill(1);
  const vf = Array.from({ length: nV }, () => []);
  for (let f = 0; f < nF; f++) for (let c = 0; c < 3; c++) vf[F[f * 3 + c]].push(f);
  const Q = new Float64Array(nV * 10);
  const addPlane = (v, nx, ny, nz, d, w) => {
    const q = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
    for (let i = 0; i < 10; i++) Q[v * 10 + i] += q[i] * w;
  };
  const edgeCount = new Map();
  const ekey = (a, b) => (a < b ? a * KEY + b : b * KEY + a);
  for (let f = 0; f < nF; f++) {
    for (let c = 0; c < 3; c++) {
      const k = ekey(F[f * 3 + c], F[f * 3 + ((c + 1) % 3)]);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
  const border = new Uint8Array(nV);
  for (let f = 0; f < nF; f++) {
    const a = F[f * 3];
    const b = F[f * 3 + 1];
    const c = F[f * 3 + 2];
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3];
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-14) continue;
    nx /= l;
    ny /= l;
    nz /= l;
    const d = -(nx * pos[a * 3] + ny * pos[a * 3 + 1] + nz * pos[a * 3 + 2]);
    for (const v of [a, b, c]) addPlane(v, nx, ny, nz, d, l * 0.5);
    const tri = [a, b, c];
    for (let e = 0; e < 3; e++) {
      const p = tri[e];
      const q = tri[(e + 1) % 3];
      if (edgeCount.get(ekey(p, q)) !== 1) continue;
      border[p] = 1;
      border[q] = 1;
      const ex = pos[q * 3] - pos[p * 3];
      const ey = pos[q * 3 + 1] - pos[p * 3 + 1];
      const ez = pos[q * 3 + 2] - pos[p * 3 + 2];
      const el = Math.hypot(ex, ey, ez) || 1;
      let mx = ey * nz - ez * ny;
      let my = ez * nx - ex * nz;
      let mz = ex * ny - ey * nx;
      const ml = Math.hypot(mx, my, mz) || 1;
      mx /= ml;
      my /= ml;
      mz /= ml;
      const md = -(mx * pos[p * 3] + my * pos[p * 3 + 1] + mz * pos[p * 3 + 2]);
      addPlane(p, mx, my, mz, md, el * el * 40);
      addPlane(q, mx, my, mz, md, el * el * 40);
    }
  }
  const dead = new Uint8Array(nV);
  const stamp = new Uint32Array(nV);
  const heap = [];
  const push = (e) => {
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const cost = (u, v) => {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    let e = 0;
    for (const w of [u, v]) {
      const q = w * 10;
      e += Q[q] * x * x + 2 * Q[q + 1] * x * y + 2 * Q[q + 2] * x * z + 2 * Q[q + 3] * x + Q[q + 4] * y * y + 2 * Q[q + 5] * y * z + 2 * Q[q + 6] * y + Q[q + 7] * z * z + 2 * Q[q + 8] * z + Q[q + 9];
    }
    return e;
  };
  const shared = (a, b) => {
    let n = 0;
    for (const f of vf[a]) if (alive[f] && (F[f * 3] === b || F[f * 3 + 1] === b || F[f * 3 + 2] === b)) n++;
    return n;
  };
  const neighbors = (v) => {
    const s = new Set();
    for (const f of vf[v]) {
      if (!alive[f]) continue;
      for (let c = 0; c < 3; c++) s.add(F[f * 3 + c]);
    }
    s.delete(v);
    return s;
  };
  const offer = (u, v) => {
    if (border[u] && !(border[v] && shared(u, v) === 1)) return;
    push([cost(u, v), u, v, stamp[u], stamp[v]]);
  };
  for (const k of edgeCount.keys()) {
    const a = Math.floor(k / KEY);
    const b = k % KEY;
    offer(a, b);
    offer(b, a);
  }
  const normalOf = (a, b, c, out) => {
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3];
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    out[0] = uy * vz - uz * vy;
    out[1] = uz * vx - ux * vz;
    out[2] = ux * vy - uy * vx;
    return Math.hypot(out[0], out[1], out[2]);
  };
  const n0 = [0, 0, 0];
  const n1 = [0, 0, 0];
  let faces = nF;
  while (faces > target && heap.length) {
    const [, u, v, su, sv] = pop();
    if (dead[u] || dead[v] || su !== stamp[u] || sv !== stamp[v]) continue;
    const nu = neighbors(u);
    if (!nu.has(v)) continue;
    const edgeFaces = shared(u, v);
    if (border[u] && !(border[v] && edgeFaces === 1)) continue;
    const nv = neighbors(v);
    let common = 0;
    for (const w of nu) if (nv.has(w)) common++;
    if (common !== edgeFaces) continue;
    if (border[u] && nu.size <= 2) continue;
    let ok = true;
    for (const f of vf[u]) {
      if (!alive[f]) continue;
      const a = F[f * 3];
      const b = F[f * 3 + 1];
      const c = F[f * 3 + 2];
      if (a === v || b === v || c === v) continue;
      const l0 = normalOf(a, b, c, n0);
      const l1 = normalOf(a === u ? v : a, b === u ? v : b, c === u ? v : c, n1);
      if (l1 < 1e-12 || (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1 + 1e-20) < 0.3) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (const f of vf[u]) {
      if (!alive[f]) continue;
      const a = F[f * 3];
      const b = F[f * 3 + 1];
      const c = F[f * 3 + 2];
      if (a === v || b === v || c === v) {
        alive[f] = 0;
        faces--;
        continue;
      }
      for (let q = 0; q < 3; q++) if (F[f * 3 + q] === u) F[f * 3 + q] = v;
      vf[v].push(f);
    }
    for (let i = 0; i < 10; i++) Q[v * 10 + i] += Q[u * 10 + i];
    dead[u] = 1;
    stamp[v]++;
    vf[v] = vf[v].filter((f) => alive[f]);
    for (const w of neighbors(v)) {
      offer(v, w);
      offer(w, v);
    }
  }
  const out = [];
  for (let f = 0; f < nF; f++) if (alive[f]) out.push(F[f * 3], F[f * 3 + 1], F[f * 3 + 2]);
  return out;
}

export function openEdges(mesh) {
  const count = new Map();
  const { idx } = mesh;
  for (let t = 0; t < idx.length; t += 3) {
    for (let c = 0; c < 3; c++) {
      const a = idx[t + c];
      const b = idx[t + ((c + 1) % 3)];
      const k = a < b ? a * KEY + b : b * KEY + a;
      count.set(k, (count.get(k) || 0) + 1);
    }
  }
  const out = [];
  for (const [k, n] of count) if (n === 1) out.push(Math.floor(k / KEY), k % KEY);
  return out;
}

export function region({ sdf, frame, min, max, h, clip, hem, tris, far }) {
  let mesh = surfaceNets({ sdf, frame, min, max, h });
  if (clip) mesh = clipMesh(mesh, clip, sdf);
  mesh = compact(mesh);
  if (!mesh.idx.length) return { pos: [], nor: [], idx: [], far: [] };
  mesh.idx = decimateOpen(mesh, tris);
  mesh = compact(mesh);
  const farIdx = far > 0 ? decimateOpen(mesh, far) : [];
  if (hem && clip) {
    mesh.boundary = openEdges(mesh);
    hemWall(mesh, hem, fieldGradient(clip));
  }
  return { pos: mesh.pos, nor: mesh.nor, idx: mesh.idx, far: farIdx };
}

function push(mesh, frame, p, n) {
  const w = frame.point(p[0], p[1], p[2]);
  const d = frame.dir(n[0], n[1], n[2]);
  mesh.pos.push(w[0], w[1], w[2]);
  mesh.nor.push(d[0], d[1], d[2]);
  return mesh.pos.length / 3 - 1;
}

export function solidBox(frame, hx, hy, hz) {
  const mesh = { pos: [], nor: [], idx: [], far: [] };
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  const h = [hx, hy, hz];
  for (const [n, u, v] of faces) {
    const corner = (a, b) => [0, 1, 2].map((k) => (n[k] + u[k] * a + v[k] * b) * h[k]);
    const i0 = push(mesh, frame, corner(-1, -1), n);
    push(mesh, frame, corner(1, -1), n);
    push(mesh, frame, corner(1, 1), n);
    push(mesh, frame, corner(-1, 1), n);
    mesh.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  mesh.far = mesh.idx.slice();
  return mesh;
}

export function solidCylinder(frame, r0, r1, half, seg = 12) {
  const mesh = { pos: [], nor: [], idx: [], far: [] };
  const slope = (r0 - r1) / (2 * half);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const n = [c, slope, s];
    const l = Math.hypot(...n);
    push(mesh, frame, [c * r0, -half, s * r0], n.map((k) => k / l));
    push(mesh, frame, [c * r1, half, s * r1], n.map((k) => k / l));
  }
  for (let i = 0; i < seg; i++) mesh.idx.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
  for (const [y, r, ny] of [[half, r1, 1], [-half, r0, -1]]) {
    const c0 = push(mesh, frame, [0, y, 0], [0, ny, 0]);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      push(mesh, frame, [Math.cos(a) * r, y, Math.sin(a) * r], [0, ny, 0]);
    }
    for (let i = 0; i < seg; i++) {
      if (ny > 0) mesh.idx.push(c0, c0 + 2 + i, c0 + 1 + i);
      else mesh.idx.push(c0, c0 + 1 + i, c0 + 2 + i);
    }
  }
  mesh.far = mesh.idx.slice();
  return mesh;
}

export function solidPrism(frame, outline, half, bulge = 0) {
  const mesh = { pos: [], nor: [], idx: [], far: [] };
  const n = outline.length;
  for (const [z, nz] of [[half, 1], [-half, -1]]) {
    const c = push(mesh, frame, [0, 0, z], [0, 0, nz]);
    for (const [x, y] of outline) {
      const l = Math.hypot(x * bulge, y * bulge, 1);
      push(mesh, frame, [x, y, z], [(x * bulge) / l, (y * bulge) / l, nz / l]);
    }
    for (let i = 0; i < n; i++) {
      const a = c + 1 + i;
      const b = c + 1 + ((i + 1) % n);
      if (nz > 0) mesh.idx.push(c, a, b);
      else mesh.idx.push(c, b, a);
    }
  }
  for (let i = 0; i < n; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % n];
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nor = [(y1 - y0) / l, -(x1 - x0) / l, 0];
    const a = push(mesh, frame, [x0, y0, half], nor);
    push(mesh, frame, [x1, y1, half], nor);
    push(mesh, frame, [x1, y1, -half], nor);
    push(mesh, frame, [x0, y0, -half], nor);
    mesh.idx.push(a, a + 3, a + 2, a, a + 2, a + 1);
  }
  mesh.far = mesh.idx.slice();
  return mesh;
}

export function eyeCap(center, radius, rings, seg = 10) {
  const mesh = { pos: [center[0], center[1], center[2] + radius], nor: [0, 0, 1], idx: [], far: [], ring: [0] };
  rings.forEach((theta, r) => {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = [Math.sin(theta) * Math.cos(a), Math.sin(theta) * Math.sin(a), Math.cos(theta)];
      mesh.pos.push(center[0] + n[0] * radius, center[1] + n[1] * radius, center[2] + n[2] * radius);
      mesh.nor.push(...n);
      mesh.ring.push(r + 1);
    }
  });
  for (let i = 0; i < seg; i++) mesh.idx.push(0, 1 + i, 1 + ((i + 1) % seg));
  for (let r = 0; r < rings.length - 1; r++) {
    const a = 1 + r * seg;
    const b = a + seg;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      mesh.idx.push(a + i, b + i, b + j, a + i, b + j, a + j);
    }
  }
  return mesh;
}
