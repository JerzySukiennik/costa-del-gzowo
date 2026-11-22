// Costa del Gzowo: getting in and out of a car (walk to the door, open it, step in, sit, close it, hands to the wheel, and the reverse) with two-bone arm and leg placement.
import * as THREE from 'three';
import { monotone, smoothstep } from './carGeometry.js';

const UP = new THREE.Vector3(0, 1, 0);
const ARM = { a: 0.29, b: 0.315 };
const LEG = { a: 0.44, b: 0.43 };
const ANKLE = 0.065;
const STAND = 0.93;
const REST_ARM = { arm: 0.0, out: 0.09, elbow: 0.16 };

function scalar(keys) {
  if (keys.length === 1) return () => keys[0][1];
  const f = monotone(keys);
  return (t) => f(t);
}

function vector(keys) {
  const fx = scalar(keys.map(([t, v]) => [t, v[0]]));
  const fy = scalar(keys.map(([t, v]) => [t, v[1]]));
  const fz = scalar(keys.map(([t, v]) => [t, v[2]]));
  return (t, out = new THREE.Vector3()) => out.set(fx(t), fy(t), fz(t));
}

function arc(a, b, lift) {
  return (t, out = new THREE.Vector3()) => out.lerpVectors(a, b, t).add(new THREE.Vector3(0, Math.sin(Math.PI * t) * lift, 0));
}

function feet(centre, yaw, side, half = 0.11) {
  return new THREE.Vector3(centre.x + Math.cos(yaw) * half * side, ANKLE, centre.z - Math.sin(yaw) * half * side);
}

function solveTwoBone(local, a, b, side, bendForward, out) {
  const d = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 0.02, local.length()));
  const c = Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b)));
  const bend = Math.PI - Math.acos(c);
  const ly = -a - b * Math.cos(bend);
  const lz = bendForward ? b * Math.sin(bend) : -b * Math.sin(bend);
  const k = d / Math.max(local.length(), 1e-4);
  const tx = local.x * k;
  const ty = local.y * k;
  const tz = local.z * k;
  const s = Math.max(-1, Math.min(1, -tx / ly));
  const g = Math.asin(s);
  const pitch = Math.atan2(tz, ty) - Math.atan2(lz, ly * Math.cos(g));
  out.pitch = Math.atan2(Math.sin(pitch), Math.cos(pitch));
  out.out = Math.max(0, g * side);
  out.bend = bend;
  return out;
}

export function createCarEntry({ model, car, character, player, rig, audio, physics, scene, game, groundBelow, onSeated }) {
  const geo = model.entryGeometry();
  const pose = {};
  const resetPose = () => {
    Object.assign(pose, { hipsY: STAND, hipsPitch: 0, hipsRoll: 0, spinePitch: 0, spineTwist: 0, headPitch: 0, headYaw: 0, gripL: 0, gripR: 0 });
    for (const t of ['L', 'R']) Object.assign(pose, { ['arm' + t]: REST_ARM.arm, ['armOut' + t]: REST_ARM.out, ['elbow' + t]: REST_ARM.elbow, ['leg' + t]: 0, ['legOut' + t]: 0.02, ['knee' + t]: 0.02, ['foot' + t]: 0 });
  };
  resetPose();

  const state = { phase: 'idle', t: 0, plan: null, path: null, walkT: 0, seated: false, cameraSwitched: false, closedSound: false, openSound: false, quick: false };
  const carQ = new THREE.Quaternion();
  const yawQ = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const hipW = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const upW = new THREE.Vector3();
  const footLocal = new THREE.Vector3();
  const footWorld = new THREE.Vector3();
  const mGroup = new THREE.Matrix4();
  const mHips = new THREE.Matrix4();
  const mSpine = new THREE.Matrix4();
  const mInv = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const solved = { pitch: 0, out: 0, bend: 0 };
  const handTargets = { L: null, R: null };
  const handWeights = { L: 0, R: 0 };

  function carYawQuat(out) {
    const f = car.forward;
    return out.setFromAxisAngle(UP, Math.atan2(-f.z, f.x));
  }

  function toWorld(local, out) {
    model.group.updateWorldMatrix(true, false);
    return out.copy(local).applyMatrix4(model.group.matrixWorld);
  }

  function toLocal(world, out) {
    model.group.updateWorldMatrix(true, false);
    return model.group.worldToLocal(out.copy(world));
  }

  function groundDelta(localXZ) {
    tmp.set(localXZ.x, 0, localXZ.z);
    toWorld(tmp, tmp);
    const g = groundBelow(tmp.x, tmp.y + 1.2, tmp.z);
    if (g === null) return 0;
    return Math.max(-0.4, Math.min(0.4, g - tmp.y));
  }

  function bodyMatrices() {
    mGroup.compose(character.group.position, character.group.quaternion, tmp2.set(1, 1, 1));
    euler.set(pose.hipsPitch, 0, pose.hipsRoll, 'XYZ');
    mHips.makeRotationFromEuler(euler).setPosition(0, pose.hipsY, 0);
    mHips.premultiply(mGroup);
    euler.set(pose.spinePitch, pose.spineTwist, -pose.hipsRoll * 0.6, 'XYZ');
    mSpine.makeRotationFromEuler(euler).setPosition(0, 0.06, 0);
    mSpine.premultiply(mHips);
  }

  function reachArm(tag, world, weight) {
    const s = tag === 'L' ? 1 : -1;
    mInv.copy(mSpine).invert();
    tmp.copy(world).applyMatrix4(mInv).sub(tmp2.set(s * 0.19, 0.425, 0));
    solveTwoBone(tmp, ARM.a, ARM.b, s, true, solved);
    const w = weight;
    pose['arm' + tag] = REST_ARM.arm + (solved.pitch - REST_ARM.arm) * w;
    pose['armOut' + tag] = REST_ARM.out + (solved.out - REST_ARM.out) * w;
    pose['elbow' + tag] = REST_ARM.elbow + (solved.bend - REST_ARM.elbow) * w;
    pose['grip' + tag] = w;
    if (character.reach) character.reach(tag, w > 0.5 ? world.clone() : null);
  }

  function placeLeg(tag, world) {
    const s = tag === 'L' ? 1 : -1;
    mInv.copy(mHips).invert();
    tmp.copy(world).applyMatrix4(mInv).sub(tmp2.set(s * 0.095, -0.03, 0));
    solveTwoBone(tmp, LEG.a, LEG.b, s, false, solved);
    pose['leg' + tag] = solved.pitch;
    pose['legOut' + tag] = Math.min(0.6, solved.out);
    pose['knee' + tag] = solved.bend;
    pose['foot' + tag] = -(pose.hipsPitch + solved.pitch + solved.bend) * 0.85;
  }

  function enterPlan() {
    const g = geo;
    const roofUp = model.roof && model.roof.value < 0.5 ? 1 : 0;
    const S = g.seat;
    const spot = g.spot;
    const back = g.stepBack;
    const gap = g.gap;
    const T = { reach: 0.45, pull: 1.0, step: 1.55, legIn: 2.15, sink: 2.75, seat: 3.15, close: 3.55, wheel: 4.0 };
    const hip = vector([
      [0, [spot.x, STAND, spot.z]], [T.reach, [spot.x + 0.04, STAND - 0.02, spot.z + 0.03]], [T.pull, [back.x, STAND - 0.01, back.z]],
      [T.step, [gap.x, STAND - 0.02, gap.z]], [T.legIn, [gap.x + 0.02, STAND - 0.1 - roofUp * 0.06, gap.z + 0.1]],
      [T.sink, [S.x - 0.02, S.y + 0.2 - roofUp * 0.05, (S.z + gap.z) / 2 + 0.06]], [T.seat, [S.x, S.y + 0.02, S.z - 0.03]], [T.close, [S.x, S.y, S.z - 0.02]], [T.wheel, [S.x, S.y, S.z]],
    ]);
    const yaw = scalar([[0, 0.3], [T.reach, 0.25], [T.pull, 0.45], [T.step, 1.2], [T.legIn, 1.15], [T.sink, 1.35], [T.seat, 1.52], [T.wheel, Math.PI / 2]]);
    const sigma = scalar([[0, 0], [T.legIn, 0], [T.sink, 0.55], [T.seat, 1], [T.wheel, 1]]);
    const hipsY = scalar([[0, STAND], [T.legIn, STAND], [T.sink, 0.25], [T.seat, 0.0], [T.wheel, 0]]);
    const hipsPitch = scalar([[0, 0.05], [T.reach, 0.32], [T.pull, 0.2], [T.step, 0.12], [T.legIn, 0.32 + roofUp * 0.25], [T.sink, 0.18 + roofUp * 0.4], [T.seat, 0.05], [T.close, -0.15], [T.wheel, -0.3]]);
    const hipsRoll = scalar([[0, 0], [T.legIn, 0], [T.sink, -0.15], [T.seat, 0.12], [T.close, 0.18], [T.wheel, 0]]);
    const spinePitch = scalar([[0, 0], [T.reach, 0.18], [T.pull, 0.05], [T.legIn, 0.12 + roofUp * 0.15], [T.sink, 0.04 + roofUp * 0.2], [T.seat, 0.0], [T.close, -0.05], [T.wheel, -0.1]]);
    const spineTwist = scalar([[0, 0], [T.reach, -0.2], [T.pull, -0.1], [T.sink, 0.2], [T.seat, 0.1], [T.close, 0.35], [T.wheel, 0]]);
    const headPitch = scalar([[0, 0.25], [T.reach, 0.35], [T.step, 0.15], [T.legIn, 0.4 + roofUp * 0.3], [T.sink, 0.25 + roofUp * 0.2], [T.seat, 0.25], [T.wheel, 0.3]]);
    const headYaw = scalar([[0, 0], [T.pull, -0.2], [T.step, 0.3], [T.seat, -0.3], [T.close, -0.7], [T.wheel, 0]]);
    const door = scalar([[0, 0], [T.reach + 0.05, 0], [T.pull, 0.42], [T.step, 0.62], [T.seat, 0.62], [T.seat + 0.1, 0.6], [T.close + 0.05, 0], [T.wheel, 0]]);
    const lStart = feet(spot, 0.3, 1);
    const rStart = feet(spot, 0.3, -1);
    const lBack = feet(back, 0.45, 1);
    const rBack = feet(back, 0.45, -1);
    const lGap = feet(gap, 1.2, 1, 0.13);
    const rGap = feet(gap, 1.2, -1, 0.13);
    const rIn = g.footInR.clone();
    const rPedal = g.pedalR.clone();
    const lPedal = g.pedalL.clone();
    const sillOver = (a, b) => (t, out) => {
      out.lerpVectors(a, b, smoothstep(0, 1, t));
      out.y += Math.sin(Math.PI * Math.min(1, t * 1.1)) * (g.sillY + 0.22 - Math.min(a.y, b.y));
      return out;
    };
    const footL = (t, out) => {
      if (t < T.reach + 0.1) return out.copy(lStart);
      if (t < T.pull) return arc(lStart, lBack, 0.08)(smoothstep(T.reach + 0.1, T.pull, t), out);
      if (t < T.pull + 0.15) return out.copy(lBack);
      if (t < T.step) return arc(lBack, lGap, 0.1)(smoothstep(T.pull + 0.15, T.step, t), out);
      if (t < T.seat - 0.05) return out.copy(lGap);
      if (t < T.close) return sillOver(lGap, lPedal)(smoothstep(T.seat - 0.05, T.close, t), out);
      return out.copy(lPedal);
    };
    const footR = (t, out) => {
      if (t < T.reach + 0.25) return out.copy(rStart);
      if (t < T.pull + 0.05) return arc(rStart, rBack, 0.08)(smoothstep(T.reach + 0.25, T.pull + 0.05, t), out);
      if (t < T.pull + 0.25) return out.copy(rBack);
      if (t < T.step + 0.05) return arc(rBack, rGap, 0.1)(smoothstep(T.pull + 0.25, T.step + 0.05, t), out);
      if (t < T.step + 0.15) return out.copy(rGap);
      if (t < T.legIn + 0.1) return sillOver(rGap, rIn)(smoothstep(T.step + 0.15, T.legIn + 0.1, t), out);
      if (t < T.seat) return out.copy(rIn);
      if (t < T.close) return out.lerpVectors(rIn, rPedal, smoothstep(T.seat, T.close, t));
      return out.copy(rPedal);
    };
    const hands = (t) => {
      handTargets.L = null;
      handTargets.R = null;
      handWeights.L = 0;
      handWeights.R = 0;
      if (t < T.pull + 0.12) {
        handWeights.R = smoothstep(0.08, T.reach, t) * (1 - smoothstep(T.pull - 0.05, T.pull + 0.12, t));
        handTargets.R = model.handlePoint(new THREE.Vector3(), g.door);
      } else if (t < T.sink) {
        handWeights.L = smoothstep(T.pull + 0.1, T.step, t) * (1 - smoothstep(T.sink - 0.15, T.sink, t));
        handTargets.L = model.supportPoint(new THREE.Vector3(), g.door);
        handWeights.R = smoothstep(T.step, T.legIn, t) * (1 - smoothstep(T.seat - 0.1, T.seat + 0.05, t));
        handTargets.R = toWorld(g.brace, new THREE.Vector3());
      } else if (t < T.close + 0.1) {
        handWeights.R = 1 - smoothstep(T.sink, T.seat, t);
        handTargets.R = toWorld(g.brace, new THREE.Vector3());
        handWeights.L = smoothstep(T.sink, T.seat + 0.05, t) * (1 - smoothstep(T.close - 0.02, T.close + 0.1, t));
        handTargets.L = model.innerPullPoint(new THREE.Vector3(), g.door);
      }
      if (t >= T.close - 0.1) {
        const w = smoothstep(T.close - 0.05, T.wheel, t);
        if (w > handWeights.L) {
          handWeights.L = w;
          handTargets.L = model.gripPoint('L', new THREE.Vector3());
        }
        const wr = smoothstep(T.seat + 0.05, T.wheel - 0.1, t);
        if (wr > handWeights.R) {
          handWeights.R = wr;
          handTargets.R = model.gripPoint('R', new THREE.Vector3());
        }
      }
    };
    return { duration: T.wheel, camera: T.wheel * 0.4, hip, yaw, sigma, hipsY, hipsPitch, hipsRoll, spinePitch, spineTwist, headPitch, headYaw, door, footL, footR, hands, events: [[T.reach + 0.05, 'open'], [T.close - 0.05, 'close']] };
  }

  function exitPlan() {
    const g = geo;
    const roofUp = model.roof && model.roof.value < 0.5 ? 1 : 0;
    const S = g.seat;
    const gap = g.gap;
    const back = g.exitSpot;
    const T = { pull: 0.45, legOut: 0.95, rise: 1.55, clear: 2.05, push: 2.6, done: 3.0 };
    const hip = vector([
      [0, [S.x, S.y, S.z]], [T.pull, [S.x, S.y + 0.01, S.z - 0.03]], [T.legOut, [S.x - 0.02, S.y + 0.04, S.z - 0.12]],
      [T.legOut + 0.3, [S.x - 0.02, S.y + 0.22 - roofUp * 0.04, (S.z + gap.z) / 2 + 0.03]], [T.rise, [gap.x, STAND - 0.12, gap.z + 0.04]],
      [T.clear, [back.x + 0.05, STAND - 0.01, back.z + 0.04]], [T.push, [back.x, STAND, back.z]], [T.done, [back.x, STAND, back.z]],
    ]);
    const yaw = scalar([[0, Math.PI / 2], [T.pull, 1.75], [T.legOut, 1.95], [T.rise, 1.9], [T.clear, 1.2], [T.push, 0.7], [T.done, 0.5]]);
    const sigma = scalar([[0, 1], [T.legOut, 1], [T.legOut + 0.3, 0.55], [T.rise, 0], [T.done, 0]]);
    const hipsY = scalar([[0, 0], [T.legOut, 0], [T.legOut + 0.3, 0.3], [T.rise, STAND], [T.done, STAND]]);
    const hipsPitch = scalar([[0, -0.3], [T.pull, -0.05], [T.legOut, 0.25], [T.legOut + 0.3, 0.55 + roofUp * 0.3], [T.rise, 0.25], [T.clear, 0.05], [T.push, 0.22], [T.done, 0.02]]);
    const hipsRoll = scalar([[0, 0], [T.pull, 0.18], [T.legOut, -0.1], [T.rise, 0], [T.done, 0]]);
    const spinePitch = scalar([[0, -0.1], [T.pull, 0.0], [T.legOut + 0.3, 0.25 + roofUp * 0.2], [T.rise, 0.1], [T.clear, 0], [T.push, 0.12], [T.done, 0]]);
    const spineTwist = scalar([[0, 0], [T.pull, 0.35], [T.legOut, 0.15], [T.rise, 0], [T.push, -0.25], [T.done, 0]]);
    const headPitch = scalar([[0, 0.3], [T.legOut, 0.35], [T.legOut + 0.3, 0.45 + roofUp * 0.25], [T.rise, 0.15], [T.done, 0.05]]);
    const headYaw = scalar([[0, 0], [T.pull, -0.6], [T.legOut, -0.3], [T.clear, 0.3], [T.push, 0.2], [T.done, 0]]);
    const door = scalar([[0, 0], [0.12, 0], [T.pull + 0.1, 0.42], [T.legOut, 0.62], [T.clear, 0.62], [T.clear + 0.12, 0.6], [T.push, 0.02], [T.done, 0]]);
    const lPedal = g.pedalL.clone();
    const rPedal = g.pedalR.clone();
    const lOut = feet(gap, 1.9, 1, 0.13);
    const rIn = g.footInR.clone();
    const rOut = feet(gap, 1.9, -1, 0.13);
    const lBack = feet(back, 0.6, 1);
    const rBack = feet(back, 0.6, -1);
    const sillOver = (a, b) => (t, out) => {
      out.lerpVectors(a, b, smoothstep(0, 1, t));
      out.y += Math.sin(Math.PI * Math.min(1, t * 1.1)) * (g.sillY + 0.22 - Math.min(a.y, b.y));
      return out;
    };
    const footL = (t, out) => {
      if (t < T.pull) return out.copy(lPedal);
      if (t < T.legOut) return sillOver(lPedal, lOut)(smoothstep(T.pull, T.legOut, t), out);
      if (t < T.rise + 0.05) return out.copy(lOut);
      if (t < T.clear) return arc(lOut, lBack, 0.1)(smoothstep(T.rise + 0.05, T.clear, t), out);
      return out.copy(lBack);
    };
    const footR = (t, out) => {
      if (t < T.legOut - 0.2) return out.lerpVectors(rPedal, rIn, smoothstep(0, T.legOut - 0.2, t));
      if (t < T.rise - 0.05) return out.copy(rIn);
      if (t < T.rise + 0.25) return sillOver(rIn, rOut)(smoothstep(T.rise - 0.05, T.rise + 0.25, t), out);
      if (t < T.rise + 0.35) return out.copy(rOut);
      if (t < T.clear + 0.15) return arc(rOut, rBack, 0.1)(smoothstep(T.rise + 0.35, T.clear + 0.15, t), out);
      return out.copy(rBack);
    };
    const hands = (t) => {
      handTargets.L = null;
      handTargets.R = null;
      handWeights.L = 0;
      handWeights.R = 0;
      const wheel = 1 - smoothstep(0, 0.25, t);
      if (t < 0.25) {
        handWeights.R = wheel;
        handTargets.R = model.gripPoint('R', new THREE.Vector3());
      }
      if (t < T.legOut) {
        handWeights.L = Math.max(t < 0.2 ? wheel : 0, smoothstep(0.05, 0.28, t) * (1 - smoothstep(T.pull + 0.15, T.legOut, t)));
        handTargets.L = t < 0.12 ? model.gripPoint('L', new THREE.Vector3()) : model.innerPullPoint(new THREE.Vector3(), g.door);
      } else if (t < T.rise + 0.1) {
        handWeights.L = smoothstep(T.legOut, T.legOut + 0.25, t) * (1 - smoothstep(T.rise - 0.1, T.rise + 0.1, t));
        handTargets.L = model.supportPoint(new THREE.Vector3(), g.door);
      }
      if (t > 0.3 && t < T.rise) {
        handWeights.R = smoothstep(0.3, T.legOut, t) * (1 - smoothstep(T.rise - 0.2, T.rise, t));
        handTargets.R = toWorld(g.brace, new THREE.Vector3());
      }
      if (t > T.clear - 0.1) {
        handWeights.R = smoothstep(T.clear - 0.1, T.clear + 0.15, t) * (1 - smoothstep(T.push - 0.05, T.done - 0.05, t));
        handTargets.R = model.handlePoint(new THREE.Vector3(), g.door);
      }
    };
    return { duration: T.done, camera: T.rise / T.done, standAt: T.rise + 0.05, hip, yaw, sigma, hipsY, hipsPitch, hipsRoll, spinePitch, spineTwist, headPitch, headYaw, door, footL, footR, hands, events: [[0.15, 'open'], [T.push - 0.05, 'close']] };
  }

  function placeCharacter(plan, t) {
    const sigma = plan.sigma(t);
    plan.hip(t, tmp);
    const local = tmp.clone();
    toWorld(local, hipW);
    const d = groundDelta(local) * (1 - sigma);
    hipW.y += d;
    pose.hipsY = plan.hipsY(t);
    pose.hipsPitch = plan.hipsPitch(t);
    pose.hipsRoll = plan.hipsRoll(t);
    pose.spinePitch = plan.spinePitch(t);
    pose.spineTwist = plan.spineTwist(t);
    pose.headPitch = plan.headPitch(t);
    pose.headYaw = plan.headYaw(t);
    const yaw = plan.yaw(t);
    model.group.updateWorldMatrix(true, false);
    carQ.setFromRotationMatrix(model.group.matrixWorld);
    carYawQuat(yawQ);
    q.setFromAxisAngle(UP, yaw);
    q2.copy(yawQ).multiply(q);
    q.premultiply(carQ);
    q2.slerp(q, sigma);
    upW.set(0, 1, 0).applyQuaternion(q2);
    character.group.position.copy(hipW).addScaledVector(upW, -pose.hipsY);
    character.group.quaternion.copy(q2);
    character.group.updateMatrixWorld(true);
    bodyMatrices();
    for (const [tag, fn] of [['L', plan.footL], ['R', plan.footR]]) {
      fn(t, footLocal);
      const dl = groundDelta(footLocal) * (1 - sigma);
      toWorld(footLocal, footWorld);
      footWorld.y += dl;
      placeLeg(tag, footWorld);
    }
    plan.hands(t);
    for (const tag of ['L', 'R']) {
      if (handTargets[tag] && handWeights[tag] > 0.001) reachArm(tag, handTargets[tag], handWeights[tag]);
      else {
        pose['arm' + tag] = REST_ARM.arm + (sigma > 0.5 ? -0.3 : 0);
        pose['armOut' + tag] = REST_ARM.out;
        pose['elbow' + tag] = REST_ARM.elbow + (sigma > 0.5 ? 0.6 : 0);
        pose['grip' + tag] = 0;
        if (character.reach) character.reach(tag, null);
      }
    }
    player.state.position.copy(hipW).addScaledVector(UP, -STAND);
    player.state.yaw = Math.atan2(tmp.set(0, 0, 1).applyQuaternion(q2).x, tmp.z);
  }

  function seatedPose(steer = 0, throttle = 0) {
    pose.hipsY = 0;
    pose.hipsPitch = -0.3;
    pose.hipsRoll = 0;
    pose.spinePitch = -0.1;
    pose.spineTwist = 0;
    pose.headPitch = 0.3;
    pose.headYaw = -steer * 0.4;
    character.group.updateMatrixWorld(true);
    mGroup.copy(character.group.matrixWorld);
    euler.set(pose.hipsPitch, 0, pose.hipsRoll, 'XYZ');
    mHips.makeRotationFromEuler(euler).setPosition(0, 0, 0).premultiply(mGroup);
    euler.set(pose.spinePitch, pose.spineTwist, 0, 'XYZ');
    mSpine.makeRotationFromEuler(euler).setPosition(0, 0.06, 0).premultiply(mHips);
    placeLeg('L', toWorld(geo.pedalL, new THREE.Vector3()));
    placeLeg('R', toWorld(tmp.copy(geo.pedalR).add(tmp2.set(0.02 * throttle, -0.015 * throttle, 0)), new THREE.Vector3()));
    reachArm('L', model.gripPoint('L', new THREE.Vector3()), 1);
    reachArm('R', model.gripPoint('R', new THREE.Vector3()), 1);
  }

  function seat() {
    model.group.add(character.group);
    character.group.position.copy(geo.seat);
    character.group.rotation.set(0, Math.PI / 2, 0);
    character.group.updateMatrixWorld(true);
    model.setDoorAngle(geo.door, 0);
    state.seated = true;
    state.phase = 'seated';
    seatedPose(0, 0);
    character.setScripted(pose, 1000);
  }

  function doorSpotWorld(out) {
    return toWorld(geo.spot, out);
  }

  function planWalk() {
    const start = player.state.position.clone();
    const startLocal = toLocal(start, new THREE.Vector3());
    const pts = [startLocal];
    const L = geo.length / 2 + 0.55;
    const W = geo.halfWidth + 0.45;
    const sideSign = Math.sign(geo.spot.z);
    if (startLocal.z * sideSign < W - 0.2) {
      const end = startLocal.x > 0 ? L : -L;
      if (startLocal.z * sideSign < -W + 0.4) pts.push(new THREE.Vector3(end, 0, -sideSign * W));
      pts.push(new THREE.Vector3(end, 0, sideSign * W));
    }
    pts.push(geo.spot.clone());
    const world = pts.map((p) => {
      const w = toWorld(tmp.set(p.x, 0, p.z), new THREE.Vector3());
      return w;
    });
    world[0].copy(start);
    let len = 0;
    for (let i = 1; i < world.length; i++) len += world[i].distanceTo(world[i - 1]);
    return { pts: world, len, s: 0 };
  }

  function updateWalk(dt) {
    const path = state.path;
    const speed = 1.45;
    path.s = Math.min(path.len, path.s + speed * dt);
    let s = path.s;
    let i = 1;
    while (i < path.pts.length - 1 && s > path.pts[i].distanceTo(path.pts[i - 1])) {
      s -= path.pts[i].distanceTo(path.pts[i - 1]);
      i++;
    }
    const a = path.pts[i - 1];
    const b = path.pts[i];
    const segLen = Math.max(1e-4, a.distanceTo(b));
    tmp.lerpVectors(a, b, Math.min(1, s / segLen));
    const gy = groundBelow(tmp.x, tmp.y + 1.5, tmp.z);
    if (gy !== null) tmp.y = gy;
    player.state.position.copy(tmp);
    const moving = path.s < path.len - 1e-3;
    const dir = Math.atan2(b.x - a.x, b.z - a.z);
    const wantYaw = moving ? dir : faceYawWorld(0.3);
    let diff = wantYaw - player.state.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.state.yaw += diff * Math.min(1, dt * (moving ? 10 : 8));
    player.state.speed = moving ? speed : 0;
    player.state.grounded = true;
    player.state.mode = 'foot';
    state.walkT += dt;
    return (!moving && Math.abs(diff) < 0.08) || state.walkT > 5;
  }

  function faceYawWorld(localYaw) {
    carYawQuat(yawQ);
    q.setFromAxisAngle(UP, localYaw);
    q.premultiply(yawQ);
    tmp2.set(0, 0, 1).applyQuaternion(q);
    return Math.atan2(tmp2.x, tmp2.z);
  }

  function blocked() {
    const tilted = car.up.y < 0.82;
    const wet = car.state.inWater && (car.state.submersion > 0.12 || car.state.waterDepth > 0.35);
    return tilted || wet || car.state.speed > 2;
  }

  function startScripted(plan) {
    state.plan = plan;
    state.t = 0;
    state.phase = plan === null ? 'idle' : state.phase;
    state.cameraSwitched = false;
    state.fired = new Set();
    player.state.mode = 'car';
    character.setScripted(pose, 14);
  }

  function fire(name) {
    if (!audio) return;
    if (name === 'open') audio.door(true);
    else audio.door(false);
  }

  const api = {
    get busy() {
      return state.phase !== 'idle' && state.phase !== 'seated';
    },
    get seated() {
      return state.seated;
    },
    get phase() {
      return state.phase;
    },
    doorLocal: geo.prompt.clone(),
    doorSpotWorld,
    begin(type) {
      if (api.busy) return false;
      if (type === 'enter') {
        player.setEnabled(false);
        player.state.velocity.set(0, 0, 0);
        resetPose();
        if (blocked()) {
          state.phase = 'quickEnter';
          state.t = 0;
          state.from = character.group.position.clone();
          player.state.mode = 'car';
          character.setScripted(pose, 10);
          if (audio) audio.door(true);
          return true;
        }
        state.phase = 'walk';
        state.walkT = 0;
        state.path = planWalk();
        return true;
      }
      if (type === 'exit') {
        car.state.occupied = false;
        state.seated = false;
        scene.attach(character.group);
        if (blocked()) {
          state.phase = 'quickExit';
          state.t = 0;
          model.setDoor(geo.door, true);
          if (audio) audio.door(true);
          return true;
        }
        state.phase = 'exit';
        startScripted(exitPlan());
        character.setScripted(pose, 1000);
        return true;
      }
      return false;
    },
    seat,
    update(dt, drive = { steer: 0, throttle: 0 }) {
      if (state.phase === 'idle') return;
      if (state.phase === 'seated') {
        seatedPose(drive.steer, drive.throttle);
        return;
      }
      if (state.phase === 'walk') {
        if (updateWalk(dt)) {
          state.phase = 'enter';
          startScripted(enterPlan());
          player.state.speed = 0;
        }
        return;
      }
      if (state.phase === 'quickEnter') {
        state.t += dt;
        const k = smoothstep(0, 1, state.t / 1.0);
        model.setDoorAngle(geo.door, Math.sin(Math.PI * Math.min(1, state.t / 1.1)) * 0.6);
        if (state.t > 0.3 && game.mode !== 'car') {
          game.mode = 'car';
          rig.setMode('car');
        }
        toWorld(geo.seat, tmp);
        character.group.position.lerpVectors(state.from, tmp, k);
        if (state.t >= 1.15) {
          seat();
          car.state.occupied = true;
          if (audio) audio.door(false);
          if (onSeated) onSeated();
        }
        return;
      }
      if (state.phase === 'quickExit') {
        state.t += dt;
        if (state.t >= 0.35) {
          toWorld(geo.exitSpot, tmp);
          const ground = groundBelow(tmp.x, model.group.position.y + 1.6, tmp.z);
          const y = ground !== null ? ground : model.group.position.y - 0.3;
          finishExit(tmp.set(tmp.x, y + 0.02, tmp.z), faceYawWorld(0.5));
          model.setDoor(geo.door, false);
        }
        return;
      }
      const plan = state.plan;
      state.t += dt;
      const t = Math.min(state.t, plan.duration);
      if (state.t > 0.3) character.setScripted(pose, 1000);
      model.setDoorAngle(geo.door, plan.door(t));
      for (const [at, name] of plan.events) {
        if (t >= at && !state.fired.has(name)) {
          state.fired.add(name);
          fire(name);
        }
      }
      placeCharacter(plan, t);
      if (state.phase === 'enter') {
        if (!state.cameraSwitched && t >= plan.camera) {
          state.cameraSwitched = true;
          game.mode = 'car';
          rig.setMode('car');
        }
        if (state.t >= plan.duration) {
          seat();
          car.state.occupied = true;
          if (onSeated) onSeated();
        }
      } else if (state.phase === 'exit') {
        if (!state.cameraSwitched && t >= plan.standAt) {
          state.cameraSwitched = true;
          game.mode = 'foot';
          rig.rig.yaw = player.state.yaw;
          rig.setMode('foot');
        }
        if (state.t >= plan.duration) {
          tmp.copy(character.group.position);
          const gy = groundBelow(tmp.x, tmp.y + 1.2, tmp.z);
          if (gy !== null) tmp.y = gy;
          finishExit(tmp, player.state.yaw);
          model.setDoorAngle(geo.door, 0);
        }
      }
    },
  };

  function finishExit(feet, yaw) {
    character.setScripted(null);
    if (character.reach) {
      character.reach('L', null);
      character.reach('R', null);
    }
    player.state.mode = 'foot';
    player.teleport(feet.x, feet.y, feet.z, yaw);
    player.setEnabled(true);
    game.mode = 'foot';
    rig.setMode('foot');
    state.phase = 'idle';
    state.seated = false;
    if (audio) audio.door(false);
  }

  return api;
}
