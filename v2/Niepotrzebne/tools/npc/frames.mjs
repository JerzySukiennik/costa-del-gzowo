// Costa del Gzowo: bind-pose frames for the pedestrian bake (bone frames, posed finger frames) without three.js.
import { Frame } from '../../../src/player/character/sdf.js';
import { FINGERS, THUMB } from '../../../src/player/character/anatomy.js';
import { boneTable, LIMB, SIDES } from '../../../src/npc/ped/bones.js';

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function local(x, y, z, rz) {
  const c = Math.cos(rz);
  const s = Math.sin(rz);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(v) {
  const l = Math.hypot(...v) || 1;
  return v.map((k) => k / l);
}

function fromUnit(a, b) {
  const v = cross(a, b);
  const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const k = 1 / (1 + c);
  return [
    [1 - (v[1] * v[1] + v[2] * v[2]) * k, v[2] + v[0] * v[1] * k, -v[1] + v[0] * v[2] * k],
    [-v[2] + v[0] * v[1] * k, 1 - (v[0] * v[0] + v[2] * v[2]) * k, v[0] + v[1] * v[2] * k],
    [v[1] + v[0] * v[2] * k, -v[0] + v[1] * v[2] * k, 1 - (v[0] * v[0] + v[1] * v[1]) * k],
  ];
}

function axisAngle(u, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  const [x, y, z] = u;
  return [
    [t * x * x + c, t * x * y + s * z, t * x * z - s * y],
    [t * x * y - s * z, t * y * y + c, t * y * z + s * x],
    [t * x * z + s * y, t * y * z - s * x, t * z * z + c],
  ];
}

function turned(frame, origin, cols) {
  return new Frame(frame.point(...origin), frame.dir(...cols[0]), frame.dir(...cols[1]), frame.dir(...cols[2]));
}

export const HANDS = {
  relaxed: { curl: { index: [0.28, 0.5, 0.3], middle: [0.4, 0.6, 0.36], ring: [0.5, 0.66, 0.4], pinky: [0.58, 0.7, 0.42] }, spread: 0.5, thumb: 0.25 },
  grip: { curl: { index: [0.95, 1.05, 0.55], middle: [1.0, 1.1, 0.6], ring: [1.05, 1.12, 0.6], pinky: [1.1, 1.15, 0.62] }, spread: 0.1, thumb: 0.75 },
  hold: { curl: { index: [0.55, 0.85, 0.5], middle: [0.62, 0.9, 0.5], ring: [0.68, 0.92, 0.5], pinky: [0.72, 0.95, 0.52] }, spread: 0.2, thumb: 0.5 },
};

export function buildFrames(shoulder, hands = { L: 'relaxed', R: 'relaxed' }, overrides = {}) {
  const table = boneTable(shoulder).map((row) => (overrides[row[0]] ? [row[0], row[1], ...overrides[row[0]], row[5]] : row));
  const bind = {};
  const index = {};
  table.forEach(([name, parent, x, y, z, rz], i) => {
    const m = local(x, y, z, rz);
    bind[name] = parent ? mul(bind[parent], m) : m;
    index[name] = i;
  });
  const cache = {};
  for (const name of Object.keys(bind)) cache[name] = Frame.fromMatrix(bind[name]);
  for (const [t, s] of SIDES) {
    index['lid' + t] = index.head;
    cache['twist' + t] = cache['elbow' + t].sub(0, -LIMB.forearm / 2, 0);
    index['twist' + t] = index['elbow' + t];
    const Wr = cache['wrist' + t];
    const pose = HANDS[hands[t] || 'relaxed'];
    for (const [name, f] of Object.entries(FINGERS)) {
      const c = pose.curl[name];
      const b0 = Wr.sub(s * f.base[0], f.base[1], f.base[2], -f.spread * pose.spread, 0, -s * c[0]);
      const b1 = b0.sub(0, -f.len[0], 0, 0, 0, -s * c[1]);
      const b2 = b1.sub(0, -f.len[1], 0, 0, 0, -s * c[2]);
      [b0, b1, b2].forEach((frame, q) => {
        cache[`${name}${q}${t}`] = frame;
        index[`${name}${q}${t}`] = index['wrist' + t];
      });
    }
    const dir = norm([s * THUMB.dir[0], THUMB.dir[1], THUMB.dir[2]]);
    const flex = norm([s * THUMB.flex[0], THUMB.flex[1], THUMB.flex[2]]);
    const q0 = fromUnit([0, -1, 0], dir);
    const axisWrist = norm(cross(dir, flex));
    const axis = [0, 1, 2].map((r) => q0[r][0] * axisWrist[0] + q0[r][1] * axisWrist[1] + q0[r][2] * axisWrist[2]);
    const t0 = turned(Wr, [s * THUMB.base[0], THUMB.base[1], THUMB.base[2]], q0);
    const t0b = turned(t0, [0, 0, 0], axisAngle(axis, pose.thumb * 0.45));
    const t1 = turned(t0b, [0, -THUMB.len[0], 0], axisAngle(axis, 0.1 + pose.thumb * 0.55));
    const t2 = turned(t1, [0, -THUMB.len[1], 0], axisAngle(axis, 0.12 + pose.thumb * 0.7));
    [t0b, t1, t2].forEach((frame, q) => {
      cache[`thumb${q}${t}`] = frame;
      index[`thumb${q}${t}`] = index['wrist' + t];
    });
  }
  const F = (name) => {
    if (!cache[name]) throw new Error('frames: unknown ' + name);
    return cache[name];
  };
  return { table, bind, index, F };
}
