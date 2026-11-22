// Costa del Gzowo Cyber Truck: body dimensions and the straight-line silhouette functions shared by the model, physics and damage.
export const CT = {
  length: 5.68,
  nose: 2.84,
  tail: -2.84,
  halfWidth: 1.0,
  wheelbase: 3.81,
  axleFront: 1.92,
  axleRear: -1.89,
  track: 1.72,
  wheelRadius: 0.445,
  tireWidth: 0.31,
  windshield: 2.02,
  apex: 0.45,
  apexY: 1.78,
  roofRear: -1.06,
  rocker: 0.52,
  side: 0.985,
  belt: 1.2,
  doorFront: 1.58,
  doorMid: 0.05,
  doorRear: -1.0,
  floor: 0.44,
  bedFloor: 0.74,
  bedFront: -1.12,
  bedRear: -2.76,
  archBottom: 0.38,
  archTop: 1.0,
  archHalfBottom: 0.68,
  archHalfTop: 0.36,
  seat: { x: 0.12, y: 0.77, z: -0.43 },
  wheel: { x: 0.48, y: 1.1, z: -0.43 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const pw = (pts, x) => {
  if (x >= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x >= pts[i][0]) return lerp(pts[i][1], pts[i - 1][1], (x - pts[i][0]) / (pts[i - 1][0] - pts[i][0]));
  return pts[pts.length - 1][1];
};

export function topY(x) {
  return x >= CT.apex ? CT.apexY - (x - CT.apex) * 0.318 : CT.apexY - (CT.apex - x) * 0.146;
}

const TOP_W = [[2.84, 0.86], [2.02, 0.81], [0.45, 0.64], [-1.06, 0.67], [-2.84, 0.83]];
export function topW(x) {
  return pw(TOP_W, x);
}

const BELT = [[2.84, 0.97], [2.02, 1.18], [0.45, 1.2], [-1.06, 1.22], [-2.84, 1.22]];
export function beltY(x) {
  return pw(BELT, x);
}

export function beltW() {
  return 0.995;
}

export function sideZ(y) {
  return CT.side + (y - CT.rocker) * 0.014;
}

export function strip(x, u, s, out) {
  const y0 = beltY(x);
  const y1 = topY(x);
  out.set(x, lerp(y0, y1, u), s * lerp(beltW(), topW(x), u));
  return out;
}

export function archOutline(xc) {
  const b = CT.archHalfBottom;
  const t = CT.archHalfTop;
  return [[xc + b, CT.archBottom], [xc + t, CT.archTop], [xc - t, CT.archTop], [xc - b, CT.archBottom]];
}

export function archX(xc, y, sign) {
  const k = (y - CT.archBottom) / (CT.archTop - CT.archBottom);
  return xc + sign * lerp(CT.archHalfBottom, CT.archHalfTop, k);
}
