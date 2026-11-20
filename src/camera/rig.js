// Costa del Gzowo: third-person camera rig (orbit on foot, chase in the car) with lag, collision avoidance, speed FOV, shake and blended transitions.
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { GROUPS, groups } from '../core/physics.js';
import { heightAt } from '../world/heightfield.js';

export function createCameraRig({ camera, physics }) {
  const R = physics.RAPIER;
  const rig = { yaw: 2.2, pitch: 0.2, distance: 3.6, mode: 'foot', trauma: 0, blend: 1, carYaw: 0, orbit: 0, orbitIdle: 9, fov: 55, far: 0, zoom: 1 };
  const pivot = new THREE.Vector3();
  const pivotSmooth = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookSmooth = new THREE.Vector3();
  const fromPos = new THREE.Vector3();
  const fromQuat = new THREE.Quaternion();
  const toQuat = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const helper = new THREE.Object3D();
  const ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  let fromFov = 55;
  let currentDist = 3.6;
  let initialized = false;
  let time = 0;

  function avoid(from, to, mask) {
    dir.copy(to).sub(from);
    const len = dir.length();
    if (len < 0.01) return len;
    dir.multiplyScalar(1 / len);
    ray.origin.x = from.x;
    ray.origin.y = from.y;
    ray.origin.z = from.z;
    ray.dir.x = dir.x;
    ray.dir.y = dir.y;
    ray.dir.z = dir.z;
    const hit = physics.world.castRay(ray, len + 0.3, true, undefined, groups(0xffff, mask));
    if (!hit) return len;
    return Math.max(0.5, (hit.timeOfImpact ?? hit.toi) - 0.3);
  }

  function setMode(mode) {
    if (mode === rig.mode) return;
    rig.mode = mode;
    fromPos.copy(camera.position);
    fromQuat.copy(camera.quaternion);
    fromFov = camera.fov;
    rig.blend = 0;
    rig.orbit = 0;
    rig.orbitIdle = 9;
  }

  function update(dt, input, player, car, water) {
    time += dt;
    const mouse = input.mouse;
    let fov = 55;
    if (rig.mode === 'foot') {
      rig.yaw -= mouse.dx * 0.0026;
      rig.pitch = THREE.MathUtils.clamp(rig.pitch + mouse.dy * 0.0022, -0.55, 1.25);
      const p = player.state.position;
      const falling = player.state.mode === 'foot' && !player.state.grounded && player.state.vy < -5 ? 1 : 0;
      rig.far += (falling - rig.far) * Math.min(1, dt * 2.5);
      const sy = Math.sin(rig.yaw);
      const cy = Math.cos(rig.yaw);
      pivot.set(p.x - cy * 0.34, p.y + 1.52 + (player.state.mode === 'swim' ? -0.55 : 0), p.z + sy * 0.34);
      if (!initialized) pivotSmooth.copy(pivot);
      const kh = 1 - Math.exp(-14 * dt);
      const kv = 1 - Math.exp(-(falling ? 4 : 9) * dt);
      pivotSmooth.x += (pivot.x - pivotSmooth.x) * kh;
      pivotSmooth.z += (pivot.z - pivotSmooth.z) * kh;
      pivotSmooth.y += (pivot.y - pivotSmooth.y) * kv;
      const pitch = rig.pitch + rig.far * 0.28;
      const dist = rig.distance * (1 + rig.far * 0.5) * (player.state.speed > 4.5 ? 1.08 : 1);
      desired.set(pivotSmooth.x - sy * Math.cos(pitch) * dist, pivotSmooth.y + Math.sin(pitch) * dist, pivotSmooth.z - cy * Math.cos(pitch) * dist);
      const free = avoid(pivotSmooth, desired, GROUPS.WORLD | GROUPS.CAR);
      currentDist += (Math.min(free, dist) - currentDist) * Math.min(1, dt * (free < currentDist ? 30 : 4));
      desired.sub(pivotSmooth).normalize().multiplyScalar(currentDist).add(pivotSmooth);
      look.copy(pivotSmooth);
      fov = 55 + rig.far * 6;
    } else {
      const s = car.state;
      const f = car.forward;
      const speed = s.speed;
      tmp.copy(f);
      if (speed > 6 && car.velocity.dot(f) > 0) tmp.lerp(dir.copy(car.velocity).normalize(), 0.45);
      const targetYaw = Math.atan2(tmp.x, tmp.z) + (s.reverse && s.forwardSpeed < -2 ? Math.PI : 0);
      if (!initialized || rig.blend === 0) rig.carYaw = rig.blend === 0 && initialized ? rig.carYaw : targetYaw;
      let diff = targetYaw - rig.carYaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      rig.carYaw += diff * Math.min(1, dt * (3.2 + speed * 0.05));
      if (Math.abs(mouse.dx) + Math.abs(mouse.dy) > 0) {
        rig.orbit -= mouse.dx * 0.0026;
        rig.pitch = THREE.MathUtils.clamp(rig.pitch + mouse.dy * 0.002, -0.05, 0.9);
        rig.orbitIdle = 0;
      } else rig.orbitIdle += dt;
      if (rig.orbitIdle > 1.6) {
        rig.orbit = Math.atan2(Math.sin(rig.orbit), Math.cos(rig.orbit)) * (1 - Math.min(1, dt * 2.2));
        rig.pitch += (0.2 - rig.pitch) * Math.min(1, dt * 1.5);
      }
      const yaw = rig.carYaw + rig.orbit;
      const pitch = Math.max(rig.pitch, 0.06);
      const dist = (6.1 + Math.min(1.6, speed * 0.035)) * rig.zoom;
      pivot.copy(car.position).addScaledVector(car.up, 1.15);
      if (!initialized) pivotSmooth.copy(pivot);
      const k = 1 - Math.exp(-16 * dt);
      pivotSmooth.lerp(pivot, k);
      desired.set(pivotSmooth.x - Math.sin(yaw) * Math.cos(pitch) * dist, pivotSmooth.y + Math.sin(pitch) * dist + 0.35, pivotSmooth.z - Math.cos(yaw) * Math.cos(pitch) * dist);
      const free = avoid(pivotSmooth, desired, GROUPS.WORLD);
      currentDist += (Math.min(free, dist) - currentDist) * Math.min(1, dt * (free < currentDist ? 30 : 3));
      desired.sub(pivotSmooth).normalize().multiplyScalar(currentDist).add(pivotSmooth);
      look.copy(pivotSmooth).addScaledVector(f, 1.6);
      look.y += 0.15;
      fov = 55 + Math.min(1, speed / 55) * 15;
      rig.trauma = Math.max(rig.trauma, Math.min(0.25, (s.skid || 0) * 0.08 + (s.onGround > 0 && car.wheels.some((w) => w.surf.loose > 0.4) ? Math.min(0.1, speed * 0.004) : 0)));
    }
    const ground = heightAt(desired.x, desired.z);
    if (desired.y < ground + 0.3) desired.y = ground + 0.3;
    const level = water ? water.getHeightAt(desired.x, desired.z) : WORLD.waterLevel;
    if (rig.mode === 'car' && ground < level && desired.y < level + 0.45) desired.y = level + 0.45;
    if (ground < level && Math.abs(desired.y - level) < 0.16) desired.y = level + (desired.y >= level ? 0.16 : -0.16);

    if (!initialized) lookSmooth.copy(look);
    lookSmooth.lerp(look, 1 - Math.exp(-18 * dt));
    helper.position.copy(desired);
    helper.lookAt(lookSmooth);
    helper.rotateY(Math.PI);
    toQuat.copy(helper.quaternion);
    rig.trauma = Math.max(0, rig.trauma - dt * 1.4);
    const shake = rig.trauma * rig.trauma;
    if (shake > 0.0001) {
      helper.rotateX(Math.sin(time * 61) * 0.035 * shake);
      helper.rotateY(Math.sin(time * 47 + 1.3) * 0.035 * shake);
      helper.rotateZ(Math.sin(time * 53 + 2.1) * 0.05 * shake);
      toQuat.copy(helper.quaternion);
    }
    if (rig.blend < 1) {
      rig.blend = Math.min(1, rig.blend + dt / 1.1);
      const e = rig.blend * rig.blend * (3 - 2 * rig.blend);
      camera.position.lerpVectors(fromPos, desired, e);
      camera.quaternion.slerpQuaternions(fromQuat, toQuat, e);
      fov = THREE.MathUtils.lerp(fromFov, fov, e);
    } else {
      camera.position.copy(desired);
      camera.quaternion.copy(toQuat);
    }
    rig.fov += (fov - rig.fov) * Math.min(1, dt * 4);
    if (Math.abs(camera.fov - rig.fov) > 0.01) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
    initialized = true;
  }

  return {
    rig,
    update,
    setMode,
    shake(amount) {
      rig.trauma = Math.min(1, rig.trauma + amount);
    },
    forward(out) {
      return out.set(Math.sin(rig.mode === 'foot' ? rig.yaw : rig.carYaw + rig.orbit), 0, Math.cos(rig.mode === 'foot' ? rig.yaw : rig.carYaw + rig.orbit));
    },
  };
}
