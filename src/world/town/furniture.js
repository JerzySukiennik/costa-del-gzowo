// Costa del Gzowo: Gzowo Springs street furniture (lamps, signals, signs, meters, poles and wires, bunting, gas station, park, palms, hill letters, physics props).
import * as THREE from 'three';
import { TOWN } from '../../config.js';
import { GROUPS, groups } from '../../core/physics.js';
import { heightAt as worldHeightAt } from '../heightfield.js';
import { TOWN_OFFSET } from './space.js';

const heightAt = (x, z) => worldHeightAt(x + TOWN_OFFSET.x, z + TOWN_OFFSET.z);
import { variantsOf, instancedVariant } from '../scatter.js';
import { L, Surface, CHANNELS } from './kit.js';
import { CROSS, PLAZA, streetY } from './layout.js';
import { PAL } from './parts.js';

const W = TOWN.walk;
const IRON = { layer: L.FLAT, color: [0.05, 0.08, 0.07], wear: 0.4, rough: 0.45, metal: 0.6 };
const GALV = { layer: L.FLAT, color: [0.55, 0.57, 0.58], wear: 0.5, rough: 0.45, metal: 0.85 };

function catenary(a, b, sag, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

export async function buildFurniture(T) {
  const { ctx, physics } = T;
  const I = T.items;
  const R = physics.RAPIER;
  const meshes = [];
  const at = (x, z) => T.cell(x, z);

  function lamp(x, z, banner = null, side = 1) {
    const F = at(x, z).fine;
    const y = W;
    F.with(IRON, () => {
      F.cyl(x, y, z, y + 0.55, 0.19, 12, { r1: 0.14 });
      F.cyl(x, y + 0.55, z, y + 0.7, 0.14, 12, { r1: 0.09 });
      F.cyl(x, y + 0.7, z, y + 4.1, 0.075, 10, { r1: 0.055 });
      F.cyl(x, y + 2.6, z, y + 2.7, 0.09, 10);
      F.cyl(x, y + 4.1, z, y + 4.25, 0.11, 10, { r1: 0.16 });
      F.cyl(x, y + 4.85, z, y + 5.05, 0.2, 10, { r1: 0.03 });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        F.box(x + Math.cos(a) * 0.15 - 0.012, y + 4.25, z + Math.sin(a) * 0.15 - 0.012, x + Math.cos(a) * 0.15 + 0.012, y + 4.85, z + Math.sin(a) * 0.15 + 0.012);
      }
    });
    F.with({ layer: L.FLAT, color: [1.0, 0.84, 0.6], glow: 5.5, channel: CHANNELS.LAMP, rough: 0.2 }, () => F.cyl(x, y + 4.28, z, y + 4.82, 0.13, 10, { r1: 0.16 }));
    T.post(x, y - 0.3, y + 4.2, z, 0.12);
    if (banner) {
      F.with(IRON, () => {
        F.tube([[x, y + 3.4, z], [x, y + 3.4, z + side * 0.75]], 0.02, 5);
        F.tube([[x, y + 2.3, z], [x, y + 2.3, z + side * 0.75]], 0.02, 5);
      });
      const D = at(x, z).fineDecal;
      const z0 = z + side * 0.08;
      const z1 = z + side * 0.72;
      D.quad(banner, [[x + 0.01, y + 2.3, z0], [x + 0.01, y + 2.3, z1], [x + 0.01, y + 3.38, z1], [x + 0.01, y + 3.38, z0]], { uv: side > 0 ? [0, 0, 1, 1] : [1, 0, 0, 1], sway: [0.02, 0.12, 0.08, 0.0] });
      D.quad(banner, [[x - 0.01, y + 2.3, z1], [x - 0.01, y + 2.3, z0], [x - 0.01, y + 3.38, z0], [x - 0.01, y + 3.38, z1]], { uv: side > 0 ? [0, 0, 1, 1] : [1, 0, 0, 1], sway: [0.12, 0.02, 0.0, 0.08] });
    }
  }

  function signalHead(F, x, y, z, yaw, prefix) {
    F.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
    F.with({ layer: L.FLAT, color: [0.85, 0.65, 0.12], wear: 0.6, rough: 0.5, metal: 0.3 }, () => F.box(-0.2, -0.55, -0.15, 0.2, 0.55, 0.12));
    F.with({ layer: L.FLAT, color: [0.05, 0.05, 0.05], rough: 0.6 }, () => {
      F.box(-0.32, -0.62, -0.17, 0.32, 0.62, -0.15);
      for (const v of [0.34, 0, -0.34]) F.box(-0.15, v + 0.13, 0.12, 0.15, v + 0.16, 0.36);
    });
    const lens = [[0.34, [0.9, 0.08, 0.05], prefix + '_R'], [0, [1.0, 0.6, 0.05], prefix + '_Y'], [-0.34, [0.1, 0.95, 0.5], prefix + '_G']];
    for (const [v, c, ch] of lens) F.with({ layer: L.FLAT, color: c.map((k) => k * 0.25), glow: 0, rough: 0.15 }, () => F.cyl(0, v - 0.005, 0.13, v + 0.005, 0.13, 14));
    for (const [v, c, ch] of lens) {
      F.push(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      F.with({ layer: L.FLAT, color: c, glow: 9, channel: CHANNELS[ch], rough: 0.15 }, () => F.cyl(0, -0.14, -v, -0.13, 0.125, 14, { caps: true }));
      F.pop();
    }
    F.pop();
  }

  function mastArm(x, z, dir, length, heads, prefix, headYaw) {
    const F = at(x, z).fine;
    F.with({ layer: L.FLAT, color: [0.42, 0.44, 0.45], wear: 0.5, rough: 0.45, metal: 0.8 }, () => {
      F.cyl(x, W, z, W + 0.4, 0.25, 12, { r1: 0.2 });
      F.cyl(x, W + 0.4, z, W + 6.8, 0.15, 12, { r1: 0.11 });
      const end = [x + dir[0] * length, W + 6.3, z + dir[1] * length];
      F.tube([[x, W + 6.3, z], end], 0.08, 8);
      F.tube([[x, W + 5.1, z], [x + dir[0] * length * 0.45, W + 6.25, z + dir[1] * length * 0.45]], 0.035, 6);
    });
    for (const k of heads) signalHead(F, x + dir[0] * k, W + 5.75, z + dir[1] * k, headYaw, prefix);
    T.post(x, W - 0.4, W + 6.8, z, 0.18);
    const D = at(x, z).fineDecal;
    F.with({ layer: L.FLAT, color: [0.05, 0.05, 0.05], rough: 0.5 }, () => F.box(x - 0.18, W + 2.55, z - 0.18, x + 0.18, W + 3.15, z + 0.18));
    for (const [ux, uz, yaw] of [[0, 0.181, 0], [0, -0.181, Math.PI], [0.181, 0, Math.PI / 2], [-0.181, 0, -Math.PI / 2]]) {
      D.frame(x + ux, W + 2.6, z + uz, yaw);
      D.put(I.walk, -0.15, 0.27, 0.15, 0.53, 0.002, { glow: 3.5, channel: CHANNELS.WALK });
      D.put(I.dont, -0.15, 0.0, 0.15, 0.26, 0.002, { glow: 3.5, channel: CHANNELS.DONT });
      D.pop();
    }
  }

  function signPost(x, z, items, h = 2.3) {
    const F = at(x, z).fine;
    const y = W;
    F.with(GALV, () => F.box(x - 0.03, y - 0.2, z - 0.03, x + 0.03, y + h + 0.9, z + 0.03));
    T.post(x, y - 0.3, y + h, z, 0.05);
    for (const s of items) {
      const D = at(x, z).fineDecal;
      const w = s.w;
      const hh = w / s.item.aspect;
      D.frame(x, y + (s.h ?? h), z, s.yaw);
      F.frame(x, y + (s.h ?? h), z, s.yaw);
      F.with({ layer: L.FLAT, color: [0.6, 0.62, 0.62], metal: 0.7, rough: 0.5 }, () => F.box(-w / 2, -hh / 2, 0.035, w / 2, hh / 2, 0.045));
      D.put(s.item, -w / 2, -hh / 2, w / 2, hh / 2, 0.047);
      F.pop();
      D.pop();
    }
  }

  const mainBanners = [I.fest_banner, I.fest_banner_b];
  const north = [271, 285.5, 311, 324, 337.5, 357, 371, 385];
  const south = [280, 311, 324.5, 337.5, 357, 371, 385];
  north.forEach((x, i) => lamp(x, 7.6, x > 300 ? mainBanners[i % 2] : null, 1));
  south.forEach((x, i) => lamp(x, -7.6, x > 300 ? mainBanners[(i + 1) % 2] : null, -1));
  for (const [x, zs] of [[295.45, [18, 36, 56, -14, -40, -58]], [304.55, [18, 40, 58, -16, -40, -58]], [341.45, [18, 40, 58, -16, -38, -58]], [350.55, [18, 34, 58, -16, -40, -58]]]) for (const z of zs) lamp(x, z);

  const palm = CROSS[0].x;
  mastArm(palm + 4.9, 8.0, [0, -1], 7.0, [2.6, 5.4], 'MAIN', -Math.PI / 2);
  mastArm(palm - 4.9, -8.0, [0, 1], 7.0, [2.6, 5.4], 'MAIN', Math.PI / 2);
  mastArm(palm - 4.9, 8.0, [1, 0], 7.0, [2.2, 4.4], 'CROSS', Math.PI);
  mastArm(palm + 4.9, -8.0, [-1, 0], 7.0, [2.2, 4.4], 'CROSS', 0);
  const rocketX = CROSS[1].x;
  signPost(rocketX - 4.7, -10.0, [{ item: I.stop, w: 0.76, yaw: Math.PI, h: 2.2 }, { item: I.sign_rocket, w: 0.9, yaw: Math.PI / 2, h: 3.15 }, { item: I.sign_main, w: 0.9, yaw: 0, h: 3.35 }]);
  signPost(rocketX + 4.7, 10.0, [{ item: I.stop, w: 0.76, yaw: 0, h: 2.2 }, { item: I.sign_rocket, w: 0.9, yaw: -Math.PI / 2, h: 3.15 }]);
  signPost(palm + 4.6, 10.3, [{ item: I.sign_palm, w: 0.9, yaw: Math.PI / 2, h: 3.2 }, { item: I.sign_main, w: 0.9, yaw: Math.PI, h: 3.4 }]);
  signPost(265.2, 7.6, [{ item: I.speed25, w: 0.6, yaw: -Math.PI / 2, h: 2.0 }]);
  signPost(289.2, 9.9, [{ item: I.busstop, w: 0.5, yaw: -Math.PI / 2, h: 2.2 }]);
  signPost(293.6, 38.8, [{ item: I.parking, w: 0.55, yaw: Math.PI / 2, h: 2.0 }]);
  for (const c of CROSS) for (const s of [-1, 1]) signPost(c.x + s * 4.6, s * 64.5, [{ item: I.deadend, w: 0.7, yaw: s > 0 ? Math.PI : 0, h: 1.8 }]);
  signPost(318, -9.9, [{ item: I.noparking, w: 0.45, yaw: 0, h: 2.0 }]);
  signPost(360, 9.9, [{ item: I.xing, w: 0.6, yaw: -Math.PI / 2, h: 2.2 }]);

  for (const c of CROSS) {
    for (const s of [-1]) {
      const F = at(c.x, s * 65).fine;
      F.with({ layer: L.FLAT, color: [0.95, 0.95, 0.92], wear: 0.5, rough: 0.5, metal: 0.4 }, () => F.box(c.x - 4.2, streetY(c.x, s * 65.6) + 0.5, s * 65.6 - 0.1, c.x + 4.2, streetY(c.x, s * 65.6) + 0.85, s * 65.6 + 0.1));
      F.with({ layer: L.SHUTTER, color: [0.9, 0.3, 0.1], wear: 0.5, rough: -1 }, () => {
        for (let k = 0; k < 6; k++) F.box(c.x - 4.0 + k * 1.4, streetY(c.x, s * 65.6) + 0.52, s * 65.6 - s * 0.11, c.x - 3.3 + k * 1.4, streetY(c.x, s * 65.6) + 0.83, s * 65.6 - s * 0.12);
      });
      F.with(GALV, () => { for (const dx of [-4, 0, 4]) F.box(c.x + dx - 0.05, TOWN.ground - 0.3, s * 65.7 - 0.05, c.x + dx + 0.05, streetY(c.x, s * 65.6) + 0.85, s * 65.7 + 0.05); });
      T.box(c.x - 4.3, c.x + 4.3, TOWN.ground - 0.3, TOWN.ground + 1.0, s * 65.6 - 0.12, s * 65.6 + 0.12, 'metal');
    }
  }

  function hydrant(x, z) {
    const F = at(x, z).fine;
    F.with({ layer: L.FLAT, color: [0.95, 0.75, 0.1], wear: 0.7, rough: 0.5, metal: 0.3 }, () => {
      F.cyl(x, W, z, W + 0.08, 0.16, 12);
      F.cyl(x, W + 0.08, z, W + 0.6, 0.11, 12);
      F.cyl(x, W + 0.6, z, W + 0.75, 0.13, 12, { r1: 0.05 });
      F.cyl(x, W + 0.75, z, W + 0.8, 0.03, 6);
      F.push(new THREE.Matrix4().makeTranslation(x, W + 0.45, z).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)));
      F.cyl(0, -0.2, 0, 0.2, 0.05, 8);
      F.pop();
      F.push(new THREE.Matrix4().makeTranslation(x, W + 0.42, z).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      F.cyl(0, -0.19, 0, 0.0, 0.065, 8);
      F.pop();
    });
    T.post(x, W - 0.2, W + 0.8, z, 0.14);
  }
  [[289.8, 7.6], [318.2, -7.6], [361.5, 7.6], [380.4, -7.6], [304.6, 30.5], [341.4, -33]].forEach(([x, z]) => hydrant(x, z));

  function meter(x, z) {
    const F = at(x, z).fine;
    F.with(GALV, () => {
      F.cyl(x, W, z, W + 1.05, 0.035, 8);
      F.box(x - 0.11, W + 1.05, z - 0.08, x + 0.11, W + 1.38, z + 0.08);
      F.cyl(x, W + 1.38, z, W + 1.46, 0.1, 10, { r1: 0.05 });
    });
    F.with({ layer: L.FLAT, color: [0.15, 0.2, 0.22], rough: 0.08, metal: 0.2 }, () => {
      F.box(x - 0.08, W + 1.17, z - 0.085, x + 0.08, W + 1.32, z + 0.085);
    });
    T.post(x, W - 0.2, W + 1.4, z, 0.06);
  }
  const avoid = [...north, ...south, 289.8, 318.2, 361.5, 380.4, 265.2, 289.2];
  for (const [a, b] of [[264, 296], [304, 342], [350, 392]]) {
    for (let x = a + 3.4; x < b - 2; x += 6.2) {
      for (const s of [-1, 1]) {
        if (s < 0 && a === 264 && ((x > 266.5 && x < 275.5) || (x > 284.5 && x < 293.5) || x > 291)) continue;
        if (avoid.some((v) => Math.abs(v - x) < 0.9)) continue;
        meter(x, s * 7.38);
      }
    }
  }

  function bench(x, z, yaw, color = [0.36, 0.22, 0.12]) {
    const F = at(x, z).fine;
    F.frame(x, W, z, yaw);
    F.with(IRON, () => {
      for (const u of [-0.7, 0.7]) {
        F.box(u - 0.03, 0, -0.25, u + 0.03, 0.45, 0.25);
        F.box(u - 0.03, 0.45, -0.3, u + 0.03, 0.9, -0.24);
      }
    });
    F.with({ layer: L.PLANK, color, wear: 0.5, rough: -1 }, () => {
      for (let k = 0; k < 4; k++) F.box(-0.9, 0.42, -0.25 + k * 0.13, 0.9, 0.46, -0.25 + k * 0.13 + 0.1);
      for (let k = 0; k < 3; k++) F.box(-0.9, 0.55 + k * 0.13, -0.3, 0.9, 0.65 + k * 0.13, -0.26);
    });
    F.pop();
    T.collider(R.ColliderDesc.cuboid(0.9, 0.3, 0.3).setTranslation(x, W + 0.3, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)), 'wood');
  }
  bench(283.5, 9.9, Math.PI);
  bench(372.5, 9.9, Math.PI);
  bench(333.5, -9.85, 0);
  bench(356.5, -9.85, 0);

  {
    const F = at(287.5, 9.9).fine;
    F.with({ layer: L.FLAT, color: [0.1, 0.32, 0.26], wear: 0.4, rough: 0.4, metal: 0.6 }, () => {
      for (const u of [286.2, 290.2]) F.box(u - 0.05, W, 9.8, u + 0.05, W + 2.6, 10.3);
      F.box(286.0, W + 2.6, 8.7, 290.4, W + 2.7, 10.4);
      F.box(286.0, W + 2.1, 10.25, 290.4, W + 2.6, 10.3);
    });
    at(287.5, 9.9).glass.pane(286.25, W + 0.15, 290.15, W + 2.05, 0, { depth: 0.2, seed: 0.4, kind: 2, lit: 0 });
    bench(288.2, 10.0, Math.PI, [0.1, 0.32, 0.26]);
    T.box(286.0, 290.4, W, W + 2.7, 10.2, 10.35, 'metal');
  }

  function cafe(x, z, color) {
    const F = at(x, z).fine;
    F.with({ layer: L.FLAT, color: [0.92, 0.92, 0.9], rough: 0.35, metal: 0.6 }, () => {
      F.cyl(x, W, z, W + 0.03, 0.25, 12);
      F.cyl(x, W, z, W + 0.72, 0.03, 8);
      F.cyl(x, W + 0.72, z, W + 0.76, 0.38, 16);
      F.cyl(x, W + 0.76, z, W + 2.35, 0.022, 6);
      for (let k = 0; k < 2; k++) {
        const cx = x + (k ? 0.62 : -0.62);
        F.box(cx - 0.2, W + 0.44, z - 0.2, cx + 0.2, W + 0.48, z + 0.2);
        for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) F.box(cx + dx - 0.015, W, z + dz - 0.015, cx + dx + 0.015, W + 0.44, z + dz + 0.015);
        const bx = k ? cx + 0.19 : cx - 0.19;
        F.box(bx - 0.02, W + 0.48, z - 0.2, bx + 0.02, W + 0.9, z + 0.2);
      }
    });
    F.with({ layer: L.STRIPES, color, wear: 0.3, rough: 0.85, sway: 0.0 }, () => {
      const n = 8;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        const r = 1.25;
        const top = [x, W + 2.4, z];
        const p0 = [x + Math.cos(a0) * r, W + 1.95, z + Math.sin(a0) * r];
        const p1 = [x + Math.cos(a1) * r, W + 1.95, z + Math.sin(a1) * r];
        const prev = F.paint({ color: k % 2 ? [0.92, 0.9, 0.84] : color });
        F.tri(top, p1, p0, [[0, 0], [1, 1], [0, 1]], [0, 0.03, 0.03]);
        F.tri(top, p0, p1, [[0, 0], [0, 1], [1, 1]], [0, 0.03, 0.03]);
        F.p = prev;
      }
    });
    T.post(x, W, W + 0.8, z, 0.3);
  }
  cafe(268.6, 9.2, PAL.teal);
  cafe(274.6, 9.2, PAL.orange);
  cafe(278.0, 9.3, PAL.teal);
  {
    const F = at(272, 9.9).fine;
    F.frame(276.6, W, 8.3, 0.3);
    F.with({ layer: L.PLANK, color: [0.4, 0.27, 0.16], wear: 0.4, rough: -1 }, () => {
      F.quad([-0.3, 0, 0.25], [0.3, 0, 0.25], [0.3, 0.95, 0.02], [-0.3, 0.95, 0.02]);
      F.quad([0.3, 0, -0.25], [-0.3, 0, -0.25], [-0.3, 0.95, -0.02], [0.3, 0.95, -0.02]);
    });
    F.pop();
    const D = at(272, 9.9).fineDecal;
    D.frame(276.6, W, 8.3, 0.3);
    D.quad(I.menu_board, [[-0.26, 0.06, 0.24], [0.26, 0.06, 0.24], [0.26, 0.9, 0.035], [-0.26, 0.9, 0.035]].map((p) => [p[0], p[1], p[2] + 0.006]));
    D.pop();
  }

  const C = at(278, -16);
  {
    const S = C.surface;
    const F = C.fine;
    const y0 = 4.3;
    S.with({ layer: L.FLAT, color: [0.95, 0.95, 0.96], wear: 0.4, rough: 0.5, metal: 0.2 }, () => S.box(266.5, y0 + 4.9, -21.0, 289.5, y0 + 5.6, -11.0));
    S.with({ layer: L.FLAT, color: [0.06, 0.37, 0.66], wear: 0.4, rough: 0.5 }, () => {
      S.box(266.4, y0 + 5.15, -21.1, 289.6, y0 + 5.35, -10.9);
    });
    S.with({ layer: L.FLAT, color: [0.98, 0.82, 0.12], wear: 0.4, rough: 0.5 }, () => S.box(266.38, y0 + 4.9, -21.12, 289.62, y0 + 5.0, -10.88));
    C.decal.frame(278, y0 + 5.25, -10.88, 0);
    C.decal.put(I.sign_gas, -4.4, -0.32, 4.4, 0.32, 0.01);
    C.decal.pop();
    C.decal.frame(278, y0 + 5.25, -21.12, Math.PI);
    C.decal.put(I.sign_gas, -4.4, -0.32, 4.4, 0.32, 0.01);
    C.decal.pop();
    S.with({ layer: L.FLAT, color: [1.0, 0.95, 0.85], glow: 4.5, channel: CHANNELS.LAMP }, () => {
      for (const x of [270, 274, 278, 282, 286]) for (const z of [-18.5, -13.5]) S.box(x - 0.8, y0 + 4.88, z - 0.3, x + 0.8, y0 + 4.9, z + 0.3);
    });
    for (const [x, z] of [[270, -16], [286, -16]]) {
      S.with({ layer: L.FLAT, color: [0.95, 0.95, 0.96], wear: 0.5, rough: 0.5 }, () => S.box(x - 0.22, y0, z - 0.22, x + 0.22, y0 + 4.9, z + 0.22));
      T.box(x - 0.25, x + 0.25, y0, y0 + 5.6, z - 0.25, z + 0.25);
    }
    T.box(266.5, 289.5, y0 + 4.9, y0 + 5.6, -21.0, -11.0, 'metal');
    for (const cx of [273, 283]) {
      F.with({ layer: L.CONCRETE, color: [0.82, 0.8, 0.76], wear: 0.6, rough: -1 }, () => F.box(cx - 3.0, y0, -16.6, cx + 3.0, y0 + 0.18, -15.4));
      T.box(cx - 3.0, cx + 3.0, y0, y0 + 0.18, -16.6, -15.4);
      for (const px of [cx - 1.4, cx + 1.4]) {
        F.with({ layer: L.FLAT, color: [0.92, 0.94, 0.95], wear: 0.5, rough: 0.4, metal: 0.3 }, () => F.box(px - 0.38, y0 + 0.18, -16.25, px + 0.38, y0 + 1.85, -15.75));
        F.with({ layer: L.FLAT, color: [0.06, 0.37, 0.66], wear: 0.5, rough: 0.4 }, () => F.box(px - 0.4, y0 + 1.85, -16.3, px + 0.4, y0 + 2.15, -15.7));
        F.with({ layer: L.FLAT, color: [0.1, 0.1, 0.1], rough: 0.6 }, () => {
          F.tube([[px + 0.4, y0 + 1.4, -16.0], [px + 0.55, y0 + 1.0, -16.0], [px + 0.5, y0 + 0.5, -16.0]], 0.02, 5);
          F.box(px + 0.38, y0 + 0.9, -16.08, px + 0.46, y0 + 1.25, -15.92);
        });
        for (const [zz, yaw] of [[-15.74, 0], [-16.26, Math.PI]]) {
          C.fineDecal.frame(px, y0 + 0.18, zz, yaw);
          C.fineDecal.put(I.pump_face, -0.34, 0.6, 0.34, 1.62, 0.003);
          C.fineDecal.pop();
        }
        T.box(px - 0.4, px + 0.4, y0, y0 + 2.15, -16.3, -15.7, 'metal');
      }
      for (const bx of [cx - 2.8, cx + 2.8]) {
        F.with({ layer: L.FLAT, color: [0.98, 0.8, 0.1], wear: 0.6, rough: 0.5 }, () => F.cyl(bx, y0 + 0.18, -16, y0 + 1.2, 0.09, 10));
        T.post(bx, y0, y0 + 1.2, -16, 0.1);
      }
    }
    F.with({ layer: L.FLAT, color: [0.3, 0.3, 0.32], wear: 0.5, rough: 0.5, metal: 0.7 }, () => F.box(263.1, y0 - 0.3, -12.7, 263.4, y0 + 6.2, -12.4));
    F.with({ layer: L.FLAT, color: [0.06, 0.37, 0.66], wear: 0.4, rough: 0.5 }, () => F.box(262.95, y0 + 3.0, -13.6, 263.55, y0 + 6.4, -11.5));
    for (const [xx, yaw] of [[262.94, -Math.PI / 2], [263.56, Math.PI / 2]]) {
      C.fineDecal.frame(xx, y0 + 3.0, -12.55, yaw);
      C.fineDecal.put(I.gas_price, -1.0, 0.05, 1.0, 2.55, 0.003);
      C.fineDecal.pop();
    }
    T.box(262.9, 263.6, y0 - 0.3, y0 + 6.4, -13.6, -11.5, 'metal');
    F.with({ layer: L.FLAT, color: [0.85, 0.15, 0.12], wear: 0.6, rough: 0.5, metal: 0.4 }, () => F.box(290.6, y0, -21.6, 291.2, y0 + 1.3, -21.1));
    F.with({ layer: L.FLAT, color: [0.1, 0.1, 0.1], rough: 0.5 }, () => F.tube([[290.9, y0 + 1.0, -21.1], [291.4, y0 + 0.4, -20.6], [291.2, y0 + 0.1, -20.2]], 0.02, 5));
    T.box(290.6, 291.2, y0, y0 + 1.3, -21.6, -21.1, 'metal');
    const tube = new Surface();
    tube.paint({ layer: L.FLAT, color: [1.0, 0.35, 0.6], wear: 0.1, rough: 0.6 });
    const tx = 292.6;
    const tz = -12.6;
    for (let k = 0; k < 14; k++) {
      const h0 = 0.6 + k * 0.3;
      tube.paint({ sway: 0.12 * k * k / 14, phase: 1.7 });
      tube.cyl(tx, y0 + h0, tz, y0 + h0 + 0.3, 0.28 - k * 0.006, 10, { caps: false });
    }
    tube.paint({ color: [1.0, 0.9, 0.2], sway: 0.0 });
    tube.cyl(tx, y0, tz, y0 + 0.6, 0.4, 12, { r1: 0.32 });
    tube.paint({ color: [0.1, 0.1, 0.1], sway: 1.4 });
    tube.cyl(tx - 0.12, y0 + 4.2, tz + 0.25, y0 + 4.35, 0.06, 6);
    tube.cyl(tx + 0.12, y0 + 4.2, tz + 0.25, y0 + 4.35, 0.06, 6);
    for (const s of [-1, 1]) {
      tube.paint({ color: [1.0, 0.35, 0.6], sway: 0.9 });
      tube.tube([[tx + s * 0.25, y0 + 3.3, tz], [tx + s * 0.9, y0 + 3.9, tz], [tx + s * 1.3, y0 + 4.5, tz + 0.2]], 0.1, 6);
    }
    const tm = new THREE.Mesh(tube.geometry(), T.mats.surface);
    tm.castShadow = true;
    tm.receiveShadow = true;
    tm.matrixAutoUpdate = false;
    meshes.push(tm);
    T.post(tx, y0, y0 + 4.4, tz, 0.35, 'plastic');
  }

  {
    const x = 364.6;
    const z = -9.6;
    const F = at(x, z).fine;
    const S = at(x, z).surface;
    S.with({ layer: L.FLAT, color: [0.06, 0.54, 0.52], wear: 0.5, rough: 0.5, metal: 0.4 }, () => {
      S.cyl(x, W, z, W + 8.4, 0.16, 12);
      S.box(x - 1.9, W + 6.0, z - 0.14, x + 1.9, W + 8.0, z + 0.14);
      S.box(x - 1.6, W + 4.9, z - 0.1, x + 1.6, W + 5.8, z + 0.1);
    });
    for (const [zz, yaw] of [[z + 0.141, 0], [z - 0.141, Math.PI]]) {
      const D = at(x, z).decal;
      D.frame(x, W, zz, yaw);
      D.put(I.sign_motel, -1.85, 6.05, 1.85, 7.95, 0.003);
      D.put(I.neon_vacancy, -1.5, 4.95, 1.5, 5.75, -0.037, { glow: 3.2, channel: CHANNELS.BLINK });
      D.put(I.arrow_motel, -1.9, 8.1, 1.9, 9.1, 0.0, { glow: 3.5, channel: CHANNELS.CHASE_A });
      D.pop();
    }
    F.with(IRON, () => F.box(x - 1.95, W + 8.05, z - 0.03, x + 1.95, W + 8.1, z + 0.03));
    T.post(x, W - 0.3, W + 8.4, z, 0.2);
  }

  {
    const x = 259.2;
    const z = 13.2;
    const S = at(x + 8, z).surface;
    const y = heightAt(x, z);
    S.with({ layer: L.CONCRETE, color: [0.84, 0.8, 0.72], wear: 0.6, rough: -1 }, () => {
      S.box(x - 0.4, y - 0.3, z - 3.0, x + 0.4, y + 0.7, z + 3.0);
      S.box(x - 0.25, y + 0.7, z - 2.9, x + 0.25, y + 3.35, z - 2.5);
      S.box(x - 0.25, y + 0.7, z + 2.5, x + 0.25, y + 3.35, z + 2.9);
      S.box(x - 0.3, y + 3.35, z - 3.05, x + 0.3, y + 3.6, z + 3.05);
    });
    S.with({ layer: L.FLAT, color: [0.2, 0.2, 0.2], rough: 0.6 }, () => S.box(x - 0.1, y + 0.75, z - 2.5, x + 0.1, y + 3.3, z + 2.5));
    const D = at(x + 8, z).decal;
    D.frame(x - 0.101, y + 0.75, z, -Math.PI / 2);
    D.put(I.welcome, -2.48, 0.0, 2.48, 2.55, 0.0);
    D.pop();
    D.frame(x + 0.101, y + 0.75, z, Math.PI / 2);
    D.put(I.welcome, -2.48, 0.0, 2.48, 2.55, 0.0);
    D.pop();
    const F = at(x + 8, z).fine;
    for (let k = 0; k < 40; k++) {
      const fx = x - 1.2 + T.random() * 2.4;
      const fz = z - 3.4 + T.random() * 6.8;
      F.with({ layer: L.FLAT, color: [0.18, 0.42, 0.14], rough: 0.8 }, () => F.box(fx - 0.12, y - 0.1, fz - 0.12, fx + 0.12, y + 0.22, fz + 0.12));
      F.with({ layer: L.FLAT, color: [[0.98, 0.3, 0.45], [1.0, 0.75, 0.15], [0.95, 0.5, 0.9], [1, 1, 1]][k % 4], rough: 0.7 }, () => F.box(fx - 0.06, y + 0.22, fz - 0.06, fx + 0.06, y + 0.3, fz + 0.06));
    }
    T.box(x - 0.4, x + 0.4, y - 0.3, y + 3.6, z - 3.05, z + 3.05);
  }

  {
    const x = 250;
    const z = -24;
    const y = heightAt(x, z);
    const S = at(262, z).surface;
    S.with({ layer: L.FLAT, color: [0.3, 0.3, 0.3], wear: 0.6, rough: 0.5, metal: 0.7 }, () => {
      for (const dz of [-3.2, 3.2]) S.box(x - 0.15, y - 0.5, z + dz - 0.15, x + 0.15, y + 6.0, z + dz + 0.15);
      S.box(x - 0.25, y + 5.6, z - 6.0, x + 0.25, y + 9.5, z + 6.0);
      S.box(x - 0.05, y + 5.3, z - 6.0, x + 1.2, y + 5.4, z + 6.0);
    });
    const D = at(262, z).decal;
    D.frame(x - 0.251, y + 5.6, z, -Math.PI / 2);
    D.put(I.billboard, -5.9, 0.05, 5.9, 3.85, 0.0);
    D.pop();
    D.frame(x + 0.251, y + 5.6, z, Math.PI / 2);
    D.put(I.billboard_radio, -5.9, 0.05, 5.9, 3.85, 0.0);
    D.pop();
    for (const dz of [-3.2, 3.2]) T.post(x, y - 0.5, y + 6.0, z + dz, 0.16);
    T.box(x - 0.25, x + 0.25, y + 5.6, y + 9.5, z - 6.0, z + 6.0, 'metal');
  }

  {
    const S = at(323, 18).surface;
    const F = at(323, 18).fine;
    S.with({ layer: L.PAVER, color: [0.95, 0.88, 0.8], wear: 0.4, rough: -1 }, () => S.box(PLAZA.x0, W - 0.25, PLAZA.z0, PLAZA.x1, W, PLAZA.z1, 'ny'));
    T.box(PLAZA.x0, PLAZA.x1, W - 0.4, W, PLAZA.z0, PLAZA.z1);
    const cx = 323;
    const cz = 19;
    S.with({ layer: L.CONCRETE, color: [0.85, 0.82, 0.76], wear: 0.5, rough: -1 }, () => {
      S.cyl(cx, W, cz, W + 0.35, 3.0, 24);
      S.box(cx - 1.0, W + 0.35, cz - 1.0, cx + 1.0, W + 1.5, cz + 1.0);
    });
    at(323, 18).decal.frame(cx, W + 0.35, cz - 1.0, Math.PI);
    at(323, 18).decal.put(I.plaque, -0.7, 0.2, 0.7, 1.13, 0.004);
    at(323, 18).decal.pop();
    const y = W + 1.5;
    S.with({ layer: L.FLAT, color: [0.95, 0.94, 0.9], wear: 0.3, rough: 0.35, metal: 0.4 }, () => {
      S.cyl(cx, y + 0.6, cz, y + 7.2, 0.6, 20);
      S.cyl(cx, y + 7.2, cz, y + 9.0, 0.6, 20, { r1: 0.03 });
    });
    S.with({ layer: L.FLAT, color: [0.94, 0.4, 0.2], wear: 0.3, rough: 0.45 }, () => {
      S.cyl(cx, y + 6.0, cz, y + 7.2, 0.61, 20, { caps: false });
      S.cyl(cx, y + 2.4, cz, y + 2.7, 0.61, 20, { caps: false });
      for (let k = 0; k < 4; k++) {
        S.push(new THREE.Matrix4().makeTranslation(cx, y, cz).multiply(new THREE.Matrix4().makeRotationY((k / 4) * Math.PI * 2 + Math.PI / 4)));
        S.quad([0.55, 0.6, 0], [1.6, 0.0, 0], [1.4, 1.4, 0], [0.55, 2.6, 0]);
        S.quad([0.55, 0.6, 0.03], [0.55, 2.6, 0.03], [1.4, 1.4, 0.03], [1.6, 0.0, 0.03]);
        S.pop();
      }
    });
    S.with({ layer: L.FLAT, color: [0.2, 0.2, 0.22], wear: 0.3, rough: 0.5, metal: 0.7 }, () => S.cyl(cx, y, cz, y + 0.6, 0.5, 16, { r1: 0.38 }));
    S.with({ layer: L.FLAT, color: [0.35, 0.6, 0.85], rough: 0.1, metal: 0.3 }, () => S.cyl(cx, y + 5.0, cz - 0.55, y + 5.3, 0.2, 14));
    T.post(cx, W, W + 10.5, cz, 1.0, 'concrete');
    T.box(cx - 1, cx + 1, W, W + 1.5, cz - 1, cz + 1);
    for (const [bx, bz, yaw] of [[cx - 4.2, cz, Math.PI / 2], [cx + 4.2, cz, -Math.PI / 2], [cx, cz + 4.2, Math.PI], [cx - 9, 13.2, 0], [cx + 9, 13.2, 0], [cx - 9, 24.6, Math.PI], [cx + 9, 24.6, Math.PI]]) bench(bx, bz, yaw, [0.75, 0.3, 0.2]);
    for (const [px, pz] of [[309.5, 13], [336.5, 13], [309.5, 24], [336.5, 24]]) {
      S.with({ layer: L.CONCRETE, color: [0.9, 0.75, 0.62], wear: 0.6, rough: -1 }, () => S.cyl(px, W, pz, W + 0.55, 1.0, 16));
      F.with({ layer: L.FLAT, color: [0.22, 0.17, 0.1], rough: 0.9 }, () => F.cyl(px, W + 0.5, pz, W + 0.56, 0.92, 16));
      T.post(px, W, W + 0.55, pz, 1.0, 'concrete');
    }
    const top = [cx, y + 8.6, cz];
    for (const [px, pz] of [[309.5, 11], [336.5, 11], [309.5, 26], [336.5, 26]]) {
      const end = [px, W + 3.2, pz];
      F.with({ layer: L.FLAT, color: [0.05, 0.05, 0.05], rough: 0.5 }, () => {
        F.tube([[px, W, pz], end], 0.04, 5);
        F.tube(catenary(top, end, 0.8), 0.008, 3);
      });
      const pts = catenary(top, end, 0.8, 18);
      F.with({ layer: L.FLAT, color: [1.0, 0.82, 0.5], glow: 7, channel: CHANNELS.FLICKER_B }, () => { for (let k = 1; k < pts.length - 1; k++) F.box(pts[k][0] - 0.04, pts[k][1] - 0.1, pts[k][2] - 0.04, pts[k][0] + 0.04, pts[k][1] - 0.02, pts[k][2] + 0.04); });
      T.post(px, W, W + 3.2, pz, 0.06);
    }
    F.with({ layer: L.FLAT, color: [0.55, 0.57, 0.58], rough: 0.4, metal: 0.8 }, () => {
      F.cyl(312, W, 25.5, W + 0.9, 0.18, 10);
      F.cyl(312, W + 0.9, 25.5, W + 1.0, 0.26, 10);
    });
    for (let x = PLAZA.x0 + 1; x < PLAZA.x1; x += 2.2) {
      F.with({ layer: L.FLAT, color: [0.2, 0.2, 0.2], rough: 0.5, metal: 0.6 }, () => F.cyl(x, W, PLAZA.z1 - 0.3, W + 0.85, 0.09, 10));
      T.post(x, W, W + 0.85, PLAZA.z1 - 0.3, 0.1);
    }
    for (let k = 0; k < 14; k++) {
      const fx = PLAZA.x0 + 2 + T.random() * (PLAZA.x1 - PLAZA.x0 - 4);
      const fz = PLAZA.z0 + 1 + T.random() * 14;
      if (Math.hypot(fx - cx, fz - cz) < 3.4) continue;
      at(fx, fz).fineDecal.frame(fx, W + 0.006, fz, 0, -Math.PI / 2);
      at(fx, fz).fineDecal.fit(I.gum, 0, 0, 1.2 + T.random(), 0);
      at(fx, fz).fineDecal.pop();
    }
  }

  function wire(F, a, b, sag, r = 0.012) {
    F.tube(catenary(a, b, sag, Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 2))), r, 3);
  }
  function utilityPole(x, z, h = 9.5, arms = 1) {
    const y = TOWN.ground;
    const F = at(x, z).fine;
    F.with({ layer: L.PLANK, color: [0.42, 0.33, 0.26], wear: 0.6, rough: -1 }, () => {
      F.cyl(x, y - 0.3, z, y + h, 0.14, 8, { r1: 0.11 });
      for (let k = 0; k < arms; k++) F.box(x - 0.06, y + h - 0.4 - k * 0.7, z - 1.1, x + 0.06, y + h - 0.28 - k * 0.7, z + 1.1);
    });
    F.with({ layer: L.FLAT, color: [0.3, 0.45, 0.35], rough: 0.3, metal: 0.2 }, () => { for (const dz of [-0.95, 0, 0.95]) F.cyl(x, y + h - 0.28, z + dz, y + h - 0.16, 0.04, 6); });
    T.post(x, y - 0.3, y + h, z, 0.15, 'wood');
    return [x, y + h - 0.18, z];
  }
  const pylonTops = [];
  for (const [z, xs] of [[31.2, [270, 284, 291.5, 309, 322, 336, 358, 372, 389]], [-31.2, [309, 322, 336, 358, 372, 389]]]) {
    const tops = xs.map((x) => utilityPole(x, z));
    pylonTops.push(tops);
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i];
      const b = tops[i + 1];
      const F = at((a[0] + b[0]) / 2, z).fine;
      F.with({ layer: L.FLAT, color: [0.03, 0.03, 0.03], rough: 0.6 }, () => {
        for (const dz of [-0.95, 0, 0.95]) wire(F, [a[0], a[1], a[2] + dz], [b[0], b[1], b[2] + dz], 0.35 + 0.02 * Math.abs(b[0] - a[0]));
      });
    }
    tops.forEach((t, i) => {
      if (i % 2) return;
      const F = at(t[0], z).fine;
      const back = z > 0 ? 26.5 : -26.5;
      F.with({ layer: L.FLAT, color: [0.03, 0.03, 0.03], rough: 0.6 }, () => wire(F, [t[0], t[1] - 0.9, t[2]], [t[0] + 1.5, TOWN.walk + 6.2, back], 0.4, 0.01));
      if (i % 4 === 0) {
        F.with({ layer: L.FLAT, color: [0.5, 0.52, 0.53], rough: 0.5, metal: 0.6 }, () => F.cyl(t[0] + 0.32, t[1] - 2.4, t[2], t[1] - 1.3, 0.25, 12));
      }
      F.with({ layer: L.FLAT, color: [0.5, 0.52, 0.53], rough: 0.5, metal: 0.6 }, () => F.tube([[t[0], t[1] - 2.9, t[2]], [t[0], t[1] - 2.6, t[2] - Math.sign(z) * 1.4]], 0.04, 5));
      F.with({ layer: L.FLAT, color: [1.0, 0.9, 0.75], glow: 5, channel: i === 2 ? CHANNELS.BROKEN : CHANNELS.LAMP }, () => F.box(t[0] - 0.12, t[1] - 2.72, t[2] - Math.sign(z) * 1.55, t[0] + 0.12, t[1] - 2.66, t[2] - Math.sign(z) * 1.2));
    });
  }
  {
    const last = [246, heightAt(246, -14) + 9.62, -14];
    const top = utilityPole(258.5, -13.8, 9.3);
    const F = at(258.5, -13.8).fine;
    F.with({ layer: L.FLAT, color: [0.03, 0.03, 0.03], rough: 0.6 }, () => {
      for (const dz of [-1.0, 0, 1.0]) wire(F, [last[0], last[1], last[2] + dz], [top[0], top[1], top[2] + dz], 0.6);
      wire(F, top, [276.5, 4.3 + 3.9, -22.2], 0.5, 0.01);
    });
  }

  {
    const F = at(286, 29).fine;
    const a = [281.5, TOWN.walk + 8.0, 26.5];
    const b = [284, TOWN.ground + 8.6, 31.0];
    F.with({ layer: L.FLAT, color: [0.85, 0.85, 0.8], rough: 0.6 }, () => wire(F, a, b, 0.3, 0.006));
    const pts = catenary(a, b, 0.3, 10);
    const colors = [[0.9, 0.2, 0.3], [0.95, 0.95, 0.9], [0.2, 0.5, 0.9], [0.98, 0.8, 0.2], [0.3, 0.75, 0.4], [0.9, 0.5, 0.75]];
    for (let k = 1; k < pts.length - 1; k++) {
      if (k % 3 === 0) continue;
      const p = pts[k];
      const w = 0.25 + T.random() * 0.25;
      const h = 0.35 + T.random() * 0.4;
      F.with({ layer: L.FLAT, color: colors[k % colors.length], rough: 0.9, phase: k }, () => {
        F.quad([p[0], p[1] - h, p[2] - w / 2], [p[0], p[1] - h, p[2] + w / 2], [p[0], p[1], p[2] + w / 2], [p[0], p[1], p[2] - w / 2], null, [0.15, 0.15, 0, 0]);
        F.quad([p[0], p[1] - h, p[2] + w / 2], [p[0], p[1] - h, p[2] - w / 2], [p[0], p[1], p[2] - w / 2], [p[0], p[1], p[2] + w / 2], null, [0.15, 0.15, 0, 0]);
      });
    }
  }

  {
    const pairs = [[311, 311], [324, 324.5], [337.5, 337.5], [357, 357], [371, 371], [385, 385]];
    const colors = [[0.95, 0.3, 0.45], [0.98, 0.78, 0.15], [0.2, 0.7, 0.7], [0.45, 0.35, 0.85], [0.98, 0.55, 0.2], [0.95, 0.95, 0.9]];
    for (const [xa, xb] of pairs) {
      const a = [xa, W + 3.95, 7.5];
      const b = [xb, W + 3.95, -7.5];
      const F = at(xa, 0).fine;
      F.with({ layer: L.FLAT, color: [0.9, 0.9, 0.85], rough: 0.6 }, () => wire(F, a, b, 0.7, 0.006));
      const pts = catenary(a, b, 0.7, 32);
      for (let k = 1; k < pts.length - 1; k++) {
        const p = pts[k];
        const q = pts[k + 1];
        F.with({ layer: L.FLAT, color: colors[k % colors.length], rough: 0.85, phase: k * 0.7 }, () => {
          F.tri([p[0], p[1], p[2]], [q[0], q[1], q[2]], [(p[0] + q[0]) / 2, p[1] - 0.32, (p[2] + q[2]) / 2], null, [0, 0, 0.12]);
          F.tri([q[0], q[1], q[2]], [p[0], p[1], p[2]], [(p[0] + q[0]) / 2, p[1] - 0.32, (p[2] + q[2]) / 2], null, [0, 0, 0.12]);
        });
      }
    }
  }

  {
    const F = at(305.6, 42).fine;
    F.with({ layer: L.FLAT, color: [0.9, 0.9, 0.9], rough: 0.3, metal: 0.8 }, () => {
      F.cyl(305.6, W, 43, W + 8.5, 0.07, 10, { r1: 0.045 });
      F.cyl(305.6, W + 8.5, 43, W + 8.62, 0.09, 10);
    });
    T.post(305.6, W, W + 8.5, 43, 0.08);
    const D = at(305.6, 42).fineDecal;
    const y = W + 6.9;
    D.quad(I.flag_town, [[305.6, y, 43.05], [305.6, y, 45.35], [305.6, y + 1.5, 45.35], [305.6, y + 1.5, 43.05]], { sway: [0.0, 0.35, 0.35, 0.0] });
    D.quad(I.flag_town, [[305.62, y, 45.35], [305.62, y, 43.05], [305.62, y + 1.5, 43.05], [305.62, y + 1.5, 45.35]], { uv: [1, 0, 0, 1], sway: [0.35, 0.0, 0.0, 0.35] });
  }

  {
    const F = at(280, 45).fine;
    for (let x = 267.35; x < 293; x += 2.7) {
      T.paint(I.line_white, x - 0.06, 31.8, x + 0.06, 36.6);
      T.paint(I.line_white, x - 0.06, 54.9, x + 0.06, 59.7);
    }
    for (let x = 268.7; x < 292; x += 2.7) {
      for (const z of [36.2, 55.3]) {
        F.with({ layer: L.CONCRETE, color: [0.85, 0.8, 0.5], wear: 0.7, rough: -1 }, () => F.box(x - 0.8, 4.3, z - 0.1, x + 0.8, 4.42, z + 0.1));
      }
    }
    F.with(GALV, () => {
      F.cyl(279.5, 4.3, 45.8, 4.3 + 7.5, 0.1, 8);
      F.box(279.5 - 1.2, 4.3 + 7.4, 45.7, 279.5 + 1.2, 4.3 + 7.5, 45.9);
    });
    F.with({ layer: L.FLAT, color: [1.0, 0.92, 0.75], glow: 5, channel: CHANNELS.LAMP }, () => { for (const dx of [-1.0, 1.0]) F.box(279.5 + dx - 0.25, 4.3 + 7.32, 45.6, 279.5 + dx + 0.25, 4.3 + 7.4, 46.0); });
    T.post(279.5, 4.3, 11.8, 45.8, 0.12);
  }

  function dumpster(x, z, color, yaw = 0) {
    const F = at(x, z).fine;
    F.frame(x, TOWN.ground + 0.02, z, yaw);
    F.with({ layer: L.FLAT, color, wear: 0.9, rough: 0.6, metal: 0.5 }, () => {
      F.quad([-0.9, 0.15, 0.6], [0.9, 0.15, 0.6], [0.9, 1.2, 0.75], [-0.9, 1.2, 0.75]);
      F.quad([0.9, 0.15, -0.6], [-0.9, 0.15, -0.6], [-0.9, 1.25, -0.6], [0.9, 1.25, -0.6]);
      F.quad([-0.9, 0.15, -0.6], [-0.9, 0.15, 0.6], [-0.9, 1.2, 0.75], [-0.9, 1.25, -0.6]);
      F.quad([0.9, 0.15, 0.6], [0.9, 0.15, -0.6], [0.9, 1.25, -0.6], [0.9, 1.2, 0.75]);
      F.box(-0.92, 0.15, -0.6, 0.92, 0.2, 0.7);
      for (const u of [-0.75, 0.75]) F.box(u - 0.05, 0.3, 0.62, u + 0.05, 1.15, 0.8);
    });
    F.with({ layer: L.FLAT, color: [0.08, 0.08, 0.08], rough: 0.7 }, () => {
      F.quad([-0.92, 1.22, 0.78], [0.92, 1.22, 0.78], [0.92, 1.33, -0.62], [-0.92, 1.33, -0.62]);
      for (const [u, w] of [[-0.75, 0.6], [0.75, 0.6]]) F.cyl(u, 0, w, 0.15, 0.07, 8);
      for (const [u, w] of [[-0.75, -0.5], [0.75, -0.5]]) F.cyl(u, 0, w, 0.15, 0.07, 8);
    });
    F.pop();
    T.collider(R.ColliderDesc.cuboid(0.92, 0.65, 0.7).setTranslation(x, TOWN.ground + 0.68, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)), 'metal');
    const D = at(x, z).fineDecal;
    D.frame(x, TOWN.ground + 0.02, z, yaw);
    D.fit(I[['tag_jrk', 'tag_okay', 'tag_bop', 'tag_kotek'][Math.floor(T.random() * 4)]], 0, 0.75, 1.2, 0.69);
    D.pop();
  }
  dumpster(275.5, 27.6, [0.15, 0.4, 0.25], 0.05);
  dumpster(331, 27.7, [0.12, 0.3, 0.6], -0.04);
  dumpster(369.5, 27.6, [0.15, 0.4, 0.25], 0.02);
  dumpster(318, -27.6, [0.15, 0.4, 0.25], Math.PI);
  dumpster(381, -27.7, [0.6, 0.35, 0.12], Math.PI + 0.06);

  function pallet(x, z, yaw, stack = 1) {
    const F = at(x, z).fine;
    F.frame(x, TOWN.ground + 0.02, z, yaw);
    F.with({ layer: L.PLANK, color: [0.75, 0.62, 0.45], wear: 0.6, rough: -1 }, () => {
      for (let s = 0; s < stack; s++) {
        const y = s * 0.15;
        for (const u of [-0.5, 0, 0.5]) F.box(u - 0.05, y, -0.6, u + 0.05, y + 0.1, 0.6);
        for (let k = 0; k < 5; k++) F.box(-0.6, y + 0.1, -0.6 + k * 0.28, 0.6, y + 0.13, -0.6 + k * 0.28 + 0.12);
      }
    });
    F.pop();
    T.box(x - 0.6, x + 0.6, TOWN.ground, TOWN.ground + stack * 0.15, z - 0.6, z + 0.6, 'wood');
  }
  pallet(278.5, 27.4, 0.1, 3);
  pallet(334.2, 27.3, -0.3, 2);
  pallet(385.5, -27.4, 0.2, 4);
  pallet(372.5, 31.0, 0.5, 1);

  {
    const S = at(383, 40).surface;
    const x = 359.5;
    const z = 59.0;
    const y = TOWN.ground;
    S.with({ layer: L.FLAT, color: [0.65, 0.66, 0.66], wear: 0.6, rough: 0.5, metal: 0.8 }, () => {
      for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) S.box(x + dx - 0.1, y, z + dz - 0.1, x + dx + 0.1, y + 13.5, z + dz + 0.1);
      for (let h = 1.5; h < 13.5; h += 2.4) {
        S.box(x - 1.6, y + h, z - 1.7, x + 1.6, y + h + 0.08, z - 1.5);
        S.box(x - 1.6, y + h, z + 1.5, x + 1.6, y + h + 0.08, z + 1.7);
        S.box(x - 1.7, y + h, z - 1.6, x - 1.5, y + h + 0.08, z + 1.6);
        S.box(x + 1.5, y + h, z - 1.6, x + 1.7, y + h + 0.08, z + 1.6);
      }
    });
    S.with({ layer: L.CONCRETE, color: [0.7, 0.7, 0.68], wear: 0.8, rough: -1 }, () => S.box(x - 2.4, y - 0.2, z - 2.4, x + 2.4, y + 0.4, z + 2.4));
    S.with({ layer: L.FLAT, color: [0.94, 0.93, 0.9], wear: 0.4, rough: 0.4, metal: 0.4 }, () => {
      S.cyl(x, y + 1.2, z, y + 12.5, 0.75, 20);
      S.cyl(x, y + 12.5, z, y + 15.0, 0.75, 20, { r1: 0.04 });
    });
    S.with({ layer: L.FLAT, color: [0.12, 0.12, 0.13], wear: 0.4, rough: 0.5, metal: 0.4 }, () => {
      S.cyl(x, y + 10.5, z, y + 11.0, 0.76, 20, { caps: false });
      S.cyl(x, y + 0.6, z, y + 1.2, 0.55, 16, { r1: 0.45 });
      for (let k = 0; k < 4; k++) {
        S.push(new THREE.Matrix4().makeTranslation(x, y + 1.0, z).multiply(new THREE.Matrix4().makeRotationY((k / 4) * Math.PI * 2)));
        S.quad([0.7, 0.3, 0], [1.8, 0.0, 0], [1.6, 1.6, 0], [0.7, 3.0, 0]);
        S.quad([0.7, 0.3, 0.03], [0.7, 3.0, 0.03], [1.6, 1.6, 0.03], [1.8, 0.0, 0.03]);
        S.pop();
      }
    });
    at(383, 40).decal.frame(x - 0.762, y + 6.0, z, -Math.PI / 2);
    at(383, 40).decal.put(I.sticker_gsp, -0.6, -0.6, 0.6, 0.6, 0.0);
    at(383, 40).decal.pop();
    T.post(x, y, y + 15, z, 2.2, 'metal');
  }

  {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 64;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000';
    g.fillRect(0, 0, 700, 64);
    g.fillStyle = '#fff';
    g.font = '900 52px "Arial Black", "Helvetica Neue", Impact, sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText('GZOWO SPRINGS', 350, 34);
    const data = g.getImageData(0, 0, 700, 64).data;
    const px = 0.12;
    const S = at(420, 0).surface;
    const x0 = 438;
    const zc = 0;
    const span = 700 * px;
    S.paint({ layer: L.FLAT, color: [0.95, 0.94, 0.9], wear: 0.6, rough: 0.6 });
    let minX = 700;
    let maxX = 0;
    let base = -Infinity;
    for (let z = -span / 2; z <= span / 2; z += 2) base = Math.max(base, heightAt(x0, zc + z));
    base += 0.6;
    for (let row = 0; row < 64; row++) {
      let run = -1;
      for (let col = 0; col <= 700; col++) {
        const on = col < 700 && data[(row * 700 + col) * 4] > 128;
        if (on && run < 0) run = col;
        if (!on && run >= 0) {
          minX = Math.min(minX, run);
          maxX = Math.max(maxX, col);
          const za = zc - span / 2 + run * px;
          const zb = zc - span / 2 + col * px;
          const yb = base + 1.6 + (63 - row) * px;
          const lean = (63 - row) * px * 0.35;
          S.box(x0 + lean - 0.3, yb, za, x0 + lean, yb + px, zb);
          run = -1;
        }
      }
    }
    S.paint({ layer: L.FLAT, color: [0.35, 0.35, 0.33], wear: 0.6, rough: 0.6, metal: 0.6 });
    for (let col = minX + 6; col < maxX; col += 22) {
      const z = zc - span / 2 + col * px;
      const g0 = heightAt(x0, z);
      S.box(x0 + 0.05, g0 - 0.5, z - 0.06, x0 + 0.17, base + 1.7, z + 0.06);
      S.tube([[x0 + 1.4, heightAt(x0 + 1.4, z) - 0.3, z], [x0 + 0.2, base + 1.6 + 4.0, z]], 0.05, 4);
    }
    S.paint({ layer: L.FLAT, color: [0.8, 0.8, 0.8], glow: 0, metal: 0, sway: 0 });
    T.box(x0 - 0.4, x0 + 2.6, base, base + 9.5, zc - span / 2 + minX * px, zc - span / 2 + maxX * px);
  }

  if (ctx.trees && ctx.trees.palms) {
    const { kinds, trunkMat, frondMat } = ctx.trees.palms;
    const spots = [
      [266.5, 16.0, W], [262.5, 9.5, 4.3], [262.5, -10, 4.3], [262, 18, 4.3], [309.5, 13, W + 0.5], [336.5, 13, W + 0.5], [309.5, 24, W + 0.5], [336.5, 24, W + 0.5],
      [330.5, -8.9, W], [376, -8.9, W], [392.6, 8.9, W], [399.6, 15.2, 4.3], [399.6, -15.2, 4.3], [296.2, 30.2, 4.3], [342.2, -30.2, 4.3], [352.6, -33.5, W],
      [270, -40, 4.3], [292.8, -36, 4.3], [356, -62, 4.3], [388, -40, 4.3], [272, 62, 4.3], [318, 60, 4.3], [357, 64, 4.3], [288, -64, 4.3],
    ];
    const use = kinds.slice(0, 3);
    const lists = use.map(() => []);
    spots.forEach(([x, z, y], i) => {
      lists[i % use.length].push({ x, y: y - 0.25, z, yaw: T.random() * 6.28, scale: 0.7 + T.random() * 0.35, tilt: [(T.random() - 0.5) * 0.12, (T.random() - 0.5) * 0.12] });
      T.post(x, y - 0.5, y + 5, z, 0.22, 'wood');
      if (y > 4.4 && !(x > 307 && x < 339 && z > 10 && z < 27)) {
        const F = at(x, z).fine;
        F.with({ layer: L.FLAT, color: [0.15, 0.15, 0.15], rough: 0.6, metal: 0.7 }, () => F.box(x - 0.6, y + 0.004, z - 0.6, x + 0.6, y + 0.012, z + 0.6));
      }
    });
    use.forEach((kind, i) => {
      if (!lists[i].length) return;
      for (const mesh of instancedVariant({ parts: [{ geometry: kind.trunk, material: trunkMat }, { geometry: kind.fronds, material: frondMat }] }, lists[i])) meshes.push(mesh);
    });
  }

  const dynamics = [];
  const kinds = new Map();
  async function dynKind(name, build) {
    if (!kinds.has(name)) kinds.set(name, await build());
    return kinds.get(name);
  }
  const loadModel = async (name) => variantsOf(await ctx.assets.model(name));
  const canKind = await dynKind('can', async () => {
    const v = (await loadModel('metal_trash_can')).reduce((a, b) => (b.size.y > a.size.y ? b : a));
    v.parts.forEach((p) => ctx.lighting.register(p.material));
    return { parts: v.parts, offset: -v.size.y / 2, desc: () => R.ColliderDesc.cylinder(v.size.y / 2, Math.max(v.size.x, v.size.z) / 2), mass: 9, half: v.size.y / 2, list: [] };
  });
  const bagKind = await dynKind('bag', async () => {
    const v = (await loadModel('trashbag'))[0];
    v.parts.forEach((p) => ctx.lighting.register(p.material));
    return { parts: v.parts, offset: -v.size.y / 2, desc: () => R.ColliderDesc.ball(Math.min(v.size.x, v.size.y, v.size.z) / 2), mass: 4, half: v.size.y / 2, list: [] };
  });
  const barrelKind = await dynKind('barrel', async () => {
    const v = (await loadModel('Barrel_01'))[0];
    v.parts.forEach((p) => ctx.lighting.register(p.material));
    return { parts: v.parts, offset: -v.size.y / 2, desc: () => R.ColliderDesc.cylinder(v.size.y / 2, v.size.x / 2), mass: 18, half: v.size.y / 2, list: [] };
  });
  const newsKinds = ['news_red', 'news_blue', 'news_yellow'].map((n, i) => {
    const s = new Surface();
    const col = [[0.78, 0.2, 0.17], [0.09, 0.39, 0.66], [0.95, 0.76, 0.19]][i];
    s.paint({ layer: L.FLAT, color: col, wear: 0.7, rough: 0.5, metal: 0.4 });
    s.box(-0.24, 0.02, -0.22, 0.24, 1.0, 0.22);
    s.paint({ layer: L.FLAT, color: [0.2, 0.2, 0.2], rough: 0.5, metal: 0.6 });
    s.box(-0.2, -0.5, -0.18, -0.16, 0.02, -0.14).box(0.16, -0.5, -0.18, 0.2, 0.02, -0.14).box(-0.2, -0.5, 0.14, -0.16, 0.02, 0.18).box(0.16, -0.5, 0.14, 0.2, 0.02, 0.18);
    s.paint({ layer: L.FLAT, color: [0.6, 0.7, 0.75], rough: 0.08, metal: 0 });
    s.box(-0.2, 0.45, 0.22, 0.2, 0.9, 0.23);
    s.paint({ layer: L.FLAT, color: [0.95, 0.94, 0.9], rough: 0.8 });
    s.box(-0.17, 0.5, 0.18, 0.17, 0.85, 0.21);
    return { parts: [{ geometry: s.geometry(), material: T.mats.surface }], offset: 0, desc: () => R.ColliderDesc.cuboid(0.24, 0.75, 0.22).setTranslation(0, 0.25, 0), mass: 22, half: 0.5, list: [] };
  });
  const coneKind = (() => {
    const s = new Surface();
    s.paint({ layer: L.FLAT, color: [0.95, 0.38, 0.08], rough: 0.55 });
    s.cyl(0, 0.04, 0, 0.72, 0.16, 14, { r1: 0.03 });
    s.paint({ layer: L.FLAT, color: [0.95, 0.95, 0.92], rough: 0.4 });
    s.cyl(0, 0.36, 0, 0.5, 0.1, 14, { r1: 0.075, caps: false });
    s.paint({ layer: L.FLAT, color: [0.08, 0.08, 0.08], rough: 0.7 });
    s.box(-0.19, 0, -0.19, 0.19, 0.04, 0.19);
    return { parts: [{ geometry: s.geometry(), material: T.mats.surface }], offset: -0.36, desc: () => R.ColliderDesc.cone(0.36, 0.19), mass: 3.2, half: 0.36, list: [] };
  })();

  function carGeometry(type) {
    const s = new Surface();
    const PAINT = [1, 0, 1];
    const spec = {
      sedan: { body: [[-2.25, 0.42], [-2.3, 0.8], [-2.14, 0.98], [-1.55, 1.0], [1.05, 0.98], [2.12, 0.86], [2.29, 0.68], [2.26, 0.42]], cab: [[-1.55, 0.98], [-1.02, 1.42], [0.28, 1.45], [1.05, 0.97]], half: 0.9, height: 1.45 },
      pickup: { body: [[-2.55, 0.46], [-2.58, 1.04], [-0.5, 1.06], [1.1, 1.12], [2.38, 1.04], [2.5, 0.76], [2.48, 0.46]], cab: [[-0.5, 1.05], [-0.42, 1.8], [0.55, 1.82], [1.12, 1.1]], half: 0.95, height: 1.82 },
      van: { body: [[-2.3, 0.44], [-2.33, 1.0], [2.0, 1.0], [2.26, 0.9], [2.32, 0.7], [2.3, 0.44]], cab: [[-2.32, 0.99], [-2.32, 1.95], [-2.1, 2.05], [1.2, 2.05], [1.95, 1.2], [2.05, 0.99]], half: 0.96, height: 2.05 },
    }[type];
    const half = spec.half;
    const zf = Math.max(...spec.body.map((p) => p[0]));
    const zb = Math.min(...spec.body.map((p) => p[0]));
    const len = zf - zb;
    s.paint({ layer: L.FLAT, color: PAINT, wear: 0.25, rough: 0.3, metal: 0.55 });
    s.extrudeX([...spec.body, spec.body[0]], -half, half, true);
    const inset = type === 'van' ? 0.02 : 0.12;
    s.paint({ layer: L.FLAT, color: [0.03, 0.04, 0.05], rough: 0.06, metal: 0.1 });
    s.extrudeX([...spec.cab, spec.cab[0]], -half + inset, half - inset, true);
    s.paint({ layer: L.FLAT, color: PAINT, wear: 0.25, rough: 0.3, metal: 0.55 });
    const cab = spec.cab;
    const roofA = cab[type === 'van' ? 2 : cab.length - 3];
    const roofB = cab[type === 'van' ? 3 : cab.length - 2];
    s.box(-half + inset - 0.01, Math.min(roofA[1], roofB[1]) - 0.06, Math.min(roofA[0], roofB[0]) - 0.02, half - inset + 0.01, Math.max(roofA[1], roofB[1]) + 0.012, Math.max(roofA[0], roofB[0]) + 0.02);
    for (const sx of [-1, 1]) {
      const x0 = sx > 0 ? half - inset - 0.005 : -half + inset - 0.025;
      const mid = (roofA[0] + roofB[0]) / 2;
      s.box(x0, cab[0][1], mid - 0.05, x0 + 0.03, Math.max(roofA[1], roofB[1]), mid + 0.05);
    }
    s.paint({ layer: L.FLAT, color: [0.05, 0.05, 0.055], rough: 0.7, metal: 0.1 });
    s.box(-half + 0.05, 0.22, zb + 0.25, half - 0.05, 0.44, zf - 0.25);
    s.box(-half - 0.03, 0.34, zf - 0.08, half + 0.03, 0.56, zf + 0.06);
    s.box(-half - 0.03, 0.34, zb - 0.06, half + 0.03, 0.56, zb + 0.08);
    for (const wz of [zb + len * 0.19, zf - len * 0.2]) {
      for (const sx of [-1, 1]) {
        s.push(new THREE.Matrix4().makeTranslation(sx * (half - 0.04), 0.35, wz).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)));
        s.paint({ layer: L.FLAT, color: [0.025, 0.025, 0.025], rough: 0.85, metal: 0 });
        s.cyl(0, -0.12, 0, 0.12, 0.35, 16);
        s.paint({ layer: L.FLAT, color: [0.72, 0.73, 0.75], rough: 0.25, metal: 0.95 });
        s.cyl(0, -sx * 0.121 - 0.002, 0, -sx * 0.121 + 0.002, 0.22, 12);
        s.pop();
        s.paint({ layer: L.FLAT, color: [0.04, 0.04, 0.045], rough: 0.8 });
        s.box(sx > 0 ? half - 0.02 : -half - 0.002, 0.42, wz - 0.42, sx > 0 ? half + 0.002 : -half + 0.02, 0.72, wz + 0.42);
      }
    }
    s.paint({ layer: L.FLAT, color: [0.95, 0.93, 0.85], rough: 0.08, metal: 0 });
    for (const sx of [-1, 1]) s.box(sx * (half - 0.32) - 0.17, 0.62, zf - 0.03, sx * (half - 0.32) + 0.17, 0.74, zf + 0.012);
    s.paint({ layer: L.FLAT, color: [0.6, 0.05, 0.04], rough: 0.15, metal: 0 });
    for (const sx of [-1, 1]) s.box(sx * (half - 0.22) - 0.13, 0.66, zb - 0.012, sx * (half - 0.22) + 0.13, 0.86, zb + 0.03);
    s.paint({ layer: L.FLAT, color: [0.85, 0.8, 0.3], rough: 0.4 });
    s.box(-0.26, 0.4, zb - 0.07, 0.26, 0.52, zb - 0.05);
    s.paint({ layer: L.FLAT, color: [0.7, 0.72, 0.74], rough: 0.25, metal: 0.9 });
    for (const sx of [-1, 1]) s.box(sx * (half + 0.02) - (sx > 0 ? 0 : 0.12), 1.0, (cab[0][0] + cab[cab.length - 1][0]) / 2 + 0.3, sx * (half + 0.02) + (sx > 0 ? 0.12 : 0), 1.12, (cab[0][0] + cab[cab.length - 1][0]) / 2 + 0.45);
    return { geometry: s.geometry(), half, len, height: spec.height };
  }
  const carTypes = { sedan: carGeometry('sedan'), pickup: carGeometry('pickup'), van: carGeometry('van') };
  const carKinds = {};
  for (const [name, c] of Object.entries(carTypes)) {
    carKinds[name] = { parts: [{ geometry: c.geometry, material: T.mats.surface }], offset: -c.height / 2, desc: () => R.ColliderDesc.cuboid(c.half, c.height / 2, c.len / 2), mass: name === 'van' ? 1700 : 1250, half: c.height / 2, list: [], tints: [], car: true };
  }

  function addDyn(kind, x, y, z, yaw) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const body = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y + kind.half, z).setRotation(q).setLinearDamping(0.1).setAngularDamping(0.4).setCanSleep(true));
    const collider = physics.world.createCollider(kind.desc().setMass(kind.mass).setFriction(0.7).setRestitution(0.15).setCollisionGroups(groups(GROUPS.PROP, 0xffff)).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(kind.mass * 30), body);
    physics.surfaces.set(collider.handle, kind === coneKind || kind === bagKind ? 'plastic' : 'metal');
    body.sleep();
    kind.list.push({ body });
    dynamics.push({ kind, body, index: kind.list.length - 1 });
  }
  [[276.2, 9.85], [309.2, -9.85], [333.2, 9.9], [362.4, -9.85], [389.2, 9.85], [272.8, 27.2], [327.6, 27.2], [366.5, -27.3], [312.5, -27.3], [393.5, 14.8]].forEach(([x, z], i) => addDyn(canKind, x, z > 26 || z < -26 ? TOWN.ground + 0.02 : W, z, i * 1.3));
  [[273.0, 10.0, 0], [273.55, 10.0, 1], [274.1, 10.0, 2], [313.0, -10.0, 1], [313.55, -10.0, 2], [384.0, 10.0, 0]].forEach(([x, z, k]) => addDyn(newsKinds[k], x, W, z, z > 0 ? Math.PI : 0));
  [[279.6, 27.3], [280.1, 27.6], [326.4, 27.4], [376.2, -27.4], [376.8, -27.2], [388.2, -27.6]].forEach(([x, z]) => addDyn(bagKind, x, TOWN.ground + 0.02, z, T.random() * 6));
  [[382.6, -27.6], [383.4, -27.3], [362.5, 33.0], [363.2, 32.6], [364.0, 33.1]].forEach(([x, z]) => addDyn(barrelKind, x, TOWN.ground + 0.02, z, T.random() * 6));
  const paints = [[0.62, 0.08, 0.06], [0.08, 0.28, 0.55], [0.85, 0.82, 0.74], [0.1, 0.42, 0.36], [0.92, 0.62, 0.12], [0.05, 0.05, 0.06], [0.62, 0.64, 0.66], [0.48, 0.72, 0.82], [0.95, 0.45, 0.55], [0.35, 0.18, 0.12]];
  const parked = [
    ['sedan', 277.5, 5.75, Math.PI / 2], ['pickup', 315.0, 5.75, Math.PI / 2], ['sedan', 333.6, -5.75, -Math.PI / 2], ['van', 364.4, -5.75, -Math.PI / 2],
    ['sedan', 376.8, 5.75, Math.PI / 2], ['sedan', 321.2, -5.75, -Math.PI / 2], ['pickup', 274.0, 34.0, 0], ['sedan', 282.1, 57.2, Math.PI], ['sedan', 287.5, 34.0, 0.03],
    ['van', 395.5, -10.5, 0.0], ['sedan', 395.5, 7.0, Math.PI], ['pickup', 277.6, -16.0, -Math.PI / 2], ['sedan', 360.8, -45.5, Math.PI / 2], ['pickup', 289.2, -48.0, Math.PI / 2],
  ];
  parked.forEach(([type, x, z, yaw], i) => {
    const kind = carKinds[type];
    const y = Math.abs(z) < 7.2 ? streetY(x, z) : z < -40 ? TOWN.ground : 4.3;
    addDyn(kind, x, y, z, yaw);
    kind.tints.push(paints[(i * 7 + 3) % paints.length]);
  });
  [[351.0, 37.5], [351.3, 52.4], [294.8, -18.4], [294.8, -23.6], [366, 7.2], [369, 7.2]].forEach(([x, z]) => addDyn(coneKind, x, z > 7 && z < 8 ? streetY(x, z) : z > 30 || z < -10 ? 4.3 : W, z, 0));

  const allKinds = [canKind, bagKind, barrelKind, ...newsKinds, coneKind, ...Object.values(carKinds)];
  const instanced = [];
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const off = new THREE.Matrix4();
  for (const kind of allKinds) {
    if (!kind.list.length) continue;
    kind.meshes = kind.parts.map((part) => {
      if (kind.tints && kind.tints.length) part.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(kind.tints.flat()), 3));
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, kind.list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      meshes.push(mesh);
      return mesh;
    });
    instanced.push(kind);
  }
  function syncAll(force) {
    for (const kind of instanced) {
      let dirty = force;
      kind.list.forEach((item, i) => {
        if (!force && item.body.isSleeping()) return;
        const t = item.body.translation();
        const r = item.body.rotation();
        pos.set(t.x - TOWN_OFFSET.x, t.y, t.z - TOWN_OFFSET.z);
        quat.set(r.x, r.y, r.z, r.w);
        m4.compose(pos, quat, one).multiply(off.makeTranslation(0, kind.offset, 0));
        for (const mesh of kind.meshes) mesh.setMatrixAt(i, m4);
        dirty = true;
      });
      if (dirty) for (const mesh of kind.meshes) mesh.instanceMatrix.needsUpdate = true;
    }
  }
  syncAll(true);

  return {
    meshes,
    dynamics,
    update() {
      syncAll(false);
    },
  };
}
