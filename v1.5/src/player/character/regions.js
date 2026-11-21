// Costa del Gzowo: meshes every sculpt region (surface nets, trim, decimation, hem walls) into skinned layer buffers; runs in a worker.
import { union, smooth } from './sdf.js';
import { surfaceNets, clipMesh, compact, hemWall, fieldGradient } from './mesher.js';
import { decimate } from './decimate.js';
import { SIDES, FINGERS } from './anatomy.js';
import { hairlineY } from './sculptHead.js';
import { SHIRT, SHORTS } from './sculptWear.js';
import { createSculpt } from './sculpt.js';

export const SEAM = 0.012;
export const MESH_VERSION = 'dario-4';
export const LAYERS = ['skin', 'hair', 'shirt', 'shorts', 'shoes'];

export function emptyLayer() {
  return { pos: [], nor: [], idx: [], skin: [], attr: [] };
}

export function append(layer, mesh, weigh, attr) {
  const base = layer.pos.length / 3;
  const n = mesh.pos.length / 3;
  for (let v = 0; v < n; v++) {
    const x = mesh.pos[v * 3];
    const y = mesh.pos[v * 3 + 1];
    const z = mesh.pos[v * 3 + 2];
    layer.pos.push(x, y, z);
    layer.nor.push(mesh.nor[v * 3], mesh.nor[v * 3 + 1], mesh.nor[v * 3 + 2]);
    layer.skin.push(...weigh(x, y, z));
    layer.attr.push(...(attr ? attr(x, y, z) : [0, 0, 0, 0]));
  }
  for (const i of mesh.idx) layer.idx.push(base + i);
}

function region(log, { sdf, frame, min, max, h, clip, hem, name, tris }) {
  const t = performance.now();
  let mesh = surfaceNets({ sdf, frame, min, max, h });
  const t1 = performance.now();
  const raw = mesh.idx.length / 3;
  if (clip) mesh = clipMesh(mesh, clip, sdf);
  mesh = compact(mesh);
  const t2 = performance.now();
  if (tris) mesh = compact(decimate(mesh, tris));
  const t3 = performance.now();
  if (hem && clip) hemWall(mesh, hem, fieldGradient(clip));
  log.push([name, Math.round(t1 - t), Math.round(t2 - t1), Math.round(t3 - t2), raw, mesh.idx.length / 3]);
  return mesh;
}

export function skinMask(F, x, y, z, handSide) {
  let red = 0;
  let stubble = 0;
  let hairEdge = 0;
  let nail = 0;
  const hy = y - 1.6;
  if (y > 1.45) {
    const d = (cx, cy, cz) => Math.hypot(x - cx, hy - cy, z - cz);
    for (const s of [1, -1]) {
      red = Math.max(red, smooth(0.04, 0.012, d(s * 0.074, 0.054, -0.012)) * 0.7);
      red = Math.max(red, smooth(0.032, 0.008, d(s * 0.04, 0.035, 0.07)) * 0.3);
    }
    red = Math.max(red, smooth(0.022, 0.004, d(0, 0.033, 0.106)) * 0.5);
    const sx = Math.abs(x);
    const jaw = smooth(0.034, 0.016, hy - Math.max(0, sx - 0.035) * 0.55) * smooth(-0.09, -0.058, hy) * smooth(-0.045, -0.005, z);
    const side = smooth(0.05, 0.062, sx) * smooth(0.07, 0.03, hy) * smooth(-0.03, 0.0, z) * smooth(0.07, 0.04, z);
    stubble = Math.min(1, jaw + side);
    hairEdge = smooth(-0.012, 0.004, hy - hairlineY(x, z));
  }
  if (handSide) {
    const s = handSide === 'L' ? 1 : -1;
    for (const name of Object.keys(FINGERS)) {
      for (const q of [0, 1, 2]) {
        const [lx, ly, lz] = F(`${name}${q}${handSide}`).local(x, y, z);
        if (q === 2) {
          const len = FINGERS[name].len[2];
          nail = Math.max(nail, smooth(0.0015, 0.0045, lx * s) * smooth(-len * 0.3, -len * 0.45, ly) * smooth(-len - 0.005, -len + 0.001, ly) * smooth(0.0068, 0.0045, Math.abs(lz)));
        }
        red = Math.max(red, smooth(0.011, 0.004, Math.hypot(lx - s * 0.006, ly, lz)) * 0.4);
      }
    }
  }
  if (y < 0.6 && y > 0.4) for (const s of [1, -1]) red = Math.max(red, smooth(0.055, 0.015, Math.hypot(x - s * 0.118, y - 0.49, z - 0.045)) * 0.35);
  return [red, stubble, hairEdge, nail];
}

export function meshRegions(bindData) {
  const S = createSculpt(bindData);
  const { F, W, arm, hand, leg, shoe, shoeG } = S;
  const wf = S.skinWeights;
  const swf = S.shoeWeights;
  const log = [];
  const layers = Object.fromEntries(LAYERS.map((k) => [k, emptyLayer()]));
  const headOnly = [S.index.head, 0, 0, 0, 1, 0, 0, 0];

  const headMesh = region(log, {
    name: 'head', sdf: S.headSdf(), frame: W, min: [-0.1, 1.405, -0.15], max: [0.1, 1.825, 0.135], h: 0.0032, tris: 13800,
    clip: (x, y, z) => Math.max(1.415 - y, y - 1.6 - hairlineY(x, z) - 0.016, Math.min(Math.hypot(x, (z + 0.015) * 0.95) - 0.082, 1.5 - y)),
  });
  append(layers.skin, headMesh, (x, y, z) => wf(x, y, z, 0.01), (x, y, z) => skinMask(F, x, y, z));

  for (const [t, s] of SIDES) {
    const Sh = F('shoulder' + t);
    const Wr = F('wrist' + t);
    const armMesh = region(log, {
      name: 'arm' + t, sdf: union(0.022, ...arm[t], ...hand[t].palm), frame: Sh, min: [-0.075, -0.6, -0.075], max: [0.075, -0.07, 0.075], h: 0.0072, tris: 3000,
      clip: (x, y, z) => Math.max(Sh.local(x, y, z)[1] - (SHIRT.sleeve + 0.032), SEAM - Wr.local(x, y, z)[1]),
    });
    append(layers.skin, armMesh, (x, y, z) => wf(x, y, z, 0.012), (x, y, z) => skinMask(F, x, y, z));
    const palm = union(0.012, arm[t][8], arm[t][9], ...hand[t].palm);
    const handMesh = region(log, {
      name: 'hand' + t, sdf: union(0, ...hand[t].fingers.map((f) => union(0.0055, palm, f))), frame: Wr, min: [-0.062, -0.215, -0.066], max: [0.062, 0.035, 0.1], h: 0.003, tris: 5200,
      clip: (x, y, z) => Wr.local(x, y, z)[1] - SEAM,
    });
    append(layers.skin, handMesh, (x, y, z) => wf(x, y, z, 0.0035), (x, y, z) => skinMask(F, x, y, z, t));

    const Hh = F('hip' + t);
    const A = F('ankle' + t);
    const legMesh = region(log, {
      name: 'leg' + t, sdf: union(0.02, ...leg[t]), frame: Hh, min: [-0.1, -0.945, -0.11], max: [0.1, -0.18, 0.25], h: 0.0072, tris: 4400,
      clip: (x, y, z) => Math.max(Hh.local(x, y, z)[1] - (SHORTS.hem + 0.04), -shoeG[t](x, y, z) - 0.014),
    });
    append(layers.skin, legMesh, (x, y, z) => wf(x, y, z, 0.012), (x, y, z) => skinMask(F, x, y, z));
    const shoeMesh = region(log, { name: 'shoe' + t, sdf: shoe[t], frame: A, min: [-0.066, -0.072, -0.1], max: [0.066, 0.045, 0.27], h: 0.005, clip: shoeG[t], hem: 0.006, tris: 3400 });
    append(layers.shoes, shoeMesh, (x, y, z) => swf(x, y, z, 0.012), (x, y, z) => [0, ...A.local(x, y, z)]);
  }

  const shirtMesh = region(log, { name: 'shirt', sdf: S.shirt(), frame: W, min: [-0.37, 0.9, -0.17], max: [0.37, 1.52, 0.17], h: 0.0105, clip: S.shirtG, hem: 0.0065, tris: 7800 });
  append(layers.shirt, shirtMesh, (x, y, z) => wf(x, y, z, 0.03), (x, y, z) => [-S.shirtG(x, y, z), 0, 0, 0]);
  const legFrames = { L: F('hipL'), R: F('hipR') };
  const shortsMesh = region(log, { name: 'shorts', sdf: S.shorts(), frame: W, min: [-0.27, 0.5, -0.19], max: [0.27, 1.03, 0.17], h: 0.0088, clip: S.shortsG, hem: 0.0055, tris: 6600 });
  append(layers.shorts, shortsMesh, (x, y, z) => wf(x, y, z, 0.03), (x, y, z) => {
    const s = x >= 0 ? 1 : -1;
    const [lx, ly, lz] = (s > 0 ? legFrames.L : legFrames.R).local(x, y, z);
    return [-S.shortsG(x, y, z), Math.atan2(lx * s, lz), ly, s];
  });

  const hairMesh = region(log, { name: 'hair', sdf: S.hair(), frame: W, min: [-0.1, 1.62, -0.15], max: [0.1, 1.83, 0.125], h: 0.0042, clip: S.hairG, tris: 4000 });
  append(layers.hair, hairMesh, () => headOnly, (x, y, z) => [y - 1.6 - hairlineY(x, z), 0, 0, 0]);

  const out = { log };
  for (const k of LAYERS) {
    const l = layers[k];
    out[k] = { pos: new Float32Array(l.pos), nor: new Float32Array(l.nor), idx: new Uint32Array(l.idx), skin: new Float32Array(l.skin), attr: new Float32Array(l.attr) };
  }
  return out;
}
