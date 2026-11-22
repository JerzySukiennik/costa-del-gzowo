// Costa del Gzowo: parametric pedestrian sculpt for the bake (body builds, garments, hair styles, hats, beards) built on the player's signed distance kit.
import { ell, sph, cone, box, custom, union, subtract, intersect, shift, offset, noise, smooth, leaves, tagAll, WORLD } from '../../../src/player/character/sdf.js';
import { weightField } from '../../../src/player/character/mesher.js';
import { sculptArm, sculptHand, sculptLeg } from '../../../src/player/character/sculptBody.js';
import { sculptHead, sculptNeck, hairlineY } from '../../../src/player/character/sculptHead.js';
import { sculptShoe, shoeClip } from '../../../src/player/character/sculptWear.js';
import { SIDES } from '../../../src/npc/ped/bones.js';

const W = WORLD;
export const SEAM = 0.012;
export const UPPER = { M: { sh: 0.19, w: 1, d: 1 }, F: { sh: 0.17, w: 0.9, d: 0.93 }, L: { sh: 0.198, w: 1.06, d: 1.08 } };

export function bodyParams(o = {}) {
  const { upper: key = 'M', ...rest } = o;
  const upper = UPPER[key];
  return { upper, sh: upper.sh, chestW: 1, chestD: 1, waistW: 1, waistD: 1, hipW: 1, hipD: 1, glute: 1, pec: 1, delt: 1, bust: 0, belly: 0, arm: 0, leg: 0, ...rest, upperKey: key };
}

export function sculptTorso(F, B) {
  const up = B.upper;
  const sh = B.sh;
  const parts = [
    ell(W.sub(0, 0.95, -0.01), 0.152 * B.hipW, 0.1, 0.104 * B.hipD).tag({ hips: 1 }),
    ell(W.sub(0, 1.06, 0.012), 0.13 * B.waistW, 0.12, 0.097 * B.waistD).tag({ spine: 0.7, hips: 0.3 }),
    ell(W.sub(0, 1.24, -0.008), 0.146 * B.chestW, 0.165, 0.106 * B.chestD).tag({ chest: 0.6, spine: 0.4 }),
    ell(W.sub(0, 1.335, 0.0), 0.158 * up.w, 0.1, 0.1 * up.d).tag({ chest: 1 }),
    ell(W.sub(0, 1.36, -0.045), 0.132 * up.w, 0.09, 0.07 * up.d).tag({ chest: 1 }),
  ];
  if (B.belly > 0) parts.push(ell(W.sub(0, 1.085, 0.025 + 0.05 * B.belly), 0.135 * B.waistW, 0.135, 0.085 + 0.075 * B.belly).tag({ spine: 0.6, hips: 0.4 }));
  for (const [t, s] of SIDES) {
    parts.push(
      ell(W.sub(s * 0.1 * B.waistW, 1.02, 0), 0.05 * B.waistW, 0.09, 0.078 * B.waistD).tag({ hips: 0.5, spine: 0.5 }),
      ell(W.sub(s * 0.062 * up.w, 1.318, 0.057, 0, 0, s * 0.25), 0.07 * up.w, 0.05, 0.042 * B.pec).tag({ chest: 0.85, ['clavicle' + t]: 0.15 }),
      ell(W.sub(s * 0.113 * B.chestW, 1.24, -0.035, 0, 0, -s * 0.2), 0.05, 0.13, 0.07 * B.chestD).tag({ chest: 0.7, spine: 0.3 }),
      ell(W.sub(s * 0.085 * up.w, 1.33, -0.083, 0, 0, s * 0.3), 0.055, 0.07, 0.022).tag({ chest: 0.6, ['clavicle' + t]: 0.4 }),
      cone(W.point(s * 0.02, 1.47, -0.03), W.point(s * (sh - 0.032), 1.432, -0.018), 0.042, 0.028).tag({ chest: 0.45, neck: 0.25, ['clavicle' + t]: 0.3 }),
      cone(W.point(s * 0.02, 1.437, 0.062), W.point(s * (sh - 0.027), 1.448, 0.01), 0.011, 0.012).tag({ ['clavicle' + t]: 0.7, chest: 0.3 }),
      ell(F('shoulder' + t).sub(s * 0.012, -0.03, 0.0), 0.05 * B.delt, 0.08, 0.055 * B.delt).tag({ ['shoulder' + t]: 0.6, ['clavicle' + t]: 0.4 }),
      ell(W.sub(s * 0.065 * B.hipW, 0.9, -0.07), 0.085 * B.hipW, 0.09, 0.065 * B.glute).tag({ hips: 0.6, ['hip' + t]: 0.4 }),
    );
    if (B.bust > 0) parts.push(ell(W.sub(s * 0.066, 1.272, 0.064), 0.062 * B.bust, 0.058 * B.bust, 0.056 * B.bust).tag({ chest: 1 }));
  }
  return parts;
}

function fatten(node, r, anchor, near, far) {
  if (!r) return node;
  return shift(node, (x, y, z) => -r * smooth(near, far, Math.hypot(x - anchor[0], y - anchor[1], z - anchor[2])), Math.abs(r));
}

export function createBody(frames, B) {
  const { F, index } = frames;
  const H = F('head');
  const torso = sculptTorso(F, B);
  const neck = sculptNeck(H, W);
  const face = tagAll(sculptHead(H, W), { head: 1 });
  const arm = {};
  const hand = {};
  const leg = {};
  const shoe = {};
  const shoeG = {};
  const armSdf = {};
  const legSdf = {};
  for (const [t, s] of SIDES) {
    arm[t] = sculptArm(F, s);
    hand[t] = sculptHand(F, s);
    leg[t] = sculptLeg(F, s);
    shoe[t] = sculptShoe(F, s);
    shoeG[t] = shoeClip(F, s);
    const delt = torso.find((p) => p.bones && p.bones['shoulder' + t] === 0.6);
    armSdf[t] = fatten(union(0.022, ...arm[t], ...hand[t].palm, delt), B.arm, F('wrist' + t).o, 0.04, 0.22);
    legSdf[t] = fatten(union(0.02, ...leg[t]), B.leg, F('ankle' + t).o, 0.08, 0.32);
  }
  const skinLeaves = [...torso, ...neck, ...leaves(face)];
  for (const [t] of SIDES) skinLeaves.push(...arm[t], ...hand[t].palm, ...hand[t].fingers.flatMap((f) => leaves(f)), ...leg[t]);
  const shoeLeaves = SIDES.flatMap(([t]) => leaves(shoe[t]));
  const torsoSdf = union(0.04, ...torso);
  const headSdf = union(0.02, face, union(0.018, ...neck), torsoSdf);
  const coreSdf = union(0.03, torsoSdf, union(0.018, ...neck));
  return {
    F, H, B, torso, neck, face, arm, hand, leg, shoe, shoeG, armSdf, legSdf, torsoSdf, headSdf, coreSdf,
    skinWeights: weightField(skinLeaves, index),
    shoeWeights: weightField(shoeLeaves, index),
  };
}

const drape = (amp) => (x, y, z) => noise(x * 14, y * 9, z * 14) * amp + noise(x * 37, y * 30, z * 37) * amp * 0.35;

export function makeTop(body, o) {
  const { F, B } = body;
  const th = o.thick ?? 0.0045;
  const a = 1 + B.arm * 9;
  const parts = body.torso.filter((p) => !(o.sleeve === 'none' && p.bones && (p.bones.shoulderL === 0.6 || p.bones.shoulderR === 0.6)));
  const frames = {};
  for (const [t] of SIDES) {
    const S = F('shoulder' + t);
    const E = F('elbow' + t);
    frames[t] = { S, E };
    if (o.sleeve === 'none') continue;
    const end = o.sleeve === 'long' ? -0.27 : o.sleeveLen;
    parts.push(cone(S.point(0, -0.03, 0), S.point(0, end - 0.02, 0), 0.0485 * a + (o.ease || 0), 0.0465 * a + (o.ease || 0)));
    if (o.sleeve === 'long') parts.push(cone(S.point(0, -0.24, 0), E.point(0, -0.03, 0), 0.05 * a, 0.047 * a), cone(E.point(0, -0.03, 0), E.point(0, -0.25, 0), 0.046 * a, 0.036 * a + (o.cuff || 0)));
  }
  let skirtTop = null;
  if (o.skirt) {
    const k = o.skirt;
    skirtTop = union(0.05, ...SIDES.map(([, s]) => cone(W.point(s * 0.045 * B.hipW, 0.99, -0.012), W.point(s * k.spread, k.hem - 0.02, 0.0), 0.128 * B.hipW, k.radius)));
  }
  let base = offset(union(0.04, ...parts), th + (o.ease || 0));
  if (skirtTop) base = union(0.05, base, skirtTop);
  const sdf = shift(base, drape(o.drape ?? 0.0022), 0.005);
  const hem = o.skirt ? o.skirt.hem : o.hem;
  const arm = (x, y, z) => {
    const f = x >= 0 ? frames.L : frames.R;
    if (o.sleeve === 'long') {
      const [ex, ey, ez] = f.E.local(x, y, z);
      return Math.min(-0.236 - ey, 0.1 - Math.hypot(ex, ez));
    }
    const [lx, ly, lz] = f.S.local(x, y, z);
    if (o.sleeve === 'none') return Math.min(0.045 - ly, 0.125 - Math.hypot(lx, lz));
    return Math.min(o.sleeveLen - ly, 0.108 - Math.hypot(lx, lz));
  };
  const neck = (x, y, z) => {
    const zc = z + 0.006;
    const rad = Math.hypot(x, zc * 1.05) - (o.neckR + 0.004 + Math.max(0, zc) * o.scoop);
    return Math.min(y - o.neckY - (o.curve ?? 2.6) * x * x, -rad);
  };
  const clip = (x, y, z) => Math.max(hem + Math.sin(x * 9) * 0.003 + z * 0.02 - y, arm(x, y, z), neck(x, y, z));
  return { sdf, clip, arm, neck, hem: 0.0065, skirt: !!o.skirt, bottomY: hem };
}

export function makeBottom(body, o) {
  const { F, B } = body;
  const top = o.top ?? 0.992;
  const seat = [
    ell(W.sub(0, 0.955, -0.008), 0.168 * B.hipW, 0.12, 0.122 * B.hipD),
    ell(W.sub(0, 0.975, 0.002), 0.162 * Math.max(B.waistW, B.hipW * 0.96), 0.06, 0.116 * Math.max(B.waistD, B.hipD * 0.96)),
  ];
  if (B.belly > 0) seat.push(ell(W.sub(0, 1.0, 0.03 + 0.045 * B.belly), 0.14 * B.waistW, 0.06, 0.088 + 0.07 * B.belly));
  for (const [, s] of SIDES) seat.push(ell(W.sub(s * 0.066 * B.hipW, 0.895, -0.07), 0.093 * B.hipW, 0.096, 0.074 * B.glute));
  const frames = { L: F('hipL'), R: F('hipR') };
  const k = 1 + B.leg * 6;
  let raw;
  if (o.kind === 'skirt') {
    raw = union(0.05, ...seat, ...SIDES.map(([, s]) => cone(W.point(s * 0.045 * B.hipW, 0.985, -0.012), W.point(s * o.spread, o.hem - 0.02, 0.0), 0.13 * B.hipW, o.radius)));
  } else if (o.kind === 'leggings') {
    raw = offset(union(0.03, ...seat.slice(0, 1), body.legSdf.L, body.legSdf.R), 0.0035);
  } else {
    const legs = SIDES.map(([t]) => {
      const Hh = F('hip' + t);
      const K = F('knee' + t);
      const len = o.kind === 'trousers' ? -0.43 : o.len;
      const tube = [cone(Hh.point(0, 0.0, 0.004), Hh.point(0, len - 0.02, 0.006), 0.102 * k, (len < -0.36 ? 0.08 : 0.09) * k)];
      if (o.kind === 'trousers') tube.push(cone(K.point(0, 0.03, 0.004), K.point(0, -0.41, -0.002), 0.079 * k, o.ankle ?? 0.064));
      return union(0.055, ...seat, ...tube);
    });
    raw = union(0, ...legs);
  }
  const sdf = shift(raw, (x, y, z) => {
    const band = smooth(top - 0.045, top - 0.038, y) * 0.0018;
    return -band + noise(x * 16, y * 10, z * 16) * 0.0024;
  }, 0.004);
  const clip = (x, y, z) => {
    let g = y - top - z * 0.03;
    if (o.kind === 'skirt') return Math.max(g, o.hem - y);
    if (o.kind === 'trousers' || o.kind === 'leggings') return Math.max(g, (o.cuffY ?? 0.108) - y);
    const [lx, ly, lz] = (x >= 0 ? frames.L : frames.R).local(x, y, z);
    if (Math.hypot(lx, lz) < 0.17 && y < 0.82) g = Math.max(g, o.len - ly);
    return g;
  };
  return { sdf, clip, hem: 0.0055, skirt: o.kind === 'skirt', top };
}

function scalpShell(scalp, thickness, { drop = 0, clump = 1, amp = 0.03 } = {}) {
  return shift(scalp, (x, y, z) => {
    const ly = y - 1.6;
    const above = ly - hairlineY(x, z) + drop;
    const fade = smooth(-0.004, 0.022, above);
    const c = (noise(x * 90, ly * 90, z * 90) * 0.0016 + noise(x * 220, ly * 220, z * 220) * 0.0006) * clump;
    return -(thickness(x, ly, z) * fade + c * fade) + 0.0012;
  }, amp);
}

export const HAIR = {
  crop: (H, face) => ({ sdf: scalpShell(face, (x, ly, z) => 0.0068 + 0.009 * smooth(0.11, 0.18, ly) + 0.004 * smooth(0.0, 0.12, z) * smooth(0.13, 0.17, ly), { amp: 0.022 }), tris: [900, 220] }),
  buzz: (H, face) => ({ sdf: scalpShell(face, () => 0.0035, { amp: 0.012, clump: 0.6 }), tris: [700, 180] }),
  receding: (H, face) => ({ sdf: scalpShell(face, (x, ly, z) => 0.007 + 0.004 * smooth(0.1, 0.16, ly), { amp: 0.02, drop: -0.022 }), drop: -0.022, tris: [800, 200] }),
  short: (H, face) => ({
    sdf: scalpShell(face, (x, ly, z) => 0.006 + 0.007 * smooth(0.04, 0.11, ly) + 0.012 * smooth(0.1, 0.17, ly) + 0.012 * smooth(0.02, 0.1, z) * smooth(0.12, 0.17, ly) + noise(x * 40, ly * 40, z * 40) * 0.004, { amp: 0.045, clump: 2.2 }),
    tris: [1100, 260],
  }),
  ponytail: (H, face) => ({
    sdf: union(0.012, scalpShell(face, () => 0.008, { amp: 0.02, clump: 0.8 }), sph(H.sub(0, 0.128, -0.1), 0.028), cone(H.point(0, 0.12, -0.112), H.point(0, -0.035, -0.158), 0.03, 0.015)),
    free: true, tris: [1200, 300], min: [-0.1, 1.5, -0.2],
  }),
  bun: (H, face) => ({
    sdf: union(0.014, scalpShell(face, () => 0.008, { amp: 0.02, clump: 0.8 }), sph(H.sub(0, 0.168, -0.068), 0.041)),
    free: true, tris: [1100, 280], max: [0.1, 1.84, 0.125],
  }),
  bob: (H, face) => ({
    sdf: subtract(union(0.02, scalpShell(face, () => 0.014, { amp: 0.03, drop: 0.012 }), ell(H.sub(0, 0.035, -0.028), 0.093, 0.108, 0.1)), ell(H.sub(0, -0.02, 0.115), 0.066, 0.125, 0.085), 0.012),
    free: true, drop: 0.012, floor: -0.05, tris: [1300, 320], min: [-0.115, 1.5, -0.15], max: [0.115, 1.84, 0.13],
  }),
  long: (H, face) => ({
    sdf: subtract(union(0.025,
      scalpShell(face, () => 0.013, { amp: 0.03, drop: 0.004 }),
      ell(H.sub(0, -0.045, -0.078), 0.084, 0.175, 0.046),
      ell(H.sub(0.076, -0.04, -0.03), 0.027, 0.15, 0.05),
      ell(H.sub(-0.076, -0.04, -0.03), 0.027, 0.15, 0.05),
    ), ell(H.sub(0, -0.03, 0.12), 0.064, 0.14, 0.09), 0.012),
    free: true, drop: 0.004, sway: true, tris: [1500, 360], min: [-0.125, 1.36, -0.16], max: [0.125, 1.83, 0.125],
  }),
  wavy: (H, face) => ({
    sdf: shift(subtract(union(0.03,
      scalpShell(face, () => 0.016, { amp: 0.03, drop: 0.006 }),
      ell(H.sub(0, -0.03, -0.075), 0.095, 0.17, 0.055),
      ell(H.sub(0.08, -0.03, -0.025), 0.034, 0.15, 0.056),
      ell(H.sub(-0.08, -0.03, -0.025), 0.034, 0.15, 0.056),
    ), ell(H.sub(0, -0.03, 0.125), 0.062, 0.14, 0.09), 0.012), (x, y, z) => Math.sin(y * 95 + noise(x * 22, y * 6, z * 22) * 4) * 0.004 * smooth(1.66, 1.56, y), 0.005),
    free: true, drop: 0.006, sway: true, tris: [1600, 380], min: [-0.14, 1.37, -0.17], max: [0.14, 1.83, 0.125],
  }),
  afro: (H, face) => ({
    sdf: shift(subtract(union(0.03, scalpShell(face, () => 0.02, { amp: 0.035, drop: 0.004 }), ell(H.sub(0, 0.108, -0.022), 0.112, 0.106, 0.116)), ell(H.sub(0, 0.0, 0.12), 0.07, 0.11, 0.08), 0.02),
      (x, y, z) => noise(x * 70, y * 70, z * 70) * 0.005 + noise(x * 150, y * 150, z * 150) * 0.002, 0.008),
    free: true, drop: 0.004, tris: [1300, 320], min: [-0.14, 1.58, -0.16], max: [0.14, 1.86, 0.125],
  }),
  curls: (H, face) => ({
    sdf: shift(subtract(union(0.03, scalpShell(face, () => 0.02, { amp: 0.035, drop: 0.008 }), ell(H.sub(0, 0.07, -0.03), 0.122, 0.145, 0.122)), ell(H.sub(0, -0.03, 0.125), 0.066, 0.13, 0.085), 0.02),
      (x, y, z) => noise(x * 60, y * 60, z * 60) * 0.006 + noise(x * 140, y * 140, z * 140) * 0.0025, 0.01),
    free: true, drop: 0.008, tris: [1500, 360], min: [-0.15, 1.5, -0.18], max: [0.15, 1.86, 0.13],
  }),
};

export function makeHair(body, style) {
  const def = HAIR[style](body.H, body.face);
  const drop = def.drop || 0;
  const line = (x, y, z) => hairlineY(x, z) - drop - (y - 1.6) - 0.002;
  const clip = def.free
    ? (x, y, z) => {
      let g = Math.min(line(x, y, z), 0.0045 - body.headSdf.d(x, y, z));
      if (def.floor !== undefined) g = Math.max(g, 1.6 + def.floor - y);
      return g;
    }
    : line;
  return { sdf: def.sdf, clip, min: def.min || [-0.1, 1.62, -0.15], max: def.max || [0.1, 1.83, 0.125], tris: def.tris, sway: !!def.sway };
}

const above = (H, y0, slope) => custom(H.sub(0, y0, 0), 1, (x, y, z) => -(y - z * slope));

export const HATS = {
  cap: (H, face) => ({
    sdf: union(0.008, intersect(offset(face, 0.011), above(H, 0.086, 0.1), 0.004), box(H.sub(0, 0.097, 0.124, 0.16, 0, 0), 0.066, 0.006, 0.058, 0.0055)),
    line: [0.086, 0.1], tris: [560, 150], min: [-0.115, 1.66, -0.145], max: [0.115, 1.84, 0.195],
  }),
  sun: (H, face) => ({
    sdf: union(0.014, intersect(offset(face, 0.011), above(H, 0.082, 0.07), 0.004), ell(H.sub(0, 0.088, -0.008, 0.07, 0, 0), 0.185, 0.0075, 0.195)),
    line: [0.082, 0.07], tris: [680, 180], min: [-0.2, 1.64, -0.215], max: [0.2, 1.84, 0.2],
  }),
};

export function makeHat(body, kind) {
  const def = HATS[kind](body.H, body.face);
  const clip = (x, y, z) => 0.003 - body.headSdf.d(x, y, z);
  return { ...def, clip };
}

export function makeBeard(body, o) {
  const mask = (x, y, z) => {
    const hy = y - 1.6;
    const sx = Math.abs(x);
    const jaw = smooth(0.036, 0.016, hy - Math.max(0, sx - 0.035) * 0.55) * smooth(-0.1, -0.062, hy) * smooth(-0.05, -0.008, z);
    const side = smooth(0.05, 0.062, sx) * smooth(0.07, 0.03, hy) * smooth(-0.03, 0.0, z) * smooth(0.075, 0.045, z);
    const stache = smooth(0.034, 0.024, sx) * smooth(0.004, 0.009, hy) * smooth(0.024, 0.017, hy) * smooth(0.078, 0.088, z);
    const mouth = smooth(0.03, 0.022, sx) * smooth(-0.02, -0.013, hy) * smooth(0.008, 0.003, hy) * smooth(0.072, 0.082, z);
    return Math.min(1, jaw + side + stache) * (1 - mouth);
  };
  const sdf = shift(body.face, (x, y, z) => {
    const m = mask(x, y, z);
    return -(o.thick * m + noise(x * 110, y * 110, z * 110) * 0.0018 * m) + 0.0012;
  }, o.thick + 0.004);
  return { sdf, clip: (x, y, z) => 0.45 - mask(x, y, z), min: [-0.09, 1.49, -0.06], max: [0.09, 1.69, 0.125], tris: [420, 110] };
}

export { W, sph, cone, box, ell, union, offset };
