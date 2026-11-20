// Costa del Gzowo: avatar skeleton (contract dimensions, A-pose bind, finger chains) and bind-space frames for sculpting.
import * as THREE from 'three';
import { Frame } from './sdf.js';

export { DIM, BIND_ARM, BIND_LEG, SIDES, FINGERS, THUMB } from './anatomy.js';
import { DIM, BIND_ARM, BIND_LEG, SIDES, FINGERS, THUMB } from './anatomy.js';

export function createSkeleton() {
  const bones = {};
  const list = [];
  const bone = (name, parent, x, y, z) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones[name] = b;
    list.push(b);
    return b;
  };
  const lean = new THREE.Object3D();
  lean.name = 'lean';
  const hips = bone('hips', null, 0, DIM.hip, 0);
  lean.add(hips);
  const spine = bone('spine', hips, 0, 0.06, 0);
  const chest = bone('chest', spine, 0, 0.2, 0);
  const neck = bone('neck', chest, 0, 0.27, -0.03);
  const head = bone('head', neck, 0, 0.14, 0.03);
  for (const [t, s] of SIDES) {
    bone('eye' + t, head, s * 0.032, 0.072, 0.067);
    bone('lid' + t, head, s * 0.032, 0.072, 0.067);
    const clav = bone('clavicle' + t, chest, s * 0.025, 0.2, 0.035);
    const shoulder = bone('shoulder' + t, clav, s * (DIM.shoulder - 0.025), 0.025, -0.035);
    const elbow = bone('elbow' + t, shoulder, 0, -DIM.upperArm, 0);
    const twist = bone('twist' + t, elbow, 0, -DIM.forearm / 2, 0);
    const wrist = bone('wrist' + t, twist, 0, -DIM.forearm / 2, 0);
    shoulder.rotation.set(0, 0, s * BIND_ARM);
    for (const [name, f] of Object.entries(FINGERS)) {
      let parent = wrist;
      let p = [s * f.base[0], f.base[1], f.base[2]];
      for (let q = 0; q < 3; q++) {
        const b = bone(`${name}${q}${t}`, parent, ...p);
        if (q === 0) b.rotation.x = -f.spread;
        parent = b;
        p = [0, -f.len[q], 0];
      }
    }
    const dir = new THREE.Vector3(s * THUMB.dir[0], THUMB.dir[1], THUMB.dir[2]).normalize();
    const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    let parent = wrist;
    let p = [s * THUMB.base[0], THUMB.base[1], THUMB.base[2]];
    for (let q = 0; q < 3; q++) {
      const b = bone(`thumb${q}${t}`, parent, ...p);
      if (q === 0) b.quaternion.copy(q0);
      parent = b;
      p = [0, -THUMB.len[q], 0];
    }
    const hip = bone('hip' + t, hips, s * DIM.hipHalf, 0, 0);
    hip.rotation.set(0, 0, s * BIND_LEG);
    const knee = bone('knee' + t, hip, 0, -DIM.thigh, 0);
    const ankle = bone('ankle' + t, knee, 0, -DIM.shin, 0);
    ankle.rotation.set(0, 0, -s * BIND_LEG);
    bone('toe' + t, ankle, 0, -0.045, 0.138);
  }
  lean.updateMatrixWorld(true);
  const bind = {};
  const bindQuat = {};
  for (const b of list) {
    bind[b.name] = b.matrixWorld.clone();
    bindQuat[b.name] = b.quaternion.clone();
  }
  const index = Object.fromEntries(list.map((b, i) => [b.name, i]));
  const frame = (name) => Frame.fromMatrix(bind[name]);
  const thumbAxis = {};
  for (const [t, s] of SIDES) {
    const dir = new THREE.Vector3(s * THUMB.dir[0], THUMB.dir[1], THUMB.dir[2]).normalize();
    const flex = new THREE.Vector3(s * THUMB.flex[0], THUMB.flex[1], THUMB.flex[2]).normalize();
    const axisWrist = new THREE.Vector3().crossVectors(dir, flex).normalize();
    thumbAxis[t] = axisWrist.applyQuaternion(bindQuat['thumb0' + t].clone().invert());
  }
  return { lean, bones, list, index, bind, bindQuat, frame, thumbAxis };
}
