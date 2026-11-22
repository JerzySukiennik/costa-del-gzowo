// Costa del Gzowo: deterministic scattering helpers, placement rules and model baking for instancing.
import * as THREE from 'three';
import { BRIDGE, HARBOUR, ROAD, TOWN, WORLD } from '../config.js';
import { heightAt, trackInfo } from './heightfield.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clearOfBuilt(x, z, margin = 0) {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax > BRIDGE.halfLength - 14 && az < ROAD.halfWidth + ROAD.shoulder + margin) return false;
  if (ax <= BRIDGE.halfLength + 4 && az < BRIDGE.deckHalfWidth + 2.5 + margin) return false;
  const p = ROAD.pullOff;
  if (x > p.x0 - 3 - margin && x < p.x1 + 3 + margin && z > p.z0 - 2 && z < p.z1 + 3 + margin) return false;
  const tr = trackInfo(x, z);
  if (tr.dist < tr.halfWidth + 1.2 + margin) return false;
  if (x > TOWN.x0 - 8 - margin && x < TOWN.x1 + 8 + margin && z > TOWN.z0 - 8 - margin && z < TOWN.z1 + 8 + margin) return false;
  if (x > HARBOUR.x0 - 10 - margin && x < HARBOUR.x1 + 10 + margin && z > TOWN.z1 - margin && z < HARBOUR.z1 + 4) return false;
  return true;
}

export function slopeAt(x, z) {
  const gx = heightAt(x + 0.7, z) - heightAt(x - 0.7, z);
  const gz = heightAt(x, z + 0.7) - heightAt(x, z - 0.7);
  return Math.hypot(gx, gz) / 1.4;
}

export function normalAt(x, z, out) {
  const gx = heightAt(x + 0.5, z) - heightAt(x - 0.5, z);
  const gz = heightAt(x, z + 0.5) - heightAt(x, z - 0.5);
  return out.set(-gx, 1, -gz).normalize();
}

export function pickPoints({ count, attempts = 30, seed, region = WORLD.half - 6, spacing = 0, accept }) {
  const random = rng(seed);
  const points = [];
  const cell = Math.max(spacing, 1);
  const grid = new Map();
  const key = (x, z) => Math.floor(x / cell) * 4096 + Math.floor(z / cell);
  const half = typeof region === 'number' ? { x0: -region, x1: region, z0: -region, z1: region } : region;
  let tries = count * attempts;
  while (points.length < count && tries-- > 0) {
    const x = half.x0 + random() * (half.x1 - half.x0);
    const z = half.z0 + random() * (half.z1 - half.z0);
    const p = accept(x, z, random);
    if (!p || random() > p) continue;
    if (spacing > 0) {
      let ok = true;
      const cx = Math.floor(x / cell);
      const cz = Math.floor(z / cell);
      for (let i = -1; i <= 1 && ok; i++) {
        for (let j = -1; j <= 1 && ok; j++) {
          const list = grid.get((cx + i) * 4096 + cz + j);
          if (!list) continue;
          for (const q of list) if ((q.x - x) ** 2 + (q.z - z) ** 2 < spacing * spacing) ok = false;
        }
      }
      if (!ok) continue;
      const k = key(x, z);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push({ x, z });
    }
    points.push({ x, z, y: heightAt(x, z), r: random(), r2: random(), r3: random() });
  }
  return points;
}

export function bakeMesh(mesh, { ground = true, sink = 0 } = {}) {
  mesh.updateWorldMatrix(true, false);
  const src = mesh.geometry;
  const geo = new THREE.BufferGeometry();
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const uv = src.attributes.uv;
  const p = new Float32Array(pos.count * 3);
  const n = new Float32Array(pos.count * 3);
  const u = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    p[i * 3] = v.x;
    p[i * 3 + 1] = v.y;
    p[i * 3 + 2] = v.z;
    if (nor) {
      v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
      n[i * 3] = v.x;
      n[i * 3 + 1] = v.y;
      n[i * 3 + 2] = v.z;
    }
    if (uv) {
      u[i * 2] = uv.getX(i);
      u[i * 2 + 1] = uv.getY(i);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(u, 2));
  if (src.index) geo.setIndex(new THREE.BufferAttribute(src.index.array.slice(), 1));
  if (ground) {
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y - (b.max.y - b.min.y) * sink, -(b.min.z + b.max.z) / 2);
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function variantsOf(root) {
  const groups = new Map();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    let top = o;
    while (top.parent && top.parent !== root) top = top.parent;
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top).push(o);
  });
  const variants = [];
  for (const meshes of groups.values()) {
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const offset = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    const parts = meshes.map((m) => {
      const geo = bakeMesh(m, { ground: false });
      geo.translate(-offset.x, -offset.y, -offset.z);
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      return { geometry: geo, material: m.material };
    });
    variants.push({ parts, size: box.getSize(new THREE.Vector3()) });
  }
  return variants;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();

export function instancedVariant(variant, placements, { layer = 0, cast = true, receive = true } = {}) {
  const meshes = [];
  for (const part of variant.parts) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    placements.forEach((pl, i) => {
      _q.setFromAxisAngle(_up, pl.yaw || 0);
      if (pl.align) {
        normalAt(pl.x, pl.z, _n);
        _q2.setFromUnitVectors(_up, _n.lerp(_up, 1 - pl.align).normalize());
        _q.premultiply(_q2);
      }
      if (pl.tilt) _q.multiply(_q2.setFromEuler(new THREE.Euler(pl.tilt[0], 0, pl.tilt[1])));
      const s = pl.scale || 1;
      _s.set(s, s * (pl.squash || 1), s);
      _p.set(pl.x, pl.y, pl.z);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.layers.set(layer);
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    mesh.matrixAutoUpdate = false;
    meshes.push(mesh);
  }
  return meshes;
}
