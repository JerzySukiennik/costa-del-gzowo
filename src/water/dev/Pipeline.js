// Riverside water harness: minimal replica of the lead render contract (reflection, opaque HDR+depth, copy, water layer, underwater, bloom, tone map).
import * as THREE from 'three';
import { LAYERS } from '../../config.js';
import { FullscreenPass, passMaterial } from '../gpu.js';

const COPY = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  gl_FragColor = texture(tColor, vUv);
  gl_FragDepth = texture(tDepth, vUv).r;
}
`;

const BRIGHT = `
uniform sampler2D tInput;
varying vec2 vUv;
void main() {
  vec3 c = texture(tInput, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * max(0.0, l - 1.6) / max(l, 1e-4), 1.0);
}
`;

const TONEMAP = `
uniform sampler2D tInput;
uniform sampler2D tBloom;
uniform float uExposure;
varying vec2 vUv;
vec3 aces(vec3 x) {
  const mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = m1 * x;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(m2 * (a / b), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture(tInput, vUv).rgb;
  vec3 b = vec3(0.0);
  b += textureLod(tBloom, vUv, 1.0).rgb * 0.30;
  b += textureLod(tBloom, vUv, 2.0).rgb * 0.25;
  b += textureLod(tBloom, vUv, 3.0).rgb * 0.20;
  b += textureLod(tBloom, vUv, 4.0).rgb * 0.15;
  b += textureLod(tBloom, vUv, 5.0).rgb * 0.10;
  c += b * 0.18;
  gl_FragColor = vec4(toSRGB(aces(c * uExposure)), 1.0);
}
`;

function hdrTarget(w, h, depth) {
  const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, colorSpace: THREE.NoColorSpace });
  if (depth) t.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
  return t;
}

export class Pipeline {
  constructor(renderer, scene, camera, water) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.water = water;
    this.exposure = 0.85;
    this.waterEnabled = true;
    this.opaqueRT = hdrTarget(4, 4, true);
    this.sceneRT = hdrTarget(4, 4, true);
    this.postRT = hdrTarget(4, 4, false);
    this.brightRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, colorSpace: THREE.NoColorSpace });
    this.copy = new FullscreenPass(passMaterial(COPY, { tColor: { value: null }, tDepth: { value: null } }, { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth }));
    this.bright = new FullscreenPass(passMaterial(BRIGHT, { tInput: { value: null } }));
    this.tonemap = new FullscreenPass(passMaterial(TONEMAP, { tInput: { value: null }, tBloom: { value: null }, uExposure: { value: 1 } }));
  }

  setSize(w, h) {
    this.width = w;
    this.height = h;
    this.opaqueRT.setSize(w, h);
    this.sceneRT.setSize(w, h);
    this.postRT.setSize(w, h);
    this.brightRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.water.setSize(w, h);
  }

  render(dt, elapsed) {
    const { renderer, scene, camera } = this;
    const water = this.waterEnabled ? this.water : null;
    if (water) {
      water.update(dt, elapsed, camera);
      water.renderReflection(renderer, scene, camera);
    }

    camera.layers.set(LAYERS.WORLD);
    camera.layers.enable(LAYERS.DETAIL);
    renderer.shadowMap.autoUpdate = true;
    renderer.autoClear = true;
    renderer.setRenderTarget(this.opaqueRT);
    renderer.render(scene, camera);
    renderer.shadowMap.autoUpdate = false;

    if (water) water.setSceneBuffers(this.opaqueRT.texture, this.opaqueRT.depthTexture, this.width, this.height);

    this.copy.material.uniforms.tColor.value = this.opaqueRT.texture;
    this.copy.material.uniforms.tDepth.value = this.opaqueRT.depthTexture;
    this.copy.render(renderer, this.sceneRT);

    camera.layers.set(water ? LAYERS.WATER : 31);
    const bg = scene.background;
    scene.background = null;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.sceneRT);
    renderer.render(scene, camera);
    renderer.autoClear = true;
    scene.background = bg;
    camera.layers.set(LAYERS.WORLD);
    camera.layers.enable(LAYERS.DETAIL);

    let hdr = this.sceneRT.texture;
    if (water && water.underwaterPass.enabled) {
      water.underwaterPass.render(renderer, this.sceneRT.texture, this.sceneRT.depthTexture, this.postRT, camera);
      hdr = this.postRT.texture;
    }
    this.bright.material.uniforms.tInput.value = hdr;
    this.bright.render(renderer, this.brightRT);
    const tu = this.tonemap.material.uniforms;
    tu.tInput.value = hdr;
    tu.tBloom.value = this.brightRT.texture;
    tu.uExposure.value = this.exposure;
    this.tonemap.render(renderer, null);
  }
}
