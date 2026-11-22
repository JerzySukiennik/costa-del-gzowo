// Costa del Gzowo: Jurek's avatar (hoodie with the hood up, sweatpants, Crocs, blob head) as a skin that follows the player character's joints.
import * as THREE from 'three';
import { hookMaterial } from '../render/shaderHooks.js';
import { createBlobHead } from './blobHead.js';

const BASE = 'assets/avatars/jurek/';
const DOWN = new THREE.Vector3(0, -1, 0);
const X = new THREE.Vector3(1, 0, 0);
const IDENTITY = new THREE.Quaternion();
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
const SPINE = ['Spine', 'Spine1', 'Spine2'];

export async function createJurekSkin(ctx, character) {
  const { assets, lighting, camera } = ctx;
  const gltf = await assets.track(assets.gltfLoader.loadAsync(BASE + 'body.glb'));
  const root = gltf.scene;
  root.name = 'jurek';
  const bones = new Map();
  let neck = null;
  root.traverse((o) => {
    if (o.isBone) bones.set(o.name, o);
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    if (o.material.name === 'NeckBacking') neck = o;
    for (const m of [].concat(o.material)) {
      hookMaterial(m, { key: 'jurek', dynamic: true });
      lighting.register(m);
    }
  });
  root.updateMatrixWorld(true);

  const restQ = new Map();
  const restP = new Map();
  const worldQ = new Map();
  const worldP = new Map();
  for (const [name, bone] of bones) {
    restQ.set(name, bone.quaternion.clone());
    restP.set(name, bone.position.clone());
    worldQ.set(name, bone.getWorldQuaternion(new THREE.Quaternion()));
    worldP.set(name, bone.getWorldPosition(new THREE.Vector3()));
  }
  const pre = new Map();
  const plain = (name) => pre.set(name, worldQ.get(name).clone());
  const limb = (name, child) => {
    const dir = worldP.get(child).clone().sub(worldP.get(name)).normalize();
    pre.set(name, new THREE.Quaternion().setFromUnitVectors(dir, DOWN).multiply(worldQ.get(name)));
  };
  for (const name of ['Hips', ...SPINE, 'Neck', 'Head', 'LeftFoot', 'RightFoot']) plain(name);
  for (const side of ['Left', 'Right']) {
    limb(side + 'Arm', side + 'ForeArm');
    limb(side + 'ForeArm', side + 'Hand');
    limb(side + 'Hand', side + 'HandMiddle1');
    limb(side + 'UpLeg', side + 'Leg');
    limb(side + 'Leg', side + 'Foot');
  }

  const head = await createBlobHead({ base: BASE, bones, lighting, parent: root });
  const lift = head.meta.lift || 0;
  if (neck && head.meta.skin) {
    const tone = head.meta.skin.map((c) => Math.pow(c, 2.2) * head.uniforms.uGain.value);
    neck.material.color.setRGB(tone[0], tone[1], tone[2], THREE.LinearSRGBColorSpace);
    neck.material.roughness = 0.7;
  }
  character.group.add(root);

  const out = new Map();
  for (const name of bones.keys()) out.set(name, new THREE.Quaternion());
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  const qC = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const hoodBase = bones.get('Cloth_Hood_Base');
  let grip = 0.3;

  function sourceQ(joint, target) {
    target.copy(joint.quaternion);
    for (let p = joint.parent; p && p !== character.group; p = p.parent) target.premultiply(p.quaternion);
    return target;
  }
  function sourceP(joint, target) {
    target.copy(joint.position);
    for (let p = joint.parent; p && p !== character.group; p = p.parent) target.applyQuaternion(p.quaternion).add(p.position);
    return target;
  }
  function setWorld(name, parentName, world) {
    out.get(name).copy(world);
    bones.get(name).quaternion.copy(q.copy(out.get(parentName)).invert()).multiply(world);
  }
  function keepRest(name, parentName) {
    out.get(name).copy(out.get(parentName)).multiply(restQ.get(name));
    bones.get(name).quaternion.copy(restQ.get(name));
  }
  function drive(name, parentName, joint) {
    setWorld(name, parentName, q2.copy(sourceQ(joint, qC)).multiply(pre.get(name)));
  }

  function sync(dt, state) {
    const j = character.joints;
    const hipHeight = character.dimensions.hip;
    const hips = bones.get('Hips');
    sourceP(j.hips, v);
    const standing = THREE.MathUtils.clamp(v.y / hipHeight, 0, 1);
    hips.position.set(restP.get('Hips').x + v.x, restP.get('Hips').y + v.y - hipHeight + lift * standing, restP.get('Hips').z + v.z);
    sourceQ(j.hips, qA);
    out.get('Hips').copy(qA).multiply(pre.get('Hips'));
    hips.quaternion.copy(out.get('Hips'));

    sourceQ(j.neck.parent, qB);
    for (let k = 0; k < 3; k++) setWorld(SPINE[k], k ? SPINE[k - 1] : 'Hips', q2.copy(qA).slerp(qB, (k + 1) / 3).multiply(pre.get(SPINE[k])));
    sourceQ(j.head, qA);
    setWorld('Neck', 'Spine2', q2.copy(qB).slerp(qA, 0.4).multiply(pre.get('Neck')));
    setWorld('Head', 'Neck', q2.copy(qA).multiply(pre.get('Head')));
    if (hoodBase) {
      q2.copy(bones.get('Head').quaternion).multiply(q.copy(restQ.get('Head')).invert());
      q2.copy(q.copy(IDENTITY).slerp(q2, 0.9));
      hoodBase.position.copy(v.copy(restP.get('Cloth_Hood_Base')).sub(restP.get('Head')).applyQuaternion(q2).add(restP.get('Head')));
      hoodBase.quaternion.copy(q2).multiply(restQ.get('Cloth_Hood_Base'));
    }

    const wantGrip = state && state.mode === 'sit' ? 0.85 : 0.3;
    grip += (wantGrip - grip) * (dt > 0 ? Math.min(1, dt * 8) : 1);
    for (const [side, tag] of [['Left', 'L'], ['Right', 'R']]) {
      const arm = j.arms[tag];
      keepRest(side + 'Shoulder', 'Spine2');
      drive(side + 'Arm', side + 'Shoulder', arm.shoulder);
      drive(side + 'ForeArm', side + 'Arm', arm.elbow);
      drive(side + 'Hand', side + 'ForeArm', arm.wrist);
      for (const finger of FINGERS) for (let i = 1; i <= 3; i++) {
        const name = `${side}Hand${finger}${i}`;
        const bone = bones.get(name);
        if (bone) bone.quaternion.copy(restQ.get(name)).multiply(q.setFromAxisAngle(X, grip * (finger === 'Thumb' ? 0.4 : 1) * (i === 1 ? 0.9 : 1.05)));
      }
      const leg = j.legs[tag];
      drive(side + 'UpLeg', 'Hips', leg.hip);
      drive(side + 'Leg', side + 'UpLeg', leg.knee);
      drive(side + 'Foot', side + 'Leg', leg.ankle);
    }
    head.update(camera);
  }

  return {
    group: root,
    bones,
    head,
    sync,
    setVisible(on) {
      root.visible = on;
    },
  };
}
