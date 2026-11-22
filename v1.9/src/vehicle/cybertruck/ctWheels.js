// Costa del Gzowo Cyber Truck: all-terrain tyre with chunky tread and shoulder lugs under a faceted aero cover whose ridges carry on down the sidewall (one shared geometry for all four wheels).
import * as THREE from 'three';
import { Batch, FIN, at, box, cyl, lathe } from '../carGeometry.js';
import { CT } from './ctShape.js';

const COVER = [0.045, 0.046, 0.05, 0.4, 0.15, 0.35];
const COVER_DARK = [0.025, 0.025, 0.028, 0.5, 0.1, 0.2];
const RUBBER = [0.022, 0.022, 0.022, 0.86, 0, 0];

function facet(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], 3));
  g.computeVertexNormals();
  return g;
}

export function buildWheelGeometry() {
  const R = CT.wheelRadius;
  const b = new Batch();
  const prof = [[0.262, -0.128], [0.3, -0.15], [0.36, -0.158], [0.405, -0.155], [0.425, -0.142], [R - 0.014, -0.12], [R - 0.014, 0.12], [0.425, 0.142], [0.405, 0.155], [0.36, 0.158], [0.3, 0.15], [0.262, 0.128]];
  const carcass = lathe(prof, 48);
  carcass.rotateX(Math.PI / 2);
  b.add(carcass, RUBBER);
  const N = 34;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const t2 = t + Math.PI / N;
    const rot = (a) => a - Math.PI / 2;
    const r = R - 0.007;
    b.add(at(box(0.068, 0.016, 0.105), Math.cos(t) * r, Math.sin(t) * r, 0.056, 0, 0, rot(t) + 0.12), RUBBER);
    b.add(at(box(0.068, 0.016, 0.105), Math.cos(t2) * r, Math.sin(t2) * r, -0.056, 0, 0, rot(t2) - 0.12), RUBBER);
    for (const sgn of [-1, 1]) {
      const ts = sgn > 0 ? t : t2;
      const rs = 0.426;
      b.add(at(box(0.062, 0.03, 0.046), Math.cos(ts) * rs, Math.sin(ts) * rs, sgn * 0.136, 0, 0, rot(ts)), RUBBER);
      const tl = sgn > 0 ? t2 : t;
      b.add(at(box(0.034, 0.03, 0.014), Math.cos(tl) * 0.395, Math.sin(tl) * 0.395, sgn * 0.158, 0, 0, rot(tl)), RUBBER);
    }
  }
  const S = 8;
  const zr = 0.168;
  const zv = 0.15;
  const zh = 0.186;
  const rh = 0.075;
  const ro = 0.335;
  for (let k = 0; k < S; k++) {
    const a0 = (k / S) * Math.PI * 2;
    const a1 = ((k + 1) / S) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const p = (r, a, z) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
    const h0 = p(rh, a0, zh);
    const h1 = p(rh, a1, zh);
    const hm = p(rh, am, zh + 0.004);
    const o0 = p(ro, a0, zv);
    const o1 = p(ro, a1, zv);
    const om = p(ro, am, zr);
    b.add(facet(h0, o0, om), COVER);
    b.add(facet(h0, om, hm), COVER);
    b.add(facet(hm, om, o1), COVER_DARK);
    b.add(facet(hm, o1, h1), COVER_DARK);
    b.add(facet(new THREE.Vector3(0, 0, zh + 0.006), h0, h1), COVER);
    b.add(facet(o0, p(ro, a0, zv - 0.03), p(ro, a1, zv - 0.03)), COVER_DARK);
    b.add(facet(o0, p(ro, a1, zv - 0.03), o1), COVER_DARK);
    b.add(at(box(0.026, 0.075, 0.014), Math.cos(am) * 0.37, Math.sin(am) * 0.37, 0.154, 0, 0, am - Math.PI / 2), COVER);
  }
  b.add(at(cyl(0.032, 0.036, 0.024, 6), 0, 0, zh + 0.01, Math.PI / 2), FIN.darkChrome);
  b.add(at(cyl(0.27, 0.27, 0.01, 32), 0, 0, -0.118, Math.PI / 2), FIN.under);
  return b.build();
}

export function buildWheel(geometry, side, material) {
  const group = new THREE.Group();
  const flip = new THREE.Group();
  const spin = new THREE.Group();
  if (side < 0) flip.rotation.y = Math.PI;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  spin.add(mesh);
  flip.add(spin);
  group.add(flip);
  return { group, spin, mesh };
}
