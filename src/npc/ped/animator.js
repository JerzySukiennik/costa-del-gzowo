// Costa del Gzowo: pedestrian animation (stride-matched gait with personal style, idle weight shifts, sitting, carried things, gestures, gaze, falls and getting up) without per-frame allocations.
import { LIMB, SIDES } from './bones.js';
import { K, ARM_KEYS, resetPose, newPose, mixPose, legIK } from './rig.js';

export const ACT = { NONE: 0, PHONE: 1, TALK: 2, LISTEN: 3, SHIELD: 4, SCAN: 5, WINDOW: 6, FLINCH: 7, WAVE: 8 };

const TAU = Math.PI * 2;
const HIP = LIMB.hip;
const LEG = LIMB.thigh + LIMB.shin;
const ANKLE = LIMB.ankle;
const HEEL_X = -0.055;
const BALL_X = 0.138;
const MID = 0.025;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const pIdle = newPose();
const pMove = newPose();
const pAux = newPose();
const footL = { x: 0, y: 0, z: 0, pitch: 0, stance: 0, k: 1, toe: 0 };
const footR = { x: 0, y: 0, z: 0, pitch: 0, stance: 0, k: 1, toe: 0 };
const gp = { run: 0, sprint: 0, freq: 1, duty: 0.6 };

function gaitParams(v, cadence) {
  gp.run = sstep(1.9, 2.9, v);
  gp.sprint = sstep(4.2, 6.0, v);
  gp.freq = lerp(0.62 + 0.21 * v, 1.24 + 0.075 * v, gp.run) * cadence;
  gp.duty = lerp(0.62 - 0.03 * Math.min(v, 2), lerp(0.4, 0.31, gp.sprint), gp.run);
  return gp;
}

function footAt(f, s, u, stride, moving, lift, width) {
  const run = gp.run;
  const sprint = gp.sprint;
  const duty = gp.duty;
  const S = stride * duty;
  const strike = lerp(-0.32, -0.12, run) * moving;
  const push = lerp(0.62, 0.95, run) * moving;
  let ballZ;
  let pitch;
  let y = 0;
  if (u < duty) {
    const k = u / duty;
    f.k = k;
    f.stance = 1;
    ballZ = S * 0.5 - k * S + MID;
    const flat = lerp(0.55, 0.35, run);
    if (k < 0.18) pitch = run > 0.5 ? strike * (1 - sstep(0, 0.12, k)) * (1 - sprint * 0.8) : strike * (1 - sstep(0, 0.18, k));
    else if (k < flat) pitch = 0;
    else pitch = push * sstep(flat, 1, k) ** 1.4;
  } else {
    const k = (u - duty) / (1 - duty);
    f.k = 1;
    f.stance = 0;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
    ballZ = lerp(-S * 0.5 + MID, S * 0.5 + MID, e) - Math.sin(Math.PI * k) * run * stride * 0.12 * (1 - k);
    const kick = run * Math.sin(Math.PI * Math.min(1, k * 1.6)) * 0.55;
    pitch = lerp(push, strike, sstep(0.1, 0.9, k)) + kick * (1 - k) * 0.4;
    y = lift * Math.sin(Math.PI * Math.pow(k, lerp(0.8, 0.62, run)));
    if (run > 0) y += run * (0.12 + stride * 0.05) * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k * 0.6);
  }
  const heel = pitch < 0;
  const px = heel ? ballZ + HEEL_X - BALL_X : ballZ;
  const rz = heel ? -HEEL_X : -BALL_X;
  const c = Math.cos(pitch);
  const sn = Math.sin(pitch);
  f.z = px + rz * c + ANKLE * sn;
  f.y = ANKLE * c - rz * sn + y;
  f.x = s * width;
  f.pitch = pitch;
  f.toe = f.stance ? -Math.max(0, pitch) : -Math.max(0, pitch) * 0.6;
}

function gait(p, v, ph, style) {
  const { run, sprint, freq, duty } = gp;
  const moving = sstep(0.05, 0.45, v);
  const stride = v / Math.max(freq, 0.3);
  const lift = lerp(0.07, lerp(0.2, 0.32, sprint), run) * moving;
  const width = lerp(0.105, 0.075, run) + style.wide;
  footAt(footL, 1, ph % 1, stride, moving, lift, width);
  footAt(footR, -1, (ph + 0.5) % 1, stride, moving, lift, width);
  let hipTop = HIP;
  for (let i = 0; i < 2; i++) {
    const f = i ? footR : footL;
    if (!f.stance || f.k >= 0.62) continue;
    const dy2 = (LEG * 0.99) ** 2 - f.z * f.z - (Math.abs(f.x) - LIMB.hipHalf) ** 2;
    if (dy2 > 0) hipTop = Math.min(hipTop, f.y + Math.sqrt(dy2));
  }
  const bounce = Math.cos(TAU * 2 * (ph - duty * 0.5));
  const runHip = HIP - 0.035 - sprint * 0.03 - bounce * lerp(0.02, 0.035, sprint);
  const walkHip = Math.min(hipTop, HIP - 0.012) - 0.01 * moving;
  p.hipsY = lerp(walkHip, runHip, run);
  const lf = footL.z - footR.z;
  p.hipsYaw = -lf * lerp(0.17, 0.1, run) * moving;
  const uL = ph % 1;
  const uR = (ph + 0.5) % 1;
  const swingL = footL.stance ? 0 : Math.sin(Math.PI * ((uL - duty) / (1 - duty)));
  const swingR = footR.stance ? 0 : Math.sin(Math.PI * ((uR - duty) / (1 - duty)));
  p.hipsRoll = (-swingL + swingR) * lerp(0.045, 0.03, run) * moving * (0.6 + 0.8 * style.sway);
  p.hipsShift = Math.cos(TAU * (ph - duty * 0.5)) * lerp(0.016, 0.006, run) * moving * (0.7 + 0.6 * style.sway);
  p.hipsPitch = lerp(0.07, 0.11 + sprint * 0.08, run) * moving;
  p.spinePitch = lerp(0.02, 0.06 + sprint * 0.08, run) * moving + style.slouch * 1.4;
  p.spineTwist = -p.hipsYaw * 1.6;
  p.spineRoll = -p.hipsRoll * 0.5;
  p.headYaw = -(p.hipsYaw + p.spineTwist) * 0.9;
  p.headPitch = -(p.hipsPitch + p.spinePitch) * 0.75 + bounce * run * 0.02 - style.chin;
  legIK(p, 'L', 1, footL.x, footL.y, footL.z, footL.pitch);
  legIK(p, 'R', -1, footR.x, footR.y, footR.z, footR.pitch);
  p.toeL = footL.toe;
  p.toeR = footR.toe;
  const amp = lerp(0.44, lerp(0.62, 0.95, sprint), run) * moving * style.swing;
  for (let i = 0; i < 2; i++) {
    const k = i ? K.R : K.L;
    const own = i ? footR : footL;
    const other = i ? footL : footR;
    const swing = clamp((other.z - own.z) / Math.max(0.25, stride * 0.5), -1, 1);
    const lag = -Math.cos(TAU * ((ph + (i ? 0.5 : 0) + 0.07) % 1));
    p[k.arm] = -swing * amp + run * 0.1;
    p[k.elbow] = lerp(0.22 + 0.25 * Math.max(0, -lag) * moving, 1.35 + sprint * 0.15 + 0.3 * Math.max(0, -lag), run);
    p[k.armOut] = lerp(0.16, 0.12, run) + style.wide * 2;
    p[k.armTwist] = lerp(0.15, 0.45, run);
    p[k.forearm] = lerp(0, 0.35, run);
    p[k.wrist] = lerp(0.05, -0.1, run);
  }
}

function idle(p, t, shift, style) {
  const breathe = Math.sin(t * 1.55);
  p.hipsShift = 0.024 * shift;
  p.hipsRoll = 0.03 * shift;
  p.hipsYaw = 0.04 * Math.sin(t * 0.23);
  p.hipsY = HIP - 0.012 - 0.008 * Math.abs(shift);
  p.spinePitch = -0.012 * breathe + style.slouch;
  p.spineRoll = -0.02 * shift;
  p.spineTwist = -0.05 * Math.sin(t * 0.23);
  p.headPitch = -style.chin - style.slouch * 0.6;
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1;
    const k = i ? K.R : K.L;
    legIK(p, i ? 'R' : 'L', s, s * (0.112 + style.wide), ANKLE, 0.03 - (s > 0 ? 0.035 : -0.02) * 0.5, 0);
    p[k.shrug] = 0.018 * breathe;
    p[k.arm] = 0.03 + 0.02 * Math.sin(t * 0.7 + s);
    p[k.armOut] = 0.15 + 0.012 * breathe + style.wide * 2;
    p[k.elbow] = 0.2 + 0.03 * Math.sin(t * 0.5 + s);
    p[k.armTwist] = 0.25;
    p[k.legTwist] = s * 0.12;
  }
}

function sit(p, t, height, style) {
  p.hipsY = height + 0.085;
  p.hipsPitch = -0.16;
  p.spinePitch = 0.12 + style.slouch + Math.sin(t * 1.4) * 0.008;
  p.headPitch = 0.02 - style.chin;
  p.hipsYaw = 0;
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1;
    const k = i ? K.R : K.L;
    const drop = clamp((p.hipsY - ANKLE - LIMB.shin * 0.99) / LIMB.thigh, -0.2, 0.9);
    const thigh = Math.PI / 2 - Math.asin(drop) + (i ? 0.02 : -0.03);
    p[k.leg] = -thigh + 0.16;
    p[k.knee] = thigh - 0.02 + (i ? 0.06 : 0);
    p[k.foot] = -(p.hipsPitch + p[k.leg] + p[k.knee]) + 0.02;
    p[k.legOut] = 0.1 + style.wide * 2;
    p[k.arm] = -0.5 + Math.sin(t * 0.4 + s) * 0.015;
    p[k.armOut] = 0.1;
    p[k.elbow] = 0.95;
    p[k.armTwist] = 0.45;
    p[k.forearm] = 0.5;
    p[k.shrug] = 0.012 * Math.sin(t * 1.4);
  }
}

function sprawl(p, t, flail, face) {
  p.hipsY = HIP;
  p.spineTwist = 0.18;
  p.spinePitch = face > 0 ? -0.12 : 0.1;
  p.headPitch = face > 0 ? -0.35 : 0.12;
  p.headYaw = 0.5;
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1;
    const k = i ? K.R : K.L;
    const a = Math.sin(t * 13 + s * 1.7);
    const b = Math.cos(t * 11 + s);
    p[k.leg] = lerp(i ? 0.12 : -0.3, a * 0.6, flail);
    p[k.knee] = lerp(i ? 0.25 : 0.6, 0.75 + b * 0.4, flail);
    p[k.legOut] = lerp(i ? 0.16 : 0.24, 0.3, flail);
    p[k.foot] = 0.5;
    p[k.arm] = lerp(face > 0 ? (i ? -2.2 : -1.3) : (i ? -0.5 : 0.35), -1.25 + a * 0.8, flail);
    p[k.armOut] = lerp(i ? 0.9 : 1.15, 1.0 + b * 0.3, flail);
    p[k.elbow] = lerp(i ? 0.7 : 1.0, 0.6 + Math.max(0, a) * 0.5, flail);
    p[k.armTwist] = 0.3;
  }
}

function crouch(p) {
  p.hipsY = 0.5;
  p.hipsFwd = -0.06;
  p.hipsPitch = 0.72;
  p.spinePitch = 0.42;
  p.headPitch = -0.7;
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1;
    const k = i ? K.R : K.L;
    legIK(p, i ? 'R' : 'L', s, s * 0.15, ANKLE, i ? -0.06 : 0.1, 0);
    p[k.arm] = -0.95;
    p[k.armOut] = 0.28;
    p[k.elbow] = 0.55;
    p[k.armTwist] = 0.4;
  }
}

function blendArm(out, side, w, arm, armOut, elbow, armTwist, forearm, wrist) {
  if (w <= 0.001) return;
  const k = K[side];
  out[k.arm] += (arm - out[k.arm]) * w;
  out[k.armOut] += (armOut - out[k.armOut]) * w;
  out[k.elbow] += (elbow - out[k.elbow]) * w;
  out[k.armTwist] += (armTwist - out[k.armTwist]) * w;
  out[k.forearm] += (forearm - out[k.forearm]) * w;
  out[k.wrist] += (wrist - out[k.wrist]) * w;
  out[k.wristSide] += (0 - out[k.wristSide]) * w;
  out[k.shrug] *= 1 - w;
}

export function createPedAnimator(rig, person, random) {
  const m = person.manner || {};
  const style = { swing: m.swing ?? 1, sway: m.sway ?? 0.6, slouch: m.slouch ?? 0, chin: m.chin ?? 0, wide: m.wide ?? 0, cadence: 0.95 + random() * 0.1 };
  const pose = newPose();
  const carry = person.carry || null;
  const bag = person.bag || null;
  const strapSide = bag && bag.kind === 'tote' ? bag.side : null;
  const free = carry ? (carry.hand === 'L' ? 'R' : 'L') : strapSide === 'R' ? 'L' : 'R';
  const gestureSide = strapSide === free ? null : free;
  let time = random() * 100;
  let phase = random();
  let moveW = 0;
  let sitW = 0;
  let downW = 0;
  let shift = random() < 0.5 ? -0.8 : 0.8;
  let shiftTarget = shift;
  let shiftTimer = 2 + random() * 5;
  let lookYaw = 0;
  let lookPitch = 0;
  let eyeYaw = 0;
  let glanceT = 1 + random() * 3;
  let glance = 0;
  let turn = 0;
  let lean = 0;
  let prevSpeed = 0;
  let accel = 0;
  let gesture = 0;
  let gestureTarget = 0;
  let gestureT = 0;
  let nod = 0;
  const actW = new Float32Array(9);
  const self = {
    pose,
    style,
    step: 0,
    get phase() {
      return phase;
    },
    update(dt, st) {
      time += dt;
      const speed = st.speed;
      if (dt > 0) accel += ((speed - prevSpeed) / dt - accel) * Math.min(1, dt * 5);
      prevSpeed = speed;
      turn += ((st.turn || 0) - turn) * Math.min(1, dt * 6);
      gaitParams(speed, style.cadence);
      const before = phase;
      phase = (phase + gp.freq * dt * Math.min(1, speed / 0.35)) % 1;
      self.step = speed > 0.5 && ((before < 0.5 && phase >= 0.5) || phase < before) ? 1 : 0;
      shiftTimer -= dt;
      if (shiftTimer <= 0) {
        shiftTimer = 3.5 + random() * 6;
        shiftTarget = random() < 0.5 ? -1 + random() * 0.4 : 0.6 + random() * 0.4;
      }
      shift += (shiftTarget - shift) * Math.min(1, dt * 0.9);
      const wantSit = st.mode === 'sit' ? 1 : 0;
      const wantDown = st.mode === 'down' ? 1 - sstep(0.55, 1, st.rise || 0) : 0;
      sitW += (wantSit - sitW) * Math.min(1, dt * 3.2);
      downW += (wantDown - downW) * Math.min(1, dt * (wantDown > downW ? 14 : 6));
      moveW = sstep(0.08, 0.7, speed);

      resetPose(pose);
      resetPose(pIdle);
      idle(pIdle, time, shift, style);
      if (moveW > 0.001) {
        resetPose(pMove);
        gait(pMove, Math.max(speed, 0.0001), phase, style);
        mixPose(pIdle, pMove, moveW);
      }
      mixPose(pose, pIdle, 1);
      const steer = clamp(turn, -3.2, 3.2);
      lean += (-(0.05 + 0.15 * gp.run) * Math.tanh((steer * speed) / 9) * moveW - lean) * Math.min(1, dt * 8);
      pose.leanRoll = lean;
      pose.hipsPitch += clamp(accel * 0.025, -0.1, 0.12) * moveW;
      pose.spinePitch += clamp(accel * 0.02, -0.07, 0.09) * moveW;
      pose.spineTwist += clamp(steer * 0.04, -0.12, 0.12) * moveW;

      if (sitW > 0.002) {
        resetPose(pAux);
        sit(pAux, time, st.seat || 0.5, style);
        mixPose(pose, pAux, sstep(0, 1, sitW));
      }
      if (downW > 0.002) {
        resetPose(pAux);
        sprawl(pAux, time, st.flail || 0, st.face || 0);
        const r = st.rise || 0;
        if (r > 0) {
          resetPose(pMove);
          crouch(pMove);
          mixPose(pAux, pMove, sstep(0.05, 0.5, r));
        }
        mixPose(pose, pAux, downW);
      }

      const act = st.act || 0;
      for (let i = 1; i < actW.length; i++) actW[i] += ((act === i ? 1 : 0) - actW[i]) * Math.min(1, dt * (i === ACT.FLINCH ? 12 : 4.5));
      const calm = (1 - downW) * (1 - gp.run * moveW);
      if (carry) {
        const w = calm;
        if (carry.what === 'cup') blendArm(pose, carry.hand, w * (1 - actW[ACT.SHIELD]), -0.22 + Math.sin(time * 0.6) * 0.02, 0.1, 1.42, 0.1, 0.05, 0.0);
        else if (carry.what === 'handbag') {
          const k = K[carry.hand];
          const h = w * (1 - sitW);
          pose[k.arm] *= 1 - 0.6 * h;
          pose[k.elbow] += (0.3 - pose[k.elbow]) * h * 0.7;
        }
      }
      if (strapSide) blendArm(pose, strapSide, calm, -0.2, 0.1, 2.38, 0.42, 0.5, 0.1);

      if (actW[ACT.PHONE] > 0.002) {
        const side = carry && carry.what === 'phone' ? carry.hand : gestureSide || free;
        const w = actW[ACT.PHONE] * (1 - downW);
        blendArm(pose, side, w, -0.5 + Math.sin(time * 0.9) * 0.015, 0.1, 1.95, -0.5, 0.5, 0.1);
        pose.headPitch += 0.46 * w;
        pose.spinePitch += 0.05 * w;
        pose.eyePitch += 0.25 * w;
      }
      if (actW[ACT.TALK] > 0.002 || actW[ACT.LISTEN] > 0.002) {
        gestureT -= dt;
        if (gestureT <= 0) {
          gestureT = 0.5 + random() * 1.6;
          gestureTarget = act === ACT.TALK && random() < 0.7 ? 0.35 + random() * 0.65 : 0;
        }
        gesture += (gestureTarget - gesture) * Math.min(1, dt * 5);
        nod += ((act === ACT.LISTEN ? 1 : 0.4) - nod) * Math.min(1, dt * 2);
        const w = Math.max(actW[ACT.TALK], actW[ACT.LISTEN]) * (1 - downW);
        if (gestureSide) blendArm(pose, gestureSide, w * gesture, -0.5 + Math.sin(time * 5.1) * 0.1, 0.22, 1.5 + Math.sin(time * 4.3) * 0.22, 0.2, 0.9 + Math.sin(time * 3.7) * 0.5, Math.sin(time * 6.1) * 0.25);
        pose.headPitch += Math.sin(time * 2.6) * 0.045 * nod * w;
        pose.headRoll += Math.sin(time * 0.9) * 0.05 * w;
        pose.spinePitch += 0.03 * gesture * w;
      } else gesture *= 1 - Math.min(1, dt * 5);
      if (actW[ACT.SHIELD] > 0.002) {
        const side = carry && carry.what !== 'handbag' ? free : gestureSide || 'R';
        const w = actW[ACT.SHIELD] * (1 - downW);
        blendArm(pose, side, w, -2.05, 0.4, 2.1, -0.75, -0.3, 0.1);
        pose.spinePitch -= 0.08 * w;
      }
      if (actW[ACT.WINDOW] > 0.002) {
        const w = actW[ACT.WINDOW];
        pose.spinePitch += 0.1 * w;
        pose.headPitch += 0.08 * w;
        pose.headYaw += Math.sin(time * 0.45) * 0.3 * w;
      }
      if (actW[ACT.SCAN] > 0.002) pose.headYaw += Math.sin(time * 1.25) * 0.95 * actW[ACT.SCAN];
      if (actW[ACT.FLINCH] > 0.002) {
        const w = actW[ACT.FLINCH];
        for (const [t] of SIDES) blendArm(pose, t, w * 0.85, -0.9, 0.75, 1.5, 0.3, 0.4, 0);
        pose.spinePitch -= 0.14 * w;
        pose.hipsY -= 0.03 * w;
      }
      if (actW[ACT.WAVE] > 0.002) blendArm(pose, free, actW[ACT.WAVE], -2.6, 0.5, 0.9 + Math.sin(time * 9) * 0.35, 0.6, 0, 0);

      glanceT -= dt;
      if (glanceT <= 0) {
        glanceT = 1.5 + random() * 4;
        glance = (random() - 0.5) * 0.7 * (1 - sitW * 0.3);
      }
      const wantYaw = st.look ? clamp(st.lookYaw, -1.25, 1.25) : glance * (1 - actW[ACT.PHONE]);
      const wantPitch = st.look ? clamp(st.lookPitch, -0.9, 0.5) : 0;
      const rate = Math.min(1, dt * (st.look ? 5.5 : 2.2));
      lookYaw += (wantYaw - lookYaw) * rate;
      lookPitch += (wantPitch - lookPitch) * rate;
      eyeYaw += (clamp(wantYaw - lookYaw, -0.5, 0.5) - eyeYaw) * Math.min(1, dt * 14);
      const gaze = 1 - downW;
      pose.headYaw += lookYaw * 0.78 * gaze;
      pose.spineTwist += lookYaw * 0.22 * gaze * (1 - moveW * 0.5);
      pose.headPitch += lookPitch * 0.85 * gaze;
      pose.eyeYaw += eyeYaw + lookYaw * 0.15;
      pose.eyePitch += lookPitch * 0.15;
      rig.apply(pose);
    },
    snap(st) {
      sitW = st.mode === 'sit' ? 1 : 0;
      downW = 0;
      lookYaw = 0;
      lookPitch = 0;
      lean = 0;
      accel = 0;
      prevSpeed = st.speed;
      actW.fill(0);
      if (st.act) actW[st.act] = 1;
      self.update(0, st);
    },
  };
  return self;
}
