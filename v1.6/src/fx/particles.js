// Costa del Gzowo: lightweight CPU particle pools (sparks, smoke, dust, debris chips, glass) drawn as soft point sprites.
import * as THREE from 'three';
import { LAYERS } from '../config.js';

const VERT = `
attribute vec4 aColor;
attribute float aSize;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * projectionMatrix[1][1] * uHeight * 0.5 / max(-mv.z, 0.05);
}`;
const FRAG = `
varying vec4 vColor;
uniform float uSoft;
uniform float uFall;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = mix(1.0, pow(1.0 - d, uFall), uSoft);
  gl_FragColor = vec4(vColor.rgb * a * vColor.a, a * vColor.a * uAlpha);
}`;

class Pool {
  constructor(scene, count, { additive, soft, gravity, drag, layer, cool = false, fall = 1.6 }) {
    this.count = count;
    this.gravity = gravity;
    this.drag = drag;
    this.cool = cool;
    this.cursor = 0;
    this.alive = 0;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.col = new Float32Array(count * 4);
    this.size = new Float32Array(count);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.base = new Float32Array(count * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uHeight: { value: 720 }, uSoft: { value: soft ? 1 : 0 }, uFall: { value: fall }, uAlpha: { value: additive ? 0 : 1 } };
    const material = new THREE.ShaderMaterial({
      vertexShader: 'uniform float uHeight;\n' + VERT,
      fragmentShader: 'uniform float uAlpha;\n' + FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
    this.points.layers.set(layer);
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, r, g, b, a, size, life, grow = 0, fade = 1) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.base.set([r, g, b, a, size, grow], i * 6);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.alive = Math.max(this.alive, 1);
    return i;
  }

  update(dt) {
    const { pos, vel, col, size, life, maxLife, base } = this;
    const drag = Math.exp(-this.drag * dt);
    let any = false;
    for (let i = 0; i < this.count; i++) {
      if (life[i] <= 0) {
        if (size[i] !== 0) size[i] = 0;
        continue;
      }
      any = true;
      life[i] -= dt;
      const k = Math.max(life[i] / maxLife[i], 0);
      const o = i * 3;
      vel[o] *= drag;
      vel[o + 1] = vel[o + 1] * drag - this.gravity * dt;
      vel[o + 2] *= drag;
      pos[o] += vel[o] * dt;
      pos[o + 1] += vel[o + 1] * dt;
      pos[o + 2] += vel[o + 2] * dt;
      const b = i * 6;
      const fadeIn = Math.min(1, (1 - k) * 8);
      col[i * 4] = base[b];
      col[i * 4 + 1] = this.cool ? base[b + 1] * (0.22 + 0.78 * k * k) : base[b + 1];
      col[i * 4 + 2] = this.cool ? base[b + 2] * k * k * k : base[b + 2];
      col[i * 4 + 3] = base[b + 3] * (this.cool ? Math.min(1, k * 2.2) : k) * fadeIn;
      size[i] = base[b + 4] + base[b + 5] * (1 - k);
    }
    const g = this.points.geometry;
    if (any || this.alive) {
      g.attributes.position.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
    }
    this.alive = any ? 1 : 0;
    this.points.visible = any;
  }
}

export function createParticles(scene) {
  const sparks = new Pool(scene, 400, { additive: true, soft: false, gravity: 9.8, drag: 0.6, layer: LAYERS.WATER });
  const smoke = new Pool(scene, 600, { additive: false, soft: true, gravity: -0.5, drag: 1.4, layer: LAYERS.WATER });
  const chips = new Pool(scene, 400, { additive: false, soft: false, gravity: 9.8, drag: 0.3, layer: LAYERS.WATER });
  const flames = new Pool(scene, 520, { additive: true, soft: true, gravity: -3.2, drag: 1.1, layer: LAYERS.WATER, cool: true, fall: 3.2 });
  const rnd = (a) => (Math.random() - 0.5) * 2 * a;
  return {
    sparks, smoke, chips, flames,
    setHeight(h) {
      for (const p of [sparks, smoke, chips, flames]) p.uniforms.uHeight.value = h;
    },
    update(dt) {
      sparks.update(dt);
      smoke.update(dt);
      chips.update(dt);
      flames.update(dt);
    },
    flame(p, size = 0.4, heat = 1, tint = null) {
      const c = tint || [1.9, 0.92, 0.3];
      flames.emit(p.x + rnd(size * 0.6), p.y + rnd(size * 0.25), p.z + rnd(size * 0.6), rnd(0.45), 1.1 + Math.random() * 1.6, rnd(0.45), c[0] * heat, c[1] * heat, c[2] * heat, 0.8, size * (0.75 + Math.random() * 0.8), 0.32 + Math.random() * 0.45, -size * 0.4);
    },
    burstSparks(p, n, dir, speed) {
      for (let i = 0; i < n; i++) sparks.emit(p.x, p.y, p.z, dir.x * speed * Math.random() + rnd(2.5), dir.y * speed * Math.random() + Math.random() * 3, dir.z * speed * Math.random() + rnd(2.5), 30, 14 + Math.random() * 8, 3, 1, 0.035, 0.25 + Math.random() * 0.5);
    },
    burstChips(p, n, color, speed = 4) {
      for (let i = 0; i < n; i++) chips.emit(p.x + rnd(0.2), p.y + rnd(0.2), p.z + rnd(0.2), rnd(speed), Math.random() * speed, rnd(speed), color[0], color[1], color[2], 1, 0.03 + Math.random() * 0.04, 0.8 + Math.random() * 0.9);
    },
    puff(p, color, alpha, size, life, vy = 0.6, spread = 0.4) {
      smoke.emit(p.x + rnd(0.15), p.y, p.z + rnd(0.15), rnd(spread), vy + Math.random() * 0.4, rnd(spread), color[0], color[1], color[2], alpha, size, life, size * 2.4);
    },
  };
}
