// Costa del Gzowo: trees with mesh LODs that end in baked impostors (chosen by size on screen), procedural palms, small trees and the far forest, whose nearest trees become real models.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from '../config.js';
import { heightAt, townDistance } from './heightfield.js';
import { hookMaterial } from '../render/shaderHooks.js';
import { rng, pickPoints, clearOfBuilt, slopeAt, bakeMesh, variantsOf, instancedVariant } from './scatter.js';

const FOLIAGE_PARS = `
uniform float uTime;
uniform vec3 uSunDir;
uniform float uWind;
`;
const FOLIAGE_VERTEX = `
{
  vec4 wp0 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp0 = instanceMatrix * wp0;
  #endif
  wp0 = modelMatrix * wp0;
  float ph = wp0.x * 0.31 + wp0.z * 0.27;
  float sway = sin(uTime * 1.1 + ph) * 0.6 + sin(uTime * 2.3 + ph * 2.1) * 0.3 + sin(uTime * 5.3 + wp0.y * 1.7 + ph * 5.0) * 0.12;
  float h = max(transformed.y, 0.0);
  transformed.x += sway * uWind * h;
  transformed.z += sway * uWind * 0.6 * h;
}
`;
const FOLIAGE_COLOR = `
{
  vec3 V = normalize(vWPos - cameraPosition);
  float back = pow(max(dot(V, uSunDir), 0.0), 2.5);
  diffuseColor.rgb *= 1.0 + 0.6 * back;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.2, 0.68), back * 0.35);
}
`;

export function makeFoliage(material, ctx, wind) {
  if (material.userData.foliageHooked) return material;
  material.userData.foliageHooked = true;
  const leaf = material.userData.foliage === true || material.alphaTest > 0;
  hookMaterial(material, {
    key: leaf ? 'foliage-leaf' : 'foliage-wood',
    uniforms: { uTime: ctx.time, uSunDir: { value: ctx.lighting.sunDirection }, uWind: { value: wind } },
    pars: FOLIAGE_PARS,
    vertex: FOLIAGE_VERTEX,
    color: leaf ? FOLIAGE_COLOR : '',
  });
  ctx.lighting.register(material);
  return material;
}

function frondTexture() {
  const w = 256;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const random = rng(77);
  const leaflets = 92;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < leaflets; i++) {
      const t = i / (leaflets - 1);
      const y = h - 96 - t * (h - 118);
      const len = (26 + 98 * Math.pow(Math.sin(Math.PI * Math.pow(t * 0.96 + 0.02, 0.6)), 0.7)) * (0.9 + random() * 0.18);
      const rise = len * (0.5 + 0.45 * t) + random() * 5;
      const wid = 3.1 - 1.2 * t;
      const hue = 84 + random() * 24;
      const light = 16 + random() * 12 + (side > 0 ? 4 : 0);
      const grad = g.createLinearGradient(w / 2, y, w / 2 + side * len, y - rise);
      grad.addColorStop(0, `hsl(${hue}, 48%, ${light}%)`);
      grad.addColorStop(0.75, `hsl(${hue - 8}, 52%, ${light + 9}%)`);
      grad.addColorStop(1, random() < 0.2 ? 'hsl(44, 46%, 36%)' : `hsl(${hue - 14}, 54%, ${light + 13}%)`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(w / 2, y + wid);
      g.quadraticCurveTo(w / 2 + side * len * 0.55, y - rise * 0.42 + wid * 0.8, w / 2 + side * len, y - rise);
      g.quadraticCurveTo(w / 2 + side * len * 0.5, y - rise * 0.5 - wid * 0.8, w / 2, y - wid);
      g.closePath();
      g.fill();
    }
  }
  const rib = g.createLinearGradient(0, h, 0, 0);
  rib.addColorStop(0, 'hsl(64, 36%, 30%)');
  rib.addColorStop(1, 'hsl(84, 44%, 36%)');
  g.fillStyle = rib;
  g.beginPath();
  g.moveTo(w / 2 - 6, h);
  g.lineTo(w / 2 + 6, h);
  g.lineTo(w / 2 + 1.5, 12);
  g.lineTo(w / 2 - 1.5, 12);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function palmGeometry(seed, height, style) {
  const random = rng(seed);
  const rings = 16;
  const sides = 10;
  const pos = [];
  const uv = [];
  const idx = [];
  const sabal = style === 'sabal';
  const lean = (0.08 + random() * 0.2) * (sabal ? 0.25 : 1);
  const leanDir = random() * Math.PI * 2;
  const spine = (t) => new THREE.Vector3(Math.cos(leanDir) * lean * t * t * height, t * height, Math.sin(leanDir) * lean * t * t * height);
  const rBase = sabal ? 0.24 : 0.17;
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const c = spine(t);
    const radius = rBase * (1 - 0.3 * t) + 0.14 * Math.exp(-t * 16) + (sabal ? 0.025 : 0.008) * Math.sin(t * height * 9);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      pos.push(c.x + Math.cos(a) * radius, c.y, c.z + Math.sin(a) * radius);
      uv.push((s / sides) * 2, t * height * 0.5);
      if (r < rings && s < sides) {
        const o = r * (sides + 1) + s;
        idx.push(o, o + sides + 1, o + 1, o + 1, o + sides + 1, o + sides + 2);
      }
    }
  }
  let trunk = new THREE.BufferGeometry();
  trunk.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  trunk.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  trunk.setIndex(idx);
  trunk.computeVertexNormals();
  const crown = spine(1);
  const bulb = new THREE.SphereGeometry(sabal ? 0.42 : 0.3, 10, 8);
  bulb.scale(1, 1.35, 1);
  bulb.translate(crown.x, crown.y - 0.1, crown.z);
  trunk = mergeGeometries([trunk, bulb], false);

  const fp = [];
  const fuv = [];
  const fi = [];
  const count = sabal ? 40 : 32;
  const segs = 10;
  const up = new THREE.Vector3(0, 1, 0);
  for (let f = 0; f < count; f++) {
    const k = f / (count - 1);
    const az = f * 2.39996 + random() * 0.5;
    let pitch = THREE.MathUtils.lerp(1.4, sabal ? -1.0 : -0.85, Math.pow(k, 0.9)) + (random() - 0.5) * 0.22;
    const length = (sabal ? 2.5 : 4.4) * (0.86 + random() * 0.26) * (0.58 + 0.42 * THREE.MathUtils.smoothstep(k, 0, 0.32));
    const droop = (0.75 + 0.75 * k + random() * 0.3) * (sabal ? 0.8 : 1.1);
    const width = (sabal ? 1.15 : 1.02) * (0.85 + random() * 0.3);
    const fold = 0.42 + random() * 0.25;
    const p = crown.clone();
    const dirH = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
    const base = fp.length / 3;
    const tangent = new THREE.Vector3();
    const normal = new THREE.Vector3();
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      tangent.copy(dirH).multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch));
      normal.crossVectors(side, tangent).normalize();
      const shape = t < 0.07 ? 0.03 : Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.07) / 0.95 + 0.04)), 0.55);
      const half = width * 0.5 * shape + 0.015;
      const ex = side.clone().multiplyScalar(half * Math.cos(fold)).addScaledVector(normal, -half * Math.sin(fold));
      const ex2 = side.clone().multiplyScalar(-half * Math.cos(fold)).addScaledVector(normal, -half * Math.sin(fold));
      fp.push(p.x + ex2.x, p.y + ex2.y, p.z + ex2.z, p.x, p.y, p.z, p.x + ex.x, p.y + ex.y, p.z + ex.z);
      fuv.push(0, t, 0.5, t, 1, t);
      if (s < segs) {
        const o = base + s * 3;
        fi.push(o, o + 1, o + 3, o + 1, o + 4, o + 3, o + 1, o + 2, o + 4, o + 2, o + 5, o + 4);
      }
      p.addScaledVector(tangent, length / segs);
      pitch -= (droop / segs) * (0.35 + 1.3 * t);
    }
  }
  const fronds = new THREE.BufferGeometry();
  fronds.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fronds.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  fronds.setIndex(fi);
  fronds.computeVertexNormals();
  trunk.computeBoundingBox();
  fronds.computeBoundingBox();
  return { trunk, fronds };
}

const IMPOSTOR_VERT = `
uniform float uFrames;
uniform vec2 uSize;
varying vec2 vUv;
varying float vShade;
void main() {
  #ifdef USE_INSTANCING
    mat4 mm = modelMatrix * instanceMatrix;
  #else
    mat4 mm = modelMatrix;
  #endif
  vec4 c4 = mm * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(mm[0].xyz);
  vec3 toCam = cameraPosition - c4.xyz;
  toCam.y = 0.0;
  toCam = normalize(toCam);
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  vec3 wp = c4.xyz + right * position.x * uSize.x * s + vec3(0.0, position.y * uSize.y * s, 0.0);
  float f = mod(floor(fract(atan(toCam.z, toCam.x) / 6.2831853 + 1.0) * uFrames + 0.5), uFrames);
  vUv = vec2((uv.x * 0.96 + 0.02 + f) / uFrames, uv.y);
  vShade = 0.84 + 0.3 * fract(sin(dot(c4.xz, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const IMPOSTOR_FRAG = `
uniform sampler2D map;
uniform vec3 uDay;
varying vec2 vUv;
varying float vShade;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.45) discard;
  gl_FragColor = vec4(c.rgb / max(c.a, 0.45) * vShade * uDay, 1.0);
}`;
const IMPOSTOR_DEPTH_FRAG = `
#include <packing>
uniform sampler2D map;
varying vec2 vUv;
void main() {
  if (texture2D(map, vUv).a < 0.45) discard;
  gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
}`;
const TAN_REF = Math.tan(THREE.MathUtils.degToRad(27.5));
const SHADOW_NEAR = 18;
const FOREST_AT = 45;
const FOREST_MAX = 150;
const FOREST_CELL = 32;
const POOL = 128;
const SOLID_IN = 26;
const SOLID_OUT = 34;

function bakeImpostor(ctx, parts, size, yaw, cell) {
  const { renderer, lighting } = ctx;
  const frames = 8;
  const target = new THREE.WebGLRenderTarget(cell * frames, cell, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true });
  target.texture.colorSpace = THREE.NoColorSpace;
  const stage = new THREE.Scene();
  stage.environment = ctx.scene.environment;
  const sun = new THREE.DirectionalLight(lighting.sunTint, lighting.sunIntensity);
  sun.position.copy(lighting.sunDirection).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const reach = Math.max(size.x, size.y) * 0.75;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 160 });
  sun.shadow.bias = -0.0015;
  sun.target.position.set(0, size.y * 0.5, 0);
  stage.add(sun, sun.target);
  const holder = new THREE.Group();
  holder.rotation.y = yaw;
  stage.add(holder);
  for (const part of parts) {
    const src = part.material;
    const material = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughness: 0.9, metalness: 0, alphaTest: src.alphaTest, side: src.side, color: src.color });
    const mesh = new THREE.Mesh(part.geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    holder.add(mesh);
  }
  const cam = new THREE.OrthographicCamera(-size.x / 2, size.x / 2, size.y, 0, 0.1, 200);
  const prevAuto = renderer.autoClear;
  const prevShadowAuto = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = true;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.autoClear = false;
  target.scissorTest = true;
  for (let f = 0; f < frames; f++) {
    const a = (f / frames) * Math.PI * 2;
    cam.position.set(Math.cos(a) * 80, 0, Math.sin(a) * 80);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    target.viewport.set(f * cell, 0, cell, cell);
    target.scissor.set(f * cell, 0, cell, cell);
    renderer.setRenderTarget(target);
    renderer.render(stage, cam);
  }
  target.scissorTest = false;
  target.viewport.set(0, 0, cell * frames, cell);
  renderer.autoClear = prevAuto;
  renderer.shadowMap.autoUpdate = prevShadowAuto;
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(null);
  holder.traverse((o) => {
    if (o.isMesh) o.material.dispose();
  });
  sun.shadow.map?.dispose();
  return target;
}

function captureImpostor(ctx, parts, size, yaw, cell) {
  const target = bakeImpostor(ctx, parts, size, yaw, cell);
  const uniforms = { map: { value: target.texture }, uFrames: { value: 8 }, uSize: { value: new THREE.Vector2(size.x, size.y) }, uDay: { value: ctx.lighting.dayTint } };
  const material = new THREE.ShaderMaterial({ vertexShader: IMPOSTOR_VERT, fragmentShader: IMPOSTOR_FRAG, uniforms, toneMapped: false });
  material.userData = { parts, size, yaw, target, cell, depth: new THREE.ShaderMaterial({ vertexShader: IMPOSTOR_VERT, fragmentShader: IMPOSTOR_DEPTH_FRAG, uniforms }) };
  return material;
}

const QUAD = new THREE.PlaneGeometry(1, 1);
QUAD.translate(0, 0.5, 0);

function impostorField(material, points, scaleRange) {
  const mesh = new THREE.InstancedMesh(QUAD, material, points.length);
  const m = new THREE.Matrix4();
  points.forEach((p, i) => {
    const s = scaleRange[0] + p.r * (scaleRange[1] - scaleRange[0]);
    m.makeScale(s, s, s).setPosition(p.x, p.y - 0.3, p.z);
    mesh.setMatrixAt(i, m);
  });
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.customDepthMaterial = material.userData.depth;
  return mesh;
}

const thinned = new Map();
function thinLeaves(geometry, keep = 0.34) {
  if (thinned.has(geometry)) return thinned.get(geometry);
  const index = geometry.index.array;
  const position = geometry.attributes.position;
  const count = position.count;
  const parent = new Uint32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let t = 0; t < index.length; t += 3) {
    const a = find(index[t]);
    parent[find(index[t + 1])] = a;
    parent[find(index[t + 2])] = a;
  }
  const sum = new Float64Array(count * 4);
  for (let i = 0; i < count; i++) {
    const r = find(i) * 4;
    sum[r] += position.getX(i);
    sum[r + 1] += position.getY(i);
    sum[r + 2] += position.getZ(i);
    sum[r + 3]++;
  }
  const kept = (root) => {
    let h = Math.imul(root ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296 < keep;
  };
  const remap = new Int32Array(count).fill(-1);
  const order = [];
  for (let i = 0; i < count; i++) {
    if (!kept(find(i))) continue;
    remap[i] = order.length;
    order.push(i);
  }
  const out = new THREE.BufferGeometry();
  const grow = Math.sqrt(1 / keep);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize;
    const array = new Float32Array(order.length * size);
    order.forEach((source, i) => {
      for (let k = 0; k < size; k++) array[i * size + k] = attribute.getComponent(source, k);
      if (name !== 'position') return;
      const r = find(source) * 4;
      for (let k = 0; k < 3; k++) {
        const c = sum[r + k] / sum[r + 3];
        array[i * 3 + k] = c + (array[i * 3 + k] - c) * grow;
      }
    });
    out.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  const list = [];
  for (let t = 0; t < index.length; t += 3) if (remap[index[t]] >= 0) list.push(remap[index[t]], remap[index[t + 1]], remap[index[t + 2]]);
  out.setIndex(list);
  out.boundingBox = geometry.boundingBox;
  out.boundingSphere = geometry.boundingSphere;
  if (!out.boundingSphere) out.computeBoundingSphere();
  thinned.set(geometry, out);
  return out;
}

function sizeOf(parts) {
  const box = new THREE.Box3();
  for (const part of parts) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    box.union(part.geometry.boundingBox);
  }
  const r = Math.max(Math.abs(box.min.x), box.max.x, Math.abs(box.min.z), box.max.z);
  return new THREE.Vector2(r * 2, box.max.y);
}

export async function createTrees(ctx, options = {}) {
  const { assets, physics, scene, terrain } = ctx;
  let cell = options.impostor || 256;
  let range = options.range || 1;
  let forestCap = Math.min(POOL, options.forest ?? 60);
  let viewHeight = 1080;
  let lightShadows = true;
  const [jacA, jacB, islandA, islandB, searsia, palmBark] = await Promise.all([
    assets.model('jacaranda_a'), assets.model('jacaranda_b'), assets.model('island_tree'), assets.model('island_tree_b'), assets.model('searsia'), assets.pbr('palm_bark'),
  ]);
  const group = new THREE.Group();
  group.name = 'trees';
  const random = rng(4242);
  const partsOf = (root, wind) => {
    const list = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (o.isMesh) list.push({ geometry: bakeMesh(o, { ground: false }), material: makeFoliage(o.material, ctx, wind) });
    });
    return list;
  };
  const jacNear = partsOf(jacA, 0.0035);
  const jacFar = partsOf(jacB, 0.0035);
  const islandNear = partsOf(islandA, 0.012);
  const islandFar = partsOf(islandB, 0.012);
  const YAWS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  const jacSize = sizeOf(jacFar);
  const islandSize = sizeOf(islandNear);
  const jacImpostors = YAWS.map((yaw) => captureImpostor(ctx, jacFar, jacSize, yaw, cell));
  const islandImpostors = YAWS.map((yaw) => captureImpostor(ctx, islandNear, islandSize, yaw, cell));

  const managed = [];
  const shades = new Map();
  const impostorLists = new Map();
  const addTree = (levels, impostors, impostorAt, x, z, scale, trunkRadius) => {
    const k = Math.floor(random() * 4);
    const y = heightAt(x, z) - 0.15 * scale;
    const holders = [];
    for (const [parts, distance] of levels) {
      const holder = new THREE.Group();
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        holder.add(mesh);
      }
      holder.position.set(x, y, z);
      holder.rotation.y = YAWS[k];
      holder.scale.setScalar(scale);
      holder.updateMatrixWorld(true);
      holder.traverse((o) => (o.matrixAutoUpdate = false));
      holder.visible = false;
      group.add(holder);
      holders.push({ holder, from: distance });
    }
    const light = levels[levels.length - 1][0];
    if (!shades.has(light)) shades.set(light, { parts: light, trees: [], sets: [], dirty: false });
    const shade = shades.get(light);
    const material = impostors[k];
    if (!impostorLists.has(material)) impostorLists.set(material, []);
    const list = impostorLists.get(material);
    const entry = { x, z, holders, impostorAt, material, index: list.length, matrix: new THREE.Matrix4().makeScale(scale, scale, scale).setPosition(x, y, z), level: -2, height: material.userData.size.y * scale, near: 0, shade, shaded: false,
      sphere: new THREE.Sphere(new THREE.Vector3(x, y + material.userData.size.y * scale * 0.5, z), Math.max(material.userData.size.x, material.userData.size.y) * scale * 0.62),
      solid: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), YAWS[k]), new THREE.Vector3(scale, scale, scale)),
    };
    shade.trees.push(entry);
    list.push(entry);
    managed.push(entry);
    if (trunkRadius) physics.staticCylinder(x, y - 1, y + 4.5, z, trunkRadius, 'wood');
  };

  const heroSpots = [[-141, 37], [-97, 34], [-72, -25], [-53, 46], [-61, -60], [62, 35], [75, -31], [96, -44], [-152, -31], [92, 54], [-30, 118], [44, -96]];
  for (const [x, z] of heroSpots) addTree([[jacNear, 0], [jacFar, 42]], jacImpostors, 84, x, z, 0.52 + random() * 0.26, 0.5);
  const taken = heroSpots.map(([x, z]) => ({ x, z }));
  const far = (x, z, d) => taken.every((t) => (t.x - x) ** 2 + (t.z - z) ** 2 > d * d);
  const core = { x0: -215, x1: 215, z0: -200, z1: 200 };

  const jacSpots = pickPoints({
    count: 64, seed: 71, spacing: 13, region: core,
    accept: (x, z) => {
      const h = heightAt(x, z);
      if (h < 0.9 || !clearOfBuilt(x, z, 7) || slopeAt(x, z) > 0.4 || !far(x, z, 12)) return 0;
      return 0.1 + terrain.vegAt(x, z).forest * 0.9;
    },
  });
  for (const p of jacSpots) {
    taken.push(p);
    addTree([[jacFar, 0]], jacImpostors, 72, p.x, p.z, 0.4 + p.r * 0.36, 0.42);
  }
  const islandSpots = pickPoints({
    count: 120, seed: 11, spacing: 6.5, region: core,
    accept: (x, z) => {
      const h = heightAt(x, z);
      if (h < 0.45 || h > 9 || !clearOfBuilt(x, z, 4) || slopeAt(x, z) > 0.5 || !far(x, z, 7)) return 0;
      return h < 2.8 ? 0.95 : 0.12 + terrain.vegAt(x, z).forest * 0.8;
    },
  });
  for (const p of islandSpots) addTree([[islandNear, 0], [islandFar, 30]], islandImpostors, 66, p.x, p.z, 1.8 + p.r * 1.3, 0.22);

  const searsiaVariants = variantsOf(searsia);
  for (const v of searsiaVariants) for (const part of v.parts) makeFoliage(part.material, ctx, 0.02);
  const smallSpots = pickPoints({
    count: 150, seed: 23, spacing: 4, region: core,
    accept: (x, z) => {
      const h = heightAt(x, z);
      if (h < 0.35 || !clearOfBuilt(x, z, 1.5) || slopeAt(x, z) > 0.6) return 0;
      return (h < 2.4 ? 0.85 : 0.1) + terrain.vegAt(x, z).forest * 0.8;
    },
  });
  const cells = new Map();
  smallSpots.forEach((p, i) => {
    const key = `${i % searsiaVariants.length}:${Math.floor(p.x / 150)}:${Math.floor(p.z / 150)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ x: p.x, y: p.y - 0.08, z: p.z, yaw: p.r * 6.28, scale: 1.4 + p.r2 * 1.1 });
  });
  for (const [key, list] of cells) {
    for (const mesh of instancedVariant(searsiaVariants[+key.split(':')[0]], list)) {
      group.add(mesh);
      ctx.cull.push({ object: mesh, x: mesh.boundingSphere.center.x, z: mesh.boundingSphere.center.z, range: 170 + mesh.boundingSphere.radius });
    }
  }

  const trunkMat = new THREE.MeshStandardMaterial({ ...palmBark, roughness: 1, metalness: 0, color: 0xc4bcae });
  trunkMat.metalnessMap = null;
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.55, metalness: 0 });
  frondMat.userData.foliage = true;
  makeFoliage(trunkMat, ctx, 0.0025);
  makeFoliage(frondMat, ctx, 0.007);
  const palmKinds = [palmGeometry(5, 12, 'coco'), palmGeometry(9, 9.5, 'coco'), palmGeometry(14, 14.5, 'coco'), palmGeometry(21, 6.4, 'sabal'), palmGeometry(29, 7.8, 'sabal'), palmGeometry(33, 10.5, 'coco')];
  const palmSpots = pickPoints({
    count: 150, seed: 37, spacing: 5, region: core,
    accept: (x, z) => {
      const h = heightAt(x, z);
      if (h < 0.4 || h > 8 || !clearOfBuilt(x, z, 3.2) || slopeAt(x, z) > 0.5 || !far(x, z, 6)) return 0;
      const nearRoad = Math.abs(z) < 24 && Math.abs(x) > 56 ? 0.55 : 0;
      return (h < 2.8 ? 0.85 : 0.08) + nearRoad + terrain.vegAt(x, z).forest * 0.25;
    },
  });
  const palmLists = palmKinds.map(() => []);
  palmSpots.forEach((p, i) => palmLists[i % palmKinds.length].push({ x: p.x, y: p.y - 0.25, z: p.z, yaw: p.r * 6.28, scale: 0.82 + p.r2 * 0.4, tilt: [(p.r3 - 0.5) * 0.14, (p.r - 0.5) * 0.14] }));
  palmKinds.forEach((kind, i) => {
    const variant = { parts: [{ geometry: kind.trunk, material: trunkMat }, { geometry: kind.fronds, material: frondMat }] };
    for (const mesh of instancedVariant(variant, palmLists[i])) group.add(mesh);
    for (const p of palmLists[i]) physics.staticCylinder(p.x, p.y - 0.5, p.y + 5, p.z, 0.22, 'wood');
  });

  const palmParts = [{ geometry: palmKinds[0].trunk, material: trunkMat }, { geometry: palmKinds[0].fronds, material: frondMat }];
  const palmImpostor = captureImpostor(ctx, palmParts, sizeOf(palmParts), 0, cell);
  const farSpots = pickPoints({
    count: 4200, seed: 91, spacing: 5, attempts: 14, region: WORLD.core - 6,
    accept: (x, z) => {
      const h = heightAt(x, z);
      if (h < 0.7 || !clearOfBuilt(x, z, 4)) return 0;
      if (x > core.x0 && x < core.x1 && z > core.z0 && z < core.z1) return 0;
      return 0.4 + terrain.vegAt(x, z).forest * 0.6;
    },
  });
  const jacKind = { levels: [{ parts: jacFar, until: SHADOW_NEAR }, { parts: jacFar, until: Infinity, light: jacFar }], trunk: 0.4 };
  const islandKind = { levels: [{ parts: islandNear, until: SHADOW_NEAR }, { parts: islandNear, until: 30, light: islandFar }, { parts: islandFar, until: Infinity, light: islandFar }], trunk: 0.22 };
  const palmKind = { levels: [{ parts: palmParts, until: Infinity }], trunk: 0.2 };
  const fields = [
    ...jacImpostors.map((material, k) => ({ material, scale: [0.42, 0.82], share: 0.14, kind: jacKind, yaw: YAWS[k] })),
    ...islandImpostors.map((material, k) => ({ material, scale: [2.0, 3.6], share: 0.065, kind: islandKind, yaw: YAWS[k] })),
    { material: palmImpostor, scale: [0.8, 1.3], share: 0.18, kind: palmKind, yaw: 0 },
  ];
  const outside = (x, z) => Math.abs(x) > WORLD.core - 6 || Math.abs(z) > WORLD.core - 6;
  const ringSpots = pickPoints({
    count: Math.round((4200 * 4 * ((WORLD.half - 6) ** 2 - (WORLD.core - 6) ** 2)) / (4 * (WORLD.core - 6) ** 2 - 430 * 400)), seed: 92, spacing: 5, attempts: 14,
    accept: (x, z) => {
      if (!outside(x, z) || townDistance(x, z) < 10) return 0;
      const h = heightAt(x, z);
      if (h < 0.7 || !clearOfBuilt(x, z, 4)) return 0;
      return 0.4 + terrain.vegAt(x, z).forest * 0.6;
    },
  });
  const keep = (p) => townDistance(p.x, p.z) > 10;
  const forest = new Map();
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let start = 0;
  let ringStart = 0;
  for (const field of fields) {
    const n = Math.floor(farSpots.length * field.share);
    const m = Math.floor(ringSpots.length * field.share);
    const points = [...farSpots.slice(start, start + n), ...ringSpots.slice(ringStart, ringStart + m)].filter(keep);
    const mesh = impostorField(field.material, points, field.scale);
    group.add(mesh);
    points.forEach((p, index) => {
      const scale = field.scale[0] + p.r * (field.scale[1] - field.scale[0]);
      const y = p.y - 0.3;
      const key = Math.floor(p.x / FOREST_CELL) * 4096 + Math.floor(p.z / FOREST_CELL);
      if (!forest.has(key)) forest.set(key, []);
      forest.get(key).push({
        x: p.x, y, z: p.z, mesh, index, kind: field.kind, height: field.material.userData.size.y * scale, on: false, rank: 0, near: 0, collider: null,
        flat: new THREE.Matrix4().makeScale(scale, scale, scale).setPosition(p.x, y, p.z),
        solid: new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), turn.setFromAxisAngle(up, field.yaw), new THREE.Vector3(scale, scale, scale)),
      });
    });
    start += n;
    ringStart += m;
  }
  for (const kind of [jacKind, islandKind, palmKind]) {
    for (const level of kind.levels) {
      level.count = 0;
      level.matrices = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 16), 16);
      const pool = (part, light) => {
        const leaf = part.material.userData.foliage === true || part.material.alphaTest > 0;
        const mesh = new THREE.InstancedMesh(light && leaf ? thinLeaves(part.geometry) : part.geometry, part.material, POOL);
        mesh.instanceMatrix = level.matrices;
        mesh.count = 0;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.visible = false;
        group.add(mesh);
        return mesh;
      };
      level.meshes = level.parts.map((part) => pool(part, false));
      level.shade = level.light ? level.light.map((part) => pool(part, true)) : [];
    }
  }

  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const impostorMeshes = new Map();
  for (const [material, list] of impostorLists) {
    const mesh = new THREE.InstancedMesh(QUAD, material, list.length);
    list.forEach((entry, i) => mesh.setMatrixAt(i, entry.matrix));
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.customDepthMaterial = material.userData.depth;
    group.add(mesh);
    impostorMeshes.set(material, mesh);
  }
  const flats = [...new Set([...impostorMeshes.values(), ...[...forest.values()].flat().map((e) => e.mesh)])];
  for (const mesh of flats) mesh.castShadow = options.shadows !== false;

  for (const shade of shades.values()) {
    shade.sets = [0, 1, 2, 3].map(() => {
      const matrices = new THREE.InstancedBufferAttribute(new Float32Array(shade.trees.length * 16), 16);
      const meshes = shade.parts.map((part) => {
        const leaf = part.material.userData.foliage === true || part.material.alphaTest > 0;
        const mesh = new THREE.InstancedMesh(leaf ? thinLeaves(part.geometry) : part.geometry, part.material, shade.trees.length);
        mesh.instanceMatrix = matrices;
        mesh.count = 0;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = false;
        mesh.visible = false;
        group.add(mesh);
        return mesh;
      });
      return { meshes, count: 0 };
    });
  }
  const fill = (shade, set, frustum) => {
    set.count = 0;
    for (const t of shade.trees) if (t.shaded && (!frustum || frustum.intersectsSphere(t.sphere))) set.meshes[0].setMatrixAt(set.count++, t.solid);
    set.meshes[0].instanceMatrix.needsUpdate = true;
    for (const mesh of set.meshes) mesh.count = set.count;
  };

  const picked = [];
  const solids = [];
  const shown = [];
  const swapped = [];
  const stats = { meshes: 0, forest: 0 };
  let signature = '';

  function updateForest(camera, eff, sharp) {
    picked.length = 0;
    {
      const cx = camera.position.x;
      const cz = camera.position.z;
      for (let i = solids.length - 1; i >= 0; i--) {
        const t = solids[i];
        if (Math.hypot(t.x - cx, t.z - cz) < SOLID_OUT) continue;
        physics.remove(t.collider);
        t.collider = null;
        solids[i] = solids[solids.length - 1];
        solids.pop();
      }
      const e = camera.matrixWorld.elements;
      const fl = Math.hypot(e[8], e[10]) || 1;
      const fx = -e[8] / fl;
      const fz = -e[10] / fl;
      const side = Math.cos(Math.min(Math.PI, Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect) + 0.2));
      const reach = Math.max(SOLID_OUT, Math.min(FOREST_MAX, Math.max(FOREST_AT / eff, 16 * sharp)));
      for (let i = Math.floor((cx - reach) / FOREST_CELL); i <= Math.floor((cx + reach) / FOREST_CELL); i++) {
        for (let j = Math.floor((cz - reach) / FOREST_CELL); j <= Math.floor((cz + reach) / FOREST_CELL); j++) {
          const list = forest.get(i * 4096 + j);
          if (!list) continue;
          for (const t of list) {
            const dx = t.x - cx;
            const dz = t.z - cz;
            const d = Math.hypot(dx, dz);
            if (d < SOLID_IN && !t.collider) {
              t.collider = physics.staticCylinder(t.x, t.y - 1, t.y + 4.5, t.z, t.kind.trunk, 'wood');
              solids.push(t);
            }
            if (forestCap === 0 || d > reach || (d * eff >= FOREST_AT && d >= t.height * sharp)) continue;
            t.near = d * eff;
            t.rank = d < 8 || dx * fx + dz * fz > d * side ? d : d * 2.5 + 20;
            picked.push(t);
          }
        }
      }
      if (picked.length > forestCap) {
        picked.sort((a, b) => a.rank - b.rank);
        picked.length = forestCap;
      }
    }
    let sum = picked.length;
    for (const t of picked) sum += (t.index + 1) * (3 + 4 * t.kind.levels.findIndex((l) => t.near < l.until)) + t.x;
    const next = `${picked.length}:${sum}`;
    stats.forest = picked.length;
    if (next === signature) return;
    signature = next;
    const dirty = new Set();
    for (const t of shown) t.on = false;
    for (const t of picked) t.on = true;
    for (const t of shown) {
      if (t.on) continue;
      t.mesh.setMatrixAt(t.index, t.flat);
      dirty.add(t.mesh);
    }
    for (const kind of [jacKind, islandKind, palmKind]) for (const level of kind.levels) level.count = 0;
    for (const t of picked) {
      t.mesh.setMatrixAt(t.index, zero);
      dirty.add(t.mesh);
      const level = t.kind.levels.find((l) => t.near < l.until);
      level.meshes[0].setMatrixAt(level.count, t.solid);
      level.count++;
    }
    for (const kind of [jacKind, islandKind, palmKind]) {
      for (const level of kind.levels) {
        level.matrices.needsUpdate = true;
        for (const mesh of level.meshes) {
          mesh.count = level.count;
          mesh.visible = level.count > 0;
          if (level.count > 0) mesh.computeBoundingSphere();
        }
        for (const mesh of level.shade) {
          mesh.count = level.count;
          if (level.count > 0) mesh.computeBoundingSphere();
        }
      }
    }
    for (const mesh of dirty) mesh.instanceMatrix.needsUpdate = true;
    shown.length = 0;
    shown.push(...picked);
  }

  function update(camera) {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const eff = Math.min(1, tan / TAN_REF) / range;
    const sharp = viewHeight / (2 * tan * cell * 1.15);
    const cx = camera.position.x;
    const cz = camera.position.z;
    stats.meshes = 0;
    for (const t of managed) {
      const d = Math.hypot(t.x - cx, t.z - cz);
      const near = d * eff;
      t.near = near;
      let level = -1;
      if (near < t.impostorAt || d < t.height * sharp) {
        level = 0;
        for (let i = 1; i < t.holders.length; i++) if (near >= t.holders[i].from) level = i;
        stats.meshes++;
      }
      const shaded = lightShadows && level >= 0 && near >= SHADOW_NEAR;
      if (shaded !== t.shaded) {
        t.shaded = shaded;
        t.shade.dirty = true;
        for (const h of t.holders) for (const mesh of h.holder.children) mesh.castShadow = !shaded;
      }
      if (level === t.level) continue;
      t.level = level;
      t.holders.forEach((h, i) => (h.holder.visible = i === level));
      const mesh = impostorMeshes.get(t.material);
      mesh.setMatrixAt(t.index, level < 0 ? t.matrix : zero);
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const shade of shades.values()) {
      if (!shade.dirty) continue;
      shade.dirty = false;
      fill(shade, shade.sets[3], null);
    }
    updateForest(camera, eff, sharp);
  }

  function stage(name, on, light, cascade = 0) {
    for (const kind of [jacKind, islandKind]) {
      for (const level of kind.levels) {
        if (!level.shade.length || level.count === 0) continue;
        for (const mesh of level.meshes) mesh.visible = !on;
        for (const mesh of level.shade) mesh.visible = on;
      }
    }
    if (name === 'shadow') {
      let frustum = null;
      if (on && light) {
        light.shadow.updateMatrices(light);
        frustum = light.shadow.getFrustum();
      }
      for (const shade of shades.values()) {
        const set = shade.sets[Math.min(2, Math.max(0, cascade))];
        if (on) fill(shade, set, frustum);
        for (const mesh of set.meshes) mesh.visible = on && set.count > 0;
      }
      return;
    }
    for (const shade of shades.values()) for (const mesh of shade.sets[3].meshes) mesh.visible = on && shade.sets[3].count > 0;
    if (!on) {
      for (const t of swapped) t.holders[t.level].holder.visible = true;
      swapped.length = 0;
      return;
    }
    for (const t of managed) {
      if (!t.shaded || t.level < 0) continue;
      t.holders[t.level].holder.visible = false;
      swapped.push(t);
    }
  }

  function forceMeshes() {
    for (const t of managed) {
      t.holders.forEach((h, i) => (h.holder.visible = i === t.holders.length - 1));
      t.level = 99;
    }
  }

  function setQuality(next) {
    if (next.range) range = next.range;
    if (next.forest !== undefined) forestCap = Math.min(POOL, next.forest);
    if (next.shadows !== undefined) for (const mesh of flats) mesh.castShadow = next.shadows;
    if (next.impostor && next.impostor !== cell) {
      cell = next.impostor;
      for (const material of [...jacImpostors, ...islandImpostors, palmImpostor]) {
        const data = material.userData;
        data.target.dispose();
        data.target = bakeImpostor(ctx, data.parts, data.size, data.yaw, cell);
        material.uniforms.map.value = data.target.texture;
      }
    }
    signature = '';
  }

  scene.add(group);
  return {
    group, heroSpots, update, forceMeshes, stage, setQuality, stats, palms: { kinds: palmKinds, trunkMat, frondMat },
    setViewport(height) {
      viewHeight = height;
    },
    set lightShadows(on) {
      lightShadows = !!on;
    },
  };
}
