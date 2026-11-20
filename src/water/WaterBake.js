// Riverside water: CPU bake of river depth, current (with obstacle deflection), wakes and shore distance into GPU textures.
import * as THREE from 'three';

const toHalf = THREE.DataUtils.toHalfFloat;

export class WaterBake {
  constructor({ heightAt, flowAt, obstacles, waterLevel, worldHalf, texel }) {
    this.heightAt = heightAt;
    this.flowAt = flowAt;
    this.obstacles = obstacles;
    this.waterLevel = waterLevel;
    this.worldHalf = worldHalf;
    this.texel = texel;
  }

  build() {
    this.findBounds();
    const { width: W, height: H, x0, z0, dx, dz } = this;
    const depth = new Float32Array(W * H);
    const vx = new Float32Array(W * H);
    const vz = new Float32Array(W * H);
    const wake = new Float32Array(W * H);
    const tmp = { x: 0, y: 0 };
    for (let j = 0; j < H; j++) {
      const z = z0 + (j + 0.5) * dz;
      for (let i = 0; i < W; i++) {
        const x = x0 + (i + 0.5) * dx;
        const k = j * W + i;
        const d = this.waterLevel - this.heightAt(x, z);
        depth[k] = d;
        if (d > -0.5) {
          this.flowAt(x, z, tmp);
          vx[k] = tmp.x;
          vz[k] = tmp.y;
        }
      }
    }
    this.depth = depth;
    this.vx = vx;
    this.vz = vz;
    this.applyObstacles(wake);
    this.wake = wake;
    this.sdf = this.signedDistance();
    this.createTextures();
  }

  findBounds() {
    const half = this.worldHalf;
    const step = 2;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let x = -half; x <= half; x += step) {
      for (let z = -half; z <= half; z += step) {
        if (this.heightAt(x, z) < this.waterLevel + 0.6) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
      }
    }
    if (minX === Infinity) {
      minX = -64;
      maxX = 64;
      minZ = -64;
      maxZ = 64;
    }
    const pad = 16;
    minX = Math.max(-half, minX - pad);
    maxX = Math.min(half, maxX + pad);
    minZ = Math.max(-half, minZ - pad);
    maxZ = Math.min(half, maxZ + pad);
    this.width = Math.min(2048, Math.ceil((maxX - minX) / this.texel));
    this.height = Math.min(2048, Math.ceil((maxZ - minZ) / this.texel));
    this.x0 = minX;
    this.z0 = minZ;
    this.spanX = maxX - minX;
    this.spanZ = maxZ - minZ;
    this.dx = this.spanX / this.width;
    this.dz = this.spanZ / this.height;
  }

  applyObstacles(wake) {
    const { width: W, height: H, x0, z0, dx, dz } = this;
    const flows = this.obstacles.map((o) => {
      const s = this.sample(o.x, o.z + 0, {});
      return { ...o, ux: s.vx, uz: s.vz };
    });
    for (const o of flows) {
      const r = o.radius;
      const speed = Math.hypot(o.ux, o.uz);
      const reach = Math.min(90, 20 + r * 50);
      const i0 = Math.max(0, Math.floor((o.x - reach - x0) / dx));
      const i1 = Math.min(W - 1, Math.ceil((o.x + reach - x0) / dx));
      const j0 = Math.max(0, Math.floor((o.z - reach - z0) / dz));
      const j1 = Math.min(H - 1, Math.ceil((o.z + reach - z0) / dz));
      const fx = speed > 1e-4 ? o.ux / speed : 0;
      const fz = speed > 1e-4 ? o.uz / speed : 1;
      for (let j = j0; j <= j1; j++) {
        const z = z0 + (j + 0.5) * dz;
        for (let i = i0; i <= i1; i++) {
          const x = x0 + (i + 0.5) * dx;
          const k = j * W + i;
          const px = x - o.x;
          const pz = z - o.z;
          const d2 = px * px + pz * pz;
          const d = Math.sqrt(d2);
          if (d < r) {
            this.vx[k] = 0;
            this.vz[k] = 0;
            wake[k] = 1;
            continue;
          }
          const s = px * fx + pz * fz;
          const n = -px * fz + pz * fx;
          if (d < r * 12) {
            const rx = px / d;
            const rz = pz / d;
            const ux = this.vx[k];
            const uz = this.vz[k];
            const dot = ux * rx + uz * rz;
            const q = (r * r) / d2;
            this.vx[k] = ux - q * (2 * dot * rx - ux);
            this.vz[k] = uz - q * (2 * dot * rz - uz);
          }
          let w = Math.exp(-Math.max(0, d - r) / 0.45) * 0.85;
          if (s > 0) {
            const width = r * 1.1 + 0.11 * s;
            const along = Math.exp(-s / 32) * Math.min(1, s / (r * 1.5));
            w += along * Math.exp(-(n * n) / (width * width)) * (0.6 + 0.4 * Math.min(1, speed / 0.4));
            const deficit = 0.55 * Math.exp(-s / 18) * Math.exp(-(n * n) / (width * width * 0.6));
            this.vx[k] *= 1 - deficit;
            this.vz[k] *= 1 - deficit;
          }
          wake[k] = Math.min(1, Math.max(wake[k], w));
        }
      }
    }
  }

  signedDistance() {
    const { width: W, height: H, dx } = this;
    const dist = new Float32Array(W * H).fill(1e6);
    const wet = (k) => this.depth[k] > 0;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const w = wet(k);
        if ((i > 0 && wet(k - 1) !== w) || (i < W - 1 && wet(k + 1) !== w) || (j > 0 && wet(k - W) !== w) || (j < H - 1 && wet(k + W) !== w)) {
          dist[k] = 0.5 * dx;
        }
      }
    }
    const a = dx;
    const b = dx * Math.SQRT2;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        let v = dist[k];
        if (i > 0) v = Math.min(v, dist[k - 1] + a);
        if (j > 0) {
          v = Math.min(v, dist[k - W] + a);
          if (i > 0) v = Math.min(v, dist[k - W - 1] + b);
          if (i < W - 1) v = Math.min(v, dist[k - W + 1] + b);
        }
        dist[k] = v;
      }
    }
    for (let j = H - 1; j >= 0; j--) {
      for (let i = W - 1; i >= 0; i--) {
        const k = j * W + i;
        let v = dist[k];
        if (i < W - 1) v = Math.min(v, dist[k + 1] + a);
        if (j < H - 1) {
          v = Math.min(v, dist[k + W] + a);
          if (i < W - 1) v = Math.min(v, dist[k + W + 1] + b);
          if (i > 0) v = Math.min(v, dist[k + W - 1] + b);
        }
        dist[k] = v;
      }
    }
    for (let k = 0; k < W * H; k++) dist[k] = Math.min(60, dist[k]) * (wet(k) ? 1 : -1);
    return dist;
  }

  createTextures() {
    const { width: W, height: H } = this;
    const a = new Uint16Array(W * H * 4);
    const b = new Uint16Array(W * H * 4);
    for (let k = 0; k < W * H; k++) {
      a[k * 4] = toHalf(Math.max(-8, Math.min(30, this.depth[k])));
      a[k * 4 + 1] = toHalf(this.vx[k]);
      a[k * 4 + 2] = toHalf(this.vz[k]);
      a[k * 4 + 3] = toHalf(this.wake[k]);
      b[k * 4] = toHalf(this.sdf[k]);
      b[k * 4 + 1] = 0;
      b[k * 4 + 2] = 0;
      b[k * 4 + 3] = 0;
    }
    const make = (data) => {
      const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.colorSpace = THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    this.textureA = make(a);
    this.textureB = make(b);
    this.rect = new THREE.Vector4(this.x0, this.z0, 1 / this.spanX, 1 / this.spanZ);
  }

  sample(x, z, out) {
    const { width: W, height: H } = this;
    const fx = Math.min(W - 1.001, Math.max(0, (x - this.x0) / this.dx - 0.5));
    const fz = Math.min(H - 1.001, Math.max(0, (z - this.z0) / this.dz - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const k = j * W + i;
    const lerp2 = (arr) => {
      const a = arr[k] + (arr[k + 1] - arr[k]) * tx;
      const b = arr[k + W] + (arr[k + W + 1] - arr[k + W]) * tx;
      return a + (b - a) * tz;
    };
    out.depth = lerp2(this.depth);
    out.vx = this.vx ? lerp2(this.vx) : 0;
    out.vz = this.vz ? lerp2(this.vz) : 0;
    return out;
  }

  dispose() {
    this.textureA?.dispose();
    this.textureB?.dispose();
  }
}
