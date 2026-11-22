// Costa del Gzowo boats: assembles a boat model from merged batches (hull and fittings, glass, moving and detachable parts) and exposes the helm, seat, boarding, lamp and damage API the vehicle contract expects.
import * as THREE from 'three';
import { createBoatMaterials, CH } from './boatMaterials.js';

export function createBoatModel(ctx, { id, glassTint = 0x0a1418, glassBase = 0.2, damageBox }) {
  const mats = createBoatMaterials(ctx.lighting, damageBox);
  const glassMat = mats.glass(glassTint, glassBase);
  const group = new THREE.Group();
  group.name = id;
  const visual = { beam: false, lights: 0 };
  const helm = new THREE.Group();
  const grips = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  let geo = null;

  const mesh = (geometry, parent = group, shadow = true) => {
    const m = new THREE.Mesh(geometry, mats.solid);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const glassMeshes = [];
  const glass = (geometry, parent = group) => {
    const m = new THREE.Mesh(geometry, glassMat);
    m.renderOrder = 2;
    parent.add(m);
    geometry.computeBoundingSphere();
    glassMeshes.push(m);
    return m;
  };
  const pivot = (x, y, z, parent = group) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const world = (node, local, out) => {
    node.updateWorldMatrix(true, false);
    return out.copy(local).applyMatrix4(node.matrixWorld);
  };

  const model = {
    id,
    group,
    mats,
    glass: glassMat,
    panels: {},
    pivots: {},
    windows: {},
    glassMaterials: { glass: glassMat },
    materials: mats,
    mirrors: [],
    wheels: [],
    headBroken: new THREE.Vector2(),
    tailBroken: new THREE.Vector2(),
    paintUniforms: { uDirt: { value: 0 } },
    damageCtx: null,
    damageTexture: null,
    fixedRoof: true,
    seat: new THREE.Vector3(),
    steeringWheel: helm,
    helm,
    visual,
    cullRadius: 8,
    hull: null,
    glassMeshes,
    parts: {},
    partNames: [],
    lampSpots: [],
    mesh,
    glassMesh: glass,
    pivot,
    setHull(m) {
      model.hull = m;
      m.geometry.userData.rest = m.geometry.attributes.position.array.slice();
      m.geometry.userData.restNormal = m.geometry.attributes.normal.array.slice();
      return m;
    },
    part(name, node, opts) {
      model.parts[name] = { node, rest: { position: node.position.clone(), quaternion: node.quaternion.clone() }, ...opts };
      model.partNames.push(name);
      return node;
    },
    lampAt(ch, x, y, z) {
      model.lampSpots.push({ ch, at: new THREE.Vector3(x, y, z) });
    },
    bindState() {},
    bindSim() {},
    setRoof() {},
    toggleRoof() {},
    setDoor() {},
    setDoorAngle() {},
    doorAmount() {
      return 0;
    },
    handlePoint(out = new THREE.Vector3()) {
      return world(group, geo.prompt, out);
    },
    innerPullPoint(out = new THREE.Vector3()) {
      return world(group, geo.brace, out);
    },
    supportPoint(out = new THREE.Vector3()) {
      return world(group, geo.brace, out);
    },
    gripPoint(side = 'L', out = new THREE.Vector3()) {
      return world(helm, grips[side === 'R' ? 'R' : 'L'], out);
    },
    setGrips(l, r) {
      grips.L.copy(l);
      grips.R.copy(r);
    },
    setEntry(g) {
      geo = {
        door: 'none', sillY: 0.6, length: 6, halfWidth: 1.2,
        ...g,
      };
      geo.stepBack = geo.stepBack || geo.spot.clone();
      geo.gap = geo.gap || geo.spot.clone();
      geo.footInR = geo.footInR || geo.pedalR.clone();
      model.seat.copy(geo.seat);
    },
    entryGeometry() {
      return geo;
    },
    setLights({ beam }) {
      visual.beam = !!beam;
    },
    navLights(on, time) {
      mats.setLamp(CH.RED, on ? 6 : 0);
      mats.setLamp(CH.GREEN, on ? 6 : 0);
      mats.setLamp(CH.WHITE, on ? 5 : 0);
      mats.setLamp(CH.SCREEN, on ? 1.6 : 0.05);
      return time;
    },
  };
  return model;
}
