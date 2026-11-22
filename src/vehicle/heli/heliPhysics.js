// Costa del Gzowo helicopter: flight model under the game's car-physics contract (rotor spool-up, thrust along the mast, a fly-by-wire computer that tilts the machine to fly where you point it, skids, ground and water, rotor strikes, soft world edge).
import * as THREE from 'three';
import { WORLD } from '../../config.js';
import { GROUPS, groups } from '../../core/physics.js';
import { heightAt } from '../../world/heightfield.js';
import { DIM } from './heliParts.js';

export const HELI_KEYS = { boost: ['ShiftLeft', 'ShiftRight'], lift: ['Space'], descend: ['KeyC'], handbrake: 'KeyX', camera: 'KeyV' };
export const TUNE = {
  mass: 1150, gravity: 9.81, spoolUp: 0.155, spoolDown: 0.075,
  cruise: 40, boost: 56, reverse: 9, accel: 3.9, boostAccel: 5.8, brake: 6.8, coast: 2.2, slip: 1.7,
  turnAccel: 8.2, yawRate: 1.2, climb: 9, boostClimb: 13.5, sink: 7.5, climbGain: 2.4,
  drag: 0.0012, dragUp: 0.006, attitude: 4.0, blend: 8.5, maxTilt: 0.78, ceiling: 560, waterFloor: 1.1, clearance: 7,
};
const EDGE = WORLD.bound - 60;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const edgePush = (p, v) => {
  const over = Math.abs(p) - EDGE;
  if (over <= 0) return 0;
  const out = Math.sign(p);
  return -out * Math.min(40, 1.0 * over + 1.4 * Math.max(0, v * out));
};

export function createHeliPhysics({ physics, model, spawn, input }) {
  const R = physics.RAPIER;
  const world = physics.world;
  const y0 = heightAt(spawn.x, spawn.z) + 0.06;
  const startQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
  const body = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(spawn.x, y0, spawn.z).setRotation(startQuat).setAdditionalMassProperties(TUNE.mass, { x: 0, y: 1.15, z: 0 }, { x: 1100, y: 3800, z: 3300 }, { x: 0, y: 0, z: 0, w: 1 }).setLinearDamping(0.02).setAngularDamping(0.5).setCcdEnabled(true).setCanSleep(false),
  );
  const own = groups(GROUPS.CAR, 0xffff);
  const along = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const mk = (desc, friction = 0.45) => world.createCollider(desc.setDensity(0).setFriction(friction).setRestitution(0.02).setCollisionGroups(own).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(2500), body);
  const colliders = [
    mk(R.ColliderDesc.roundCuboid(1.5, 0.52, 0.6, 0.13).setTranslation(0.45, 1.3, 0)),
    mk(R.ColliderDesc.capsule(1.9, 0.17).setTranslation(-4.0, 1.6, 0).setRotation(along)),
    mk(R.ColliderDesc.cuboid(0.4, 0.95, 0.04).setTranslation(-6.05, 2.0, 0)),
    mk(R.ColliderDesc.cuboid(0.95, 0.2, 0.34).setTranslation(-0.65, 2.26, 0)),
    mk(R.ColliderDesc.capsule(1.5, 0.045).setTranslation(0, 0.045, -DIM.skidZ).setRotation(along), 0.9),
    mk(R.ColliderDesc.capsule(1.5, 0.045).setTranslation(0, 0.045, DIM.skidZ).setRotation(along), 0.9),
  ];
  for (const c of colliders) physics.surfaces.set(c.handle, 'car');

  const state = {
    throttle: 0, brake: 0, steerInput: 0, handbrake: 0, steer: 0, gear: 1, rpm: 0, speed: 0, forwardSpeed: 0, shifting: 0, engineOn: false, occupied: false,
    submersion: 0, flood: 0, stalled: false, airborne: false, onGround: 4, engineLoad: 0, waterDepth: 0, lastShift: 0, reverse: false, skid: 0, gForce: new THREE.Vector3(), inWater: false,
    electric: true, kick: 0, landing: 0, rotor: 0, lift: 0, agl: 0, flying: false, strike: 0, readout: 'ROTOR 0%', rotorBroken: false, powerScale: 1, pitch: 0, roll: 0, wash: 0, overWater: false, floorY: 0,
  };
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const vel = new THREE.Vector3();
  const fwd = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3(0, 0, 1);
  const prevVel = new THREE.Vector3();
  const fh = new THREE.Vector3();
  const rh = new THREE.Vector3();
  const want = new THREE.Vector3();
  const tF = new THREE.Vector3();
  const tR = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const qT = new THREE.Quaternion();
  const qE = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const solid = groups(0xffff, GROUPS.WORLD | GROUPS.PROP);
  const skidPoints = [[1.25, -1], [1.25, 1], [-1.25, -1], [-1.25, 1]].map(([x, s]) => new THREE.Vector3(x, 0.3, s * DIM.skidZ));
  let water = null;
  let time = 0;
  let heading = spawn.yaw;
  let holding = false;
  let holdAlt = null;
  let thrust = 0;
  let groundT = 1;
  let airT = 0;
  let wasFast = false;
  let gustX = 0;
  let gustZ = 0;

  function read() {
    const t = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    pos.set(t.x, t.y, t.z);
    quat.set(r.x, r.y, r.z, r.w);
    vel.set(lv.x, lv.y, lv.z);
    fwd.set(1, 0, 0).applyQuaternion(quat);
    up.set(0, 1, 0).applyQuaternion(quat);
    right.set(0, 0, 1).applyQuaternion(quat);
  }

  function cast(origin, dir, length) {
    ray.origin.x = origin.x;
    ray.origin.y = origin.y;
    ray.origin.z = origin.z;
    ray.dir.x = dir.x;
    ray.dir.y = dir.y;
    ray.dir.z = dir.z;
    const hit = world.castRay(ray, length, true, undefined, solid);
    return hit ? (hit.timeOfImpact ?? hit.toi) : null;
  }

  function sense() {
    v.copy(pos).addScaledVector(up, 0.8);
    const d = cast(v, { x: 0, y: -1, z: 0 }, 90);
    let floor = d === null ? pos.y - 90 : v.y - d;
    const wet = heightAt(pos.x, pos.z) < WORLD.waterLevel - 0.05;
    const level = wet ? (water ? water.getHeightAt(pos.x, pos.z) : WORLD.waterLevel) : null;
    state.overWater = level !== null && level > floor;
    if (state.overWater) floor = level;
    state.floorY = floor;
    state.agl = Math.max(0, pos.y - floor);
    let contacts = 0;
    for (const p of skidPoints) {
      v.copy(p).applyQuaternion(quat).add(pos);
      const h = cast(v, { x: -up.x, y: -up.y, z: -up.z }, 0.42);
      if (h !== null) contacts++;
    }
    state.onGround = contacts;
    const depth = level === null ? 0 : level - (pos.y + 0.35);
    state.waterDepth = Math.max(0, depth);
    state.submersion = clamp(depth / 1.3, 0, 1);
    state.inWater = state.submersion > 0.02;
    return level;
  }

  function rotorStrike() {
    if (state.rotor < 0.5 || state.rotorBroken) return;
    const a = Math.random() * Math.PI * 2;
    v.set(Math.cos(a), 0.02, Math.sin(a)).applyQuaternion(quat).normalize();
    want.copy(DIM.mast).applyQuaternion(quat).add(pos).addScaledVector(v, 0.6);
    const d = cast(want, v, DIM.rotorRadius - 0.6);
    if (d === null) return;
    state.strike = time;
    state.strikePoint = want.clone().addScaledVector(v, d);
    body.applyImpulse({ x: -v.x * TUNE.mass * 1.6, y: TUNE.mass * 0.5, z: -v.z * TUNE.mass * 1.6 }, true);
    body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 2600, y: (Math.random() - 0.5) * 5200, z: (Math.random() - 0.5) * 2600 }, true);
  }

  function substep(dt) {
    time += dt;
    read();
    const level = sense();
    const on = state.occupied && !state.stalled;
    const key = (list) => (input && on ? input.key(...list) : false);
    const fw = on ? controls.throttle - controls.brake : 0;
    const turn = on ? controls.steer : 0;
    const lift = key(HELI_KEYS.lift);
    const sink = key(HELI_KEYS.descend);
    const fast = key(HELI_KEYS.boost);
    if (fast && !wasFast && state.flying) state.kick = time;
    wasFast = fast;

    const target = on && !state.rotorBroken ? 1 : 0;
    state.rotor += clamp(target - state.rotor, -TUNE.spoolDown * dt, TUNE.spoolUp * dt);
    const power = clamp((state.rotor - 0.84) / 0.14, 0, 1) * (state.powerScale ?? 1);
    const grounded = state.onGround >= 2;
    if (grounded) groundT += dt;
    else groundT = 0;
    if (!grounded) airT += dt;
    else {
      if (airT > 0.35) state.landing = Math.min(1, Math.abs(prevVel.y) / 5);
      airT = 0;
    }
    state.landing = Math.max(0, state.landing - dt * 2);
    if (lift && power > 0.9) state.flying = true;
    else if (grounded && groundT > 0.3 && !lift && vel.y < 0.4) state.flying = false;
    if (!grounded && power > 0.5) state.flying = true;
    if (power < 0.3) state.flying = false;

    fh.set(fwd.x, 0, fwd.z);
    if (fh.lengthSq() < 1e-4) fh.set(Math.cos(heading), 0, -Math.sin(heading));
    fh.normalize();
    rh.set(-fh.z, 0, fh.x);
    const vf = vel.dot(fh);
    const vr = vel.dot(rh);
    const g = TUNE.gravity;
    let wantThrust = TUNE.mass * g * 0.12 * power;
    let authority = 0;
    state.pitch = 0;
    state.roll = 0;

    if (state.flying) {
      const top = fast ? TUNE.boost : TUNE.cruise;
      let vfT = 0;
      let lim = TUNE.coast;
      if (fw > 0) {
        vfT = top;
        lim = vf > top ? TUNE.coast : fast ? TUNE.boostAccel : TUNE.accel;
      } else if (fw < 0) {
        vfT = vf > 1.5 ? 0 : -TUNE.reverse;
        lim = TUNE.brake;
      }
      const af = clamp((vfT - vf) * 1.1, -lim, lim);
      const yawCmd = turn * Math.min(TUNE.yawRate, TUNE.turnAccel / Math.max(Math.abs(vf), 7));
      const ar = clamp(-vf * yawCmd - vr * TUNE.slip, -9, 9);
      gustX += (Math.random() - 0.5) * dt * 3 - gustX * dt * 0.8;
      gustZ += (Math.random() - 0.5) * dt * 3 - gustZ * dt * 0.8;
      const calm = clamp(state.agl / 6, 0.15, 1);
      want.set(fh.x * af + rh.x * ar + gustX * 0.5 * calm, 0, fh.z * af + rh.z * ar + gustZ * 0.5 * calm);

      const hv0 = Math.hypot(vel.x, vel.z);
      let vyT;
      if (lift) {
        vyT = fast ? TUNE.boostClimb : TUNE.climb;
        holdAlt = null;
      } else if (sink) {
        vyT = -Math.min(TUNE.sink, 0.55 + state.agl * 0.55);
        holdAlt = null;
      } else {
        if (holdAlt === null && Math.abs(vel.y) < 1.4) holdAlt = pos.y;
        vyT = holdAlt === null ? 0 : clamp((holdAlt - pos.y) * 1.6, -3, 3);
      }
      if (!sink) {
        let need = 0;
        for (const ahead of hv0 > 8 ? [0.7, 1.4, 2.2, 3.0] : []) {
          const clear = heightAt(pos.x + vel.x * ahead, pos.z + vel.z * ahead) + TUNE.clearance - pos.y;
          if (clear > 0) need = Math.max(need, clear / ahead + 1.5);
        }
        if (state.agl < TUNE.clearance * 0.6 && hv0 > 6) need = Math.max(need, (TUNE.clearance * 0.6 - state.agl) * 1.5);
        if (need > vyT) {
          vyT = Math.min(need, TUNE.boostClimb);
          holdAlt = null;
        }
      }
      if (pos.y > TUNE.ceiling - 40) vyT = Math.min(vyT, (TUNE.ceiling - pos.y) * 0.25);
      if (state.overWater && state.agl < TUNE.waterFloor + 2) {
        vyT = Math.max(vyT, (TUNE.waterFloor - state.agl) * 2.2);
        if (holdAlt !== null) holdAlt = Math.max(holdAlt, state.floorY + TUNE.waterFloor);
      }
      const ay = clamp((vyT - vel.y) * TUNE.climbGain, -7.5, 8);

      const maxTilt = Math.min(TUNE.maxTilt, 0.1 + state.agl * 0.13);
      const maxH = Math.tan(maxTilt) * (g + ay);
      if (want.length() > maxH) want.setLength(maxH);
      state.pitch = clamp(want.dot(fh) / 6, -1, 1);
      state.roll = clamp(want.dot(rh) / 8, -1, 1);
      want.y = g + ay;
      want.normalize();
      if (yawCmd !== 0 || !holding) heading = Math.atan2(-fh.z, fh.x) + yawCmd * 0.1;
      holding = yawCmd === 0;
      tF.set(Math.cos(heading), 0, -Math.sin(heading));
      tF.y = -tF.dot(want) / want.y;
      tF.normalize();
      tR.crossVectors(tF, want).normalize();
      basis.makeBasis(tF, want, tR);
      qT.setFromRotationMatrix(basis);
      qE.copy(quat).invert().premultiply(qT);
      if (qE.w < 0) qE.set(-qE.x, -qE.y, -qE.z, -qE.w);
      v.set(qE.x, qE.y, qE.z).multiplyScalar(2 * TUNE.attitude);
      v.y += yawCmd * 0.6;
      if (v.length() > 3) v.setLength(3);
      authority = power * clamp(0.25 + state.agl * 1.5, 0, 1);
      const w = body.angvel();
      const k = (1 - Math.exp(-TUNE.blend * dt)) * authority;
      body.setAngvel({ x: w.x + (v.x - w.x) * k, y: w.y + (v.y - w.y) * k, z: w.z + (v.z - w.z) * k }, true);
      wantThrust = clamp((TUNE.mass * (g + ay)) / Math.max(0.45, up.y), TUNE.mass * g * 0.12, TUNE.mass * g * 1.95) * power;
    } else {
      holdAlt = null;
      holding = false;
    }

    thrust += (wantThrust - thrust) * (1 - Math.exp(-4.5 * dt));
    state.lift = thrust / (TUNE.mass * g);
    const hv = Math.hypot(vel.x, vel.z);
    let fx = up.x * thrust - TUNE.mass * TUNE.drag * hv * vel.x;
    let fy = up.y * thrust - TUNE.mass * TUNE.dragUp * Math.abs(vel.y) * vel.y;
    let fz = up.z * thrust - TUNE.mass * TUNE.drag * hv * vel.z;
    if (!grounded) {
      fx += edgePush(pos.x, vel.x) * TUNE.mass;
      fz += edgePush(pos.z, vel.z) * TUNE.mass;
    } else if (!state.flying) {
      fx -= vel.x * TUNE.mass * 2.5;
      fz -= vel.z * TUNE.mass * 2.5;
    }
    if (state.inWater) {
      fy += TUNE.mass * g * 1.5 * state.submersion - vel.y * TUNE.mass * 2.2 * state.submersion;
      fx -= vel.x * TUNE.mass * 1.6 * state.submersion;
      fz -= vel.z * TUNE.mass * 1.6 * state.submersion;
      if (state.waterDepth > 0.75 && !state.stalled) {
        state.stalled = true;
        state.flood = 1;
      }
    }
    body.applyImpulse({ x: fx * dt, y: fy * dt, z: fz * dt }, true);
    rotorStrike();
    if (pos.y < WORLD.waterLevel - 40) respawn();

    const washReach = clamp(1 - state.agl / 14, 0, 1);
    state.wash = washReach * state.rotor * state.rotor * clamp(state.lift, 0.2, 1.3);
    Object.assign(state, {
      throttle: Math.max(0, fw), brake: Math.max(0, -fw), steerInput: turn, steer: turn * 0.3, rpm: state.rotor * 6400, speed: vel.length(), forwardSpeed: vf,
      airborne: !grounded, engineLoad: clamp(state.lift, 0, 1.5), level,
      readout: state.stalled ? 'ENGINE OUT' : state.flying && !grounded ? `ALT ${Math.round(state.agl)} m` : state.rotor < 0.98 ? `ROTOR ${Math.round(state.rotor * 100)}%` : 'READY',
    });
    prevVel.copy(vel);
  }

  function sync() {
    read();
    model.group.position.copy(pos);
    model.group.quaternion.copy(quat);
    model.setRotor({ rpm: state.rotor, lift: state.lift, pitch: state.pitch, roll: state.roll, collective: clamp((state.lift - 0.12) / 1.1, 0, 1), lights: state.occupied || state.rotor > 0.05, broken: state.rotorBroken });
    state.gForce.copy(vel).sub(prevVel);
  }

  function place(x, y, z, yaw) {
    body.setTranslation({ x, y, z }, true);
    body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    heading = yaw;
    holdAlt = null;
    thrust = 0;
    state.flying = false;
    read();
  }

  function respawn() {
    place(spawn.x, y0 + 0.3, spawn.z, spawn.yaw);
    state.stalled = false;
    state.flood = 0;
  }

  read();
  sync();
  return {
    body, wheels: [], state, controls, colliders, mass: TUNE.mass, keys: HELI_KEYS,
    position: pos, quaternion: quat, velocity: vel, forward: fwd, up, right,
    camera: { distance: 11, height: 2.1, ahead: 3.2, pitch: 0.22 },
    hint: 'Exit   ·   Space up   ·   C down   ·   W S A D fly   ·   Shift fast',
    label: 'Enter helicopter',
    setWater(w) {
      water = w;
    },
    get water() {
      return water;
    },
    substep,
    sync,
    reset() {
      const yaw = Math.atan2(-fwd.z, fwd.x);
      place(pos.x, Math.max(pos.y, heightAt(pos.x, pos.z)) + 0.8, pos.z, yaw);
    },
    respawn,
  };
}
