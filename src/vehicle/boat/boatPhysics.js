// Costa del Gzowo boats: shared hull physics under the vehicle contract (buoyancy from the live water surface, planing lift and trim, stern thrust and steering, sideslip, banking, foils, diving ballast, grounding, mooring).
import * as THREE from 'three';
import { WORLD } from '../../config.js';
import { GROUPS, groups } from '../../core/physics.js';
import { heightAt, flowAt } from '../../world/heightfield.js';

const RHO = 1000;
const G = 9.81;
const EDGE = WORLD.half - 30;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createBoatPhysics({ physics, model, spawn, input, design }) {
  const R = physics.RAPIER;
  const world = physics.world;
  const D = design;
  const samples = D.samples;
  const area = samples.reduce((a, s) => a + (s[3] ? 0 : s[2]), 0);
  const draft = D.mass / (RHO * area);
  const bottomY = -draft;
  const column = D.column ?? 1.2;
  const heave = RHO * G * area;
  const dampArea = (D.heaveDamp ?? 0.5) * 2 * Math.sqrt(heave * D.mass) / area;
  const quad = D.accel / (D.top * D.top);
  const com = new THREE.Vector3(...(D.com || [0, 0, 0]));
  const I = D.inertia;
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
  const body = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(spawn.x, 0, spawn.z).setRotation(yawQ)
      .setAdditionalMassProperties(D.mass, { x: com.x, y: com.y, z: com.z }, { x: I[0], y: I[1], z: I[2] }, { x: 0, y: 0, z: 0, w: 1 })
      .setLinearDamping(0.02).setAngularDamping(0.3).setCcdEnabled(true).setCanSleep(false),
  );
  const own = groups(GROUPS.CAR, 0xffff);
  const colliders = D.colliders.map((c) => {
    let desc;
    if (c.points) desc = R.ColliderDesc.convexHull(c.points);
    else desc = R.ColliderDesc.cuboid(c.half[0], c.half[1], c.half[2]).setTranslation(c.at[0], c.at[1], c.at[2]);
    const col = world.createCollider(desc.setDensity(0).setFriction(c.friction ?? 0.5).setRestitution(0.05).setCollisionGroups(own).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(D.mass * 3), body);
    physics.surfaces.set(col.handle, c.surface || 'boat');
    return col;
  });

  const state = {
    throttle: 0, brake: 0, steerInput: 0, steer: 0, gear: 1, rpm: 0, speed: 0, forwardSpeed: 0, engineOn: false, occupied: false,
    submersion: 0, flood: 0, stalled: false, airborne: false, onGround: 0, engineLoad: 0, waterDepth: 1, reverse: false, skid: 0, gForce: new THREE.Vector3(), inWater: true,
    readout: '0 KN', boat: true, planing: 0, foiling: 0, foilLift: 0, submerged: false, dive: 0, depth: 0, wet: 1, wash: 0, spray: 0, prop: 0, grounded: 0, boost: false,
    ballast: 0, diving: false, targetDepth: 2, pitch: 0, roll: 0, yawRate: 0, powerScale: 1, moored: true, health: 1,
  };
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const vel = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const fwd = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3(0, 0, 1);
  const prevVel = new THREE.Vector3();
  const comW = new THREE.Vector3();
  const fh = new THREE.Vector3();
  const rh = new THREE.Vector3();
  const F = new THREE.Vector3();
  const T = new THREE.Vector3();
  const p = new THREE.Vector3();
  const r = new THREE.Vector3();
  const f = new THREE.Vector3();
  const tq = new THREE.Vector3();
  const flow = { x: 0, y: 0 };
  const foils = D.foil ? D.foil.foils.map((fl) => ({ ...fl, lift: 0, sub: 0, cl: 0 })) : [];
  let water = null;
  let time = 0;
  let steer = 0;
  let thrustNow = 0;
  let ticks = 0;
  let grounded = 0;
  let bedAtProp = -10;
  let home = { x: spawn.x, z: spawn.z, yaw: spawn.yaw };

  function read() {
    const t = body.translation();
    const q = body.rotation();
    const lv = body.linvel();
    const av = body.angvel();
    pos.set(t.x, t.y, t.z);
    quat.set(q.x, q.y, q.z, q.w);
    vel.set(lv.x, lv.y, lv.z);
    ang.set(av.x, av.y, av.z);
    fwd.set(1, 0, 0).applyQuaternion(quat);
    up.set(0, 1, 0).applyQuaternion(quat);
    right.set(0, 0, 1).applyQuaternion(quat);
    comW.copy(com).applyQuaternion(quat).add(pos);
  }

  const level = (x, z) => (water ? water.getHeightAt(x, z) : WORLD.waterLevel);
  const local = (x, y, z, out) => out.set(x, y, z).applyQuaternion(quat).add(pos);

  function force(fx, fy, fz, px, py, pz) {
    F.x += fx;
    F.y += fy;
    F.z += fz;
    const rx = px - comW.x;
    const ry = py - comW.y;
    const rz = pz - comW.z;
    T.x += ry * fz - rz * fy;
    T.y += rz * fx - rx * fz;
    T.z += rx * fy - ry * fx;
  }

  function pointVel(px, py, pz, out) {
    const rx = px - comW.x;
    const ry = py - comW.y;
    const rz = pz - comW.z;
    return out.set(vel.x + ang.y * rz - ang.z * ry, vel.y + ang.z * rx - ang.x * rz, vel.z + ang.x * ry - ang.y * rx);
  }

  function substep(dt) {
    time += dt;
    read();
    F.set(0, 0, 0);
    T.set(0, 0, 0);
    const on = state.occupied && !state.stalled;
    const fw = on ? controls.throttle - controls.brake : 0;
    const turn = on ? controls.steer : 0;
    const boost = on && input ? input.key('ShiftLeft', 'ShiftRight') : false;
    state.boost = boost && fw > 0;
    const dive = D.dive || null;
    const diving = dive && state.diving;
    if (dive && on && input && diving) state.targetDepth = clamp(state.targetDepth + ((input.key('KeyC') ? 1 : 0) - (input.key('Space') ? 1 : 0)) * dive.rate * dt, dive.minDepth, dive.maxDepth);
    if (dive) state.ballast =clamp(state.ballast + (diving ? dt / dive.flood : -dt / dive.blow), 0, 1);
    const ballast = dive ? state.ballast : 0;

    let wetA = 0;
    let deep = 0;
    const probe = ++ticks % 6 === 0;
    if (probe) grounded = 0;
    for (const s of samples) {
      local(s[0], bottomY + (s[3] || 0), s[1], p);
      const wy = level(p.x, p.z);
      const d = wy - p.y;
      if (probe && p.y < heightAt(p.x, p.z) + 0.06) grounded++;
      if (d <= 0) continue;
      const dd = Math.min(d, column);
      pointVel(p.x, p.y, p.z, f);
      const lift = RHO * G * s[2] * dd * (1 - ballast) - dampArea * s[2] * f.y * Math.min(1, d / 0.25);
      force(0, lift, 0, p.x, p.y, p.z);
      wetA += s[2] * Math.min(1, d / Math.max(0.12, draft * 0.7));
      deep += s[2] * Math.min(1, d / column);
    }
    const wet = Math.min(1, wetA / area);
    const sunk = Math.min(1, deep / area);
    state.wet = wet;
    state.grounded = grounded / samples.length;

    fh.set(fwd.x, 0, fwd.z);
    if (fh.lengthSq() < 1e-4) fh.set(1, 0, 0);
    fh.normalize();
    rh.set(-fh.z, 0, fh.x);
    flowAt(comW.x, comW.z, flow);
    const vx = vel.x - flow.x * wet;
    const vz = vel.z - flow.y * wet;
    const vf = vx * fh.x + vz * fh.z;
    const vs = vx * rh.x + vz * rh.z;
    const speed = vel.length();
    const water0 = level(comW.x, comW.z);
    state.depth = water0 - (pos.y + (D.topY ?? 0.8));
    const under = dive ? clamp((water0 - (pos.y + (D.topY ?? 0.8))) / 0.4, 0, 1) : 0;
    state.submerged = under > 0.5;

    let foilSub = 0;
    let foilFly = 0;
    if (foils.length) {
      const fo = D.foil;
      const v2 = Math.max(0, vf) * Math.max(0, vf);
      const q = 0.5 * RHO * v2;
      const rideH = pos.y + bottomY - water0;
      let avail = 0;
      for (const fl of foils) {
        local(fl.x, fl.y, fl.z, p);
        fl.sub = clamp((level(p.x, p.z) - p.y) / 0.3, 0, 1);
        avail += q * fl.area * fo.clMax * fl.sub;
        foilSub += fl.sub / foils.length;
      }
      const pitch = Math.asin(clamp(fwd.y, -1, 1));
      const roll = Math.asin(clamp(-right.y, -1, 1));
      const wantRoll = clamp(-ang.y * Math.max(0, vf) * fo.bank, -0.42, 0.42);
      const wantLift = D.mass * (G + clamp((fo.ride - rideH) * fo.kp - vel.y * fo.kd, -6, 6));
      const share = avail > 1 ? clamp(wantLift / avail, 0, 1) : 0;
      for (const fl of foils) {
        let cl = share * fo.clMax;
        const pe = (fo.pitch - pitch) * fo.kPitch - ang.dot(right) * fo.kPitchD;
        if (fl.front) cl += clamp(pe * 0.4, -0.3, 0.3);
        else cl -= clamp(pe, -0.5, 0.5);
        if (fl.z) cl += Math.sign(fl.z) * clamp((roll - wantRoll) * fo.kRoll + ang.dot(fwd) * fo.kRollD, -0.35, 0.35);
        cl = clamp(cl, 0, fo.clMax);
        fl.cl = cl;
        fl.lift = q * fl.area * cl * fl.sub;
        local(fl.x, fl.y, fl.z, p);
        force(up.x * fl.lift, up.y * fl.lift, up.z * fl.lift, p.x, p.y, p.z);
        const drag = fl.lift * (0.03 + cl * cl * 0.04) + q * fl.area * fo.cd * fl.sub;
        force(-fh.x * drag, 0, -fh.z * drag, p.x, p.y, p.z);
      }
      const total = foils.reduce((a, fl) => a + fl.lift, 0);
      state.foilLift = total / (D.mass * G);
      foilFly = clamp((rideH + 0.05) / 0.35, 0, 1) * smooth(0.5, 0.9, state.foilLift);
      state.foiling = foilFly;
    }

    const hull = wet;
    const plan = D.plane ? smooth(D.plane.v0, D.plane.v1, vf) * Math.min(1, hull * 1.5) : 0;
    state.planing = plan;
    if (D.plane && hull > 0.02) {
      local(com.x + D.plane.x, bottomY, 0, p);
      const lift = D.mass * G * D.plane.lift * plan;
      force(0, lift, 0, p.x, p.y, p.z);
      const hump = Math.exp(-(((vf - D.plane.hump) / D.plane.width) ** 2));
      const trim = D.inertia[2] * D.plane.trim * (hump + D.plane.hold * plan) * Math.min(1, hull * 2);
      T.addScaledVector(right, trim);
    }

    const humpDrag = D.plane ? 1 + D.plane.drag * Math.exp(-(((vf - D.plane.hump) / D.plane.width) ** 2)) - D.plane.slick * plan : 1;
    const dragMul = dive ? 1 + (dive.drag - 1) * under : 1;
    const hullDrag = (D.lin * vf + quad * vf * Math.abs(vf) * humpDrag) * D.mass * Math.max(hull, under) * dragMul;
    force(-fh.x * hullDrag, 0, -fh.z * hullDrag, comW.x, comW.y, comW.z);

    const latWet = Math.max(hull * (1 - 0.45 * plan), foilSub * 0.5, under);
    const lat = (D.latLin * vs + D.latQuad * vs * Math.abs(vs)) * D.mass * latWet;
    local(com.x + D.latX, com.y, 0, p);
    force(-rh.x * lat, 0, -rh.z * lat, p.x, comW.y, p.z);

    const target = turn * D.steerMax;
    steer += clamp(target - steer, -D.steerRate * dt, D.steerRate * dt);
    local(D.prop[0], D.prop[1], D.prop[2], p);
    const propDepth = level(p.x, p.z) - p.y;
    if (probe) bedAtProp = heightAt(p.x, p.z);
    const bite = clamp(propDepth / 0.25, 0, 1) * (p.y > bedAtProp + 0.05 ? 1 : 0.15);
    state.prop = bite;
    const top = diving && under > 0.5 ? dive.accel : D.accel;
    const cmd = fw > 0 ? fw * (boost ? D.boost : 1) : fw * D.reverse;
    thrustNow += (cmd - thrustNow) * (1 - Math.exp(-dt * D.spool));
    const thrust = thrustNow * top * D.mass * bite * state.powerScale;
    const c = Math.cos(steer * D.vector);
    const sn = Math.sin(steer * D.vector);
    force((fh.x * c + rh.x * sn) * thrust, 0, (fh.z * c + rh.z * sn) * thrust, p.x, D.thrustAtCom ? comW.y : Math.min(p.y, comW.y), p.z);
    const rudderWet = Math.max(hull, foilSub, under);
    const rudder = steer * D.rudder * vf * Math.abs(vf) * D.mass * rudderWet;
    force(rh.x * rudder, 0, rh.z * rudder, p.x, comW.y, p.z);

    const wy = ang.y;
    T.y -= wy * D.yawDamp * I[1] * (0.25 + Math.max(hull, foilSub, under));
    const fwAng = ang.dot(fwd);
    const rtAng = ang.dot(right);
    T.addScaledVector(fwd, -fwAng * D.rollDamp * I[0] * (0.3 + hull));
    T.addScaledVector(right, -rtAng * D.pitchDamp * I[2] * (0.3 + hull));
    if (D.bank && !foils.length) T.addScaledVector(fwd, -D.bank * wy * Math.max(0, vf) * I[0] * hull * smooth(2, 8, vf));
    const tilt = Math.acos(clamp(up.y, -1, 1));
    const right0 = smooth(D.capsize ?? 0.5, 1.6, tilt) * D.mass * G * (D.righting ?? 1.5);
    tq.set(up.z, 0, -up.x);
    if (tq.lengthSq() > 1e-8) T.addScaledVector(tq.normalize(), -right0);

    if (dive) {
      if (ballast > 0) {
        const lo = Math.max(heightAt(comW.x, comW.z) + (D.keelClear ?? 1.4), water0 - dive.maxDepth);
        const hi = water0 - (D.topY ?? 0.8) - dive.minDepth;
        const want = diving ? clamp(water0 - (D.topY ?? 0.8) - state.targetDepth, Math.min(lo, hi), hi) : water0 + 2;
        const ay = clamp((want - pos.y) * dive.kp - vel.y * dive.kd, -dive.climb, dive.climb);
        F.y += D.mass * (G * ballast + ay * ballast * sunk);
        const keep = Math.min(ballast, under);
        T.addScaledVector(right, (clamp(vel.y * 0.08, -0.25, 0.25) - Math.asin(clamp(fwd.y, -1, 1))) * I[2] * 6 * keep);
        T.addScaledVector(fwd, (0 - Math.asin(clamp(-right.y, -1, 1)) * 1) * I[0] * 6 * keep);
        F.y -= vel.y * D.mass * 1.2 * under;
      }
      state.dive = ballast;
    }

    const hv = Math.hypot(vel.x, vel.z);
    F.x -= vel.x * hv * 0.0006 * D.mass;
    F.z -= vel.z * hv * 0.0006 * D.mass;
    if (state.grounded > 0) {
      const k = D.mass * 2.2 * state.grounded;
      F.x -= vel.x * k;
      F.z -= vel.z * k;
      T.y -= wy * I[1] * 2 * state.grounded;
    }
    if (!state.occupied) {
      const dx = home.x - pos.x;
      const dz = home.z - pos.z;
      const near = Math.hypot(dx, dz) < (D.mooring ?? 8);
      state.moored = near;
      const k = near ? 1.2 : 0;
      F.x += (dx * k * 0.6 - vel.x * 1.4) * D.mass;
      F.z += (dz * k * 0.6 - vel.z * 1.4) * D.mass;
      if (near) {
        let e = home.yaw - Math.atan2(-fwd.z, fwd.x);
        e = Math.atan2(Math.sin(e), Math.cos(e));
        T.y += (e * 1.5 - wy * 2.5) * I[1];
      } else T.y -= wy * 2.5 * I[1];
    } else state.moored = false;

    const ox = Math.abs(pos.x) - EDGE;
    const oz = Math.abs(pos.z) - EDGE;
    if (ox > 0) F.x -= Math.sign(pos.x) * D.mass * Math.min(30, ox * 2 + Math.max(0, vel.x * Math.sign(pos.x)) * 2);
    if (oz > 0) F.z -= Math.sign(pos.z) * D.mass * Math.min(30, oz * 2 + Math.max(0, vel.z * Math.sign(pos.z)) * 2);

    body.applyImpulse({ x: F.x * dt, y: F.y * dt, z: F.z * dt }, true);
    body.applyTorqueImpulse({ x: T.x * dt, y: T.y * dt, z: T.z * dt }, true);
    if (pos.y < WORLD.waterLevel - 60) respawn();

    const kn = Math.abs(vf) * 1.94384;
    const engine = Math.abs(thrustNow);
    const flooded = tilt > 1.9 && sunk > 0.6;
    state.submersion = flooded ? 1 : 0;
    Object.assign(state, {
      throttle: Math.max(0, fw), brake: Math.max(0, -fw), steerInput: turn, steer: (steer / D.steerMax) * 0.6, rpm: on ? 900 + engine * 5600 + Math.abs(vf) * 25 : 0, speed, forwardSpeed: vf,
      reverse: fw < 0 && vf < 0.5, engineLoad: engine, airborne: !!(dive && ballast > 0.05), onGround: grounded, yawRate: wy,
      pitch: Math.asin(clamp(fwd.y, -1, 1)), roll: Math.asin(clamp(-right.y, -1, 1)), skid: clamp(Math.abs(vs) / 6 - 0.2, 0, 1) * hull,
      wash: clamp(speed / D.top, 0, 1) * Math.max(hull, foilSub * 0.3), spray: plan,
    });
    let mode = '';
    if (state.grounded > 0.3 && speed < 2) mode = '  AGROUND';
    else if (dive && ballast > 0.05) mode = state.submerged ? `  DEPTH ${Math.max(0, state.depth).toFixed(1)} m` : diving ? '  DIVING' : '  SURFACING';
    else if (foilFly > 0.5) mode = '  FOILING';
    else if (plan > 0.6) mode = '  PLANING';
    state.readout = `${Math.round(kn)} KN${mode}`;
    prevVel.copy(vel);
  }

  function sync() {
    read();
    model.group.position.copy(pos);
    model.group.quaternion.copy(quat);
    state.gForce.copy(vel).sub(prevVel);
  }

  function place(x, z, yaw) {
    const y = level(x, z) + (D.restY ?? 0);
    body.setTranslation({ x, y, z }, true);
    body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    thrustNow = 0;
    steer = 0;
    state.ballast = 0;
    state.diving = false;
    read();
  }

  function respawn() {
    place(spawn.x, spawn.z, spawn.yaw);
    home = { x: spawn.x, z: spawn.z, yaw: spawn.yaw };
    state.stalled = false;
  }

  place(spawn.x, spawn.z, spawn.yaw);
  sync();
  return {
    body, wheels: [], state, controls, colliders, mass: D.mass, keys: D.keys,
    position: pos, quaternion: quat, velocity: vel, forward: fwd, up, right,
    camera: D.camera, hint: D.hint, label: D.label, design: D, foils, draft, bottomY,
    setWater(w) {
      water = w;
      place(spawn.x, spawn.z, spawn.yaw);
    },
    get water() {
      return water;
    },
    substep,
    sync,
    reset() {
      read();
      const yaw = Math.atan2(-fwd.z, fwd.x);
      if (heightAt(pos.x, pos.z) > WORLD.waterLevel - draft - 0.3) respawn();
      else place(pos.x, pos.z, yaw);
    },
    respawn,
    leave() {
      home = { x: pos.x, z: pos.z, yaw: Math.atan2(-fwd.z, fwd.x) };
      const sx = spawn.x - pos.x;
      const sz = spawn.z - pos.z;
      if (Math.hypot(sx, sz) < (D.mooring ?? 8)) home = { x: spawn.x, z: spawn.z, yaw: spawn.yaw };
    },
    get home() {
      return home;
    },
  };
}
