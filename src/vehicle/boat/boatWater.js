// Costa del Gzowo boats: feeds the water simulation (hull interactor, stern wake and foam trail, bow and chine spray, rooster tail, strut wakes, thruster bubbles under water).
import * as THREE from 'three';
import { KIND } from '../../water/fx/ParticlePool.js';

const rand = (a, b) => a + Math.random() * (b - a);
const poisson = (mean) => Math.floor(mean) + (Math.random() < mean - Math.floor(mean) ? 1 : 0);

export function createBoatWater(car, spec, id) {
  const fx = spec.fx;
  const it = { id, kind: 'vehicle', position: new THREE.Vector3(), velocity: new THREE.Vector3(), radius: fx.halfLength, halfExtents: new THREE.Vector3(fx.halfLength, fx.halfHeight, fx.halfBeam), quaternion: new THREE.Quaternion(), submersion: 0 };
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  let wakeTimer = 0;
  let strutTimer = 0;

  return function update(dt, list) {
    const water = car.water;
    if (!water || !water.addRipple) return;
    const s = car.state;
    const speed = s.speed;
    const pos = car.position;
    const level = water.getHeightAt(pos.x, pos.z);
    const bottom = pos.y + car.bottomY * Math.max(0.2, car.up.y);
    const sub = Math.min(1, Math.max(0, (level - bottom) / (fx.halfHeight * 2)));
    const moving = speed > 0.4 || s.occupied;
    if (moving && sub > 0.02 && list.length < 7) {
      it.position.copy(pos).addScaledVector(car.up, fx.halfHeight * 0.4 - car.draft * 0.5);
      it.velocity.copy(car.velocity);
      it.quaternion.copy(car.quaternion);
      it.submersion = s.submerged ? 1 : sub;
      list.push(it);
    }
    const f = car.forward;
    const r = car.right;
    const vf = s.forwardSpeed;
    wakeTimer -= dt;
    if (wakeTimer <= 0 && Math.abs(vf) > 1.6 && sub > 0.02 && !s.submerged) {
      wakeTimer = 0.055;
      const k = Math.min(1, sub * 4);
      p.copy(pos).addScaledVector(f, -fx.halfLength * Math.sign(vf) * 0.95);
      water.addRipple(p.x, p.z, fx.halfBeam * 0.8, Math.min(3.6, 0.5 + Math.abs(vf) * 0.16) * k);
      if (Math.abs(vf) > 4) {
        for (const side of [-1, 1]) {
          q.copy(p).addScaledVector(r, side * fx.halfBeam * 0.85).addScaledVector(f, 0.4);
          water.addRipple(q.x, q.z, 0.6, Math.min(2.6, Math.abs(vf) * 0.12) * k);
          q.copy(pos).addScaledVector(r, side * fx.halfBeam * 1.05).addScaledVector(f, fx.halfLength * 0.35);
          water.addRipple(q.x, q.z, 0.45, Math.min(1.8, Math.abs(vf) * 0.08) * k);
        }
      }
    }
    const spray = water.spray;
    if (spray && vf > 3 && sub > 0.02 && !s.submerged) {
      const rate = Math.min(420, (vf - 3) * (vf - 3) * fx.spray) * Math.min(1, sub * 3);
      const n = poisson(rate * dt);
      for (let i = 0; i < n; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const along = rand(fx.sprayFrom, fx.sprayTo);
        p.copy(pos).addScaledVector(f, along).addScaledVector(r, side * fx.halfBeam * rand(0.75, 1.0));
        const y = level + 0.03;
        const out = rand(0.6, 1.4) * (1.2 + vf * 0.12);
        const upv = rand(0.8, 1.8) * (0.7 + vf * 0.07);
        spray.spawn(KIND.DROPLET, p.x, y, p.z, r.x * side * out + f.x * vf * rand(0.1, 0.35), upv, r.z * side * out + f.z * vf * rand(0.1, 0.35), rand(0.012, 0.045), rand(0.7, 1.4), rand(0.5, 0.9), rand(0.1, 0.3));
      }
      if (Math.random() < rate * dt * 0.04) {
        const side = Math.random() < 0.5 ? -1 : 1;
        p.copy(pos).addScaledVector(f, rand(fx.sprayFrom, fx.sprayTo)).addScaledVector(r, side * fx.halfBeam);
        const size = rand(0.5, 1.3);
        spray.spawn(KIND.SHEET, p.x, level + 0.2, p.z, r.x * side * 2.2, rand(0.8, 2.2), r.z * side * 2.2, size, rand(0.5, 1.0), 0.35, 0.4, size * 0.6);
      }
      if (fx.rooster && s.prop > 0.3 && vf > 9 && s.throttle > 0.3) {
        const m = poisson(Math.min(160, (vf - 8) * 12) * dt * fx.rooster);
        p.copy(pos).addScaledVector(f, -fx.halfLength - 0.4);
        for (let i = 0; i < m; i++) {
          spray.spawn(KIND.DROPLET, p.x + rand(-0.15, 0.15), level + 0.05, p.z + rand(-0.15, 0.15), -f.x * vf * rand(0.15, 0.4) + rand(-0.6, 0.6), rand(2.5, 4.5) + vf * 0.08, -f.z * vf * rand(0.15, 0.4) + rand(-0.6, 0.6), rand(0.015, 0.05), rand(0.9, 1.6), rand(0.5, 0.9), rand(0.05, 0.2));
        }
      }
    }
    if (fx.struts && s.foiling > 0.2 && vf > 4) {
      strutTimer -= dt;
      if (strutTimer <= 0) {
        strutTimer = 0.06;
        for (const st of fx.struts) {
          p.set(st[0], 0, st[1]).applyQuaternion(car.quaternion).add(pos);
          water.addRipple(p.x, p.z, 0.35, Math.min(1.2, vf * 0.05));
          if (spray) {
            const n = poisson(vf * 0.7);
            for (let i = 0; i < n; i++) spray.spawn(KIND.DROPLET, p.x + f.x * 0.1, level + 0.02, p.z + f.z * 0.1, -f.x * vf * rand(0.05, 0.3) + r.x * rand(-1.4, 1.4), rand(0.8, 2.2), -f.z * vf * rand(0.05, 0.3) + r.z * rand(-1.4, 1.4), rand(0.01, 0.035), rand(0.5, 1.1), rand(0.55, 0.9), 0.2);
            if (Math.random() < 0.35) {
              const size = rand(0.3, 0.7);
              spray.spawn(KIND.SHEET, p.x, level + 0.12, p.z, -f.x * vf * 0.2, rand(0.6, 1.4), -f.z * vf * 0.2, size, rand(0.4, 0.8), 0.35, 0.4, size * 0.5);
            }
          }
        }
      }
    }
    if (water.bubbles && s.flood > 0.03 && s.flood < 1 && s.ingress > 0) {
      const m = poisson(Math.min(240, s.ingress * 120 * 400 * (s.sunk ? 0.5 : 1)) * dt);
      for (let i = 0; i < m; i++) {
        p.set(rand(-fx.halfLength, fx.halfLength) * 0.7, rand(0, fx.halfHeight), rand(-fx.halfBeam, fx.halfBeam) * 0.7).applyQuaternion(car.quaternion).add(pos);
        if (p.y > level - 0.05) p.y = level - 0.1;
        water.bubbles.spawn(KIND.BUBBLE, p.x, p.y, p.z, rand(-0.2, 0.2), rand(0.3, 0.9), rand(-0.2, 0.2), rand(0.01, 0.05), rand(2, 5), rand(0.5, 0.9), 0);
      }
    }
    if (fx.thrusters && water.bubbles && s.submerged && (s.throttle > 0.05 || s.brake > 0.05 || Math.random() < dt * 3)) {
      const n = poisson((8 + 110 * Math.max(s.throttle, s.brake)) * dt);
      for (const th of fx.thrusters) {
        p.set(th[0], th[1], th[2]).applyQuaternion(car.quaternion).add(pos);
        for (let i = 0; i < n; i++) water.bubbles.spawn(KIND.BUBBLE, p.x + rand(-0.06, 0.06), p.y + rand(-0.06, 0.06), p.z + rand(-0.06, 0.06), -f.x * rand(0.5, 2.5), rand(0.1, 0.5), -f.z * rand(0.5, 2.5), rand(0.006, 0.03), rand(2, 5), rand(0.5, 0.9), 0);
      }
    }
  };
}
