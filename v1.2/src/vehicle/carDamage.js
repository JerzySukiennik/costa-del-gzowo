// Costa del Gzowo: persistent vehicle damage (mesh dents, paint scratches, cracked glass, broken lights, loose and detached panels, engine health).
import * as THREE from 'three';
import { GROUPS, groups } from '../core/physics.js';

const DETACH = {
  frontBumper: { half: [0.2, 0.22, 0.85], mass: 9 },
  rearBumper: { half: [0.2, 0.22, 0.85], mass: 9 },
  hood: { half: [0.55, 0.04, 0.75], mass: 14 },
};

export function createCarDamage({ physics, scene, model, car, particles, audio }) {
  const state = { health: 1, front: 0, rear: 0, left: 0, right: 0, hoodOpen: 0, trunkOpen: 0, steerBias: 0, hits: 0, lastHit: 0, note: '' };
  const parts = { frontBumper: { damage: 0, gone: false }, rearBumper: { damage: 0, gone: false }, hood: { damage: 0, gone: false }, mirrorL: { gone: false }, mirrorR: { gone: false } };
  const debris = [];
  const pending = [];
  const cool = new Map();
  const local = new THREE.Vector3();
  const dirLocal = new THREE.Vector3();
  const v = new THREE.Vector3();
  const rest = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const R = physics.RAPIER;
  let time = 0;
  let scrape = 0;

  function onContact(otherHandle, event) {
    const force = event.totalForceMagnitude();
    const dv = (force * physics.dt) / car.mass;
    const other = physics.world.getCollider(otherHandle);
    if (!other) return;
    const kind = physics.surfaces.get(otherHandle) || 'terrain';
    const d = event.maxForceDirection();
    let point = null;
    for (const c of car.colliders) {
      physics.world.contactPair(c, other, (manifold, flipped) => {
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
    const radius = 0.32 + depth * 1.6;
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
        const jitter = 0.75 + 0.5 * Math.abs(Math.sin(i * 12.9898 + depth * 78.233));
        v.addScaledVector(dirLocal, depth * k * jitter);
        rest.fromBufferAttribute(restAttr, i);
        const off = v.clone().sub(rest);
        const limit = 0.42;
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

  function detach(name, extraVelocity) {
    const cfg = DETACH[name];
    const pivot = model.pivots[name];
    if (!cfg || !pivot || parts[name].gone) return;
    parts[name].gone = true;
    pivot.updateWorldMatrix(true, false);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    pivot.matrixWorld.decompose(p, q, s);
    scene.add(pivot);
    pivot.position.copy(p);
    pivot.quaternion.copy(q);
    pivot.traverse((o) => (o.userData.detached = true));
    const lv = car.body.linvel();
    const body = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(q).setLinvel(lv.x + extraVelocity.x, lv.y + extraVelocity.y + 1.2, lv.z + extraVelocity.z).setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }).setLinearDamping(0.1).setAngularDamping(0.4));
    const collider = physics.world.createCollider(R.ColliderDesc.cuboid(...cfg.half).setMass(cfg.mass).setFriction(0.6).setRestitution(0.2).setCollisionGroups(groups(GROUPS.DEBRIS, GROUPS.WORLD | GROUPS.PROP)), body);
    physics.surfaces.set(collider.handle, 'metal');
    debris.push({ object: pivot, body });
    state.note = `${name === 'hood' ? 'Hood' : name === 'frontBumper' ? 'Front bumper' : 'Rear bumper'} torn off`;
  }

  function dropMirror(tag) {
    const key = 'mirror' + tag;
    if (parts[key].gone) return;
    const mirror = model.mirrors[tag === 'L' ? 0 : 1];
    if (!mirror) return;
    parts[key].gone = true;
    mirror.updateWorldMatrix(true, false);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    mirror.matrixWorld.decompose(p, q, s);
    scene.add(mirror);
    mirror.position.copy(p);
    mirror.quaternion.copy(q);
    const lv = car.body.linvel();
    const body = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(q).setLinvel(lv.x * 0.7, lv.y + 1.5, lv.z * 0.7).setAngvel({ x: 3, y: 5, z: 2 }));
    physics.world.createCollider(R.ColliderDesc.ball(0.08).setMass(1.2).setRestitution(0.3).setCollisionGroups(groups(GROUPS.DEBRIS, GROUPS.WORLD)), body);
    debris.push({ object: mirror, body });
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
    if (particles) particles.burstChips(worldPoint, 60, [1.4, 1.6, 1.7], 5);
    if (audio) audio.glass(1);
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
    const depth = Math.min(0.32, (dv - 0.6) * 0.042) * (soft ? 0.2 : 1);
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
      particles.burstSparks(point, Math.floor(4 + severity * 26), inward.clone().negate(), 3 + dv * 0.5);
      particles.burstChips(point, Math.floor(3 + severity * 18), [0.55, 0.16, 0.04], 2 + dv * 0.4);
      particles.puff(point, [0.5, 0.48, 0.44], 0.35, 0.5, 1.2);
    }
    if (soft) return;
    if (frontHit) {
      parts.frontBumper.damage += severity;
      if (dv > 2.2 && Math.abs(local.z) > 0.4) model.headBroken[local.z < 0 ? 'x' : 'y'] = 1;
      if (dv > 4.5) {
        state.hoodOpen = Math.max(state.hoodOpen, Math.min(0.5, 0.14 + severity * 0.5));
        state.health -= severity * 0.22;
        parts.hood.damage += severity;
        crack('windshield', severity * 0.6);
      }
      if (dv > 6 && Math.random() < 0.7) state.steerBias += (Math.random() - 0.5) * 0.03;
      if (parts.frontBumper.damage > 0.9 && dv > 3.5) detach('frontBumper', inward.clone().multiplyScalar(-2));
      if (parts.hood.damage > 1.5 && dv > 8) {
        detach('hood', new THREE.Vector3(0, 4, 0));
        state.hoodOpen = 0;
      }
    } else if (rearHit) {
      parts.rearBumper.damage += severity;
      if (dv > 2.2) model.tailBroken[local.z < 0 ? 'x' : 'y'] = 1;
      if (dv > 5) state.trunkOpen = Math.max(state.trunkOpen, Math.min(0.42, 0.12 + severity * 0.4));
      if (parts.rearBumper.damage > 0.9 && dv > 3.5) detach('rearBumper', inward.clone().multiplyScalar(-2));
    } else {
      const tag = local.z < 0 ? 'L' : 'R';
      if (dv > 2.6 && local.x > 0.5 && local.y > 0.7) dropMirror(tag);
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
    state.health = Math.max(0.12, state.health);
    state.note = state.health < 0.45 ? 'Engine damaged' : state.hits > 0 ? 'Bodywork damaged' : '';
  }

  const smokeAt = new THREE.Vector3();
  return {
    state,
    parts,
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) process(hit);
      scrape = Math.max(0, scrape - dt * 2.5);
      if (audio) audio.setScrape(scrape * Math.min(1, car.state.speed / 8));
      if (!parts.hood.gone) {
        const flutter = state.hoodOpen > 0.05 ? Math.sin(time * 23) * 0.012 * Math.min(1, car.state.speed / 20) : 0;
        model.pivots.hood.rotation.z = state.hoodOpen + flutter;
      }
      if (model.roof.value === model.roof.target && state.trunkOpen > 0) model.pivots.trunk.rotation.z = Math.max(model.pivots.trunk.rotation.z, state.trunkOpen);
      if (!parts.frontBumper.gone && parts.frontBumper.damage > 0.45) model.pivots.frontBumper.rotation.x = 0.07 + Math.sin(time * 17) * 0.004 * Math.min(1, car.state.speed / 10);
      if (!parts.rearBumper.gone && parts.rearBumper.damage > 0.45) model.pivots.rearBumper.rotation.x = -0.06;
      car.state.powerScale = 0.5 + 0.5 * state.health;
      car.state.steerBias = state.steerBias;
      if (state.health < 0.72 && particles && car.state.engineOn && Math.random() < dt * (state.health < 0.4 ? 30 : 9)) {
        smokeAt.set(1.5, 0.95, (Math.random() - 0.5) * 0.8).applyQuaternion(model.group.quaternion).add(model.group.position);
        const dark = state.health < 0.4 ? 0.07 : 0.55;
        particles.puff(smokeAt, [dark, dark, dark], state.health < 0.4 ? 0.5 : 0.3, 0.35, 2.2, 1.4, 0.3);
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
