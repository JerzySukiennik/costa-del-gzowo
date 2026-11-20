// Costa del Gzowo: gameplay orchestration (on-foot and driving modes, entering and leaving the car, effects, water interaction hooks).
import * as THREE from 'three';
import { SPAWN, WORLD } from './config.js';
import { GROUPS, groups } from './core/physics.js';
import { heightAt } from './world/heightfield.js';
import { createCharacter } from './player/character.js';
import { createAvatars } from './player/avatars.js';
import { createPlayer } from './player/controller.js';
import { createCarModel } from './vehicle/carModel.js';
import { createCarPhysics } from './vehicle/carPhysics.js';
import { createCarDamage } from './vehicle/carDamage.js';
import { createCameraRig } from './camera/rig.js';
import { createParticles } from './fx/particles.js';
import { createSkidmarks } from './fx/skidmarks.js';
import { createHud } from './ui/hud.js';

const STEP = 1 / 120;
const DOOR_LOCAL = new THREE.Vector3(0.3, 0, -1.55);
const EXIT_LOCAL = new THREE.Vector3(0.25, 0, -1.75);

export async function createGame(ctx) {
  const { scene, camera, physics, terrain, input, props, grass } = ctx;
  const audio = ctx.audio || null;
  const particles = createParticles(scene);
  const skidmarks = createSkidmarks(scene);
  const hud = createHud();
  const character = await createCharacter(ctx);
  scene.add(character.group);
  const avatars = createAvatars(ctx, character);
  if (ctx.avatar && ctx.avatar !== 'default') await avatars.set(ctx.avatar).catch((error) => console.warn('Avatar unavailable, using the default one.', error));
  const carModel = await createCarModel(ctx);
  scene.add(carModel.group);
  const car = createCarPhysics({ physics, terrain, model: carModel, spawn: SPAWN.car });
  const damage = createCarDamage({ physics, scene, model: carModel, car, particles, audio });
  const player = createPlayer({ physics, character, spawn: SPAWN.player });
  const rig = createCameraRig({ camera, physics });
  rig.rig.yaw = SPAWN.player.yaw;

  const game = { mode: 'foot', transition: null, beams: false, water: null, time: 0 };
  const moveInput = { x: 0, z: 0, sprint: false, jump: false };
  const f = new THREE.Vector3();
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const doorWorld = new THREE.Vector3();
  const seatWorld = new THREE.Vector3();
  const ray = new physics.RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const interactors = [];
  const carInteractor = { id: 'car', kind: 'vehicle', position: new THREE.Vector3(), velocity: new THREE.Vector3(), radius: 2.4, halfExtents: new THREE.Vector3(2.3, 0.6, 0.92), quaternion: new THREE.Quaternion(), submersion: 0 };
  const playerInteractor = { id: 'player', kind: 'character', position: new THREE.Vector3(), velocity: new THREE.Vector3(), radius: 0.32, submersion: 0 };
  let acc = 0;
  let carWasWet = false;
  let carDryTime = 5;
  let stepTimer = 0;
  let exitHint = 0;
  let lastHitSeen = 0;
  let wasOccupied = false;
  const pushA = new THREE.Vector4();
  const pushB = new THREE.Vector4();
  const bodyShadow = new THREE.Vector4();

  function groundBelow(x, y, z) {
    ray.origin.x = x;
    ray.origin.y = y;
    ray.origin.z = z;
    const hit = physics.world.castRay(ray, 6, true, undefined, groups(0xffff, GROUPS.WORLD));
    return hit ? y - (hit.timeOfImpact ?? hit.toi) : null;
  }

  function seatCharacter() {
    carModel.group.add(character.group);
    character.group.position.copy(carModel.seat);
    character.group.rotation.set(0, Math.PI / 2, 0);
  }

  function beginEnter() {
    game.transition = { type: 'enter', t: 0, from: character.group.position.clone(), yaw: character.group.rotation.y };
    player.setEnabled(false);
    player.state.mode = 'car';
    carModel.setDoor('doorFL', true);
    if (audio) audio.door(true);
  }

  function beginExit() {
    game.transition = { type: 'exit', t: 0 };
    carModel.setDoor('doorFL', true);
    car.state.occupied = false;
    if (audio) audio.door(true);
  }

  function updateTransition(dt) {
    const tr = game.transition;
    if (!tr) return;
    tr.t += dt;
    if (tr.type === 'enter') {
      if (tr.t > 0.3 && game.mode !== 'car') {
        game.mode = 'car';
        rig.setMode('car');
      }
      if (tr.t >= 0.4 && !tr.attached) {
        tr.attached = true;
        scene.attach(character.group);
        carModel.group.attach(character.group);
        tr.local = character.group.position.clone();
      }
      if (tr.attached) {
        const k = Math.min(1, (tr.t - 0.4) / 0.5);
        const e = k * k * (3 - 2 * k);
        character.group.position.lerpVectors(tr.local, carModel.seat, e);
        character.group.rotation.set(0, THREE.MathUtils.lerp(character.group.rotation.y, Math.PI / 2, e), 0);
      }
      if (tr.t > 0.95 && !tr.closed) {
        tr.closed = true;
        carModel.setDoor('doorFL', false);
        if (audio) audio.door(false);
      }
      if (tr.t > 1.35) {
        seatCharacter();
        car.state.occupied = true;
        game.transition = null;
        exitHint = 4;
      }
    } else {
      v.copy(EXIT_LOCAL);
      carModel.group.localToWorld(v);
      if (tr.t >= 0.4 && !tr.detached) {
        tr.detached = true;
        tr.local = character.group.position.clone();
      }
      if (tr.detached && tr.t < 0.95) {
        const k = Math.min(1, (tr.t - 0.4) / 0.5);
        const e = k * k * (3 - 2 * k);
        character.group.position.lerpVectors(tr.local, v2.copy(EXIT_LOCAL).setY(0.05), e);
      }
      if (tr.t >= 0.95 && !tr.out) {
        tr.out = true;
        const p = carModel.group.position;
        const ground = groundBelow(v.x, p.y + 1.6, v.z);
        const y = ground !== null ? ground : p.y - 0.3;
        scene.attach(character.group);
        const yaw = Math.atan2(car.forward.x, car.forward.z);
        player.state.mode = 'foot';
        player.teleport(v.x, y + 0.02, v.z, yaw);
        player.setEnabled(true);
        game.mode = 'foot';
        rig.rig.yaw = yaw;
        rig.setMode('foot');
        carModel.setDoor('doorFL', false);
        if (audio) audio.door(false);
      }
      if (tr.t > 1.3) game.transition = null;
    }
  }

  function tyreEffects(dt) {
    car.wheels.forEach((w, i) => {
      const hard = w.surface === 'asphalt' || w.surface === 'concrete';
      v.copy(car.forward);
      skidmarks.mark(i, w.point, w.normal, v, 0.22, w.contact && hard && w.skid > 0.3);
      if (!w.contact) return;
      const speed = car.state.speed;
      if (hard && w.skid > 0.35 && Math.random() < dt * 60 * w.skid) particles.puff(w.point, [0.78, 0.78, 0.8], 0.22 * w.skid, 0.35, 1.3, 0.5, 0.5);
      else if (w.surf.loose > 0.3 && !w.wet && (speed > 4 || w.skid > 0.2) && Math.random() < dt * (10 + speed * 1.2 + w.skid * 50) * w.surf.loose) {
        const c = w.surface === 'sand' ? [0.62, 0.56, 0.44] : w.surface === 'gravel' ? [0.58, 0.55, 0.5] : [0.42, 0.36, 0.27];
        particles.puff(w.point, c, 0.2 + 0.25 * w.skid, 0.4, 1.6, 0.5, 0.6);
      }
    });
    skidmarks.update();
  }

  function waterHooks(dt) {
    const water = game.water;
    interactors.length = 0;
    const cs = car.state;
    if (cs.inWater) {
      carInteractor.position.copy(car.position).addScaledVector(car.up, 0.55);
      carInteractor.velocity.copy(car.velocity);
      carInteractor.quaternion.copy(car.quaternion);
      carInteractor.submersion = cs.submersion;
      interactors.push(carInteractor);
      carDryTime = 0;
      if (!carWasWet) {
        carWasWet = true;
        if (car.velocity.length() > 1.5) {
          v.copy(car.position).addScaledVector(car.forward, Math.sign(cs.forwardSpeed || 1) * 1.2);
          v.y = water ? water.getHeightAt(v.x, v.z) : WORLD.waterLevel;
          if (water) water.splash({ position: v.clone(), velocity: car.velocity.clone(), radius: 1.7, mass: car.mass, kind: 'vehicle' });
          if (audio) audio.splash(Math.min(1, car.velocity.length() / 12) * 1.0 + 0.4, v);
          rig.shake(Math.min(0.6, car.velocity.length() * 0.05));
        }
      }
      carModel.paintUniforms.uDirt.value = Math.max(0.05, carModel.paintUniforms.uDirt.value - dt * 0.08);
    } else {
      carDryTime += dt;
      if (carDryTime > 1.2) carWasWet = false;
      const loose = car.wheels.reduce((a, w) => a + (w.contact ? w.surf.loose : 0), 0) / 4;
      carModel.paintUniforms.uDirt.value = Math.min(1, carModel.paintUniforms.uDirt.value + dt * loose * cs.speed * 0.0016);
    }
    const ps = player.state;
    if (game.mode === 'foot' && ps.inWater) {
      playerInteractor.position.set(ps.position.x, water ? water.getHeightAt(ps.position.x, ps.position.z) : WORLD.waterLevel, ps.position.z);
      playerInteractor.velocity.set(ps.velocity.x, ps.vy, ps.velocity.z);
      playerInteractor.submersion = Math.min(1, ps.depth / 1.6);
      interactors.push(playerInteractor);
    }
    if (water) water.setInteractors(interactors);
    for (const e of player.events.splice(0)) {
      if (e.type === 'splash') {
        if (water) water.splash({ position: new THREE.Vector3(e.x, e.y, e.z), velocity: new THREE.Vector3(e.vx, e.vy, e.vz), radius: 0.36, mass: 78, kind: 'character' });
        if (audio) audio.splash(Math.min(1, -e.vy / 12) * 0.7 + 0.15, new THREE.Vector3(e.x, e.y, e.z));
        rig.shake(Math.min(0.35, -e.vy * 0.025));
      } else if (e.type === 'land') {
        if (audio) audio.land(e.speed, ps.position);
        if (e.speed > 7) rig.shake(0.2);
      } else if (e.type === 'jump' && audio) audio.jump();
    }
  }

  function update(dt, elapsed) {
    game.time = elapsed;
    const inCar = game.mode === 'car' && !game.transition;
    rig.forward(f);
    const fw = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const strafe = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    moveInput.x = f.x * fw - f.z * strafe;
    moveInput.z = f.z * fw + f.x * strafe;
    moveInput.sprint = input.key('ShiftLeft', 'ShiftRight');
    moveInput.jump = game.mode === 'foot' && input.hit('Space');
    car.controls.throttle = inCar && fw > 0 ? 1 : 0;
    car.controls.brake = inCar && fw < 0 ? 1 : 0;
    car.controls.steer = inCar ? -strafe : 0;
    car.controls.handbrake = inCar && input.key('Space');

    doorWorld.copy(DOOR_LOCAL);
    carModel.group.localToWorld(doorWorld);
    const nearDoor = game.mode === 'foot' && !game.transition && doorWorld.distanceTo(player.center(v)) < 2.3;
    if (input.hit('KeyF') && !game.transition) {
      if (nearDoor) beginEnter();
      else if (inCar && car.state.speed < 4.5) beginExit();
    }
    if (inCar) {
      if (input.hit('KeyR')) {
        car.reset();
        if (car.state.submersion > 0.3 || car.position.y < -1) car.respawn();
      }
      if (input.hit('KeyT')) {
        carModel.toggleRoof();
        if (audio) audio.roof();
      }
      if (input.hit('KeyH')) game.beams = !game.beams;
      if (ctx.radio && input.hit('KeyQ')) ctx.radio.step(-1);
      if (ctx.radio && input.hit('KeyE')) ctx.radio.step(1);
      if (input.hit('KeyC')) rig.rig.zoom = rig.rig.zoom > 1.3 ? 0.78 : rig.rig.zoom < 0.9 ? 1 : 1.45;
    }
    updateTransition(dt);
    if (ctx.radio && car.state.occupied !== wasOccupied) {
      wasOccupied = car.state.occupied;
      if (wasOccupied && !car.state.stalled) ctx.radio.enter();
      else ctx.radio.exit();
    }
    if (ctx.radio && car.state.stalled) ctx.radio.kill();

    acc = Math.min(acc + dt, STEP * 8);
    let first = true;
    while (acc >= STEP) {
      car.substep(STEP);
      player.fixedUpdate(STEP, { ...moveInput, jump: first && moveInput.jump }, game.water);
      physics.step();
      acc -= STEP;
      first = false;
    }
    car.sync();
    carModel.update(dt);
    damage.update(dt);
    props.update(dt, elapsed, game.water);
    const braking = car.state.occupied && !car.state.reverse ? car.state.brake : car.state.reverse ? car.state.brake : 0;
    carModel.setLights({ brake: braking > 0.05 ? 1 : 0, reverse: car.state.reverse && car.state.occupied, beam: game.beams });
    player.sync(dt, { steer: car.state.steer / 0.6, throttle: car.state.throttle });
    tyreEffects(dt);
    waterHooks(dt);
    particles.update(dt);
    if (damage.state.lastHit !== lastHitSeen) {
      lastHitSeen = damage.state.lastHit;
      rig.shake(0.55);
    }

    if (game.mode === 'foot' && player.state.grounded && player.state.speed > 0.6 && audio) {
      stepTimer -= dt * (player.state.speed > 4.5 ? 2.9 : 1.9) * Math.max(0.6, player.state.speed / 3.3);
      if (stepTimer <= 0) {
        stepTimer = 1;
        const ps = player.state;
        ray.origin.x = ps.position.x;
        ray.origin.y = ps.position.y + 0.6;
        ray.origin.z = ps.position.z;
        const below = physics.world.castRay(ray, 1.2, true, undefined, groups(0xffff, GROUPS.WORLD));
        const kind = below ? physics.surfaceOf(below.collider) : 'terrain';
        audio.footstep(ps.inWater ? 'water' : kind === 'terrain' ? terrain.groundAt(ps.position.x, ps.position.z) : 'hard', ps.position, ps.speed);
      }
    }

    exitHint = Math.max(0, exitHint - dt);
    if (nearDoor) hud.prompt('F', 'Enter car');
    else if (inCar && car.state.stalled) hud.prompt('R', 'Engine flooded, reset car');
    else if (inCar && exitHint > 0 && car.state.speed < 1) hud.prompt('F', 'Exit   ·   Q E radio   ·   T roof   ·   H lights');
    else hud.prompt('', '');
    hud.drive(game.mode === 'car', car.state);
    hud.note(damage.state.note);

    if (!game.cinematic) rig.update(dt, input, player, car, game.water);
    v.copy(player.state.position);
    const onFoot = game.mode === 'foot' && !game.transition;
    pushA.set(v.x, onFoot ? v.y : -100, v.z, 0.75);
    pushB.set(car.position.x, car.position.y, car.position.z, 2.5);
    bodyShadow.set(v.x, onFoot ? v.y : -1000, v.z, 0.3);
    grass.update(camera.position, pushA, pushB, carModel.group.matrixWorld, bodyShadow);
    if (audio) audio.update(dt, { game, car, player, camera, water: game.water });
    input.endFrame();
  }

  character.snap({ mode: 'foot', speed: 0, vy: 0, wade: 0 });
  player.sync(0.016, { steer: 0, throttle: 0 });

  return {
    game, update, hud, car, carModel, damage, player, character, avatars, rig, particles,
    setWater(water) {
      game.water = water;
      car.setWater(water);
    },
    setViewport(height) {
      particles.setHeight(height);
    },
    seat() {
      player.setEnabled(false);
      player.state.mode = 'car';
      game.mode = 'car';
      rig.setMode('car');
      seatCharacter();
      car.state.occupied = true;
    },
  };
}
