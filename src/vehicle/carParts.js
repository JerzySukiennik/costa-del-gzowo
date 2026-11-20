// Riverside: car sub-assemblies (wheels, cabriolet interior, mirrors, exterior details) built procedurally.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR } from './carBody.js';

const R = CAR.wheelRadius;
const TW = CAR.tireWidth;

function strip(list) {
  return mergeGeometries(
    list.map((g) => {
      const out = g.index ? g.toNonIndexed() : g;
      for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(name)) out.deleteAttribute(name);
      return out;
    }),
    false,
  );
}

function at(geometry, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return geometry.clone().applyMatrix4(m);
}

function tireTexture() {
  const w = 1024;
  const h = 256;
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = bump.width = w;
  color.height = bump.height = h;
  const c = color.getContext('2d');
  const b = bump.getContext('2d');
  c.fillStyle = '#0d0d0d';
  c.fillRect(0, 0, w, h);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, w, h);
  const t0 = h * 0.34;
  const t1 = h * 0.66;
  c.fillStyle = '#111111';
  c.fillRect(0, t0, w, t1 - t0);
  b.fillStyle = '#b0b0b0';
  b.fillRect(0, t0, w, t1 - t0);
  b.fillStyle = '#202020';
  for (const f of [0.2, 0.42, 0.58, 0.8]) b.fillRect(0, t0 + (t1 - t0) * f - 3, w, 6);
  b.lineWidth = 2.5;
  b.strokeStyle = '#303030';
  for (let x = 0; x < w; x += 16) {
    b.beginPath();
    b.moveTo(x, t0);
    b.lineTo(x + 9, t0 + (t1 - t0) * 0.2);
    b.moveTo(x + 9, t1 - (t1 - t0) * 0.2);
    b.lineTo(x, t1);
    b.moveTo(x + 4, t0 + (t1 - t0) * 0.44);
    b.lineTo(x + 10, t0 + (t1 - t0) * 0.56);
    b.stroke();
  }
  for (const [y0, flip] of [[h * 0.2, false], [h * 0.8, true]]) {
    c.save();
    c.translate(0, y0);
    if (flip) c.scale(1, -1);
    c.fillStyle = '#1c1c1c';
    c.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
    c.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) {
      c.fillText('RIVERSIDE  SPORT', 40 + k * 512, 0);
      c.font = '18px "Helvetica Neue", Arial, sans-serif';
      c.fillText('255/35 ZR19  96Y', 330 + k * 512, 0);
      c.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
    }
    c.restore();
    b.fillStyle = '#9a9a9a';
    b.fillRect(0, y0 - 16, w, 2);
    b.fillRect(0, y0 + 14, w, 2);
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump);
  for (const t of [map, bumpMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    t.anisotropy = 8;
  }
  return { map, bumpMap };
}

export function buildWheelAssets() {
  const hw = TW / 2;
  const profile = [[0.243, -hw + 0.022], [0.262, -hw + 0.004], [0.295, -hw], [0.32, -hw + 0.006], [0.332, -hw + 0.028], [R, -hw + 0.05], [R, hw - 0.05], [0.332, hw - 0.028], [0.32, hw - 0.006], [0.295, hw], [0.262, hw - 0.004], [0.243, hw - 0.022]].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.LatheGeometry(profile, 56);
  tire.rotateX(Math.PI / 2);
  const barrelProfile = [[0.243, -hw + 0.022], [0.236, -hw + 0.03], [0.228, -0.04], [0.225, 0.06], [0.236, hw - 0.03], [0.243, hw - 0.022], [0.25, hw - 0.018], [0.243, hw - 0.012]].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.LatheGeometry(barrelProfile, 48);
  barrel.rotateX(Math.PI / 2);
  const rimParts = [barrel];
  const spokeShape = new THREE.Shape();
  spokeShape.moveTo(-0.022, 0.05);
  spokeShape.lineTo(0.022, 0.05);
  spokeShape.lineTo(0.013, 0.236);
  spokeShape.lineTo(-0.013, 0.236);
  spokeShape.closePath();
  const spoke = new THREE.ExtrudeGeometry(spokeShape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
  for (let i = 0; i < 5; i++) {
    for (const off of [-0.2, 0.2]) {
      const g = spoke.clone();
      g.rotateZ(off * 0.5);
      g.translate(Math.sin(-off) * 0.0, 0, 0);
      g.rotateZ((i / 5) * Math.PI * 2 + off * 0.35);
      g.translate(0, 0, hw - 0.062);
      rimParts.push(g);
    }
  }
  const hub = new THREE.CylinderGeometry(0.07, 0.078, 0.05, 24);
  hub.rotateX(Math.PI / 2);
  hub.translate(0, 0, hw - 0.055);
  rimParts.push(hub);
  const cap = new THREE.CylinderGeometry(0.034, 0.034, 0.012, 20);
  cap.rotateX(Math.PI / 2);
  cap.translate(0, 0, hw - 0.027);
  for (let i = 0; i < 5; i++) {
    const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.014, 6);
    nut.rotateX(Math.PI / 2);
    nut.translate(Math.cos((i / 5) * Math.PI * 2) * 0.052, Math.sin((i / 5) * Math.PI * 2) * 0.052, hw - 0.03);
    rimParts.push(nut);
  }
  const rim = strip(rimParts);
  const disc = new THREE.CylinderGeometry(0.178, 0.178, 0.026, 40);
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, 0.02);
  const hat = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 24);
  hat.rotateX(Math.PI / 2);
  hat.translate(0, 0, 0.035);
  const caliper = new RoundedBoxGeometry(0.2, 0.085, 0.075, 3, 0.02);
  caliper.translate(0, 0.158, 0.02);
  const tex = tireTexture();
  return {
    tire,
    rim,
    cap,
    disc: strip([disc, hat]),
    caliper,
    materials: {
      tire: new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bumpMap, bumpScale: 2.2, roughness: 0.86, metalness: 0 }),
      rim: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.3, metalness: 0.92 }),
      cap: new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.2, metalness: 1 }),
      disc: new THREE.MeshStandardMaterial({ color: 0x7c7f84, roughness: 0.38, metalness: 0.95 }),
      caliper: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.42, metalness: 0.2 }),
    },
  };
}

export function buildWheel(assets, side) {
  const hubGroup = new THREE.Group();
  const spin = new THREE.Group();
  const make = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  spin.add(make(assets.tire, assets.materials.tire), make(assets.rim, assets.materials.rim), make(assets.cap, assets.materials.cap), make(assets.disc, assets.materials.disc));
  const caliper = make(assets.caliper, assets.materials.caliper);
  const flip = new THREE.Group();
  if (side < 0) flip.rotation.y = Math.PI;
  flip.add(spin);
  hubGroup.add(flip, caliper);
  return { group: hubGroup, spin, caliper };
}

function seat(leather, dark) {
  const parts = [];
  parts.push(at(new RoundedBoxGeometry(0.52, 0.15, 0.5, 4, 0.06), -0.02, 0.075, 0));
  parts.push(at(new RoundedBoxGeometry(0.5, 0.11, 0.09, 3, 0.04), -0.02, 0.13, 0.22));
  parts.push(at(new RoundedBoxGeometry(0.5, 0.11, 0.09, 3, 0.04), -0.02, 0.13, -0.22));
  parts.push(at(new RoundedBoxGeometry(0.14, 0.64, 0.46, 4, 0.06), -0.3, 0.42, 0, 0, 0, 0.28));
  parts.push(at(new RoundedBoxGeometry(0.16, 0.52, 0.08, 3, 0.035), -0.27, 0.42, 0.22, 0, 0, 0.28));
  parts.push(at(new RoundedBoxGeometry(0.16, 0.52, 0.08, 3, 0.035), -0.27, 0.42, -0.22, 0, 0, 0.28));
  parts.push(at(new RoundedBoxGeometry(0.1, 0.19, 0.25, 3, 0.045), -0.43, 0.83, 0, 0, 0, 0.2));
  const frame = [at(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 8), -0.4, 0.72, 0.06, 0, 0, 0.24), at(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 8), -0.4, 0.72, -0.06, 0, 0, 0.24), at(new THREE.BoxGeometry(0.5, 0.05, 0.44), -0.02, -0.03, 0)];
  const group = new THREE.Group();
  const a = new THREE.Mesh(strip(parts), leather);
  const b = new THREE.Mesh(strip(frame), dark);
  a.castShadow = a.receiveShadow = true;
  b.castShadow = true;
  group.add(a, b);
  return group;
}

function screenTexture(draw, w = 512, h = 192) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#020305';
  g.fillRect(0, 0, w, h);
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildInterior({ leatherMaps }) {
  const group = new THREE.Group();
  group.name = 'interior';
  const leather = new THREE.MeshStandardMaterial({ ...leatherMaps, color: 0xa8622f, roughness: 0.62, metalness: 0 });
  leather.metalnessMap = null;
  const darkLeather = new THREE.MeshStandardMaterial({ ...leatherMaps, color: 0x1b1a19, roughness: 0.7, metalness: 0 });
  darkLeather.metalnessMap = null;
  const plastic = new THREE.MeshStandardMaterial({ color: 0x101011, roughness: 0.72, metalness: 0 });
  const carpet = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb4b7ba, roughness: 0.28, metalness: 1 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
  const add = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  const tub = [];
  tub.push(at(new THREE.BoxGeometry(2.9, 0.04, 1.6), -0.36, 0.285, 0));
  tub.push(at(new THREE.BoxGeometry(0.06, 0.72, 1.6), 1.03, 0.62, 0));
  tub.push(at(new THREE.BoxGeometry(0.06, 0.7, 1.6), -1.72, 0.62, 0));
  for (const s of [-1, 1]) {
    tub.push(at(new THREE.BoxGeometry(0.75, 0.62, 0.05), -1.42, 0.6, s * 0.79));
    tub.push(at(new THREE.BoxGeometry(0.2, 0.62, 0.05), 1.0, 0.6, s * 0.8));
  }
  add(strip(tub), carpet, false);

  const dashProfile = [[-1.0, 0.3], [-0.72, 0.3], [-0.62, 0.52], [-0.52, 0.6], [-0.5, 0.76], [-0.56, 0.9], [-0.64, 0.935], [-0.98, 0.955], [-1.02, 0.9]];
  const shape = new THREE.Shape();
  dashProfile.forEach(([x, y], i) => (i ? shape.lineTo(-x, y) : shape.moveTo(-x, y)));
  shape.closePath();
  const dash = new THREE.ExtrudeGeometry(shape, { depth: 1.58, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4 });
  dash.translate(0, 0, -0.79);
  add(dash, darkLeather);
  add(at(new RoundedBoxGeometry(0.2, 0.09, 0.44, 3, 0.03), 0.59, 0.945, -0.37), darkLeather);
  add(at(new RoundedBoxGeometry(0.03, 0.022, 1.5, 2, 0.008), 0.505, 0.795, 0), metal, false);

  const cluster = screenTexture((g, w, h) => {
    g.strokeStyle = '#2aa6ff';
    g.lineWidth = 5;
    for (const cx of [110, 402]) {
      g.beginPath();
      g.arc(cx, 100, 74, Math.PI * 0.8, Math.PI * 2.2);
      g.stroke();
    }
    g.fillStyle = '#e9f2ff';
    g.font = 'bold 54px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('0', 110, 118);
    g.font = '18px "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = '#8fa3b8';
    g.fillText('km/h', 110, 146);
    g.fillText('x1000 rpm', 402, 146);
    g.fillStyle = '#e9f2ff';
    g.font = 'bold 30px "Helvetica Neue", Arial, sans-serif';
    g.fillText('P', 256, 76);
    g.font = '16px "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = '#8fa3b8';
    g.fillText('27°C   412 km', 256, 126);
  });
  const clusterMat = new THREE.MeshBasicMaterial({ map: cluster, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) });
  const clusterMesh = add(at(new THREE.PlaneGeometry(0.3, 0.11), 0.522, 0.875, -0.37, 0, -Math.PI / 2, 0), clusterMat, false);
  clusterMesh.rotation.z = 0;
  const nav = screenTexture((g, w, h) => {
    g.fillStyle = '#0b1a20';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1f4f5c';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(-10, 150);
    g.bezierCurveTo(140, 90, 260, 170, 530, 60);
    g.stroke();
    g.strokeStyle = '#d6dde2';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, 96);
    g.lineTo(512, 96);
    g.stroke();
    g.fillStyle = '#ff9a2e';
    g.beginPath();
    g.arc(256, 96, 9, 0, 7);
    g.fill();
    g.fillStyle = '#d6dde2';
    g.font = '18px "Helvetica Neue", Arial, sans-serif';
    g.fillText('Sawgrass River Bridge', 16, 28);
  }, 512, 192);
  add(at(new RoundedBoxGeometry(0.014, 0.15, 0.34, 2, 0.006), 0.5, 0.9, 0.02), gloss, false);
  add(at(new THREE.PlaneGeometry(0.32, 0.13), 0.492, 0.9, 0.02, 0, -Math.PI / 2, 0), new THREE.MeshBasicMaterial({ map: nav, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) }), false);

  const consoleParts = [at(new RoundedBoxGeometry(1.5, 0.24, 0.24, 3, 0.04), -0.2, 0.42, 0), at(new RoundedBoxGeometry(0.42, 0.07, 0.2, 3, 0.03), -0.38, 0.57, 0)];
  add(strip(consoleParts), darkLeather);
  add(at(new RoundedBoxGeometry(0.34, 0.012, 0.17, 2, 0.005), 0.18, 0.545, 0), gloss, false);
  add(strip([at(new THREE.CylinderGeometry(0.02, 0.026, 0.09, 12), 0.1, 0.59, 0.02), at(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 20), -0.06, 0.548, 0.045), at(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 20), -0.06, 0.548, -0.045)]), metal, false);

  const frontL = seat(leather, plastic);
  frontL.position.set(-0.05, 0.31, -0.37);
  const frontR = seat(leather, plastic);
  frontR.position.set(-0.05, 0.31, 0.37);
  const rearL = seat(leather, plastic);
  rearL.position.set(-1.0, 0.33, -0.36);
  rearL.scale.set(0.92, 0.95, 1);
  const rearR = seat(leather, plastic);
  rearR.position.set(-1.0, 0.33, 0.36);
  rearR.scale.set(0.92, 0.95, 1);
  group.add(frontL, frontR, rearL, rearR);

  const deck = [at(new RoundedBoxGeometry(0.5, 0.06, 1.5, 3, 0.02), -1.5, 0.93, 0)];
  add(strip(deck), darkLeather);
  const hoops = [];
  for (const s of [-1, 1]) {
    const hoop = new THREE.TorusGeometry(0.15, 0.022, 10, 20, Math.PI);
    hoop.rotateY(Math.PI / 2);
    hoops.push(at(hoop, -1.4, 0.96, s * 0.36));
  }
  add(strip(hoops), metal);

  const doorCards = {};
  for (const [name, x0, x1] of [['doorF', -0.28, 0.98], ['doorR', -1.12, -0.28]]) {
    for (const [tag, s] of [['L', -1], ['R', 1]]) {
      const len = x1 - x0;
      const card = new THREE.Group();
      const panel = new THREE.Mesh(strip([at(new RoundedBoxGeometry(len - 0.03, 0.6, 0.07, 3, 0.025), (x0 + x1) / 2, 0.6, s * 0.8), at(new RoundedBoxGeometry(len - 0.03, 0.035, 0.1, 2, 0.012), (x0 + x1) / 2, 0.915, s * 0.83)]), darkLeather);
      const rest = new THREE.Mesh(strip([at(new RoundedBoxGeometry(len * 0.62, 0.07, 0.1, 3, 0.03), (x0 + x1) / 2 - 0.05, 0.66, s * 0.745)]), leather);
      const pull = new THREE.Mesh(at(new RoundedBoxGeometry(0.16, 0.022, 0.02, 2, 0.008), x1 - 0.32, 0.8, s * 0.758), metal);
      for (const m of [panel, rest, pull]) {
        m.castShadow = m.receiveShadow = true;
        card.add(m);
      }
      doorCards[name + tag] = card;
    }
  }

  const wheel = new THREE.Group();
  const rimGeo = new THREE.TorusGeometry(0.18, 0.0165, 12, 40);
  const wheelParts = [rimGeo, at(new RoundedBoxGeometry(0.11, 0.09, 0.05, 3, 0.02), 0, 0, -0.01)];
  for (const a of [Math.PI * 0.03, Math.PI * 0.97, Math.PI * 1.5]) wheelParts.push(at(new RoundedBoxGeometry(0.15, 0.03, 0.02, 2, 0.008), Math.cos(a) * 0.105, Math.sin(a) * 0.105, 0, 0, 0, a));
  const wheelMesh = new THREE.Mesh(strip(wheelParts), darkLeather);
  wheelMesh.castShadow = true;
  wheel.add(wheelMesh);
  const column = new THREE.Group();
  column.position.set(0.4, 0.83, -0.37);
  column.rotation.set(0, Math.PI / 2, 0);
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.36;
  tilt.add(wheel);
  column.add(tilt);
  const shaft = new THREE.Mesh(at(new THREE.CylinderGeometry(0.03, 0.035, 0.24, 12), 0, 0, -0.13, Math.PI / 2), plastic);
  tilt.add(shaft);
  group.add(column);

  const mirror = strip([at(new RoundedBoxGeometry(0.03, 0.055, 0.21, 2, 0.012), 0.36, 1.275, 0), at(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), 0.4, 1.31, 0, 0, 0, 0.6)]);
  add(mirror, plastic, false);

  return { group, steeringWheel: wheel, doorCards, materials: { leather, darkLeather, plastic, metal, gloss }, seat: new THREE.Vector3(-0.1, 0.44, -0.37) };
}

export function buildExterior(materials) {
  const out = {};
  const mk = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  out.mirrors = [-1, 1].map((s) => {
    const g = new THREE.Group();
    const housing = new RoundedBoxGeometry(0.11, 0.115, 0.2, 4, 0.045);
    housing.translate(0, 0, s * 0.1);
    const stalk = at(new RoundedBoxGeometry(0.06, 0.03, 0.09, 2, 0.012), 0.01, -0.045, s * 0.01);
    g.add(mk(housing, materials.paint), mk(stalk, materials.trim));
    const face = new THREE.Mesh(at(new THREE.PlaneGeometry(0.17, 0.095), -0.056, 0, s * 0.105, 0, -Math.PI / 2, 0), materials.mirror);
    g.add(face);
    g.position.set(0.9, 0.99, s * 0.905);
    g.rotation.y = s * -0.12;
    return g;
  });
  out.handles = [];
  for (const x of [-0.18, -1.02]) {
    for (const s of [-1, 1]) {
      const h = mk(new RoundedBoxGeometry(0.17, 0.028, 0.02, 2, 0.009), materials.paint);
      h.position.set(x, 0.845, s * 0.918);
      out.handles.push({ mesh: h, door: (x > -0.5 ? 'doorF' : 'doorR') + (s < 0 ? 'L' : 'R') });
    }
  }
  const tips = [];
  for (const z of [-0.6, -0.48, 0.48, 0.6]) tips.push(at(new THREE.CylinderGeometry(0.043, 0.047, 0.14, 18, 1, true), -2.39, 0.275, z, 0, 0, Math.PI / 2));
  out.exhaust = mk(strip(tips), materials.chrome);
  out.exhaust.material = materials.chrome;
  const fins = [];
  for (const z of [-0.3, -0.1, 0.1, 0.3]) fins.push(at(new THREE.BoxGeometry(0.34, 0.09, 0.012), -2.27, 0.25, z, 0, 0, 0.3));
  fins.push(at(new THREE.BoxGeometry(0.1, 0.03, 1.5), 2.2, 0.185, 0));
  out.blackTrim = mk(strip(fins), materials.plastic);
  const wipers = [];
  for (const z of [-0.42, 0.12]) {
    wipers.push(at(new THREE.BoxGeometry(0.012, 0.012, 0.56), 1.0, 1.0, z + 0.26, 0.05, 0.42, 0));
    wipers.push(at(new THREE.BoxGeometry(0.02, 0.008, 0.5), 0.985, 1.012, z + 0.29, 0.05, 0.42, 0));
  }
  out.wipers = mk(strip(wipers), materials.plastic);
  const liners = [];
  for (const ax of [CAR.axleFront, CAR.axleRear]) {
    for (const s of [-1, 1]) {
      const arch = new THREE.CylinderGeometry(CAR.archRadius + 0.012, CAR.archRadius + 0.012, 0.36, 28, 1, true, -Math.PI / 2, Math.PI);
      arch.rotateX(-Math.PI / 2);
      liners.push(at(arch, ax, CAR.wheelRadius, s * (CAR.halfWidth - 0.2)));
      liners.push(at(new THREE.CircleGeometry(CAR.archRadius + 0.012, 24, 0, Math.PI), ax, CAR.wheelRadius, s * (CAR.halfWidth - 0.38), 0, s > 0 ? 0 : Math.PI, 0));
    }
  }
  out.liners = new THREE.Mesh(strip(liners), materials.liner);
  out.liners.castShadow = true;
  return out;
}

export function plateTexture(textValue) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#eceadf';
  g.fillRect(0, 0, 512, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,170,60,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(40,150,120,0.4)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#1b3a34';
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 236);
  g.fillStyle = '#1b3a34';
  g.textAlign = 'center';
  g.font = 'bold 34px "Helvetica Neue", Arial, sans-serif';
  g.fillText('SAWGRASS STATE', 256, 54);
  g.font = 'bold 118px "Helvetica Neue", Arial, sans-serif';
  g.fillText(textValue, 256, 176);
  g.font = '26px "Helvetica Neue", Arial, sans-serif';
  g.fillText('river country', 256, 226);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
