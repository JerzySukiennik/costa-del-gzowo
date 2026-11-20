// Riverside water: fullscreen pass helper, render target factory and renderer state save/restore.
import * as THREE from 'three';

const triangle = new THREE.BufferGeometry();
triangle.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
triangle.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export const FULLSCREEN_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export class FullscreenPass {
  constructor(material) {
    this.material = material;
    this.mesh = new THREE.Mesh(triangle, material);
    this.mesh.frustumCulled = false;
  }

  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.mesh, orthoCamera);
  }

  dispose() {
    this.material.dispose();
  }
}

export function passMaterial(fragmentShader, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    ...extra,
  });
}

export function makeTarget(width, height, options = {}) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: options.type ?? THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: options.minFilter ?? THREE.LinearFilter,
    magFilter: options.magFilter ?? THREE.LinearFilter,
    wrapS: options.wrap ?? THREE.ClampToEdgeWrapping,
    wrapT: options.wrap ?? THREE.ClampToEdgeWrapping,
    generateMipmaps: options.mipmaps ?? false,
    depthBuffer: options.depthBuffer ?? false,
    stencilBuffer: false,
    colorSpace: THREE.NoColorSpace,
  });
  if (options.anisotropy) target.texture.anisotropy = options.anisotropy;
  return target;
}

export function saveState(renderer) {
  return {
    target: renderer.getRenderTarget(),
    autoClear: renderer.autoClear,
    shadowAuto: renderer.shadowMap.autoUpdate,
    clearColor: renderer.getClearColor(new THREE.Color()),
    clearAlpha: renderer.getClearAlpha(),
  };
}

export function restoreState(renderer, state) {
  renderer.setRenderTarget(state.target);
  renderer.autoClear = state.autoClear;
  renderer.shadowMap.autoUpdate = state.shadowAuto;
  renderer.setClearColor(state.clearColor, state.clearAlpha);
}

export function floatLinearSupported(renderer) {
  return renderer.extensions.has('OES_texture_float_linear') && renderer.extensions.has('EXT_color_buffer_float');
}
