// Costa del Gzowo: whole models (vehicles, statues) that are outside the camera's view skip the main picture but still appear in shadow maps and the water reflection; only their drawable parts are switched off, lights stay in the scene so no shader has to be rebuilt.
import * as THREE from 'three';

export function createModelCull({ camera, perf }) {
  const items = [];
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const stats = { models: 0, hidden: 0 };

  function hide(item) {
    item.parts.length = 0;
    item.root.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || o.layers.mask === 0) return;
      item.parts.push(o, o.layers.mask);
      o.layers.mask = 0;
    });
    item.hidden = true;
  }

  function show(item, on) {
    const parts = item.parts;
    for (let i = 0; i < parts.length; i += 2) parts[i].layers.mask = on ? parts[i + 1] : 0;
  }

  return {
    stats,
    watch(root, radius, lift = 0.8) {
      if (root && !items.some((item) => item.root === root)) items.push({ root, radius, lift, hidden: false, parts: [] });
    },
    update() {
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      stats.models = items.length;
      stats.hidden = 0;
      for (const item of items) {
        let out = false;
        if (perf.models && item.root.visible && item.root.parent) {
          item.root.getWorldPosition(sphere.center);
          sphere.center.y += item.lift;
          sphere.radius = item.radius;
          out = !frustum.intersectsSphere(sphere);
        }
        if (out && !item.hidden) hide(item);
        else if (!out && item.hidden) {
          show(item, true);
          item.hidden = false;
          item.parts.length = 0;
        }
        if (item.hidden) stats.hidden++;
      }
    },
    stage(name, on) {
      for (const item of items) if (item.hidden) show(item, on);
    },
  };
}
