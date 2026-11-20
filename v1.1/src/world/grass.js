// Costa del Gzowo: camera-following instanced grass, shoreline reeds and underwater eelgrass with wind and body push.
import * as THREE from 'three';
import { LAYERS, WORLD } from '../config.js';
import { rng } from './scatter.js';

const PARS = `
attribute vec4 aInst;
attribute vec2 aBlade;
uniform sampler2D tHeight;
uniform sampler2D tVeg;
uniform sampler2D tNoise;
uniform vec3 uCam;
uniform float uTime;
uniform float uSpan;
uniform vec2 uHeights;
uniform float uChannel;
uniform float uWind;
uniform vec4 uPushA;
uniform vec4 uPushB;
varying float vT;
varying float vRand;
`;
const VERTEX = `
{
  vec2 base = mod(aInst.xy - uCam.xz + uSpan * 0.5, uSpan) + uCam.xz - uSpan * 0.5;
  float world = ${(WORLD.half * 2).toFixed(1)};
  float ground = texture2D(tHeight, (base + world * 0.5 + 0.5) / (world + 1.0)).r;
  vec4 veg = texture2D(tVeg, base / world + 0.5);
  float mask = veg.r;
  if (uChannel > 1.5) mask = smoothstep(-0.3, -0.7, ground) * smoothstep(-3.4, -2.2, ground) * step(0.5, texture2D(tNoise, base * 0.013).g) * 1.4;
  else if (uChannel > 0.5) mask = veg.g;
  float fade = 1.0 - smoothstep(uSpan * 0.36, uSpan * 0.485, distance(base, uCam.xz));
  float keep = step(aInst.w, mask) * fade;
  float hgt = mix(uHeights.x, uHeights.y, aInst.z) * (0.55 + 0.55 * mask) * keep;
  float yaw = aInst.w * 61.3;
  float cy = cos(yaw);
  float sy = sin(yaw);
  vec3 local = position;
  local.xz = mat2(cy, -sy, sy, cy) * local.xz;
  float t = aBlade.x;
  float gust = texture2D(tNoise, base * 0.021 + uTime * vec2(0.05, 0.031)).r;
  float flutter = sin(uTime * 5.5 + aInst.z * 40.0 + aBlade.y * 17.0);
  float bend = (0.1 + 0.6 * gust + flutter * 0.06) * uWind;
  if (uChannel > 1.5) bend = 0.55 + 0.25 * sin(uTime * 1.3 + base.x * 0.7 + base.y * 0.4 + aBlade.y * 3.0);
  vec3 wp = vec3(base.x, ground - 0.02, base.y) + vec3(local.x, 0.0, local.z) * step(0.001, hgt) + vec3(0.0, local.y * hgt, 0.0);
  vec2 windDir = uChannel > 1.5 ? vec2(0.12, 1.0) : vec2(0.8, 0.6);
  wp.xz += windDir * bend * t * t * hgt;
  wp.y -= bend * bend * t * t * hgt * 0.35;
  vec2 da = wp.xz - uPushA.xz;
  float ka = clamp(1.0 - length(da) / uPushA.w, 0.0, 1.0) * step(abs(ground - uPushA.y), 1.6);
  vec2 db = wp.xz - uPushB.xz;
  float kb = clamp(1.0 - length(db) / uPushB.w, 0.0, 1.0) * step(abs(ground - uPushB.y), 1.6);
  wp.xz += (normalize(da + 0.0001) * ka * ka + normalize(db + 0.0001) * kb * kb) * t * hgt * 0.8;
  wp.y -= max(ka, kb) * t * hgt * 0.75;
  transformed = wp;
  vT = t;
  vRand = aInst.z;
}
`;
const VERT_MAIN = `
varying vec3 vWPos;
varying vec3 vFace;
void main() {
  vec3 transformed = position;
  VERTEX_BODY
  vWPos = transformed;
  vFace = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(transformed, 1.0);
}`;
const FRAG = `
uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform vec3 uDryColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform sampler2D tShadow;
uniform mat4 uShadowMatrix;
uniform float uShadowOn;
uniform mat4 uCarInv;
uniform vec4 uBody;
varying float vT;
varying float vRand;
varying vec3 vWPos;
varying vec3 vFace;
float staticShadow(vec3 p) {
  vec4 sc = uShadowMatrix * vec4(p + uSunDir * 0.12, 1.0);
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0) return 1.0;
  vec2 t = vec2(1.0 / 4096.0);
  float s = step(sc.z - 0.0012, texture2D(tShadow, sc.xy).r);
  s += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(t.x, 0.0)).r);
  s += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + vec2(0.0, t.y)).r);
  s += step(sc.z - 0.0012, texture2D(tShadow, sc.xy + t).r);
  return s * 0.25;
}
float carShadow(vec3 p) {
  vec3 o = (uCarInv * vec4(p, 1.0)).xyz;
  vec3 d = mat3(uCarInv) * uSunDir;
  vec3 inv = 1.0 / d;
  vec3 t0 = (vec3(-2.4, 0.14, -0.93) - o) * inv;
  vec3 t1 = (vec3(2.25, 0.98, 0.93) - o) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  float near = max(max(tn.x, tn.y), tn.z);
  float far = min(min(tf.x, tf.y), tf.z);
  return far >= max(near, 0.0) ? 0.0 : 1.0;
}
float bodyShadow(vec3 p) {
  vec3 oc = uBody.xyz + vec3(0.0, 0.9, 0.0) - p;
  float along = dot(oc, uSunDir);
  float d2 = dot(oc, oc) - along * along;
  return along > 0.0 ? smoothstep(0.06, 0.2, d2 / max(uBody.w * uBody.w, 0.0001) * 0.16) : 1.0;
}
void main() {
  vec3 tip = mix(uTipColor, uDryColor, smoothstep(0.5, 0.95, vRand) * 0.85);
  vec3 col = mix(uBaseColor, tip, pow(vT, 0.75));
  vec3 n = normalize(vec3(vFace.x * 0.35, 1.0, vFace.z * 0.35));
  float shadow = uShadowOn > 0.5 ? staticShadow(vWPos) : 1.0;
  shadow *= carShadow(vWPos) * bodyShadow(vWPos);
  float ndl = clamp(dot(n, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  vec3 V = normalize(vWPos - cameraPosition);
  float back = pow(max(dot(V, uSunDir), 0.0), 2.0) * vT;
  vec3 light = uSunColor * 0.3183 * shadow * (ndl + back * 0.7) + uSkyColor * (0.45 + 0.55 * vT);
  gl_FragColor = vec4(col * light, 1.0);
}`;

function clumpGeometry(blades, width, segments, spread, seed) {
  const random = rng(seed);
  const pos = [];
  const nor = [];
  const blade = [];
  const idx = [];
  for (let b = 0; b < blades; b++) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * spread;
    const ox = Math.cos(a) * r;
    const oz = Math.sin(a) * r;
    const face = random() * Math.PI * 2;
    const fx = Math.cos(face);
    const fz = Math.sin(face);
    const lean = (random() - 0.3) * 0.35;
    const w = width * (0.7 + random() * 0.6);
    const tall = 0.65 + random() * 0.35;
    const id = random();
    const start = pos.length / 3;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const half = w * 0.5 * (1 - Math.pow(t, 1.6));
      const cx = ox + fz * lean * t * t;
      const cz = oz - fx * lean * t * t;
      if (s === segments) {
        pos.push(cx, t * tall, cz);
        nor.push(fz, 0, -fx);
        blade.push(t, id);
      } else {
        pos.push(cx - fx * half, t * tall, cz - fz * half, cx + fx * half, t * tall, cz + fz * half);
        nor.push(fz, 0, -fx, fz, 0, -fx);
        blade.push(t, id, t, id);
      }
    }
    for (let s = 0; s < segments - 1; s++) {
      const o = start + s * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    const o = start + (segments - 1) * 2;
    idx.push(o, o + 1, o + 2);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aBlade', new THREE.Float32BufferAttribute(blade, 2));
  geo.setIndex(idx);
  return geo;
}

export function createGrass(ctx, { density = 1 } = {}) {
  const { terrain, lighting, scene } = ctx;
  const grid = WORLD.half * 2 + 1;
  const heightTex = new THREE.DataTexture(terrain.heights, grid, grid, THREE.RedFormat, THREE.FloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
  const shared = {
    uCam: { value: new THREE.Vector3() }, uPushA: { value: new THREE.Vector4(0, -100, 0, 1) }, uPushB: { value: new THREE.Vector4(0, -100, 0, 1) },
    tShadow: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uCarInv: { value: new THREE.Matrix4().makeTranslation(0, -1000, 0) }, uBody: { value: new THREE.Vector4(0, -1000, 0, 0.3) },
  };

  function layer({ span, step, blades, width, segments, spread, heights, channel, wind, base, tip, dry, seed, roughness }) {
    const geo = clumpGeometry(blades, width, segments, spread, seed);
    const n = Math.floor(span / step);
    const random = rng(seed * 7 + 1);
    const inst = new Float32Array(n * n * 4);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const o = (j * n + i) * 4;
        inst[o] = (i + random()) * step;
        inst[o + 1] = (j + random()) * step;
        inst[o + 2] = random();
        inst[o + 3] = random() * 0.98 + 0.01;
      }
    }
    geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    geo.instanceCount = n * n;
    const material = new THREE.ShaderMaterial({
      vertexShader: PARS + VERT_MAIN.replace('VERTEX_BODY', VERTEX),
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        tHeight: { value: heightTex }, tVeg: { value: terrain.splat.texVeg }, tNoise: { value: terrain.noise }, uCam: shared.uCam, uTime: ctx.time,
        uSpan: { value: n * step }, uHeights: { value: new THREE.Vector2(...heights) }, uChannel: { value: channel }, uWind: { value: wind },
        uPushA: shared.uPushA, uPushB: shared.uPushB, uBaseColor: { value: new THREE.Color(...base) }, uTipColor: { value: new THREE.Color(...tip) },
        uDryColor: { value: new THREE.Color(...dry) }, uSunDir: { value: lighting.sunDirection }, uSunColor: { value: lighting.sunColor },
        uSkyColor: { value: new THREE.Color(0.34, 0.45, 0.54) }, tShadow: shared.tShadow, uShadowMatrix: shared.uShadowMatrix, uShadowOn: shared.uShadowOn,
        uCarInv: shared.uCarInv, uBody: shared.uBody,
      },
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.layers.set(LAYERS.DETAIL);
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  }

  const k = Math.sqrt(density);
  const meshes = [
    layer({ span: 84, step: 0.27 / k, blades: 5, width: 0.05, segments: 3, spread: 0.17, heights: [0.14, 0.46], channel: 0, wind: 0.5, base: [0.07, 0.13, 0.035], tip: [0.21, 0.33, 0.08], dry: [0.4, 0.37, 0.17], seed: 3, roughness: 0.62 }),
    layer({ span: 120, step: 0.62 / k, blades: 6, width: 0.045, segments: 3, spread: 0.28, heights: [0.9, 1.9], channel: 1, wind: 0.32, base: [0.045, 0.085, 0.02], tip: [0.24, 0.36, 0.09], dry: [0.5, 0.43, 0.2], seed: 5, roughness: 0.55 }),
    layer({ span: 100, step: 0.75 / k, blades: 5, width: 0.07, segments: 3, spread: 0.24, heights: [0.5, 1.3], channel: 2, wind: 1, base: [0.015, 0.05, 0.02], tip: [0.07, 0.2, 0.05], dry: [0.12, 0.2, 0.06], seed: 8, roughness: 0.5 }),
  ];

  return {
    meshes,
    setShadow(texture, matrix) {
      shared.tShadow.value = texture;
      shared.uShadowMatrix.value.copy(matrix);
      shared.uShadowOn.value = 1;
    },
    update(camera, pushA, pushB, carMatrixWorld, body) {
      shared.uCam.value.copy(camera);
      if (pushA) shared.uPushA.value.copy(pushA);
      if (pushB) shared.uPushB.value.copy(pushB);
      if (carMatrixWorld) shared.uCarInv.value.copy(carMatrixWorld).invert();
      if (body) shared.uBody.value.copy(body);
    },
  };
}
