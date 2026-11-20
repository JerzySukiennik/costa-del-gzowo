// Costa del Gzowo Roadster: wraps the ported Roadster simulation in the game's car-physics contract (game frame +X forward, +Z right), reads the thruster keys and publishes boost, thrust and flight signals on the state.
import * as THREE from 'three';
import { WORLD } from '../../config.js';
import { GROUPS, groups } from '../../core/physics.js';
import { heightAt } from '../../world/heightfield.js';
import { SURFACES, GROUND_NAMES } from '../carPhysics.js';
import { RoadsterSim } from './roadsterSim.js';
import { TUNING } from './tuning.js';

const TO_GAME = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
const EDGE = WORLD.half - 50;
const edgePush = (p, v) => {
  const over = Math.abs(p) - EDGE;
  if (over <= 0) return 0;
  const out = Math.sign(p);
  return -out * Math.min(70, 1.2 * over + 1.6 * Math.max(0, v * out));
};
export const ROADSTER_KEYS = { boost: ['ShiftLeft', 'ShiftRight'], lift: ['Space'], descend: ['KeyC'], handbrake: 'KeyX', camera: 'KeyV', pitchDown: ['KeyI'], pitchUp: ['KeyK'], rollLeft: ['KeyJ'], rollRight: ['KeyL'], assist: ['KeyG'] };

export function createRoadsterPhysics({ physics, terrain, model, spawn, input }) {
  const R = physics.RAPIER;
  const y0 = heightAt(spawn.x, spawn.z) + 0.06;
  let water = null;
  const surface = (collider, x, z) => {
    let name = physics.surfaceOf(collider);
    if (name === 'terrain') name = GROUND_NAMES[terrain.groundAt(x, z)] || 'grass';
    const surf = SURFACES[name] || SURFACES.asphalt;
    return { name: SURFACES[name] ? name : 'asphalt', surf };
  };
  const sim = new RoadsterSim(R, physics.world, TUNING, {
    position: [spawn.x, y0, spawn.z],
    yaw: spawn.yaw + Math.PI / 2,
    collisionGroups: groups(GROUPS.CAR, 0xffff),
    queryGroups: groups(0xffff, GROUPS.WORLD),
    surface,
    waterAt: (x, z) => (heightAt(x, z) > WORLD.waterLevel - 0.05 ? null : water ? water.getHeightAt(x, z) : WORLD.waterLevel),
    wetAt: (p) => p.y < WORLD.waterLevel,
  });
  for (const c of sim.colliders) physics.surfaces.set(c.handle, 'car');
  const body = sim.body;

  const state = {
    throttle: 0, brake: 0, steerInput: 0, handbrake: 0, steer: 0, gear: 1, rpm: 0, speed: 0, forwardSpeed: 0, shifting: 0, engineOn: false, occupied: false,
    submersion: 0, flood: 0, stalled: false, airborne: false, onGround: 4, engineLoad: 0, waterDepth: 0, lastShift: 0, reverse: false, skid: 0, gForce: new THREE.Vector3(), inWater: false,
    boost: 0, thrust: 0, lift: 0, flightMode: 'ground', assist: true, kick: 0, landing: 0, electric: true,
  };
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const vel = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const prevVel = new THREE.Vector3();
  const inp = { throttle: 0, brake: 0, steer: 0, boost: false, lift: false, descend: false, pitch: 0, roll: 0, park: true };
  const wheels = sim.wheels.map(() => ({ contact: false, surface: 'asphalt', surf: SURFACES.asphalt, skid: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), wet: 0, load: 0, slip: 0 }));
  let wasBoost = false;
  let airT = 0;
  let time = 0;

  function read() {
    const t = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    pos.set(t.x, t.y, t.z);
    quat.set(r.x, r.y, r.z, r.w).multiply(TO_GAME);
    vel.set(lv.x, lv.y, lv.z);
    fwd.set(1, 0, 0).applyQuaternion(quat);
    up.set(0, 1, 0).applyQuaternion(quat);
    right.set(0, 0, 1).applyQuaternion(quat);
  }

  function readInput() {
    const on = state.occupied;
    const key = (list) => (input && on ? input.key(...list) : false);
    inp.throttle = on ? controls.throttle : 0;
    inp.brake = on ? controls.brake : 0;
    inp.steer = on ? controls.steer : 0;
    inp.park = !on || controls.handbrake;
    inp.boost = key(ROADSTER_KEYS.boost);
    inp.lift = key(ROADSTER_KEYS.lift);
    inp.descend = on ? key(ROADSTER_KEYS.descend) : true;
    inp.pitch = (key(ROADSTER_KEYS.pitchDown) ? 1 : 0) - (key(ROADSTER_KEYS.pitchUp) ? 1 : 0);
    inp.roll = (key(ROADSTER_KEYS.rollRight) ? 1 : 0) - (key(ROADSTER_KEYS.rollLeft) ? 1 : 0);
  }

  function substep(dt) {
    time += dt;
    readInput();
    if (sim.contacts === 0) {
      const at = body.translation();
      const lv = body.linvel();
      const ax = edgePush(at.x, lv.x);
      const az = edgePush(at.z, lv.z);
      if (ax || az) body.applyImpulse({ x: ax * sim.mass * dt, y: 0, z: az * sim.mass * dt }, true);
      if (at.y < WORLD.waterLevel - 60) sim.teleport([spawn.x, y0 + 0.4, spawn.z], spawn.yaw + Math.PI / 2);
    }
    sim.powerScale = (state.powerScale ?? 1) * (sim.waterDepth > 0.9 ? 0.2 : 1);
    sim.step(dt, inp);
    read();
    let skid = 0;
    sim.wheels.forEach((w, i) => {
      const o = wheels[i];
      o.contact = w.contact;
      o.surface = w.surface;
      o.surf = w.surf || SURFACES.asphalt;
      o.point.set(w.point.x, w.point.y, w.point.z);
      o.normal.set(w.normal.x, w.normal.y, w.normal.z);
      o.wet = w.contact && w.point.y < WORLD.waterLevel ? 1 : 0;
      o.load = w.load;
      o.slip = w.slip;
      o.skid = w.contact && w.slip > 0.32 && sim.speed > 1.5 ? Math.min(1, 0.25 + (w.slip - 0.32) * 0.7) : 0;
      skid = Math.max(skid, o.skid);
    });
    const th = sim.thrusters;
    let rear = 0;
    let lift = 0;
    let tot = 0;
    th.all.forEach((n, i) => {
      tot += n.valve;
      if (i < 4) rear += n.valve / 4;
      else lift += n.valve / 6;
    });
    const boosting = rear > 0.5;
    if (boosting && !wasBoost && state.occupied) state.kick = time;
    wasBoost = boosting;
    const air = sim.contacts === 0;
    if (air) airT += dt;
    else {
      if (airT > 0.4) state.landing = Math.min(1, Math.abs(prevVel.y) / 14);
      airT = 0;
    }
    state.landing = Math.max(0, state.landing - dt * 2);
    Object.assign(state, {
      throttle: inp.throttle, brake: sim.brakeOn && sim.speed > 0.3 ? 1 : inp.brake, steerInput: inp.steer, steer: sim.steerAngle * 0.95, reverse: sim.gear === 'R', rpm: Math.min(7000, sim.motorRpm * 0.32),
      speed: sim.speed, forwardSpeed: sim.fwdSpeed, airborne: air, onGround: sim.contacts, engineLoad: sim.load, skid, submersion: sim.submersion, waterDepth: sim.waterDepth, inWater: sim.submersion > 0.02,
      boost: rear, lift, thrust: tot / 10, flightMode: sim.flight.mode, airTime: airT,
    });
  }

  function sync() {
    if (input && state.occupied && input.hit && input.hit(ROADSTER_KEYS.assist[0])) {
      state.assist = !state.assist;
      sim.flight.assist = state.assist;
    }
    read();
    model.group.position.copy(pos);
    model.group.quaternion.copy(quat);
    model.applySim(sim);
    state.gForce.copy(vel).sub(prevVel);
    prevVel.copy(vel);
  }

  read();
  sync();
  return {
    body, sim, wheels, state, controls, colliders: sim.colliders, mass: sim.mass, keys: ROADSTER_KEYS,
    position: pos, quaternion: quat, velocity: vel, forward: fwd, up, right,
    setWater(w) {
      water = w;
    },
    substep,
    sync,
    reset() {
      const t = body.translation();
      const yaw = Math.atan2(-fwd.z, fwd.x);
      sim.teleport([t.x, Math.max(t.y, heightAt(t.x, t.z)) + 1.0, t.z], yaw + Math.PI / 2);
      read();
    },
    respawn() {
      sim.teleport([spawn.x, y0 + 0.4, spawn.z], spawn.yaw + Math.PI / 2);
      read();
    },
  };
}
