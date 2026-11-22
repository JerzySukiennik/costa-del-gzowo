// Costa del Gzowo: assembles the grand-touring convertible (body panels, glass, lamps, soft top, doors, wheels, cockpit) and exposes its animation and contact-point API.
import * as THREE from 'three';
import { buildBody, CAR, MAT } from './carBody.js';
import { buildWheelAssets, buildWheel, buildExterior, plateTexture } from './carParts.js';
import { buildInterior } from './carInterior.js';
import { buildRoof } from './carRoof.js';
import { createCarMaterials } from './carMaterials.js';
import { Batch } from './carGeometry.js';
import { hookMaterial } from '../render/shaderHooks.js';

const DOOR_MAX = 1.12;

export async function createCarModel(ctx, options = {}) {
  const { assets, lighting } = ctx;
  const leatherMaps = await assets.pbr('fabric_leather_01', { repeat: 4 });
  const mats = createCarMaterials({ lighting, leatherMaps, paintColor: options.color ?? 0x6e130c });
  mats.plate = mats.register(hookMaterial(new THREE.MeshStandardMaterial({ map: plateTexture(options.plate || 'GZW 26'), roughness: 0.45, metalness: 0.1 }), { key: 'car-plate', dynamic: true }));
  const body = buildBody();
  const group = new THREE.Group();
  group.name = 'car';

  const panels = {};
  const pivots = {};
  const pivotAt = (name, x, y, z) => {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    p.name = name;
    group.add(p);
    pivots[name] = p;
    return p;
  };
  const under = (pivot, object) => {
    object.position.sub(pivot.position);
    pivot.add(object);
    return object;
  };
  const panelMats = [mats.paint, mats.solid, mats.lens];
  const addPanel = (name, geometry, parent) => {
    const mesh = new THREE.Mesh(geometry, panelMats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    parent === group ? group.add(mesh) : under(parent, mesh);
    panels[name] = mesh;
    return mesh;
  };
  const solidMesh = (geometry, parent, name) => {
    const mesh = new THREE.Mesh(geometry, mats.solid);
    mesh.name = name;
    mesh.receiveShadow = true;
    parent === group ? group.add(mesh) : under(parent, mesh);
    return mesh;
  };

  addPanel('shell', body.panels.shell, group);
  const ext = buildExterior({ body, mats });
  const frame = new THREE.Mesh(ext.frame, mats.paint);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
  panels.frame = frame;
  const windshield = new THREE.Mesh(ext.windshield, mats.makeGlass('windshield', 0.16));
  windshield.renderOrder = 2;
  group.add(windshield);

  const fb = pivotAt('frontBumper', 2.1, 0.4, 0);
  addPanel('frontBumper', body.panels.frontBumper, fb);
  solidMesh(ext.front.build(), fb, 'frontDetails');
  const rb = pivotAt('rearBumper', -2.25, 0.45, 0);
  addPanel('rearBumper', body.panels.rearBumper, rb);
  solidMesh(ext.rear.build(), rb, 'rearDetails');
  under(rb, ext.plate);
  const hood = pivotAt('hood', CAR.cowl + 0.01, 0.92, 0);
  addPanel('hood', body.panels.hood, hood);
  const trunk = pivotAt('trunk', -2.33, 0.99, 0);
  addPanel('trunk', body.panels.trunk, trunk);

  const interior = buildInterior({ mats, lighting });
  group.add(interior.group);

  const shellSolid = new Batch();
  shellSolid.parts.push(ext.shell.build(), ext.headInternals.build(), ext.tailInternals.build(), interior.solidGeo);
  solidMesh(shellSolid.build(), group, 'shellDetails');

  const roofParts = buildRoof({ mats });
  for (const pv of roofParts.pivots) group.add(pv);
  const windows = {};
  const doors = {};
  for (const [tag, s] of [['L', -1], ['R', 1]]) {
    const name = 'doorF' + tag;
    const p = pivotAt(name, CAR.hinge.x, 0.55, s * CAR.hinge.z);
    addPanel(name, body.panels['door' + tag], p);
    solidMesh(ext['door' + tag].build(), p, name + 'Details');
    const card = interior.doorCards['door' + tag];
    under(p, card);
    const glass = new THREE.Mesh(roofParts.windows['winF' + tag], mats.makeGlass('winF' + tag, 0.2));
    glass.renderOrder = 2;
    under(p, glass);
    glass.userData.baseY = glass.position.y;
    windows['winF' + tag] = glass;
    const q = new THREE.Mesh(roofParts.windows['winR' + tag], mats.makeGlass('winR' + tag, 0.2));
    q.renderOrder = 2;
    group.add(q);
    q.userData.baseY = 0;
    windows['winR' + tag] = q;
    doors[name] = { pivot: p, sign: s, value: 0, target: 0, handle: ext.handleLocal[tag].clone().sub(p.position), pull: card.userData.pull.clone().sub(p.position), support: new THREE.Vector3(CAR.doorRear + 0.14, 0.9, s * 0.8).sub(p.position) };
  }

  ext.mirrors.forEach((m, i) => under(pivots['doorF' + (i === 0 ? 'L' : 'R')], m));

  const wheelAssets = buildWheelAssets(mats.register);
  const wheels = [];
  for (const [front, ax] of [[true, CAR.axleFront], [false, CAR.axleRear]]) {
    for (const s of [-1, 1]) {
      const w = buildWheel(wheelAssets, s, mats.solid);
      w.group.position.set(ax, CAR.wheelRadius, s * (CAR.track / 2));
      group.add(w.group);
      wheels.push({ ...w, side: s, front, x: ax, z: s * (CAR.track / 2), angle: 0 });
    }
  }

  const beams = [-1, 1].map((s) => {
    const light = new THREE.SpotLight(0xfff1dc, 0, 75, 0.5, 0.65, 1.6);
    light.position.set(2.12, 0.64, s * 0.66);
    light.target.position.set(24, -0.2, s * 1.4);
    group.add(light, light.target);
    return light;
  });

  const lamp = mats.lampUniforms;
  const roof = { value: 1, target: 1 };
  const applyRoof = () => roofParts.apply(roof.value, { trunk, windowMeshes: windows });
  applyRoof();

  group.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
  });

  let state = null;
  let dashTimer = 0;
  let lastDash = '';
  const gripLocal = { L: new THREE.Vector3(-0.182, 0.032, 0), R: new THREE.Vector3(0.182, 0.032, 0) };
  const applyDoor = (name) => {
    const d = doors[name];
    if (d.gone) return;
    const e = d.value * d.value * (3 - 2 * d.value);
    d.pivot.rotation.y = d.sign * (e * DOOR_MAX + (d.slack || 0));
  };
  const doorPoint = (d, local, out) => {
    if (d.gone) return group.localToWorld(out.copy(local).add(d.rest));
    d.pivot.updateWorldMatrix(true, false);
    return d.pivot.localToWorld(out.copy(local));
  };
  for (const d of Object.values(doors)) d.rest = d.pivot.position.clone();

  return {
    group, panels, pivots, wheels, interior, windows, body, materials: mats,
    glassMaterials: mats.glassMaterials,
    damageCanvas: mats.damageCanvas,
    damageCtx: mats.damageCtx,
    damageTexture: mats.damageTexture,
    paintUniforms: mats.paintUniforms,
    steeringWheel: interior.steeringWheel,
    mirrors: ext.mirrors,
    seat: interior.seat.clone(),
    headBroken: lamp.uHeadBroken.value,
    tailBroken: lamp.uTailBroken.value,
    roof,
    doorMax: DOOR_MAX,
    hinge: new THREE.Vector3(CAR.hinge.x, 0, -CAR.hinge.z),
    dims: { length: CAR.length, halfWidth: CAR.halfWidth, doorFront: CAR.doorFront, doorRear: CAR.doorRear, sill: 0.3, belt: 0.955, roofRail: 1.21 },
    bindState(s) {
      state = s;
    },
    setRoof(value) {
      roof.value = roof.target = Math.min(1, Math.max(0, value));
      applyRoof();
    },
    toggleRoof() {
      roof.target = roof.target > 0.5 ? 0 : 1;
    },
    setDoor(name, open) {
      if (doors[name]) doors[name].target = open ? 1 : 0;
    },
    setDoorAngle(name, amount) {
      const d = doors[name];
      if (!d) return;
      d.value = d.target = Math.min(1, Math.max(0, amount));
      applyDoor(name);
    },
    doorAmount(name = 'doorFL') {
      return doors[name] ? doors[name].value : 0;
    },
    handlePoint(out = new THREE.Vector3(), name = 'doorFL') {
      return doorPoint(doors[name], doors[name].handle, out);
    },
    innerPullPoint(out = new THREE.Vector3(), name = 'doorFL') {
      return doorPoint(doors[name], doors[name].pull, out);
    },
    supportPoint(out = new THREE.Vector3(), name = 'doorFL') {
      return doorPoint(doors[name], doors[name].support, out);
    },
    setDoorSlack(name, angle) {
      const d = doors[name];
      if (!d || d.gone) return;
      d.slack = angle;
      applyDoor(name);
    },
    setDoorGone(name, gone) {
      const d = doors[name];
      if (!d) return;
      d.gone = gone;
      if (!gone) {
        d.slack = 0;
        applyDoor(name);
      }
    },
    entryGeometry() {
      const s = interior.seat;
      return {
        door: 'doorFL',
        seat: s.clone(),
        spot: new THREE.Vector3(-0.6, 0, -1.26),
        stepBack: new THREE.Vector3(-0.76, 0, -1.37),
        gap: new THREE.Vector3(-0.36, 0, -1.1),
        exitSpot: new THREE.Vector3(-0.8, 0, -1.42),
        prompt: new THREE.Vector3(-0.3, 0, -1.4),
        footInR: new THREE.Vector3(-0.06, 0.23, -0.66),
        pedalR: new THREE.Vector3(0.21, 0.25, s.z + 0.085),
        pedalL: new THREE.Vector3(0.15, 0.235, s.z - 0.1),
        sillY: 0.33,
        brace: new THREE.Vector3(-0.66, 0.585, -0.1),
        length: CAR.length,
        halfWidth: CAR.halfWidth,
      };
    },
    gripPoint(side = 'L', out = new THREE.Vector3()) {
      interior.steeringWheel.updateWorldMatrix(true, false);
      return interior.steeringWheel.localToWorld(out.copy(gripLocal[side === 'R' ? 'R' : 'L']));
    },
    setLights({ brake, reverse, beam }) {
      const v = lamp.uLamp.value;
      v[1] = beam ? 2.5 : 4.5;
      v[2] = beam ? 40 : 0;
      v[3] = 1.6 + (beam ? 1.2 : 0) + brake * 7;
      v[4] = brake * 16;
      v[5] = reverse ? 10 : 0;
      v[7] = 0.5;
      const on = beam ? 1 : 0;
      beams[0].intensity = on * 260 * (1 - lamp.uHeadBroken.value.x);
      beams[1].intensity = on * 260 * (1 - lamp.uHeadBroken.value.y);
    },
    update(dt) {
      if (roof.value !== roof.target) {
        roof.value += Math.sign(roof.target - roof.value) * Math.min(Math.abs(roof.target - roof.value), dt / 4.2);
        applyRoof();
      }
      for (const [name, d] of Object.entries(doors)) {
        if (d.value === d.target) continue;
        d.value += Math.sign(d.target - d.value) * Math.min(Math.abs(d.target - d.value), dt / 0.5);
        applyDoor(name);
      }
      dashTimer -= dt;
      if (state && dashTimer <= 0) {
        dashTimer = 0.2;
        const speed = Math.round(Math.abs(state.forwardSpeed || 0) * 3.6);
        const rpm = Math.round((state.rpm || 0) / 100) * 100;
        const gear = !state.occupied ? 'P' : state.reverse ? 'R' : String(state.gear || 'D');
        const key = speed + '|' + rpm + '|' + gear;
        if (key !== lastDash) {
          lastDash = key;
          interior.screens.cluster.draw(speed, rpm, gear);
        }
      }
    },
  };
}

export { MAT };
