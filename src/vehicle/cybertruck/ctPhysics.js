// Costa del Gzowo Cyber Truck: dynamics (raycast air suspension with three ride heights, combined-slip all-terrain tyres, tri-motor drive with torque vectoring and regeneration, ABS brakes, speed-dependent steer-by-wire with four-wheel steering, pivot and drift control, aero, buoyancy).
import * as THREE from 'three';
import { WORLD } from '../../config.js';
import { GROUPS, groups } from '../../core/physics.js';
import { vnoise, heightAt, flowAt } from '../../world/heightfield.js';
import { SURFACES, GROUND_NAMES } from '../carPhysics.js';
import { CT } from './ctShape.js';

export const TUNE = {
  mass: 3100,
  com: { x: 0.04, y: 0.6, z: 0 },
  inertia: { x: 1650, y: 7600, z: 7300 },
  rayY: 1.02,
  power: 900000,
  topSpeed: 58.4,
  reverseSpeed: 11,
  torqueFront: 3900,
  torqueRear: 5300,
  brakeFront: 6200,
  brakeRear: 4600,
  regen: 0.3,
  grip: 1.25,
  steerMax: 0.72,
  steerHigh: 0.075,
  rearCounter: 0.7,
  rearMax: 0.5,
  rearInPhase: 0.16,
  spring: 61000,
  damp: 4300,
  pivotRate: 2.3,
  pivotTorque: 5200,
  dragArea: 1.05,
};

export const RIDE = {
  low: { lift: -0.075, k: 1.08, travel: 0.1 },
  normal: { lift: 0, k: 1, travel: 0.13 },
  offroad: { lift: 0.13, k: 0.74, travel: 0.2 },
};
const ORDER = ['normal', 'offroad', 'low'];
const R = CT.wheelRadius;
const WHEEL_INERTIA = 2.6;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const grip = (s) => Math.sin(1.4 * Math.atan(2.08 * s));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hullPoints() {
  const pts = [];
  const add = (x, y, z) => pts.push(x, y, z, x, y, -z);
  add(2.84, 1.0, 0.86);
  add(2.84, 0.96, 0.97);
  add(2.8, 0.42, 0.96);
  add(2.02, 1.27, 0.8);
  add(0.45, 1.76, 0.63);
  add(-1.06, 1.54, 0.66);
  add(-2.84, 1.28, 0.82);
  add(-2.84, 1.2, 0.97);
  add(-2.84, 0.42, 0.96);
  add(1.2, 0.36, 0.95);
  add(-1.2, 0.36, 0.95);
  add(0.4, 1.2, 0.98);
  return new Float32Array(pts);
}

export function createTruckPhysics({ physics, terrain, model, spawn }) {
  const RAP = physics.RAPIER;
  const world = physics.world;
  const MASS = TUNE.mass;
  const COM = TUNE.com;
  const y0 = heightAt(spawn.x, spawn.z) + 0.05;
  const startQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
  const body = world.createRigidBody(
    RAP.RigidBodyDesc.dynamic().setTranslation(spawn.x, y0, spawn.z).setRotation(startQuat).setAdditionalMassProperties(MASS, COM, TUNE.inertia, { x: 0, y: 0, z: 0, w: 1 }).setLinearDamping(0.01).setAngularDamping(0.05).setCcdEnabled(true).setCanSleep(false),
  );
  const carGroups = groups(GROUPS.CAR, 0xffff);
  const mk = (desc) => world.createCollider(desc.setDensity(0).setFriction(0.32).setRestitution(0.05).setCollisionGroups(carGroups).setActiveEvents(RAP.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(4500), body);
  const hullDesc = RAP.ColliderDesc.convexHull(hullPoints()) || RAP.ColliderDesc.roundCuboid(2.78, 0.36, 0.94, 0.04).setTranslation(0, 0.84, 0);
  const hull = mk(hullDesc);
  physics.surfaces.set(hull.handle, 'car');
  const colliders = [hull];

  const wheels = model.wheels.map((w) => {
    const front = w.front;
    const staticLoad = (front ? 0.505 : 0.495) * MASS * 9.81 * 0.5;
    const cs = staticLoad / TUNE.spring;
    return {
      visual: w, front, side: w.side, lx: w.x, lz: w.z, k: TUNE.spring, damp: TUNE.damp, staticLoad, L0: TUNE.rayY - R + cs, cs, comp: cs, prevComp: cs, omega: 0, angle: 0, steer: 0, drive: 0,
      contact: false, load: staticLoad, slipRatio: 0, slipAngle: 0, slip: 0, surface: 'gravel', surf: SURFACES.gravel, wet: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), brakeHold: 1, skid: 0, gone: false, camber: 0, toe: 0,
    };
  });

  const state = {
    throttle: 0, brake: 0, steerInput: 0, handbrake: 0, steer: 0, rearSteer: 0, gear: 1, rpm: 0, speed: 0, forwardSpeed: 0, shifting: 0, engineOn: false, electric: true, occupied: false,
    submersion: 0, flood: 0, stalled: false, airborne: false, onGround: 4, engineLoad: 0, waterDepth: 0, reverse: false, skid: 0, gForce: new THREE.Vector3(), inWater: false,
    ride: 'normal', rideTarget: 'normal', lift: 0, liftTarget: 0, lifting: 0, regen: 0, power: 0, drifting: false, pivot: 0, used: 0, kick: 0, landing: 0, readout: 'D', fx: 1, fz: 0, yawRate: 0,
  };
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const camera = { distance: 7.6, height: 1.6, ahead: 2.4, pitch: 0.17, fov: 72, cockpit: false, eye: new THREE.Vector3(), dir: new THREE.Vector3() };

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
  for (const x of [-2.4, -0.8, 0.8, 2.4]) for (const z of [-0.8, 0.8]) probes.push({ x, z, front: x > 0 });
  const prevVel = new THREE.Vector3();
  let water = null;
  let time = 0;
  let airT = 0;
  let launchArmed = true;
  let travel = RIDE.normal.travel;
  let kScale = 1;

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

  function updateRide(dt) {
    const speed = state.speed;
    let mode = state.rideTarget;
    if (mode === 'offroad' && speed > 22) mode = 'normal';
    const cfg = RIDE[mode];
    let target = cfg.lift;
    if (mode === 'normal' && speed > 25) target = RIDE.low.lift * 0.7;
    if (!state.occupied && speed < 0.5 && mode !== 'offroad') target = RIDE.low.lift;
    state.ride = mode;
    state.liftTarget = target;
    const diff = target - state.lift;
    const rate = diff > 0 ? 0.06 : 0.085;
    state.lifting = Math.abs(diff) > 0.002 ? Math.sign(diff) : 0;
    state.lift += clamp(diff, -rate * dt, rate * dt);
    kScale += (cfg.k - kScale) * Math.min(1, dt * 1.5);
    travel += (cfg.travel - travel) * Math.min(1, dt * 1.5);
    for (const w of wheels) {
      w.k = TUNE.spring * kScale;
      w.damp = TUNE.damp * (0.75 + 0.25 * kScale);
      w.cs = w.staticLoad / w.k;
      w.L0 = TUNE.rayY - R + w.cs + state.lift;
    }
  }

  function updateSteering(dt) {
    const v = Math.abs(state.forwardSpeed);
    const input = state.occupied ? controls.steer : 0;
    const k = smooth(0, 42, v) ** 0.7;
    const maxFront = THREE.MathUtils.lerp(TUNE.steerMax, TUNE.steerHigh, k);
    const pivoting = state.pivot > 0.05;
    const target = input * (pivoting ? TUNE.steerMax * (1 - 0.6 * (state.nose || 0)) : maxFront) + (state.steerBias ?? 0);
    const rate = (Math.abs(target) > Math.abs(state.steer) ? 4.2 : 5.5) * (0.45 + 0.55 * (1 - k));
    state.steer += clamp(target - state.steer, -rate * dt, rate * dt);
    let rear;
    if (pivoting) rear = -input * TUNE.rearMax * (1 - 0.5 * (state.nose || 0));
    else {
      const counter = 1 - smooth(4, 17, v);
      const phase = smooth(19, 30, v);
      rear = -state.steer * TUNE.rearCounter * counter + state.steer * TUNE.rearInPhase * phase;
      if (state.drifting) rear -= input * 0.22 * (1 - smooth(25, 40, v));
      rear = clamp(rear, -TUNE.rearMax, TUNE.rearMax);
    }
    state.rearSteer += clamp(rear - state.rearSteer, -3.5 * dt, 3.5 * dt);
  }

  function updateDrive(dt) {
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
    if (throttle > 0.5 && launchArmed && state.speed < 2.5 && !state.reverse) {
      state.kick = time;
      launchArmed = false;
    }
    if (throttle < 0.1) launchArmed = true;
    state.throttle += (throttle - state.throttle) * Math.min(1, dt * 14);
    state.brake += (brake - state.brake) * Math.min(1, dt * 16);
    state.handbrake = state.occupied ? (controls.handbrake ? 1 : 0) : 1;
    const steerIn = state.occupied ? controls.steer : 0;
    const slow = Math.abs(speedF) < 5.5;
    const wantPivot = state.occupied && controls.handbrake && slow && Math.abs(steerIn) > 0.1 && !state.stalled;
    state.pivot += ((wantPivot ? 1 : 0) - state.pivot) * Math.min(1, dt * 6);
    state.drifting = state.occupied && controls.handbrake && !slow && !state.stalled;
  }

  function wheelTorques(dt) {
    const v = Math.abs(state.forwardSpeed);
    const scale = state.powerScale ?? 1;
    const dir = state.reverse ? -1 : 1;
    let force = Math.min((TUNE.torqueFront * 2 + TUNE.torqueRear * 2) / R, TUNE.power / Math.max(v, 1));
    const top = state.reverse ? TUNE.reverseSpeed : TUNE.topSpeed;
    force *= 1 - smooth(top - 2, top, v);
    const want = state.throttle * force * scale;
    const frontShare = state.drifting ? 0.18 : 0.42;
    const front = Math.min(want * frontShare * R / 2, TUNE.torqueFront);
    const rear = Math.min(want * (1 - frontShare) * R / 2, TUNE.torqueRear * (state.drifting ? 1.25 : 1));
    state.power = clamp((want * Math.max(v, 1)) / TUNE.power, 0, 1);
    state.rpm = 300 + state.power * 6900;
    state.engineLoad = state.throttle;
    const regen = state.occupied && state.throttle < 0.05 && v > 1.2 && !state.reverse && state.brake < 0.05 ? TUNE.regen * smooth(1.2, 6, v) : 0;
    state.regen += (regen / TUNE.regen - state.regen) * Math.min(1, dt * 6);
    const regenTorque = regen * MASS * 9.81 * R / 4;
    const steerIn = state.occupied ? controls.steer : 0;
    const pivot = state.pivot;
    const sgn = Math.sign(steerIn) || 1;
    const err = (steerIn * TUNE.pivotRate - state.yawRate) * sgn;
    const tv = TUNE.pivotTorque * clamp(0.45 + 0.9 * err, 0, 1.2) * pivot * Math.min(1, Math.abs(steerIn) * 1.5);
    const nose = pivot * state.throttle;
    state.nose = nose;
    for (const w of wheels) {
      let t = (w.front ? front : rear) * dir;
      t *= 1 - pivot;
      if (pivot > 0) {
        const outer = w.side * sgn;
        t += outer * tv * (1 - nose) + (w.front ? 0 : nose * TUNE.torqueRear * 0.9);
        if (Math.abs(w.omega) > 26 && Math.sign(w.omega) === Math.sign(t)) t *= 0.2;
      }
      if (state.drifting && w.front) t *= 0.6;
      w.drive = t;
      w.regen = regenTorque;
    }
  }

  function substep(dt) {
    time += dt;
    readBody();
    state.fx = fwd.x;
    state.fz = fwd.z;
    state.yawRate = ang.dot(up);
    updateDrive(dt);
    updateRide(dt);
    updateSteering(dt);
    wheelTorques(dt);
    let grounded = 0;
    let skid = 0;
    const tcOn = !state.drifting && state.pivot < 0.05;

    for (const w of wheels) {
      if (w.gone) {
        w.prevComp = 0;
        w.comp = 0;
        w.contact = false;
        w.load = 0;
        w.slipRatio = 0;
        w.slip = 0;
        continue;
      }
      tmp.set(w.lx, TUNE.rayY, w.lz).applyQuaternion(quat).add(pos);
      ray.origin.x = tmp.x;
      ray.origin.y = tmp.y;
      ray.origin.z = tmp.z;
      ray.dir.x = -up.x;
      ray.dir.y = -up.y;
      ray.dir.z = -up.z;
      const maxDist = w.L0 + R + (travel - 0.13);
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
        if (surf.bump > 0) dist -= surf.bump * (vnoise(px * 2.3, pz * 2.3) + vnoise(px * 0.7 + 9, pz * 0.7) - 1) * (state.ride === 'offroad' ? 0.6 : 1);
        if (dist < maxDist) {
          w.contact = true;
          w.surface = name;
          w.surf = surf;
          w.comp = clamp(w.L0 - (dist - R), -(travel - 0.13), w.cs + travel);
          w.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
          w.point.set(px, tmp.y - up.y * dist, pz);
        }
      }
      if (!w.contact) {
        w.comp = Math.max(-(travel - 0.13), w.comp - dt * 1.6);
        w.load = 0;
        w.slipRatio = 0;
        w.slip = 0;
      }
    }
    const rollFront = (wheels[0].comp - wheels[1].comp) * 26000 * kScale;
    const rollRear = (wheels[2].comp - wheels[3].comp) * 21000 * kScale;
    const looseBonus = state.ride === 'offroad' ? 1.12 : 1.04;

    wheels.forEach((w, i) => {
      const steer = w.front ? state.steer : state.rearSteer;
      w.steer = steer;
      const hold = state.occupied && state.throttle < 0.05 && state.brake < 0.05 && state.speed < 0.6 && !state.reverse ? 4000 : 0;
      const hb = Math.max(hold, state.handbrake * (state.drifting ? 1500 : state.pivot > 0.05 ? 0 : 5200));
      const brakeTorque = state.brake * (w.front ? TUNE.brakeFront : TUNE.brakeRear) * w.brakeHold + (w.front ? 0 : hb) + (w.regen || 0);
      let fz = 0;
      if (w.contact) {
        const rate = (w.comp - w.prevComp) / dt;
        fz = w.k * Math.max(0, w.comp) + (rate > 0 ? w.damp : w.damp * 1.4) * rate;
        const over = w.comp - (w.cs + travel - 0.025);
        if (over > 0) fz += over * 420000;
        const bar = i === 0 ? rollFront : i === 1 ? -rollFront : i === 2 ? rollRear : -rollRear;
        fz = clamp(fz + bar, 0, 70000);
        grounded++;
      }
      w.load = fz;
      if (!w.contact || fz <= 0) {
        const free = w.drive - Math.sign(w.omega) * Math.min(Math.abs(w.omega) * WHEEL_INERTIA / dt, brakeTorque);
        w.omega += (free / WHEEL_INERTIA) * dt;
        w.omega *= 1 - 0.3 * dt;
        w.angle += w.omega * dt;
        w.skid = 0;
        return;
      }
      heading.copy(fwd).multiplyScalar(Math.cos(steer)).addScaledVector(right, -Math.sin(steer));
      heading.addScaledVector(w.normal, -heading.dot(w.normal)).normalize();
      sideDir.crossVectors(w.normal, heading);
      tmp2.copy(w.point).sub(comWorld);
      pointVel.copy(ang).cross(tmp2).add(vel);
      const vLong = pointVel.dot(heading);
      const vLat = pointVel.dot(sideDir);
      const wetFactor = w.point.y < WORLD.waterLevel ? 0.75 : 1;
      w.wet = wetFactor < 1 ? 1 : 0;
      const loose = w.surf.loose > 0.3 ? looseBonus : 1;
      const mu = w.surf.mu * TUNE.grip * loose * wetFactor * (1 - 0.06 * clamp(fz / 7600 - 1, -1, 2));
      const latMu = !w.front && (state.drifting || state.nose > 0.3) ? 0.6 : 1;
      const kPeak = 0.12 * w.surf.peak;
      const aPeak = 0.13 * w.surf.peak;
      const vRef = Math.max(Math.abs(vLong), 2.6);
      const sy = vLat / vRef / aPeak;
      let drive = w.drive;
      if (tcOn && state.throttle > 0.1 && w.slipRatio * Math.sign(drive) > kPeak * 1.2) drive *= clamp(1 - (w.slipRatio * Math.sign(drive) - kPeak * 1.2) * 6, 0.2, 1);
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
        fySum += -f * sy * latMu;
        const rolling = -Math.sign(w.omega) * fz * R * (w.surf.roll + w.wet * 0.05) * Math.min(1, Math.abs(w.omega) * 0.5);
        let net = drive - fx * R + rolling;
        const brakeMax = (Math.abs(w.omega) * WHEEL_INERTIA) / h + Math.abs(net);
        net -= Math.sign(w.omega || vLong) * Math.min(brakeTorque, brakeMax);
        const before = w.omega;
        w.omega += (net / WHEEL_INERTIA) * h;
        if (brakeTorque > 0 && before * w.omega < 0 && Math.abs(drive) < brakeTorque) w.omega = 0;
        w.slipRatio = kappa;
      }
      const fx = fxSum / sub;
      const fy = fySum / sub;
      w.slipAngle = Math.atan2(vLat, Math.abs(vLong) + 0.5);
      w.slip = Math.hypot(w.slipRatio / kPeak, sy);
      if (state.brake > 0.05 && Math.abs(vLong) > 2.5) w.brakeHold = clamp(w.brakeHold + (w.slipRatio < -kPeak * 1.3 ? -11 : 6) * dt, 0.2, 1);
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
    if (grounded === 0) airT += dt;
    else {
      if (airT > 0.35) state.landing = Math.min(1, Math.abs(prevVel.y) / 6);
      airT = 0;
    }
    state.landing = Math.max(0, state.landing - dt * 2);
    state.airborne = grounded === 0;
    state.skid = skid;

    if (grounded >= 2 && state.nose > 0.05) {
      const steerIn = controls.steer;
      const yawT = clamp((steerIn * 2.1 - state.yawRate) * TUNE.inertia.y * 5, -32000, 32000) * state.nose;
      body.applyTorqueImpulse(tmp.copy(up).multiplyScalar(yawT * dt), true);
    }
    if (grounded >= 2 && state.pivot > 0.05) {
      const anchor = tmp.set(state.throttle > 0.1 ? CT.axleFront : COM.x, COM.y, 0).applyQuaternion(quat).add(pos);
      tmp2.copy(anchor).sub(comWorld);
      pointVel.copy(ang).cross(tmp2).add(vel);
      pointVel.addScaledVector(up, -pointVel.dot(up));
      const cap = 0.42 * MASS * 9.81 * state.pivot;
      tmp3.copy(pointVel).multiplyScalar(-MASS * 3.2);
      if (tmp3.length() > cap) tmp3.setLength(cap);
      body.applyImpulseAtPoint(tmp3.multiplyScalar(dt), anchor, true);
    }
    if (grounded >= 2 && state.drifting) {
      const vPlanar = Math.hypot(vel.x, vel.z);
      if (vPlanar > 4) {
        const beta = Math.atan2(vel.dot(right), Math.max(0.5, Math.abs(vel.dot(fwd))));
        const over = Math.abs(beta) - 0.85;
        if (over > 0) body.applyTorqueImpulse(tmp.copy(up).multiplyScalar(-state.yawRate * TUNE.inertia.y * Math.min(1, over * 3) * 2.2 * dt), true);
      }
    }

    const v2 = vel.length();
    if (v2 > 0.1) {
      tmp.copy(vel).multiplyScalar(-0.5 * 1.2 * TUNE.dragArea * v2 * dt);
      body.applyImpulse(tmp, true);
    }
    if (state.occupied && state.throttle > 0.02) state.used += state.power * dt * 0.06;

    let submerged = 0;
    let maxDepth = 0;
    for (const p of probes) {
      tmp.set(p.x, 0.3, p.z).applyQuaternion(quat).add(pos);
      if (heightAt(tmp.x, tmp.z) > WORLD.waterLevel - 0.05) continue;
      const level = water ? water.getHeightAt(tmp.x, tmp.z) : WORLD.waterLevel;
      const depth = level - tmp.y;
      if (depth <= 0) continue;
      const frac = clamp(depth / 1.1, 0, 1);
      submerged += frac / probes.length;
      maxDepth = Math.max(maxDepth, depth);
      const floodHere = clamp(state.flood * (p.front ? 1.2 : 0.9), 0, 1);
      const volume = (13 / probes.length) * frac * (0.36 - 0.26 * floodHere);
      tmp2.copy(ang).cross(tmp3.copy(tmp).sub(comWorld)).add(vel);
      flowAt(tmp.x, tmp.z, flow);
      tmp2.x -= flow.x;
      tmp2.z -= flow.y;
      const drag = 380 * frac;
      const quad = 260 * frac * tmp2.length();
      tmp3.set(-tmp2.x * (drag + quad), 1000 * 9.81 * volume - tmp2.y * (drag * 2.2 + quad * 2), -tmp2.z * (drag + quad)).multiplyScalar(dt);
      body.applyImpulseAtPoint(tmp3, tmp, true);
    }
    state.submersion = submerged;
    state.waterDepth = maxDepth;
    state.inWater = submerged > 0.02;
    if (submerged > 0.3) {
      state.flood = Math.min(1, state.flood + dt * (0.008 + submerged * 0.035));
      body.applyTorqueImpulse(tmp.copy(ang).multiplyScalar(-submerged * 1600 * dt), true);
    } else if (submerged < 0.02) state.flood = Math.max(0, state.flood - dt * 0.05);
    if (maxDepth > 1.25 && submerged > 0.55) state.stalled = true;
    prevVel.copy(vel);
  }

  function sync() {
    const t = body.translation();
    const r = body.rotation();
    model.group.position.set(t.x, t.y, t.z);
    model.group.quaternion.set(r.x, r.y, r.z, r.w);
    for (const w of wheels) {
      if (w.gone) continue;
      w.visual.group.position.y = TUNE.rayY - w.L0 + w.comp;
      w.visual.group.rotation.set(w.camber, (w.front ? state.steer : state.rearSteer) + w.toe, 0);
      w.visual.spin.rotation.z = (w.side > 0 ? -1 : 1) * w.angle;
    }
    model.steeringWheel.rotation.z = (state.steer / TUNE.steerMax) * 2.4;
    const lv = body.linvel();
    state.gForce.set(lv.x - prevVel.x, lv.y - prevVel.y, lv.z - prevVel.z);
    model.group.updateMatrixWorld();
    camera.eye.copy(model.eye).applyMatrix4(model.group.matrixWorld);
    state.readout = (state.stalled ? 'STALLED' : state.reverse ? 'R' : state.drifting || state.pivot > 0.3 ? 'DRIFT' : 'D') + ' · ' + (state.rideTarget === 'offroad' ? 'OFF-ROAD' : state.rideTarget === 'low' ? 'LOW' : 'NORMAL');
  }

  const api = {
    body, hull, wheels, state, controls, colliders, mass: MASS, camera,
    keys: { handbrake: 'Space', camera: 'KeyC' },
    label: 'Enter Cyber Truck',
    hint: 'Exit   ·   Space drift   ·   T vault   ·   G ride height   ·   V cockpit   ·   H lights',
    get water() {
      return water;
    },
    setWater(w) {
      water = w;
    },
    cycleRide() {
      const i = ORDER.indexOf(state.rideTarget);
      state.rideTarget = ORDER[(i + 1) % ORDER.length];
      return state.rideTarget;
    },
    setRide(name) {
      if (RIDE[name]) state.rideTarget = name;
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
      body.setTranslation({ x: t.x, y: Math.max(t.y, heightAt(t.x, t.z)) + 1.0, z: t.z }, true);
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
  return api;
}
