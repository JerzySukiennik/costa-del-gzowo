// Costa del Gzowo helicopter: builds the Kestrel as a vehicle (model, flight physics, damage, entry) and runs its per-frame effects (rotor wash on grass, dust and water, sound).
import * as THREE from 'three';
import { GROUND } from '../../world/terrain.js';
import { createCarEntry } from '../carEntry.js';
import { createHeliModel } from './heliModel.js';
import { createHeliPhysics } from './heliPhysics.js';
import { createHeliDamage } from './heliDamage.js';
import { createHeliAudio } from './heliAudio.js';

const DUST = { [GROUND.SAND]: [0.62, 0.56, 0.44], [GROUND.GRAVEL]: [0.58, 0.55, 0.5], [GROUND.DIRT]: [0.42, 0.36, 0.27], [GROUND.PEBBLES]: [0.55, 0.52, 0.47], [GROUND.MUD]: [0.3, 0.26, 0.2] };

export async function createHeli(ctx, spawn, deps) {
  const model = await createHeliModel(ctx);
  const car = createHeliPhysics({ physics: deps.physics, model, spawn, input: ctx.input });
  car.words = { wrecked: 'Helicopter wrecked, get a new one', stalled: 'Engine drowned, reset the helicopter' };
  const damage = createHeliDamage({ physics: deps.physics, model, car, particles: deps.particles, audio: deps.audio });
  const sound = createHeliAudio(deps.audio, ctx.base || '');
  const p = new THREE.Vector3();
  const baseUpdate = model.update;
  model.update = (dt) => {
    baseUpdate(dt);
    const s = car.state;
    const particles = deps.particles;
    if (s.wash > 0.04) {
      const x = car.position.x;
      const z = car.position.z;
      const ring = 2.2 + Math.min(4.5, s.agl * 0.55);
      if (s.overWater) {
        const water = car.water;
        if (water && water.addRipple && Math.random() < dt * 34) {
          const a = Math.random() * Math.PI * 2;
          water.addRipple(x + Math.cos(a) * ring, z + Math.sin(a) * ring, 1.2 + ring * 0.35, 0.5 + 2.2 * s.wash);
        }
        if (particles && s.agl < 9) {
          const want = dt * 46 * s.wash;
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) {
            const a = Math.random() * Math.PI * 2;
            const r = ring * (0.75 + Math.random() * 0.6);
            particles.puff(p.set(x + Math.cos(a) * r, s.floorY + 0.25, z + Math.sin(a) * r), [0.86, 0.93, 0.97], 0.1 + 0.26 * s.wash, 0.7 + ring * 0.12, 1.4, 0.5 + 1.6 * s.wash, 1.6);
          }
        }
      } else {
        if (ctx.grass && ctx.grass.press) ctx.grass.press({ x, z, radius: 3.4 + ring, press: Math.min(0.95, s.wash * 1.05), radial: true, soft: 0.85 });
        const dust = particles && s.agl < 7 && ctx.terrain ? DUST[ctx.terrain.groundAt(x, z)] : null;
        if (dust) {
          const want = dt * 38 * s.wash;
          for (let n = Math.random() < want % 1 ? Math.ceil(want) : Math.floor(want); n > 0; n--) {
            const a = Math.random() * Math.PI * 2;
            const r = ring * (0.7 + Math.random() * 0.7);
            particles.puff(p.set(x + Math.cos(a) * r, s.floorY + 0.2, z + Math.sin(a) * r), dust, 0.12 + 0.2 * s.wash, 0.6 + ring * 0.1, 1.8, 0.4 + 1.2 * s.wash, 1.9);
          }
        }
      }
    }
    sound.update(dt, { state: s, inside: s.occupied, camera: ctx.camera, position: model.group.position });
  };
  const vehicle = {
    id: 'heli',
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
