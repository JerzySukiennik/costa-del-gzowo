// Costa del Gzowo: pavement graph of Gzowo Springs (walk lines, crossings, benches, shop windows, obstacles) derived from the street plan and converted to world space, with path search.
import { MAIN, CROSS, PLOTS, PLAZA, FRONT } from '../../world/town/layout.js';
import { toWorldX, toWorldZ } from '../../world/town/space.js';
import { TOWN } from '../../config.js';

const BENCHES = [
  [283.5, 9.9, Math.PI], [372.5, 9.9, Math.PI], [333.5, -9.85, 0], [356.5, -9.85, 0], [288.2, 10.0, Math.PI],
  [318.8, 19, Math.PI / 2], [327.2, 19, -Math.PI / 2], [323, 23.2, Math.PI], [314, 13.2, 0], [332, 13.2, 0], [314, 24.6, Math.PI], [332, 24.6, Math.PI],
];
const POSTS = [
  ...[271, 285.5, 311, 324, 337.5, 357, 371, 385].map((x) => [x, 7.6, 0.25]),
  ...[280, 311, 324.5, 337.5, 357, 371, 385].map((x) => [x, -7.6, 0.25]),
  [304.9, 8, 0.3], [295.1, -8, 0.3], [295.1, 8, 0.3], [304.9, -8, 0.3],
  [289.8, 7.6, 0.25], [318.2, -7.6, 0.25], [361.5, 7.6, 0.25], [380.4, -7.6, 0.25],
  [268.6, 9.2, 0.95], [274.6, 9.2, 0.95], [278.0, 9.3, 0.95],
  [276.2, 9.85, 0.35], [309.2, -9.85, 0.35], [333.2, 9.9, 0.35], [362.4, -9.85, 0.35], [389.2, 9.85, 0.35],
  [273.5, 10.0, 0.6], [313.3, -10.0, 0.5], [384.0, 10.0, 0.35],
  [309.5, 13, 1.1], [336.5, 13, 1.1], [309.5, 24, 1.1], [336.5, 24, 1.1], [323, 19, 3.2], [312, 25.5, 0.35],
  [286.2, 10.05, 0.3], [290.2, 10.05, 0.3],
];

export function createPedGraph() {
  const nodes = [];
  const edges = [];
  const crossings = [];
  const key = new Map();
  const node = (x, z) => {
    const k = `${x.toFixed(1)}:${z.toFixed(1)}`;
    if (key.has(k)) return key.get(k);
    const n = { id: nodes.length, x: toWorldX(x), z: toWorldZ(z), links: [], exit: false };
    nodes.push(n);
    key.set(k, n);
    return n;
  };
  const link = (a, b, crossing = null) => {
    const e = { a, b, len: Math.hypot(a.x - b.x, a.z - b.z), crossing };
    edges.push(e);
    a.links.push({ to: b, edge: e });
    b.links.push({ to: a, edge: e });
    return e;
  };
  const chain = (points) => {
    for (let i = 1; i < points.length; i++) link(node(...points[i - 1]), node(...points[i]));
  };
  const crossing = (a, b, rule, axis) => {
    const na = node(...a);
    const nb = node(...b);
    const c = { id: crossings.length, rule, axis, ax: na.x, az: na.z, bx: nb.x, bz: nb.z, cx: (na.x + nb.x) / 2, cz: (na.z + nb.z) / 2, peds: 0, waiting: 0 };
    crossings.push(c);
    link(na, nb, c);
    return c;
  };

  const zn = MAIN.half + MAIN.walk / 2;
  const [palm, rocket] = CROSS;
  const pw = palm.x - palm.half - palm.walk / 2;
  const pe = palm.x + palm.half + palm.walk / 2;
  const rw = rocket.x - rocket.half - rocket.walk / 2;
  const re = rocket.x + rocket.half + rocket.walk / 2;
  chain([[266, zn], [280, zn], [pw, zn]]);
  chain([[pe, zn], [315, zn], [323, zn], [331, zn], [rw, zn]]);
  chain([[re, zn], [362, zn], [372, zn], [382, zn], [390.5, zn]]);
  chain([[266, -zn], [271, -zn], [280, -zn], [289, -zn], [pw, -zn]]);
  chain([[pe, -zn], [315, -zn], [323, -zn], [331, -zn], [rw, -zn]]);
  chain([[re, -zn], [362, -zn], [372, -zn], [382, -zn], [390.5, -zn]]);
  chain([[pw, zn], [pw, 18], [pw, 28], [pw, 43], [pw, 58]]);
  chain([[pw, -zn], [pw, -21], [pw, -36], [pw, -52]]);
  chain([[pe, zn], [pe, 18], [pe, 29], [pe, 44], [pe, 58]]);
  chain([[pe, -zn], [pe, -18], [pe, -29], [pe, -44], [pe, -58]]);
  chain([[rw, zn], [rw, 18], [rw, 29], [rw, 44], [rw, 58]]);
  chain([[rw, -zn], [rw, -18], [rw, -29], [rw, -47], [rw, -58]]);
  chain([[re, zn], [re, 18], [re, 29], [re, 45], [re, 58]]);
  chain([[re, -zn], [re, -18], [re, -29], [re, -44], [re, -58]]);
  const px = (PLAZA.x0 + PLAZA.x1) / 2;
  chain([[315, zn], [313, 15.5], [316.5, 21.5], [323, 25], [329.5, 21.5], [333, 15.5], [331, zn]]);
  chain([[pe, 18], [313, 15.5]]);
  chain([[rw, 18], [333, 15.5]]);
  chain([[px, zn], [px, 13.6]]);
  chain([[313, 15.5], [px, 13.6], [333, 15.5]]);
  for (const sz of [1, -1]) {
    crossing([pw, sz * zn], [pe, sz * zn], 'side-signal', 'x');
    crossing([rw, sz * zn], [re, sz * zn], 'side-free', 'x');
  }
  for (const x of [pw, pe]) crossing([x, zn], [x, -zn], 'main-signal', 'z');
  for (const x of [rw, re]) crossing([x, zn], [x, -zn], 'main-free', 'z');
  for (const [x, z] of [[266, zn], [390.5, zn], [266, -zn], [390.5, -zn], [pw, 58], [pe, 58], [rw, 58], [re, 58], [pw, -52], [pe, -58], [rw, -58], [re, -58]]) node(x, z).exit = true;

  const pool = [];
  for (const [k, n] of key) {
    const [x, z] = k.split(':').map(Number);
    const core = Math.abs(Math.abs(z) - zn) < 0.2 || (x > PLAZA.x0 && x < PLAZA.x1 && z > 0 && z < PLAZA.z1);
    for (let i = 0; i < (core ? 4 : 1); i++) pool.push(n);
  }
  const benches = BENCHES.map(([x, z, yaw]) => ({ x: toWorldX(x), z: toWorldZ(z), yaw, taken: [null, null] }));
  const windows = [];
  for (const p of PLOTS) {
    if (p.face !== 'S' && p.face !== 'N') continue;
    const z = p.face === 'S' ? FRONT - 0.75 : -FRONT + 0.75;
    for (let x = p.x0 + 2.2; x < p.x1 - 1.5; x += 3.4) windows.push({ x: toWorldX(x), z: toWorldZ(z), yaw: p.face === 'S' ? 0 : Math.PI, busy: null });
  }
  const spots = [[311, 17.5], [318, 14.6], [328, 14.8], [335, 18.5], [320, 24], [326.5, 23.8], [287, 8.6], [300 - 6.2, 9.2], [357, 8.4], [378, -8.6], [311, -8.4], [270, 8.1]].map(([x, z]) => ({ x: toWorldX(x), z: toWorldZ(z), busy: null }));
  const posts = POSTS.map(([x, z, r]) => ({ x: toWorldX(x), z: toWorldZ(z), r }));
  for (const b of BENCHES) for (const u of [-0.5, 0.5]) posts.push({ x: toWorldX(b[0] + Math.cos(b[2]) * u), z: toWorldZ(b[1] - Math.sin(b[2]) * u), r: 0.45 });

  const dist = new Float32Array(nodes.length);
  const prev = new Int16Array(nodes.length);
  const done = new Uint8Array(nodes.length);

  function path(from, to, out) {
    dist.fill(Infinity);
    done.fill(0);
    prev.fill(-1);
    dist[from.id] = 0;
    for (;;) {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        if (!done[i] && dist[i] < bd) {
          bd = dist[i];
          best = i;
        }
      }
      if (best < 0 || best === to.id) break;
      done[best] = 1;
      for (const l of nodes[best].links) {
        const d = bd + l.edge.len * (l.edge.crossing ? 1.6 : 1);
        if (d < dist[l.to.id]) {
          dist[l.to.id] = d;
          prev[l.to.id] = best;
        }
      }
    }
    out.length = 0;
    if (!Number.isFinite(dist[to.id])) return out;
    for (let i = to.id; i !== from.id && i >= 0; i = prev[i]) out.push(nodes[i]);
    out.reverse();
    return out;
  }

  function nearest(x, z) {
    let best = nodes[0];
    let bd = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  function edgeBetween(a, b) {
    for (const l of a.links) if (l.to === b) return l.edge;
    return null;
  }

  return { nodes, pool, edges, crossings, benches, windows, spots, posts, path, nearest, edgeBetween, centre: { x: toWorldX((TOWN.x0 + TOWN.x1) / 2), z: toWorldZ(0) }, walkY: TOWN.walk };
}
