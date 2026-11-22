// Costa del Gzowo: Gzowo Springs street plan (streets, pavements, alleys, lots, plots, yards) and paved-ground heights, all in the town's own coordinates (see space.js for the shift to world coordinates).
import { TOWN } from '../../config.js';

const AREA = { x0: TOWN.x0 - TOWN.shift, x1: TOWN.x1 - TOWN.shift, z0: TOWN.z0, z1: TOWN.z1 };

export const MAIN = { z: 0, half: 7, walk: 3.5, x0: 262, x1: 392, crown: 0.018 };
export const CROSS = [
  { x: 300, half: 4, walk: 3, z0: -66, z1: 66, name: 'PALM AVE' },
  { x: 346, half: 4, walk: 3, z0: -66, z1: 66, name: 'ROCKET ST' },
];
export const ALLEYS = [
  { z: 29, half: 2.5, x0: 266, x1: 392 },
  { z: -29, half: 2.5, x0: 303, x1: 392 },
];
export const LOTS = [
  { id: 'parking', x0: 266, x1: 293, z0: 31.5, z1: 60 },
  { id: 'gas', x0: 264, x1: 296, z0: -30, z1: -10.5 },
  { id: 'diner', x0: 392, x1: 402, z0: -16, z1: 16 },
  { id: 'pierogi', x0: 325, x1: 339, z0: -60, z1: -36 },
];
export const PLAZA = { x0: 307, x1: 339, z0: 10.5, z1: 26.5 };
export const FRONT = MAIN.half + MAIN.walk;

export const PLOTS = [
  { id: 'coffee', x0: 266, x1: 279, z0: FRONT, z1: 26.5, face: 'S' },
  { id: 'hotel', x0: 279, x1: 293, z0: FRONT, z1: 26.5, face: 'S' },
  { id: 'hobby', x0: 353, x1: 366, z0: FRONT, z1: 26.5, face: 'S' },
  { id: 'barber', x0: 366, x1: 376, z0: FRONT, z1: 22, face: 'S' },
  { id: 'arcade', x0: 376, x1: 392, z0: FRONT, z1: 26.5, face: 'S' },
  { id: 'gaskiosk', x0: 276, x1: 293, z0: -30, z1: -22, face: 'N' },
  { id: 'pharmacy', x0: 307, x1: 318, z0: -26.5, z1: -FRONT, face: 'N' },
  { id: 'icecream', x0: 318, x1: 328, z0: -22, z1: -FRONT, face: 'N' },
  { id: 'records', x0: 328, x1: 339, z0: -26.5, z1: -FRONT, face: 'N' },
  { id: 'motel', x0: 353, x1: 365, z0: -26.5, z1: -FRONT, face: 'N' },
  { id: 'laundry', x0: 365, x1: 375, z0: -26.5, z1: -FRONT, face: 'N' },
  { id: 'hardware', x0: 375, x1: 392, z0: -26.5, z1: -FRONT, face: 'N' },
  { id: 'post', x0: 307, x1: 330, z0: 34, z1: 50, face: 'W' },
  { id: 'hangar', x0: 356, x1: 386, z0: 34, z1: 56, face: 'W' },
  { id: 'pierogi', x0: 307, x1: 323, z0: -56, z1: -38, face: 'W' },
  { id: 'house1', x0: 280, x1: 292, z0: -58, z1: -44, face: 'E' },
  { id: 'house2', x0: 356, x1: 367, z0: -58, z1: -44, face: 'W' },
  { id: 'house3', x0: 372, x1: 383, z0: -58, z1: -44, face: 'W' },
  { id: 'diner', x0: 402, x1: 411, z0: -12, z1: 12, face: 'W' },
];
export const YARDS = [
  { x0: 268, x1: 296, z0: -64, z1: -38 },
  { x0: 353, x1: 389, z0: -64, z1: -38 },
];

const between = (v, a, b) => v >= a && v <= b;

export function onMain(x, z, pad = 0) {
  return between(x, MAIN.x0 - pad, MAIN.x1 + pad) && Math.abs(z) <= MAIN.half + pad;
}

export function onCross(x, z, pad = 0) {
  for (const c of CROSS) if (Math.abs(x - c.x) <= c.half + pad && between(z, c.z0 - pad, c.z1 + pad)) return c;
  return null;
}

export function onFlat(x, z, pad = 0) {
  for (const a of ALLEYS) if (Math.abs(z - a.z) <= a.half + pad && between(x, a.x0 - pad, a.x1 + pad)) return true;
  for (const l of LOTS) if (between(x, l.x0 - pad, l.x1 + pad) && between(z, l.z0 - pad, l.z1 + pad)) return true;
  return false;
}

export function isPaved(x, z, pad = 0) {
  return onMain(x, z, pad) || !!onCross(x, z, pad) || onFlat(x, z, pad);
}

export function streetY(x, z) {
  let d = Infinity;
  if (between(x, MAIN.x0 - 1, MAIN.x1 + 1)) d = Math.abs(z);
  for (const c of CROSS) if (between(z, c.z0 - 1, c.z1 + 1)) d = Math.min(d, Math.abs(x - c.x));
  if (d <= MAIN.half) return TOWN.street - MAIN.crown * d;
  return TOWN.street - MAIN.crown * MAIN.half + 0.03;
}

export function inTown(x, z, pad = 0) {
  return x > AREA.x0 - pad && x < AREA.x1 + pad && z > AREA.z0 - pad && z < AREA.z1 + pad;
}

export function inYard(x, z) {
  return YARDS.some((y) => between(x, y.x0, y.x1) && between(z, y.z0, y.z1));
}
