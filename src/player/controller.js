// Costa del Gzowo: on-foot player controller (kinematic capsule with walking, sprinting, jumping, wading, swimming and climbing out of the water).
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { GROUPS, groups } from '../core/physics.js';
import { heightAt, flowAt } from '../world/heightfield.js';

const HALF = 0.58;
const RADIUS = 0.3;
const FEET = HALF + RADIUS;

export function createPlayer({ physics, character, spawn }) {
  const R = physics.RAPIER;
  const world = physics.world;
  const startY = heightAt(spawn.x, spawn.z) + FEET + 0.05;
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, startY, spawn.z));
  const solidGroups = groups(GROUPS.PLAYER, GROUPS.WORLD | GROUPS.PROP);
  const collider = world.createCollider(R.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(solidGroups).setFriction(0), body);
  physics.surfaces.set(collider.handle, 'player');
  const controller = world.createCharacterController(0.03);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setMaxSlopeClimbAngle(0.92);
  controller.setMinSlopeSlideAngle(0.8);
  controller.enableAutostep(0.4, 0.18, true);
  controller.enableSnapToGround(0.35);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(78);
  const moveGroups = groups(GROUPS.PLAYER, GROUPS.WORLD | GROUPS.PROP | GROUPS.CAR);

  const state = {
    mode: 'foot', position: new THREE.Vector3(spawn.x, startY - FEET, spawn.z), velocity: new THREE.Vector3(), yaw: spawn.yaw, grounded: true, vy: 0, speed: 0,
    depth: 0, wade: 0, inWater: false, headUnder: false, surface: 'gravel', fallStart: startY, justLanded: 0, stepPhase: 0, enabled: true, swimLift: 0, climb: 0,
  };
  const move = new THREE.Vector3();
  const flow = { x: 0, y: 0 };
  const events = [];
  let prevDepth = 0;
  let airTime = 0;
  let climb = null;
  const ease = (x) => x * x * (3 - 2 * x);

  function climbStep(dt, water) {
    climb.t = Math.min(1, climb.t + dt / climb.time);
    const rise = ease(Math.min(1, climb.t / 0.64));
    const reach = ease(Math.max(0, (climb.t - 0.42) / 0.58));
    const x = climb.x0 + (climb.x1 - climb.x0) * reach;
    const z = climb.z0 + (climb.z1 - climb.z0) * reach;
    const y = climb.y0 + (climb.y1 - climb.y0) * rise;
    const level = water ? water.getHeightAt(x, z) : WORLD.waterLevel;
    body.setNextKinematicTranslation({ x, y: y + FEET, z });
    state.position.set(x, y, z);
    state.velocity.set(0, 0, 0);
    state.vy = 0;
    state.speed = reach > 0 && reach < 1 ? 1.4 : 0;
    state.depth = Math.max(0, level - y);
    state.inWater = state.depth > 0.05 && reach < 0.2;
    state.wade = Math.min(1, state.depth / 1.2) * (1 - reach);
    state.headUnder = false;
    state.climb = climb.t;
    prevDepth = state.depth;
    airTime = 0;
    if (climb.t >= 1) {
      climb = null;
      state.climb = 0;
      state.grounded = true;
    }
  }

  function fixedUpdate(dt, input, water) {
    if (!state.enabled) return;
    if (climb) {
      climbStep(dt, water);
      return;
    }
    const t = body.translation();
    const feetY = t.y - FEET;
    const level = water ? water.getHeightAt(t.x, t.z) : WORLD.waterLevel;
    const overWater = heightAt(t.x, t.z) < level - 0.03;
    const depth = overWater ? Math.max(0, level - feetY) : 0;
    state.depth = depth;
    state.inWater = depth > 0.05;
    state.wade = Math.min(1, depth / 1.2);
    state.headUnder = depth > 1.72;
    if (prevDepth <= 0.05 && depth > 0.05 && state.vy < -1.5) events.push({ type: 'splash', x: t.x, y: level, z: t.z, vx: state.velocity.x, vy: state.vy, vz: state.velocity.z });
    prevDepth = depth;
    if (state.mode === 'foot' && depth > 1.28) state.mode = 'swim';
    else if (state.mode === 'swim' && depth < 1.05) state.mode = 'foot';

    move.set(input.x, 0, input.z);
    const moving = move.lengthSq() > 0.0001;
    if (moving) move.normalize();
    const v = state.velocity;
    if (state.mode === 'swim') {
      const top = input.sprint ? 2.5 : 1.55;
      flowAt(t.x, t.z, flow);
      const k = Math.min(1, dt * 3.2);
      v.x += (move.x * top + flow.x * 0.8 - v.x) * k;
      v.z += (move.z * top + flow.y * 0.8 - v.z) * k;
      const centerTarget = level - 0.54;
      state.vy += ((centerTarget - t.y) * 16 - state.vy * 5.5) * dt;
      state.vy = Math.max(state.vy, -9);
      state.grounded = false;
      airTime = 0;
    } else {
      const top = (input.sprint ? 6.1 : 3.3) * (1 - 0.6 * state.wade);
      const accel = state.grounded ? 30 : 5;
      const k = Math.min(1, dt * accel / Math.max(top, 1));
      v.x += (move.x * top - v.x) * (moving ? k : Math.min(1, dt * (state.grounded ? 14 : 1)));
      v.z += (move.z * top - v.z) * (moving ? k : Math.min(1, dt * (state.grounded ? 14 : 1)));
      if (state.grounded) {
        if (input.jump && depth < 0.9) {
          state.vy = 4.9;
          state.grounded = false;
          events.push({ type: 'jump' });
        } else state.vy = Math.max(state.vy, -1.5);
      }
      state.vy -= 9.81 * 1.35 * dt;
      if (depth > 0.3 && state.vy < 0) state.vy *= 1 - Math.min(1, dt * 4 * state.wade);
      state.vy = Math.max(state.vy, -40);
    }
    controller.computeColliderMovement(collider, { x: v.x * dt, y: state.vy * dt, z: v.z * dt }, undefined, moveGroups);
    const m = controller.computedMovement();
    const wasGrounded = state.grounded;
    if (state.mode === 'foot') {
      state.grounded = controller.computedGrounded();
      if (state.grounded) {
        if (!wasGrounded && airTime > 0.25) events.push({ type: 'land', speed: -state.vy });
        airTime = 0;
        if (state.vy < 0) state.vy = 0;
      } else airTime += dt;
    } else if (Math.abs(m.y - state.vy * dt) > 0.002 && state.vy < 0) state.vy = 0;
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    state.position.set(t.x + m.x, t.y + m.y - FEET, t.z + m.z);
    state.speed = Math.hypot(m.x, m.z) / dt;
    if (moving) {
      const want = Math.atan2(move.x, move.z);
      let diff = want - state.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      state.yaw += diff * Math.min(1, dt * 11);
    }
    state.airTime = airTime;
  }

  function sync(dt, driveInfo) {
    if (state.mode === 'car') {
      character.update(dt, { mode: 'sit', steer: driveInfo.steer, throttle: driveInfo.throttle });
      return;
    }
    const swimMoving = state.mode === 'swim' && state.speed > 0.3;
    state.swimLift += ((swimMoving ? 0.2 : state.mode === 'swim' ? 0.0 : 0) - state.swimLift) * Math.min(1, dt * 5);
    character.group.position.set(state.position.x, state.position.y + state.swimLift, state.position.z);
    character.group.rotation.set(0, state.yaw, 0);
    const rising = climb && climb.t < 0.5;
    const mode = rising ? 'air' : state.mode === 'swim' ? 'swim' : state.grounded || airTime < 0.12 ? 'foot' : 'air';
    const heading = state.speed > 0.3 && !climb ? Math.atan2(state.velocity.x, state.velocity.z) : state.yaw;
    character.update(dt, { mode, speed: state.speed, vy: rising ? 1.6 : state.vy, wade: state.wade, heading });
  }

  return {
    body, collider, state, events, fixedUpdate, sync,
    teleport(x, y, z, yaw) {
      body.setTranslation({ x, y: y + FEET, z }, true);
      body.setNextKinematicTranslation({ x, y: y + FEET, z });
      state.position.set(x, y, z);
      state.velocity.set(0, 0, 0);
      state.vy = 0;
      if (yaw !== undefined) state.yaw = yaw;
    },
    climbTo(x, y, z, yaw, time = 1.1) {
      if (climb || !state.enabled) return false;
      climb = { t: 0, time, x0: state.position.x, y0: state.position.y, z0: state.position.z, x1: x, y1: y + 0.02, z1: z };
      state.mode = 'foot';
      state.grounded = false;
      state.yaw = yaw;
      state.climb = 0.001;
      return true;
    },
    setEnabled(on) {
      if (!on) {
        climb = null;
        state.climb = 0;
      }
      state.enabled = on;
      collider.setEnabled(on);
    },
    center(out) {
      return out.set(state.position.x, state.position.y + FEET, state.position.z);
    },
  };
}
