// Costa del Gzowo: town materials (texture-array facade shader with wear and wind, interior-mapped window glass, atlas decals).
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';

const RES = 1024;
const LAYERS = [
  { name: 'painted_plaster_wall', scale: 0.42, tint: true, bump: 0.8 },
  { name: 'painted_worn_brick', scale: 0.55, tint: true, bump: 1.2 },
  { name: 'large_red_bricks', scale: 0.62, tint: false, bump: 1.2 },
  { name: 'clay_roof_tiles_02', scale: 0.42, tint: false, bump: 1.3 },
  { name: 'distressed_painted_planks', scale: 0.5, tint: true, bump: 1.0 },
  { name: 'corrugated_iron', scale: 0.45, tint: false, bump: 1.4 },
  { name: 'painted_metal_shutter', scale: 0.55, tint: true, bump: 1.2 },
  { name: 'concrete_wall_008', scale: 0.4, tint: false, bump: 0.9 },
  { name: 'concrete_pavement', scale: 0.36, tint: false, bump: 1.0 },
  { name: 'asphalt_02', scale: 0.27, tint: false, bump: 1.1 },
  { name: null, scale: 1, tint: false, bump: 0.2 },
  { name: 'gravel_floor_02', scale: 0.5, tint: false, bump: 1.0 },
];

async function buildArrays(assets) {
  const canvas = new OffscreenCanvas(RES, RES);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const bytes = RES * RES * 4;
  const albedo = new Uint8Array(bytes * LAYERS.length);
  const nra = new Uint8Array(bytes * LAYERS.length);
  const means = [];
  const pixels = async (path) => {
    const image = await assets.image(path);
    g.drawImage(image, 0, 0, RES, RES);
    return g.getImageData(0, 0, RES, RES).data;
  };
  const lin = (c) => Math.pow(c / 255, 2.2);
  for (let l = 0; l < LAYERS.length; l++) {
    const off = l * bytes;
    const def = LAYERS[l];
    if (!def.name) {
      let s = 77;
      for (let p = 0; p < bytes; p += 4) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const d = (s >>> 26) - 32;
        albedo[off + p] = albedo[off + p + 1] = albedo[off + p + 2] = 212 + (d >> 3);
        albedo[off + p + 3] = 255;
        nra[off + p] = 128 + (d >> 4);
        nra[off + p + 1] = 128 - (d >> 4);
        nra[off + p + 2] = 120;
        nra[off + p + 3] = 255;
      }
      means.push(0);
      continue;
    }
    const base = `assets/textures/${def.name}/`;
    const a = await pixels(base + 'diff.jpg');
    albedo.set(a, off);
    let sum = 0;
    for (let p = 0; p < bytes; p += 64) sum += 0.2126 * lin(a[p]) + 0.7152 * lin(a[p + 1]) + 0.0722 * lin(a[p + 2]);
    means.push(def.tint ? sum / (bytes / 64) : 0);
    const nor = new Uint8Array(await pixels(base + 'nor.jpg'));
    const arm = await pixels(base + 'arm.jpg');
    for (let p = 0; p < bytes; p += 4) {
      nra[off + p] = nor[p];
      nra[off + p + 1] = nor[p + 1];
      nra[off + p + 2] = arm[p + 1];
      nra[off + p + 3] = arm[p];
    }
  }
  const make = (data, srgb) => {
    const tex = new THREE.DataArrayTexture(data, RES, RES, LAYERS.length);
    tex.format = THREE.RGBAFormat;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = Math.min(8, assets.maxAniso);
    tex.needsUpdate = true;
    return tex;
  };
  return { albedo: make(albedo, true), nra: make(nra, false), means };
}

const SURF_VERT_PARS = `
attribute vec2 aUv;
attribute vec3 aCol;
attribute vec4 aMat;
attribute vec4 aExt;
attribute vec3 aTint;
uniform float uTime;
uniform vec2 uWind;
varying vec2 vTUv;
varying vec3 vCol;
varying vec4 vMat;
varying vec4 vExt;
`;
const SURF_VERTEX = `
{
  vTUv = aUv;
  vCol = aCol;
  if (aTint.r + aTint.g + aTint.b > 0.0 && aCol.r > 0.99 && aCol.g < 0.01 && aCol.b > 0.99) vCol = aTint;
  vMat = aMat;
  vExt = aExt;
  if (aExt.z > 0.0) {
    vec3 p = transformed;
    float ph = aExt.w + p.x * 0.21 + p.z * 0.17;
    float g = 0.55 + 0.45 * sin(uTime * 0.31 + p.x * 0.013);
    float s = sin(uTime * 2.3 + ph) * 0.55 + sin(uTime * 4.1 + ph * 1.7 + p.y) * 0.3 + sin(uTime * 9.7 + ph * 3.1 + p.y * 3.0) * 0.15;
    transformed += vec3(uWind.x, 0.0, uWind.y) * (g * 0.6 + s * g) * aExt.z + vec3(0.0, abs(s) * 0.25, 0.0) * aExt.z;
  }
}
`;
const SURF_FRAG_PARS = `
uniform sampler2DArray tTownA;
uniform sampler2DArray tTownN;
uniform sampler2D tNoise;
uniform float uScale[12];
uniform float uMean[12];
uniform float uBump[12];
uniform float uChan[16];
uniform float uTime;
varying vec2 vTUv;
varying vec3 vCol;
varying vec4 vMat;
varying vec4 vExt;
float gRough;
float gAO;
float gMetal;
vec3 gEmit;
vec3 gNW;
`;
const SURF_COLOR = `
{
  float layer = floor(vMat.x + 0.5);
  float L = layer > 11.5 ? 10.0 : layer;
  int li = int(L);
  vec2 uv = vTUv * uScale[li];
  vec3 q0 = dFdx(vWPos);
  vec3 q1 = dFdy(vWPos);
  vec2 st0 = dFdx(uv);
  vec2 st1 = dFdy(uv);
  vec4 ta = texture(tTownA, vec3(uv, L));
  vec4 tn = texture(tTownN, vec3(uv, L));
  vec3 N = normalize(vWNormal);
  vec3 q1p = cross(q1, N);
  vec3 q0p = cross(N, q0);
  vec3 T = q1p * st0.x + q0p * st1.x;
  vec3 B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float isc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec3 mapN = vec3((tn.rg * 2.0 - 1.0) * uBump[li], 1.0);
  gNW = normalize(T * isc * mapN.x + B * isc * mapN.y + N * mapN.z);
  vec3 alb = ta.rgb;
  float mean = uMean[li];
  if (mean > 0.0) alb = alb / mean * 0.55;
  vec3 tint = vCol;
  if (layer > 11.5 && layer < 12.5) {
    float st = step(0.5, fract(vTUv.x * 1.6));
    tint = mix(vec3(0.86, 0.84, 0.78), vCol, st);
  } else if (layer > 12.5) {
    float st = fract((vTUv.x * 0.9 + vWPos.y * 2.2) - uTime * 0.6);
    tint = st < 0.33 ? vec3(0.62, 0.05, 0.05) : st < 0.5 ? vec3(0.86, 0.86, 0.84) : st < 0.83 ? vec3(0.06, 0.16, 0.55) : vec3(0.86, 0.86, 0.84);
  }
  vec3 col = alb * tint;
  float wear = vMat.y;
  float vertical = 1.0 - abs(N.y);
  float n1 = texture(tNoise, vWPos.xz * 0.043 + vWPos.y * 0.031).r;
  float n2 = texture(tNoise, vWPos.xz * 0.37 + vWPos.y * 0.29).g;
  float along = dot(vWPos.xz, vec2(0.71, 0.71));
  float streak = texture(tNoise, vec2(along * 0.31, vWPos.y * 0.016)).g;
  float splash = smoothstep(1.1, 0.0, vWPos.y - 4.42 + (n1 - 0.5) * 0.7) * vertical;
  float runs = smoothstep(0.52, 0.86, streak) * vertical * (0.6 + 0.4 * n2);
  float grime = clamp(splash * 0.75 + runs * 0.45 + (n1 - 0.45) * 0.35, 0.0, 1.0) * wear;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, mix(vec3(lum), col, 0.7) * vec3(0.78, 0.7, 0.6), grime * 0.75);
  float fade = smoothstep(0.35, 0.8, n1) * wear * 0.3 * step(0.5, vertical + N.y);
  col = mix(col, vec3(lum) * 1.18 + 0.04, fade);
  diffuseColor.rgb = col;
  gRough = vExt.y >= 0.0 ? vExt.y : clamp(tn.b * 1.05, 0.3, 1.0);
  gRough = mix(gRough, min(1.0, gRough + 0.12), grime);
  gAO = mix(1.0, tn.a, 0.8);
  gMetal = vExt.x;
  float ch = uChan[int(vMat.w + 0.5)];
  gEmit = tint * vMat.z * ch;
}
`;

const GLASS_VERT_PARS = `
attribute vec4 aWin;
attribute vec4 aRoom;
varying vec4 vWin;
varying vec4 vRoom;
`;
const GLASS_VERTEX = `
vWin = aWin;
vRoom = aRoom;
`;
const GLASS_FRAG_PARS = `
uniform sampler2D tNoise;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uIndoor;
uniform float uChan[16];
varying vec4 vWin;
varying vec4 vRoom;
float gGlassRough;
float hsh(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
vec3 pastel(float s) {
  float k = floor(s * 7.0);
  if (k < 1.0) return vec3(0.82, 0.76, 0.62);
  if (k < 2.0) return vec3(0.62, 0.74, 0.72);
  if (k < 3.0) return vec3(0.86, 0.66, 0.56);
  if (k < 4.0) return vec3(0.84, 0.82, 0.76);
  if (k < 5.0) return vec3(0.58, 0.66, 0.78);
  if (k < 6.0) return vec3(0.9, 0.8, 0.52);
  return vec3(0.7, 0.62, 0.74);
}
vec3 interior(vec2 o, vec2 size, vec3 d, vec3 sunL, float depth, float seed, float kind, float lit) {
  bool shop = kind > 0.5 && abs(kind - 2.0) > 0.5;
  float sill = shop ? 0.0 : 0.95;
  float roomH = shop ? max(size.y + 0.4, 3.4) : 2.9;
  float mx = shop ? 0.2 : 0.9;
  vec3 lo = vec3(-mx, -sill, 0.0);
  vec3 hi = vec3(size.x + mx, roomH - sill, depth);
  vec3 p0 = vec3(o, 0.0);
  vec3 inv = 1.0 / d;
  vec3 t1 = (lo - p0) * inv;
  vec3 t2 = (hi - p0) * inv;
  vec3 tf = max(t1, t2);
  float t = min(min(tf.x, tf.y), tf.z);
  vec3 p = p0 + d * t;
  vec3 wall = pastel(seed);
  vec3 c;
  float face;
  if (t == tf.z) {
    face = 0.0;
    c = wall;
    float bx = p.x / max(size.x + 2.0 * mx, 0.1);
    if (kind > 3.5 && kind < 4.5) {
      float cell = floor(p.x / 0.75);
      float lx = fract(p.x / 0.75) * 0.75 - 0.375;
      float body = step(p.y, 1.0) * step(0.1, p.y);
      float ly = p.y - 0.55;
      float doorR = length(vec2(lx, ly));
      c = mix(c, vec3(0.92, 0.92, 0.9), body);
      c = mix(c, vec3(0.2, 0.24, 0.3), body * step(doorR, 0.24));
      c = mix(c, vec3(0.75, 0.82, 0.9), body * step(doorR, 0.19) * step(0.5, hsh(cell + seed * 30.0)));
      float upper = step(1.2, p.y) * step(p.y, 2.1);
      c = mix(c, vec3(0.88, 0.88, 0.86), upper);
      c = mix(c, vec3(0.2, 0.24, 0.3), upper * step(length(vec2(lx, p.y - 1.65)), 0.22));
    } else if (kind > 4.5) {
      float tile = mod(floor(p.x / 0.2) + floor(p.y / 0.2), 2.0);
      c = mix(vec3(0.92, 0.9, 0.85), vec3(0.15, 0.15, 0.15), tile * step(p.y, 1.2));
      c = mix(c, vec3(0.75, 0.15, 0.12), step(1.2, p.y) * step(p.y, 1.35));
      float pie = step(abs(p.x - size.x * 0.5), 0.8) * step(1.6, p.y) * step(p.y, 2.2);
      c = mix(c, vec3(0.95, 0.85, 0.6), pie);
    } else if (shop) {
      float shelf = step(0.0, p.y + sill - 0.3) * step(p.y + sill, 2.2);
      float row = fract((p.y + sill) / 0.45);
      float item = hsh(floor(p.x / 0.22) + floor((p.y + sill) / 0.45) * 7.0 + seed * 91.0);
      vec3 goods = mix(vec3(0.85, 0.3, 0.2), vec3(0.2, 0.5, 0.85), item);
      goods = mix(goods, vec3(0.95, 0.8, 0.25), step(0.66, item));
      c = mix(c, mix(goods, vec3(0.35, 0.25, 0.18), step(0.82, row)), shelf * step(0.2, row));
    } else {
      float door = step(abs(p.x - (size.x * hsh(seed * 3.1))), 0.45) * step(p.y + sill, 2.05);
      c = mix(c, vec3(0.42, 0.3, 0.2), door * step(0.5, hsh(seed * 5.7)));
      vec2 fr = vec2(p.x - size.x * 0.5 + (hsh(seed * 2.3) - 0.5) * size.x, p.y + sill - 1.6);
      float pic = step(abs(fr.x), 0.32) * step(abs(fr.y), 0.24);
      c = mix(c, mix(vec3(0.2, 0.35, 0.5), vec3(0.8, 0.5, 0.3), hsh(seed * 9.0)), pic * step(0.3, hsh(seed * 7.7)));
      float sofa = step(abs(p.x - size.x * 0.5), 0.9) * step(p.y + sill, 0.85);
      c = mix(c, vec3(0.3, 0.32, 0.4) * (0.7 + hsh(seed * 4.0)), sofa * step(0.55, hsh(seed * 1.9)));
    }
  } else if (t == tf.y) {
    if (d.y < 0.0) {
      face = 1.0;
      float plank = fract(p.x / 0.18);
      c = mix(vec3(0.42, 0.28, 0.17), vec3(0.62, 0.58, 0.52), step(0.5, hsh(seed * 2.0)));
      c *= 0.85 + 0.15 * step(0.08, plank);
    } else {
      face = 2.0;
      c = vec3(0.86, 0.85, 0.82);
    }
  } else {
    face = 3.0;
    c = wall * 0.86;
  }
  if (shop) {
    float zc = depth * 0.42;
    float tc = (zc - p0.z) / d.z;
    vec3 pc = p0 + d * tc;
    if (tc < t && pc.y < 1.0 && pc.x > size.x * 0.12 && pc.x < size.x * 0.88) {
      t = tc;
      p = pc;
      face = 4.0;
      c = kind > 4.5 ? vec3(0.8, 0.12, 0.1) : kind > 3.5 ? vec3(0.9, 0.9, 0.88) : vec3(0.45, 0.3, 0.2) * (0.8 + 0.4 * hsh(seed));
      c *= 0.8 + 0.2 * step(0.9, p.y);
    }
  }
  float depthFall = 1.0 - 0.5 * clamp(t * length(d) / max(depth, 0.5), 0.0, 1.0);
  float light = uIndoor * depthFall * (face == 2.0 ? 0.7 : 1.0);
  vec3 lamp = vec3(0.0);
  if (lit > 0.5) {
    vec3 lc = vec3(size.x * 0.5, roomH - sill - 0.05, depth * 0.5);
    float dl = length(p - lc);
    lamp = vec3(1.0, 0.72, 0.42) * (0.7 / (1.0 + dl * dl * 0.35)) * lit;
    if (face == 2.0) lamp += vec3(1.0, 0.8, 0.55) * 3.0 * smoothstep(0.28, 0.2, length(p.xz - lc.xz));
  }
  vec3 sunHit = vec3(0.0);
  if (sunL.z < -0.02) {
    float s = -p.z / sunL.z;
    vec2 w = p.xy + sunL.xy * s;
    float inWin = step(0.0, w.x) * step(w.x, size.x) * step(0.0, w.y) * step(w.y, size.y);
    sunHit = uSunColor * 0.1 * inWin * max(0.0, face == 1.0 ? -sunL.y : face == 0.0 ? -sunL.z : 0.5);
  }
  return c * (light + lamp) + c * sunHit;
}
`;
const GLASS_EMISSIVE = `
{
  vec3 N = normalize(vWNormal);
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  vec3 V = normalize(vWPos - cameraPosition);
  vec3 d = vec3(dot(V, T), dot(V, vec3(0.0, 1.0, 0.0)), -dot(V, N));
  d.z = max(d.z, 0.02);
  vec3 sunL = vec3(dot(uSunDir, T), dot(uSunDir, vec3(0.0, 1.0, 0.0)), -dot(uSunDir, N));
  float kind = floor(vRoom.z + 0.5);
  vec3 room = interior(vWin.xy, vWin.zw, d, sunL, vRoom.x, vRoom.y, kind, vRoom.w);
  vec2 u = vWin.xy / max(vWin.zw, vec2(0.01));
  float seed = vRoom.y;
  if (kind < 0.5 || abs(kind - 2.0) < 0.5) {
    float blinds = hsh(seed * 13.1);
    if (blinds < 0.4) {
      float drop = 0.25 + 0.7 * hsh(seed * 17.3);
      float slat = step(0.35, fract(vWin.y / 0.05));
      vec3 bc = mix(vec3(0.88, 0.86, 0.8), vec3(0.75, 0.65, 0.5), hsh(seed * 3.3));
      room = mix(room, bc * (uIndoor * 1.6 + 0.12), step(1.0 - drop, u.y) * slat);
    } else if (blinds < 0.75) {
      float w1 = 0.18 + 0.25 * hsh(seed * 19.7);
      float fold = 0.8 + 0.2 * sin(vWin.x * 40.0);
      vec3 cc = pastel(hsh(seed * 23.1)) * vec3(1.0, 0.9, 0.85);
      float cur = step(u.x, w1) + step(1.0 - w1, u.x);
      room = mix(room, cc * fold * (uIndoor * 1.8 + 0.1 + vRoom.w * 0.25), clamp(cur, 0.0, 1.0));
    }
  }
  float dirt = texture(tNoise, vWPos.xz * 0.21 + vWPos.y * 0.37).r;
  float edge = smoothstep(0.0, 0.08, min(min(u.x, 1.0 - u.x), min(u.y, 1.0 - u.y)));
  room *= mix(0.72, 1.0, edge) * (0.9 + 0.1 * dirt);
  gGlassRough = 0.04 + 0.18 * smoothstep(0.55, 0.9, dirt) + 0.1 * (1.0 - edge);
  totalEmissiveRadiance += room;
}
`;

const DECAL_VERT_PARS = `
attribute vec4 aGlow;
uniform float uTime;
uniform vec2 uWind;
varying vec4 vGlow;
`;
const DECAL_VERTEX = `
vGlow = aGlow;
if (aGlow.w > 0.0) {
  vec3 p = transformed;
  float ph = p.x * 0.37 + p.z * 0.29;
  float s = sin(uTime * 2.1 + ph) * 0.6 + sin(uTime * 4.7 + ph * 1.9 + p.y * 2.0) * 0.3;
  transformed += vec3(uWind.x, 0.0, uWind.y) * (0.35 + s) * aGlow.w;
}
`;
const DECAL_FRAG_PARS = `
uniform float uChan[16];
varying vec4 vGlow;
`;

export async function createTownMaterials(ctx, atlas) {
  const { assets, lighting, terrain } = ctx;
  const arrays = await buildArrays(assets);
  const chan = { value: new Array(16).fill(1) };
  const wind = { value: new THREE.Vector2(0.8, 0.6) };

  const extra = (material, extraFrag) => {
    const inner = material.onBeforeCompile;
    material.onBeforeCompile = (shader, r) => {
      inner(shader, r);
      for (const [a, b] of extraFrag) shader.fragmentShader = shader.fragmentShader.replace(a, b);
    };
    return material;
  };

  const surface = extra(
    hookMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }), {
      key: 'town-surface',
      uniforms: {
        tTownA: { value: arrays.albedo }, tTownN: { value: arrays.nra }, tNoise: { value: terrain.noise },
        uScale: { value: LAYERS.map((l) => l.scale) }, uMean: { value: arrays.means }, uBump: { value: LAYERS.map((l) => l.bump) },
        uChan: chan, uTime: ctx.time, uWind: wind,
      },
      pars: SURF_VERT_PARS,
      fragPars: SURF_FRAG_PARS,
      vertex: SURF_VERTEX,
      color: SURF_COLOR,
      rough: 'roughnessFactor = gRough;',
      normal: 'normal = normalize((viewMatrix * vec4(gNW, 0.0)).xyz);',
      emissive: 'totalEmissiveRadiance += gEmit;',
      final: 'if (vExt.z > 0.001) gl_FragColor.a = 0.0;',
    }),
    [
      ['#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gMetal;'],
      ['#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= gAO;\nreflectedLight.indirectSpecular *= mix(1.0, gAO, 0.6);\n#include <aomap_fragment>'],
    ],
  );
  lighting.register(surface);

  const glass = extra(
    hookMaterial(new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.05, metalness: 0 }), {
      key: 'town-glass',
      uniforms: { tNoise: { value: terrain.noise }, uSunDir: { value: lighting.sunDirection }, uSunColor: { value: lighting.sunColor }, uIndoor: { value: 0.16 }, uChan: chan },
      pars: GLASS_VERT_PARS,
      fragPars: GLASS_FRAG_PARS,
      vertex: GLASS_VERTEX,
      emissive: GLASS_EMISSIVE,
    }),
    [['#include <lights_physical_fragment>', 'roughnessFactor = gGlassRough;\n#include <lights_physical_fragment>']],
  );
  lighting.register(glass);

  const decal = hookMaterial(
    new THREE.MeshStandardMaterial({ map: atlas.texture, transparent: true, depthWrite: false, roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    {
      key: 'town-decal',
      uniforms: { uChan: chan, uTime: ctx.time, uWind: wind },
      pars: DECAL_VERT_PARS,
      fragPars: DECAL_FRAG_PARS,
      vertex: DECAL_VERTEX,
      color: 'diffuseColor.a *= vGlow.z;',
      emissive: 'totalEmissiveRadiance += diffuseColor.rgb * vGlow.x * uChan[int(vGlow.y + 0.5)];',
    },
  );
  lighting.register(decal);

  return { surface, glass, decal, chan, wind, layers: LAYERS };
}
