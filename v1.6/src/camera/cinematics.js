// Costa del Gzowo: live cinematic shots shown behind the title screen (slow dollies with hard cuts).
import * as THREE from 'three';
import { SPAWN } from '../config.js';
import { heightAt } from '../world/heightfield.js';

export function createCinematics({ camera, pipeline, lighting }) {
  const cx = SPAWN.car.x;
  const cz = SPAWN.car.z;
  const cy = heightAt(cx, cz);
  const shots = [
    { from: [1, 11.6, 7.5], to: [9, 11.1, 9.5], look: [16, 1, 130], fov: 40, time: 8 },
    { from: [cx + 5.6, cy + 1.0, cz + 3.2], to: [cx + 3.4, cy + 1.25, cz + 5.4], look: [cx, cy + 0.7, cz], fov: 36, time: 7 },
    { from: [-9, 0.75, 72], to: [-5, 0.95, 54], look: [0, 5.5, 0], fov: 46, time: 8 },
    { from: [-42, 9.95, -5.5], to: [-30, 9.95, -5.5], look: [44, 9.1, -2.6], fov: 32, time: 7 },
    { from: [-37, 1.5, -15], to: [-31, 1.7, -9.5], look: [8, 4.6, 5], fov: 50, time: 7 },
    { from: [-101, 5.6, 29], to: [-97, 5.8, 32.5], look: [-60, 8, 70], fov: 38, time: 7 },
    { from: [-150, 58, -120], to: [-122, 54, -100], look: [12, 0, 36], fov: 44, time: 9 },
  ];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const look = new THREE.Vector3();
  let index = -1;
  let t = 0;

  function cut(next) {
    index = next % shots.length;
    t = 0;
    const shot = shots[index];
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    lighting.resize();
    pipeline.reset = true;
  }

  return {
    update(dt) {
      if (index < 0 || t >= shots[index].time) cut(index + 1);
      const shot = shots[index];
      t += dt;
      const k = Math.min(1, t / shot.time);
      a.fromArray(shot.from);
      b.fromArray(shot.to);
      camera.position.lerpVectors(a, b, k);
      const ground = heightAt(camera.position.x, camera.position.z);
      if (camera.position.y < ground + 0.35) camera.position.y = ground + 0.35;
      look.fromArray(shot.look);
      camera.lookAt(look);
    },
    stop() {
      camera.fov = 55;
      camera.updateProjectionMatrix();
      lighting.resize();
      pipeline.reset = true;
    },
  };
}
