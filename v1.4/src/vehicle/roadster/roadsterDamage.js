// Costa del Gzowo Roadster: damage model (dented body panels, sparks and chips, broken lamps, crazed glass, knocked nozzles that lose thrust, battery fire ending in a blow-up) and full repair.
import * as THREE from 'three';

const DRIVEN = /^(Wheel_|Steer_|Brake_|Nozzle_|Exhaust_|Pod_|SteeringWheel|NozzleMount_)/;
const COLD = [1.7, 1.75, 2.2];
const rnd = (a) => (Math.random() - 0.5) * 2 * a;

export function createRoadsterDamage({ physics, model, car, particles, audio }) {
  const state = { health: 1, hits: 0, lastHit: 0, note: '', front: 0, rear: 0, left: 0, right: 0, burning: 0, exploded: false };
  const parts = {};
  const pending = [];
  const local = new THREE.Vector3();
  const dirLocal = new THREE.Vector3();
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const smokeAt = new THREE.Vector3();
  const glass = model.materials.Glass_Tint ? { opacity: model.materials.Glass_Tint.opacity, color: model.materials.Glass_Tint.color.clone() } : null;
  const panels = [];
  const paints = new Map();
  model.group.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position || o.geometry.attributes.position.count < 60) return;
    for (let p = o; p && p !== model.group; p = p.parent) if (DRIVEN.test(p.name)) return;
    const material = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!material || material.transparent || material.colorWrite === false) return;
    panels.push({ mesh: o, rest: null, dirty: false, gain: material.name === 'Interior_Dark' ? 1.3 : 1 });
    if (material.color && !paints.has(material)) paints.set(material, { color: material.color.clone(), roughness: material.roughness });
  });
  let time = 0;
  let last = -1;
  let normalsAt = 0;
  let smolder = 0;

  function onContact(otherHandle, event) {
    const dv = (event.totalForceMagnitude() * physics.dt) / car.mass;
    const other = physics.world.getCollider(otherHandle);
    if (!other) return;
    const kind = physics.surfaces.get(otherHandle) || 'terrain';
    let point = null;
    for (const c of car.colliders) {
      physics.world.contactPair(c, other, (manifold) => {
        if (point || manifold.numSolverContacts() === 0) return;
        const p = manifold.solverContactPoint(0);
        point = new THREE.Vector3(p.x, p.y, p.z);
      });
      if (point) break;
    }
    if (point) pending.push({ dv, point, kind });
  }
  for (const c of car.colliders) physics.onContact(c, onContact);

  function dent(worldPoint, worldDir, depth) {
    const radius = 0.3 + depth * 1.6;
    for (const panel of panels) {
      const mesh = panel.mesh;
      const geo = mesh.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      mesh.updateWorldMatrix(true, false);
      inv.copy(mesh.matrixWorld).invert();
      local.copy(worldPoint).applyMatrix4(inv);
      if (local.distanceTo(geo.boundingSphere.center) > geo.boundingSphere.radius + radius) continue;
      dirLocal.copy(worldDir).transformDirection(inv);
      const pos = geo.attributes.position;
      if (!panel.rest) panel.rest = pos.array.slice();
      let touched = false;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const dist = v.distanceTo(local);
        if (dist > radius) continue;
        const f = 1 - dist / radius;
        const k = f * f * (3 - 2 * f);
        const jitter = 0.75 + 0.5 * Math.abs(Math.sin(v.x * 5.3 + v.y * 7.1 + v.z * 4.3));
        v.addScaledVector(dirLocal, depth * k * jitter * panel.gain);
        pos.setXYZ(i, v.x, v.y, v.z);
        touched = true;
      }
      if (touched) {
        pos.needsUpdate = true;
        panel.dirty = true;
      }
    }
  }

  function explode() {
    if (state.exploded) return;
    state.exploded = true;
    state.health = 0;
    state.hits++;
    state.lastHit = time;
    const center = new THREE.Vector3(0, 0.8, 0).applyQuaternion(model.group.quaternion).add(model.group.position);
    const up = new THREE.Vector3(0, 1, 0);
    if (particles) {
      particles.burstSparks(center, 180, up, 16);
      particles.burstChips(center, 110, [0.6, 0.62, 0.66], 10);
      for (let i = 0; i < 14; i++) {
        v.copy(center).add(smokeAt.set(rnd(1.4), Math.random() * 1.2, rnd(1.4)));
        particles.puff(v, [0.07, 0.07, 0.08], 0.78, 1.1 + Math.random(), 3.6, 2.6, 2.4);
      }
      for (let i = 0; i < 150; i++) {
        v.copy(center).add(smokeAt.set(rnd(1.6), Math.random() * 1.5, rnd(1.6)));
        particles.flame(v, 0.6 + Math.random() * 0.7, 1.6, COLD);
      }
    }
    for (const [material, was] of paints) {
      material.color.copy(was.color).multiplyScalar(0.07);
      if (material.roughness !== undefined) material.roughness = Math.max(was.roughness, 0.85);
    }
    model.headBroken.set(1, 1);
    model.tailBroken.set(1, 1);
    for (const n of car.sim.thrusters.all) n.health = 0;
    car.body.applyImpulse({ x: rnd(car.mass * 1.2), y: car.mass * 4.6, z: rnd(car.mass * 1.2) }, true);
    car.body.applyTorqueImpulse({ x: rnd(car.mass * 1.4), y: rnd(car.mass * 0.8), z: rnd(car.mass * 1.4) }, true);
    for (let i = 0; i < 10; i++) dent(v.copy(center).add(smokeAt.set(rnd(1.8), rnd(0.4), rnd(0.8)).applyQuaternion(model.group.quaternion)), new THREE.Vector3(rnd(1), rnd(1), rnd(1)).normalize(), 0.12);
    if (audio) audio.crash(16, 'metal', center);
    smolder = 26;
    state.note = 'Car wrecked';
  }

  function repair() {
    for (const panel of panels) {
      if (!panel.rest) continue;
      panel.mesh.geometry.attributes.position.array.set(panel.rest);
      panel.mesh.geometry.attributes.position.needsUpdate = true;
      panel.mesh.geometry.computeVertexNormals();
      panel.dirty = false;
    }
    for (const [material, was] of paints) {
      material.color.copy(was.color);
      if (material.roughness !== undefined) material.roughness = was.roughness;
    }
    for (const n of car.sim.thrusters.all) n.health = 1;
    model.headBroken.set(0, 0);
    model.tailBroken.set(0, 0);
    if (glass) {
      model.materials.Glass_Tint.opacity = glass.opacity;
      model.materials.Glass_Tint.color.copy(glass.color);
    }
    Object.assign(state, { health: 1, front: 0, rear: 0, left: 0, right: 0, note: '', burning: 0, exploded: false });
    smolder = 0;
    car.state.stalled = false;
    car.state.powerScale = 1;
  }

  function process({ dv, point, kind }) {
    if (dv < 1.2 || time - last < 0.15) return;
    last = time;
    const soft = kind === 'plastic' || kind === 'soft' || kind === 'rubber';
    const severity = Math.min(1, (dv - 1.2) / 9) * (soft ? 0.25 : 1);
    local.copy(point);
    model.group.worldToLocal(local);
    const where = local.clone();
    state.hits++;
    state.lastHit = time;
    if (where.x > 1.4) state.front += severity;
    else if (where.x < -1.4) state.rear += severity;
    else if (where.z < 0) state.left += severity;
    else state.right += severity;
    if (!state.exploded) state.health = Math.max(0.05, state.health - severity * 0.18);
    if (audio) audio.crash(dv, kind, point);
    if (particles && !soft) {
      particles.burstSparks(point, Math.floor(6 + severity * 40), car.velocity.clone().normalize().negate(), 3 + dv * 0.6);
      particles.burstChips(point, Math.floor(4 + severity * 20), [0.62, 0.64, 0.68], 2 + dv * 0.4);
    }
    if (soft) return;
    const inward = car.position.clone().add(new THREE.Vector3(0, 0.55, 0)).sub(point).normalize();
    dent(point, inward, Math.min(0.3, (dv - 1.2) * 0.04));
    if (dv > 3 && where.x > 1.4) model.headBroken[where.z < 0 ? 'x' : 'y'] = 1;
    if (dv > 3 && where.x < -1.4) model.tailBroken[where.z < 0 ? 'x' : 'y'] = 1;
    if (dv > 4.5 && model.materials.Glass_Tint) {
      const g = model.materials.Glass_Tint;
      g.opacity = Math.min(0.92, g.opacity + severity * 0.25);
      g.color.lerp(new THREE.Color(0.85, 0.88, 0.9), severity * 0.4);
    }
    for (const n of car.sim.thrusters.all) {
      const nx = n.pos.z;
      const nz = -n.pos.x;
      const d = Math.hypot(where.x - nx, where.z - nz);
      if (d < 1.0) n.health = Math.max(0.25, n.health - severity * (1 - d) * 0.8);
    }
    state.note = state.exploded ? 'Car wrecked' : state.health < 0.25 ? 'Battery on fire' : state.health < 0.45 ? 'Battery damaged' : 'Bodywork damaged';
  }

  const pack = (spread) => smokeAt.set(rnd(spread * 1.8), 0.95 + Math.random() * 0.2, rnd(spread)).applyQuaternion(model.group.quaternion).add(model.group.position);
  return {
    state,
    parts,
    repair,
    explode,
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) process(hit);
      if (time - normalsAt > 0.3) {
        for (const panel of panels) {
          if (!panel.dirty) continue;
          panel.dirty = false;
          panel.mesh.geometry.computeVertexNormals();
          normalsAt = time;
        }
      }
      car.state.powerScale = state.exploded ? 0 : 0.45 + 0.55 * state.health;
      if (state.exploded) {
        car.state.stalled = true;
        smolder = Math.max(0, smolder - dt);
        if (particles && smolder > 0 && Math.random() < dt * 16) particles.puff(pack(0.6), [0.06, 0.06, 0.07], 0.55, 0.6, 3, 1.8, 0.5);
        if (particles && smolder > 8) {
          const want = dt * 200 * Math.min(1, (smolder - 8) / 10);
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(pack(0.6), 0.4, 1, COLD);
        }
      } else if (state.health < 0.25) {
        state.burning += dt;
        if (particles) {
          const want = dt * (90 + 130 * Math.min(1, state.burning / 7));
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(pack(0.5), 0.26 + Math.min(0.2, state.burning * 0.03), 1, COLD);
          if (Math.random() < dt * 20) particles.puff(pack(0.6).setY(smokeAt.y + 0.6), [0.8, 0.8, 0.82], 0.5, 0.5, 2.4, 1.8, 0.4);
          if (Math.random() < dt * 12) particles.burstSparks(pack(0.5), 4, new THREE.Vector3(0, 1, 0), 4);
        }
        state.note = 'Battery on fire';
        if (state.burning > 9) explode();
      } else if (state.health < 0.6 && particles && Math.random() < dt * (state.health < 0.35 ? 22 : 6)) {
        smokeAt.set(1.2, 0.8, rnd(0.6)).applyQuaternion(model.group.quaternion).add(model.group.position);
        particles.puff(smokeAt, [0.8, 0.8, 0.82], 0.3, 0.35, 2.2, 1.2, 0.3);
      }
    },
  };
}
