// Costa del Gzowo: terrain chunks, baked splat maps, layered PBR ground shader and the physics heightfield.
import * as THREE from 'three';
import { BRIDGE, ROAD, TOWN, WORLD } from '../config.js';
import { heightAt, trackInfo, townSigned, fbm, smooth, clamp } from './heightfield.js';
import { inYard } from './town/layout.js';

export const GROUND = { GRASS: 0, FOREST: 1, MUD: 2, PEBBLES: 3, SAND: 4, GRAVEL: 5, DIRT: 6, ROCK: 7 };
const LAYER_NAMES = ['leafy_grass', 'forrest_ground_01', 'brown_mud_leaves_01', 'ganges_river_pebbles', 'coast_sand_01', 'gravel_floor_02', 'gravel_road', 'seaside_rock'];
const LAYER_SCALE = [0.31, 0.3, 0.33, 0.47, 0.36, 0.52, 0.33, 0.24];
const LAYER_TINT = [[0.5, 0.74, 0.34], [0.62, 0.74, 0.46], [0.8, 0.76, 0.66], [1.0, 0.97, 0.9], [1.12, 1.06, 0.92], [0.6, 0.58, 0.54], [0.78, 0.7, 0.6], [0.85, 0.85, 0.85]];
const SIZE = WORLD.half * 2;
const GRID = SIZE + 1;
const SPLAT = Math.round(SIZE / 0.625);
const LAYER_RES = 1024;

function buildHeights() {
  const heights = new Float32Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) heights[j * GRID + i] = heightAt(i - WORLD.half, j - WORLD.half);
  }
  return heights;
}

function gridHeight(heights, x, z) {
  const fx = clamp(x + WORLD.half, 0, SIZE - 0.001);
  const fz = clamp(z + WORLD.half, 0, SIZE - 0.001);
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const a = heights[iz * GRID + ix];
  const b = heights[iz * GRID + ix + 1];
  const c = heights[(iz + 1) * GRID + ix];
  const d = heights[(iz + 1) * GRID + ix + 1];
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

function rectDistance(x, z, r) {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
}

function bakeSplat(heights) {
  const a = new Uint8Array(SPLAT * SPLAT * 4);
  const b = new Uint8Array(SPLAT * SPLAT * 4);
  const veg = new Uint8Array(SPLAT * SPLAT * 4);
  const w = new Float32Array(8);
  const step = SIZE / SPLAT;
  for (let j = 0; j < SPLAT; j++) {
    const z = (j + 0.5) * step - WORLD.half;
    for (let i = 0; i < SPLAT; i++) {
      const x = (i + 0.5) * step - WORLD.half;
      const h = gridHeight(heights, x, z);
      const gx = gridHeight(heights, x + 0.8, z) - gridHeight(heights, x - 0.8, z);
      const gz = gridHeight(heights, x, z + 0.8) - gridHeight(heights, x, z - 0.8);
      const slope = 1 - 1 / Math.sqrt(1 + (gx * gx + gz * gz) / 2.56);
      const n1 = fbm(x * 0.05, z * 0.05, 3);
      const n2 = fbm(x * 0.21 + 7, z * 0.21, 2);
      const n3 = fbm(x * 0.013 + 3, z * 0.013 + 5, 3);
      const hN = h + (n2 - 0.5) * 0.45;
      const under = 1 - smooth(-0.15, 0.3, hN);
      const strand = smooth(-0.3, 0.1, hN) * (1 - smooth(0.5, 1.5, hN));
      const bank = smooth(0.4, 1.3, hN);
      const deep = smooth(-0.7, -2.4, h);
      const forest = smooth(0.4, 0.62, n3);
      w[GROUND.SAND] = under * (0.4 + 0.6 * deep) + strand * smooth(0.55, 0.75, n1);
      w[GROUND.PEBBLES] = under * (1 - deep) * (0.35 + 1.3 * n2) + strand * smooth(0.42, 0.66, n2) * 1.3;
      w[GROUND.MUD] = strand * (0.45 + n1) + bank * forest * smooth(0.45, 0.75, n1) * 0.7;
      w[GROUND.GRASS] = bank * (1 - 0.85 * forest) * (1 - smooth(0.16, 0.34, slope));
      w[GROUND.FOREST] = bank * (0.12 + 0.9 * forest);
      w[GROUND.DIRT] = bank * smooth(0.13, 0.26, slope) * 0.8;
      w[GROUND.ROCK] = bank * smooth(0.3, 0.48, slope) * 1.2;
      w[GROUND.GRAVEL] = 0;
      const ax = Math.abs(x);
      const az = Math.abs(z);
      if (ax < BRIDGE.halfLength + 6 && ax > 27 && az < 15 && h > 0.15) {
        const k = (1 - smooth(9, 15, az)) * smooth(0.15, 0.7, h) * (1 - smooth(BRIDGE.halfLength + 1, BRIDGE.halfLength + 6, ax));
        w[GROUND.ROCK] += k * 3;
        for (const g of [GROUND.GRASS, GROUND.FOREST, GROUND.MUD]) w[g] *= 1 - k;
      }
      let hard = 0;
      if (ax > BRIDGE.halfLength - 2 && x < TOWN.x1 && x > -WORLD.core - 30) {
        const edge = az - ROAD.halfWidth + (n2 - 0.5) * 0.9;
        hard = Math.max(hard, 1 - smooth(0.4, 2.9, edge));
      }
      hard = Math.max(hard, 1 - smooth(-1.5, 2.2, rectDistance(x, z, ROAD.pullOff) + (n2 - 0.5) * 2.4));
      const tr = trackInfo(x, z);
      let track = 0;
      if (tr.dist < tr.halfWidth + 2) {
        track = 1 - smooth(tr.halfWidth - 0.7, tr.halfWidth + 0.8, tr.dist + (n2 - 0.5) * 1.2);
        const crown = (1 - smooth(0.15, 0.55, tr.dist)) * 0.75 * (1 - smooth(0.82, 0.95, tr.t));
        track *= 1 - crown;
        if (tr.t > 0.8) hard = Math.max(hard, track * smooth(0.8, 0.9, tr.t) * 0.6);
      }
      const keep = (1 - hard) * (1 - track);
      for (let k = 0; k < 8; k++) w[k] *= keep;
      w[GROUND.GRAVEL] += hard * 1.2;
      w[GROUND.DIRT] += track * 1.2;
      let town = 0;
      let wild = -1;
      if (x > TOWN.x0 - 40) {
        let s0 = 0;
        for (let k = 0; k < 8; k++) s0 += w[k];
        wild = s0 > 0.0001 ? (w[GROUND.GRASS] + w[GROUND.FOREST] * 0.35) / s0 : 0;
        town = 1 - smooth(-3, 1.5, townSigned(x, z) + (n2 - 0.5) * 3);
        const yard = town > 0 && inYard(x, z) ? 1 - smooth(0.3, 0.7, n2 * 0.6 + n1 * 0.5) * 0.4 : 0;
        const bare = town * (1 - yard);
        for (let k = 0; k < 8; k++) w[k] *= 1 - town;
        w[GROUND.GRAVEL] += bare * 0.2 * smooth(0.55, 0.8, n1);
        w[GROUND.DIRT] += bare * (0.35 + 0.5 * (1 - n1));
        w[GROUND.MUD] += bare * 0.3 * n2;
        w[GROUND.GRASS] += bare * (0.35 + 0.7 * smooth(0.35, 0.65, n2));
        w[GROUND.GRASS] += town * yard * 1.4;
        w[GROUND.DIRT] += town * yard * 0.25 * smooth(0.5, 0.8, n2);
        wild = wild * (1 - town) + town * yard;
        town = bare;
      }
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += w[k];
      if (sum < 0.0001) {
        w[GROUND.GRASS] = 1;
        sum = 1;
      }
      const o = (j * SPLAT + i) * 4;
      for (let k = 0; k < 4; k++) {
        a[o + k] = Math.round((w[k] / sum) * 255);
        b[o + k] = Math.round((w[k + 4] / sum) * 255);
      }
      const grassy = wild >= 0 ? wild : (w[GROUND.GRASS] + w[GROUND.FOREST] * 0.35) / sum;
      veg[o] = Math.round(clamp(grassy * (0.55 + 0.9 * n2) * (wild >= 0 ? 1 : 1 - town), 0, 1) * 255);
      veg[o + 1] = Math.round(clamp(smooth(-0.32, -0.05, h) * (1 - smooth(0.25, 0.7, h)) * smooth(0.46, 0.62, n1) * (1 - hard) * (1 - track) * (1 - town) * 1.4, 0, 1) * 255);
      veg[o + 2] = Math.round(forest * bank * keep * 255);
      veg[o + 3] = Math.round(clamp(h * 12 + 128, 0, 255));
    }
  }
  const make = (data) => {
    const tex = new THREE.DataTexture(data, SPLAT, SPLAT, THREE.RGBAFormat);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  };
  return { a, b, veg, texA: make(a), texB: make(b), texVeg: make(veg) };
}

async function buildLayerArrays(assets, maxAniso) {
  const canvas = new OffscreenCanvas(LAYER_RES, LAYER_RES);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = async (path) => {
    const image = await assets.image(path);
    ctx.drawImage(image, 0, 0, LAYER_RES, LAYER_RES);
    return ctx.getImageData(0, 0, LAYER_RES, LAYER_RES).data;
  };
  const layerBytes = LAYER_RES * LAYER_RES * 4;
  const albedo = new Uint8Array(layerBytes * 8);
  const nra = new Uint8Array(layerBytes * 8);
  for (let l = 0; l < 8; l++) {
    const base = `assets/textures/${LAYER_NAMES[l]}/`;
    albedo.set(await pixels(base + 'diff.jpg'), l * layerBytes);
    const nor = new Uint8Array(await pixels(base + 'nor.jpg'));
    const arm = await pixels(base + 'arm.jpg');
    const off = l * layerBytes;
    for (let p = 0; p < layerBytes; p += 4) {
      nra[off + p] = nor[p];
      nra[off + p + 1] = nor[p + 1];
      nra[off + p + 2] = arm[p + 1];
      nra[off + p + 3] = arm[p];
    }
  }
  const make = (data, srgb) => {
    const tex = new THREE.DataArrayTexture(data, LAYER_RES, LAYER_RES, 8);
    tex.format = THREE.RGBAFormat;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = Math.min(8, maxAniso);
    tex.needsUpdate = true;
    return tex;
  };
  return { albedo: make(albedo, true), nra: make(nra, false) };
}

export function makeNoiseTexture() {
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rnd() * 256);
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const FRAG_PARS = `
uniform sampler2DArray tLayersA;
uniform sampler2DArray tLayersN;
uniform sampler2D tSplatA;
uniform sampler2D tSplatB;
uniform sampler2D tNoise;
uniform float uScale[8];
uniform vec3 uTint[8];
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
vec3 gTerrainNormal;
float gTerrainRough;
float gTerrainAO;
`;

const FRAG_MAP = `
{
  vec2 suv = vTerrainPos.xz / ${SIZE.toFixed(1)} + 0.5;
  vec4 wa = texture2D(tSplatA, suv);
  vec4 wb = texture2D(tSplatB, suv);
  float w[8];
  w[0] = wa.r; w[1] = wa.g; w[2] = wa.b; w[3] = wa.a; w[4] = wb.r; w[5] = wb.g; w[6] = wb.b; w[7] = wb.a;
  vec2 p = vec2(vTerrainPos.x, -vTerrainPos.z);
  vec2 ddx = dFdx(p);
  vec2 ddy = dFdy(p);
  float farMix = smoothstep(16.0, 64.0, length(vViewPosition));
  vec3 alb = vec3(0.0);
  vec4 nra = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (w[i] < 0.012) continue;
    float sc = uScale[i];
    float layer = float(i);
    vec3 a = vec3(0.0);
    vec4 n = vec4(0.0);
    if (farMix < 0.999) {
      a = textureGrad(tLayersA, vec3(p * sc, layer), ddx * sc, ddy * sc).rgb * (1.0 - farMix);
      n = textureGrad(tLayersN, vec3(p * sc, layer), ddx * sc, ddy * sc) * (1.0 - farMix);
    }
    if (farMix > 0.001) {
      float s2 = sc * 0.21;
      vec2 p2 = p * s2 + 0.37;
      a += textureGrad(tLayersA, vec3(p2, layer), ddx * s2, ddy * s2).rgb * farMix;
      n += textureGrad(tLayersN, vec3(p2, layer), ddx * s2, ddy * s2) * farMix;
    }
    float ww = pow(w[i], 1.4) * (0.3 + n.a);
    a *= uTint[i];
    alb += a * ww;
    nra += n * ww;
    wsum += ww;
  }
  alb /= max(wsum, 0.0001);
  nra /= max(wsum, 0.0001);
  float macro = texture2D(tNoise, vTerrainPos.xz * 0.0037).r;
  float macro2 = texture2D(tNoise, vTerrainPos.xz * 0.029).g;
  alb *= 0.74 + 0.36 * macro + 0.16 * macro2;
  float wet = smoothstep(0.42, 0.02, vTerrainPos.y + (macro2 - 0.5) * 0.2);
  alb *= mix(1.0, 0.52, wet);
  gTerrainRough = mix(clamp(nra.b * 1.05, 0.35, 1.0), 0.28, wet * 0.8);
  gTerrainAO = mix(1.0, nra.a, 0.85);
  vec3 tn = vec3(nra.rg * 2.0 - 1.0, 0.0);
  tn.xy *= 1.25;
  tn.z = sqrt(max(1.0 - dot(tn.xy, tn.xy), 0.06));
  vec3 N = normalize(vTerrainNormal);
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
  vec3 B = cross(N, T);
  gTerrainNormal = normalize(T * tn.x + B * tn.y + N * tn.z);
  diffuseColor.rgb = alb;
}
`;

export async function createTerrain({ assets, lighting, physics, scene }) {
  const heights = buildHeights();
  const splat = bakeSplat(heights);
  const layers = await buildLayerArrays(assets, assets.maxAniso);
  const noise = makeNoiseTexture();

  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  material.userData.customShader = true;
  material.customProgramCacheKey = () => 'riverside-terrain';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tLayersA = { value: layers.albedo };
    shader.uniforms.tLayersN = { value: layers.nra };
    shader.uniforms.tSplatA = { value: splat.texA };
    shader.uniforms.tSplatB = { value: splat.texB };
    shader.uniforms.tNoise = { value: noise };
    shader.uniforms.uScale = { value: LAYER_SCALE };
    shader.uniforms.uTint = { value: LAYER_TINT.map((t) => new THREE.Vector3(...t)) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainPos;\nvarying vec3 vTerrainNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvTerrainNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <map_fragment>', FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gTerrainRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gTerrainNormal, 0.0)).xyz);')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= gTerrainAO;\n#include <aomap_fragment>');
  };
  lighting.register(material);

  const group = new THREE.Group();
  group.name = 'terrain';
  const rects = [];
  const core = WORLD.core;
  for (let z = -core; z < core; z += 64) for (let x = -core; x < core; x += 64) rects.push([x, z, 64, 64]);
  const ring = WORLD.half - core;
  if (ring > 0) {
    const across = Math.ceil(SIZE / 128);
    const wide = SIZE / across;
    for (let k = 0; k < across; k++) {
      rects.push([-WORLD.half + k * wide, -WORLD.half, wide, ring]);
      rects.push([-WORLD.half + k * wide, core, wide, ring]);
    }
    for (let z = -core; z < core; z += 128) {
      rects.push([-WORLD.half, z, ring, 128]);
      rects.push([core, z, ring, 128]);
    }
  }
  const indexCache = new Map();
  const indexFor = (cw, ch) => {
    const key = cw + 'x' + ch;
    if (indexCache.has(key)) return indexCache.get(key);
    const index = new Uint32Array(cw * ch * 6);
    let q = 0;
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const v = j * (cw + 1) + i;
        index[q++] = v;
        index[q++] = v + cw + 1;
        index[q++] = v + 1;
        index[q++] = v + 1;
        index[q++] = v + cw + 1;
        index[q++] = v + cw + 2;
      }
    }
    const attr = new THREE.BufferAttribute(index, 1);
    indexCache.set(key, attr);
    return attr;
  };
  const hAt = (i, j) => heights[clamp(j, 0, SIZE) * GRID + clamp(i, 0, SIZE)];
  for (const [x0, z0, cw, ch] of rects) {
    const gi0 = x0 + WORLD.half;
    const gj0 = z0 + WORLD.half;
    const pos = new Float32Array((cw + 1) * (ch + 1) * 3);
    const nor = new Float32Array((cw + 1) * (ch + 1) * 3);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let j = 0; j <= ch; j++) {
      for (let i = 0; i <= cw; i++) {
        const gi = gi0 + i;
        const gj = gj0 + j;
        const o = (j * (cw + 1) + i) * 3;
        const y = hAt(gi, gj);
        pos[o] = gi - WORLD.half;
        pos[o + 1] = y;
        pos[o + 2] = gj - WORLD.half;
        const nx = hAt(gi - 1, gj) - hAt(gi + 1, gj);
        const nz = hAt(gi, gj - 1) - hAt(gi, gj + 1);
        const inv = 1 / Math.hypot(nx, 2, nz);
        nor[o] = nx * inv;
        nor[o + 1] = 2 * inv;
        nor[o + 2] = nz * inv;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(indexFor(cw, ch));
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(x0, minY, z0), new THREE.Vector3(x0 + cw, maxY, z0 + ch));
    geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  scene.add(group);

  if (physics) {
    const R = physics.RAPIER;
    const column = new Float32Array(GRID * GRID);
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) column[i * GRID + j] = heights[j * GRID + i];
    const desc = R.ColliderDesc.heightfield(SIZE, SIZE, column, { x: SIZE, y: 1, z: SIZE }).setFriction(1).setRestitution(0);
    physics.tag(physics.world.createCollider(desc), 'terrain');
  }

  function groundAt(x, z) {
    const i = clamp(Math.floor(((x + WORLD.half) / SIZE) * SPLAT), 0, SPLAT - 1);
    const j = clamp(Math.floor(((z + WORLD.half) / SIZE) * SPLAT), 0, SPLAT - 1);
    const o = (j * SPLAT + i) * 4;
    let best = 0;
    let bestW = -1;
    for (let k = 0; k < 4; k++) {
      if (splat.a[o + k] > bestW) {
        bestW = splat.a[o + k];
        best = k;
      }
      if (splat.b[o + k] > bestW) {
        bestW = splat.b[o + k];
        best = k + 4;
      }
    }
    return best;
  }

  function vegAt(x, z) {
    const i = clamp(Math.floor(((x + WORLD.half) / SIZE) * SPLAT), 0, SPLAT - 1);
    const j = clamp(Math.floor(((z + WORLD.half) / SIZE) * SPLAT), 0, SPLAT - 1);
    const o = (j * SPLAT + i) * 4;
    return { grass: splat.veg[o] / 255, reeds: splat.veg[o + 1] / 255, forest: splat.veg[o + 2] / 255 };
  }

  return { group, material, heights, splat, noise, groundAt, vegAt, heightGrid: (x, z) => gridHeight(heights, x, z) };
}
