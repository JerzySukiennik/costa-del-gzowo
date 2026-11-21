// Costa del Gzowo: Gzowo Springs buildings, each with its own facade, shopfronts, signs, roof, back side and street art.
import * as THREE from 'three';
import { TOWN } from '../../config.js';
import { L } from './kit.js';
import { PLOTS } from './layout.js';
import {
  PAL, bundle, placeFrame, eachSide, spread, room, windowUnit, acUnit, storefront, door, wallLamp, rollup, awning, board, blade,
  cornice, band, parapetRoof, gableRoof, roofClutter, downspout, meters, fireEscape,
} from './parts.js';

const plot = (id) => PLOTS.find((p) => p.id === id);

function centerOf(p) {
  return [(p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2];
}

function art(T, B, list) {
  for (const [name, cu, cv, w, opts] of list) B[opts && opts.fine ? 'FD' : 'D'].fit(T.items[name], cu, cv, w, (opts && opts.z) ?? 0.012, opts || {});
}

function upperRows(T, B, W, floors, ground, upper, o) {
  for (let f = 1; f < floors; f++) {
    const v0 = ground + (f - 1) * upper + (o.sill ?? 0.85);
    const h = o.h ?? 1.55;
    for (const [u0, u1] of o.cols || spread(o.n, o.w, W, o.margin ?? 0.9)) {
      windowUnit(T, B, { u0, v0, u1, v1: v0 + h, frame: o.frame, trim: o.trim, split: o.split, lintel: o.lintel, shutters: o.shutters, ac: T.random() < (o.ac ?? 0.15), box: o.boxes && T.random() < 0.5 ? o.boxes : null, sillLayer: o.sillLayer, room: room(T, o.kind ?? 0) });
    }
  }
}

function wallWithHoles(B, paint, W, H, holes) {
  B.S.with(paint, () => B.S.wall(0, W, -0.35, H, holes));
}

function commercial(T, p, spec) {
  const base = spec.base ?? TOWN.walk;
  const f = placeFrame(p, spec.face ?? p.face);
  const [cx, cz] = centerOf(p);
  const B = bundle(T.cell(cx, cz));
  const floors = spec.floors;
  const G0 = spec.ground ?? 4.2;
  const U = spec.upper ?? 3.3;
  const H = G0 + (floors - 1) * U;
  const W = f.W;
  const D = f.D;
  const paint = { layer: L.PLASTER, wear: 0.65, rough: -1, metal: 0, glow: 0, channel: 0, ...spec.wall };
  B.push(f.x, base, f.z, f.yaw);
  eachSide(B, W, D, (side, w) => {
    const s = spec[side] || {};
    const holes = [];
    const work = [];
    if (s.shops) for (const sh of s.shops) {
      holes.push([sh.u0, 0, sh.u1, sh.h ?? 3.0]);
      work.push(() => storefront(T, B, { frame: spec.frame ?? PAL.black, ...sh }));
    }
    if (s.doors) for (const d of s.doors) {
      holes.push([d.u0, 0, d.u1, d.h ?? 2.3]);
      work.push(() => door(T, B, d));
    }
    if (s.rolls) for (const r of s.rolls) {
      holes.push([r.u0, r.v0 ?? 0, r.u1, r.v1]);
      work.push(() => rollup(T, B, r));
    }
    const winRects = [];
    if (s.ground) for (const [u0, u1, v0, v1] of s.ground) {
      holes.push([u0, v0, u1, v1]);
      winRects.push([u0, u1, v0, v1]);
    }
    const up = s.upper;
    if (up) {
      for (let fl = 1; fl < floors; fl++) {
        const v0 = G0 + (fl - 1) * U + (up.sill ?? 0.85);
        const h = up.h ?? 1.55;
        for (const [u0, u1] of up.cols || spread(up.n, up.w, w, up.margin ?? 0.9)) holes.push([u0, v0, u1, v0 + h]);
      }
    }
    wallWithHoles(B, paint, w, H, holes);
    for (const job of work) job();
    for (const [u0, u1, v0, v1] of winRects) windowUnit(T, B, { u0, v0, u1, v1, frame: spec.winFrame ?? PAL.white, trim: spec.trim, split: s.groundSplit ?? 'dh', lintel: spec.lintel ?? 'flat', sillLayer: spec.sillLayer, room: room(T, s.groundKind ?? 0), shutters: s.groundShutters });
    if (up) upperRows(T, B, w, floors, G0, U, { frame: spec.winFrame ?? PAL.white, trim: spec.trim, lintel: spec.lintel ?? 'flat', sillLayer: spec.sillLayer, ...up });
    if (spec.bands !== false && floors > 1 && side !== 'back') band(B, 0, w, G0 - 0.05, 0.22, 0.08, { color: spec.trim ?? PAL.white, layer: spec.bandLayer ?? L.FLAT });
    if (spec.cornice && side !== 'back') cornice(B, -0.02, w + 0.02, H - 0.62, { color: spec.trim ?? PAL.white, scale: spec.corniceScale ?? 1 });
    if (s.pilasters) for (const u of s.pilasters) B.S.with({ layer: spec.pilasterLayer ?? L.FLAT, color: spec.trim ?? PAL.white, wear: 0.7, rough: 0.6 }, () => B.S.box(u - 0.18, -0.3, 0, u + 0.18, s.pilasterTop ?? G0 - 0.05, 0.1));
    if (s.extra) s.extra(B, w, H, G0, U);
  });
  let top = H + (spec.parapet ?? 0.9);
  if (spec.gable) {
    const g = spec.gable;
    const opts = { layer: g.layer, tile: g.color, metal: g.metal, wallPaint: paint, rise: g.rise, over: g.over, fascia: g.fascia ?? spec.trim };
    if (g.ridge === 'depth') {
      B.push(W, 0, 0, Math.PI / 2);
      top = gableRoof(T, B, D, W, H, opts);
      B.pop();
    } else top = gableRoof(T, B, W, D, H, opts);
  } else {
    parapetRoof(T, B, W, D, H, { parapet: spec.parapet ?? 0.9, wallPaint: paint, roofLayer: spec.roofLayer, roofColor: spec.roofColor, capColor: spec.trim });
    roofClutter(T, B, W, D, H, spec.clutter ?? 3);
  }
  if (spec.roof) spec.roof(B, W, D, H);
  B.pop();
  T.box(p.x0, p.x1, base - 0.5, base + (spec.gable ? H : top), p.z0, p.z1);
  if (spec.gable) T.box(p.x0 + 0.5, p.x1 - 0.5, base + H, base + top - 0.6, p.z0 + 0.5, p.z1 - 0.5);
  return { W, D, H, base, frame: f };
}

function graffitiWall(T, B, w, list) {
  art(T, B, list);
  for (let i = 0; i < 6; i++) B.FD.fit(T.items['sticker_' + ['gsp', 'smile', 'alien', 'g', 'planet', 'star', 'bolt', 'cat', 'radio', 'hello', 'labs', 'rocket'][Math.floor(T.random() * 12)]], 0.6 + T.random() * (w - 1.2), 0.9 + T.random() * 1.2, 0.09 + T.random() * 0.05, 0.014);
}

function backSide(T, B, w, o = {}) {
  door(T, B, { u0: o.door ?? 1.2, u1: (o.door ?? 1.2) + 1.0, h: 2.2, color: o.doorColor ?? [0.35, 0.38, 0.36], layer: L.SHUTTER, lamp: true, frame: [0.3, 0.3, 0.3], panels: false });
  meters(T, B, (o.door ?? 1.2) + 1.5, 1.1);
  downspout(B, w - 0.4, o.H ?? 4.5);
  if (o.ac !== false) acUnit(T, B, Math.min(w - 1.6, (o.door ?? 1.2) + 3.6), 0.0, 0.02);
  B.FD.put(T.items.grime, 0, -0.1, w, 1.6, 0.011, { fade: 0.9 });
}

export function buildBuildings(T) {
  const out = [];
  const I = T.items;

  out.push(commercial(T, plot('coffee'), {
    floors: 2, wall: { color: PAL.teal, layer: L.PLASTER }, trim: PAL.cream, winFrame: PAL.cream, frame: [0.08, 0.18, 0.2], cornice: true, lintel: 'hood',
    front: {
      shops: [{ u0: 0.9, u1: 6.4, door: 2, divs: 4, frame: [0.08, 0.2, 0.22], bulkColor: PAL.orange }, { u0: 7.4, u1: 12.1, divs: 3, frame: [0.08, 0.2, 0.22], bulkColor: PAL.orange }],
      upper: { n: 4, w: 1.2, h: 1.6, split: 'dh', shutters: PAL.orange, ac: 0.2, boxes: PAL.cream },
      pilasters: [0.45, 6.9, 12.55],
      extra(B, w, H, G0) {
        board(T, B, { u0: 1.0, u1: 12.0, v0: 3.25, v1: 4.0, item: I.sign_coffee, frameColor: [0.08, 0.2, 0.22], lamps: true, lampColor: [0.08, 0.2, 0.22] });
        awning(T, B, { u0: 0.8, u1: 6.5, v: 3.15, color: PAL.orange, depth: 1.5, drop: 0.7 });
        awning(T, B, { u0: 7.3, u1: 12.2, v: 3.15, color: PAL.orange, depth: 1.5, drop: 0.7 });
        B.FD.fit(I.neon_coffee, 9.8, 1.9, 1.3, -0.1, { glow: 3.5, channel: 13 });
        B.FD.fit(I.door_hours, 4.65, 1.4, 0.45, -0.115);
        B.FD.fit(I.poster_launch, 11.2, 1.35, 0.42, -0.11);
        blade(T, B, { u: 0.3, v: 4.6, w: 0.9, h: 1.6, item: I.neon_rocket, glow: 3, channel: 1 });
      },
    },
    left: {},
    right: {
      upper: { n: 3, w: 1.0, h: 1.4, split: 'dh' },
      extra(B, w, H) {
        B.D.put(I.mural_postcard, 0.6, 0.35, w - 0.6, 0.35 + (w - 1.2) / (1536 / 576), 0.012);
        art(T, B, [['sticker_gsp', 1.4, 1.1, 0.12, { fine: true, z: 0.016 }], ['sticker_smile', 2.0, 1.25, 0.1, { fine: true, z: 0.016 }]]);
      },
    },
    back: { upper: { n: 3, w: 1.0, h: 1.4, split: 'dh', ac: 0.4 }, extra(B, w, H) { backSide(T, B, w, { H }); art(T, B, [['tag_okay', 6.5, 1.5, 1.4], ['tag_kotek', 10, 2.1, 1.2], ['throw_gzw', 9.5, 4.0, 2.2]]); B.FD.put(I.water_stain, 1.0, 3.0, 6.0, 7.5, 0.011, { fade: 0.6 }); } },
  }));

  out.push(commercial(T, plot('hotel'), {
    floors: 3, ground: 4.4, upper: 3.4, wall: { color: [0.92, 0.86, 0.82], layer: L.BRICK, wear: 0.75 }, trim: [0.93, 0.9, 0.82], winFrame: [0.2, 0.32, 0.26], cornice: true, corniceScale: 1.3, lintel: 'flat', parapet: 1.2,
    pilasterLayer: L.CONCRETE, sillLayer: L.CONCRETE, clutter: 5,
    front: {
      shops: [{ u0: 0.7, u1: 5.6, divs: 3, frame: [0.2, 0.32, 0.26], bulkLayer: L.CONCRETE, bulkColor: [0.8, 0.78, 0.72] }, { u0: 8.6, u1: 13.3, divs: 3, frame: [0.2, 0.32, 0.26], bulkLayer: L.CONCRETE, bulkColor: [0.8, 0.78, 0.72] }],
      doors: [{ u0: 6.2, u1: 8.0, h: 3.0, color: [0.2, 0.32, 0.26], glass: true, frame: [0.93, 0.9, 0.82], r: 0.5 }],
      upper: { n: 5, w: 1.1, h: 1.75, split: 'dh', ac: 0.35, margin: 0.8 },
      pilasters: [0.35, 6.0, 8.2, 13.65],
      extra(B, w, H, G0) {
        board(T, B, { u0: 3.2, u1: 10.8, v0: 3.45, v1: 4.2, item: I.sign_hotel, frameColor: [0.2, 0.32, 0.26] });
        B.F.with({ layer: L.FLAT, color: [0.2, 0.32, 0.26], rough: 0.5, metal: 0.5 }, () => {
          B.F.box(5.9, 3.05, 0, 8.3, 3.15, 2.2);
          B.F.tube([[6.0, 3.15, 2.1], [6.0, 5.2, 0.02]], 0.02, 5);
          B.F.tube([[8.2, 3.15, 2.1], [8.2, 5.2, 0.02]], 0.02, 5);
        });
        B.F.with({ layer: L.FLAT, color: [1.0, 0.85, 0.6], glow: 4, channel: 14 }, () => { for (let u = 6.3; u < 8.2; u += 0.5) B.F.box(u - 0.06, 3.02, 1.0, u + 0.06, 3.05, 1.12); });
        blade(T, B, { u: 13.9, v: 4.9, w: 0.75, h: 3.0, item: I.neon_hotel, glow: 3.2, channel: 13, t: 0.1, out: 0.4 });
        B.FD.fit(I.window_wifi, 3.15, 2.5, 1.1, -0.1);
        B.FD.fit(I.poster_band, 9.2, 1.5, 0.45, -0.1);
        B.FD.fit(I.poster_fest, 12.6, 1.5, 0.45, -0.1);
      },
    },
    left: {
      shops: [{ u0: 10.6, u1: 14.6, divs: 3, frame: [0.2, 0.32, 0.26], bulkLayer: L.CONCRETE, bulkColor: [0.8, 0.78, 0.72] }],
      upper: { n: 5, w: 1.0, h: 1.75, split: 'dh', ac: 0.3 },
      extra(B, w, H, G0, U) {
        fireEscape(T, B, 4.6, 7.8, 3, G0, U);
        B.D.put(I.ghost_cola, 9.0, G0 + U + 2.2, 15.0, G0 + U + 5.2, 0.012, { fade: 0.85 });
        art(T, B, [['poster_cat', 8.6, 1.5, 0.4, { fine: true, z: 0.013 }], ['poster_yard', 9.2, 1.45, 0.4, { fine: true, z: 0.014 }], ['tag_narew', 2.8, 1.4, 1.6]]);
        downspout(B, 0.4, H + 0.8);
      },
    },
    right: { upper: { cols: [[2.0, 3.0], [5.0, 6.0], [8.0, 9.0], [11.0, 12.0], [14.0, 15.0]], h: 1.75, split: 'dh', ac: 0.2 }, extra(B, w, H) { B.D.put(I.water_stain, 3.0, 8.5, 9.0, 12.0, 0.011, { fade: 0.7 }); } },
    back: { upper: { n: 4, w: 1.0, h: 1.5, split: 'dh', ac: 0.5 }, extra(B, w, H, G0, U) { backSide(T, B, w, { H, door: 2 }); fireEscape(T, B, 6.5, 9.5, 3, G0, U); art(T, B, [['piece_costa', 10.5, 1.7, 3.6], ['tag_bop', 4.8, 2.6, 1.0]]); } },
    roof(B, W, D, H) {
      B.S.with({ layer: L.FLAT, color: [0.15, 0.15, 0.16], rough: 0.6, metal: 0.6 }, () => {
        for (const u of [2.0, 7.0, 12.0]) B.S.box(u - 0.08, H + 1.2, -6.2, u + 0.08, H + 5.0, -6.04);
        for (const u of [2.0, 7.0, 12.0]) B.S.tube([[u, H + 1.2, -7.6], [u, H + 3.5, -6.15]], 0.05, 5);
        B.S.box(0.6, H + 2.4, -6.3, 13.4, H + 2.5, -6.0);
      });
      board(T, B, { u0: 0.6, u1: 13.4, v0: H + 2.5, v1: H + 5.2, z: -6.1, item: I.billboard_radio, depth: 0.1, frameColor: [0.18, 0.18, 0.18], lamps: true, lampColor: [0.18, 0.18, 0.18] });
    },
  }));

  out.push(commercial(T, plot('hobby'), {
    floors: 2, wall: { color: PAL.butter }, trim: [0.98, 0.95, 0.88], winFrame: PAL.navy, frame: PAL.navy, cornice: false, parapet: 1.6, lintel: 'none',
    front: {
      shops: [{ u0: 0.8, u1: 8.4, door: 0, divs: 5, frame: PAL.navy, bulkColor: PAL.navy }],
      upper: { cols: [[1.2, 3.2], [4.5, 6.5], [7.8, 9.8], [10.6, 12.2]], h: 1.5, split: 'grid', ac: 0.1 },
      ground: [[9.4, 12.2, 0.9, 2.8]],
      groundSplit: 'grid',
      extra(B, w, H, G0) {
        board(T, B, { u0: 0.7, u1: 12.4, v0: 3.2, v1: 4.05, item: I.sign_hobby, frameColor: PAL.navy, lamps: true, lampColor: PAL.navy });
        B.S.with({ layer: L.FLAT, color: PAL.orange, wear: 0.5, rough: 0.6 }, () => {
          for (const u of [0.35, 4.0, 8.9, 12.65]) B.S.box(u - 0.15, 4.2, 0, u + 0.15, H + 1.6, 0.25);
          B.S.box(0, H + 1.3, 0, w, H + 1.6, 0.12);
        });
        awning(T, B, { u0: 0.7, u1: 8.5, v: 3.12, color: PAL.navy, solid: true, depth: 1.2, drop: 0.45, valance: 0.22 });
        B.FD.fit(I.neon_rocket, 6.6, 1.7, 0.85, -0.1, { glow: 3.5, channel: 1 });
        B.FD.fit(I.poster_print, 2.2, 1.6, 0.5, -0.1);
        B.FD.fit(I.poster_launch, 3.0, 1.55, 0.5, -0.1);
        B.FD.fit(I.window_sale, 10.8, 2.1, 1.6, -0.17);
      },
    },
    right: {
      upper: { n: 3, w: 1.3, h: 1.5, split: 'grid' },
      ground: [[2.0, 4.0, 0.9, 2.8], [5.5, 7.5, 0.9, 2.8]],
      groundSplit: 'grid',
      extra(B, w, H) {
        B.D.put(I.mural_launch, 8.6, 0.5, 15.4, 0.5 + 6.8 / 2, 0.012);
        art(T, B, [['sticker_rocket', 1.2, 1.3, 0.13, { fine: true, z: 0.016 }], ['sticker_g', 1.45, 1.2, 0.1, { fine: true, z: 0.016 }], ['sticker_radio', 4.8, 1.0, 0.13, { fine: true, z: 0.016 }]]);
      },
    },
    left: { upper: { n: 2, w: 1.0, h: 1.4 } },
    back: { extra(B, w, H) { backSide(T, B, w, { H }); art(T, B, [['throw_oho', 7.2, 1.5, 2.6], ['tag_gdev', 10.5, 2.4, 1.3]]); } },
    roof(B, W, D, H) {
      B.push(W / 2, H, -D / 2);
      B.S.with({ layer: L.FLAT, color: [0.95, 0.94, 0.9], wear: 0.4, rough: 0.35, metal: 0.3 }, () => {
        B.S.cyl(0, 0.6, 0, 4.6, 0.42, 16);
        B.S.cyl(0, 4.6, 0, 5.6, 0.42, 16, { r1: 0.02 });
      });
      B.S.with({ layer: L.FLAT, color: PAL.orange, wear: 0.4, rough: 0.5 }, () => {
        B.S.cyl(0, 3.8, 0, 4.6, 0.43, 16, { caps: false });
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          B.S.push(new THREE.Matrix4().makeRotationY(a));
          B.S.quad([0.4, 0.6, 0], [1.1, 0.3, 0], [1.0, 1.3, 0], [0.4, 1.8, 0]);
          B.S.quad([0.4, 0.6, 0.02], [0.4, 1.8, 0.02], [1.0, 1.3, 0.02], [1.1, 0.3, 0.02]);
          B.S.pop();
        }
      });
      B.S.with({ layer: L.FLAT, color: PAL.sky, rough: 0.1, metal: 0.4 }, () => B.S.cyl(0, 3.0, 0.38, 3.3, 0.14, 12));
      B.S.with({ layer: L.CONCRETE, color: [0.6, 0.6, 0.6], wear: 0.6, rough: -1 }, () => B.S.box(-0.9, 0, -0.9, 0.9, 0.6, 0.9));
      B.pop();
    },
  }));

  out.push(commercial(T, plot('barber'), {
    floors: 1, ground: 4.6, wall: { color: PAL.pink }, trim: PAL.white, winFrame: PAL.white, frame: [0.85, 0.85, 0.85], parapet: 1.4, cornice: true, corniceScale: 0.8,
    front: {
      shops: [{ u0: 0.8, u1: 5.6, divs: 3, frame: [0.85, 0.85, 0.85], bulkColor: PAL.navy, metal: 0.8 }],
      doors: [{ u0: 6.4, u1: 7.5, h: 2.5, color: PAL.navy, glass: true, frame: PAL.white }],
      ground: [[8.1, 9.3, 0.9, 2.6]],
      extra(B, w, H) {
        board(T, B, { u0: 0.6, u1: 9.4, v0: 3.35, v1: 4.25, item: I.sign_barber, frameColor: PAL.white });
        awning(T, B, { u0: 0.6, u1: 5.8, v: 3.2, color: [0.9, 0.35, 0.5], scallop: true, depth: 1.2, drop: 0.6 });
        B.FD.put(I.gold_letters, 1.0, 1.8, 5.4, 2.35, -0.1);
        B.FD.fit(I.neon_open, 4.6, 1.2, 0.8, -0.1, { glow: 3, channel: 2 });
        B.S.with({ layer: L.BARBER, color: [1, 1, 1], wear: 0.1, rough: 0.2 }, () => B.S.cyl(6.0, 1.3, 0.35, 2.5, 0.11, 16, { caps: false }));
        B.S.with({ layer: L.FLAT, color: [0.85, 0.85, 0.85], rough: 0.2, metal: 0.9 }, () => {
          B.S.cyl(6.0, 1.15, 0.35, 1.3, 0.14, 16);
          B.S.cyl(6.0, 2.5, 0.35, 2.65, 0.14, 16);
          B.S.cyl(6.0, 2.65, 0.35, 2.78, 0.1, 16, { r1: 0.03 });
          B.S.box(5.97, 1.9, 0, 6.03, 1.96, 0.3);
        });
      },
    },
    back: { extra(B, w, H) { backSide(T, B, w, { H, door: 1.0 }); art(T, B, [['tag_zow', 5.5, 1.6, 1.4], ['throw_yes', 8.0, 2.6, 2.2], ['sticker_hello', 3.0, 1.4, 0.16, { fine: true, z: 0.014 }]]); } },
  }));

  out.push(commercial(T, plot('arcade'), {
    floors: 2, ground: 4.4, upper: 3.4, wall: { color: [0.35, 0.22, 0.5] }, trim: PAL.mint, winFrame: [0.12, 0.12, 0.14], frame: [0.12, 0.12, 0.14], parapet: 2.4, cornice: false, bands: false,
    front: {
      shops: [{ u0: 1.2, u1: 14.8, door: 4, divs: 8, frame: [0.12, 0.12, 0.14], bulkColor: PAL.mint, kind: 1, depth: 9 }],
      upper: { cols: [[1.0, 4.6], [5.8, 10.2], [11.4, 15.0]], h: 1.3, split: 'pair', sill: 1.2 },
      extra(B, w, H) {
        B.S.with({ layer: L.FLAT, color: PAL.mint, wear: 0.4, rough: 0.5 }, () => {
          B.S.push(new THREE.Matrix4().makeTranslation(0, 3.3, 0));
          B.S.extrudeX([[0, 0.5], [2.2, 0.15], [2.2, 0], [0, 0.05]], 0.5, 15.5);
          B.S.pop();
          for (const u of [0.25, 15.75]) B.S.box(u - 0.25, 0, 0, u + 0.25, H + 2.4, 0.3);
        });
        B.F.with({ layer: L.FLAT, color: [1.0, 0.9, 0.7], glow: 5, channel: 11 }, () => { for (let u = 1.0; u < 15; u += 0.8) B.F.cyl(u, 3.28, 1.6, 3.32, 0.05, 6); });
        B.F.with({ layer: L.FLAT, color: [1.0, 0.9, 0.7], glow: 5, channel: 12 }, () => { for (let u = 1.4; u < 15; u += 0.8) B.F.cyl(u, 3.28, 1.6, 3.32, 0.05, 6); });
        board(T, B, { u0: 1.5, u1: 14.5, v0: H + 0.15, v1: H + 2.25, z: 0.3, item: I.neon_arcade, frame: false, glow: 3.2, channel: 13 });
        B.S.with({ layer: L.FLAT, color: [0.08, 0.08, 0.1], rough: 0.4, metal: 0.5 }, () => B.S.box(1.3, H + 0.1, 0.18, 14.7, H + 2.3, 0.3));
        B.FD.fit(I.poster_help, 2.0, 1.6, 0.45, -0.1);
      },
    },
    left: { upper: { n: 3, w: 1.2, h: 1.3 }, extra(B, w, H) { art(T, B, [['piece_gzowo', 4.6, 2.4, 6.6], ['piece_rakieta', 11.2, 2.0, 4.6], ['tag_springz', 14.0, 1.2, 1.4]]); graffitiWall(T, B, w, []); } },
    right: { upper: { cols: [[3.0, 4.2], [8.0, 9.2], [12.0, 13.2]], h: 1.3 }, extra(B, w) { art(T, B, [['tag_kotek', 6, 7.5, 1.2]]); } },
    back: { extra(B, w, H) { backSide(T, B, w, { H, door: 3 }); } },
  }));

  out.push(commercial(T, plot('pharmacy'), {
    floors: 2, wall: { color: [0.93, 0.93, 0.88] }, trim: PAL.green, winFrame: PAL.green, frame: PAL.green, cornice: true, corniceScale: 0.9,
    front: {
      shops: [{ u0: 0.8, u1: 7.4, door: 1, divs: 4, frame: PAL.green, bulkColor: PAL.green }],
      upper: { n: 3, w: 1.3, h: 1.6, split: 'dh', ac: 0.25, boxes: PAL.green },
      ground: [[8.2, 10.2, 0.9, 2.8]],
      extra(B, w, H) {
        board(T, B, { u0: 0.7, u1: 10.3, v0: 3.2, v1: 3.95, item: I.sign_pharmacy, frameColor: PAL.green, lamps: true, lampColor: PAL.green });
        awning(T, B, { u0: 0.7, u1: 7.5, v: 3.12, color: PAL.green, depth: 1.3, drop: 0.6 });
        B.push(10.75, 4.6, 0, -Math.PI / 2);
        B.S.with({ layer: L.FLAT, color: [0.2, 0.8, 0.4], glow: 2.4, channel: 13, rough: 0.4 }, () => {
          B.S.box(0.35, 0.3, -0.06, 1.05, 0.55, 0.06);
          B.S.box(0.575, 0.075, -0.06, 0.825, 0.775, 0.06);
        });
        B.pop();
        B.FD.fit(I.window_sale, 3.0, 2.0, 1.4, -0.11);
      },
    },
    left: {
      shops: [{ u0: 1.0, u1: 5.2, divs: 3, frame: PAL.green, bulkColor: PAL.green }],
      upper: { n: 4, w: 1.2, h: 1.5, ac: 0.3 },
      extra(B, w) { art(T, B, [['poster_piano', 6.0, 1.6, 0.45, { fine: true, z: 0.013 }], ['tag_jrk', 9.5, 1.5, 1.2]]); downspout(B, 0.3, 8); },
    },
    right: { upper: { n: 2, w: 1.0, h: 1.4 } },
    back: { extra(B, w, H) { backSide(T, B, w, { H }); } },
  }));

  out.push(commercial(T, plot('icecream'), {
    floors: 1, ground: 4.3, wall: { color: [0.62, 0.86, 0.82] }, trim: [0.98, 0.6, 0.78], winFrame: PAL.white, frame: [0.98, 0.98, 0.98], parapet: 1.8, cornice: false, bands: false,
    front: {
      shops: [{ u0: 0.9, u1: 9.1, door: 2, divs: 5, frame: [0.95, 0.95, 0.95], bulkColor: [0.98, 0.6, 0.78], metal: 0.2 }],
      extra(B, w, H) {
        board(T, B, { u0: 0.8, u1: 9.2, v0: 3.25, v1: 4.1, item: I.sign_icecream, frameColor: [0.98, 0.6, 0.78] });
        awning(T, B, { u0: 0.7, u1: 9.3, v: 3.15, color: [0.98, 0.5, 0.72], scallop: true, depth: 1.6, drop: 0.7 });
        B.FD.fit(I.neon_scoops, 7.6, 1.8, 1.1, -0.1, { glow: 3.2, channel: 1 });
        B.FD.fit(I.poster_help, 1.5, 1.4, 0.4, -0.1);
      },
    },
    back: { extra(B, w, H) { B.D.fit(I.mural_sea, 5.0, 2.4, 8.4); door(T, B, { u0: 0.6, u1: 1.5, h: 2.2, color: [0.98, 0.6, 0.78], lamp: true }); art(T, B, [['sticker_cat', 9.2, 1.4, 0.14, { fine: true, z: 0.016 }]]); } },
    roof(B, W, D, H) {
      B.push(W / 2, H, -D / 2);
      B.S.with({ layer: L.FLAT, color: [0.86, 0.66, 0.38], wear: 0.3, rough: 0.7 }, () => B.S.cyl(0, 0.3, 0, 3.2, 0.06, 12, { r1: 0.95 }));
      B.S.with({ layer: L.FLAT, color: [1.0, 0.62, 0.8], wear: 0.2, rough: 0.5 }, () => B.S.cyl(0, 3.2, 0, 3.9, 0.95, 16, { r1: 0.72 }));
      B.S.with({ layer: L.FLAT, color: [0.98, 0.94, 0.82], wear: 0.2, rough: 0.5 }, () => B.S.cyl(0, 3.9, 0, 4.5, 0.78, 16, { r1: 0.5 }));
      B.S.with({ layer: L.FLAT, color: [0.55, 0.32, 0.2], wear: 0.2, rough: 0.5 }, () => B.S.cyl(0, 4.5, 0, 4.95, 0.55, 16, { r1: 0.1 }));
      B.S.with({ layer: L.FLAT, color: [0.85, 0.1, 0.15], wear: 0.1, rough: 0.3 }, () => B.S.cyl(0, 4.95, 0, 5.2, 0.14, 10, { r1: 0.04 }));
      B.S.with({ layer: L.CONCRETE, color: [0.6, 0.6, 0.6], wear: 0.6, rough: -1 }, () => B.S.box(-0.5, 0, -0.5, 0.5, 0.3, 0.5));
      B.pop();
    },
  }));

  out.push(commercial(T, plot('records'), {
    floors: 2, wall: { color: [0.22, 0.24, 0.4], layer: L.PBRICK }, trim: PAL.yellow, winFrame: [0.95, 0.9, 0.8], frame: [0.1, 0.1, 0.1], cornice: true, corniceScale: 0.9,
    front: {
      shops: [{ u0: 0.8, u1: 10.2, door: 3, divs: 5, frame: [0.1, 0.1, 0.1], bulkColor: PAL.yellow }],
      upper: { n: 3, w: 1.4, h: 1.6, split: 'cross', ac: 0.3 },
      extra(B, w, H) {
        board(T, B, { u0: 0.7, u1: 10.3, v0: 3.25, v1: 4.0, item: I.sign_records, frameColor: [0.1, 0.1, 0.1] });
        awning(T, B, { u0: 0.6, u1: 10.4, v: 3.15, color: PAL.yellow, depth: 1.2, drop: 0.55 });
        art(T, B, [['poster_band', 1.6, 1.5, 0.48, { fine: true, z: -0.1 }], ['poster_piano', 2.3, 1.48, 0.48, { fine: true, z: -0.1 }], ['poster_fest', 3.0, 1.5, 0.48, { fine: true, z: -0.1 }]]);
        B.FD.fit(I.neon_beer, 8.6, 1.9, 1.0, -0.1, { glow: 3, channel: 13 });
      },
    },
    right: { upper: { n: 3, w: 1.1, h: 1.5 }, extra(B, w, H) { B.D.put(I.mural_keys, 1.0, 0.6, w - 1.0, 0.6 + (w - 2.0) / (1024 / 352), 0.012); } },
    left: { upper: { n: 2, w: 1.0, h: 1.4 } },
    back: { extra(B, w, H) { backSide(T, B, w, { H }); art(T, B, [['throw_kot', 7.5, 1.4, 2.0]]); } },
  }));

  out.push(commercial(T, plot('laundry'), {
    floors: 1, ground: 4.5, wall: { color: [0.9, 0.94, 0.97] }, trim: [0.22, 0.6, 0.82], winFrame: PAL.white, frame: [0.85, 0.87, 0.9], parapet: 1.5, cornice: false, bands: false,
    front: {
      shops: [{ u0: 0.7, u1: 9.3, door: 0, divs: 5, frame: [0.85, 0.87, 0.9], bulkColor: [0.22, 0.6, 0.82], kind: 4, depth: 8, metal: 0.8 }],
      extra(B, w, H) {
        board(T, B, { u0: 0.5, u1: 9.5, v0: 3.3, v1: 4.1, item: I.sign_laundry, frameColor: [0.22, 0.6, 0.82] });
        B.S.with({ layer: L.FLAT, color: [0.22, 0.6, 0.82], wear: 0.5, rough: 0.6 }, () => B.S.box(0, H + 0.6, 0, w, H + 0.85, 0.14));
        B.FD.fit(I.window_wifi, 6.0, 2.4, 1.2, -0.1);
        B.FD.fit(I.neon_open, 8.4, 1.4, 0.75, -0.1, { glow: 3, channel: 0 });
      },
    },
    back: { extra(B, w, H) { backSide(T, B, w, { H, door: 4 }); B.F.with({ layer: L.FLAT, color: [0.6, 0.6, 0.6], metal: 0.8, rough: 0.4 }, () => B.F.box(1.4, 2.6, 0, 1.9, 3.1, 0.3)); } },
  }));

  out.push(commercial(T, plot('hardware'), {
    floors: 2, ground: 4.4, upper: 3.2, wall: { color: [0.86, 0.82, 0.78], layer: L.BRICK, wear: 0.8 }, trim: [0.92, 0.88, 0.8], winFrame: [0.2, 0.2, 0.2], frame: [0.2, 0.2, 0.2], cornice: true, corniceScale: 1.1, lintel: 'brick', parapet: 1.3,
    front: {
      shops: [{ u0: 1.0, u1: 7.2, divs: 4, frame: [0.2, 0.2, 0.2], bulkColor: PAL.red }, { u0: 9.8, u1: 16.0, divs: 4, frame: [0.2, 0.2, 0.2], bulkColor: PAL.red }],
      doors: [{ u0: 7.8, u1: 9.2, h: 2.8, color: PAL.red, glass: true, frame: [0.2, 0.2, 0.2], r: 0.4 }],
      upper: { n: 6, w: 1.0, h: 1.6, split: 'dh', ac: 0.15 },
      pilasters: [0.5, 7.5, 9.5, 16.5],
      extra(B, w, H) {
        board(T, B, { u0: 0.9, u1: 16.1, v0: 3.3, v1: 4.15, item: I.sign_hardware, frameColor: [0.2, 0.2, 0.2], lamps: true, lampColor: [0.2, 0.2, 0.2] });
        awning(T, B, { u0: 0.9, u1: 7.3, v: 3.2, color: [0.18, 0.4, 0.25], depth: 1.3, drop: 0.6 });
        awning(T, B, { u0: 9.7, u1: 16.1, v: 3.2, color: [0.18, 0.4, 0.25], depth: 1.3, drop: 0.6 });
        B.FD.fit(I.window_sale, 4.0, 2.0, 1.5, -0.11);
        B.FD.fit(I.poster_yard, 14.8, 1.5, 0.45, -0.1);
      },
    },
    right: {
      rolls: [{ u0: 2.4, u1: 6.0, v1: 3.2, open: 0.45, color: [0.62, 0.66, 0.6] }],
      upper: { n: 4, w: 1.0, h: 1.5, ac: 0.3 },
      extra(B, w) { art(T, B, [['tag_narew', 7.5, 1.5, 1.6], ['throw_gzw', 9.8, 1.5, 2.0], ['piece_costa', 13.0, 1.8, 4.4]]); meters(T, B, 0.6, 1.0); },
    },
    left: { upper: { n: 4, w: 1.0, h: 1.5 }, extra(B, w, H) { B.D.put(I.ghost_cola, 4.0, 6.2, 11.0, 9.7, 0.012, { fade: 0.7 }); } },
    back: { extra(B, w, H) { backSide(T, B, w, { H, door: 6 }); } },
  }));

  out.push(commercial(T, plot('motel'), {
    floors: 2, ground: 3.4, upper: 3.0, wall: { color: [0.97, 0.94, 0.86] }, trim: [0.06, 0.54, 0.52], winFrame: PAL.white, frame: [0.06, 0.54, 0.52], parapet: 0.7, cornice: false, bands: false,
    front: {
      shops: [{ u0: 0.8, u1: 4.2, door: 1, divs: 2, h: 2.7, frame: [0.06, 0.54, 0.52], bulkColor: [0.06, 0.54, 0.52] }],
      doors: [{ u0: 5.4, u1: 6.3, h: 2.15, color: [0.94, 0.55, 0.24], frame: PAL.white }, { u0: 9.0, u1: 9.9, h: 2.15, color: [0.94, 0.55, 0.24], frame: PAL.white }],
      ground: [[6.6, 8.2, 0.95, 2.0], [10.2, 11.4, 0.95, 2.0]],
      groundShutters: null,
      upper: { cols: [[0.6, 1.5], [1.8, 3.4], [4.2, 5.1], [5.4, 7.0], [8.2, 9.1], [9.4, 11.0]], h: 1.9, sill: 0.15, split: 'none', ac: 0.2 },
      extra(B, w, H, G0) {
        B.S.with({ layer: L.CONCRETE, color: [0.85, 0.84, 0.8], wear: 0.6, rough: -1 }, () => B.S.box(0, G0 - 0.12, 0, w, G0, 1.5));
        B.S.with({ layer: L.FLAT, color: [0.06, 0.54, 0.52], wear: 0.3, rough: 0.5, metal: 0.5 }, () => {
          B.S.box(0, G0 + 0.95, 1.42, w, G0 + 1.0, 1.5);
          for (let u = 0.1; u < w; u += 0.14) B.S.box(u, G0, 1.45, u + 0.02, G0 + 0.95, 1.47);
          for (const u of [0.15, 4.0, 8.0, w - 0.15]) B.S.box(u - 0.08, 0, 1.35, u + 0.08, G0 + 2.9, 1.5);
          B.S.box(0, G0 + 2.85, 0, w, G0 + 3.0, 1.6);
        });
        board(T, B, { u0: 4.6, u1: 11.6, v0: G0 + U_MOTEL + 0.05, v1: G0 + U_MOTEL + 0.75, item: I.sign_motel, frameColor: [0.06, 0.54, 0.52], z: 0.1 });
        art(T, B, [['num_12', 5.85, 2.45, 0.3, { fine: true, z: 0.015 }], ['num_14', 9.45, 2.45, 0.3, { fine: true, z: 0.015 }]]);
        wallLamp(T, B, 4.9, 2.2);
        wallLamp(T, B, 8.6, 2.2);
        B.F.with({ layer: L.FLAT, color: [0.9, 0.9, 0.92], rough: 0.4, metal: 0.6 }, () => B.F.box(7.2, 0, 0.05, 8.0, 1.6, 0.75));
        B.FD.put(I.cola_machine, 7.25, 0.1, 7.95, 1.5, 0.755);
      },
    },
    left: { upper: { n: 3, w: 1.1, h: 1.4 }, ground: [[3.0, 4.2, 0.95, 2.0], [9.0, 10.2, 0.95, 2.0]], extra(B, w) { art(T, B, [['tag_bop', 13, 1.5, 1.0]]); } },
    right: { upper: { n: 3, w: 1.1, h: 1.4 } },
    back: { extra(B, w, H) { backSide(T, B, w, { H }); } },
  }));

  out.push(...buildSpecials(T));
  return out;
}

const U_MOTEL = 3.0;

function buildSpecials(T) {
  const out = [];
  const I = T.items;
  out.push(commercial(T, plot('gaskiosk'), {
    floors: 1, ground: 3.6, base: 4.3, wall: { color: [0.94, 0.94, 0.92] }, trim: [0.06, 0.37, 0.66], frame: [0.75, 0.77, 0.8], parapet: 0.9, cornice: false, bands: false,
    front: {
      shops: [{ u0: 0.8, u1: 11.2, door: 3, divs: 6, h: 2.8, frame: [0.75, 0.77, 0.8], bulkColor: [0.06, 0.37, 0.66], metal: 0.8 }],
      extra(B, w, H) {
        board(T, B, { u0: 0.6, u1: 16.4, v0: 3.0, v1: 3.95, item: I.sign_gas, frameColor: [0.06, 0.37, 0.66] });
        B.FD.fit(I.neon_beer, 9.7, 1.8, 1.0, -0.1, { glow: 3, channel: 13 });
        B.FD.fit(I.neon_open, 2.2, 1.4, 0.7, -0.1, { glow: 3, channel: 2 });
        B.F.with({ layer: L.FLAT, color: [0.95, 0.95, 0.97], rough: 0.4, metal: 0.4 }, () => B.F.box(12.0, 0, 0.05, 13.4, 1.2, 0.85));
        B.FD.put(I.sticker_bolt, 12.3, 0.6, 12.6, 0.9, 0.855);
        B.D.put(I.cola_machine, 14.0, 0.0, 14.8, 1.6, 0.81);
        B.F.with({ layer: L.FLAT, color: [0.75, 0.12, 0.12], rough: 0.4, metal: 0.3 }, () => B.F.box(13.95, 0, 0.05, 14.85, 1.62, 0.8));
      },
    },
    back: { extra(B, w, H) { backSide(T, B, w, { H, door: 3 }); art(T, B, [['tag_gdev', 9, 1.4, 1.3], ['throw_oho', 13, 1.5, 2.2]]); } },
    left: { extra(B, w) { art(T, B, [['tag_zow', 4, 1.4, 1.4]]); } },
  }));

  out.push(commercial(T, plot('post'), {
    floors: 1, ground: 5.8, wall: { color: [0.9, 0.84, 0.72] }, trim: [0.97, 0.95, 0.9], winFrame: [0.18, 0.2, 0.2], cornice: true, corniceScale: 1.25, parapet: 1.1, bands: false,
    front: {
      doors: [{ u0: 6.9, u1: 9.1, h: 3.3, color: [0.18, 0.2, 0.2], glass: true, frame: [0.97, 0.95, 0.9], r: 0.45 }],
      ground: [[1.0, 2.6, 1.0, 4.3], [3.6, 5.2, 1.0, 4.3], [10.8, 12.4, 1.0, 4.3], [13.4, 15.0, 1.0, 4.3]],
      groundSplit: 'grid',
      pilasters: [0.35, 3.1, 5.7, 10.3, 12.9, 15.65],
      pilasterTop: 5.2,
      extra(B, w, H) {
        board(T, B, { u0: 3.0, u1: 13.0, v0: 4.45, v1: 5.1, item: I.sign_post, frame: false, z: 0.06 });
        B.S.with({ layer: L.CONCRETE, color: [0.85, 0.83, 0.78], wear: 0.6, rough: -1 }, () => { B.S.box(0.0, 5.2, -0.02, w, 5.4, 0.16); });
        wallLamp(T, B, 6.5, 2.6, false);
        wallLamp(T, B, 9.5, 2.6, false);
        B.F.with({ layer: L.FLAT, color: [0.12, 0.25, 0.55], wear: 0.6, rough: 0.5, metal: 0.4 }, () => {
          B.F.box(4.6 + 0.0, 0.0, 1.6, 5.2, 1.0, 2.1);
          B.F.cyl(4.9, 1.0, 1.85, 1.05, 0.3, 12);
        });
        art(T, B, [['poster_fest', 2.6, 1.5, 0.4, { fine: true, z: 0.013 }]]);
      },
    },
    left: { ground: [[3.0, 4.4, 1.2, 4.0], [8.0, 9.4, 1.2, 4.0], [13.0, 14.4, 1.2, 4.0]], extra(B, w) { art(T, B, [['tag_springz', 18.5, 1.5, 1.6], ['throw_kot', 21, 1.5, 1.8]]); } },
    right: { ground: [[3.0, 4.4, 1.2, 4.0], [8.0, 9.4, 1.2, 4.0], [13.0, 14.4, 1.2, 4.0]] },
    back: { rolls: [{ u0: 4.0, u1: 7.6, v1: 3.4, color: [0.55, 0.58, 0.62] }], extra(B, w, H) { backSide(T, B, w, { H, door: 10 }); } },
  }));

  const hangar = commercial(T, plot('hangar'), {
    floors: 1, ground: 7.4, base: TOWN.ground + 0.02, wall: { color: [0.86, 0.87, 0.86], layer: L.IRON, wear: 0.85 }, trim: [0.25, 0.27, 0.28], frame: [0.25, 0.27, 0.28], bands: false,
    gable: { layer: L.IRON, color: [0.72, 0.74, 0.74], metal: 0.6, ridge: 'depth', rise: 3.2, over: 0.3, fascia: [0.25, 0.27, 0.28] },
    front: {
      rolls: [{ u0: 1.6, u1: 9.6, v1: 5.6, open: 0.62, color: [0.85, 0.42, 0.18] }, { u0: 12.4, u1: 20.4, v1: 5.6, color: [0.85, 0.42, 0.18] }],
      extra(B, w, H) {
        board(T, B, { u0: 3.0, u1: 19.0, v0: 6.0, v1: 7.25, item: I.sign_hangar, frameColor: [0.25, 0.27, 0.28], lamps: true, lampColor: [0.25, 0.27, 0.28] });
        art(T, B, [['sticker_gsp', 10.9, 1.6, 0.5, { z: 0.02 }], ['sticker_rocket', 11.1, 2.3, 0.35, { fine: true, z: 0.02 }]]);
      },
    },
    left: {
      doors: [{ u0: 25.0, u1: 26.1, h: 2.2, color: [0.25, 0.27, 0.28], frame: [0.25, 0.27, 0.28], lamp: true, panels: false }],
      upper: null,
      ground: [[3.0, 6.0, 5.2, 6.6], [9.0, 12.0, 5.2, 6.6], [15.0, 18.0, 5.2, 6.6], [21.0, 24.0, 5.2, 6.6]],
      groundSplit: 'grid',
      extra(B, w) {
        art(T, B, [['piece_gzowo', 6.2, 2.2, 7.0], ['piece_rakieta', 14.6, 2.0, 6.0], ['throw_gzw', 20.3, 1.6, 2.6], ['tag_jrk', 22.8, 2.6, 1.3], ['tag_gdev', 2.2, 3.4, 1.4]]);
        graffitiWall(T, B, w, []);
        meters(T, B, 27.0, 1.0);
      },
    },
    right: { ground: [[3.0, 6.0, 5.2, 6.6], [9.0, 12.0, 5.2, 6.6], [15.0, 18.0, 5.2, 6.6], [21.0, 24.0, 5.2, 6.6]], groundSplit: 'grid', extra(B, w) { B.FD.put(I.water_stain, 2, 2, 12, 7, 0.011, { fade: 0.7 }); } },
    back: { extra(B, w, H) { backSide(T, B, w, { H: 7.0, door: 10 }); } },
  });
  out.push(hangar);

  out.push(commercial(T, plot('pierogi'), {
    floors: 1, ground: 3.6, wall: { color: [0.96, 0.9, 0.78], layer: L.PLANK, wear: 0.55 }, trim: [0.72, 0.14, 0.18], winFrame: [0.97, 0.95, 0.9], bands: false,
    gable: { layer: L.TILE, color: [0.95, 0.85, 0.8], rise: 3.0, over: 0.55, fascia: [0.97, 0.95, 0.9] },
    front: {
      doors: [{ u0: 8.4, u1: 9.6, h: 2.3, color: [0.72, 0.14, 0.18], glass: true, frame: [0.97, 0.95, 0.9], lamp: true }],
      ground: [[1.2, 2.8, 0.9, 2.5], [4.0, 5.6, 0.9, 2.5], [5.9, 7.5, 0.9, 2.5], [11.0, 12.6, 0.9, 2.5], [12.9, 14.5, 0.9, 2.5], [15.6, 17.2, 0.9, 2.5]],
      groundShutters: [0.72, 0.14, 0.18],
      groundKind: 5,
      extra(B, w, H) {
        board(T, B, { u0: 5.0, u1: 13.0, v0: 2.85, v1: 3.5, item: I.sign_pierogi, frameColor: [0.72, 0.14, 0.18] });
        const F = B.F;
        const pts = [];
        for (let k = 0; k <= 30; k++) pts.push([0.3 + (k / 30) * (w - 0.6), H - 0.15 - Math.sin((k / 30) * Math.PI * 4) * 0.18 - 0.1, 0.5]);
        F.with({ layer: L.FLAT, color: [0.05, 0.05, 0.05], rough: 0.5 }, () => F.tube(pts, 0.006, 3));
        F.with({ layer: L.FLAT, color: [1.0, 0.78, 0.45], glow: 7, channel: 13 }, () => { for (const p of pts) F.box(p[0] - 0.03, p[1] - 0.09, p[2] - 0.03, p[0] + 0.03, p[1] - 0.02, p[2] + 0.03); });
        for (const [u0, u1] of [[1.2, 2.8], [4.0, 5.6], [5.9, 7.5], [11.0, 12.6], [12.9, 14.5], [15.6, 17.2]]) {
          B.F.with({ layer: L.PLANK, color: [0.72, 0.14, 0.18], wear: 0.5, rough: -1 }, () => B.F.box(u0 - 0.05, 0.6, 0.08, u1 + 0.05, 0.82, 0.34));
          B.F.with({ layer: L.FLAT, color: [0.25, 0.5, 0.18], rough: 0.8 }, () => { for (let k = 0; k < 5; k++) B.F.box(u0 + k * 0.32, 0.8, 0.12, u0 + k * 0.32 + 0.18, 0.98 + (k % 2) * 0.08, 0.3); });
          B.F.with({ layer: L.FLAT, color: [0.95, 0.25, 0.35], rough: 0.7 }, () => { for (let k = 0; k < 4; k++) B.F.box(u0 + 0.2 + k * 0.36, 0.96, 0.16, u0 + 0.28 + k * 0.36, 1.04, 0.26); });
        }
        B.FD.fit(I.neon_open, 13.7, 1.6, 0.6, -0.12, { glow: 3, channel: 2 });
      },
    },
    left: { ground: [[3.0, 4.6, 0.9, 2.5], [10.0, 11.6, 0.9, 2.5]], groundShutters: [0.72, 0.14, 0.18], groundKind: 5, extra(B, w) { art(T, B, [['tag_kotek', 13.5, 1.4, 1.1]]); } },
    right: { ground: [[3.0, 4.6, 0.9, 2.5], [10.0, 11.6, 0.9, 2.5]], groundShutters: [0.72, 0.14, 0.18], groundKind: 5 },
    back: { extra(B, w, H) { backSide(T, B, w, { H }); B.F.with({ layer: L.FLAT, color: [0.3, 0.3, 0.3], metal: 0.7, rough: 0.4 }, () => B.F.tube([[w - 2, H - 0.5, 0.2], [w - 2, H + 2.6, 0.2]], 0.15, 10)); } },
  }));

  const houses = [
    ['house1', 'E', PAL.sky, [0.45, 0.4, 0.38], PAL.white],
    ['house2', 'W', PAL.peach, [0.55, 0.32, 0.24], PAL.white],
    ['house3', 'N', PAL.mint, [0.42, 0.42, 0.45], PAL.white],
  ];
  for (const [id, face, color, roof, trim] of houses) {
    const p = plot(id);
    const h = commercial(T, p, {
      face, floors: 1, ground: 3.0, base: TOWN.ground + 0.55, wall: { color, layer: L.PLANK, wear: 0.5 }, trim, winFrame: trim, bands: false,
      gable: { layer: L.TILE, color: roof, rise: 2.4, over: 0.6, fascia: trim },
      front: {
        doors: [{ u0: 5.6, u1: 6.6, h: 2.15, color: [color[0] * 0.5, color[1] * 0.5, color[2] * 0.5], frame: trim, glass: true, lamp: true }],
        ground: [[1.4, 3.0, 0.8, 2.2], [8.4, 10.0, 0.8, 2.2]],
        groundShutters: [color[0] * 0.55, color[1] * 0.55, color[2] * 0.55],
        extra(B, w, H) {
          const S = B.S;
          S.with({ layer: L.PLANK, color: [0.6, 0.48, 0.36], wear: 0.6, rough: -1 }, () => S.box(0.5, -0.2, 0, w - 0.5, -0.02, 2.2));
          S.with({ layer: L.CONCRETE, color: [0.8, 0.78, 0.74], wear: 0.7, rough: -1 }, () => {
            S.box(5.3, -0.38, 2.2, 6.9, -0.2, 2.6);
            S.box(5.3, -0.55, 2.6, 6.9, -0.38, 3.0);
          });
          S.with({ layer: L.FLAT, color: trim, wear: 0.5, rough: 0.6 }, () => {
            for (const u of [0.6, 4.6, 7.4, w - 0.6]) S.box(u - 0.1, -0.02, 1.95, u + 0.1, H - 0.05, 2.15);
            S.box(0.5, H - 0.25, 0, w - 0.5, H - 0.05, 2.2);
            for (let u = 0.8; u < w - 0.6; u += 0.16) if (u < 5.2 || u > 7.0) S.box(u - 0.02, -0.02, 2.1, u + 0.02, 0.8, 2.14);
            S.box(0.5, 0.8, 2.08, 5.2, 0.86, 2.16);
            S.box(7.0, 0.8, 2.08, w - 0.5, 0.86, 2.16);
          });
          S.with({ layer: L.TILE, color: roof, wear: 0.5, rough: -1 }, () => S.quad([0.3, H - 0.05, 2.45], [w - 0.3, H - 0.05, 2.45], [w - 0.3, H + 0.45, 0.02], [0.3, H + 0.45, 0.02]));
          S.with({ layer: L.PLANK, color: trim, wear: 0.4, rough: -1 }, () => S.quad([w - 0.3, H - 0.07, 2.45], [0.3, H - 0.07, 2.45], [0.3, H + 0.43, 0.02], [w - 0.3, H + 0.43, 0.02]));
          acUnit(T, B, w - 1.0, -0.5, 2.3);
          B.F.with({ layer: L.FLAT, color: [0.15, 0.3, 0.6], wear: 0.6, rough: 0.5, metal: 0.4 }, () => B.F.box(1.0, 0.6, 2.25, 1.35, 0.85, 2.6));
          B.F.with({ layer: L.FLAT, color: [0.97, 0.97, 0.95], wear: 0.6, rough: 0.5 }, () => {
            B.F.box(0.2, -0.75, 3.4, 0.24, 0.1, 3.6);
            B.F.box(0.1, 0.1, 3.3, 0.34, 0.35, 3.7);
          });
        },
      },
      left: { ground: [[2.5, 4.0, 0.8, 2.2], [8.0, 9.5, 0.8, 2.2]], extra(B, w) { acUnit(T, B, 6.0, -0.5, 0.02); downspout(B, 0.3, 3.0); } },
      right: { ground: [[2.5, 4.0, 0.8, 2.2], [8.0, 9.5, 0.8, 2.2]], extra(B, w) { meters(T, B, 5.0, 0.5); } },
      back: { ground: [[2.0, 3.2, 1.0, 2.2], [9.0, 10.2, 1.0, 2.2]], doors: [{ u0: 5.5, u1: 6.4, h: 2.1, color: trim, frame: trim, lamp: true }] },
    });
    out.push(h);
  }

  out.push(commercial(T, plot('diner'), {
    floors: 1, ground: 3.6, base: TOWN.ground + 0.45, wall: { color: [0.8, 0.82, 0.84], layer: L.FLAT, metal: 0.85, rough: 0.28, wear: 0.4 }, trim: [0.78, 0.12, 0.1], frame: [0.85, 0.86, 0.88], parapet: 0.35, bands: false,
    front: {
      shops: [{ u0: 1.2, u1: 22.8, door: 7, divs: 14, h: 2.7, kind: 5, depth: 8, frame: [0.85, 0.86, 0.88], bulk: 0.95, bulkColor: [0.78, 0.12, 0.1], metal: 0.9 }],
      extra(B, w, H) {
        B.S.with({ layer: L.FLAT, color: [0.78, 0.12, 0.1], wear: 0.3, rough: 0.35, metal: 0.3 }, () => {
          B.S.box(0, 2.85, -0.02, w, 3.05, 0.06);
          B.S.box(0, 3.25, -0.02, w, 3.35, 0.06);
        });
        B.S.with({ layer: L.FLAT, color: [0.82, 0.84, 0.86], metal: 0.9, rough: 0.25 }, () => {
          B.S.cyl(0.0, -0.45, -0.6, H + 0.3, 0.62, 16);
          B.S.cyl(w, -0.45, -0.6, H + 0.3, 0.62, 16);
          B.S.box(9.6, -0.45, 0, 14.4, -0.25, 1.6);
          B.S.box(10.0, -0.25, 0, 14.0, -0.02, 0.9);
        });
        B.S.with({ layer: L.FLAT, color: [0.15, 0.15, 0.16], metal: 0.6, rough: 0.4 }, () => {
          for (const u of [7.4, 16.6]) B.S.box(u - 0.08, H, -2.0, u + 0.08, H + 3.2, -1.84);
          B.S.box(6.6, H + 0.4, -2.05, 17.4, H + 0.5, -1.8);
        });
        board(T, B, { u0: 6.8, u1: 17.2, v0: H + 0.55, v1: H + 3.2, z: -1.9, item: I.neon_diner, frame: false, glow: 3.4, channel: 1 });
        B.FD.fit(I.neon_open, 13.2, 1.9, 0.7, -0.12, { glow: 3, channel: 2 });
        B.FD.fit(I.poster_band, 15.6, 1.75, 0.42, -0.11);
      },
    },
    left: { extra(B, w) { art(T, B, [['tag_okay', 5, 1.4, 1.2]]); } },
    right: { extra(B, w) { art(T, B, [['throw_yes', 4.5, 1.5, 2.0]]); } },
    back: { extra(B, w, H) { backSide(T, B, w, { H }); } },
  }));
  return out;
}
