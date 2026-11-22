// Costa del Gzowo boats: geometry helpers (lofted hulls with hard chines, decks and cockpits, faceted shells, finish batches merged into one mesh per material).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { grid, clean } from '../carGeometry.js';

export { at, box, cyl, sphere, tube, sweep, lathe, roundRect, extrude, grid } from '../carGeometry.js';

export const F = {
  gel: [0.86, 0.86, 0.84, 0.16, 0, 1],
  navy: [0.02, 0.05, 0.11, 0.18, 0, 1],
  anti: [0.05, 0.06, 0.08, 0.6, 0, 0.2],
  black: [0.02, 0.02, 0.022, 0.5, 0, 0.3],
  gloss: [0.012, 0.012, 0.014, 0.12, 0, 1],
  rubber: [0.018, 0.018, 0.018, 0.85, 0, 0],
  steel: [0.72, 0.73, 0.75, 0.18, 1, 0],
  chrome: [0.9, 0.91, 0.93, 0.06, 1, 0],
  alu: [0.6, 0.61, 0.63, 0.3, 1, 0],
  teak: [0.42, 0.25, 0.12, 0.6, 0, 0],
  cream: [0.78, 0.74, 0.66, 0.7, 0, 0],
  white: [0.82, 0.82, 0.8, 0.5, 0, 0.4],
  grip: [0.62, 0.62, 0.6, 0.75, 0, 0],
  gold: [0.85, 0.6, 0.24, 0.24, 1, 0.5],
  green: [0.006, 0.03, 0.024, 0.18, 0.3, 1],
  lamp: [0.02, 0.02, 0.02, 0.3, 0, 1],
  carbon: [0.03, 0.032, 0.035, 0.3, 0.2, 1],
  screen: [0.01, 0.012, 0.015, 0.15, 0, 1],
};

export class Batch {
  constructor() {
    this.parts = [];
  }

  add(geometry, finish, code = 0, paint = null) {
    const g = clean(geometry);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const fin = new Float32Array(n * 4);
    const pos = g.attributes.position;
    const c = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      c[0] = finish[0];
      c[1] = finish[1];
      c[2] = finish[2];
      if (paint) paint(pos.getX(i), pos.getY(i), pos.getZ(i), c);
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
      fin[i * 4] = finish[3];
      fin[i * 4 + 1] = finish[4];
      fin[i * 4 + 2] = finish[5];
      fin[i * 4 + 3] = code;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aFinish', new THREE.BufferAttribute(fin, 4));
    this.parts.push(g);
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  build() {
    const g = mergeGeometries(this.parts, false);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    this.parts = [];
    return g;
  }
}

export function flat(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  return g;
}

export function hullShape(spec) {
  const L = spec.length;
  const x0 = -L / 2;
  const xAt = (t) => x0 + t * L;
  const section = (t, out) => {
    out.beam = Math.max(0, spec.beam(t));
    out.chine = Math.max(0, Math.min(out.beam, spec.chine(t)));
    out.keel = spec.keel(t);
    out.chineY = spec.chineY(t);
    out.sheer = spec.sheer(t);
    return out;
  };
  return { L, x0, xAt, section, spec };
}

export function hullSurfaces(shape, { nu = 40, nb = 12, ns = 6, deckFrom = 1, floorY = null, wall = 0.08, camber = 0.05, flare = 0.75, bottomPow = 1 } = {}) {
  const s = {};
  const { section, xAt } = shape;
  const u2t = (u) => u;
  const bottom = grid(nu, nb, (u, v, p) => {
    const t = u2t(u);
    section(t, s);
    const w = v * 2 - 1;
    const a = Math.abs(w);
    p.set(xAt(t), s.keel + (s.chineY - s.keel) * Math.pow(a, bottomPow), Math.sign(w) * s.chine * a);
  });
  const side = (sign) => grid(nu, ns, (u, v, p) => {
    const t = u2t(u);
    section(t, s);
    const q = sign > 0 ? v : 1 - v;
    p.set(xAt(t), s.chineY + (s.sheer - s.chineY) * q, sign * (s.chine + (s.beam - s.chine) * Math.pow(q, flare)));
  });
  const out = { bottom, sides: [side(1), side(-1)], deck: null, floor: null, walls: [], caps: [], bulkhead: null, transom: null, bow: null };
  const cap = (t, facing) => {
    const tr = section(t, {});
    if (tr.beam <= 0.01) return null;
    const shp = new THREE.Shape();
    const pts = [];
    for (let i = 0; i <= ns; i++) {
      const q = 1 - i / ns;
      pts.push([-(tr.chine + (tr.beam - tr.chine) * Math.pow(q, flare)), tr.chineY + (tr.sheer - tr.chineY) * q]);
    }
    for (let i = 1; i < nb; i++) {
      const w = -1 + (2 * i) / nb;
      pts.push([tr.chine * w, tr.keel + (tr.chineY - tr.keel) * Math.pow(Math.abs(w), bottomPow)]);
    }
    for (let i = 0; i <= ns; i++) {
      const q = i / ns;
      pts.push([tr.chine + (tr.beam - tr.chine) * Math.pow(q, flare), tr.chineY + (tr.sheer - tr.chineY) * q]);
    }
    shp.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shp.lineTo(pts[i][0], pts[i][1]);
    const g = new THREE.ShapeGeometry(shp);
    g.rotateY(facing * Math.PI / 2);
    if (facing > 0) g.scale(1, 1, -1);
    g.translate(xAt(t), 0, 0);
    return g;
  };
  out.transom = cap(0, -1);
  out.bow = cap(1, 1);
  const deckN = Math.max(2, Math.round(nu * (1 - deckFrom)));
  if (deckFrom < 1) {
    out.deck = grid(deckN, 10, (u, v, p) => {
      const t = deckFrom + (1 - deckFrom) * u;
      section(t, s);
      const w = v * 2 - 1;
      p.set(xAt(t), s.sheer + camber * (1 - w * w) * Math.min(1, s.beam), w * s.beam);
    });
  }
  if (floorY !== null && deckFrom > 0) {
    const n = Math.max(2, Math.round(nu * deckFrom));
    const inner = (t) => Math.max(0.02, section(t, s).beam - wall);
    out.floor = grid(n, 8, (u, v, p) => {
      const t = deckFrom * u;
      p.set(xAt(t), floorY, (v * 2 - 1) * inner(t));
    });
    for (const sign of [1, -1]) {
      out.walls.push(grid(n, 3, (u, v, p) => {
        const t = deckFrom * u;
        const z = inner(t);
        section(t, s);
        p.set(xAt(t), floorY + (s.sheer - floorY) * v, sign * z);
      }));
      out.caps.push(grid(n, 2, (u, v, p) => {
        const t = deckFrom * u;
        section(t, s);
        p.set(xAt(t), s.sheer + 0.012, sign * (s.beam - wall + wall * v));
      }));
    }
    section(deckFrom, s);
    const iw = Math.max(0.02, s.beam - wall);
    out.bulkhead = new THREE.PlaneGeometry(iw * 2, s.sheer - floorY).rotateY(-Math.PI / 2).translate(xAt(deckFrom), (s.sheer + floorY) / 2, 0);
  }
  return out;
}

export function hullPoints(shape, n = 10) {
  const s = {};
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.min(0.995, i / n);
    shape.section(t, s);
    const x = shape.xAt(t);
    pts.push(x, s.keel, 0, x, s.chineY, s.chine, x, s.chineY, -s.chine, x, s.sheer, s.beam, x, s.sheer, -s.beam);
  }
  return new Float32Array(pts);
}

export function buoyancySamples(shape, { along = 5, across = 3, from = 0.04, to = 0.86 } = {}) {
  const s = {};
  const out = [];
  const dt = (to - from) / along;
  for (let i = 0; i < along; i++) {
    const t = from + (i + 0.5) * dt;
    shape.section(t, s);
    const w = (s.beam + s.chine) * 0.5 * 2;
    const dx = dt * shape.L;
    for (let j = 0; j < across; j++) {
      const z = (-0.5 + (j + 0.5) / across) * w * 0.9;
      out.push([shape.xAt(t), z, (dx * w) / across]);
    }
  }
  return out;
}

export function foilSection(chord, thick = 0.1) {
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([Math.cos(a) * chord * 0.5, Math.sin(a) * chord * thick * (i < n / 2 ? 1 : 0.7)]);
  }
  for (let i = 1; i < n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    pts.push([Math.cos(a) * chord * 0.5, Math.sin(a) * chord * thick * 0.35]);
  }
  return pts;
}

export function prism(points, y0, y1) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, y1, 0);
  return g;
}

export function propeller(radius, blades = 3, hub = 0.06) {
  const parts = [];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const blade = new THREE.SphereGeometry(1, 10, 6).scale(0.02, radius * 0.5, radius * 0.24).translate(0, radius * 0.5, 0);
    blade.rotateY(0.5);
    blade.rotateX(a);
    parts.push(blade);
  }
  parts.push(new THREE.CylinderGeometry(hub * 0.6, hub, hub * 3, 12).rotateZ(Math.PI / 2));
  return mergeGeometries(parts.map(clean), false);
}

export function mergeAll(list) {
  return mergeGeometries(list.map(clean), false);
}
