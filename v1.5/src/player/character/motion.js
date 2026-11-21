// Costa del Gzowo: procedural motion generators (idle, walk-to-sprint gait with foot roll and leg IK, jump, fall, wade, crawl, treading, driving).
import * as THREE from 'three';
import { DIM, SIDES } from './skeleton.js';

const TAU = Math.PI * 2;
const LEG = DIM.thigh + DIM.shin;
const ANKLE = 0.061;
const HEEL = [-0.055, -ANKLE];
const BALL = [0.138, -ANKLE];
const MID = 0.025;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const euler = new THREE.Euler();
const qPelvis = new THREE.Quaternion();
const vHip = new THREE.Vector3();
const vD = new THREE.Vector3();

export function legIK(p, t, s, ankle, pitch) {
  euler.set(p.hipsPitch, p.hipsYaw, p.hipsRoll, 'XYZ');
  qPelvis.setFromEuler(euler);
  vHip.set(s * DIM.hipHalf, 0, 0).applyQuaternion(qPelvis).add(vD.set(p.hipsShift, p.hipsY, p.hipsFwd));
  vD.set(ankle[0], ankle[1], ankle[2]).sub(vHip).applyQuaternion(qPelvis.invert());
  const d = clamp(vD.length(), 0.25, LEG - 0.004);
  const a = DIM.thigh;
  const b = DIM.shin;
  const knee = Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const len = vD.length();
  const out = Math.asin(clamp(vD.x / len, -0.9, 0.9));
  const psi = Math.atan2(-vD.z, -vD.y);
  p['legOut' + t] = out * s;
  p['leg' + t] = psi - alpha;
  p['knee' + t] = knee;
  p['foot' + t] = pitch - (p.hipsPitch + p['leg' + t] + knee);
}

export function rollAnkle(ballZ, pitch) {
  const pivot = pitch < 0 ? HEEL : BALL;
  const px = pitch < 0 ? ballZ + HEEL[0] - BALL[0] : ballZ;
  const rz = -pivot[0];
  const ry = -pivot[1];
  const c = Math.cos(pitch);
  const sn = Math.sin(pitch);
  return [px + rz * c + ry * sn, ry * c - rz * sn];
}

export function gaitParams(v, wade) {
  const run = sstep(1.9, 2.9, v);
  const sprint = sstep(4.2, 6.0, v);
  const freq = lerp(0.62 + 0.21 * v, 1.24 + 0.075 * v, run) * (1 - wade * 0.25);
  const duty = lerp(0.62 - 0.03 * Math.min(v, 2), lerp(0.4, 0.31, sprint), run);
  return { run, sprint, freq, duty };
}

export function gait(p, st, g) {
  const v = st.speed;
  const wade = st.wade;
  const { run, sprint, freq, duty } = g;
  const moving = sstep(0.05, 0.45, v);
  const stride = v / Math.max(freq, 0.3);
  const lift = lerp(0.07, lerp(0.2, 0.32, sprint), run) * moving + wade * 0.2 * moving;
  const ph = st.phase;
  const feet = {};
  const stanceH = [];
  for (const [t, s, off] of [['L', 1, 0], ['R', -1, 0.5]]) {
    const u = (ph + off) % 1;
    const width = lerp(0.105, 0.075, run) + wade * 0.04;
    let ballZ;
    let pitch;
    let y = 0;
    let stance = 0;
    let kk = 1;
    const S = stride * duty;
    if (u < duty) {
      const k = u / duty;
      kk = k;
      ballZ = S * 0.5 - k * S + MID;
      const strike = lerp(-0.32, -0.12, run) * moving;
      const off2 = lerp(0.62, 0.95, run) * moving;
      if (k < 0.18) pitch = strike * (1 - sstep(0, 0.18, k));
      else if (k < lerp(0.55, 0.35, run)) pitch = 0;
      else pitch = off2 * sstep(lerp(0.55, 0.35, run), 1, k) ** 1.4;
      if (run > 0.5 && k < 0.18) pitch = strike * (1 - sstep(0, 0.12, k)) * (1 - sprint * 0.8);
      stance = 1;
    } else {
      const k = (u - duty) / (1 - duty);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      const back = -S * 0.5 + MID;
      const front = S * 0.5 + MID;
      ballZ = lerp(back, front, e) - Math.sin(Math.PI * k) * run * stride * 0.12 * (1 - k);
      const kick = run * Math.sin(Math.PI * Math.min(1, k * 1.6)) * 0.55;
      pitch = lerp(lerp(0.62, 0.95, run) * moving, lerp(-0.32, -0.12, run) * moving, sstep(0.1, 0.9, k)) + kick * (1 - k) * 0.4;
      y = lift * Math.sin(Math.PI * Math.pow(k, lerp(0.8, 0.62, run))) * (1 + wade * 0.6 * Math.sin(Math.PI * k));
      if (run > 0) y += run * (0.12 + stride * 0.05) * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k * 0.6);
    }
    const [az, ay] = rollAnkle(ballZ, pitch);
    feet[t] = { z: az, y: ay + y, x: s * width, pitch, stance, k: kk, u, toe: stance ? -Math.max(0, pitch) : -Math.max(0, pitch) * 0.6 };
    if (stance && kk < 0.62) stanceH.push(feet[t]);
  }
  let hipTop = DIM.hip;
  for (const f of stanceH) {
    const dz = f.z;
    const dy2 = (LEG * 0.99) ** 2 - dz * dz - (Math.abs(f.x) - DIM.hipHalf) ** 2;
    if (dy2 > 0) hipTop = Math.min(hipTop, f.y + Math.sqrt(dy2));
  }
  const bounce = Math.cos(TAU * 2 * (ph - duty * 0.5));
  const runHip = DIM.hip - 0.035 - sprint * 0.03 - bounce * lerp(0.02, 0.035, sprint);
  const walkHip = Math.min(hipTop, DIM.hip - 0.012) - 0.01 * moving;
  p.hipsY = lerp(walkHip, runHip, run) - wade * 0.05 * moving;
  const lf = feet.L.z - feet.R.z;
  p.hipsYaw = -lf * lerp(0.17, 0.1, run) * moving;
  const swingL = feet.L.stance ? 0 : Math.sin(Math.PI * (((ph % 1) - duty) / (1 - duty)));
  const swingR = feet.R.stance ? 0 : Math.sin(Math.PI * ((((ph + 0.5) % 1) - duty) / (1 - duty)));
  p.hipsRoll = (-swingL + swingR) * lerp(0.045, 0.03, run) * moving;
  p.hipsShift = (feet.L.stance - feet.R.stance) * lerp(0.016, 0.006, run) * moving;
  p.hipsPitch = lerp(0.07, 0.11 + sprint * 0.08, run) * moving + wade * 0.08 * moving;
  p.spinePitch = lerp(0.02, 0.06 + sprint * 0.08, run) * moving;
  p.spineTwist = -p.hipsYaw * 1.6;
  p.spineRoll = -p.hipsRoll * 0.5;
  p.headYaw = -(p.hipsYaw + p.spineTwist) * 0.9;
  p.headPitch = -(p.hipsPitch + p.spinePitch) * 0.75 + bounce * run * 0.02;
  for (const [t, s] of SIDES) {
    const f = feet[t];
    legIK(p, t, s, [f.x, f.y, f.z], f.pitch);
    p['toe' + t] = f.toe;
  }
  const amp = lerp(0.44, lerp(0.62, 0.95, sprint), run) * moving;
  for (const [t, s] of SIDES) {
    const other = t === 'L' ? feet.R : feet.L;
    const swing = clamp((other.z - (t === 'L' ? feet.L.z : feet.R.z)) / Math.max(0.25, stride * 0.5), -1, 1);
    const lagPh = (ph + (t === 'L' ? 0 : 0.5) + 0.07) % 1;
    const lagSwing = -Math.cos(TAU * lagPh);
    p['arm' + t] = -swing * amp + run * 0.1;
    p['elbow' + t] = lerp(0.22 + 0.25 * Math.max(0, -lagSwing) * moving, 1.35 + sprint * 0.15 + 0.3 * Math.max(0, -lagSwing), run);
    p['armOut' + t] = lerp(0.16, 0.12, run) + wade * 0.65 * moving;
    p['armTwist' + t] = lerp(0.15, 0.45, run);
    p['forearm' + t] = lerp(0, 0.35, run);
    p['wrist' + t] = lerp(0.05, -0.1, run);
    p['grip' + t] = lerp(0.18, 0.55, run);
    p['thumb' + t] = lerp(0.2, 0.5, run);
    p['spread' + t] = lerp(0.6, 0.25, run);
    if (wade > 0.1) {
      p['elbow' + t] += wade * 0.5 * moving;
      p['arm' + t] = lerp(p['arm' + t], -0.25, wade * 0.6);
    }
  }
  return feet;
}

export function idle(p, t, shift) {
  const breathe = Math.sin(t * 1.55);
  const w = shift;
  p.hipsShift = 0.024 * w;
  p.hipsRoll = 0.03 * w;
  p.hipsYaw = 0.04 * Math.sin(t * 0.23);
  p.hipsY = DIM.hip - 0.012 - 0.008 * Math.abs(w);
  p.spinePitch = -0.012 * breathe;
  p.spineRoll = -0.02 * w;
  p.spineTwist = -0.05 * Math.sin(t * 0.23);
  for (const [tt, s] of SIDES) {
    const ankle = [s * 0.112, ANKLE, 0.03 - (s > 0 ? 0.035 : -0.02) * 0.5];
    legIK(p, tt, s, ankle, 0);
    p['shrug' + tt] = 0.018 * breathe;
    p['arm' + tt] = 0.03 + 0.02 * Math.sin(t * 0.7 + s);
    p['armOut' + tt] = 0.15 + 0.012 * breathe;
    p['elbow' + tt] = 0.2 + 0.03 * Math.sin(t * 0.5 + s);
    p['armTwist' + tt] = 0.25;
    p['grip' + tt] = 0.18;
    p['legTwist' + tt] = s * 0.12;
  }
}

export function airPose(p, st, time, airTime) {
  const fall = sstep(-3.5, -7.5, st.vy) * sstep(0.35, 0.8, airTime);
  const rise = sstep(0, 2.5, st.vy);
  const take = 1 - sstep(0.05, 0.2, airTime);
  p.hipsY = DIM.hip;
  p.spinePitch = lerp(lerp(0.12, -0.04, rise), -0.12, fall);
  p.hipsPitch = 0.05;
  p.headPitch = lerp(0.1, 0.25, fall);
  const tuck = rise * (1 - take);
  for (const [t, s] of SIDES) {
    const lead = s > 0;
    const fl = Math.sin(time * 8.5 + (lead ? 0 : 2.4));
    const fl2 = Math.cos(time * 7.1 + (lead ? 1 : 0));
    p['leg' + t] = lerp(lerp(lead ? -0.35 : 0.15, lead ? -0.85 : -0.15, tuck), -0.45 + fl * 0.45, fall) + take * (lead ? -0.2 : 0.25);
    p['knee' + t] = lerp(lerp(lead ? 0.6 : 0.35, lead ? 1.45 : 0.75, tuck), 0.9 + fl2 * 0.5, fall) * (1 - take * 0.6);
    p['foot' + t] = lerp(0.25, 0.3, fall) + take * 0.35;
    p['legOut' + t] = lerp(0.05, 0.22, fall);
    p['arm' + t] = lerp(lerp(lead ? 0.35 : -0.55, lead ? 0.15 : -0.7, tuck), -1.3 + Math.sin(time * 9 + s * 1.6) * 1.1, fall);
    p['armOut' + t] = lerp(0.35 + tuck * 0.2, 1.05 + Math.cos(time * 9 + s) * 0.35, fall);
    p['elbow' + t] = lerp(0.6, 0.35 + Math.max(0, fl) * 0.5, fall);
    p['grip' + t] = lerp(0.25, 0.05, fall);
    p['spread' + t] = lerp(0.6, 1.0, fall);
  }
}

export function swimPose(p, st, time, phase) {
  const moving = sstep(0.25, 0.7, st.speed);
  const crawl = { ...p };
  const tread = { ...p };
  crawl.hipsY = DIM.hip + 0.16;
  crawl.hipsPitch = 1.42;
  crawl.spinePitch = 0.02;
  const c = phase;
  crawl.hipsYaw = Math.sin(TAU * c) * 0.55;
  crawl.spineTwist = Math.sin(TAU * c - 0.4) * 0.25;
  const breath = Math.max(0, Math.sin(TAU * c * 0.5)) ** 6;
  crawl.headPitch = -1.05;
  crawl.headYaw = -breath * 1.1 - crawl.hipsYaw * 0.5;
  crawl.eyePitch = -0.15;
  for (const [t, s, off] of [['L', 1, 0], ['R', -1, 0.5]]) {
    const u = (c + off) % 1;
    if (u < 0.55) {
      const k = u / 0.55;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      crawl['arm' + t] = lerp(-2.95, -0.05, e);
      crawl['armOut' + t] = 0.12 + Math.sin(Math.PI * k) * 0.12;
      crawl['elbow' + t] = 0.2 + Math.sin(Math.PI * Math.min(1, k * 1.2)) * 1.25;
      crawl['armTwist' + t] = 0.5;
      crawl['forearm' + t] = 0.8;
    } else {
      const k = (u - 0.55) / 0.45;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      crawl['arm' + t] = lerp(-0.05, -2.95, e);
      crawl['armOut' + t] = 0.2 + Math.sin(Math.PI * k) * 1.05;
      crawl['elbow' + t] = 0.25 + Math.sin(Math.PI * k) * 1.55;
      crawl['armTwist' + t] = 0.9 - Math.sin(Math.PI * k) * 0.4;
      crawl['forearm' + t] = 0.4;
    }
    crawl['wrist' + t] = 0.15;
    crawl['grip' + t] = 0.12;
    crawl['spread' + t] = 0.15;
    crawl['thumb' + t] = 0.1;
    const kick = Math.sin(TAU * c * 3 + (s > 0 ? 0 : Math.PI));
    crawl['leg' + t] = kick * 0.3 + 0.05;
    crawl['knee' + t] = 0.15 + Math.max(0, Math.sin(TAU * c * 3 + (s > 0 ? 0.9 : 0.9 + Math.PI))) * 0.45;
    crawl['foot' + t] = 1.05;
    crawl['legOut' + t] = 0.03;
  }
  const tc = time * 2.3;
  tread.hipsY = DIM.hip;
  tread.hipsPitch = 0.14;
  tread.spinePitch = -0.04;
  tread.headPitch = -0.12;
  for (const [t, s] of SIDES) {
    const sc = Math.sin(tc + (s > 0 ? 0 : 1.2));
    tread['arm' + t] = -0.55 + sc * 0.12;
    tread['armOut' + t] = 0.75 + Math.cos(tc * 1.0 + (s > 0 ? 0 : 1.2)) * 0.32;
    tread['armTwist' + t] = 0.6;
    tread['elbow' + t] = 0.75 + sc * 0.2;
    tread['forearm' + t] = 1.0 + sc * 0.5;
    tread['wrist' + t] = sc * 0.3;
    tread['grip' + t] = 0.1;
    tread['spread' + t] = 0.2;
    const kc = Math.sin(time * 3.1 + (s > 0 ? 0 : Math.PI));
    tread['leg' + t] = -0.7 + kc * 0.32;
    tread['knee' + t] = 1.15 + Math.cos(time * 3.1 + (s > 0 ? 0 : Math.PI)) * 0.4;
    tread['legOut' + t] = 0.3;
    tread['legTwist' + t] = s * -0.3;
    tread['foot' + t] = 0.45;
  }
  for (const k in p) p[k] = lerp(tread[k], crawl[k], moving);
}

export function sitPose(p, st, time) {
  p.hipsY = 0;
  p.hipsPitch = -0.24;
  p.spinePitch = 0.14;
  p.headPitch = 0.08;
  const steer = st.steer || 0;
  p.headYaw = steer * 0.42 + Math.sin(time * 0.37) * 0.05;
  p.headRoll = -steer * 0.05;
  p.spineRoll = -steer * 0.05;
  p.eyeYaw = steer * 0.25;
  for (const [t, s] of SIDES) {
    p['leg' + t] = -1.38;
    p['legOut' + t] = 0.11;
    p['knee' + t] = 1.22 + (t === 'R' ? -0.08 * (st.throttle || 0) : 0.05);
    p['foot' + t] = 0.2 + (t === 'R' ? 0.28 * (st.throttle || 0) : 0);
    p['arm' + t] = -0.85;
    p['armOut' + t] = 0.32;
    p['elbow' + t] = 0.75;
    p['armTwist' + t] = 0.35;
    p['forearm' + t] = 0.6;
    p['grip' + t] = 0.72;
    p['thumb' + t] = 0.35;
    p['spread' + t] = 0.15;
  }
}

