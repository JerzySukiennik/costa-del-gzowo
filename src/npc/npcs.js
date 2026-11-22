// Costa del Gzowo: the living world (pedestrians and road traffic) as one system with shared knowledge of vehicles, signals, crashes and aircraft, plus debugging helpers.
import { loadPeds } from './ped/assets.js';
import { createPeds } from './ped/peds.js';
import { setPedDaylight } from './ped/material.js';
import { createTraffic } from './traffic/traffic.js';
import { createNpcAudio } from './npcAudio.js';
import { POPULATION } from './util.js';
import { GROUPS, groups } from '../core/physics.js';

const SEED = 20261122;
const SIZE = { heli: [4.2, 1.3], roadster: [2.3, 1.0], convertible: [2.36, 0.95] };

export async function createNpcs(ctx, play) {
  const pack = await loadPeds();
  const world = {
    seed: SEED, signal: 0, vehicles: [], peds: [], crossings: [], aircraft: null, crash: null,
    player: { x: 0, y: 0, z: 0, vx: 0, vz: 0, speed: 0, onFoot: true, eye: 1.6 },
    onHit: null, onStep: null, onHorn: null, onSqueal: null, onCrash: null,
  };
  const peds = createPeds(ctx, play, world, pack);
  const traffic = createTraffic(ctx, play, world, pack);
  const audio = createNpcAudio(ctx);
  world.peds = peds.actors;
  const fleetRecs = [];
  const air = { x: 0, y: 0, z: 0, eye: 0 };
  const crash = { x: 0, y: 0, z: 0, eye: 1, fresh: false, time: -100 };
  const lastHit = new Map();
  const ray = new ctx.physics.RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const rayGroups = groups(0xffff, GROUPS.WORLD);
  let elapsed = 0;
  let enabled = true;

  world.onHit = (a, speed) => {
    audio.thud(a.x, a.y, a.z, speed);
    const v = a.threat;
    if (v && v.item && v.item.car.body && speed > 2) {
      const k = Math.min(1, 80 / (v.item.car.mass || 1500)) * 0.6;
      const lv = v.item.car.body.linvel();
      v.item.car.body.setLinvel({ x: lv.x * (1 - k * 0.2), y: lv.y, z: lv.z * (1 - k * 0.2) }, true);
    }
  };
  world.onStep = (a) => {
    if (ctx.audio && ctx.audio.footstep) ctx.audio.footstep('hard', a.rig.group.position, a.speed * 0.5);
  };
  world.onHorn = (car) => audio.horn(car);
  world.onSqueal = (car) => audio.squeal(car);
  world.onCrash = (car) => {
    crash.x = car.x;
    crash.y = car.y;
    crash.z = car.z;
    crash.eye = car.y + 1;
    crash.time = elapsed;
    if (ctx.audio && ctx.audio.crash) ctx.audio.crash(5, 'metal', car.group.position);
  };

  function setQuality(level) {
    const [people, cars] = POPULATION[level] || POPULATION.ultra;
    peds.setTarget(enabled ? people : 0);
    traffic.setTarget(enabled ? cars : 0);
  }

  function sense(dt) {
    const p = play.player.state;
    const pl = world.player;
    const onFoot = play.game.mode === 'foot';
    const at = onFoot ? p.position : play.car.position;
    pl.vx = onFoot ? p.velocity.x : 0;
    pl.vz = onFoot ? p.velocity.z : 0;
    pl.x = at.x;
    pl.y = at.y;
    pl.z = at.z;
    pl.eye = at.y + 1.62;
    pl.speed = onFoot ? p.speed : 0;
    pl.onFoot = onFoot && !play.game.cinematic;
    const list = world.vehicles;
    list.length = 0;
    world.aircraft = null;
    const fleet = play.fleet;
    for (let i = 0; i < fleet.length; i++) {
      const item = fleet[i];
      let r = fleetRecs[i];
      if (!r) {
        const size = SIZE[item.id] || [2.5, 1.05];
        r = fleetRecs[i] = { x: 0, y: 0, z: 0, vx: 0, vz: 0, fx: 1, fz: 0, halfL: size[0], halfW: size[1], speed: 0, air: false, kind: 'fleet', npc: null, item, yielding: null };
      }
      const c = item.car;
      r.x = c.position.x;
      r.y = c.position.y;
      r.z = c.position.z;
      r.vx = c.velocity.x;
      r.vz = c.velocity.z;
      const fl = Math.hypot(c.forward.x, c.forward.z) || 1;
      r.fx = c.forward.x / fl;
      r.fz = c.forward.z / fl;
      r.speed = Math.hypot(r.vx, r.vz);
      ray.origin.x = r.x;
      ray.origin.y = r.y + 0.8;
      ray.origin.z = r.z;
      const hit = ctx.physics.world.castRay(ray, 80, true, undefined, rayGroups);
      const above = hit ? (hit.timeOfImpact ?? hit.toi) - 0.8 : 99;
      r.air = above > 2.2;
      if (above > 3.2 && above < 60 && (r.speed > 3 || item.id === 'heli') && (item.car.state.occupied || r.speed > 3)) {
        if (!world.aircraft || Math.hypot(r.x - pl.x, r.z - pl.z) < Math.hypot(air.x - pl.x, air.z - pl.z)) {
          air.x = r.x;
          air.y = r.y;
          air.z = r.z;
          air.eye = r.y;
          world.aircraft = air;
        }
      }
      list.push(r);
      const struck = item.damage && item.damage.state ? item.damage.state.lastHit : 0;
      if (lastHit.has(item) && struck !== lastHit.get(item)) {
        crash.x = r.x;
        crash.y = r.y;
        crash.z = r.z;
        crash.eye = r.y + 1;
        crash.time = elapsed;
      }
      lastHit.set(item, struck);
    }
    traffic.records(list);
    crash.fresh = elapsed - crash.time < 1.2;
    world.crash = crash;
    world.signal = elapsed % 34;
  }

  setQuality(ctx.quality);

  const api = {
    world, peds, traffic, audio, pack,
    update(dt, time) {
      elapsed = time;
      setPedDaylight(ctx.lighting ? ctx.lighting.ambientScale : 1);
      sense(dt);
      traffic.update(dt);
      peds.update(dt);
      audio.update(traffic.cars);
    },
    setQuality,
    setEnabled(on) {
      enabled = on;
      setQuality(ctx.quality);
      if (!on) {
        peds.clear();
        traffic.clear();
      }
    },
    count: () => ({ people: peds.count, cars: traffic.count }),
    placePerson: (x, z, id, state) => peds.place(x, z, id, state),
    placeCar: (x, z, options) => traffic.place(x, z, options),
    fill: () => peds.fill(),
    freeze(on = true) {
      peds.freeze(on);
      traffic.freeze(on);
    },
    setTargets(people, cars) {
      peds.setTarget(people);
      traffic.setTarget(cars);
    },
    list: () => ({
      people: peds.actors.filter((a) => a.active).map((a) => ({ id: a.meta.id, x: +a.x.toFixed(1), z: +a.z.toFixed(1), state: Object.keys(peds.S).find((k) => peds.S[k] === a.state) })),
      cars: traffic.cars.filter((c) => c.active).map((c) => ({ type: c.type, x: +c.x.toFixed(1), z: +c.z.toFixed(1), v: +c.v.toFixed(1), mode: c.mode, lane: c.lane.id })),
    }),
  };
  return api;
}
