// Costa del Gzowo: bakes the pedestrian cast (sculpt, mesh, two triangle lists, skin weights, colour slots, shading) into assets/npc/peds.bin and peds.json.
// node bake_npcs.mjs [id ...]   re-bakes the listed people (all when none is cached) and reassembles the pack; NPC_CACHE sets the cache folder.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { smooth, cone, box, union } from '../../src/player/character/sdf.js';
import { hairlineY, EYE } from '../../src/player/character/sculptHead.js';
import { SIDES } from '../../src/npc/ped/bones.js';
import { SLOT, KIND, FACE_RANGE, BLOCKS } from '../../src/npc/ped/format.js';
import { buildFrames } from './npc/frames.mjs';
import { region, solidBox, solidCylinder, solidPrism, eyeCap } from './npc/meshkit.mjs';
import { bodyParams, createBody, makeTop, makeBottom, makeHair, makeHat, makeBeard, SEAM, W } from './npc/sculpt.mjs';
import { CAST } from './npc/cast.mjs';

const VERSION = 14;
const OUT = new URL('../../assets/npc/', import.meta.url).pathname.replace(/%20/g, ' ');
const CACHE = process.env.NPC_CACHE || join(tmpdir(), 'costa-npc-cache');
mkdirSync(OUT, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const ROUGH = { skin: 0.68, hair: 0.62, cloth: 0.88, denim: 0.92, shoe: 0.5, sole: 0.78, gloss: 0.12, eye: 0.14, hat: 0.82, bag: 0.6 };
const FAR = [0, -1, 0];

function cached(key, make) {
  const file = join(CACHE, `${key}-v${VERSION}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const value = make();
  writeFileSync(file, JSON.stringify(value));
  return value;
}

function toLocal(mesh, frame) {
  const out = { pos: [], nor: [], idx: mesh.idx, far: mesh.far };
  for (let v = 0; v < mesh.pos.length; v += 3) {
    out.pos.push(...frame.local(mesh.pos[v], mesh.pos[v + 1], mesh.pos[v + 2]));
    const n = [mesh.nor[v], mesh.nor[v + 1], mesh.nor[v + 2]];
    out.nor.push(n[0] * frame.x[0] + n[1] * frame.x[1] + n[2] * frame.x[2], n[0] * frame.y[0] + n[1] * frame.y[1] + n[2] * frame.y[2], n[0] * frame.z[0] + n[1] * frame.z[1] + n[2] * frame.z[2]);
  }
  return out;
}

function toWorld(mesh, frame) {
  const out = { pos: [], nor: [], idx: mesh.idx, far: mesh.far };
  for (let v = 0; v < mesh.pos.length; v += 3) {
    out.pos.push(...frame.point(mesh.pos[v], mesh.pos[v + 1], mesh.pos[v + 2]));
    out.nor.push(...frame.dir(mesh.nor[v], mesh.nor[v + 1], mesh.nor[v + 2]));
  }
  return out;
}

function headWarp(h) {
  return (x, y, z) => {
    const f = smooth(1.47, 1.535, y);
    if (f <= 0) return [x, y, z];
    let hx = x;
    let hy = y - 1.6;
    let hz = z;
    const nw = smooth(0.04, 0.014, Math.hypot(hx, (hy - 0.04) * 0.8, hz - 0.095));
    const ns = 1 + (h.nose - 1) * nw;
    hx *= ns;
    hy = 0.045 + (hy - 0.045) * ns;
    hz = 0.082 + (hz - 0.082) * ns;
    const cw = smooth(0.05, 0.015, Math.hypot(Math.abs(hx) - 0.048, hy - 0.015, hz - 0.05));
    hx += Math.sign(hx) * h.cheek * cw;
    const low = smooth(0.045, -0.05, hy) * smooth(-0.14, -0.09, hy) * smooth(-0.06, 0.02, hz);
    hx *= 1 + (h.jaw - 1) * low;
    if (hy < 0) hy *= 1 + (h.chin - 1) * smooth(-0.005, -0.04, hy) * smooth(-0.01, 0.05, hz) * smooth(-0.14, -0.09, hy);
    hx *= 1 + (h.width - 1) * f;
    const s = 1 + (h.scale - 1) * f;
    return [hx * s, 1.6 - 0.1 + (hy + 0.1) * s, -0.02 + (hz + 0.02) * s];
  };
}

function bakePerson(def) {
  const t0 = Date.now();
  const B = bodyParams(def.body);
  const hands = { L: 'relaxed', R: 'relaxed' };
  if (def.carry) hands[def.carry.hand] = def.carry.what === 'phone' ? 'hold' : 'grip';
  const frames = buildFrames(B.sh, hands);
  const { F, index } = frames;
  const body = createBody(frames, B);
  const wf = body.skinWeights;
  const one = (name) => [index[name], 0, 0, 0, 1, 0, 0, 0];
  const pieces = [];
  const occluders = [body.headSdf, body.armSdf.L, body.armSdf.R, body.legSdf.L, body.legSdf.R];
  const sizes = [];
  const add = (mesh, weigh, mat, extra = {}) => {
    sizes.push(`${mesh.idx.length / 3}/${mesh.far.length / 3}`);
    if (mesh.idx.length) pieces.push({ mesh, weigh, mat, ...extra });
  };
  const skin = () => [SLOT.SKIN, 1, ROUGH.skin, KIND.SKIN];

  const headClip = (x, y, z) => Math.max(1.415 - y, Math.min(Math.hypot(x, (z + 0.015) * 0.95) - 0.082, 1.5 - y));
  const head = cached('head-' + B.upperKey, () => {
    const std = createBody(buildFrames(B.sh), bodyParams({ upper: B.upperKey }));
    return region({ sdf: std.headSdf, frame: W, min: [-0.1, 1.405, -0.15], max: [0.1, 1.825, 0.135], h: 0.0042, tris: 2900, far: 620, clip: headClip });
  });
  add(head, (x, y, z) => wf(x, y, z, 0.01), skin, { head: true, face: true });

  const top = makeTop(body, def.top);
  const bottom = def.bottom ? makeBottom(body, def.bottom) : null;
  occluders.push(top.sdf);
  if (bottom) occluders.push(bottom.sdf);

  const bare = def.top.sleeve === 'none';
  const chest = region({
    sdf: bare ? union(0.03, body.coreSdf, body.armSdf.L, body.armSdf.R) : body.coreSdf, frame: W, min: [-0.31, 1.14, -0.17], max: [0.31, 1.5, 0.17], h: 0.0085, tris: bare ? 620 : 420, far: bare ? 160 : 110,
    clip: (x, y, z) => {
      let g = Math.max(-headClip(x, y, z), Math.min(-0.035 - top.neck(x, y, z), bare ? -0.035 - top.arm(x, y, z) : 1));
      if (bare && y > 1.2) {
        const S = F(x >= 0 ? 'shoulderL' : 'shoulderR');
        const [lx, ly, lz] = S.local(x, y, z);
        if (Math.hypot(lx, lz) < 0.14) g = Math.max(g, -0.06 - ly);
      }
      return g;
    },
  });
  add(chest, (x, y, z) => wf(x, y, z, 0.02), skin);

  for (const [t, s] of SIDES) {
    const Sh = F('shoulder' + t);
    const E = F('elbow' + t);
    const Wr = F('wrist' + t);
    const A = F('ankle' + t);
    const Hh = F('hip' + t);
    const sleeve = def.top.sleeve;
    const armMesh = region({
      sdf: body.armSdf[t], frame: Sh, min: [-0.085, -0.6, -0.085], max: [0.085, 0.035, 0.085], h: 0.0075, tris: 430, far: 110,
      clip: (x, y, z) => {
        const ly = Sh.local(x, y, z)[1];
        const cover = sleeve === 'long' ? E.local(x, y, z)[1] + 0.206 : sleeve === 'none' ? ly + 0.06 : ly - (def.top.sleeveLen + 0.03);
        return Math.max(cover, SEAM - Wr.local(x, y, z)[1]);
      },
    });
    add(armMesh, (x, y, z) => wf(x, y, z, 0.012), skin);

    const handLocal = cached(`hand-${t}-${hands[t]}`, () => {
      const hf = buildFrames(0.19, hands);
      const hb = createBody(hf, bodyParams({}));
      const wr = hf.F('wrist' + t);
      const palm = union(0.012, hb.arm[t][8], hb.arm[t][9], ...hb.hand[t].palm);
      const mesh = region({
        sdf: union(0, ...hb.hand[t].fingers.map((f) => union(0.0055, palm, f))), frame: wr, min: [-0.11, -0.215, -0.08], max: [0.11, 0.035, 0.105], h: 0.0034, tris: 440, far: 96,
        clip: (x, y, z) => wr.local(x, y, z)[1] - SEAM,
      });
      return toLocal(mesh, wr);
    });
    add(toWorld(handLocal, Wr), () => one('wrist' + t), skin);

    const kind = bottom ? def.bottom.kind : 'skirt';
    const sock = kind === 'trousers';
    const legMesh = region({
      sdf: body.legSdf[t], frame: Hh, min: [-0.11, -0.945, -0.12], max: [0.11, -0.1, 0.25], h: 0.008, tris: sock ? 120 : 540, far: sock ? 40 : 130,
      clip: (x, y, z) => {
        let cover;
        if (kind === 'shorts') cover = Hh.local(x, y, z)[1] - (def.bottom.len + 0.04);
        else if (kind === 'skirt') cover = y - ((bottom ? def.bottom.hem : def.top.skirt.hem) + 0.13);
        else if (kind === 'leggings') cover = 1;
        else cover = y - ((def.bottom.cuffY ?? 0.108) + 0.04);
        return Math.max(cover, -body.shoeG[t](x, y, z) - 0.014);
      },
    });
    add(legMesh, (x, y, z) => wf(x, y, z, 0.012), sock ? () => [SLOT.SOLE, 1, ROUGH.cloth, KIND.PLAIN] : skin);

    const shoeMesh = cached('shoe-' + t, () => region({ sdf: body.shoe[t], frame: A, min: [-0.066, -0.072, -0.1], max: [0.066, 0.045, 0.27], h: 0.0056, clip: body.shoeG[t], hem: 0.006, tris: 470, far: 120 }));
    add(shoeMesh, (x, y, z) => body.shoeWeights(x, y, z, 0.012), (x, y, z) => {
      const ly = A.local(x, y, z)[1];
      const sole = smooth(-0.031, -0.036, ly);
      return sole > 0.5 ? [SLOT.SOLE, ly < -0.054 ? 0.55 : 1, ROUGH.sole, KIND.PLAIN] : [SLOT.SHOE, 1, ROUGH.shoe, KIND.PLAIN];
    });
  }

  const dress = !!def.top.skirt;
  const long = def.top.sleeve === 'long';
  const lowY = dress ? def.top.skirt.hem - 0.03 : def.top.hem - 0.04;
  const reach = long ? 0.57 : 0.37;
  const wide = dress ? Math.max(reach, def.top.skirt.spread + def.top.skirt.radius + 0.03) : reach;
  const topMesh = region({
    sdf: top.sdf, frame: W, min: [-wide, lowY, -0.27], max: [wide, 1.53, 0.3], h: dress ? 0.0115 : 0.0105, clip: top.clip, hem: top.hem,
    tris: dress ? 2900 : long ? 2400 : 2000, far: dress ? 720 : long ? 620 : 520,
  });
  add(topMesh, (x, y, z) => wf(x, y, z, 0.03), (x, y, z) => [SLOT.TOP, 1 - 0.14 * smooth(0.012, 0.0, -top.clip(x, y, z)), ROUGH.cloth, KIND.PATTERN]);

  if (bottom) {
    const kind = def.bottom.kind;
    const low = kind === 'skirt' ? def.bottom.hem - 0.03 : kind === 'shorts' ? 0.93 + def.bottom.len - 0.06 : 0.07;
    const spread = kind === 'skirt' ? def.bottom.spread + def.bottom.radius + 0.03 : 0.3;
    const mesh = region({ sdf: bottom.sdf, frame: W, min: [-spread, low, -0.25], max: [spread, 1.06, 0.32], h: 0.0095, clip: bottom.clip, hem: bottom.hem, tris: kind === 'trousers' || kind === 'leggings' ? 2000 : 1650, far: kind === 'trousers' || kind === 'leggings' ? 520 : 420 });
    add(mesh, (x, y, z) => wf(x, y, z, 0.03), (x, y, z) => [SLOT.BOTTOM, (1 - 0.14 * smooth(0.012, 0.0, -bottom.clip(x, y, z))) * (y > bottom.top - 0.036 ? 0.82 : 1), kind === 'leggings' ? 0.6 : ROUGH.denim, KIND.PLAIN]);
  }

  if (bottom && def.top.hem > bottom.top - 0.012) {
    const mesh = region({
      sdf: body.torsoSdf, frame: W, min: [-0.26, bottom.top - 0.07, -0.2], max: [0.26, def.top.hem + 0.07, 0.3], h: 0.0085, tris: 320, far: 80,
      clip: (x, y, z) => Math.max(bottom.top - 0.045 - y, y - (def.top.hem + 0.045)),
    });
    add(mesh, (x, y, z) => wf(x, y, z, 0.02), skin);
  }

  const hat = def.hat ? makeHat(body, def.hat) : null;
  if (def.hair) {
    const hair = makeHair(body, def.hair);
    occluders.push(hair.sdf);
    const clip = hat ? (x, y, z) => Math.max(hair.clip(x, y, z), y - 1.6 - hat.line[0] - z * hat.line[1] + 0.005) : hair.clip;
    const mesh = region({ sdf: hair.sdf, frame: W, min: hair.min, max: hair.max, h: 0.006, clip, tris: hair.tris[0], far: hair.tris[1] });
    const headW = one('head');
    add(mesh, hair.sway ? (x, y, z) => {
      const a = smooth(1.4, 1.5, y);
      return [index.head, index.chest, 0, 0, a, 1 - a, 0, 0];
    } : () => headW, () => [SLOT.HAIR, 1, ROUGH.hair, KIND.HAIR], { head: true });
  }
  if (hat) {
    occluders.push(hat.sdf);
    const mesh = region({ sdf: hat.sdf, frame: W, min: hat.min, max: hat.max, h: 0.006, clip: hat.clip, tris: hat.tris[0], far: hat.tris[1] });
    add(mesh, () => one('head'), (x, y, z) => (def.hat === 'sun' && Math.hypot(x, z + 0.012) < 0.098 && y - 1.6 < 0.112 + z * 0.07 ? [SLOT.ACCENT2, 1, ROUGH.hat, KIND.PLAIN] : [SLOT.ACCENT, 1, ROUGH.hat, KIND.PLAIN]), { head: true });
  }
  if (def.beard) {
    const beard = makeBeard(body, def.beard);
    const mesh = region({ sdf: beard.sdf, frame: W, min: beard.min, max: beard.max, h: 0.005, clip: beard.clip, tris: beard.tris[0], far: beard.tris[1] });
    add(mesh, (x, y, z) => wf(x, y, z, 0.01), () => [SLOT.HAIR, 1, ROUGH.hair, KIND.HAIR], { head: true });
  }

  const H = F('head');
  const gloss = () => [SLOT.DARK, 1, 0.34, KIND.GLOSS];
  if (def.glasses) {
    const parts = [solidBox(H.sub(0, 0.0795, 0.1005), 0.0085, 0.0028, 0.002)];
    for (const [, s] of SIDES) {
      const lens = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const r = 1 / Math.pow(Math.pow(Math.abs(c), 3.2) + Math.pow(Math.abs(sn), 3.2), 1 / 3.2);
        lens.push([c * r * 0.0265 + (sn > 0 ? s * 0.0025 * sn : 0), sn * r * (sn > 0 ? 0.0185 : 0.021)]);
      }
      parts.push(solidPrism(H.sub(s * 0.0345, 0.0705, 0.099, 0, s * 0.14, 0), lens, 0.0018, 30));
      parts.push(solidBox(H.sub(s * 0.0695, 0.077, 0.047, 0, s * 0.165, 0), 0.0013, 0.0028, 0.05));
    }
    for (const m of parts) add(m, () => one('head'), gloss, { head: true, plain: true, near: true });
  }
  const warp = headWarp(def.head);
  const eyeRows = {};
  for (const [t, s] of SIDES) {
    const c = [s * EYE.x, 1.6 + EYE.y, EYE.z];
    const w = warp(...c);
    eyeRows['eye' + t] = [w[0], w[1] - 1.6, w[2]];
    const cap = eyeCap(c, EYE.r, [0.23, 0.27, 0.6, 0.67, 0.98, 1.4]);
    const ring = cap.ring;
    let v = 0;
    add(cap, () => one('eye' + t), () => {
      const r = ring[v++ % ring.length];
      return r <= 1 ? [SLOT.DARK, 1, ROUGH.eye, KIND.GLOSS] : r <= 3 ? [SLOT.IRIS, r === 3 ? 0.5 : 0.95, ROUGH.eye, KIND.GLOSS] : [SLOT.EYE, r >= 6 ? 0.42 : r === 5 ? 0.6 : 0.72, ROUGH.eye, KIND.GLOSS];
    }, { head: true, plain: true, near: true });
  }

  if (def.carry) {
    const s = def.carry.hand === 'L' ? 1 : -1;
    const Wr = F('wrist' + def.carry.hand);
    const wrist = () => one('wrist' + def.carry.hand);
    if (def.carry.what === 'cup') {
      const C = Wr.sub(-s * 0.043, -0.083, 0.012, Math.PI / 2, 0, 0);
      add(solidCylinder(C, 0.03, 0.039, 0.058, 12), wrist, () => [SLOT.ACCENT2, 1, 0.7, KIND.PLAIN], { plain: true });
      add(solidCylinder(C.sub(0, 0.063, 0), 0.041, 0.04, 0.006, 12), wrist, () => [SLOT.DARK, 1.6, 0.5, KIND.PLAIN], { plain: true });
    } else if (def.carry.what === 'phone') {
      add(solidBox(Wr.sub(-s * 0.027, -0.1, 0.008, 0, 0, -s * 0.22), 0.0045, 0.074, 0.037), wrist, gloss, { plain: true });
    } else if (def.carry.what === 'handbag') {
      const sdf = union(0.012, box(Wr.sub(0, -0.275, 0), 0.05, 0.085, 0.13, 0.03), cone(Wr.point(0, -0.085, 0.03), Wr.point(0, -0.19, 0.085), 0.0065, 0.0065), cone(Wr.point(0, -0.085, -0.03), Wr.point(0, -0.19, -0.085), 0.0065, 0.0065));
      const mesh = region({ sdf, frame: Wr, min: [-0.075, -0.38, -0.155], max: [0.075, -0.06, 0.155], h: 0.0075, tris: 300, far: 80 });
      add(mesh, wrist, (x, y, z) => (Wr.local(x, y, z)[1] > -0.185 ? [SLOT.ACCENT2, 1, 0.5, KIND.PLAIN] : [SLOT.ACCENT, 1, ROUGH.bag, KIND.PLAIN]));
    }
  }
  if (def.bag && def.bag.kind === 'tote') {
    const s = def.bag.side === 'L' ? 1 : -1;
    const sdf = union(0.01, box(W.sub(s * 0.225, 0.985, -0.03), 0.042, 0.14, 0.16, 0.03), cone(W.point(s * 0.2, 1.12, 0.07), W.point(s * 0.14, 1.468, 0.012), 0.0075, 0.0075), cone(W.point(s * 0.2, 1.12, -0.12), W.point(s * 0.14, 1.468, -0.03), 0.0075, 0.0075));
    occluders.push(sdf);
    const mesh = region({ sdf, frame: W, min: [s > 0 ? 0.1 : -0.29, 0.82, -0.21], max: [s > 0 ? 0.29 : -0.1, 1.5, 0.13], h: 0.0075, tris: 380, far: 100 });
    add(mesh, (x, y) => {
      const a = smooth(0.95, 1.2, y);
      return [index.chest, index.hips, 0, 0, 0.55 + 0.45 * a, 0.45 - 0.45 * a, 0, 0];
    }, (x, y) => (y > 1.135 ? [SLOT.ACCENT2, 1, 0.5, KIND.PLAIN] : [SLOT.ACCENT, 1, ROUGH.bag, KIND.PLAIN]));
  }
  if (def.bag && def.bag.kind === 'backpack') {
    const straps = SIDES.flatMap(([, s]) => [
      cone(W.point(s * 0.095, 1.38, -0.13), W.point(s * 0.105, 1.47, -0.012), 0.012, 0.012),
      cone(W.point(s * 0.105, 1.47, -0.012), W.point(s * 0.118, 1.29, 0.1 * B.upper.d + 0.006), 0.012, 0.011),
      cone(W.point(s * 0.118, 1.29, 0.1 * B.upper.d + 0.006), W.point(s * 0.142, 1.18, 0.06), 0.011, 0.01),
    ]);
    const sdf = union(0.012, box(W.sub(0, 1.2, -0.19), 0.125, 0.185, 0.068, 0.045), box(W.sub(0, 1.12, -0.262), 0.085, 0.07, 0.02, 0.018), ...straps);
    occluders.push(sdf);
    const mesh = region({ sdf, frame: W, min: [-0.19, 0.98, -0.3], max: [0.19, 1.5, 0.13], h: 0.008, tris: 520, far: 130 });
    add(mesh, () => one('chest'), (x, y, z) => (z > -0.115 ? [SLOT.ACCENT2, 1, 0.6, KIND.PLAIN] : [SLOT.ACCENT, z < -0.25 ? 0.8 : 1, ROUGH.bag, KIND.PLAIN]));
  }

  const dist = (x, y, z) => {
    let d = 1;
    for (const o of occluders) d = Math.min(d, o.d(x, y, z));
    return d;
  };
  const out = { pos: [], nor: [], si: [], sw: [], mat: [], face: [], idx: [], far: [] };
  for (const piece of pieces) {
    const base = out.pos.length / 3;
    const { pos, nor } = piece.mesh;
    for (let v = 0; v < pos.length; v += 3) {
      const x = pos[v];
      const y = pos[v + 1];
      const z = pos[v + 2];
      let nx = nor[v];
      let ny = nor[v + 1];
      let nz = nor[v + 2];
      const w = piece.weigh(x, y, z);
      const m = piece.mat(x, y, z);
      let shade = m[1];
      if (!piece.plain) {
        const a1 = Math.min(1, Math.max(0, dist(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012) / 0.012));
        const a2 = Math.min(1, Math.max(0, dist(x + nx * 0.032, y + ny * 0.032, z + nz * 0.032) / 0.032));
        shade *= 0.66 + 0.34 * (0.5 * a1 + 0.5 * a2);
      }
      let p = [x, y, z];
      if (piece.head) {
        p = warp(x, y, z);
        const q = warp(x + nx * 0.004, y + ny * 0.004, z + nz * 0.004);
        const l = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) || 1;
        nx = (q[0] - p[0]) / l;
        ny = (q[1] - p[1]) / l;
        nz = (q[2] - p[2]) / l;
      }
      out.pos.push(p[0], p[1], p[2]);
      out.nor.push(nx, ny, nz);
      let sum = 0;
      const bw = [0, 0, 0, 0];
      for (let q = 0; q < 4; q++) {
        bw[q] = Math.round(w[4 + q] * 255);
        sum += bw[q];
      }
      bw[0] += 255 - sum;
      out.si.push(w[0], w[1], w[2], w[3]);
      out.sw.push(...bw);
      out.mat.push(m[0], Math.round(Math.min(1, Math.max(0, shade * 0.5)) * 255), Math.round(m[2] * 255), m[3]);
      out.face.push(...(piece.face ? [x, y - 1.6, z] : FAR));
    }
    for (const i of piece.mesh.idx) out.idx.push(base + i);
    if (!piece.near) for (const i of piece.mesh.far) out.far.push(base + i);
  }
  const bones = frames.table.map((row) => (eyeRows[row[0]] ? [row[0], row[1], ...eyeRows[row[0]], row[5]] : row));
  const meta = {
    id: def.id, gender: def.gender, height: def.height, pace: def.pace, jog: !!def.jog, manner: def.manner, carry: def.carry || null, bag: def.bag || null,
    hat: def.hat || null, glasses: !!def.glasses, looks: def.looks, bones, verts: out.pos.length / 3, tris: out.idx.length / 3, farTris: out.far.length / 3,
  };
  if (process.env.NPC_LOG) console.log(sizes.join(' '));
  console.log(`${def.id}: ${meta.verts} vertices, ${meta.tris} / ${meta.farTris} triangles, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return { meta, out };
}

function pack(out) {
  const n = out.pos.length / 3;
  if (n > 65535) throw new Error('too many vertices for 16-bit indices');
  const nor = new Int8Array(n * 3);
  for (let i = 0; i < n * 3; i++) nor[i] = Math.round(Math.max(-1, Math.min(1, out.nor[i])) * 127);
  const face = new Int16Array(n * 3);
  for (let i = 0; i < n * 3; i++) face[i] = Math.round(Math.max(-1, Math.min(1, out.face[i] / FACE_RANGE)) * 32767);
  return {
    position: new Float32Array(out.pos), normal: nor, skinIndex: new Uint8Array(out.si), skinWeight: new Uint8Array(out.sw), mat: new Uint8Array(out.mat), face,
    index: new Uint16Array(out.idx), far: new Uint16Array(out.far),
  };
}

const want = process.argv.slice(2);
const people = [];
for (const def of CAST) {
  const key = createHash('sha1').update(JSON.stringify(def) + VERSION).digest('hex').slice(0, 12);
  const file = join(CACHE, `person-${def.id}-${key}.json`);
  let baked;
  if (existsSync(file) && !want.includes(def.id)) baked = JSON.parse(readFileSync(file, 'utf8'));
  else if (want.length && !want.includes(def.id) && !want.includes('all')) {
    console.log(`${def.id}: not baked yet, skipped`);
    continue;
  } else {
    baked = bakePerson(def);
    writeFileSync(file, JSON.stringify(baked));
  }
  people.push(baked);
}

const chunks = [];
let offset = 0;
const list = [];
for (const { meta, out } of people) {
  const blocks = pack(out);
  const where = {};
  for (const name of BLOCKS) {
    const a = blocks[name];
    const bytes = Buffer.from(a.buffer, a.byteOffset, a.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    where[name] = [offset, a.length];
    chunks.push(bytes);
    if (pad) chunks.push(Buffer.alloc(pad));
    offset += bytes.length + pad;
  }
  list.push({ ...meta, blocks: where });
}
writeFileSync(OUT + 'peds.bin', Buffer.concat(chunks));
writeFileSync(OUT + 'peds.json', JSON.stringify({ version: VERSION, people: list }));
console.log(`packed ${list.length} people, ${(offset / 1048576).toFixed(2)} MB`);
