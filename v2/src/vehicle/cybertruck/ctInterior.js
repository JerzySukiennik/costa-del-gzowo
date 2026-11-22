// Costa del Gzowo Cyber Truck: cabin (flat deep dash with an ambient light line, 18.5 inch landscape touchscreen with a live drawn interface, squircle wheel with touch pads and scroll wheels, fabric seats, console, door cards) seen through the glass roof.
import * as THREE from 'three';
import { Batch, FIN, LAMP, at, box, cyl, tube } from '../carGeometry.js';
import { screenMaterial } from '../carMaterials.js';
import { CT } from './ctShape.js';

const SUEDE = [0.05, 0.05, 0.052];
const PALE = [0.62, 0.62, 0.6, 0.55, 0, 0];
const DARK = [0.03, 0.03, 0.032, 0.6, 0, 0];
const GLOW = [0.85, 0.92, 1.0, 0.3, 0, 0];
const PAD = [0.16, 0.16, 0.17, 0.35, 0, 0.6];
const SEAT_X = CT.seat.x;
const SEAT_Y = CT.seat.y;

const MODES = { low: 'LOW', normal: 'NORMAL', offroad: 'OFF-ROAD' };

function screenCanvas() {
  const w = 768;
  const h = 480;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const font = (size, weight = '') => `${weight} ${size}px "Helvetica Neue", Arial, sans-serif`;
  function truck(cx, cy, k, lift, open) {
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = '#c9d0d6';
    g.lineWidth = 2.5;
    g.fillStyle = '#1b2026';
    const y = -lift * k;
    g.beginPath();
    g.moveTo(-1.42 * k, -0.33 * k + y);
    g.lineTo(-0.85 * k, -0.33 * k + y);
    g.lineTo(-0.12 * k, -0.6 * k + y);
    g.lineTo(1.42 * k, -0.47 * k + y);
    g.lineTo(1.42 * k, -0.05 * k + y);
    g.lineTo(-1.42 * k, -0.05 * k + y);
    g.closePath();
    g.fill();
    g.stroke();
    if (open) {
      g.strokeStyle = '#7fd0ff';
      g.beginPath();
      g.moveTo(0.55 * k, -0.52 * k + y);
      g.lineTo(1.4 * k, -0.46 * k + y);
      g.stroke();
    }
    g.fillStyle = '#0c0e10';
    g.strokeStyle = '#5c646c';
    for (const x of [-0.95, 0.95]) {
      g.beginPath();
      g.arc(x * k, 0.05 * k, 0.21 * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.restore();
  }
  function draw(s) {
    g.fillStyle = '#07090b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0e1216';
    g.fillRect(0, 0, 300, h);
    g.fillStyle = '#eef2f5';
    g.textAlign = 'left';
    g.font = font(15);
    g.fillStyle = '#8a949c';
    g.fillText(`${s.range} km`, 22, 32);
    g.textAlign = 'right';
    g.fillText(s.clock, 280, 32);
    g.textAlign = 'center';
    g.fillStyle = '#eef2f5';
    g.font = font(92, '300');
    g.fillText(String(s.speed), 150, 150);
    g.font = font(16);
    g.fillStyle = '#8a949c';
    g.fillText('km/h', 150, 176);
    const gears = ['P', 'R', 'N', 'D'];
    gears.forEach((gl, i) => {
      g.font = font(22, gl === s.gear ? 'bold' : '');
      g.fillStyle = gl === s.gear ? '#ffffff' : '#4a535b';
      g.fillText(gl, 96 + i * 36, 222);
    });
    truck(150, 330, 58, s.lift, s.vault);
    g.font = font(15, 'bold');
    g.fillStyle = s.mode === 'offroad' ? '#7fd0ff' : '#eef2f5';
    g.fillText(`RIDE  ${MODES[s.mode]}`, 150, 410);
    g.font = font(13);
    g.fillStyle = '#8a949c';
    g.fillText(`${Math.round(s.clearance * 1000)} mm clearance`, 150, 432);
    g.fillText(s.vault ? 'Vault open' : 'Vault closed', 150, 454);
    const mx = 300;
    g.fillStyle = '#121a20';
    g.fillRect(mx, 0, w - mx, h - 56);
    g.save();
    g.beginPath();
    g.rect(mx, 0, w - mx, h - 56);
    g.clip();
    g.translate(mx + (w - mx) / 2, (h - 56) * 0.62);
    g.rotate(-s.heading);
    g.strokeStyle = '#1f2b33';
    g.lineWidth = 2;
    const gx = ((s.x % 40) + 40) % 40;
    const gz = ((s.z % 40) + 40) % 40;
    for (let i = -8; i <= 8; i++) {
      g.beginPath();
      g.moveTo(i * 40 - gx * 2, -400);
      g.lineTo(i * 40 - gx * 2, 400);
      g.stroke();
      g.beginPath();
      g.moveTo(-400, i * 40 - gz * 2);
      g.lineTo(400, i * 40 - gz * 2);
      g.stroke();
    }
    g.strokeStyle = '#3c5463';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(-500, -s.z * 2 * 4);
    g.lineTo(500, -s.z * 2 * 4);
    g.stroke();
    g.restore();
    g.fillStyle = '#eef2f5';
    g.beginPath();
    const ax = mx + (w - mx) / 2;
    const ay = (h - 56) * 0.62;
    g.moveTo(ax, ay - 14);
    g.lineTo(ax + 10, ay + 10);
    g.lineTo(ax, ay + 4);
    g.lineTo(ax - 10, ay + 10);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(7,9,11,0.82)';
    g.fillRect(mx + 16, 14, 260, 38);
    g.fillStyle = '#eef2f5';
    g.textAlign = 'left';
    g.font = font(16);
    g.fillText(s.place, mx + 30, 39);
    g.fillStyle = '#0b0e11';
    g.fillRect(0, h - 56, w, 56);
    g.fillStyle = '#8a949c';
    g.textAlign = 'center';
    g.font = font(15);
    g.fillText(s.drift ? 'DRIFT' : 'DRIVE', 70, h - 22);
    g.fillText(s.radio, w / 2, h - 22);
    g.fillText('21°C', w - 70, h - 22);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i === 2 ? '#2b3742' : '#161c22';
      g.fillRect(200 + i * 76, h - 44, 56, 32);
    }
    t.needsUpdate = true;
  }
  return { texture: t, draw };
}

function squircle(a, b, n = 4, steps = 72) {
  const pts = [];
  for (let k = 0; k < steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(new THREE.Vector3(Math.sign(c) * a * Math.abs(c) ** (2 / n), Math.sign(s) * b * Math.abs(s) ** (2 / n), 0));
  }
  return pts;
}

function seat(L, x, z, wide = 0.5) {
  L.add(at(box(0.52, 0.12, wide, 0.04), x + 0.02, SEAT_Y - 0.05, z, 0, 0, 0.06));
  L.add(at(box(0.1, 0.12, wide + 0.04, 0.04), x + 0.26, SEAT_Y - 0.03, z, 0, 0, 0.2));
  const back = (g) => g.rotateZ(0.32).translate(x - 0.22, SEAT_Y + 0.02, z);
  L.add(back(at(box(0.1, 0.78, wide, 0.04), 0, 0.36, 0)));
  L.add(back(at(box(0.12, 0.5, 0.08, 0.03), 0.02, 0.28, wide / 2 - 0.02)));
  L.add(back(at(box(0.12, 0.5, 0.08, 0.03), 0.02, 0.28, -wide / 2 + 0.02)));
}

class FabricBatch {
  constructor() {
    this.b = new Batch();
  }

  add(g) {
    this.b.add(g, DARK);
  }
}

export function buildInterior({ mats, lighting }) {
  const group = new THREE.Group();
  group.name = 'cabin';
  const solid = new Batch();
  const leather = new Batch();
  const fabric = new FabricBatch();
  const f = CT.floor;

  solid.add(at(box(2.1, 0.03, 1.76), -0.02, f - 0.015, 0), FIN.carpet);
  solid.add(at(box(0.42, 0.03, 1.7), 1.3, f + 0.17, 0, 0, 0, 0.9), FIN.carpet);
  solid.add(at(box(0.04, 0.5, 1.7), 1.5, 0.85, 0), FIN.liner);
  for (const s of [-1, 1]) {
    solid.add(at(box(0.36, 0.66, 0.05), 1.36, f + 0.33, s * 0.9), FIN.plastic);
    solid.add(at(box(1.15, 0.2, 0.05), -0.45, f + 0.1, s * 0.9), FIN.plastic);
    solid.add(at(box(0.1, 0.5, 0.06), CT.doorMid, 1.42, s * 0.84, 0.35 * s, 0, 0), DARK);
    leather.add(at(box(0.62, 0.24, 0.06, 0.02), -0.6, 0.98, s * 0.9), FIN.black, 0, SUEDE);
    solid.add(at(box(0.5, 0.006, 0.006), -0.6, 1.08, s * 0.868), GLOW, LAMP.CLUSTER);
  }

  leather.add(at(box(1.2, 0.05, 1.78, 0.02), 1.39, 1.105, 0), FIN.black, 0, SUEDE);
  solid.add(at(box(0.05, 0.13, 1.78, 0.015), 0.805, 1.03, 0), PALE);
  solid.add(at(box(0.006, 0.006, 1.74), 0.777, 1.082, 0), GLOW, LAMP.CLUSTER);
  solid.add(at(box(0.3, 0.2, 1.78, 0.02), 0.95, 0.86, 0), DARK);
  solid.add(at(box(0.05, 0.03, 1.4), 0.81, 0.955, 0), DARK);
  for (const s of [-1, 1]) solid.add(at(box(0.012, 0.03, 0.22), 0.782, 1.0, s * 0.62), FIN.mesh);

  solid.add(at(box(1.15, 0.34, 0.32, 0.03), 0.3, f + 0.17, 0), DARK);
  for (let i = 0; i < 12; i++) solid.add(at(box(0.012, 0.004, 0.27), -0.13 + i * 0.045, f + 0.343, 0), FIN.satin);
  solid.add(at(box(0.3, 0.05, 0.3, 0.02), -0.28, f + 0.38, 0), DARK);
  leather.add(at(box(0.32, 0.06, 0.28, 0.025), -0.28, f + 0.42, 0), FIN.black, 0, SUEDE);

  seat(fabric, SEAT_X, CT.seat.z);
  seat(fabric, SEAT_X, -CT.seat.z);
  seat(fabric, -0.68, 0, 1.5);
  for (const z of [CT.seat.z, -CT.seat.z]) {
    solid.add(at(box(0.5, 0.06, 0.4), SEAT_X, SEAT_Y - 0.15, z), DARK);
    solid.add(at(box(0.1, SEAT_Y - 0.18 - f, 0.3), SEAT_X, (SEAT_Y - 0.18 + f) / 2, z), DARK);
  }
  solid.add(at(box(0.5, SEAT_Y - 0.12 - f, 1.5), -0.7, (SEAT_Y - 0.12 + f) / 2, 0), DARK);

  const pz = CT.seat.z;
  solid.add(at(box(0.012, 0.11, 0.07, 0.004), 1.02, f + 0.1, pz + 0.1, 0, 0, -0.6), FIN.alu);
  solid.add(at(box(0.012, 0.09, 0.11, 0.004), 1.02, f + 0.09, pz - 0.05, 0, 0, -0.6), FIN.black);
  solid.add(at(box(0.08, 0.04, 0.2), 1.0, f + 0.02, pz - 0.18), FIN.plastic);

  const W = CT.wheel;
  const axis = new THREE.Vector3(-1, 0.42, 0).normalize();
  const upv = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
  const xAxis = new THREE.Vector3().crossVectors(upv, axis);
  const column = new THREE.Group();
  column.position.set(W.x, W.y, W.z);
  column.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, upv, axis));
  solid.add(tubeBetween(new THREE.Vector3(W.x + 0.36, W.y - 0.13, W.z), new THREE.Vector3(W.x + 0.05, W.y - 0.02, W.z), 0.04), DARK);
  const steeringWheel = new THREE.Group();
  column.add(steeringWheel);
  const wl = new Batch();
  const ws = new Batch();
  wl.add(tube(squircle(0.185, 0.14), 0.017, 10, true), FIN.black, 0, SUEDE);
  wl.add(at(box(0.36, 0.05, 0.04, 0.02), 0, -0.005, -0.015), FIN.black, 0, SUEDE);
  wl.add(at(box(0.13, 0.12, 0.06, 0.035), 0, -0.02, -0.02), FIN.black, 0, SUEDE);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) ws.add(at(box(0.022, 0.016, 0.004, 0.005), s * (0.09 + i * 0.026), 0.012, 0.007), PAD);
    ws.add(at(cyl(0.011, 0.011, 0.012, 16), s * 0.11, -0.016, 0.008, 0, 0, Math.PI / 2), FIN.alu);
    ws.add(at(box(0.018, 0.004, 0.004), s * 0.11, -0.016, 0.02), FIN.black);
  }
  ws.add(at(box(0.06, 0.004, 0.003), 0, -0.07, 0.022), FIN.alu);
  const wheelMesh = new THREE.Mesh(wl.build(), mats.leather);
  const wheelSolid = new THREE.Mesh(ws.build(), mats.solid);
  steeringWheel.add(wheelMesh, wheelSolid);
  group.add(column);

  const screen = screenCanvas();
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.256), screenMaterial(screen.texture, lighting, 1.35));
  screenMesh.position.set(0.748, 1.235, 0.04);
  screenMesh.rotation.set(0, -Math.PI / 2, 0);
  screenMesh.rotateY(-0.12);
  screenMesh.rotateX(-0.2);
  const bezel = at(box(0.42, 0.268, 0.02, 0.006), 0, 0, -0.012);
  bezel.applyMatrix4(screenMesh.matrix.clone().compose(screenMesh.position, screenMesh.quaternion, new THREE.Vector3(1, 1, 1)));
  solid.add(bezel, FIN.gloss);
  solid.add(tubeBetween(new THREE.Vector3(0.79, 1.12, 0.04), new THREE.Vector3(0.77, 1.22, 0.04), 0.03), DARK);

  const doorCards = {};
  for (const [tag, s] of [['L', -1], ['R', 1]]) {
    const L = new Batch();
    const S = new Batch();
    const x0 = CT.doorMid + 0.03;
    const x1 = CT.doorFront - 0.03;
    const xm = (x0 + x1) / 2;
    S.add(at(box(x1 - x0, 0.62, 0.07, 0.02), xm, 0.84, s * 0.94), DARK);
    L.add(at(box(x1 - x0 - 0.1, 0.22, 0.05, 0.02), xm - 0.04, 0.94, s * 0.9), FIN.black, 0, SUEDE);
    S.add(at(box(x1 - x0 - 0.2, 0.05, 0.1, 0.02), xm - 0.1, 0.83, s * 0.88), PALE);
    S.add(at(box(x1 - x0 - 0.1, 0.006, 0.006), xm - 0.04, 1.08, s * 0.868), GLOW, LAMP.CLUSTER);
    S.add(at(box(0.16, 0.04, 0.05, 0.015), xm - 0.36, 0.9, s * 0.875), FIN.satin);
    const card = new THREE.Group();
    const lm = new THREE.Mesh(L.build(), mats.leather);
    const sm = new THREE.Mesh(S.build(), mats.solid);
    card.add(lm, sm);
    card.userData.pull = new THREE.Vector3(xm - 0.36, 0.92, s * 0.86);
    doorCards['door' + tag] = card;
  }

  const leatherMesh = new THREE.Mesh(leather.build(), mats.leather);
  const fabricMesh = new THREE.Mesh(fabric.b.build(), mats.fabric);
  leatherMesh.receiveShadow = fabricMesh.receiveShadow = true;
  group.add(leatherMesh, fabricMesh, screenMesh);
  return {
    group,
    solidGeo: solid.build(),
    steeringWheel,
    column,
    doorCards,
    screen,
    seat: new THREE.Vector3(CT.seat.x, CT.seat.y, CT.seat.z),
  };
}

function tubeBetween(a, b, r) {
  return tube([a, a.clone().lerp(b, 0.5), b], r, 10);
}
