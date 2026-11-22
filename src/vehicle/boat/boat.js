// Costa del Gzowo boats: builds any boat of the fleet as a vehicle (model, hull physics, damage, boarding, sound, water effects, network extras) and runs its per-frame animation.
import { createBoatPhysics } from './boatPhysics.js';
import { createBoatDamage } from './boatDamage.js';
import { createBoatEntry } from './boatEntry.js';
import { createBoatAudio } from './boatAudio.js';
import { createBoatWater } from './boatWater.js';

const BUILDERS = {
  speedboat: () => import('./speedboat.js'),
  foilboat: () => import('./foilboat.js'),
  diver: () => import('./diver.js'),
  yacht: () => import('./yacht.js'),
};
const byte = (x) => Math.min(255, Math.max(0, Math.round(x * 255)));
let serial = 0;

export async function createBoat(ctx, spawn, deps, kind) {
  const { build } = await BUILDERS[kind]();
  const spec = await build(ctx);
  const model = spec.model;
  const input = ctx.input;
  const car = createBoatPhysics({ physics: deps.physics, model, spawn, input, design: spec.design });
  const layers = [
    ...spec.layers,
    { file: 'fire_loop', gain: (s) => (damage.state.burning > 0 ? Math.min(1, 0.3 + damage.state.burning / 6) : damage.state.exploded ? 0.5 : 0) * 0.8 },
    { file: 'sink_gurgle', gain: (s) => Math.min(1, s.ingress * 3000) * (s.sunk ? 0.3 : 0.75), rate: (s) => 0.8 + 0.4 * s.flood },
  ];
  const sound = createBoatAudio(deps.audio, ctx.base || '', layers);
  const damage = createBoatDamage({ physics: deps.physics, scene: deps.scene, model, car, particles: deps.particles, audio: deps.audio, sound, design: spec.design });
  car.ownWater = createBoatWater(car, spec, `boat-${kind}-${serial++}`);
  car.words = { wrecked: 'Boat wrecked, get a new one', stalled: 'Boat swamped, raise it at its berth' };
  const quiet = deps.audio ? { ...deps.audio, door() {} } : null;
  const baseUpdate = model.update;
  model.update = (dt) => {
    const s = car.state;
    if (spec.toggle && s.occupied && !vehicle.remote && input.hit(spec.toggle.key)) spec.toggle.run(s, damage.state);
    if (s.occupied && !vehicle.remote && (s.flood > 0.8 || s.sunk) && vehicle.entry && !vehicle.entry.busy && vehicle.entry.seated) vehicle.entry.begin('exit');
    if (baseUpdate) baseUpdate(dt, s, car);
    sound.update(dt, { state: s, inside: s.occupied && vehicle.driver < 0 && !vehicle.remote, camera: ctx.camera, position: model.group.position });
  };
  car.netPack = (extra) => {
    extra[0] = byte(car.state.ballast);
    extra[1] = byte(Math.min(1, car.state.engineLoad));
    extra[2] = byte(car.state.foiling);
    extra[3] = car.state.diving ? 1 : 0;
    extra[4] = byte(car.state.flood);
  };
  car.netApply = (s) => {
    Object.assign(car.state, { ballast: s.extra[0] / 255, engineLoad: s.extra[1] / 255, foiling: s.extra[2] / 255, diving: s.extra[3] === 1, submerged: s.extra[0] > 128 && car.position.y < -0.9, flood: s.extra[4] / 255 });
    if (s.parts) damage.netParts(s.parts);
  };
  const vehicle = {
    id: kind,
    model,
    car,
    damage,
    entry: null,
    bindEntry(more) {
      vehicle.entry = createBoatEntry({ model, car, audio: quiet, physics: deps.physics, scene: deps.scene, spawn, ...more });
      return vehicle.entry;
    },
  };
  return vehicle;
}
