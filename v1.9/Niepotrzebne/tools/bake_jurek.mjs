// Costa del Gzowo: bakes Jurek's avatar (RTFKT hoodie with the hood up, H&M sweatpants, green Crocs) into one GLB and repacks the trained blob head for it.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, meshopt, textureCompress, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';

const HOME = process.env.HOME;
const SRC = HOME + '/Downloads/Claude/Projects/Avatar/Output/full-v1/';
const OUT = new URL('../../assets/avatars/jurek/', import.meta.url).pathname.replace(/%20/g, ' ');
const BACKING_CUT = -0.082;
const BACKING_INSET = 0.003;
const HEAD_CENTER = [0, 1.64, 0.0];

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
mkdirSync(OUT, { recursive: true });

const doc = await io.read(SRC + 'character_nude.glb');
const root = doc.getRoot();
const mainScene = root.listScenes()[0];
const nodeByName = new Map();
for (const n of root.listNodes()) nodeByName.set(n.getName(), n);

const meta = JSON.parse(readFileSync(SRC + 'editor/assets/blobhead/head.json', 'utf8'));
const raw = readFileSync(SRC + 'editor/assets/blobhead/head.bin');
const bin = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const NV = meta.nv;
const NB = meta.nb;
const rest = new Float32Array(bin, meta.offsets.rest, NV * 3);
const disp = new Float32Array(bin, meta.offsets.disp, NV * 3);
const corners = new Float32Array(bin, meta.offsets.corners, NB * 4);
const blob = new Float32Array(bin, meta.offsets.blob, NB * 28);

const headNode = nodeByName.get('Head');
const headMesh = headNode.getMesh();
const headSkin = headNode.getSkin();
const jointNames = headSkin.listJoints().map((j) => j.getName());
const ibm = headSkin.getInverseBindMatrices();

const isEye = new Uint8Array(NV);
for (const [name, [a, b]] of Object.entries(meta.parts)) if (/^Eye/.test(name)) isEye.fill(name.endsWith('L') ? 1 : 2, a, b);

const CELL = 0.0008;
const grid = new Map();
for (let i = 0; i < NV; i++) {
  if (isEye[i]) continue;
  const k = Math.floor(rest[i * 3] / CELL) + ',' + Math.floor(rest[i * 3 + 1] / CELL) + ',' + Math.floor(rest[i * 3 + 2] / CELL);
  let list = grid.get(k);
  if (!list) grid.set(k, (list = []));
  list.push(i);
}

const usedBones = [];
const boneSlot = (name) => {
  let i = usedBones.indexOf(name);
  if (i < 0) {
    i = usedBones.length;
    usedBones.push(name);
  }
  return i;
};
const skinIndex = new Uint8Array(NV * 4);
const skinWeight = new Float32Array(NV * 4);
const matched = new Uint8Array(NV);
let worst = 0;
let unmatchedGl = 0;
let skinPrim = null;
for (const prim of headMesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION');
  const nor = prim.getAttribute('NORMAL');
  const joints = prim.getAttribute('JOINTS_0');
  const weights = prim.getAttribute('WEIGHTS_0');
  const isSkin = prim.getMaterial().getName() === 'Skin';
  if (isSkin) skinPrim = prim;
  const P = Float32Array.from(pos.getArray());
  const N = nor.getArray();
  const je = [];
  const we = [];
  for (let g = 0; g < pos.getCount(); g++) {
    const x = P[g * 3], y = P[g * 3 + 1], z = P[g * 3 + 2];
    const ix = Math.floor(x / CELL), iy = Math.floor(y / CELL), iz = Math.floor(z / CELL);
    let best = -1;
    let bd = 1e9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const list = grid.get(ix + a + ',' + (iy + b) + ',' + (iz + c));
      if (!list) continue;
      for (const m of list) {
        const dx = rest[m * 3] - x, dy = rest[m * 3 + 1] - y, dz = rest[m * 3 + 2] - z;
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd < bd) {
          bd = dd;
          best = m;
        }
      }
    }
    if (best < 0) {
      unmatchedGl++;
      continue;
    }
    worst = Math.max(worst, Math.sqrt(bd));
    if (!matched[best]) {
      matched[best] = 1;
      joints.getElement(g, je);
      weights.getElement(g, we);
      for (let k = 0; k < 4; k++) {
        skinIndex[best * 4 + k] = we[k] > 0 ? boneSlot(jointNames[je[k]]) : 0;
        skinWeight[best * 4 + k] = we[k];
      }
    }
    if (isSkin) {
      P[g * 3] = x + disp[best * 3] - N[g * 3] * BACKING_INSET;
      P[g * 3 + 1] = y + disp[best * 3 + 1] - N[g * 3 + 1] * BACKING_INSET;
      P[g * 3 + 2] = z + disp[best * 3 + 2] - N[g * 3 + 2] * BACKING_INSET;
    }
  }
  if (isSkin) pos.setArray(P);
}
let missing = 0;
for (let i = 0; i < NV; i++) {
  if (matched[i]) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += skinWeight[i * 4 + k];
    for (let k = 0; k < 4; k++) skinWeight[i * 4 + k] /= s || 1;
    continue;
  }
  if (!isEye[i]) missing++;
  skinIndex[i * 4] = boneSlot(isEye[i] === 1 ? 'LeftEye' : isEye[i] === 2 ? 'RightEye' : 'Head');
  skinWeight[i * 4] = 1;
}
console.log('head match: worst', (worst * 1000).toFixed(3), 'mm, unmatched gltf', unmatchedGl, 'missing mine', missing, 'bones', usedBones.join(','));

const restModel = new Float32Array(NV * 3);
for (let i = 0; i < NV * 3; i++) restModel[i] = rest[i] + disp[i];
const inverseBinds = usedBones.map((name) => {
  const out = [];
  ibm.getElement(jointNames.indexOf(name), out);
  return out.map((v) => +v.toFixed(7));
});

{
  const cutY = meta.dz + BACKING_CUT;
  const P = skinPrim.getAttribute('POSITION').getArray();
  const idx = skinPrim.getIndices();
  const I = idx.getArray();
  const out = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (Math.min(P[a * 3 + 1], P[b * 3 + 1], P[c * 3 + 1]) > cutY) continue;
    out.push(a, b, c);
  }
  idx.setArray(new Uint32Array(out));
  for (const target of skinPrim.listTargets()) {
    skinPrim.removeTarget(target);
    target.dispose();
  }
  skinPrim.setAttribute('TEXCOORD_0', null);
  const srgb = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const backing = doc.createMaterial('NeckBacking').setBaseColorFactor([srgb(meta.skin[0]), srgb(meta.skin[1]), srgb(meta.skin[2]), 1]).setRoughnessFactor(0.58).setMetallicFactor(0);
  skinPrim.setMaterial(backing);
  for (const prim of headMesh.listPrimitives()) if (prim !== skinPrim) {
    headMesh.removePrimitive(prim);
    prim.dispose();
  }
  headMesh.setWeights([]);
  headMesh.setExtras({});
  headNode.setWeights([]);
  console.log('neck backing tris', out.length / 3);
}
for (const n of root.listNodes()) {
  if (n.getMesh() && /^(Eye|Lashes|Hair|Eyebrow)/.test(n.getName())) {
    const mesh = n.getMesh();
    n.dispose();
    mesh.dispose();
  }
}

async function addGarment(file, bakeClip) {
  const g = await io.read(file);
  const before = new Set(root.listNodes());
  const beforeScenes = new Set(root.listScenes());
  const beforeAnims = new Set(root.listAnimations());
  mergeDocuments(doc, g);
  const newNodes = root.listNodes().filter((n) => !before.has(n));
  const newScenes = root.listScenes().filter((s) => !beforeScenes.has(s));
  const newAnims = root.listAnimations().filter((a) => !beforeAnims.has(a));
  const meshNodes = newNodes.filter((n) => n.getMesh());
  const keep = new Set(meshNodes);
  const skins = new Set(meshNodes.map((n) => n.getSkin()).filter(Boolean));
  for (const skin of skins) {
    const joints = skin.listJoints();
    const mapped = joints.map((j) => nodeByName.get(j.getName()) || j);
    for (const j of joints) skin.removeJoint(j);
    for (const j of mapped) skin.addJoint(j);
    skin.setSkeleton(nodeByName.get('Jurek.Rig') || null);
    for (const j of mapped) {
      if (before.has(j)) continue;
      keep.add(j);
      nodeByName.set(j.getName(), j);
    }
  }
  for (const e of [...keep]) {
    if (e.getMesh()) continue;
    const par = e.getParentNode();
    if (par && !keep.has(par) && nodeByName.get(par.getName()) && before.has(nodeByName.get(par.getName()))) {
      par.removeChild(e);
      nodeByName.get(par.getName()).addChild(e);
    }
  }
  for (const n of meshNodes) {
    const par = n.getParentNode();
    if (par) par.removeChild(n);
    for (const s of newScenes) s.removeChild(n);
    mainScene.addChild(n);
  }
  if (bakeClip) {
    const clip = newAnims.find((x) => x.getName() === bakeClip);
    if (!clip) throw new Error('clip not found: ' + bakeClip);
    for (const ch of clip.listChannels()) {
      const node = ch.getTargetNode();
      if (!node || !/^Cloth_/.test(node.getName())) continue;
      const sampler = ch.getSampler();
      const output = sampler.getOutput();
      const arr = output.getArray();
      const count = output.getCount();
      const size = output.getElementSize();
      const vi = sampler.getInterpolation() === 'CUBICSPLINE' ? 3 * (count / 3 - 1) + 1 : count - 1;
      const v = Array.from(arr.slice(vi * size, (vi + 1) * size));
      const path = ch.getTargetPath();
      if (path === 'translation') node.setTranslation(v);
      else if (path === 'rotation') node.setRotation(v);
      else if (path === 'scale') node.setScale(v);
    }
  }
  for (const a of newAnims) a.dispose();
  for (const s of newScenes) s.dispose();
  for (const n of newNodes) if (!keep.has(n)) n.dispose();
  const prims = [];
  for (const n of meshNodes) for (const p of n.getMesh().listPrimitives()) prims.push(p);
  return { meshNodes, prims };
}

const hoodie = await addGarment(SRC + 'clothes/rtfkt-ar-hoodie.glb', 'hood_state_up');
const pants = await addGarment(SRC + 'clothes/sweatpants-hm/sweatpants-hm.glb');
await addGarment(SRC + 'clothes/crocs-green.glb');
const crocsItem = JSON.parse(readFileSync(SRC + 'clothes/crocs-green.item.json', 'utf8'));

{
  const WAIST = 1.045;
  const PUSH = 0.013;
  const sm = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (const p of hoodie.prims) {
    const pos = p.getAttribute('POSITION');
    const P = pos.getArray();
    const N = p.getAttribute('NORMAL').getArray();
    const n = pos.getCount();
    const key = new Map();
    const grp = new Int32Array(n);
    const sum = [];
    for (let i = 0; i < n; i++) {
      const k = Math.round(P[i * 3] * 2e4) + ',' + Math.round(P[i * 3 + 1] * 2e4) + ',' + Math.round(P[i * 3 + 2] * 2e4);
      let id = key.get(k);
      if (id === undefined) {
        id = sum.length;
        key.set(k, id);
        sum.push([0, 0, 0, 0]);
      }
      grp[i] = id;
      const s = sum[id];
      s[0] += N[i * 3];
      s[1] += N[i * 3 + 1];
      s[2] += N[i * 3 + 2];
      s[3]++;
    }
    const np = new Float32Array(P);
    for (let i = 0; i < n; i++) {
      const s = sum[grp[i]];
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      const w = Math.min(1, l / s[3] / 0.5) / l;
      const f = PUSH * (1 - sm(WAIST - 0.05, WAIST + 0.05, P[i * 3 + 1]));
      np[i * 3] += s[0] * w * f;
      np[i * 3 + 1] += s[1] * w * f;
      np[i * 3 + 2] += s[2] * w * f;
    }
    pos.setArray(np);
  }
}

{
  const REGION_MASK = new Set([0, 1, 2, 3, 5, 6]);
  const C = 0.012;
  const cells = new Set();
  for (const g of [hoodie, pants]) for (const p of g.prims) {
    const P = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < P.length; i += 3) cells.add(Math.floor(P[i] / C) + ',' + Math.floor(P[i + 1] / C) + ',' + Math.floor(P[i + 2] / C));
  }
  const covered = (x, y, z) => {
    const cx = Math.floor(x / C), cy = Math.floor(y / C), cz = Math.floor(z / C);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (cells.has(cx + dx + ',' + (cy + dy) + ',' + (cz + dz))) return true;
    return false;
  };
  const body = root.listMeshes().find((m) => m.getName() === 'Body').listPrimitives()[0];
  const idx = body.getIndices();
  const src = idx.getArray();
  const reg = body.getAttribute('_REGION');
  const P = body.getAttribute('POSITION').getArray();
  const out = [];
  for (let i = 0; i < src.length; i += 3) {
    const a = src[i], b = src[i + 1], c = src[i + 2];
    const ra = Math.round(reg.getScalar(a)), rb = Math.round(reg.getScalar(b)), rc = Math.round(reg.getScalar(c));
    if (ra === 1 && rb === 1 && rc === 1) continue;
    if (REGION_MASK.has(ra) && REGION_MASK.has(rb) && REGION_MASK.has(rc)) {
      const x = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, y = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, z = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
      if (covered(x, y, z)) continue;
    }
    out.push(a, b, c);
  }
  console.log('body tris', src.length / 3, '->', out.length / 3);
  idx.setArray(new Uint32Array(out));
}

const hoodPos = hoodie.prims[0].getAttribute('POSITION').getArray();
const hoodIdx = hoodie.prims[0].getIndices().getArray();
const MAP_W = 720;
const MAP_H = 360;
const hoodMap = new Float32Array(MAP_W * MAP_H).fill(Infinity);
const binOf = (dx, dy, dz, r) => {
  const u = Math.atan2(dz, dx) / (2 * Math.PI) + 0.5;
  const v = Math.acos(Math.max(-1, Math.min(1, dy / r))) / Math.PI;
  return [Math.min(MAP_W - 1, Math.floor(u * MAP_W)), Math.min(MAP_H - 1, Math.floor(v * MAP_H))];
};
for (let t = 0; t < hoodIdx.length; t += 3) {
  const a = hoodIdx[t] * 3, b = hoodIdx[t + 1] * 3, c = hoodIdx[t + 2] * 3;
  if (Math.max(hoodPos[a + 1], hoodPos[b + 1], hoodPos[c + 1]) < 1.36) continue;
  const ab = Math.hypot(hoodPos[b] - hoodPos[a], hoodPos[b + 1] - hoodPos[a + 1], hoodPos[b + 2] - hoodPos[a + 2]);
  const ac = Math.hypot(hoodPos[c] - hoodPos[a], hoodPos[c + 1] - hoodPos[a + 1], hoodPos[c + 2] - hoodPos[a + 2]);
  const steps = Math.max(2, Math.ceil(Math.max(ab, ac) / 0.0006));
  for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) {
    const u = i / steps, v = j / steps, w = 1 - u - v;
    const dx = w * hoodPos[a] + u * hoodPos[b] + v * hoodPos[c] - HEAD_CENTER[0];
    const dy = w * hoodPos[a + 1] + u * hoodPos[b + 1] + v * hoodPos[c + 1] - HEAD_CENTER[1];
    const dz = w * hoodPos[a + 2] + u * hoodPos[b + 2] + v * hoodPos[c + 2] - HEAD_CENTER[2];
    const r = Math.hypot(dx, dy, dz);
    const [bx, by] = binOf(dx, dy, dz, r);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const yy = by + oy;
      if (yy < 0 || yy >= MAP_H) continue;
      const k = yy * MAP_W + ((bx + ox + MAP_W) % MAP_W);
      if (r < hoodMap[k]) hoodMap[k] = r;
    }
  }
}

const centers = new Float32Array(NB * 3);
const keep = [];
let outside = 0;
for (let i = 0; i < NB; i++) {
  const a = corners[i * 4] * 3, b = corners[i * 4 + 1] * 3, c = corners[i * 4 + 2] * 3;
  const o = i * 28;
  const ux = restModel[b] - restModel[a], uy = restModel[b + 1] - restModel[a + 1], uz = restModel[b + 2] - restModel[a + 2];
  const wx = restModel[c] - restModel[a], wy = restModel[c + 1] - restModel[a + 1], wz = restModel[c + 2] - restModel[a + 2];
  let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  const ul = Math.hypot(ux, uy, uz) || 1;
  const e1x = ux / ul, e1y = uy / ul, e1z = uz / ul;
  const e2x = ny * e1z - nz * e1y, e2y = nz * e1x - nx * e1z, e2z = nx * e1y - ny * e1x;
  const b1 = blob[o + 1], b2 = blob[o + 2], ox = blob[o + 3], oy = blob[o + 4], oz = blob[o + 5];
  const px = restModel[a] + b1 * ux + b2 * wx + e1x * ox + e2x * oy + nx * oz;
  const py = restModel[a + 1] + b1 * uy + b2 * wy + e1y * ox + e2y * oy + ny * oz;
  const pz = restModel[a + 2] + b1 * uz + b2 * wz + e1z * ox + e2z * oy + nz * oz;
  centers[i * 3] = px; centers[i * 3 + 1] = py; centers[i * 3 + 2] = pz;
  const dx = px - HEAD_CENTER[0], dy = py - HEAD_CENTER[1], dz = pz - HEAD_CENTER[2];
  const r = Math.hypot(dx, dy, dz);
  const [bx, by] = binOf(dx, dy, dz, r);
  const reach = Math.min(0.006, Math.max(blob[o + 10], blob[o + 11], blob[o + 12]));
  if (r + reach > hoodMap[by * MAP_W + bx] - 0.0015) {
    outside++;
    continue;
  }
  keep.push(i);
}
console.log('blobs', NB, 'outside the hood', outside, 'kept', keep.length);

const rim = (() => {
  const P = hoodPos;
  const weld = new Map();
  const id = (v) => {
    const k = Math.round(P[v * 3] * 1e4) + ',' + Math.round(P[v * 3 + 1] * 1e4) + ',' + Math.round(P[v * 3 + 2] * 1e4);
    if (!weld.has(k)) weld.set(k, v);
    return weld.get(k);
  };
  const edges = new Map();
  for (let t = 0; t < hoodIdx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = id(hoodIdx[t + e]), b = id(hoodIdx[t + ((e + 1) % 3)]);
    if (a === b) continue;
    const k = a < b ? a + '_' + b : b + '_' + a;
    edges.set(k, (edges.get(k) || 0) + 1);
  }
  const next = new Map();
  for (const [k, n] of edges) if (n === 1) {
    const [a, b] = k.split('_').map(Number);
    if (!next.has(a)) next.set(a, []);
    if (!next.has(b)) next.set(b, []);
    next.get(a).push(b);
    next.get(b).push(a);
  }
  const seen = new Set();
  const loops = [];
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    const stack = [start];
    while (stack.length) {
      const v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      loop.push(v);
      for (const w of next.get(v)) if (!seen.has(w)) stack.push(w);
    }
    loops.push(loop);
  }
  const info = loops.map((loop) => {
    const c = [0, 0, 0];
    for (const v of loop) for (let k = 0; k < 3; k++) c[k] += P[v * 3 + k] / loop.length;
    return { loop, c };
  });
  console.log('hoodie open loops', info.map((l) => `${l.loop.length}@${l.c.map((v) => v.toFixed(2))}`).join(' | '));
  const face = info.filter((l) => l.c[1] > 1.5 && Math.abs(l.c[0]) < 0.03).sort((a, b) => b.loop.length - a.loop.length)[0];
  if (!face) return null;
  const ring = new Set(face.loop);
  let yLo = Infinity, yHi = -Infinity;
  for (const v of ring) {
    yLo = Math.min(yLo, P[v * 3 + 1]);
    yHi = Math.max(yHi, P[v * 3 + 1]);
  }
  let sy = 0, sz = 0, syy = 0, syz = 0;
  for (const v of ring) {
    sy += P[v * 3 + 1];
    sz += P[v * 3 + 2];
    syy += P[v * 3 + 1] * P[v * 3 + 1];
    syz += P[v * 3 + 1] * P[v * 3 + 2];
  }
  const count = ring.size;
  const slope = (count * syz - sy * sz) / (count * syy - sy * sy);
  const cy = sy / count;
  const cz = sz / count;
  const widths = [];
  for (let k = 0; k < 12; k++) {
    const level = yLo + ((yHi - yLo) * k) / 11;
    let w = 0;
    for (const v of ring) for (const n of next.get(v)) {
      const y0 = P[v * 3 + 1], y1 = P[n * 3 + 1];
      if ((y0 - level) * (y1 - level) > 0) continue;
      const t = Math.abs(y1 - y0) < 1e-9 ? 0 : (level - y0) / (y1 - y0);
      w = Math.max(w, Math.abs(P[v * 3] + (P[n * 3] - P[v * 3]) * t));
    }
    widths.push(+w.toFixed(4));
  }
  return { cy: +cy.toFixed(4), cz: +cz.toFixed(4), slope: +slope.toFixed(4), yLo: +yLo.toFixed(4), yHi: +yHi.toFixed(4), widths };
})();
console.log('hood opening', JSON.stringify(rim));

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
function toHalf(value) {
  f32[0] = value;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  let mant = x & 0x007fffff;
  const exp = (x >>> 23) & 0xff;
  if (exp === 255) return sign | 0x7c00 | (mant ? 0x200 : 0);
  const e = exp - 127 + 15;
  if (e >= 31) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mant = (mant | 0x00800000) >>> (1 - e);
    return sign | ((mant + 0x1000) >>> 13);
  }
  return (sign | (e << 10) | (mant >>> 13)) + ((mant & 0x1000) ? 1 : 0);
}

const nb = keep.length;
const blobHalf = new Uint16Array(nb * 28);
const cornerOut = new Uint16Array(nb * 3);
for (let q = 0; q < nb; q++) {
  const i = keep[q];
  for (let k = 0; k < 28; k++) blobHalf[q * 28 + k] = toHalf(blob[i * 28 + k]);
  cornerOut[q * 3] = corners[i * 4];
  cornerOut[q * 3 + 1] = corners[i * 4 + 1];
  cornerOut[q * 3 + 2] = corners[i * 4 + 2];
}
const pad4 = (n) => (n + 3) & ~3;
const sections = [
  ['rest', new Uint8Array(restModel.buffer)],
  ['skinWeight', new Uint8Array(skinWeight.buffer)],
  ['skinIndex', skinIndex],
  ['corners', new Uint8Array(cornerOut.buffer)],
  ['blob', new Uint8Array(blobHalf.buffer)],
];
const offsets = {};
let total = 0;
for (const [name, bytes] of sections) {
  offsets[name] = total;
  total = pad4(total + bytes.byteLength);
}
const outBin = new Uint8Array(total);
for (const [name, bytes] of sections) outBin.set(bytes, offsets[name]);
writeFileSync(OUT + 'head.bin', outBin);
writeFileSync(OUT + 'head.json', JSON.stringify({
  nv: NV, nb, dz: meta.dz, color: meta.color, light: meta.light, skin: meta.skin, blobFloats: 28,
  bones: usedBones, inverseBinds, hood: rim, lift: crocsItem.lift_m, offsets,
}));
console.log('head.bin', (total / 1048576).toFixed(2), 'MB');

for (const p of root.listMeshes().flatMap((m) => m.listPrimitives())) {
  p.setAttribute('_REGION', null);
  p.setAttribute('_HEADVERT', null);
}
for (const m of root.listMaterials()) if (/Hoodie|SweatFabric|SweatRib|SweatCord|Croslite/i.test(m.getName())) m.setMetallicFactor(0);
for (const a of root.listAnimations()) a.dispose();

await doc.transform(
  prune(),
  dedup(),
  unpartition(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /^hoodie_baseColor/, resize: [2048, 2048], quality: 88 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /^(cord_|rivet_)/, resize: [256, 256], quality: 84 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /^(?!hoodie_baseColor|cord_|rivet_)/, resize: [1024, 1024], quality: 86 }),
  quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(OUT + 'body.glb', doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() || 0) / 3;
console.log('body.glb', (statSync(OUT + 'body.glb').size / 1048576).toFixed(2), 'MB, tris', tris | 0, 'meshes', root.listMeshes().map((m) => m.getName()).join(','), 'textures', root.listTextures().length);
