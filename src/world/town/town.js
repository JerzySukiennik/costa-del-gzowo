// Costa del Gzowo: Gzowo Springs assembly (cells of merged geometry, materials, colliders, live lights, wind and props).
import * as THREE from 'three';
import { LAYERS, TOWN } from '../../config.js';
import { rng } from '../scatter.js';
import { Surface, Glass, Decals, CHANNELS } from './kit.js';
import { createAtlas } from './atlas.js';
import { createTownMaterials } from './materials.js';
import { buildStreets } from './streets.js';
import { buildBuildings } from './buildings.js';
import { buildFurniture } from './furniture.js';
import { inTown } from './layout.js';

const CELL_X = [256, 300, 346, 380, 420];

export async function createTown(ctx) {
  const { scene, physics } = ctx;
  const atlas = createAtlas();
  const mats = await createTownMaterials(ctx, atlas);
  const cells = new Map();
  const random = rng(1926);

  function cell(x, z) {
    let i = 0;
    while (i < CELL_X.length - 2 && x >= CELL_X[i + 1]) i++;
    const key = `${i}:${z < 0 ? 0 : 1}`;
    if (!cells.has(key)) cells.set(key, { key, surface: new Surface(), glass: new Glass(), decal: new Decals(), fine: new Surface(), fineDecal: new Decals(), cx: (CELL_X[i] + CELL_X[i + 1]) / 2, cz: z < 0 ? -36 : 36 });
    return cells.get(key);
  }

  const T = {
    ctx, physics, atlas, random, cell, items: atlas.items, mats,
    collider(desc, surface = 'metal') {
      return physics.tag(physics.world.createCollider(desc), surface);
    },
    box(x0, x1, y0, y1, z0, z1, surface = 'concrete') {
      physics.staticBox(Math.min(x0, x1), Math.max(x0, x1), y0, y1, Math.min(z0, z1), Math.max(z0, z1), surface);
    },
    post(x, y0, y1, z, r = 0.06, surface = 'metal') {
      physics.staticCylinder(x, y0, y1, z, r, surface);
    },
  };

  const streets = buildStreets(T);
  T.paint = streets.paint;
  const buildings = buildBuildings(T);
  const furniture = await buildFurniture(T);

  const group = new THREE.Group();
  group.name = 'town';
  let triangles = 0;
  const add = (geometry, material, { layer = LAYERS.WORLD, cast = true, receive = true, range = 0, x = 0, z = 0, order = 0 } = {}) => {
    if (!geometry) return null;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    mesh.layers.set(layer);
    mesh.renderOrder = order;
    group.add(mesh);
    triangles += geometry.attributes.position.count / 3;
    if (range) ctx.cull.push({ object: mesh, x, z, range });
    return mesh;
  };
  for (const c of cells.values()) {
    add(c.surface.geometry(), mats.surface, { range: 900, x: c.cx, z: c.cz });
    add(c.glass.geometry(), mats.glass, { range: 900, x: c.cx, z: c.cz });
    add(c.decal.geometry(), mats.decal, { layer: LAYERS.DETAIL, cast: false, order: 1, range: 280, x: c.cx, z: c.cz });
    add(c.fine.geometry(), mats.surface, { range: 140, x: c.cx, z: c.cz });
    add(c.fineDecal.geometry(), mats.decal, { layer: LAYERS.DETAIL, cast: false, range: 90, x: c.cx, z: c.cz, order: 2 });
  }
  for (const m of furniture.meshes) {
    if (m.isInstancedMesh && !m.frustumCulled) {
      m.frustumCulled = true;
      m.boundingSphere = new THREE.Sphere(new THREE.Vector3((TOWN.x0 + TOWN.x1) / 2, 6, 0), 115);
    }
    group.add(m);
    ctx.cull.push({ object: m, x: (TOWN.x0 + TOWN.x1) / 2, z: 0, range: 300 });
  }
  group.updateMatrixWorld(true);
  scene.add(group);

  const chan = mats.chan.value;
  let phase = 0;
  let flickerT = 0;
  let flick = 1;
  function update(dt, elapsed, camera) {
    phase = elapsed % 34;
    const mainGreen = phase < 15;
    const mainYellow = phase >= 15 && phase < 18.5;
    const crossGreen = phase >= 20 && phase < 30.5;
    const crossYellow = phase >= 30.5 && phase < 33;
    chan[CHANNELS.MAIN_G] = mainGreen ? 1 : 0;
    chan[CHANNELS.MAIN_Y] = mainYellow ? 1 : 0;
    chan[CHANNELS.MAIN_R] = mainGreen || mainYellow ? 0 : 1;
    chan[CHANNELS.CROSS_G] = crossGreen ? 1 : 0;
    chan[CHANNELS.CROSS_Y] = crossYellow ? 1 : 0;
    chan[CHANNELS.CROSS_R] = crossGreen || crossYellow ? 0 : 1;
    const walkPhase = phase >= 20 && phase < 27;
    const flash = phase >= 27 && phase < 30.5;
    chan[CHANNELS.WALK] = walkPhase ? 1 : 0;
    chan[CHANNELS.DONT] = walkPhase ? 0 : flash ? (Math.floor(elapsed * 2) % 2 ? 1 : 0.05) : 1;
    flickerT -= dt;
    if (flickerT <= 0) {
      flick = flick > 0.5 ? (Math.random() < 0.5 ? 0.15 : 0.6) : 1;
      flickerT = flick > 0.5 ? 0.6 + Math.random() * 4 : 0.03 + Math.random() * 0.09;
    }
    chan[CHANNELS.FLICKER] = flick;
    chan[CHANNELS.FLICKER_B] = 0.85 + 0.15 * Math.sin(elapsed * 31) * Math.sin(elapsed * 7.3);
    chan[CHANNELS.BLINK] = elapsed % 1.6 < 1.1 ? 1 : 0.08;
    const chase = Math.floor(elapsed * 3) % 2;
    chan[CHANNELS.CHASE_A] = chase ? 1 : 0.15;
    chan[CHANNELS.CHASE_B] = chase ? 0.15 : 1;
    chan[CHANNELS.LAMP] = 1;
    chan[CHANNELS.BROKEN] = Math.random() < 0.04 ? 0.1 : elapsed % 7 < 6.6 ? 1 : 0.2;
    furniture.update(dt, elapsed, camera);
  }

  return {
    group,
    triangles,
    cells,
    materials: mats,
    atlas,
    buildings,
    furniture,
    name: TOWN.name,
    contains: (x, z) => inTown(x, z, 6),
    update,
  };
}
