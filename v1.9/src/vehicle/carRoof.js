// Costa del Gzowo: three-bow fabric soft top with glass rear window, frameless side glass and the stowing sequence (windows drop, deck lid lifts, top folds into the well).
import * as THREE from 'three';
import { grid, monotone, smoothstep } from './carGeometry.js';

const RAIL_Y = monotone([[-1.07, 0.94], [-1.0, 1.01], [-0.85, 1.12], [-0.62, 1.215], [-0.4, 1.235], [0.24, 1.242]]);
const RAIL_Z = monotone([[-1.07, 0.66], [-0.6, 0.69], [0.24, 0.7]]);
const TOP_Y = monotone([[-1.07, 0.945], [-1.0, 1.06], [-0.86, 1.225], [-0.66, 1.305], [-0.4, 1.322], [-0.05, 1.32], [0.15, 1.295], [0.24, 1.278]]);
const BOWS = [0.02, -0.3, -0.6];
const SPLITS = [0.245, -0.25, -0.62, -1.07];
const KEYS = [
  { pivot: [-0.25, 1.32], lifted: [-1.05, 1.56, Math.PI], stowed: [-1.62, 0.895, Math.PI * 2] },
  { pivot: [-0.62, 1.31], lifted: [-0.98, 1.42, Math.PI * 0.62], stowed: [-1.1, 0.868, Math.PI] },
  { pivot: [-1.07, 0.945], lifted: [-1.1, 0.98, 1.35], stowed: [-1.1, 0.84, 2.52] },
];

export function roofPoint(x, f, out = new THREE.Vector3()) {
  const a = Math.abs(f);
  const ry = RAIL_Y(x);
  const ty = TOP_Y(x);
  let y = ry + (ty - ry) * (1 - Math.pow(a, 2.4));
  let sag = 0;
  for (const b of BOWS) sag = Math.max(sag, Math.exp(-(((x - b) / 0.05) ** 2)));
  y -= 0.006 * (1 - sag) * (1 - smoothstep(0.75, 1, a)) * smoothstep(-1.0, -0.85, x) * (x < 0.15 ? 1 : 0);
  const z = Math.sign(f) * RAIL_Z(x) * Math.min(1, a);
  y -= a > 0.97 ? (a - 0.97) * 0.9 : 0;
  return out.set(x, y, z);
}

function glassPanel(points, zAt) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, zAt(p.getX(i), p.getY(i)));
  g.computeVertexNormals();
  return g;
}

function bodyAttrs(g) {
  const n = g.attributes.position.count;
  g.setAttribute('aRest', new THREE.Float32BufferAttribute(g.attributes.position.array.slice(), 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aProj', new THREE.Float32BufferAttribute(new Float32Array(n).fill(2), 1));
  g.computeBoundingSphere();
  return g;
}

export function buildRoof({ mats }) {
  const pivots = [];
  const panels = [];
  for (let i = 0; i < 3; i++) {
    const x0 = SPLITS[i];
    const x1 = SPLITS[i + 1];
    const k = KEYS[i];
    const pivot = new THREE.Group();
    pivot.position.set(k.pivot[0], k.pivot[1], 0);
    const nu = Math.max(8, Math.round((x0 - x1) / 0.025));
    const g = grid(nu, 36, (u, v, p) => roofPoint(x0 + (x1 - x0) * u, v * 2.08 - 1.04, p));
    if (i === 2) {
      const idx = g.index.array;
      const keep = [];
      const pos = g.attributes.position;
      for (let t = 0; t < idx.length; t += 3) {
        let cx = 0;
        let cz = 0;
        for (let j = 0; j < 3; j++) {
          cx += pos.getX(idx[t + j]) / 3;
          cz += pos.getZ(idx[t + j]) / 3;
        }
        if (cx < -0.68 && cx > -0.985 && Math.abs(cz) < 0.43) continue;
        keep.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      g.setIndex(keep);
    }
    g.translate(-k.pivot[0], -k.pivot[1], 0);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mats.fabric);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    pivots.push(pivot);
    panels.push(mesh);
  }
  const rg = grid(16, 12, (u, v, p) => {
    roofPoint(-0.69 - 0.285 * u, (v * 2 - 1) * 0.66, p);
    p.y -= 0.003;
    return p;
  });
  rg.translate(-KEYS[2].pivot[0], -KEYS[2].pivot[1], 0);
  const rearGlass = new THREE.Mesh(bodyAttrs(rg), mats.makeGlass('rearGlass', 0.3));
  rearGlass.renderOrder = 2;
  pivots[2].add(rearGlass);

  const zDoor = (s) => (x, y) => s * (0.775 - (y - 0.89) * 0.3);
  const doorPoly = [[0.7, 0.885], [0.66, 0.935], [0.22, 1.226], [0.18, 1.234], [-0.38, 1.234], [-0.41, 1.215], [-0.42, 0.885]];
  const quarterPoly = [[-0.47, 0.9], [-0.47, 1.22], [-0.52, 1.222], [-0.66, 1.2], [-0.86, 1.08], [-0.93, 0.97], [-0.94, 0.92]];
  const windows = {};
  for (const [tag, s] of [['L', -1], ['R', 1]]) {
    windows['winF' + tag] = bodyAttrs(glassPanel(doorPoly, zDoor(s)));
    windows['winR' + tag] = bodyAttrs(glassPanel(quarterPoly, (x, y) => s * (0.765 - (y - 0.9) * 0.3)));
  }

  function apply(r, { trunk, windowMeshes }) {
    const drop = smoothstep(0, 0.2, r);
    for (const w of Object.values(windowMeshes)) {
      w.position.y = w.userData.baseY - drop * 0.3;
      w.visible = drop < 0.98 && !w.userData.broken;
    }
    const lid = smoothstep(0.08, 0.28, r) * (1 - smoothstep(0.8, 0.98, r));
    trunk.rotation.z = Math.max(trunk.userData.damageOpen || 0, lid * 0.48);
    const t = smoothstep(0.18, 0.85, r);
    for (let i = 0; i < 3; i++) {
      const k = KEYS[i];
      const p = pivots[i];
      const a = t < 0.5 ? smoothstep(0, 1, t / 0.5) : smoothstep(0, 1, (t - 0.5) / 0.5);
      const from = t < 0.5 ? [k.pivot[0], k.pivot[1], 0] : k.lifted;
      const to = t < 0.5 ? k.lifted : k.stowed;
      p.position.set(from[0] + (to[0] - from[0]) * a, from[1] + (to[1] - from[1]) * a, 0);
      p.rotation.z = from[2] + (to[2] - from[2]) * a;
      const squeeze = 1 - 0.12 * smoothstep(0.7, 1, t);
      p.scale.set(squeeze, 1, squeeze);
      p.visible = r < 0.995;
    }
  }

  return { pivots, panels, rearGlass, windows, apply };
}
