// Costa del Gzowo: reusable building parts (frames, windows, storefronts, doors, awnings, signs, trims, roofs, fire escapes, clutter).
import * as THREE from 'three';
import { L } from './kit.js';

export const PAL = {
  coral: [0.82, 0.42, 0.34], teal: [0.27, 0.56, 0.53], mint: [0.6, 0.8, 0.68], butter: [0.92, 0.8, 0.5], peach: [0.94, 0.66, 0.52],
  sky: [0.52, 0.72, 0.84], lilac: [0.7, 0.6, 0.8], pink: [0.93, 0.6, 0.68], sand: [0.86, 0.78, 0.62], white: [0.9, 0.88, 0.83],
  cream: [0.95, 0.9, 0.78], navy: [0.12, 0.17, 0.3], deepTeal: [0.07, 0.28, 0.3], orange: [0.94, 0.45, 0.22], red: [0.62, 0.16, 0.13],
  yellow: [0.98, 0.78, 0.2], magenta: [0.78, 0.22, 0.52], green: [0.12, 0.42, 0.3], black: [0.04, 0.04, 0.045], steel: [0.62, 0.64, 0.66],
  rust: [0.42, 0.2, 0.1], wood: [0.45, 0.3, 0.18], concrete: [0.78, 0.77, 0.73], purple: [0.32, 0.18, 0.42], olive: [0.5, 0.52, 0.32],
};

export function bundle(cell) {
  const list = [cell.surface, cell.glass, cell.decal, cell.fine, cell.fineDecal];
  return {
    S: cell.surface, G: cell.glass, D: cell.decal, F: cell.fine, FD: cell.fineDecal,
    push(x, y, z, yaw = 0, pitch = 0) {
      for (const b of list) b.frame(x, y, z, yaw, pitch);
      return this;
    },
    pop() {
      for (const b of list) b.pop();
      return this;
    },
  };
}

export function placeFrame(p, face) {
  if (face === 'N') return { x: p.x0, z: p.z1, yaw: 0, W: p.x1 - p.x0, D: p.z1 - p.z0 };
  if (face === 'S') return { x: p.x1, z: p.z0, yaw: Math.PI, W: p.x1 - p.x0, D: p.z1 - p.z0 };
  if (face === 'W') return { x: p.x0, z: p.z0, yaw: -Math.PI / 2, W: p.z1 - p.z0, D: p.x1 - p.x0 };
  return { x: p.x1, z: p.z1, yaw: Math.PI / 2, W: p.z1 - p.z0, D: p.x1 - p.x0 };
}

export function eachSide(B, W, D, fn) {
  B.push(0, 0, 0, 0);
  fn('front', W);
  B.pop();
  B.push(W, 0, 0, Math.PI / 2);
  fn('right', D);
  B.pop();
  B.push(W, 0, -D, Math.PI);
  fn('back', W);
  B.pop();
  B.push(0, 0, -D, -Math.PI / 2);
  fn('left', D);
  B.pop();
}

export function spread(n, w, total, margin = 0.8) {
  const out = [];
  if (n <= 0) return out;
  const span = total - 2 * margin;
  const gap = (span - n * w) / n;
  for (let i = 0; i < n; i++) {
    const u0 = margin + gap / 2 + i * (w + gap);
    out.push([u0, u0 + w]);
  }
  return out;
}

export function room(T, kind = 0, extra = {}) {
  return { depth: kind === 0 ? 3.5 + T.random() * 2 : 6, seed: T.random(), kind, lit: kind === 0 ? (T.random() < 0.3 ? 0.6 + T.random() * 0.4 : 0) : 1, ...extra };
}

export function windowUnit(T, B, o) {
  const { S, G } = B;
  const { u0, v0, u1, v1 } = o;
  const r = o.r ?? 0.2;
  const ft = o.ft ?? 0.07;
  const frame = o.frame ?? PAL.white;
  const trim = o.trim ?? frame;
  S.reveal(u0, v0, u1, v1, r);
  S.with({ layer: L.FLAT, color: frame, wear: 0.35, rough: 0.55 }, () => {
    S.box(u0, v0, -r, u0 + ft, v1, -r + 0.07);
    S.box(u1 - ft, v0, -r, u1, v1, -r + 0.07);
    S.box(u0 + ft, v1 - ft, -r, u1 - ft, v1, -r + 0.07);
    S.box(u0 + ft, v0, -r, u1 - ft, v0 + ft, -r + 0.07);
    const split = o.split ?? 'dh';
    if (split === 'dh' || split === 'cross') {
      const vm = (v0 + v1) / 2;
      S.box(u0 + ft, vm - 0.035, -r + 0.01, u1 - ft, vm + 0.035, -r + 0.09);
    }
    if (split === 'cross' || split === 'pair') {
      const um = (u0 + u1) / 2;
      S.box(um - 0.035, v0 + ft, -r + 0.01, um + 0.035, v1 - ft, -r + 0.09);
    }
    if (split === 'grid') {
      for (let k = 1; k < 3; k++) {
        const uk = u0 + ((u1 - u0) * k) / 3;
        S.box(uk - 0.02, v0 + ft, -r + 0.02, uk + 0.02, v1 - ft, -r + 0.08);
        const vk = v0 + ((v1 - v0) * k) / 3;
        S.box(u0 + ft, vk - 0.02, -r + 0.02, u1 - ft, vk + 0.02, -r + 0.08);
      }
    }
  });
  G.pane(u0 + ft, v0 + ft, u1 - ft, v1 - ft, -r + 0.035, o.room || room(T));
  if (o.sill !== false) {
    S.with({ layer: o.sillLayer ?? L.CONCRETE, color: trim, wear: 0.7, rough: -1 }, () => {
      S.box(u0 - 0.09, v0 - 0.08, -r, u1 + 0.09, v0, 0.08);
    });
  }
  const lintel = o.lintel ?? 'flat';
  if (lintel === 'flat') S.with({ layer: o.sillLayer ?? L.CONCRETE, color: trim, wear: 0.6, rough: -1 }, () => S.box(u0 - 0.12, v1, -0.02, u1 + 0.12, v1 + 0.2, 0.05));
  else if (lintel === 'hood') {
    S.with({ layer: L.FLAT, color: trim, wear: 0.6, rough: 0.6 }, () => {
      S.push(new THREE.Matrix4().makeTranslation(u0 - 0.16, v1 + 0.04, 0));
      S.extrudeX([[0, 0.24], [0.16, 0.24], [0.16, 0.18], [0.07, 0.08], [0.07, 0], [0, 0]], 0, u1 - u0 + 0.32);
      S.pop();
    });
  } else if (lintel === 'brick') {
    S.with({ layer: L.BRICK, color: [0.85, 0.8, 0.78], wear: 0.6, rough: -1 }, () => S.box(u0 - 0.06, v1, -0.01, u1 + 0.06, v1 + 0.24, 0.02));
  }
  if (o.shutters) {
    const sw = (u1 - u0) / 2 - 0.02;
    S.with({ layer: L.SHUTTER, color: o.shutters, wear: 0.55, rough: -1 }, () => {
      S.box(u0 - sw - 0.08, v0, 0.0, u0 - 0.06, v1, 0.04);
      S.box(u1 + 0.06, v0, 0.0, u1 + sw + 0.08, v1, 0.04);
    });
    S.with({ layer: L.FLAT, color: [0.15, 0.15, 0.15], metal: 0.8, rough: 0.5 }, () => {
      S.box(u0 - 0.1, v0 + 0.2, 0.04, u0 - 0.05, v0 + 0.25, 0.06);
      S.box(u1 + 0.05, v0 + 0.2, 0.04, u1 + 0.1, v0 + 0.25, 0.06);
    });
  }
  if (o.ac) acUnit(T, B, (u0 + u1) / 2, v0 + 0.02, -r + 0.05, true);
  if (o.box) {
    S.with({ layer: L.PLANK, color: o.box, wear: 0.6, rough: -1 }, () => S.box(u0 - 0.05, v0 - 0.32, 0.08, u1 + 0.05, v0 - 0.1, 0.36));
    S.with({ layer: L.FLAT, color: [0.25, 0.5, 0.18], wear: 0.2, rough: 0.8 }, () => {
      for (let k = 0; k < 6; k++) {
        const uu = u0 + ((u1 - u0) * (k + 0.5)) / 6;
        S.box(uu - 0.07, v0 - 0.12, 0.12, uu + 0.07, v0 + 0.03 + (k % 2) * 0.06, 0.32);
      }
    });
    S.with({ layer: L.FLAT, color: [[0.95, 0.3, 0.4], [0.98, 0.85, 0.2], [0.9, 0.5, 0.9]][Math.floor(T.random() * 3)], glow: 0, rough: 0.7 }, () => {
      for (let k = 0; k < 5; k++) {
        const uu = u0 + ((u1 - u0) * (k + 0.7)) / 6;
        S.box(uu - 0.04, v0 + 0.04, 0.18, uu + 0.04, v0 + 0.11, 0.26);
      }
    });
  }
}

export function acUnit(T, B, u, v, z, window = false) {
  const { F, FD } = B;
  F.with({ layer: L.FLAT, color: [0.82, 0.8, 0.74], wear: 0.8, rough: 0.6, metal: 0.2 }, () => {
    F.box(u - 0.34, v, z - 0.05, u + 0.34, v + 0.42, z + 0.45);
  });
  F.with({ layer: L.FLAT, color: [0.3, 0.3, 0.3], wear: 0.4, rough: 0.7, metal: 0.4 }, () => {
    for (let k = 0; k < 6; k++) F.box(u - 0.3, v + 0.05 + k * 0.06, z + 0.45, u + 0.3, v + 0.08 + k * 0.06, z + 0.47);
  });
  if (window) {
    F.with({ layer: L.FLAT, color: [0.12, 0.12, 0.12], wear: 0.2, rough: 0.5, metal: 0.5 }, () => F.box(u - 0.4, v - 0.05, z, u + 0.4, v, z + 0.4));
  }
  FD.put(T.items.rust_drip, u - 0.25, v - 1.6, u + 0.25, v - 0.02, 0.012, { fade: 0.8 });
}

export function storefront(T, B, o) {
  const { S, G } = B;
  const { u0, u1 } = o;
  const h = o.h ?? 3.0;
  const r = o.r ?? 0.14;
  const frame = o.frame ?? PAL.black;
  const bulk = o.bulk ?? 0.5;
  const n = o.divs ?? Math.max(2, Math.round((u1 - u0) / 1.6));
  const step = (u1 - u0) / n;
  const tr = h - 0.5;
  const rm = o.room || room(T, o.kind ?? 1, { depth: o.depth ?? 6 });
  S.reveal(u0, 0, u1, h, r);
  S.with({ layer: o.bulkLayer ?? L.FLAT, color: o.bulkColor ?? frame, wear: 0.6, rough: 0.6 }, () => S.box(u0, -0.02, -r - 0.02, u1, bulk, -r + 0.06));
  S.with({ layer: L.FLAT, color: frame, wear: 0.3, rough: 0.4, metal: o.metal ?? 0.6 }, () => {
    for (let k = 0; k <= n; k++) {
      const u = u0 + k * step;
      S.box(u - 0.04, bulk, -r, u + 0.04, h, -r + 0.08);
    }
    S.box(u0, bulk, -r, u1, bulk + 0.06, -r + 0.08);
    S.box(u0, tr - 0.04, -r, u1, tr + 0.04, -r + 0.08);
    S.box(u0, h - 0.06, -r, u1, h, -r + 0.08);
  });
  for (let k = 0; k < n; k++) {
    const a = u0 + k * step + 0.04;
    const b = u0 + (k + 1) * step - 0.04;
    const isDoor = o.door === k;
    if (isDoor) {
      S.with({ layer: L.FLAT, color: o.doorColor ?? frame, wear: 0.4, rough: 0.45, metal: o.metal ?? 0.6 }, () => {
        S.box(a, 0, -r - 0.05, a + 0.08, tr, -r + 0.03);
        S.box(b - 0.08, 0, -r - 0.05, b, tr, -r + 0.03);
        S.box(a, 0, -r - 0.05, b, 0.22, -r + 0.03);
        S.box(a + 0.15, 1.0, -r + 0.03, b - 0.15, 1.06, -r + 0.07);
      });
      G.pane(a + 0.08, 0.22, b - 0.08, tr - 0.04, -r - 0.02, rm, [a + 0.08 - u0, 0.22, u1 - u0, h]);
    } else {
      G.pane(a, bulk + 0.06, b, tr - 0.04, -r + 0.035, rm, [a - u0, bulk + 0.06, u1 - u0, h]);
    }
    G.pane(a, tr + 0.04, b, h - 0.06, -r + 0.035, rm, [a - u0, tr + 0.04, u1 - u0, h]);
  }
  S.with({ layer: L.CONCRETE, color: [0.7, 0.68, 0.64], wear: 0.8, rough: -1 }, () => S.box(u0 - 0.05, -0.02, -r, u1 + 0.05, 0.03, 0.06));
}

export function door(T, B, o) {
  const { S, G } = B;
  const { u0, u1 } = o;
  const h = o.h ?? 2.3;
  const r = o.r ?? 0.22;
  S.reveal(u0, 0, u1, h, r);
  const color = o.color ?? PAL.red;
  S.with({ layer: o.layer ?? L.FLAT, color, wear: 0.65, rough: 0.6 }, () => {
    S.box(u0, 0, -r - 0.04, u1, h, -r + 0.02);
    if (o.panels !== false) {
      const m = 0.14;
      S.box(u0 + m, 0.2, -r + 0.02, u1 - m, h * 0.42, -r + 0.035);
      if (!o.glass) S.box(u0 + m, h * 0.5, -r + 0.02, u1 - m, h - 0.2, -r + 0.035);
    }
  });
  if (o.glass) G.pane(u0 + 0.16, h * 0.5, u1 - 0.16, h - 0.2, -r + 0.04, o.room || room(T, 0, { depth: 3 }));
  S.with({ layer: L.FLAT, color: [0.75, 0.62, 0.3], metal: 0.9, rough: 0.3 }, () => S.box(u1 - 0.17, 1.0, -r + 0.02, u1 - 0.12, 1.06, -r + 0.1));
  S.with({ layer: L.FLAT, color: o.frame ?? PAL.white, wear: 0.4, rough: 0.6 }, () => {
    S.box(u0 - 0.08, 0, -0.01, u0, h + 0.08, 0.05);
    S.box(u1, 0, -0.01, u1 + 0.08, h + 0.08, 0.05);
    S.box(u0 - 0.08, h, -0.01, u1 + 0.08, h + 0.08, 0.05);
  });
  if (o.step) S.with({ layer: L.CONCRETE, color: [0.75, 0.73, 0.7], wear: 0.8, rough: -1 }, () => S.box(u0 - 0.25, -o.step, 0, u1 + 0.25, 0, 0.45));
  if (o.lamp) wallLamp(T, B, (u0 + u1) / 2, h + 0.35);
}

export function wallLamp(T, B, u, v, cage = true) {
  const { F } = B;
  F.with({ layer: L.FLAT, color: [0.1, 0.1, 0.1], metal: 0.7, rough: 0.5 }, () => {
    F.box(u - 0.08, v - 0.12, 0, u + 0.08, v + 0.12, 0.05);
    if (cage) F.box(u - 0.1, v - 0.09, 0.05, u + 0.1, v + 0.09, 0.2);
  });
  F.with({ layer: L.FLAT, color: [1.0, 0.82, 0.55], glow: 6, channel: 14, rough: 0.3 }, () => F.box(u - 0.07, v - 0.06, 0.06, u + 0.07, v + 0.06, 0.18));
}

export function rollup(T, B, o) {
  const { S } = B;
  const { u0, u1, v1 } = o;
  const r = o.r ?? 0.2;
  const open = o.open ?? 0;
  const v0 = o.v0 ?? 0;
  S.reveal(u0, v0, u1, v1, r);
  const bottom = v0 + (v1 - v0) * open;
  S.with({ layer: L.SHUTTER, color: o.color ?? [0.7, 0.72, 0.7], wear: 0.7, rough: -1 }, () => S.box(u0, bottom, -r, u1, v1, -r + 0.04));
  S.with({ layer: L.FLAT, color: [0.15, 0.15, 0.16], wear: 0.5, rough: 0.6, metal: 0.6 }, () => {
    S.box(u0, bottom - 0.06, -r, u1, bottom, -r + 0.07);
    S.box(u0 - 0.1, v1, -0.02, u1 + 0.1, v1 + 0.45, 0.3);
  });
  if (open > 0) {
    S.with({ layer: L.FLAT, color: [0.03, 0.03, 0.035], wear: 0, rough: 0.9 }, () => S.box(u0, v0, -r - 2.5, u1, bottom, -r - 2.45));
    B.G.pane(u0 + 0.01, v0 + 0.01, u1 - 0.01, bottom - 0.01, -r - 0.05, room(T, 1, { depth: 7, lit: 0.6 }));
  }
}

export function awning(T, B, o) {
  const { S } = B;
  const { u0, u1, v } = o;
  const d = o.depth ?? 1.4;
  const drop = o.drop ?? 0.75;
  const val = o.valance ?? 0.28;
  const color = o.color ?? PAL.red;
  const layer = o.solid ? L.FLAT : L.STRIPES;
  const len = Math.hypot(d, drop);
  S.with({ layer, color, wear: 0.45, rough: 0.85 }, () => {
    const a = [u0, v, 0.02];
    const b = [u1, v, 0.02];
    const c = [u1, v - drop, d];
    const e = [u0, v - drop, d];
    S.quad(e, c, b, a, [[u0, len], [u1, len], [u1, 0], [u0, 0]]);
    S.quad(a, b, c, e, [[u0, 0], [u1, 0], [u1, len], [u0, len]]);
    S.tri([u0, v, 0.02], [u0, v - drop, d], [u0, v - drop, 0.02], [[0, 0], [d, drop], [0, drop]]);
    S.tri([u0, v, 0.02], [u0, v - drop, 0.02], [u0, v - drop, d], [[0, 0], [0, drop], [d, drop]]);
    S.tri([u1, v, 0.02], [u1, v - drop, 0.02], [u1, v - drop, d], [[0, 0], [0, drop], [d, drop]]);
    S.tri([u1, v, 0.02], [u1, v - drop, d], [u1, v - drop, 0.02], [[0, 0], [d, drop], [0, drop]]);
    const seg = Math.max(2, Math.round((u1 - u0) / 0.31));
    const vb = v - drop;
    const phase = T.random() * 6;
    for (let k = 0; k < seg; k++) {
      const ua = u0 + ((u1 - u0) * k) / seg;
      const ub = u0 + ((u1 - u0) * (k + 1)) / seg;
      const scal = o.scallop ? 0.08 : 0;
      const prev = S.paint({ phase });
      const sw = [0.05, 0.05, 0, 0];
      S.quad([ua, vb - val, d], [ub, vb - val, d], [ub, vb, d], [ua, vb, d], [[ua, val], [ub, val], [ub, 0], [ua, 0]], sw);
      S.quad([ub, vb - val, d - 0.005], [ua, vb - val, d - 0.005], [ua, vb, d - 0.005], [ub, vb, d - 0.005], [[ub, val], [ua, val], [ua, 0], [ub, 0]], sw);
      if (scal) {
        S.tri([ua, vb - val, d], [ub, vb - val, d], [(ua + ub) / 2, vb - val - scal, d], [[ua, 0], [ub, 0], [(ua + ub) / 2, 0]], [0.05, 0.05, 0.08]);
        S.tri([ub, vb - val, d - 0.005], [ua, vb - val, d - 0.005], [(ua + ub) / 2, vb - val - scal, d - 0.005], [[ub, 0], [ua, 0], [(ua + ub) / 2, 0]], [0.05, 0.05, 0.08]);
      }
      S.p = prev;
    }
  });
  S.with({ layer: L.FLAT, color: [0.2, 0.2, 0.2], metal: 0.8, rough: 0.5 }, () => {
    S.tube([[u0 + 0.05, v - 0.02, 0.02], [u0 + 0.05, v - drop, d - 0.02]], 0.015, 5);
    S.tube([[u1 - 0.05, v - 0.02, 0.02], [u1 - 0.05, v - drop, d - 0.02]], 0.015, 5);
  });
  if (o.text) B.D.put(o.text, u0 + 0.3, v - drop - val + 0.04, u1 - 0.3, v - drop - 0.03, d + 0.008);
}

export function board(T, B, o) {
  const { S, D } = B;
  const { u0, u1, v0, v1 } = o;
  const depth = o.depth ?? 0.08;
  const z = o.z ?? 0;
  if (o.frame !== false) {
    S.with({ layer: L.FLAT, color: o.frameColor ?? [0.12, 0.12, 0.12], wear: 0.5, rough: 0.5, metal: 0.4 }, () => S.box(u0, v0, z, u1, v1, z + depth));
  }
  D.put(o.item, u0 + (o.inset ?? 0.03), v0 + (o.inset ?? 0.03), u1 - (o.inset ?? 0.03), v1 - (o.inset ?? 0.03), z + depth + 0.004, { glow: o.glow ?? 0, channel: o.channel ?? 0 });
  if (o.lamps) {
    const n = Math.max(2, Math.round((u1 - u0) / 1.8));
    for (let k = 0; k < n; k++) {
      const u = u0 + ((u1 - u0) * (k + 0.5)) / n;
      B.F.with({ layer: L.FLAT, color: o.lampColor ?? [0.1, 0.25, 0.2], metal: 0.6, rough: 0.4 }, () => {
        B.F.tube([[u, v1 + 0.1, z], [u, v1 + 0.35, z + 0.15], [u, v1 + 0.32, z + 0.5]], 0.018, 5);
        B.F.cyl(u, v1 + 0.18, z + 0.55, v1 + 0.34, 0.15, 10, { r1: 0.05 });
      });
      B.F.with({ layer: L.FLAT, color: [1.0, 0.85, 0.6], glow: 5, channel: 14 }, () => B.F.cyl(u, v1 + 0.16, z + 0.55, v1 + 0.19, 0.12, 10));
    }
  }
}

export function blade(T, B, o) {
  const { u, v, w, h, item } = o;
  const t = o.t ?? 0.06;
  const out = o.out ?? 0.35;
  B.push(u, v, 0, -Math.PI / 2);
  B.S.with({ layer: L.FLAT, color: o.frameColor ?? [0.12, 0.12, 0.12], wear: 0.5, rough: 0.5, metal: 0.4 }, () => {
    B.S.box(out, 0, -t, out + w, h, t);
    B.S.tube([[0, h * 0.85, 0], [out + 0.05, h * 0.85, 0]], 0.025, 6);
    B.S.tube([[0, h * 0.15, 0], [out + 0.05, h * 0.15, 0]], 0.025, 6);
  });
  B.D.put(item, out + 0.04, 0.04, out + w - 0.04, h - 0.04, t + 0.004, { glow: o.glow ?? 0, channel: o.channel ?? 0 });
  B.pop();
  B.push(u, v, 0, -Math.PI / 2);
  B.D.frame(out + w, 0, 0, Math.PI);
  B.D.put(item, 0.04, 0.04, w - 0.04, h - 0.04, t + 0.004, { glow: o.glow ?? 0, channel: o.channel ?? 0 });
  B.D.pop();
  B.pop();
}

export function cornice(B, u0, u1, v, o = {}) {
  const s = o.scale ?? 1;
  const prof = [[0, 0.55], [0.32, 0.55], [0.32, 0.43], [0.24, 0.4], [0.2, 0.22], [0.1, 0.14], [0.1, 0], [0, 0]].map(([z, y]) => [z * s, y * s]);
  B.S.with({ layer: o.layer ?? L.FLAT, color: o.color ?? PAL.white, wear: 0.7, rough: o.layer ? -1 : 0.65 }, () => {
    B.S.push(new THREE.Matrix4().makeTranslation(0, v, 0));
    B.S.extrudeX(prof, u0, u1);
    B.S.pop();
  });
}

export function band(B, u0, u1, v, h, out, paint) {
  B.S.with({ layer: L.FLAT, wear: 0.6, rough: 0.6, ...paint }, () => B.S.box(u0, v, -0.02, u1, v + h, out));
}

export function parapetRoof(T, B, W, D, H, o = {}) {
  const { S } = B;
  const p = o.parapet ?? 0.9;
  const t = 0.22;
  S.with({ layer: o.roofLayer ?? L.GRAVEL, color: o.roofColor ?? [0.62, 0.6, 0.56], wear: 0.6, rough: -1 }, () => S.box(0, H - 0.2, -D, W, H, 0, 'ny'));
  S.with(o.wallPaint, () => {
    S.box(0, H, -t, W, H + p, 0, 'ny');
    S.box(0, H, -D, W, H + p, -D + t, 'ny');
    S.box(0, H, -D + t, t, H + p, -t, 'ny');
    S.box(W - t, H, -D + t, W, H + p, -t, 'ny');
  });
  S.with({ layer: L.CONCRETE, color: o.capColor ?? [0.86, 0.84, 0.78], wear: 0.7, rough: -1 }, () => {
    S.box(-0.05, H + p, -t - 0.02, W + 0.05, H + p + 0.08, 0.05);
    S.box(-0.05, H + p, -D - 0.05, W + 0.05, H + p + 0.08, -D + t + 0.02);
    S.box(-0.05, H + p, -D + t, t + 0.02, H + p + 0.08, -t);
    S.box(W - t - 0.02, H + p, -D + t, W + 0.05, H + p + 0.08, -t);
  });
}

export function gableRoof(T, B, W, D, H, o = {}) {
  const { S } = B;
  const rise = o.rise ?? D * 0.28;
  const over = o.over ?? 0.45;
  const ridge = H + rise;
  const zm = -D / 2;
  S.with({ layer: o.layer ?? L.TILE, color: o.tile ?? [0.95, 0.9, 0.85], wear: 0.5, rough: -1, metal: o.metal ?? 0 }, () => {
    S.quad([-over, H - over * (rise / (D / 2)), over], [W + over, H - over * (rise / (D / 2)), over], [W + over, ridge, zm], [-over, ridge, zm]);
    S.quad([W + over, H - over * (rise / (D / 2)), -D - over], [-over, H - over * (rise / (D / 2)), -D - over], [-over, ridge, zm], [W + over, ridge, zm]);
  });
  S.with({ layer: L.FLAT, color: [0.45, 0.3, 0.24], wear: 0.5, rough: 0.8 }, () => {
    S.quad([W + over, H - over * (rise / (D / 2)) - 0.02, over], [-over, H - over * (rise / (D / 2)) - 0.02, over], [-over, ridge - 0.02, zm], [W + over, ridge - 0.02, zm]);
    S.quad([-over, H - over * (rise / (D / 2)) - 0.02, -D - over], [W + over, H - over * (rise / (D / 2)) - 0.02, -D - over], [W + over, ridge - 0.02, zm], [-over, ridge - 0.02, zm]);
    S.box(-over, ridge - 0.04, zm - 0.12, W + over, ridge + 0.1, zm + 0.12);
  });
  S.with(o.wallPaint, () => {
    S.tri([0, H, 0], [0, ridge, zm], [0, H, -D]);
    S.tri([W, H, 0], [W, H, -D], [W, ridge, zm]);
  });
  S.with({ layer: L.FLAT, color: o.fascia ?? PAL.white, wear: 0.5, rough: 0.6 }, () => {
    S.box(-over, H - over * (rise / (D / 2)) - 0.2, over - 0.04, W + over, H - over * (rise / (D / 2)) + 0.02, over + 0.02);
    S.box(-over, H - over * (rise / (D / 2)) - 0.2, -D - over - 0.02, W + over, H - over * (rise / (D / 2)) + 0.02, -D - over + 0.04);
  });
  return ridge;
}

export function roofClutter(T, B, W, D, H, n = 3) {
  const { F } = B;
  for (let i = 0; i < n; i++) {
    const u = 1.2 + T.random() * (W - 2.4);
    const z = -1.2 - T.random() * (D - 2.4);
    const kind = Math.floor(T.random() * 4);
    if (kind === 0) {
      F.with({ layer: L.FLAT, color: [0.8, 0.79, 0.75], wear: 0.8, rough: 0.55, metal: 0.3 }, () => F.box(u - 0.55, H, z - 0.45, u + 0.55, H + 0.85, z + 0.45));
      F.with({ layer: L.FLAT, color: [0.15, 0.15, 0.15], rough: 0.6, metal: 0.5 }, () => F.cyl(u, H + 0.85, z, H + 0.9, 0.36, 14));
      F.with({ layer: L.FLAT, color: [0.3, 0.3, 0.3], rough: 0.6, metal: 0.6 }, () => F.tube([[u + 0.55, H + 0.3, z], [u + 1.1, H + 0.3, z], [u + 1.1, H + 0.05, z - 0.4]], 0.03, 5));
    } else if (kind === 1) {
      F.with({ layer: L.FLAT, color: [0.55, 0.56, 0.57], rough: 0.4, metal: 0.8 }, () => {
        F.cyl(u, H, z, H + 0.9, 0.13, 10);
        F.cyl(u, H + 0.9, z, H + 1.0, 0.26, 10, { r1: 0.05 });
      });
    } else if (kind === 2) {
      F.with({ layer: L.FLAT, color: [0.88, 0.88, 0.86], rough: 0.4, metal: 0.3 }, () => {
        F.tube([[u, H, z], [u, H + 1.0, z]], 0.03, 5);
        F.push(new THREE.Matrix4().makeTranslation(u, H + 1.1, z).multiply(new THREE.Matrix4().makeRotationX(-0.9)));
        F.cyl(0, -0.03, 0, 0.03, 0.42, 14);
        F.pop();
      });
    } else {
      F.with({ layer: L.FLAT, color: [0.45, 0.47, 0.48], rough: 0.7, metal: 0.4 }, () => F.box(u - 0.45, H, z - 0.45, u + 0.45, H + 0.5, z + 0.45));
      F.with({ layer: L.FLAT, color: [0.2, 0.2, 0.2], rough: 0.7, metal: 0.4 }, () => F.box(u - 0.48, H + 0.5, z - 0.48, u + 0.48, H + 0.56, z + 0.48));
    }
  }
}

export function downspout(B, u, top, out = 0.08, color = [0.85, 0.84, 0.8]) {
  B.F.with({ layer: L.FLAT, color, wear: 0.7, rough: 0.5, metal: 0.4 }, () => {
    B.F.tube([[u, top, out], [u, 0.35, out], [u, 0.12, out + 0.25]], 0.045, 6);
    for (let v = 1.0; v < top; v += 1.6) B.F.box(u - 0.06, v, 0, u + 0.06, v + 0.04, out);
  });
}

export function meters(T, B, u, v) {
  const { F } = B;
  F.with({ layer: L.FLAT, color: [0.62, 0.64, 0.6], wear: 0.8, rough: 0.5, metal: 0.6 }, () => {
    F.box(u, v, 0, u + 0.42, v + 0.55, 0.16);
    F.box(u + 0.55, v + 0.05, 0, u + 0.85, v + 0.45, 0.14);
    F.tube([[u + 0.2, v + 0.55, 0.06], [u + 0.2, v + 3.5, 0.06]], 0.025, 5);
  });
  F.with({ layer: L.FLAT, color: [0.85, 0.9, 0.95], rough: 0.1, metal: 0 }, () => F.cyl(u + 0.21, v + 0.3, 0.16, v + 0.31, 0.1, 10).box(u + 0.6, v + 0.2, 0.14, u + 0.8, v + 0.35, 0.145));
  F.with({ layer: L.FLAT, color: [0.9, 0.75, 0.15], rough: 0.5, metal: 0.3 }, () => F.tube([[u + 1.05, 0, 0.08], [u + 1.05, v + 0.25, 0.08], [u + 0.85, v + 0.25, 0.08]], 0.03, 5));
}

export function fireEscape(T, B, u0, u1, floors, ground, upper) {
  const { F } = B;
  const dark = { layer: L.FLAT, color: [0.1, 0.1, 0.1], wear: 0.6, rough: 0.55, metal: 0.7 };
  F.with(dark, () => {
    for (let f = 1; f < floors; f++) {
      const v = ground + (f - 1) * upper - 0.08;
      F.box(u0, v, 0.02, u1, v + 0.05, 1.15);
      for (let x = u0; x <= u1 + 0.01; x += 0.12) F.box(x, v + 0.05, 1.1, x + 0.018, v + 1.0, 1.13);
      F.box(u0, v + 0.98, 1.08, u1, v + 1.03, 1.15);
      F.box(u0, v + 0.98, 0.02, u0 + 0.04, v + 1.03, 1.15);
      F.box(u1 - 0.04, v + 0.98, 0.02, u1, v + 1.03, 1.15);
      for (let z = 0.1; z < 1.1; z += 0.12) {
        F.box(u0, v + 0.05, z, u0 + 0.018, v + 1.0, z + 0.018);
        F.box(u1 - 0.018, v + 0.05, z, u1, v + 1.0, z + 0.018);
      }
      if (f < floors - 1) {
        const a = [u0 + 0.3, v + 0.05, 0.6];
        const b = [u1 - 0.4, v + upper, 0.6];
        const n = 12;
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          F.box(a[0] + (b[0] - a[0]) * t - 0.1, a[1] + (b[1] - a[1]) * t - 0.02, 0.15, a[0] + (b[0] - a[0]) * t + 0.1, a[1] + (b[1] - a[1]) * t, 1.05);
        }
        F.tube([[a[0], a[1], 0.12], [b[0], b[1], 0.12]], 0.025, 4);
        F.tube([[a[0], a[1], 1.08], [b[0], b[1], 1.08]], 0.025, 4);
        F.tube([[a[0], a[1] + 0.9, 1.08], [b[0], b[1] + 0.9, 1.08]], 0.02, 4);
      } else if (f === floors - 1 && floors > 1) {
        F.box(u1 - 0.45, v - 2.4, 0.95, u1 - 0.42, v, 0.98);
        F.box(u1 - 0.05, v - 2.4, 0.95, u1 - 0.02, v, 0.98);
        for (let y = v - 2.3; y < v; y += 0.3) F.box(u1 - 0.45, y, 0.95, u1 - 0.02, y + 0.025, 0.98);
      }
    }
  });
}
