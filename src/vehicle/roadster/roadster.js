// Costa del Gzowo Roadster: builds the thruster Roadster as a vehicle (model, physics, damage, entry) and runs its per-frame effects (vapour billows on the ground, motor and cold-gas sound).
import * as THREE from 'three';
import { createRoadsterModel } from './roadsterModel.js';
import { createRoadsterPhysics } from './roadsterPhysics.js';
import { createRoadsterDamage } from './roadsterDamage.js';
import { createRoadsterAudio } from './roadsterAudio.js';
import { createCarEntry } from '../carEntry.js';

export async function createRoadster(ctx, spawn, deps) {
  const model = await createRoadsterModel(ctx);
  const car = createRoadsterPhysics({ physics: deps.physics, terrain: deps.terrain, model, spawn, input: ctx.input });
  model.bindSim(car.sim);
  const damage = createRoadsterDamage({ physics: deps.physics, model, car, particles: deps.particles, audio: deps.audio });
  const sound = createRoadsterAudio(deps.audio, ctx.base || '');
  const p = new THREE.Vector3();
  const d = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const baseUpdate = model.update;
  model.update = (dt) => {
    baseUpdate(dt);
    const particles = deps.particles;
    if (particles) {
      q.copy(model.group.quaternion).multiply(turn);
      for (const n of car.sim.thrusters.all) {
        if (n.valve < 0.3 || n.groundDist > 3) continue;
        if (Math.random() > dt * 26 * n.valve) continue;
        d.set(-n.dir.x, -n.dir.y, -n.dir.z).applyQuaternion(q);
        p.set(n.pos.x, n.pos.y, n.pos.z).applyQuaternion(q).add(model.group.position).addScaledVector(d, n.groundDist);
        p.y += 0.15;
        particles.puff(p, [0.88, 0.92, 0.96], 0.32 * n.valve, 0.6, 1.4, 0.9, 1.4);
      }
    }
    sound.update(dt, { sim: car.sim, inside: car.state.occupied, camera: ctx.camera, position: model.group.position });
  };
  const vehicle = {
    id: 'roadster',
    model,
    car,
    damage,
    entry: null,
    bindEntry(more) {
      vehicle.entry = createCarEntry({ model, car, audio: deps.audio, physics: deps.physics, scene: deps.scene, ...more });
      return vehicle.entry;
    },
  };
  return vehicle;
}
