// Costa del Gzowo boats: hull damage (impacts against piers, quays, the bank and other craft scrape the hull, crack the glass, cost engine power and finally flood the boat) and full repair.
import * as THREE from 'three';

export function createBoatDamage({ physics, model, car, particles, audio }) {
  const state = { health: 1, hits: 0, lastHit: 0, note: '', burning: 0, exploded: false };
  const pending = [];
  const up = new THREE.Vector3(0, 1, 0);
  let time = 0;
  let last = -1;
  let noteTime = 0;

  function onContact(otherHandle, event) {
    const dv = (event.totalForceMagnitude() * physics.dt) / car.mass;
    const other = physics.world.getCollider(otherHandle);
    if (!other || pending.length > 4) return;
    let point = null;
    for (const c of car.colliders) {
      physics.world.contactPair(c, other, (manifold) => {
        if (point || manifold.numSolverContacts() === 0) return;
        const p = manifold.solverContactPoint(0);
        point = new THREE.Vector3(p.x, p.y, p.z);
      });
      if (point) break;
    }
    if (point) pending.push({ dv, point, kind: physics.surfaces.get(otherHandle) || 'terrain' });
  }
  for (const c of car.colliders) physics.onContact(c, onContact);

  function process({ dv, point, kind }) {
    if (dv < 1.6 || time - last < 0.2) return;
    last = time;
    const soft = kind === 'terrain' || kind === 'soft' || kind === 'player';
    const severity = Math.min(1, (dv - 1.6) / 7) * (soft ? 0.35 : 1);
    state.hits++;
    state.lastHit = time;
    if (audio) audio.crash(dv, kind === 'terrain' ? 'gravel' : kind, point);
    if (particles && !soft) particles.burstChips(point, Math.floor(4 + severity * 24), [0.85, 0.85, 0.82], 2 + dv * 0.4);
    state.health = Math.max(0.15, state.health - severity * 0.22);
    if (dv > 5 && model.glass && model.glass.userData.uniforms) model.glass.userData.uniforms.uBase.value = Math.min(0.6, model.glass.userData.uniforms.uBase.value + severity * 0.1);
    state.note = state.health < 0.35 ? 'Hull holed, taking on water' : state.health < 0.7 ? 'Hull damaged' : 'Hull scraped';
    noteTime = 4;
  }

  return {
    state,
    parts: {},
    repair() {
      Object.assign(state, { health: 1, note: '', burning: 0, exploded: false });
      if (model.glass && model.glass.userData.uniforms) model.glass.userData.uniforms.uBase.value = model.glass.userData.base;
      car.state.powerScale = 1;
    },
    explode() {},
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) if (!state.remote) process(hit);
      car.state.powerScale = 0.45 + 0.55 * state.health;
      car.state.health = state.health;
      noteTime -= dt;
      if (noteTime <= 0 && state.health > 0.35) state.note = '';
    },
  };
}
