// Costa del Gzowo boats: shared boat materials (one vertex-coloured multi-finish solid with teak, non-skid and brushed patterns, lamp channels, a hull damage map for scrapes and gouges and fire charring, plus tinted glass that cracks).
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';

export const CH = { NONE: 0, RED: 1, GREEN: 2, WHITE: 3, ACCENT: 4, FLOOD: 5, CABIN: 6, SCREEN: 7, GOLD: 8 };
export const PAT = { TEAK: 20, GRIP: 21, BRUSHED: 22, CARBON: 23 };

const V_PARS = `
attribute vec4 aFinish;
varying vec4 vFinish;
varying vec3 vLocal;
varying vec3 vLocalN;
`;
const V_SNIP = `
vFinish = aFinish;
vLocal = position;
vLocalN = normal;
`;
const F_PARS = `
varying vec4 vFinish;
varying vec3 vLocal;
varying vec3 vLocalN;
uniform vec3 uLamp[9];
uniform sampler2D tDamage;
uniform vec4 uDamageBox;
uniform float uChar;
float bHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float bNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bHash(i), bHash(i + vec2(1.0, 0.0)), f.x), mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bRough;
`;
const COLOR = `
{
  bRough = -1.0;
  int code = int(vFinish.w + 0.5);
  if (code == ${PAT.TEAK}) {
    float plank = vLocal.z / 0.085;
    float row = floor(plank);
    float seam = smoothstep(0.43, 0.47, abs(fract(plank) - 0.5));
    float butt = step(0.985, fract(vLocal.x / 2.4 + bHash(vec2(row, 3.0))));
    float grain = bNoise(vec2(vLocal.x * 3.0, plank * 9.0 + row * 7.0)) * 0.6 + bNoise(vec2(vLocal.x * 18.0, plank * 31.0)) * 0.4;
    vec3 wood = diffuseColor.rgb * (0.78 + 0.34 * grain + 0.12 * (bHash(vec2(row, 1.0)) - 0.5));
    diffuseColor.rgb = mix(wood, vec3(0.018, 0.016, 0.014), max(seam, butt));
    bRough = mix(0.62 + 0.15 * grain, 0.9, seam);
  } else if (code == ${PAT.GRIP}) {
    float d = bNoise(vLocal.xz * 160.0);
    diffuseColor.rgb *= 0.9 + 0.12 * d;
    bRough = 0.72 + 0.2 * d;
  } else if (code == ${PAT.BRUSHED}) {
    float s = bNoise(vec2(vLocal.x * 2.0, (vLocal.y + vLocal.z) * 220.0));
    diffuseColor.rgb *= 0.93 + 0.1 * s;
    bRough = 0.22 + 0.16 * s;
  } else if (code == ${PAT.CARBON}) {
    vec2 q = floor(vec2(vLocal.x + vLocal.y, vLocal.z - vLocal.y) * 140.0);
    float w = mod(q.x + q.y, 2.0);
    diffuseColor.rgb *= 0.8 + 0.35 * w;
    bRough = 0.25 + 0.1 * w;
  }
  float base = bRough >= 0.0 ? bRough : vFinish.x;
  if (abs(vLocalN.z) > 0.3 || vLocalN.y < -0.3) {
    vec2 duv = vec2((vLocal.x - uDamageBox.x) / uDamageBox.y, clamp((vLocal.y - uDamageBox.z) / uDamageBox.w, 0.0, 1.0));
    duv.x = clamp(duv.x, 0.0, 1.0) * 0.5 + (vLocal.z > 0.0 ? 0.5 : 0.0);
    vec4 dmg = texture2D(tDamage, duv);
    float grain = bNoise(vLocal.xy * 90.0);
    float scratch = smoothstep(0.1, 0.5, dmg.r) * (0.6 + 0.4 * grain);
    float gouge = smoothstep(0.2, 0.7, dmg.g);
    vec3 bare = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1)) > 0.3 ? vec3(0.36, 0.34, 0.31) : vec3(0.66, 0.65, 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, bare * (0.8 + 0.3 * grain), scratch);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.08, 0.07) * (0.7 + 0.6 * grain), gouge);
    base = max(base, max(scratch * 0.6, gouge * 0.9));
  }
  if (uChar > 0.0) {
    float grit = bNoise(vLocal.xz * 2.7 + vLocal.y * 1.3) * 0.7 + bNoise(vLocal.xy * 13.0) * 0.3;
    float burn = clamp(uChar * 2.2 - grit * 1.1, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.015, 0.013, 0.012), vec3(0.12, 0.07, 0.04), grit * 0.5), burn);
    base = max(base, burn * 0.95);
  }
  bRough = base;
}
`;
const ROUGH = `
roughnessFactor = bRough;
metalnessFactor = vFinish.y * (1.0 - clamp(uChar * 1.5, 0.0, 1.0));
`;
const PHYSICAL = `
#ifdef USE_CLEARCOAT
  material.clearcoat *= vFinish.z * (1.0 - smoothstep(0.35, 0.8, roughnessFactor));
#endif
`;
const EMISSIVE = `
{
  int ch = int(vFinish.w + 0.5);
  if (ch > 0 && ch < 9) totalEmissiveRadiance += uLamp[ch];
}
`;
const GLASS_V = `
varying vec3 vGLocal;
`;
const GLASS_V_SNIP = `
vGLocal = position;
`;
const GLASS_PARS = `
uniform float uBase;
uniform float uCrack;
uniform vec3 uCrackAt;
varying vec3 vGLocal;
float gHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float gNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const GLASS_FINAL = `
{
  float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.6, 0.1));
  float a = clamp(uBase + lum * 0.4, 0.0, 0.97);
  if (uCrack > 0.0) {
    vec3 d = vGLocal - uCrackAt;
    float r = length(d);
    float ang = atan(d.y + d.x * 0.3, d.z);
    float spokes = smoothstep(0.06, 0.0, abs(fract(ang * 2.2 + gNoise(vec2(r * 3.0, ang)) * 0.6) - 0.5) - 0.44);
    float rings = smoothstep(0.035, 0.0, abs(fract(r * 4.0 + gNoise(vec2(ang * 3.0, r)) * 0.5) - 0.5) - 0.45);
    vec2 p = vGLocal.xz * 6.0 + vGLocal.y * 4.0;
    float web = smoothstep(0.04, 0.0, abs(gNoise(p) - 0.5)) + smoothstep(0.03, 0.0, abs(gNoise(p * 2.3 + 1.7) - 0.5)) * 0.7;
    float reach = smoothstep(0.4 + uCrack * 2.6, 0.0, r);
    float c = clamp((spokes + rings * 0.7) * reach + web * smoothstep(0.5, 1.0, uCrack) * 0.8, 0.0, 1.0) * uCrack;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.5, 1.6, 1.65), c * 0.8);
    a = clamp(a + c * 0.75 + uCrack * 0.15, 0.0, 1.0);
  }
  gl_FragColor.a = a;
}
`;

export function createBoatMaterials(lighting, box = [-4, 8, -1, 3]) {
  const reg = (m) => {
    if (lighting && lighting.register) lighting.register(m);
    return m;
  };
  const lamps = Array.from({ length: 9 }, () => new THREE.Vector3());
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const damageCtx = canvas.getContext('2d');
  damageCtx.fillStyle = '#000';
  damageCtx.fillRect(0, 0, 1024, 256);
  const damageTexture = new THREE.CanvasTexture(canvas);
  damageTexture.colorSpace = THREE.NoColorSpace;
  damageTexture.generateMipmaps = false;
  damageTexture.minFilter = damageTexture.magFilter = THREE.LinearFilter;
  const char = { value: 0 };
  const damageBox = new THREE.Vector4(...box);
  const solid = reg(hookMaterial(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.15, side: THREE.DoubleSide }), {
    key: 'boat-solid', uniforms: { uLamp: { value: lamps }, tDamage: { value: damageTexture }, uDamageBox: { value: damageBox }, uChar: char }, pars: V_PARS, fragPars: F_PARS, vertex: V_SNIP, color: COLOR, normal: ROUGH, physical: PHYSICAL, emissive: EMISSIVE, dynamic: true,
  }));
  const glass = (tint = 0x0a1418, base = 0.2) => {
    const uniforms = { uBase: { value: base }, uCrack: { value: 0 }, uCrackAt: { value: new THREE.Vector3() } };
    const m = reg(hookMaterial(new THREE.MeshPhysicalMaterial({
    color: tint, metalness: 0, roughness: 0.03, envMapIntensity: 1.35, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }), { key: 'boat-glass', uniforms, pars: GLASS_V, vertex: GLASS_V_SNIP, fragPars: GLASS_PARS, final: GLASS_FINAL }));
    m.userData.uniforms = uniforms;
    m.userData.base = base;
    return m;
  };
  const COLORS = {
    [CH.RED]: [1, 0.04, 0.02], [CH.GREEN]: [0.05, 1, 0.25], [CH.WHITE]: [1, 0.97, 0.92], [CH.ACCENT]: [0.35, 0.85, 1],
    [CH.FLOOD]: [0.8, 0.95, 1], [CH.CABIN]: [1, 0.72, 0.42], [CH.SCREEN]: [0.5, 0.75, 1], [CH.GOLD]: [1, 0.62, 0.2],
  };
  const broken = new Array(9).fill(0);
  return {
    solid,
    glass,
    lamps,
    broken,
    char,
    damageCtx,
    damageTexture,
    damageBox,
    setLamp(ch, level) {
      const c = COLORS[ch];
      const k = level * (1 - broken[ch]);
      lamps[ch].set(c[0] * k, c[1] * k, c[2] * k);
    },
  };
}
