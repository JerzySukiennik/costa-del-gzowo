// Riverside water: river surface vertex/fragment shaders (multi-scale flow-advected normals, refraction, absorption, caustics, reflections, glints, foam, underside).
import { GLSL_CONSTANTS, GLSL_HASH, GLSL_BAKE, GLSL_UNDULATION, GLSL_OPTICS, GLSL_SHADOW, GLSL_SCENE, GLSL_CAUSTICS } from '../glsl/common.js';

const SIM_SAMPLING = `
uniform sampler2D uSimState;
uniform sampler2D uSimAux;
uniform vec4 uSimWindow;
uniform float uSimTexel;
uniform float uSimEnabled;
vec2 simUV(vec2 xz) { return (xz - uSimWindow.xy) * uSimWindow.w; }
float simFade(vec2 uv) {
  vec2 e = min(uv, 1.0 - uv);
  return uSimEnabled * smoothstep(0.0, 0.07, min(e.x, e.y));
}
float simHeight(vec2 uv) {
  vec4 s = textureLod(uSimState, uv, 0.0);
  return s.x + s.z;
}
`;

export const SURFACE_VERT = `
${GLSL_CONSTANTS}
${GLSL_BAKE}
${GLSL_UNDULATION}
${SIM_SAMPLING}
uniform vec3 uGridOrigin;
varying vec3 vWorld;
varying float vBedDepth;
void main() {
  vec2 xz = position.xz + uGridOrigin.xz;
  float depth = bakeALod(xz).x;
  float y = uWaterLevel + undulation(xz, depth).x;
  vec2 suv = simUV(xz);
  float f = simFade(suv);
  if (f > 0.0) y += simHeight(suv) * f;
  vWorld = vec3(xz.x, y, xz.y);
  vBedDepth = depth;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

export const SURFACE_FRAG = `
${GLSL_CONSTANTS}
${GLSL_HASH}
${GLSL_BAKE}
${GLSL_UNDULATION}
${GLSL_OPTICS}
${GLSL_SHADOW}
${GLSL_SCENE}
${GLSL_CAUSTICS}
${SIM_SAMPLING}
uniform sampler2D uSlope0;
uniform sampler2D uSlope1;
uniform vec2 uTiles;
uniform vec2 uLayerAmp;
uniform sampler2D uFoamTex;
uniform sampler2D uBoilTex;
uniform vec2 uWindDir;
uniform sampler2D uReflection;
uniform mat4 uReflMatrix;
uniform float uHasReflection;
uniform float uReflDistance;
uniform float uRefraction;
uniform vec3 uFoamAlbedo;
uniform float uFoamAmount;
uniform float uGlitter;
uniform float uBoilStrength;
uniform float uCameraUnder;
uniform mat4 uProj;
varying vec3 vWorld;
varying float vBedDepth;

vec4 flowLayer(sampler2D tex, vec2 xz, vec2 flow, float tile, float period, float seed) {
  float t = uTime / period + seed;
  float p0 = fract(t);
  float p1 = fract(t + 0.5);
  float w0 = 1.0 - abs(2.0 * p0 - 1.0);
  float w1 = 1.0 - w0;
  vec2 j0 = hash22(vec2(floor(t), seed * 13.1));
  vec2 j1 = hash22(vec2(floor(t + 0.5), seed * 13.1 + 5.7));
  vec4 s0 = texture(tex, (xz - flow * (p0 - 0.5) * period) / tile + j0);
  vec4 s1 = texture(tex, (xz - flow * (p1 - 0.5) * period) / tile + j1);
  float norm = inversesqrt(w0 * w0 + w1 * w1);
  vec2 mean = (s0.xy * w0 + s1.xy * w1) * norm;
  vec2 var = max(s0.zw - s0.xy * s0.xy, 0.0) * w0 + max(s1.zw - s1.xy * s1.xy, 0.0) * w1;
  return vec4(mean, var);
}

vec4 flowTex(sampler2D tex, vec2 uvBase, vec2 flowUV, float period, float seed) {
  float t = uTime / period + seed;
  float p0 = fract(t);
  float p1 = fract(t + 0.5);
  float w0 = 1.0 - abs(2.0 * p0 - 1.0);
  vec2 j0 = hash22(vec2(floor(t), seed * 7.3));
  vec2 j1 = hash22(vec2(floor(t + 0.5), seed * 7.3 + 2.9));
  vec4 a = texture(tex, uvBase - flowUV * (p0 - 0.5) * period + j0);
  vec4 b = texture(tex, uvBase - flowUV * (p1 - 0.5) * period + j1);
  return a * w0 + b * (1.0 - w0);
}

float ggxD(float NdotH, float a2) {
  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
float smithG(float NdotV, float NdotL, float a2) {
  float gv = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);
  float gl = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-5);
}
float fresnelWater(float c) {
  float f0 = 0.0204;
  return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0);
}
float fresnelExact(float cosI, float eta) {
  float sinT2 = eta * eta * (1.0 - cosI * cosI);
  if (sinT2 >= 1.0) return 1.0;
  float cosT = sqrt(1.0 - sinT2);
  float rs = (eta * cosI - cosT) / (eta * cosI + cosT);
  float rp = (cosI - eta * cosT) / (cosI + eta * cosT);
  return 0.5 * (rs * rs + rp * rp);
}

vec3 sampleReflection(vec3 P, vec3 R, float lod) {
  vec4 rc = uReflMatrix * vec4(P + R * uReflDistance, 1.0);
  vec2 ruv = clamp(rc.xy / rc.w, vec2(0.001), vec2(0.999));
  vec3 c = textureLod(uReflection, ruv, lod).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sunAway = 1.0 - 0.9 * smoothstep(0.985, 0.9995, dot(R, normalize(uSunDir)));
  return c * min(1.0, 7.0 / max(l, 1e-4)) * sunAway;
}

vec2 projectToScreen(vec3 wp) {
  vec4 c = uProj * viewMatrix * vec4(wp, 1.0);
  return c.xy / c.w * 0.5 + 0.5;
}

void main() {
  vec3 P = vWorld;
  vec2 xz = P.xz;
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  vec4 bA = bakeA(xz);
  float bedDepth = bA.x;
  vec2 flow = bA.yz;
  float wake = bA.w;
  float sdf = bakeSdf(xz);
  float speed = length(flow);
  vec2 fdir = speed > 0.02 ? flow / speed : vec2(0.0, 1.0);

  vec2 suv = simUV(xz);
  float sFade = simFade(suv);
  vec2 simSlope = vec2(0.0);
  float simFoam = 0.0;
  float turb = 0.0;
  if (sFade > 0.0) {
    float e = uSimTexel;
    float h0 = simHeight(suv - vec2(e, e) * 0.5);
    float hr = simHeight(suv + vec2(e, -e) * 0.5);
    float hu = simHeight(suv + vec2(-e, e) * 0.5);
    simSlope = vec2(hr - h0, hu - h0) / (e * uSimWindow.z) * sFade;
    vec4 aux = textureLod(uSimAux, suv, 0.0);
    simFoam = aux.x * sFade;
    turb = aux.y * sFade;
  }

  vec4 gt = texture(uFoamTex, xz / 151.0 - uWindDir * uTime * 0.014);
  float gustA = gt.a;
  float gustB = gt.b;
  float gust = 0.16 + 1.15 * smoothstep(0.42, 0.75, gustA * 0.6 + gustB * 0.45);
  float shelter = mix(0.5, 1.0, smoothstep(0.0, 9.0, sdf));

  float channel = smoothstep(0.12, 0.5, speed) * smoothstep(0.6, 2.4, bedDepth);
  float boilPresence = channel * uBoilStrength + wake * 1.2;
  vec2 slope = vec2(0.0);
  float calmDome = 0.0;
  if (boilPresence > 0.005) {
    float bs = mix(23.0, 7.0, clamp(wake * 1.5, 0.0, 1.0));
    vec4 boil = flowTex(uBoilTex, xz / bs, flow / bs, mix(11.0, 5.0, clamp(wake * 1.5, 0.0, 1.0)), 3.0);
    slope = boil.xy / bs * (0.05 * channel * uBoilStrength + 0.04 * wake);
    calmDome = smoothstep(0.55, 0.9, boil.z) * boilPresence;
  }

  float ampFine = uLayerAmp.x * gust * shelter * (1.0 - 0.55 * clamp(calmDome, 0.0, 1.0)) * (1.0 + 1.8 * wake + 2.5 * min(turb, 1.5)) * (1.0 + 0.6 * channel);
  float ampCoarse = uLayerAmp.y * mix(0.75, 1.2, gustA) * mix(0.55, 1.0, shelter) * (1.0 + 1.0 * wake + 0.4 * channel);
  vec4 l0 = flowLayer(uSlope0, xz, flow, uTiles.x, 3.3, 0.0);
  vec4 l1 = flowLayer(uSlope1, xz, flow, uTiles.y, 8.5, 0.37);
  slope += l0.xy * ampFine + l1.xy * ampCoarse;
  vec2 slopeVar = l0.zw * ampFine * ampFine + l1.zw * ampCoarse * ampCoarse;

  vec3 und = undulation(xz, bedDepth);
  slope += und.yz;
  slope += simSlope;

  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  float alpha2 = 0.0009 + slopeVar.x + slopeVar.y + min(turb, 2.0) * 0.004;
  float alpha = sqrt(alpha2);

  vec2 suvScreen = gl_FragCoord.xy / uResolution;
  float sunVisP = sunVisibilityFast(P);
  vec3 L = normalize(uSunDir);
  vec3 sigmaT0 = uAbsorb + uScatter;
  vec3 sigmaS = uScatter + vec3(0.9, 1.0, 0.95) * (min(turb, 2.0) * 0.55 + wake * 0.12 + min(simFoam, 2.0) * 0.25);
  vec3 sigmaT = uAbsorb + sigmaS;
  vec3 rsDown = refractedSunDown();
  float muS = max(-rsDown.y, 0.05);
  vec3 ambE = uAmbient * PI;

  float wd = bedDepth + (P.y - uWaterLevel);
  float shoreMask = smoothstep(0.2, 0.0, wd) * smoothstep(-0.1, 0.0, wd);
  float coverage = 0.0;
  float density = 0.0;
  float pattern = 0.0;
  if ((simFoam + wake + shoreMask) > 0.003 && uFoamAmount > 0.0 && dist < 260.0) {
    vec4 lace = flowTex(uFoamTex, xz / 3.1, flow / 3.1, 4.0, 1.0);
    vec4 lace2 = flowTex(uFoamTex, xz / 1.15 + 0.37, flow / 1.15, 3.0, 4.0);
    pattern = lace.r * 0.62 + lace2.r * 0.38;
    float streakR = 0.0;
    if (wake > 0.003) {
      vec2 fuv = vec2(dot(xz, vec2(fdir.y, -fdir.x)), dot(xz, fdir));
      vec4 streakS = flowTex(uFoamTex, vec2(fuv.x / 2.2, fuv.y / 9.0), vec2(0.0, speed / 9.0), 6.0, 2.0);
      streakR = streakS.r;
    }
    float lap = 0.5 + 0.5 * sin(uTime * 0.9 + dot(xz, vec2(0.37, 0.21)) * 1.7 + lace.a * 6.0);
    float shoreFoam = smoothstep(0.14, 0.01, wd + lap * 0.04) * smoothstep(-0.1, 0.0, wd) * smoothstep(0.45, 0.75, lace.b) * 0.5;
    float wakeFoam = wake * smoothstep(0.08, 0.35, speed) * (0.25 + 0.75 * smoothstep(0.3, 0.75, streakR)) * 0.9;
    pattern = mix(pattern, max(pattern, streakR), clamp(wake * 1.5, 0.0, 1.0) * 0.6);
    density = (simFoam * 0.5 + wakeFoam + shoreFoam) * uFoamAmount;
    float dens = 1.0 - exp(-density * 1.4);
    coverage = smoothstep(1.0 - dens, 1.0 - dens + 0.38, pattern) * (0.35 + 0.65 * dens);
  }

#if UNDERSIDE
    vec3 Nd = -N;
    vec3 I = -V;
    float cosI = clamp(dot(-I, Nd), 0.0, 1.0);
    vec3 T = refract(I, Nd, 1.333);
    float F = fresnelExact(cosI, 1.333);
    vec3 deepCol = columnInscatter(sigmaS, sigmaT, 60.0, 1.0, muS, waterPhase(dot(rsDown, vec3(0.0, -1.0, 0.0))), uSunColor * sunVisP, ambE) * 2.0;
    vec3 Rr = reflect(I, Nd);
    vec3 mirror = deepCol;
    vec2 mp = projectToScreen(P + Rr * 6.0);
    if (uHasScene > 0.5 && mp.x > 0.0 && mp.y > 0.0 && mp.x < 1.0 && mp.y < 1.0) {
      vec3 seen = texture(uSceneColor, mp).rgb;
      float dm = texture(uSceneDepth, mp).r;
      vec3 wpm = worldFromView(viewFromDepth(mp, dm));
      float below = step(wpm.y, uWaterLevel - 0.05) * step(dm, 0.99999);
      mirror = mix(deepCol, seen * exp(-sigmaT * 4.0) + deepCol * 0.4, below * 0.8);
    }
    vec3 col = mirror;
    if (dot(T, T) > 0.0) {
      vec3 sky = skyRadiance(normalize(T));
      vec2 sp = projectToScreen(P + normalize(T) * 60.0);
      if (uHasScene > 0.5 && sp.x > 0.0 && sp.y > 0.0 && sp.x < 1.0 && sp.y < 1.0) {
        float dS = texture(uSceneDepth, sp).r;
        if (dS < 0.9999) {
          vec3 above = texture(uSceneColor, sp).rgb;
          sky = mix(sky, above, 0.65);
        }
      }
      col = sky * (1.0 - F) + mirror * F;
      vec3 Hs = normalize(-I + L);
      float spec = ggxD(max(dot(N, normalize(L - I * 1.333)), 0.0), max(alpha2, 0.002)) * 0.02;
      col += uSunColor * sunVisP * min(spec, 30.0) * 0.05 * (1.0 - F);
    }
    vec3 foamCol = uFoamAlbedo * (uSunColor * sunVisP * 0.25 + ambE * 0.4) / PI;
    col = mix(col, foamCol, coverage * 0.75);
    gl_FragColor = vec4(min(col, vec3(64.0)), 1.0);
#else

  float NdotV = dot(N, V);
  if (NdotV < 0.04) {
    N = normalize(N + V * (0.04 - NdotV));
    NdotV = 0.04;
  }

  vec3 vsP = (viewMatrix * vec4(P, 1.0)).xyz;
  float d0 = texture(uSceneDepth, suvScreen).r;
  vec3 vs0 = viewFromDepth(suvScreen, d0);
  float thick0 = max(0.0, vsP.z - vs0.z);
  vec3 B0 = worldFromView(vs0);
  float vert0 = max(0.0, P.y - B0.y);
  float edgeFade = smoothstep(0.0, 0.035, min(vert0, thick0));

  vec3 Tn = refract(-V, N, 1.0 / 1.333);
  vec3 T0 = refract(-V, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  float pathGuess = min(length(B0 - P), 6.0);
  vec2 ruv = projectToScreen(P + T0 * pathGuess + (Tn - T0) * pathGuess * uRefraction);
  ruv = mix(suvScreen, ruv, smoothstep(0.0, 0.3, vert0));
  vec2 roff = ruv - suvScreen;
  vec2 room = mix(suvScreen, 1.0 - suvScreen, step(0.0, roff));
  roff *= clamp(min(room.x / max(abs(roff.x), 1e-5), room.y / max(abs(roff.y), 1e-5)) * 0.5, 0.0, 1.0);
  ruv = clamp(suvScreen + roff, vec2(0.0005), vec2(0.9995));
  float d1 = texture(uSceneDepth, ruv).r;
  vec3 vs1 = viewFromDepth(ruv, d1);
  if (vs1.z > vsP.z - 0.02) {
    ruv = suvScreen;
    d1 = d0;
    vs1 = vs0;
  }
  vec3 B = worldFromView(vs1);
  float far = step(0.99999, d1);
  float dView = mix(length(B - P), 200.0, far);
  float dVert = mix(max(0.0, P.y - B.y), 50.0, far);
  vec3 bedCol = texture(uSceneColor, ruv).rgb;

  float muV = clamp(dVert / max(dView, 1e-3), 0.05, 1.0);
  float sunVisB = sunVisibilityFast(B);
  float caus = sunVisB > 0.0 && dVert < 8.0 && dist < 120.0 ? causticAt(B, dVert, flow) : 1.0;
  vec3 tDown = exp(-sigmaT0 * dVert / muS);
  vec3 tAmb = exp(-sigmaT0 * dVert * 1.25);
  vec3 bedLit = bedCol * (tDown * 0.72 * mix(1.0, caus, sunVisB) + tAmb * 0.28);
  vec3 tView = exp(-sigmaT * dView);
  float cosScatter = dot(rsDown, -Tn);
  vec3 inscatter = columnInscatter(sigmaS, sigmaT, dView, muV, muS, waterPhase(cosScatter), uSunColor * sunVisP * (1.0 - fresnelWater(dot(L, vec3(0.0, 1.0, 0.0)))), ambE);
  vec3 refracted = bedLit * tView + inscatter;

  float F = fresnelWater(NdotV);
  F = mix(F, fresnelWater(NdotV) * (1.0 - min(alpha * 1.6, 0.5)), smoothstep(0.0, 0.3, alpha));
  vec3 R = reflect(-V, N);
  R.y = max(R.y, 0.015);
  float lod = clamp(log2(1.0 + alpha * 70.0) * 1.15, 0.0, 6.0);
  vec3 refl = uHasReflection > 0.5 ? sampleReflection(P, normalize(R), lod) : skyRadiance(R);

  vec3 H = normalize(L + V);
  float NdotL = max(dot(N, L), 0.0);
  float NdotH = max(dot(N, H), 0.0);
  float a2s = max(alpha2, 0.00035);
  float D = ggxD(NdotH, a2s);
  float G = smithG(NdotV, NdotL, a2s);
  float Fs = fresnelWater(max(dot(V, H), 0.0));
  float spec = D * G * Fs * NdotL;
  float pix = max(length(fwidth(xz)), 0.004);
  float cellSize = exp2(ceil(log2(pix * 2.5)));
  vec2 cell = floor(xz / cellSize);
  float rnd = hash12(cell + floor(uTime * 7.0 + hash12(cell * 1.7) * 7.0) * 0.137);
  float glint = pow(rnd, 22.0) * 23.0;
  float glitterAmt = uGlitter * smoothstep(0.0015, 0.02, alpha2) * smoothstep(0.6, 6.0, dist);
  spec *= mix(1.0, glint, glitterAmt);
  vec3 sunSpec = uSunColor * min(spec, 60.0) * sunVisP;

  vec3 col = refracted * (1.0 - F) + refl * F + sunSpec;

  vec3 foamLight = uSunColor * sunVisP * (0.25 + 0.75 * max(dot(N, L), 0.0)) / PI + ambE / PI;
  vec3 foamCol = uFoamAlbedo * foamLight;
  col = mix(col, foamCol, coverage * 0.93);

  vec3 raw = texture(uSceneColor, suvScreen).rgb * vec3(0.6, 0.62, 0.64);
  col = mix(raw, col, edgeFade);
#if WATER_DEBUG == 1
  col = refl;
#elif WATER_DEBUG == 2
  col = refracted;
#elif WATER_DEBUG == 3
  col = N * 0.5 + 0.5;
#elif WATER_DEBUG == 4
  col = vec3(coverage, density, pattern);
#elif WATER_DEBUG == 5
  col = sunSpec;
#elif WATER_DEBUG == 6
  col = vec3(F);
#elif WATER_DEBUG == 7
  col = vec3(alpha * 4.0, caus * 0.3, sFade);
#elif WATER_DEBUG == 8
  col = vec3(0.5 + simSlope.x * 2.0, 0.5 + simSlope.y * 2.0, 0.5);
#endif
  col = clamp(col, vec3(0.0), vec3(64.0));
  if (any(isnan(col))) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
#endif
}
`;
