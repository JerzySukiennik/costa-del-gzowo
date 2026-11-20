// Riverside water: fullscreen underwater pass (spectral absorption fog, sun shafts with shadow, caustics on submerged geometry, wobble, waterline split).
import * as THREE from 'three';
import { FullscreenPass, passMaterial } from '../gpu.js';
import { GLSL_CONSTANTS, GLSL_HASH, GLSL_BAKE, GLSL_UNDULATION, GLSL_OPTICS, GLSL_SHADOW, GLSL_CAUSTICS } from '../glsl/common.js';

const FRAG = `
${GLSL_CONSTANTS}
${GLSL_HASH}
${GLSL_BAKE}
${GLSL_UNDULATION}
${GLSL_OPTICS}
${GLSL_SHADOW}
${GLSL_CAUSTICS}
uniform sampler2D tInput;
uniform sampler2D tDepth;
uniform mat4 uInvProjU;
uniform mat4 uCamWorldU;
uniform vec3 uCamPos;
uniform vec2 uRes;
uniform float uShaftStrength;
uniform float uWobble;
uniform float uFull;
uniform float uSimHeightAtCam;
uniform float uMultiScatter;
uniform float uClarity;
varying vec2 vUv;

vec3 viewRay(vec2 uv, float d) {
  vec4 p = uInvProjU * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}

void main() {
  vec3 nearV = viewRay(vUv, 0.0);
  vec3 nearW = (uCamWorldU * vec4(nearV, 1.0)).xyz;
  float surfNear = uWaterLevel + undulation(nearW.xz, 4.0).x + uSimHeightAtCam;
  float below = surfNear - nearW.y;
  vec3 src = texture(tInput, vUv).rgb;
  if (uFull < 0.5 && below < -0.02) {
    gl_FragColor = vec4(src, 1.0);
    return;
  }
  vec2 wob = vec2(sin(vUv.y * 23.0 + uTime * 1.7) + sin(vUv.y * 41.0 - uTime * 2.3) * 0.5, cos(vUv.x * 19.0 + uTime * 1.3) + cos(vUv.x * 37.0 + uTime * 2.1) * 0.5) * uWobble;
  vec2 uv = clamp(vUv + wob, vec2(0.0), vec2(1.0));
  vec3 color = texture(tInput, uv).rgb;
  float d = texture(tDepth, uv).r;
  vec3 vp = viewRay(uv, d);
  vec3 wp = (uCamWorldU * vec4(vp, 1.0)).xyz;
  vec3 ro = uCamPos;
  vec3 rd = normalize(wp - ro);
  float sceneDist = d >= 0.99999 ? 1e4 : length(wp - ro);
  float surfY = uWaterLevel + undulation(ro.xz, 4.0).x + uSimHeightAtCam;
  float camDepth = max(0.0, surfY - ro.y);
  float distSurf = rd.y > 1e-4 ? (surfY - ro.y) / rd.y : 1e5;
  bool hitsSurface = distSurf < sceneDist;
  float dist = min(sceneDist, max(distSurf, 0.0));
  vec2 flow = bakeA(ro.xz).yz;
  vec3 sigmaT = (uAbsorb + uScatter) * uClarity;
  vec3 rs = refractedSunDown();
  float muS = max(-rs.y, 0.05);
  if (!hitsSurface && d < 0.99999) {
    float depthBelow = max(0.0, surfY - wp.y);
    float vis = sunVisibilityFast(wp);
    float caus = causticAt(wp, depthBelow, bakeA(wp.xz).yz);
    color *= exp(-sigmaT * depthBelow * 0.9) * (0.3 + 0.7 * mix(1.0, caus * 1.25, vis));
  }
  vec3 T = exp(-sigmaT * dist);
  float cosTheta = dot(rd, rs);
  float phase = waterPhase(cosTheta);
  float marchLen = min(dist, 36.0);
  const int STEPS = 12;
  float jitter = hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0);
  vec3 sun = vec3(0.0);
  vec2 shaftShift = rs.xz / min(rs.y, -0.05);
  vec2 drift = flow * uTime;
  float cluster = 0.6 + 0.7 * smoothstep(0.3, 0.8, textureLod(uCaustics, (ro.xz + rd.xz * marchLen * 0.5) / 41.0 + uTime * 0.004, 6.0).g);
  for (int i = 0; i < STEPS; i++) {
    float t = (float(i) + jitter) / float(STEPS);
    float s = marchLen * t * t;
    float ds = marchLen * (2.0 * t / float(STEPS));
    vec3 p = ro + rd * s;
    float dep = max(0.0, surfY - p.y);
    vec3 att = exp(-sigmaT * (dep / muS + s));
    float vis = sunVisibilityFast(p);
    vec2 sp = p.xz + shaftShift * dep;
    float shaft = textureLod(uCaustics, (sp * 0.5 - drift * 0.5) / uCausticTile, 2.6 + min(dep * 0.25, 1.5)).g;
    shaft = mix(1.0, shaft * shaft * 1.25 * cluster, 0.85);
    sun += att * vis * shaft * ds;
  }
  vec3 sunIn = uScatter * uSunColor * phase * sun * uShaftStrength * uMultiScatter;
  vec3 kA = sigmaT * (1.0 - rd.y / 0.75);
  vec3 ambE = uAmbient * PI;
  vec3 ambIn = uScatter * ambE * (1.0 / (4.0 * PI)) * exp(-sigmaT * camDepth / 0.75) * (1.0 - exp(-kA * dist)) / max(abs(kA), vec3(1e-4)) * sign(kA + 1e-6);
  vec3 outC = color * T + sunIn + max(ambIn, vec3(0.0)) * uMultiScatter;
  float line = smoothstep(0.035, 0.0, abs(below)) * (1.0 - uFull);
  outC = mix(outC, outC * 0.55, line * 0.6);
  outC = clamp(outC, vec3(0.0), vec3(64.0));
  if (any(isnan(outC))) outC = vec3(0.0);
  gl_FragColor = vec4(outC, 1.0);
}
`;

export class UnderwaterPass {
  constructor(shared) {
    this.enabled = false;
    this.uniforms = {
      ...shared,
      tInput: { value: null },
      tDepth: { value: null },
      uInvProjU: { value: new THREE.Matrix4() },
      uCamWorldU: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uShaftStrength: { value: 1.0 },
      uWobble: { value: 0.0018 },
      uFull: { value: 1 },
      uSimHeightAtCam: { value: 0 },
      uMultiScatter: { value: 2.0 },
      uClarity: { value: 0.8 },
    };
    this.pass = new FullscreenPass(passMaterial(FRAG, this.uniforms));
  }

  render(renderer, inputTexture, depthTexture, outputTarget, camera) {
    const u = this.uniforms;
    u.tInput.value = inputTexture;
    u.tDepth.value = depthTexture;
    u.uInvProjU.value.copy(camera.projectionMatrix).invert();
    u.uCamWorldU.value.copy(camera.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    const prevTarget = renderer.getRenderTarget();
    this.pass.render(renderer, outputTarget ?? null);
    renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    this.pass.dispose();
  }
}
