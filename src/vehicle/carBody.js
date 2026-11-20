// Costa del Gzowo: procedural sports sedan body, lofted from side-view profiles into separate deformable panels.
import * as THREE from 'three';

export const CAR = {
  length: 4.72,
  wheelbase: 2.82,
  axleFront: 1.41,
  axleRear: -1.41,
  track: 1.6,
  halfWidth: 0.93,
  wheelRadius: 0.335,
  tireWidth: 0.255,
  archRadius: 0.4,
  nose: 2.27,
  tail: -2.45,
};

export const MAT = { PAINT: 0, GLASS: 1, TRIM: 2, HEAD: 3, TAIL: 4, GRILLE: 5 };

function curve(points) {
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
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
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

const yTop = curve([[-2.45, 0.6], [-2.435, 0.84], [-2.41, 0.975], [-2.365, 1.038], [-2.2, 1.047], [-1.74, 1.08], [-0.98, 1.352], [-0.25, 1.412], [0.25, 1.386], [1.02, 0.985], [1.6, 0.9], [2.0, 0.8], [2.15, 0.735], [2.22, 0.69], [2.262, 0.61], [2.27, 0.56]]);
const yBottom = curve([[-2.45, 0.44], [-2.42, 0.34], [-2.3, 0.27], [-1.9, 0.19], [-1.0, 0.165], [1.0, 0.16], [1.9, 0.17], [2.15, 0.19], [2.24, 0.25], [2.27, 0.34]]);
const yBelt = curve([[-2.45, 0.575], [-2.435, 0.8], [-2.41, 0.93], [-2.365, 0.978], [-2.0, 0.985], [-1.2, 0.955], [0.0, 0.925], [1.0, 0.905], [1.6, 0.862], [2.0, 0.772], [2.15, 0.7], [2.27, 0.545]]);
const halfWidth = curve([[-2.45, 0.62], [-2.42, 0.77], [-2.3, 0.865], [-2.0, 0.915], [-1.41, 0.935], [-0.5, 0.925], [0.5, 0.92], [1.41, 0.925], [1.9, 0.9], [2.12, 0.83], [2.22, 0.74], [2.27, 0.6]]);
const roofHalf = curve([[-1.74, 0.63], [-0.98, 0.585], [0.25, 0.575], [1.02, 0.67]]);

const X_COWL = 1.02;
const X_ROOF_FRONT = 0.25;
const X_ROOF_REAR = -0.98;
const X_DECK = -1.74;

function cabin(x) {
  if (x >= X_COWL || x <= X_DECK) return 0;
  if (x > X_ROOF_FRONT) return (X_COWL - x) / (X_COWL - X_ROOF_FRONT);
  if (x < X_ROOF_REAR) return (x - X_DECK) / (X_ROOF_REAR - X_DECK);
  return 1;
}

const SEGMENTS = [3, 2, 5, 5, 2, 1, 5, 1, 1, 6];
export const SEG = { UNDER: 0, ROCKER: 1, LOWER: 2, UPPER: 3, SHOULDER: 4, BELT: 5, GLASS: 6, RAIL: 7, EDGE: 8, TOP: 9 };
const HALF_CELLS = SEGMENTS.reduce((a, b) => a + b, 0);
const SIDE_LIMIT = SEGMENTS.slice(0, 5).reduce((a, b) => a + b, 0);

function flare(x, y) {
  let out = 0;
  for (const ax of [CAR.axleFront, CAR.axleRear]) {
    const d = Math.hypot(x - ax, y - CAR.wheelRadius);
    out += 0.026 * Math.exp(-(((d - CAR.archRadius - 0.03) / 0.085) ** 2));
  }
  return out;
}

function keyPoints(x) {
  const w = halfWidth(x);
  const yb = yBottom(x);
  const belt = yBelt(x);
  const top = Math.max(yTop(x), belt + 0.004);
  const c = cabin(x);
  const H = belt - yb;
  const mid = yb + Math.min(0.56 - yb, H * 0.52);
  const deckEdge = w - 0.07;
  const deckY = (f) => top - (top - (belt - 0.012)) * Math.pow(f, 2.7);
  const wr = roofHalf(x);
  const rail = top - 0.05;
  const lerp = (a, b) => [a[0] + (b[0] - a[0]) * c, a[1] + (b[1] - a[1]) * c];
  const P5c = [w - 0.078, belt];
  const P6c = [wr, rail];
  const dir = [P6c[0] - P5c[0], P6c[1] - P5c[1]];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const along = (d) => [P5c[0] + (dir[0] / len) * d, P5c[1] + (dir[1] / len) * d];
  return [
    [0, yb],
    [Math.max(w - 0.14, 0.05), yb],
    [w - 0.012, yb + Math.min(0.115, H * 0.28)],
    [w, mid],
    [w - 0.02, belt - Math.min(0.085, H * 0.15)],
    lerp([deckEdge, deckY(1)], P5c),
    lerp([deckEdge * 0.955, deckY(0.955)], along(0.028)),
    lerp([deckEdge * 0.86, deckY(0.86)], along(Math.max(len - 0.03, 0.03))),
    lerp([deckEdge * 0.8, deckY(0.8)], P6c),
    lerp([deckEdge * 0.72, deckY(0.72)], [wr - 0.065, top - 0.022]),
    [0, top],
  ];
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

function section(x) {
  const keys = keyPoints(x);
  const pts = [];
  for (let s = 0; s < SEGMENTS.length; s++) {
    const p0 = keys[Math.max(s - 1, 0)];
    const p1 = keys[s];
    const p2 = keys[s + 1];
    const p3 = keys[Math.min(s + 2, keys.length - 1)];
    const straight = s === SEG.UNDER || s === SEG.GLASS || s === SEG.BELT || s === SEG.RAIL;
    for (let k = 0; k < SEGMENTS[s]; k++) {
      const t = k / SEGMENTS[s];
      pts.push(straight ? [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t] : catmull(p0, p1, p2, p3, t));
    }
  }
  pts.push(keys[keys.length - 1]);
  for (const p of pts) {
    if (p[1] > 0.12 && p[1] < 0.95) p[0] += flare(x, p[1]) * Math.min(1, p[0] / 0.6);
  }
  return pts;
}

function stations() {
  const marks = [CAR.tail, -2.435, -2.41, -2.365, -2.33, -2.05, X_DECK, -1.4, -1.12, X_ROOF_REAR, -0.34, -0.22, 0.2, X_ROOF_FRONT, 0.9, 0.98, X_COWL, 1.88, 1.93, 2.15, 2.22, 2.262, CAR.nose];
  const xs = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i];
    const b = marks[i + 1];
    const n = Math.max(1, Math.round((b - a) / 0.048));
    for (let k = 0; k < n; k++) xs.push(a + ((b - a) * k) / n);
  }
  xs.push(marks[marks.length - 1]);
  return xs;
}

function segmentOf(j) {
  let acc = 0;
  for (let s = 0; s < SEGMENTS.length; s++) {
    acc += SEGMENTS[s];
    if (j < acc) return s;
  }
  return SEGMENTS.length - 1;
}

function classify(xc, seg, zc, yTopHere) {
  const top = seg >= SEG.BELT;
  const glassX = xc < 0.9 && xc > -1.4;
  if (xc <= -2.365) {
    if (!top) return ['rearBumper', MAT.PAINT];
    if (yTopHere < 0.85) return ['rearBumper', MAT.PAINT];
    if (yTopHere < 0.99) return [Math.abs(zc) < 0.5 ? 'trunk' : 'shell', MAT.TAIL];
    return ['trunk', MAT.PAINT];
  }
  if (xc > 2.15) return ['frontBumper', MAT.PAINT];
  if (xc > 1.88 && seg >= SEG.SHOULDER && seg <= SEG.RAIL) return ['shell', MAT.HEAD];
  if (xc > 1.93 && !top) return ['frontBumper', MAT.PAINT];
  if (xc <= -2.05 && !top) {
    if (seg === SEG.SHOULDER && xc > -2.33) return ['shell', MAT.TAIL];
    return ['rearBumper', MAT.PAINT];
  }
  if (xc > X_COWL && top) return ['hood', MAT.PAINT];
  if (xc <= X_DECK && top) return ['trunk', MAT.PAINT];
  if (seg === SEG.TOP) {
    if (xc > X_ROOF_FRONT) return ['shell', MAT.GLASS];
    if (xc > 0.2) return ['shell', MAT.PAINT];
    if (xc < X_ROOF_REAR) return ['roof', MAT.GLASS];
    if (xc < 0.08 && xc > -0.82 && Math.abs(zc) < 0.44) return ['roof', MAT.TRIM];
    return ['roof', MAT.PAINT];
  }
  if (seg === SEG.EDGE) return [xc > 0.2 ? 'shell' : 'roof', MAT.PAINT];
  const door = xc > -0.28 && xc <= 0.98 ? 'doorF' : xc > -1.12 && xc <= -0.28 ? 'doorR' : null;
  const sideTag = zc > 0 ? 'R' : 'L';
  const sideName = door ? door + sideTag : 'shell';
  if (seg === SEG.GLASS) {
    if (!glassX) return [xc <= -1.4 ? 'roof' : 'shell', MAT.PAINT];
    if (!door) return ['roof', MAT.GLASS];
    return [(door === 'doorF' ? 'winF' : 'winR') + sideTag, MAT.GLASS];
  }
  if (seg === SEG.RAIL) {
    if (xc > 0.2) return ['shell', glassX ? MAT.TRIM : MAT.PAINT];
    return ['roof', glassX ? MAT.TRIM : MAT.PAINT];
  }
  if (seg === SEG.BELT) return [glassX ? sideName : 'shell', glassX ? MAT.TRIM : MAT.PAINT];
  if (seg >= SEG.LOWER && seg <= SEG.SHOULDER && door) return [sideName, MAT.PAINT];
  return ['shell', MAT.PAINT];
}

export function buildBody() {
  const xs = stations();
  const rows = xs.length;
  const cols = HALF_CELLS * 2 + 1;
  const grid = new Float32Array(rows * cols * 3);
  for (let i = 0; i < rows; i++) {
    const half = section(xs[i]);
    for (let j = 0; j < cols; j++) {
      const k = j <= HALF_CELLS ? HALF_CELLS - j : j - HALF_CELLS;
      const sign = j <= HALF_CELLS ? -1 : 1;
      const p = half[HALF_CELLS - k];
      const o = (i * cols + j) * 3;
      grid[o] = xs[i];
      grid[o + 1] = p[1];
      grid[o + 2] = sign * p[0];
    }
  }
  const vid = (i, j) => i * cols + j;
  const inside = new Uint8Array(rows * cols);
  const archZ = CAR.halfWidth - 0.34;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const o = vid(i, j) * 3;
      const x = grid[o];
      const y = grid[o + 1];
      const z = Math.abs(grid[o + 2]);
      if (z < archZ || y > 0.9) continue;
      for (const ax of [CAR.axleFront, CAR.axleRear]) {
        if (Math.hypot(x - ax, y - CAR.wheelRadius) < CAR.archRadius) inside[vid(i, j)] = ax > 0 ? 1 : 2;
      }
    }
  }
  const cellSeg = (j) => segmentOf(j < HALF_CELLS ? j : 2 * HALF_CELLS - 1 - j);
  const cells = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const v = [vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)];
      const insideCount = v.reduce((a, id) => a + (inside[id] ? 1 : 0), 0);
      if (insideCount === 4 || (insideCount > 0 && cellSeg(j) === SEG.UNDER)) continue;
      const xc = (xs[i] + xs[i + 1]) / 2;
      const zc = (grid[v[0] * 3 + 2] + grid[v[3] * 3 + 2]) / 2;
      const [panel, mat] = classify(xc, cellSeg(j), zc, yTop(xc));
      cells.push({ v, panel, mat, i, j, flip: false });
    }
  }
  for (let id = 0; id < rows * cols; id++) {
    if (!inside[id]) continue;
    const ax = inside[id] === 1 ? CAR.axleFront : CAR.axleRear;
    const o = id * 3;
    const dx = grid[o] - ax;
    const dy = grid[o + 1] - CAR.wheelRadius;
    const d = Math.hypot(dx, dy) || 1;
    grid[o] = ax + (dx / d) * CAR.archRadius;
    grid[o + 1] = Math.max(CAR.wheelRadius + (dy / d) * CAR.archRadius, yBottom(grid[o]));
  }

  const normals = new Float32Array(rows * cols * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const P = (id, out) => out.set(grid[id * 3], grid[id * 3 + 1], grid[id * 3 + 2]);
  for (const cell of cells) {
    const [v0, v1, v2, v3] = cell.v;
    P(v0, a);
    P(v1, b);
    P(v3, c);
    n.crossVectors(c.sub(a), b.sub(a));
    P(v2, a);
    P(v3, b);
    P(v1, c);
    n.add(new THREE.Vector3().crossVectors(c.sub(a), b.sub(a)));
    for (const id of cell.v) {
      normals[id * 3] += n.x;
      normals[id * 3 + 1] += n.y;
      normals[id * 3 + 2] += n.z;
    }
  }
  for (let id = 0; id < rows * cols; id++) {
    const l = Math.hypot(normals[id * 3], normals[id * 3 + 1], normals[id * 3 + 2]) || 1;
    normals[id * 3] /= l;
    normals[id * 3 + 1] /= l;
    normals[id * 3 + 2] /= l;
  }

  const owner = new Map();
  for (const cell of cells) {
    for (const id of cell.v) {
      const key = cell.panel + ':' + cell.mat;
      if (!owner.has(id)) owner.set(id, new Set());
      owner.get(id).add(key);
    }
  }

  const panels = {};
  const byPanel = new Map();
  for (const cell of cells) {
    if (!byPanel.has(cell.panel)) byPanel.set(cell.panel, []);
    byPanel.get(cell.panel).push(cell);
  }
  for (const [name, list] of byPanel) {
    const remap = new Map();
    const pos = [];
    const nor = [];
    const edge = [];
    const uv = [];
    const proj = [];
    const groups = [[], [], [], [], [], []];
    const add = (id) => {
      if (!remap.has(id)) {
        remap.set(id, pos.length / 3);
        pos.push(grid[id * 3], grid[id * 3 + 1], grid[id * 3 + 2]);
        nor.push(normals[id * 3], normals[id * 3 + 1], normals[id * 3 + 2]);
        edge.push(owner.get(id).size > 1 ? 1 : 0);
        uv.push(grid[id * 3 + 2], grid[id * 3 + 1]);
        const ring = id % cols;
        const halfIndex = ring <= HALF_CELLS ? ring : 2 * HALF_CELLS - ring;
        const x = grid[id * 3];
        proj.push(x > 2.2 || x < -2.4 ? 3 : halfIndex <= SIDE_LIMIT ? (ring <= HALF_CELLS ? 0 : 1) : 2);
      }
      return remap.get(id);
    };
    for (const cell of list) {
      const [v0, v1, v2, v3] = cell.v.map(add);
      groups[cell.mat].push(v0, v3, v1, v1, v3, v2);
    }
    const index = [];
    const geo = new THREE.BufferGeometry();
    for (let m = 0; m < groups.length; m++) {
      if (!groups[m].length) continue;
      geo.addGroup(index.length, groups[m].length, m);
      index.push(...groups[m]);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aRest', new THREE.Float32BufferAttribute(pos.slice(), 3));
    geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aProj', new THREE.Float32BufferAttribute(proj, 1));
    geo.setIndex(index);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    panels[name] = geo;
  }

  const capGeometry = (row, sign) => {
    const ring = [];
    for (let j = 0; j < cols; j++) ring.push(vid(row, j));
    const pos = [];
    const nor = [];
    const uv = [];
    const index = [];
    let cy = 0;
    for (const id of ring) cy += grid[id * 3 + 1];
    cy /= ring.length;
    pos.push(grid[ring[0] * 3], cy, 0);
    for (const id of ring) pos.push(grid[id * 3], grid[id * 3 + 1], grid[id * 3 + 2]);
    for (let k = 0; k <= ring.length; k++) {
      nor.push(sign, 0, 0);
      uv.push(pos[k * 3 + 2] * 0.8 + 0.5, (pos[k * 3 + 1] - 0.3) * 3.2);
    }
    for (let k = 1; k < ring.length; k++) {
      if (sign > 0) index.push(0, k, k + 1);
      else index.push(0, k + 1, k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aRest', new THREE.Float32BufferAttribute(pos.slice(), 3));
    geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(new Array(ring.length + 1).fill(0), 1));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aProj', new THREE.Float32BufferAttribute(new Array(ring.length + 1).fill(3), 1));
    geo.setIndex(index);
    geo.addGroup(0, index.length, MAT.GRILLE);
    return geo;
  };

  return {
    panels,
    caps: { frontBumper: capGeometry(rows - 1, 1), rearBumper: capGeometry(0, -1) },
    profile: { yTop, yBottom, yBelt, halfWidth, roofHalf, section, keyPoints },
  };
}
