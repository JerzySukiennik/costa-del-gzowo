// Costa del Gzowo: car sub-assemblies (wheels, windshield and frame, side glass, mirrors, handles, lamp internals, grille, exhausts, diffuser, underbody, wheel houses, plate).
import * as THREE from 'three';
import { CAR } from './carBody.js';
import { FIN, LAMP, Batch, at, box, cyl, sphere, sweep, lathe, tube, grid, merge } from './carGeometry.js';

const R = CAR.wheelRadius;
const TW = CAR.tireWidth;

function tyreTextures() {
  const w = 1024;
  const h = 256;
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = bump.width = w;
  color.height = bump.height = h;
  const c = color.getContext('2d');
  const b = bump.getContext('2d');
  c.fillStyle = '#121212';
  c.fillRect(0, 0, w, h);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, w, h);
  const t0 = h * 0.36;
  const t1 = h * 0.64;
  c.fillStyle = '#161616';
  c.fillRect(0, t0, w, t1 - t0);
  b.fillStyle = '#b4b4b4';
  b.fillRect(0, t0, w, t1 - t0);
  b.fillStyle = '#1c1c1c';
  for (const f of [0.17, 0.4, 0.6, 0.83]) b.fillRect(0, t0 + (t1 - t0) * f - 3, w, 6);
  b.strokeStyle = '#2a2a2a';
  b.lineWidth = 3;
  for (let x = 0; x < w + 20; x += 14) {
    b.beginPath();
    b.moveTo(x, t0);
    b.lineTo(x + 10, t0 + (t1 - t0) * 0.17);
    b.moveTo(x + 10, t1 - (t1 - t0) * 0.17);
    b.lineTo(x, t1);
    b.moveTo(x + 5, t0 + (t1 - t0) * 0.42);
    b.lineTo(x + 2, t0 + (t1 - t0) * 0.58);
    b.stroke();
  }
  for (const [y0, flip] of [[h * 0.19, false], [h * 0.81, true]]) {
    for (const [ctx, col] of [[c, '#262626'], [b, '#a8a8a8']]) {
      ctx.save();
      ctx.translate(0, y0);
      if (flip) ctx.scale(1, -1);
      ctx.fillStyle = col;
      ctx.textBaseline = 'middle';
      for (let k = 0; k < 2; k++) {
        ctx.font = 'bold 30px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('GZOWO  CORSA  GT', 30 + k * 512, 0);
        ctx.font = '19px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('255/35 ZR19  96Y  XL', 340 + k * 512, 0);
      }
      ctx.restore();
    }
    b.fillStyle = '#9a9a9a';
    b.fillRect(0, y0 - 20, w, 2);
    b.fillRect(0, y0 + 19, w, 2);
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

export function buildWheelAssets(register) {
  const hw = TW / 2;
  const prof = [
    [0.241, -hw + 0.02], [0.256, -hw + 0.006], [0.282, -hw - 0.002], [0.306, -hw + 0.002], [0.322, -hw + 0.012], [0.331, -hw + 0.03],
    [R, -hw + 0.055], [R, -0.02], [R, 0.02], [R, hw - 0.055], [0.331, hw - 0.03], [0.322, hw - 0.012], [0.306, hw - 0.002], [0.282, hw + 0.002], [0.256, hw - 0.006], [0.241, hw - 0.02],
  ];
  const tire = lathe(prof.map(([r, y]) => [r, y]), 72);
  tire.rotateX(Math.PI / 2);
  const rim = new Batch();
  const barrel = lathe([[0.226, -hw + 0.03], [0.222, -0.05], [0.218, 0.0], [0.224, hw - 0.05], [0.236, hw - 0.022], [0.246, hw - 0.012], [0.25, hw - 0.004], [0.243, hw + 0.002], [0.238, hw - 0.004]], 64);
  barrel.rotateX(Math.PI / 2);
  rim.add(barrel, FIN.rim);
  const lip = lathe([[0.251, hw - 0.004], [0.2505, hw + 0.002], [0.244, hw + 0.004]], 64);
  lip.rotateX(Math.PI / 2);
  rim.add(lip, FIN.rimFace);
  const spokeProfile = [[-0.011, 0.0], [0.011, 0.0], [0.0085, 0.019], [-0.0085, 0.019]];
  for (let i = 0; i < 5; i++) {
    for (const off of [-0.17, 0.17]) {
      const a = (i / 5) * Math.PI * 2 + off;
      const a2 = (i / 5) * Math.PI * 2 + off * 0.45;
      const path = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const r = 0.062 + t * 0.172;
        const ang = a2 + (a - a2) * t;
        const zz = hw - 0.072 + 0.045 * Math.sin(t * Math.PI * 0.5) + 0.012 * t * t;
        path.push(new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, zz));
      }
      const g = sweep(path, spokeProfile, { closed: true, up: new THREE.Vector3(0, 0, 1), scale: (t) => 1.25 - 0.35 * t });
      rim.add(g, FIN.rim);
      const face = sweep(path.map((p) => p.clone().setZ(p.z + 0.0195)), [[-0.0075, 0], [0.0075, 0], [0.0075, 0.0012], [-0.0075, 0.0012]], { closed: true, up: new THREE.Vector3(0, 0, 1), scale: (t) => 1.2 - 0.35 * t });
      rim.add(face, FIN.rimFace);
    }
  }
  rim.add(at(cyl(0.074, 0.08, 0.04, 40), 0, 0, hw - 0.062, Math.PI / 2), FIN.rim);
  rim.add(at(cyl(0.036, 0.034, 0.012, 32), 0, 0, hw - 0.036, Math.PI / 2), FIN.gloss);
  rim.add(at(cyl(0.026, 0.026, 0.004, 32), 0, 0, hw - 0.029, Math.PI / 2), FIN.alu);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    rim.add(at(cyl(0.0095, 0.0095, 0.02, 6), Math.cos(a) * 0.053, Math.sin(a) * 0.053, hw - 0.036, Math.PI / 2), FIN.chrome);
  }
  const disc = lathe([[0.098, 0.0], [0.178, 0.0], [0.178, 0.028], [0.098, 0.028]], 56);
  disc.rotateX(Math.PI / 2);
  rim.add(at(disc, 0, 0, -0.005), FIN.disc);
  rim.add(at(cyl(0.1, 0.1, 0.05, 40), 0, 0, 0.035, Math.PI / 2), FIN.hat);
  const rimGeo = rim.build();
  const cal = new Batch();
  const arc = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * 0.3 + (Math.PI * 0.42 * k) / 12;
    arc.push(new THREE.Vector3(Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0.009));
  }
  const prof2 = [[-0.035, -0.028], [0.035, -0.028], [0.04, 0.0], [0.035, 0.03], [-0.035, 0.03], [-0.04, 0.0]];
  cal.add(sweep(arc, prof2, { closed: true, up: new THREE.Vector3(0, 0, 1) }), FIN.caliper);
  for (const k of [0, 12]) cal.add(at(sphere(0.036, 1, 1, 0.9, 12, 8), arc[k].x, arc[k].y, 0.009), FIN.caliper);
  const caliperGeo = cal.build();
  const tex = tyreTextures();
  const tyreMat = new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bumpMap, bumpScale: 2.4, roughness: 0.88, metalness: 0 });
  if (register) register(tyreMat);
  return { tire, rimGeo, caliperGeo, tyreMat };
}

export function buildWheel(assets, side, solid) {
  const group = new THREE.Group();
  const flip = new THREE.Group();
  const spin = new THREE.Group();
  if (side < 0) flip.rotation.y = Math.PI;
  const tyre = new THREE.Mesh(assets.tire, assets.tyreMat);
  const rim = new THREE.Mesh(assets.rimGeo, solid);
  const caliper = new THREE.Mesh(assets.caliperGeo, solid);
  tyre.castShadow = true;
  tyre.receiveShadow = rim.receiveShadow = caliper.receiveShadow = true;
  spin.add(tyre, rim);
  flip.add(spin, caliper);
  group.add(flip);
  return { group, spin, caliper, tyre };
}

function bodyAttrs(g, proj = 2) {
  const n = g.attributes.position.count;
  g.setAttribute('aRest', new THREE.Float32BufferAttribute(g.attributes.position.array.slice(), 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aProj', new THREE.Float32BufferAttribute(new Float32Array(n).fill(proj), 1));
  g.computeBoundingSphere();
  return g;
}

export function windshieldShape(body) {
  const base = (u) => {
    const z = (u * 2 - 1) * 0.765;
    const x = CAR.cockpitFront + 0.01 - 0.085 * (z / 0.765) ** 2;
    const y = body.probeTop(x + 0.02, z).y + 0.012;
    return new THREE.Vector3(x, y, z);
  };
  const top = (u) => {
    const z = (u * 2 - 1) * 0.655;
    return new THREE.Vector3(0.235 - 0.06 * (z / 0.655) ** 2, 1.268 - 0.022 * (z / 0.655) ** 2, z);
  };
  const point = (u, v, out = new THREE.Vector3()) => {
    const a = base(u);
    const b = top(u);
    out.lerpVectors(a, b, v);
    out.x += 0.028 * Math.sin(Math.PI * v) * (1 - (u * 2 - 1) ** 2 * 0.6);
    return out;
  };
  return { base, top, point };
}

export function buildExterior({ body, mats }) {
  const ws = windshieldShape(body);
  const out = { shell: new Batch(), front: new Batch(), rear: new Batch(), doorL: new Batch(), doorR: new Batch() };

  const glass = grid(28, 18, (u, v, p) => ws.point(u, v, p));
  out.windshield = bodyAttrs(glass, 2);
  const fritPts = [];
  for (const [u0, v0, u1, v1] of [[0, 0, 1, 0], [0, 0, 0, 1], [1, 0, 1, 1], [0, 1, 1, 1]]) {
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      pts.push(ws.point(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t).add(new THREE.Vector3(-0.004, -0.003, 0)));
    }
    fritPts.push(pts);
  }
  for (const pts of fritPts) out.shell.add(tube(pts, 0.022, 4), FIN.gloss);

  const frame = [];
  const pillar = (u) => {
    const pts = [];
    for (let k = 0; k <= 16; k++) pts.push(ws.point(u, k / 16));
    const dir = u < 0.5 ? -1 : 1;
    const ext = pts.map((p) => p.clone().add(new THREE.Vector3(0.006, 0.004, dir * 0.022)));
    ext.push(ext[ext.length - 1].clone().add(new THREE.Vector3(-0.03, 0.006, -dir * 0.01)));
    return ext;
  };
  const prof = [[-0.042, -0.014], [0.042, -0.014], [0.046, 0.008], [0.034, 0.024], [-0.034, 0.024], [-0.046, 0.008]];
  for (const u of [0, 1]) frame.push(sweep(pillar(u), prof, { closed: true, up: new THREE.Vector3(1, 0.6, 0).normalize() }));
  const header = [];
  for (let k = 0; k <= 24; k++) header.push(ws.point(-0.03 + (1.06 * k) / 24, 1).add(new THREE.Vector3(-0.01, 0.018, 0)));
  frame.push(sweep(header, [[-0.05, -0.014], [0.036, -0.014], [0.042, 0.006], [0.026, 0.02], [-0.036, 0.02], [-0.052, 0.0]], { closed: true, up: new THREE.Vector3(0.45, 1, 0).normalize() }));
  out.frame = bodyAttrs(merge(frame), 2);
  const fp = out.frame.attributes.position.count;
  out.frame.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(fp * 3), 3));
  out.frame.setAttribute('aFinish', new THREE.Float32BufferAttribute(new Float32Array(fp * 4), 4));

  for (let s = 0; s < 2; s++) {
    const u = 0.32 + s * 0.36;
    const pivot = ws.point(u, 0).add(new THREE.Vector3(0.07, -0.006, 0));
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push(ws.point(u - 0.33 * t, 0.03 + 0.04 * t).add(new THREE.Vector3(0.012, 0.008, 0)));
    }
    out.shell.add(tube(pts, 0.006, 6), FIN.satin);
    out.shell.add(tube(pts.map((p) => p.clone().add(new THREE.Vector3(0.006, 0.01, 0))), 0.004, 5), FIN.rubber);
    out.shell.add(at(cyl(0.016, 0.018, 0.03, 12), pivot.x, pivot.y, pivot.z), FIN.satin);
  }

  const cowl = [];
  for (let k = 0; k < 18; k++) {
    const z = -0.62 + (1.24 * k) / 17;
    const p = body.probeTop(CAR.cowl - 0.04, z);
    cowl.push(at(box(0.05, 0.004, 0.05, 0.001), p.x, p.y + 0.002, z));
  }
  out.shell.add(merge(cowl), FIN.mesh);

  out.handles = {};
  out.handleLocal = {};
  for (const [tag, s] of [['L', -1], ['R', 1]]) {
    const n = new THREE.Vector3();
    const p = body.probeSide(-0.28, 0.835, s, new THREE.Vector3(), n);
    const B = out['door' + tag];
    const g1 = box(0.17, 0.034, 0.008, 0.005);
    const g2 = box(0.15, 0.016, 0.012, 0.0055);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), n, new THREE.Vector3(0, 1, 0));
    m.setPosition(p.clone().addScaledVector(n, -0.002));
    g1.applyMatrix4(m);
    m.setPosition(p.clone().addScaledVector(n, 0.0045));
    g2.applyMatrix4(m);
    B.add(g1, FIN.gloss);
    B.add(g2, FIN.chrome);
    out.handleLocal[tag] = p.clone().addScaledVector(n, 0.03);
  }

  out.mirrors = [];
  out.mirrorParts = [];
  for (const [tag, s] of [['L', -1], ['R', 1]]) {
    const base = body.probeSide(0.6, body.edgeY(0.6) - 0.004, s);
    const g = new THREE.Group();
    g.position.copy(base);
    const housing = box(0.085, 0.1, 0.19, 0.04, 4);
    const hp = housing.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i);
      const y = hp.getY(i);
      const z = hp.getZ(i);
      const k = x > 0 ? 1 - 0.35 * (x / 0.0425) ** 2 : 1;
      hp.setXYZ(i, x * (1 + 0.25 * Math.max(0, x / 0.0425)), y * k, z * (x > 0 ? 1 - 0.12 * (x / 0.0425) : 1) - s * 0.012 * (y / 0.05));
    }
    housing.computeVertexNormals();
    at(housing, 0.01, 0.075, s * 0.15, 0, 0, 0);
    const housingGeo = bodyAttrs(housing, s < 0 ? 0 : 1);
    const hc = housingGeo.attributes.position.count;
    housingGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(hc * 3), 3));
    housingGeo.setAttribute('aFinish', new THREE.Float32BufferAttribute(new Float32Array(hc * 4), 4));
    const housingMesh = new THREE.Mesh(housingGeo, mats.paint);
    housingMesh.castShadow = true;
    const parts = new Batch();
    const arm = [new THREE.Vector3(0.0, 0.0, -s * 0.01), new THREE.Vector3(0.0, 0.03, s * 0.035), new THREE.Vector3(0.0, 0.055, s * 0.075)];
    parts.add(tube(arm, 0.017, 10), FIN.gloss);
    parts.add(at(box(0.07, 0.012, 0.05, 0.005), 0, 0.004, s * 0.006), FIN.gloss);
    const glassG = new THREE.CircleGeometry(0.1, 28);
    glassG.scale(0.88, 0.44, 1);
    glassG.rotateY(-Math.PI / 2);
    parts.add(at(glassG, -0.034, 0.075, s * 0.15), FIN.chrome);
    parts.add(at(box(0.004, 0.006, 0.07, 0.002), 0.035, 0.03, s * 0.18), [0.6, 0.45, 0.2, 0.3, 0, 0], LAMP.INDICATOR);
    const partsMesh = new THREE.Mesh(parts.build(), mats.solid);
    g.add(housingMesh, partsMesh);
    g.userData.housing = housingMesh;
    out.mirrors.push(g);
    out.mirrorParts.push(housingMesh);
  }

  out.headInternals = new Batch();
  out.beamSpots = [];
  for (const tag of ['L', 'R']) {
    const quads = body.lenses.head[tag];
    if (!quads.length) continue;
    const back = [];
    for (const { q } of quads) {
      const d = 0.075;
      const pts = q.map(([x, y, z, nx, ny, nz]) => new THREE.Vector3(x - nx * d, y - ny * d, z - nz * d));
      const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]);
      g.computeVertexNormals();
      back.push(g);
    }
    out.headInternals.add(merge(back), FIN.darkChrome);
    const front = quads.filter(({ q }) => q[0][3] > 0.55);
    const zs = front.map(({ q }) => Math.abs(q[0][2]));
    const ys = front.map(({ q }) => q[0][1]);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    const yMid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const s = tag === 'L' ? -1 : 1;
    for (const f of [0.32, 0.66]) {
      const z = s * (z0 + (z1 - z0) * f);
      const n = new THREE.Vector3();
      const p = body.probeEnd(true, z, yMid - 0.005, new THREE.Vector3(), n);
      const c = p.clone().addScaledVector(n, -0.035);
      const ring = new THREE.TorusGeometry(0.026, 0.006, 8, 24);
      ring.rotateY(Math.PI / 2);
      out.headInternals.add(at(ring, c.x, c.y, c.z), FIN.chrome);
      out.headInternals.add(at(cyl(0.03, 0.026, 0.05, 20), c.x - 0.03, c.y, c.z, 0, 0, Math.PI / 2), FIN.reflector);
      out.headInternals.add(at(sphere(0.023, 0.6, 1, 1, 16, 10), c.x + 0.004, c.y, c.z), [0.05, 0.055, 0.06, 0.04, 0, 1], LAMP.BEAM);
      out.beamSpots.push(c);
    }
    const byCol = new Map();
    for (const { c, r, q } of quads) if (!byCol.has(c) || byCol.get(c).r > r) byCol.set(c, { r, q });
    const cols = [...byCol.keys()].sort((a, b) => a - b);
    const drl = cols.map((c) => {
      const { q } = byCol.get(c);
      const a = q[0];
      const b = q[3];
      return new THREE.Vector3((a[0] + b[0]) / 2 - a[3] * 0.014, (a[1] * 0.75 + b[1] * 0.25) + 0.004 - a[4] * 0.014, (a[2] + b[2]) / 2 - a[5] * 0.014);
    });
    if (drl.length > 3) out.headInternals.add(tube(drl, 0.0045, 6), [0.9, 0.9, 0.9, 0.2, 0, 0], LAMP.DRL);
    if (drl.length > 3) {
      const outer = drl.filter((p) => Math.abs(p.z) > 0.72 || p.x < 1.95);
      if (outer.length > 2) out.headInternals.add(tube(outer.map((p) => p.clone().add(new THREE.Vector3(0, 0.014, 0))), 0.0035, 5), [0.6, 0.45, 0.2, 0.3, 0, 0], LAMP.INDICATOR);
    }
  }

  out.tailInternals = new Batch();
  for (const tag of ['L', 'R']) {
    const quads = body.lenses.tail[tag];
    if (!quads.length) continue;
    const back = [];
    for (const { q } of quads) {
      const d = 0.035;
      const pts = q.map(([x, y, z, nx, ny, nz]) => new THREE.Vector3(x - nx * d, y - ny * d, z - nz * d));
      const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]);
      g.computeVertexNormals();
      back.push(g);
    }
    out.tailInternals.add(merge(back), FIN.housing);
    const byCol = new Map();
    for (const { c, q } of quads) byCol.set(c, q);
    const cols = [...byCol.keys()].sort((a, b) => a - b);
    const bar = cols.map((c) => {
      const q = byCol.get(c);
      const mx = (q[0][0] + q[3][0]) / 2;
      const my = (q[0][1] + q[3][1]) / 2;
      const mz = (q[0][2] + q[3][2]) / 2;
      return new THREE.Vector3(mx - q[0][3] * 0.012, my + 0.012, mz - q[0][5] * 0.012);
    });
    if (bar.length > 3) {
      out.tailInternals.add(tube(bar, 0.006, 6), [0.6, 0.05, 0.03, 0.3, 0, 0], LAMP.TAIL);
      out.tailInternals.add(tube(bar.map((p) => p.clone().add(new THREE.Vector3(0, -0.026, 0))).filter((p) => Math.abs(p.z) > 0.28), 0.0075, 6), [0.5, 0.04, 0.03, 0.3, 0, 0], LAMP.BRAKE);
    }
  }
  for (const s of [-1, 1]) {
    const n = new THREE.Vector3();
    const p = body.probeEnd(false, s * 0.33, 0.37, new THREE.Vector3(), n);
    out.rear.add(at(box(0.012, 0.03, 0.09, 0.006), p.x + 0.002, p.y, p.z), [0.9, 0.9, 0.9, 0.05, 0, 1], LAMP.REVERSE);
    out.rear.add(at(box(0.014, 0.04, 0.1, 0.008), p.x + 0.001, p.y, p.z), FIN.gloss);
  }

  const backPlate = (list, depth, finish, B) => {
    const geos = [];
    for (const { q } of list) {
      const pts = q.map(([x, y, z, nx, ny, nz]) => new THREE.Vector3(x - nx * depth, y - ny * depth, z - nz * depth));
      const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]);
      g.computeVertexNormals();
      geos.push(g);
    }
    if (geos.length) B.add(merge(geos), finish);
  };
  backPlate(body.holes.grille, 0.1, FIN.mesh, out.front);
  backPlate(body.holes.intake, 0.075, FIN.mesh, out.front);
  backPlate(body.holes.exhaust, 0.065, FIN.soot, out.rear);

  const rowsOf = (list) => {
    const rows = new Map();
    for (const h of list) {
      if (!rows.has(h.r)) rows.set(h.r, []);
      rows.get(h.r).push(h);
    }
    return rows;
  };
  const grilleRows = rowsOf(body.holes.grille);
  const rkeys = [...grilleRows.keys()].sort((a, b) => a - b);
  for (let i = 1; i < rkeys.length; i++) {
    const cells = grilleRows.get(rkeys[i]).sort((a, b) => a.q[0][2] - b.q[0][2]);
    const pts = cells.map((h) => new THREE.Vector3(h.q[0][0] - h.q[0][3] * 0.03, h.q[0][1], h.q[0][2] - h.q[0][5] * 0.03));
    const last = cells[cells.length - 1].q[1];
    pts.push(new THREE.Vector3(last[0] - last[3] * 0.03, last[1], last[2] - last[5] * 0.03));
    if (pts.length > 2) out.front.add(sweep(pts, [[-0.025, -0.003], [0.025, -0.003], [0.025, 0.003], [-0.025, 0.003]], { closed: true, up: new THREE.Vector3(1, 0, 0), twist: () => 0.3 }), FIN.satin);
  }
  const sideCells = (list) => {
    const out2 = { L: [], R: [] };
    for (const h of list) out2[h.side].push(h);
    return out2;
  };
  for (const [, cells] of Object.entries(sideCells(body.holes.exhaust))) {
    if (!cells.length) continue;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const h of cells) for (const v of h.q) {
      x += v[0];
      y += v[1];
      z += v[2];
    }
    const k = cells.length * 4;
    x /= k;
    y /= k;
    z /= k;
    for (const dz of [-0.048, 0.048]) {
      const tip = lathe([[0.04, 0], [0.042, 0.004], [0.042, 0.13], [0.036, 0.13], [0.036, 0.01], [0.032, 0.0]], 28);
      tip.rotateZ(Math.PI / 2);
      out.rear.add(at(tip, x - 0.05, y, z + dz), FIN.tip);
      out.rear.add(at(cyl(0.032, 0.032, 0.002, 20), x - 0.06, y, z + dz, 0, 0, Math.PI / 2), FIN.soot);
    }
  }
  for (const z of [-0.36, -0.18, 0, 0.18, 0.36]) {
    const fin = new THREE.Shape();
    fin.moveTo(0, 0);
    fin.lineTo(0.3, 0);
    fin.lineTo(0.3, 0.01);
    fin.lineTo(0.06, 0.06);
    fin.lineTo(0, 0.06);
    fin.closePath();
    const g = new THREE.ExtrudeGeometry(fin, { depth: 0.008, bevelEnabled: false });
    out.rear.add(at(g, -2.27, 0.172, z - 0.004), FIN.black);
  }
  out.rear.add(at(box(0.5, 0.008, 1.24, 0.003), -2.1, 0.175, 0, 0, 0, -0.12), FIN.black);

  const floor = [];
  const wells = (x, z) => [CAR.axleFront, CAR.axleRear].some((ax) => Math.abs(x - ax) < CAR.archRadius + 0.02 && Math.abs(z) > 0.56);
  const fy = (x) => (x > 1.92 ? 0.165 - (x - 1.92) * 0.24 : x < -2.0 ? 0.168 + (-2.0 - x) * 0.12 : 0.165);
  const gx = 80;
  const gz = 20;
  for (let i = 0; i < gx; i++) {
    for (let j = 0; j < gz; j++) {
      const x0 = -2.28 + (4.44 * i) / gx;
      const x1 = -2.28 + (4.44 * (i + 1)) / gx;
      const xm = (x0 + x1) / 2;
      const half = (xm > 2.0 ? 0.8 : xm < -2.15 ? 0.78 : 0.86) * (body.width(Math.min(1.85, Math.max(-2.08, xm))) / 0.9);
      const z0 = -half + (2 * half * j) / gz;
      const z1 = -half + (2 * half * (j + 1)) / gz;
      if (wells(xm, (z0 + z1) / 2)) continue;
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x0, fy(x0), z0), new THREE.Vector3(x0, fy(x0), z1), new THREE.Vector3(x1, fy(x1), z1),
        new THREE.Vector3(x0, fy(x0), z0), new THREE.Vector3(x1, fy(x1), z1), new THREE.Vector3(x1, fy(x1), z0),
      ]);
      g.computeVertexNormals();
      floor.push(g);
    }
  }
  out.shell.add(merge(floor), FIN.under);
  for (const ax of [CAR.axleFront, CAR.axleRear]) {
    for (const s of [-1, 1]) {
      const inner = 0.56;
      const outer = body.width(ax) - 0.02;
      const len = outer - inner;
      const arch = new THREE.CylinderGeometry(CAR.archRadius + 0.014, CAR.archRadius + 0.014, len, 36, 1, true, Math.PI / 2 - 0.15, Math.PI + 0.3);
      arch.rotateX(Math.PI / 2);
      out.shell.add(at(arch, ax, R, s * (inner + len / 2)), FIN.liner);
      const disk = new THREE.CircleGeometry(CAR.archRadius + 0.014, 32, -0.15, Math.PI + 0.3);
      out.shell.add(at(disk, ax, R, s * inner, 0, s > 0 ? 0 : Math.PI, 0), FIN.liner);
    }
  }

  const bay = [];
  bay.push(at(box(1.2, 0.02, 1.36, 0.01), 1.45, 0.42, 0));
  out.shell.add(merge(bay), FIN.under);
  out.shell.add(at(box(0.62, 0.12, 0.7, 0.05), 1.3, 0.58, 0), FIN.satin);
  out.shell.add(at(box(0.42, 0.02, 0.06, 0.008), 1.3, 0.645, -0.18), FIN.alu);
  out.shell.add(at(box(0.42, 0.02, 0.06, 0.008), 1.3, 0.645, 0.18), FIN.alu);
  for (const s of [-1, 1]) out.shell.add(at(cyl(0.07, 0.07, 0.04, 20), 1.62, 0.62, s * 0.5), FIN.alu);
  out.front.add(at(box(0.08, 0.1, 1.5, 0.02), 2.08, 0.32, 0), FIN.alu);
  out.shell.add(at(box(1.15, 0.36, 1.4, 0.04), -1.65, 0.66, 0), FIN.carpet);

  out.plate = new THREE.Mesh(new THREE.PlaneGeometry(0.305, 0.152), mats.plate);
  const pn = new THREE.Vector3();
  const pp = body.probeEnd(false, 0, 0.6, new THREE.Vector3(), pn);
  out.plate.position.copy(pp).addScaledVector(pn, 0.006);
  out.plate.lookAt(pp.clone().addScaledVector(pn, 1));
  out.rear.add(at(box(0.012, 0.17, 0.33, 0.006), pp.x, pp.y, pp.z), FIN.gloss);
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
