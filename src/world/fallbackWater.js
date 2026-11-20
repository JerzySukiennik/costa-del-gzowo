// Riverside: minimal stand-in water surface used only when the full water system fails to start.
import * as THREE from 'three';
import { LAYERS, WORLD } from '../config.js';

export function createFallbackWater({ scene, lighting }) {
  const material = new THREE.MeshPhysicalMaterial({ color: 0x0d3b38, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.84 });
  lighting.register(material);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WORLD.waterLevel;
  mesh.layers.set(LAYERS.WATER);
  scene.add(mesh);
  return {
    fallback: true,
    cameraUnderwater: false,
    underwaterPass: { enabled: false, render() {} },
    update() {},
    renderReflection() {},
    setSceneBuffers() {},
    setSunShadow() {},
    setSize() {},
    splash() {},
    setInteractors() {},
    addRipple() {},
    getHeightAt: () => WORLD.waterLevel,
    getFlowAt: (x, z, target) => target.set(0, WORLD.flowSpeed),
    dispose() {},
  };
}
