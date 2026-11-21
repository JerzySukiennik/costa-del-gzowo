// Costa del Gzowo: persistent tyre skid marks drawn as a ring-buffered ribbon on hard surfaces.
import * as THREE from 'three';

export function createSkidmarks(scene, max = 2400) {
  const pos = new Float32Array(max * 18);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.MeshBasicMaterial({ color: 0x040404, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  const last = new Map();
  let cursor = 0;
  let dirty = false;
  const a = new THREE.Vector3();
  const side = new THREE.Vector3();
  return {
    mark(id, point, normal, heading, width, active) {
      const prev = last.get(id);
      if (!active) {
        if (prev) last.delete(id);
        return;
      }
      side.crossVectors(normal, heading).normalize().multiplyScalar(width / 2);
      const l = a.copy(point).addScaledVector(normal, 0.012).sub(side).clone();
      const r = a.copy(point).addScaledVector(normal, 0.012).add(side).clone();
      if (prev && prev.l.distanceToSquared(l) < 0.09) return;
      if (prev && prev.l.distanceToSquared(l) < 9) {
        const o = cursor * 18;
        pos.set([prev.l.x, prev.l.y, prev.l.z, prev.r.x, prev.r.y, prev.r.z, l.x, l.y, l.z, prev.r.x, prev.r.y, prev.r.z, r.x, r.y, r.z, l.x, l.y, l.z], o);
        cursor = (cursor + 1) % max;
        dirty = true;
      }
      last.set(id, { l, r });
    },
    update() {
      if (!dirty) return;
      geo.attributes.position.needsUpdate = true;
      dirty = false;
    },
  };
}
