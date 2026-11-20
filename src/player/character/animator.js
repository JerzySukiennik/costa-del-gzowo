// Costa del Gzowo: state-driven animation mixer (mode cross-fades, landing absorption, turn and acceleration lean, eyes, scripted overlay, hand IK).
import * as THREE from 'three';
import { SIDES } from './skeleton.js';
import { KEYS, basePose, createRigApplier, reachArm, handBasis } from './rig.js';
import { gait, gaitParams, idle, airPose, swimPose, sitPose, legIK } from './motion.js';

const MODES = ['foot', 'air', 'swim', 'sit'];
const RATE_IN = { foot: 11, air: 9, swim: 3.2, sit: 6 };
const WHEEL = { center: new THREE.Vector3(0, 0.39, 0.5), radius: 0.18, tilt: 0.36, spin: 7.5 * 0.6 };

export function createAnimator(skel, group) {
  const apply = createRigApplier(skel);
  const weights = { foot: 1, air: 0, swim: 0, sit: 0 };
  const poses = Object.fromEntries(MODES.map((m) => [m, basePose()]));
  const out = basePose();
  const offset = Object.fromEntries(KEYS.map((k) => [k, 0]));
  let scripted = null;
  let scriptedRate = 10;
  const reachTarget = { L: null, R: null };
  const reachWeight = { L: 0, R: 0 };
  const lastTarget = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  let time = 0;
  let phase = 0;
  let swimPhase = 0;
  let airTime = 0;
  let prevMode = 'foot';
  let prevVy = 0;
  let land = 0;
  let landT = 9;
  let prevSpeed = 0;
  let accel = 0;
  let prevYaw = null;
  let turn = 0;
  let shift = 0;
  let shiftTarget = 0;
  let shiftTimer = 3;
  let blinkT = 2;
  let blink = 0;
  let saccade = { yaw: 0, pitch: 0, t: 1 };
  let lookYaw = 0;
  const handTarget = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  const handQuat = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();

  function compute(st, dt) {
    time += dt;
    const mode = MODES.includes(st.mode) ? st.mode : 'foot';
    const speed = st.speed || 0;
    const vy = st.vy || 0;
    const wade = st.wade || 0;
    if (dt > 0) accel += ((speed - prevSpeed) / dt - accel) * Math.min(1, dt * 5);
    prevSpeed = speed;
    const yaw = group.rotation.y;
    if (prevYaw !== null && dt > 0) {
      const dy = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw)) / dt;
      turn += ((st.turn ?? dy) - turn) * Math.min(1, dt * 6);
    }
    prevYaw = yaw;
    if (mode === 'air') airTime += dt;
    if (prevMode === 'air' && mode === 'foot') {
      land = Math.min(1, Math.max(0, (-prevVy - 2) / 9));
      landT = 0;
    }
    if (mode !== 'air') airTime = 0;
    prevMode = mode;
    prevVy = vy;
    landT += dt;

    const g = gaitParams(speed, wade);
    phase = (phase + g.freq * dt * Math.min(1, speed / 0.35)) % 1;
    shiftTimer -= dt;
    if (shiftTimer <= 0) {
      shiftTimer = 3.5 + Math.random() * 5;
      shiftTarget = Math.random() < 0.5 ? -1 + Math.random() * 0.4 : 0.6 + Math.random() * 0.4;
    }
    shift += (shiftTarget - shift) * Math.min(1, dt * 0.9);

    const foot = poses.foot;
    Object.assign(foot, basePose());
    const idleP = basePose();
    idle(idleP, time, shift);
    const moveP = basePose();
    gait(moveP, { speed: Math.max(speed, 0.0001), wade, phase }, g);
    const mw = THREE.MathUtils.smoothstep(speed, 0.08, 0.7);
    for (const k of KEYS) foot[k] = idleP[k] + (moveP[k] - idleP[k]) * mw;
    if (landT < 0.9) {
      const e = landT < 0.07 ? landT / 0.07 : Math.exp(-(landT - 0.07) * 6.5);
      const dip = land * e;
      foot.hipsY -= dip * 0.2;
      foot.hipsPitch += dip * 0.18;
      foot.spinePitch += dip * 0.3;
      foot.headPitch -= dip * 0.15;
      for (const [t] of SIDES) {
        foot['arm' + t] -= dip * 0.5;
        foot['armOut' + t] += dip * 0.3;
        foot['elbow' + t] += dip * 0.4;
      }
      if (mw < 0.5) {
        for (const [t, s] of SIDES) legIK(foot, t, s, [s * 0.112, 0.061, 0.01], 0);
      }
    }
    const lateral = turn * speed;
    foot.leanRoll = -Math.atan(lateral / 9.81) * 0.75;
    foot.hipsPitch += THREE.MathUtils.clamp(accel * 0.025, -0.12, 0.14) * mw;
    foot.spinePitch += THREE.MathUtils.clamp(accel * 0.02, -0.08, 0.1) * mw;
    foot.headYaw += THREE.MathUtils.clamp(turn * 0.18, -0.4, 0.4);

    if (weights.air > 0.001 || mode === 'air') {
      Object.assign(poses.air, basePose());
      airPose(poses.air, { vy }, time, airTime);
    }
    if (weights.swim > 0.001 || mode === 'swim') {
      swimPhase = (swimPhase + dt * (0.42 + speed * 0.16)) % 2;
      Object.assign(poses.swim, basePose());
      swimPose(poses.swim, { speed }, time, swimPhase);
    }
    if (weights.sit > 0.001 || mode === 'sit') {
      Object.assign(poses.sit, basePose());
      sitPose(poses.sit, st, time);
    }

    const rate = RATE_IN[mode];
    let sum = 0;
    for (const m of MODES) {
      weights[m] += ((m === mode ? 1 : 0) - weights[m]) * Math.min(1, dt * rate);
      sum += weights[m];
    }
    for (const k of KEYS) {
      let v = 0;
      for (const m of MODES) if (weights[m] > 1e-4) v += poses[m][k] * weights[m];
      out[k] = v / sum;
    }

    lookYaw += (out.headYaw - lookYaw) * Math.min(1, dt * 8);
    saccade.t -= dt;
    if (saccade.t <= 0) {
      saccade = { yaw: (Math.random() - 0.5) * 0.25, pitch: (Math.random() - 0.5) * 0.12, t: 0.6 + Math.random() * 2.2 };
    }
    out.eyeYaw += saccade.yaw + (out.headYaw - lookYaw) * 1.5;
    out.eyePitch += saccade.pitch;
    blinkT -= dt;
    if (blinkT <= 0) {
      blinkT = 2 + Math.random() * 4;
      blink = 1;
    }
    blink = Math.max(0, blink - dt * 7);
    out.blink = Math.max(out.blink, Math.sin(Math.min(1, blink) * Math.PI));

    const kS = 1 - Math.exp(-scriptedRate * dt);
    for (const k of KEYS) {
      const want = scripted && scripted[k] !== undefined ? scripted[k] - out[k] : 0;
      offset[k] += (want - offset[k]) * (dt > 0 ? kS : 1);
      out[k] += offset[k];
    }
    if (!scripted) {
      let idleOffset = true;
      for (const k of KEYS) if (Math.abs(offset[k]) > 1e-5) idleOffset = false;
      if (idleOffset) scriptedRate = 10;
    }
    return mode;
  }

  function sitHands(st) {
    if (st.hands && st.hands.L && st.hands.R) {
      handTarget.L.copy(st.hands.L);
      handTarget.R.copy(st.hands.R);
      for (const [t] of SIDES) {
        tmp.copy(handTarget.L).add(handTarget.R).multiplyScalar(0.5);
        const radial = tmp2.copy(handTarget[t]).sub(tmp).normalize();
        const fwd = new THREE.Vector3(0, 0, 1).transformDirection(group.matrixWorld);
        const palmN = fwd.clone().multiplyScalar(0.75).addScaledVector(radial, -0.65).normalize();
        const up = new THREE.Vector3(0, 1, 0).transformDirection(group.matrixWorld);
        handBasis(t, palmN, up, handQuat[t]);
      }
      return true;
    }
    const steerAngle = (st.steer || 0) * WHEEL.spin;
    const wq = tmpQ.setFromEuler(new THREE.Euler(-WHEEL.tilt, 0, 0));
    for (const [t, s] of SIDES) {
      const a = (s > 0 ? Math.PI * 0.2 : Math.PI * 0.8) + THREE.MathUtils.clamp(steerAngle, -1.0, 1.0);
      const local = new THREE.Vector3(Math.cos(a) * WHEEL.radius, Math.sin(a) * WHEEL.radius, 0).applyQuaternion(wq).add(WHEEL.center);
      handTarget[t].copy(local).applyMatrix4(group.matrixWorld);
      const radialL = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).applyQuaternion(wq);
      const normalL = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
      const tangentL = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).applyQuaternion(wq).multiplyScalar(s);
      const palmN = normalL.clone().multiplyScalar(0.8).addScaledVector(radialL, -0.6).normalize().transformDirection(group.matrixWorld);
      const thumb = tangentL.clone().multiplyScalar(-1).transformDirection(group.matrixWorld);
      handBasis(t, palmN, thumb, handQuat[t]);
      handTarget[t].addScaledVector(palmN, -0.012);
    }
    return true;
  }

  return {
    weights,
    pose: out,
    get phase() {
      return phase;
    },
    set phase(v) {
      phase = v;
    },
    setScripted(p, rate = 10) {
      scripted = p;
      scriptedRate = rate;
    },
    reach(side, point) {
      reachTarget[side] = point ? point.clone() : null;
      if (point) lastTarget[side].copy(point);
    },
    update(dt, st) {
      const mode = compute(st, dt);
      apply(out);
      group.updateMatrixWorld(true);
      const sitW = weights.sit;
      let wheel = false;
      if (sitW > 0.02 && !scripted) wheel = sitHands(st);
      for (const [t] of SIDES) {
        const explicit = reachTarget[t];
        const want = explicit ? 1 : wheel ? sitW : 0;
        reachWeight[t] += (want - reachWeight[t]) * Math.min(1, dt * 7);
        if (dt === 0) reachWeight[t] = want;
        if (reachWeight[t] < 0.002) continue;
        const target = explicit || (wheel ? handTarget[t] : lastTarget[t]);
        reachArm(skel, t, target, reachWeight[t], !explicit && wheel ? { orient: handQuat[t], palm: new THREE.Vector3(t === 'L' ? -0.03 : 0.03, -0.085, 0.0) } : {});
      }
      return mode;
    },
    snap(st) {
      const mode = MODES.includes(st.mode) ? st.mode : 'foot';
      for (const m of MODES) weights[m] = m === mode ? 1 : 0;
      for (const k of KEYS) offset[k] = 0;
      prevMode = mode;
      landT = 9;
      compute(st, 0);
      apply(out);
      group.updateMatrixWorld(true);
      if (mode === 'sit') {
        sitHands(st);
        for (const [t] of SIDES) {
          reachWeight[t] = 1;
          reachArm(skel, t, handTarget[t], 1, { orient: handQuat[t], palm: new THREE.Vector3(t === 'L' ? -0.03 : 0.03, -0.085, 0.0) });
        }
      }
    },
  };
}
