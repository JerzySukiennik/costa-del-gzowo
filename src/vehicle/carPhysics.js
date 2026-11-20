// Costa del Gzowo: vehicle dynamics (raycast suspension, combined-slip tyres, AWD drivetrain with automatic gearbox, brakes with ABS, aero, buoyancy).
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { GROUPS, groups } from '../core/physics.js';
import { GROUND } from '../world/terrain.js';
import { vnoise, heightAt, flowAt } from '../world/heightfield.js';
import { CAR } from './carBody.js';

const MASS = 1650;
const COM = { x: 0.1, y: 0.47, z: 0 };
const R = CAR.wheelRadius;
const RAY_Y = 0.75;
const GEARS = [4.71, 3.14, 2.11, 1.67, 1.29, 1.0, 0.84];
const FINAL = 3.31;
const REVERSE = -3.6;
const IDLE = 850;
const REDLINE = 6900;
const WHEEL_INERTIA = 1.7;

export const SURFACES = {
  asphalt: { mu: 1.06, peak: 1, roll: 0.013, bump: 0, loose: 0 },
  concrete: { mu: 1.0, peak: 1, roll: 0.014, bump: 0, loose: 0 },
  metal: { mu: 0.6, peak: 1, roll: 0.014, bump: 0, loose: 0 },
  wood: { mu: 0.7, peak: 1.1, roll: 0.02, bump: 0.01, loose: 0 },
  rock: { mu: 0.8, peak: 1.1, roll: 0.03, bump: 0.02, loose: 0 },
  grass: { mu: 0.56, peak: 1.6, roll: 0.06, bump: 0.018, loose: 0.5 },
  forest: { mu: 0.52, peak: 1.7, roll: 0.07, bump: 0.024, loose: 0.6 },
  mud: { mu: 0.43, peak: 2.0, roll: 0.12, bump: 0.02, loose: 0.8 },
  pebbles: { mu: 0.55, peak: 1.8, roll: 0.09, bump: 0.03, loose: 0.7 },
  sand: { mu: 0.5, peak: 2.0, roll: 0.16, bump: 0.012, loose: 1 },
  gravel: { mu: 0.66, peak: 1.5, roll: 0.035, bump: 0.012, loose: 0.9 },
  dirt: { mu: 0.62, peak: 1.5, roll: 0.045, bump: 0.02, loose: 0.8 },
};
export const GROUND_NAMES = { [GROUND.GRASS]: 'grass', [GROUND.FOREST]: 'forest', [GROUND.MUD]: 'mud', [GROUND.PEBBLES]: 'pebbles', [GROUND.SAND]: 'sand', [GROUND.GRAVEL]: 'gravel', [GROUND.DIRT]: 'dirt', [GROUND.ROCK]: 'rock' };

const TORQUE = [[800, 300], [1800, 500], [5000, 500], [6400, 410], [7200, 290]];
function torqueAt(rpm) {
  if (rpm <= TORQUE[0][0]) return TORQUE[0][1];
  for (let i = 0; i < TORQUE.length - 1; i++) {
    const a = TORQUE[i];
    const b = TORQUE[i + 1];
    if (rpm <= b[0]) return a[1] + ((b[1] - a[1]) * (rpm - a[0])) / (b[0] - a[0]);
  }
  return TORQUE[TORQUE.length - 1][1];
}
const grip = (s) => Math.sin(1.4 * Math.atan(2.08 * s));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function createCarPhysics({ physics, terrain, model, spawn }) {
  const RAP = physics.RAPIER;
  const world = physics.world;
  const y0 = heightAt(spawn.x, spawn.z) + 0.03;
  const startQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
  const body = world.createRigidBody(
    RAP.RigidBodyDesc.dynamic().setTranslation(spawn.x, y0, spawn.z).setRotation(startQuat).setAdditionalMassProperties(MASS, COM, { x: 640, y: 2750, z: 2550 }, { x: 0, y: 0, z: 0, w: 1 }).setLinearDamping(0.01).setAngularDamping(0.05).setCcdEnabled(true).setCanSleep(false),
  );
  const carGroups = groups(GROUPS.CAR, 0xffff);
  const mkCollider = (desc) => world.createCollider(desc.setDensity(0).setFriction(0.32).setRestitution(0.06).setCollisionGroups(carGroups).setActiveEvents(RAP.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(2500), body);
  const hull = mkCollider(RAP.ColliderDesc.roundCuboid(2.16, 0.2, 0.78, 0.1).setTranslation(-0.09, 0.56, 0));
  const cabin = mkCollider(RAP.ColliderDesc.roundCuboid(1.1, 0.07, 0.62, 0.08).setTranslation(-0.6, 0.9, 0));
  const screen = mkCollider(RAP.ColliderDesc.cuboid(0.05, 0.2, 0.58).setTranslation(0.62, 1.16, 0).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.05)));
  physics.surfaces.set(hull.handle, 'car');
  physics.surfaces.set(cabin.handle, 'car');
  physics.surfaces.set(screen.handle, 'car');

  const wheels = model.wheels.map((w) => {
    const front = w.front;
    const k = front ? 51000 : 55000;
    const staticLoad = (front ? 0.535 : 0.465) * MASS * 9.81 * 0.5;
    const cs = staticLoad / k;
    return {
      visual: w, front, side: w.side, lx: w.x, lz: w.z, k, damp: front ? 3900 : 3700, L0: RAY_Y - R + cs, cs, comp: cs, prevComp: cs, omega: 0, angle: 0,
      contact: false, load: staticLoad, slipRatio: 0, slipAngle: 0, slip: 0, surface: 'gravel', surf: SURFACES.gravel, wet: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), brakeHold: 1, skid: 0,
    };
  });

  const state = {
    throttle: 0, brake: 0, steerInput: 0, handbrake: 0, steer: 0, gear: 1, rpm: IDLE, speed: 0, forwardSpeed: 0, shifting: 0, engineOn: true, occupied: false,
    submersion: 0, flood: 0, stalled: false, airborne: false, onGround: 4, engineLoad: 0, waterDepth: 0, lastShift: 0, reverse: false, skid: 0, gForce: new THREE.Vector3(), inWater: false,
  };
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const vel = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const sideDir = new THREE.Vector3();
  const pointVel = new THREE.Vector3();
  const comWorld = new THREE.Vector3();
  const flow = { x: 0, y: 0 };
  const queryGroups = groups(0xffff, GROUPS.WORLD);
  const ray = new RAP.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const probes = [];
  for (const x of [-2.0, -0.7, 0.7, 2.0]) for (const z of [-0.62, 0.62]) probes.push({ x, z, front: x > 0 });
  let water = null;
  let prevVel = new THREE.Vector3();

  function readBody() {
    const t = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    const av = body.angvel();
    pos.set(t.x, t.y, t.z);
    quat.set(r.x, r.y, r.z, r.w);
    vel.set(lv.x, lv.y, lv.z);
    ang.set(av.x, av.y, av.z);
    fwd.set(1, 0, 0).applyQuaternion(quat);
    up.set(0, 1, 0).applyQuaternion(quat);
    right.set(0, 0, 1).applyQuaternion(quat);
    comWorld.set(COM.x, COM.y, COM.z).applyQuaternion(quat).add(pos);
  }

  function updateDrivetrain(dt) {
    const speedF = vel.dot(fwd);
    state.forwardSpeed = speedF;
    state.speed = vel.length();
    let throttle = controls.throttle;
    let brake = controls.brake;
    if (!state.occupied) {
      throttle = 0;
      brake = 0;
    }
    if (state.occupied) {
      if (state.reverse) {
        if (controls.throttle > 0.1 && speedF > -0.6) state.reverse = false;
      } else if (controls.brake > 0.1 && speedF < 0.6 && controls.throttle < 0.1) state.reverse = true;
      if (state.reverse) {
        throttle = controls.brake;
        brake = controls.throttle;
      }
    }
    if (state.stalled) throttle = 0;
    state.throttle += (throttle - state.throttle) * Math.min(1, dt * 9);
    state.brake += (brake - state.brake) * Math.min(1, dt * 14);
    state.handbrake = controls.handbrake || !state.occupied ? 1 : 0;
    const ratio = (state.reverse ? REVERSE : GEARS[state.gear - 1]) * FINAL;
    const driven = wheels.reduce((a, w) => a + w.omega, 0) / 4;
    const wheelRpm = Math.abs(driven * ratio) * 9.5493;
    const stall = IDLE + state.throttle * (state.gear === 1 || state.reverse ? 2300 : 600);
    const target = Math.max(wheelRpm, state.engineOn ? stall : 0);
    state.rpm += (target - state.rpm) * Math.min(1, dt * (target > state.rpm ? 9 : 5));
    state.rpm = clamp(state.rpm, state.engineOn ? IDLE * 0.9 : 0, 7300);
    state.lastShift += dt;
    if (state.shifting > 0) state.shifting -= dt;
    if (!state.reverse && state.shifting <= 0 && state.lastShift > 0.5) {
      const upAt = 2300 + state.throttle * 4300;
      const downAt = 1250 + state.throttle * 2300;
      if (wheelRpm > upAt && state.gear < GEARS.length && state.onGround >= 2) {
        state.gear++;
        state.shifting = 0.16;
        state.lastShift = 0;
      } else if (wheelRpm < downAt && state.gear > 1) {
        state.gear--;
        state.shifting = 0.12;
        state.lastShift = 0;
      }
    }
    if (state.reverse) state.gear = 1;
    let torque = 0;
    if (state.engineOn && !state.stalled) {
      if (state.throttle > 0.02) torque = torqueAt(state.rpm) * state.throttle * (state.rpm > REDLINE ? 0.05 : 1);
      else torque = wheelRpm > IDLE * 1.15 ? -(25 + state.rpm * 0.011) : 0;
      if (state.shifting > 0) torque *= 0.15;
    }
    const slipping = wheels.reduce((a, w) => Math.max(a, w.contact ? w.slipRatio : 0), 0);
    if (slipping > 0.24 && state.throttle > 0.2) torque *= clamp(1 - (slipping - 0.24) * 3.2, 0.25, 1);
    state.engineLoad = state.throttle;
    return torque * ratio * 0.9 * (state.powerScale ?? 1);
  }

  function substep(dt) {
    readBody();
    const driveTorque = updateDrivetrain(dt);
    const speedAbs = Math.abs(state.forwardSpeed);
    const maxSteer = THREE.MathUtils.lerp(0.6, 0.11, clamp(speedAbs / 42, 0, 1) ** 0.75);
    const steerTarget = (state.occupied ? controls.steer * maxSteer : 0) + (state.steerBias ?? 0);
    const rate = (Math.abs(steerTarget) > Math.abs(state.steer) ? 1.9 : 3.2) * (0.55 + 0.45 * maxSteer / 0.6);
    state.steer += clamp(steerTarget - state.steer, -rate * dt, rate * dt);
    let grounded = 0;
    let skid = 0;

    for (const w of wheels) {
      tmp.set(w.lx, RAY_Y, w.lz).applyQuaternion(quat).add(pos);
      ray.origin.x = tmp.x;
      ray.origin.y = tmp.y;
      ray.origin.z = tmp.z;
      ray.dir.x = -up.x;
      ray.dir.y = -up.y;
      ray.dir.z = -up.z;
      const maxDist = w.L0 + R;
      const hit = world.castRayAndGetNormal(ray, maxDist + 0.02, true, undefined, queryGroups, undefined, body);
      w.prevComp = w.comp;
      w.contact = false;
      if (hit) {
        let dist = hit.timeOfImpact ?? hit.toi;
        const px = tmp.x - up.x * dist;
        const pz = tmp.z - up.z * dist;
        let name = physics.surfaceOf(hit.collider);
        if (name === 'terrain') name = GROUND_NAMES[terrain.groundAt(px, pz)] || 'grass';
        const surf = SURFACES[name] || SURFACES.asphalt;
        if (surf.bump > 0) dist -= surf.bump * (vnoise(px * 2.3, pz * 2.3) + vnoise(px * 0.7 + 9, pz * 0.7) - 1);
        if (dist < maxDist) {
          w.contact = true;
          w.surface = name;
          w.surf = surf;
          w.comp = clamp(w.L0 - (dist - R), 0, w.cs + 0.11);
          w.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
          w.point.set(px, tmp.y - up.y * dist, pz);
        }
      }
      if (!w.contact) {
        w.comp = Math.max(0, w.comp - dt * 1.6);
        w.load = 0;
        w.slipRatio = 0;
        w.slip = 0;
      }
    }
    const rollFront = (wheels[0].comp - wheels[1].comp) * 15000;
    const rollRear = (wheels[2].comp - wheels[3].comp) * 9500;

    wheels.forEach((w, i) => {
      const steer = w.front ? state.steer : 0;
      const share = w.front ? 0.2 : 0.3;
      const brakeTorque = state.brake * (w.front ? 3300 : 1900) * w.brakeHold + (w.front ? 0 : state.handbrake * 4200);
      let fz = 0;
      if (w.contact) {
        const rate = (w.comp - w.prevComp) / dt;
        fz = w.k * w.comp + (rate > 0 ? w.damp : w.damp * 1.45) * rate;
        const over = w.comp - (w.cs + 0.085);
        if (over > 0) fz += over * 260000;
        const bar = i === 0 ? rollFront : i === 1 ? -rollFront : i === 2 ? rollRear : -rollRear;
        fz = clamp(fz + bar, 0, 42000);
        grounded++;
      }
      w.load = fz;
      if (!w.contact || fz <= 0) {
        const free = share * driveTorque - Math.sign(w.omega) * Math.min(Math.abs(w.omega) * WHEEL_INERTIA / dt, brakeTorque);
        w.omega += (free / WHEEL_INERTIA) * dt;
        w.omega *= 1 - 0.3 * dt;
        w.angle += w.omega * dt;
        return;
      }
      heading.copy(fwd).multiplyScalar(Math.cos(steer)).addScaledVector(right, -Math.sin(steer));
      heading.addScaledVector(w.normal, -heading.dot(w.normal)).normalize();
      sideDir.crossVectors(w.normal, heading);
      tmp2.copy(w.point).sub(comWorld);
      pointVel.copy(ang).cross(tmp2).add(vel);
      const vLong = pointVel.dot(heading);
      const vLat = pointVel.dot(sideDir);
      const wetFactor = w.point.y < WORLD.waterLevel ? 0.72 : 1;
      w.wet = wetFactor < 1 ? 1 : 0;
      const mu = w.surf.mu * wetFactor * (1 - 0.07 * clamp(fz / 4300 - 1, -1, 2));
      const kPeak = 0.11 * w.surf.peak;
      const aPeak = 0.145 * w.surf.peak;
      const vRef = Math.max(Math.abs(vLong), 2.6);
      const sy = vLat / vRef / aPeak;
      const sub = 6;
      const h = dt / sub;
      let fxSum = 0;
      let fySum = 0;
      for (let s = 0; s < sub; s++) {
        const kappa = (w.omega * R - vLong) / vRef;
        const sx = kappa / kPeak;
        const sigma = Math.hypot(sx, sy);
        const f = sigma > 1e-5 ? (mu * fz * grip(sigma)) / sigma : 0;
        const fx = f * sx;
        fxSum += fx;
        fySum += -f * sy;
        const rolling = -Math.sign(w.omega) * fz * R * (w.surf.roll + w.wet * 0.05) * Math.min(1, Math.abs(w.omega) * 0.5);
        let net = share * driveTorque - fx * R + rolling;
        const brakeMax = (Math.abs(w.omega) * WHEEL_INERTIA) / h + Math.abs(net);
        net -= Math.sign(w.omega || vLong) * Math.min(brakeTorque, brakeMax);
        const before = w.omega;
        w.omega += (net / WHEEL_INERTIA) * h;
        if (brakeTorque > 0 && before * w.omega < 0 && Math.abs(share * driveTorque) < brakeTorque) w.omega = 0;
        w.slipRatio = kappa;
      }
      const fx = fxSum / sub;
      const fy = fySum / sub;
      w.slipAngle = Math.atan2(vLat, Math.abs(vLong) + 0.5);
      w.slip = Math.hypot(w.slipRatio / kPeak, sy);
      if (state.brake > 0.05 && Math.abs(vLong) > 3) w.brakeHold = clamp(w.brakeHold + (w.slipRatio < -0.2 ? -9 : 5) * dt, 0.15, 1);
      else w.brakeHold = 1;
      w.angle += w.omega * dt;
      const speedSlide = Math.hypot(w.omega * R - vLong, vLat);
      w.skid = clamp((w.slip - 1.1) * 0.7, 0, 1) * clamp(speedSlide / 4, 0, 1);
      skid = Math.max(skid, w.skid);
      tmp3.copy(w.normal).multiplyScalar(fz).addScaledVector(heading, fx).addScaledVector(sideDir, fy).multiplyScalar(dt);
      tmp.copy(w.point).addScaledVector(up, 0.06);
      body.applyImpulseAtPoint(tmp3, tmp, true);
    });
    state.onGround = grounded;
    state.airborne = grounded === 0;
    state.skid = skid;

    const v2 = vel.length();
    if (v2 > 0.1) {
      tmp.copy(vel).multiplyScalar(-0.5 * 1.2 * 0.68 * v2 * dt);
      body.applyImpulse(tmp, true);
      if (grounded > 0) body.applyImpulse(tmp.copy(up).multiplyScalar(-0.5 * 1.2 * 0.35 * v2 * v2 * dt), true);
    }

    let submerged = 0;
    let maxDepth = 0;
    for (const p of probes) {
      tmp.set(p.x, 0.22, p.z).applyQuaternion(quat).add(pos);
      if (heightAt(tmp.x, tmp.z) > WORLD.waterLevel - 0.05) continue;
      const level = water ? water.getHeightAt(tmp.x, tmp.z) : WORLD.waterLevel;
      const depth = level - tmp.y;
      if (depth <= 0) continue;
      const frac = clamp(depth / 1.0, 0, 1);
      submerged += frac / probes.length;
      maxDepth = Math.max(maxDepth, depth);
      const floodHere = clamp(state.flood * (p.front ? 1.35 : 0.85), 0, 1);
      const volume = (9.4 / probes.length) * frac * (0.36 - 0.29 * floodHere);
      tmp2.copy(ang).cross(tmp3.copy(tmp).sub(comWorld)).add(vel);
      flowAt(tmp.x, tmp.z, flow);
      tmp2.x -= flow.x;
      tmp2.z -= flow.y;
      const drag = 260 * frac;
      const quad = 190 * frac * tmp2.length();
      tmp3.set(-tmp2.x * (drag + quad), 1000 * 9.81 * volume - tmp2.y * (drag * 2.2 + quad * 2), -tmp2.z * (drag + quad)).multiplyScalar(dt);
      body.applyImpulseAtPoint(tmp3, tmp, true);
    }
    state.submersion = submerged;
    state.waterDepth = maxDepth;
    state.inWater = submerged > 0.02;
    if (submerged > 0.25) {
      state.flood = Math.min(1, state.flood + dt * (0.012 + submerged * 0.05 + (model.roof.value > 0.5 && maxDepth > 0.75 ? 0.25 : 0)));
      body.applyTorqueImpulse(tmp.copy(ang).multiplyScalar(-submerged * 900 * dt), true);
    } else if (submerged < 0.02) state.flood = Math.max(0, state.flood - dt * 0.05);
    if (maxDepth > 0.95 && submerged > 0.5) state.stalled = true;
  }

  function sync() {
    const t = body.translation();
    const r = body.rotation();
    model.group.position.set(t.x, t.y, t.z);
    model.group.quaternion.set(r.x, r.y, r.z, r.w);
    for (const w of wheels) {
      w.visual.group.position.y = RAY_Y - w.L0 + w.comp;
      w.visual.group.rotation.y = w.front ? state.steer : 0;
      w.visual.spin.rotation.z = (w.side > 0 ? -1 : 1) * w.angle;
    }
    model.steeringWheel.rotation.z = state.steer * 7.5;
    const lv = body.linvel();
    state.gForce.set(lv.x - prevVel.x, lv.y - prevVel.y, lv.z - prevVel.z);
    prevVel.set(lv.x, lv.y, lv.z);
  }

  return {
    body, hull, cabin, wheels, state, controls, colliders: [hull, cabin, screen], mass: MASS,
    setWater(w) {
      water = w;
    },
    substep,
    sync,
    position: pos,
    quaternion: quat,
    velocity: vel,
    forward: fwd,
    up,
    right,
    reset() {
      const t = body.translation();
      const yaw = Math.atan2(-fwd.z, fwd.x);
      const ground = Math.max(heightAt(t.x, t.z), physics.world ? -100 : 0);
      body.setTranslation({ x: t.x, y: Math.max(t.y, ground) + 1.0, z: t.z }, true);
      body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      state.stalled = false;
      state.flood = 0;
    },
    respawn() {
      body.setTranslation({ x: spawn.x, y: y0 + 0.4, z: spawn.z }, true);
      body.setRotation(startQuat, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      state.stalled = false;
      state.flood = 0;
    },
  };
}
