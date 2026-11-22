// Costa del Gzowo Cyber Truck: exterior geometry (flat stainless exoskeleton panels, doors, trapezoid arch flares, bumpers, light bars, glass, wiper, mirrors and the vault with its bed, bin and roll-up cover).
import * as THREE from 'three';
import { CT, topY, topW, beltY, sideZ, strip, archX } from './ctShape.js';
import { SteelBatch, V, polyGeo, ribbon, beam, mapGeo } from './ctGeo.js';
import { Batch, FIN, LAMP, at, box, cyl, merge } from '../carGeometry.js';
import { glassAttrs } from './ctMaterials.js';

const G = 0.004;
const CLAD = [0.032, 0.033, 0.035, 0.74, 0, 0];
const SEAL = [0.012, 0.012, 0.013, 0.6, 0, 0];
const LINER = [0.028, 0.028, 0.03, 0.88, 0, 0];
const SLAT = [0.035, 0.036, 0.04, 0.42, 0.25, 0.2];
const LAMPBAR = [0.06, 0.06, 0.065, 0.2, 0, 1];

const sideMap = (s) => (x, y, out) => out.set(x, y, s * sideZ(y));
const stripMap = (s) => (x, u, out) => strip(x, u, s, out);
const rect = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

function flareOutline(xc) {
  const o = [[xc + 0.68, CT.archBottom], [xc + 0.36, CT.archTop], [xc - 0.36, CT.archTop], [xc - 0.68, CT.archBottom]];
  const q = [[xc + 0.765, CT.archBottom], [xc + 0.406, CT.archTop + 0.075], [xc - 0.406, CT.archTop + 0.075], [xc - 0.765, CT.archBottom]];
  return { o, q };
}

function frame(outer, inner) {
  return ribbon(outer.concat([outer[0]]), inner.concat([inner[0]]));
}

function inset(points, d) {
  const c = points.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
  return points.map((p) => {
    const dir = c.clone().sub(p);
    const len = dir.length();
    return p.clone().addScaledVector(dir, Math.min(d / Math.max(len, 1e-4) * 1.4, 0.5));
  });
}

export function buildExterior() {
  const body = new SteelBatch(11);
  const doorSteel = { L: new SteelBatch(23), R: new SteelBatch(37) };
  const trim = new Batch();
  const doorTrim = { L: new Batch(), R: new Batch() };
  const glass = { windshield: [], roof: [], side: [], doorL: [], doorR: [] };
  const xf = CT.axleFront;
  const xr = CT.axleRear;
  const D = CT.doorFront;
  const M = CT.doorMid;
  const R = CT.doorRear;

  body.poly([V(2.836, topY(2.836), -topW(2.836)), V(2.836, topY(2.836), topW(2.836)), V(CT.windshield, topY(CT.windshield), topW(CT.windshield)), V(CT.windshield, topY(CT.windshield), -topW(CT.windshield))]);
  body.poly([V(2.842, 1.02, -0.86), V(2.842, 1.02, 0.86), V(2.84, 0.97, 0.995), V(2.8, 0.64, 0.99), V(2.8, 0.64, -0.99), V(2.84, 0.97, -0.995)]);
  body.poly([V(-2.842, 0.64, -0.99), V(-2.842, 0.64, 0.99), V(-2.842, 1.215, 0.995), V(-2.842, 1.215, -0.995)]);

  for (const s of [-1, 1]) {
    const tag = s < 0 ? 'L' : 'R';
    const dS = doorSteel[tag];
    const dT = doorTrim[tag];
    const sm = sideMap(s);
    const st = stripMap(s);
    body.map(rect(CT.windshield, 2.84, 0, 1), st);
    body.map(rect(CT.roofRear, CT.windshield, 0.93, 1), st);
    body.map(rect(-2.84, CT.roofRear, 0, 1), st);
    body.map(rect(D + G, CT.windshield, 0, 0.035), st);
    body.map(rect(CT.roofRear, M - G, 0, 0.035), st);
    body.map(rect(CT.roofRear, -0.86, 0.035, 0.93), st);
    dS.map(rect(M + G, D - G, 0, 0.035), st);
    const g1 = mapGeo(rect(M + 0.045, D - 0.03, 0.035, 0.93), st, 0.5);
    glass['door' + tag].push(g1);
    glass.side.push(mapGeo(rect(D + 0.03, CT.windshield - 0.02, 0.035, 0.93), st, 0.5));
    glass.side.push(mapGeo(rect(-0.86, M - 0.05, 0.035, 0.93), st, 0.5));
    trim.add(mapGeo(rect(M - 0.05, M + 0.045, 0.035, 0.93), stripMap(s), 0.5), SEAL);
    trim.add(mapGeo(rect(D - 0.03, D + 0.03, 0.035, 0.93), stripMap(s), 0.5), SEAL);

    const fenderBottom = archX(xf, 0.64, 1);
    body.map([[2.8, 0.64], [fenderBottom, 0.64], [xf + CT.archHalfTop, CT.archTop], [D + G, CT.archTop], [D + G, beltY(D)], [CT.windshield, beltY(CT.windshield)], [2.84, 0.97]], sm);
    dS.map([[D - G, CT.archTop], [xf - CT.archHalfTop, CT.archTop], [archX(xf, CT.rocker, -1), CT.rocker], [M + G, CT.rocker], [M + G, beltY(M)], [CT.apex, beltY(CT.apex)], [D - G, beltY(D)]], sm);
    body.map([[M - G, CT.rocker], [M - G, beltY(M)], [R + G, beltY(R)], [R + G, CT.rocker]], sm);
    body.map([[R - G, CT.rocker], [archX(xr, CT.rocker, 1), CT.rocker], [xr + CT.archHalfTop, CT.archTop], [xr - CT.archHalfTop, CT.archTop], [archX(xr, 0.64, -1), 0.64], [-2.84, 0.64], [-2.84, beltY(-2.84)], [CT.roofRear, beltY(CT.roofRear)], [R - G, beltY(R)]], sm);

    for (const x of [D, M, R]) {
      const y0 = x === D ? CT.archTop - 0.02 : CT.rocker;
      const y1 = beltY(x);
      trim.add(polyGeo([V(x - 0.02, y0, s * (sideZ(y0) - 0.015)), V(x + 0.02, y0, s * (sideZ(y0) - 0.015)), V(x + 0.02, y1, s * (sideZ(y1) - 0.015)), V(x - 0.02, y1, s * (sideZ(y1) - 0.015))]), SEAL);
    }

    for (const xc of [xf, xr]) {
      const { o, q } = flareOutline(xc);
      const proud = (p, k = 0.03) => V(p[0], p[1], s * (sideZ(p[1]) + k));
      trim.add(ribbon(o.map((p) => proud(p)), q.map((p) => proud(p))), CLAD);
      trim.add(ribbon(o.map((p) => proud(p)), o.map((p) => proud(p, -0.01))), CLAD);
      trim.add(ribbon(q.map((p) => proud(p)), q.map((p) => proud(p, -0.02))), CLAD);
      trim.add(ribbon(o.map((p) => proud(p, -0.01)), o.map((p) => V(p[0], p[1], s * 0.56))), LINER);
    }

    trim.add(at(box(archX(xf, 0.4, -1) - archX(xr, 0.4, 1), 0.15, 0.05), (archX(xf, 0.4, -1) + archX(xr, 0.4, 1)) / 2, 0.455, s * 0.985), CLAD);
    trim.add(at(box(2.8 - archX(xf, 0.64, 1) + 0.04, 0.3, 0.05), (2.8 + archX(xf, 0.64, 1)) / 2, 0.49, s * 0.975), CLAD);
    trim.add(at(box(archX(xr, 0.64, -1) + 2.84, 0.28, 0.05), (archX(xr, 0.64, -1) - 2.84) / 2, 0.5, s * 0.975), CLAD);

    const mx = 1.8;
    const my = beltY(mx) + 0.05;
    trim.add(beam(V(mx - 0.06, my - 0.02, s * 0.995), V(mx - 0.02, my + 0.03, s * 1.12), 0.03, 0.05), FIN.satin);
    trim.add(at(box(0.11, 0.13, 0.2, 0.03), mx - 0.04, my + 0.08, s * 1.17, 0, s * 0.1, 0), FIN.satin);
    trim.add(at(box(0.012, 0.11, 0.18, 0.02), mx - 0.1, my + 0.08, s * 1.17, 0, s * 0.1, 0), FIN.darkChrome);

    const bd = V(0, 0.049, -s * 0.135).normalize();
    trim.add(beam(V(2.842, 0.955, s * 0.99), V(2.843, 1.004, s * 0.855), 0.008, 0.016, V(0, Math.abs(bd.z), -Math.sign(bd.z) * bd.y)), LAMPBAR, LAMP.DRL);
    trim.add(at(box(0.02, 0.032, 0.42), 2.808, 0.585, s * 0.63), LAMPBAR, LAMP.BEAM);
    trim.add(at(box(0.02, 0.012, 0.42), 2.808, 0.615, s * 0.63), LAMPBAR, LAMP.DRL);
    trim.add(at(box(0.02, 0.03, 0.16), -2.866, 0.585, s * 0.8), LAMPBAR, LAMP.REVERSE);
    trim.add(at(box(0.02, 0.022, 0.06), -2.866, 0.585, s * 0.94), LAMPBAR, LAMP.TAIL);
  }

  trim.add(beam(V(2.843, 1.004, -0.86), V(2.843, 1.004, 0.86), 0.008, 0.016, V(0, 1, 0)), LAMPBAR, LAMP.DRL);
  trim.add(beam(V(-2.848, 1.257, -0.9), V(-2.848, 1.257, 0.9), 0.008, 0.017, V(0, 1, 0)), LAMPBAR, LAMP.TAIL);
  trim.add(polyGeo([V(-2.845, 1.214, -0.995), V(-2.845, 1.214, 0.995), V(-2.845, 1.302, 0.83), V(-2.845, 1.302, -0.83)]), SEAL);
  trim.add(at(box(0.012, 0.004, 1.5), 2.77, topY(2.77) + 0.001, 0), SEAL);

  trim.add(at(box(0.2, 0.32, 1.96), 2.705, 0.49, 0), CLAD);
  trim.add(at(box(0.012, 0.1, 1.2), 2.81, 0.42, 0), FIN.mesh);
  trim.add(at(box(0.3, 0.04, 1.8), 2.6, 0.32, 0), CLAD);
  trim.add(at(box(0.24, 0.28, 1.96), -2.74, 0.5, 0), CLAD);
  trim.add(at(box(0.06, 0.08, 0.8), -2.88, 0.44, 0), CLAD);
  trim.add(at(box(5.1, 0.04, 1.3), 0, 0.33, 0), FIN.under);
  trim.add(at(box(2.4, 0.04, 1.9), 0.02, 0.34, 0), FIN.under);
  trim.add(at(box(0.04, 0.3, 1.3), 1.25, 0.48, 0), FIN.under);
  trim.add(at(box(0.04, 0.3, 1.3), -1.22, 0.48, 0), FIN.under);

  const xw = CT.windshield;
  const xa = CT.apex;
  const xb = CT.roofRear;
  const ws = [V(xw - 0.005, topY(xw - 0.005), -topW(xw) + 0.005), V(xw - 0.005, topY(xw - 0.005), topW(xw) - 0.005), V(xa + 0.01, topY(xa + 0.01), topW(xa) - 0.004), V(xa + 0.01, topY(xa + 0.01), -topW(xa) + 0.004)];
  const up = (pts, d) => pts.map((p) => p.clone().setY(p.y + d));
  glass.windshield.push(polyGeo(up(ws, 0.004)));
  trim.add(frame(up(ws, 0.001), up(inset(ws, 0.055), 0.001)), SEAL);
  const rf = [V(xa - 0.01, topY(xa - 0.01), -topW(xa) + 0.004), V(xa - 0.01, topY(xa - 0.01), topW(xa) - 0.004), V(xb + 0.005, topY(xb + 0.005), topW(xb) - 0.004), V(xb + 0.005, topY(xb + 0.005), -topW(xb) + 0.004)];
  glass.roof.push(polyGeo(up(rf, 0.004)));
  trim.add(frame(up(rf, 0.001), up(inset(rf, 0.05), 0.001)), SEAL);
  trim.add(beam(V(xa, CT.apexY + 0.004, -topW(xa)), V(xa, CT.apexY + 0.004, topW(xa)), 0.03, 0.006, V(0, 1, 0)), SEAL);
  const cap = [V(xb, topY(xb) + 0.002, -topW(xb)), V(xb, topY(xb) + 0.002, topW(xb)), V(-1.22, topY(-1.22) - 0.004, topW(-1.22)), V(-1.22, topY(-1.22) - 0.004, -topW(-1.22))];
  trim.add(polyGeo(cap), SEAL);

  const wx0 = xw - 0.04;
  const wx1 = 0.78;
  const wz0 = -topW(wx0) + 0.1;
  const wz1 = -topW(wx1) + 0.08;
  trim.add(beam(V(wx0, topY(wx0) + 0.02, wz0), V(wx1, topY(wx1) + 0.02, wz1), 0.022, 0.014, V(0.318, 1, 0).normalize()), FIN.satin);
  trim.add(beam(V(wx0 - 0.04, topY(wx0) + 0.03, wz0 - 0.01), V(wx1 + 0.06, topY(wx1) + 0.012, wz1 + 0.01), 0.012, 0.028, V(0.318, 1, 0).normalize()), FIN.rubber);
  trim.add(at(cyl(0.025, 0.03, 0.05, 12), wx0 + 0.02, topY(wx0) + 0.02, wz0), FIN.satin);

  const bed = buildBed(trim);
  return {
    body: body.build(),
    doorSteel: { L: doorSteel.L.build(), R: doorSteel.R.build() },
    trim,
    doorTrim,
    glass: {
      windshield: glassAttrs(merge(glass.windshield)),
      roof: glassAttrs(merge(glass.roof)),
      side: glassAttrs(merge(glass.side)),
      doorL: glassAttrs(merge(glass.doorL)),
      doorR: glassAttrs(merge(glass.doorR)),
      rear: glassAttrs(polyGeo([V(CT.bedFront - 0.004, 1.02, -0.5), V(CT.bedFront - 0.004, 1.02, 0.5), V(CT.bedFront - 0.004, 1.48, 0.5), V(CT.bedFront - 0.004, 1.48, -0.5)])),
    },
    bed,
  };
}

function buildBed(trim) {
  const x0 = CT.bedFront;
  const x1 = CT.bedRear;
  const fy = CT.bedFloor;
  const wallZ = 0.8;
  const binX0 = -2.5;
  const binX1 = -1.7;
  const binZ = 0.55;
  const binY = 0.43;
  trim.add(at(box(x0 - binX1, 0.02, wallZ * 2), (x0 + binX1) / 2, fy - 0.01, 0), LINER);
  trim.add(at(box(binX0 - x1, 0.02, wallZ * 2), (binX0 + x1) / 2, fy - 0.01, 0), LINER);
  for (const s of [-1, 1]) trim.add(at(box(binX1 - binX0, 0.02, wallZ - binZ), (binX0 + binX1) / 2, fy - 0.01, s * (wallZ + binZ) / 2), LINER);
  trim.add(at(box(binX1 - binX0, 0.02, binZ * 2), (binX0 + binX1) / 2, binY, 0), LINER);
  for (const s of [-1, 1]) trim.add(at(box(binX1 - binX0, fy - binY, 0.02), (binX0 + binX1) / 2, (fy + binY) / 2, s * binZ), LINER);
  for (const x of [binX0, binX1]) trim.add(at(box(0.02, fy - binY, binZ * 2), x, (fy + binY) / 2, 0), LINER);
  for (let i = 0; i < 6; i++) trim.add(at(box(binX1 - binX0 - 0.1, 0.006, 0.03), (binX0 + binX1) / 2, binY + 0.012, -0.4 + i * 0.16), FIN.plastic);
  for (const s of [-1, 1]) {
    const a = V(x0, fy, s * wallZ);
    const b = V(x1, fy, s * wallZ);
    const c = V(x1, 1.2, s * wallZ);
    const d = V(x0, 1.2, s * wallZ);
    trim.add(polyGeo([a, b, c, d]), LINER);
    trim.add(polyGeo([d, c, V(x1, topY(x1) - 0.015, s * (topW(x1) - 0.01)), V(x0, topY(x0) - 0.015, s * (topW(x0) - 0.01))]), LINER);
    trim.add(polyGeo([V(x1, 1.2, s * wallZ), V(x1, 1.214, s * 0.99), V(x1, topY(x1) - 0.005, s * (topW(x1))), V(x1, topY(x1) - 0.015, s * (topW(x1) - 0.01))]), LINER);
    trim.add(at(box(0.16, 0.1, 0.012), -1.55, 0.98, s * (wallZ - 0.008)), FIN.plastic);
    for (const k of [-1, 1]) trim.add(at(box(0.012, 0.03, 0.006), -1.55 + k * 0.03, 0.98, s * (wallZ - 0.016)), FIN.black);
    trim.add(at(box(0.6, 0.012, 0.004), -2.1, 1.16, s * (wallZ - 0.004)), [0.9, 0.9, 0.95, 0.3, 0, 0], LAMP.AMBIENT);
  }
  trim.add(polyGeo([V(x1, fy, -wallZ), V(x1, fy, wallZ), V(x1, 1.214, wallZ), V(x1, 1.214, -wallZ)]), LINER);
  const wy = topY(x0) - 0.01;
  trim.add(polyGeo([V(x0, fy, -wallZ), V(x0, fy, wallZ), V(x0, 1.02, wallZ), V(x0, 1.02, -wallZ)]), LINER);
  trim.add(polyGeo([V(x0, 1.48, -wallZ), V(x0, 1.48, wallZ), V(x0, wy, topW(x0)), V(x0, wy, -topW(x0))]), LINER);
  for (const s of [-1, 1]) trim.add(polyGeo([V(x0, 1.02, s * 0.5), V(x0, 1.02, s * wallZ), V(x0, 1.48, s * wallZ), V(x0, 1.48, s * 0.5)]), LINER);
  const path = coverPath();
  const drum = path.F.clone().addScaledVector(path.n, -0.078);
  trim.add(at(cyl(0.085, 0.085, topW(-1.22) * 2 - 0.03, 24), drum.x, drum.y - 0.006, 0, Math.PI / 2), FIN.black);
  const lid = new Batch();
  lid.add(at(box(binX1 - binX0, 0.022, binZ * 2 - 0.01), -(binX1 - binX0) / 2, 0.011, 0), LINER);
  lid.add(at(box(0.12, 0.012, 0.04), -(binX1 - binX0) + 0.1, 0.024, 0), FIN.satin);
  return { lid: lid.build(), lidHinge: V(binX1, fy - 0.022, 0) };
}

export function coverPath() {
  const fx = -1.22;
  const tx = CT.bedRear - 0.06;
  const F = V(fx, topY(fx) - 0.008, 0);
  const T = V(tx, topY(tx) - 0.008, 0);
  const d = T.clone().sub(F);
  const length = d.length();
  d.normalize();
  const n = V(-d.y, d.x, 0);
  if (n.y < 0) n.negate();
  return { F, d, n, length };
}

export function buildCover() {
  const path = coverPath();
  const pitch = 0.058;
  const count = Math.ceil(path.length / pitch);
  const slat = box(pitch - 0.004, 0.014, 1, 0.003, 1);
  const base = slat.index ? slat.toNonIndexed() : slat;
  const bp = base.attributes.position.array.slice();
  const bn = base.attributes.normal.array.slice();
  const vpc = bp.length / 3;
  const b = new Batch();
  for (let i = 0; i < count; i++) b.add(base.clone(), SLAT);
  const geometry = b.build();
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  const m = new THREE.Matrix4();
  const q = new THREE.Vector3();
  const xA = new THREE.Vector3();
  const yA = new THREE.Vector3();
  const zA = new THREE.Vector3(0, 0, 1);
  const c = new THREE.Vector3();
  let last = -1;
  const drumC = path.F.clone().addScaledVector(path.n, -0.078);
  function place(open) {
    if (Math.abs(open - last) < 1e-4) return false;
    last = open;
    const pos = geometry.attributes.position.array;
    const nor = geometry.attributes.normal.array;
    const shift = open * count * pitch;
    for (let i = 0; i < count; i++) {
      const s = (i + 0.5) * pitch - shift;
      let width;
      if (s >= 0) {
        c.copy(path.F).addScaledVector(path.d, s);
        xA.copy(path.d);
        yA.copy(path.n);
        width = topW(c.x) - 0.012;
      } else {
        const r = Math.max(0.03, 0.078 - 0.011 * (-s / (2 * Math.PI * 0.07)));
        const a = -s / r;
        c.copy(drumC).addScaledVector(path.n, r * Math.cos(a)).addScaledVector(path.d, -r * Math.sin(a));
        yA.copy(path.n).multiplyScalar(Math.cos(a)).addScaledVector(path.d, -Math.sin(a));
        xA.crossVectors(yA, zA).negate();
        width = topW(-1.22) - 0.03;
      }
      m.makeBasis(xA, yA, zA);
      for (let k = 0; k < vpc; k++) {
        q.set(bp[k * 3], bp[k * 3 + 1], bp[k * 3 + 2] * width * 2).applyMatrix4(m).add(c);
        const o = (i * vpc + k) * 3;
        pos[o] = q.x;
        pos[o + 1] = q.y;
        pos[o + 2] = q.z;
        q.set(bn[k * 3], bn[k * 3 + 1], bn[k * 3 + 2]).applyMatrix4(m).normalize();
        nor[o] = q.x;
        nor[o + 1] = q.y;
        nor[o + 2] = q.z;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingSphere();
    return true;
  }
  place(0);
  return { geometry, place };
}
