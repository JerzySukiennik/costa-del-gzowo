// Costa del Gzowo: builds the avatar layer geometries (worker-meshed sculpt plus laces, belt loops, watch, bracelet and eyes).
import * as THREE from 'three';
import { smooth } from './sdf.js';
import { SIDES } from './anatomy.js';
import { EYE } from './sculptHead.js';
import { SHORTS } from './sculptWear.js';
import { createSculpt } from './sculpt.js';
import { meshRegions, append, emptyLayer, LAYERS, SEAM, MESH_VERSION } from './regions.js';

function meshFromGeometry(geo, matrix) {
  geo.applyMatrix4(matrix);
  const p = geo.attributes.position.array;
  const n = geo.attributes.normal.array;
  const idx = geo.index ? Array.from(geo.index.array) : [...Array(p.length / 3).keys()];
  return { pos: Array.from(p), nor: Array.from(n), idx };
}

function frameMatrix(F, x, y, z, rx = 0, ry = 0, rz = 0) {
  const f = F.sub(x, y, z, rx, ry, rz);
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.x), new THREE.Vector3(...f.y), new THREE.Vector3(...f.z)).setPosition(...f.o);
}

function runWorker(data) {
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      resolve(null);
      return;
    }
    worker.onmessage = (e) => {
      worker.terminate();
      if (!e.data.ok) console.warn('avatar worker failed, meshing inline', e.data.error);
      resolve(e.data.ok ? e.data.out : null);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      worker.terminate();
      resolve(null);
    };
    worker.postMessage(data);
  });
}

function cacheStore(mode, fn) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('costa-avatar', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('mesh');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction('mesh', mode);
          const req = fn(tx.objectStore('mesh'));
          tx.oncomplete = () => resolve(req && req.result !== undefined ? req.result : null);
          tx.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      };
    } catch (e) {
      resolve(null);
    }
  });
}

async function meshCached(data) {
  const skip = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nocache');
  if (!skip) {
    const hit = await cacheStore('readonly', (st) => st.get(MESH_VERSION));
    if (hit && hit.skin) return { ...hit, cached: true };
  }
  const out = (await runWorker(data)) || meshRegions(data);
  if (!skip) cacheStore('readwrite', (st) => st.put(out, MESH_VERSION));
  return out;
}

function geometryOf(l) {
  const g = new THREE.BufferGeometry();
  const n = l.pos.length / 3;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    for (let q = 0; q < 4; q++) {
      si[v * 4 + q] = l.skin[v * 8 + q];
      sw[v * 4 + q] = l.skin[v * 8 + 4 + q];
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(l.pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(l.nor), 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aData', new THREE.BufferAttribute(Float32Array.from(l.attr), 4));
  g.setIndex(new THREE.BufferAttribute(n > 65535 ? Uint32Array.from(l.idx) : Uint16Array.from(l.idx), 1));
  g.computeBoundingSphere();
  return g;
}

function fromBuffers(b) {
  return { pos: Array.from(b.pos), nor: Array.from(b.nor), idx: Array.from(b.idx), skin: Array.from(b.skin), attr: Array.from(b.attr) };
}

export async function buildAvatar(skel) {
  const t0 = performance.now();
  const bind = {};
  for (const [name, m] of Object.entries(skel.bind)) bind[name] = Array.from(m.elements);
  const data = { bind, index: skel.index };
  const meshed = await meshCached(data);
  const t1 = performance.now();
  const S = createSculpt(data);
  const { F, W } = S;
  const wf = S.skinWeights;
  const swf = S.shoeWeights;
  const layers = {};
  for (const k of LAYERS) layers[k] = fromBuffers(meshed[k]);
  layers.eyes = emptyLayer();
  layers.gear = emptyLayer();

  for (const [t, s] of SIDES) {
    const A = F('ankle' + t);
    const Wr = F('wrist' + t);
    for (let q = 0; q < 5; q++) {
      const lz = 0.04 + q * 0.018;
      const ly = 0.006 - (lz - 0.04) * 0.4;
      const lace = new THREE.CapsuleGeometry(0.0021, 0.046, 2, 6).rotateZ(Math.PI / 2);
      const m = meshFromGeometry(lace, frameMatrix(A, 0, ly, lz, -0.4, q % 2 ? 0.16 : -0.16, 0));
      append(layers.shoes, m, (x, y, z) => swf(x, y, z, 0.012), (x, y, z) => [1, ...A.local(x, y, z)]);
    }
    if (s > 0) {
      const strap = meshFromGeometry(new THREE.TorusGeometry(0.0285, 0.0042, 8, 36).scale(0.78, 1.04, 2.6).rotateX(Math.PI / 2), frameMatrix(Wr, 0, SEAM + 0.0005, 0));
      append(layers.gear, strap, (x, y, z) => wf(x, y, z, 0.012), () => [0.12, 0.1, 0.09, 0.65]);
      const caseGeo = new THREE.CylinderGeometry(0.0172, 0.0172, 0.008, 28).rotateZ(Math.PI / 2);
      append(layers.gear, meshFromGeometry(caseGeo, frameMatrix(Wr, s * 0.021, SEAM + 0.0005, 0.0)), (x, y, z) => wf(x, y, z, 0.012), () => [0.62, 0.6, 0.57, 0.25]);
      const glass = new THREE.CylinderGeometry(0.0146, 0.0146, 0.0015, 28).rotateZ(Math.PI / 2);
      append(layers.gear, meshFromGeometry(glass, frameMatrix(Wr, s * 0.0252, SEAM + 0.0005, 0.0)), (x, y, z) => wf(x, y, z, 0.012), () => [0.03, 0.035, 0.04, 0.08]);
    } else {
      for (const [dy, c] of [[-0.002, [0.42, 0.24, 0.1]], [0.0065, [0.07, 0.15, 0.24]]]) {
        const band = meshFromGeometry(new THREE.TorusGeometry(0.0262, 0.0026, 6, 32).scale(0.8, 1.06, 1).rotateX(Math.PI / 2), frameMatrix(Wr, 0, SEAM + dy, 0));
        append(layers.gear, band, (x, y, z) => wf(x, y, z, 0.012), () => [...c, 0.8]);
      }
    }
    const sphere = new THREE.SphereGeometry(EYE.r, 24, 16).rotateX(Math.PI / 2);
    const p = sphere.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const z = p.getZ(v) / EYE.r;
      if (z > 0.86) p.setZ(v, p.getZ(v) + 0.0007 * smooth(0.86, 1.0, z));
    }
    sphere.computeVertexNormals();
    const E = F('eye' + t);
    append(layers.eyes, meshFromGeometry(sphere, new THREE.Matrix4().makeTranslation(...E.o)), () => [skel.index['eye' + t], 0, 0, 0, 1, 0, 0, 0], (x, y, z) => [x - E.o[0], y - E.o[1], z - E.o[2], s]);
  }
  for (const a of [0.55, -0.55, 1.4, -1.4, 2.5, -2.5, Math.PI]) {
    const px = Math.sin(a) * 0.17;
    const pz = Math.cos(a) * 0.125;
    const loop = new THREE.BoxGeometry(0.011, 0.044, 0.0045, 1, 2, 1);
    append(layers.shorts, meshFromGeometry(loop, frameMatrix(W, px, SHORTS.top - 0.024, pz, 0, Math.atan2(px / 0.17, pz / 0.125), 0)), (x, y, z) => wf(x, y, z, 0.03), () => [0.05, 0, 0, 2]);
  }
  const geos = {};
  const stats = { worker: Math.round(t1 - t0), cached: !!meshed.cached, regions: meshed.log };
  let tris = 0;
  for (const [k, l] of Object.entries(layers)) {
    geos[k] = geometryOf(l);
    stats['tri_' + k] = l.idx.length / 3;
    tris += l.idx.length / 3;
  }
  stats.tris = tris;
  stats.total = Math.round(performance.now() - t0);
  return { geos, stats };
}
