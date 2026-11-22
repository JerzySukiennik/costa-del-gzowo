// Costa del Gzowo water: suspended silt and plankton motes in a camera-wrapped volume, drifting with the current, visible only underwater.
import * as THREE from 'three';
import { GLSL_CONSTANTS, GLSL_HASH, GLSL_SCENE, GLSL_OPTICS } from '../glsl/common.js';

const VERT = `
attribute vec4 iSeed;
uniform vec3 uCamPos;
uniform float uBox;
uniform float uTime;
uniform vec3 uDrift;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  vec3 drift = uDrift + vec3(sin(uTime * 0.3 + iSeed.w * 20.0), cos(uTime * 0.23 + iSeed.w * 13.0), sin(uTime * 0.19 + iSeed.w * 7.0)) * 0.15;
  vec3 local = fract(iSeed.xyz + (drift - uCamPos) / uBox) - 0.5;
  vec3 wp = uCamPos + local * uBox;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float size = mix(0.004, 0.016, fract(iSeed.w * 7.13));
  mv.xy += position.xy * size;
  vUv = position.xy + 0.5;
  float edge = 1.0 - smoothstep(0.32, 0.5, max(max(abs(local.x), abs(local.y)), abs(local.z)));
  vAlpha = edge * smoothstep(0.15, 0.6, -mv.z);
  vWorld = wp;
  vViewZ = mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = `
${GLSL_CONSTANTS}
${GLSL_HASH}
${GLSL_SCENE}
${GLSL_OPTICS}
uniform float uWaterLevel;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  if (vWorld.y > uWaterLevel - 0.02) discard;
  vec2 suv = gl_FragCoord.xy / uResolution;
  float sceneZ = viewFromDepth(suv, texture(uSceneDepth, suv).r).z;
  if (vViewZ < sceneZ) discard;
  float r = length(vUv * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.2, 1.0, r)) * vAlpha * 0.55;
  vec3 V = normalize(cameraPosition - vWorld);
  float fwd = hgPhase(dot(-V, normalize(uSunDir)), 0.75);
  vec3 col = uAmbient * 0.9 + uSunColor * fwd * 0.35;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a, a);
}
`;

export class SiltFX {
  constructor(count, shared, layer) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = count;
    this.uniforms = {
      ...shared,
      uCamPos: { value: new THREE.Vector3() },
      uBox: { value: 9 },
      uDrift: { value: new THREE.Vector3() },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(layer);
    this.mesh.renderOrder = 9;
    this.mesh.visible = false;
    this.mesh.name = 'UnderwaterSilt';
    this.geometry = geo;
  }

  update(cameraPos, flow, dt, visible) {
    this.uniforms.uCamPos.value.copy(cameraPos);
    this.uniforms.uDrift.value.x += flow.x * dt;
    this.uniforms.uDrift.value.z += flow.y * dt;
    this.mesh.visible = visible;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
