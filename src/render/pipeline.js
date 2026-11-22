// Costa del Gzowo: HDR frame pipeline (opaque pass, AO, water/transparent composite, volumetric fog, TAA, bloom, grade).
import * as THREE from 'three';
import { LAYERS } from '../config.js';

const VERT = `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const HEAD = `precision highp float;
precision highp sampler2D;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

const AO_FRAG = `
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uIntensity;
uniform float uFrame;
uniform float uProjScale;
vec3 viewPos(vec2 uv) {
  float d = texture(tDepth, uv).r;
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
void main() {
  float d0 = texture(tDepth, vUv).r;
  if (d0 >= 0.999999) { outColor = vec4(1.0, 10000.0, 0.0, 1.0); return; }
  vec3 P = viewPos(vUv);
  vec3 r = viewPos(vUv + vec2(uTexel.x, 0.0)) - P;
  vec3 l = P - viewPos(vUv - vec2(uTexel.x, 0.0));
  vec3 u = viewPos(vUv + vec2(0.0, uTexel.y)) - P;
  vec3 b = P - viewPos(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(r.z) < abs(l.z) ? r : l;
  vec3 dy = abs(u.z) < abs(b.z) ? u : b;
  vec3 N = normalize(cross(dx, dy));
  float dist = -P.z;
  float radiusPx = clamp(uRadius * uProjScale / dist, 3.0, 120.0);
  float noise = ign(gl_FragCoord.xy + uFrame * 5.588238);
  float r2 = uRadius * uRadius;
  float bias = 0.012 + 0.0025 * dist;
  float sum = 0.0;
  const int COUNT = AO_COUNT;
  for (int i = 0; i < COUNT; i++) {
    float a = (float(i) + 0.5) / float(COUNT);
    float ang = (a * 5.0 + noise) * 6.2831853;
    vec2 uv = vUv + vec2(cos(ang), sin(ang)) * a * radiusPx * uTexel;
    vec3 v = viewPos(uv) - P;
    float vv = dot(v, v);
    float f = max(r2 - vv, 0.0);
    sum += f * f * f * max((dot(v, N) - bias) / (vv + 0.01), 0.0);
  }
  float ao = max(0.0, 1.0 - sum * uIntensity * 5.0 / (r2 * r2 * r2 * float(COUNT)));
  ao = mix(ao, 1.0, smoothstep(70.0, 160.0, dist));
  outColor = vec4(ao, dist, 0.0, 1.0);
}`;

const COMPOSITE_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform vec2 uTexel;
uniform float uAOEnabled;
void main() {
  vec4 c = texture(tColor, vUv);
  float d = texture(tDepth, vUv).r;
  float ao = 1.0;
  if (uAOEnabled > 0.5) {
    vec2 center = texture(tAO, vUv).rg;
    float sum = 0.0;
    float wsum = 0.0;
    for (int y = -2; y < 2; y++) {
      for (int x = -2; x < 2; x++) {
        vec2 s = texture(tAO, vUv + (vec2(float(x), float(y)) + 0.5) * uTexel).rg;
        float w = max(0.0, 1.0 - abs(s.g - center.g) / (0.04 * center.g + 0.03)) + 0.001;
        sum += s.r * w;
        wsum += w;
      }
    }
    ao = sum / wsum;
    ao = mix(ao, 1.0, 0.75 * step(0.15, c.a) * step(c.a, 0.4));
  }
  vec3 lifted = mix(vec3(ao), vec3(1.0), clamp(c.rgb * 0.12, 0.0, 0.6));
  outColor = vec4(c.rgb * lifted, c.a);
  gl_FragDepth = d;
}`;

const FOG_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tShadow;
uniform mat4 uInvViewProj;
uniform mat4 uShadowMatrix;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform float uDensity;
uniform float uFalloff;
uniform float uBaseY;
uniform float uAniso;
uniform float uFrame;
uniform float uShadowOn;
uniform float uMaxDist;
float densityAt(float y) { return uDensity * exp(-max(y - uBaseY, 0.0) * uFalloff); }
void main() {
  vec4 c = texture(tColor, vUv);
  float d = texture(tDepth, vUv).r;
  vec4 wp = uInvViewProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec3 ray = wp.xyz / wp.w - uCamPos;
  float dist = length(ray);
  vec3 dir = ray / dist;
  if (d >= 0.999999) dist = 700.0;
  float marchDist = min(dist, uMaxDist);
  const int STEPS = FOG_STEPS;
  float stepLen = marchDist / float(STEPS);
  float jitter = ign(gl_FragCoord.xy + uFrame * 5.588238);
  float cosT = dot(dir, uSunDir);
  float g = uAniso;
  float phase = (1.0 - g * g) / (12.566371 * pow(1.0 + g * g - 2.0 * g * cosT, 1.5));
  phase = phase * 0.82 + 0.18 * 0.0795775;
  vec3 inscatter = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = uCamPos + dir * stepLen * (float(i) + jitter);
    float a = densityAt(p.y) * stepLen;
    float lit = 1.0;
    if (uShadowOn > 0.5) {
      vec4 sc = uShadowMatrix * vec4(p, 1.0);
      if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) lit = step(sc.z - 0.0015, texture(tShadow, sc.xy).r);
    }
    inscatter += T * a * (uSunColor * phase * lit + uSkyColor);
    T *= exp(-a);
  }
  if (dist > marchDist) {
    float rest = dist - marchDist;
    float ys = uCamPos.y + dir.y * marchDist;
    float k = uFalloff * dir.y * rest;
    float integral = abs(k) < 0.001 ? 1.0 : (1.0 - exp(-k)) / k;
    float od = min(densityAt(ys) * rest * integral, 6.0);
    float t2 = exp(-od);
    inscatter += T * (1.0 - t2) * (uSunColor * phase + uSkyColor);
    T *= t2;
  }
  outColor = vec4(c.rgb * T + inscatter, c.a);
}`;

const TAA_FRAG = `
uniform sampler2D tCurrent;
uniform sampler2D tHistory;
uniform sampler2D tDepth;
uniform mat4 uInvViewProj;
uniform mat4 uPrevViewProj;
uniform vec2 uTexel;
uniform float uReset;
vec3 tm(vec3 c) { c = min(c, vec3(48.0)); return c / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 itm(vec3 c) { return c / max(1.0 - max(c.r, max(c.g, c.b)), 0.0001); }
void main() {
  float d = texture(tDepth, vUv).r;
  vec2 off = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i == 0 || i == 3 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0) * uTexel;
    float dd = texture(tDepth, vUv + o).r;
    if (dd < d) { d = dd; off = o; }
  }
  vec2 uvd = vUv + off;
  vec4 wp = uInvViewProj * vec4(uvd * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 pc = uPrevViewProj * vec4(wp.xyz / wp.w, 1.0);
  vec2 vel = (pc.xy / pc.w * 0.5 + 0.5) - uvd;
  vec4 cur4 = texture(tCurrent, vUv);
  vec2 huv = vUv + vel * step(0.5, cur4.a);
  vec3 cur = tm(cur4.rgb);
  vec3 m1 = cur;
  vec3 m2 = cur * cur;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      if (x == 0 && y == 0) continue;
      vec3 s = tm(texture(tCurrent, vUv + vec2(float(x), float(y)) * uTexel).rgb);
      m1 += s;
      m2 += s * s;
    }
  }
  m1 /= 9.0;
  m2 /= 9.0;
  vec3 sigma = sqrt(max(m2 - m1 * m1, vec3(0.0)));
  vec3 hist = tm(texture(tHistory, huv).rgb);
  hist = clamp(hist, m1 - 1.3 * sigma, m1 + 1.3 * sigma);
  float valid = huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0 ? 1.0 : 0.0;
  float speed = length(vel / uTexel);
  float alpha = mix(1.0, clamp(0.08 + speed * 0.004, 0.08, 0.3), valid * (1.0 - uReset));
  outColor = vec4(itm(mix(hist, cur, alpha)), cur4.a);
}`;

const BLOOM_DOWN_FRAG = `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uFirst;
vec3 s(float x, float y) { return min(texture(tSrc, vUv + vec2(x, y) * uTexel).rgb, vec3(48.0)); }
void main() {
  vec3 a = s(-2.0, 2.0), b = s(0.0, 2.0), c = s(2.0, 2.0);
  vec3 d = s(-2.0, 0.0), e = s(0.0, 0.0), f = s(2.0, 0.0);
  vec3 g = s(-2.0, -2.0), h = s(0.0, -2.0), i = s(2.0, -2.0);
  vec3 j = s(-1.0, 1.0), k = s(1.0, 1.0), l = s(-1.0, -1.0), m = s(1.0, -1.0);
  vec3 col;
  if (uFirst > 0.5) {
    vec3 g0 = (a + b + d + e) * 0.25;
    vec3 g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25;
    vec3 g3 = (e + f + h + i) * 0.25;
    vec3 g4 = (j + k + l + m) * 0.25;
    float w0 = 0.125 / (1.0 + luma(g0));
    float w1 = 0.125 / (1.0 + luma(g1));
    float w2 = 0.125 / (1.0 + luma(g2));
    float w3 = 0.125 / (1.0 + luma(g3));
    float w4 = 0.5 / (1.0 + luma(g4));
    col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  outColor = vec4(col, 1.0);
}`;

const BLOOM_UP_FRAG = `
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec2 t = uTexel;
  vec3 col = texture(tSrc, vUv).rgb * 4.0;
  col += (texture(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture(tSrc, vUv - vec2(t.x, 0.0)).rgb + texture(tSrc, vUv + vec2(0.0, t.y)).rgb + texture(tSrc, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  col += texture(tSrc, vUv + t).rgb + texture(tSrc, vUv - t).rgb + texture(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture(tSrc, vUv + vec2(-t.x, t.y)).rgb;
  outColor = vec4(col / 16.0, 1.0);
}`;

const MOTION_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform mat4 uInvViewProj;
uniform mat4 uPrevViewProj;
uniform float uStrength;
void main() {
  vec4 c = texture(tColor, vUv);
  float d = texture(tDepth, vUv).r;
  vec4 wp = uInvViewProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 pc = uPrevViewProj * vec4(wp.xyz / wp.w, 1.0);
  vec2 vel = (vUv - (pc.xy / pc.w * 0.5 + 0.5)) * uStrength * step(0.5, c.a);
  float len = length(vel);
  if (len < 0.0007) { outColor = c; return; }
  vel *= min(1.0, 0.045 / len);
  float jitter = ign(gl_FragCoord.xy) - 0.5;
  vec3 sum = c.rgb;
  float wsum = 1.0;
  for (int i = 1; i <= BLUR_TAPS; i++) {
    vec2 uv = vUv + vel * ((float(i) + jitter) / float(BLUR_TAPS) - 0.5);
    vec4 s = texture(tColor, uv);
    float w = step(0.5, s.a);
    sum += min(s.rgb, vec3(48.0)) * w;
    wsum += w;
  }
  outColor = vec4(sum / wsum, c.a);
}`;

const ADAPT_FRAG = `
uniform sampler2D tSmall;
uniform sampler2D tPrev;
uniform float uRate;
uniform float uReset;
void main() {
  float sum = 0.0;
  float wsum = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 uv = (vec2(float(x), float(y)) + 0.5) / 4.0;
      float w = 1.0 - 0.6 * length(uv - 0.5);
      sum += log(max(luma(texture(tSmall, uv).rgb), 0.0005)) * w;
      wsum += w;
    }
  }
  float avg = exp(sum / wsum);
  float target = clamp(pow(0.45 / avg, 0.55), 0.6, 1.7);
  float prev = texture(tPrev, vec2(0.5)).r;
  outColor = vec4(uReset > 0.5 ? target : mix(prev, target, uRate), 0.0, 0.0, 1.0);
}`;

const FINAL_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 uTexel;
uniform float uExposure;
uniform float uBloom;
uniform float uSharpen;
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uTint;
uniform float uFade;
uniform sampler2D tAdapt;
uniform sampler2D tSunDepth;
uniform vec3 uSun;
uniform float uAberration;
uniform float uGlare;
uniform float uVibrance;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uOlive;
uniform float uDistort;
uniform float uHalation;
uniform float uStreak;
uniform float uMatte;
uniform float uLetterbox;
uniform float uScan;
uniform float uFlicker;
uniform float uGrainSize;
uniform float uFlare;
uniform float uDof;
uniform float uFocus;
uniform vec2 uNearFar;
float depthAt(vec2 uv) {
  float d = texture(tSunDepth, uv).r;
  return uNearFar.x * uNearFar.y / (uNearFar.y - d * (uNearFar.y - uNearFar.x));
}
float cocAt(float z) {
  float c = (z - uFocus) / max(z, 0.1);
  return clamp(abs(c) * (c < 0.0 ? 0.55 : 1.0) * uDof * 26.0, 0.0, 15.0);
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 val) {
  const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  val = m * val;
  val = clamp(log2(max(val, vec3(1e-10))), -12.47393, 4.026069);
  val = (val + 12.47393) / 16.5;
  return agxContrast(val);
}
vec3 agxOut(vec3 val) {
  const mat3 m = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  return m * val;
}
vec3 flare(vec2 uv) {
  if (uSun.z < 0.01) return vec3(0.0);
  float open = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 o = vec2(float(i % 3) - 1.0, float(i / 2) - 1.0) * 0.012;
    open += step(0.99999, texture(tSunDepth, clamp(uSun.xy + o, 0.001, 0.999)).r);
  }
  open *= 0.2;
  if (open < 0.01) return vec3(0.0);
  float aspect = uTexel.y / uTexel.x;
  vec2 toCenter = vec2(0.5) - uSun.xy;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float k = float(i);
    vec2 p = uSun.xy + toCenter * (0.55 + k * 0.42);
    vec2 d = (uv - p) * vec2(aspect, 1.0);
    float r = 0.035 + 0.03 * fract(k * 0.618 + 0.3);
    float disc = smoothstep(r, r * 0.55, length(d));
    acc += disc * mix(vec3(1.0, 0.75, 0.45), vec3(0.45, 0.8, 1.0), fract(k * 0.37)) * (0.022 + 0.012 * fract(k * 0.77));
  }
  vec2 ds = (uv - uSun.xy) * vec2(aspect, 1.0);
  float dist = length(ds);
  acc += vec3(1.0, 0.9, 0.75) * (0.05 / (1.0 + dist * dist * 90.0) + 0.035 * exp(-abs(ds.y) * 70.0) * exp(-abs(ds.x) * 2.6));
  acc += vec3(1.0, 0.82, 0.6) * 0.03 * smoothstep(0.03, 0.0, abs(dist - 0.28));
  return acc * uSun.z * open;
}
void main() {
  vec2 q = vUv - 0.5;
  vec2 uv = 0.5 + q * (1.0 + uDistort * dot(q, q)) / (1.0 + max(uDistort, 0.0) * 0.5);
  vec2 ca = q * dot(q, q) * uAberration;
  vec3 c = vec3(texture(tColor, uv - ca).r, texture(tColor, uv).g, texture(tColor, uv + ca).b);
  if (uDof > 0.001) {
    float z = depthAt(uv);
    float coc = cocAt(z) / (uTexel.y * 1080.0);
    if (coc > 0.6) {
      vec3 sum = c;
      float wsum = 1.0;
      for (int i = 0; i < 16; i++) {
        float f = (float(i) + 0.5) / 16.0;
        float a = float(i) * 2.39996;
        float r = sqrt(f) * coc;
        vec2 o = vec2(cos(a), sin(a)) * r * uTexel;
        float zs = depthAt(uv + o);
        float w = zs >= z - 0.6 ? 1.0 : clamp(cocAt(zs) / (uTexel.y * 1080.0) / max(r, 0.5), 0.0, 1.0);
        sum += min(texture(tColor, uv + o).rgb, vec3(24.0)) * w;
        wsum += w;
      }
      c = mix(c, sum / wsum, smoothstep(0.6, 2.2, coc));
    }
  }
  vec3 n = texture(tColor, uv + vec2(uTexel.x, 0.0)).rgb + texture(tColor, uv - vec2(uTexel.x, 0.0)).rgb + texture(tColor, uv + vec2(0.0, uTexel.y)).rgb + texture(tColor, uv - vec2(0.0, uTexel.y)).rgb;
  float lc = luma(texture(tColor, uv).rgb);
  float ln = luma(n) * 0.25;
  c *= 1.0 + uSharpen * clamp((lc - ln) / max(max(lc, ln), 0.001), -0.5, 0.5);
  vec3 bloom = texture(tBloom, uv).rgb / 6.0;
  c = mix(c, bloom, uBloom);
  c += max(bloom - 0.9, vec3(0.0)) * uGlare * vec3(1.0, 0.8, 0.55);
  c += max(bloom - 0.5, vec3(0.0)) * uHalation * vec3(0.55, 0.11, 0.04);
  if (uStreak > 0.001) {
    vec3 line = vec3(0.0);
    for (int i = -7; i <= 7; i++) line += texture(tBloom, uv + vec2(float(i) * 0.02, 0.0)).rgb * (1.0 - abs(float(i)) / 8.0);
    c += max(line / 48.0 - 0.4, vec3(0.0)) * uStreak * vec3(0.28, 0.52, 1.0);
  }
  c += flare(vUv) * max(luma(bloom), 0.6) * uFlare;
  c *= 1.0 - uVignette * pow(dot(q, q) * 2.0, 1.35);
  c *= 1.0 + uFlicker * 0.05 * (fract(sin(floor(uTime * 24.0) * 12.9898) * 43758.5453) - 0.5);
  c *= uExposure * texture(tAdapt, vec2(0.5)).r * uTint;
  c = agx(c);
  c = pow(max(c, vec3(0.0)), vec3(uContrast));
  float l = luma(c);
  c = l + uSaturation * (c - l);
  float vib = max(c.g, c.b) - c.r;
  c = l + (c - l) * (1.0 + uVibrance * clamp(vib * 2.0, 0.0, 1.0));
  float green = max(c.g - max(c.r, c.b), 0.0);
  c.r += green * uOlive;
  c.b -= green * uOlive * 0.25;
  c = agxOut(c);
  c = clamp(c, 0.0, 1.0);
  float lum = luma(c);
  c = lum + (c - lum) * (1.0 + 0.22 * smoothstep(0.42, 0.9, lum) * min(uSaturation, 1.0));
  c += uShadowTint * (1.0 - smoothstep(0.0, 0.42, lum)) + uHighlightTint * smoothstep(0.5, 1.0, lum);
  c += uMatte * (1.0 - c) * (1.0 - c) * vec3(0.92, 0.96, 1.06);
  c *= 1.0 - uScan * 0.2 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  vec2 cell = floor(gl_FragCoord.xy / uGrainSize);
  float grain = fract(sin(dot(cell + fract(uTime) * 61.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += grain * uGrain * (1.0 - 0.6 * lum);
  c += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  if (uLetterbox > 0.0) c *= step(abs(q.y), 0.5 * min(1.0, (uTexel.y / uTexel.x) / uLetterbox));
  outColor = vec4(clamp(c, 0.0, 1.0) * uFade, 1.0);
}`;

function halton(index, base) {
  let f = 1;
  let r = 0;
  while (index > 0) {
    f /= base;
    r += f * (index % base);
    index = Math.floor(index / base);
  }
  return r;
}

export class Pipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.water = null;
    this.frame = 0;
    this.time = 0;
    this.reset = true;
    this.settings = { ao: true, fog: true, taa: true, bloom: true, motion: true, scale: 1 };
    this.reflectionGate = null;
    this.adaptReset = 0;
    this.night = 0;
    this.stage = null;
    this.skipped = 0;
    this.exposure = 0.56;
    this.sunOcclusion = 1;
    this.fade = 1;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo, null);
    this.quad.frustumCulled = false;
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const mat = (fragment, uniforms, extra = {}) =>
      new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: HEAD + fragment, uniforms, depthTest: false, depthWrite: false, ...extra });
    const v2 = () => ({ value: new THREE.Vector2() });
    const m4 = () => ({ value: new THREE.Matrix4() });
    const tex = () => ({ value: null });

    this.aoMat = mat(AO_FRAG, { tDepth: tex(), uProjInv: m4(), uTexel: v2(), uRadius: { value: 1.25 }, uIntensity: { value: 1.35 }, uFrame: { value: 0 }, uProjScale: { value: 500 } }, { defines: { AO_COUNT: 12 } });
    this.compositeMat = mat(COMPOSITE_FRAG, { tColor: tex(), tDepth: tex(), tAO: tex(), uTexel: v2(), uAOEnabled: { value: 1 } }, { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth });
    this.fogMat = mat(FOG_FRAG, {
      tColor: tex(), tDepth: tex(), tShadow: tex(), uInvViewProj: m4(), uShadowMatrix: m4(),
      uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSkyColor: { value: new THREE.Color(0.19, 0.2, 0.24) }, uDensity: { value: 0.00095 }, uFalloff: { value: 0.035 }, uBaseY: { value: 0 },
      uAniso: { value: 0.78 }, uFrame: { value: 0 }, uShadowOn: { value: 0 }, uMaxDist: { value: 240 },
    }, { defines: { FOG_STEPS: 14 } });
    this.taaMat = mat(TAA_FRAG, { tCurrent: tex(), tHistory: tex(), tDepth: tex(), uInvViewProj: m4(), uPrevViewProj: m4(), uTexel: v2(), uReset: { value: 1 } });
    this.downMat = mat(BLOOM_DOWN_FRAG, { tSrc: tex(), uTexel: v2(), uFirst: { value: 0 } });
    this.upMat = mat(BLOOM_UP_FRAG, { tSrc: tex(), uTexel: v2() }, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation });
    this.finalMat = mat(FINAL_FRAG, {
      tColor: tex(), tBloom: tex(), uTexel: v2(), uExposure: { value: 0.5 }, uBloom: { value: 0.055 }, uSharpen: { value: 0.55 }, uTime: { value: 0 },
      uVignette: { value: 0.2 }, uGrain: { value: 0.018 }, uSaturation: { value: 1.3 }, uContrast: { value: 1.23 }, uTint: { value: new THREE.Color(1.035, 1.0, 0.955) }, uFade: { value: 1 },
      tAdapt: tex(), tSunDepth: tex(), uSun: { value: new THREE.Vector3() }, uAberration: { value: 0.0035 }, uGlare: { value: 0.08 }, uVibrance: { value: 0.3 }, uOlive: { value: 0.3 },
      uShadowTint: { value: new THREE.Vector3(-0.02, 0.008, 0.036) }, uHighlightTint: { value: new THREE.Vector3(0.036, 0.014, -0.032) },
      uDistort: { value: 0 }, uHalation: { value: 0 }, uStreak: { value: 0 }, uMatte: { value: 0 }, uLetterbox: { value: 0 }, uScan: { value: 0 }, uFlicker: { value: 0 }, uGrainSize: { value: 1 }, uFlare: { value: 1 },
      uDof: { value: 0 }, uFocus: { value: 8 }, uNearFar: { value: new THREE.Vector2(0.1, 2000) },
    });
    this.look = null;
    this.focus = 8;
    this.motionMat = mat(MOTION_FRAG, { tColor: tex(), tDepth: tex(), uInvViewProj: m4(), uPrevViewProj: m4(), uStrength: { value: 0.5 } }, { defines: { BLUR_TAPS: 7 } });
    this.adaptMat = mat(ADAPT_FRAG, { tSmall: tex(), tPrev: tex(), uRate: { value: 0.05 }, uReset: { value: 1 } });
    this.sunWorld = new THREE.Vector3(0, 1, 0);
    this.sunClip = new THREE.Vector4();

    this.viewProj = new THREE.Matrix4();
    this.prevViewProj = new THREE.Matrix4();
    this.jitteredInvViewProj = new THREE.Matrix4();
    this.cleanProj = new THREE.Matrix4();
    this.tmp = new THREE.Matrix4();
    this.targets = null;
    this.width = 0;
    this.height = 0;
  }

  setSamples({ ao, fog, blur }) {
    const set = (material, key, value) => {
      if (material.defines[key] === value) return;
      material.defines[key] = value;
      material.needsUpdate = true;
    };
    set(this.aoMat, 'AO_COUNT', ao);
    set(this.fogMat, 'FOG_STEPS', fog);
    set(this.motionMat, 'BLUR_TAPS', blur);
  }

  setSunShadow(depthTexture, matrix) {
    this.fogMat.uniforms.tShadow.value = depthTexture;
    this.fogMat.uniforms.uShadowMatrix.value.copy(matrix);
    this.fogMat.uniforms.uShadowOn.value = 1;
  }

  setSize(cssWidth, cssHeight, pixelRatio) {
    const w = Math.max(2, Math.round(cssWidth * pixelRatio * this.settings.scale));
    const h = Math.max(2, Math.round(cssHeight * pixelRatio * this.settings.scale));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    if (this.targets) for (const t of this.targets.all) t.dispose();
    const hdr = (tw, th, depth) => {
      const rt = new THREE.WebGLRenderTarget(tw, th, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, stencilBuffer: false, generateMipmaps: false });
      rt.texture.colorSpace = THREE.NoColorSpace;
      if (depth) {
        rt.depthTexture = new THREE.DepthTexture(tw, th, THREE.UnsignedIntType);
        rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
      }
      return rt;
    };
    const opaque = hdr(w, h, true);
    const scene = hdr(w, h, true);
    const ao = hdr(w, h, false);
    ao.texture.minFilter = ao.texture.magFilter = THREE.NearestFilter;
    const work = hdr(w, h, false);
    const taa = [hdr(w, h, false), hdr(w, h, false)];
    const down = [];
    let bw = w;
    let bh = h;
    for (let i = 0; i < 6; i++) {
      bw = Math.max(2, Math.floor(bw / 2));
      bh = Math.max(2, Math.floor(bh / 2));
      down.push(hdr(bw, bh, false));
    }
    const adapt = [hdr(1, 1, false), hdr(1, 1, false)];
    this.targets = { opaque, scene, ao, work, taa, down, adapt, all: [opaque, scene, ao, work, ...taa, ...down, ...adapt] };
    this.reset = true;
    this.adaptReset = 3;
    if (this.water) this.water.setSize(w, h);
  }

  draw(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.quadCamera);
  }

  render(dt, elapsed) {
    const { renderer, scene, camera, targets: t, water } = this;
    const w = this.width;
    const h = this.height;
    this.frame++;
    this.time += dt;
    camera.updateMatrixWorld();
    this.cleanProj.copy(camera.projectionMatrix);
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (this.reset) this.prevViewProj.copy(this.viewProj);

    renderer.shadowMap.autoUpdate = false;
    if (water) {
      water.update(dt, elapsed, camera);
      camera.layers.set(LAYERS.WORLD);
      if (this.reflectionGate && !this.reflectionGate()) this.skipped++;
      else {
        if (this.stage) this.stage('reflection', true);
        water.renderReflection(renderer, scene, camera);
        if (this.stage) this.stage('reflection', false);
      }
    }

    if (this.settings.taa) {
      const i = (this.frame % 16) + 1;
      camera.projectionMatrix.elements[8] += ((halton(i, 2) - 0.5) * 2) / w;
      camera.projectionMatrix.elements[9] += ((halton(i, 3) - 0.5) * 2) / h;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    this.tmp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.jitteredInvViewProj.copy(this.tmp).invert();

    camera.layers.set(LAYERS.WORLD);
    camera.layers.enable(LAYERS.DETAIL);
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(t.opaque);
    renderer.render(scene, camera);

    const texel = (m, tw, th) => m.uniforms.uTexel.value.set(1 / tw, 1 / th);
    if (this.settings.ao) {
      const u = this.aoMat.uniforms;
      u.tDepth.value = t.opaque.depthTexture;
      u.uProjInv.value.copy(camera.projectionMatrixInverse);
      u.uFrame.value = this.frame % 64;
      u.uProjScale.value = camera.projectionMatrix.elements[5] * 0.5 * h;
      texel(this.aoMat, w, h);
      this.draw(this.aoMat, t.ao);
    }
    const cu = this.compositeMat.uniforms;
    cu.tColor.value = t.opaque.texture;
    cu.tDepth.value = t.opaque.depthTexture;
    cu.tAO.value = t.ao.texture;
    cu.uAOEnabled.value = this.settings.ao ? 1 : 0;
    texel(this.compositeMat, w, h);
    this.draw(this.compositeMat, t.scene);

    if (water) water.setSceneBuffers(t.opaque.texture, t.opaque.depthTexture, w, h);
    const background = scene.background;
    scene.background = null;
    camera.layers.set(LAYERS.WATER);
    renderer.autoClear = false;
    renderer.setRenderTarget(t.scene);
    renderer.render(scene, camera);
    renderer.autoClear = true;
    scene.background = background;
    camera.layers.set(LAYERS.WORLD);
    camera.layers.enable(LAYERS.DETAIL);

    const underwater = !!(water && water.underwaterPass && water.underwaterPass.enabled);
    if (underwater) {
      water.underwaterPass.render(renderer, t.scene.texture, t.scene.depthTexture, t.work, camera);
    } else if (this.settings.fog) {
      const u = this.fogMat.uniforms;
      u.tColor.value = t.scene.texture;
      u.tDepth.value = t.scene.depthTexture;
      u.uInvViewProj.value.copy(this.jitteredInvViewProj);
      u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      u.uFrame.value = this.frame % 64;
      this.draw(this.fogMat, t.work);
    }
    const lit = underwater || this.settings.fog ? t.work : t.scene;

    let resolved = lit;
    if (this.settings.taa) {
      const cur = t.taa[this.frame % 2];
      const prev = t.taa[(this.frame + 1) % 2];
      const u = this.taaMat.uniforms;
      u.tCurrent.value = lit.texture;
      u.tHistory.value = prev.texture;
      u.tDepth.value = t.scene.depthTexture;
      u.uInvViewProj.value.copy(this.jitteredInvViewProj);
      u.uPrevViewProj.value.copy(this.prevViewProj);
      u.uReset.value = this.reset ? 1 : 0;
      texel(this.taaMat, w, h);
      this.draw(this.taaMat, cur);
      resolved = cur;
    }

    let output = resolved;
    if (this.settings.motion && this.settings.taa && !this.reset) {
      const u = this.motionMat.uniforms;
      u.tColor.value = resolved.texture;
      u.tDepth.value = t.scene.depthTexture;
      u.uInvViewProj.value.copy(this.jitteredInvViewProj);
      u.uPrevViewProj.value.copy(this.prevViewProj);
      u.uStrength.value = Math.min(1.2, 0.28 * (0.0167 / Math.max(dt, 0.004)) * (this.look ? this.look.motionBlur : 1));
      this.draw(this.motionMat, t.work);
      output = t.work;
    }

    let src = output;
    for (let i = 0; i < t.down.length; i++) {
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.downMat.uniforms.uFirst.value = i === 0 ? 1 : 0;
      this.draw(this.downMat, t.down[i]);
      src = t.down[i];
    }
    const adaptCur = t.adapt[this.frame % 2];
    const adaptPrev = t.adapt[(this.frame + 1) % 2];
    const au = this.adaptMat.uniforms;
    au.tSmall.value = t.down[t.down.length - 1].texture;
    au.tPrev.value = adaptPrev.texture;
    au.uRate.value = 1 - Math.exp(-dt * 1.6);
    au.uReset.value = this.frame < 3 || this.adaptReset > 0 ? 1 : 0;
    if (this.adaptReset > 0) this.adaptReset--;
    this.draw(this.adaptMat, adaptCur);
    renderer.autoClear = false;
    for (let i = t.down.length - 2; i >= 0; i--) {
      const lower = t.down[i + 1];
      this.upMat.uniforms.tSrc.value = lower.texture;
      this.upMat.uniforms.uTexel.value.set(1 / lower.width, 1 / lower.height);
      this.draw(this.upMat, t.down[i]);
    }
    renderer.autoClear = true;

    const fu = this.finalMat.uniforms;
    fu.tColor.value = output.texture;
    fu.tBloom.value = t.down[0].texture;
    fu.tAdapt.value = adaptCur.texture;
    fu.tSunDepth.value = t.scene.depthTexture;
    const look = this.look;
    fu.uBloom.value = this.settings.bloom ? (look ? look.bloom : 0.065) : 0;
    fu.uExposure.value = look ? look.exposure : this.exposure;
    if (look) {
      fu.uContrast.value = look.contrast;
      fu.uSaturation.value = look.saturation;
      fu.uVibrance.value = look.vibrance;
      fu.uTint.value.setRGB(1.035 * (1 + 0.12 * look.temperature) * (1 - 0.2 * this.night), (1 + 0.08 * look.tint) * (1 - 0.07 * this.night), 0.955 * (1 - 0.12 * look.temperature) * (1 + 0.2 * this.night));
      fu.uShadowTint.value.fromArray(look.shadowTint).multiplyScalar(look.split);
      fu.uHighlightTint.value.fromArray(look.highlightTint).multiplyScalar(look.split);
      fu.uOlive.value = look.olive;
      fu.uMatte.value = look.matte;
      fu.uGlare.value = look.glare * (1 + 1.2 * this.night);
      fu.uHalation.value = look.halation;
      fu.uStreak.value = this.settings.bloom ? look.streak : 0;
      fu.uVignette.value = look.vignette;
      fu.uAberration.value = look.aberration;
      fu.uDistort.value = look.distortion;
      fu.uSharpen.value = look.sharpen;
      fu.uFlare.value = look.flare * (1 - 0.88 * this.night);
      fu.uDof.value = look.dof;
      fu.uFocus.value = this.focus;
      fu.uNearFar.value.set(camera.near, camera.far);
      fu.uGrain.value = look.grain;
      fu.uGrainSize.value = look.grainSize;
      fu.uLetterbox.value = look.letterbox;
      fu.uScan.value = look.scanlines;
      fu.uFlicker.value = look.flicker;
    }
    fu.uTime.value = this.time;
    fu.uFade.value = this.fade;
    this.sunClip.set(camera.position.x + this.sunWorld.x * 1000, camera.position.y + this.sunWorld.y * 1000, camera.position.z + this.sunWorld.z * 1000, 1).applyMatrix4(this.viewProj);
    let sunVisible = 0;
    if (this.sunClip.w > 0 && !underwater) {
      const sx = (this.sunClip.x / this.sunClip.w) * 0.5 + 0.5;
      const sy = (this.sunClip.y / this.sunClip.w) * 0.5 + 0.5;
      const edge = Math.min(sx + 0.15, 1.15 - sx, sy + 0.15, 1.15 - sy);
      sunVisible = Math.max(0, Math.min(1, edge * 4)) * this.sunOcclusion;
      fu.uSun.value.set(sx, sy, sunVisible);
    } else fu.uSun.value.z = 0;
    texel(this.finalMat, w, h);
    this.draw(this.finalMat, null);

    camera.projectionMatrix.copy(this.cleanProj);
    camera.projectionMatrixInverse.copy(this.cleanProj).invert();
    this.prevViewProj.copy(this.viewProj);
    this.reset = false;
  }
}
