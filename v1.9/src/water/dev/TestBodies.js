// Costa del Gzowo water harness: simple stand-in bodies (jumping character, falling or wading car) that feed splash and interactor data to the water.
import * as THREE from 'three';
import { LAYERS } from '../../config.js';
import { heightAt } from '../../world/heightfield.js';

let nextId = 1;

export class TestBody {
  constructor(kind, scene) {
    this.id = `body${nextId++}`;
    this.kind = kind;
    this.vehicle = kind === 'vehicle';
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.halfExtents = this.vehicle ? new THREE.Vector3(0.925, 0.71, 2.35) : new THREE.Vector3(0.3, 0.9, 0.3);
    this.radius = this.vehicle ? 2.5 : 0.32;
    this.mass = this.vehicle ? 1650 : 80;
    this.inWater = false;
    this.submersion = 0;
    this.waterTime = 0;
    this.path = null;
    const mat = new THREE.MeshStandardMaterial({ color: this.vehicle ? 0x1d3f6e : 0xc8643c, roughness: this.vehicle ? 0.25 : 0.7, metalness: this.vehicle ? 0.4 : 0 });
    const geo = this.vehicle ? new THREE.BoxGeometry(1.85, 1.42, 4.7) : new THREE.CapsuleGeometry(0.28, 1.24, 4, 12);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.layers.set(LAYERS.WORLD);
    scene.add(this.mesh);
    this.scene = scene;
  }

  followPath(points, speed) {
    this.path = { points, speed, s: 0 };
  }

  update(dt, water) {
    const hy = this.halfExtents.y;
    const surface = water.getHeightAt(this.position.x, this.position.z);
    if (this.path) {
      this.updatePath(dt, water, surface);
    } else {
      this.velocity.y -= 9.81 * dt;
      if (this.inWater) {
        const ratio = this.vehicle ? THREE.MathUtils.lerp(0.55, 1.15, Math.min(1, this.waterTime / 26)) : 0.92;
        const buoy = 9.81 * this.submersion / ratio;
        this.velocity.y += buoy * dt;
        const drag = Math.exp(-dt * (0.6 + 2.6 * this.submersion));
        this.velocity.multiplyScalar(drag);
      }
      this.position.addScaledVector(this.velocity, dt);
      const ground = heightAt(this.position.x, this.position.z) + hy;
      if (this.position.y < ground) {
        this.position.y = ground;
        this.velocity.y = Math.max(0, this.velocity.y);
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
      }
      if (this.vehicle && this.inWater) {
        const pitch = Math.min(0.35, this.waterTime * 0.04);
        this.quaternion.setFromEuler(new THREE.Euler(pitch, this.yaw ?? 0, Math.sin(this.waterTime * 0.7) * 0.03));
      }
    }
    const bottom = this.position.y - hy;
    this.submersion = THREE.MathUtils.clamp((surface - bottom) / (2 * hy), 0, 1);
    if (!this.inWater && this.submersion > 0) {
      this.inWater = true;
      if (!this.path && this.velocity.y < -1.5) {
        water.splash({
          position: new THREE.Vector3(this.position.x, surface, this.position.z),
          velocity: this.velocity.clone(),
          radius: this.radius,
          mass: this.mass,
          kind: this.kind,
        });
      }
    }
    if (this.inWater) this.waterTime += dt;
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(this.quaternion);
  }

  updatePath(dt, water, surface) {
    const p = this.path;
    p.s += p.speed * dt;
    const pts = p.points;
    let acc = 0;
    let i = 0;
    for (; i < pts.length - 1; i++) {
      const seg = pts[i].distanceTo(pts[i + 1]);
      if (acc + seg >= p.s) break;
      acc += seg;
    }
    if (i >= pts.length - 1) {
      this.path = null;
      return;
    }
    const a = pts[i];
    const b = pts[i + 1];
    const t = (p.s - acc) / a.distanceTo(b);
    const prev = this.position.clone();
    const x = THREE.MathUtils.lerp(a.x, b.x, t);
    const z = THREE.MathUtils.lerp(a.z, b.z, t);
    const ground = heightAt(x, z) + this.halfExtents.y;
    const floatY = surface - this.halfExtents.y * 0.25;
    this.position.set(x, Math.max(ground, floatY), z);
    this.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    this.quaternion.setFromEuler(new THREE.Euler(0, this.yaw, 0));
    if (dt > 0) this.velocity.subVectors(this.position, prev).divideScalar(dt);
  }

  interactor() {
    return {
      id: this.id,
      kind: this.kind,
      position: this.position,
      velocity: this.velocity,
      radius: this.radius,
      halfExtents: this.vehicle ? this.halfExtents : undefined,
      quaternion: this.vehicle ? this.quaternion : undefined,
      submersion: this.submersion,
    };
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
