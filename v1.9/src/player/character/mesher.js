// Costa del Gzowo: surface nets polygoniser with surface projection, exact field clipping, hem walls and bone weight fields.
import { BIG } from './sdf.js';

const BRICK = 16;

function gradient(sdf, x, y, z, e, out) {
  const a = sdf.d(x + e, y - e, z - e);
  const b = sdf.d(x - e, y - e, z + e);
  const c = sdf.d(x - e, y + e, z - e);
  const d = sdf.d(x + e, y + e, z + e);
  out[0] = a - b - c + d;
  out[1] = -a - b + c + d;
  out[2] = -a + b - c + d;
  const l = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= l;
  out[1] /= l;
  out[2] /= l;
  return out;
}

function project(sdf, p, h, n, steps = 3) {
  const g = [0, 0, 0];
  const start = [p[0], p[1], p[2]];
  for (let s = 0; s < steps; s++) {
    const d = sdf.d(p[0], p[1], p[2]);
    if (Math.abs(d) < 1e-5) break;
    gradient(sdf, p[0], p[1], p[2], h * 0.25, g);
    p[0] -= g[0] * d;
    p[1] -= g[1] * d;
    p[2] -= g[2] * d;
  }
  const mx = p[0] - start[0];
  const my = p[1] - start[1];
  const mz = p[2] - start[2];
  const ml = Math.hypot(mx, my, mz);
  if (ml > h * 0.75) {
    const s = (h * 0.75) / ml;
    p[0] = start[0] + mx * s;
    p[1] = start[1] + my * s;
    p[2] = start[2] + mz * s;
  }
  gradient(sdf, p[0], p[1], p[2], h * 0.35, n);
}

export function surfaceNets({ sdf, frame, min, max, h }) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const vals = new Float32Array(nx * ny * nz);
  const at = (i, j, k) => frame.point(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  const visit = (i0, j0, k0, size) => {
    const ei = Math.min(i0 + size, nx);
    const ej = Math.min(j0 + size, ny);
    const ek = Math.min(k0 + size, nz);
    if (i0 >= ei || j0 >= ej || k0 >= ek) return;
    if (size > 2) {
      const half = Math.sqrt((ei - i0 - 1) ** 2 + (ej - j0 - 1) ** 2 + (ek - k0 - 1) ** 2) * h * 0.5;
      const c = at((i0 + ei - 1) / 2, (j0 + ej - 1) / 2, (k0 + ek - 1) / 2);
      const dc = sdf.d(c[0], c[1], c[2]);
      if (Math.abs(dc) > half * 1.15 + h * 2) {
        const fill = Math.sign(dc) * (Math.abs(dc) - half);
        for (let k = k0; k < ek; k++) for (let j = j0; j < ej; j++) vals.fill(fill, i0 + nx * (j + ny * k), ei + nx * (j + ny * k));
        return;
      }
      const hs = size >> 1;
      for (let q = 0; q < 8; q++) visit(i0 + (q & 1) * hs, j0 + ((q >> 1) & 1) * hs, k0 + ((q >> 2) & 1) * hs, hs);
      return;
    }
    for (let k = k0; k < ek; k++) {
      for (let j = j0; j < ej; j++) {
        for (let i = i0; i < ei; i++) {
          const p = at(i, j, k);
          vals[i + nx * (j + ny * k)] = sdf.d(p[0], p[1], p[2]);
        }
      }
    }
  };
  for (let k = 0; k < nz; k += BRICK) for (let j = 0; j < ny; j += BRICK) for (let i = 0; i < nx; i += BRICK) visit(i, j, k, BRICK);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) vals[i + nx * (j + ny * k)] = Math.max(vals[i + nx * (j + ny * k)], 1e-4);
    }
  }
  const cx = nx - 1;
  const cy = ny - 1;
  const cells = new Int32Array(cx * cy * (nz - 1)).fill(-1);
  const pos = [];
  const nor = [];
  const corner = new Float32Array(8);
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const n = [0, 0, 0];
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = vals[i + (c & 1) + nx * (j + ((c >> 1) & 1) + ny * (k + ((c >> 2) & 1)))];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a];
          const vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          cnt++;
        }
        const fx = sx / cnt;
        const fy = sy / cnt;
        const fz = sz / cnt;
        const p = frame.point(min[0] + (i + fx) * h, min[1] + (j + fy) * h, min[2] + (k + fz) * h);
        const gx = (corner[1] - corner[0]) * (1 - fy) * (1 - fz) + (corner[3] - corner[2]) * fy * (1 - fz) + (corner[5] - corner[4]) * (1 - fy) * fz + (corner[7] - corner[6]) * fy * fz;
        const gy = (corner[2] - corner[0]) * (1 - fx) * (1 - fz) + (corner[3] - corner[1]) * fx * (1 - fz) + (corner[6] - corner[4]) * (1 - fx) * fz + (corner[7] - corner[5]) * fx * fz;
        const gz = (corner[4] - corner[0]) * (1 - fx) * (1 - fy) + (corner[5] - corner[1]) * fx * (1 - fy) + (corner[6] - corner[2]) * (1 - fx) * fy + (corner[7] - corner[3]) * fx * fy;
        const d = frame.dir(gx, gy, gz);
        const gl = Math.hypot(d[0], d[1], d[2]) || 1;
        n[0] = d[0] / gl;
        n[1] = d[1] / gl;
        n[2] = d[2] / gl;
        cells[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(p[0], p[1], p[2]);
        nor.push(n[0], n[1], n[2]);
      }
    }
  }
  const idx = [];
  const cell = (i, j, k) => cells[i + cx * (j + cy * k)];
  const quad = (a, b, c, d, dir) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const P = (q) => [pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]];
    const pa = P(a);
    const pb = P(b);
    const pc = P(c);
    const pd = P(d);
    const e1 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const e2 = [pd[0] - pb[0], pd[1] - pb[1], pd[2] - pb[2]];
    const qn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (qn[0] * dir[0] + qn[1] * dir[1] + qn[2] * dir[2] < 0) {
      const t = b;
      b = d;
      d = t;
    }
    const dac = Math.hypot(...e1);
    const dbd = Math.hypot(...e2);
    if (dac <= dbd) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  };
  const ax = frame.x;
  const ay = frame.y;
  const az = frame.z;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v0 = vals[i + nx * (j + ny * k)];
        const in0 = v0 < 0;
        if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
          const v1 = vals[i + 1 + nx * (j + ny * k)];
          if (in0 !== v1 < 0) {
            const s = in0 ? 1 : -1;
            quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), [ax[0] * s, ax[1] * s, ax[2] * s]);
          }
        }
        if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
          const v1 = vals[i + nx * (j + 1 + ny * k)];
          if (in0 !== v1 < 0) {
            const s = in0 ? 1 : -1;
            quad(cell(i - 1, j, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i - 1, j, k), [ay[0] * s, ay[1] * s, ay[2] * s]);
          }
        }
        if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
          const v1 = vals[i + nx * (j + ny * (k + 1))];
          if (in0 !== v1 < 0) {
            const s = in0 ? 1 : -1;
            quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), [az[0] * s, az[1] * s, az[2] * s]);
          }
        }
      }
    }
  }
  return { pos, nor, idx, h };
}

export function clipMesh(mesh, g, sdf) {
  const { pos, nor, idx, h } = mesh;
  const gv = [];
  for (let v = 0; v < pos.length / 3; v++) gv.push(g(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]));
  const out = [];
  const edgeMap = new Map();
  const boundary = [];
  const onCut = new Set();
  const cut = (a, b) => {
    const key = a < b ? a * 1e7 + b : b * 1e7 + a;
    let v = edgeMap.get(key);
    if (v !== undefined) return v;
    const t = gv[a] / (gv[a] - gv[b]);
    const p = [0, 1, 2].map((c) => pos[a * 3 + c] + (pos[b * 3 + c] - pos[a * 3 + c]) * t);
    const n = [0, 0, 0];
    if (sdf) project(sdf, p, h, n, 1);
    else {
      for (let c = 0; c < 3; c++) n[c] = nor[a * 3 + c] + (nor[b * 3 + c] - nor[a * 3 + c]) * t;
      const l = Math.hypot(...n) || 1;
      n[0] /= l;
      n[1] /= l;
      n[2] /= l;
    }
    v = pos.length / 3;
    pos.push(...p);
    nor.push(...n);
    gv.push(0);
    edgeMap.set(key, v);
    onCut.add(v);
    return v;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]];
    const ins = tri.map((v) => gv[v] <= 0);
    const nin = ins.filter(Boolean).length;
    if (nin === 3) {
      out.push(...tri);
      continue;
    }
    if (nin === 0) continue;
    const poly = [];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const ia = gv[a] <= 0;
      const ib = gv[b] <= 0;
      if (ia) poly.push(a);
      if (ia !== ib) poly.push(cut(a, b));
    }
    for (let q = 1; q < poly.length - 1; q++) out.push(poly[0], poly[q], poly[q + 1]);
    for (let q = 0; q < poly.length; q++) {
      const a = poly[q];
      const b = poly[(q + 1) % poly.length];
      if (onCut.has(a) && onCut.has(b)) boundary.push(a, b);
    }
  }
  return { pos, nor, idx: out, h, boundary };
}

export function compact(mesh) {
  const { pos, nor, idx } = mesh;
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const P = [];
  const N = [];
  const I = [];
  for (const v of idx) {
    if (remap[v] < 0) {
      remap[v] = P.length / 3;
      P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      N.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
    }
    I.push(remap[v]);
  }
  const boundary = (mesh.boundary || []).filter((v) => remap[v] >= 0).map((v) => remap[v]);
  return { pos: P, nor: N, idx: I, h: mesh.h, boundary: boundary.length % 2 ? boundary.slice(0, -1) : boundary };
}

export function hemWall(mesh, depth, gradG, roll = 0.6) {
  const { pos, nor, idx, boundary } = mesh;
  const made = new Map();
  const g = [0, 0, 0];
  const pair = (v) => {
    if (made.has(v)) return made.get(v);
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const n = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]];
    gradG(p[0], p[1], p[2], g);
    const top = [g[0] * roll + n[0] * (1 - roll), g[1] * roll + n[1] * (1 - roll), g[2] * roll + n[2] * (1 - roll)];
    const tl = Math.hypot(...top) || 1;
    const a = pos.length / 3;
    pos.push(...p);
    nor.push(top[0] / tl, top[1] / tl, top[2] / tl);
    pos.push(p[0] - n[0] * depth + g[0] * depth * 0.15, p[1] - n[1] * depth + g[1] * depth * 0.15, p[2] - n[2] * depth + g[2] * depth * 0.15);
    nor.push(g[0], g[1], g[2]);
    made.set(v, [a, a + 1]);
    return [a, a + 1];
  };
  for (let e = 0; e < boundary.length; e += 2) {
    const [a0, a1] = pair(boundary[e]);
    const [b0, b1] = pair(boundary[e + 1]);
    const P = (q) => [pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]];
    const pa = P(a0);
    const pb = P(b0);
    const pc = P(b1);
    const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const qn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    gradG(pa[0], pa[1], pa[2], g);
    if (qn[0] * g[0] + qn[1] * g[1] + qn[2] * g[2] >= 0) idx.push(a0, b0, b1, a0, b1, a1);
    else idx.push(b0, a0, a1, b0, a1, b1);
  }
  return mesh;
}

export function fieldGradient(fn) {
  return (x, y, z, out) => {
    const e = 0.0015;
    out[0] = fn(x + e, y, z) - fn(x - e, y, z);
    out[1] = fn(x, y + e, z) - fn(x, y - e, z);
    out[2] = fn(x, y, z + e) - fn(x, y, z - e);
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l;
    out[1] /= l;
    out[2] /= l;
    return out;
  };
}

export function weightField(leafList, boneIndex) {
  const leaves = leafList.map((leaf) => ({ leaf, bones: Object.entries(leaf.bones).map(([name, w]) => [boneIndex[name], w]) }));
  for (const l of leaves) for (const [i] of l.bones) if (i === undefined) throw new Error('weight field: unknown bone');
  const ds = new Float32Array(leaves.length);
  return (x, y, z, sigma) => {
    let dmin = BIG;
    for (let i = 0; i < leaves.length; i++) {
      const b = leaves[i].leaf.bound(x, y, z);
      if (b > dmin + sigma * 8) {
        ds[i] = BIG;
        continue;
      }
      const d = Math.max(leaves[i].leaf.d(x, y, z), -sigma * 0.5);
      ds[i] = d;
      if (d < dmin) dmin = d;
    }
    const acc = new Map();
    for (let i = 0; i < leaves.length; i++) {
      const rel = ds[i] - dmin;
      if (rel > sigma * 7) continue;
      const w = Math.exp(-rel / sigma);
      for (const [bi, bw] of leaves[i].bones) acc.set(bi, (acc.get(bi) || 0) + w * bw);
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0) || 1;
    const out = [0, 0, 0, 0, 0, 0, 0, 0];
    top.forEach(([bi, w], q) => {
      out[q] = bi;
      out[4 + q] = w / sum;
    });
    return out;
  };
}
