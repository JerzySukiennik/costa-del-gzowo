// Riverside water: turns splash events and per-frame interactors into droplets, spray sheets, mist, bubble plumes and sim impulses.
import { KIND } from './ParticlePool.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class SplashFX {
  constructor({ spray, bubbles, sim, heightAt, bedDepthAt, scale = 1 }) {
    this.spray = spray;
    this.bubbles = bubbles;
    this.sim = sim;
    this.heightAt = heightAt;
    this.bedDepthAt = bedDepthAt;
    this.scale = scale;
    this.pending = [];
    this.time = 0;
    this.bodies = new Map();
    this.impactBudget = 0;
  }

  schedule(delay, fn) {
    this.pending.push({ at: this.time + delay, fn });
  }

  splash({ position, velocity, radius = 0.4, mass = 80, kind = 'character', extents = null }) {
    const x = position.x;
    const z = position.z;
    const y = this.heightAt(x, z);
    const vy = Math.min(-0.5, velocity.y);
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const energy = 0.5 * mass * speed * speed;
    const vehicle = kind === 'vehicle';
    if (vehicle && !extents) extents = { hx: radius * 0.4, hz: radius, fx: 0, fz: 1, ax: 1, az: 0 };
    const debris = kind === 'debris';
    const e = Math.log10(1 + energy / 200);
    const r = radius;
    const depth = Math.max(0.2, this.bedDepthAt(x, z));
    const shallow = Math.min(1, depth / (vehicle ? 1.6 : 0.9));
    const s = this.scale;
    const impact = Math.min(-vy, 16);

    const craterA = -(vehicle ? 2.0 : debris ? 0.6 : 1.5) * Math.min(1.6, impact / 8 + 0.35) * (0.6 + e * 0.25);
    const craterB = -(vehicle ? 0.55 : debris ? 0.08 : 0.22) * Math.min(1.6, impact / 8 + 0.3) * (0.5 + e * 0.25);
    const foam = vehicle ? 2.2 : debris ? 0.5 : 1.6;
    this.sim.addImpulse(x, z, r * (vehicle ? 1.15 : 1.5), craterA, { ripple: 1, swell: 0, foam, turbulence: vehicle ? 4 : 3 });
    this.sim.addImpulse(x, z, r * (vehicle ? 2.0 : 2.6), craterB, { ripple: 0, swell: 1, foam: foam * 0.4, turbulence: 1 });
    this.schedule(vehicle ? 0.55 : 0.3, () => {
      this.sim.addImpulse(x, z, r * 0.9, -craterA * 0.55, { ripple: 1, swell: 0.3, foam: foam * 0.4, turbulence: 1 });
    });
    this.schedule(vehicle ? 1.1 : 0.65, () => {
      this.sim.addImpulse(x, z, r * 1.2, craterA * 0.25, { ripple: 1, swell: 0.2, foam: 0.3, turbulence: 0.6 });
    });

    const rings = vehicle ? [[0.12, 1.6], [0.35, 2.6], [0.7, 3.8], [1.1, 4.8]] : [[0.12, 1.3], [0.3, 2.0], [0.55, 2.8], [0.9, 3.5]];
    for (const [delay, k] of rings) {
      this.schedule(delay, () => {
        const n = vehicle ? 14 : 10;
        const rad = r * k;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
          const rr = rad * rand(0.85, 1.15);
          this.sim.addImpulse(x + Math.cos(a) * rr, z + Math.sin(a) * rr, rad * 0.35, 0, { ripple: 0, swell: 0, foam: (vehicle ? 0.6 : 0.32) * rand(0.3, 1.3), turbulence: 0.6 });
        }
      });
    }
    const hx = vehicle ? r * 1.25 : r;
    const ringR = r * (vehicle ? 1.0 : 0.85);
    const crownCount = Math.round((vehicle ? 1500 : debris ? 40 : 260) * s * Math.min(1.5, 0.4 + impact / 12));
    for (let i = 0; i < crownCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const elev = rand(0.95, 1.4);
      const sp = impact * rand(0.22, vehicle ? 0.7 : 0.6) * (0.6 + 0.4 * shallow);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rr = ringR * rand(0.7, 1.15);
      const along = vehicle ? rand(0.8, 1.6) : 1;
      this.spray.spawn(KIND.DROPLET, x + ca * rr * along, y + 0.03, z + sa * rr, ca * Math.cos(elev) * sp + velocity.x * 0.15, Math.sin(elev) * sp, sa * Math.cos(elev) * sp + velocity.z * 0.15, rand(vehicle ? 0.06 : 0.035, vehicle ? 0.18 : 0.085), rand(1.2, 2.6), rand(0.7, 1.0), rand(0.04, 0.2));
    }
    const sheetCount = Math.round((vehicle ? 70 : debris ? 2 : 26) * Math.max(0.6, s));
    for (let i = 0; i < sheetCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = impact * rand(0.18, 0.45);
      const size = vehicle ? rand(0.9, 2.4) : rand(0.3, 0.75);
      const elev = rand(1.05, 1.4);
      this.spray.spawn(KIND.SHEET, x + Math.cos(a) * ringR * 0.8, y + size * 0.3, z + Math.sin(a) * ringR * 0.8, Math.cos(a) * Math.cos(elev) * sp, Math.sin(elev) * sp, Math.sin(a) * Math.cos(elev) * sp, size, rand(0.8, vehicle ? 2.2 : 1.4), rand(0.6, 0.9), rand(0.06, 0.16), size * rand(0.4, 0.9));
    }
    if (vehicle) {
      const fp = extents;
      const wall = Math.round(90 * Math.max(0.6, s));
      for (let i = 0; i < wall; i++) {
        const t = Math.random() * 4;
        const side = Math.floor(t);
        const u = (t - side) * 2 - 1;
        const lx = side < 2 ? u * fp.hx : (side === 2 ? -1 : 1) * fp.hx;
        const lz = side < 2 ? (side === 0 ? -1 : 1) * fp.hz : u * fp.hz;
        const ox = fp.ax * lx + fp.fx * lz;
        const oz = fp.az * lx + fp.fz * lz;
        const ol = Math.hypot(ox, oz) || 1;
        const out = impact * rand(0.15, 0.4);
        const up = impact * rand(0.35, 0.75);
        const size = rand(0.6, 1.6);
        this.spray.spawn(KIND.SHEET, x + ox, y + 0.2, z + oz, (ox / ol) * out, up, (oz / ol) * out, size, rand(1.2, 2.4), rand(0.7, 0.95), rand(0.04, 0.1), size * rand(0.3, 0.7));
      }
    }
    const mistCount = Math.round((vehicle ? 34 : debris ? 0 : 10) * Math.max(0.6, s));
    for (let i = 0; i < mistCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const size = vehicle ? rand(1.4, 3.2) : rand(0.4, 1.0);
      this.spray.spawn(KIND.MIST, x + Math.cos(a) * hx * rand(0.3, 1.2), y + rand(0.2, vehicle ? 2.5 : 1.0), z + Math.sin(a) * hx * rand(0.3, 1.2), Math.cos(a) * rand(0.3, 1.5), rand(0.5, impact * 0.25), Math.sin(a) * rand(0.3, 1.5), size, rand(1.6, vehicle ? 3.8 : 2.4), rand(0.12, 0.26), 0.6, size * rand(0.5, 1.1));
    }
    if (!debris) {
      this.schedule(vehicle ? 0.42 : 0.24, () => {
        const jet = Math.round((vehicle ? 260 : 90) * s);
        const jetSpeed = Math.min(9, impact * (vehicle ? 0.55 : 0.42));
        for (let i = 0; i < jet; i++) {
          const a = Math.random() * Math.PI * 2;
          const spread = rand(0, 0.6);
          const up = jetSpeed * rand(0.45, 1.0);
          this.spray.spawn(KIND.DROPLET, x + Math.cos(a) * r * 0.2, y + 0.05, z + Math.sin(a) * r * 0.2, Math.cos(a) * spread, up, Math.sin(a) * spread, rand(0.035, vehicle ? 0.13 : 0.085), rand(1.0, 2.0), rand(0.7, 1.0), rand(0.04, 0.18));
        }
        for (let i = 0; i < (vehicle ? 10 : 4); i++) {
          const size = vehicle ? rand(0.8, 1.8) : rand(0.25, 0.5);
          this.spray.spawn(KIND.SHEET, x, y + 0.1, z, rand(-0.3, 0.3), jetSpeed * rand(0.4, 0.8), rand(-0.3, 0.3), size, rand(0.6, 1.1), 0.45, 0.4, size * 0.4);
        }
      });
    }

    const plume = Math.round((vehicle ? 1100 : debris ? 40 : 420) * s);
    const plumeDepth = Math.min(depth - 0.1, (vehicle ? 0.22 : 0.17) * impact + 0.3);
    const dirx = velocity.x / speed || 0;
    const dirz = velocity.z / speed || 0;
    for (let i = 0; i < plume; i++) {
      const t = Math.pow(Math.random(), 0.7);
      const d = t * plumeDepth;
      const spread = (0.25 + t * 0.6) * (vehicle ? r * 0.8 : r * 1.2);
      const a = Math.random() * Math.PI * 2;
      const bx = x + dirx * d * 0.5 + Math.cos(a) * spread * Math.random();
      const bz = z + dirz * d * 0.5 + Math.sin(a) * spread * Math.random();
      this.bubbles.spawn(KIND.BUBBLE, bx, y - 0.05 - d, bz, Math.cos(a) * rand(0, 0.8), -rand(0, impact * 0.12), Math.sin(a) * rand(0, 0.8), rand(0.006, vehicle ? 0.05 : 0.03), rand(2.5, 7), rand(0.5, 0.95), 0);
    }
  }

  ripple(x, z, radius, strength) {
    this.sim.addImpulse(x, z, radius, -strength, { ripple: 1, swell: 0.15 * Math.min(1, radius), foam: Math.min(0.6, strength * 0.25), turbulence: strength * 0.3 });
  }

  updateInteractors(list, dt) {
    const seen = new Set();
    for (const it of list) {
      seen.add(it.id);
      let body = this.bodies.get(it.id);
      if (!body) {
        body = { air: 1, rippleTimer: 0, prevSub: it.submersion };
        this.bodies.set(it.id, body);
      }
      const vx = it.velocity.x;
      const vz = it.velocity.z;
      const h = Math.hypot(vx, vz);
      const sub = it.submersion;
      const px = it.position.x;
      const pz = it.position.z;
      const surface = this.heightAt(px, pz);
      if (it.kind === 'vehicle') {
        const hx = it.halfExtents?.x ?? 0.93;
        const hy = it.halfExtents?.y ?? 0.71;
        const hz = it.halfExtents?.z ?? 2.35;
        const fwd = it.footprint;
        const dirx = h > 0.01 ? vx / h : fwd.fx;
        const dirz = h > 0.01 ? vz / h : fwd.fz;
        if (sub > 0.04 && sub < 0.9 && h > 0.8) {
          const rate = Math.min(900, (h - 0.6) * (h - 0.6) * 55 * Math.min(1, sub * 3)) * this.scale;
          const n = poisson(rate * dt);
          const front = Math.abs(dirx * fwd.fx + dirz * fwd.fz) > 0.5 ? fwd.halfLength : fwd.halfWidth;
          for (let i = 0; i < n; i++) {
            const side = rand(-1, 1);
            const ox = px + dirx * front * 0.95 + -dirz * side * fwd.halfWidth;
            const oz = pz + dirz * front * 0.95 + dirx * side * fwd.halfWidth;
            const up = rand(0.6, 1.4) * (0.8 + h * 0.35);
            this.spray.spawn(KIND.DROPLET, ox, surface + 0.05, oz, dirx * h * rand(0.5, 1.0) + -dirz * side * rand(0.5, 1.8), up, dirz * h * rand(0.5, 1.0) + dirx * side * rand(0.5, 1.8), rand(0.01, 0.035), rand(0.8, 1.6), rand(0.5, 0.9), rand(0.08, 0.3));
          }
          if (Math.random() < rate * dt * 0.05) {
            const size = rand(0.5, 1.2);
            this.spray.spawn(KIND.SHEET, px + dirx * front, surface + 0.3, pz + dirz * front, dirx * h * 0.6, rand(0.8, 2.0), dirz * h * 0.6, size, rand(0.5, 1.0), 0.35, 0.4, size * 0.6);
          }
        }
        if (sub > 0.02 && sub < 0.45 && h > 1.4) {
          const rate = Math.min(600, (h - 1.2) * 70 * this.scale);
          for (let w = 0; w < 4; w++) {
            const sx = w < 2 ? -1 : 1;
            const sz = w % 2 === 0 ? -1 : 1;
            const wx = px + fwd.ax * sx * fwd.halfWidth * 0.85 + fwd.fx * sz * fwd.halfLength * 0.68;
            const wz = pz + fwd.az * sx * fwd.halfWidth * 0.85 + fwd.fz * sz * fwd.halfLength * 0.68;
            const n = poisson(rate * dt * 0.25);
            for (let i = 0; i < n; i++) {
              this.spray.spawn(KIND.DROPLET, wx, surface + 0.05, wz, -dirx * h * rand(0.15, 0.45) + fwd.ax * sx * rand(0.3, 1.4), rand(1.2, 2.2) + h * 0.3, -dirz * h * rand(0.15, 0.45) + fwd.az * sx * rand(0.3, 1.4), rand(0.008, 0.03), rand(0.6, 1.3), rand(0.5, 0.9), rand(0.1, 0.4));
            }
          }
        }
        if (sub > 0.3 && body.air > 0) {
          const rate = body.air * 260 * Math.min(1, sub) * this.scale;
          body.air = Math.max(0, body.air - dt * 0.035 * (0.5 + sub));
          const n = poisson(rate * dt);
          const bottom = it.position.y - hy;
          const top = Math.min(surface - 0.05, it.position.y + hy);
          for (let i = 0; i < n; i++) {
            const lx = rand(-1, 1) * fwd.halfWidth * 0.9;
            const lz = rand(-1, 1) * fwd.halfLength * 0.9;
            const bx = px + fwd.ax * lx + fwd.fx * lz;
            const bz = pz + fwd.az * lx + fwd.fz * lz;
            const by = top - Math.random() * Math.max(0.05, Math.min(top - bottom, 0.8));
            if (by >= surface) continue;
            this.bubbles.spawn(KIND.BUBBLE, bx, by, bz, rand(-0.1, 0.1), rand(0.1, 0.4), rand(-0.1, 0.1), rand(0.006, 0.04), rand(3, 8), rand(0.5, 0.9), 0);
          }
        }
        body.rippleTimer -= dt;
        if (sub > 0.05 && Math.abs(it.velocity.y) > 0.4 && body.rippleTimer <= 0) {
          body.rippleTimer = 0.15;
          this.sim.addImpulse(px, pz, Math.max(hx, hz) * 0.8, -0.25 * Math.sign(-it.velocity.y) * Math.min(2, Math.abs(it.velocity.y)), { ripple: 0.6, swell: 1, foam: 0.25, turbulence: 0.5 });
        }
      } else {
        body.rippleTimer -= dt;
        if (sub > 0.08 && sub < 0.98) {
          const interval = h > 0.3 ? Math.max(0.22, 0.6 - h * 0.15) : 1.4;
          if (body.rippleTimer <= 0) {
            body.rippleTimer = interval * rand(0.8, 1.2);
            const strength = (0.12 + h * 0.18) * Math.min(1, sub * 2);
            this.sim.addImpulse(px + vx * 0.15, pz + vz * 0.15, 0.32, -strength, { ripple: 1, swell: 0.12, foam: 0.12 + h * 0.08, turbulence: 0.25 + h * 0.2 });
          }
          if (h > 0.9) {
            const n = poisson((h - 0.8) * 30 * this.scale * dt);
            for (let i = 0; i < n; i++) {
              const a = Math.atan2(vz, vx) + rand(-1.1, 1.1);
              this.spray.spawn(KIND.DROPLET, px + Math.cos(a) * 0.3, surface + 0.04, pz + Math.sin(a) * 0.3, Math.cos(a) * rand(0.3, 1.0) + vx * 0.4, rand(0.8, 2.0), Math.sin(a) * rand(0.3, 1.0) + vz * 0.4, rand(0.006, 0.02), rand(0.5, 1.0), rand(0.5, 0.85), 0.2);
            }
          }
        }
        if (sub >= 0.98 && Math.random() < dt * 1.6) {
          const n = Math.round(rand(4, 14));
          for (let i = 0; i < n; i++) {
            this.bubbles.spawn(KIND.BUBBLE, px + rand(-0.08, 0.08), it.position.y + 0.25, pz + rand(-0.08, 0.08), rand(-0.05, 0.05), rand(0.1, 0.3), rand(-0.05, 0.05), rand(0.004, 0.018), rand(3, 6), 0.8, 0);
          }
        }
      }
      body.prevSub = sub;
    }
    for (const id of this.bodies.keys()) if (!seen.has(id)) this.bodies.delete(id);
  }

  update(dt) {
    this.time += dt;
    this.impactBudget = 40;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].at <= this.time) {
        const p = this.pending[i];
        this.pending.splice(i, 1);
        p.fn();
      }
    }
  }

  onDropletImpact(x, z, size, speed) {
    if (size < 0.012 && Math.random() > 0.35) return;
    if (this.impactBudget <= 0) return;
    this.impactBudget--;
    const s = Math.min(0.5, size * speed * 2.2);
    this.sim.addImpulse(x, z, Math.max(0.12, size * 7), -s, { ripple: 1, swell: 0, foam: size * 6, turbulence: size * 4 });
  }

  onSheetImpact(x, z, size, speed) {
    this.sim.addImpulse(x, z, Math.max(0.3, size * 0.6), -Math.min(0.6, size * speed * 0.08), { ripple: 1, swell: 0.2, foam: 0.35, turbulence: 0.5 });
  }

  onBubbleSurface(x, z, size) {
    if (size < 0.02 || Math.random() > 0.25) return;
    if (this.impactBudget <= 0) return;
    this.impactBudget--;
    this.sim.addImpulse(x, z, 0.15 + size * 4, 0.06, { ripple: 1, swell: 0, foam: 0.12, turbulence: 0.1 });
  }
}

function poisson(mean) {
  const base = Math.floor(mean);
  return base + (Math.random() < mean - base ? 1 : 0);
}
