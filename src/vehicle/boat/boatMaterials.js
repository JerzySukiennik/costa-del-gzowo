// Costa del Gzowo boats: shared boat materials (one vertex-coloured multi-finish solid with teak, non-skid and brushed patterns and lamp channels, plus tinted glass).
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';

export const CH = { NONE: 0, RED: 1, GREEN: 2, WHITE: 3, ACCENT: 4, FLOOD: 5, CABIN: 6, SCREEN: 7, GOLD: 8 };
export const PAT = { TEAK: 20, GRIP: 21, BRUSHED: 22, CARBON: 23 };

const V_PARS = `
attribute vec4 aFinish;
varying vec4 vFinish;
varying vec3 vLocal;
`;
const V_SNIP = `
vFinish = aFinish;
vLocal = position;
`;
const F_PARS = `
varying vec4 vFinish;
varying vec3 vLocal;
uniform vec3 uLamp[9];
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
}
`;
const ROUGH = `
roughnessFactor = bRough >= 0.0 ? bRough : vFinish.x;
metalnessFactor = vFinish.y;
`;
const PHYSICAL = `
#ifdef USE_CLEARCOAT
  material.clearcoat *= vFinish.z;
#endif
`;
const EMISSIVE = `
{
  int ch = int(vFinish.w + 0.5);
  if (ch > 0 && ch < 9) totalEmissiveRadiance += uLamp[ch];
}
`;
const GLASS_PARS = `
uniform float uBase;
`;
const GLASS_FINAL = `
{
  float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.6, 0.1));
  gl_FragColor.a = clamp(uBase + lum * 0.4, 0.0, 0.97);
}
`;

export function createBoatMaterials(lighting) {
  const reg = (m) => {
    if (lighting && lighting.register) lighting.register(m);
    return m;
  };
  const lamps = Array.from({ length: 9 }, () => new THREE.Vector3());
  const solid = reg(hookMaterial(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.15, side: THREE.DoubleSide }), {
    key: 'boat-solid', uniforms: { uLamp: { value: lamps } }, pars: V_PARS, fragPars: F_PARS, vertex: V_SNIP, color: COLOR, normal: ROUGH, physical: PHYSICAL, emissive: EMISSIVE, dynamic: true,
  }));
  const glass = (tint = 0x0a1418, base = 0.2) => {
    const uniforms = { uBase: { value: base } };
    const m = reg(hookMaterial(new THREE.MeshPhysicalMaterial({
    color: tint, metalness: 0, roughness: 0.03, envMapIntensity: 1.35, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }), { key: 'boat-glass', uniforms, fragPars: GLASS_PARS, final: GLASS_FINAL }));
    m.userData.uniforms = uniforms;
    m.userData.base = base;
    return m;
  };
  const COLORS = {
    [CH.RED]: [1, 0.04, 0.02], [CH.GREEN]: [0.05, 1, 0.25], [CH.WHITE]: [1, 0.97, 0.92], [CH.ACCENT]: [0.35, 0.85, 1],
    [CH.FLOOD]: [0.8, 0.95, 1], [CH.CABIN]: [1, 0.72, 0.42], [CH.SCREEN]: [0.5, 0.75, 1], [CH.GOLD]: [1, 0.62, 0.2],
  };
  return {
    solid,
    glass,
    lamps,
    setLamp(ch, level) {
      const c = COLORS[ch];
      lamps[ch].set(c[0] * level, c[1] * level, c[2] * level);
    },
  };
}
