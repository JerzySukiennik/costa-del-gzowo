// Costa del Gzowo: lane network for traffic (open road from roads.js, town lanes derived from the street plan, junction connectors, crossings, stop lines) as sampled directed polylines.
import { MAIN, CROSS, ALLEYS } from '../../world/town/layout.js';
import { toWorldX, toWorldZ } from '../../world/town/space.js';
import { HIGHWAY, WEST_TURN, TOWN_SPEED } from '../roads.js';

const STEP = 1.6;

export function createNetwork(crossings) {
  const lanes = [];
  const junctions = [];

  function lane(points, speed, more = {}) {
    const pts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const d = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(d / STEP));
      for (let k = 0; k < n; k++) pts.push(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n);
    }
    pts.push(points[points.length - 1][0], points[points.length - 1][1]);
    const n = pts.length / 2;
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    const curve = new Float32Array(n);
    for (let i = 1; i < n - 1; i++) {
      const a0 = Math.atan2(pts[i * 2 + 1] - pts[i * 2 - 1], pts[i * 2] - pts[i * 2 - 2]);
      const a1 = Math.atan2(pts[i * 2 + 3] - pts[i * 2 + 1], pts[i * 2 + 2] - pts[i * 2]);
      curve[i] = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))) / Math.max(0.3, (cum[i + 1] - cum[i - 1]) / 2);
    }
    const l = { id: lanes.length, pts: new Float32Array(pts), n, cum, curve, len: cum[n - 1], speed, next: [], kind: 'road', control: null, junction: null, turn: 0, rank: 0, opposite: null, crossings: [], conflicts: [], ...more };
    lanes.push(l);
    return l;
  }

  function bezier(a, da, b, db, bulge = 0.55) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const c1 = [a[0] + da[0] * d * bulge, a[1] + da[1] * d * bulge];
    const c2 = [b[0] - db[0] * d * bulge, b[1] - db[1] * d * bulge];
    const out = [];
    const n = Math.max(6, Math.round(d / 1.1));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      out.push([u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]]);
    }
    return out;
  }

  const endOf = (l) => [l.pts[l.n * 2 - 2], l.pts[l.n * 2 - 1]];
  const startOf = (l) => [l.pts[0], l.pts[1]];
  const dirEnd = (l) => {
    const dx = l.pts[l.n * 2 - 2] - l.pts[l.n * 2 - 4];
    const dz = l.pts[l.n * 2 - 1] - l.pts[l.n * 2 - 3];
    const d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  };
  const dirStart = (l) => {
    const dx = l.pts[2] - l.pts[0];
    const dz = l.pts[3] - l.pts[1];
    const d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  };

  function connect(from, to, junction, rank = 0, speed = TOWN_SPEED.turn) {
    const da = dirEnd(from);
    const db = dirStart(to);
    const cross = da[0] * db[1] - da[1] * db[0];
    const dot = da[0] * db[0] + da[1] * db[1];
    const turn = dot > 0.9 ? 0 : cross > 0 ? 1 : -1;
    const c = lane(bezier(endOf(from), da, startOf(to), db), turn ? speed : Math.min(from.speed, to.speed), { kind: 'turn', junction, turn, rank });
    from.next.push(c);
    c.next.push(to);
    if (junction) junction.connectors.push(c);
    return c;
  }

  const wx = toWorldX;
  const wz = toWorldZ;
  const h = HIGHWAY;
  const east = [];
  const west = [];
  for (let i = 0; i < h.centre.length - 1; i++) {
    const [ax, az] = h.centre[i];
    const [bx, bz] = h.centre[i + 1];
    const d = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / d;
    const nz = (bx - ax) / d;
    east.push(lane([[ax + nx * h.lane, az + nz * h.lane], [bx + nx * h.lane, bz + nz * h.lane]], h.speed[i]));
    west.unshift(lane([[bx - nx * h.lane, bz - nz * h.lane], [ax - nx * h.lane, az - nz * h.lane]], h.speed[i]));
    east[i].opposite = west[0];
    west[0].opposite = east[i];
  }
  for (let i = 0; i < east.length - 1; i++) {
    east[i].next.push(east[i + 1]);
    west[i].next.push(west[i + 1]);
  }
  {
    const t = WEST_TURN;
    const a = endOf(west[west.length - 1]);
    const b = startOf(east[0]);
    const s = t.heading;
    const pts = [a, [a[0] + s * 3, a[1] - (t.swing - h.lane) * 0.5], [a[0] + s * 6.5, -t.swing + t.z]];
    for (let k = 0; k <= 10; k++) {
      const ang = -Math.PI / 2 - (k / 10) * Math.PI;
      pts.push([a[0] + s * 6.5 + s * Math.sin(-ang - Math.PI / 2) * t.radius, t.z + Math.sin(ang) * t.swing]);
    }
    pts.push([b[0] + s * 3, b[1] + (t.swing - h.lane) * 0.5], b);
    const u = lane(pts, TOWN_SPEED.uturn, { kind: 'uturn', turn: -1 });
    west[west.length - 1].next.push(u);
    u.next.push(east[0]);
  }

  const L = 2.25;
  const [palm, rocket] = CROSS;
  const [alleyN, alleyS] = ALLEYS;
  const cl = palm.half / 2;
  const x1 = palm.x - palm.half - 3.4;
  const x2 = palm.x + palm.half + 3.4;
  const x3 = rocket.x - rocket.half - 3.4;
  const x4 = rocket.x + rocket.half + 3.4;
  const zc = MAIN.half + 3.6;
  const road = (pts, speed, more) => lane(pts.map(([x, z]) => [wx(x), wz(z)]), speed, more);
  const mE1 = road([[MAIN.x0, L], [x1, L]], TOWN_SPEED.main);
  const mE2 = road([[x2, L], [x3, L]], TOWN_SPEED.main);
  const mE3 = road([[x4, L], [MAIN.x1 - 8, L]], TOWN_SPEED.main);
  const mW1 = road([[MAIN.x1 - 8, -L], [x4, -L]], TOWN_SPEED.main);
  const mW2 = road([[x3, -L], [x2, -L]], TOWN_SPEED.main);
  const mW3 = road([[x1, -L], [MAIN.x0, -L]], TOWN_SPEED.main);
  for (const [a, b] of [[mE1, mW3], [mE2, mW2], [mE3, mW1]]) {
    a.opposite = b;
    b.opposite = a;
  }
  const pN = road([[palm.x - cl, zc], [palm.x - cl, alleyN.z - alleyN.half - 0.6]], TOWN_SPEED.cross);
  const pS = road([[palm.x - cl, alleyS.z + alleyS.half + 1.0], [palm.x - cl, -zc]], TOWN_SPEED.cross);
  const rN = road([[rocket.x + cl, alleyN.z - alleyN.half - 1.6], [rocket.x + cl, zc]], TOWN_SPEED.cross);
  const rS = road([[rocket.x + cl, -zc], [rocket.x + cl, alleyS.z + alleyS.half + 0.6]], TOWN_SPEED.cross);
  const aN = road([[palm.x + palm.half + 0.8, alleyN.z], [rocket.x - rocket.half - 4.2, alleyN.z]], TOWN_SPEED.alley);
  const aS = road([[rocket.x - rocket.half - 3.2, alleyS.z], [palm.x + palm.half + 1.6, alleyS.z]], TOWN_SPEED.alley);
  east[east.length - 1].next.push(mE1);
  mW3.next.push(west[0]);
  {
    const a = endOf(mE3);
    const b = startOf(mW1);
    const cxp = a[0] + 6.2;
    const pts = [a, [a[0] + 3, a[1] + 1.1], [cxp, wz(4.5)]];
    for (let k = 1; k <= 9; k++) {
      const ang = Math.PI / 2 - (k / 10) * Math.PI;
      pts.push([cxp + Math.cos(ang) * 4.7, wz(-0.3) + Math.sin(ang) * 4.8]);
    }
    pts.push([cxp, wz(-5.1)], [b[0] + 3, b[1] - 1.3], b);
    const u = lane(pts, TOWN_SPEED.uturn, { kind: 'uturn', turn: -1 });
    mE3.next.push(u);
    u.next.push(mW1);
  }

  const j1 = { id: 0, x: wx(palm.x), z: wz(0), signal: true, connectors: [], hold: 0 };
  const j2 = { id: 1, x: wx(rocket.x), z: wz(0), signal: false, connectors: [], hold: 0 };
  junctions.push(j1, j2);
  for (const l of [mE1, mW2]) l.control = { junction: j1, type: 'signal', group: 'main' };
  pS.control = { junction: j1, type: 'signal', group: 'cross' };
  for (const l of [mE2, mW1]) l.control = { junction: j2, type: 'free' };
  rN.control = { junction: j2, type: 'stop' };
  connect(mE1, mE2, j1, 0);
  connect(mE1, pN, j1, 0);
  connect(mW2, mW3, j1, 0);
  connect(mW2, pN, j1, 1);
  connect(pS, pN, j1, 0);
  connect(pS, mW3, j1, 0);
  connect(pS, mE2, j1, 1);
  connect(mE2, mE3, j2, 0);
  connect(mE2, rS, j2, 1);
  connect(mW1, mW2, j2, 0);
  connect(mW1, rS, j2, 0);
  connect(rN, rS, j2, 2);
  connect(rN, mE3, j2, 2);
  connect(rN, mW2, j2, 2);
  connect(pN, aN, null, 0, TOWN_SPEED.uturn);
  connect(aN, rN, null, 0, TOWN_SPEED.uturn);
  connect(rS, aS, null, 0, TOWN_SPEED.uturn);
  connect(aS, pS, null, 0, TOWN_SPEED.uturn);

  for (const j of junctions) {
    for (const a of j.connectors) {
      for (const b of j.connectors) {
        if (a === b) continue;
        let hit = false;
        for (let i = 1; i < a.n - 1 && !hit; i++) {
          for (let k = 1; k < b.n - 1; k++) {
            if (Math.hypot(a.pts[i * 2] - b.pts[k * 2], a.pts[i * 2 + 1] - b.pts[k * 2 + 1]) < 2.4) {
              hit = true;
              break;
            }
          }
        }
        const sameStart = Math.hypot(a.pts[0] - b.pts[0], a.pts[1] - b.pts[1]) < 0.5;
        if (hit && !sameStart) a.conflicts.push(b);
      }
    }
  }

  for (const c of crossings || []) {
    const ex = c.bx - c.ax;
    const ez = c.bz - c.az;
    const el2 = ex * ex + ez * ez;
    for (const l of lanes) {
      for (let i = 0; i < l.n; i++) {
        const px = l.pts[i * 2] - c.ax;
        const pz = l.pts[i * 2 + 1] - c.az;
        const t = (px * ex + pz * ez) / el2;
        if (t < -0.05 || t > 1.05) continue;
        if (Math.abs(px * ez - pz * ex) / Math.sqrt(el2) < 0.9) {
          l.crossings.push({ s: l.cum[i], c });
          break;
        }
      }
    }
  }

  return { lanes, junctions, east, west, spawnable: lanes.filter((l) => l.kind === 'road' && l.len > 18) };
}

export function lanePoint(l, s, out) {
  const cum = l.cum;
  let lo = 0;
  let hi = l.n - 1;
  if (s <= 0) lo = 0;
  else if (s >= l.len) lo = l.n - 2;
  else {
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
  }
  const seg = cum[lo + 1] - cum[lo] || 1;
  const t = Math.min(1.5, Math.max(-0.5, (s - cum[lo]) / seg));
  const ax = l.pts[lo * 2];
  const az = l.pts[lo * 2 + 1];
  const bx = l.pts[lo * 2 + 2];
  const bz = l.pts[lo * 2 + 3];
  out.x = ax + (bx - ax) * t;
  out.z = az + (bz - az) * t;
  out.tx = (bx - ax) / seg;
  out.tz = (bz - az) / seg;
  out.i = lo;
  return out;
}
