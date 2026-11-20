// Riverside water: screen-space wet-bank decal that darkens terrain just above the waterline, with lapping and drying gradient.
import * as THREE from 'three';
import { GLSL_CONSTANTS, GLSL_HASH, GLSL_BAKE, GLSL_SCENE } from '../glsl/common.js';

const VERT = `
uniform vec3 uGridOrigin;
uniform float uWaterLevel;
uniform float uBand;
void main() {
  vec3 p = vec3(position.x + uGridOrigin.x, uWaterLevel + uBand, position.z + uGridOrigin.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAG = `
${GLSL_CONSTANTS}
${GLSL_HASH}
${GLSL_BAKE}
${GLSL_SCENE}
uniform float uBand;
uniform sampler2D uFoamTex;
uniform float uWetStrength;
void main() {
  vec2 suv = gl_FragCoord.xy / uResolution;
  float d = texture(uSceneDepth, suv).r;
  if (d >= 0.99999) discard;
  vec3 wp = worldFromView(viewFromDepth(suv, d));
  float above = wp.y - uWaterLevel;
  if (above < -0.02 || above > uBand) discard;
  float sdf = bakeSdf(wp.xz);
  if (sdf < -6.0) discard;
  vec4 n = texture(uFoamTex, wp.xz / 7.0);
  float lap = 0.5 + 0.5 * sin(uTime * 0.8 + dot(wp.xz, vec2(0.21, 0.17)) + n.a * 5.0);
  float fresh = 0.035 + 0.05 * lap + n.b * 0.03;
  float wet = 1.0 - smoothstep(fresh, fresh + 0.03, above);
  float damp = (1.0 - smoothstep(0.03, uBand, above)) * 0.55 * (0.6 + 0.4 * n.r);
  float w = max(wet, damp) * smoothstep(-6.0, -1.0, sdf) * uWetStrength;
  vec3 m = mix(vec3(1.0), vec3(0.58, 0.6, 0.62), w);
  gl_FragColor = vec4(m, 1.0);
}
`;

export class ShoreWetEdge {
  constructor(geometry, shared, layer, band = 0.32) {
    this.uniforms = {
      ...shared,
      uBand: { value: band },
      uWetStrength: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
      blendEquation: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -20;
    this.mesh.layers.set(layer);
    this.mesh.name = 'ShoreWetEdge';
  }

  dispose() {
    this.material.dispose();
  }
}
