// Riverside water: GPU two-band heightfield wave simulation in a camera-following window (shore/obstacle walls, current advection, foam).
import * as THREE from 'three';
import { FullscreenPass, passMaterial, makeTarget, saveState, restoreState } from '../gpu.js';
import { ADVECT_FRAG, AUX_FRAG, STEP_FRAG, MAX_IMPULSES, MAX_INTERACTORS, MAX_OBSTACLES } from './simShaders.js';

const SUBSTEP = 1 / 120;

export class RippleSim {
  constructor(renderer, { resolution = 512, size = 80, bake, obstacles = [], floatLinear = true }) {
    this.renderer = renderer;
    this.N = resolution;
    this.size = size;
    this.dx = size / resolution;
    this.bake = bake;
    this.allObstacles = obstacles;
    this.obstacles = obstacles.slice(0, MAX_OBSTACLES);
    this.floatLinear = floatLinear;
    this.window = new THREE.Vector4(0, 0, size, 1 / size);
    this.originI = null;
    this.shift = new THREE.Vector2();
    this.impulses = [];
    this.interactorCount = 0;
    this.simTime = 0;
    this.params = {
      rippleSpeed: 1.15,
      rippleDamping: 0.14,
      swellMaxSpeed: 3.6,
      swellDamping: 0.06,
      foamLife: 11,
      turbulenceLife: 2.2,
      foamThreshold: 0.55,
      foamGain: 0.9,
      pushRipple: 18,
      pushSwell: 26,
      wadeJitter: 5.0,
      verticalCoupling: 0.8,
    };
  }

  init() {
    const N = this.N;
    const type = this.floatLinear ? THREE.FloatType : THREE.HalfFloatType;
    const opts = { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.state = [makeTarget(N, N, opts), makeTarget(N, N, opts)];
    this.aux = [makeTarget(N, N, { type: THREE.HalfFloatType }), makeTarget(N, N, { type: THREE.HalfFloatType })];
    this.current = 0;
    this.auxCurrent = 0;
    const bakeUniforms = () => ({
      uBakeA: { value: this.bake.textureA },
      uBakeB: { value: this.bake.textureB },
      uBakeRect: { value: this.bake.rect },
      uWaterLevel: { value: 0 },
      uTime: { value: 0 },
    });
    const common = () => ({
      ...bakeUniforms(),
      uWindow: { value: this.window },
      uN: { value: N },
      uShift: { value: this.shift },
      uDt: { value: SUBSTEP },
    });
    const vec4s = (n) => Array.from({ length: n }, () => new THREE.Vector4());
    this.impA = vec4s(MAX_IMPULSES);
    this.impB = vec4s(MAX_IMPULSES);
    this.intA = vec4s(MAX_INTERACTORS);
    this.intB = vec4s(MAX_INTERACTORS);
    this.intC = vec4s(MAX_INTERACTORS);
    const obstacleValues = (this.obstacleValues = Array.from({ length: MAX_OBSTACLES }, (_, i) => {
      const o = this.obstacles[i];
      return o ? new THREE.Vector3(o.x, o.z, o.radius) : new THREE.Vector3(1e6, 1e6, 0);
    }));
    const interactorUniforms = () => ({
      uIntA: { value: this.intA },
      uIntB: { value: this.intB },
      uIntC: { value: this.intC },
      uIntCount: { value: 0 },
    });
    const impulseUniforms = () => ({
      uImpA: { value: this.impA },
      uImpB: { value: this.impB },
      uImpCount: { value: 0 },
    });
    this.advectPass = new FullscreenPass(passMaterial(ADVECT_FRAG, { ...common(), uState: { value: null } }));
    this.auxPass = new FullscreenPass(passMaterial(AUX_FRAG, {
      ...common(),
      ...interactorUniforms(),
      ...impulseUniforms(),
      uPrevAux: { value: null },
      uPrevState: { value: null },
      uObstacles: { value: obstacleValues },
      uObstacleCount: { value: this.obstacles.length },
      uFoamParams: { value: new THREE.Vector4() },
    }));
    this.stepPass = new FullscreenPass(passMaterial(STEP_FRAG, {
      ...common(),
      ...interactorUniforms(),
      ...impulseUniforms(),
      uState: { value: null },
      uAux: { value: null },
      uWaveParams: { value: new THREE.Vector4() },
      uIntGain: { value: new THREE.Vector4() },
      uDx: { value: this.dx },
      uSimTime: { value: 0 },
    }));
    const state = saveState(this.renderer);
    this.renderer.setClearColor(0x000000, 0);
    for (const t of [...this.state, ...this.aux]) {
      this.renderer.setRenderTarget(t);
      this.renderer.clear(true, false, false);
    }
    restoreState(this.renderer, state);
  }

  get stateTexture() {
    return this.state[this.current].texture;
  }

  get auxTexture() {
    return this.aux[this.auxCurrent].texture;
  }

  pickObstacles(x, z) {
    if (this.allObstacles.length <= MAX_OBSTACLES) return;
    const sorted = this.allObstacles
      .map((o) => ({ o, d: Math.hypot(o.x - x, o.z - z) - o.radius }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_OBSTACLES);
    sorted.forEach(({ o }, i) => this.obstacleValues[i].set(o.x, o.z, o.radius));
  }

  setCenter(x, z) {
    this.pickObstacles(x, z);
    const dx = this.dx;
    const half = this.N / 2;
    const ix = Math.round(x / dx) - half;
    const iz = Math.round(z / dx) - half;
    if (this.originI === null) {
      this.originI = { x: ix, z: iz };
      this.shift.set(0, 0);
    } else {
      this.shift.set(ix - this.originI.x, iz - this.originI.z);
      this.originI.x = ix;
      this.originI.z = iz;
    }
    this.window.set(ix * dx, iz * dx, this.size, 1 / this.size);
  }

  addImpulse(x, z, radius, strength, { ripple = 1, swell = 0.5, foam = 0, turbulence = 0 } = {}) {
    const w = this.window;
    const m = radius * 2;
    if (x < w.x - m || z < w.y - m || x > w.x + w.z + m || z > w.y + w.z + m) return;
    this.impulses.push({ x, z, radius: Math.max(radius, this.dx * 1.5), strength, ripple, swell, foam, turbulence });
  }

  setInteractors(list) {
    let n = 0;
    for (const it of list) {
      if (n >= MAX_INTERACTORS) break;
      this.intA[n].set(it.x, it.z, it.vx, it.vz);
      this.intB[n].set(it.halfX, it.halfZ, it.cos, it.sin);
      this.intC[n].set(it.submersion, it.vy, it.foamGain, it.kind);
      n++;
    }
    this.interactorCount = n;
  }

  packImpulses() {
    let list = this.impulses;
    if (list.length > MAX_IMPULSES) {
      list.sort((a, b) => Math.abs(b.strength * b.radius) - Math.abs(a.strength * a.radius));
      list = list.slice(0, MAX_IMPULSES);
    }
    list.forEach((p, i) => {
      this.impA[i].set(p.x, p.z, p.radius, p.strength);
      this.impB[i].set(p.foam, p.turbulence, p.ripple, p.swell);
    });
    this.impulses = [];
    return list.length;
  }

  step(dt) {
    const renderer = this.renderer;
    const p = this.params;
    const state = saveState(renderer);
    const frameDt = Math.min(dt, 1 / 15);
    const maxDt = (0.45 * this.dx) / Math.max(p.swellMaxSpeed, p.rippleSpeed);
    const steps = Math.max(1, Math.min(3, Math.ceil(frameDt / Math.max(maxDt, SUBSTEP))));
    const sub = frameDt / steps;
    this.simTime += frameDt;
    const impCount = this.packImpulses();

    const au = this.auxPass.material.uniforms;
    au.uDt.value = frameDt;
    au.uPrevAux.value = this.aux[this.auxCurrent].texture;
    au.uPrevState.value = this.state[this.current].texture;
    au.uImpCount.value = impCount;
    au.uIntCount.value = this.interactorCount;
    au.uFoamParams.value.set(p.foamLife, p.turbulenceLife, p.foamThreshold, p.foamGain);
    this.auxCurrent = 1 - this.auxCurrent;
    this.auxPass.render(renderer, this.aux[this.auxCurrent]);

    const ad = this.advectPass.material.uniforms;
    ad.uDt.value = frameDt;
    ad.uState.value = this.state[this.current].texture;
    this.current = 1 - this.current;
    this.advectPass.render(renderer, this.state[this.current]);

    const su = this.stepPass.material.uniforms;
    su.uAux.value = this.aux[this.auxCurrent].texture;
    su.uDt.value = sub;
    su.uIntCount.value = this.interactorCount;
    su.uWaveParams.value.set(p.rippleSpeed, p.rippleDamping, p.swellMaxSpeed, p.swellDamping);
    su.uIntGain.value.set(p.pushRipple, p.pushSwell, p.wadeJitter, p.verticalCoupling);
    su.uSimTime.value = this.simTime;
    for (let i = 0; i < steps; i++) {
      su.uImpCount.value = i === 0 ? impCount : 0;
      su.uState.value = this.state[this.current].texture;
      this.current = 1 - this.current;
      this.stepPass.render(renderer, this.state[this.current]);
    }
    this.shift.set(0, 0);
    restoreState(renderer, state);
  }

  dispose() {
    [...this.state, ...this.aux].forEach((t) => t.dispose());
    this.advectPass.dispose();
    this.auxPass.dispose();
    this.stepPass.dispose();
  }
}
