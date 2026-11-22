// Costa del Gzowo: lighter triangle lists for heavy models, built in a background worker; shadow maps, the water reflection and far-away views draw the same vertices with fewer triangles, only where the difference stays under half a pixel (or under the shadow bias).
import * as THREE from 'three';

const MIN_TRIANGLES = 1500;
const ERRORS = [0.006, 0.025];
const PIXELS = 0.5;

export function createMeshLod({ camera, perf }) {
  const roots = [];
  const items = [];
  const jobs = new Map();
  const known = new WeakSet();
  const center = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const stats = { meshes: 0, ready: 0, pending: 0, saved: 0 };
  let viewHeight = 1080;
  let pixelsPerMetre = 1000;
  let worker = null;
  let nextId = 1;
  let age = 1e9;
  try {
    worker = new Worker(new URL('./meshLodWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => finish(event.data);
    worker.onerror = () => {
      worker = null;
      stats.pending = 0;
      jobs.clear();
    };
  } catch (error) {
    worker = null;
  }

  function finish({ id, levels }) {
    const job = jobs.get(id);
    jobs.delete(id);
    stats.pending = jobs.size;
    if (!job) return;
    const base = job.geometry;
    const lod = base.userData.lod;
    lod.levels = levels.map((list) => {
      if (!list) return null;
      const geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute);
      geometry.morphAttributes = base.morphAttributes;
      geometry.morphTargetsRelative = base.morphTargetsRelative;
      geometry.setIndex(new THREE.BufferAttribute(job.vertices < 65536 ? new Uint16Array(list) : list, 1));
      return geometry;
    });
    if (!lod.levels[0] && lod.levels[1]) lod.levels[0] = lod.levels[1];
    base.addEventListener('dispose', () => {
      for (const geometry of new Set(lod.levels)) if (geometry) geometry.dispose();
      lod.levels = [null, null];
    });
    stats.ready++;
  }

  function request(mesh) {
    const geometry = mesh.geometry;
    if (geometry.userData.lod) return true;
    const index = geometry.index;
    const position = geometry.attributes.position;
    if (!worker || !index || !position || index.count < MIN_TRIANGLES * 3 || geometry.groups.length > 1 || geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return false;
    mesh.updateWorldMatrix(true, false);
    scale.setFromMatrixScale(mesh.matrixWorld);
    const size = Math.max(scale.x, scale.y, scale.z) || 1;
    const positions = new Float32Array(position.count * 3);
    if (!position.isInterleavedBufferAttribute && position.array instanceof Float32Array && position.itemSize === 3 && !position.normalized) positions.set(position.array.subarray(0, position.count * 3));
    else for (let i = 0; i < position.count; i++) positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
    const indices = new Uint32Array(index.array.subarray(0, index.count));
    const id = nextId++;
    geometry.userData.lod = { levels: [null, null] };
    jobs.set(id, { geometry, vertices: position.count });
    stats.pending = jobs.size;
    worker.postMessage({ id, positions, indices, errors: ERRORS.map((e) => e / size) }, [positions.buffer, indices.buffer]);
    return true;
  }

  function choose(item, mode, cascade) {
    const levels = item.base.userData.lod.levels;
    if (mode === 'shadow') return perf.shadows ? (cascade === 0 ? levels[0] : levels[1] || levels[0]) : null;
    if (mode === 'reflection') return perf.reflection ? levels[1] || levels[0] : null;
    if (!perf.models || (!levels[0] && !levels[1])) return null;
    const mesh = item.mesh;
    const sphere = item.base.boundingSphere || (item.base.computeBoundingSphere(), item.base.boundingSphere);
    center.copy(sphere.center).applyMatrix4(mesh.matrixWorld);
    scale.setFromMatrixScale(mesh.matrixWorld);
    const distance = Math.max(0.5, center.distanceTo(camera.position) - sphere.radius * Math.max(scale.x, scale.y, scale.z));
    const pixels = pixelsPerMetre / distance;
    if (levels[1] && ERRORS[1] * pixels < PIXELS) return levels[1];
    if (levels[0] && ERRORS[0] * pixels < PIXELS) return levels[0];
    return null;
  }

  function apply(mode, cascade = 0) {
    for (const item of items) {
      const mesh = item.mesh;
      if (mesh.geometry !== item.base && mesh.geometry !== item.set) {
        item.base = mesh.geometry;
        item.set = null;
        if (!request(mesh)) continue;
      }
      if (!item.base.userData.lod) continue;
      const light = mode === 'base' ? null : choose(item, mode, cascade);
      const next = light || item.base;
      if (light) {
        light.boundingSphere = item.base.boundingSphere;
        light.boundingBox = item.base.boundingBox;
        if (mode === 'main') stats.saved += (item.base.index.count - light.index.count) / 3;
      }
      if (mesh.geometry !== next) mesh.geometry = next;
      item.set = next;
    }
  }

  function scan() {
    for (const root of roots) {
      root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || known.has(o) || Array.isArray(o.material)) return;
        known.add(o);
        if (!request(o)) return;
        items.push({ mesh: o, base: o.geometry, set: null });
        stats.meshes = items.length;
      });
    }
    for (let i = items.length - 1; i >= 0; i--) {
      let top = items[i].mesh;
      while (top.parent) top = top.parent;
      if (!top.isScene) items.splice(i, 1);
    }
  }

  return {
    stats,
    watch(root) {
      if (root && !roots.includes(root)) roots.push(root);
      age = 1e9;
    },
    setViewport(height) {
      viewHeight = height;
    },
    stage(name, on, cascade) {
      apply(on ? name : 'main', cascade);
    },
    update() {
      stats.saved = 0;
      pixelsPerMetre = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      if (++age > 90) {
        age = 0;
        scan();
      }
      apply('main');
    },
    end() {
      apply('base');
    },
  };
}
