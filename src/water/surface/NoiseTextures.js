// Costa del Gzowo water: one-time GPU generation of tileable foam (lace, bubbles, streaks, blobs) and current-boil height/gradient textures.
import * as THREE from 'three';
import { FullscreenPass, passMaterial, makeTarget, saveState, restoreState } from '../gpu.js';
import { GLSL_HASH } from '../glsl/common.js';

const NOISE = `
${GLSL_HASH}
vec2 grad(vec2 cell, float period, float seed) {
  vec2 h = hash22(mod(cell, period) + seed * 17.13);
  float a = h.x * 6.2831853;
  return vec2(cos(a), sin(a));
}
float gnoise(vec2 p, float period, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(i, period, seed), f);
  float b = dot(grad(i + vec2(1.0, 0.0), period, seed), f - vec2(1.0, 0.0));
  float c = dot(grad(i + vec2(0.0, 1.0), period, seed), f - vec2(0.0, 1.0));
  float d = dot(grad(i + vec2(1.0, 1.0), period, seed), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 uv, float period, int oct, float seed) {
  float s = 0.0;
  float a = 0.5;
  float n = 0.0;
  float p = period;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * gnoise(uv * p, p, seed + float(i));
    n += a;
    a *= 0.5;
    p *= 2.0;
  }
  return s / n;
}
vec3 worley(vec2 p, float period, float seed) {
  vec2 c = floor(p);
  vec2 f = fract(p);
  float f1 = 9.0;
  float f2 = 9.0;
  float id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cell = mod(c + g, period);
      vec2 o = hash22(cell + seed * 31.7);
      vec2 d = g + o - f;
      float dd = dot(d, d);
      if (dd < f1) {
        f2 = f1;
        f1 = dd;
        id = hash12(cell + seed * 5.3);
      } else if (dd < f2) {
        f2 = dd;
      }
    }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}
`;

const FOAM_FRAG = `
${NOISE}
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  vec2 warp = vec2(fbm(uv, 5.0, 4, 1.0), fbm(uv, 5.0, 4, 2.0)) * 0.11;
  vec2 wuv = uv + warp;
  float clumps = fbm(wuv, 7.0, 5, 4.0) * 0.5 + 0.5;
  float detail = fbm(wuv * 1.0 + warp, 19.0, 3, 5.0) * 0.5 + 0.5;
  vec3 w1 = worley(wuv * 14.0, 14.0, 1.0);
  vec3 w2 = worley((uv + warp * 1.6) * 31.0, 31.0, 2.0);
  vec3 w3 = worley((uv + warp * 0.7) * 63.0, 63.0, 3.0);
  float bubbleHoles = smoothstep(0.42, 0.12, w2.x) * step(0.45, w2.z) * 0.55 + smoothstep(0.35, 0.1, w3.x) * step(0.6, w3.z) * 0.35;
  float filaments = 1.0 - smoothstep(0.0, 0.22, w1.y - w1.x);
  float foam = clumps * 0.85 + (detail - 0.5) * 0.45 + filaments * 0.18 - bubbleHoles * 0.45 + 0.05;
  foam = clamp(foam, 0.0, 1.0);
  float r = mix(0.15, 0.45, w3.z);
  float dots = smoothstep(r, r * 0.4, w3.x) * step(0.72, w3.z);
  float ring = smoothstep(r * 0.45, r * 0.8, w3.x) * smoothstep(r * 1.1, r * 0.8, w3.x) * step(0.72, w3.z);
  float bub = clamp(dots * 0.7 + ring, 0.0, 1.0) * smoothstep(0.35, 0.6, clumps);
  float streak = fbm(uv, 8.0, 5, 7.0) * 0.5 + 0.5;
  float blob = fbm(uv, 3.0, 4, 9.0) * 0.5 + 0.5;
  gl_FragColor = vec4(foam, bub, streak, blob);
}
`;

const BOIL_FRAG = `
${NOISE}
varying vec2 vUv;
uniform float uSize;
float boil(vec2 uv) {
  vec3 w = worley(uv * 5.0, 5.0, 11.0);
  float dome = 1.0 - smoothstep(0.0, 0.75, w.x);
  dome = dome * dome * (0.4 + 0.6 * w.z);
  float n = fbm(uv, 3.0, 4, 12.0);
  return dome * 0.8 + n * 0.5;
}
void main() {
  vec2 uv = vUv;
  float e = 1.0 / uSize;
  float h = boil(uv);
  float hx = boil(uv + vec2(e, 0.0)) - boil(uv - vec2(e, 0.0));
  float hz = boil(uv + vec2(0.0, e)) - boil(uv - vec2(0.0, e));
  gl_FragColor = vec4(hx / (2.0 * e), hz / (2.0 * e), h, fbm(uv, 6.0, 3, 13.0) * 0.5 + 0.5);
}
`;

export function createNoiseTextures(renderer, { foamSize = 512, boilSize = 256 } = {}) {
  const state = saveState(renderer);
  const foam = makeTarget(foamSize, foamSize, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter,
    wrap: THREE.RepeatWrapping,
    mipmaps: true,
    anisotropy: Math.min(2, renderer.capabilities.getMaxAnisotropy()),
  });
  const boil = makeTarget(boilSize, boilSize, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearMipmapLinearFilter,
    wrap: THREE.RepeatWrapping,
    mipmaps: true,
  });
  const foamPass = new FullscreenPass(passMaterial(FOAM_FRAG, {}));
  foamPass.render(renderer, foam);
  const boilPass = new FullscreenPass(passMaterial(BOIL_FRAG, { uSize: { value: boilSize } }));
  boilPass.render(renderer, boil);
  foamPass.dispose();
  boilPass.dispose();
  restoreState(renderer, state);
  return { foam, boil, foamTexture: foam.texture, boilTexture: boil.texture };
}
