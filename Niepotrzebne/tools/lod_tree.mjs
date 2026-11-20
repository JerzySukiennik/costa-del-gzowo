// Riverside: reduces a photoscanned tree glTF (thins leaf cards by component, simplifies wood) and writes a plain glTF.
// node lod_tree.mjs <in.gltf> <outDir> <name> leaves=0.1 wood=0.1 [scale=1]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

const [input, outDir, name, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((s) => s.split('=')));
const keepLeaves = +(opt.leaves ?? 0.1);
const woodRatio = +(opt.wood ?? 0.1);
const leafGrow = +(opt.grow ?? 0.42);
const leafPattern = new RegExp(opt.leaf ?? 'leaves|twigs');
await MeshoptSimplifier.ready;

const gltf = JSON.parse(readFileSync(input, 'utf8'));
const bin = readFileSync(join(dirname(input), gltf.buffers[0].uri));
const TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function read(accIndex) {
  const acc = gltf.accessors[accIndex];
  const view = gltf.bufferViews[acc.bufferView];
  const offset = bin.byteOffset + (view.byteOffset || 0) + (acc.byteOffset || 0);
  const n = acc.count * TYPES[acc.type];
  const Ctor = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[acc.componentType];
  const out = new Ctor(n);
  const dv = new DataView(bin.buffer, offset, n * Ctor.BYTES_PER_ELEMENT);
  for (let i = 0; i < n; i++) {
    out[i] = Ctor === Float32Array ? dv.getFloat32(i * 4, true) : Ctor === Uint32Array ? dv.getUint32(i * 4, true) : Ctor === Uint16Array ? dv.getUint16(i * 2, true) : dv.getUint8(i);
  }
  return out;
}

function hash01(i) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function thin(pos, nor, uv, idx, keep) {
  const count = pos.length / 3;
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], pos[i * 3 + k]);
    max[k] = Math.max(max[k], pos[i * 3 + k]);
  }
  const range = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const canon = new Uint32Array(count);
  const seen = new Map();
  for (let i = 0; i < count; i++) {
    const qx = Math.round(((pos[i * 3] - min[0]) / range) * 131071);
    const qy = Math.round(((pos[i * 3 + 1] - min[1]) / range) * 131071);
    const qz = Math.round(((pos[i * 3 + 2] - min[2]) / range) * 131071);
    const key = (qx * 131072 + qy) * 131072 + qz;
    const hit = seen.get(key);
    if (hit === undefined) {
      seen.set(key, i);
      canon[i] = i;
    } else canon[i] = hit;
  }
  const parent = new Uint32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(canon[idx[t]]);
    const b = find(canon[idx[t + 1]]);
    const c = find(canon[idx[t + 2]]);
    if (a !== b) parent[b] = a;
    const a2 = find(a);
    if (a2 !== c) parent[find(c)] = a2;
  }
  const sum = new Float64Array(count * 3);
  const num = new Uint32Array(count);
  const root = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const r = find(canon[i]);
    root[i] = r;
    sum[r * 3] += pos[i * 3];
    sum[r * 3 + 1] += pos[i * 3 + 1];
    sum[r * 3 + 2] += pos[i * 3 + 2];
    num[r]++;
  }
  const grow = Math.pow(keep, -leafGrow);
  const remap = new Int32Array(count).fill(-1);
  const outPos = [];
  const outNor = [];
  const outUv = [];
  const outIdx = [];
  let components = 0;
  for (let i = 0; i < count; i++) if (root[i] === i) components++;
  for (let t = 0; t < idx.length; t += 3) {
    const r = root[idx[t]];
    if (hash01(r) > keep) continue;
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k];
      if (remap[v] < 0) {
        remap[v] = outPos.length / 3;
        const cx = sum[r * 3] / num[r];
        const cy = sum[r * 3 + 1] / num[r];
        const cz = sum[r * 3 + 2] / num[r];
        outPos.push(cx + (pos[v * 3] - cx) * grow, cy + (pos[v * 3 + 1] - cy) * grow, cz + (pos[v * 3 + 2] - cz) * grow);
        outNor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
        outUv.push(uv[v * 2], uv[v * 2 + 1]);
      }
      outIdx.push(remap[v]);
    }
  }
  console.log('  leaf components', components, 'tris', idx.length / 3, '->', outIdx.length / 3);
  return { pos: new Float32Array(outPos), nor: new Float32Array(outNor), uv: new Float32Array(outUv), idx: new Uint32Array(outIdx) };
}

function simplify(pos, nor, uv, idx, ratio) {
  const indices = idx instanceof Uint32Array ? idx : new Uint32Array(idx);
  const target = Math.max(300, Math.floor((indices.length / 3) * ratio)) * 3;
  let [res, err] = MeshoptSimplifier.simplify(indices, pos, 3, target, 0.02, []);
  if (res.length > indices.length * 0.6 && ratio < 0.5) {
    const sloppy = MeshoptSimplifier.simplifySloppy(indices, pos, 3, null, Math.min(indices.length, target * 2), 0.05);
    if (sloppy[0].length < res.length) [res, err] = sloppy;
  }
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const outPos = [];
  const outNor = [];
  const outUv = [];
  const outIdx = new Uint32Array(res.length);
  for (let i = 0; i < res.length; i++) {
    const v = res[i];
    if (remap[v] < 0) {
      remap[v] = outPos.length / 3;
      outPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      outNor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
      outUv.push(uv[v * 2], uv[v * 2 + 1]);
    }
    outIdx[i] = remap[v];
  }
  console.log('  wood tris', indices.length / 3, '->', res.length / 3, 'err', err.toFixed(4));
  return { pos: new Float32Array(outPos), nor: new Float32Array(outNor), uv: new Float32Array(outUv), idx: outIdx };
}

const chunks = [];
const views = [];
const accessors = [];
let byteLength = 0;
function push(array, type, target, withBounds) {
  const buf = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const pad = (4 - (buf.length % 4)) % 4;
  views.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, target });
  chunks.push(buf, Buffer.alloc(pad));
  byteLength += buf.length + pad;
  const comps = TYPES[type];
  const acc = { bufferView: views.length - 1, componentType: array instanceof Float32Array ? 5126 : 5125, count: array.length / comps, type };
  if (withBounds) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], array[i + k]);
      max[k] = Math.max(max[k], array[i + k]);
    }
    acc.min = min;
    acc.max = max;
  }
  accessors.push(acc);
  return accessors.length - 1;
}

for (const mesh of gltf.meshes) {
  for (const prim of mesh.primitives) {
    const material = gltf.materials[prim.material];
    console.log(mesh.name, material.name);
    const pos = read(prim.attributes.POSITION);
    const nor = read(prim.attributes.NORMAL);
    const uv = read(prim.attributes.TEXCOORD_0);
    const idx = read(prim.indices);
    const isLeaf = leafPattern.test(material.name);
    const out = isLeaf ? (keepLeaves < 1 ? thin(pos, nor, uv, idx, keepLeaves) : { pos, nor, uv, idx: new Uint32Array(idx) }) : simplify(pos, nor, uv, idx, woodRatio);
    prim.attributes = {
      POSITION: push(out.pos, 'VEC3', 34962, true),
      NORMAL: push(out.nor, 'VEC3', 34962, false),
      TEXCOORD_0: push(out.uv, 'VEC2', 34962, false),
    };
    prim.indices = push(out.idx, 'SCALAR', 34963, false);
    if (isLeaf) {
      material.alphaMode = 'MASK';
      material.alphaCutoff = 0.4;
    }
  }
}

mkdirSync(join(outDir, 'textures'), { recursive: true });
gltf.accessors = accessors;
gltf.bufferViews = views;
gltf.buffers = [{ uri: name + '.bin', byteLength }];
for (const image of gltf.images || []) {
  const src = join(dirname(input), image.uri);
  const dst = join(outDir, image.uri);
  if (!existsSync(dst)) copyFileSync(src, dst);
}
writeFileSync(join(outDir, name + '.bin'), Buffer.concat(chunks));
writeFileSync(join(outDir, name + '.gltf'), JSON.stringify(gltf));
console.log('wrote', name, (byteLength / 1e6).toFixed(1), 'MB');
