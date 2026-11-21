// Costa del Gzowo: whole models (vehicles, statues) that are outside the camera's view skip the main picture but still appear in shadow maps and the water reflection.
import * as THREE from 'three';

export function createModelCull({ camera, perf }) {
  const items = [];
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const stats = { models: 0, hidden: 0 };
  return {
    stats,
    watch(root, radius, lift = 0.8) {
      if (root && !items.some((item) => item.root === root)) items.push({ root, radius, lift, hidden: false });
    },
    update() {
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      stats.models = items.length;
      stats.hidden = 0;
      for (const item of items) {
        if (item.hidden) {
          item.root.visible = true;
          item.hidden = false;
        }
        if (!perf.models || !item.root.visible || !item.root.parent) continue;
        item.root.getWorldPosition(sphere.center);
        sphere.center.y += item.lift;
        sphere.radius = item.radius;
        if (frustum.intersectsSphere(sphere)) continue;
        item.root.visible = false;
        item.hidden = true;
        stats.hidden++;
      }
    },
    stage(name, on) {
      for (const item of items) if (item.hidden) item.root.visible = on;
    },
  };
}
