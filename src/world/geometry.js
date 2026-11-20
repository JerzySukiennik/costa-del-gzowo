// Costa del Gzowo: small procedural geometry helpers (extrusions with world-scale UVs, boxes, merging).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function extrudeX(profile, x0, x1, { uv = 0.3, caps = true, yAt = null } = {}) {
  const pos = [];
  const nor = [];
  const uvs = [];
  const n = profile.length;
  const y0 = yAt ? yAt(x0) : 0;
  const y1 = yAt ? yAt(x1) : 0;
  let run = 0;
  for (let i = 0; i < n; i++) {
    const a = profile[i];
    const b = profile[(i + 1) % n];
    const dz = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dz, dy);
    if (len < 1e-6) continue;
    const ny = -dz / len;
    const nz = dy / len;
    const A = [x0, a[1] + y0, a[0]];
    const B = [x1, a[1] + y1, a[0]];
    const C = [x1, b[1] + y1, b[0]];
    const D = [x0, b[1] + y0, b[0]];
    pos.push(...A, ...B, ...D, ...B, ...C, ...D);
    for (let k = 0; k < 6; k++) nor.push(0, ny, nz);
    const u0 = x0 * uv;
    const u1 = x1 * uv;
    const v0 = run * uv;
    const v1 = (run + len) * uv;
    uvs.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
    run += len;
  }
  if (caps) {
    const contour = profile.map((p) => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [x, sign, yo] of [[x0, -1, y0], [x1, 1, y1]]) {
      for (const t of tris) {
        const order = sign > 0 ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]];
        for (const idx of order) {
          const p = profile[idx];
          pos.push(x, p[1] + yo, p[0]);
          nor.push(sign, 0, 0);
          uvs.push(p[0] * uv, p[1] * uv);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

export function box(x0, x1, y0, y1, z0, z1, uv = 0.3) {
  return extrudeX([[z0, y0], [z1, y0], [z1, y1], [z0, y1]], x0, x1, { uv });
}

export function worldUV(geometry, scale = 0.3) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (ay >= ax && ay >= az) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else if (ax >= az) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function placed(geometry, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), typeof s === 'number' ? new THREE.Vector3(s, s, s) : s);
  return geometry.clone().applyMatrix4(m);
}

export function merge(list) {
  const clean = list.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(name)) out.deleteAttribute(name);
    return out;
  });
  return mergeGeometries(clean, false);
}

export function solid(geometries, material, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(merge(geometries), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
