// Costa del Gzowo: persistent vehicle damage (dents and crumple, scratches, cracked and shattered glass, broken lamps, loose and torn-off bumpers, hood, trunk and doors, bent and lost wheels, engine fire ending in a blow-up) and full repair.
import * as THREE from 'three';
import { GROUPS, groups } from '../core/physics.js';

const DETACH = {
  frontBumper: { half: [0.2, 0.22, 0.85], mass: 9, label: 'Front bumper' },
  rearBumper: { half: [0.2, 0.22, 0.85], mass: 9, label: 'Rear bumper' },
  hood: { half: [0.55, 0.04, 0.75], mass: 14, label: 'Hood' },
  trunk: { half: [0.42, 0.04, 0.7], mass: 11, label: 'Trunk lid' },
  doorFL: { half: [0.55, 0.32, 0.07], mass: 24, label: 'Door' },
  doorFR: { half: [0.55, 0.32, 0.07], mass: 24, label: 'Door' },
};
const GLASS = ['windshield', 'rearGlass', 'winFL', 'winFR', 'winRL', 'winRR'];
const rnd = (a) => (Math.random() - 0.5) * 2 * a;

export function createCarDamage({ physics, scene, model, car, particles, audio }) {
  const state = { health: 1, front: 0, rear: 0, left: 0, right: 0, hoodOpen: 0, trunkOpen: 0, steerBias: 0, hits: 0, lastHit: 0, note: '', burning: 0, exploded: false };
  const parts = {};
  for (const name of [...Object.keys(DETACH), 'mirrorL', 'mirrorR']) parts[name] = { damage: 0, gone: false, home: null };
  const pivotRest = {};
  for (const [name, pivot] of Object.entries(model.pivots)) pivotRest[name] = { position: pivot.position.clone(), quaternion: pivot.quaternion.clone() };
  const wheelRest = model.wheels.map((w) => ({ x: w.group.position.x, y: w.group.position.y, z: w.group.position.z }));
  const wheelDamage = model.wheels.map(() => 0);
  const debris = [];
  const pending = [];
  const cool = new Map();
  const local = new THREE.Vector3();
  const dirLocal = new THREE.Vector3();
  const v = new THREE.Vector3();
  const rest = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const p3 = new THREE.Vector3();
  const q4 = new THREE.Quaternion();
  const s3 = new THREE.Vector3();
  const R = physics.RAPIER;
  let time = 0;
  let scrape = 0;
  let smolder = 0;

  function onContact(otherHandle, event) {
    const force = event.totalForceMagnitude();
    const dv = (force * physics.dt) / car.mass;
    const other = physics.world.getCollider(otherHandle);
    if (!other) return;
    const kind = physics.surfaces.get(otherHandle) || 'terrain';
    const d = event.maxForceDirection();
    let point = null;
    for (const c of car.colliders) {
      physics.world.contactPair(c, other, (manifold) => {
        if (point || manifold.numSolverContacts() === 0) return;
        const p = manifold.solverContactPoint(0);
        point = new THREE.Vector3(p.x, p.y, p.z);
      });
      if (point) break;
    }
    if (!point) return;
    pending.push({ dv, point, dir: new THREE.Vector3(d.x, d.y, d.z), kind, otherHandle });
  }
  for (const c of car.colliders) physics.onContact(c, onContact);

  function stamp(restPos, proj, amount, slide) {
    const g = model.damageCtx;
    let u;
    let w;
    if (proj < 0.5) [u, w] = [(restPos.x / 5 + 0.5) * 0.5, (restPos.y / 1.5) * 0.5];
    else if (proj < 1.5) [u, w] = [(restPos.x / 5 + 0.5) * 0.5 + 0.5, (restPos.y / 1.5) * 0.5];
    else if (proj < 2.5) [u, w] = [(restPos.x / 5 + 0.5) * 0.5, (restPos.z / 2 + 0.5) * 0.5 + 0.5];
    else [u, w] = [(restPos.z / 2 + 0.5) * 0.25 + (restPos.x > 0 ? 0.5 : 0.75), (restPos.y / 1.5) * 0.5 + 0.5];
    const cx = u * 1024;
    const cy = (1 - w) * 1024;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const n = 3 + Math.floor(amount * 16);
    const angle = slide + (Math.random() - 0.5) * 0.3;
    for (let i = 0; i < n; i++) {
      const len = (8 + Math.random() * 34) * (0.5 + amount);
      const ox = (Math.random() - 0.5) * 36 * (0.4 + amount);
      const oy = (Math.random() - 0.5) * 22 * (0.4 + amount);
      const a = angle + (Math.random() - 0.5) * 0.5;
      g.strokeStyle = `rgba(${Math.floor(110 + Math.random() * 145)}, ${Math.floor(Math.random() * 60)}, 0, ${0.35 + amount * 0.5})`;
      g.lineWidth = 0.6 + Math.random() * (1 + amount * 3);
      g.beginPath();
      g.moveTo(cx + ox - Math.cos(a) * len * 0.5, cy + oy - Math.sin(a) * len * 0.5);
      g.lineTo(cx + ox + Math.cos(a) * len * 0.5, cy + oy + Math.sin(a) * len * 0.5);
      g.stroke();
    }
    const blot = g.createRadialGradient(cx, cy, 0, cx, cy, 26 + amount * 40);
    blot.addColorStop(0, `rgba(${Math.floor(amount * 120)}, ${Math.floor(40 + amount * 90)}, 0, 0.5)`);
    blot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = blot;
    g.fillRect(cx - 70, cy - 70, 140, 140);
    g.restore();
    model.damageTexture.needsUpdate = true;
  }

  function dent(worldPoint, worldDir, depth) {
    const radius = 0.34 + depth * 1.7;
    let nearest = null;
    let nearestDist = Infinity;
    for (const [name, mesh] of Object.entries(model.panels)) {
      if (!mesh.parent || mesh.userData.detached || !mesh.visible) continue;
      let visible = true;
      for (let o = mesh.parent; o && o !== model.group; o = o.parent) if (!o.visible) visible = false;
      if (!visible) continue;
      mesh.updateWorldMatrix(true, false);
      inv.copy(mesh.matrixWorld).invert();
      local.copy(worldPoint).applyMatrix4(inv);
      const geo = mesh.geometry;
      if (!geo.boundingSphere || local.distanceTo(geo.boundingSphere.center) > geo.boundingSphere.radius + radius) continue;
      dirLocal.copy(worldDir).transformDirection(inv);
      const pos = geo.attributes.position;
      const restAttr = geo.attributes.aRest;
      let touched = false;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const dist = v.distanceTo(local);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = { rest: new THREE.Vector3().fromBufferAttribute(restAttr, i), proj: geo.attributes.aProj.getX(i), name };
        }
        if (dist > radius) continue;
        const f = 1 - dist / radius;
        const k = f * f * (3 - 2 * f);
        const jitter = 0.7 + 0.6 * Math.abs(Math.sin(i * 12.9898 + depth * 78.233));
        v.addScaledVector(dirLocal, depth * k * jitter);
        v.y += Math.sin(i * 7.31 + depth * 41.7) * depth * k * 0.22;
        rest.fromBufferAttribute(restAttr, i);
        const off = v.clone().sub(rest);
        const limit = 0.56;
        if (off.length() > limit) v.copy(rest).addScaledVector(off.normalize(), limit);
        if (Math.abs(v.z) < 0.25 && Math.abs(rest.z) > 0.5) v.z = Math.sign(rest.z) * 0.25;
        pos.setXYZ(i, v.x, v.y, v.z);
        touched = true;
      }
      if (touched) {
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      }
    }
    return nearest;
  }

  function fling(object, half, mass, velocity, spin = 6, collider = null) {
    object.updateWorldMatrix(true, false);
    object.matrixWorld.decompose(p3, q4, s3);
    const home = { parent: object.parent, position: object.position.clone(), quaternion: object.quaternion.clone() };
    scene.add(object);
    object.position.copy(p3);
    object.quaternion.copy(q4);
    object.traverse((o) => (o.userData.detached = true));
    const lv = car.body.linvel();
    const body = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p3.x, p3.y, p3.z).setRotation(q4).setLinvel(lv.x + velocity.x, lv.y + velocity.y, lv.z + velocity.z).setAngvel({ x: rnd(spin), y: rnd(spin), z: rnd(spin) }).setLinearDamping(0.1).setAngularDamping(0.4));
    const shape = collider || R.ColliderDesc.cuboid(...half);
    const handle = physics.world.createCollider(shape.setMass(mass).setFriction(0.6).setRestitution(0.25).setCollisionGroups(groups(GROUPS.DEBRIS, GROUPS.WORLD | GROUPS.PROP)), body);
    physics.surfaces.set(handle.handle, 'metal');
    debris.push({ object, body, home });
    return home;
  }

  function detach(name, extraVelocity) {
    const cfg = DETACH[name];
    const pivot = model.pivots[name];
    if (!cfg || !pivot || parts[name].gone) return;
    parts[name].gone = true;
    if (model.setDoorGone && name.startsWith('door')) model.setDoorGone(name, true);
    fling(pivot, cfg.half, cfg.mass, v.copy(extraVelocity).setY(extraVelocity.y + 1.2).clone());
    state.note = `${cfg.label} torn off`;
    if (audio) audio.crash(5, 'metal', p3);
  }

  function dropMirror(tag) {
    const key = 'mirror' + tag;
    if (parts[key].gone || parts['doorF' + tag].gone) return;
    const mirror = model.mirrors[tag === 'L' ? 0 : 1];
    if (!mirror) return;
    parts[key].gone = true;
    fling(mirror, null, 1.2, new THREE.Vector3(0, 1.5, 0), 5, R.ColliderDesc.ball(0.08));
  }

  function loseWheel(i) {
    const w = car.wheels[i];
    if (w.gone) return;
    w.gone = true;
    const side = car.right ? v.copy(car.right) : v.set(0, 0, 1).applyQuaternion(model.group.quaternion);
    const push = side.multiplyScalar(w.side * 3.2).setY(2.4).clone();
    fling(w.visual.group, null, 18, push, 9, R.ColliderDesc.cylinder(0.12, 0.33).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }).setFriction(0.9).setRestitution(0.5));
    state.note = 'Wheel torn off';
    if (audio) audio.crash(7, 'metal', p3);
    if (particles) particles.burstSparks(p3, 30, new THREE.Vector3(0, 1, 0), 6);
  }

  function crack(name, amount) {
    const m = model.glassMaterials[name];
    if (!m || m.userData.gone) return;
    const u = m.userData.uniforms.uCrack;
    u.value = Math.min(1, u.value + amount);
    if (amount > 0.2 && audio) audio.glass(amount);
  }

  function shatter(name, worldPoint) {
    const m = model.glassMaterials[name];
    if (!m || m.userData.gone) return;
    m.userData.gone = true;
    m.visible = false;
    const w = model.windows[name];
    if (w) w.userData.broken = true;
    if (particles) particles.burstChips(worldPoint, 90, [1.4, 1.6, 1.7], 6);
    if (audio) audio.glass(1);
  }

  function breakLamp(which, side, point) {
    const lamp = which === 'head' ? model.headBroken : model.tailBroken;
    if (lamp[side] >= 1) return;
    lamp[side] = 1;
    if (particles) {
      particles.burstChips(point, 26, which === 'head' ? [1.5, 1.5, 1.4] : [1.3, 0.12, 0.08], 4);
      particles.burstSparks(point, 10, new THREE.Vector3(0, 1, 0), 3);
    }
    if (audio) audio.glass(0.5);
  }

  function shove(name, dx, tilt) {
    const pivot = model.pivots[name];
    const home = pivotRest[name];
    if (!pivot || !home || parts[name].gone) return;
    pivot.position.x = THREE.MathUtils.clamp(pivot.position.x + dx, home.position.x - 0.16, home.position.x + 0.16);
    pivot.position.y = THREE.MathUtils.clamp(pivot.position.y + rnd(tilt * 0.25), home.position.y - 0.05, home.position.y + 0.04);
    pivot.rotation.y = THREE.MathUtils.clamp(pivot.rotation.y + rnd(tilt), -0.14, 0.14);
    pivot.rotation.z = THREE.MathUtils.clamp(pivot.rotation.z + rnd(tilt * 0.8), -0.12, 0.12);
  }

  function hitWheel(dv, severity) {
    let best = -1;
    let bestD = 0.85;
    car.wheels.forEach((w, i) => {
      if (w.gone) return;
      const d = Math.hypot(local.x - w.lx, local.z - w.lz);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0 || dv < 3.8 || local.y > 0.95) return;
    const w = car.wheels[best];
    wheelDamage[best] += severity * (1.2 - bestD);
    w.camber = THREE.MathUtils.clamp(w.camber - w.side * severity * 0.22, -0.34, 0.34);
    w.toe = THREE.MathUtils.clamp(w.toe + rnd(severity * 0.12), -0.14, 0.14);
    if (w.front) state.steerBias = THREE.MathUtils.clamp(state.steerBias + w.toe * 0.25, -0.08, 0.08);
    if (wheelDamage[best] > 1.25 && dv > 7.5) loseWheel(best);
  }

  function explode() {
    if (state.exploded) return;
    state.exploded = true;
    state.health = 0;
    state.hits++;
    state.lastHit = time;
    const center = new THREE.Vector3(1.2, 0.9, 0).applyQuaternion(model.group.quaternion).add(model.group.position);
    const up = new THREE.Vector3(0, 1, 0);
    if (particles) {
      particles.burstSparks(center, 160, up, 15);
      particles.burstChips(center, 110, [0.12, 0.11, 0.1], 10);
      for (let i = 0; i < 14; i++) {
        v.copy(center).add(s3.set(rnd(1.4), Math.random() * 1.2, rnd(1.4)));
        particles.puff(v, [0.05, 0.045, 0.04], 0.78, 1.1 + Math.random(), 3.6, 2.6, 2.4);
      }
      for (let i = 0; i < 150; i++) {
        v.copy(center).add(s3.set(rnd(1.6), Math.random() * 1.5, rnd(1.6)));
        particles.flame(v, 0.6 + Math.random() * 0.7, 1.7);
      }
    }
    for (const name of GLASS) shatter(name, center);
    breakLamp('head', 'x', center);
    breakLamp('head', 'y', center);
    model.tailBroken.set(1, 1);
    detach('hood', new THREE.Vector3(rnd(2), 8, rnd(2)));
    detach('frontBumper', new THREE.Vector3(rnd(3), 3, rnd(3)));
    const side = new THREE.Vector3(0, 0, 1).applyQuaternion(model.group.quaternion);
    detach('doorFL', side.clone().multiplyScalar(-5).setY(3));
    detach('doorFR', side.clone().multiplyScalar(5).setY(3));
    detach('trunk', new THREE.Vector3(rnd(2), 6, rnd(2)));
    car.body.applyImpulse({ x: rnd(car.mass * 1.2), y: car.mass * 4.6, z: rnd(car.mass * 1.2) }, true);
    car.body.applyTorqueImpulse({ x: rnd(car.mass * 1.4), y: rnd(car.mass * 0.8), z: rnd(car.mass * 1.4) }, true);
    for (let i = 0; i < 26; i++) stamp(new THREE.Vector3(rnd(2.4), Math.random() * 1.2, rnd(0.9)), Math.floor(Math.random() * 4), 1, Math.random() * 6);
    if (model.paintUniforms.uDirt) model.paintUniforms.uDirt.value = 1;
    model.materials.char.value = 1;
    model.materials.leather.color.setScalar(0.1);
    if (audio) {
      audio.crash(16, 'metal', center);
      audio.glass(1);
    }
    smolder = 26;
    state.note = 'Car wrecked';
  }

  function repair() {
    for (const d of debris) {
      physics.world.removeRigidBody(d.body);
      d.home.parent.add(d.object);
      d.object.position.copy(d.home.position);
      d.object.quaternion.copy(d.home.quaternion);
      d.object.traverse((o) => (o.userData.detached = false));
    }
    debris.length = 0;
    for (const [name, pivot] of Object.entries(model.pivots)) {
      if (!pivotRest[name]) continue;
      pivot.position.copy(pivotRest[name].position);
      pivot.quaternion.copy(pivotRest[name].quaternion);
    }
    for (const name of Object.keys(parts)) {
      parts[name].damage = 0;
      parts[name].gone = false;
      if (model.setDoorGone && name.startsWith('door')) model.setDoorGone(name, false);
    }
    car.wheels.forEach((w, i) => {
      w.gone = false;
      w.camber = 0;
      w.toe = 0;
      wheelDamage[i] = 0;
      w.visual.group.position.set(wheelRest[i].x, wheelRest[i].y, wheelRest[i].z);
      w.visual.group.rotation.set(0, 0, 0);
    });
    for (const mesh of Object.values(model.panels)) {
      const pos = mesh.geometry.attributes.position;
      const restAttr = mesh.geometry.attributes.aRest;
      if (!restAttr) continue;
      pos.array.set(restAttr.array);
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    for (const name of GLASS) {
      const m = model.glassMaterials[name];
      if (!m) continue;
      m.userData.gone = false;
      m.visible = true;
      m.userData.uniforms.uCrack.value = 0;
      if (model.windows[name]) model.windows[name].userData.broken = false;
    }
    model.headBroken.set(0, 0);
    model.tailBroken.set(0, 0);
    model.damageCtx.globalCompositeOperation = 'source-over';
    model.damageCtx.fillStyle = '#000';
    model.damageCtx.fillRect(0, 0, 1024, 1024);
    model.damageTexture.needsUpdate = true;
    if (model.paintUniforms.uDirt) model.paintUniforms.uDirt.value = 0.05;
    model.materials.char.value = 0;
    model.materials.leather.color.setScalar(1);
    Object.assign(state, { health: 1, front: 0, rear: 0, left: 0, right: 0, hoodOpen: 0, trunkOpen: 0, steerBias: 0, note: '', burning: 0, exploded: false });
    smolder = 0;
    car.state.stalled = false;
    car.state.steerBias = 0;
    car.state.powerScale = 1;
  }

  function process(hit) {
    const { dv, point, dir, kind } = hit;
    const key = Math.round(point.x * 2) + ':' + Math.round(point.y * 2) + ':' + Math.round(point.z * 2);
    const last = cool.get(key) || -1;
    const fresh = time - last > 0.12;
    local.copy(point);
    model.group.worldToLocal(local);
    const sliding = car.state.speed;
    if (dv < 0.6) {
      if (sliding > 1.5 && kind !== 'plastic' && kind !== 'soft') {
        scrape = Math.min(1, scrape + 0.3);
        if (particles && (kind === 'concrete' || kind === 'metal' || kind === 'asphalt' || kind === 'rock') && Math.random() < 0.5) particles.burstSparks(point, 2, car.velocity.clone().normalize(), sliding * 0.6);
        if (fresh && Math.random() < 0.3) {
          const nearest = dent(point, dir, 0);
          if (nearest) stamp(nearest.rest, nearest.proj, 0.12, Math.random() * 3);
          cool.set(key, time);
        }
      }
      return;
    }
    if (!fresh) return;
    cool.set(key, time);
    const soft = kind === 'plastic' || kind === 'soft' || kind === 'rubber';
    const severity = Math.min(1, (dv - 0.6) / 9) * (soft ? 0.25 : 1);
    const depth = Math.min(0.46, (dv - 0.6) * 0.056) * (soft ? 0.2 : 1);
    const inward = dir.clone();
    const toCenter = car.position.clone().add(new THREE.Vector3(0, 0.6, 0)).sub(point).normalize();
    if (inward.dot(toCenter) < 0) inward.negate();
    inward.lerp(toCenter, 0.35).normalize();
    const nearest = dent(point, inward, depth);
    if (nearest) stamp(nearest.rest, nearest.proj, 0.2 + severity * 0.8, Math.atan2(car.velocity.y, 1) + Math.random());
    state.hits++;
    state.lastHit = time;
    const frontHit = local.x > 1.3;
    const rearHit = local.x < -1.5;
    if (frontHit) state.front += severity;
    else if (rearHit) state.rear += severity;
    else if (local.z < 0) state.left += severity;
    else state.right += severity;
    if (audio) audio.crash(dv, kind, point);
    if (particles && !soft) {
      particles.burstSparks(point, Math.floor(6 + severity * 40), inward.clone().negate(), 3 + dv * 0.6);
      particles.burstChips(point, Math.floor(4 + severity * 26), [0.55, 0.16, 0.04], 2 + dv * 0.45);
      particles.puff(point, [0.5, 0.48, 0.44], 0.35, 0.5, 1.2);
    }
    if (soft || state.exploded) return;
    state.health -= severity * (frontHit ? 0.1 : 0.06);
    hitWheel(dv, severity);
    if (frontHit) {
      parts.frontBumper.damage += severity;
      if (dv > 2.6) shove('frontBumper', -severity * 0.06, severity * 0.07);
      if (dv > 2.2 && Math.abs(local.z) > 0.4) breakLamp('head', local.z < 0 ? 'x' : 'y', point);
      if (dv > 4.5) {
        state.hoodOpen = Math.max(state.hoodOpen, Math.min(0.5, 0.14 + severity * 0.5));
        state.health -= severity * 0.16;
        parts.hood.damage += severity;
        crack('windshield', severity * 0.6);
      }
      if (dv > 6 && Math.random() < 0.7) state.steerBias += rnd(0.03);
      if (parts.frontBumper.damage > 0.9 && dv > 3.5) detach('frontBumper', inward.clone().multiplyScalar(-2));
      if (parts.hood.damage > 1.5 && dv > 8) {
        detach('hood', new THREE.Vector3(0, 4, 0));
        state.hoodOpen = 0;
      }
    } else if (rearHit) {
      parts.rearBumper.damage += severity;
      parts.trunk.damage += severity * 0.7;
      if (dv > 2.6) shove('rearBumper', severity * 0.06, severity * 0.07);
      if (dv > 2.2) breakLamp('tail', local.z < 0 ? 'x' : 'y', point);
      if (dv > 5) state.trunkOpen = Math.max(state.trunkOpen, Math.min(0.42, 0.12 + severity * 0.4));
      if (parts.rearBumper.damage > 0.9 && dv > 3.5) detach('rearBumper', inward.clone().multiplyScalar(-2));
      if (parts.trunk.damage > 1.4 && dv > 7.5 && model.roof.value === model.roof.target) detach('trunk', new THREE.Vector3(0, 4, 0));
    } else {
      const tag = local.z < 0 ? 'L' : 'R';
      const door = parts['doorF' + tag];
      if (dv > 2.6 && local.x > 0.5 && local.y > 0.7) dropMirror(tag);
      if (local.x > -1.0 && local.x < 1.0) {
        door.damage += severity;
        if (door.damage > 1.5 && dv > 6.5) detach('doorF' + tag, new THREE.Vector3(0, 0, 1).applyQuaternion(model.group.quaternion).multiplyScalar(tag === 'L' ? -3 : 3));
      }
      if (dv > 4) {
        crack('winF' + tag, severity);
        crack('winR' + tag, severity * 0.7);
      }
      if (dv > 7) {
        shatter('winF' + tag, point);
        shatter('winR' + tag, point);
      }
    }
    if (local.y > 0.95 || dv > 7.5) crack('windshield', severity * 0.8);
    if (model.glassMaterials.windshield.userData.uniforms.uCrack.value >= 1 && dv > 8) shatter('windshield', point);
    if (dv > 6) crack('rearGlass', severity);
    state.health = Math.max(0.05, state.health);
    state.note = state.health < 0.3 ? 'Engine on fire' : state.health < 0.45 ? 'Engine damaged' : 'Bodywork damaged';
  }

  const smokeAt = new THREE.Vector3();
  const engine = (spread) => smokeAt.set(1.5 + rnd(0.35), 0.92, rnd(spread)).applyQuaternion(model.group.quaternion).add(model.group.position);
  const wreck = (spread) => smokeAt.set(rnd(1.7), 0.75, rnd(spread)).applyQuaternion(model.group.quaternion).add(model.group.position);
  return {
    state,
    parts,
    repair,
    explode,
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) if (!state.remote) process(hit);
      scrape = Math.max(0, scrape - dt * 2.5);
      if (audio) audio.setScrape(scrape * Math.min(1, car.state.speed / 8));
      const speed = car.state.speed;
      if (!parts.hood.gone) {
        const flutter = state.hoodOpen > 0.05 ? Math.sin(time * 23) * 0.012 * Math.min(1, speed / 20) : 0;
        if (state.hoodOpen > 0.3 && speed > 31) {
          detach('hood', new THREE.Vector3(0, 6, 0));
          state.hoodOpen = 0;
        } else model.pivots.hood.rotation.z = state.hoodOpen + flutter;
      }
      if (!parts.trunk.gone && model.roof.value === model.roof.target && state.trunkOpen > 0) model.pivots.trunk.rotation.z = Math.max(model.pivots.trunk.rotation.z, state.trunkOpen);
      if (!parts.frontBumper.gone && parts.frontBumper.damage > 0.45) model.pivots.frontBumper.rotation.x = 0.07 + Math.sin(time * 17) * 0.004 * Math.min(1, speed / 10);
      if (!parts.rearBumper.gone && parts.rearBumper.damage > 0.45) model.pivots.rearBumper.rotation.x = -0.06;
      if (model.setDoorSlack) {
        for (const tag of ['L', 'R']) {
          const door = parts['doorF' + tag];
          if (door.gone || door.damage < 0.6) continue;
          const loose = Math.min(0.55, (door.damage - 0.6) * 0.5);
          model.setDoorSlack('doorF' + tag, loose * (0.35 + 0.65 * Math.abs(Math.sin(time * 2.3 + (tag === 'L' ? 0 : 1.7))) * Math.min(1, 0.25 + speed / 12)));
        }
      }
      car.state.powerScale = state.exploded ? 0 : 0.45 + 0.55 * state.health;
      car.state.steerBias = state.steerBias;
      if (state.exploded) {
        car.state.stalled = true;
        smolder = Math.max(0, smolder - dt);
        if (particles && smolder > 0 && Math.random() < dt * 16) particles.puff(wreck(0.9), [0.05, 0.05, 0.05], 0.55, 0.6, 3, 1.8, 0.5);
        if (particles && smolder > 8) {
          const rate = Math.min(1, (smolder - 8) / 10);
          const want = dt * 260 * rate;
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(wreck(0.8), 0.26 + rate * 0.22, 1);
        }
      } else if (state.health < 0.3) {
        state.burning += dt;
        const grow = Math.min(1, state.burning / 7);
        model.materials.char.value = Math.max(model.materials.char.value, grow * 0.55);
        if (particles) {
          const want = dt * (90 + 130 * grow);
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(engine(0.7), 0.24 + grow * 0.2, 1);
          if (Math.random() < dt * 22) particles.puff(engine(0.8).setY(smokeAt.y + 0.5 + grow * 0.5), [0.045, 0.045, 0.045], 0.55, 0.5, 2.8, 2.0, 0.4);
          if (Math.random() < dt * 6) particles.burstSparks(engine(0.6), 3, new THREE.Vector3(0, 1, 0), 3);
        }
        state.note = 'Engine on fire';
        if (state.burning > 9) explode();
      } else if (state.health < 0.72 && particles && car.state.engineOn && Math.random() < dt * (state.health < 0.45 ? 30 : 9)) {
        const dark = state.health < 0.45 ? 0.07 : 0.55;
        particles.puff(engine(0.8), [dark, dark, dark], state.health < 0.45 ? 0.5 : 0.3, 0.35, 2.2, 1.4, 0.3);
      }
      for (const d of debris) {
        if (d.body.isSleeping()) continue;
        const t = d.body.translation();
        const r = d.body.rotation();
        d.object.position.set(t.x, t.y, t.z);
        d.object.quaternion.set(r.x, r.y, r.z, r.w);
      }
    },
  };
}
