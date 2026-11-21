// Costa del Gzowo: garment and footwear sculpt (fitted tee, denim shorts, low-top sneakers, cropped hair) with their trim fields.
import { ell, cone, box, torus, union, subtract, shift, offset, noise, smooth } from './sdf.js';
import { hairlineY } from './sculptHead.js';

export const SHIRT = { hem: 0.962, sleeve: -0.142, neckY: 1.468, neckR: 0.074 };
export const SHORTS = { top: 0.992, hem: -0.305 };

function sideFrame(F, x) {
  return x >= 0 ? F.L : F.R;
}

export function sculptShirt(F, W) {
  const parts = [
    ell(W.sub(0, 1.24, -0.008), 0.152, 0.17, 0.112),
    ell(W.sub(0, 1.335, 0.0), 0.162, 0.104, 0.104),
    ell(W.sub(0, 1.36, -0.045), 0.137, 0.094, 0.074),
    ell(W.sub(0, 1.07, 0.006), 0.142, 0.13, 0.106),
    ell(W.sub(0, 0.99, 0.0), 0.162, 0.075, 0.12),
  ];
  for (const s of [1, -1]) {
    const t = s > 0 ? 'L' : 'R';
    const S = F('shoulder' + t);
    parts.push(
      ell(W.sub(s * 0.064, 1.318, 0.062, 0, 0, s * 0.25), 0.072, 0.054, 0.044),
      ell(W.sub(s * 0.114, 1.24, -0.034, 0, 0, -s * 0.2), 0.053, 0.135, 0.072),
      ell(W.sub(s * 0.085, 1.33, -0.087, 0, 0, s * 0.3), 0.057, 0.072, 0.024),
      cone(W.point(s * 0.02, 1.474, -0.03), W.point(s * 0.158, 1.436, -0.018), 0.045, 0.031),
      ell(S.sub(s * 0.008, -0.035, 0.0), 0.047, 0.08, 0.053),
      cone(S.point(0, -0.03, 0), S.point(0, SHIRT.sleeve - 0.02, 0), 0.053, 0.05),
    );
  }
  const base = offset(union(0.05, ...parts), 0.007);
  const folded = shift(base, (x, y, z) => {
    const waist = smooth(0.96, 1.0, y) * (1 - smooth(1.08, 1.16, y));
    const wr = Math.sin(y * 210 + noise(x * 40, y * 12, z * 40) * 3) * 0.0016 * waist;
    const pit = Math.max(0, 1 - Math.abs(Math.abs(x) - 0.16) / 0.05) * smooth(1.22, 1.3, y) * (1 - smooth(1.36, 1.4, y));
    const pf = Math.sin((y - Math.abs(x) * 0.8) * 260) * 0.0014 * pit;
    const drape = noise(x * 14, y * 9, z * 14) * 0.0022;
    return wr + pf + drape;
  }, 0.004);
  return folded;
}

export function shirtClip(F) {
  const frames = { L: F('shoulderL'), R: F('shoulderR') };
  return (x, y, z) => {
    let g = SHIRT.hem + Math.sin(x * 9) * 0.003 + z * 0.02 - y;
    const S = sideFrame(frames, x);
    const [lx, ly, lz] = S.local(x, y, z);
    if (Math.hypot(lx, lz) < 0.11 && ly < 0) g = Math.max(g, SHIRT.sleeve - ly);
    const zc = z + 0.006;
    const rad = Math.hypot(x, zc * 1.05) - (SHIRT.neckR + 0.004 + Math.max(0, zc) * 0.12);
    g = Math.max(g, Math.min(y - 1.42, -rad));
    return g;
  };
}

export function sculptShorts(F, W) {
  const seat = [
    ell(W.sub(0, 0.955, -0.008), 0.168, 0.12, 0.122),
    ell(W.sub(0, 0.975, 0.002), 0.162, 0.06, 0.116),
  ];
  for (const s of [1, -1]) seat.push(ell(W.sub(s * 0.066, 0.895, -0.07), 0.093, 0.096, 0.074));
  const legs = [1, -1].map((s) => {
    const Hh = F(s > 0 ? 'hipL' : 'hipR');
    return union(0.055, ...seat, cone(Hh.point(0, 0.0, 0.004), Hh.point(0, SHORTS.hem - 0.02, 0.006), 0.102, 0.09));
  });
  const raw = union(0, ...legs);
  const frames = { L: F('hipL'), R: F('hipR') };
  return shift(raw, (x, y, z) => {
    const H = sideFrame(frames, x);
    const [, ly] = H.local(x, y, z);
    const band = smooth(SHORTS.top - 0.045, SHORTS.top - 0.038, y) * 0.0018;
    const cuff = Math.exp(-(((ly - (SHORTS.hem + 0.017)) / 0.008) ** 2)) * 0.0028 * (y < 0.8 ? 1 : 0);
    const crotch = Math.max(0, 1 - Math.abs(x) / 0.09) * smooth(0.78, 0.84, y) * (1 - smooth(0.88, 0.92, y));
    const whisk = Math.sin(Math.atan2(y - 0.8, Math.abs(x)) * 22) * 0.0012 * crotch;
    return -band - cuff + whisk + noise(x * 16, y * 10, z * 16) * 0.0025;
  }, 0.004);
}

export function shortsClip(F) {
  const frames = { L: F('hipL'), R: F('hipR') };
  return (x, y, z) => {
    let g = y - SHORTS.top - z * 0.03;
    const H = sideFrame(frames, x);
    const [lx, ly, lz] = H.local(x, y, z);
    if (Math.hypot(lx, lz) < 0.16 && y < 0.82) g = Math.max(g, SHORTS.hem - ly);
    return g;
  };
}

export function sculptShoe(F, s) {
  const t = s > 0 ? 'L' : 'R';
  const A = F('ankle' + t);
  const T = F('toe' + t);
  const an = 'ankle' + t;
  const to = 'toe' + t;
  const sole = union(0.008,
    box(A.sub(0, -0.0475, -0.005), 0.044, 0.0135, 0.062, 0.0125).tag({ [an]: 1 }),
    ell(A.sub(0, -0.0475, 0.075), 0.049, 0.0145, 0.1).tag({ [an]: 1 }),
    ell(T.sub(0, -0.003, 0.035, -0.1, 0, 0), 0.049, 0.0135, 0.075).tag({ [to]: 1 }),
  );
  const upper = union(0.03,
    ell(A.sub(0, -0.014, -0.026), 0.044, 0.044, 0.05).tag({ [an]: 1 }),
    box(A.sub(0, -0.026, 0.045), 0.044, 0.026, 0.07, 0.024).tag({ [an]: 1 }),
    ell(A.sub(0, -0.022, 0.085, -0.22, 0, 0), 0.044, 0.028, 0.08).tag({ [an]: 1 }),
    ell(T.sub(0, 0.003, 0.048), 0.045, 0.023, 0.06).tag({ [to]: 1 }),
    ell(A.sub(0, -0.008, 0.07, -0.55, 0, 0), 0.025, 0.007, 0.038).tag({ [an]: 1 }),
    torus(A.sub(0, 0.003, -0.006, 0.28, 0, 0), 0.04, 0.009, 0.92, 1.12).tag({ [an]: 1 }),
  );
  return union(0.006, sole, upper);
}

export function shoeClip(F, s) {
  const A = F(s > 0 ? 'ankleL' : 'ankleR');
  return (x, y, z) => {
    const [, ly, lz] = A.local(x, y, z);
    const collar = lz < 0 ? -lz * 0.32 : -lz * 0.12;
    return Math.min(ly - collar, 0.052 - lz);
  };
}

export function sculptHair(H, scalp) {
  return shift(scalp, (x, y, z) => {
    const lx = x;
    const ly = y - 1.6;
    const lz = z;
    const above = ly - hairlineY(lx, lz);
    const top = 0.0068 + 0.009 * smooth(0.11, 0.18, ly) + 0.004 * smooth(0.0, 0.12, lz) * smooth(0.13, 0.17, ly);
    const fade = smooth(-0.004, 0.022, above);
    const clump = noise(lx * 90, ly * 90, lz * 90) * 0.0016 + noise(lx * 220, ly * 220, lz * 220) * 0.0006;
    return -(top * fade + clump * fade) + 0.0012;
  }, 0.02);
}

export function hairClip() {
  return (x, y, z) => hairlineY(x, z) - (y - 1.6) - 0.002;
}
