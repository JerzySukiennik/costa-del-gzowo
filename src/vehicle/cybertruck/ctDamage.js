// Costa del Gzowo Cyber Truck: armoured damage (shallow dents and scratches in the stainless skin, armoured glass that cracks only under hard hits, lamps, bent wheels, a long road to a battery fire and blow-up) and full repair.
import * as THREE from 'three';

const GLASS = ['windshield', 'roof', 'side', 'rearGlass', 'winFL', 'winFR'];
const rnd = (a) => (Math.random() - 0.5) * 2 * a;

export function createTruckDamage({ physics, model, car, particles, audio }) {
  const state = { health: 1, front: 0, rear: 0, left: 0, right: 0, hits: 0, lastHit: 0, note: '', burning: 0, exploded: false, steerBias: 0 };
  const pending = [];
  const cool = new Map();
  const local = new THREE.Vector3();
  const dirLocal = new THREE.Vector3();
  const v = new THREE.Vector3();
  const rest = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const wheelDamage = car.wheels.map(() => 0);
  const leather = model.materials.leather.color.clone();
  let time = 0;
  let scrape = 0;
  let smolder = 0;

  function onContact(otherHandle, event) {
    const dv = (event.totalForceMagnitude() * physics.dt) / car.mass;
    const other = physics.world.getCollider(otherHandle);
    if (!other) return;
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
    const d = event.maxForceDirection();
    pending.push({ dv, point, dir: new THREE.Vector3(d.x, d.y, d.z), kind: physics.surfaces.get(otherHandle) || 'terrain' });
  }
  for (const c of car.colliders) physics.onContact(c, onContact);

  function stamp(uv, amount, slide, dent) {
    const g = model.damageCtx;
    const cx = uv.x * 1024;
    const cy = (1 - uv.y) * 1024;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const n = 2 + Math.floor(amount * 12);
    for (let i = 0; i < n; i++) {
      const len = (10 + Math.random() * 40) * (0.4 + amount);
      const ox = rnd(18) * (0.4 + amount);
      const oy = rnd(10) * (0.4 + amount);
      const a = slide + rnd(0.18);
      g.strokeStyle = `rgba(${Math.floor(90 + Math.random() * 150)}, 0, 0, ${0.3 + amount * 0.5})`;
      g.lineWidth = 0.5 + Math.random() * (0.6 + amount * 1.6);
      g.beginPath();
      g.moveTo(cx + ox - Math.cos(a) * len * 0.5, cy + oy - Math.sin(a) * len * 0.5);
      g.lineTo(cx + ox + Math.cos(a) * len * 0.5, cy + oy + Math.sin(a) * len * 0.5);
      g.stroke();
    }
    if (dent > 0) {
      const r = 10 + dent * 160;
      const blot = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      blot.addColorStop(0, `rgba(0, ${Math.floor(dent * 60)}, ${Math.floor(60 + dent * 600)}, 0.6)`);
      blot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = blot;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();
    model.damageTexture.needsUpdate = true;
  }

  function dent(worldPoint, worldDir, depth) {
    const radius = 0.22 + depth * 3.2;
    let nearest = null;
    let nearestDist = Infinity;
    for (const mesh of Object.values(model.panels)) {
      if (!mesh.parent) continue;
      mesh.updateWorldMatrix(true, false);
      inv.copy(mesh.matrixWorld).invert();
      local.copy(worldPoint).applyMatrix4(inv);
      const geo = mesh.geometry;
      if (!geo.boundingSphere || local.distanceTo(geo.boundingSphere.center) > geo.boundingSphere.radius + radius) continue;
      dirLocal.copy(worldDir).transformDirection(inv);
      const pos = geo.attributes.position;
      const restAttr = geo.attributes.aRest;
      const dmg = geo.attributes.aDmg;
      let touched = false;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const dist = v.distanceTo(local);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = { uv: new THREE.Vector2(dmg.getX(i), dmg.getY(i)) };
        }
        if (dist > radius || depth <= 0) continue;
        const f = 1 - dist / radius;
        const k = f * f * (3 - 2 * f);
        v.addScaledVector(dirLocal, depth * k * (0.8 + 0.4 * Math.abs(Math.sin(i * 12.9898))));
        rest.fromBufferAttribute(restAttr, i);
        const off = v.clone().sub(rest);
        if (off.length() > 0.16) v.copy(rest).addScaledVector(off.normalize(), 0.16);
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

  function crack(name, amount) {
    const m = model.glassMaterials[name];
    if (!m || m.userData.gone) return;
    const u = m.userData.uniforms.uCrack;
    u.value = Math.min(1, u.value + amount);
    if (amount > 0.2 && audio) audio.glass(amount * 0.8);
  }

  function shatter(name, point) {
    const m = model.glassMaterials[name];
    if (!m || m.userData.gone) return;
    m.userData.gone = true;
    m.visible = false;
    if (particles) particles.burstChips(point, 90, [1.4, 1.6, 1.7], 6);
    if (audio) audio.glass(1);
  }

  function breakLamp(which, side, point) {
    const lamp = which === 'head' ? model.headBroken : model.tailBroken;
    if (lamp[side] >= 1) return;
    lamp[side] = 1;
    if (particles) particles.burstChips(point, 20, which === 'head' ? [1.5, 1.5, 1.4] : [1.3, 0.12, 0.08], 4);
    if (audio) audio.glass(0.4);
  }

  function hitWheel(dv, severity) {
    let best = -1;
    let bestD = 0.9;
    car.wheels.forEach((w, i) => {
      if (w.gone) return;
      const d = Math.hypot(local.x - w.lx, local.z - w.lz);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0 || dv < 7 || local.y > 1.0) return;
    const w = car.wheels[best];
    wheelDamage[best] += severity * (1.2 - bestD);
    w.camber = THREE.MathUtils.clamp(w.camber - w.side * severity * 0.1, -0.2, 0.2);
    w.toe = THREE.MathUtils.clamp(w.toe + rnd(severity * 0.05), -0.08, 0.08);
    if (w.front) state.steerBias = THREE.MathUtils.clamp(state.steerBias + w.toe * 0.2, -0.05, 0.05);
  }

  function explode() {
    if (state.exploded) return;
    state.exploded = true;
    state.health = 0;
    state.hits++;
    state.lastHit = time;
    const center = new THREE.Vector3(0, 0.7, 0).applyQuaternion(model.group.quaternion).add(model.group.position);
    if (particles) {
      particles.burstSparks(center, 170, up, 15);
      particles.burstChips(center, 110, [0.5, 0.5, 0.5], 10);
      for (let i = 0; i < 16; i++) particles.puff(at.copy(center).add(v.set(rnd(2), Math.random() * 1.3, rnd(1.2))), [0.05, 0.045, 0.04], 0.78, 1.2 + Math.random(), 3.8, 2.6, 2.4);
      for (let i = 0; i < 160; i++) particles.flame(at.copy(center).add(v.set(rnd(2.2), Math.random() * 1.4, rnd(1.2))), 0.6 + Math.random() * 0.7, 1.7);
    }
    for (const name of GLASS) shatter(name, center);
    model.headBroken.set(1, 1);
    model.tailBroken.set(1, 1);
    car.body.applyImpulse({ x: rnd(car.mass * 1.0), y: car.mass * 4.2, z: rnd(car.mass * 1.0) }, true);
    car.body.applyTorqueImpulse({ x: rnd(car.mass * 1.6), y: rnd(car.mass), z: rnd(car.mass * 1.6) }, true);
    for (let i = 0; i < 24; i++) stamp(new THREE.Vector2(Math.random(), Math.random()), 1, Math.random() * 6, 0.3);
    model.paintUniforms.uDirt.value = 1;
    model.materials.char.value = 1;
    model.materials.leather.color.setScalar(0.1);
    if (audio) {
      audio.crash(16, 'metal', center);
      audio.glass(1);
    }
    smolder = 28;
    state.note = 'Truck wrecked';
  }

  function repair() {
    car.wheels.forEach((w, i) => {
      w.gone = false;
      w.camber = 0;
      w.toe = 0;
      wheelDamage[i] = 0;
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
    }
    model.headBroken.set(0, 0);
    model.tailBroken.set(0, 0);
    model.damageCtx.globalCompositeOperation = 'source-over';
    model.damageCtx.fillStyle = '#000';
    model.damageCtx.fillRect(0, 0, 1024, 1024);
    model.damageTexture.needsUpdate = true;
    model.paintUniforms.uDirt.value = 0.08;
    model.materials.char.value = 0;
    model.materials.leather.color.copy(leather);
    Object.assign(state, { health: 1, front: 0, rear: 0, left: 0, right: 0, note: '', burning: 0, exploded: false, steerBias: 0 });
    smolder = 0;
    Object.assign(car.state, { stalled: false, steerBias: 0, powerScale: 1, flood: 0 });
  }

  function process(hit) {
    const { dv, point, dir, kind } = hit;
    const key = Math.round(point.x * 2) + ':' + Math.round(point.y * 2) + ':' + Math.round(point.z * 2);
    const fresh = time - (cool.get(key) || -1) > 0.15;
    local.copy(point);
    model.group.worldToLocal(local);
    const soft = kind === 'plastic' || kind === 'soft' || kind === 'rubber';
    if (dv < 1.1) {
      if (car.state.speed > 1.5 && !soft) {
        scrape = Math.min(1, scrape + 0.3);
        if (particles && kind !== 'terrain' && Math.random() < 0.5) particles.burstSparks(point, 2, car.velocity.clone().normalize(), car.state.speed * 0.6);
        if (fresh && Math.random() < 0.3) {
          const nearest = dent(point, dir, 0);
          if (nearest) stamp(nearest.uv, 0.1, Math.random() * 3, 0);
          cool.set(key, time);
        }
      }
      return;
    }
    if (!fresh) return;
    cool.set(key, time);
    const severity = Math.min(1, (dv - 1.1) / 16) * (soft ? 0.2 : 1);
    const depth = Math.min(0.075, (dv - 1.1) * 0.0075) * (soft ? 0.2 : 1);
    const inward = dir.clone();
    const toCenter = car.position.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(point).normalize();
    if (inward.dot(toCenter) < 0) inward.negate();
    inward.lerp(toCenter, 0.35).normalize();
    const nearest = dent(point, inward, depth);
    if (nearest) stamp(nearest.uv, 0.15 + severity * 0.7, Math.random() * 3, depth / 0.075);
    state.hits++;
    state.lastHit = time;
    if (audio) audio.crash(dv * 0.85, kind, point);
    if (particles && !soft) {
      particles.burstSparks(point, Math.floor(8 + severity * 40), inward.clone().negate(), 3 + dv * 0.5);
      particles.puff(point, [0.5, 0.48, 0.44], 0.3, 0.5, 1.2);
    }
    if (soft || state.exploded) return;
    const frontHit = local.x > 2.1;
    const rearHit = local.x < -2.2;
    if (frontHit) state.front += severity;
    else if (rearHit) state.rear += severity;
    else if (local.z < 0) state.left += severity;
    else state.right += severity;
    state.health -= severity * (frontHit ? 0.085 : 0.055);
    hitWheel(dv, severity);
    if (frontHit && dv > 6.5 && local.y < 1.1) breakLamp('head', local.z < 0 ? 'x' : 'y', point);
    if (rearHit && dv > 6) breakLamp('tail', local.z < 0 ? 'x' : 'y', point);
    if (dv > 9) {
      if (frontHit || local.y > 1.25) crack('windshield', severity * 0.4);
      if (!frontHit && !rearHit) {
        crack(local.z < 0 ? 'winFL' : 'winFR', severity * 0.45);
        crack('side', severity * 0.3);
      }
      if (local.y > 1.4) crack('roof', severity * 0.4);
      if (rearHit) crack('rearGlass', severity * 0.4);
    }
    if (dv > 15) {
      for (const name of GLASS) {
        const m = model.glassMaterials[name];
        if (m && m.userData.uniforms.uCrack.value >= 1 && Math.random() < 0.5) shatter(name, point);
      }
    }
    state.health = Math.max(0.05, state.health);
    state.note = state.health < 0.25 ? 'Battery on fire' : state.health < 0.45 ? 'Drive unit damaged' : 'Panels dented';
  }

  const at2 = new THREE.Vector3();
  const pack = (spread) => at2.set(rnd(1.6), 0.45, rnd(spread)).applyQuaternion(model.group.quaternion).add(model.group.position);
  return {
    state,
    parts: {},
    repair,
    explode,
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) if (!state.remote) process(hit);
      scrape = Math.max(0, scrape - dt * 2.5);
      if (audio) audio.setScrape(scrape * Math.min(1, car.state.speed / 8));
      car.state.powerScale = state.exploded ? 0 : 0.55 + 0.45 * state.health;
      car.state.steerBias = state.steerBias;
      if (state.exploded) {
        car.state.stalled = true;
        smolder = Math.max(0, smolder - dt);
        if (particles && smolder > 0 && Math.random() < dt * 16) particles.puff(pack(0.9), [0.05, 0.05, 0.05], 0.55, 0.6, 3, 1.8, 0.5);
        if (particles && smolder > 8) {
          const want = dt * 260 * Math.min(1, (smolder - 8) / 10);
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(pack(0.8), 0.45, 1);
        }
      } else if (state.health < 0.25) {
        state.burning += dt;
        const grow = Math.min(1, state.burning / 8);
        model.materials.char.value = Math.max(model.materials.char.value, grow * 0.45);
        if (particles) {
          const want = dt * (70 + 120 * grow);
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(pack(0.7), 0.24 + grow * 0.2, 1);
          if (Math.random() < dt * 22) particles.puff(pack(0.8).setY(at2.y + 0.4), [0.045, 0.045, 0.045], 0.55, 0.5, 2.8, 2.0, 0.4);
        }
        state.note = 'Battery on fire';
        if (state.burning > 11) explode();
      } else if (state.health < 0.5 && particles && car.state.occupied && Math.random() < dt * 8) {
        particles.puff(pack(0.8), [0.5, 0.5, 0.5], 0.25, 0.35, 2.2, 1.0, 0.3);
      }
    },
  };
}
