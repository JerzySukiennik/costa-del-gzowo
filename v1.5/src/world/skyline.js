// Costa del Gzowo: distant city skyline in the haze (instanced towers with procedural curtain walls), radio mast and far causeway.
import * as THREE from 'three';
import { hookMaterial } from '../render/shaderHooks.js';
import { rng } from './scatter.js';

const PARS = `
attribute vec3 aStyle;
varying vec3 vStyle;
varying vec3 vLocal;
varying vec3 vScale;
`;
const VERTEX = `
{
  vStyle = aStyle;
  vLocal = position;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
}
`;
const FRAG_PARS = `
varying vec3 vStyle;
varying vec3 vLocal;
varying vec3 vScale;
float gWindow;
`;
const COLOR = `
{
  vec3 m = vLocal * vScale;
  float side = abs(vWNormal.x) > abs(vWNormal.z) ? m.z : m.x;
  float floorH = 3.6;
  float bay = mix(1.6, 3.4, vStyle.y);
  vec2 cell = vec2(side / bay, m.y / floorH);
  vec2 f = fract(cell);
  vec2 id = floor(cell);
  float mullion = step(0.12, f.x) * step(f.x, 0.88);
  float spandrel = step(mix(0.22, 0.42, vStyle.z), f.y);
  float win = mullion * spandrel * step(abs(vWNormal.y), 0.5);
  float rnd = fract(sin(dot(id + vStyle.x * 37.0, vec2(127.1, 311.7))) * 43758.5453);
  vec3 glass = mix(vec3(0.05, 0.09, 0.12), vec3(0.16, 0.24, 0.3), rnd * 0.6 + vStyle.x * 0.3);
  vec3 frame = mix(vec3(0.5, 0.5, 0.48), vec3(0.78, 0.74, 0.68), vStyle.x);
  frame = mix(frame, vec3(0.3, 0.33, 0.36), step(0.72, vStyle.z));
  diffuseColor.rgb = mix(frame, glass, win);
  gWindow = win;
}
`;
const ROUGH = `
roughnessFactor = mix(0.75, 0.08, gWindow);
`;

export function createSkyline(ctx) {
  const { scene, lighting } = ctx;
  const random = rng(2026);
  const group = new THREE.Group();
  group.name = 'skyline';
  const towers = [];
  const districts = [
    { cx: 1500, cz: -260, rx: 420, rz: 520, n: 46, hMin: 60, hMax: 250 },
    { cx: 1250, cz: 620, rx: 300, rz: 280, n: 22, hMin: 35, hMax: 130 },
    { cx: 1780, cz: -980, rx: 320, rz: 260, n: 18, hMin: 40, hMax: 150 },
    { cx: 420, cz: 1650, rx: 380, rz: 240, n: 20, hMin: 45, hMax: 170 },
  ];
  for (const d of districts) {
    for (let i = 0; i < d.n; i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random());
      const core = 1 - r;
      const h = d.hMin + (d.hMax - d.hMin) * Math.pow(random(), 1.8) * (0.35 + 0.65 * core);
      const w = 26 + random() * 34;
      const dp = 26 + random() * 30;
      towers.push({ x: d.cx + Math.cos(a) * r * d.rx, z: d.cz + Math.sin(a) * r * d.rz, w, d: dp, h, yaw: (random() - 0.5) * 0.5, style: [random(), random(), random()] });
      if (h > 120 && random() < 0.7) {
        const t = towers[towers.length - 1];
        towers.push({ x: t.x, z: t.z, w: w * 0.62, d: dp * 0.62, h: h * (1.12 + random() * 0.14), yaw: t.yaw, style: t.style });
      }
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const style = new Float32Array(towers.length * 3);
  const material = hookMaterial(new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 }), {
    key: 'skyline',
    pars: PARS,
    fragPars: FRAG_PARS,
    vertex: VERTEX,
    color: COLOR,
    rough: ROUGH,
  });
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    inner(shader, r);
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(0.0, 0.85, gWindow);');
  };
  lighting.register(material);
  const mesh = new THREE.InstancedMesh(geo, material, towers.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  towers.forEach((t, i) => {
    q.setFromAxisAngle(up, t.yaw);
    m.compose(new THREE.Vector3(t.x, -4, t.z), q, new THREE.Vector3(t.w, t.h, t.d));
    mesh.setMatrixAt(i, m);
    style.set(t.style, i * 3);
  });
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 3));
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  group.add(mesh);

  const mastMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a8, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 1.2, 0.6), toneMapped: false });
  lighting.register(mastMat);
  const mast = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 160, 6), mastMat);
  shaft.position.y = 80;
  mast.add(shaft);
  for (const y of [158, 106, 54]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), lampMat);
    lamp.position.y = y;
    mast.add(lamp);
  }
  mast.position.set(-520, 12, -760);
  mast.updateMatrixWorld(true);
  mast.traverse((o) => (o.matrixAutoUpdate = false));
  group.add(mast);

  const causewayMat = new THREE.MeshStandardMaterial({ color: 0xa9a59c, roughness: 0.85 });
  lighting.register(causewayMat);
  const causeway = new THREE.Group();
  const span = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 1500), causewayMat);
  span.position.set(0, 21, 0);
  causeway.add(span);
  for (let z = -720; z <= 720; z += 48) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(11, 24, 3), causewayMat);
    pier.position.set(0, 9, z);
    causeway.add(pier);
  }
  causeway.position.set(960, 0, 200);
  causeway.rotation.y = 0.32;
  causeway.updateMatrixWorld(true);
  causeway.traverse((o) => (o.matrixAutoUpdate = false));
  group.add(causeway);

  scene.add(group);
  return { group, lamps: lampMat };
}
