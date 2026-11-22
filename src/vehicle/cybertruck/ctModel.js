// Costa del Gzowo Cyber Truck: assembles the stainless truck (body, doors, glass, lamps, cabin, vault cover and bin, wheels) merged by material, and exposes the shared car-model API plus the vault, screen and cockpit eye.
import * as THREE from 'three';
import { CT } from './ctShape.js';
import { createTruckMaterials } from './ctMaterials.js';
import { buildExterior, buildCover } from './ctBody.js';
import { buildInterior } from './ctInterior.js';
import { buildWheelGeometry, buildWheel } from './ctWheels.js';

const DOOR_MAX = 1.08;
const RIDE_MM = { low: 0.22, normal: 0.3, offroad: 0.43 };

export async function createTruckModel(ctx) {
  const { assets, lighting } = ctx;
  const leatherMaps = await assets.pbr('fabric_leather_01', { repeat: 4 });
  const mats = createTruckMaterials({ lighting, leatherMaps });
  const ext = buildExterior();
  const interior = buildInterior({ mats, lighting });
  const group = new THREE.Group();
  group.name = 'cybertruck';
  const pivots = {};
  const panels = {};
  const windows = {};
  const doors = {};

  const steel = new THREE.Mesh(ext.body, mats.steel);
  steel.castShadow = true;
  steel.receiveShadow = true;
  steel.name = 'shell';
  group.add(steel);
  panels.shell = steel;

  ext.trim.parts.push(interior.solidGeo);
  const trim = new THREE.Mesh(ext.trim.build(), mats.solid);
  trim.castShadow = true;
  trim.receiveShadow = true;
  group.add(trim);
  group.add(interior.group);

  const glassMesh = (geometry, name, base, order = 2) => {
    const m = new THREE.Mesh(geometry, mats.makeGlass(name, base));
    m.renderOrder = order;
    windows[name] = m;
    return m;
  };
  group.add(glassMesh(ext.glass.windshield, 'windshield', 0.5), glassMesh(ext.glass.roof, 'roof', 0.72), glassMesh(ext.glass.side, 'side', 0.74), glassMesh(ext.glass.rear, 'rearGlass', 0.6));

  for (const [tag, s] of [['L', -1], ['R', 1]]) {
    const name = 'doorF' + tag;
    const p = new THREE.Group();
    p.name = name;
    p.position.set(CT.doorFront, 0, s * 0.99);
    group.add(p);
    pivots[name] = p;
    const skin = new THREE.Mesh(ext.doorSteel[tag], mats.steel);
    skin.castShadow = true;
    skin.receiveShadow = true;
    skin.position.copy(p.position).negate();
    p.add(skin);
    panels[name] = skin;
    const glass = glassMesh(ext.glass['door' + tag], 'winF' + tag, 0.72);
    glass.position.copy(p.position).negate();
    p.add(glass);
    const card = interior.doorCards['door' + tag];
    card.position.copy(p.position).negate();
    p.add(card);
    doors[name] = {
      pivot: p, sign: s, value: 0, target: 0,
      pull: card.userData.pull.clone().sub(p.position),
      support: new THREE.Vector3(CT.doorMid + 0.22, 1.16, s * 0.95).sub(p.position),
      rest: p.position.clone(),
    };
  }

  const cover = buildCover();
  const coverMesh = new THREE.Mesh(cover.geometry, mats.solid);
  coverMesh.receiveShadow = true;
  coverMesh.castShadow = true;
  group.add(coverMesh);
  const lid = new THREE.Group();
  lid.position.copy(ext.bed.lidHinge);
  lid.add(new THREE.Mesh(ext.bed.lid, mats.solid));
  group.add(lid);
  pivots.vault = lid;

  const wheelGeo = buildWheelGeometry();
  const wheels = [];
  for (const [front, ax] of [[true, CT.axleFront], [false, CT.axleRear]]) {
    for (const s of [-1, 1]) {
      const w = buildWheel(wheelGeo, s, mats.solid);
      w.group.position.set(ax, CT.wheelRadius, s * (CT.track / 2));
      group.add(w.group);
      wheels.push({ ...w, side: s, front, x: ax, z: s * (CT.track / 2), angle: 0 });
    }
  }

  group.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false;
  });

  const lamp = mats.lampUniforms;
  const vault = { value: 0, target: 0 };
  const roof = { value: 0, target: 0 };
  const eye = new THREE.Vector3(CT.seat.x - 0.1, CT.seat.y + 0.7, CT.seat.z);
  const handleLocal = new THREE.Vector3(CT.doorMid - 0.03, 1.27, -1.0);
  const gripLocal = { L: new THREE.Vector3(-0.172, 0.0, 0.01), R: new THREE.Vector3(0.172, 0.0, 0.01) };
  let state = null;
  let screenTimer = 0;
  let lastScreen = '';
  let clock = 0;
  const screenState = { speed: 0, gear: 'P', range: 512, clock: '18:42', mode: 'normal', lift: 0, clearance: 0.3, vault: false, heading: 0, x: 0, z: 0, place: 'Sawgrass River Bridge', radio: 'Springs Radio  91.5', drift: false };

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
  const applyVault = () => {
    const e = vault.value * vault.value * (3 - 2 * vault.value);
    cover.place(Math.min(1, e * 1.08));
    const l = Math.max(0, (vault.value - 0.75) / 0.25);
    lid.rotation.z = -l * l * (3 - 2 * l) * 1.25;
  };
  applyVault();

  const model = {
    id: 'cybertruck',
    group, panels, pivots, wheels, interior, windows, materials: mats,
    glassMaterials: mats.glassMaterials,
    damageCanvas: mats.damageCanvas,
    damageCtx: mats.damageCtx,
    damageTexture: mats.damageTexture,
    paintUniforms: mats.paintUniforms,
    steeringWheel: interior.steeringWheel,
    mirrors: [],
    seat: interior.seat.clone(),
    headBroken: lamp.uHeadBroken.value,
    tailBroken: lamp.uTailBroken.value,
    roof,
    vault,
    fixedRoof: true,
    eye,
    doorMax: DOOR_MAX,
    hinge: new THREE.Vector3(CT.doorFront, 0, -0.99),
    dims: { length: CT.length, halfWidth: CT.halfWidth, doorFront: CT.doorFront, doorRear: CT.doorMid, sill: 0.52, belt: CT.belt, roofRail: CT.apexY },
    screenState,
    bindState(s) {
      state = s;
    },
    setRoof() {},
    toggleRoof() {},
    setVault(open) {
      vault.target = open ? 1 : 0;
    },
    setVaultNow(v) {
      vault.value = vault.target = Math.min(1, Math.max(0, v));
      applyVault();
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
    handlePoint(out = new THREE.Vector3()) {
      group.updateWorldMatrix(true, false);
      return group.localToWorld(out.copy(handleLocal));
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
        spot: new THREE.Vector3(s.x - 0.22, 0, -1.42),
        stepBack: new THREE.Vector3(s.x - 0.36, 0, -1.52),
        gap: new THREE.Vector3(s.x + 0.12, 0, -1.2),
        exitSpot: new THREE.Vector3(s.x - 0.4, 0, -1.58),
        prompt: new THREE.Vector3(s.x, 0, -1.5),
        footInR: new THREE.Vector3(s.x + 0.32, CT.floor + 0.06, -0.7),
        pedalR: new THREE.Vector3(s.x + 0.86, CT.floor + 0.07, s.z + 0.1),
        pedalL: new THREE.Vector3(s.x + 0.8, CT.floor + 0.05, s.z - 0.08),
        sillY: 0.56,
        brace: new THREE.Vector3(s.x - 0.32, CT.floor + 0.44, -0.08),
        length: CT.length,
        halfWidth: CT.halfWidth,
      };
    },
    gripPoint(side = 'L', out = new THREE.Vector3()) {
      interior.steeringWheel.updateWorldMatrix(true, false);
      return interior.steeringWheel.localToWorld(out.copy(gripLocal[side === 'R' ? 'R' : 'L']));
    },
    setLights({ brake, reverse, beam }) {
      const v = lamp.uLamp.value;
      const on = state && state.occupied ? 1 : 0;
      v[1] = (beam ? 3.2 : 5.5) * (0.12 + 0.88 * on);
      v[2] = beam ? 36 : 0;
      v[3] = (1.2 + (beam ? 0.8 : 0)) * (0.2 + 0.8 * on) + brake * 11;
      v[4] = brake * 11;
      v[5] = reverse ? 9 : 0;
      v[8] = 0.25 + 1.6 * on;
    },
    update(dt) {
      for (const [name, d] of Object.entries(doors)) {
        if (d.value === d.target) continue;
        d.value += Math.sign(d.target - d.value) * Math.min(Math.abs(d.target - d.value), dt / 0.6);
        applyDoor(name);
      }
      if (vault.value !== vault.target) {
        vault.value += Math.sign(vault.target - vault.value) * Math.min(Math.abs(vault.target - vault.value), dt / 3.2);
        applyVault();
      }
      clock += dt;
      screenTimer -= dt;
      if (!state || !state.occupied || screenTimer > 0) return;
      screenTimer = 0.25;
      const ss = screenState;
      ss.speed = Math.round(Math.abs(state.forwardSpeed || 0) * 3.6);
      ss.gear = state.reverse ? 'R' : state.speed < 0.3 && state.throttle < 0.05 ? 'P' : 'D';
      ss.mode = state.ride || 'normal';
      ss.lift = state.lift || 0;
      ss.clearance = RIDE_MM.normal + (state.lift || 0);
      ss.vault = vault.target > 0.5;
      ss.drift = !!state.drifting;
      ss.range = Math.max(0, Math.round(512 - (state.used || 0)));
      ss.heading = Math.atan2(-(state.fx || 1), -(state.fz || 0));
      ss.x = group.position.x;
      ss.z = group.position.z;
      const minutes = 18 * 60 + 42 + Math.floor(clock / 60);
      ss.clock = `${Math.floor(minutes / 60) % 24}:${String(minutes % 60).padStart(2, '0')}`;
      const key = `${ss.speed}|${ss.gear}|${ss.mode}|${Math.round(ss.lift * 100)}|${ss.vault}|${ss.drift}|${ss.range}|${Math.round(ss.heading * 20)}|${Math.round(ss.x)}|${Math.round(ss.z)}|${ss.clock}|${ss.place}|${ss.radio}`;
      if (key === lastScreen) return;
      lastScreen = key;
      interior.screen.draw(ss);
    },
  };
  interior.screen.draw(screenState);
  return model;
}
