// Costa del Gzowo helicopter: assembles the light turbine helicopter (fuselage, glass, pilot door, rotors with blur discs, cabin, moving controls, lamps) and exposes its animation and contact-point API.
import * as THREE from 'three';
import { hookMaterial } from '../../render/shaderHooks.js';
import { screenMaterial } from '../carMaterials.js';
import { buildFuselage, skinPoint } from './heliBody.js';
import { buildParts, DIM } from './heliParts.js';
import { createHeliMaterials } from './heliMaterials.js';

const DOOR_MAX = 1.25;
const OMEGA = 40.8;
const TAIL_OMEGA = 205;
const DISC_VS = `
uniform float uCone;
varying vec2 vP;
void main() {
  vP = position.xz;
  vec3 p = position;
  p.y += length(position.xz) * uCone;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const DISC_FS = `
uniform float uAlpha;
uniform float uPhase;
uniform float uRadius;
uniform float uBlades;
uniform vec3 uTip;
uniform vec3 uLight;
varying vec2 vP;
void main() {
  float r = length(vP);
  float q = r / uRadius;
  float a = atan(vP.y, vP.x) + uPhase;
  float smear = 0.42 + 0.58 * pow(0.5 + 0.5 * cos(a * uBlades), 3.0);
  float cover = clamp(1.5 / (r + 0.6), 0.26, 0.9);
  float edge = smoothstep(1.0, 0.985, q) * smoothstep(0.1, 0.16, q);
  float tip = clamp(smoothstep(0.895, 0.9, q) * (1.0 - smoothstep(0.935, 0.94, q)) + smoothstep(0.96, 0.965, q), 0.0, 1.0);
  vec3 col = mix(vec3(0.085, 0.087, 0.092), uTip, tip) * uLight;
  gl_FragColor = vec4(col, uAlpha * edge * smear * (cover + tip * 0.1));
}`;

function discMaterial(radius, blades, tip) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: DISC_VS, fragmentShader: DISC_FS,
    uniforms: { uAlpha: { value: 0 }, uPhase: { value: 0 }, uRadius: { value: radius }, uBlades: { value: blades }, uCone: { value: 0 }, uTip: { value: new THREE.Color(...tip) }, uLight: { value: new THREE.Color(1, 1, 1) } },
  });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}

export async function createHeliModel(ctx) {
  const { assets, lighting } = ctx;
  const leatherMaps = await assets.pbr('fabric_leather_01', { repeat: 4 });
  const mats = createHeliMaterials({ lighting, leatherMaps });
  const body = buildFuselage();
  const parts = buildParts();
  const group = new THREE.Group();
  group.name = 'helicopter';

  const add = (geometry, material, parent = group, shadow = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const under = (pivot, mesh) => {
    mesh.position.sub(pivot.position);
    pivot.add(mesh);
    return mesh;
  };
  const lamp = (color, radius, position, parent = group) => {
    const material = hookMaterial(new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3, emissive: new THREE.Color(color), emissiveIntensity: 0 }), { key: 'heli-lamp', dynamic: true });
    if (lighting && lighting.register) lighting.register(material);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
    mesh.position.copy(position);
    parent.add(mesh);
    return material;
  };

  const shell = add(body.shell, mats.paint);
  shell.name = 'shell';
  add(parts.paint, mats.paint).name = 'fairings';
  add(parts.solid, mats.solid).name = 'fittings';
  add(parts.leather, mats.leather).name = 'seats';

  const windows = {};
  for (const [name, geometry] of Object.entries(body.windows)) {
    const glass = add(geometry, mats.makeGlass(name, name === 'windshield' ? 0.13 : 0.2, 0x0b1518), group, false);
    glass.renderOrder = 2;
    windows[name] = glass;
  }

  const doorPivot = new THREE.Group();
  doorPivot.position.copy(body.hinge);
  group.add(doorPivot);
  const doorPanel = under(doorPivot, add(body.door, mats.paint, group));
  doorPanel.name = 'door';
  under(doorPivot, add(parts.doorSolid, mats.solid, group));
  const doorGlass = under(doorPivot, add(body.doorGlass, mats.makeGlass('winFL', 0.2, 0x0b1518), group, false));
  doorGlass.renderOrder = 2;
  windows.winFL = doorGlass;
  const door = { value: 0, target: 0 };
  const doorLocal = (x, y, z) => new THREE.Vector3(x, y, z).sub(doorPivot.position);
  const handleLocal = doorLocal(parts.doorHandle.x, parts.doorHandle.y, parts.doorHandle.z);
  const pullLocal = doorLocal(0.42, 1.06, -0.65);
  const supportLocal = doorLocal(0.62, 1.5, -0.73);

  for (const [kind, z] of [['flight', -0.22], ['map', 0.22]]) {
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), screenMaterial(parts.screens[kind], lighting, 1.2));
    screen.position.set(1.418, 1.2, z);
    screen.rotation.set(0, -Math.PI / 2, 0);
    screen.rotateX(-0.12);
    group.add(screen);
  }

  const cyclicPivot = new THREE.Group();
  cyclicPivot.position.copy(DIM.cyclic);
  group.add(cyclicPivot);
  add(parts.cyclic, mats.solid, cyclicPivot, false);
  const copilotStick = add(parts.cyclic, mats.solid, group, false);
  copilotStick.position.set(DIM.cyclic.x, DIM.cyclic.y, -DIM.cyclic.z);
  const collectivePivot = new THREE.Group();
  collectivePivot.position.copy(DIM.collective);
  group.add(collectivePivot);
  add(parts.collective, mats.solid, collectivePivot, false);
  const gripLocal = { R: new THREE.Vector3(-0.1, 0.49, 0), L: new THREE.Vector3(0.4, 0.19, 0) };

  const rotor = new THREE.Group();
  rotor.position.copy(DIM.mast);
  group.add(rotor);
  add(parts.rotorSolid, mats.solid, rotor);
  const blades = [];
  for (let i = 0; i < DIM.blades; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI * 2) / DIM.blades;
    rotor.add(arm);
    const flap = new THREE.Group();
    flap.position.set(0.2, 0, 0);
    arm.add(flap);
    const blade = add(parts.blade, mats.solid, flap);
    blade.position.set(-0.2, 0, 0);
    blades.push({ flap, blade });
  }
  const disc = new THREE.Mesh(new THREE.RingGeometry(0.45, DIM.rotorRadius, 96, 8).rotateX(-Math.PI / 2), discMaterial(DIM.rotorRadius, DIM.blades, [0.86, 0.58, 0.04]));
  disc.position.copy(DIM.mast);
  disc.renderOrder = 6;
  disc.frustumCulled = false;
  disc.visible = false;
  group.add(disc);

  const tailRotor = new THREE.Group();
  tailRotor.position.copy(DIM.tailRotor);
  group.add(tailRotor);
  const tailBlades = add(parts.tailBlades, mats.solid, tailRotor);
  const tailDisc = new THREE.Mesh(new THREE.RingGeometry(0.06, DIM.tailRadius, 48, 3).rotateX(-Math.PI / 2), discMaterial(DIM.tailRadius, 2, [0.75, 0.75, 0.73]));
  tailDisc.position.copy(DIM.tailRotor);
  tailDisc.rotation.x = Math.PI / 2;
  tailDisc.renderOrder = 6;
  tailDisc.visible = false;
  group.add(tailDisc);

  const lamps = {
    red: lamp(0xff1408, 0.035, new THREE.Vector3(-4.75, 1.66, -0.985)),
    green: lamp(0x10ff48, 0.035, new THREE.Vector3(-4.75, 1.66, 0.985)),
    tail: lamp(0xffffff, 0.03, new THREE.Vector3(-6.44, 1.9, 0)),
    beacon: lamp(0xff1408, 0.045, new THREE.Vector3(-6.2, 3.01, 0)),
    strobe: lamp(0xffffff, 0.04, new THREE.Vector3(0.1, 0.5, 0)),
    landing: lamp(0xfff4dc, 0.06, skinPoint(2.2, 0.93).add(new THREE.Vector3(0.02, -0.02, 0))),
  };
  const beam = new THREE.SpotLight(0xfff0d8, 0, 90, 0.5, 0.8, 1.6);
  beam.position.set(2.2, 0.8, 0);
  beam.target.position.set(16, -3.2, 0);
  group.add(beam, beam.target);

  const headBroken = new THREE.Vector2();
  const tailBroken = new THREE.Vector2();
  const visual = { rpm: 0, lift: 0, pitch: 0, roll: 0, collective: 0, angle: 0, tailAngle: 0, lights: false, beam: false, broken: false };
  let time = 0;
  const applyDoor = () => {
    const e = door.value * door.value * (3 - 2 * door.value);
    doorPivot.rotation.y = -e * DOOR_MAX;
  };
  const world = (node, local, out) => {
    node.updateWorldMatrix(true, false);
    return out.copy(local).applyMatrix4(node.matrixWorld);
  };

  const model = {
    id: 'heli',
    group,
    panels: { shell, door: doorPanel },
    pivots: { doorFL: doorPivot, rotor, tailRotor },
    windows,
    glassMaterials: mats.glassMaterials,
    materials: mats,
    mirrors: [],
    wheels: [],
    headBroken,
    tailBroken,
    paintUniforms: mats.paintUniforms,
    damageCtx: null,
    damageTexture: null,
    roof: { value: 0, target: 0 },
    fixedRoof: true,
    seat: DIM.seat.clone(),
    steeringWheel: cyclicPivot,
    dims: DIM,
    blades,
    rotor,
    visual,
    bindState() {},
    bindSim() {},
    setRoof() {},
    toggleRoof() {},
    setDoor(name, open) {
      if (name === 'doorFL') door.target = open ? 1 : 0;
    },
    setDoorAngle(name, amount) {
      if (name !== 'doorFL') return;
      door.value = door.target = Math.min(1, Math.max(0, amount));
      applyDoor();
    },
    doorAmount() {
      return door.value;
    },
    handlePoint(out = new THREE.Vector3()) {
      return world(doorPivot, handleLocal, out);
    },
    innerPullPoint(out = new THREE.Vector3()) {
      return world(doorPivot, pullLocal, out);
    },
    supportPoint(out = new THREE.Vector3()) {
      return world(doorPivot, supportLocal, out);
    },
    gripPoint(side = 'L', out = new THREE.Vector3()) {
      return side === 'R' ? world(cyclicPivot, gripLocal.R, out) : world(collectivePivot, gripLocal.L, out);
    },
    entryGeometry() {
      const s = DIM.seat;
      return {
        door: 'doorFL',
        seat: s.clone(),
        spot: new THREE.Vector3(0.5, 0, -1.6),
        stepBack: new THREE.Vector3(0.34, 0, -1.72),
        gap: new THREE.Vector3(0.74, 0, -1.3),
        exitSpot: new THREE.Vector3(0.3, 0, -1.78),
        prompt: new THREE.Vector3(0.7, 0, -1.6),
        footInR: new THREE.Vector3(1.04, DIM.floor + 0.02, -0.5),
        pedalR: new THREE.Vector3(1.46, 0.71, -0.27),
        pedalL: new THREE.Vector3(1.45, 0.71, -0.46),
        sillY: 0.6,
        brace: new THREE.Vector3(0.52, 1.52, -0.1),
        length: 5.6,
        halfWidth: 1.15,
      };
    },
    setLights({ beam: on }) {
      visual.beam = !!on;
    },
    setRotor(state) {
      Object.assign(visual, state);
    },
    update(dt) {
      time += dt;
      if (door.value !== door.target) {
        door.value += Math.sign(door.target - door.value) * Math.min(Math.abs(door.target - door.value), dt / 0.9);
        applyDoor();
      }
      const rpm = visual.broken ? 0 : visual.rpm;
      visual.angle = (visual.angle + rpm * OMEGA * dt) % (Math.PI * 2);
      visual.tailAngle = (visual.tailAngle + rpm * TAIL_OMEGA * dt) % (Math.PI * 2);
      rotor.rotation.y = visual.angle;
      tailRotor.rotation.z = visual.tailAngle;
      const spin = rpm * rpm;
      const cone = -0.05 + spin * (0.045 + 0.06 * Math.min(1.3, visual.lift));
      for (const b of blades) b.flap.rotation.z = cone;
      const blur = THREE.MathUtils.smoothstep(rpm, 0.3, 0.8);
      const solid = rpm < 0.62 && !visual.broken;
      for (const b of blades) b.blade.visible = solid;
      disc.visible = blur > 0.01 && !visual.broken;
      disc.material.uniforms.uAlpha.value = blur * 0.95;
      disc.material.uniforms.uPhase.value = -visual.angle * 0.13 + Math.sin(time * 37.0) * 0.12;
      disc.material.uniforms.uCone.value = Math.tan(cone);
      disc.rotation.set(visual.roll * 0.07, 0, -visual.pitch * 0.07);
      tailBlades.visible = rpm < 0.5;
      tailDisc.visible = rpm > 0.25;
      tailDisc.material.uniforms.uAlpha.value = THREE.MathUtils.smoothstep(rpm, 0.25, 0.6) * 0.9;
      tailDisc.material.uniforms.uPhase.value = visual.tailAngle * 0.07;
      if (lighting && lighting.sunColor) {
        const c = lighting.sunColor;
        const k = 0.5 + 0.5 * Math.max(c.r, c.g, c.b);
        disc.material.uniforms.uLight.value.setScalar(Math.min(1.6, k));
        tailDisc.material.uniforms.uLight.value.setScalar(Math.min(1.6, k));
      }
      cyclicPivot.rotation.set(-visual.roll * 0.16, 0, -visual.pitch * 0.14);
      collectivePivot.rotation.z = -0.1 + visual.collective * 0.3;
      const on = visual.lights ? 1 : 0;
      const blink = time % 1.2;
      lamps.red.emissiveIntensity = 7 * on;
      lamps.green.emissiveIntensity = 7 * on;
      lamps.tail.emissiveIntensity = 5 * on;
      lamps.beacon.emissiveIntensity = on * (blink < 0.07 || (blink > 0.16 && blink < 0.23) ? 40 : 0.2);
      lamps.strobe.emissiveIntensity = on * (time % 1.6 < 0.05 ? 60 : 0);
      const lit = visual.beam && on ? 1 - Math.max(headBroken.x, headBroken.y) : 0;
      lamps.landing.emissiveIntensity = 30 * lit;
      beam.intensity = 520 * lit;
    },
  };
  applyDoor();
  model.update(0);
  return model;
}
