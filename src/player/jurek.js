// Costa del Gzowo: Jurek's avatar (hoodie with the hood up, sweatpants, Crocs, blob head) as a skin driven by the player character's joints.
import * as THREE from 'three';
import { hookMaterial } from '../render/shaderHooks.js';
import { createBlobHead } from './blobHead.js';

const BASE = 'assets/avatars/jurek/';
const DOWN = new THREE.Vector3(0, -1, 0);
const X = new THREE.Vector3(1, 0, 0);
const IDENTITY = new THREE.Quaternion();
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];

export async function createJurekSkin(ctx, character) {
  const { assets, lighting, camera } = ctx;
  const gltf = await assets.track(assets.gltfLoader.loadAsync(BASE + 'body.glb'));
  const root = gltf.scene;
  root.name = 'jurek';
  const bones = new Map();
  root.traverse((o) => {
    if (o.isBone) bones.set(o.name, o);
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
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
  for (const name of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftFoot', 'RightFoot']) plain(name);
  for (const side of ['Left', 'Right']) {
    limb(side + 'Arm', side + 'ForeArm');
    limb(side + 'ForeArm', side + 'Hand');
    limb(side + 'Hand', side + 'HandMiddle1');
    limb(side + 'UpLeg', side + 'Leg');
    limb(side + 'Leg', side + 'Foot');
  }

  const head = await createBlobHead({ base: BASE, bones, lighting, parent: root });
  const lift = head.meta.lift || 0;
  let neck = null;
  root.traverse((o) => {
    if (o.isMesh && o.material.name === 'NeckBacking') neck = o;
  });
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
  const qSpine = new THREE.Quaternion();
  const qHeadLocal = new THREE.Quaternion();
  const qSrc = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const hoodBase = bones.get('Cloth_Hood_Base');
  let grip = 0.3;

  function setWorld(name, parentName, world) {
    out.get(name).copy(world);
    bones.get(name).quaternion.copy(q.copy(out.get(parentName)).invert()).multiply(world);
  }
  function keepRest(name, parentName) {
    out.get(name).copy(out.get(parentName)).multiply(restQ.get(name));
    bones.get(name).quaternion.copy(restQ.get(name));
  }
  function drive(name, parentName, source) {
    setWorld(name, parentName, q2.copy(source).multiply(pre.get(name)));
  }

  function sync(dt, state) {
    const j = character.joints;
    const hipHeight = character.dimensions.hip;
    const hips = bones.get('Hips');
    const standing = THREE.MathUtils.clamp(j.hips.position.y / hipHeight, 0, 1);
    hips.position.set(restP.get('Hips').x + j.hips.position.x, restP.get('Hips').y + j.hips.position.y - hipHeight + lift * standing, restP.get('Hips').z + j.hips.position.z);
    out.get('Hips').copy(j.hips.quaternion).multiply(pre.get('Hips'));
    hips.quaternion.copy(out.get('Hips'));

    const spineNames = ['Spine', 'Spine1', 'Spine2'];
    for (let k = 0; k < 3; k++) {
      qSrc.copy(j.hips.quaternion).multiply(q2.copy(IDENTITY).slerp(j.spine.quaternion, (k + 1) / 3));
      setWorld(spineNames[k], k ? spineNames[k - 1] : 'Hips', q2.copy(qSrc).multiply(pre.get(spineNames[k])));
    }
    qSpine.copy(j.hips.quaternion).multiply(j.spine.quaternion);
    qHeadLocal.copy(j.neck.quaternion).multiply(j.head.quaternion);
    qSrc.copy(qSpine).multiply(q2.copy(IDENTITY).slerp(qHeadLocal, 0.4));
    setWorld('Neck', 'Spine2', q2.copy(qSrc).multiply(pre.get('Neck')));
    qSrc.copy(qSpine).multiply(qHeadLocal);
    setWorld('Head', 'Neck', q2.copy(qSrc).multiply(pre.get('Head')));
    if (hoodBase) {
      const headBone = bones.get('Head');
      q2.copy(headBone.quaternion).multiply(q.copy(restQ.get('Head')).invert());
      q2.copy(q.copy(IDENTITY).slerp(q2, 0.9));
      hoodBase.position.copy(v.copy(restP.get('Cloth_Hood_Base')).sub(restP.get('Head')).applyQuaternion(q2).add(restP.get('Head')));
      hoodBase.quaternion.copy(q2).multiply(restQ.get('Cloth_Hood_Base'));
    }

    const wantGrip = state && state.mode === 'sit' ? 0.85 : 0.3;
    grip += (wantGrip - grip) * Math.min(1, dt * 8 + (dt === 0 ? 1 : 0));
    for (const [side, tag] of [['Left', 'L'], ['Right', 'R']]) {
      const arm = j.arms[tag];
      keepRest(side + 'Shoulder', 'Spine2');
      qSrc.copy(qSpine).multiply(arm.shoulder.quaternion);
      drive(side + 'Arm', side + 'Shoulder', qSrc);
      qSrc.multiply(arm.elbow.quaternion);
      drive(side + 'ForeArm', side + 'Arm', qSrc);
      qSrc.multiply(arm.wrist.quaternion);
      drive(side + 'Hand', side + 'ForeArm', qSrc);
      for (const finger of FINGERS) for (let i = 1; i <= 3; i++) {
        const name = `${side}Hand${finger}${i}`;
        const bone = bones.get(name);
        if (bone) bone.quaternion.copy(restQ.get(name)).multiply(q.setFromAxisAngle(X, grip * (finger === 'Thumb' ? 0.4 : 1) * (i === 1 ? 0.9 : 1.05)));
      }
      const leg = j.legs[tag];
      qSrc.copy(j.hips.quaternion).multiply(leg.hip.quaternion);
      drive(side + 'UpLeg', 'Hips', qSrc);
      qSrc.multiply(leg.knee.quaternion);
      drive(side + 'Leg', side + 'UpLeg', qSrc);
      qSrc.multiply(leg.ankle.quaternion);
      drive(side + 'Foot', side + 'Leg', qSrc);
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
