// Costa del Gzowo: standalone avatar viewer with camera presets, frozen states and side-by-side cycle strips.
import * as THREE from 'three';
import { Assets } from '../../src/core/assets.js';
import { createLighting } from '../../src/render/lighting.js';
import { createCharacter } from '../../src/player/character.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 300);
camera.position.set(0, 1.2, 4);
const assets = new Assets(renderer);
const lighting = await createLighting({ renderer, scene, camera, assets });
const ctx = { renderer, scene, camera, assets, lighting, time: { value: 0 } };
const t0 = performance.now();
const ch = await createCharacter(ctx);
const buildMs = Math.round(performance.now() - t0);
scene.add(ch.group);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a847a, roughness: 0.9 });
lighting.register(groundMat);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), groundMat);
ground.receiveShadow = true;
scene.add(ground);

let state = { mode: 'foot', speed: 0, vy: 0, wade: 0, steer: 0, throttle: 0 };
let frozen = null;
let strip = null;
let look = { pos: new THREE.Vector3(0, 1.0, 4.2), target: new THREE.Vector3(0, 0.95, 0) };
const VIEWS = {
  front: [[0, 1.0, 4.4], [0, 0.92, 0]],
  three: [[2.4, 1.25, 3.4], [0, 0.92, 0]],
  side: [[4.3, 1.0, 0], [0, 0.92, 0]],
  back: [[0, 1.1, -4.3], [0, 0.92, 0]],
  face: [[0.0, 1.69, 0.62], [0, 1.66, 0]],
  face34: [[0.38, 1.7, 0.5], [0, 1.665, 0.03]],
  faceside: [[0.62, 1.68, 0.05], [0, 1.665, 0.03]],
  hand: [[0.62, 0.92, 0.5], [0.27, 0.86, 0.02]],
  feet: [[0.6, 0.35, 1.0], [0.0, 0.1, 0.1]],
  torso: [[0.8, 1.3, 1.6], [0, 1.2, 0]],
  strip: [[2.0, 1.05, 7.2], [2.0, 0.9, 0]],
};
function view(name, ox = 0) {
  const v = VIEWS[name];
  look.pos.set(v[0][0] + ox, v[0][1], v[0][2]);
  look.target.set(v[1][0] + ox, v[1][1], v[1][2]);
}
window.__view = (name, opts = {}) => {
  view(name);
  if (opts.fov) camera.fov = opts.fov;
  if (opts.pos) look.pos.set(...opts.pos);
  if (opts.target) look.target.set(...opts.target);
  if (opts.yaw !== undefined) ch.group.rotation.y = opts.yaw;
  camera.updateProjectionMatrix();
};
window.__state = (s) => {
  frozen = null;
  strip = null;
  state = { ...state, ...s };
};
window.__freeze = (s, phase = 0) => {
  strip = null;
  state = { ...state, ...s };
  ch.snap(state);
  ch.debug.animator.phase = phase;
  ch.update(0, state);
  frozen = true;
};
window.__strip = (s, n = 6, spacing = 0.85, phases) => {
  state = { ...state, ...s };
  ch.snap(state);
  strip = { n, spacing, phases: phases || [...Array(n).keys()].map((i) => i / n) };
  frozen = true;
};
window.__ch = ch;
window.__wheel = () => {
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.0165, 12, 40), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  wheel.position.set(0, 0.39, 0.5);
  wheel.rotation.x = -0.36;
  ch.group.add(wheel);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x5a3a28 }));
  seat.position.set(0, -0.06, -0.02);
  ch.group.add(seat);
  return wheel;
};
window.__scene = scene;
window.__three = THREE;
window.__renderer = renderer;
window.__info = () => ({ buildMs, stats: ch.debug.stats, calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
document.getElementById('info').textContent = `build ${buildMs} ms, tris ${ch.debug.stats.tris}`;

const clock = new THREE.Clock();
renderer.autoClear = false;
let frames = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  camera.position.copy(look.pos);
  camera.lookAt(look.target);
  ctx.time.value += dt;
  renderer.info.reset();
  renderer.info.autoReset = false;
  renderer.clear();
  if (strip) {
    camera.updateMatrixWorld();
    lighting.update();
    const bg = scene.background;
    strip.phases.forEach((ph, i) => {
      scene.background = i === 0 ? bg : null;
      ch.group.position.x = i * strip.spacing;
      ch.snap(state);
      ch.debug.animator.phase = ph;
      ch.update(0, state);
      ground.visible = i === 0;
      renderer.render(scene, camera);
    });
    scene.background = bg;
    ch.group.position.x = 0;
    ground.visible = true;
  } else {
    if (!frozen) ch.update(dt, state);
    camera.updateMatrixWorld();
    lighting.update();
    renderer.render(scene, camera);
  }
  if (++frames === 5) window.__ready = true;
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  lighting.resize();
});
frame();
