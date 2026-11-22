// Costa del Gzowo boats: persistent boat damage (crushed bow and dented sides, scrapes and gouges, cracked then shattered glass, broken lamps, bent and torn-off foils, motors and fittings that float or sink, holed hulls that flood and sink, engine fire ending in a blow-up) and full repair.
import * as THREE from 'three';
import { GROUPS, groups } from '../../core/physics.js';
import { CH } from './boatMaterials.js';

const NET_PARTS = ['frontBumper', 'rearBumper', 'hood', 'trunk', 'doorFL', 'doorFR'];
const UP = new THREE.Vector3(0, 1, 0);
const rnd = (a) => (Math.random() - 0.5) * 2 * a;

export function createBoatDamage({ physics, scene, model, car, particles, audio, sound, design }) {
  const D = design;
  const R = physics.RAPIER;
  const state = { health: 1, hull: 1, hits: 0, lastHit: 0, note: '', burning: 0, exploded: false, breach: 0 };
  const parts = {};
  for (const name of model.partNames) parts[name] = { damage: 0, gone: false };
  NET_PARTS.forEach((alias, i) => {
    const name = model.partNames[i];
    if (name) parts[alias] = parts[name];
  });
  const box = model.mats.damageBox;
  const ctx2d = model.mats.damageCtx;
  const pending = [];
  const debris = [];
  const local = new THREE.Vector3();
  const dirLocal = new THREE.Vector3();
  const v = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const p3 = new THREE.Vector3();
  const q4 = new THREE.Quaternion();
  const s3 = new THREE.Vector3();
  const at = new THREE.Vector3();
  const leak = { x: 0, z: 0, w: 0 };
  let time = 0;
  let last = -1;
  let smolder = 0;
  let noteTime = 0;
  let wasSunk = false;

  function onContact(otherHandle, event) {
    if (pending.length > 6) return;
    const dv = (event.totalForceMagnitude() * physics.dt) / car.mass;
    const other = physics.world.getCollider(otherHandle);
    if (!other) return;
    const d = event.maxForceDirection();
    let point = null;
    for (const col of car.colliders) {
      physics.world.contactPair(col, other, (manifold) => {
        if (point || manifold.numSolverContacts() === 0) return;
        const p = manifold.solverContactPoint(0);
        point = new THREE.Vector3(p.x, p.y, p.z);
      });
      if (point) break;
    }
    if (point) pending.push({ dv, point, dir: new THREE.Vector3(d.x, d.y, d.z), kind: physics.surfaces.get(otherHandle) || 'terrain' });
  }
  for (const col of car.colliders) physics.onContact(col, onContact);

  function stamp(lp, amount, gouge, slide) {
    const u = Math.min(1, Math.max(0, (lp.x - box.x) / box.y));
    const w = Math.min(1, Math.max(0, (lp.y - box.z) / box.w));
    const cx = u * 512 + (lp.z > 0 ? 512 : 0);
    const cy = (1 - w) * 256;
    const g = ctx2d;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const count = 4 + Math.floor(amount * 18);
    for (let i = 0; i < count; i++) {
      const len = (6 + Math.random() * 30) * (0.5 + amount);
      const ox = rnd(18 * (0.4 + amount));
      const oy = rnd(9 * (0.4 + amount));
      const ang = slide + rnd(0.35);
      g.strokeStyle = `rgba(${Math.floor(120 + Math.random() * 135)}, ${gouge > 0 && Math.random() < gouge ? Math.floor(120 + Math.random() * 135) : 0}, 0, ${0.35 + amount * 0.5})`;
      g.lineWidth = 0.6 + Math.random() * (1 + amount * 2.5);
      g.beginPath();
      g.moveTo(cx + ox - Math.cos(ang) * len * 0.5, cy + oy - Math.sin(ang) * len * 0.5);
      g.lineTo(cx + ox + Math.cos(ang) * len * 0.5, cy + oy + Math.sin(ang) * len * 0.5);
      g.stroke();
    }
    if (gouge > 0) {
      const blot = g.createRadialGradient(cx, cy, 0, cx, cy, 6 + gouge * 22);
      blot.addColorStop(0, `rgba(160, ${Math.floor(120 + gouge * 135)}, 0, 0.9)`);
      blot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = blot;
      g.fillRect(cx - 40, cy - 40, 80, 80);
    }
    g.restore();
    model.mats.damageTexture.needsUpdate = true;
  }

  function dent(lp, dir, depth) {
    const mesh = model.hull;
    if (!mesh || depth <= 0.002) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const rest = geo.userData.rest;
    const radius = 0.3 + depth * 2.4;
    const r2 = radius * radius;
    const touched = new Uint8Array(pos.count / 3);
    let any = false;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - lp.x;
      const dy = pos.getY(i) - lp.y;
      const dz = pos.getZ(i) - lp.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      const f = 1 - Math.sqrt(d2) / radius;
      a.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
      const h = a.x * 12.9898 + a.y * 78.233 + a.z * 37.719;
      const k = f * f * (3 - 2 * f) * (0.75 + 0.5 * Math.abs(Math.sin(h)));
      v.set(pos.getX(i) + dir.x * depth * k, pos.getY(i) + dir.y * depth * k + Math.sin(h * 0.57) * depth * k * 0.15, pos.getZ(i) + dir.z * depth * k);
      b.copy(v).sub(a);
      if (b.length() > D.dentLimit) v.copy(a).addScaledVector(b.normalize(), D.dentLimit);
      pos.setXYZ(i, v.x, v.y, v.z);
      touched[Math.floor(i / 3)] = 1;
      any = true;
    }
    if (!any) return;
    for (let t = 0; t < touched.length; t++) {
      if (!touched[t]) continue;
      const i = t * 3;
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      n.subVectors(c, b).cross(v.subVectors(a, b)).normalize();
      if (n.dot(v.set(nor.getX(i), nor.getY(i), nor.getZ(i))) < 0) n.negate();
      for (let j = 0; j < 3; j++) nor.setXYZ(i + j, n.x, n.y, n.z);
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }

  function crack(amount, lp) {
    const m = model.glass;
    if (!m || m.userData.gone) return;
    const u = m.userData.uniforms;
    if (u.uCrack.value === 0) u.uCrackAt.value.copy(lp);
    u.uCrack.value = Math.min(1, u.uCrack.value + amount);
    if (amount > 0.15 && audio) audio.glass(Math.min(1, amount));
    if (u.uCrack.value >= 0.5) car.state.canopyBroken = true;
  }

  function shatter(worldPoint) {
    const m = model.glass;
    if (!m || m.userData.gone) return;
    m.userData.gone = true;
    m.visible = false;
    if (particles) particles.burstChips(worldPoint, 80, [1.4, 1.6, 1.7], 6);
    if (audio) audio.glass(1);
    car.state.canopyBroken = true;
  }

  function breakLamp(ch, point) {
    if (model.mats.broken[ch] >= 1) return;
    model.mats.broken[ch] = 1;
    if (particles) particles.burstChips(point, 18, ch === CH.RED ? [1.3, 0.12, 0.08] : ch === CH.GREEN ? [0.1, 1.2, 0.3] : [1.4, 1.4, 1.35], 3);
    if (audio) audio.glass(0.4);
  }

  function fling(object, half, mass, velocity, float, spin = 5) {
    object.updateWorldMatrix(true, false);
    object.matrixWorld.decompose(p3, q4, s3);
    const home = { parent: object.parent, position: object.position.clone(), quaternion: object.quaternion.clone() };
    scene.add(object);
    object.position.copy(p3);
    object.quaternion.copy(q4);
    const lv = car.body.linvel();
    const body = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p3.x, p3.y, p3.z).setRotation(q4).setLinvel(lv.x + velocity.x, lv.y + velocity.y, lv.z + velocity.z).setAngvel({ x: rnd(spin), y: rnd(spin), z: rnd(spin) }).setLinearDamping(0.2).setAngularDamping(0.6));
    const col = physics.world.createCollider(R.ColliderDesc.cuboid(...half).setMass(mass).setFriction(0.6).setRestitution(0.2).setCollisionGroups(groups(GROUPS.DEBRIS, GROUPS.WORLD | GROUPS.PROP)), body);
    physics.surfaces.set(col.handle, 'metal');
    debris.push({ object, body, home, float, volume: half[0] * half[1] * half[2] * 8, mass });
  }

  function lose(name, push) {
    const part = model.parts[name];
    const st = parts[name];
    if (!part || !st || st.gone) return;
    st.gone = true;
    part.detached = true;
    if (part.onLose) part.onLose(car);
    v.copy(push || at.set(rnd(1.5), 2, rnd(1.5)));
    fling(part.node, part.half, part.mass, v.clone(), part.float);
    state.note = `${part.label} torn off`;
    noteTime = 4;
    if (sound) sound.play('hull_crack', 0.9);
    if (particles) particles.burstChips(p3, 24, [0.3, 0.3, 0.3], 4);
  }

  function bend(name, amount) {
    const part = model.parts[name];
    const st = parts[name];
    if (!part || st.gone) return;
    st.damage += amount;
    const k = Math.min(1, st.damage);
    part.k = k;
    part.node.quaternion.copy(part.rest.quaternion);
    part.node.rotateX(part.bend[0] * k);
    part.node.rotateZ(part.bend[1] * k);
    if (part.onBend) part.onBend(car, st.damage);
  }

  function explode() {
    if (state.exploded) return;
    state.exploded = true;
    state.health = 0;
    state.hits++;
    state.lastHit = time;
    const center = at.set(D.engine[0], D.engine[1] + 0.4, D.engine[2]).applyQuaternion(model.group.quaternion).add(model.group.position).clone();
    if (particles) {
      particles.burstSparks(center, 150, UP, 15);
      particles.burstChips(center, 110, [0.12, 0.11, 0.1], 10);
      for (let i = 0; i < 14; i++) particles.puff(v.copy(center).add(s3.set(rnd(1.6), Math.random() * 1.4, rnd(1.6))), [0.05, 0.045, 0.04], 0.78, 1.2 + Math.random(), 3.6, 2.6, 2.4);
      for (let i = 0; i < 150; i++) particles.flame(v.copy(center).add(s3.set(rnd(1.8), Math.random() * 1.5, rnd(1.8))), 0.6 + Math.random() * 0.7, 1.7);
    }
    if (car.water) car.water.splash({ position: center.clone().setY(car.water.getHeightAt(center.x, center.z)), velocity: new THREE.Vector3(0, -6, 0), radius: 2.4, mass: car.mass * 0.3, kind: 'vehicle' });
    shatter(center);
    for (const ch of [CH.RED, CH.GREEN, CH.WHITE, CH.ACCENT, CH.FLOOD, CH.SCREEN, CH.CABIN]) model.mats.broken[ch] = 1;
    for (const name of model.partNames) lose(name, at.set(rnd(4), 5 + Math.random() * 4, rnd(4)));
    for (let i = 0; i < 24; i++) stamp(at.set(box.x + Math.random() * box.y, box.z + Math.random() * box.w, rnd(1)), 1, 0.7, Math.random() * 6);
    model.mats.char.value = 1;
    breach(D.blastBreach, D.engine[0], 0);
    car.body.applyImpulse({ x: rnd(car.mass * 0.8), y: car.mass * 3.2, z: rnd(car.mass * 0.8) }, true);
    car.body.applyTorqueImpulse({ x: rnd(car.mass * 1.2), y: rnd(car.mass * 0.6), z: rnd(car.mass * 1.2) }, true);
    if (audio) audio.crash(16, 'metal', center);
    if (sound) sound.play('hull_crack', 1);
    car.state.stalled = true;
    smolder = 30;
    state.note = 'Boat wrecked';
  }

  function breach(amount, x, z) {
    if (amount <= 0) return;
    state.breach = Math.min(D.maxBreach, state.breach + amount);
    leak.x = (leak.x * leak.w + x * amount) / (leak.w + amount);
    leak.z = (leak.z * leak.w + z * amount) / (leak.w + amount);
    leak.w += amount;
  }

  function repair() {
    for (const d of debris) {
      physics.world.removeRigidBody(d.body);
      d.home.parent.add(d.object);
      d.object.position.copy(d.home.position);
      d.object.quaternion.copy(d.home.quaternion);
    }
    debris.length = 0;
    for (const name of model.partNames) {
      const part = model.parts[name];
      part.node.position.copy(part.rest.position);
      part.node.quaternion.copy(part.rest.quaternion);
      parts[name].damage = 0;
      parts[name].gone = false;
      part.k = 0;
      part.detached = false;
      if (part.onRepair) part.onRepair(car);
    }
    if (model.hull) {
      const g = model.hull.geometry;
      g.attributes.position.array.set(g.userData.rest);
      g.attributes.normal.array.set(g.userData.restNormal);
      g.attributes.position.needsUpdate = true;
      g.attributes.normal.needsUpdate = true;
    }
    const m = model.glass;
    if (m) {
      m.userData.gone = false;
      m.visible = true;
      m.userData.uniforms.uCrack.value = 0;
      m.userData.uniforms.uBase.value = m.userData.base;
    }
    model.mats.broken.fill(0);
    ctx2d.globalCompositeOperation = 'source-over';
    ctx2d.fillStyle = '#000';
    ctx2d.fillRect(0, 0, 1024, 256);
    model.mats.damageTexture.needsUpdate = true;
    model.mats.char.value = 0;
    Object.assign(state, { health: 1, hull: 1, note: '', burning: 0, exploded: false, breach: 0 });
    leak.x = leak.z = leak.w = 0;
    Object.assign(car.state, { stalled: false, flood: 0, breach: 0, powerScale: 1, thrustScale: 1, foilsOff: false, canopyBroken: false, sunk: false });
    smolder = 0;
    wasSunk = false;
  }

  function process({ dv, point, dir, kind }) {
    local.copy(point);
    model.group.worldToLocal(local);
    const speed = car.state.speed;
    const hard = kind !== 'player' && kind !== 'soft' && kind !== 'plastic';
    if (dv < D.dentAt) {
      if (speed > 1.5 && hard && time - last > 0.15 && Math.random() < 0.4) {
        last = time;
        stamp(local, 0.12, 0, Math.random() * 3);
        if (particles && D.metal && (kind === 'concrete' || kind === 'metal')) particles.burstSparks(point, 3, car.velocity.clone().normalize(), speed * 0.5);
      }
      return;
    }
    if (time - last < 0.12 || !hard) return;
    last = time;
    const severity = Math.min(1, (dv - D.dentAt) / D.crushAt);
    const depth = Math.min(D.dentLimit, (dv - D.dentAt) * D.dentScale);
    dirLocal.copy(dir).transformDirection(inv.copy(model.group.matrixWorld).invert());
    v.set(-local.x, 0.2 - local.y, -local.z).normalize();
    if (dirLocal.dot(v) < 0) dirLocal.negate();
    dirLocal.lerp(v, 0.4).normalize();
    const L = box.y;
    const bow = local.x > box.x + L * 0.72;
    const stern = local.x < box.x + L * 0.22;
    const below = local.y < car.bottomY - 0.15;
    dent(local, dirLocal, bow ? depth * 1.4 : depth);
    stamp(local, 0.25 + severity * 0.75, severity, Math.random() * 6);
    state.hits++;
    state.lastHit = time;
    noteTime = 4;
    if (audio) audio.crash(dv, D.metal ? 'metal' : kind, point);
    if (sound) sound.play(severity > 0.45 ? 'hull_crack' : 'hull_crunch', 0.4 + severity * 0.6);
    if (particles) {
      if (D.metal) particles.burstSparks(point, Math.floor(6 + severity * 30), v.copy(dirLocal).negate().transformDirection(model.group.matrixWorld), 3 + dv * 0.5);
      particles.burstChips(point, Math.floor(6 + severity * 30), D.chips, 2 + dv * 0.4);
    }
    if (state.exploded) return;
    state.hull = Math.max(0, state.hull - severity * (bow ? 0.26 : 0.18));
    const wet = local.y < 0.45 ? 1 : 0.25;
    let absorbed = false;
    for (const name of model.partNames) if (!parts[name].gone && below && model.parts[name].zone(local, below) > 0.5) absorbed = true;
    if (dv > D.holeAt && !absorbed) breach(severity * D.breachScale * wet, local.x, local.z);
    state.health = Math.max(0.02, state.health - severity * (stern ? D.engineHit * 1.8 : D.engineHit));
    for (const s of model.lampSpots) if (dv > 2.2 && s.at.distanceTo(local) < 1.0 + severity) breakLamp(s.ch, point);
    if (model.glass && !model.glass.userData.gone && model.glassMeshes.length) {
      const sphere = model.glassMeshes[0].geometry.boundingSphere;
      const dist = local.distanceTo(sphere.center) - sphere.radius;
      if (dist < 0.8 || dv > 6) crack(severity * (dist < 0.3 ? 1.1 : 0.6), local);
      if (model.glass.userData.uniforms.uCrack.value >= 1 && dv > D.shatterAt) shatter(point);
    }
    for (const name of model.partNames) {
      const part = model.parts[name];
      if (parts[name].gone) continue;
      const near = part.zone(local, below);
      if (!near) continue;
      bend(name, severity * near);
      if (parts[name].damage > part.limit && dv > part.tearAt) lose(name, v.copy(dirLocal).transformDirection(model.group.matrixWorld).multiplyScalar(-2).setY(2).clone());
    }
    state.note = state.health < 0.3 ? 'Engine on fire' : state.breach > 0.05 ? 'Hull holed, taking on water' : state.hull < 0.6 ? 'Hull badly damaged' : 'Hull damaged';
  }

  const fireAt = (spread) => at.set(D.engine[0] + rnd(spread), D.engine[1], D.engine[2] + rnd(spread)).applyQuaternion(model.group.quaternion).add(model.group.position);
  return {
    state,
    parts,
    repair,
    explode,
    hit(point, dir, dv, kind = 'concrete') {
      pending.push({ point: point.clone(), dir: dir.clone(), dv, kind });
    },
        netParts(bits) {
      NET_PARTS.forEach((alias, i) => {
        const name = model.partNames[i];
        if (name && (bits >> i) & 1 && !parts[name].gone) lose(name, null);
      });
    },
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) if (!state.remote) process(hit);
      const cs = car.state;
      cs.breach = state.breach;
      cs.leakX = leak.x;
      cs.leakZ = leak.z;
      const level = car.water ? car.water.getHeightAt(car.position.x, car.position.z) : 0;
      fireAt(0);
      const drowned = at.y < level + 0.05 || cs.flood > 0.7;
      cs.powerScale = state.exploded ? 0 : 0.4 + 0.6 * state.health;
      if (state.exploded) {
        cs.stalled = true;
        smolder = Math.max(0, smolder - dt * (drowned ? 4 : 1));
        if (particles && smolder > 0 && Math.random() < dt * 14) particles.puff(fireAt(1), [0.05, 0.05, 0.05], 0.55, 0.6, 3, 1.8, 0.5);
        if (particles && smolder > 10 && !drowned) {
          const want = dt * 200 * Math.min(1, (smolder - 10) / 10);
          for (let k = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); k > 0; k--) particles.flame(fireAt(1.2), 0.3 + Math.random() * 0.25, 1);
        }
      } else if (state.health < 0.3 && !drowned) {
        state.burning += dt;
        const grow = Math.min(1, state.burning / 8);
        model.mats.char.value = Math.max(model.mats.char.value, grow * 0.55);
        if (particles) {
          const want = dt * (80 + 140 * grow);
          for (let k = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); k > 0; k--) particles.flame(fireAt(0.5 + grow * 0.6), 0.24 + grow * 0.24, 1);
          if (Math.random() < dt * 20) particles.puff(fireAt(0.6).setY(at.y + 0.6 + grow * 0.6), [0.045, 0.045, 0.045], 0.6, 0.6, 3, 2.2, 0.4);
          if (Math.random() < dt * 5) particles.burstSparks(fireAt(0.5), 3, UP, 3);
        }
        state.note = 'Engine on fire';
        noteTime = 1;
        if (state.burning > D.burnTime) explode();
      } else {
        if (state.burning > 0 && drowned) {
          state.burning = 0;
          state.note = 'Fire out, engine flooded';
          noteTime = 4;
        }
        if (state.health < 0.7 && particles && cs.occupied && Math.random() < dt * (state.health < 0.45 ? 26 : 8)) {
          const dark = state.health < 0.45 ? 0.07 : 0.5;
          particles.puff(fireAt(0.4), [dark, dark, dark], 0.4, 0.35, 2.2, 1.4, 0.3);
        }
      }
      if (cs.sunk && !wasSunk) {
        state.note = 'Boat sunk, press R to raise it at its berth';
        noteTime = 99999;
      }
      wasSunk = !!cs.sunk;
      if (cs.flood > 0.05 && !cs.sunk && !state.exploded && state.health >= 0.3) {
        state.note = cs.flood > 0.6 ? 'Sinking' : 'Taking on water';
        noteTime = 1;
      }
      if (state.hold) {
        noteTime = Math.max(noteTime, state.hold);
        state.hold = 0;
      }
      noteTime -= dt;
      if (noteTime <= 0 && !state.exploded && state.health >= 0.3) state.note = '';
      for (const d of debris) {
        const t = d.body.translation();
        if (car.water && d.float) {
          const lv = car.water.getHeightAt(t.x, t.z);
          const sub = Math.min(1, Math.max(0, (lv - t.y) / 0.3 + 0.5));
          if (sub > 0) {
            const lvel = d.body.linvel();
            d.body.applyImpulse({ x: -lvel.x * d.mass * 1.5 * dt, y: (d.mass * 9.81 * 1.8 * sub - lvel.y * d.mass * 3) * dt, z: -lvel.z * d.mass * 1.5 * dt }, true);
          }
        } else if (car.water && t.y < 0) {
          const lvel = d.body.linvel();
          d.body.applyImpulse({ x: -lvel.x * d.mass * 2 * dt, y: (d.mass * 9.81 * 0.6 - lvel.y * d.mass * 2) * dt, z: -lvel.z * d.mass * 2 * dt }, true);
        }
        if (d.body.isSleeping()) continue;
        const r = d.body.rotation();
        d.object.position.set(t.x, t.y, t.z);
        d.object.quaternion.set(r.x, r.y, r.z, r.w);
      }
    },
  };
}
