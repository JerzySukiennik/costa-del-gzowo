// Costa del Gzowo Roadster: lighter damage model (impact health, sparks and chips, broken lamps, crazed glass, knocked nozzles that lose thrust, battery smoke at low health).
import * as THREE from 'three';

export function createRoadsterDamage({ physics, model, car, particles, audio }) {
  const state = { health: 1, hits: 0, lastHit: 0, note: '', front: 0, rear: 0, left: 0, right: 0 };
  const parts = {};
  const pending = [];
  const local = new THREE.Vector3();
  const smokeAt = new THREE.Vector3();
  let time = 0;
  let last = -1;

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

  function process({ dv, point, kind }) {
    if (dv < 1.2 || time - last < 0.15) return;
    last = time;
    const soft = kind === 'plastic' || kind === 'soft' || kind === 'rubber';
    const severity = Math.min(1, (dv - 1.2) / 9) * (soft ? 0.25 : 1);
    local.copy(point);
    model.group.worldToLocal(local);
    state.hits++;
    state.lastHit = time;
    if (local.x > 1.4) state.front += severity;
    else if (local.x < -1.4) state.rear += severity;
    else if (local.z < 0) state.left += severity;
    else state.right += severity;
    state.health = Math.max(0.15, state.health - severity * 0.18);
    if (audio) audio.crash(dv, kind, point);
    if (particles && !soft) {
      particles.burstSparks(point, Math.floor(4 + severity * 26), car.velocity.clone().normalize().negate(), 3 + dv * 0.5);
      particles.burstChips(point, Math.floor(3 + severity * 14), [0.62, 0.64, 0.68], 2 + dv * 0.4);
    }
    if (soft) return;
    if (dv > 3 && local.x > 1.4) model.headBroken[local.z < 0 ? 'x' : 'y'] = 1;
    if (dv > 3 && local.x < -1.4) model.tailBroken[local.z < 0 ? 'x' : 'y'] = 1;
    if (dv > 4.5 && model.materials.Glass_Tint) {
      const g = model.materials.Glass_Tint;
      g.opacity = Math.min(0.92, g.opacity + severity * 0.25);
      g.color.lerp(new THREE.Color(0.85, 0.88, 0.9), severity * 0.4);
    }
    for (const n of car.sim.thrusters.all) {
      const nx = n.pos.z;
      const nz = -n.pos.x;
      const d = Math.hypot(local.x - nx, local.z - nz);
      if (d < 1.0) n.health = Math.max(0.25, n.health - severity * (1 - d) * 0.8);
    }
    state.note = state.health < 0.45 ? 'Battery damaged' : 'Bodywork damaged';
  }

  return {
    state,
    parts,
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) process(hit);
      car.state.powerScale = 0.45 + 0.55 * state.health;
      if (state.health < 0.6 && particles && Math.random() < dt * (state.health < 0.35 ? 22 : 6)) {
        smokeAt.set(1.2, 0.8, (Math.random() - 0.5) * 0.6).applyQuaternion(model.group.quaternion).add(model.group.position);
        particles.puff(smokeAt, [0.8, 0.8, 0.82], 0.3, 0.35, 2.2, 1.2, 0.3);
      }
    },
  };
}
