// Riverside water: camera-centred radial surface mesh and its material wiring (bake, sim, spectrum, caustics, reflection, scene buffers).
import * as THREE from 'three';
import { SURFACE_VERT, SURFACE_FRAG } from './surfaceShader.js';

function radialGrid(segments, maxRadius, innerStep) {
  const radii = [0];
  let r = 0;
  const k = (2 * Math.PI) / segments;
  while (r < maxRadius) {
    r += Math.max(innerStep, r * k, (r * r) / 520);
    radii.push(r);
  }
  const positions = new Float32Array((1 + (radii.length - 1) * segments) * 3);
  let o = 3;
  for (let i = 1; i < radii.length; i++) {
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2 + (i % 2) * (Math.PI / segments);
      positions[o++] = Math.cos(a) * radii[i];
      positions[o++] = 0;
      positions[o++] = Math.sin(a) * radii[i];
    }
  }
  const indices = [];
  for (let s = 0; s < segments; s++) indices.push(0, 1 + ((s + 1) % segments), 1 + s);
  for (let i = 1; i < radii.length - 1; i++) {
    const a0 = 1 + (i - 1) * segments;
    const b0 = 1 + i * segments;
    const odd = i % 2 === 1;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      if (odd) {
        indices.push(a0 + s, a0 + s1, b0 + s);
        indices.push(a0 + s1, b0 + s1, b0 + s);
      } else {
        indices.push(a0 + s, b0 + s1, b0 + s);
        indices.push(a0 + s, a0 + s1, b0 + s1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices.length > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maxRadius);
  return geo;
}

export class WaterSurface {
  constructor({ segments, maxRadius = 1400, layer, shared }) {
    this.geometry = radialGrid(segments, maxRadius, 0.05);
    this.uniforms = {
      ...shared,
      uGridOrigin: { value: new THREE.Vector3() },
      uSlope0: { value: null },
      uSlope1: { value: null },
      uTiles: { value: new THREE.Vector2() },
      uLayerAmp: { value: new THREE.Vector2(1, 1) },
      uBoilTex: { value: null },
      uWindDir: { value: new THREE.Vector2(0.83, 0.55) },
      uReflection: { value: null },
      uReflMatrix: { value: new THREE.Matrix4() },
      uHasReflection: { value: 0 },
      uReflDistance: { value: 22 },
      uRefraction: { value: 2.2 },
      uFoamAlbedo: { value: new THREE.Color(0.82, 0.84, 0.83) },
      uFoamAmount: { value: 1 },
      uGlitter: { value: 1 },
      uBoilStrength: { value: 1 },
      uCameraUnder: { value: 0 },
      uProj: { value: new THREE.Matrix4() },
    };
    const make = (under) => new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: SURFACE_FRAG,
      uniforms: this.uniforms,
      side: under ? THREE.BackSide : THREE.FrontSide,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
      transparent: false,
      defines: { WATER_DEBUG: 0, UNDERSIDE: under ? 1 : 0 },
    });
    this.material = make(false);
    this.underMaterial = make(true);
    const u = this.uniforms;
    const before = (renderer, scene, camera) => {
      u.uProj.value.copy(camera.projectionMatrix);
      u.uInvProj.value.copy(camera.projectionMatrix).invert();
      u.uCamWorld.value.copy(camera.matrixWorld);
    };
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.underMesh = new THREE.Mesh(this.geometry, this.underMaterial);
    for (const m of [this.mesh, this.underMesh]) {
      m.frustumCulled = false;
      m.renderOrder = -10;
      m.layers.set(layer);
      m.onBeforeRender = before;
    }
    this.mesh.name = 'RiverSurface';
    this.underMesh.name = 'RiverSurfaceUnderside';
    this.mesh.add(this.underMesh);
  }

  setDebugView(mode) {
    this.material.defines.WATER_DEBUG = mode | 0;
    this.material.needsUpdate = true;
  }

  follow(position) {
    this.uniforms.uGridOrigin.value.set(position.x, 0, position.z);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.underMaterial.dispose();
  }
}
