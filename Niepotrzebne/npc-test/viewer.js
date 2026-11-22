// Costa del Gzowo: standalone pedestrian and traffic model viewer under the game's lighting (line-ups, frozen poses, camera presets).
import * as THREE from 'three';
import { Assets } from '../../src/core/assets.js';
import { createLighting } from '../../src/render/lighting.js';
import { loadPeds } from '../../src/npc/ped/assets.js';
import { createPedMaterial, applyLook } from '../../src/npc/ped/material.js';
import { createPedRig } from '../../src/npc/ped/rig.js';
import { createPedAnimator, ACT } from '../../src/npc/ped/animator.js';
import { buildCar, buildWheel, CAR_TYPES } from '../../src/npc/traffic/carModels.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 300);
const assets = new Assets(renderer);
const lighting = await createLighting({ renderer, scene, camera, assets });
const ctx = { renderer, scene, camera, assets, lighting, time: { value: 0 } };
const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a847a, roughness: 0.9 });
lighting.register(groundMat);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), groundMat);
ground.receiveShadow = true;
scene.add(ground);

const pack = await loadPeds();
const actors = [];
let seed = 7;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

function spawn(id, look, x, z = 0, far = false) {
  const person = pack.byId[id];
  const rig = createPedRig(person.meta);
  const material = createPedMaterial(ctx);
  applyLook(material, person.meta, person.meta.looks[look % person.meta.looks.length]);
  const mesh = new THREE.SkinnedMesh(far ? person.far : person.near, material);
  mesh.bind(rig.skeleton, new THREE.Matrix4());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  rig.group.add(mesh);
  rig.group.scale.setScalar(person.meta.height);
  rig.group.position.set(x, 0, z);
  scene.add(rig.group);
  const animator = createPedAnimator(rig, person.meta, random);
  const st = { speed: 0, turn: 0, mode: 'foot', act: 0, look: false, lookYaw: 0, lookPitch: 0, seat: 0.5, flail: 0, rise: 0, face: 0 };
  const actor = { id, person, rig, mesh, animator, st };
  actors.push(actor);
  return actor;
}

const look = { pos: new THREE.Vector3(0, 1.2, 9), target: new THREE.Vector3(0, 0.95, 0) };
window.__line = (ids, { spacing = 0.95, lookIndex = 0, far = false, z = 0 } = {}) => {
  for (const a of actors) scene.remove(a.rig.group);
  actors.length = 0;
  const list = ids === 'all' ? pack.people.map((p) => p.id) : ids;
  list.forEach((id, i) => spawn(id, lookIndex, (i - (list.length - 1) / 2) * spacing, z, far));
  return actors.map((a) => `${a.id}:${a.person.meta.tris}/${a.person.meta.farTris}`);
};
window.__set = (state, index = -1) => {
  for (const [i, a] of actors.entries()) if (index < 0 || i === index) Object.assign(a.st, state);
};
window.__yaw = (yaw, index = -1) => {
  for (const [i, a] of actors.entries()) if (index < 0 || i === index) a.rig.group.rotation.y = yaw;
};
window.__tilt = (x, y, index = -1) => {
  for (const [i, a] of actors.entries()) if (index < 0 || i === index) {
    a.rig.tilt.rotation.x = x;
    a.rig.tilt.position.y = y;
  }
};
window.__cam = (px, py, pz, tx, ty, tz, fov = 32) => {
  look.pos.set(px, py, pz);
  look.target.set(tx, ty, tz);
  camera.fov = fov;
  camera.updateProjectionMatrix();
};
window.__run = (seconds, dt = 1 / 60) => {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) for (const a of actors) a.animator.update(dt, a.st);
  draw();
  return renderer.info.render.triangles;
};
window.__cars = (colors = [0x7a1512, 0x1d3f6e, 0xe9e6de, 0x3f5d4a]) => {
  for (const a of actors) scene.remove(a.rig.group);
  actors.length = 0;
  const wheel = buildWheel();
  const out = [];
  Object.keys(CAR_TYPES).forEach((type, i) => {
    const m = buildCar(type);
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: colors[i], metalness: 0.45, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06 });
    const trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1316, roughness: 0.03, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    for (const mat of [paint, trim]) lighting.register(mat);
    const a = new THREE.Mesh(m.paint, paint);
    a.castShadow = true;
    a.receiveShadow = true;
    g.add(a, new THREE.Mesh(m.trim, trim), new THREE.Mesh(m.glass, glass));
    for (const ax of [m.dims.wheelbase / 2, -m.dims.wheelbase / 2]) for (const s of [1, -1]) {
      const w = new THREE.Mesh(wheel, trim);
      w.position.set(ax, m.dims.radius, s * (m.dims.track / 2 - 0.02));
      w.scale.set(m.dims.radius, m.dims.radius, 0.21);
      if (s < 0) w.rotation.y = Math.PI;
      w.castShadow = true;
      g.add(w);
    }
    g.position.set(0, 0, (i - 1.5) * 3.2);
    scene.add(g);
    out.push(`${type}:${(m.paint.index.count + m.trim.index.count + m.glass.index.count) / 3}`);
  });
  return out;
};
window.__ACT = ACT;
window.__actors = actors;
window.__renderer = renderer;

function draw() {
  camera.position.copy(look.pos);
  camera.lookAt(look.target);
  camera.updateMatrixWorld();
  lighting.update();
  renderer.render(scene, camera);
}
let live = new URLSearchParams(location.search).has('live');
let last = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (live) for (const a of actors) a.animator.update(dt, a.st);
  draw();
}
window.__line(pack.people.map((p) => p.id));
window.__run(0.5);
requestAnimationFrame(frame);
window.__ready = true;
