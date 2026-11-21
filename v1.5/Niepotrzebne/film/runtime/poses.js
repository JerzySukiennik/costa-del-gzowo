// Costa del Gzowo film: pose library for the avatar (absolute joint targets for character.setScripted, some animated over time).
(() => {
  const F = (window.__filmPoses = {});
  const SIDES = [['L', 1], ['R', -1]];
  const STAND = {
    hipsY: 0.93, hipsPitch: 0, hipsRoll: 0, hipsYaw: 0, hipsShift: 0, hipsFwd: 0,
    spinePitch: 0, spineTwist: 0, spineRoll: 0, headPitch: 0, headYaw: 0, headRoll: 0, leanPitch: 0, leanRoll: 0,
    eyeYaw: 0, eyePitch: 0, blink: 0,
  };
  for (const [t] of SIDES) {
    Object.assign(STAND, {
      ['arm' + t]: 0.03, ['armOut' + t]: 0.15, ['elbow' + t]: 0.2, ['armTwist' + t]: 0.25, ['shrug' + t]: 0, ['forearm' + t]: 0, ['wrist' + t]: 0, ['wristSide' + t]: 0,
      ['grip' + t]: 0.2, ['thumb' + t]: 0.15, ['spread' + t]: 0.6,
      ['leg' + t]: 0, ['legOut' + t]: 0.02, ['knee' + t]: 0.02, ['foot' + t]: -0.02, ['toe' + t]: 0, ['legTwist' + t]: 0,
    });
  }
  const sym = (o) => {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (k.endsWith('_')) {
        out[k.slice(0, -1) + 'L'] = v;
        out[k.slice(0, -1) + 'R'] = v;
      } else out[k] = v;
    }
    return out;
  };
  const P = (...parts) => Object.assign({}, STAND, ...parts.map(sym));
  F.P = P;
  F.STAND = STAND;

  F.stand = () => P({});
  F.tpose = () => P({ armOut_: 1.57, arm_: 0, elbow_: 0, armTwist_: 0, grip_: 0, spread_: 0.3, headPitch: -0.05 });
  F.lieBack = (t = 0) => P({
    hipsY: 0.93, spinePitch: -0.05, headPitch: 0.35 + 0.03 * Math.sin(t * 1.3),
    arm_: -2.7, armOut_: 0.9, elbow_: 2.3, armTwist_: 0.6, grip_: 0.3,
    legL: -0.12, kneeL: 0.25, legR: -0.02, kneeR: 0.05, legOutL: -0.06, legOutR: 0.04, footL: 0.45, footR: 0.5,
  });
  F.superman = (t = 0) => P({
    hipsY: 0.93, spinePitch: -0.35, headPitch: -0.95, hipsPitch: -0.1,
    arm_: -2.95, armOut_: 0.12, elbow_: 0.05, armTwist_: 0.1, gripL: 0.95, gripR: 0.0, spreadR: 0.1,
    armL: -3.0, armOutL: 0.05,
    leg_: 0.15, knee_: 0.25 + 0.05 * Math.sin(t * 6), foot_: 0.6, legOut_: 0.04,
  });
  F.sneak = (t = 0, step = 0) => P({
    spinePitch: 0.42, headPitch: -0.35, headYaw: 0.5 * Math.sin(t * 2.2),
    arm_: -1.05, armOut_: 0.45, elbow_: 1.9, wrist_: 0.9, grip_: 0.1, spread_: 0.9, armTwist_: 0.9,
  });
  F.surf = (t = 0) => P({
    hipsY: 0.78, hipsYaw: 0.15, spinePitch: 0.15, spineTwist: -0.5, headYaw: -1.2, headPitch: -0.05,
    armOutL: 1.25, armL: -0.25, elbowL: 0.35, armOutR: 1.15, armR: 0.3, elbowR: 0.4, grip_: 0.05,
    legL: -0.5, kneeL: 0.95, footL: -0.45, legOutL: 0.42, legR: -0.5, kneeR: 0.95, footR: -0.45, legOutR: 0.42,
    hipsRoll: 0.04 * Math.sin(t * 2),
  });
  F.dab = () => P({
    spinePitch: 0.25, spineTwist: 0.35, headPitch: 0.65, headYaw: 0.55, headRoll: 0.15,
    armL: -1.55, armOutL: -0.15, elbowL: 2.25, armTwistL: 0.4, gripL: 0.7,
    armR: -0.6, armOutR: 2.1, elbowR: 0.05, armTwistR: 0, gripR: 0.1,
  });
  F.floss = (t = 0, bpm = 120) => {
    const ph = (t * bpm) / 60 * Math.PI;
    const s = Math.sin(ph);
    const c = Math.sign(Math.cos(ph / 2)) * 0.35;
    return P({
      hipsShift: 0.07 * -s, hipsRoll: 0.12 * s, spineRoll: -0.2 * s, headRoll: 0.1 * s,
      armL: c, armR: c, armOutL: 0.35 + 0.55 * s, armOutR: 0.35 - 0.55 * s, elbow_: 0.05, grip_: 0.6,
      kneeL: 0.12 + 0.08 * Math.max(0, s), kneeR: 0.12 + 0.08 * Math.max(0, -s), hipsY: 0.9,
    });
  };
  F.pump = (t = 0, bpm = 120) => {
    const b = (t * bpm) / 60;
    const ph = b * Math.PI * 2;
    const up = Math.abs(Math.sin(ph / 2));
    const side = Math.sin(ph / 2) > 0 ? 1 : -1;
    return P({
      hipsY: 0.88 - 0.05 * up, kneeL: 0.25 + 0.15 * up, kneeR: 0.25 + 0.15 * up, legL: -0.18 - 0.12 * up, legR: -0.18 - 0.12 * up, footL: -0.1, footR: -0.1,
      spinePitch: 0.1, headPitch: 0.15 * up - 0.05, headYaw: 0.25 * side, spineTwist: 0.2 * side,
      armL: -1.2 - 1.2 * (side > 0 ? up : 0.2), armOutL: 0.5, elbowL: 0.6 + 0.8 * (side > 0 ? 1 - up : 1), gripL: 0.95,
      armR: -1.2 - 1.2 * (side < 0 ? up : 0.2), armOutR: 0.5, elbowR: 0.6 + 0.8 * (side < 0 ? 1 - up : 1), gripR: 0.95,
    });
  };
  F.wave = (t = 0) => P({
    armR: -0.2, armOutR: 2.4, elbowR: 0.6 + 0.35 * Math.sin(t * 9), armTwistR: 0.2, gripR: 0, spreadR: 0.9, headYaw: 0.1,
  });
  F.shrug = () => P({ shrug_: 0.08, armOut_: 0.55, arm_: -0.35, elbow_: 1.5, forearm_: -1.2, grip_: 0, spread_: 0.9, headRoll: 0.18, headPitch: -0.05 });
  F.point = () => P({ armR: -1.55, armOutR: 0.25, elbowR: 0.05, gripR: 0.85, headPitch: -0.05, spineTwist: -0.15 });
  F.facepalm = () => P({ armR: -1.6, armOutR: -0.25, elbowR: 2.45, armTwistR: 0.2, gripR: 0.1, headPitch: 0.45, spinePitch: 0.2 });
  F.meditate = (t = 0) => P({
    hipsY: 0.12, spinePitch: -0.05, headPitch: 0.05 + 0.02 * Math.sin(t),
    leg_: -1.45, legOut_: 0.75, knee_: 2.5, foot_: 0.2, legTwist_: 0.4,
    arm_: 0.25, armOut_: 0.35, elbow_: 0.9, forearm_: -1.0, grip_: 0.35, thumb_: 0.9,
  });
  F.sitEdge = (t = 0) => P({
    hipsY: 0.02, spinePitch: 0.05, headPitch: -0.05,
    leg_: -1.5, knee_: 1.45 + 0.25 * Math.sin(t * 4), kneeR: 1.45 + 0.25 * Math.sin(t * 4 + 2), foot_: 0.2, legOut_: 0.12,
    arm_: 0.35, armOut_: 0.35, elbow_: 0.3, grip_: 0.3,
  });
  F.mix = (a, b, k) => {
    const out = {};
    for (const key of Object.keys(a)) out[key] = a[key] + ((b[key] ?? a[key]) - a[key]) * k;
    return out;
  };
})();
