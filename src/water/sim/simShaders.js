// Costa del Gzowo water: GLSL for the camera-following two-band wave simulation (advection, wave step, foam/turbulence update).
import { GLSL_BAKE, GLSL_HASH } from '../glsl/common.js';

export const MAX_IMPULSES = 64;
export const MAX_INTERACTORS = 8;
export const MAX_OBSTACLES = 16;

const SIM_COMMON = `
${GLSL_HASH}
${GLSL_BAKE}
uniform vec4 uWindow;
uniform float uN;
uniform vec2 uShift;
uniform float uDt;
varying vec2 vUv;
vec2 windowWorld(vec2 uv) { return uWindow.xy + uv * uWindow.z; }
bool insideUnit(vec2 uv) { return uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0; }
`;

const INTERACTORS = `
uniform vec4 uIntA[${MAX_INTERACTORS}];
uniform vec4 uIntB[${MAX_INTERACTORS}];
uniform vec4 uIntC[${MAX_INTERACTORS}];
uniform int uIntCount;
vec4 interactorField(int i, vec2 p) {
  vec4 A = uIntA[i];
  vec4 B = uIntB[i];
  vec2 d = p - A.xy;
  vec2 l = vec2(d.x * B.z + d.y * B.w, -d.x * B.w + d.y * B.z);
  float rr = min(B.x, B.y) * 0.45;
  vec2 q = abs(l) - (B.xy - rr);
  float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
  float width = 0.25 + min(B.x, B.y) * 0.35;
  float mask = 1.0 - smoothstep(-0.12, width * 0.6, sdf);
  float edge = exp(-pow((sdf - width * 0.15) / width, 2.0));
  vec2 vel = A.zw;
  float speed = length(vel);
  vec2 dir = speed > 1e-3 ? vel / speed : vec2(0.0);
  float dl = length(d);
  vec2 outward = dl > 1e-3 ? d / dl : vec2(0.0);
  float front = dot(outward, dir);
  return vec4(mask, edge, front, speed);
}
`;

export const ADVECT_FRAG = `
${SIM_COMMON}
uniform sampler2D uState;
vec4 catmullRom(sampler2D tex, vec2 uv, vec2 texSize) {
  vec2 samplePos = uv * texSize;
  vec2 texPos1 = floor(samplePos - 0.5) + 0.5;
  vec2 f = samplePos - texPos1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 offset12 = w2 / w12;
  vec2 texPos0 = (texPos1 - 1.0) / texSize;
  vec2 texPos3 = (texPos1 + 2.0) / texSize;
  vec2 texPos12 = (texPos1 + offset12) / texSize;
  vec4 r = vec4(0.0);
  r += textureLod(tex, vec2(texPos0.x, texPos0.y), 0.0) * w0.x * w0.y;
  r += textureLod(tex, vec2(texPos12.x, texPos0.y), 0.0) * w12.x * w0.y;
  r += textureLod(tex, vec2(texPos3.x, texPos0.y), 0.0) * w3.x * w0.y;
  r += textureLod(tex, vec2(texPos0.x, texPos12.y), 0.0) * w0.x * w12.y;
  r += textureLod(tex, vec2(texPos12.x, texPos12.y), 0.0) * w12.x * w12.y;
  r += textureLod(tex, vec2(texPos3.x, texPos12.y), 0.0) * w3.x * w12.y;
  r += textureLod(tex, vec2(texPos0.x, texPos3.y), 0.0) * w0.x * w3.y;
  r += textureLod(tex, vec2(texPos12.x, texPos3.y), 0.0) * w12.x * w3.y;
  r += textureLod(tex, vec2(texPos3.x, texPos3.y), 0.0) * w3.x * w3.y;
  return r;
}
void main() {
  vec2 world = windowWorld(vUv);
  vec2 flow = bakeALod(world).yz;
  vec2 src = vUv + uShift / uN - flow * uDt * uWindow.w;
  if (!insideUnit(src)) {
    gl_FragColor = vec4(0.0);
    return;
  }
  gl_FragColor = catmullRom(uState, src, vec2(uN));
}
`;

export const AUX_FRAG = `
${SIM_COMMON}
${INTERACTORS}
uniform sampler2D uPrevAux;
uniform sampler2D uPrevState;
uniform vec3 uObstacles[${MAX_OBSTACLES}];
uniform int uObstacleCount;
uniform vec4 uImpA[${MAX_IMPULSES}];
uniform vec4 uImpB[${MAX_IMPULSES}];
uniform int uImpCount;
uniform vec4 uFoamParams;
void main() {
  vec2 world = windowWorld(vUv);
  vec4 b = bakeALod(world);
  float depth = b.x;
  vec2 flow = b.yz;
  float solid = depth <= 0.005 ? 1.0 : 0.0;
  for (int i = 0; i < ${MAX_OBSTACLES}; i++) {
    if (i >= uObstacleCount) break;
    vec3 o = uObstacles[i];
    if (distance(world, o.xy) < o.z) solid = 1.0;
  }
  vec2 src = vUv + uShift / uN - flow * uDt * uWindow.w;
  vec4 prev = insideUnit(src) ? textureLod(uPrevAux, src, 0.0) : vec4(0.0);
  vec4 st = insideUnit(src) ? textureLod(uPrevState, src, 0.0) : vec4(0.0);
  float foam = prev.x * exp(-uDt / uFoamParams.x);
  float turb = prev.y * exp(-uDt / uFoamParams.y);
  float energy = abs(st.y) * 1.0 + abs(st.w) * 0.7;
  float breaking = max(0.0, energy - uFoamParams.z);
  foam += breaking * uFoamParams.w * uDt;
  turb += breaking * uFoamParams.w * 2.0 * uDt;
  for (int i = 0; i < ${MAX_IMPULSES}; i++) {
    if (i >= uImpCount) break;
    vec4 a = uImpA[i];
    float d = distance(world, a.xy);
    float r = a.z * 1.6;
    if (d < r) {
      float p = 0.5 + 0.5 * cos(3.14159265 * d / r);
      vec2 q = (world - a.xy) / max(a.z, 0.2);
      float ang = atan(q.y, q.x);
      float lobes = 0.55 + 0.45 * sin(ang * 3.0 + float(i) * 1.7) * sin(ang * 5.0 - float(i) * 0.9 + d);
      float n = (0.5 + 0.8 * hash12(floor(world * 2.0) + float(i))) * lobes;
      foam += uImpB[i].x * p * n;
      turb += uImpB[i].y * p;
    }
  }
  for (int i = 0; i < ${MAX_INTERACTORS}; i++) {
    if (i >= uIntCount) break;
    vec4 f = interactorField(i, world);
    vec4 C = uIntC[i];
    float sub = C.x;
    float wading = sub * (1.0 - smoothstep(0.85, 1.0, sub));
    float speed = f.w;
    float churn = f.y * wading * (min(speed, 6.0) * min(speed, 6.0) * 0.06 + abs(C.y) * 0.4) * (0.6 + 0.6 * max(f.z, -0.3));
    foam += churn * uDt * C.z;
    turb += (churn * 2.5 + f.x * abs(C.y) * 0.8 * sub) * uDt * C.z;
  }
  foam = min(foam, 3.0) * (1.0 - solid);
  turb = min(turb, 3.0) * (1.0 - solid);
  gl_FragColor = vec4(foam, turb, depth, solid);
}
`;

export const STEP_FRAG = `
${SIM_COMMON}
${INTERACTORS}
uniform sampler2D uState;
uniform sampler2D uAux;
uniform vec4 uImpA[${MAX_IMPULSES}];
uniform vec4 uImpB[${MAX_IMPULSES}];
uniform int uImpCount;
uniform vec4 uWaveParams;
uniform vec4 uIntGain;
uniform float uDx;
uniform float uSimTime;
vec4 neighbor(ivec2 c, ivec2 n, vec4 self) {
  if (n.x < 0 || n.y < 0 || n.x >= int(uN) || n.y >= int(uN)) return self;
  if (texelFetch(uAux, n, 0).w > 0.5) return self;
  return texelFetch(uState, n, 0);
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uState, c, 0);
  vec4 a = texelFetch(uAux, c, 0);
  if (a.w > 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float depth = a.z;
  vec4 sum = neighbor(c, c + ivec2(1, 0), s) + neighbor(c, c - ivec2(1, 0), s) + neighbor(c, c + ivec2(0, 1), s) + neighbor(c, c - ivec2(0, 1), s);
  vec4 lap = (sum - 4.0 * s) / (uDx * uDx);
  vec2 world = windowWorld(vUv);
  vec2 h = s.xz;
  vec2 v = s.yw;
  float cA = uWaveParams.x * smoothstep(0.0, 0.12, depth);
  float cB = min(sqrt(9.81 * max(depth, 0.0)), uWaveParams.z);
  v.x += cA * cA * lap.x * uDt;
  v.y += cB * cB * lap.z * uDt;
  for (int i = 0; i < ${MAX_IMPULSES}; i++) {
    if (i >= uImpCount) break;
    vec4 ia = uImpA[i];
    float d = distance(world, ia.xy);
    float rho2 = d * d / (ia.z * ia.z * 0.36);
    if (rho2 < 9.0) {
      float p = (1.0 - rho2) * exp(-rho2);
      v += ia.w * p * uImpB[i].zw;
    }
  }
  for (int i = 0; i < ${MAX_INTERACTORS}; i++) {
    if (i >= uIntCount) break;
    vec4 f = interactorField(i, world);
    vec4 C = uIntC[i];
    float sub = C.x;
    float wade = sub * (1.0 - 0.6 * smoothstep(0.9, 1.0, sub));
    float stag = min(0.38, f.w * f.w / 19.62 * 0.45) * wade;
    float bow = f.y * max(f.z, 0.0);
    float stern = f.y * max(-f.z, 0.0);
    float targetB = stag * (bow - stern * 0.6);
    float jitter = (hash12(floor(world * 4.0) + floor(uSimTime * 9.0)) - 0.5) * f.y * min(f.w, 3.0) * wade;
    float heave = clamp(C.y, -3.0, 3.0) * (f.x - f.y * 0.8) * (1.0 - smoothstep(0.85, 1.0, sub));
    v.y += (targetB - h.y) * f.y * uIntGain.y * step(0.05, f.w) * uDt + heave * uIntGain.w * 0.4 * uDt;
    v.x += ((targetB * 0.5 - h.x) * f.y * uIntGain.x * step(0.05, f.w) + jitter * uIntGain.z + heave * uIntGain.w) * uDt;
    h *= 1.0 - f.x * sub * (1.0 - smoothstep(0.85, 1.0, sub)) * clamp(uDt * 3.0, 0.0, 1.0) * 0.25;
  }
  float shore = 1.0 - smoothstep(0.03, 0.5, depth);
  vec2 edge2 = min(vUv, 1.0 - vUv);
  float sponge = 1.0 - smoothstep(0.0, 0.08, min(edge2.x, edge2.y));
  v.x *= exp(-uDt * (uWaveParams.y + shore * 2.5 + sponge * 8.0));
  v.y *= exp(-uDt * (uWaveParams.w + shore * 1.4 + sponge * 8.0));
  h += v * uDt;
  h = clamp(h, vec2(-0.9), vec2(0.9));
  h *= exp(-uDt * (vec2(0.05, 0.18) + sponge * 2.0));
  gl_FragColor = vec4(h.x, v.x, h.y, v.y);
}
`;
