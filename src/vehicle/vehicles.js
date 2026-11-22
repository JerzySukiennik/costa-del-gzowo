// Costa del Gzowo: vehicle registry and factory (the GT convertible, the thruster Roadster and the Kestrel helicopter share one shape: model, physics, damage, entry).
import { createCarModel } from './carModel.js';
import { createCarPhysics } from './carPhysics.js';
import { createCarDamage } from './carDamage.js';
import { createCarEntry } from './carEntry.js';

export const VEHICLES = [
  { id: 'convertible', name: 'Costa GT Convertible', specs: { power: '420 kW', torque: '500 Nm', mass: '1650 kg', drive: 'AWD, 7-speed automatic', top: '300 km/h', zeroTo100: '4.1 s', roof: 'Three-bow fabric soft top' } },
  { id: 'roadster', name: 'Roadster', specs: { power: '950 kW', mass: '1950 kg', drive: 'Tri-motor AWD', top: '402 km/h', zeroTo100: '1.9 s', thrusters: '10 cold-gas nozzles, 4 rear boost, 2 front retro, 4 side lift' } },
  { id: 'heli', name: 'Kestrel Helicopter', specs: { power: '450 kW turboshaft', mass: '1150 kg', drive: 'Three-blade rotor, 9.4 m', top: '200 km/h', seats: '5', ceiling: '560 m' } },
  { id: 'speedboat', name: 'Sawgrass 25 Sport Boat', specs: { power: '220 kW outboard', mass: '1500 kg', drive: 'Deep-V planing hull, 7.6 m', top: '50 knots (93 km/h)', seats: '6' } },
  { id: 'foilboat', name: 'Halcyon Electric Foiler', specs: { power: '90 kW electric pod', mass: '1100 kg', drive: 'Fly-by-wire hydrofoils, takes off at 25 km/h', top: '30 knots (56 km/h)', seats: '2' } },
  { id: 'diver', name: 'Manta Dive Boat', specs: { power: '160 kW electric, twin thrusters', mass: '2600 kg', drive: 'Surface planing or submerged to 12 m', top: '38 knots, 8 knots dived', seats: '4' } },
  { id: 'yacht', name: 'Gzowo Star Trimaran Yacht', specs: { power: '2 x 900 kW diesel', mass: '42 t', drive: 'Trimaran, 26 m', top: '24 knots (44 km/h)', seats: '12' } },
];

const BOAT_KINDS = ['speedboat', 'foilboat', 'diver', 'yacht'];

export async function createVehicle(ctx, id, spawn, deps) {
  if (BOAT_KINDS.includes(id)) {
    const { createBoat } = await import('./boat/boat.js');
    return createBoat(ctx, spawn, deps, id);
  }
  if (id === 'heli') {
    const { createHeli } = await import('./heli/heli.js');
    return createHeli(ctx, spawn, deps);
  }
  if (id === 'roadster') {
    const { createRoadster } = await import('./roadster/roadster.js');
    return createRoadster(ctx, spawn, deps);
  }
  const model = await createCarModel(ctx, { color: spawn.color, plate: spawn.plate });
  const car = createCarPhysics({ physics: deps.physics, terrain: deps.terrain, model, spawn });
  model.bindState(car.state);
  const damage = createCarDamage({ physics: deps.physics, scene: deps.scene, model, car, particles: deps.particles, audio: deps.audio });
  const vehicle = {
    id: 'convertible',
    model,
    car,
    damage,
    entry: null,
    bindEntry(more) {
      vehicle.entry = createCarEntry({ model, car, audio: deps.audio, physics: deps.physics, scene: deps.scene, ...more });
      return vehicle.entry;
    },
    update() {},
  };
  return vehicle;
}
