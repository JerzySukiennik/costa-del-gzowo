// Costa del Gzowo: another player in the world (character with avatar, their vehicle as a visual model with a kinematic collision body), driven by interpolated network snapshots.
import * as THREE from 'three';
import { GROUPS, groups } from '../core/physics.js';
import { createCharacter } from '../player/character.js';
import { createAvatars } from '../player/avatars.js';
import { NET } from './firebaseConfig.js';
import { KINDS, PARTS, FLAG, VFLAG } from './protocol.js';

const HEAT = { convertible: [1.5, 0.92, 0], roadster: [0, 1.0, 0], heli: [-0.9, 2.25, 0] };
const TAG = { convertible: 1.75, roadster: 1.6, heli: 3.3 };
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a) => (Math.random() - 0.5) * 2 * a;

function colliders(R, kind) {
  const along = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  if (kind === 'heli') {
    return [
      R.ColliderDesc.roundCuboid(1.5, 0.52, 0.6, 0.13).setTranslation(0.45, 1.3, 0),
      R.ColliderDesc.capsule(1.9, 0.17).setTranslation(-4.0, 1.6, 0).setRotation(along),
      R.ColliderDesc.cuboid(0.4, 0.95, 0.04).setTranslation(-6.05, 2.0, 0),
      R.ColliderDesc.cuboid(0.95, 0.2, 0.34).setTranslation(-0.65, 2.26, 0),
      R.ColliderDesc.capsule(1.5, 0.045).setTranslation(0, 0.045, -1.02).setRotation(along),
      R.ColliderDesc.capsule(1.5, 0.045).setTranslation(0, 0.045, 1.02).setRotation(along),
    ];
  }
  if (kind === 'roadster') return [R.ColliderDesc.roundCuboid(2.1, 0.24, 0.88, 0.1).setTranslation(0, 0.55, 0), R.ColliderDesc.roundCuboid(0.9, 0.12, 0.6, 0.08).setTranslation(-0.3, 0.95, 0)];
  return [R.ColliderDesc.roundCuboid(2.16, 0.2, 0.78, 0.1).setTranslation(-0.09, 0.56, 0), R.ColliderDesc.roundCuboid(1.1, 0.07, 0.62, 0.08).setTranslation(-0.6, 0.9, 0)];
}

export function createRemote(ctx, deps, slot) {
  const { scene, physics, particles } = deps;
  const R = physics.RAPIER;
  const snaps = [];
  const pos = new THREE.Vector3();
  const vPos = new THREE.Vector3();
  const vQuat = new THREE.Quaternion();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const forward = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const velocity = new THREE.Vector3();
  let offset = null;
  let gap = 1000 / NET.sendHz;
  let character = null;
  let building = false;
  let vehicle = null;
  let buildingKind = -1;
  let gone = false;
  let spin = 0;

  const self = {
    slot,
    profile: { name: 'Player', car: 'convertible', avatar: 'default' },
    link: 'joining',
    now: null,
    tag: new THREE.Vector3(),
    tagOn: false,
    proxy: { position: vPos, quaternion: vQuat, forward, up, velocity, wheels: [], state: { speed: 0, forwardSpeed: 0, reverse: false, skid: 0, onGround: 4, rpm: 0, gear: 1, stalled: false, readout: '' }, camera: null },
    get vehicle() {
      return vehicle;
    },
    get character() {
      return character;
    },
    get driving() {
      return !!self.now && (self.now.flags & FLAG.DRIVING) !== 0;
    },
    get ridingWith() {
      return self.now && self.now.flags & FLAG.RIDING ? self.now.host : -1;
    },
    setProfile(p) {
      const avatar = self.profile.avatar;
      Object.assign(self.profile, p);
      if (character && avatar !== self.profile.avatar) character.avatars.set(self.profile.avatar).catch(() => {});
    },
    push(s, now) {
      const last = snaps[snaps.length - 1];
      if (last && ((s.time - last.time) | 0) <= 0 && Math.abs(s.time - last.time) < 60000) return;
      if (last) gap += (Math.min(1000, s.time - last.time) - gap) * 0.1;
      const o = now - s.time;
      offset = offset === null || o < offset || Math.abs(o - offset) > 5000 ? o : offset + 0.4;
      snaps.push(s);
      if (snaps.length > 40) snaps.shift();
    },
    sample(now) {
      if (!snaps.length || offset === null) return null;
      const delay = Math.min(480, Math.max(NET.delayMs, gap * 1.6 + 35));
      const t = now - offset - delay;
      let i = snaps.length - 1;
      while (i > 0 && snaps[i - 1].time > t) i--;
      const b = snaps[i];
      const a = snaps[Math.max(0, i - 1)];
      const span = b.time - a.time;
      const k = span > 0 ? Math.min(1, Math.max(0, (t - a.time) / span)) : 1;
      const ahead = i === snaps.length - 1 ? Math.min(0.25, Math.max(0, (t - b.time) / 1000)) : 0;
      return { a, b, k, ahead };
    },
    pose(now, outPos, outQuat) {
      const s = self.sample(now);
      if (!s) return false;
      const { a, b, k, ahead } = s;
      outPos.set(lerp(a.vx, b.vx, k) + b.v[0] * ahead, lerp(a.vyPos, b.vyPos, k) + b.v[1] * ahead, lerp(a.vz, b.vz, k) + b.v[2] * ahead);
      qa.set(a.q[0], a.q[1], a.q[2], a.q[3]);
      qb.set(b.q[0], b.q[1], b.q[2], b.q[3]);
      outQuat.copy(qa).slerp(qb, k).normalize();
      return true;
    },
    fixed(now) {
      if (!vehicle || !vehicle.body || !self.pose(now, v, qa)) return;
      vehicle.body.setNextKinematicTranslation({ x: v.x, y: v.y, z: v.z });
      vehicle.body.setNextKinematicRotation({ x: qa.x, y: qa.y, z: qa.z, w: qa.w });
    },
    update(dt, now, env) {
      const s = self.sample(now);
      if (!s) return;
      const { a, b, k } = s;
      self.now = b;
      if (!character && !building) buildCharacter();
      const kind = b.flags & FLAG.VEHICLE ? b.kind : -1;
      if (kind >= 0 && (!vehicle || vehicle.kind !== kind) && buildingKind !== kind) buildVehicle(kind);
      if (vehicle && self.pose(now, vPos, vQuat)) applyVehicle(dt, b, env);
      applyCharacter(dt, a, b, k, env);
    },
    dispose() {
      gone = true;
      if (character) {
        if (character.group.parent) character.group.parent.remove(character.group);
        character = null;
      }
      dropVehicle();
    },
  };

  async function buildCharacter() {
    building = true;
    try {
      const rig = await createCharacter(ctx, { id: 'default' });
      rig.avatars = createAvatars(ctx, rig);
      if (self.profile.avatar !== 'default') await rig.avatars.set(self.profile.avatar).catch(() => {});
      if (gone) return;
      rig.group.visible = false;
      scene.add(rig.group);
      rig.snap({ mode: 'foot', speed: 0, vy: 0, wade: 0 });
      character = rig;
    } catch (error) {
      console.warn('Remote character unavailable.', error);
    }
    building = false;
  }

  function dropVehicle() {
    if (!vehicle) return;
    if (character && character.group.parent === vehicle.model.group) scene.add(character.group);
    scene.remove(vehicle.model.group);
    vehicle.model.group.traverse((o) => {
      if (o.isMesh && o.geometry) o.geometry.dispose();
    });
    if (vehicle.body) physics.world.removeRigidBody(vehicle.body);
    vehicle = null;
  }

  async function buildVehicle(kind) {
    buildingKind = kind;
    const name = KINDS[kind] || 'convertible';
    try {
      let model;
      let sim = null;
      let state = null;
      if (name === 'roadster') {
        const [m, t, tune] = await Promise.all([import('../vehicle/roadster/roadsterModel.js'), import('../vehicle/roadster/thrusters.js'), import('../vehicle/roadster/tuning.js')]);
        model = await m.createRoadsterModel(ctx);
        sim = { thrusters: new t.Thrusters(tune.TUNING), wheels: [0, 1, 2, 3].map(() => ({ length: tune.TUNING.suspension.rest_length * 0.8, steer: 0, spin: 0 })), steerAngle: 0, opts: {} };
        model.bindSim(sim);
      } else if (name === 'heli') {
        model = await (await import('../vehicle/heli/heliModel.js')).createHeliModel(ctx);
      } else {
        model = await (await import('../vehicle/carModel.js')).createCarModel(ctx);
        state = { forwardSpeed: 0, rpm: 0, occupied: false, reverse: false, gear: 1 };
        model.bindState(state);
      }
      if (gone || buildingKind !== kind) return;
      dropVehicle();
      const body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -500, 0));
      for (const desc of colliders(R, name)) {
        const c = physics.world.createCollider(desc.setFriction(0.45).setRestitution(0.05).setCollisionGroups(groups(GROUPS.CAR, 0xffff)), body);
        physics.surfaces.set(c.handle, 'car');
      }
      model.group.visible = false;
      scene.add(model.group);
      vehicle = { kind, name, model, body, sim, state, burn: 0 };
      self.proxy.camera = name === 'heli' ? { distance: 11, height: 2.1, ahead: 3.2, pitch: 0.22 } : null;
    } catch (error) {
      console.warn('Remote vehicle unavailable.', error);
    }
    buildingKind = -1;
  }

  function applyVehicle(dt, s, env) {
    const m = vehicle.model;
    m.group.visible = true;
    m.group.position.copy(vPos);
    m.group.quaternion.copy(vQuat);
    forward.set(1, 0, 0).applyQuaternion(vQuat);
    up.set(0, 1, 0).applyQuaternion(vQuat);
    velocity.set(s.v[0], s.v[1], s.v[2]);
    const fwd = velocity.dot(forward);
    const steer = s.steer * 0.6;
    const exploded = (s.vflags & VFLAG.EXPLODED) !== 0;
    const burning = (s.vflags & VFLAG.BURNING) !== 0;
    spin += (fwd / 0.34) * dt;
    Object.assign(self.proxy.state, { speed: velocity.length(), forwardSpeed: fwd, rpm: 1500 + Math.abs(fwd) * 90, readout: `With ${self.profile.name}` });
    if (vehicle.name === 'convertible') {
      m.wheels.forEach((w, i) => {
        const lost = ((s.parts >> (6 + i)) & 1) === 1;
        w.group.visible = !lost;
        w.group.rotation.y = w.front ? steer : 0;
        if (w.spin) w.spin.rotation.z = (w.side > 0 ? -1 : 1) * spin;
      });
      if (m.steeringWheel) m.steeringWheel.rotation.z = steer * 7.5;
      PARTS.forEach((part, i) => {
        if (m.pivots[part]) m.pivots[part].visible = ((s.parts >> i) & 1) === 0;
      });
      Object.assign(vehicle.state, { forwardSpeed: fwd, rpm: 900 + s.throttle * 4200, occupied: (s.vflags & VFLAG.OCCUPIED) !== 0, reverse: (s.flags & FLAG.REVERSE) !== 0 });
      if (Math.abs(m.roof.value - s.roof) > 0.03) m.setRoof(s.roof);
      m.setLights({ brake: s.flags & FLAG.BRAKE ? 1 : 0, reverse: (s.flags & FLAG.REVERSE) !== 0, beam: (s.flags & FLAG.BEAMS) !== 0 });
      m.materials.char.value = exploded ? 1 : burning ? Math.max(m.materials.char.value, 0.4) : 0;
    } else if (vehicle.name === 'roadster') {
      const sim = vehicle.sim;
      sim.steerAngle = steer;
      sim.wheels.forEach((w, i) => {
        w.length = (s.extra[12 + i] / 255) * 0.6;
        w.steer = i < 2 ? steer : 0;
        w.spin = spin;
      });
      sim.thrusters.all.forEach((nozzle, i) => {
        nozzle.valve = s.extra[i] / 255;
      });
      sim.thrusters.extend = s.extra[10] / 255;
      sim.thrusters.sideDeploy = s.extra[11] / 255;
      sim.thrusters.flap = s.extra[0] > 20 ? 1 : 0;
      m.applySim(sim);
      m.setLights({ brake: s.flags & FLAG.BRAKE ? 1 : 0, beam: (s.flags & FLAG.BEAMS) !== 0 });
    } else {
      m.setRotor({ rpm: s.extra[0] / 255, lift: s.extra[1] / 100, pitch: (s.extra[2] - 128) / 127, roll: (s.extra[3] - 128) / 127, collective: s.extra[4] / 255, lights: (s.vflags & VFLAG.OCCUPIED) !== 0 || s.extra[0] > 12, broken: (s.vflags & VFLAG.ROTOR_BROKEN) !== 0 });
      m.setLights({ beam: (s.flags & FLAG.BEAMS) !== 0 });
      m.materials.char.value = exploded ? 1 : burning ? Math.max(m.materials.char.value, 0.4) : 0;
    }
    m.update(dt);
    if (particles && (burning || exploded)) {
      const h = HEAT[vehicle.name];
      const want = dt * (exploded ? 60 : 110);
      for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(v.set(h[0] + rnd(0.4), h[1], h[2] + rnd(0.5)).applyQuaternion(vQuat).add(vPos), 0.34, 1);
      if (Math.random() < dt * 18) particles.puff(v.set(h[0], h[1] + 0.6, h[2]).applyQuaternion(vQuat).add(vPos), [0.05, 0.05, 0.05], 0.55, 0.55, 2.8, 2.0, 0.4);
    }
  }

  function applyCharacter(dt, a, b, k, env) {
    if (!character) {
      self.tagOn = false;
      return;
    }
    const driving = (b.flags & FLAG.DRIVING) !== 0;
    const riding = (b.flags & FLAG.RIDING) !== 0;
    if (driving || riding) {
      const host = driving ? vehicle && vehicle.model : b.host === env.slot ? env.model : env.remotes.get(b.host) && env.remotes.get(b.host).vehicle && env.remotes.get(b.host).vehicle.model;
      if (!host) {
        character.group.visible = false;
        self.tagOn = false;
        return;
      }
      if (character.group.parent !== host.group) host.group.add(character.group);
      const seat = host.seat;
      character.group.position.set(seat.x, seat.y, driving ? seat.z : -seat.z);
      character.group.rotation.set(0, Math.PI / 2, 0);
      character.group.visible = true;
      character.update(dt, { mode: 'sit', steer: driving ? b.steer : 0, throttle: driving ? b.throttle : 0 });
      host.group.getWorldPosition(self.tag);
      self.tag.y += (TAG[host.id] || TAG.convertible) + (riding ? 0.35 : 0);
      self.tagOn = true;
      return;
    }
    if (character.group.parent !== scene) scene.add(character.group);
    pos.set(lerp(a.px, b.px, k), lerp(a.py, b.py, k), lerp(a.pz, b.pz, k));
    let dy = b.yaw - a.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const yaw = a.yaw + dy * k;
    character.group.position.copy(pos);
    character.group.rotation.set(0, yaw, 0);
    character.group.visible = true;
    const mode = b.flags & FLAG.SWIM ? 'swim' : b.flags & FLAG.GROUNDED ? 'foot' : 'air';
    character.update(dt, { mode, speed: lerp(a.speed, b.speed, k), vy: b.vy, wade: b.wade, heading: yaw });
    self.tag.set(pos.x, pos.y + 2.02, pos.z);
    self.tagOn = true;
  }

  return self;
}
