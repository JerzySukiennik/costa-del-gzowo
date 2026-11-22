// Costa del Gzowo: the default hand-sculpted avatar (skinned layers on one skeleton driven by the procedural animator).
import * as THREE from 'three';
import { createSkeleton, DIM, SIDES } from './skeleton.js';
import { buildAvatar } from './build.js';
import { createAnimator } from './animator.js';
import { skinMaterial, eyeMaterial, hairMaterial, shirtMaterial, denimMaterial, shoeMaterial, gearMaterial } from './shading.js';

const SHADOWS = { skin: true, hair: true, shirt: true, shorts: true, shoes: true, eyes: false, gear: false };

let prepared = null;

export function prepareDefaultAvatar() {
  prepared ||= (async () => {
    const skel = createSkeleton();
    return { skel, ...(await buildAvatar(skel)) };
  })();
  return prepared;
}

export async function createDefaultAvatar(ctx) {
  const { skel, geos, stats } = await prepareDefaultAvatar();
  prepared = null;
  const denim = await ctx.assets.pbr('denim_fabric', { repeat: 1 });
  const materials = {
    skin: skinMaterial(ctx),
    eyes: eyeMaterial(ctx),
    hair: hairMaterial(ctx),
    shirt: shirtMaterial(ctx),
    shorts: denimMaterial(ctx, denim),
    shoes: shoeMaterial(ctx),
    gear: gearMaterial(ctx),
  };
  const group = new THREE.Group();
  group.name = 'player';
  const skeleton = new THREE.Skeleton(skel.list);
  group.add(skel.lean);
  const meshes = {};
  for (const [name, geo] of Object.entries(geos)) {
    const mesh = new THREE.SkinnedMesh(geo, materials[name]);
    mesh.name = 'avatar-' + name;
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.castShadow = SHADOWS[name];
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    meshes[name] = mesh;
  }
  const animator = createAnimator(skel, group);
  const b = skel.bones;
  const joints = { hips: b.hips, spine: b.spine, neck: b.neck, head: b.head, arms: {}, legs: {} };
  for (const [t, s] of SIDES) {
    joints.arms[t] = { shoulder: b['shoulder' + t], elbow: b['elbow' + t], wrist: b['wrist' + t], side: s };
    joints.legs[t] = { hip: b['hip' + t], knee: b['knee' + t], ankle: b['ankle' + t], side: s };
  }
  return {
    group,
    height: 1.8,
    joints,
    dimensions: DIM,
    update(dt, state) {
      animator.update(dt, state);
    },
    snap(state) {
      animator.snap(state);
    },
    setScripted(pose, rate = 10) {
      animator.setScripted(pose, rate);
    },
    reach(side, point) {
      animator.reach(side, point);
    },
    debug: { skel, animator, meshes, materials, stats },
  };
}
