// Costa del Gzowo: torso, arm, hand and leg sculpt with per-primitive bone tags for skin weights.
import { ell, sph, cone, box, union } from './sdf.js';
import { FINGERS, THUMB } from './anatomy.js';

export function sculptTorso(F, W) {
  const parts = [
    ell(W.sub(0, 0.95, -0.01), 0.152, 0.1, 0.104).tag({ hips: 1 }),
    ell(W.sub(0, 1.06, 0.012), 0.13, 0.12, 0.097).tag({ spine: 0.7, hips: 0.3 }),
    ell(W.sub(0, 1.24, -0.008), 0.146, 0.165, 0.106).tag({ chest: 0.6, spine: 0.4 }),
    ell(W.sub(0, 1.335, 0.0), 0.158, 0.1, 0.1).tag({ chest: 1 }),
    ell(W.sub(0, 1.36, -0.045), 0.132, 0.09, 0.07).tag({ chest: 1 }),
  ];
  for (const s of [1, -1]) {
    const t = s > 0 ? 'L' : 'R';
    parts.push(
      ell(W.sub(s * 0.1, 1.02, 0), 0.05, 0.09, 0.078).tag({ hips: 0.5, spine: 0.5 }),
      ell(W.sub(s * 0.062, 1.318, 0.057, 0, 0, s * 0.25), 0.07, 0.05, 0.042).tag({ chest: 0.85, ['clavicle' + t]: 0.15 }),
      ell(W.sub(s * 0.113, 1.24, -0.035, 0, 0, -s * 0.2), 0.05, 0.13, 0.07).tag({ chest: 0.7, spine: 0.3 }),
      ell(W.sub(s * 0.085, 1.33, -0.083, 0, 0, s * 0.3), 0.055, 0.07, 0.022).tag({ chest: 0.6, ['clavicle' + t]: 0.4 }),
      cone(W.point(s * 0.02, 1.47, -0.03), W.point(s * 0.158, 1.432, -0.018), 0.042, 0.028).tag({ chest: 0.45, neck: 0.25, ['clavicle' + t]: 0.3 }),
      cone(W.point(s * 0.02, 1.437, 0.062), W.point(s * 0.163, 1.448, 0.01), 0.011, 0.012).tag({ ['clavicle' + t]: 0.7, chest: 0.3 }),
      ell(F('shoulder' + t).sub(s * 0.012, -0.03, 0.0), 0.05, 0.08, 0.055).tag({ ['shoulder' + t]: 0.6, ['clavicle' + t]: 0.4 }),
      ell(W.sub(s * 0.065, 0.9, -0.07), 0.085, 0.09, 0.065).tag({ hips: 0.6, ['hip' + t]: 0.4 }),
    );
  }
  return parts;
}

export function sculptArm(F, s) {
  const t = s > 0 ? 'L' : 'R';
  const S = F('shoulder' + t);
  const E = F('elbow' + t);
  const T = F('twist' + t);
  const Wr = F('wrist' + t);
  const sh = 'shoulder' + t;
  const el = 'elbow' + t;
  return [
    cone(S.point(0, -0.02, 0), S.point(0, -0.27, 0), 0.045, 0.036).tag({ [sh]: 1 }),
    ell(S.sub(0, -0.155, 0.017), 0.03, 0.075, 0.029).tag({ [sh]: 1 }),
    ell(S.sub(s * 0.004, -0.115, -0.02), 0.032, 0.085, 0.028).tag({ [sh]: 1 }),
    sph(E.sub(0, 0.004, -0.021), 0.0165).tag({ [el]: 0.5, [sh]: 0.5 }),
    ell(E.sub(0, 0.006, -0.004), 0.034, 0.018, 0.022).tag({ [el]: 0.5, [sh]: 0.5 }),
    cone(E.point(0, -0.01, 0), T.point(0, 0, 0), 0.038, 0.03).tag({ [el]: 1 }),
    ell(E.sub(s * 0.009, -0.07, 0.01), 0.032, 0.075, 0.029).tag({ [el]: 1 }),
    ell(E.sub(-s * 0.006, -0.08, -0.004), 0.029, 0.08, 0.029).tag({ [el]: 1 }),
    cone(T.point(0, 0, 0), Wr.point(0, 0.022, 0), 0.03, 0.022).tag({ ['twist' + t]: 1 }),
    box(Wr.sub(0, 0.006, 0.0), 0.0175, 0.022, 0.027, 0.015).tag({ ['wrist' + t]: 0.5, ['twist' + t]: 0.5 }),
  ];
}

export function sculptHand(F, s) {
  const t = s > 0 ? 'L' : 'R';
  const Wr = F('wrist' + t);
  const w = 'wrist' + t;
  const palm = [
    box(Wr.sub(0, -0.053, 0.0), 0.0125, 0.046, 0.04, 0.0105).tag({ [w]: 1 }),
    ell(Wr.sub(s * 0.003, -0.062, 0), 0.0125, 0.042, 0.041).tag({ [w]: 1 }),
    ell(Wr.sub(-s * 0.008, -0.036, 0.022), 0.0125, 0.026, 0.016).tag({ [w]: 0.6, ['thumb0' + t]: 0.4 }),
    ell(Wr.sub(-s * 0.006, -0.052, -0.029), 0.011, 0.032, 0.012).tag({ [w]: 1 }),
  ];
  const fingers = [];
  for (const [name, f] of Object.entries(FINGERS)) {
    const B = [0, 1, 2].map((q) => F(`${name}${q}${t}`));
    palm.push(sph(B[0].sub(s * 0.003, 0.004, 0), f.r[0] * 1.02).tag({ [w]: 0.5, [`${name}0${t}`]: 0.5 }));
    fingers.push(
      union(0.004,
        cone(B[0].point(0, 0, 0), B[1].point(0, 0, 0), f.r[0], f.r[1]).tag({ [`${name}0${t}`]: 1 }),
        sph(B[1].sub(s * 0.0006, 0, 0), f.r[1] * 1.04).tag({ [`${name}0${t}`]: 0.5, [`${name}1${t}`]: 0.5 }),
        cone(B[1].point(0, 0, 0), B[2].point(0, 0, 0), f.r[1], f.r[2]).tag({ [`${name}1${t}`]: 1 }),
        sph(B[2].sub(s * 0.0004, 0, 0), f.r[2] * 1.03).tag({ [`${name}1${t}`]: 0.5, [`${name}2${t}`]: 0.5 }),
        cone(B[2].point(0, 0, 0), B[2].point(-s * 0.0008, -f.len[2] + f.r[3] * 0.9, 0), f.r[2], f.r[3]).tag({ [`${name}2${t}`]: 1 }),
        ell(B[2].sub(-s * 0.0018, -f.len[2] + f.r[3] * 1.3, 0), f.r[3] * 0.92, f.r[3] * 1.25, f.r[3] * 1.02).tag({ [`${name}2${t}`]: 1 }),
      ),
    );
  }
  const TB = [0, 1, 2].map((q) => F(`thumb${q}${t}`));
  fingers.push(
    union(0.005,
      cone(TB[0].point(0, 0, 0), TB[1].point(0, 0, 0), THUMB.r[0], THUMB.r[1]).tag({ [`thumb0${t}`]: 1 }),
      sph(TB[1].sub(0, 0, 0), THUMB.r[1] * 1.04).tag({ [`thumb0${t}`]: 0.5, [`thumb1${t}`]: 0.5 }),
      cone(TB[1].point(0, 0, 0), TB[2].point(0, 0, 0), THUMB.r[1], THUMB.r[2]).tag({ [`thumb1${t}`]: 1 }),
      sph(TB[2].sub(0, 0, 0), THUMB.r[2] * 1.03).tag({ [`thumb1${t}`]: 0.5, [`thumb2${t}`]: 0.5 }),
      cone(TB[2].point(0, 0, 0), TB[2].point(0, -THUMB.len[2] + THUMB.r[3], 0), THUMB.r[2], THUMB.r[3]).tag({ [`thumb2${t}`]: 1 }),
    ),
  );
  palm.push(ell(Wr.sub(-s * 0.002, -0.06, 0.03), 0.007, 0.022, 0.014).tag({ [w]: 0.5, [`thumb0${t}`]: 0.5 }));
  return { palm, fingers };
}

export function sculptLeg(F, s) {
  const t = s > 0 ? 'L' : 'R';
  const Hh = F('hip' + t);
  const K = F('knee' + t);
  const A = F('ankle' + t);
  const T = F('toe' + t);
  const hp = 'hip' + t;
  const kn = 'knee' + t;
  const an = 'ankle' + t;
  return [
    cone(Hh.point(0, -0.02, 0), Hh.point(0, -0.4, 0), 0.083, 0.052).tag({ [hp]: 1 }),
    ell(Hh.sub(s * 0.008, -0.25, 0.024), 0.058, 0.15, 0.05).tag({ [hp]: 1 }),
    ell(Hh.sub(-s * 0.026, -0.365, 0.016), 0.034, 0.05, 0.035).tag({ [hp]: 0.8, [kn]: 0.2 }),
    ell(Hh.sub(0, -0.22, -0.03), 0.055, 0.15, 0.045).tag({ [hp]: 1 }),
    ell(K.sub(0, 0.006, 0.041), 0.021, 0.025, 0.012).tag({ [kn]: 0.5, [hp]: 0.5 }),
    ell(K.sub(0, 0.012, 0.0), 0.049, 0.034, 0.044).tag({ [kn]: 0.5, [hp]: 0.5 }),
    cone(K.point(0, -0.012, 0.034), K.point(0, -0.06, 0.03), 0.012, 0.012).tag({ [kn]: 1 }),
    cone(K.point(0, -0.02, 0.0), K.point(0, -0.4, -0.006), 0.045, 0.029).tag({ [kn]: 1 }),
    ell(K.sub(-s * 0.015, -0.12, -0.027), 0.033, 0.082, 0.035).tag({ [kn]: 1 }),
    ell(K.sub(s * 0.016, -0.1, -0.025), 0.029, 0.07, 0.03).tag({ [kn]: 1 }),
    cone(K.point(-s * 0.006, -0.05, 0.031), K.point(-s * 0.01, -0.33, 0.017), 0.012, 0.008).tag({ [kn]: 1 }),
    cone(K.point(0, -0.25, -0.03), A.point(0, -0.03, -0.044), 0.016, 0.0115).tag({ [kn]: 0.6, [an]: 0.4 }),
    sph(A.sub(s * 0.031, -0.006, -0.01), 0.0115).tag({ [kn]: 0.5, [an]: 0.5 }),
    sph(A.sub(-s * 0.027, 0.004, 0.0), 0.012).tag({ [kn]: 0.5, [an]: 0.5 }),
    box(A.sub(0, -0.034, 0.05), 0.04, 0.025, 0.1, 0.022).tag({ [an]: 1 }),
    sph(A.sub(0, -0.034, -0.034), 0.029).tag({ [an]: 1 }),
    box(T.sub(0, 0.0, 0.034), 0.042, 0.015, 0.04, 0.014).tag({ ['toe' + t]: 1 }),
  ];
}
