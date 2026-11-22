// Costa del Gzowo: road traffic (drivers that keep lanes and distance, obey lights, stop signs and crossings, pass obstacles, sound the horn; kinematic bodies that turn dynamic when hit hard and recover).
import * as THREE from 'three';
import { GROUPS, groups } from '../../core/physics.js';
import { hookMaterial } from '../../render/shaderHooks.js';
import { seeded, clamp, wrap } from '../util.js';
import { createNetwork, lanePoint } from './network.js';
import { buildCar, buildWheel, CAR_TYPES, LAMP } from './carModels.js';
import { createPedRig, newPose, legIK } from '../ped/rig.js';
import { createPedMaterial, applyLook } from '../ped/material.js';

const MAX = 12;
const SAMPLES = 46;
const PAINTS = [0xb9bcc0, 0x1b1d21, 0xe9e6de, 0x7a1512, 0x1d3f6e, 0x3f5d4a, 0xc9a24a, 0x6d7f8c, 0x8a4a22, 0x2f7f86, 0xd9d2c0, 0x40454c];
const ORDER = ['sedan', 'hatch', 'pickup', 'van', 'sedan', 'hatch', 'sedan', 'pickup', 'hatch', 'van', 'sedan', 'hatch'];
const TRIM_PARS = 'attribute float aLamp;\nuniform float uLamp[6];\nvarying float vLampGain;\n';
const pt = { x: 0, z: 0, tx: 1, tz: 0, i: 0 };
const Y = new THREE.Vector3(0, 1, 0);
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const e1 = new THREE.Euler();
const m4 = new THREE.Matrix4();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();

export function createTraffic(ctx, play, world, pack) {
  const { scene, camera, physics, lighting } = ctx;
  const R = physics.RAPIER;
  const net = createNetwork(world.crossings);
  const random = seeded(world.seed ^ 0x51f3);
  const models = {};
  for (const type of Object.keys(CAR_TYPES)) models[type] = buildCar(type);
  const glassMaterial = hookMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x0b1316, metalness: 0, roughness: 0.03, envMapIntensity: 1.2, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  }), { key: 'npc-glass' });
  lighting.register(glassMaterial);
  const wheelMaterial = hookMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }), { key: 'npc-wheel', dynamic: true, rough: 'roughnessFactor = vColor.a;' });
  lighting.register(wheelMaterial);
  const wheels = new THREE.InstancedMesh(buildWheel(), wheelMaterial, MAX * 4);
  wheels.castShadow = true;
  wheels.receiveShadow = true;
  wheels.frustumCulled = false;
  wheels.count = 0;
  wheels.name = 'npc-wheels';
  scene.add(wheels);
  const cars = [];
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const rayGroups = groups(0xffff, GROUPS.WORLD);
  const sx = new Float32Array(SAMPLES);
  const sz = new Float32Array(SAMPLES);
  const ss = new Float32Array(SAMPLES);
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  let target = 0;
  let frozen = false;
  let frame = 0;
  let warm = 12;
  let blink = 0;

  function paintMaterial(hex) {
    const m = hookMaterial(new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.45, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06 }), { key: 'npc-paint', dynamic: true });
    lighting.register(m);
    return m;
  }

  function trimMaterial() {
    const uniforms = { uLamp: { value: new Float32Array([0, 2.2, 1.0, 0, 0, 0]) } };
    const m = hookMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }), {
      key: 'npc-trim', dynamic: true, pars: TRIM_PARS, fragPars: 'varying float vLampGain;\n', vertex: 'vLampGain = uLamp[int(aLamp + 0.5)];', rough: 'roughnessFactor = vColor.a;',
      emissive: 'totalEmissiveRadiance += vColor.rgb * vLampGain;', uniforms,
    });
    lighting.register(m);
    m.userData.lamp = uniforms.uLamp.value;
    return m;
  }

  function groundAt(x, y, z) {
    ray.origin.x = x;
    ray.origin.y = y + 1.6;
    ray.origin.z = z;
    const hit = physics.world.castRay(ray, 6, true, undefined, rayGroups);
    return hit ? y + 1.6 - (hit.timeOfImpact ?? hit.toi) : y;
  }

  function build(index) {
    const type = ORDER[index % ORDER.length];
    const model = models[type];
    const d = model.dims;
    const group = new THREE.Group();
    group.name = 'npc-car-' + type;
    const body = new THREE.Group();
    group.add(body);
    const paint = new THREE.Mesh(model.paint, paintMaterial(PAINTS[(index * 5 + 2) % PAINTS.length]));
    paint.castShadow = true;
    paint.receiveShadow = true;
    const trim = new THREE.Mesh(model.trim, trimMaterial());
    trim.receiveShadow = true;
    const glass = new THREE.Mesh(model.glass, glassMaterial);
    glass.renderOrder = 2;
    body.add(paint, trim, glass);
    const person = pack.people[(index * 7 + 3) % pack.people.length];
    const rig = createPedRig(person.meta);
    const skin = createPedMaterial(ctx);
    applyLook(skin, person.meta, person.meta.looks[index % person.meta.looks.length]);
    const driver = new THREE.SkinnedMesh(person.far, skin);
    driver.bind(rig.skeleton, new THREE.Matrix4());
    driver.receiveShadow = true;
    driver.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 1.3);
    rig.group.add(driver);
    const scale = Math.min(person.meta.height, 0.96);
    rig.group.scale.setScalar(scale);
    rig.group.rotation.y = Math.PI / 2;
    const pose = newPose();
    pose.hipsY = 0.4;
    pose.hipsPitch = -0.3;
    pose.spinePitch = 0.2;
    pose.headPitch = 0.1;
    for (const [t, s] of [['L', 1], ['R', -1]]) {
      legIK(pose, t, s, s * 0.14, 0.22, 0.62, 0.25);
      pose['arm' + t] = -0.95;
      pose['armOut' + t] = 0.22;
      pose['elbow' + t] = 0.7;
      pose['armTwist' + t] = 0.3;
      pose['forearm' + t] = 0.5;
    }
    rig.apply(pose);
    rig.group.position.set(d.seat[0] - 0.16, d.seat[1] + 0.1 - 0.4 * scale, d.seat[2]);
    body.add(rig.group);
    group.visible = false;
    scene.add(group);
    const rnd = seeded(world.seed * 13 + index * 7919 + 1);
    return {
      index, type, model, d, group, body, paint, trim, glass, driverGroup: rig.group, rig, pose, lamp: trim.material.userData.lamp, rnd,
      active: false, lane: null, plan: [], s: 0, v: 0, a: 0, off: 0, offTarget: 0, fx: 0, fz: 0, rx: 0, rz: 0, x: 0, y: 0, z: 0, yaw: 0, yawRate: 0, hx: 1, hz: 0, yF: 0, yR: 0,
      roll: 0, rollV: 0, pitch: 0, pitchV: 0, spin: 0, steer: 0, keen: 1, mode: 'drive', blockedT: 0, hornT: 3, stopT: 0, cleared: null, yieldT: 0, blocker: null, pass: null, ignore: null, ignoreT: 0,
      rb: null, colliders: [], hitForce: 0, restT: 0, wreckT: 0, dist: 0, seen: false, rec: { x: 0, y: 0, z: 0, vx: 0, vz: 0, fx: 1, fz: 0, halfL: d.halfL, halfW: d.halfW, speed: 0, air: false, kind: 'npc', npc: null, yielding: null },
      braking: false, signal: 0, squealT: 0, yieldC: null, blockLat: 0, blockR: 1,
    };
  }

  function choosePlan(car) {
    while (car.plan.length < 5) {
      const last = car.plan.length ? car.plan[car.plan.length - 1] : car.lane;
      const n = last.next;
      car.plan.push(n.length ? n[Math.floor(car.rnd() * n.length)] : last);
    }
  }

  function setPose(car) {
    lanePoint(car.lane, car.s, pt);
    car.fx = pt.x + -pt.tz * car.off;
    car.fz = pt.z + pt.tx * car.off;
  }

  function place(car, lane, s) {
    car.lane = lane;
    car.s = s;
    car.plan.length = 0;
    choosePlan(car);
    car.off = car.offTarget = 0;
    setPose(car);
    car.hx = pt.tx;
    car.hz = pt.tz;
    car.rx = car.fx - pt.tx * car.d.wheelbase;
    car.rz = car.fz - pt.tz * car.d.wheelbase;
    car.v = lane.speed * 0.6;
    car.a = 0;
    car.mode = 'drive';
    car.keen = 0.9 + car.rnd() * 0.18;
    car.y = car.yF = car.yR = groundAt(car.fx, car.y || 6, car.fz);
    car.blockedT = 0;
    car.stopT = 0;
    car.cleared = null;
    car.blocker = null;
    car.pass = null;
    car.roll = car.pitch = car.rollV = car.pitchV = 0;
    car.active = true;
    car.rec.npc = car;
    pose(car, 0);
  }

  function freeSpot(minCamera) {
    for (let tries = 0; tries < 12; tries++) {
      const lane = net.spawnable[Math.floor(random() * net.spawnable.length)];
      const s = 4 + random() * (lane.len - 10);
      lanePoint(lane, s, pt);
      const dc = Math.hypot(pt.x - camera.position.x, pt.z - camera.position.z);
      if (dc < minCamera) continue;
      let ok = true;
      for (const c of cars) if (c.active && Math.hypot(c.x - pt.x, c.z - pt.z) < 28) ok = false;
      for (const v of world.vehicles) if (Math.hypot(v.x - pt.x, v.z - pt.z) < 14) ok = false;
      if (ok) return { lane, s };
    }
    return null;
  }

  function removeBody(car) {
    if (!car.rb) return;
    for (const c of car.colliders) {
      physics.offContact(c);
      physics.surfaces.delete(c.handle);
    }
    physics.world.removeRigidBody(car.rb);
    car.rb = null;
    car.colliders.length = 0;
  }

  function addBody(car) {
    const d = car.d;
    const rb = physics.world.createRigidBody(R.RigidBodyDesc.kinematicVelocityBased().setTranslation(car.x, car.y, car.z).setRotation(q1.setFromAxisAngle(Y, car.yaw)).setCanSleep(false).setLinearDamping(0.5).setAngularDamping(1.6));
    const g = groups(GROUPS.CAR, 0xffff);
    const hull = physics.world.createCollider(R.ColliderDesc.roundCuboid(d.halfL - 0.12, 0.3, d.halfW - 0.1, 0.08).setTranslation(0, 0.68, 0).setMass(d.mass * 0.8).setFriction(0.4).setRestitution(0.05).setCollisionGroups(g).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(9000), rb);
    car.colliders.push(hull);
    if (d.height > 1.3) car.colliders.push(physics.world.createCollider(R.ColliderDesc.cuboid(d.halfL * 0.42, (d.height - 1.05) / 2, d.halfW - 0.2).setTranslation(-d.halfL * 0.12, (d.height + 1.05) / 2 - 0.03, 0).setMass(d.mass * 0.05).setFriction(0.4).setCollisionGroups(g), rb));
    for (const ax of [d.wheelbase / 2, -d.wheelbase / 2]) for (const s of [1, -1]) car.colliders.push(physics.world.createCollider(R.ColliderDesc.ball(d.radius).setTranslation(ax, d.radius, s * d.track / 2).setMass(d.mass * 0.0375).setFriction(1.0).setCollisionGroups(g), rb));
    for (const c of car.colliders) physics.surfaces.set(c.handle, 'car');
    physics.onContact(hull, (other, event) => {
      const o = physics.world.getCollider(other);
      const parent = o ? o.parent() : null;
      if (!parent || !parent.isDynamic()) return;
      car.hitForce = Math.max(car.hitForce, event.maxForceMagnitude());
    });
    car.rb = rb;
  }

  function pose(car, dt) {
    const d = car.d;
    let dx = car.fx - car.rx;
    let dz = car.fz - car.rz;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    car.rx = car.fx - dx * d.wheelbase;
    car.rz = car.fz - dz * d.wheelbase;
    const yaw = Math.atan2(-dz, dx);
    if (dt > 0) car.yawRate += (wrap(yaw - car.yaw) / dt - car.yawRate) * Math.min(1, dt * 10);
    car.yaw = yaw;
    car.hx = dx;
    car.hz = dz;
    car.x = (car.fx + car.rx) / 2;
    car.z = (car.fz + car.rz) / 2;
    if ((frame + car.index) % (car.dist < 60 ? 1 : car.dist < 150 ? 3 : 8) === 0) {
      car.yF = groundAt(car.fx, car.y, car.fz);
      car.yR = groundAt(car.rx, car.y, car.rz);
    }
    const y = (car.yF + car.yR) / 2;
    car.y += (y - car.y) * (dt > 0 ? Math.min(1, dt * 14) : 1);
  }

  function show(car, dt) {
    const d = car.d;
    const g = car.group;
    g.position.set(car.x, car.y, car.z);
    const slope = Math.atan2(car.yF - car.yR, d.wheelbase);
    g.quaternion.setFromAxisAngle(Y, car.yaw).multiply(q2.setFromEuler(e1.set(0, 0, slope)));
    const lat = car.v * car.yawRate;
    car.rollV += ((lat * 0.011 - car.roll) * 60 - car.rollV * 9) * dt;
    car.roll += car.rollV * dt;
    car.pitchV += ((car.a * 0.011 - car.pitch) * 55 - car.pitchV * 8) * dt;
    car.pitch += car.pitchV * dt;
    car.body.rotation.set(clamp(car.roll, -0.09, 0.09), 0, clamp(car.pitch, -0.05, 0.05));
    car.spin -= (car.v * dt) / d.radius;
  }

  function wheelMatrices(car, base) {
    const d = car.d;
    let k = base;
    for (const [ax, front] of [[d.wheelbase / 2, true], [-d.wheelbase / 2, false]]) {
      for (const s of [1, -1]) {
        v3.set(ax, d.radius, s * (d.track / 2 - 0.02)).applyQuaternion(car.group.quaternion).add(car.group.position);
        q1.copy(car.group.quaternion);
        if (front) q1.multiply(q2.setFromAxisAngle(Y, car.steer));
        if (s < 0) q1.multiply(q2.setFromAxisAngle(Y, Math.PI));
        q1.multiply(q2.setFromEuler(e1.set(0, 0, s * car.spin)));
        m4.compose(v3, q1, s3.set(d.radius, d.radius, 0.21));
        wheels.setMatrixAt(k++, m4);
      }
    }
    return k;
  }

  function samples(car, horizon) {
    const step = Math.max(1.6, horizon / (SAMPLES - 1));
    let lane = car.lane;
    let s = car.s;
    let plan = 0;
    for (let n = 0; n < SAMPLES; n++) {
      while (s > lane.len && plan < car.plan.length) {
        s -= lane.len;
        lane = car.plan[plan++];
      }
      lanePoint(lane, Math.min(s, lane.len), pt);
      const over = Math.max(0, s - lane.len);
      const off = car.off + clamp(car.offTarget - car.off, -0.8 * n * step, 0.8 * n * step);
      sx[n] = pt.x + pt.tx * over - pt.tz * off;
      sz[n] = pt.z + pt.tz * over + pt.tx * off;
      ss[n] = n * step;
      s += step;
    }
    return step;
  }

  const probe = { car: null, acc: 0, blocker: null, step: 1, reach: 0, front: 0, free: 0 };
  function check(ox, oz, r, ovx, ovz, ref, s0) {
    const car = probe.car;
    const dx = ox - car.fx;
    const dz = oz - car.fz;
    if (dx * dx + dz * dz > probe.reach * probe.reach) return;
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const ex = ox - sx[i];
      const ez = oz - sz[i];
      const e = ex * ex + ez * ez;
      if (e < best) {
        best = e;
        bi = i;
      }
    }
    const j = Math.min(SAMPLES - 2, bi);
    const tx = (sx[j + 1] - sx[j]) / probe.step;
    const tz = (sz[j + 1] - sz[j]) / probe.step;
    const along = (ox - sx[j]) * tx + (oz - sz[j]) * tz;
    const lateral = -(ox - sx[j]) * tz + (oz - sz[j]) * tx;
    if (Math.abs(lateral) > car.d.halfW + r + 0.3) return;
    const gap = ss[j] + along - r - probe.front;
    if (gap < -(car.d.halfL * 2 + r)) return;
    const lead = Math.max(0, ovx * tx + ovz * tz);
    const a = idm(car, Math.max(gap, 0.05), lead, s0);
    if (a < probe.acc) {
      probe.acc = a;
      if (gap < 14) {
        probe.blocker = ref;
        lanePoint(car.lane, car.s, pt);
        car.blockLat = -(ox - pt.x) * pt.tz + (oz - pt.z) * pt.tx;
        car.blockR = r;
      }
    }
  }

  function idm(car, gap, lead, s0) {
    const v = car.v;
    const a = 1.9 * car.keen;
    const dv = v - lead;
    const want = s0 + Math.max(0, v * 1.25 + (v * dv) / (2 * Math.sqrt(a * 2.6)));
    return probe.free - a * (want / Math.max(gap, 0.05)) ** 2;
  }

  function mayEnter(car, connector, junction) {
    if (!connector || !junction) return true;
    for (const k of cars) {
      if (k === car || !k.active || k.mode !== 'drive') continue;
      if (connector.conflicts.includes(k.lane)) return false;
      const kc = k.lane.control;
      if (!kc || kc.junction !== junction || !connector.conflicts.includes(k.plan[0])) continue;
      if (kc.type === 'signal' && !green(kc)) continue;
      const kd = k.lane.len - k.s;
      const near = kd < Math.max(11, k.v * 3.6);
      if (!near) continue;
      const kr = k.plan[0].rank;
      if (kr < connector.rank || (kr === connector.rank && (k.cleared === junction || k.index < car.index))) return false;
    }
    if (connector.rank > 0) {
      for (const v of world.vehicles) {
        if (v.kind === 'npc' || v.air || v.speed < 2) continue;
        const dx = junction.x - v.x;
        const dz = junction.z - v.z;
        const d = Math.hypot(dx, dz);
        if (d < 30 && (dx * v.vx + dz * v.vz) / (d * v.speed + 1e-6) > 0.6) return false;
      }
    }
    const out = connector.next[0];
    if (out) for (const k of cars) if (k !== car && k.active && k.lane === out && k.s < 7 && k.v < 0.8) return false;
    return true;
  }

  function green(control) {
    const p = world.signal;
    return control.group === 'main' ? p < 15 : p >= 20 && p < 30.5;
  }

  function drive(car, dt) {
    const d = car.d;
    const lane = car.lane;
    const front = d.halfL - d.wheelbase / 2;
    const horizon = (car.v * car.v) / 4.2 + car.v * 1.2 + 14;
    const step = samples(car, horizon);
    let acc = 1.9 * car.keen;
    let v0 = lane.speed * car.keen;
    let lanePlan = lane;
    let ahead = lane.len - car.s;
    for (let i = 0; i < 2 && ahead < horizon; i++) {
      const nl = car.plan[i];
      v0 = Math.min(v0, Math.sqrt((nl.speed * car.keen) ** 2 + 2 * 1.5 * Math.max(0, ahead - 2)));
      ahead += nl.len;
      lanePlan = nl;
    }
    for (let i = 1; i < SAMPLES - 1; i++) {
      const a0 = Math.atan2(sz[i] - sz[i - 1], sx[i] - sx[i - 1]);
      const a1 = Math.atan2(sz[i + 1] - sz[i], sx[i + 1] - sx[i]);
      const k = Math.abs(wrap(a1 - a0)) / step;
      if (k > 0.012) v0 = Math.min(v0, Math.sqrt(2.1 / k + 2 * 1.6 * Math.max(0, ss[i] - 3)));
    }
    acc *= 1 - (car.v / Math.max(v0, 0.5)) ** 4;
    probe.free = acc;
    let blocker = null;
    let rule = false;
    car.rec.yielding = null;

    const control = lane.control;
    const toLine = lane.len - car.s;
    if (control && toLine < horizon) {
      let stop = false;
      const junction = control.junction;
      if (control.type === 'signal') {
        const p = world.signal;
        const g = green(control);
        const yellow = control.group === 'main' ? p >= 15 && p < 18.5 : p >= 30.5 && p < 33;
        if (!g) stop = !(yellow && toLine < (car.v * car.v) / 5.5 + 2);
      } else if (control.type === 'stop' && car.cleared !== junction) {
        stop = true;
        if (toLine < 2.6 && car.v < 0.3) {
          car.stopT += dt;
          if (car.stopT > 0.8) stop = false;
        }
      }
      if (!stop && car.cleared !== junction && toLine < Math.max(9, car.v * 2.2) && !mayEnter(car, car.plan[0], junction)) stop = true;
      if (!stop && toLine < 3) car.cleared = junction;
      if (stop) {
        acc = Math.min(acc, idm(car, toLine - 0.4, 0, 0.5));
        rule = true;
      }
    }
    let base = -car.s;
    let cl = lane;
    for (let i = -1; i < 2; i++) {
      if (i >= 0) {
        base += cl.len;
        cl = car.plan[i];
      }
      for (const cr of cl.crossings) {
        const gap = base + cr.s - front - 2.4;
        if (gap > horizon || gap < -2.2) continue;
        const c = cr.c;
        const free = c.rule === 'main-free' || c.rule === 'side-free';
        let stop = c.peds > 0;
        if (!stop && c.waiting > 0 && free && car.yieldT < 9 && (car.yieldC === c || gap > (car.v * car.v) / 9)) stop = true;
        if (stop) {
          acc = Math.min(acc, idm(car, Math.max(gap, 0.05), 0, 0.4));
          rule = true;
          car.yieldC = c;
          if (c.peds === 0) {
            car.rec.yielding = c;
            if (car.v < 0.5) car.yieldT += dt;
          }
        }
      }
    }
    if (!car.rec.yielding && car.yieldT > 0) car.yieldT = Math.max(0, car.yieldT - dt * 0.5);
    if (!rule) car.yieldC = null;

    probe.car = car;
    probe.acc = acc;
    probe.blocker = null;
    probe.step = step;
    probe.reach = horizon + 8;
    probe.front = front;
    for (const v of world.vehicles) {
      if (v === car.rec || v.air || v === car.ignore) continue;
      const r = v.halfW + 0.05;
      const o = v.halfL - v.halfW;
      const s0 = v.npc && v.npc.mode === 'drive' ? 2.0 : 4.6;
      check(v.x, v.z, r, v.vx, v.vz, v, s0);
      check(v.x + v.fx * o, v.z + v.fz * o, r, v.vx, v.vz, v, s0);
      check(v.x - v.fx * o, v.z - v.fz * o, r, v.vx, v.vz, v, s0);
    }
    for (const p of world.peds) if (p.active) check(p.x, p.z, 0.32, p.vx, p.vz, p, 2.4);
    if (world.player.onFoot) check(world.player.x, world.player.z, 0.4, world.player.vx, world.player.vz, world.player, 2.4);
    acc = probe.acc;
    blocker = probe.blocker;

    if (car.ignoreT > 0) {
      car.ignoreT -= dt;
      if (car.ignoreT <= 0) car.ignore = null;
    }
    car.blocker = blocker;
    if (blocker && car.v < 0.4) {
      car.blockedT += dt;
      const other = blocker.npc;
      if (other && other.mode === 'drive' && other.blocker === car.rec && car.blockedT > 2.5 && car.index < other.index) {
        car.ignore = blocker;
        car.ignoreT = 4;
      }
      const still = (blocker.speed ?? Math.hypot(blocker.vx || 0, blocker.vz || 0)) < 0.3;
      if (still && car.blockedT > 3.2 && lane.kind === 'road' && lane.opposite && !(other && other.mode === 'drive') && blocker.halfL) {
        let clear = true;
        for (const v of world.vehicles) {
          if (v === car.rec || v === blocker || v.air) continue;
          const ax = (v.x - car.fx) * car.hx + (v.z - car.fz) * car.hz;
          const side = -(v.x - car.fx) * car.hz + (v.z - car.fz) * car.hx;
          if (ax > -8 && ax < 55 && side < -1.2 && side > -7.5) clear = false;
        }
        if (clear) {
          car.pass = blocker;
          car.offTarget = Math.max(-5.2, Math.min(0, car.blockLat - (d.halfW + car.blockR + 0.75)));
        }
      }
      car.hornT -= dt;
      if (car.blockedT > 4 && car.hornT <= 0 && !rule && car.dist < 90) {
        car.hornT = 6 + car.rnd() * 5;
        if (world.onHorn) world.onHorn(car);
      }
    } else if (car.v > 1) car.blockedT = 0;
    if (car.pass) {
      const p = car.pass;
      const ax = (p.x - car.x) * car.hx + (p.z - car.z) * car.hz;
      if (ax < -(d.halfL + p.halfL + 2.5) || ax > 40 || (p.speed ?? 0) > 2) {
        car.pass = null;
        car.offTarget = 0;
      }
    }
    car.off += clamp(car.offTarget - car.off, -0.8 * car.v * dt, 0.8 * car.v * dt);

    acc = clamp(acc, -8.5, 2.4);
    car.a += (acc - car.a) * Math.min(1, dt * (acc < car.a ? 9 : 4));
    car.v = Math.max(0, car.v + car.a * dt);
    if (car.v < 0.03 && car.a <= 0) car.v = 0;
    car.braking = car.a < -0.5 || (car.v < 0.1 && (rule || blocker));
    if (car.a < -5.2 && car.v > 6 && car.squealT <= 0 && car.dist < 70) {
      car.squealT = 1.2;
      if (world.onSqueal) world.onSqueal(car);
    }
    car.squealT -= dt;
    car.s += car.v * dt;
    while (car.s > car.lane.len) {
      car.s -= car.lane.len;
      car.lane = car.plan.shift();
      car.stopT = 0;
      if (car.lane.kind === 'road') car.cleared = null;
      choosePlan(car);
    }
    const turnLane = car.lane.turn ? car.lane : car.lane.len - car.s < 32 && car.plan[0].turn ? car.plan[0] : null;
    car.signal = turnLane ? turnLane.turn : car.pass ? (car.offTarget < car.off - 0.2 ? -1 : car.offTarget > car.off + 0.2 ? 1 : 0) : 0;
    setPose(car);
    const want = Math.atan2(-pt.tz, pt.tx);
    car.steer += (clamp(wrap(want - car.yaw) * 1.6, -0.6, 0.6) - car.steer) * Math.min(1, dt * 8);
    pose(car, dt);
  }

  function physicsStep(car, dt) {
    const rb = car.rb;
    if (car.mode === 'drive') {
      if (!rb) return;
      if (car.hitForce > 160000 || (car.hitForce > 70000 && car.v < 3)) {
        car.mode = 'loose';
        car.restT = 0;
        rb.setBodyType(R.RigidBodyType.Dynamic, true);
        rb.setLinvel({ x: car.hx * car.v, y: 0, z: car.hz * car.v }, true);
        if (world.onCrash) world.onCrash(car);
        car.hitForce = 0;
        return;
      }
      car.hitForce = 0;
      const t = rb.translation();
      const k = 1 / Math.max(dt, 1 / 120);
      rb.setLinvel({ x: clamp((car.x - t.x) * k, -40, 40), y: clamp((car.y - t.y) * k, -10, 10), z: clamp((car.z - t.z) * k, -40, 40) }, true);
      const r = rb.rotation();
      q1.set(r.x, r.y, r.z, r.w);
      q2.copy(car.group.quaternion).multiply(q1.invert());
      if (q2.w < 0) q2.set(-q2.x, -q2.y, -q2.z, -q2.w);
      rb.setAngvel({ x: q2.x * 2 * k, y: q2.y * 2 * k, z: q2.z * 2 * k }, true);
      return;
    }
    const t = rb.translation();
    const r = rb.rotation();
    const lv = rb.linvel();
    const av = rb.angvel();
    car.group.position.set(t.x, t.y, t.z);
    car.group.quaternion.set(r.x, r.y, r.z, r.w);
    car.body.rotation.set(0, 0, 0);
    v3.set(1, 0, 0).applyQuaternion(car.group.quaternion);
    car.hx = v3.x;
    car.hz = v3.z;
    car.x = t.x;
    car.y = t.y;
    car.z = t.z;
    car.v = Math.hypot(lv.x, lv.z);
    car.yaw = Math.atan2(-v3.z, v3.x);
    car.spin -= ((lv.x * v3.x + lv.z * v3.z) * dt) / car.d.radius;
    car.braking = true;
    const up = v3.set(0, 1, 0).applyQuaternion(car.group.quaternion).y;
    if (car.mode === 'loose') {
      car.restT = car.v < 0.35 && Math.hypot(av.x, av.y, av.z) < 0.3 ? car.restT + dt : 0;
      if (car.restT < 1.3) return;
      let best = null;
      let bd = 81;
      let bs = 0;
      const ax = car.x + car.hx * car.d.wheelbase / 2;
      const az = car.z + car.hz * car.d.wheelbase / 2;
      for (const l of net.lanes) {
        for (let i = 0; i < l.n - 1; i++) {
          const tx = l.pts[i * 2 + 2] - l.pts[i * 2];
          const tz = l.pts[i * 2 + 3] - l.pts[i * 2 + 1];
          const tl = Math.hypot(tx, tz) || 1;
          const u = clamp(((ax - l.pts[i * 2]) * tx + (az - l.pts[i * 2 + 1]) * tz) / (tl * tl), 0, 1);
          const e = (l.pts[i * 2] + tx * u - ax) ** 2 + (l.pts[i * 2 + 1] + tz * u - az) ** 2;
          if (e < bd && (tx * car.hx + tz * car.hz) / tl > 0.25) {
            bd = e;
            best = l;
            bs = l.cum[i] + tl * u;
          }
        }
      }
      const ground = groundAt(car.x, car.y, car.z);
      if (best && up > 0.9 && Math.abs(car.y - ground) < 0.5) {
        rb.setBodyType(R.RigidBodyType.KinematicVelocityBased, true);
        car.mode = 'drive';
        car.lane = best;
        car.s = Math.min(best.len - 0.05, bs);
        car.plan.length = 0;
        choosePlan(car);
        car.fx = car.x + car.hx * car.d.wheelbase / 2;
        car.fz = car.z + car.hz * car.d.wheelbase / 2;
        car.rx = car.x - car.hx * car.d.wheelbase / 2;
        car.rz = car.z - car.hz * car.d.wheelbase / 2;
        lanePoint(best, car.s, pt);
        car.off = clamp(-(car.fx - pt.x) * pt.tz + (car.fz - pt.z) * pt.tx, -6, 6);
        car.offTarget = 0;
        car.v = 0;
        car.a = 0;
        car.yF = car.yR = car.y = ground;
        car.hitForce = 0;
        car.blockedT = 0;
        car.pass = null;
        car.cleared = null;
      } else {
        car.mode = 'wreck';
        car.wreckT = 0;
      }
      return;
    }
    car.wreckT += dt;
    if (car.wreckT > 40 && !car.seen && car.dist > 70) {
      removeBody(car);
      const spot = freeSpot(110);
      if (spot) place(car, spot.lane, spot.s);
      else car.wreckT = 30;
    }
  }

  function lamps(car) {
    const l = car.lamp;
    const on = blink < 0.5 ? 12 : 0;
    const hazard = car.mode !== 'drive';
    l[LAMP.TAIL] = car.braking ? 9 : 1.1;
    l[LAMP.LEFT] = hazard || car.signal < 0 ? on : 0;
    l[LAMP.RIGHT] = hazard || car.signal > 0 ? on : 0;
  }

  function update(dt) {
    frame++;
    if (warm > 0) {
      warm--;
      if (!cars.length) cars.push(build(0));
      const car = cars[0];
      if (!car.active) {
        if (warm > 0) {
          camera.getWorldDirection(v3);
          car.group.position.copy(camera.position).addScaledVector(v3, 9);
          car.group.position.y -= 3.2;
          car.group.visible = true;
          car.group.traverse((o) => {
            if (o.isMesh) o.frustumCulled = false;
          });
          wheels.count = 4;
          m4.compose(car.group.position, car.group.quaternion, s3.set(0.3, 0.3, 0.2));
          for (let i = 0; i < 4; i++) wheels.setMatrixAt(i, m4);
          wheels.instanceMatrix.needsUpdate = true;
        } else {
          car.group.visible = false;
          car.group.traverse((o) => {
            if (o.isMesh) o.frustumCulled = true;
          });
          wheels.count = 0;
        }
      }
      return;
    }
    if (frozen) return;
    blink = (blink + dt * 1.45) % 1;
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    let active = 0;
    for (const c of cars) if (c.active) active++;
    if (active < target && frame % 20 === 0) {
      const spot = freeSpot(active < 2 ? 40 : 95);
      if (spot) {
        let car = cars.find((c) => !c.active);
        if (!car && cars.length < MAX) {
          car = build(cars.length);
          cars.push(car);
        }
        if (car) place(car, spot.lane, spot.s);
      }
    }
    let w = 0;
    for (const car of cars) {
      if (!car.active) continue;
      car.dist = Math.hypot(car.x - camera.position.x, car.z - camera.position.z);
      sphere.center.set(car.x, car.y + 0.8, car.z);
      sphere.radius = 3.2;
      car.seen = car.dist < 420 && frustum.intersectsSphere(sphere);
      if (active > target && !car.seen && car.dist > 80 && car.mode !== 'loose') {
        removeBody(car);
        car.active = false;
        car.group.visible = false;
        active--;
        continue;
      }
      let near = Infinity;
      for (const v of world.vehicles) if (v.kind === 'fleet') near = Math.min(near, Math.hypot(car.x - v.x, car.z - v.z));
      near = Math.min(near, Math.hypot(car.x - world.player.x, car.z - world.player.z));
      if (!car.rb && near < 105) addBody(car);
      else if (car.rb && near > 125 && car.mode === 'drive') removeBody(car);
      if (car.mode === 'drive') {
        drive(car, dt);
        show(car, dt);
      }
      physicsStep(car, dt);
      lamps(car);
      const visible = car.dist < 420;
      if (car.group.visible !== visible) car.group.visible = visible;
      car.paint.castShadow = car.dist < 95;
      car.driverGroup.visible = car.dist < 48;
      const rec = car.rec;
      rec.x = car.x;
      rec.y = car.y;
      rec.z = car.z;
      rec.fx = car.hx;
      rec.fz = car.hz;
      rec.vx = car.hx * car.v;
      rec.vz = car.hz * car.v;
      rec.speed = car.v;
      if (car.rb && car.mode !== 'drive') {
        const lv = car.rb.linvel();
        rec.vx = lv.x;
        rec.vz = lv.z;
      }
      if (visible) w = wheelMatrices(car, w);
    }
    wheels.count = w;
    wheels.instanceMatrix.needsUpdate = true;
  }

  return {
    net,
    cars,
    update,
    get count() {
      return cars.reduce((n, c) => n + (c.active ? 1 : 0), 0);
    },
    records(out) {
      for (const c of cars) if (c.active) out.push(c.rec);
    },
    setTarget(n) {
      target = Math.min(MAX, n);
    },
    freeze(on) {
      frozen = on;
    },
    place(x, z, { type = null, speed = null } = {}) {
      let best = null;
      let bd = Infinity;
      let bs = 0;
      for (const l of net.lanes) {
        for (let i = 0; i < l.n; i++) {
          const e = (l.pts[i * 2] - x) ** 2 + (l.pts[i * 2 + 1] - z) ** 2;
          if (e < bd) {
            bd = e;
            best = l;
            bs = l.cum[i];
          }
        }
      }
      let car = cars.find((c) => !c.active && (!type || c.type === type));
      while (!car && cars.length < MAX) {
        const made = build(cars.length);
        cars.push(made);
        if (!type || made.type === type) car = made;
      }
      if (!car) car = cars.find((c) => !type || c.type === type) || cars[0];
      removeBody(car);
      place(car, best, bs);
      if (speed !== null) car.v = speed;
      return car;
    },
    clear() {
      for (const c of cars) {
        removeBody(c);
        c.active = false;
        c.group.visible = false;
      }
      wheels.count = 0;
    },
  };
}
