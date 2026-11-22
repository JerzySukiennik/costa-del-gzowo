// Costa del Gzowo helicopter: damage (hard landings and crashes, rotor strikes that shed the blades, engine fire ending in a blow-up and a charred wreck) and full repair.
import * as THREE from 'three';

const rnd = (a) => (Math.random() - 0.5) * 2 * a;

export function createHeliDamage({ physics, model, car, particles, audio }) {
  const state = { health: 1, hits: 0, lastHit: 0, note: '', burning: 0, exploded: false, strikes: 0 };
  const pending = [];
  const at = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const leather = model.materials.leather.color.clone();
  let time = 0;
  let last = -1;
  let seenStrike = 0;
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
    if (point) pending.push({ dv, point, kind: physics.surfaces.get(otherHandle) || 'terrain' });
  }
  for (const c of car.colliders) physics.onContact(c, onContact);

  const engine = (spread) => at.set(-0.9 + rnd(0.5), 2.25, rnd(spread)).applyQuaternion(model.group.quaternion).add(model.group.position);
  const cabin = (spread) => at.set(rnd(1.6), 1.3, rnd(spread)).applyQuaternion(model.group.quaternion).add(model.group.position);

  function shedRotor() {
    if (car.state.rotorBroken) return;
    car.state.rotorBroken = true;
    state.note = 'Rotor destroyed';
    at.copy(model.dims.mast).applyQuaternion(model.group.quaternion).add(model.group.position);
    if (particles) {
      particles.burstSparks(at, 90, up, 14);
      particles.burstChips(at, 70, [0.05, 0.05, 0.055], 16);
    }
    if (audio) audio.crash(12, 'metal', at);
  }

  function explode() {
    if (state.exploded) return;
    state.exploded = true;
    state.health = 0;
    state.hits++;
    state.lastHit = time;
    shedRotor();
    const center = cabin(0).clone();
    if (particles) {
      particles.burstSparks(center, 170, up, 16);
      particles.burstChips(center, 110, [0.1, 0.1, 0.1], 11);
      for (let i = 0; i < 14; i++) particles.puff(at.copy(center).add(new THREE.Vector3(rnd(1.6), Math.random() * 1.4, rnd(1.6))), [0.05, 0.045, 0.04], 0.78, 1.2 + Math.random(), 3.6, 2.6, 2.4);
      for (let i = 0; i < 150; i++) particles.flame(at.copy(center).add(new THREE.Vector3(rnd(1.8), Math.random() * 1.6, rnd(1.8))), 0.6 + Math.random() * 0.7, 1.7);
    }
    for (const m of Object.values(model.glassMaterials)) {
      m.userData.gone = true;
      m.visible = false;
    }
    model.materials.char.value = 1;
    model.materials.leather.color.setScalar(0.1);
    model.headBroken.set(1, 1);
    car.body.applyImpulse({ x: rnd(car.mass * 1.2), y: car.mass * 3.6, z: rnd(car.mass * 1.2) }, true);
    car.body.applyTorqueImpulse({ x: rnd(2600), y: rnd(2600), z: rnd(2600) }, true);
    if (audio) {
      audio.crash(16, 'metal', center);
      audio.glass(1);
    }
    car.state.stalled = true;
    smolder = 26;
    state.note = 'Helicopter wrecked';
  }

  function repair() {
    for (const m of Object.values(model.glassMaterials)) {
      m.userData.gone = false;
      m.visible = true;
      if (m.userData.uniforms) m.userData.uniforms.uCrack.value = 0;
    }
    model.materials.char.value = 0;
    model.materials.leather.color.copy(leather);
    model.headBroken.set(0, 0);
    Object.assign(state, { health: 1, note: '', burning: 0, exploded: false, strikes: 0 });
    Object.assign(car.state, { rotorBroken: false, stalled: false, flood: 0, powerScale: 1 });
    smolder = 0;
  }

  function process({ dv, point, kind }) {
    if (dv < 2.2 || time - last < 0.15) return;
    last = time;
    const soft = kind === 'plastic' || kind === 'soft' || kind === 'rubber';
    const severity = Math.min(1, (dv - 2.2) / 8) * (soft ? 0.25 : 1);
    state.hits++;
    state.lastHit = time;
    if (audio) audio.crash(dv, kind, point);
    if (particles && !soft) {
      particles.burstSparks(point, Math.floor(6 + severity * 40), up, 3 + dv * 0.5);
      particles.burstChips(point, Math.floor(4 + severity * 20), [0.7, 0.7, 0.68], 2 + dv * 0.4);
    }
    if (soft || state.exploded) return;
    state.health = Math.max(0.05, state.health - severity * 0.3);
    if (dv > 5) for (const name of ['windshield', 'chinL', 'chinR']) {
      const m = model.glassMaterials[name];
      if (m && m.userData.uniforms) m.userData.uniforms.uCrack.value = Math.min(1, m.userData.uniforms.uCrack.value + severity * 0.6);
    }
    if (dv > 11) explode();
    else state.note = state.health < 0.3 ? 'Engine on fire' : state.health < 0.55 ? 'Engine damaged' : 'Airframe damaged';
  }

  return {
    state,
    parts: {},
    repair,
    explode,
    update(dt) {
      time += dt;
      for (const hit of pending.splice(0)) if (!state.remote) process(hit);
      if (car.state.strike && car.state.strike !== seenStrike) {
        seenStrike = car.state.strike;
        state.strikes++;
        state.hits++;
        state.lastHit = time;
        if (!state.exploded) state.health = Math.max(0.05, state.health - 0.16);
        const p = car.state.strikePoint;
        if (particles && p) {
          particles.burstSparks(p, 46, up, 12);
          particles.burstChips(p, 30, [0.05, 0.05, 0.055], 12);
        }
        if (audio && p) audio.crash(9, 'metal', p);
        if (state.strikes >= 3) shedRotor();
        else state.note = 'Rotor strike';
      }
      car.state.powerScale = state.exploded ? 0 : 0.5 + 0.5 * state.health;
      if (state.exploded) {
        car.state.stalled = true;
        smolder = Math.max(0, smolder - dt);
        if (particles && smolder > 0 && Math.random() < dt * 16) particles.puff(cabin(0.9), [0.05, 0.05, 0.05], 0.55, 0.6, 3, 1.8, 0.5);
        if (particles && smolder > 8) {
          const want = dt * 240 * Math.min(1, (smolder - 8) / 10);
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(cabin(0.8), 0.4, 1);
        }
      } else if (state.health < 0.3) {
        state.burning += dt;
        const grow = Math.min(1, state.burning / 7);
        model.materials.char.value = Math.max(model.materials.char.value, grow * 0.4);
        if (particles) {
          const want = dt * (90 + 130 * grow);
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) particles.flame(engine(0.5), 0.24 + grow * 0.2, 1);
          if (Math.random() < dt * 22) particles.puff(engine(0.6).setY(at.y + 0.5), [0.045, 0.045, 0.045], 0.55, 0.5, 2.8, 2.0, 0.4);
        }
        state.note = 'Engine on fire';
        if (state.burning > 9) explode();
      } else if (state.health < 0.7 && particles && car.state.rotor > 0.3 && Math.random() < dt * (state.health < 0.5 ? 26 : 8)) {
        particles.puff(engine(0.5), state.health < 0.5 ? [0.07, 0.07, 0.07] : [0.55, 0.55, 0.55], 0.4, 0.35, 2.2, 1.4, 0.3);
      }
    },
  };
}
