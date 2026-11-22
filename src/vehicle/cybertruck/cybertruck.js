// Costa del Gzowo Cyber Truck: builds the stainless electric pickup as a vehicle (model, physics, damage, entry, sound) and runs its own controls (vault cover, ride height, cockpit view), screen data and network extras.
import { RADIO } from '../../config.js';
import { createCarEntry } from '../carEntry.js';
import { createTruckModel } from './ctModel.js';
import { createTruckPhysics, RIDE } from './ctPhysics.js';
import { createTruckDamage } from './ctDamage.js';
import { createTruckAudio } from './ctAudio.js';

const RIDES = Object.keys(RIDE);
const byte = (x) => Math.min(255, Math.max(0, Math.round(x * 255)));

export async function createCybertruck(ctx, spawn, deps) {
  const model = await createTruckModel(ctx);
  const car = createTruckPhysics({ physics: deps.physics, terrain: deps.terrain, model, spawn });
  model.bindState(car.state);
  car.words = { wrecked: 'Truck wrecked, get a new one', stalled: 'Drive units flooded, reset the truck' };
  const damage = createTruckDamage({ physics: deps.physics, model, car, particles: deps.particles, audio: deps.audio });
  const sound = createTruckAudio(deps.audio, ctx.base || '');
  const input = ctx.input;
  const baseUpdate = model.update;
  let radioTimer = 0;
  model.update = (dt) => {
    baseUpdate(dt);
    const s = car.state;
    const mine = s.occupied && !vehicle.remote;
    if (mine && input) {
      if (input.hit('KeyT')) {
        model.setVault(model.vault.target < 0.5);
        sound.vault(model.vault.target > 0.5);
      }
      if (input.hit('KeyG')) car.cycleRide();
      if (input.hit('KeyV')) car.camera.cockpit = !car.camera.cockpit;
    }
    if (!s.occupied) car.camera.cockpit = false;
    radioTimer -= dt;
    if (mine && radioTimer <= 0) {
      radioTimer = 0.5;
      let i = -1;
      try {
        i = Number(localStorage.getItem('costa-radio') ?? 0);
      } catch (error) {
        i = 0;
      }
      const r = ctx.radio && ctx.radio.available !== false ? RADIO[i] : null;
      model.screenState.radio = r ? `${r.name}  ${r.frequency}` : 'Radio off';
    }
    if (mine && ctx.town) model.screenState.place = ctx.town.contains(car.position.x, car.position.z) ? ctx.town.name : 'Sawgrass River Bridge';
    sound.update(dt, { state: s, wheels: car.wheels, inside: s.occupied && !vehicle.remote, cockpit: car.camera.cockpit, camera: ctx.camera, position: model.group.position, vault: model.vault });
  };
  const entryAudio = deps.audio ? Object.assign(Object.create(deps.audio), { door: (open) => sound.door(open) }) : null;
  const vehicle = {
    id: 'cybertruck',
    model,
    car,
    damage,
    entry: null,
    remote: false,
    bindEntry(more) {
      vehicle.entry = createCarEntry({ model, car, audio: entryAudio, physics: deps.physics, scene: deps.scene, ...more });
      return vehicle.entry;
    },
    netExtra(extra) {
      const s = car.state;
      extra[0] = byte(model.vault.target);
      extra[1] = RIDES.indexOf(s.rideTarget);
      extra[2] = byte((s.lift + 0.1) / 0.3);
      extra[3] = byte(Math.min(1, Math.max(-1, s.rearSteer / 0.6)) * 0.5 + 0.5);
      extra[4] = byte(s.pivot);
    },
    netApply(record, dt) {
      const s = car.state;
      const x = record.extra;
      model.setVault(x[0] > 127);
      s.rideTarget = RIDES[x[1]] || 'normal';
      s.lift = (x[2] / 255) * 0.3 - 0.1;
      s.rearSteer = ((x[3] / 255) - 0.5) * 2 * 0.6;
      s.pivot = x[4] / 255;
      const fwd = s.forwardSpeed;
      for (const w of car.wheels) {
        w.angle += (fwd / 0.445) * dt;
        w.L0 = 1.02 - 0.445 + w.cs + s.lift;
      }
    },
  };
  return vehicle;
}
