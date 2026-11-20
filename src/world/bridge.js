// Riverside: road strip and the concrete girder bridge (deck, girders, piers, abutments, railings, lamps) with colliders.
import * as THREE from 'three';
import { BRIDGE, ROAD } from '../config.js';
import { roadY, heightAt } from './heightfield.js';
import { extrudeX, box, worldUV, placed, solid, merge } from './geometry.js';
import { hookMaterial } from '../render/shaderHooks.js';

const CROWN = 0.018;
const L = BRIDGE.halfLength;
const DECK = BRIDGE.deckY;
const CURB_Y = DECK - CROWN * BRIDGE.carriageHalfWidth;
const WALK_Y = CURB_Y + BRIDGE.sidewalkHeight;
const PARAPET_TOP = WALK_Y + 0.45;
const RAIL_TOP = WALK_Y + 1.12;
const SLAB_BOTTOM = DECK - 0.45;
const GIRDER_BOTTOM = SLAB_BOTTOM - 1.35;
const CAP_TOP = GIRDER_BOTTOM - 0.08;
const CAP_BOTTOM = CAP_TOP - 1.3;

export const BRIDGE_LEVELS = { CURB_Y, WALK_Y, PARAPET_TOP, RAIL_TOP, SLAB_BOTTOM, GIRDER_BOTTOM, CAP_TOP, CAP_BOTTOM };

const ASPHALT_PARS = `
uniform sampler2D tNoise;
uniform float uMarkings;
`;
const ASPHALT_COLOR = `
{
  float az = abs(vWPos.z);
  float n1 = texture2D(tNoise, vWPos.xz * 0.11).r;
  float n2 = texture2D(tNoise, vWPos.xz * vec2(0.021, 0.6)).g;
  float n3 = texture2D(tNoise, vWPos.xz * 0.013).b;
  float lane = abs(az - 1.95);
  float track = exp(-pow((lane - 0.82) / 0.3, 2.0));
  float oil = exp(-pow(lane / 0.4, 2.0)) * (0.35 + 0.65 * n2);
  diffuseColor.rgb *= 0.86 + 0.2 * n3;
  diffuseColor.rgb *= 1.0 + 0.12 * track - 0.16 * oil;
  vec2 cell = floor(vWPos.xz / vec2(9.0, 3.9));
  float patchRnd = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  vec2 cuv = fract(vWPos.xz / vec2(9.0, 3.9));
  float inPatch = step(0.86, patchRnd) * step(0.06, cuv.x) * step(cuv.x, 0.94) * step(0.05, cuv.y) * step(cuv.y, 0.95) * step(az, 4.4);
  diffuseColor.rgb *= mix(1.0, 0.72, inPatch);
  float dust = smoothstep(3.75, 4.5, az + (n1 - 0.5) * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.33, 0.27), dust * 0.6);
  float aa = fwidth(vWPos.z) * 1.3;
  float wear = smoothstep(0.2, 0.62, texture2D(tNoise, vWPos.xz * 0.31).r * 0.55 + texture2D(tNoise, vWPos.xz * 2.7).g * 0.55);
  float yellow = 1.0 - smoothstep(0.052, 0.052 + aa, abs(az - 0.16));
  float white = 1.0 - smoothstep(0.06, 0.06 + aa, abs(az - 3.78));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.41, 0.045), yellow * (0.3 + 0.62 * wear) * uMarkings);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.66, 0.63), white * (0.25 + 0.6 * wear) * uMarkings);
}
`;

const CONCRETE_PARS = `
uniform sampler2D tNoise;
uniform float uAlgae;
uniform float uStreak;
uniform float uJoint;
uniform vec3 uTone;
`;
const CONCRETE_COLOR = `
{
  float vertical = 1.0 - abs(vWNormal.y);
  float along = dot(vWPos.xz, vec2(0.83, 0.56));
  float streak = texture2D(tNoise, vec2(along * 0.085, vWPos.y * 0.011)).g;
  float fine = texture2D(tNoise, vec2(along * 0.43, vWPos.y * 0.03)).r;
  float runoff = (smoothstep(0.5, 0.82, streak) * 0.75 + smoothstep(0.62, 0.9, fine) * 0.35) * vertical;
  float blotch = texture2D(tNoise, vWPos.xz * 0.017 + vWPos.y * 0.023).b;
  diffuseColor.rgb *= uTone * (0.78 + 0.38 * blotch);
  diffuseColor.rgb *= mix(1.0, 0.5, runoff * uStreak);
  float under = smoothstep(-0.2, -0.9, vWNormal.y);
  diffuseColor.rgb *= mix(1.0, 0.72, under);
  float line = smoothstep(1.9, 0.15, vWPos.y) * uAlgae;
  float mark = smoothstep(0.75, 0.55, abs(vWPos.y - 0.55) + blotch * 0.5) * uAlgae;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.38, 0.47, 0.3), clamp(line * 0.85 + mark * 0.3, 0.0, 1.0));
  if (uJoint > 0.0) {
    float j = abs(fract(vWPos.x / uJoint) - 0.5) * uJoint;
    float groove = (1.0 - smoothstep(0.004, 0.012 + fwidth(vWPos.x), j)) * step(0.5, vWNormal.y);
    diffuseColor.rgb *= mix(1.0, 0.35, groove);
  }
}
`;

function asphaltStrip(x0, x1, step) {
  const zs = [-ROAD.halfWidth, -2.25, 0, 2.25, ROAD.halfWidth];
  const cols = zs.length;
  const rows = Math.round((x1 - x0) / step) + 1;
  const pos = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);
  const index = [];
  for (let r = 0; r < rows; r++) {
    const x = x0 + ((x1 - x0) * r) / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const o = r * cols + c;
      pos[o * 3] = x;
      pos[o * 3 + 1] = roadY(x) - CROWN * Math.abs(zs[c]);
      pos[o * 3 + 2] = zs[c];
      uv[o * 2] = x * 0.27;
      uv[o * 2 + 1] = zs[c] * 0.27;
      if (r < rows - 1 && c < cols - 1) index.push(o, o + 1, o + cols, o + 1, o + cols + 1, o + cols);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function lamp(x, side) {
  const z = side * (BRIDGE.deckHalfWidth - 0.17);
  const parts = [];
  parts.push(placed(new THREE.BoxGeometry(0.34, 0.5, 0.34), x, PARAPET_TOP + 0.25, z));
  parts.push(placed(new THREE.CylinderGeometry(0.065, 0.1, 7.6, 14), x, PARAPET_TOP + 0.5 + 3.8, z));
  const top = PARAPET_TOP + 0.5 + 7.6;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, top - 0.1, z), new THREE.Vector3(x, top + 0.75, z - side * 0.25), new THREE.Vector3(x, top + 0.82, z - side * 2.3));
  parts.push(new THREE.TubeGeometry(curve, 14, 0.05, 10, false));
  parts.push(placed(new THREE.BoxGeometry(0.3, 0.13, 0.78), x, top + 0.8, z - side * 2.55));
  return parts;
}

export async function createBridge({ assets, lighting, physics, scene, noise }) {
  const [asphaltMaps, dirtyMaps, brushedMaps, precastMaps, wornMaps, railMaps] = await Promise.all([
    assets.pbr('asphalt_02'),
    assets.pbr('dirty_concrete'),
    assets.pbr('brushed_concrete'),
    assets.pbr('concrete_wall_008'),
    assets.pbr('concrete_floor_worn_001'),
    assets.pbr('rusty_metal_02'),
  ]);
  const noiseU = { value: noise };
  const concrete = (maps, key, opts = {}) =>
    hookMaterial(new THREE.MeshStandardMaterial({ ...maps, metalness: 0, roughness: 1, aoMapIntensity: 0.8, normalScale: new THREE.Vector2(opts.bump ?? 1, opts.bump ?? 1) }), {
      key: 'concrete',
      uniforms: { tNoise: noiseU, uAlgae: { value: opts.algae ?? 0 }, uStreak: { value: opts.streak ?? 1 }, uJoint: { value: opts.joint ?? 0 }, uTone: { value: new THREE.Color(...(opts.tone ?? [1, 1, 1])) } },
      pars: CONCRETE_PARS,
      color: CONCRETE_COLOR,
    });
  const mat = {
    asphalt: hookMaterial(new THREE.MeshStandardMaterial({ ...asphaltMaps, metalness: 0, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2), color: 0xb8b8b8 }), {
      key: 'asphalt',
      uniforms: { tNoise: noiseU, uMarkings: { value: 1 } },
      pars: ASPHALT_PARS,
      color: ASPHALT_COLOR,
    }),
    deck: concrete(dirtyMaps, 'deck', { tone: [0.8, 0.79, 0.76], streak: 1 }),
    pier: concrete(dirtyMaps, 'pier', { tone: [0.74, 0.73, 0.69], algae: 1, streak: 1.1 }),
    girder: concrete(precastMaps, 'girder', { tone: [0.72, 0.71, 0.68], streak: 0.8, bump: 0.6 }),
    sidewalk: concrete(brushedMaps, 'sidewalk', { tone: [0.9, 0.89, 0.86], streak: 0.5, joint: 1.6 }),
    worn: concrete(wornMaps, 'worn', { tone: [0.82, 0.8, 0.76], streak: 0.9, algae: 0.6 }),
    rail: new THREE.MeshStandardMaterial({ ...railMaps, metalness: 0.35, roughness: 0.9, color: 0xd9dbd6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2a2b2d, metalness: 0.8, roughness: 0.55 }),
    galvanized: new THREE.MeshStandardMaterial({ color: 0x8f9396, metalness: 0.85, roughness: 0.48 }),
    lens: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.25, metalness: 0, emissive: new THREE.Color(1.0, 0.72, 0.38), emissiveIntensity: 14 }),
  };
  mat.rail.metalnessMap = null;
  Object.values(mat).forEach((m) => lighting.register(m));

  const group = new THREE.Group();
  group.name = 'bridge';

  const road = new THREE.Mesh(asphaltStrip(-ROAD.endX - 12, ROAD.endX + 12, 2), mat.asphalt);
  road.receiveShadow = true;
  road.matrixAutoUpdate = false;
  group.add(road);
  physics.staticTrimesh(new Float32Array(road.geometry.attributes.position.array), new Uint32Array(road.geometry.index.array), 'asphalt', 1);

  const skirt = [];
  for (const s of [-1, 1]) {
    for (const sx of [-1, 1]) {
      for (let x = L; x < ROAD.endX + 12; x += 4) {
        const xa = sx > 0 ? x : -x - 4;
        const zEdge = s * ROAD.halfWidth;
        const prof = s > 0 ? [[zEdge, -CROWN * ROAD.halfWidth - 0.3], [zEdge + 0.02, -CROWN * ROAD.halfWidth - 0.3], [zEdge + 0.02, -CROWN * ROAD.halfWidth], [zEdge, -CROWN * ROAD.halfWidth]] : [[zEdge - 0.02, -CROWN * ROAD.halfWidth - 0.3], [zEdge, -CROWN * ROAD.halfWidth - 0.3], [zEdge, -CROWN * ROAD.halfWidth], [zEdge - 0.02, -CROWN * ROAD.halfWidth]];
        skirt.push(extrudeX(prof, xa, xa + 4, { caps: false, yAt: roadY }));
      }
    }
  }
  group.add(solid(skirt, mat.asphalt, { cast: false }));

  const e = BRIDGE.deckHalfWidth;
  const c = BRIDGE.carriageHalfWidth;
  const deckParts = [extrudeX([[-e, DECK - 0.32], [-e + 0.4, SLAB_BOTTOM], [e - 0.4, SLAB_BOTTOM], [e, DECK - 0.32], [e, CURB_Y - 0.02], [-e, CURB_Y - 0.02]], -L, L)];
  const walkParts = [];
  for (const s of [-1, 1]) {
    const prof = s > 0 ? [[c, CURB_Y - 0.02], [e, CURB_Y - 0.02], [e, WALK_Y], [c + 0.04, WALK_Y], [c, WALK_Y - 0.035]] : [[-e, CURB_Y - 0.02], [-c, CURB_Y - 0.02], [-c, WALK_Y - 0.035], [-c - 0.04, WALK_Y], [-e, WALK_Y]];
    walkParts.push(extrudeX(prof, -L, L, { uv: 0.45 }));
  }
  group.add(solid(walkParts, mat.sidewalk));
  physics.staticBox(-L, L, SLAB_BOTTOM, CURB_Y - 0.02, -e, e, 'concrete');
  physics.staticBox(-L, L, CURB_Y - 0.02, WALK_Y, c, e, 'concrete');
  physics.staticBox(-L, L, CURB_Y - 0.02, WALK_Y, -e, -c, 'concrete');

  const girderProfile = (z0) => [[-0.33, 0], [0.33, 0], [0.33, 0.2], [0.1, 0.38], [0.1, 1.1], [0.25, 1.22], [0.25, 1.35], [-0.25, 1.35], [-0.25, 1.22], [-0.1, 1.1], [-0.1, 0.38], [-0.33, 0.2]].map(([z, y]) => [z + z0, y + GIRDER_BOTTOM]);
  const girderParts = [];
  const spans = [-L, ...BRIDGE.pierXs, L];
  const girderZ = [-4.9, -2.45, 0, 2.45, 4.9];
  const steelParts = [];
  for (let i = 0; i < spans.length - 1; i++) {
    const a = spans[i] + (i === 0 ? 0.7 : 0.3);
    const b = spans[i + 1] - (i === spans.length - 2 ? 0.7 : 0.3);
    for (const z of girderZ) {
      girderParts.push(extrudeX(girderProfile(z), a, b, { uv: 0.4 }));
      steelParts.push(box(a + 0.1, a + 0.55, CAP_TOP, GIRDER_BOTTOM, z - 0.28, z + 0.28));
      steelParts.push(box(b - 0.55, b - 0.1, CAP_TOP, GIRDER_BOTTOM, z - 0.28, z + 0.28));
    }
    for (const x of [a + 0.6, (a + b) / 2, b - 0.6]) {
      for (let k = 0; k < girderZ.length - 1; k++) girderParts.push(box(x - 0.12, x + 0.12, GIRDER_BOTTOM + 0.42, SLAB_BOTTOM, girderZ[k] + 0.1, girderZ[k + 1] - 0.1, 0.4));
    }
    physics.staticBox(a, b, GIRDER_BOTTOM, SLAB_BOTTOM, -5.25, 5.25, 'concrete');
  }
  group.add(solid(girderParts, mat.girder));

  const pierParts = [];
  for (const px of BRIDGE.pierXs) {
    pierParts.push(extrudeX([[-4.4, CAP_BOTTOM], [4.4, CAP_BOTTOM], [6.1, CAP_BOTTOM + 0.72], [6.1, CAP_TOP], [-6.1, CAP_TOP], [-6.1, CAP_BOTTOM + 0.72]], px - 0.8, px + 0.8));
    physics.staticBox(px - 0.8, px + 0.8, CAP_BOTTOM + 0.2, CAP_TOP, -6.1, 6.1, 'concrete');
    for (const s of [-1, 1]) {
      const z = s * BRIDGE.columnZ;
      const bed = heightAt(px, z);
      const col = worldUV(placed(new THREE.CylinderGeometry(BRIDGE.columnRadius, BRIDGE.columnRadius, CAP_BOTTOM - bed + 1.5, 36, 1, true), px, (CAP_BOTTOM + bed - 1.5) / 2, z), 0.3);
      pierParts.push(col);
      pierParts.push(box(px - 1.25, px + 1.25, bed - 1.2, bed + 0.28, z - 1.25, z + 1.25));
      physics.staticCylinder(px, bed - 1, CAP_BOTTOM, z, BRIDGE.columnRadius, 'concrete');
      physics.staticBox(px - 1.25, px + 1.25, bed - 1.2, bed + 0.28, z - 1.25, z + 1.25, 'concrete');
    }
  }
  group.add(solid(pierParts, mat.pier));

  const abutParts = [];
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? L - 1.0 : -L - 0.4;
    const x1 = s > 0 ? L + 0.4 : -L + 1.0;
    abutParts.push(box(x0, x1, 2.6, CAP_TOP, -e - 0.2, e + 0.2));
    const bx0 = s > 0 ? L - 0.02 : -L - 0.4;
    const bx1 = s > 0 ? L + 0.4 : -L + 0.02;
    abutParts.push(box(bx0, bx1, CAP_TOP, CURB_Y - 0.02, -e - 0.2, e + 0.2));
    physics.staticBox(x0, x1, 2.6, CAP_TOP, -e - 0.2, e + 0.2, 'concrete');
    physics.staticBox(bx0, bx1, CAP_TOP, CURB_Y - 0.02, -e - 0.2, e + 0.2, 'concrete');
    for (const zs of [-1, 1]) {
      const za = zs * (e + 0.2);
      const zb = zs * 13.6;
      const wx0 = s > 0 ? L - 1.0 : -L - 0.4;
      const wx1 = s > 0 ? L + 0.4 : -L + 1.0;
      const top0 = WALK_Y + 0.25;
      const top1 = top0 - 0.52 * (Math.abs(zb) - Math.abs(za)) + 0.5;
      const zMin = Math.min(za, zb);
      const zMax = Math.max(za, zb);
      const prof = [[zMin, 2.2], [zMax, 2.2], [zMax, za > zb ? top0 : top1], [zMin, za > zb ? top1 : top0]];
      abutParts.push(extrudeX(prof, wx0, wx1));
      physics.staticBox(wx0, wx1, 2.2, Math.min(top0, top1) + 0.6, Math.min(za, zb), Math.max(za, zb), 'concrete');
    }
  }
  group.add(solid(abutParts, mat.worn));

  const parapetParts = [];
  const railParts = [];
  const sections = { [-1]: [[-L, L]], [1]: [[-L, BRIDGE.gapX[0]], [BRIDGE.gapX[1], L]] };
  if (BRIDGE.gapSide < 0) [sections[-1], sections[1]] = [sections[1], sections[-1]];
  for (const s of [-1, 1]) {
    for (const [a, b] of sections[s]) {
      const zi = s * (e - 0.35);
      const zo = s * e;
      const prof = s > 0 ? [[zi, WALK_Y], [zo, WALK_Y], [zo, PARAPET_TOP], [zi + 0.07, PARAPET_TOP]] : [[zo, WALK_Y], [zi, WALK_Y], [zi - 0.07, PARAPET_TOP], [zo, PARAPET_TOP]];
      parapetParts.push(extrudeX(prof, a, b, { uv: 0.5 }));
      physics.staticBox(a, b, WALK_Y, PARAPET_TOP, Math.min(zi, zo), Math.max(zi, zo), 'concrete');
      const zc = s * (e - 0.16);
      const n = Math.max(1, Math.round((b - a) / 2));
      for (let k = 0; k <= n; k++) {
        const x = a + 0.12 + ((b - a - 0.24) * k) / n;
        railParts.push(box(x - 0.045, x + 0.045, PARAPET_TOP, RAIL_TOP - 0.05, zc - 0.04, zc + 0.04, 0.9));
        railParts.push(box(x - 0.09, x + 0.09, PARAPET_TOP, PARAPET_TOP + 0.015, zc - 0.07, zc + 0.07, 0.9));
      }
      railParts.push(box(a + 0.05, b - 0.05, RAIL_TOP - 0.07, RAIL_TOP, zc - 0.055, zc + 0.055, 0.9));
      railParts.push(box(a + 0.05, b - 0.05, PARAPET_TOP + 0.3, PARAPET_TOP + 0.36, zc - 0.03, zc + 0.03, 0.9));
      physics.staticBox(a, b, PARAPET_TOP, RAIL_TOP, zc - 0.05, zc + 0.05, 'metal', 0.5);
    }
  }
  const gz = BRIDGE.gapSide * (e - 0.175);
  parapetParts.push(box(BRIDGE.gapX[0] - 0.02, BRIDGE.gapX[0] + 0.02, WALK_Y, PARAPET_TOP - 0.02, gz - 0.17, gz + 0.17));
  group.add(solid(parapetParts, mat.deck));
  group.add(solid(deckParts, mat.deck));
  group.add(solid(railParts, mat.rail));

  for (const x of [-L, ...BRIDGE.pierXs, L]) steelParts.push(box(x - 0.07, x + 0.07, roadY(x) - CROWN * c - 0.05, roadY(x) + 0.004, -c, c));
  for (let x = -L + 6; x < L; x += 12) {
    for (const s of [-1, 1]) steelParts.push(box(x - 0.25, x + 0.25, CURB_Y - 0.01, CURB_Y + 0.012, s * (c - 0.02) - 0.07, s * (c - 0.02) + 0.07));
  }
  const pipeZ = -(e - 0.75);
  steelParts.push(placed(new THREE.CylinderGeometry(0.14, 0.14, 2 * L - 1.6, 16, 1, true), 0, SLAB_BOTTOM - 0.32, pipeZ, 0, 0, Math.PI / 2));
  for (let x = -L + 2; x < L; x += 4) steelParts.push(box(x - 0.03, x + 0.03, SLAB_BOTTOM - 0.5, SLAB_BOTTOM, pipeZ - 0.17, pipeZ + 0.17));
  group.add(solid(steelParts, mat.steel));

  const lampParts = [];
  const lensParts = [];
  const lampSpots = [[-36, -1], [-12, 1], [12, -1], [36, 1]];
  for (const [x, s] of lampSpots) {
    lampParts.push(...lamp(x, s));
    const z = s * (e - 0.17) - s * 2.55;
    lensParts.push(placed(new THREE.BoxGeometry(0.2, 0.03, 0.5), x, PARAPET_TOP + 0.5 + 7.6 + 0.72, z));
    physics.staticCylinder(x, PARAPET_TOP, PARAPET_TOP + 8, s * (e - 0.17), 0.1, 'metal');
  }
  group.add(solid(lampParts, mat.galvanized));
  group.add(solid(lensParts, mat.lens, { cast: false }));

  const railGuard = [];
  const wProfile = (s) => {
    const base = [[0, 0], [0.05, 0.045], [0.05, 0.105], [0, 0.155], [0.05, 0.205], [0.05, 0.265], [0, 0.31], [-0.014, 0.31], [0.036, 0.265], [0.036, 0.205], [-0.014, 0.155], [0.036, 0.105], [0.036, 0.045], [-0.014, 0]];
    const pts = base.map(([z, y]) => [s * (ROAD.halfWidth + 1.05) - s * z, y + 0.42]);
    return s > 0 ? pts.reverse() : pts;
  };
  for (const sx of [-1, 1]) {
    for (const s of [-1, 1]) {
      for (let x = L + 0.6; x < L + 46; x += 1.905) {
        const xa = sx > 0 ? x : -x - 1.905;
        railGuard.push(extrudeX(wProfile(s), xa, xa + 1.905, { caps: false, yAt: roadY, uv: 1 }));
        const xp = xa + 0.95;
        const zp = s * (ROAD.halfWidth + 1.13);
        railGuard.push(box(xp - 0.05, xp + 0.05, roadY(xp) - 0.6, roadY(xp) + 0.74, zp - 0.075, zp + 0.075, 1));
      }
      for (let x = L + 0.6; x < L + 46; x += 7.62) {
        const xa = sx > 0 ? x : -x - 7.62;
        const ym = roadY(xa + 3.81);
        const zc = s * (ROAD.halfWidth + 1.05);
        const desc = physics.RAPIER.ColliderDesc.cuboid(3.85, 0.4, 0.06)
          .setTranslation(xa + 3.81, ym + 0.42, zc)
          .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(roadY(xa + 7.62) - roadY(xa), 7.62)))
          .setFriction(0.4);
        physics.tag(physics.world.createCollider(desc), 'metal');
      }
    }
  }
  group.add(solid(railGuard, mat.galvanized));

  scene.add(group);
  return { group, materials: mat };
}
