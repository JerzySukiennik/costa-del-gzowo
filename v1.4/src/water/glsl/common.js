// Costa del Gzowo water: shared GLSL chunks (bake lookup, ambient undulation, optics, shadow, depth reconstruction, noise).

export const GLSL_CONSTANTS = `
#define PI 3.141592653589793
#define TAU 6.283185307179586
`;

export const GLSL_HASH = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float ign(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}
`;

export const GLSL_BAKE = `
uniform sampler2D uBakeA;
uniform sampler2D uBakeB;
uniform vec4 uBakeRect;
uniform float uWaterLevel;
uniform float uTime;
vec2 bakeUV(vec2 xz) { return (xz - uBakeRect.xy) * uBakeRect.zw; }
vec4 bakeA(vec2 xz) { return texture(uBakeA, bakeUV(xz)); }
vec4 bakeALod(vec2 xz) { return textureLod(uBakeA, bakeUV(xz), 0.0); }
float bakeSdf(vec2 xz) { return texture(uBakeB, bakeUV(xz)).r; }
`;

export const GLSL_UNDULATION = `
uniform vec4 uWaveA[4];
uniform vec4 uWaveB[4];
float undulationMask(float depth) {
  return 0.25 * smoothstep(-0.05, 0.25, depth) + 0.75 * smoothstep(0.2, 2.0, depth);
}
vec3 undulation(vec2 xz, float depth) {
  vec3 r = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    float ph = a.z * dot(a.xy, xz) - b.x * uTime + b.y;
    r.x += a.w * sin(ph);
    r.yz += a.w * a.z * cos(ph) * a.xy;
  }
  return r * undulationMask(depth);
}
`;

export const GLSL_OPTICS = `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform sampler2D uSkyTex;
uniform float uHasSky;
uniform float uSkyIntensity;
float hgPhase(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
float waterPhase(float c) {
  return mix(hgPhase(c, 0.82), hgPhase(c, -0.25), 0.22);
}
vec3 skyRadiance(vec3 dir) {
  if (uHasSky < 0.5) return uAmbient * (0.55 + 0.7 * max(dir.y, 0.0));
  vec2 uv = vec2(atan(dir.z, dir.x) * (0.5 / PI) + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * (1.0 / PI) + 0.5);
  return min(textureLod(uSkyTex, uv, 0.0).rgb * uSkyIntensity, vec3(400.0));
}
vec3 refractedSunDown() {
  vec3 r = refract(-uSunDir, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  return r;
}
vec3 columnInscatter(vec3 sigmaS, vec3 sigmaT, float pathLen, float muV, float muS, float phase, vec3 sunE, vec3 ambE) {
  vec3 kS = sigmaT * (1.0 + muV / max(muS, 0.05));
  vec3 kA = sigmaT * (1.0 + muV / 0.75);
  vec3 sunPart = sigmaS * sunE * phase * (1.0 - exp(-kS * pathLen)) / max(kS, vec3(1e-4));
  vec3 ambPart = sigmaS * ambE * (1.0 / (4.0 * PI)) * (1.0 - exp(-kA * pathLen)) / max(kA, vec3(1e-4));
  return sunPart + ambPart;
}
`;

export const GLSL_SHADOW = `
uniform sampler2D uSunShadow;
uniform mat4 uSunShadowMatrix;
uniform float uHasShadow;
uniform float uShadowBias;
float sunVisibility(vec3 wp) {
  if (uHasShadow < 0.5) return 1.0;
  vec4 sc = uSunShadowMatrix * vec4(wp, 1.0);
  sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.y < 0.0 || sc.x > 1.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  vec2 ts = 1.0 / vec2(textureSize(uSunShadow, 0));
  float vis = 0.0;
  vis += (sc.z - uShadowBias > texture(uSunShadow, sc.xy + vec2(-0.5, -0.5) * ts).r) ? 0.0 : 1.0;
  vis += (sc.z - uShadowBias > texture(uSunShadow, sc.xy + vec2(0.5, -0.5) * ts).r) ? 0.0 : 1.0;
  vis += (sc.z - uShadowBias > texture(uSunShadow, sc.xy + vec2(-0.5, 0.5) * ts).r) ? 0.0 : 1.0;
  vis += (sc.z - uShadowBias > texture(uSunShadow, sc.xy + vec2(0.5, 0.5) * ts).r) ? 0.0 : 1.0;
  return vis * 0.25;
}
float sunVisibilityFast(vec3 wp) {
  if (uHasShadow < 0.5) return 1.0;
  vec4 sc = uSunShadowMatrix * vec4(wp, 1.0);
  sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.y < 0.0 || sc.x > 1.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  return (sc.z - uShadowBias > texture(uSunShadow, sc.xy).r) ? 0.0 : 1.0;
}
`;

export const GLSL_SCENE = `
uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform vec2 uResolution;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uHasScene;
vec3 viewFromDepth(vec2 uv, float d) {
  vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
vec3 worldFromView(vec3 v) {
  return (uCamWorld * vec4(v, 1.0)).xyz;
}
`;

export const GLSL_CAUSTICS = `
uniform sampler2D uCaustics;
uniform float uCausticTile;
uniform float uCausticStrength;
float causticSample(vec2 xz, float lod, vec2 flow, float depthMix) {
  float period = 6.0;
  float t = uTime / period;
  float p0 = fract(t);
  float p1 = fract(t + 0.5);
  float w0 = 1.0 - abs(2.0 * p0 - 1.0);
  vec2 j0 = hash22(vec2(floor(t), 3.0));
  vec2 j1 = hash22(vec2(floor(t + 0.5), 11.0));
  vec2 c0 = textureLod(uCaustics, (xz - flow * (p0 - 0.5) * period) / uCausticTile + j0, lod).rg;
  vec2 c1 = textureLod(uCaustics, (xz - flow * (p1 - 0.5) * period) / uCausticTile + j1, lod).rg;
  vec2 c = c0 * w0 + c1 * (1.0 - w0);
  return mix(c.r, c.g, depthMix);
}
float causticAt(vec3 wp, float depthBelow, vec2 flow) {
  vec3 rs = refract(-uSunDir, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  vec2 surf = wp.xz + rs.xz / min(rs.y, -0.05) * depthBelow;
  float depthMix = smoothstep(0.5, 2.2, depthBelow);
  float lod = clamp(log2(1.0 + depthBelow * 0.55), 0.0, 3.5);
  float c = causticSample(surf, lod, flow, depthMix);
  float fadeIn = smoothstep(0.03, 0.45, depthBelow);
  float fadeOut = exp(-depthBelow * 0.12);
  return mix(1.0, c, fadeIn * fadeOut * uCausticStrength);
}
`;
