// Costa del Gzowo: Gzowo Springs paving (street surface, kerbed pavements with rounded corners, road paint) and its colliders.
import { TOWN } from '../../config.js';
import { L } from './kit.js';
import { MAIN, CROSS, isPaved, streetY } from './layout.js';

const R = 2.6;
const W = TOWN.walk;

export const PAVEMENTS = [
  { x0: 264, x1: 296, z0: 7, z1: 10.5, round: ['x1z0'] },
  { x0: 304, x1: 342, z0: 7, z1: 10.5, round: ['x0z0', 'x1z0'] },
  { x0: 350, x1: 392, z0: 7, z1: 10.5, round: ['x0z0'] },
  { x0: 264, x1: 268, z0: -10.5, z1: -7 },
  { x0: 274, x1: 286, z0: -10.5, z1: -7 },
  { x0: 292, x1: 296, z0: -10.5, z1: -7, round: ['x1z1'] },
  { x0: 304, x1: 342, z0: -10.5, z1: -7, round: ['x0z1', 'x1z1'] },
  { x0: 350, x1: 392, z0: -10.5, z1: -7, round: ['x0z1'] },
  { x0: 293, x1: 296, z0: 10.5, z1: 26.5 },
  { x0: 293, x1: 296, z0: 31.5, z1: 40 },
  { x0: 293, x1: 296, z0: 46, z1: 66 },
  { x0: 304, x1: 307, z0: 10.5, z1: 26.5 },
  { x0: 304, x1: 307, z0: 31.5, z1: 66 },
  { x0: 339, x1: 342, z0: 10.5, z1: 26.5 },
  { x0: 339, x1: 342, z0: 31.5, z1: 66 },
  { x0: 350, x1: 353, z0: 10.5, z1: 26.5 },
  { x0: 350, x1: 353, z0: 31.5, z1: 38 },
  { x0: 350, x1: 353, z0: 52, z1: 66 },
  { x0: 293, x1: 296, z0: -66, z1: -24 },
  { x0: 293, x1: 296, z0: -18, z1: -10.5 },
  { x0: 304, x1: 307, z0: -66, z1: -31.5 },
  { x0: 304, x1: 307, z0: -26.5, z1: -10.5 },
  { x0: 339, x1: 342, z0: -66, z1: -50 },
  { x0: 339, x1: 342, z0: -44, z1: -31.5 },
  { x0: 339, x1: 342, z0: -26.5, z1: -10.5 },
  { x0: 350, x1: 353, z0: -66, z1: -31.5 },
  { x0: 350, x1: 353, z0: -26.5, z1: -10.5 },
  { x0: 399, x1: 402, z0: -14, z1: 14 },
];
export const APRONS = [
  { x0: 268, x1: 274, z0: -10.5, z1: -7 },
  { x0: 286, x1: 292, z0: -10.5, z1: -7 },
  { x0: 293, x1: 296, z0: 40, z1: 46 },
  { x0: 293, x1: 296, z0: -24, z1: -18 },
  { x0: 339, x1: 342, z0: -50, z1: -44 },
  { x0: 350, x1: 353, z0: 38, z1: 52 },
  { x0: 353, x1: 358, z0: 38, z1: 52 },
];
const CORNERS = [];
for (const c of CROSS) for (const sx of [-1, 1]) for (const sz of [-1, 1]) CORNERS.push({ x0: c.x + sx * c.half - (sx > 0 ? 0 : R), x1: c.x + sx * c.half + (sx > 0 ? R : 0), z0: sz * MAIN.half - (sz > 0 ? 0 : R), z1: sz * MAIN.half + (sz > 0 ? R : 0) });

const inside = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

function outline(r) {
  const pts = [];
  const corner = (key, x, z, a0) => {
    if (r.round && r.round.includes(key)) {
      const cx = x + (key[1] === '0' ? R : -R);
      const cz = z + (key[3] === '0' ? R : -R);
      for (let k = 0; k <= 6; k++) {
        const a = a0 + (k / 6) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]);
      }
    } else pts.push([x, z]);
  };
  corner('x0z0', r.x0, r.z0, Math.PI);
  corner('x1z0', r.x1, r.z0, Math.PI * 1.5);
  corner('x1z1', r.x1, r.z1, 0);
  corner('x0z1', r.x0, r.z1, Math.PI / 2);
  return pts;
}

function roadAt(x, z) {
  return isPaved(x, z) || APRONS.some((a) => inside(x, z, a)) || CORNERS.some((c) => inside(x, z, c));
}

function nextToSlab(x, z, self) {
  return PAVEMENTS.some((p) => p !== self && inside(x, z, p));
}

export function buildStreets(T) {
  const { physics } = T;
  const verts = [];
  const index = [];
  for (let x = 262; x < 402; x++) {
    for (let z = -66; z < 66; z++) {
      if (!roadAt(x + 0.5, z + 0.5) && !roadAt(x + 0.05, z + 0.05) && !roadAt(x + 0.95, z + 0.95) && !roadAt(x + 0.05, z + 0.95) && !roadAt(x + 0.95, z + 0.05)) continue;
      const S = T.cell(x + 0.5, z + 0.5).surface;
      const y = streetY;
      const k = verts.length / 3;
      const p = [[x, y(x, z + 1), z + 1], [x + 1, y(x + 1, z + 1), z + 1], [x + 1, y(x + 1, z), z], [x, y(x, z), z]];
      S.with({ layer: L.ASPHALT, color: [0.78, 0.77, 0.75], wear: 0.15, rough: -1 }, () => S.quad(p[0], p[1], p[2], p[3]));
      for (const q of p) verts.push(...q);
      index.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
  }
  physics.staticTrimesh(new Float32Array(verts), new Uint32Array(index), 'asphalt', 1);

  for (const r of PAVEMENTS) {
    const S = T.cell((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2).surface;
    const pts = outline(r);
    S.with({ layer: L.PAVER, color: [0.92, 0.9, 0.86], wear: 0.35, rough: -1 }, () => {
      S.frame(0, W, 0, 0, -Math.PI / 2);
      S.poly(pts.map(([x, z]) => [x, -z]));
      S.pop();
    });
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-3) continue;
      const nx = (b[1] - a[1]) / len;
      const nz = -(b[0] - a[0]) / len;
      const ox = mx + nx * 0.25;
      const oz = mz + nz * 0.25;
      if (nextToSlab(ox, oz, r)) continue;
      const kerb = roadAt(ox, oz);
      const ya = kerb ? streetY(a[0], a[1]) - 0.02 : TOWN.ground - 0.12;
      const yb = kerb ? streetY(b[0], b[1]) - 0.02 : TOWN.ground - 0.12;
      const yellow = kerb && Math.abs(mz) < 12 && CROSS.some((c) => Math.abs(mx - c.x) < 14);
      S.with({ layer: L.CONCRETE, color: yellow ? [0.95, 0.72, 0.16] : [0.86, 0.85, 0.8], wear: 0.6, rough: -1 }, () => {
        S.quad([b[0], yb, b[1]], [a[0], ya, a[1]], [a[0], W, a[1]], [b[0], W, b[1]]);
        if (kerb) {
          const ia = [a[0] - nx * 0.16, a[1] - nz * 0.16];
          const ib = [b[0] - nx * 0.16, b[1] - nz * 0.16];
          S.quad([a[0], W + 0.004, a[1]], [ia[0], W + 0.004, ia[1]], [ib[0], W + 0.004, ib[1]], [b[0], W + 0.004, b[1]]);
        }
      });
    }
    const cx0 = r.x0;
    const cx1 = r.x1;
    const cz0 = r.z0;
    const cz1 = r.z1;
    const rounds = r.round || [];
    if (!rounds.length) physics.staticBox(cx0, cx1, 3.9, W, cz0, cz1, 'concrete');
    else {
      const key = rounds[0];
      const xr = key[1] === '0' ? cx0 + R : cx1 - R;
      const zr = key[3] === '0' ? cz0 + R : cz1 - R;
      const xs = key[1] === '0' ? [xr, cx1] : [cx0, xr];
      const zs = key[3] === '0' ? [zr, cz1] : [cz0, zr];
      physics.staticBox(xs[0], xs[1], 3.9, W, cz0, cz1, 'concrete');
      physics.staticBox(key[1] === '0' ? cx0 : xr, key[1] === '0' ? xr : cx1, 3.9, W, zs[0], zs[1], 'concrete');
      physics.staticCylinder(xr, 3.9, W, zr, R, 'concrete');
      if (rounds[1]) {
        const k2 = rounds[1];
        const x2 = k2[1] === '0' ? cx0 + R : cx1 - R;
        const z2 = k2[3] === '0' ? cz0 + R : cz1 - R;
        physics.staticCylinder(x2, 3.9, W, z2, R, 'concrete');
      }
    }
  }

  const paint = (item, x0, z0, x1, z1, lift = 0.014) => {
    const y = (x, z) => streetY(x, z) + lift;
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.ceil(len / 1.0));
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const uv = [0, (t0 * len) / 8, 1, (t1 * len) / 8];
      if (alongX) {
        const a = x0 + (x1 - x0) * t0;
        const b = x0 + (x1 - x0) * t1;
        T.cell((a + b) / 2, (z0 + z1) / 2).decal.quad(item, [[a, y(a, z0), z0], [a, y(a, z1), z1], [b, y(b, z1), z1], [b, y(b, z0), z0]], { uv });
      } else {
        const a = z0 + (z1 - z0) * t0;
        const b = z0 + (z1 - z0) * t1;
        T.cell((x0 + x1) / 2, (a + b) / 2).decal.quad(item, [[x1, y(x1, a), a], [x0, y(x0, a), a], [x0, y(x0, b), b], [x1, y(x1, b), b]], { uv });
      }
    }
  };
  const yellow = T.atlas.items.line_yellow;
  const white = T.atlas.items.line_white;
  const runs = [[262, 292.5], [307.5, 338.5], [353.5, 392]];
  for (const [a, b] of runs) {
    for (let x = a; x < b; x += 8) {
      const e = Math.min(b, x + 8);
      paint(yellow, x, -0.22, e, -0.1);
      paint(yellow, x, 0.1, e, 0.22);
    }
    for (let x = a + 3; x < b - 3; x += 6.2) {
      for (const s of [-1, 1]) {
        paint(white, x - 0.06, Math.min(s * 4.5, s * 6.9), x + 0.06, Math.max(s * 4.5, s * 6.9));
        paint(white, x - 0.06, s * 4.5 - 0.06, x + 6.2 - 0.06, s * 4.5 + 0.06);
      }
    }
  }
  for (const c of CROSS) {
    for (const sz of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const x0 = c.x - c.half + 0.35 + k * 0.95;
        paint(white, x0, sz * 8.2 - 1.4, x0 + 0.5, sz * 8.2 + 1.4);
      }
      paint(white, c.x - c.half + 0.2, sz * 10.2 - 0.2, c.x + c.half - 0.2, sz * 10.2 + 0.2);
      for (let z = 12; z < 64; z += 6) paint(yellow, c.x - 0.07, Math.min(sz * z, sz * (z + 3)), c.x + 0.07, Math.max(sz * z, sz * (z + 3)));
    }
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 10; k++) {
        const z0 = -MAIN.half + 0.4 + k * 1.38;
        paint(white, c.x + sx * (c.half + 1.6) - 1.4, z0, c.x + sx * (c.half + 1.6) + 1.4, z0 + 0.6);
      }
    }
  }
  return { roadAt, paint };
}
