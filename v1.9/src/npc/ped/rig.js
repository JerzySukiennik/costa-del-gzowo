// Costa del Gzowo: pedestrian rig (bones from the baked table under tilt and lean pivots), pose vocabulary, allocation-free pose application and leg IK.
import * as THREE from 'three';
import { LIMB, SIDES } from './bones.js';

const CORE = ['hipsY', 'hipsPitch', 'hipsRoll', 'hipsYaw', 'hipsShift', 'hipsFwd', 'spinePitch', 'spineTwist', 'spineRoll', 'headPitch', 'headYaw', 'headRoll', 'leanPitch', 'leanRoll', 'eyeYaw', 'eyePitch'];
const SIDE = ['arm', 'armOut', 'elbow', 'armTwist', 'shrug', 'forearm', 'wrist', 'wristSide', 'leg', 'legOut', 'knee', 'foot', 'toe', 'legTwist'];

export const KEYS = [...CORE];
export const K = { L: {}, R: {} };
for (const [t] of SIDES) {
  for (const k of SIDE) {
    K[t][k] = k + t;
    KEYS.push(k + t);
  }
}
export const ARM_KEYS = { L: ['arm', 'armOut', 'elbow', 'armTwist', 'shrug', 'forearm', 'wrist', 'wristSide'].map((k) => k + 'L'), R: ['arm', 'armOut', 'elbow', 'armTwist', 'shrug', 'forearm', 'wrist', 'wristSide'].map((k) => k + 'R') };
const COUNT = KEYS.length;

export function resetPose(p) {
  for (let i = 0; i < COUNT; i++) p[KEYS[i]] = 0;
  p.hipsY = LIMB.hip;
  p.armOutL = p.armOutR = 0.16;
  p.elbowL = p.elbowR = 0.18;
  p.armTwistL = p.armTwistR = 0.15;
  return p;
}

export function newPose() {
  return resetPose({});
}

export function copyPose(out, a) {
  for (let i = 0; i < COUNT; i++) out[KEYS[i]] = a[KEYS[i]];
  return out;
}

export function mixPose(out, b, t) {
  if (t <= 0) return out;
  for (let i = 0; i < COUNT; i++) {
    const k = KEYS[i];
    out[k] += (b[k] - out[k]) * t;
  }
  return out;
}

const euler = new THREE.Euler();
const qPelvis = new THREE.Quaternion();
const vHip = new THREE.Vector3();
const vD = new THREE.Vector3();
const LEG = LIMB.thigh + LIMB.shin;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function legIK(p, t, s, ax, ay, az, pitch) {
  const k = K[t];
  euler.set(p.hipsPitch, p.hipsYaw, p.hipsRoll, 'XYZ');
  qPelvis.setFromEuler(euler);
  vHip.set(s * LIMB.hipHalf, 0, 0).applyQuaternion(qPelvis);
  vHip.x += p.hipsShift;
  vHip.y += p.hipsY;
  vHip.z += p.hipsFwd;
  vD.set(ax - vHip.x, ay - vHip.y, az - vHip.z).applyQuaternion(qPelvis.invert());
  const len = vD.length();
  const d = clamp(len, 0.25, LEG - 0.004);
  const a = LIMB.thigh;
  const b = LIMB.shin;
  const knee = Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const out = Math.asin(clamp(vD.x / len, -0.9, 0.9));
  const psi = Math.atan2(-vD.z, -vD.y);
  p[k.legOut] = out * s;
  p[k.leg] = psi - alpha;
  p[k.knee] = knee;
  p[k.foot] = pitch - (p.hipsPitch + p[k.leg] + knee);
}

export function createPedRig(person) {
  const bones = {};
  const list = [];
  const group = new THREE.Group();
  const tilt = new THREE.Object3D();
  const lean = new THREE.Object3D();
  group.add(tilt);
  tilt.add(lean);
  for (const [name, parent, x, y, z, rz] of person.bones) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    b.rotation.z = rz;
    (parent ? bones[parent] : lean).add(b);
    bones[name] = b;
    list.push(b);
  }
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  for (const [t] of SIDES) {
    bones['shoulder' + t].rotation.order = 'XZY';
    bones['hip' + t].rotation.order = 'XZY';
    bones['wrist' + t].rotation.order = 'YXZ';
  }
  const b = bones;
  const sides = SIDES.map(([t, s]) => ({ s, k: K[t], eye: b['eye' + t], clavicle: b['clavicle' + t], shoulder: b['shoulder' + t], elbow: b['elbow' + t], wrist: b['wrist' + t], hip: b['hip' + t], knee: b['knee' + t], ankle: b['ankle' + t], toe: b['toe' + t] }));

  function apply(c) {
    lean.rotation.set(c.leanPitch, 0, c.leanRoll);
    b.hips.position.set(c.hipsShift, c.hipsY, c.hipsFwd);
    b.hips.rotation.set(c.hipsPitch, c.hipsYaw, c.hipsRoll);
    const sideBend = -c.hipsRoll * 0.6 + c.spineRoll;
    b.spine.rotation.set(c.spinePitch * 0.5, c.spineTwist * 0.45, sideBend * 0.5);
    b.chest.rotation.set(c.spinePitch * 0.5, c.spineTwist * 0.55, sideBend * 0.5);
    b.neck.rotation.set(c.headPitch * 0.35, c.headYaw * 0.35, c.headRoll * 0.35);
    b.head.rotation.set(c.headPitch * 0.65, c.headYaw * 0.65, c.headRoll * 0.65);
    for (let i = 0; i < 2; i++) {
      const o = sides[i];
      const s = o.s;
      const k = o.k;
      o.eye.rotation.set(c.eyePitch, c.eyeYaw, 0);
      const arm = c[k.arm];
      const out = c[k.armOut];
      const lift = Math.max(0, out - 0.75) * 0.32 + Math.max(0, -arm - 1.1) * 0.22 + c[k.shrug];
      const pro = Math.max(0, -arm - 0.3) * 0.12 - Math.max(0, arm - 0.3) * 0.08;
      o.clavicle.rotation.set(0, -s * pro, s * lift);
      o.shoulder.rotation.set(arm, s * c[k.armTwist], s * out);
      o.elbow.rotation.set(-c[k.elbow], 0, 0);
      o.wrist.rotation.set(-c[k.wristSide], s * c[k.forearm], -s * c[k.wrist]);
      o.hip.rotation.set(c[k.leg], s * c[k.legTwist], s * c[k.legOut]);
      o.knee.rotation.set(c[k.knee], 0, 0);
      o.ankle.rotation.set(c[k.foot], 0, -s * c[k.legOut] * 0.85);
      o.toe.rotation.set(c[k.toe], 0, 0);
    }
  }

  return { group, tilt, lean, bones, list, skeleton, apply };
}
