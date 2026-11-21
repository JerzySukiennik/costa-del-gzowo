// Costa del Gzowo: convertible cockpit (tub, sculpted dash with cluster and centre screen, steering wheel, sport seats, console, door cards, pedals, belts, roll hoops).
import * as THREE from 'three';
import { CAR } from './carBody.js';
import { FIN, LAMP, Batch, at, box, cyl, sphere, sweep, tube, merge } from './carGeometry.js';
import { screenMaterial } from './carMaterials.js';

export const SEAT = new THREE.Vector3(-0.38, 0.45, -0.37);
export const WHEEL_CENTER = new THREE.Vector3(-0.03, 0.8, -0.37);
export const WHEEL_RADIUS = 0.185;
const TAN = [0.66, 0.38, 0.2];
const DARK = [0.045, 0.04, 0.036];
const RECLINE = 0.38;

function dashProfile() {
  const s = new THREE.Shape();
  const pts = [[0.44, 0.55], [0.4, 0.6], [0.355, 0.68], [0.335, 0.76], [0.338, 0.83], [0.37, 0.875], [0.45, 0.885], [0.62, 0.895], [0.78, 0.888], [0.8, 0.86], [0.7, 0.62], [0.6, 0.52]];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

function screenTextures() {
  const make = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { c, g, t, draw: (...a) => { draw(g, w, h, ...a); t.needsUpdate = true; } };
  };
  const cluster = make(512, 192, (g, w, h, speed = 0, rpm = 850, gear = 'P') => {
    g.fillStyle = '#020306';
    g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(256, 100, 10, 256, 100, 260);
    grd.addColorStop(0, '#0b1420');
    grd.addColorStop(1, '#020306');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const dial = (cx, val, max, label) => {
      g.lineWidth = 7;
      g.strokeStyle = '#18222e';
      g.beginPath();
      g.arc(cx, 104, 70, Math.PI * 0.75, Math.PI * 2.25);
      g.stroke();
      g.strokeStyle = '#ff8a2a';
      g.beginPath();
      g.arc(cx, 104, 70, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.min(1, val / max));
      g.stroke();
      g.fillStyle = '#eef3f8';
      g.textAlign = 'center';
      g.font = 'bold 44px "Helvetica Neue", Arial, sans-serif';
      g.fillText(String(label), cx, 118);
    };
    dial(110, speed, 300, Math.round(speed));
    dial(402, rpm, 7500, (rpm / 1000).toFixed(1));
    g.font = '16px "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = '#7f93a8';
    g.textAlign = 'center';
    g.fillText('km/h', 110, 150);
    g.fillText('x1000 rpm', 402, 150);
    g.fillStyle = '#eef3f8';
    g.font = 'bold 34px "Helvetica Neue", Arial, sans-serif';
    g.fillText(gear, 256, 84);
    g.font = '15px "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = '#7f93a8';
    g.fillText('29°C   ·   418 km', 256, 128);
  });
  const nav = make(512, 320, (g, w, h) => {
    g.fillStyle = '#0a1418';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#173a44';
    g.lineWidth = 26;
    g.beginPath();
    g.moveTo(-20, 250);
    g.bezierCurveTo(140, 160, 280, 280, 540, 120);
    g.stroke();
    g.strokeStyle = '#2a3238';
    g.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64 + 40, h);
      g.stroke();
    }
    g.strokeStyle = '#d6dde2';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(0, 160);
    g.lineTo(512, 160);
    g.stroke();
    g.fillStyle = '#ff9a2e';
    g.beginPath();
    g.moveTo(256, 146);
    g.lineTo(268, 174);
    g.lineTo(256, 168);
    g.lineTo(244, 174);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(8,14,18,0.85)';
    g.fillRect(0, 0, w, 54);
    g.fillStyle = '#d6dde2';
    g.font = '22px "Helvetica Neue", Arial, sans-serif';
    g.fillText('Sawgrass River Bridge', 18, 35);
    g.fillStyle = '#ff9a2e';
    g.fillText('12:48', 440, 35);
  });
  cluster.draw();
  nav.draw();
  return { cluster, nav };
}

function seatGeometry(leather, solid) {
  const L = leather;
  const S = solid;
  const back = (g) => {
    g.rotateZ(RECLINE);
    return g.translate(-0.13, 0.03, 0);
  };
  L.add(at(box(0.46, 0.07, 0.25, 0.03), 0.04, -0.075, 0, 0, 0, 0.1), FIN.black, 0, TAN);
  for (let i = 0; i < 5; i++) L.add(at(box(0.018, 0.012, 0.24, 0.005), -0.13 + i * 0.085, -0.04 + i * 0.0085, 0, 0, 0, 0.1), FIN.black, 0, [TAN[0] * 0.8, TAN[1] * 0.8, TAN[2] * 0.8]);
  for (const s of [-1, 1]) {
    L.add(at(box(0.48, 0.1, 0.1, 0.04), 0.03, -0.06, s * 0.17, s * 0.2, 0, 0.1), FIN.black, 0, DARK);
    S.add(tube([new THREE.Vector3(-0.2, -0.04 - 0.02, s * 0.124), new THREE.Vector3(0.26, 0.005, s * 0.124)], 0.0022, 4), FIN.stitch);
  }
  L.add(at(box(0.08, 0.09, 0.42, 0.035), 0.27, -0.085, 0, 0, 0, 0.3), FIN.black, 0, DARK);
  L.add(back(at(box(0.07, 0.62, 0.26, 0.03), 0, 0.31, 0)), FIN.black, 0, TAN);
  for (let i = 0; i < 6; i++) L.add(back(at(box(0.012, 0.016, 0.25, 0.005), 0.036, 0.06 + i * 0.09, 0)), FIN.black, 0, [TAN[0] * 0.8, TAN[1] * 0.8, TAN[2] * 0.8]);
  for (const s of [-1, 1]) {
    L.add(back(at(box(0.11, 0.56, 0.1, 0.04), 0.03, 0.27, s * 0.175, 0, s * -0.35, 0)), FIN.black, 0, DARK);
    S.add(back(tube([new THREE.Vector3(0.038, 0.0, s * 0.128), new THREE.Vector3(0.038, 0.6, s * 0.128)], 0.0022, 4)), FIN.stitch);
  }
  L.add(back(at(box(0.1, 0.2, 0.27, 0.045), 0.0, 0.73, 0)), FIN.black, 0, DARK);
  L.add(back(at(box(0.04, 0.05, 0.1, 0.015), 0.035, 0.73, 0)), FIN.black, 0, TAN);
  S.add(back(at(box(0.04, 0.7, 0.34, 0.03), -0.045, 0.36, 0)), FIN.black);
  S.add(at(box(0.46, 0.04, 0.4, 0.01), 0.02, -0.14, 0), FIN.satin);
  for (const s of [-1, 1]) S.add(at(box(0.55, 0.025, 0.03, 0.006), 0.02, -0.175, s * 0.15), FIN.alu);
  S.add(back(at(box(0.012, 0.05, 0.05, 0.004), -0.015, 0.7, -0.19)), FIN.black);
}

export function buildInterior({ mats, lighting }) {
  const group = new THREE.Group();
  group.name = 'interior';
  const leather = new Batch();
  const solid = new Batch();
  const X0 = CAR.cockpitRear + 0.02;

  solid.add(at(box(1.82, 0.03, 1.5, 0.01), -0.12, 0.148, 0), FIN.carpet);
  solid.add(at(box(1.5, 0.2, 0.22, 0.06), -0.2, 0.25, 0), FIN.carpet);
  const toe = new THREE.PlaneGeometry(0.42, 1.5);
  toe.rotateY(-Math.PI / 2);
  toe.rotateZ(-0.95);
  solid.add(at(toe, 0.66, 0.3, 0), FIN.carpet);
  for (const s of [-1, 1]) {
    solid.add(at(box(1.82, 0.28, 0.05, 0.015), -0.12, 0.29, s * 0.8), FIN.carpet);
    solid.add(at(box(0.32, 0.5, 0.05, 0.015), 0.66, 0.5, s * 0.78), FIN.plastic);
  }
  leather.add(at(box(0.06, 0.76, 1.56, 0.02), X0 + 0.01, 0.53, 0), FIN.black, 0, DARK);
  leather.add(at(box(0.24, 0.06, 1.52, 0.02), X0 + 0.11, 0.6, 0), FIN.black, 0, DARK);
  for (const s of [-1, 1]) {
    const hoop = new THREE.TorusGeometry(0.14, 0.02, 10, 24, Math.PI);
    hoop.rotateY(Math.PI / 2);
    solid.add(at(hoop, X0 - 0.01, 0.915, s * 0.37), FIN.alu);
    leather.add(at(box(0.3, 0.06, 0.34, 0.03), X0 - 0.1, 0.92, s * 0.37), FIN.black, 0, DARK);
  }

  const dash = new THREE.ExtrudeGeometry(dashProfile(), { depth: 1.52, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 6 });
  dash.translate(0, 0, -0.76);
  leather.add(dash, FIN.black, 0, DARK);
  solid.add(at(box(0.012, 0.022, 1.36, 0.005), 0.348, 0.74, 0.08), FIN.alu);
  solid.add(tube([new THREE.Vector3(0.39, 0.872, -0.74), new THREE.Vector3(0.392, 0.874, 0), new THREE.Vector3(0.39, 0.872, 0.74)], 0.0025, 4), FIN.stitch);
  solid.add(tube([new THREE.Vector3(0.344, 0.715, -0.74), new THREE.Vector3(0.344, 0.715, 0.74)], 0.003, 4), [0.6, 0.35, 0.15, 0.4, 0, 0], LAMP.AMBIENT);
  const hood = new THREE.CylinderGeometry(0.075, 0.075, 0.38, 24, 1, true, 0, Math.PI);
  hood.rotateX(Math.PI / 2);
  hood.rotateZ(Math.PI * 0.08);
  leather.add(at(hood, 0.42, 0.88, WHEEL_CENTER.z), FIN.black, 0, DARK);
  solid.add(at(box(0.05, 0.14, 0.36, 0.01), 0.425, 0.855, WHEEL_CENTER.z, 0, 0, 0.32), FIN.gloss);
  for (const [z, y] of [[-0.64, 0.8], [0.64, 0.8], [-0.1, 0.665], [0.1, 0.665]]) {
    const ring = new THREE.TorusGeometry(0.036, 0.007, 8, 24);
    ring.rotateY(Math.PI / 2);
    solid.add(at(ring, 0.342, y, z), FIN.chrome);
    solid.add(at(cyl(0.034, 0.034, 0.02, 20), 0.352, y, z, 0, 0, Math.PI / 2), FIN.black);
    for (let k = -1; k <= 1; k++) solid.add(at(box(0.004, 0.004, 0.06, 0.001), 0.344, y + k * 0.014, z), FIN.alu);
  }
  solid.add(at(box(0.03, 0.2, 0.33, 0.012), 0.36, 0.79, 0, 0, 0, 0.3), FIN.gloss);
  for (let i = 0; i < 6; i++) solid.add(at(box(0.01, 0.012, 0.03, 0.004), 0.33, 0.62, -0.09 + i * 0.036), FIN.alu);
  const mirror = [at(box(0.035, 0.065, 0.24, 0.02), 0.255, 1.175, 0)];
  solid.add(merge(mirror), FIN.gloss);
  solid.add(at(box(0.002, 0.05, 0.22, 0.004), 0.236, 1.175, 0), FIN.chrome);
  solid.add(tube([new THREE.Vector3(0.27, 1.2, 0), new THREE.Vector3(0.262, 1.236, 0)], 0.008, 6), FIN.gloss);

  leather.add(at(box(0.42, 0.08, 0.2, 0.03), -0.72, 0.53, 0), FIN.black, 0, DARK);
  leather.add(at(box(0.8, 0.18, 0.22, 0.05), -0.12, 0.42, 0), FIN.black, 0, DARK);
  const ramp = box(0.5, 0.05, 0.2, 0.02);
  solid.add(at(ramp, 0.12, 0.535, 0, 0, 0, 0.28), FIN.gloss);
  solid.add(at(cyl(0.022, 0.03, 0.06, 18), -0.2, 0.55, 0.0), FIN.alu);
  solid.add(at(sphere(0.03, 1, 0.7, 1, 16, 10), -0.2, 0.585, 0), FIN.alu);
  solid.add(at(cyl(0.028, 0.028, 0.02, 24), -0.06, 0.527, 0.05), FIN.chrome);
  for (const z of [-0.05, 0.05]) solid.add(at(cyl(0.035, 0.035, 0.012, 20), -0.4, 0.512, z), FIN.black);
  solid.add(at(cyl(0.016, 0.016, 0.01, 16), 0.1, 0.57, -0.06, 0, 0, Math.PI / 2 - 0.28), FIN.alu);

  const seatL = new Batch();
  const seatS = new Batch();
  seatGeometry(seatL, seatS);
  const seatLeather = seatL.build();
  const seatSolid = seatS.build();
  for (const s of [-1, 1]) {
    const m = new THREE.Matrix4().makeTranslation(SEAT.x, SEAT.y, s * Math.abs(SEAT.z));
    leather.parts.push(seatLeather.clone().applyMatrix4(m));
    solid.parts.push(seatSolid.clone().applyMatrix4(m));
  }

  for (const s of [-1, 1]) {
    const z = s * Math.abs(SEAT.z);
    const belt = [
      new THREE.Vector3(SEAT.x - 0.36, 1.02, z - s * 0.17),
      new THREE.Vector3(SEAT.x - 0.3, 0.86, z - s * 0.21),
      new THREE.Vector3(SEAT.x - 0.18, 0.55, z - s * 0.24),
      new THREE.Vector3(SEAT.x - 0.1, 0.3, z - s * 0.27),
    ];
    solid.add(sweep(belt, [[-0.022, -0.002], [0.022, -0.002], [0.022, 0.002], [-0.022, 0.002]], { closed: true, up: new THREE.Vector3(0, 0, 1) }), FIN.satin);
    solid.add(at(box(0.05, 0.08, 0.03, 0.01), SEAT.x - 0.02, 0.42, z + s * 0.16, 0, 0, 0.5), FIN.gloss);
    solid.add(at(box(0.03, 0.02, 0.03, 0.006), SEAT.x - 0.02, 0.47, z + s * 0.16), FIN.alu);
  }

  for (const [dz, w, y] of [[-0.06, 0.05, 0.2], [0.05, 0.08, 0.2]]) {
    const pad = box(0.012, 0.11, w, 0.004);
    solid.add(at(pad, 0.47, 0.25 + (y - 0.2), WHEEL_CENTER.z + dz, 0, 0, -0.55), FIN.alu);
    solid.add(tube([new THREE.Vector3(0.5, 0.33, WHEEL_CENTER.z + dz), new THREE.Vector3(0.56, 0.52, WHEEL_CENTER.z + dz)], 0.008, 6), FIN.black);
  }
  solid.add(at(box(0.012, 0.09, 0.08, 0.004), 0.45, 0.22, WHEEL_CENTER.z - 0.16, 0, 0, -0.75), FIN.black);

  const leatherMesh = new THREE.Mesh(leather.build(), mats.leather);
  leatherMesh.castShadow = true;
  leatherMesh.receiveShadow = true;
  const solidGeo = solid.build();

  const screens = screenTextures();
  const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1125), screenMaterial(screens.cluster.t, lighting, 1.5));
  cluster.position.set(0.432, 0.85, WHEEL_CENTER.z);
  cluster.rotation.set(0, -Math.PI / 2, 0);
  cluster.rotateX(-0.3);
  const nav = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.18), screenMaterial(screens.nav.t, lighting, 1.25));
  nav.position.set(0.343, 0.79, 0);
  nav.rotation.set(0, -Math.PI / 2, 0);
  nav.rotateX(-0.3);
  const screenGroup = new THREE.Group();
  screenGroup.add(cluster, nav);
  group.add(leatherMesh, screenGroup);

  const n = new THREE.Vector3(-Math.cos(0.38), Math.sin(0.38), 0).normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize();
  const xAxis = new THREE.Vector3().crossVectors(up, n);
  const column = new THREE.Group();
  column.position.copy(WHEEL_CENTER);
  column.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, up, n));
  const steeringWheel = new THREE.Group();
  column.add(steeringWheel);
  const wl = new Batch();
  const ws = new Batch();
  const rimPts = [];
  for (let k = 0; k <= 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const flat = Math.sin(a) < -0.86 ? -0.86 * WHEEL_RADIUS / Math.abs(Math.sin(a)) : WHEEL_RADIUS;
    const r = Math.min(WHEEL_RADIUS, flat);
    rimPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  wl.add(tube(rimPts, 0.0165, 12, true, (t) => (Math.abs(Math.cos(t * Math.PI * 2)) > 0.93 ? 1.12 : 1)), FIN.black, 0, DARK);
  for (const a of [0, Math.PI]) ws.add(tube([new THREE.Vector3(Math.cos(a) * 0.05, -0.012, -0.03), new THREE.Vector3(Math.cos(a) * 0.12, -0.006, -0.012), new THREE.Vector3(Math.cos(a) * 0.172, 0, 0)], 0.012, 8), FIN.alu);
  ws.add(tube([new THREE.Vector3(0, -0.05, -0.03), new THREE.Vector3(0, -0.12, -0.012), new THREE.Vector3(0, -0.158, 0)], 0.011, 8), FIN.satin);
  wl.add(at(box(0.15, 0.115, 0.05, 0.03), 0, -0.01, -0.012), FIN.black, 0, DARK);
  ws.add(at(box(0.05, 0.012, 0.008, 0.004), 0, -0.01, 0.015), FIN.alu);
  for (const s of [-1, 1]) ws.add(at(box(0.05, 0.075, 0.008, 0.004), s * 0.13, 0.03, -0.05, 0, 0, s * -0.2), FIN.alu);
  ws.add(at(cyl(0.035, 0.045, 0.2, 16), 0, 0, -0.13, Math.PI / 2), FIN.satin);
  const wheelLeather = new THREE.Mesh(wl.build(), mats.leather);
  const wheelSolid = new THREE.Mesh(ws.build(), mats.solid);
  wheelLeather.castShadow = true;
  steeringWheel.add(wheelLeather, wheelSolid);
  group.add(column);

  const doorCards = {};
  for (const [tag, s] of [['L', -1], ['R', 1]]) {
    const L = new Batch();
    const S = new Batch();
    const zi = s * 0.745;
    const x0 = CAR.doorRear + 0.03;
    const x1 = CAR.doorFront - 0.03;
    const len = x1 - x0;
    const xm = (x0 + x1) / 2;
    L.add(at(box(len, 0.6, 0.05, 0.02), xm, 0.58, zi + s * 0.025), FIN.black, 0, DARK);
    L.add(at(box(len, 0.06, 0.1, 0.025), xm, 0.86, zi + s * 0.035), FIN.black, 0, DARK);
    L.add(at(box(len * 0.6, 0.16, 0.012, 0.006), xm - 0.06, 0.66, zi - s * 0.002), FIN.black, 0, TAN);
    L.add(at(box(len * 0.62, 0.055, 0.075, 0.025), xm - 0.08, 0.6, zi - s * 0.03), FIN.black, 0, TAN);
    S.add(tube([new THREE.Vector3(x0 + 0.05, 0.74, zi - s * 0.008), new THREE.Vector3(x1 - 0.05, 0.74, zi - s * 0.008)], 0.003, 4), [0.6, 0.35, 0.15, 0.4, 0, 0], LAMP.AMBIENT);
    const pull = [new THREE.Vector3(-0.27, 0.645, zi - s * 0.02), new THREE.Vector3(-0.22, 0.7, zi - s * 0.05), new THREE.Vector3(-0.07, 0.72, zi - s * 0.05), new THREE.Vector3(0.0, 0.7, zi - s * 0.02)];
    S.add(tube(pull, 0.012, 10), FIN.alu);
    S.add(at(box(0.07, 0.03, 0.02, 0.008), 0.48, 0.79, zi - s * 0.005), FIN.chrome);
    S.add(at(box(0.09, 0.05, 0.012, 0.006), 0.48, 0.79, zi + s * 0.001), FIN.gloss);
    const spk = new THREE.CircleGeometry(0.075, 28);
    spk.rotateY(s < 0 ? Math.PI / 2 : -Math.PI / 2);
    S.add(at(spk, 0.42, 0.42, zi - s * 0.0015), FIN.mesh);
    const ring = new THREE.TorusGeometry(0.078, 0.006, 6, 28);
    ring.rotateY(Math.PI / 2);
    S.add(at(ring, 0.42, 0.42, zi - s * 0.002), FIN.alu);
    S.add(at(box(0.1, 0.012, 0.045, 0.004), -0.18, 0.63, zi - s * 0.05), FIN.gloss);
    const card = new THREE.Group();
    const lm = new THREE.Mesh(L.build(), mats.leather);
    const sm = new THREE.Mesh(S.build(), mats.solid);
    lm.receiveShadow = sm.receiveShadow = true;
    card.add(lm, sm);
    card.userData.pull = new THREE.Vector3(-0.14, 0.715, zi - s * 0.05);
    doorCards['door' + tag] = card;
  }

  return {
    group,
    leatherMesh,
    solidGeo,
    steeringWheel,
    column,
    doorCards,
    screens,
    seat: SEAT.clone(),
    wheelCenter: WHEEL_CENTER.clone(),
  };
}
