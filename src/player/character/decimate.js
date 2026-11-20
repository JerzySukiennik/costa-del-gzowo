// Costa del Gzowo: quadric error half-edge collapse that keeps original surface samples and locks open borders.
export function decimate(mesh, target) {
  const { pos, idx } = mesh;
  const nV = pos.length / 3;
  const nF = idx.length / 3;
  if (nF <= target) return mesh;
  const F = Int32Array.from(idx);
  const alive = new Uint8Array(nF).fill(1);
  const vf = Array.from({ length: nV }, () => []);
  for (let f = 0; f < nF; f++) for (let c = 0; c < 3; c++) vf[F[f * 3 + c]].push(f);
  const Q = new Float64Array(nV * 10);
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
    const area = l * 0.5;
    nx /= l;
    ny /= l;
    nz /= l;
    const d = -(nx * pos[a * 3] + ny * pos[a * 3 + 1] + nz * pos[a * 3 + 2]);
    const q = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
    for (const v of [a, b, c]) for (let i = 0; i < 10; i++) Q[v * 10 + i] += q[i] * area;
  }
  const edgeCount = new Map();
  const ekey = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  for (let f = 0; f < nF; f++) {
    for (let c = 0; c < 3; c++) {
      const k = ekey(F[f * 3 + c], F[f * 3 + ((c + 1) % 3)]);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
  const locked = new Uint8Array(nV);
  for (const [k, n] of edgeCount) {
    if (n !== 1) continue;
    locked[Math.floor(k / 4194304)] = 1;
    locked[k % 4194304] = 1;
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
    if (locked[u]) return;
    push([cost(u, v), u, v, stamp[u], stamp[v]]);
  };
  for (const k of edgeCount.keys()) {
    const a = Math.floor(k / 4194304);
    const b = k % 4194304;
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
    const nv = neighbors(v);
    let common = 0;
    for (const w of nu) if (nv.has(w)) common++;
    if (common !== 2) continue;
    let ok = true;
    for (const f of vf[u]) {
      if (!alive[f]) continue;
      const a = F[f * 3];
      const b = F[f * 3 + 1];
      const c = F[f * 3 + 2];
      if (a === v || b === v || c === v) continue;
      const l0 = normalOf(a, b, c, n0);
      const l1 = normalOf(a === u ? v : a, b === u ? v : b, c === u ? v : c, n1);
      if (l1 < 1e-12 || (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1 + 1e-20) < 0.35) {
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
    const around = neighbors(v);
    for (const w of around) {
      offer(v, w);
      offer(w, v);
    }
  }
  const out = [];
  for (let f = 0; f < nF; f++) if (alive[f]) out.push(F[f * 3], F[f * 3 + 1], F[f * 3 + 2]);
  mesh.idx = out;
  return mesh;
}
