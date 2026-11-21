// Costa del Gzowo: scattered undergrowth, rocks, riprap and woody debris (instanced photoscans).
import * as THREE from 'three';
import { LAYERS, BRIDGE } from '../config.js';
import { heightAt } from './heightfield.js';
import { rng, pickPoints, clearOfBuilt, slopeAt, variantsOf, instancedVariant } from './scatter.js';
import { makeFoliage } from './trees.js';

const CELL = 128;

let cullList = null;

function addCells(group, variants, points, place, options = {}) {
  const cells = new Map();
  points.forEach((p, i) => {
    const v = Math.floor(p.r3 * variants.length) % variants.length;
    const key = `${v}:${Math.floor(p.x / CELL)}:${Math.floor(p.z / CELL)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(place(p, i));
  });
  for (const [key, list] of cells) {
    for (const mesh of instancedVariant(variants[+key.split(':')[0]], list, options)) {
      group.add(mesh);
      cullList.push({ object: mesh, x: mesh.boundingSphere.center.x, z: mesh.boundingSphere.center.z, range: (options.range ?? 150) + mesh.boundingSphere.radius });
    }
  }
}

export async function createPlants(ctx) {
  const { assets, lighting, physics, scene, terrain } = ctx;
  cullList = ctx.cull;
  const names = ['fern_02', 'shrub_02', 'shrub_03', 'shrub_04', 'wild_rooibos_bush', 'nettle_plant', 'weed_plant_02', 'anthurium_botany_01', 'calathea_orbifolia_01', 'pachira_aquatica_01', 'rock_moss_set_01', 'rock_moss_set_02', 'rock_07', 'rock_09', 'boulder_01', 'dead_tree_trunk', 'dry_branches_medium_01', 'tree_stump_01'];
  const loaded = await Promise.all(names.map((n) => assets.model(n)));
  const model = Object.fromEntries(names.map((n, i) => [n, variantsOf(loaded[i])]));
  const group = new THREE.Group();
  group.name = 'plants';
  const foliage = (list, wind) => list.forEach((v) => v.parts.forEach((p) => makeFoliage(p.material, ctx, wind)));
  foliage(model.fern_02, 0.05);
  foliage(model.shrub_02, 0.03);
  foliage(model.shrub_03, 0.03);
  foliage(model.shrub_04, 0.03);
  foliage(model.wild_rooibos_bush, 0.03);
  foliage(model.nettle_plant, 0.05);
  foliage(model.weed_plant_02, 0.05);
  foliage(model.anthurium_botany_01, 0.04);
  foliage(model.calathea_orbifolia_01, 0.04);
  foliage(model.pachira_aquatica_01, 0.03);
  for (const key of ['rock_moss_set_01', 'rock_moss_set_02', 'rock_07', 'rock_09', 'boulder_01', 'dead_tree_trunk', 'dry_branches_medium_01', 'tree_stump_01']) model[key].forEach((v) => v.parts.forEach((p) => lighting.register(p.material)));

  const bankBias = (x, z, low, high) => {
    const h = heightAt(x, z);
    if (h < low || h > high || !clearOfBuilt(x, z, 0.6)) return -1;
    return h;
  };
  const understory = (count, seed, spacing, rule) => pickPoints({ count, seed, spacing, region: { x0: -210, x1: 210, z0: -190, z1: 190 }, accept: rule });
  const forestRule = (base, forestGain, low = 0.3, high = 12) => (x, z) => {
    const h = bankBias(x, z, low, high);
    if (h < 0 || slopeAt(x, z) > 0.7) return 0;
    return base + terrain.vegAt(x, z).forest * forestGain + (h < 2 ? 0.25 : 0);
  };
  const std = (min, max, sink = 0.04) => (p) => ({ x: p.x, y: p.y - sink, z: p.z, yaw: p.r * 6.28, scale: min + p.r2 * (max - min), align: 0.5 });

  addCells(group, model.fern_02, understory(900, 101, 1.0, forestRule(0.1, 0.9)), std(0.9, 1.7), { layer: LAYERS.DETAIL, cast: false, range: 75 });
  addCells(group, model.shrub_02, understory(260, 102, 2.0, forestRule(0.2, 0.7)), std(1.0, 1.9), { cast: false });
  addCells(group, model.shrub_03, understory(300, 103, 1.8, forestRule(0.25, 0.6)), std(1.0, 2.0), { cast: false });
  addCells(group, model.shrub_04, understory(150, 104, 2.4, forestRule(0.2, 0.7)), std(0.9, 1.6), { cast: false });
  addCells(group, model.wild_rooibos_bush, understory(200, 105, 2.4, forestRule(0.3, 0.3, 0.5)), std(1.0, 1.8), { cast: false });
  addCells(group, model.nettle_plant, understory(260, 106, 1.3, forestRule(0.2, 0.6)), std(0.9, 1.5), { layer: LAYERS.DETAIL, cast: false, range: 75 });
  addCells(group, model.weed_plant_02, understory(320, 107, 1.2, forestRule(0.35, 0.2)), std(0.8, 1.5), { layer: LAYERS.DETAIL, cast: false, range: 75 });
  addCells(group, model.anthurium_botany_01, understory(210, 108, 1.4, forestRule(0.05, 0.9, 0.2, 4)), std(0.9, 1.6), { layer: LAYERS.DETAIL, cast: false, range: 75 });
  addCells(group, model.calathea_orbifolia_01, understory(190, 109, 1.4, forestRule(0.05, 0.9, 0.2, 4)), std(0.9, 1.5), { layer: LAYERS.DETAIL, cast: false, range: 75 });
  addCells(group, model.pachira_aquatica_01, understory(120, 110, 2.2, forestRule(0.1, 0.8, 0.15, 3)), std(1.1, 2.2), { cast: false });

  const smallRocks = [...model.rock_moss_set_01, ...model.rock_moss_set_02];
  const shoreRocks = pickPoints({
    count: 260, seed: 201, spacing: 1.2, region: { x0: -120, x1: 120, z0: -220, z1: 220 },
    accept: (x, z) => {
      const h = heightAt(x, z);
      if (h < -1.6 || h > 1.2 || !clearOfBuilt(x, z, 0.5)) return 0;
      return h < 0.3 ? 0.9 : 0.4;
    },
  });
  addCells(group, smallRocks, shoreRocks, (p) => ({ x: p.x, y: p.y - 0.12, z: p.z, yaw: p.r * 6.28, scale: 0.5 + p.r2 * p.r2 * 1.9, align: 0.3, tilt: [(p.r - 0.5) * 0.5, (p.r3 - 0.5) * 0.5] }), { cast: false, range: 170 });

  const riprap = pickPoints({
    count: 900, seed: 202, spacing: 0.5, region: { x0: -BRIDGE.halfLength - 2, x1: BRIDGE.halfLength + 2, z0: -13, z1: 13 },
    accept: (x, z) => {
      const ax = Math.abs(x);
      const h = heightAt(x, z);
      if (ax < 28 || ax > BRIDGE.halfLength - 1.2 || h < -0.4) return 0;
      return 1;
    },
  });
  addCells(group, smallRocks, riprap, (p) => ({ x: p.x, y: p.y - 0.1, z: p.z, yaw: p.r * 6.28, scale: 0.45 + p.r2 * 0.75, align: 0.8, tilt: [(p.r - 0.5) * 0.8, (p.r3 - 0.5) * 0.8] }), { cast: false, range: 170 });

  const obstacles = [];
  const bigRocks = [...model.rock_07, ...model.rock_09, ...model.boulder_01];
  const bigSpots = [[-22, 41, 1.3], [-17.5, 52, 0.9], [19, -38, 1.5], [24, 58, 1.1], [-25, -72, 1.4], [9, 118, 1.2], [-36, 12.5, 0.8], [33, -14, 0.9], [14, 30, 1.0], [-8, -30, 0.85], [-92, 46, 1.1], [86, 22, 1.3], [-131, 29, 0.7], [58, -52, 1.2]];
  const bigRandom = rng(55);
  const bigLists = bigRocks.map(() => []);
  bigSpots.forEach(([x, z, s], i) => {
    const v = i % bigRocks.length;
    const size = bigRocks[v].size;
    const scale = (s * 2.2) / Math.max(size.x, size.z);
    const y = heightAt(x, z) - size.y * scale * 0.3;
    bigLists[v].push({ x, y, z, yaw: bigRandom() * 6.28, scale, tilt: [(bigRandom() - 0.5) * 0.3, (bigRandom() - 0.5) * 0.3] });
    const radius = s * 1.0;
    const desc = physics.RAPIER.ColliderDesc.ball(radius).setTranslation(x, y + size.y * scale * 0.42, z).setFriction(0.8);
    physics.tag(physics.world.createCollider(desc), 'rock');
    if (heightAt(x, z) < 0.1) obstacles.push({ x, z, radius: radius * 0.95 });
  });
  bigRocks.forEach((variant, i) => {
    if (bigLists[i].length) for (const mesh of instancedVariant(variant, bigLists[i])) group.add(mesh);
  });

  const logSpots = [[-27.5, 33, 0.4], [26.5, -55, 2.1], [-64, 51, 1.2], [47, 24, 2.6], [-33, -44, 0.9]];
  const logs = logSpots.map(([x, z, yaw]) => ({ x, y: heightAt(x, z) + 0.05, z, yaw, scale: 1.25, align: 0.9 }));
  for (const mesh of instancedVariant(model.dead_tree_trunk[0], logs)) group.add(mesh);
  for (const l of logs) {
    const len = model.dead_tree_trunk[0].size.x * 0.5 * l.scale;
    const desc = physics.RAPIER.ColliderDesc.capsule(Math.max(len - 0.3, 0.3), 0.26)
      .setTranslation(l.x, l.y + 0.22, l.z)
      .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, l.yaw, Math.PI / 2)));
    physics.tag(physics.world.createCollider(desc), 'wood');
  }
  addCells(group, model.dry_branches_medium_01, understory(70, 301, 3, forestRule(0.15, 0.8)), (p) => ({ x: p.x, y: p.y + 0.02, z: p.z, yaw: p.r * 6.28, scale: 1 + p.r2 * 0.8, align: 1 }), { layer: LAYERS.DETAIL, cast: false, range: 75 });
  addCells(group, model.tree_stump_01, understory(9, 302, 14, forestRule(0.1, 0.8, 0.8)), std(1.0, 1.4, 0.1));

  scene.add(group);
  return { group, obstacles };
}
