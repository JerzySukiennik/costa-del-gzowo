// Costa del Gzowo: car materials (flake metallic paint with clearcoat, damage and dirt, multi-finish solid parts with lamp channels, glass, leather, rubber, fabric, screens).
import * as THREE from 'three';
import { hookMaterial } from '../render/shaderHooks.js';

const V_BODY = `
attribute float aEdge;
attribute vec3 aRest;
attribute float aProj;
varying float vEdge;
varying vec3 vRest;
flat varying float vProj;
`;
const V_BODY_SNIP = `
vEdge = aEdge;
vRest = aRest;
vProj = aProj;
`;
const F_BODY = `
varying float vEdge;
varying vec3 vRest;
flat varying float vProj;
uniform sampler2D tNoise;
`;

const PAINT_PARS = F_BODY + `
uniform sampler2D tDamage;
uniform float uDirt;
uniform float uFlake;
float gCoat;
float gRough;
float gFlake;
`;
const PAINT_COLOR = `
{
  vec2 duv;
  if (vProj < 0.5) duv = vec2(vRest.x / 5.0 + 0.5, vRest.y / 1.5) * 0.5;
  else if (vProj < 1.5) duv = vec2(vRest.x / 5.0 + 0.5, vRest.y / 1.5) * 0.5 + vec2(0.5, 0.0);
  else if (vProj < 2.5) duv = vec2(vRest.x / 5.0 + 0.5, vRest.z / 2.0 + 0.5) * 0.5 + vec2(0.0, 0.5);
  else duv = vec2(vRest.z / 2.0 + 0.5, vRest.y / 1.5) * vec2(0.25, 0.5) + vec2(vRest.x > 0.0 ? 0.5 : 0.75, 0.5);
  vec4 dmg = texture2D(tDamage, duv);
  float grit = texture2D(tNoise, vRest.xy * 0.9 + vRest.z * 0.37).r;
  float streak = texture2D(tNoise, vec2(vRest.x * 0.35, vRest.y * 6.0 + vRest.z)).g;
  float dust = clamp(smoothstep(0.62, 0.16, vRest.y) * (0.25 + 0.75 * grit) * uDirt + dmg.g + uDirt * 0.12 * streak * smoothstep(0.9, 0.3, vRest.y), 0.0, 1.0);
  float scratch = smoothstep(0.12, 0.5, dmg.r);
  float gap = smoothstep(0.3, 1.0, vEdge);
  vec3 bare = mix(vec3(0.3, 0.31, 0.32), vec3(0.62, 0.63, 0.65), smoothstep(0.55, 0.95, dmg.r));
  diffuseColor.rgb = mix(diffuseColor.rgb, bare, scratch);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.25, 0.22, 0.18), dust * 0.72);
  diffuseColor.rgb *= 1.0 - 0.9 * gap;
  gCoat = (1.0 - scratch) * (1.0 - dust * 0.8) * (1.0 - gap * 0.7);
  gRough = max(scratch * 0.5, dust * 0.75);
  gFlake = gCoat * (1.0 - gap);
}
`;
const PAINT_ROUGH = `roughnessFactor = max(roughnessFactor, gRough);`;
const PAINT_NORMAL = `
{
  vec3 cell = floor(vRest * 1500.0);
  vec3 h = fract(sin(vec3(dot(cell, vec3(12.9898, 78.233, 37.719)), dot(cell, vec3(39.346, 11.135, 83.155)), dot(cell, vec3(73.156, 52.235, 9.151)))) * 43758.5453) - 0.5;
  normal = normalize(normal + h * uFlake * gFlake);
}
`;
const PAINT_PHYSICAL = `
#ifdef USE_CLEARCOAT
  material.clearcoat *= gCoat;
  material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.45, 1.0 - gCoat);
#endif
`;

const SOLID_V = `
attribute vec4 aFinish;
varying vec4 vFinish;
varying vec3 vLocal;
`;
const SOLID_V_SNIP = `
vFinish = aFinish;
vLocal = position;
`;
const SOLID_F = `
varying vec4 vFinish;
varying vec3 vLocal;
uniform float uLamp[9];
uniform vec2 uHeadBroken;
uniform vec2 uTailBroken;
`;
const SOLID_NORMAL = `
roughnessFactor = vFinish.x;
metalnessFactor = vFinish.y;
`;
const SOLID_PHYSICAL = `
#ifdef USE_CLEARCOAT
  material.clearcoat *= vFinish.z;
#endif
`;
const SOLID_EMISSIVE = `
{
  int ch = int(vFinish.w + 0.5);
  if (ch > 0) {
    float left = vLocal.z < 0.0 ? 1.0 : 0.0;
    float head = 1.0 - mix(uHeadBroken.y, uHeadBroken.x, left);
    float tail = 1.0 - mix(uTailBroken.y, uTailBroken.x, left);
    vec3 e = vec3(0.0);
    float k = uLamp[ch];
    if (ch == 1 || ch == 2) e = vec3(1.0, 0.97, 0.92) * k * head;
    else if (ch == 3 || ch == 4) e = vec3(1.0, 0.035, 0.015) * k * tail;
    else if (ch == 5) e = vec3(1.0, 0.98, 0.95) * k * tail;
    else if (ch == 6) e = vec3(1.0, 0.42, 0.02) * k;
    else if (ch == 7) e = vec3(1.0, 0.5, 0.22) * k;
    else e = vec3(0.55, 0.78, 1.0) * k;
    totalEmissiveRadiance += e;
  }
}
`;

const GLASS_PARS = F_BODY + `
uniform float uCrack;
uniform float uBase;
`;
const GLASS_FINAL = `
{
  float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.6, 0.1));
  float a = clamp(uBase + lum * 0.4, 0.0, 0.96);
  #ifdef USE_COLOR
    a = clamp(a + (vColor.r - vColor.g) * 1.1, 0.0, 0.97);
  #endif
  if (uCrack > 0.0) {
    vec2 p = vRest.xy * 7.0 + vRest.z * 5.3;
    float n1 = texture2D(tNoise, p * 0.11).r;
    float n2 = texture2D(tNoise, p * 0.47 + 0.3).g;
    float web = smoothstep(0.035, 0.0, abs(n1 - 0.5)) + smoothstep(0.03, 0.0, abs(n2 - 0.5)) * 0.8;
    web *= uCrack;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.6, 1.7, 1.75), clamp(web, 0.0, 1.0) * 0.8);
    a = clamp(a + web * 0.8 + uCrack * 0.2, 0.0, 1.0);
  }
  gl_FragColor.a = a;
}
`;

export function noiseTexture() {
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  let seed = 2027;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rnd() * 256);
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function weaveTextures() {
  const normal = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const over = ((x >> 2) + (y >> 2)) % 2 === 0;
        g.fillStyle = over ? 'rgb(150,128,240)' : 'rgb(128,150,240)';
        g.fillRect(x, y, 2, 4);
        g.fillStyle = over ? 'rgb(106,128,240)' : 'rgb(128,106,240)';
        g.fillRect(x + 2, y, 2, 4);
      }
    }
  }, false);
  normal.repeat.set(26, 26);
  return { normal };
}

export function createCarMaterials({ lighting, leatherMaps, paintColor = 0x8f1c12 }) {
  const noise = { value: noiseTexture() };
  const damageCanvas = document.createElement('canvas');
  damageCanvas.width = damageCanvas.height = 1024;
  const damageCtx = damageCanvas.getContext('2d');
  damageCtx.fillStyle = '#000';
  damageCtx.fillRect(0, 0, 1024, 1024);
  const damageTexture = new THREE.CanvasTexture(damageCanvas);
  damageTexture.colorSpace = THREE.NoColorSpace;
  damageTexture.generateMipmaps = false;
  damageTexture.minFilter = damageTexture.magFilter = THREE.LinearFilter;

  const reg = (m) => {
    if (lighting && lighting.register) lighting.register(m);
    return m;
  };
  const paintUniforms = { tNoise: noise, tDamage: { value: damageTexture }, uDirt: { value: 0.18 }, uFlake: { value: 0.045 } };
  const paint = reg(hookMaterial(new THREE.MeshPhysicalMaterial({ color: paintColor, metalness: 0.55, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.025, envMapIntensity: 1.25, side: THREE.DoubleSide }), {
    key: 'car-paint', uniforms: paintUniforms, pars: V_BODY, fragPars: PAINT_PARS, vertex: V_BODY_SNIP, color: PAINT_COLOR, rough: PAINT_ROUGH, normal: PAINT_NORMAL, physical: PAINT_PHYSICAL, dynamic: true,
  }));

  const lampUniforms = { uLamp: { value: [0, 1, 0, 1, 0, 0, 0, 0.35, 1.2] }, uHeadBroken: { value: new THREE.Vector2() }, uTailBroken: { value: new THREE.Vector2() } };
  const solid = reg(hookMaterial(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }), {
    key: 'car-solid', uniforms: lampUniforms, pars: SOLID_V, fragPars: SOLID_F, vertex: SOLID_V_SNIP, normal: SOLID_NORMAL, physical: SOLID_PHYSICAL, emissive: SOLID_EMISSIVE, dynamic: true,
  }));

  const glassMaterials = {};
  const makeGlass = (name, base = 0.22, tint = 0x0a1114, vertexColors = false) => {
    const uniforms = { tNoise: noise, uCrack: { value: 0 }, uBase: { value: base } };
    const m = reg(hookMaterial(new THREE.MeshPhysicalMaterial({ color: tint, vertexColors, metalness: 0, roughness: 0.02, envMapIntensity: 1.3, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }), {
      key: 'car-glass', uniforms, pars: V_BODY, fragPars: GLASS_PARS, vertex: V_BODY_SNIP, final: GLASS_FINAL,
    }));
    m.userData.uniforms = uniforms;
    if (name) glassMaterials[name] = m;
    return m;
  };
  const lens = makeGlass(null, 0.04, 0xffffff, true);

  const leather = reg(hookMaterial(new THREE.MeshStandardMaterial({ normalMap: leatherMaps.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, color: 0xffffff, roughness: 0.62, metalness: 0 }), { key: 'car-leather', dynamic: true }));

  const fabricTex = weaveTextures();
  const fabric = reg(hookMaterial(new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.92, metalness: 0, normalMap: fabricTex.normal, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide }), { key: 'car-fabric', dynamic: true }));

  return { paint, solid, lens, leather, fabric, makeGlass, glassMaterials, paintUniforms, lampUniforms, noise, damageCanvas, damageCtx, damageTexture, register: reg, canvasTexture };
}

export function screenMaterial(texture, lighting, gain = 1.4) {
  const m = hookMaterial(new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.12, metalness: 0, emissive: new THREE.Color(gain, gain, gain), emissiveMap: texture }), { key: 'car-screen', dynamic: true });
  if (lighting && lighting.register) lighting.register(m);
  return m;
}
