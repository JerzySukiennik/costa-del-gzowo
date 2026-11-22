// Costa del Gzowo: pose vocabulary, pose-to-bone application, finger curls and two-bone arm IK with hand orientation.
import * as THREE from 'three';
import { DIM, SIDES, FINGERS } from './skeleton.js';

const CORE = ['hipsY', 'hipsPitch', 'hipsRoll', 'spinePitch', 'spineTwist', 'headPitch', 'headYaw'];
const EXTRA = ['hipsYaw', 'hipsShift', 'hipsFwd', 'spineRoll', 'headRoll', 'leanPitch', 'leanRoll', 'eyeYaw', 'eyePitch', 'blink'];
const LIMB = ['arm', 'armOut', 'elbow', 'leg', 'legOut', 'knee', 'foot'];
const LIMB_EXTRA = ['armTwist', 'shrug', 'forearm', 'wrist', 'wristSide', 'grip', 'thumb', 'spread', 'toe', 'legTwist'];

export const KEYS = [...CORE, ...EXTRA];
for (const [t] of SIDES) for (const k of [...LIMB, ...LIMB_EXTRA]) KEYS.push(k + t);

export function basePose() {
  const p = {};
  for (const k of KEYS) p[k] = 0;
  p.hipsY = DIM.hip;
  for (const [t] of SIDES) {
    p['armOut' + t] = 0.16;
    p['elbow' + t] = 0.18;
    p['armTwist' + t] = 0.15;
    p['grip' + t] = 0.12;
    p['thumb' + t] = 0.15;
    p['spread' + t] = 0.6;
  }
  return p;
}

const CURL_OPEN = [0.12, 0.2, 0.12];
const CURL_FIST = [1.45, 1.7, 0.95];
const CURL_BIAS = { index: 0, middle: 0.04, ring: 0.09, pinky: 0.16 };

export function createRigApplier(skel) {
  const b = skel.bones;
  b.shoulderL.rotation.order = 'XZY';
  b.shoulderR.rotation.order = 'XZY';
  b.hipL.rotation.order = 'XZY';
  b.hipR.rotation.order = 'XZY';
  const qa = new THREE.Quaternion();
  const thumbAxis = skel.thumbAxis;
  const thumbBind = { L: skel.bindQuat.thumb0L, R: skel.bindQuat.thumb0R };

  return function applyPose(c) {
    skel.lean.rotation.set(c.leanPitch, 0, c.leanRoll);
    b.hips.position.set(c.hipsShift, c.hipsY, c.hipsFwd);
    b.hips.rotation.set(c.hipsPitch, c.hipsYaw, c.hipsRoll);
    const sideBend = -c.hipsRoll * 0.6 + c.spineRoll;
    b.spine.rotation.set(c.spinePitch * 0.5, c.spineTwist * 0.45, sideBend * 0.5);
    b.chest.rotation.set(c.spinePitch * 0.5, c.spineTwist * 0.55, sideBend * 0.5);
    b.neck.rotation.set(c.headPitch * 0.35, c.headYaw * 0.35, c.headRoll * 0.35);
    b.head.rotation.set(c.headPitch * 0.65, c.headYaw * 0.65, c.headRoll * 0.65);
    for (const [t, s] of SIDES) {
      b['eye' + t].rotation.set(c.eyePitch, c.eyeYaw, 0);
      b['lid' + t].rotation.set(c.blink * 0.62 + c.eyePitch * 0.35, 0, 0);
      const arm = c['arm' + t];
      const out = c['armOut' + t];
      const lift = Math.max(0, out - 0.75) * 0.32 + Math.max(0, -arm - 1.1) * 0.22 + c['shrug' + t];
      const pro = Math.max(0, -arm - 0.3) * 0.12 - Math.max(0, arm - 0.3) * 0.08;
      b['clavicle' + t].rotation.set(0, -s * pro, s * lift);
      b['shoulder' + t].rotation.set(arm, s * c['armTwist' + t], s * out);
      b['elbow' + t].rotation.set(-c['elbow' + t], 0, 0);
      b['twist' + t].rotation.set(0, s * c['forearm' + t], 0);
      b['wrist' + t].rotation.set(-c['wristSide' + t], 0, -s * c['wrist' + t]);
      const g = c['grip' + t];
      const spread = c['spread' + t];
      for (const [name, fdef] of Object.entries(FINGERS)) {
        for (let q = 0; q < 3; q++) {
          const curl = CURL_OPEN[q] + (CURL_FIST[q] - CURL_OPEN[q]) * Math.min(1, g * (1 + CURL_BIAS[name] * 0.6)) + CURL_BIAS[name] * (1 - g) * (q === 0 ? 1 : 0.5);
          b[`${name}${q}${t}`].rotation.set(q === 0 ? -fdef.spread * spread : 0, 0, -s * curl);
        }
      }
      const th = c['thumb' + t];
      b['thumb0' + t].quaternion.copy(thumbBind[t]).multiply(qa.setFromAxisAngle(thumbAxis[t], th * 0.45));
      b['thumb1' + t].quaternion.setFromAxisAngle(thumbAxis[t], 0.1 + th * 0.55);
      b['thumb2' + t].quaternion.setFromAxisAngle(thumbAxis[t], 0.12 + th * 0.7);
      b['hip' + t].rotation.set(c['leg' + t], s * c['legTwist' + t], s * c['legOut' + t]);
      b['knee' + t].rotation.set(c['knee' + t], 0, 0);
      b['ankle' + t].rotation.set(c['foot' + t], 0, -s * c['legOut' + t] * 0.85);
      b['toe' + t].rotation.set(c['toe' + t], 0, 0);
    }
  };
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const vS = new THREE.Vector3();
const vE = new THREE.Vector3();
const qw = new THREE.Quaternion();
const qp = new THREE.Quaternion();
const qs = new THREE.Quaternion();
const qT = new THREE.Quaternion();
const qSw = new THREE.Quaternion();
const mBasis = new THREE.Matrix4();
const Y = new THREE.Vector3(0, 1, 0);
const PALM = new THREE.Vector3();
const POLE = new THREE.Vector3();

function rotateWorld(obj, q) {
  obj.getWorldQuaternion(qw);
  qw.premultiply(q);
  obj.parent.getWorldQuaternion(qp);
  obj.quaternion.copy(qp.invert().multiply(qw));
  obj.updateMatrixWorld(true);
}

function setWorld(obj, wq) {
  obj.parent.getWorldQuaternion(qp);
  obj.quaternion.copy(qp.invert().multiply(wq));
  obj.updateMatrixWorld(true);
}

export function reachArm(skel, side, target, weight, opts = {}) {
  if (weight <= 0.001) return;
  const b = skel.bones;
  const s = side === 'L' ? 1 : -1;
  const shoulder = b['shoulder' + side];
  const elbow = b['elbow' + side];
  const twist = b['twist' + side];
  const wrist = b['wrist' + side];
  const fkS = shoulder.quaternion.clone();
  const fkE = elbow.rotation.x;
  const fkT = twist.quaternion.clone();
  const fkW = wrist.quaternion.clone();
  const palm = opts.palm ? PALM.copy(opts.palm) : PALM.set(-s * 0.02, -0.08, 0.004);
  const pole = POLE.copy(opts.pole || v1.set(s * 0.4, -1, -0.45)).normalize();
  shoulder.parent.updateMatrixWorld(true);
  shoulder.getWorldPosition(vS);
  for (let iter = 0; iter < 2; iter++) {
    if (opts.orient) qw.copy(opts.orient);
    else wrist.getWorldQuaternion(qw);
    const desired = v2.copy(palm).applyQuaternion(qw).negate().add(target);
    const a = DIM.upperArm;
    const c = DIM.forearm;
    const d = Math.min(a + c - 0.003, Math.max(0.06, desired.distanceTo(vS)));
    const cosE = (a * a + c * c - d * d) / (2 * a * c);
    elbow.rotation.x = -(Math.PI - Math.acos(Math.max(-1, Math.min(1, cosE))));
    shoulder.updateMatrixWorld(true);
    const from = wrist.getWorldPosition(v3).sub(vS).normalize();
    const to = desired.sub(vS).normalize();
    rotateWorld(shoulder, qs.setFromUnitVectors(from, to));
    const pe = elbow.getWorldPosition(vE).sub(vS).projectOnPlane(to);
    const pp = v1.copy(pole).projectOnPlane(to);
    if (pe.lengthSq() > 1e-6 && pp.lengthSq() > 1e-6) {
      pe.normalize();
      pp.normalize();
      const ang = Math.atan2(v3.crossVectors(pe, pp).dot(to), pe.dot(pp));
      rotateWorld(shoulder, qs.setFromAxisAngle(to, ang));
    }
    if (opts.orient) {
      twist.quaternion.copy(fkT);
      twist.updateMatrixWorld(true);
      setWorld(wrist, opts.orient);
      const q = wrist.quaternion;
      const r = Y.clone().multiplyScalar(q.x * Y.x + q.y * Y.y + q.z * Y.z);
      qT.set(r.x, r.y, r.z, q.w).normalize();
      qSw.copy(qT).invert().multiply(q);
      twist.quaternion.multiply(qT);
      wrist.quaternion.copy(qSw);
      twist.updateMatrixWorld(true);
    }
  }
  shoulder.quaternion.copy(fkS.slerp(shoulder.quaternion, weight));
  elbow.rotation.x = fkE + (elbow.rotation.x - fkE) * weight;
  twist.quaternion.copy(fkT.slerp(twist.quaternion, weight));
  wrist.quaternion.copy(fkW.slerp(wrist.quaternion, weight));
  shoulder.updateMatrixWorld(true);
}

export function handBasis(side, palmNormal, thumbDir, out) {
  const s = side === 'L' ? 1 : -1;
  const x = v1.copy(palmNormal).multiplyScalar(-s).normalize();
  const z = v2.copy(thumbDir).projectOnPlane(x).normalize();
  const y = v3.crossVectors(z, x).normalize();
  mBasis.makeBasis(x, y, z);
  return out.setFromRotationMatrix(mBasis);
}
