// Riverside: analytic terrain height and river flow, shared by terrain mesh, physics, vegetation and water.
import { BRIDGE, ROAD, WORLD } from '../config.js';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;

function hash(x, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function vnoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x + i * 17.3, z - i * 9.1);
    norm += amp;
    x = x * 2.03 + 3.1;
    z = z * 2.03 - 1.7;
    amp *= 0.5;
  }
  return sum / norm;
}

export function riverCenter(z) {
  const bend = z > 140 ? 0.0021 * (z - 140) ** 2 : z < -140 ? -0.0021 * (z + 140) ** 2 : 0;
  return 10 * Math.sin(z / 75) + 4 * Math.sin(z / 33) + bend;
}

export function riverSlope(z) {
  const bend = z > 140 ? 0.0042 * (z - 140) : z < -140 ? -0.0042 * (z + 140) : 0;
  return (10 / 75) * Math.cos(z / 75) + (4 / 33) * Math.cos(z / 33) + bend;
}

export function riverHalfWidth(z) {
  return 26 + 3 * Math.sin(z / 47 + 0.6) + 1.5 * Math.sin(z / 19 + 2.1);
}

export function roadY(x) {
  const ax = Math.abs(x);
  return ROAD.baseY + (BRIDGE.deckY - ROAD.baseY) * (1 - smooth(BRIDGE.halfLength, 150, ax));
}

const TRACK = [
  [-121, 23, 0, 3.4],
  [-104, 38, -0.75, 2.6],
  [-76, 56, -1.9, 2.4],
  [-48, 68, -3.0, 2.4],
  [-30, 73, -4.1, 2.6],
  [-18, 75.5, -4.75, 3.0],
  [-6, 78, -6.2, 3.0],
];

export function trackInfo(x, z) {
  let best = Infinity;
  let by = 0;
  let bw = 0;
  let bt = 0;
  for (let i = 0; i < TRACK.length - 1; i++) {
    const a = TRACK[i];
    const b = TRACK[i + 1];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    const px = a[0] + ex * t;
    const pz = a[1] + ez * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      by = a[2] + (b[2] - a[2]) * t;
      bw = a[3] + (b[3] - a[3]) * t;
      bt = (i + t) / (TRACK.length - 1);
    }
  }
  return { dist: best, yOffset: by, halfWidth: bw, t: bt };
}

export const TRACK_POINTS = TRACK;

function natural(x, z) {
  const slope = riverSlope(z);
  const lateral = (x - riverCenter(z)) / Math.sqrt(1 + slope * slope);
  const wobble = (fbm(x * 0.06, z * 0.06, 3) - 0.5) * 6 + (fbm(x * 0.31, z * 0.31, 2) - 0.5) * 1.3;
  const s = Math.abs(lateral) - riverHalfWidth(z) + wobble;
  if (s < 0) {
    const inside = -s;
    const outerBend = clamp(0.5 + 0.5 * Math.sign(lateral) * Math.sin(z / 75 + 1.2), 0, 1);
    const deep = 3.3 + 0.8 * Math.sin(z / 61 + 1) + 0.9 * outerBend;
    const bars = (fbm(x * 0.09, z * 0.05, 3) - 0.5) * 1.1 * smooth(3, 12, inside);
    return -(0.14 * Math.min(inside, 5) + (deep - 0.7) * smooth(4, 16, inside)) + bars + (fbm(x * 0.9, z * 0.9, 2) - 0.5) * 0.08;
  }
  const roll = (fbm(x * 0.021, z * 0.021, 4) - 0.5) * 2 * (0.2 + 1.5 * smooth(5, 70, s));
  const micro = (fbm(x * 0.33, z * 0.33, 3) - 0.5) * 0.22 * smooth(0.5, 4, s);
  const hills = 17 * smooth(175, 315, Math.abs(lateral)) * (0.55 + 0.9 * fbm(x * 0.011 + 9, z * 0.011, 3));
  return 0.14 * Math.min(s, 2) + 1.9 * smooth(2, 9, s) + 2.6 * smooth(8, 70, s) + roll + micro + hills;
}

function rectDistance(x, z, r) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.hypot(dx, dz);
}

export function heightAt(x, z) {
  let y = natural(x, z);
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const dz = Math.max(0, az - (ROAD.halfWidth + ROAD.shoulder));
  const dEnd = Math.max(0, BRIDGE.halfLength - ax);
  const dist = Math.hypot(dz, dEnd);
  const grade = roadY(x) - 0.14;
  const fill = grade - dist * 0.52 - 2.9 * smooth(0, 0.8, dEnd);
  if (y < fill) y = fill;
  if (dEnd === 0) {
    const cut = grade + dist * 0.5;
    if (y > cut) y = cut;
  }
  const pull = rectDistance(x, z, ROAD.pullOff);
  if (pull < 9) {
    const target = roadY(x) - 0.16 - 0.015 * Math.max(0, z - ROAD.pullOff.z0);
    y = mix(target, y, smooth(0, 9, pull));
  }
  const tr = trackInfo(x, z);
  if (tr.dist < tr.halfWidth + 6) {
    const base = roadY(-121) - 0.2;
    const target = base + tr.yOffset;
    const rut = Math.cos(clamp(tr.dist / tr.halfWidth, 0, 1) * Math.PI * 2) * -0.025;
    y = mix(target + rut, y, smooth(tr.halfWidth, tr.halfWidth + 6, tr.dist));
  }
  return y;
}

export function depthAt(x, z) {
  return Math.max(0, WORLD.waterLevel - heightAt(x, z));
}

export function flowAt(x, z, out) {
  const slope = riverSlope(z);
  const inv = 1 / Math.sqrt(1 + slope * slope);
  const depth = depthAt(x, z);
  const speed = WORLD.flowSpeed * (0.25 + 0.75 * smooth(0.15, 2.6, depth)) * (depth > 0 ? 1 : 0);
  out.x = slope * inv * speed;
  out.y = inv * speed;
  return out;
}
