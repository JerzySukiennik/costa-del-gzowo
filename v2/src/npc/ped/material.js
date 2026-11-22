// Costa del Gzowo: the pedestrian material (one program for everybody: palette slots, skin with face detail drawn in rest space and a soft sky fill, patterned cloth, hair strands).
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';
import { EYE } from '../../player/character/sculptHead.js';
import { SLOT, SLOT_COUNT, FACE_RANGE } from './format.js';

const f = (v) => v.toFixed(5);
const DAYLIGHT = { value: new THREE.Vector4(1, 1.4, 0, 0) };

const VERT_PARS = `
attribute vec4 aMat;
attribute vec3 aFace;
uniform vec3 uPal[${SLOT_COUNT}];
varying vec3 vTint;
varying vec3 vKind;
varying vec3 vFace;
varying vec3 vRest;
`;

const VERT = `
float pdShade = aMat.y * ${f(2 / 255)};
if (aMat.w > 0.5 && aMat.w < 1.5) pdShade = mix(pdShade, max(pdShade, 1.0), 0.7);
vTint = uPal[int(aMat.x + 0.5)] * pdShade;
vKind = vec3(aMat.z * ${f(1 / 255)}, aMat.w, 0.0);
vFace = aFace * ${f(FACE_RANGE)};
vRest = position;
`;

const FRAG_PARS = `
uniform vec3 uPal[${SLOT_COUNT}];
uniform vec4 uFeature;
uniform vec4 uLip;
uniform vec4 uPattern;
uniform vec4 uDaylight;
varying vec3 vTint;
varying vec3 vKind;
varying vec3 vFace;
varying vec3 vRest;
float pdHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float pdNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 q = fract(p);
  q = q * q * (3.0 - 2.0 * q);
  return mix(mix(mix(pdHash(i), pdHash(i + vec3(1.0, 0.0, 0.0)), q.x), mix(pdHash(i + vec3(0.0, 1.0, 0.0)), pdHash(i + vec3(1.0, 1.0, 0.0)), q.x), q.y),
             mix(mix(pdHash(i + vec3(0.0, 0.0, 1.0)), pdHash(i + vec3(1.0, 0.0, 1.0)), q.x), mix(pdHash(i + vec3(0.0, 1.0, 1.0)), pdHash(i + vec3(1.0, 1.0, 1.0)), q.x), q.y), q.z);
}
float pdLip(vec3 h, out float line) {
  float sx = abs(h.x);
  float front = smoothstep(0.072, 0.082, h.z);
  float up = 0.0086 - 7.5 * sx * sx + 0.0011 * exp(-pow((sx - 0.0062) / 0.0028, 2.0)) - 0.0013 * exp(-pow(sx / 0.0026, 2.0));
  float lo = -0.0172 + 15.0 * sx * sx;
  float m = front * smoothstep(0.027, 0.0235, sx) * smoothstep(up + 0.0012, up - 0.0008, h.y) * smoothstep(lo - 0.0012, lo + 0.0009, h.y);
  line = front * smoothstep(0.0014, 0.0003, abs(h.y + 0.0024 + 2.5 * sx * sx)) * smoothstep(0.0265, 0.021, sx);
  return m;
}
float pdBrow(vec3 h) {
  float sx = abs(h.x);
  float u = clamp((sx - 0.011) / 0.047, 0.0, 1.0);
  float by = 0.0935 + 0.0065 * sin(u * 2.4) - 0.0035 * u * u;
  float th = mix(0.0068, 0.0032, u) * uFeature.x;
  float m = smoothstep(0.009, 0.015, sx) * smoothstep(0.061, 0.052, sx) * smoothstep(th * 1.15, th * 0.25, abs(h.y - by)) * smoothstep(0.05, 0.062, h.z);
  float strands = pdNoise(vec3(sx * 700.0, (h.y - by) * 220.0 + sx * 90.0, h.z * 300.0));
  return clamp(m * (0.5 + 0.7 * strands), 0.0, 1.0);
}
float pdLash(vec3 h, out float crease) {
  float s = sign(h.x);
  vec3 q = h - vec3(s * ${f(EYE.x)}, ${f(EYE.y)}, ${f(EYE.z)});
  float x = q.x * s;
  float u = (x + 0.0012) / ${f(EYE.w)};
  float shape = max(0.0, 1.0 - u * u);
  float lift = 0.0009 * u + x * ${f(EYE.tilt)};
  float top = ${f(EYE.up)} * pow(shape, 0.8) + lift;
  float bot = -${f(EYE.down)} * pow(shape, 0.9) + lift * 0.6 - 0.0006;
  float near = step(0.0, q.z + 0.006) * smoothstep(0.0175, 0.0155, length(q));
  float upper = smoothstep(0.0026, 0.0005, abs(q.y - top + 0.0003)) * smoothstep(1.15, 0.85, abs(u));
  float lower = smoothstep(0.0012, 0.0003, abs(q.y - bot)) * smoothstep(1.02, 0.7, abs(u)) * 0.4;
  crease = near * smoothstep(0.003, 0.0008, abs(q.y - top - 0.0044 - 0.002 * shape)) * smoothstep(1.1, 0.6, abs(u));
  return near * clamp(upper + lower, 0.0, 1.0);
}
float pdStubble(vec3 h) {
  float sx = abs(h.x);
  float jaw = smoothstep(0.034, 0.016, h.y - max(0.0, sx - 0.035) * 0.55) * smoothstep(-0.09, -0.058, h.y) * smoothstep(-0.045, -0.005, h.z);
  float side = smoothstep(0.05, 0.062, sx) * smoothstep(0.07, 0.03, h.y) * smoothstep(-0.03, 0.0, h.z) * smoothstep(0.07, 0.04, h.z);
  return min(1.0, jaw + side);
}
`;

const COLOR = `
{
  vec3 c = vTint;
  float kind = vKind.y;
  if (kind > 0.5 && kind < 1.5) {
    c *= 0.93 + 0.12 * pdNoise(vRest * 40.0);
    vec3 h = vFace;
    if (h.y > -0.2) {
      float sx = abs(h.x);
      float front = smoothstep(0.02, 0.06, h.z);
      float cheek = smoothstep(0.045, 0.012, length(vec3(sx - 0.05, h.y - 0.018, h.z - 0.05)));
      float nose = smoothstep(0.022, 0.004, length(h - vec3(0.0, 0.033, 0.106)));
      float chin = smoothstep(0.03, 0.008, length(h - vec3(0.0, -0.05, 0.08)));
      c = mix(c, c * vec3(1.12, 0.84, 0.8), min(1.0, cheek * 0.45 + nose * 0.3 + chin * 0.14));
      float brow = smoothstep(0.1, 0.135, h.y) * front * smoothstep(0.07, 0.03, sx);
      c = mix(c, c * vec3(1.06, 1.03, 0.95), brow * 0.5);
      float under = front * smoothstep(0.013, 0.003, length(vec2(sx - ${f(EYE.x)}, (h.y - ${f(EYE.y - 0.0125)}) * 1.7)));
      c = mix(c, c * vec3(0.84, 0.78, 0.83), under * 0.3);
      float lid = front * smoothstep(0.012, 0.004, length(vec2(sx - ${f(EYE.x)}, (h.y - ${f(EYE.y + 0.0092)}) * 1.9)));
      c = mix(c, c * vec3(0.9, 0.8, 0.8), lid * 0.25);
      float nostril = smoothstep(0.004, 0.0015, length(vec3(sx - 0.0088, h.y - 0.0215, (h.z - 0.0965) * 0.7)));
      c *= 1.0 - nostril * 0.32;
      float phil = smoothstep(0.004, 0.0, sx) * smoothstep(0.004, 0.012, h.y) * smoothstep(0.022, 0.016, h.y) * smoothstep(0.085, 0.092, h.z);
      c *= 1.0 - phil * 0.1;
      float fold = smoothstep(0.004, 0.0, abs(length(vec2(sx - 0.012, h.y - 0.03) * vec2(1.0, 0.8)) - 0.024)) * smoothstep(0.0, 0.03, -h.y + 0.03) * step(0.017, sx) * smoothstep(0.07, 0.085, h.z);
      c *= 1.0 - fold * 0.12;
      float lineM;
      float lip = pdLip(h, lineM);
      c = mix(c, mix(c * vec3(0.92, 0.6, 0.58), uLip.rgb, uLip.a), lip * 0.85);
      c *= 1.0 - lineM * 0.5;
      c = mix(c, mix(uPal[${SLOT.HAIR}] * 1.25 + 0.004, c * 0.3, uFeature.y), pdBrow(h) * 0.88);
      float crease;
      float lash = pdLash(h, crease);
      c *= 1.0 - lash * uFeature.z - crease * 0.2;
      float st = pdStubble(h) * uFeature.w;
      c = mix(c, mix(c * 0.78, uPal[${SLOT.HAIR}], 0.3), st * (0.6 + 0.4 * pdNoise(vRest * 900.0)));
    }
  } else if (kind > 1.5 && kind < 2.5) {
    if (uPattern.x > 1.5) {
      vec3 q = vRest * uPattern.y;
      vec3 cell = floor(q);
      vec3 fr = fract(q) - 0.5;
      float rnd = pdHash(cell);
      float leaf = smoothstep(0.37, 0.3, length(fr + (vec3(rnd, fract(rnd * 7.3), fract(rnd * 13.7)) - 0.5) * 0.4));
      c = mix(c, uPal[${SLOT.TOP2}] * vTint / max(uPal[${SLOT.TOP}], vec3(0.003)), leaf * step(0.35, rnd));
    } else if (uPattern.x > 0.5) {
      float band = smoothstep(0.42, 0.5, abs(fract(vRest.y * uPattern.y) - 0.5) * 2.0);
      c = mix(c, uPal[${SLOT.TOP2}] * vTint / max(uPal[${SLOT.TOP}], vec3(0.003)), band);
    }
    c *= 0.95 + 0.08 * pdNoise(vRest * 28.0);
  } else if (kind > 2.5 && kind < 3.5) {
    float strand = pdNoise(vec3(vRest.x * 520.0, vRest.y * 46.0, vRest.z * 520.0));
    c *= 0.72 + 0.6 * strand;
  }
  diffuseColor.rgb = c;
}
`;

const ROUGH = `
roughnessFactor = vKind.x;
if (vKind.y > 0.5 && vKind.y < 1.5) {
  vec3 h = vFace;
  float lineM;
  float tz = smoothstep(0.03, 0.0, length(h.xy - vec2(0.0, 0.07)) - 0.03) * smoothstep(0.05, 0.09, h.z);
  roughnessFactor = clamp(roughnessFactor - 0.04 - tz * 0.08 - pdLip(h, lineM) * 0.2 + (pdNoise(vRest * 300.0) - 0.5) * 0.08, 0.3, 0.9);
}
if (vKind.y > 2.5 && vKind.y < 3.5) roughnessFactor = clamp(roughnessFactor + (pdNoise(vRest * 300.0) - 0.5) * 0.3, 0.3, 0.9);
`;

const FILL = `
{
  vec3 base = diffuseColor.rgb;
  if (vKind.y > 0.5 && vKind.y < 1.5) {
    float lum = dot(base, vec3(0.3, 0.55, 0.15));
    vec3 soft = mix(base, vec3(lum), 0.32) + vec3(0.012, 0.004, 0.002);
    vec3 sky = mix(vec3(0.3, 0.24, 0.18), vec3(0.24, 0.29, 0.36), vWNormal.y * 0.5 + 0.5);
    float graze = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
    float lift = 0.6 + 0.2 / (lum + 0.12);
    totalEmissiveRadiance += uDaylight.x * (soft * sky * lift * uDaylight.y + sky * (0.012 + 0.08 * graze));
  } else totalEmissiveRadiance += base * 0.08 * uDaylight.x;
}
`;

const GRADE = `
if (vKind.y > 0.5 && vKind.y < 1.5) {
  vec3 col = gl_FragColor.rgb;
  vec3 w = vec3(0.3, 0.55, 0.15);
  float al = dot(diffuseColor.rgb, w) + 0.015;
  float l = dot(col, w);
  float top = al * 2.3;
  float l2 = mix(l, pow(l / top, 0.62) * top, 0.85 * uDaylight.x);
  vec3 tone = mix(diffuseColor.rgb, vec3(al), 0.2) * vec3(1.1, 0.98, 0.88) / al;
  gl_FragColor.rgb = mix(col * (l2 / max(l, 0.0001)), tone * l2, 0.25 + 0.4 * uDaylight.x);
}
`;

export function createPedMaterial(ctx) {
  const palette = [];
  for (let i = 0; i < SLOT_COUNT; i++) palette.push(new THREE.Color(0.5, 0.5, 0.5));
  const uniforms = {
    uPal: { value: palette },
    uFeature: { value: new THREE.Vector4(1, 0, 0.8, 0) },
    uLip: { value: new THREE.Vector4(0.5, 0.2, 0.2, 0) },
    uPattern: { value: new THREE.Vector4(0, 60, 0, 0) },
    uDaylight: DAYLIGHT,
  };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, shadowSide: THREE.BackSide });
  hookMaterial(material, { key: 'npc-ped', dynamic: 'soft', pars: VERT_PARS, vertex: VERT, fragPars: FRAG_PARS, color: COLOR, rough: ROUGH, emissive: FILL, final: GRADE, uniforms });
  if (ctx && ctx.lighting && ctx.lighting.register) ctx.lighting.register(material);
  material.userData.uniforms = uniforms;
  return material;
}

export function setPedDaylight(amount) {
  DAYLIGHT.value.x = amount;
}

const FIXED = { [SLOT.DARK]: 0x0b0b0c, [SLOT.EYE]: 0xd9d2c8 };
const NAMES = { skin: SLOT.SKIN, hair: SLOT.HAIR, top: SLOT.TOP, bottom: SLOT.BOTTOM, shoe: SLOT.SHOE, accent: SLOT.ACCENT, top2: SLOT.TOP2, sole: SLOT.SOLE, iris: SLOT.IRIS, accent2: SLOT.ACCENT2 };

export function applyLook(material, person, look) {
  const u = material.userData.uniforms;
  const pal = u.uPal.value;
  for (const [slot, hex] of Object.entries(FIXED)) pal[slot].setHex(hex);
  for (const [name, slot] of Object.entries(NAMES)) pal[slot].setHex(look[name] ?? 0x808080);
  const woman = person.gender === 'f';
  const hair = pal[SLOT.HAIR];
  const fair = THREE.MathUtils.smoothstep(0.3 * hair.r + 0.55 * hair.g + 0.15 * hair.b, 0.06, 0.3);
  u.uFeature.value.set(woman ? 0.72 : 1.0, fair * 0.75, woman ? 0.62 : 0.45, look.stubble || 0);
  if (look.lip) {
    const c = new THREE.Color(look.lip[0]);
    u.uLip.value.set(c.r, c.g, c.b, look.lip[1]);
  } else u.uLip.value.set(0, 0, 0, 0);
  u.uPattern.value.set(look.pattern || 0, look.pattern === 1 ? 26 : 13, 0, 0);
}
