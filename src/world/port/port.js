// Costa del Gzowo marina: the town harbour built in its own frame from PORT (quay wall and apron, gangway, floating pontoons and finger slips, fuel dock, harbour office, slipway, crane, lamps, bollards, fenders, ladders, life rings, benches, signs, bobbing buoys and channel markers) with walkable colliders.
import * as THREE from 'three';
import { PORT, portPoint, LAYERS } from '../../config.js';
import { Surface, Glass, Decals, CHANNELS, L } from '../town/kit.js';
import { SITE } from './site.js';

export { portSite } from './site.js';

const UP = new THREE.Vector3(0, 1, 0);
const DECK = 0.55;
const SPINE = { v: -8, half: 1.2, u0: 5, u1: 30 };
const FINGERS = [6, 13, 20, 27];
const FINGER = { half: 0.55, v1: -9.2, v0: -18.4 };
const THEAD = { u0: 30, u1: 32.6, v0: -18, v1: 2 };
const OFFICE = { u0: -13.6, u1: -6.6, v0: -31, v1: -21, h: 3.8 };
const C = {
  quay: [0.74, 0.72, 0.67], coping: [0.86, 0.84, 0.79], wet: [0.3, 0.33, 0.29], deck: [0.55, 0.42, 0.3], float: [0.16, 0.17, 0.18], pile: [0.2, 0.21, 0.22],
  iron: [0.06, 0.06, 0.065], white: [0.9, 0.89, 0.85], teal: [0.07, 0.3, 0.32], navy: [0.1, 0.15, 0.27], yellow: [0.9, 0.68, 0.12], orange: [0.95, 0.4, 0.1],
  rope: [0.62, 0.55, 0.42], rubber: [0.03, 0.03, 0.03], steel: [0.6, 0.62, 0.64], wood: [0.42, 0.28, 0.16], red: [0.75, 0.1, 0.07], green: [0.05, 0.45, 0.2],
};

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const panel = (x, y, w, h, bg, fg, text, font) => {
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font;
    g.fillText(text, x + w / 2, y + h / 2 + 4, w - 40);
  };
  panel(0, 0, 1024, 200, '#123a4a', '#f3ead8', 'GZOWO SPRINGS MARINA', `700 96px ${SANS}`);
  panel(0, 200, 640, 120, '#f3ead8', '#123a4a', 'HARBOUR OFFICE', `700 64px ${SANS}`);
  panel(640, 200, 384, 120, '#e8b21c', '#1a1a1a', 'FUEL', `800 78px ${SANS}`);
  ['A1', 'A2', 'A3', 'A4'].forEach((t, i) => panel(i * 128, 320, 128, 96, '#123a4a', '#f3ead8', t, `700 56px ${SANS}`));
  panel(512, 320, 512, 96, '#f3ead8', '#123a4a', 'NO WAKE  5 KN', `700 56px ${SANS}`);
  panel(0, 416, 512, 96, '#123a4a', '#f3ead8', 'SLIPWAY', `700 56px ${SANS}`);
  panel(512, 416, 512, 96, '#f3ead8', '#123a4a', 'VISITOR BERTH', `700 52px ${SANS}`);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const item = (x, y, w, h) => ({ uv: [x / 1024, 1 - (y + h) / 512, (x + w) / 1024, 1 - y / 512], aspect: w / h });
  return {
    texture: t,
    items: {
      marina: item(0, 0, 1024, 200), office: item(0, 200, 640, 120), fuel: item(640, 200, 384, 120),
      slips: [0, 1, 2, 3].map((i) => item(i * 128, 320, 128, 96)), wake: item(512, 320, 512, 96), slipway: item(0, 416, 512, 96), visitor: item(512, 416, 512, 96),
    },
  };
}

function buoyGeometry(kind) {
  const S = new Surface();
  S.paint({ layer: L.FLAT, wear: 0.3, rough: 0.5, sway: 0.0004 });
  if (kind === 'mooring') {
    S.with({ color: C.yellow }, () => S.cyl(0, -0.35, 0, 0.25, 0.42, 14, { r1: 0.36 }));
    S.with({ color: C.steel, metal: 1, rough: 0.35 }, () => S.cyl(0, 0.25, 0, 0.42, 0.05, 8));
    return S.geometry();
  }
  const color = kind === 'port' ? C.red : C.green;
  S.with({ color: [0.12, 0.12, 0.12] }, () => S.cyl(0, -0.6, 0, 0.0, 0.75, 16, { r1: 0.8 }));
  S.with({ color }, () => S.cyl(0, 0.0, 0, 0.35, 0.8, 16, { r1: 0.6 }));
  S.with({ color }, () => {
    for (const [x, z] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) S.tube([[x, 0.3, z], [x * 0.3, 2.1, z * 0.3]], 0.04, 6);
    S.cyl(0, 1.2, 0, 1.3, 0.3, 12);
  });
  S.with({ color }, () => {
    if (kind === 'port') S.cyl(0, 2.1, 0, 2.6, 0.22, 12);
    else S.cyl(0, 2.1, 0, 2.7, 0.3, 12, { r1: 0.02 });
  });
  S.with({ color: kind === 'port' ? [1, 0.25, 0.1] : [0.2, 1, 0.4], glow: 6, channel: CHANNELS.BLINK }, () => S.cyl(0, kind === 'port' ? 2.6 : 2.7, 0, kind === 'port' ? 2.75 : 2.82, 0.07, 8));
  return S.geometry();
}

export async function createPort(ctx) {
  const { scene, physics } = ctx;
  const R = physics.RAPIER;
  const mats = ctx.town.materials;
  const atlas = ctx.town.atlas.items;
  const S = new Surface();
  const G = new Glass();
  const D = new Decals();
  const SD = new Decals();
  for (const k of [S, G, D, SD]) k.frame(PORT.x, 0, PORT.z, PORT.heading);
  const sign = signTexture();
  const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, PORT.heading);
  const obstacles = [];
  let colliders = 0;

  const box = (u0, u1, y0, y1, v0, v1, skip = '') => S.box(Math.min(u0, u1), y0, -Math.max(v0, v1), Math.max(u0, u1), y1, -Math.min(v0, v1), skip);
  const cyl = (u, y0, v, y1, r, seg = 10, opts = {}) => S.cyl(u, y0, -v, y1, r, seg, opts);
  const tube = (pts, r, seg = 6) => S.tube(pts.map(([u, y, v]) => [u, y, -v]), r, seg);
  const ring = (u, y, v, r, tr, color) => {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      pts.push([u + Math.cos(a) * r * 0.06, y + Math.sin(a) * r, v + Math.cos(a) * r]);
    }
    S.with({ color, layer: L.FLAT, rough: 0.6 }, () => tube(pts, tr, 6));
  };
  const solid = (u0, u1, y0, y1, v0, v1, surface = 'concrete', tilt = 0) => {
    const c = portPoint((u0 + u1) / 2, (v0 + v1) / 2);
    const q = tilt ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PORT.heading, tilt, 'YXZ')) : yawQ;
    const desc = R.ColliderDesc.cuboid(Math.abs(u1 - u0) / 2, (y1 - y0) / 2, Math.abs(v1 - v0) / 2).setTranslation(c.x, (y0 + y1) / 2, c.z).setRotation(q).setFriction(0.9);
    physics.tag(physics.world.createCollider(desc), surface);
    colliders++;
  };
  const post = (u, y0, y1, v, r, surface = 'metal') => {
    const c = portPoint(u, v);
    physics.staticCylinder(c.x, y0, y1, c.z, r, surface);
    colliders++;
  };
  const pile = (u, v, top = 2.3) => {
    S.with({ layer: L.FLAT, color: C.pile, rough: 0.55, metal: 0.6 }, () => cyl(u, -5, v, top, 0.17, 12));
    S.with({ layer: L.FLAT, color: C.white, rough: 0.5 }, () => cyl(u, top, v, top + 0.08, 0.2, 12));
    S.with({ layer: L.FLAT, color: C.wet, rough: 0.9 }, () => cyl(u, -0.4, v, 0.25, 0.175, 12, { caps: false }));
    post(u, -5, top, v, 0.17);
    const c = portPoint(u, v);
    obstacles.push({ x: c.x, z: c.z, radius: 0.17 });
  };
  const cleat = (u, v, along = 'u') => S.with({ layer: L.FLAT, color: C.steel, metal: 1, rough: 0.3 }, () => {
    if (along === 'u') box(u - 0.15, u + 0.15, DECK, DECK + 0.07, v - 0.03, v + 0.03);
    else box(u - 0.03, u + 0.03, DECK, DECK + 0.07, v - 0.15, v + 0.15);
  });
  const coil = (u, y, v, r = 0.22) => {
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        pts.push([u + Math.cos(a) * (r - k * 0.05), y + 0.03 + k * 0.035, v + Math.sin(a) * (r - k * 0.05)]);
      }
      S.with({ layer: L.FLAT, color: C.rope, rough: 0.95 }, () => tube(pts, 0.025, 5));
    }
  };

  const pontoon = (u0, u1, v0, v1) => {
    S.with({ layer: L.FLAT, color: C.float, rough: 0.8 }, () => box(u0 + 0.08, u1 - 0.08, -0.35, DECK - 0.1, v0 + 0.08, v1 - 0.08));
    S.with({ layer: L.PLANK, color: C.deck, wear: 0.55 }, () => box(u0, u1, DECK - 0.1, DECK, v0, v1, 'ny'));
    S.with({ layer: L.FLAT, color: [0.32, 0.22, 0.13], rough: 0.85 }, () => {
      box(u0 - 0.06, u0, DECK - 0.22, DECK - 0.02, v0, v1);
      box(u1, u1 + 0.06, DECK - 0.22, DECK - 0.02, v0, v1);
      box(u0, u1, DECK - 0.22, DECK - 0.02, v0 - 0.06, v0);
      box(u0, u1, DECK - 0.22, DECK - 0.02, v1, v1 + 0.06);
    });
    solid(u0, u1, -0.35, DECK, v0, v1, 'wood');
  };

  const q = SITE.quay;
  const a = SITE.apron;
  const sw = SITE.slipway;
  S.with({ layer: L.PAVER, color: C.quay, wear: 0.6 }, () => {
    box(a.u0, -0.6, 1.4, SITE.land, q.v0, sw.v0, 'ny');
    box(a.u0, sw.u0, 1.4, SITE.land, sw.v0, q.v1, 'ny');
  });
  S.with({ layer: L.CONCRETE, color: C.coping, wear: 0.4 }, () => box(-0.6, 0, 1.4, SITE.land + 0.05, q.v0, sw.v0, 'ny'));
  S.with({ layer: L.CONCRETE, color: C.quay, wear: 0.8 }, () => {
    box(-0.6, 0, -4.5, 1.4, q.v0, sw.v0, 'py');
    box(a.u0, a.u0 + 0.4, -4.5, 1.4, q.v0, q.v1, 'py');
    box(a.u0, -0.6, -4.5, 1.4, q.v0, q.v0 + 0.4, 'py');
  });
  S.with({ layer: L.CONCRETE, color: C.wet, wear: 1 }, () => box(0, 0.01, -1.2, 0.35, q.v0, sw.v0, 'py nx ny'));
  solid(a.u0, 0, -4.5, SITE.land, q.v0, sw.v0, 'concrete');
  solid(a.u0, sw.u0, -4.5, SITE.land, sw.v0, q.v1, 'concrete');

  const rampLen = Math.hypot(sw.u1 - sw.u0, sw.top - sw.bottom);
  const tilt = -Math.atan2(sw.top - sw.bottom, sw.u1 - sw.u0);
  S.push(new THREE.Matrix4().compose(new THREE.Vector3((sw.u0 + sw.u1) / 2, (sw.top + sw.bottom) / 2, -(sw.v0 + sw.v1) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt), new THREE.Vector3(1, 1, 1)));
  S.with({ layer: L.CONCRETE, color: [0.66, 0.65, 0.6], wear: 0.9 }, () => S.box(-rampLen / 2, -0.5, -(sw.v1 - sw.v0) / 2, rampLen / 2, 0, (sw.v1 - sw.v0) / 2));
  S.with({ layer: L.FLAT, color: [0.5, 0.49, 0.45], rough: 0.9 }, () => {
    for (let i = 1; i < 18; i++) S.box(-rampLen / 2 + i * (rampLen / 18) - 0.03, 0, -(sw.v1 - sw.v0) / 2 + 0.3, -rampLen / 2 + i * (rampLen / 18) + 0.03, 0.025, (sw.v1 - sw.v0) / 2 - 0.3);
  });
  S.pop();
  const rc = portPoint((sw.u0 + sw.u1) / 2, (sw.v0 + sw.v1) / 2);
  const rampQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PORT.heading, tilt, 'YXZ'));
  physics.tag(physics.world.createCollider(R.ColliderDesc.cuboid(rampLen / 2, 0.25, (sw.v1 - sw.v0) / 2).setTranslation(rc.x, (sw.top + sw.bottom) / 2 - 0.25, rc.z).setRotation(rampQ).setFriction(0.9)), 'concrete');
  S.with({ layer: L.CONCRETE, color: C.quay, wear: 0.8 }, () => {
    box(sw.u0, 0, -4.5, SITE.land, sw.v0 - 0.4, sw.v0, 'ny');
    box(sw.u0, -0.6, -4.5, SITE.land, sw.v1, sw.v1 + 0.4, 'ny');
  });
  S.with({ layer: L.FLAT, color: C.yellow, rough: 0.6 }, () => {
    for (const v of [sw.v0 + 0.15, sw.v1 - 0.15]) box(sw.u0 - 0.1, sw.u0 + 0.1, SITE.land, SITE.land + 0.02, v - 0.1, v + 0.1);
  });

  for (let v = q.v0 + 3; v < sw.v0 - 1; v += 6.5) {
    if (Math.abs(v - SPINE.v) < 2 || Math.abs(v - 16) < 1.5) continue;
    S.with({ layer: L.FLAT, color: C.iron, rough: 0.55, metal: 0.7 }, () => {
      cyl(-0.55, SITE.land, v, SITE.land + 0.42, 0.17, 12);
      cyl(-0.55, SITE.land + 0.42, v, SITE.land + 0.5, 0.25, 12);
    });
    post(-0.55, SITE.land, SITE.land + 0.5, v, 0.2);
  }
  for (let v = q.v0 + 1.5; v < sw.v0 - 0.5; v += 4) {
    if (Math.abs(v - SPINE.v) < 1.2) continue;
    S.with({ layer: L.FLAT, color: C.rubber, rough: 0.92 }, () => box(0, 0.22, -0.5, 1.35, v - 0.17, v + 0.17));
  }
  for (const v of [-15, 9, 27]) {
    S.with({ layer: L.FLAT, color: C.steel, metal: 1, rough: 0.4 }, () => {
      for (const dv of [-0.25, 0.25]) tube([[0.1, -1.8, v + dv], [0.1, SITE.land + 0.05, v + dv], [-0.4, SITE.land + 0.9, v + dv], [-0.4, SITE.land, v + dv]], 0.022, 6);
      for (let y = -1.6; y < SITE.land; y += 0.3) box(0.06, 0.12, y, y + 0.03, v - 0.25, v + 0.25);
    });
  }

  for (let v = q.v0 + 4; v < q.v1 - 2; v += 12) {
    const top = SITE.land + 4.6;
    S.with({ layer: L.FLAT, color: C.navy, rough: 0.45, metal: 0.4 }, () => {
      cyl(-2.6, SITE.land, v, SITE.land + 0.3, 0.13, 10);
      cyl(-2.6, SITE.land + 0.3, v, top, 0.065, 10);
      tube([[-2.6, top - 0.05, v], [-2.1, top + 0.15, v], [-1.75, top + 0.12, v]], 0.04, 6);
      box(-1.95, -1.45, top - 0.02, top + 0.16, v - 0.17, v + 0.17);
    });
    S.with({ layer: L.FLAT, color: [1.0, 0.86, 0.62], glow: 5.5, channel: CHANNELS.LAMP, rough: 0.2 }, () => box(-1.9, -1.5, top - 0.06, top - 0.01, v - 0.13, v + 0.13));
    post(-2.6, SITE.land, top, v, 0.08);
  }
  for (const v of [-4, 3, 22]) {
    S.with({ layer: L.PLANK, color: C.wood, wear: 0.5 }, () => {
      for (let k = 0; k < 4; k++) box(-4.75 + k * 0.13, -4.65 + k * 0.13, SITE.land + 0.45, SITE.land + 0.49, v - 0.9, v + 0.9);
      for (let k = 0; k < 3; k++) box(-4.85 - k * 0.0, -4.81, SITE.land + 0.55 + k * 0.13, SITE.land + 0.64 + k * 0.13, v - 0.9, v + 0.9);
    });
    S.with({ layer: L.FLAT, color: C.iron, metal: 0.6, rough: 0.5 }, () => {
      for (const dv of [-0.75, 0.75]) {
        box(-4.85, -4.3, SITE.land, SITE.land + 0.45, v + dv - 0.03, v + dv + 0.03);
        box(-4.88, -4.8, SITE.land + 0.45, SITE.land + 0.95, v + dv - 0.03, v + dv + 0.03);
      }
    });
    solid(-4.9, -4.25, SITE.land, SITE.land + 0.5, v - 0.9, v + 0.9, 'wood');
  }
  for (const v of [-21, 5, 30]) {
    S.with({ layer: L.FLAT, color: C.white, rough: 0.6 }, () => {
      box(-1.05, -0.95, SITE.land, SITE.land + 1.5, v - 0.05, v + 0.05);
      box(-1.1, -0.9, SITE.land + 1.5, SITE.land + 1.56, v - 0.42, v + 0.42);
    });
    ring(-0.92, SITE.land + 1.0, v, 0.34, 0.07, C.orange);
    S.with({ layer: L.FLAT, color: C.white, rough: 0.6 }, () => {
      for (const ang of [0.6, 2.2, 3.8, 5.4]) box(-0.94, -0.9, SITE.land + 1.0 + Math.sin(ang) * 0.34 - 0.05, SITE.land + 1.0 + Math.sin(ang) * 0.34 + 0.05, v + Math.cos(ang) * 0.34 - 0.06, v + Math.cos(ang) * 0.34 + 0.06);
    });
    post(-1.0, SITE.land, SITE.land + 1.5, v, 0.08);
  }

  const gw = { u0: -0.4, u1: SPINE.u0 + 0.2, v0: SPINE.v - 0.7, v1: SPINE.v + 0.7 };
  const gLen = Math.hypot(gw.u1 - gw.u0, SITE.land - DECK);
  const gTilt = -Math.atan2(SITE.land - DECK, gw.u1 - gw.u0);
  S.push(new THREE.Matrix4().compose(new THREE.Vector3((gw.u0 + gw.u1) / 2, (SITE.land + DECK) / 2, -SPINE.v), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), gTilt), new THREE.Vector3(1, 1, 1)));
  S.with({ layer: L.FLAT, color: C.steel, metal: 0.9, rough: 0.4 }, () => {
    S.box(-gLen / 2, -0.12, -0.72, gLen / 2, 0, 0.72);
    for (const z of [-0.7, 0.7]) {
      S.box(-gLen / 2, 0.9, z - 0.03, gLen / 2, 0.95, z + 0.03);
      for (let i = 0; i <= 5; i++) S.box(-gLen / 2 + (i / 5) * gLen - 0.025, 0, z - 0.025, -gLen / 2 + (i / 5) * gLen + 0.025, 0.92, z + 0.025);
    }
  });
  S.with({ layer: L.PLANK, color: C.deck, wear: 0.4 }, () => {
    for (let i = 0; i < 14; i++) S.box(-gLen / 2 + 0.05 + i * (gLen / 14), 0, -0.66, -gLen / 2 + (i + 0.6) * (gLen / 14), 0.04, 0.66);
  });
  S.pop();
  const gc = portPoint((gw.u0 + gw.u1) / 2, SPINE.v);
  physics.tag(physics.world.createCollider(R.ColliderDesc.cuboid(gLen / 2, 0.08, 0.72).setTranslation(gc.x, (SITE.land + DECK) / 2 - 0.08, gc.z).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PORT.heading, gTilt, 'YXZ'))).setFriction(0.9)), 'metal');
  for (const side of [-1, 1]) {
    const c = portPoint((gw.u0 + gw.u1) / 2, SPINE.v + side * 0.78);
    physics.tag(physics.world.createCollider(R.ColliderDesc.cuboid(gLen / 2, 0.5, 0.04).setTranslation(c.x, (SITE.land + DECK) / 2 + 0.45, c.z).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PORT.heading, gTilt, 'YXZ')))), 'metal');
  }

  pontoon(SPINE.u0, SPINE.u1, SPINE.v - SPINE.half, SPINE.v + SPINE.half);
  FINGERS.forEach((u, i) => {
    pontoon(u - FINGER.half, u + FINGER.half, FINGER.v0, FINGER.v1);
    pile(u, FINGER.v0 - 0.25);
    for (const side of [-1, 1]) for (const v of [FINGER.v0 + 1.2, FINGER.v0 + 5.5]) cleat(u + side * (FINGER.half - 0.12), v);
    if (i < 3) coil(u + 0.15, DECK, FINGER.v1 - 2.5);
    S.with({ layer: L.FLAT, color: C.white, rough: 0.6 }, () => box(u - 0.04, u + 0.04, DECK, DECK + 1.1, FINGER.v1 - 0.45, FINGER.v1 - 0.37));
    if (i < 3) SD.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(sign.items.slips[i], (FINGER.v1 - 0.41) - 0.34, DECK + 0.82, (FINGER.v1 - 0.41) + 0.34, DECK + 1.33, u + 0.05).pop();
  });
  for (let u = SPINE.u0 + 3; u < SPINE.u1; u += 6.5) pile(u, SPINE.v + SPINE.half + 0.25);
  pontoon(THEAD.u0, THEAD.u1, THEAD.v0, THEAD.v1);
  for (const v of [THEAD.v0 + 0.3, THEAD.v1 - 0.3]) pile(THEAD.u1 + 0.25, v);
  pile(THEAD.u1 + 0.25, (THEAD.v0 + THEAD.v1) / 2);
  for (const v of [THEAD.v0 + 2, THEAD.v0 + 8, -3]) cleat(THEAD.u1 - 0.12, v, 'v');
  S.with({ layer: L.FLAT, color: C.rubber, rough: 0.9 }, () => {
    for (let v = THEAD.v0 + 1; v < THEAD.v1; v += 2.5) box(THEAD.u1, THEAD.u1 + 0.16, DECK - 0.4, DECK - 0.05, v - 0.4, v + 0.4);
  });
  const pump = { u: THEAD.u0 + 1.1, v: -2 };
  S.with({ layer: L.FLAT, color: C.yellow, rough: 0.5 }, () => box(pump.u - 0.3, pump.u + 0.3, DECK, DECK + 1.5, pump.v - 0.22, pump.v + 0.22));
  S.with({ layer: L.FLAT, color: C.iron, rough: 0.6 }, () => {
    box(pump.u - 0.32, pump.u + 0.32, DECK, DECK + 0.12, pump.v - 0.25, pump.v + 0.25);
    tube([[pump.u + 0.25, DECK + 1.1, pump.v + 0.18], [pump.u + 0.45, DECK + 0.6, pump.v + 0.3], [pump.u + 0.4, DECK + 0.2, pump.v + 0.5], [pump.u + 0.32, DECK + 0.9, pump.v + 0.25]], 0.02, 6);
  });
  D.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(atlas.pump_face, pump.v - 0.17, DECK + 0.3, pump.v + 0.17, DECK + 1.0, pump.u + 0.305).pop();
  for (const [du, dv] of [[-0.6, -1.2], [0.6, -1.2], [-0.6, 1.2], [0.6, 1.2]]) {
    S.with({ layer: L.FLAT, color: C.white, rough: 0.5 }, () => cyl(pump.u + du, DECK, pump.v + dv, DECK + 2.6, 0.05, 8));
  }
  S.with({ layer: L.FLAT, color: C.teal, rough: 0.5 }, () => box(pump.u - 0.85, pump.u + 0.85, DECK + 2.6, DECK + 2.78, pump.v - 1.45, pump.v + 1.45));
  S.with({ layer: L.FLAT, color: [1, 0.92, 0.75], glow: 4, channel: CHANNELS.LAMP }, () => box(pump.u - 0.4, pump.u + 0.4, DECK + 2.57, DECK + 2.6, pump.v - 0.8, pump.v + 0.8));
  SD.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(sign.items.fuel, pump.v - 0.7, DECK + 2.62, pump.v + 0.7, DECK + 2.76, pump.u + 0.86).pop();
  solid(pump.u - 0.3, pump.u + 0.3, DECK, DECK + 1.5, pump.v - 0.22, pump.v + 0.22, 'metal');

  const plank = { u0: -0.3, u1: 1.05, v: 16 };
  S.with({ layer: L.PLANK, color: C.deck, wear: 0.4 }, () => box(plank.u0, plank.u1, SITE.land + 0.1, SITE.land + 0.18, plank.v - 0.55, plank.v + 0.55));
  S.with({ layer: L.FLAT, color: C.steel, metal: 1, rough: 0.35 }, () => {
    for (const dv of [-0.55, 0.55]) {
      for (const u of [plank.u0 + 0.1, plank.u1 - 0.05]) cyl(u, SITE.land + 0.18, plank.v + dv, SITE.land + 1.1, 0.02, 6);
      tube([[plank.u0 + 0.1, SITE.land + 1.1, plank.v + dv], [plank.u1 - 0.05, SITE.land + 1.1, plank.v + dv]], 0.012, 5);
    }
  });
  solid(plank.u0, plank.u1, SITE.land + 0.02, SITE.land + 0.18, plank.v - 0.55, plank.v + 0.55, 'wood');
  SD.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(sign.items.visitor, plank.v + 2.2, SITE.land + 1.0, plank.v + 4.2, SITE.land + 1.4, -2.29).pop();
  S.with({ layer: L.FLAT, color: C.white, rough: 0.6 }, () => {
    for (const v of [plank.v + 2.3, plank.v + 4.1]) box(-2.36, -2.3, SITE.land, SITE.land + 1.45, v - 0.04, v + 0.04);
  });

  const cr = { u: -1.6, v: 30.4 };
  S.with({ layer: L.FLAT, color: C.yellow, rough: 0.5, metal: 0.3 }, () => {
    cyl(cr.u, SITE.land, cr.v, SITE.land + 0.4, 0.55, 12);
    cyl(cr.u, SITE.land + 0.4, cr.v, SITE.land + 6.4, 0.22, 12);
    box(cr.u - 0.6, cr.u + 5.2, SITE.land + 6.2, SITE.land + 6.65, cr.v - 0.16, cr.v + 0.16);
    tube([[cr.u, SITE.land + 4.2, cr.v], [cr.u + 3.2, SITE.land + 6.2, cr.v]], 0.07, 6);
  });
  S.with({ layer: L.FLAT, color: C.iron, rough: 0.5, metal: 0.8 }, () => {
    tube([[cr.u + 4.7, SITE.land + 6.2, cr.v], [cr.u + 4.7, SITE.land + 2.4, cr.v]], 0.015, 4);
    box(cr.u + 4.55, cr.u + 4.85, SITE.land + 2.1, SITE.land + 2.45, cr.v - 0.12, cr.v + 0.12);
    box(cr.u - 0.9, cr.u - 0.3, SITE.land + 5.9, SITE.land + 6.6, cr.v - 0.3, cr.v + 0.3);
  });
  post(cr.u, SITE.land, SITE.land + 6.4, cr.v, 0.4);
  SD.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(sign.items.slipway, (sw.v0 + sw.v1) / 2 - 1.1, SITE.land + 1.2, (sw.v0 + sw.v1) / 2 + 1.1, SITE.land + 1.62, sw.u0 - 1.2).pop();
  S.with({ layer: L.FLAT, color: C.white, rough: 0.6 }, () => {
    for (const dv of [-1.0, 1.0]) box(sw.u0 - 1.26, sw.u0 - 1.2, SITE.land, SITE.land + 1.64, (sw.v0 + sw.v1) / 2 + dv - 0.04, (sw.v0 + sw.v1) / 2 + dv + 0.04);
  });

  const o = OFFICE;
  const base = SITE.land;
  S.with({ layer: L.PLASTER, color: C.white, wear: 0.35 }, () => {
    S.frame(o.u1, base, 0, Math.PI / 2);
    S.wall(o.v0, o.v1, 0, o.h, [[o.v0 + 0.8, 0.9, o.v0 + 3.2, 2.7], [o.v0 + 4.2, 0, o.v0 + 5.8, 2.6], [o.v0 + 6.8, 0.9, o.v1 - 0.8, 2.7]]);
    S.pop();
    S.frame(o.u0, base, 0, -Math.PI / 2);
    S.wall(-o.v1, -o.v0, 0, o.h, [[-o.v1 + 2, 1.0, -o.v1 + 4, 2.4], [-o.v1 + 6, 1.0, -o.v1 + 8, 2.4]]);
    S.pop();
    S.frame(0, base, -o.v1, Math.PI);
    S.wall(-o.u1, -o.u0, 0, o.h, [[-o.u1 + 1.5, 1.0, -o.u1 + 4.5, 2.5]]);
    S.pop();
    S.frame(0, base, -o.v0, 0);
    S.wall(o.u0, o.u1, 0, o.h, [[o.u0 + 2.5, 1.0, o.u1 - 1.5, 2.5]]);
    S.pop();
  });
  S.with({ layer: L.FLAT, color: C.teal, rough: 0.6 }, () => {
    box(o.u0 - 0.1, o.u1 + 0.1, base + o.h, base + o.h + 0.35, o.v0 - 0.1, o.v1 + 0.1);
    box(o.u0 - 0.02, o.u1 + 0.02, base, base + 0.3, o.v0 - 0.02, o.v1 + 0.02);
  });
  S.with({ layer: L.CONCRETE, color: [0.6, 0.6, 0.58], wear: 0.5 }, () => box(o.u0, o.u1, base + o.h - 0.1, base + o.h + 0.25, o.v0, o.v1, 'ny'));
  const tw = { u0: o.u0 + 0.6, u1: o.u0 + 3.2, v0: o.v1 - 3.0, v1: o.v1 - 0.4, h: 3.0 };
  S.with({ layer: L.PLASTER, color: C.white, wear: 0.35 }, () => box(tw.u0, tw.u1, base + o.h + 0.35, base + o.h + 0.35 + tw.h, tw.v0, tw.v1, 'ny'));
  S.with({ layer: L.FLAT, color: C.teal, rough: 0.6 }, () => {
    box(tw.u0 - 0.35, tw.u1 + 0.35, base + o.h + tw.h + 0.35, base + o.h + tw.h + 0.55, tw.v0 - 0.35, tw.v1 + 0.35);
    cyl((tw.u0 + tw.u1) / 2, base + o.h + tw.h + 0.55, (tw.v0 + tw.v1) / 2, base + o.h + tw.h + 2.6, 0.04, 6);
  });
  S.with({ layer: L.FLAT, color: [1, 0.9, 0.7], glow: 6, channel: CHANNELS.BLINK }, () => cyl((tw.u0 + tw.u1) / 2, base + o.h + tw.h + 2.6, (tw.v0 + tw.v1) / 2, base + o.h + tw.h + 2.75, 0.08, 8));
  G.frame(tw.u1 + 0.01, base + o.h + 0.35, 0, Math.PI / 2).pane(tw.v0 + 0.25, 0.9, tw.v1 - 0.25, 2.4, 0, { depth: 2.4, seed: 7, kind: 1, lit: 0.6 }).pop();
  G.frame(o.u1 + 0.01, base, 0, Math.PI / 2);
  G.pane(o.v0 + 0.8, 0.9, o.v0 + 3.2, 2.7, -0.08, { depth: 5, seed: 3, kind: 1, lit: 0.5 });
  G.pane(o.v0 + 6.8, 0.9, o.v1 - 0.8, 2.7, -0.08, { depth: 5, seed: 4, kind: 1, lit: 0.5 });
  G.pane(o.v0 + 4.3, 0.05, o.v0 + 5.7, 2.5, -0.1, { depth: 5, seed: 5, kind: 1, lit: 0.3 });
  G.pop();
  G.frame(o.u0 - 0.01, base, 0, -Math.PI / 2);
  G.pane(-o.v1 + 2, 1.0, -o.v1 + 4, 2.4, -0.08, { depth: 4, seed: 9, kind: 1 });
  G.pane(-o.v1 + 6, 1.0, -o.v1 + 8, 2.4, -0.08, { depth: 4, seed: 10, kind: 1 });
  G.pop();
  G.frame(0, base, -o.v1 - 0.01, Math.PI).pane(-o.u1 + 1.5, 1.0, -o.u1 + 4.5, 2.5, -0.08, { depth: 4, seed: 11, kind: 1 }).pop();
  G.frame(0, base, -o.v0 + 0.01, 0).pane(o.u0 + 2.5, 1.0, o.u1 - 1.5, 2.5, -0.08, { depth: 4, seed: 12, kind: 1 }).pop();
  S.with({ layer: L.FLAT, color: C.navy, rough: 0.5 }, () => {
    S.frame(o.u1, base, 0, Math.PI / 2);
    for (const [u0, u1] of [[o.v0 + 0.8, o.v0 + 3.2], [o.v0 + 6.8, o.v1 - 0.8], [o.v0 + 4.2, o.v0 + 5.8]]) S.reveal(u0, u0 === o.v0 + 4.2 ? 0 : 0.9, u1, 2.7, 0.12, 0);
    S.pop();
  });
  S.with({ layer: L.FLAT, color: C.navy, rough: 0.7 }, () => {
    const aw = [[o.u1, base + 3.05], [o.u1 + 1.4, base + 2.7]];
    S.quad([aw[0][0], aw[0][1], -(o.v0 + 0.5)], [aw[1][0], aw[1][1], -(o.v0 + 0.5)], [aw[1][0], aw[1][1], -(o.v1 - 0.5)], [aw[0][0], aw[0][1], -(o.v1 - 0.5)]);
  });
  SD.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(sign.items.office, o.v0 + 1.2, base + 3.15, o.v1 - 1.2, base + 3.7, o.u1 + 0.02).pop();
  SD.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(sign.items.marina, (tw.v0 + tw.v1) / 2 - 1.25, base + o.h + 2.65, (tw.v0 + tw.v1) / 2 + 1.25, base + o.h + 3.12, tw.u1 + 0.02).pop();
  solid(o.u0, o.u1, base, base + o.h + 0.35, o.v0, o.v1, 'concrete');
  solid(tw.u0, tw.u1, base + o.h, base + o.h + tw.h + 0.55, tw.v0, tw.v1, 'concrete');

  const ms = { u: -3.2, v: -36 + 1.5 };
  S.with({ layer: L.FLAT, color: C.navy, rough: 0.5 }, () => {
    for (const dv of [-2.2, 2.2]) cyl(ms.u, base, ms.v + 3 + dv, base + 2.8, 0.07, 8);
    box(ms.u - 0.06, ms.u + 0.06, base + 1.9, base + 2.9, ms.v + 3 - 2.4, ms.v + 3 + 2.4);
  });
  SD.push(new THREE.Matrix4().makeRotationY(Math.PI / 2)).put(sign.items.marina, ms.v + 3 - 2.3, base + 1.95, ms.v + 3 + 2.3, base + 2.85, ms.u + 0.07).pop();
  SD.push(new THREE.Matrix4().makeRotationY(-Math.PI / 2)).put(sign.items.wake, -(ms.v + 3) - 1.6, base + 1.95, -(ms.v + 3) + 1.6, base + 2.5, -(ms.u - 0.07)).pop();

  const group = new THREE.Group();
  group.name = 'marina';
  let triangles = 0;
  const add = (geometry, material, cast = true, layer = LAYERS.WORLD, order = 0) => {
    if (!geometry) return null;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.layers.set(layer);
    mesh.renderOrder = order;
    group.add(mesh);
    triangles += geometry.attributes.position.count / 3;
    return mesh;
  };
  add(S.geometry(), mats.surface);
  add(G.geometry(), mats.glass, false);
  add(D.geometry(), mats.decal, false, LAYERS.DETAIL, 1);
  const signMat = new THREE.MeshStandardMaterial({ map: sign.texture, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  if (ctx.lighting && ctx.lighting.register) ctx.lighting.register(signMat);
  add(SD.geometry(), signMat, false, LAYERS.WORLD, 1);

  const buoys = [];
  const kinds = [
    ['port', [[38, -26], [62, -30]]],
    ['starboard', [[38, 10], [62, 14]]],
    ['mooring', [[30, 26], [36, 34], [24, 38]]],
  ];
  const m4 = new THREE.Matrix4();
  const qb = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const pb = new THREE.Vector3();
  for (const [kind, spots] of kinds) {
    const mesh = new THREE.InstancedMesh(buoyGeometry(kind), mats.surface, spots.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    triangles += (mesh.geometry.attributes.position.count / 3) * spots.length;
    spots.forEach(([u, v], i) => {
      const p = portPoint(u, v);
      buoys.push({ mesh, i, x: p.x, z: p.z, phase: i * 1.7 + u * 0.3, big: kind !== 'mooring' });
      const c = portPoint(u, v);
      obstacles.push({ x: c.x, z: c.z, radius: kind === 'mooring' ? 0.4 : 0.8 });
    });
  }
  group.updateMatrixWorld(true);
  scene.add(group);

  let time = 0;
  function update(dt, water) {
    time += dt;
    for (const b of buoys) {
      const y = (water ? water.getHeightAt(b.x, b.z) : 0) + Math.sin(time * 1.3 + b.phase) * 0.04;
      e.set(Math.sin(time * 0.9 + b.phase) * (b.big ? 0.05 : 0.08), b.phase, Math.cos(time * 0.7 + b.phase * 1.3) * (b.big ? 0.05 : 0.08));
      m4.compose(pb.set(b.x, y, b.z), qb.setFromEuler(e), one);
      b.mesh.setMatrixAt(b.i, m4);
    }
    for (const b of buoys) b.mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, null);

  return { group, triangles, colliders, obstacles, update, site: SITE };
}
