// Riverside water: physically based caustic map (refracted light-grid splatting) for two reference depths, tileable with the fine ripple layer.
import * as THREE from 'three';
import { makeTarget, saveState, restoreState } from '../gpu.js';

const VERT = `
uniform sampler2D uSlopes;
uniform float uDepth;
uniform float uTile;
uniform float uAmp;
uniform vec3 uSunDir;
varying vec2 vOld;
varying vec2 vNew;
void main() {
  vec2 uv = position.xy;
  vec2 s = textureLod(uSlopes, uv, 0.5).xy * uAmp;
  vec3 n = normalize(vec3(-s.x, 1.0, -s.y));
  vec3 l = -uSunDir;
  vec3 r = refract(l, n, 1.0 / 1.333);
  vec3 r0 = refract(l, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  vec2 off = (r.xz / max(-r.y, 0.1) - r0.xz / max(-r0.y, 0.1)) * uDepth / uTile;
  vec2 p = uv + off;
  vOld = uv;
  vNew = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG = `
uniform vec4 uMask;
varying vec2 vOld;
varying vec2 vNew;
void main() {
  vec2 ox = dFdx(vOld);
  vec2 oy = dFdy(vOld);
  vec2 nx = dFdx(vNew);
  vec2 ny = dFdy(vNew);
  float oldArea = abs(ox.x * oy.y - ox.y * oy.x);
  float newArea = abs(nx.x * ny.y - nx.y * ny.x);
  float intensity = min(oldArea / max(newArea, 1e-12), 24.0);
  gl_FragColor = uMask * intensity;
}
`;

function buildGrid(n, margin) {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array((n + 1) * (n + 1) * 3);
  const span = 1 + margin * 2;
  let o = 0;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      verts[o++] = -margin + (i / n) * span;
      verts[o++] = -margin + (j / n) * span;
      verts[o++] = 0;
    }
  }
  const idx = new Uint32Array(n * n * 6);
  o = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      const b = a + 1;
      const c = a + n + 1;
      const d = c + 1;
      idx[o++] = a;
      idx[o++] = b;
      idx[o++] = d;
      idx[o++] = a;
      idx[o++] = d;
      idx[o++] = c;
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

export class Caustics {
  constructor(renderer, { size = 512, grid = 256, tile, slopeTexture, depths = [0.8, 2.4], sunDirection }) {
    this.renderer = renderer;
    this.tile = tile;
    this.sunDirection = sunDirection;
    this.target = makeTarget(size, size, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearMipmapLinearFilter,
      wrap: THREE.RepeatWrapping,
      mipmaps: true,
    });
    this.texture = this.target.texture;
    const geometry = buildGrid(grid, 0.08);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.materials = depths.map((depth, i) => new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uSlopes: { value: slopeTexture },
        uDepth: { value: depth },
        uTile: { value: tile },
        uAmp: { value: 1.0 },
        uSunDir: { value: sunDirection },
        uMask: { value: new THREE.Vector4(i === 0 ? 1 : 0, i === 1 ? 1 : 0, 0, 1) },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      side: THREE.DoubleSide,
    }));
    for (const m of this.materials) {
      const mesh = new THREE.Mesh(geometry, m);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }
    this.geometry = geometry;
  }

  update(amplitude = 1) {
    const renderer = this.renderer;
    for (const m of this.materials) m.uniforms.uAmp.value = amplitude;
    const state = saveState(renderer);
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.target);
    renderer.clear(true, false, false);
    renderer.autoClear = false;
    renderer.render(this.scene, this.camera);
    restoreState(renderer, state);
  }

  dispose() {
    this.target.dispose();
    this.geometry.dispose();
    this.materials.forEach((m) => m.dispose());
  }
}
